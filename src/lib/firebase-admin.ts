import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

const adminApp =
  getApps().find((app) => app.name === 'admin') ||
  initializeApp(
    {
      credential: cert(
        serviceAccount || {
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: 'missing-in-action',
          privateKey: 'missing-in-action',
        }
      ),
    },
    'admin'
  );

const db = getFirestore(adminApp);

export { adminApp, db };
