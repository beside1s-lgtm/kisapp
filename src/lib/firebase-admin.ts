import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App | undefined;
let db: Firestore | undefined;

function initialize() {
    const apps = getApps();
    if (apps.length > 0) {
        app = apps[0];
        db = getFirestore(app);
        return;
    }

    try {
        const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!serviceAccountString) {
            // This will be caught by the calling function, but good to log here too.
            console.error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set.");
            return;
        }

        const serviceAccount = JSON.parse(serviceAccountString);

        app = initializeApp({
          credential: cert(serviceAccount),
        });
        db = getFirestore(app);
    } catch (e) {
        console.error("Firebase admin initialization error", e);
    }
}


export function getDb(): Firestore {
  if (!db) {
    initialize();
  }
  if (!db) {
    // This will be the error that the client sees if init fails.
    throw new Error("Firestore database is not initialized. Check server logs for details.");
  }
  return db;
}
