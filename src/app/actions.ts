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
  updateDoc,
  where,
  Timestamp,
  DocumentSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db as clientDbInstance } from '@/lib/firebase'; // [이름 변경] 헷갈림 방지
import { getDb as getAdminDb } from '@/lib/firebase-admin';
import type {
  ApprovalDoc,
  ApprovalDocPayload,
  DocConfig,
  UserProfile,
} from '@/lib/types';
import { generateDocumentContent } from '@/ai/flows/generate-document-content';
import { z } from 'zod';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError } from '@/lib/errors';
import * as xlsx from 'xlsx';

// [중요] clientDbInstance는 함수가 아니라 이미 초기화된 객체입니다.
// 따라서 clientDbInstance() 가 아니라 clientDbInstance 를 그대로 써야 합니다.

function getApprovalsCol() {
  return collection(clientDbInstance, 'approvals');
}

function serializeDocs(docs: any[]): any[] {
  if (!docs) return [];
  return docs.map(d => {
    const data = d.data();
    if (!data) return { id: d.id };
    return {
      ...data,
      id: d.id,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
      completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate().toISOString() : data.completedAt,
      approvers: data.approvers?.map((approver: any) => ({
        ...approver,
        approvedAt: approver.approvedAt instanceof Timestamp ? approver.approvedAt.toDate().toISOString() : approver.approvedAt,
      })) || [],
    }
  })
}

export async function getInboxDocuments(userEmail: string) {
  // [수정] getClientDb() 호출 제거 -> clientDbInstance 사용
  const db = clientDbInstance; 
  if (!userEmail) return [];
  
  const approvalsCol = getApprovalsCol();
  const q = query(
    approvalsCol,
    where('status', '==', 'pending'),
  );
  try {
    const snapshot = await getDocs(q);
    const allPending = serializeDocs(snapshot.docs);
    return allPending.filter(doc => doc.approvers[doc.currentStep]?.email === userEmail);
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: approvalsCol.path,
      operation: 'list',
    });
    // Server Actions에서는 emit이 클라이언트로 직접 전달되지 않으므로 주의
    console.error("Permission Error:", error); 
    return [];
  }
}

export async function getSentDocuments(userId: string) {
  const db = clientDbInstance;
  if (!userId) return [];
  const approvalsCol = getApprovalsCol();
  const q = query(approvalsCol, where('requesterId', '==', userId), orderBy('createdAt', 'desc'));
  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs);
  } catch (error) {
    console.error("Get Sent Docs Error:", error);
    return [];
  }
}

export async function getRegistryDocuments(userId: string, userEmail: string) {
    const db = clientDbInstance;
    if (!userId || !userEmail) return [];
    
    const approvalsCol = getApprovalsCol();
    const q = query(approvalsCol, where('status', '==', 'approved'), orderBy('createdAt', 'desc'));
    
    try {
        const snapshot = await getDocs(q);
        return serializeDocs(snapshot.docs);
    } catch (error: any) {
        console.error("Get Registry Docs Error:", error);
        return [];
    }
}

export async function getDocumentById(docId: string) {
  const db = clientDbInstance;
  const approvalsCol = getApprovalsCol();
  const docRef = doc(approvalsCol, docId);
  try {
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
        return null;
    }
    return serializeDocs([snapshot])[0];
  } catch (error: any) {
     console.error("Get Doc By ID Error:", error);
     return null;
  }
}


