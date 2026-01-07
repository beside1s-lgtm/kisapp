import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp = null;
let db = null;

try {
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountString) {
        const serviceAccount = JSON.parse(serviceAccountString);
        
        // Check if all required fields are present
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
        console.warn("FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set. Admin SDK not initialized.");
    }
} catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
}

export { adminApp, db };
