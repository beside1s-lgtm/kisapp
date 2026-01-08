import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let db: Firestore | null = null;

function initialize() {
    try {
        const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (serviceAccountString) {
            const serviceAccount = JSON.parse(serviceAccountString);
            
            if (serviceAccount.project_id && serviceAccount.client_email && serviceAccount.private_key) {
                const appName = 'admin';
                const existingApp = getApps().find((app) => app.name === appName);
                adminApp = existingApp || initializeApp({
                    credential: cert(serviceAccount),
                }, appName);

                db = getFirestore(adminApp);
            } else {
                console.warn("Firebase service account key is incomplete. Admin SDK not initialized.");
            }
        } else {
           // console.warn("FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set. Admin SDK not initialized.");
        }
    } catch (error) {
        console.error("Failed to initialize Firebase Admin SDK:", error);
    }
}

export async function ensureDbInitialized(): Promise<Firestore | null> {
    if (!db) {
        initialize();
    }
    return db;
}
