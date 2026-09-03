import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';

const targetConfig = {
  apiKey: "AIzaSyDIG0l-il8rggQEBWK6rUFwFs0oFcNGkrg",
  authDomain: "studio-9153973571-7837c.firebaseapp.com",
  projectId: "studio-9153973571-7837c",
  storageBucket: "studio-9153973571-7837c.appspot.com",
  messagingSenderId: "450357468060",
  appId: "1:450357468060:web:9987ff7b76682415ed8659"
};

const app = initializeApp(targetConfig);
const db = getFirestore(app);

async function matchStudents() {
  const [peSnap, userSnap, masterSnap, recSnap] = await Promise.all([
    getDocs(collection(db, 'pe_schools', 'KISH', 'students')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'master_students')),
    getDocs(collection(db, 'pe_schools', 'KISH', 'records')),
  ]);

  console.log(`PE Students: ${peSnap.docs.length}`);
  console.log(`Users: ${userSnap.docs.length}`);
  console.log(`Master Students: ${masterSnap.docs.length}`);
  console.log(`PE Records: ${recSnap.docs.length}`);

  // Build key map for users and master_students
  // key: "name_grade_classNum" or "name_grade"
  const userMap = new Map();
  userSnap.docs.forEach(d => {
    const u = d.data();
    const name = (u.studentName || u.name || '').trim();
    const grade = String(u.grade || u.studentGrade || '').trim();
    const classNum = String(u.class || u.classNum || u.studentClass || '').trim();
    const studentNum = String(u.number || u.studentNumber || u.studentNum || '').trim();
    const email = (u.email || d.id || '').trim().toLowerCase();

    if (name && email.endsWith('@kshcm.net')) {
      const fullKey = `${name}_${grade}_${classNum}`;
      const nameGradeKey = `${name}_${grade}`;
      const nameKey = `${name}`;

      if (!userMap.has(fullKey)) userMap.set(fullKey, { id: d.id, email, ...u });
      if (!userMap.has(nameGradeKey)) userMap.set(nameGradeKey, { id: d.id, email, ...u });
      if (!userMap.has(nameKey)) userMap.set(nameKey, { id: d.id, email, ...u });
    }
  });

  let matchedCount = 0;
  let photoMatchCount = 0;
  const peIdToUserMap = new Map(); // peStudent.id -> user / masterStudent

  peSnap.docs.forEach(d => {
    const pe = d.data();
    const peName = (pe.name || '').trim();
    const peGrade = String(pe.grade || '').trim();
    const peClass = String(pe.classNum || pe.class || '').trim();

    const fullKey = `${peName}_${peGrade}_${peClass}`;
    const nameGradeKey = `${peName}_${peGrade}`;
    const nameKey = `${peName}`;

    const matchedUser = userMap.get(fullKey) || userMap.get(nameGradeKey) || userMap.get(nameKey);
    if (matchedUser) {
      matchedCount++;
      peIdToUserMap.set(d.id, matchedUser);
      if (pe.photoUrl) photoMatchCount++;
    }
  });

  console.log(`Matched PE students to users: ${matchedCount} / ${peSnap.docs.length}`);
  console.log(`PE students with photo matched: ${photoMatchCount}`);

  process.exit(0);
}

matchStudents().catch(console.error);
