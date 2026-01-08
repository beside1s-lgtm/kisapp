import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App;
let db: Firestore;

function initializeAdmin() {
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountString) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set.");
  }
  const serviceAccount = JSON.parse(serviceAccountString);

  if (!getApps().length) {
    app = initializeApp({
      credential: cert(serviceAccount),
    });
    db = getFirestore(app);
  } else {
    app = getApps()[0];
    db = getFirestore(app);
  }
}

export function getDb(): Firestore {
  if (!db) {
    initializeAdmin();
  }
  return db;
}
