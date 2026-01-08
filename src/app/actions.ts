'use server';

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  Timestamp,
  writeBatch,
  deleteDoc,
  or,
  and,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/firebase';
import type {
  ApprovalDoc,
  ApprovalDocPayload,
  DocConfig,
  UserProfile,
} from '@/lib/types';
import { generateDocumentContent } from '@/ai/flows/generate-document-content';
import { z } from 'zod';
import { FirestorePermissionError } from '@/lib/errors';
import * as xlsx from 'xlsx';

// Firestore collections
function getUsersCol() { return collection(db, 'users'); }
function getApprovalsCol() { return collection(db, 'approvals'); }
function getSettingsCol() { return collection(db, 'settings'); }

function serializeDocs(docs: any[]): any[] {
  if (!docs) return [];
  return docs.map(d => {
    const data = d.data();
    if (!data) return { id: d.id };
    return {
      ...data,
      id: d.id,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
      completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate().toISOString() : (data.completedAt || null),
      approvers: data.approvers?.map((approver: any) => ({
        ...approver,
        approvedAt: approver.approvedAt instanceof Timestamp ? approver.approvedAt.toDate().toISOString() : approver.approvedAt,
      })) || [],
    }
  })
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  if (!email) return null;
  const userDocRef = doc(getUsersCol(), email);
  try {
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        name: data?.name || '',
        role: data?.role || '',
        signature: data?.signature || '',
        uid: data?.uid || '',
        email: snap.id,
        isAdmin: data?.isAdmin || false,
    };
  } catch (error) {
     console.error(`[Action] getUserProfileByEmail error:`, error);
     return null;
  }
}

export async function saveUserProfile(userId: string, email: string, profileData: Partial<UserProfile>) {
  if (!email || !profileData) return { success: false, error: 'Invalid data' };
  const userProfileRef = doc(getUsersCol(), email);
  try {
    const docSnap = await getDoc(userProfileRef);
    const dataToSave: Partial<UserProfile> & { updatedAt?: any, createdAt?: any } = {
      ...profileData,
      uid: userId || profileData.uid || (docSnap.exists() ? docSnap.data().uid : ''),
      email: email,
    };
    
    // Ensure UID is always present if it exists on the doc or passed in
    if (!dataToSave.uid) {
        if(userId) dataToSave.uid = userId;
        else if(docSnap.exists() && docSnap.data().uid) dataToSave.uid = docSnap.data().uid;
    }
    
    const timestamp = serverTimestamp();
    if (docSnap.exists()) {
        dataToSave.updatedAt = timestamp;
    } else {
        dataToSave.createdAt = timestamp;
    }

    await setDoc(userProfileRef, dataToSave, { merge: true });
    
    revalidatePath('/');
    
    // Server actions must return plain objects.
    const { updatedAt, createdAt, ...returnProfile } = dataToSave;
    
    const finalProfile: UserProfile = {
      name: returnProfile.name || '',
      email: returnProfile.email || email,
      role: returnProfile.role || '',
      signature: returnProfile.signature || '',
      isAdmin: returnProfile.isAdmin || false,
      uid: returnProfile.uid || userId,
    };


    return { success: true, profile: finalProfile };
  } catch (error: any) {
      return { success: false, error: `저장 실패: ${error.message}` };
  }
}


export async function getUsersDirectory(): Promise<UserProfile[]> {
  try {
    const snapshot = await getDocs(getUsersCol());
    if (snapshot.empty) return [];
    // Firestore 문서 ID를 이메일로 사용하고, 문서 내의 다른 필드와 결합
    return snapshot.docs.map(d => {
        const data = d.data();
        return {
            email: d.id, 
            uid: data.uid,
            name: data.name,
            role: data.role,
            signature: data.signature,
            isAdmin: data.isAdmin,
        } as UserProfile;
    });
  } catch (error) {
    console.error("[Action] getUsersDirectory failed:", error);
    return [];
  }
}

// [1] 미결재함 (Inbox): 내가 결재할 차례인 문서 (status=pending)
export async function getInboxDocuments(userEmail: string) {
  if (!userEmail) return [];
  const approvalsCol = getApprovalsCol();
  
  try {
    // Firestore 쿼리는 배열의 특정 인덱스에 접근하는 것을 직접 지원하지 않습니다.
    // 따라서, 모든 'pending' 문서를 가져와서 서버 측에서 필터링합니다.
    const allPendingSnapshot = await getDocs(query(approvalsCol, where('status', '==', 'pending'), orderBy('createdAt', 'desc')));
    
    const allPending = serializeDocs(allPendingSnapshot.docs);
    
    const myTurnDocs = allPending.filter(doc => {
        // currentStep이 유효한 인덱스인지 확인
        if (doc.currentStep >= 0 && doc.currentStep < doc.approvers.length) {
            // 현재 결재자 정보에 접근
            const currentApprover = doc.approvers[doc.currentStep];
            // 이메일 주소를 비교 (대소문자 구분 없이)
            return currentApprover?.email?.toLowerCase() === userEmail?.toLowerCase();
        }
        return false;
    });

    return myTurnDocs;
  } catch (error) {
    console.error("Get Inbox Error:", error);
    return [];
  }
}


