import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let db: Firestore | null = null;

function getDb(): Firestore {
  if (db) {
    return db;
  }

  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountString) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set.");
  }

  const serviceAccount = JSON.parse(serviceAccountString);

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  db = getFirestore();
  return db;
}

export { getDb };
