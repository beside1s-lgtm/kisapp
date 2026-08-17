import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-9153973571-7837c',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

async function checkDoc() {
  try {
    const docSnap = await getDoc(doc(db, 'approvals', 'tozVH2YhfXGQoyoIFQaBu'));
    if (!docSnap.exists()) {
      console.log('Doc not found');
      return;
    }
    const data = docSnap.data();
    console.log('=== DOCUMENT DATA ===');
    console.log('Title:', data.title);
    console.log('Status:', data.status);
    console.log('CurrentStep:', data.currentStep);
    console.log('Requester:', data.requesterName, data.requesterEmail);
    console.log('Approvers:', JSON.stringify(data.approvers, null, 2));
  } catch (err) {
    console.error('Error fetching doc:', err);
  }
}

checkDoc();
