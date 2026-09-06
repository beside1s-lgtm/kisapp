import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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

const portalApp = initializeApp(portalConfig, 'portal');
const portalDb = getFirestore(portalApp);

const busApp = initializeApp(kisbusConfig, 'bus');
const busDb = getFirestore(busApp);

async function check() {
  console.log("=== 1. 스쿨버스 DB에서 이정민 학생 조회 ===");
  const studentsSnap = await getDocs(collection(busDb, 'students'));
  const jungmins = [];
  studentsSnap.forEach(d => {
    const data = d.data();
    if ((data.name && data.name.includes('정민')) || (data.nameKo && data.nameKo.includes('정민'))) {
      jungmins.push({ id: d.id, ...data });
    }
  });
  console.log(`이정민 검색 결과: ${jungmins.length}명`);
  jungmins.forEach(j => {
    console.log(`- ID: ${j.id}, 이름: ${j.name || j.nameKo}, 학년: ${j.grade}, 반: ${j.class || j.classNum}, 번호: ${j.studentNum || j.number}`);
    console.log(`  morningDestinationId: ${j.morningDestinationId}, afternoonDestinationId: ${j.afternoonDestinationId}`);
    console.log(`  afterSchoolDestinations:`, JSON.stringify(j.afterSchoolDestinations));
    console.log(`  afterSchoolClassIds:`, JSON.stringify(j.afterSchoolClassIds));
    console.log(`  vacationAfterSchoolDestinations:`, JSON.stringify(j.vacationAfterSchoolDestinations));
  });

  console.log("\n=== 2. 포털 DB에서 이정민 학생 수강신청 조회 ===");
  const enrollSnap = await getDocs(collection(portalDb, 'afterschool_enrollments'));
  const enrolls = [];
  enrollSnap.forEach(d => {
    const data = d.data();
    const name = data.name || data.studentName || '';
    if (name.includes('정민')) {
      enrolls.push({ id: d.id, ...data });
    }
  });
  console.log(`이정민 수강신청 건수: ${enrolls.length}건`);
  for (const e of enrolls) {
    console.log(`- 신청ID: ${e.id}, 학생: ${e.name || e.studentName}, 학년: ${e.grade}, 반: ${e.classNum}, 상태: ${e.status}, courseId: ${e.courseId}, courseTitle: ${e.courseTitle}, kisbusNo: ${e.kisbusNo}, needsBus: ${e.needsBus}`);
  }

  console.log("\n=== 3. 관련 강좌 정보 조회 ===");
  const courseIds = [...new Set(enrolls.map(e => e.courseId))];
  const coursesSnap = await getDocs(collection(portalDb, 'afterschool_courses'));
  coursesSnap.forEach(d => {
    const c = d.data();
    if (courseIds.includes(d.id) || (c.title && (c.title.includes('3D') || c.title.includes('수과학') || c.title.includes('웹툰')))) {
      console.log(`- 강좌ID: ${d.id}, 제목: ${c.title}, classDays: ${JSON.stringify(c.classDays)}, days: ${JSON.stringify(c.days)}, day: ${c.day}, schedule: ${c.schedule}, period: ${c.period}`);
    }
  });

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