// [2] 상신함 (Sent Box): 내가 상신한 모든 문서 (과거 데이터 포함)
export async function getSentDocuments(userId: string, userEmail: string) {
  if (!userId && !userEmail) return [];
  const approvalsCol = getApprovalsCol();

  // requesterId가 없거나 비어있는 아주 오래된 문서를 대비해 or 쿼리 사용
  const q = query(
    approvalsCol, 
    or(
        where('requesterId', '==', userId),
        where('requesterEmail', '==', userEmail)
    ),
    orderBy('createdAt', 'desc')
  );

  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs);
  } catch (error) {
    console.error("Get Sent Docs Error:", error);
    return [];
  }
}

// [3] 진행 문서함 (Pending Box): 내가 상신했고, 아직 "진행 중인" 문서 (과거 데이터 포함)
export async function getPendingDocuments(userId: string, userEmail: string) {
  if (!userId && !userEmail) return [];
  const approvalsCol = getApprovalsCol();
  
  // 'requesterId' 또는 'requesterEmail'이 일치하고, 'status'가 'pending'인 문서를 찾습니다.
  const q = query(
    approvalsCol,
    and(
        or(
            where('requesterId', '==', userId),
            where('requesterEmail', '==', userEmail)
        ),
        where('status', '==', 'pending')
    ),
    orderBy('createdAt', 'desc')
  );

  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs);
  } catch (error) {
    console.error("Get Pending Docs Error:", error);
    return [];
  }
}

// [4] 문서등록대장 (Registry): 결재 완료된 모든 공개 문서
export async function getRegistryDocuments(userId: string, userEmail: string) {
    const approvalsCol = getApprovalsCol();
    // 'approved' 상태인 모든 문서를 가져옵니다.
    // 참고: 비공개 문서도 일단 목록에는 표시될 수 있으나, 접근 시 권한 확인이 필요합니다. (향후 구현)
    const q = query(approvalsCol, where('status', '==', 'approved'), orderBy('completedAt', 'desc'));
    try {
        const snapshot = await getDocs(q);
        return serializeDocs(snapshot.docs);
    } catch (error) {
        console.error("Get Registry Docs Error:", error);
        return [];
    }
}

export async function getDocumentById(docId: string) {
  try {
    const snapshot = await getDoc(doc(getApprovalsCol(), docId));
    // 참고: 현재는 문서 존재 여부만 확인합니다. 향후 여기서 사용자 권한 검사를 추가할 수 있습니다.
    // (예: 기안자, 결재선 참여자, 공람자, 관리자인지 확인)
    return snapshot.exists() ? serializeDocs([snapshot])[0] : null;
  } catch (error) {
     console.error("Get Doc By ID Error:", error);
     return null;
  }
}

