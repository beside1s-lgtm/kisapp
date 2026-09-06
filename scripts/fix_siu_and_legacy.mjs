import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, writeBatch, query, where } from 'firebase/firestore';

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

const portalDb = getFirestore(initializeApp(portalConfig, 'p_fix'));
const busDb = getFirestore(initializeApp(kisbusConfig, 'b_fix'));

async function fixData() {
  console.log("=== 1. 정시우 수강신청 문서 학년/반 수정 ===");
  const siuRef = doc(portalDb, 'afterschool_enrollments', 'e_bulk_1787644951186_163_wwy6');
  await updateDoc(siuRef, {
    grade: 3,
    classNum: 4
  });
  console.log("정시우 수강신청 문서 grade: 3, classNum: 4 업데이트 완료!");

  console.log("\n=== 2. 방과후 수강생이 아닌 학생의 레거시 방과후 데이터 전수 정리 ===");
  // 1) 전체 ENROLLED 수강생의 studentId 집합 구축
  const enrollSnap = await getDocs(
    query(
      collection(portalDb, 'afterschool_enrollments'),
      where('status', '==', 'ENROLLED')
    )
  );

  const clean = (str) => String(str || '').replace(/\s+/g, '').toLowerCase();
  const enrolledStudentIds = new Set();
  const enrolledKeys = new Set();

  enrollSnap.forEach(d => {
    const data = d.data();
    if (data.studentId) enrolledStudentIds.add(data.studentId);
    const key = `${Number(data.grade)}-${Number(data.classNum)}-${clean(data.name || data.studentName)}`;
    enrolledKeys.add(key);
  });
  console.log(`현재 유효한 수강생 키 수: ${enrolledKeys.size}개`);

  // 2) 스쿨버스 학생들 중 수강신청이 전혀 없는 학생인데 afterSchoolDestinations 또는 afterSchoolClassIds가 남아있는 경우 클리어
  const studentsSnap = await getDocs(collection(busDb, 'students'));
  const batch = writeBatch(busDb);
  let clearedCount = 0;

  studentsSnap.forEach(d => {
    const s = d.data();
    const key = `${Number(s.grade)}-${Number(s.class || s.classNum)}-${clean(s.nameKo || s.name || s.nameEn)}`;
    const isEnrolled = enrolledStudentIds.has(d.id) || enrolledKeys.has(key);

    const hasAfterSchoolData = (
      (s.afterSchoolDestinations && Object.keys(s.afterSchoolDestinations).length > 0) ||
      (s.afterSchoolClassIds && Object.keys(s.afterSchoolClassIds).length > 0)
    );

    if (!isEnrolled && hasAfterSchoolData) {
      console.log(`[레거시 제거] ${s.name || s.nameKo} (${s.grade}-${s.class || s.classNum}, ID: ${d.id})`);
      batch.update(d.ref, {
        afterSchoolDestinations: {},
        afterSchoolClassIds: {}
      });
      clearedCount++;
    }
  });

  if (clearedCount > 0) {
    await batch.commit();
    console.log(`총 ${clearedCount}명의 비수강생 레거시 방과후 데이터 초기화 완료!`);
  } else {
    console.log("제거할 비수강생 레거시 데이터가 없습니다.");
  }

  process.exit(0);
}

fixData().catch(e => {
  console.error(e);
  process.exit(1);
});
