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

async function checkEvents() {
  const configRef = db.collection('settings').doc('documentConfig');
  const configSnap = await configRef.get();
  const config = configSnap.data();
  console.log("config keys:", Object.keys(config || {}));
  console.log("academicCalendar keys:", Object.keys(config?.academicCalendar || {}));
  const events = config?.academicCalendar?.events || [];
  console.log("Events count:", events.length);
  events.forEach(e => {
    console.log(e.date, e.endDate, e.title, e.isSchoolDay, e.type);
  });
}

checkEvents();