export async function createDocument(payload: ApprovalDocPayload, userId: string, userProfile: UserProfile) {
  const newDocRef = doc(getApprovalsCol());
  const settingsRef = doc(getSettingsCol(), 'docConfig');

  try {
    const finalDocNoStr = await runTransaction(db, async (transaction) => {
      const settingsSnap = await transaction.get(settingsRef);
      let nextNum = 1;
      if (settingsSnap.exists()) {
        nextNum = (settingsSnap.data() as DocConfig).nextNumber || 1;
        transaction.update(settingsRef, { nextNumber: nextNum + 1 });
      } else {
        transaction.set(settingsRef, { nextNumber: 2 });
      }
      return `Kish-초등-${nextNum}`;
    });

    const hasApprovers = payload.approvers && payload.approvers.length > 0;
    const newDocData: any = {
      ...payload,
      docNo: finalDocNoStr,
      requesterId: userProfile.uid,
      requesterName: userProfile.name,
      requesterEmail: userProfile.email,
      requesterRole: userProfile.role,
      requesterSignature: userProfile.signature || '',
      currentStep: 0,
      status: hasApprovers ? 'pending' : 'approved', // 결재자 없으면 즉시 완료
      createdAt: serverTimestamp(),
      completedAt: hasApprovers ? null : serverTimestamp(),
    };

    await setDoc(newDocRef, newDocData);
    revalidatePath('/pending'); // 진행함 갱신
    revalidatePath('/sent'); // 상신함 갱신
    revalidatePath('/inbox'); // 미결재함 갱신
    return { success: true, docId: newDocRef.id, docNo: finalDocNoStr };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function approveDocument(docId: string, userId: string, userProfile: UserProfile) {
    const docRef = doc(getApprovalsCol(), docId);
    try {
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(docRef);
            if (!docSnap.exists()) throw new Error("문서가 없습니다.");
            
            const data = docSnap.data() as ApprovalDoc;
            const step = data.currentStep;
            
            // 현재 결재 차례인지 확인
            if (data.approvers[step]?.email?.toLowerCase() !== userProfile.email?.toLowerCase()) {
                throw new Error("결재 권한이 없거나 차례가 아닙니다.");
            }

            const updatedApprovers = [...data.approvers];
            updatedApprovers[step] = {
                ...updatedApprovers[step],
                status: 'approved',
                signature: userProfile.signature || '',
                approvedAt: new Date().toISOString(),
                approverName: userProfile.name,
            };

            const isFinal = updatedApprovers[step].type === 'final' || step === updatedApprovers.length - 1;
            
            transaction.update(docRef, {
                approvers: updatedApprovers,
                currentStep: isFinal ? step : step + 1, // 완료되면 step 유지, 아니면 증가
                status: isFinal ? 'approved' : 'pending', // 완료되면 approved -> 상신함/대장으로 이동됨
                completedAt: isFinal ? serverTimestamp() : null,
            });
        });

        revalidatePath('/inbox');  // 내 미결재함 갱신
        revalidatePath('/pending'); // 기안자의 진행함 갱신
        revalidatePath('/sent');    // 완료 시 기안자의 상신함 갱신
        revalidatePath('/registry'); // 완료 시 대장 갱신
        revalidatePath(`/documents/${docId}`); // 현재 문서 페이지 갱신
        return { success: true, docId };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function generateContentAction(input: any) {
    const parsedInput = z.object({
        title: z.string(),
        approvers: z.array(z.any()),
        attachments: z.array(z.any()).optional(),
    }).safeParse(input);

    if (!parsedInput.success) {
        return { success: false, error: '유효하지 않은 입력입니다.' };
    }
    try {
        const result = await generateDocumentContent(parsedInput.data);
        return { success: true, content: result.content };
    } catch (e: any) {
        console.error("AI Generation Error: ", e);
        return { success: false, error: 'AI 콘텐츠 생성에 실패했습니다: ' + e.message };
    }
}
export async function bulkRegisterUsers(fileData: string) {
    try {
        const base64Data = fileData.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const users = xlsx.utils.sheet_to_json(worksheet) as { email: string; name: string; role: string }[];
        
        if (!users.length) return { success: false, error: '엑셀 파일에 데이터가 없습니다.' };

        const batch = writeBatch(db);
        let count = 0;

        for (const user of users) {
            if (user.email && user.name && user.role) {
                const userRef = doc(db, "users", user.email.toLowerCase());
                // uid는 인증 시 자동으로 연결되므로, 여기서는 프로필 정보만 설정합니다.
                batch.set(userRef, {
                    name: user.name,
                    role: user.role,
                    email: user.email.toLowerCase(),
                    isAdmin: false, // 기본값
                    signature: '', // 기본값
                }, { merge: true });
                count++;
            }
        }
        await batch.commit();
        revalidatePath('/settings');
        return { success: true, summary: `${count}명의 사용자가 등록/업데이트되었습니다.` };

    } catch (error: any) {
        return { success: false, error: `일괄 등록 실패: ${error.message}` };
    }
}

export async function getDocConfig() {
    try {
        const snap = await getDoc(doc(getSettingsCol(), 'docConfig'));
        return snap.exists() ? (snap.data() as DocConfig) : {};
    } catch (e) {
        return {};
    }
}
export async function saveDocConfig(payload: any) {
    try {
        await setDoc(doc(getSettingsCol(), 'docConfig'), payload, { merge: true });
        revalidatePath('/'); // 전체 앱에 영향을 줄 수 있으므로 넓게 revalidate
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteUser(email: string) {
    if (!email) {
      return { success: false, error: '이메일이 제공되지 않았습니다.' };
    }
    try {
      const userRef = doc(db, 'users', email);
      await deleteDoc(userRef);
      revalidatePath('/settings'); // 사용자 목록 갱신
      return { success: true };
    } catch (error: any) {
      console.error('사용자 삭제 실패:', error);
      return { success: false, error: `사용자 삭제 중 오류가 발생했습니다: ${error.message}` };
    }
}
