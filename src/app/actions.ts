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
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/firebase';
import type {
  ApprovalDoc,
  ApprovalDocPayload,
  DocConfig,
  UserProfile,
  User,
} from '@/lib/types';
import { generateDocumentContent } from '@/ai/flows/generate-document-content';
import { z } from 'zod';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError } from '@/lib/errors';

const appId = 'kish-standard-v6-fix'.replace(/[\/.]/g, '_');

// Helper function to get collections
function getApprovalsCol() {
  if (!db) throw new Error("Firestore is not initialized.");
  return collection(db, 'approvals');
}
function getUsersDirCol() {
    if (!db) throw new Error("Firestore is not initialized.");
    return collection(db, 'users');
}
function getSettingsRef() {
    if (!db) throw new Error("Firestore is not initialized.");
    return doc(db, 'settings', 'docConfig');
}
function getUserProfileRef(userId: string) {
    if (!db) throw new Error("Firestore is not initialized.");
    return doc(db, 'users', userId);
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
  if (!db || !userEmail) return [];
  const q = query(
    getApprovalsCol(),
    where('status', '==', 'pending'),
  );
  try {
    const snapshot = await getDocs(q);
    const allPending = serializeDocs(snapshot.docs);
    return allPending.filter(doc => doc.approvers[doc.currentStep]?.email === userEmail);
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: getApprovalsCol().path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    return [];
  }
}

