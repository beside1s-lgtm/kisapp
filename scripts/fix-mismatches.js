const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

const mainConfig = { apiKey: 'AIzaSyDIG0l-il8rggQEBWK6rUFwFs0oFcNGkrg', projectId: 'studio-9153973571-7837c' };
const kisbusConfig = { apiKey: 'AIzaSyD98EXwu0qawhpLkL8fMe1erS5aBpXzv8w', projectId: 'studio-8176556433-7698a' };

const mainApp = initializeApp(mainConfig, 'mainApp');
const kisbusApp = initializeApp(kisbusConfig, 'kisbusApp');
const mainDb = getFirestore(mainApp);
const busDb = getFirestore(kisbusApp);

async function inspectAndFixMismatches() {
  const eSnap = await getDocs(collection(mainDb, 'afterschool_enrollments'));
  const bSnap = await getDocs(collection(busDb, 'students'));

  const busStudents = [];
  bSnap.forEach(d => busStudents.push({ id: d.id, ...d.data() }));

  const clean = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

  const mismatches = [];

  eSnap.forEach(d => {
    const e = d.data();
    if (e.studentId) {
      const b = busStudents.find(s => s.id === e.studentId);
      if (b) {
        const eG = Number(e.grade);
        const bG = Number(b.grade);
        const eC = Number(e.classNum);
        const bC = Number(b.class || b.classNum);
        if (eG !== bG || eC !== bC) {
          mismatches.push({ enrollDocId: d.id, enroll: e, wrongBus: b });
        }
      }
    }
  });

  console.log('Total mismatches to analyze:', mismatches.length);

  for (const m of mismatches) {
    const e = m.enroll;
    console.log('Analyzing:', e.name, 'Enroll:', e.grade, e.classNum, 'WrongBus:', m.wrongBus.grade, m.wrongBus.class, 'Course:', e.courseTitle);
    
    // 이 학생(e)과 정확히 학년+반이 일치하는 버스 학생이 있는지 검색
    const correctBus = busStudents.find(s => {
      const matchName = clean(s.name) === clean(e.name) || clean(s.nameKo) === clean(e.name) || clean(s.nameEn) === clean(e.name);
      const matchGrade = Number(s.grade) === Number(e.grade);
      const matchClass = Number(s.class || s.classNum) === Number(e.classNum);
      return matchName && matchGrade && matchClass;
    });

    if (correctBus) {
      console.log('  -> Found correct bus student:', correctBus.id, correctBus.grade, correctBus.class);
      await updateDoc(doc(mainDb, 'afterschool_enrollments', m.enrollDocId), {
        studentId: correctBus.id
      });
    } else {
      console.log('  -> No matching bus student. Detaching studentId.');
      await updateDoc(doc(mainDb, 'afterschool_enrollments', m.enrollDocId), {
        studentId: null
      });
    }
  }
}

inspectAndFixMismatches().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
