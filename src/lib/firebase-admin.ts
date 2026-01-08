import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
let db: Firestore;

if (serviceAccountString) {
    const serviceAccount = JSON.parse(serviceAccountString);
    if (!getApps().length) {
        initializeApp({
            credential: cert(serviceAccount)
        });
    }
    db = getFirestore();
} else {
    // This is a fallback for local development or environments where the service account key is not set.
    // It will likely fail in production if not configured correctly.
    console.warn("FIREBASE_SERVICE_ACCOUNT_KEY is not set. Using a fallback that may not have permissions.");
    if (!getApps().length) {
        initializeApp();
    }
    db = getFirestore();
}

export { db };
