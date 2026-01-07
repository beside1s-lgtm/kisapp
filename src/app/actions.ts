
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
import { db } from '@/lib/firebase';
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
  
  const newDocRef = doc(approvalsCol);
  const newDocId = newDocRef.id;

  try {
    const finalDocNoStr = await runTransaction(db, async (transaction) => {
        const settingsSnap = await transaction.get(settingsRef);
        const currentConfig = (settingsSnap.data() as DocConfig) || { nextNumber: 1 };
        let nextNum = currentConfig.nextNumber || 1;
        
        const docNo = `Kish-초등-${nextNum}`;
        transaction.set(settingsRef, { nextNumber: nextNum + 1 }, { merge: true });
        
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
      createdAt: serverTimestamp() as Timestamp,
      completedAt: hasApprovers ? null : serverTimestamp() as Timestamp,
    };

    await setDoc(newDocRef, newDocData).catch((error) => {
        // This catch block is crucial for permission errors
        const permissionError = new FirestorePermissionError({
            path: newDocRef.path,
            operation: 'create',
            requestResourceData: newDocData,
        });
        errorEmitter.emit('permission-error', permissionError);
        // We throw to make sure the outer catch block catches it.
        throw new Error(`Permission denied: ${permissionError.message}`);
    });

    revalidatePath('/sent');
    return { success: true, docId: newDocId, docNo: finalDocNoStr };

  } catch (error: any) {
    console.error("Failed to create document:", error); // Log the full error on the server
    
    let errorMessage = "An unknown error occurred while creating the document.";
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else if (error?.name === 'FirebaseError' && error.code === 'permission-denied') {
        errorMessage = "Permission denied. Please check Firestore security rules.";
    }

    // Return the specific error to the client
    return { success: false, error: errorMessage };
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


export async function getUsersDirectory(): Promise<UserProfile[]> {
  if (!db) return [];
  try {
    const snapshot = await getDocs(getUsersDirCol());
    if (snapshot.empty) return [];
    
    // We are using user's email as the document ID, but the actual auth UID is stored in the 'uid' field.
    // The profile type expects 'uid' so we map the document's 'uid' field to the returned object.
    return snapshot.docs.map(d => {
        const data = d.data() as Omit<UserProfile, 'uid'>;
        return {
            ...data,
            uid: data.uid || d.id, // Fallback to doc id if uid field is missing
        } as UserProfile
    });

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
  try {
    const snap = await getDoc(settingsRef);
    return snap.exists() ? snap.data() as DocConfig : {};
  } catch(error) {
    const permissionError = new FirestorePermissionError({
      path: settingsRef.path,
      operation: 'get',
    });
    errorEmitter.emit('permission-error', permissionError);
    return {};
  }
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

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    if (!db || !email) return null;
    const docRef = doc(db, 'users', email);
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
    
    // We use email as the document ID in the 'users' collection
    const userProfileRef = doc(db, 'users', email);
    let docExists = false;

    try {
        const docSnap = await getDoc(userProfileRef);
        docExists = docSnap.exists();
        const existingData = docSnap.data() as UserProfile | undefined;
        
        let dataToSave: UserProfile;

        if (docExists && existingData) {
            // Document exists, so we merge.
            dataToSave = {
                ...existingData,
                ...profile,
                email: email, // Ensure email is always correct
                uid: userId, // Update with the latest Firebase Auth UID
            };
            await setDoc(userProfileRef, dataToSave, { merge: true });
        } else {
            // Document does not exist, so we create it.
            // This case should be rare if users are pre-registered
            dataToSave = {
                uid: userId,
                email: email,
                name: profile.name || 'New User',
                role: profile.role || '담당',
                signature: profile.signature || '',
                isAdmin: profile.isAdmin === true ? true : false,
            };
            await setDoc(userProfileRef, dataToSave);
        }
        
        revalidatePath('/');
        return { success: true, profile: dataToSave };
    } catch (error: any) {
        // We need docExists from the try block to determine the operation.
        const permissionError = new FirestorePermissionError({
            path: userProfileRef.path,
            operation: docExists ? 'update' : 'create',
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

export async function bulkRegisterUsers(fileData: string): Promise<{ success: boolean; error?: string; summary?: string; }> {
  if (!db) {
    return { success: false, error: '데이터베이스가 초기화되지 않았습니다.' };
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
        console.warn(`Skipping row due to missing data: ${JSON.stringify(user)}`);
        continue;
      }
      
      // Use the user's email as the document ID
      const userRef = doc(db, 'users', email);

      const userProfile: Partial<UserProfile> = {
        email,
        name,
        role,
        uid: '', // UID will be set on first login
        isAdmin: false, 
        signature: '',
      };
      
      // Use set with merge to create a new user or update an existing one.
      batch.set(userRef, userProfile, { merge: true });
      count++;
    }

    await batch.commit();
    revalidatePath('/'); // Revalidate to reflect changes

    return { 
        success: true, 
        summary: `${count}명의 사용자가 성공적으로 등록/업데이트되었습니다.`
    };
  } catch (error: any) {
    console.error('Bulk user registration failed:', error);
    // Firestore permission errors should be caught and emitted
    if (error.name === 'FirebaseError' && error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: getUsersDirCol().path,
            operation: 'update', // This is a batch write, so 'update' is a reasonable guess
        });
        errorEmitter.emit('permission-error', permissionError);
        return { success: false, error: permissionError.message };
    }
    return { success: false, error: `파일 처리 중 오류가 발생했습니다: ${error.message}` };
  }
}

    

    