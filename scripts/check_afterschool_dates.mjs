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

async function check() {
  try {
    const snaps = await db.collection('settings').get();
    console.log("=== ALL SETTINGS DOCS ===");
    for (const d of snaps.docs) {
      console.log(`Doc ID: [${d.id}]`);
      if (d.id.includes('afterschool') || d.id.includes('teacher') || d.id.includes('timer') || d.id.includes('academic') || d.id.includes('doc')) {
        console.log(JSON.stringify(d.data(), null, 2));
      }
    }
  } catch (e) {
    console.error(e);
  }
}

check();
