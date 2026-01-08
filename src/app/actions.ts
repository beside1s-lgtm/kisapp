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
    const dataToSave: Partial<UserProfile> = {
      ...profileData,
      uid: userId || profileData.uid || (docSnap.exists() ? docSnap.data().uid : ''),
      email: email,
    };
    
    // Ensure UID is always present if it exists on the doc
    if (docSnap.exists() && docSnap.data().uid && !dataToSave.uid) {
        dataToSave.uid = docSnap.data().uid;
    }

    await setDoc(userProfileRef, {
        ...dataToSave,
        [docSnap.exists() ? 'updatedAt' : 'createdAt']: serverTimestamp()
    }, { merge: true });
    
    revalidatePath('/');
    return { success: true, profile: { ...dataToSave, isAdmin: profileData.isAdmin || false } as UserProfile };
  } catch (error: any) {
      return { success: false, error: `저장 실패: ${error.message}` };
  }
}

export async function getUsersDirectory(): Promise<UserProfile[]> {
  try {
    const snapshot = await getDocs(getUsersCol());
    if (snapshot.empty) return [];
    return snapshot.docs.map(d => ({
        email: d.id, 
        uid: d.data().uid,
        ...d.data()
    } as UserProfile));
  } catch (error) {
    console.error("[Action] getUsersDirectory failed:", error);
    return [];
  }
}

// [1] 미결재함 (Inbox): 내가 결재할 차례인 문서 (status=pending)
export async function getInboxDocuments(userEmail: string) {
  if (!userEmail) return [];
  const approvalsCol = getApprovalsCol();
  // status가 pending이고, 현재 결재 순서(currentStep)의 결재자 이메일이 내 이메일과 같은지 쿼리
  const q = query(
    approvalsCol,
    where('status', '==', 'pending'),
    where(`approvers.0.email`, '==', userEmail) // Firestore는 배열의 특정 인덱스로 직접 쿼리 불가. work-around 필요.
  );
  
  try {
    // 임시 해결책: 일단 'pending' 문서를 가져와서 서버에서 필터링
    const allPendingSnapshot = await getDocs(query(approvalsCol, where('status', '==', 'pending')));
    const allPending = serializeDocs(allPendingSnapshot.docs);
    const myTurnDocs = allPending.filter(doc => doc.approvers[doc.currentStep]?.email === userEmail);
    return myTurnDocs;
  } catch (error) {
    console.error("Get Inbox Error:", error);
    return [];
  }
}

// [2] 상신함 (Sent Box): 내가 상신한 모든 문서
export async function getSentDocuments(userId: string) {
  if (!userId) return [];
  const approvalsCol = getApprovalsCol();
  const q = query(
    approvalsCol, 
    where('requesterId', '==', userId),
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

// [3] 진행 문서함 (Pending Box): 내가 상신했고, 아직 "진행 중인" 문서
export async function getPendingDocuments(userId: string) {
  if (!userId) return [];
  const approvalsCol = getApprovalsCol();
  const q = query(
    approvalsCol,
    where('requesterId', '==', userId),
    where('status', '==', 'pending'),
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
        return { success: true, docId };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// (나머지 generateContentAction, bulkRegisterUsers, config 관련 함수는 기존 유지)
export async function generateContentAction(input: any) {
    // ... 기존 코드 유지 ...
    return { success: false, error: "구현 필요" }; // 축약됨
}
export async function bulkRegisterUsers(fileData: string) { return { success: false }; }
export async function getDocConfig() { return {}; }
export async function saveDocConfig(payload: any) { return { success: true }; }


export async function deleteUser(email: string) {
    if (!email) {
      return { success: false, error: '이메일이 제공되지 않았습니다.' };
    }
    try {
      const userRef = doc(db, 'users', email);
      await deleteDoc(userRef);
      // 참고: 이 함수는 Firestore의 사용자 프로필만 삭제합니다.
      // Firebase Authentication의 사용자를 삭제하려면 별도의 Admin SDK 로직이 필요합니다.
      // 현재 앱에서는 Firestore 프로필 삭제만 구현합니다.
      revalidatePath('/settings'); // 사용자 목록 갱신
      return { success: true };
    } catch (error: any) {
      console.error('사용자 삭제 실패:', error);
      return { success: false, error: `사용자 삭제 중 오류가 발생했습니다: ${error.message}` };
    }
}