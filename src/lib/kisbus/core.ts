import { getKisbusDb as db } from './firebase';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  onSnapshot,
  Query,
} from 'firebase/firestore';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/lib/errors';

export async function fetchCollection<T>(collectionName: string, q?: Query): Promise<T[]> {
    const queryToExecute = q || collection(db(), collectionName);
    try {
        const querySnapshot = await getDocs(queryToExecute);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: `/${collectionName}`,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function addDocument<T extends {id: string}>(collectionName: string, data: Omit<T, 'id'>): Promise<T> {
  const docRef = await addDoc(collection(db(), collectionName), data)
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/${collectionName}`,
            operation: 'create',
            requestResourceData: data,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
  return { id: docRef.id, ...data } as T;
}

export function onCollectionUpdate<T>(collectionName: string, callback: (data: T[]) => void): () => void {
    const q = collection(db(), collectionName);
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const data: T[] = [];
        querySnapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() } as T);
        });
        callback(data);
    }, (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/${collectionName}`,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    return unsubscribe;
}

export async function setDocument<T>(collectionName: string, docId: string, data: Partial<T>): Promise<void> {
    const docRef = doc(db(), collectionName, docId);
    try {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(docRef, data, { merge: true });
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: `/${collectionName}/${docId}`,
            operation: 'update',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export async function fetchDocument<T>(collectionName: string, docId: string): Promise<T | null> {
    const docRef = doc(db(), collectionName, docId);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as T;
        }
        return null;
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: `/${collectionName}/${docId}`,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

export function onDocumentUpdate<T>(collectionName: string, docId: string, callback: (data: T | null) => void): () => void {
    const docRef = doc(db(), collectionName, docId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback({ id: docSnap.id, ...docSnap.data() } as T);
        } else {
            callback(null);
        }
    }, (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/${collectionName}/${docId}`,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    return unsubscribe;
}
