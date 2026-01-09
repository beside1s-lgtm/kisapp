

'use server';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  Timestamp,
  writeBatch,
  deleteDoc as firestoreDeleteDoc,
  or,
  and,
  updateDoc as firestoreUpdateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  ApprovalDoc,
  ApprovalDocPayload,
  DocConfig,
  UserProfile,
} from '@/lib/types';
import * as xlsx from 'xlsx';

// Firestore collections
function getUsersCol() { return collection(db, 'users'); }
function getApprovalsCol() { return collection(db, 'approvals'); }
function getSettingsCol() { return collection(db, 'settings'); }

// Helper: Serialize Firestore timestamps to ISO strings
function serializeDocs(docs: any[], sortBy: 'createdAt' | 'completedAt' = 'createdAt'): any[] {
  if (!docs) return [];
  const serialized = docs.map(d => {
    const data = d.data();
    if (!data) return { id: d.id };
    
    const safeToISOString = (timestamp: any) => {
      if (!timestamp) return null;
      if (timestamp instanceof Timestamp) {
        return timestamp.toDate().toISOString();
      }
      if (typeof timestamp === 'string') {
        if (!isNaN(Date.parse(timestamp))) return timestamp;
      }
      if (timestamp?.toDate) {
        return timestamp.toDate().toISOString();
      }
      try {
        return new Date(timestamp).toISOString();
      } catch (e) {
        return null;
      }
    };

    return {
      ...data,
      id: d.id,
      createdAt: safeToISOString(data.createdAt),
      completedAt: safeToISOString(data.completedAt),
      approvers: data.approvers?.map((approver: any) => ({
        ...approver,
        approvedAt: safeToISOString(approver.approvedAt),
      })) || [],
    }
  });

  return serialized.sort((a, b) => {
    const dateA = a[sortBy] ? new Date(a[sortBy]).getTime() : 0;
    const dateB = b[sortBy] ? new Date(b[sortBy]).getTime() : 0;
    return dateB - dateA; // 내림차순 (최신순)
  });
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
    };
    
    // On initial save, ensure UID is set.
    if (!docSnap.exists() && userId) {
      dataToSave.uid = userId;
    }
    
    await setDoc(userProfileRef, dataToSave, { merge: true });
    
    const finalProfileSnap = await getDoc(userProfileRef);
    const finalData = finalProfileSnap.data() as UserProfile;

    return { success: true, profile: { ...finalData, email: finalProfileSnap.id, uid: finalData.uid || userId }};
  } catch (error: any) {
      return { success: false, error: `저장 실패: ${error.message}` };
  }
}