export async function createDocument(payload: ApprovalDocPayload, userId: string, userProfile: UserProfile): Promise<{ success: boolean; error?: string; docId?: string; docNo?: string; }> {
  const adminDb = getAdminDb();
  const clientDb = clientDbInstance;
  
  const approvalsCol = collection(clientDb, 'approvals');
  const newDocRef = doc(approvalsCol);

  try {
    const finalDocNoStr = await runTransaction(adminDb, async (transaction) => {
      const settingsRef = doc(adminDb, 'settings', 'docConfig');
      const settingsSnap = await transaction.get(settingsRef);
      
      let nextNum = 1;
      if (settingsSnap.exists()) {
        const currentConfig = settingsSnap.data() as DocConfig;
        nextNum = currentConfig.nextNumber || 1;
        transaction.update(settingsRef, { nextNumber: nextNum + 1 });
      } else {
        transaction.set(settingsRef, { nextNumber: 2 });
      }
      
      const docNo = `Kish-초등-${nextNum}`;
      return docNo;
    });

    const hasApprovers = payload.approvers && payload.approvers.length > 0;
    
    const newDocData: Omit<ApprovalDoc, 'id'> = {
      ...payload,
      docNo: finalDocNoStr,
      requesterId: userId,
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

    revalidatePath('/sent');
    revalidatePath('/inbox');
    return { success: true, docId: newDocRef.id, docNo: finalDocNoStr };

  } catch (error: any) {
    console.error('Create document error:', error);
    return { success: false, error: `문서 생성 실패: ${error.message}` };
  }
}


export async function approveDocument(docId: string, userId: string, userProfile: UserProfile) {
    const db = clientDbInstance;
    const approvalsCol = getApprovalsCol();
    const docRef = doc(approvalsCol, docId);

    try {
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(docRef);
            if (!docSnap.exists()) {
                throw new Error("문서가 존재하지 않습니다!");
            }

            const data = docSnap.data() as ApprovalDoc;
            const step = data.currentStep;

            const approverEmail = data.approvers[step]?.email?.toLowerCase().trim();
            const userEmail = userProfile.email?.toLowerCase().trim();

            if (approverEmail !== userEmail) {
                throw new Error("결재할 차례가 아닙니다.");
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
            
            const updatedData = {
                approvers: updatedApprovers,
                currentStep: isFinal ? step : step + 1,
                status: isFinal ? 'approved' : 'pending',
                completedAt: isFinal ? serverTimestamp() : null,
            };
            transaction.update(docRef, updatedData);
        });

        revalidatePath('/inbox');
        revalidatePath(`/documents/${docId}`);
        return { success: true, docId };
    } catch (error: any) {
        console.error("Approve document failed:", error);
        return { success: false, error: error.message };
    }
}

export async function generateContentAction(input: {
  title: string;
  approvers: { name: string; role: string }[];
  attachments?: { name:string; data: string }[];
}) {
  const schema = z.object({
    title: z.string().min(1, '제목은 필수입니다.'),
    approvers: z.array(z.object({ name: z.string(), role: z.string() })),
    attachments: z.array(z.object({ name: z.string(), data: z.string() })).optional(),
  });

  const validation = schema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: '잘못된 입력입니다.' };
  }

  try {
    const result = await generateDocumentContent(validation.data);
    return { success: true, content: result.content };
  } catch (error: any) {
    console.error("AI 콘텐츠 생성 오류:", error);
    return { success: false, error: `콘텐츠 생성 실패: ${error.message}` };
  }
}

export async function bulkRegisterUsers(fileData: string): Promise<{ success: boolean; error?: string; summary?: string; }> {
  const db = getAdminDb();
  if (!db) {
    return { success: false, error: 'Database not initialized.' };
  }

  try {
    const base64Data = fileData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const usersJson = xlsx.utils.sheet_to_json(worksheet) as { email: string; name: string; role: string }[];

    const requiredColumns = ['email', 'name', 'role'];
    if (usersJson.length > 0) {
        const firstRow = Object.keys(usersJson[0]);
        const hasAllColumns = requiredColumns.every(col => firstRow.includes(col));
        if (!hasAllColumns) {
            return { success: false, error: `엑셀 파일에 필수 컬럼(${requiredColumns.join(', ')})이 포함되어야 합니다.` };
        }
    } else {
        return { success: false, error: '엑셀 파일에 데이터가 없습니다.'};
    }

    const batch = writeBatch(db);
    let count = 0;

    for (const user of usersJson) {
      const { email, name, role } = user;
      if (!email || !name || !role) {
        continue;
      }
      
      const userRef = doc(db, 'users', email);

      const userProfile: Partial<UserProfile> = {
        email,
        name,
        role,
        uid: '', 
        isAdmin: false, 
        signature: '',
      };
      
      batch.set(userRef, userProfile, { merge: true });
      count++;
    }

    await batch.commit();
    revalidatePath('/');

    return { 
        success: true, 
        summary: `${count}명의 사용자가 성공적으로 등록/업데이트되었습니다.`
    };
  } catch (error: any) {
    console.error('Bulk user registration failed:', error);
    return { success: false, error: `파일 처리 중 오류가 발생했습니다: ${error.message}` };
  }
}

export async function getDocConfig() {
    const db = getAdminDb();
    if (!db) return {};
    const settingsRef = doc(db, 'settings', 'docConfig');
    try {
        const snap = await getDoc(settingsRef);
        return snap.exists() ? (snap.data() as DocConfig) : {};
    } catch(error) {
        console.error("[actions] getDocConfig failed:", error);
        return {};
    }
}