export async function getSentDocuments(userId: string) {
  if (!db || !userId) return [];
  const q = query(getApprovalsCol(), where('requesterId', '==', userId), orderBy('createdAt', 'desc'));
  try {
    const snapshot = await getDocs(q);
    return serializeDocs(snapshot.docs);
  } catch (error) {
     const permissionError = new FirestorePermissionError({
      path: getApprovalsCol().path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    return [];
  }
}

export async function getRegistryDocuments(userId: string, userEmail: string) {
    if (!db || !userId || !userEmail) return [];
    
    // Since firestore rules will handle visibility, we can query all approved docs
    // and let firestore security rules do the filtering.
    const q = query(getApprovalsCol(), where('status', '==', 'approved'), orderBy('createdAt', 'desc'));
    
    try {
        const snapshot = await getDocs(q);
        return serializeDocs(snapshot.docs);
    } catch (error: any) {
        const permissionError = new FirestorePermissionError({
            path: getApprovalsCol().path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        return [];
    }
}

export async function getDocumentById(docId: string) {
  if (!db) return null;
  const docRef = doc(getApprovalsCol(), docId);
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
  if (!db) return { success: false, error: "Database not initialized." };
  
  const settingsRef = getSettingsRef();
  const approvalsCol = getApprovalsCol();
  
  let finalDocNoStr = "";
  let newDocId: string | undefined = undefined;

  try {
    const newDocRef = doc(approvalsCol); // Generate a new ref with an ID
    newDocId = newDocRef.id;

    const newDoc: Omit<ApprovalDoc, 'id'> = {
      ...payload,
      docNo: '', // Will be set in transaction
      requesterId: userId,
      requesterName: userProfile.name,
      requesterEmail: userProfile.email,
      requesterRole: userProfile.role,
      requesterSignature: userProfile.signature || '',
      currentStep: 0,
      status: 'pending',
      createdAt: serverTimestamp() as Timestamp,
      completedAt: null,
    };

    await runTransaction(db, async (transaction) => {
      const settingsSnap = await transaction.get(settingsRef);
      if (!settingsSnap.exists()) {
        // Let's create a default one if it doesn't exist. Requires admin to fix later.
        transaction.set(settingsRef, { nextNumber: 1 });
      }
      const currentConfig = (settingsSnap.data() as DocConfig) || { nextNumber: 1 };
      let nextNum = currentConfig.nextNumber || 1;
      
      finalDocNoStr = `Kish-초등-${nextNum}`;
      newDoc.docNo = finalDocNoStr;
      
      transaction.set(settingsRef, { nextNumber: nextNum + 1 }, { merge: true });
      transaction.set(newDocRef, newDoc);
    });

    revalidatePath('/sent');
    return { success: true, docId: newDocId, docNo: finalDocNoStr };

  } catch (error: any) {
    let permissionError;
    if (error.message.includes("settings")) {
        permissionError = new FirestorePermissionError({
            path: settingsRef.path,
            operation: 'update',
        });
    } else {
       permissionError = new FirestorePermissionError({
          path: approvalsCol.path, 
          operation: 'create',
          requestResourceData: payload,
      });
    }
    errorEmitter.emit('permission-error', permissionError);
    return { success: false, error: permissionError.message };
  }
}

export async function approveDocument(docId: string, userId: string, userProfile: UserProfile) {
    if (!db) return { success: false, error: "Database not initialized." };
    const docRef = doc(getApprovalsCol(), docId);
    let updatedData: any = {};

    try {
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(docRef);
            if (!docSnap.exists()) {
                throw new Error("문서가 존재하지 않습니다!");
            }

            const data = docSnap.data() as ApprovalDoc;
            const step = data.currentStep;

            if (data.approvers[step]?.email !== userProfile.email) {
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
            
            updatedData = {
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
        // Catch transaction errors, including permission errors
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updatedData,
        });
        errorEmitter.emit('permission-error', permissionError);
        return { success: false, error: permissionError.message };
    }
}


export async function getUsersDirectory(): Promise<User[]> {
  if (!db) return [];
  try {
    const snapshot = await getDocs(getUsersDirCol());
    if (snapshot.empty) return [];
    return snapshot.docs.map(d => ({ ...(d.data() as object), uid: d.id }) as User);
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: getUsersDirCol().path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    return [];
  }
}

export async function getDocConfig(): Promise<DocConfig> {
  if (!db) return {};
  const settingsRef = getSettingsRef();
  const snap = await getDoc(settingsRef);
  return snap.exists() ? snap.data() as DocConfig : {};
}

export async function saveDocConfig(payload: DocConfig) {
  if (!db) return { success: false, error: "Database not initialized." };
  const settingsRef = getSettingsRef();
  
  try {
    await setDoc(settingsRef, payload, { merge: true });
    revalidatePath('/'); // Revalidate all pages that might use this
    return { success: true };
  } catch (error: any) {
    const permissionError = new FirestorePermissionError({
        path: settingsRef.path,
        operation: 'update',
        requestResourceData: payload,
    });
    errorEmitter.emit('permission-error', permissionError);
    return { success: false, error: permissionError.message };
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!db || !userId) return null;
    const docRef = getUserProfileRef(userId);
    try {
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() as UserProfile : null;
    } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        return null;
    }
}

export async function saveUserProfile(userId: string, email: string, profile: Partial<UserProfile>) {
  if (!db) {
      return { success: false, error: "Database not initialized." };
  }
  
  const userProfileRef = getUserProfileRef(userId);

  try {
      const dataToSave: Partial<User & UserProfile> = {
          uid: userId,
          email: email,
          name: profile.name,
          role: profile.role,
          signature: profile.signature,
          isAdmin: profile.isAdmin === true ? true : false
      };
      
      // clean undefined values
      Object.keys(dataToSave).forEach(key => 
            dataToSave[key as keyof typeof dataToSave] === undefined && delete dataToSave[key as keyof typeof dataToSave]
      );
      
      await setDoc(userProfileRef, dataToSave, { merge: true });
      revalidatePath('/');
      return { success: true };
  } catch (error: any) {
      const permissionError = new FirestorePermissionError({
          path: userProfileRef.path,
          operation: 'update',
          requestResourceData: profile,
      });
      errorEmitter.emit('permission-error', permissionError);
      return { success: false, error: permissionError.message };
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