export async function getUsersDirectory(): Promise<UserProfile[]> {
  try {
    const snapshot = await getDocs(getUsersCol());
    if (snapshot.empty) return [];
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

// [1] 미결재함 (Inbox)
export async function getInboxDocuments(userEmail: string) {
  if (!userEmail) return [];
  const approvalsCol = getApprovalsCol();
  
  const q = query(
    approvalsCol, 
    where('status', '==', 'pending')
  );
  
  try {
    const snapshot = await getDocs(q);
    const allPending = serializeDocs(snapshot.docs, 'createdAt');
    
    const myTurnDocs = allPending.filter(doc => {
        if (doc.currentStep >= 0 && doc.currentStep < doc.approvers.length) {
            const currentApprover = doc.approvers[doc.currentStep];
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

// [2] 상신함 (Sent Box)
export async function getSentDocuments(userId: string, userEmail: string) {
  if (!userId && !userEmail) return [];
  const approvalsCol = getApprovalsCol();

  const q = query(
    approvalsCol, 
    or(
        where('requesterId', '==', userId),
        where('requesterEmail', '==', userEmail)
    )
  );

  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs, 'createdAt');
  } catch (error) {
    console.error("Get Sent Docs Error:", error);
    return [];
  }
}

// [3] 진행 문서함 (Pending Box)
export async function getPendingDocuments(userId: string, userEmail: string) {
  if (!userId && !userEmail) return [];
  const approvalsCol = getApprovalsCol();
  
  const q = query(
    approvalsCol,
    and(
        or(
            where('requesterId', '==', userId),
            where('requesterEmail', '==', userEmail)
        ),
        where('status', '==', 'pending')
    )
  );

  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs, 'createdAt');
  } catch (error) {
    console.error("Get Pending Docs Error:", error);
    return [];
  }
}

// [4] 문서등록대장 (Registry)
export async function getRegistryDocuments(userId: string, userEmail: string) {
    const approvalsCol = getApprovalsCol();
    const q = query(approvalsCol, where('status', '==', 'approved'));
    try {
        const snapshot = await getDocs(q);
        return serializeDocs(snapshot.docs, 'completedAt');
    } catch (error) {
        console.error("Get Registry Docs Error:", error);
        return [];
    }
}

// [5] 회수함 (Recalled Box)
export async function getRecalledDocuments(userId: string, userEmail: string) {
  if (!userId && !userEmail) return [];
  const approvalsCol = getApprovalsCol();

  const q = query(
    approvalsCol,
    and(
      or(
        where('requesterId', '==', userId),
        where('requesterEmail', '==', userEmail)
      ),
      where('status', '==', 'recalled')
    )
  );

  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs, 'createdAt');
  } catch (error) {
    console.error("Get Recalled Docs Error:", error);
    return [];
  }
}


export async function getDocumentById(docId: string) {
  try {
    const snapshot = await getDoc(doc(getApprovalsCol(), docId));
    if (!snapshot.exists()) return null;
    return serializeDocs([snapshot])[0];
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
    
    // 명시적으로 타입을 지정하여 status 필드 오류 방지
    const newDocData: any = {
      ...payload,
      docNo: finalDocNoStr,
      requesterId: userProfile.uid,
      requesterName: userProfile.name,
      requesterEmail: userProfile.email,
      requesterRole: userProfile.role,
      requesterSignature: userProfile.signature || '',
      currentStep: 0,
      status: hasApprovers ? 'pending' : 'approved',
      createdAt: serverTimestamp(),
      completedAt: hasApprovers ? null : serverTimestamp(),
    };

    await setDoc(newDocRef, newDocData);
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
                currentStep: isFinal ? step : step + 1,
                status: isFinal ? 'approved' : 'pending',
                completedAt: isFinal ? serverTimestamp() : null,
            });
        });
        return { success: true, docId };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function rejectDocument(docId: string, userId: string, userProfile: UserProfile, reason: string) {
    const docRef = doc(getApprovalsCol(), docId);
    try {
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(docRef);
            if (!docSnap.exists()) throw new Error("문서가 없습니다.");
            
            const data = docSnap.data() as ApprovalDoc;
            const step = data.currentStep;

             // 결재선 데이터 유효성 검사 추가
             if (!data.approvers || !data.approvers[step]) {
                throw new Error("결재 단계 데이터가 유효하지 않습니다.");
            }
            
            if (data.approvers[step].email?.toLowerCase() !== userProfile.email?.toLowerCase()) {
                throw new Error("반려 권한이 없거나 결재 차례가 아닙니다.");
            }

            const updatedApprovers = [...data.approvers];
            
            updatedApprovers[step] = {
                ...updatedApprovers[step],
                status: 'rejected',
                signature: userProfile.signature || '',
                approvedAt: new Date().toISOString(),
                approverName: userProfile.name,
                comment: reason,
            } as any;
            
            transaction.update(docRef, {
                approvers: updatedApprovers,
                status: 'rejected',
                completedAt: serverTimestamp(),
                comment: reason, // 최상위 필드에도 반려사유 저장 (선택사항)
            });
        });
        return { success: true, docId };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function recallDocument(docId: string, userId: string) {
    const docRef = doc(getApprovalsCol(), docId);
    try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            return { success: false, error: "문서를 찾을 수 없습니다." };
        }

        const docData = docSnap.data() as ApprovalDoc;
        if (docData.requesterId !== userId) {
            return { success: false, error: "문서를 회수할 권한이 없습니다." };
        }

        if (docData.status !== 'pending') {
            return { success: false, error: "진행 중인 문서만 회수할 수 있습니다." };
        }
        
        await setDoc(docRef, { status: 'recalled' }, { merge: true });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: `문서 회수 중 오류 발생: ${error.message}` };
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
                batch.set(userRef, {
                    name: user.name,
                    role: user.role,
                    email: user.email.toLowerCase(),
                    isAdmin: false,
                    signature: '',
                }, { merge: true });
                count++;
            }
        }
        await batch.commit();
        // revalidatePath 제거됨
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
      const userRef = doc(getUsersCol(), email);
      await firestoreDeleteDoc(userRef);
      return { success: true };
    } catch (error: any) {
      console.error('사용자 삭제 실패:', error);
      return { success: false, error: `사용자 삭제 중 오류가 발생했습니다: ${error.message}` };
    }
}


export async function updateDocument(docId: string, payload: ApprovalDocPayload, userId: string) {
    const docRef = doc(getApprovalsCol(), docId);
    try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            throw new Error("문서를 찾을 수 없습니다.");
        }
        const docData = docSnap.data();
        if (docData.requesterId !== userId) {
            throw new Error("문서를 수정할 권한이 없습니다.");
        }
        if (docData.status !== 'recalled') {
            throw new Error("회수된 문서만 수정할 수 있습니다.");
        }

        const hasApprovers = payload.approvers && payload.approvers.length > 0;
        const updatedData = {
            ...payload,
            // 재상신 시 상태와 결재 단계를 초기화합니다.
            status: hasApprovers ? 'pending' : 'approved',
            currentStep: 0,
            completedAt: hasApprovers ? null : serverTimestamp(),
            // createdAt은 그대로 유지하고, updatedAt을 추가할 수 있습니다.
            updatedAt: serverTimestamp(),
        };

        await firestoreUpdateDoc(docRef, updatedData);
        return { success: true, docId };
    } catch (error: any) {
        console.error("Update Document Error:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteDocument(docId: string, userId: string) {
    const docRef = doc(getApprovalsCol(), docId);
    try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            return { success: false, error: "문서를 찾을 수 없습니다." };
        }

        const docData = docSnap.data() as ApprovalDoc;
        if (docData.requesterId !== userId) {
            return { success: false, error: "문서를 삭제할 권한이 없습니다." };
        }

        if (docData.status !== 'recalled') {
            return { success: false, error: "회수된 문서만 삭제할 수 있습니다." };
        }

        await firestoreDeleteDoc(docRef);
        return { success: true };
    } catch (error: any) {
        console.error("Delete Document Error:", error);
        return { success: false, error: `문서 삭제 중 오류 발생: ${error.message}` };
    }
}
    

    


