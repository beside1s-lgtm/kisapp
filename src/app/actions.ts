
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
import { getDb as getClientDb } from '@/lib/firebase';
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


const appId = 'kish-standard-v6-fix'.replace(/[\/.]/g, '_');

// Helper function to get collections
function getApprovalsCol() {
  const db = getClientDb();
  return collection(db, 'approvals');
}
function getUsersDirCol() {
    const db = getAdminDb();
    return collection(db, 'users');
}
function getSettingsRef() {
    const db = getAdminDb();
    return doc(db, 'settings', 'docConfig');
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
  const db = getClientDb();
  if (!userEmail) return [];
  const approvalsCol = getApprovalsCol();
  const q = query(
    approvalsCol,
    where('status', '==', 'pending'),
  );
  try {
    const snapshot = await getDocs(q);
    const allPending = serializeDocs(snapshot.docs);
    // This will be filtered by firestore rules in production for security.
    // For now, client-side filtering to allow UI to work.
    return allPending.filter(doc => doc.approvers[doc.currentStep]?.email === userEmail);
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: approvalsCol.path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    return [];
  }
}

export async function getSentDocuments(userId: string) {
  const db = getClientDb();
  if (!userId) return [];
  const approvalsCol = getApprovalsCol();
  const q = query(approvalsCol, where('requesterId', '==', userId), orderBy('createdAt', 'desc'));
  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs);
  } catch (error) {
     const permissionError = new FirestorePermissionError({
      path: approvalsCol.path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    return [];
  }
}

export async function getRegistryDocuments(userId: string, userEmail: string) {
    const db = getClientDb();
    if (!userId || !userEmail) return [];
    
    // Since firestore rules will handle visibility, we can query all approved docs
    // and let firestore security rules do the filtering.
    const approvalsCol = getApprovalsCol();
    const q = query(approvalsCol, where('status', '==', 'approved'), orderBy('createdAt', 'desc'));
    
    try {
        const snapshot = await getDocs(q);
        return serializeDocs(snapshot.docs);
    } catch (error: any) {
        const permissionError = new FirestorePermissionError({
            path: approvalsCol.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        return [];
    }
}

export async function getDocumentById(docId: string) {
  const db = getClientDb();
  const approvalsCol = getApprovalsCol();
  const docRef = doc(approvalsCol, docId);
  try {
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
        return null;
    }
    return serializeDocs([snapshot])[0];
  } catch (error: any) {
     const permissionError = new FirestorePermissionError({
         path: docRef.path,
         operation: 'get',
     });
     errorEmitter.emit('permission-error', permissionError);
     return null;
  }
}


export async function createDocument(payload: ApprovalDocPayload, userId: string, userProfile: UserProfile): Promise<{ success: boolean; error?: string; docId?: string; docNo?: string; }> {
  const adminDb = getAdminDb();
  const clientDb = getClientDb();
  
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
    if (error instanceof FirestorePermissionError) {
      errorEmitter.emit('permission-error', error);
      return { success: false, error: error.message };
    }
    return { success: false, error: `문서 생성 실패: ${error.message}` };
  }
}


export async function approveDocument(docId: string, userId: string, userProfile: UserProfile) {
    const db = getClientDb();
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

export async function saveUserProfile(userId: string, email: string, profile: Partial<UserProfile>) {
    const db = getAdminDb();
    
    const userProfileRef = doc(db, 'users', email);
    
    let dataToSave: Partial<UserProfile>;

    try {
        const docSnap = await getDoc(userProfileRef);
        const docExists = docSnap.exists();
        const existingData = docSnap.data() as UserProfile | undefined;
        
        if (docExists && existingData) {
            dataToSave = { ...existingData, ...profile };
        } else {
             dataToSave = {
                uid: userId || '',
                email: email,
                name: profile.name || 'New User',
                role: profile.role || '담당',
                signature: profile.signature || '',
                isAdmin: profile.isAdmin === true ? true : false,
            };
        }
        
        dataToSave.email = email;
        if (userId) {
          dataToSave.uid = userId;
        }
        
        await setDoc(userProfileRef, dataToSave, { merge: true });
        
        revalidatePath('/');
        const newProfile = (await getDoc(userProfileRef)).data() as UserProfile;
        return { success: true, profile: newProfile };

    } catch (error: any) {
        console.error("saveUserProfile failed:", error);
        return { success: false, error: `프로필 저장 실패: ${error.message}` };
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
        console.warn(`Skipping row due to missing data: ${JSON.stringify(user)}`);
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
