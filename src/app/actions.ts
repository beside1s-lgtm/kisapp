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
import { db } from '@/lib/firebase-admin';
import type {
  ApprovalDoc,
  ApprovalDocPayload,
  DocConfig,
  UserProfile,
  User,
} from '@/lib/types';
import { generateDocumentContent } from '@/ai/flows/generate-document-content';
import { z } from 'zod';

const appId = 'kish-standard-v6-fix'.replace(/[\/.]/g, '_');

// Helper function to get collections, handles null db
function getApprovalsCol() {
  if (!db) throw new Error("Firestore is not initialized.");
  return collection(db, 'artifacts', appId, 'public', 'data', 'approvals');
}
function getUsersDirCol() {
    if (!db) throw new Error("Firestore is not initialized.");
    return collection(db, 'artifacts', appId, 'public', 'data', 'users_directory');
}
function getSettingsRef() {
    if (!db) throw new Error("Firestore is not initialized.");
    return doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'docConfig');
}
function getUserProfileRef(userId: string) {
    if (!db) throw new Error("Firestore is not initialized.");
    return doc(db, 'artifacts', appId, 'users', userId, 'profile', 'info');
}
function getUserDirectoryRef(userId: string) {
    if (!db) throw new Error("Firestore is not initialized.");
    return doc(db, 'artifacts', appId, 'public', 'data', 'users_directory', userId);
}


function serializeDocs(docs: any[]): any[] {
  return docs.map(d => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : null,
      completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate().toISOString() : null,
      approvers: data.approvers.map((approver: any) => ({
        ...approver,
        approvedAt: approver.approvedAt ? new Date(approver.approvedAt).toISOString() : null,
      })),
    }
  })
}

export async function getInboxDocuments(userEmail: string) {
  if (!db || !userEmail) return [];
  const q = query(
    getApprovalsCol(),
    where('status', '==', 'pending'),
  );
  const snapshot = await getDocs(q);
  const allPending = serializeDocs(snapshot.docs);

  return allPending.filter(doc => doc.approvers[doc.currentStep]?.email === userEmail);
}

export async function getSentDocuments(userId: string) {
  if (!db || !userId) return [];
  const q = query(getApprovalsCol(), where('requesterId', '==', userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return serializeDocs(snapshot.docs);
}

export async function getRegistryDocuments(userId: string, userEmail: string) {
    if (!db || !userId || !userEmail) return [];
    
    const q = query(getApprovalsCol(), where('status', '==', 'approved'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const allApproved = serializeDocs(snapshot.docs);

    return allApproved.filter(doc => {
        if (doc.publishStatus === '공개') return true;
        const isRequester = doc.requesterId === userId;
        const isApprover = doc.approvers.some((a: any) => a.email === userEmail);
        const isCircular = doc.circulars.some((c: any) => c.email === userEmail);
        return isRequester || isApprover || isCircular;
    });
}

export async function getDocumentById(docId: string) {
  if (!db) return null;
  const docRef = doc(getApprovalsCol(), docId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    return null;
  }
  return serializeDocs([snapshot])[0];
}


export async function createDocument(payload: ApprovalDocPayload, userId: string, userProfile: UserProfile) {
  if (!db) return { success: false, error: "Database not initialized." };
  const settingsRef = getSettingsRef();

  let finalDocNoStr = "";
  try {
    await runTransaction(db, async (transaction) => {
      const settingsSnap = await transaction.get(settingsRef);
      const currentConfig = settingsSnap.data() as DocConfig || {};
      let nextNum = currentConfig.nextNumber || 1;
      
      finalDocNoStr = `Kish-초등-${nextNum}`;
      transaction.set(settingsRef, { nextNumber: nextNum + 1 }, { merge: true });
    });

    const newDoc: Omit<ApprovalDoc, 'id'> = {
      ...payload,
      docNo: finalDocNoStr,
      requesterId: userId,
      requesterName: userProfile.name,
      requesterEmail: userProfile.email,
      requesterRole: userProfile.role,
      requesterSignature: userProfile.signature || '',
      currentStep: 0,
      status: 'pending',
      createdAt: serverTimestamp() as Timestamp,
    };
    
    const docRef = await addDoc(getApprovalsCol(), newDoc);

    revalidatePath('/sent');
    return { success: true, docId: docRef.id, docNo: finalDocNoStr };
  } catch (error: any) {
    console.error("제출 오류:", error);
    return { success: false, error: error.message };
  }
}

export async function approveDocument(docId: string, userId: string, userProfile: UserProfile) {
    if (!db) return { success: false, error: "Database not initialized." };
    const docRef = doc(getApprovalsCol(), docId);

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
            
            transaction.update(docRef, {
                approvers: updatedApprovers,
                currentStep: isFinal ? step : step + 1,
                status: isFinal ? 'approved' : 'pending',
                completedAt: isFinal ? serverTimestamp() : null,
            });
        });

        revalidatePath('/inbox');
        revalidatePath(`/documents/${docId}`);
        return { success: true, docId };
    } catch (error: any) {
        console.error("결재 오류:", error);
        return { success: false, error: error.message };
    }
}


export async function getUsersDirectory(): Promise<User[]> {
  if (!db) return [];
  const snapshot = await getDocs(getUsersDirCol());
  return snapshot.docs.map(d => ({ ...d.data(), uid: d.id }) as User);
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
    return { success: false, error: error.message };
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!db) return null;
    if (!userId) return null;
    const docRef = getUserProfileRef(userId);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() as UserProfile : null;
}

export async function saveUserProfile(userId: string, email: string, profile: Partial<UserProfile>) {
  if (!db) return { success: false, error: "Database not initialized." };
  
  try {
    await runTransaction(db, async (transaction) => {
        const userProfileRef = getUserProfileRef(userId);
        const userDirectoryRef = getUserDirectoryRef(userId);
        
        transaction.set(userProfileRef, profile, { merge: true });

        const directoryData: Partial<User> = {
            name: profile.name,
            email: email,
            role: profile.role,
        };
        // Remove undefined values to avoid Firestore errors
        Object.keys(directoryData).forEach(key => directoryData[key as keyof typeof directoryData] === undefined && delete directoryData[key as keyof typeof directoryData]);

        transaction.set(userDirectoryRef, directoryData, { merge: true });
    });
    
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error("Error saving user profile:", error);
    return { success: false, error: error.message };
  }
}

export async function generateContentAction(input: {
  title: string;
  approvers: { name: string; role: string }[];
  attachments?: { name: string; data: string }[];
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
