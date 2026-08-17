import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const privateKey = process.env.FIREBASE_PRIVATE_KEY 
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
  : '';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    })
  });
}

const db = admin.firestore();

async function run() {
  console.log("=== users 컬렉션에서 학부모 조회 ===");
  const usersSnap = await db.collection('users').get();
  usersSnap.forEach(u => {
    const d = u.data();
    if (d.role === '학부모') {
      console.log(`학부모: ${u.id} (${d.name}) -> email: ${d.email}, studentName: ${d.studentName}, studentGrade: ${d.studentGrade}`);
    }
  });
}

run().catch(console.error);
