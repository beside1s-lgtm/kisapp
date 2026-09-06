import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';

const portalConfig = {
  apiKey: "AIzaSyDIG0l-il8rggQEBWK6rUFwFs0oFcNGkrg",
  authDomain: "studio-9153973571-7837c.firebaseapp.com",
  projectId: "studio-9153973571-7837c",
  storageBucket: "studio-9153973571-7837c.appspot.com",
  messagingSenderId: "450357468060",
  appId: "1:450357468060:web:9987ff7b76682415ed8659"
};

const kisbusConfig = {
  apiKey: "AIzaSyD98EXwu0qawhpLkL8fMe1erS5aBpXzv8w",
  authDomain: "studio-8176556433-7698a.firebaseapp.com",
  projectId: "studio-8176556433-7698a",
  storageBucket: "studio-8176556433-7698a.firebasestorage.app",
  messagingSenderId: "89517826209",
  appId: "1:89517826209:web:37c6d9f5cb30a03e1850e0"
};

const portalDb = getFirestore(initializeApp(portalConfig, 'p_check'));
const busDb = getFirestore(initializeApp(kisbusConfig, 'b_check'));

async function checkThreeStudents() {
  const names = ['정시우', '허민희', '궉서후'];

  console.log("=== 1. 스쿨버스 DB students 확인 ===");
  const snap = await getDocs(collection(busDb, 'students'));
  const foundBus = [];
  snap.forEach(d => {
    const s = d.data();
    const clean = (str) => String(str || '').replace(/\s+/g, '').toLowerCase();
    for (const name of names) {
      if (clean(s.name).includes(clean(name)) || clean(s.nameKo).includes(clean(name)) || clean(s.nameEn).includes(clean(name))) {
        foundBus.push({ id: d.id, ...s });
      }
    }
  });

  foundBus.forEach(s => {
    console.log(`\n[스쿨버스 학생] ${s.name} / ${s.nameKo} / ${s.nameEn} (ID: ${s.id})`);
    console.log(`  학년-반: ${s.grade}-${s.class || s.classNum}`);
    console.log(`  morningDestinationId: ${s.morningDestinationId}, morningBusNo: ${s.morningBusNo}`);
    console.log(`  afternoonDestinationId: ${s.afternoonDestinationId}, afternoonBusNo: ${s.afternoonBusNo}`);
    console.log(`  _hiddenAfternoonDestId: ${s._hiddenAfternoonDestId}`);
    console.log(`  afterSchoolDestinations:`, JSON.stringify(s.afterSchoolDestinations));
    console.log(`  afterSchoolClassIds:`, JSON.stringify(s.afterSchoolClassIds));
    console.log(`  vacationAfterSchoolDestinations:`, JSON.stringify(s.vacationAfterSchoolDestinations));
    console.log(`  vacationAfterSchoolClassIds:`, JSON.stringify(s.vacationAfterSchoolClassIds));
    console.log(`  applicationStatus: ${s.applicationStatus}, type: ${s.type}`);
  });

  console.log("\n=== 2. 방과후 포털 enrollments 확인 ===");
  const eSnap = await getDocs(collection(portalDb, 'afterschool_enrollments'));
  const foundEnrolls = [];
  eSnap.forEach(d => {
    const e = d.data();
    const eName = e.name || e.studentName || '';
    for (const name of names) {
      if (eName.includes(name)) {
        foundEnrolls.push({ id: d.id, ...e });
      }
    }
  });

  console.log(`포털 수강신청 건수: ${foundEnrolls.length}건`);
  foundEnrolls.forEach(e => {
    console.log(`\n[수강신청] ID: ${e.id}, 이름: ${e.name || e.studentName} (${e.grade}-${e.classNum})`);
    console.log(`  강좌: ${e.courseTitle} (${e.courseId})`);
    console.log(`  상태: ${e.status}, kisbusNo: ${e.kisbusNo}, needsBus: ${e.needsBus}`);
    console.log(`  afternoonBusHidden: ${e.afternoonBusHidden}`);
  });

  console.log("\n=== 3. 스쿨버스 routes 좌석에 배정되어 있는지 확인 ===");
  const rSnap = await getDocs(collection(busDb, 'routes'));
  const busIds = foundBus.map(b => b.id);
  rSnap.forEach(d => {
    const r = d.data();
    (r.seating || []).forEach(seat => {
      if (busIds.includes(seat.studentId)) {
        const student = foundBus.find(b => b.id === seat.studentId);
        console.log(`[노선 좌석] 노선명: ${r.name || r.busNo || r.id}, type: ${r.type}, day: ${r.dayOfWeek}, seat: ${seat.seatNumber}, 학생: ${student?.name} (${student?.grade}-${student?.class})`);
      }
    });
  });

  process.exit(0);
}

checkThreeStudents().catch(e => {
  console.error(e);
  process.exit(1);
});
