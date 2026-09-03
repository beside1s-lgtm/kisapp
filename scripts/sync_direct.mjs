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

async function syncDirect() {
  console.log('=== Loading PE students and Users ===');
  const [peSnap, userSnap] = await Promise.all([
    getDocs(collection(db, 'pe_schools', 'KISH', 'students')),
    getDocs(collection(db, 'users')),
  ]);

  console.log(`PE students: ${peSnap.docs.length}, Users: ${userSnap.docs.length}`);

  // Create lookup maps from users
  const userByFull = new Map();
  const userByClass = new Map();
  const userByGrade = new Map();
  const userByName = new Map();

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

      const uObj = { email, docId: d.id, name, grade, classNum, studentNum };
      if (!userByFull.has(fullKey)) userByFull.set(fullKey, uObj);
      if (!userByClass.has(classKey)) userByClass.set(classKey, uObj);
      if (!userByGrade.has(gradeKey)) userByGrade.set(gradeKey, uObj);
      if (!userByName.has(nameKey)) userByName.set(nameKey, uObj);
    }
  });

  let matched = 0;
  let photoUpdated = 0;

  for (const pDoc of peSnap.docs) {
    const pe = pDoc.data();
    const pName = (pe.name || '').trim();
    const pGrade = String(pe.grade || '').trim();
    const pClass = String(pe.classNum || pe.class || '').trim();
    const pNum = String(pe.number || pe.studentNum || '').trim();

    const fullKey = `${pName}_${pGrade}_${pClass}_${pNum}`;
    const classKey = `${pName}_${pGrade}_${pClass}`;
    const gradeKey = `${pName}_${pGrade}`;
    const nameKey = `${pName}`;

    const u = userByFull.get(fullKey) || userByClass.get(classKey) || userByGrade.get(gradeKey) || userByName.get(nameKey);
    if (u) {
      matched++;
      const payload = {
        photoUrl: pe.photoUrl || null,
        peStudentId: pDoc.id,
      };

      if (pe.photoUrl) {
        photoUpdated++;
        await setDoc(doc(db, 'users', u.email), payload, { merge: true });
        await setDoc(doc(db, 'master_students', u.email), {
          ...payload,
          name: u.name,
          nameKo: u.name,
          grade: u.grade,
          classNum: u.classNum,
          studentNum: u.studentNum,
          studentEmail: u.email,
        }, { merge: true });
      } else {
        await setDoc(doc(db, 'users', u.email), { peStudentId: pDoc.id }, { merge: true });
        await setDoc(doc(db, 'master_students', u.email), {
          peStudentId: pDoc.id,
          name: u.name,
          nameKo: u.name,
          grade: u.grade,
          classNum: u.classNum,
          studentNum: u.studentNum,
          studentEmail: u.email,
        }, { merge: true });
      }

      // Also link user email on PE student doc
      await setDoc(doc(db, 'pe_schools', 'KISH', 'students', pDoc.id), {
        unifiedStudentId: u.email,
        studentEmail: u.email,
      }, { merge: true });
    }
  }

  console.log(`Matched: ${matched}, Photos Updated: ${photoUpdated}`);
  process.exit(0);
}

syncDirect().catch(console.error);
