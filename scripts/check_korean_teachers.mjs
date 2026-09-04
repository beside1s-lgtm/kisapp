import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || 'studio-9153973571-7837c',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function checkKoreanTeachers() {
  const emails = ['kisekimkeunghun@kshcm.net', 'kisebaeyumi@kshcm.net', 'kisekwonyerim@kshcm.net', 'kisekimokyung@kshcm.net', 'kisechongyoojin@kshcm.net'];
  for (const email of emails) {
    const snap = await db.collection('users').doc(email).get();
    console.log(email, snap.exists ? snap.data() : 'NOT FOUND');
  }
}

checkKoreanTeachers().catch(console.error);
