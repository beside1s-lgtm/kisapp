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
  const orgSnap = await db.collection('settings').doc('orgStructure').get();
  const org = orgSnap.data();
  console.log("=== orgStructure ===");
  console.log("Departments:");
  for (const d of (org.departments || [])) {
    console.log(`- ${d.name} (ID: ${d.id}, Head: ${d.headEmail}): Members (${(d.memberEmails || []).length}):`, d.memberEmails);
  }
  console.log("\nGradeHeads:", org.gradeHeads);
  console.log("GradeSubjects:", org.gradeSubjects);

  console.log("\n=== Recent Users with dept/grade ===");
  const usersSnap = await db.collection('users').get();
  let count = 0;
  usersSnap.forEach(doc => {
    const u = doc.data();
    if (u.grade || u.dept) {
      console.log(`[User] ${u.name} (${doc.id}): grade="${u.grade}", dept="${u.dept}", role="${u.role}"`);
      count++;
    }
  });
  console.log(`Total users with grade/dept: ${count}`);
}

check().catch(console.error);
