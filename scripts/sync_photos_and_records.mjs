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

async function syncAll() {
  console.log('=== Step 1: Loading all collections ===');
  const [peSnap, userSnap, masterSnap, recSnap] = await Promise.all([
    getDocs(collection(db, 'pe_schools', 'KISH', 'students')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'master_students')),
    getDocs(collection(db, 'pe_schools', 'KISH', 'records')),
  ]);

  console.log(`Loaded ${peSnap.docs.length} PE students, ${userSnap.docs.length} users, ${masterSnap.docs.length} master students, ${recSnap.docs.length} records`);

  // Build index for users
  const userMap = new Map(); // fullKey -> userDoc
  const emailToUserMap = new Map();

  userSnap.docs.forEach(d => {
    const u = d.data();
    const name = (u.studentName || u.name || '').trim();
    const grade = String(u.grade || u.studentGrade || '').trim();
    const classNum = String(u.class || u.classNum || u.studentClass || '').trim();
    const studentNum = String(u.number || u.studentNumber || u.studentNum || '').trim();
    const email = (u.email || d.id || '').trim().toLowerCase();

    if (name && email.endsWith('@kshcm.net')) {
      const fullKey = `${name}_${grade}_${classNum}_${studentNum}`;
      const classKey = `${name}_${grade}_${classNum}`;
      const gradeKey = `${name}_${grade}`;
      const nameKey = `${name}`;

      const userObj = { docId: d.id, email, name, grade, classNum, studentNum, ...u };
      emailToUserMap.set(email, userObj);

      if (!userMap.has(fullKey)) userMap.set(fullKey, userObj);
      if (!userMap.has(classKey)) userMap.set(classKey, userObj);
      if (!userMap.has(gradeKey)) userMap.set(gradeKey, userObj);
      if (!userMap.has(nameKey)) userMap.set(nameKey, userObj);
    }
  });

  const peIdToUserMap = new Map(); // peUuid -> userObj
  const userDocIdToPeDoc = new Map(); // userDocId -> peDoc

  peSnap.docs.forEach(d => {
    const pe = d.data();
    const peName = (pe.name || '').trim();
    const peGrade = String(pe.grade || '').trim();
    const peClass = String(pe.classNum || pe.class || '').trim();
    const peNum = String(pe.number || pe.studentNum || '').trim();

    const fullKey = `${peName}_${peGrade}_${peClass}_${peNum}`;
    const classKey = `${peName}_${peGrade}_${peClass}`;
    const gradeKey = `${peName}_${peGrade}`;
    const nameKey = `${peName}`;

    const matchedUser = userMap.get(fullKey) || userMap.get(classKey) || userMap.get(gradeKey) || userMap.get(nameKey);
    if (matchedUser) {
      peIdToUserMap.set(d.id, matchedUser);
      userDocIdToPeDoc.set(matchedUser.docId, { id: d.id, ...pe });
    }
  });

  console.log(`\n=== Step 2: Syncing photos to users and master_students (${userDocIdToPeDoc.size} matched) ===`);
  let userBatch = writeBatch(db);
  let uCount = 0;

  for (const [userDocId, peData] of userDocIdToPeDoc.entries()) {
    if (peData.photoUrl) {
      // 1. users doc update
      userBatch.set(doc(db, 'users', userDocId), { photoUrl: peData.photoUrl }, { merge: true });
      // 2. master_students doc update
      userBatch.set(doc(db, 'master_students', userDocId), { photoUrl: peData.photoUrl, peStudentId: peData.id }, { merge: true });
      uCount++;

      if (uCount % 200 === 0) {
        await userBatch.commit();
        userBatch = writeBatch(db);
        console.log(`Synced ${uCount} student photos...`);
      }
    }
  }
  if (uCount % 200 !== 0) {
    await userBatch.commit();
    console.log(`Synced total ${uCount} student photos!`);
  }

  console.log(`\n=== Step 3: Updating PE Records to match userDocIds (${recSnap.docs.length} records) ===`);
  let recBatch = writeBatch(db);
  let rCount = 0;
  let updatedRecCount = 0;

  for (const rDoc of recSnap.docs) {
    const rData = rDoc.data();
    const originalStudentId = rData.studentId;
    const matchedUser = peIdToUserMap.get(originalStudentId);

    if (matchedUser) {
      // Set studentId to matchedUser.docId (e.g. 2022kangsoobin@kshcm.net) and preserve peStudentId
      recBatch.set(doc(db, 'pe_schools', 'KISH', 'records', rDoc.id), {
        studentId: matchedUser.docId,
        studentEmail: matchedUser.email,
        peStudentId: originalStudentId
      }, { merge: true });
      updatedRecCount++;
    }

    rCount++;
    if (rCount % 400 === 0) {
      await recBatch.commit();
      recBatch = writeBatch(db);
      console.log(`Updated ${rCount} records...`);
    }
  }
  if (rCount % 400 !== 0) {
    await recBatch.commit();
    console.log(`Updated total ${updatedRecCount} / ${recSnap.docs.length} records to unified user IDs!`);
  }

  console.log('\nAll photo syncing and record ID unification completed successfully!');
  process.exit(0);
}

syncAll().catch(console.error);
