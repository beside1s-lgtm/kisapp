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
  writeBatch,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db as clientDbInstance } from '@/lib/firebase';
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

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  if (!email) return null;
  const db = getAdminDb();
  const userDocRef = db.collection('users').doc(email);
  const snap = await userDocRef.get();

  if (!snap.exists) {
    return null;
  }
  
  const data = snap.data();
  if (!data) {
      return null;
  }
  
  const profile: UserProfile = {
      name: data.name || '',
      role: data.role || '',
      signature: data.signature || '',
      uid: data.uid || snap.id,
      email: snap.id,
      isAdmin: data.isAdmin || false,
  };

  return profile;
}

export async function saveUserProfile(userId: string, email: string, profileData: Partial<UserProfile>): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
  const db = getAdminDb();
  if (!email || !profileData) {
    return { success: false, error: 'Invalid request body' };
  }

  const userProfileRef = db.collection('users').doc(email);
  try {
    const docSnap = await userProfileRef.get();
    
    if (docSnap.exists) {
        await userProfileRef.set({
           ...profileData,
           ...(userId ? { uid: userId } : {}),
           updatedAt: new Date().toISOString() 
        }, { merge: true });
    } else {
        await userProfileRef.set({
            email: email,
            uid: userId || '',
            ...profileData,
            createdAt: new Date().toISOString()
        });
    }
    
    const newProfile: UserProfile = {
        name: profileData.name || '',
        role: profileData.role || '',
        signature: profileData.signature || '',
        email: email,
        uid: userId || '',
        isAdmin: profileData.isAdmin || false,
    };

    revalidatePath('/'); // Revalidate relevant paths
    return { success: true, profile: newProfile };

  } catch (error: any) {
      console.error(`[Action] saveUserProfile failed:`, error);
      return { success: false, error: `프로필 저장 실패: ${error.message}` };
  }
}

export async function getUsersDirectory(): Promise<UserProfile[]> {
  const db = getAdminDb();
  
  try {
    const snapshot = await db.collection('users').get();

    if (snapshot.empty) {
      return [];
    }
    
    const users = snapshot.docs.map(d => {
        const data = d.data();
        return {
            name: data.name || '',
            role: data.role || '',
            signature: data.signature || '',
            isAdmin: data.isAdmin || false,
            email: d.id,
            uid: data.uid || '', 
        } as UserProfile
    });
    
    const uniqueUsers = Array.from(new Map(users.map(user => [user.email, user])).values());
    return uniqueUsers;

  } catch (error) {
    console.error("[Action] getUsersDirectory failed:", error);
    return [];
  }
}

export async function getInboxDocuments(userEmail: string) {
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

export async function getDocConfig(): Promise<DocConfig> {
    const db = getAdminDb();
    const settingsRef = doc(db, 'settings', 'docConfig');
    try {
        const snap = await getDoc(settingsRef);
        return snap.exists() ? (snap.data() as DocConfig) : {};
    } catch(error) {
        console.error("[actions] getDocConfig failed:", error);
        return {};
    }
}

export async function saveDocConfig(payload: DocConfig): Promise<{ success: boolean, error?: string}> {
    const db = getAdminDb();
    const settingsRef = doc(db, 'settings', 'docConfig');
    
    try {
        await setDoc(settingsRef, payload, { merge: true });
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error("[Action] saveDocConfig failed:", error);
        return { success: false, error: error.message };
    }
}