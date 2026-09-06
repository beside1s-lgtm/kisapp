import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, query, where } from 'firebase/firestore';

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

const portalDb = getFirestore(initializeApp(portalConfig, 'portal_resync'));
const busDb = getFirestore(initializeApp(kisbusConfig, 'bus_resync'));

const dayMap = {
  '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday',
  '목': 'Thursday', '금': 'Friday', '토': 'Saturday'
};

const clean = (str) => String(str || '').replace(/\s+/g, '').toLowerCase();

const extractCourseDays = (course) => {
  if (!course) return [];
  if (Array.isArray(course.classDays) && course.classDays.length > 0) return course.classDays;
  if (Array.isArray(course.days) && course.days.length > 0) return course.days;
  const text = `${course.period || ''} ${course.title || ''} ${course.schedule || ''} ${course.day || ''} ${course.classTime || ''}`;
  if (text.includes('토')) return ['토'];
  const days = [];
  if (text.includes('월')) days.push('월');
  if (text.includes('화')) days.push('화');
  if (text.includes('수')) days.push('수');
  if (text.includes('목')) days.push('목');
  if (text.includes('금')) days.push('금');
  return days;
};

async function runResync() {
  console.log("=== 방과후 요일별 목적지 정밀 복구 및 동기화 시작 ===");

  // 1. 방과후 수강 확정 목록 조회
  const enrollmentsSnap = await getDocs(
    query(
      collection(portalDb, 'afterschool_enrollments'),
      where('status', '==', 'ENROLLED')
    )
  );
  const allEnrolled = enrollmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`수강 확정(ENROLLED) 건수: ${allEnrolled.length}건`);

  // 2. 강좌 조회
  const coursesSnap = await getDocs(collection(portalDb, 'afterschool_courses'));
  const courseMap = new Map();
  coursesSnap.forEach(d => courseMap.set(d.id, d.data()));

  // 3. 학생 조회
  const studentsSnap = await getDocs(collection(busDb, 'students'));
  const busStudentsList = [];
  studentsSnap.forEach(d => {
    busStudentsList.push({ id: d.id, ref: d.ref, data: d.data() });
  });
  console.log(`스쿨버스 학생 수: ${busStudentsList.length}명`);

  const findBusStudent = (name, grade, classNum, studentNum) => {
    if (!name) return null;
    const targetName = clean(name);

    let matched = busStudentsList.find(s => {
      const d = s.data;
      const matchName = clean(d.name) === targetName || clean(d.nameKo) === targetName || clean(d.nameEn) === targetName;
      const matchGrade = Number(d.grade) === Number(grade);
      const matchClass = Number(d.class || d.classNum) === Number(classNum);
      const sNum = Number(d.studentNum || d.number || 0);
      const matchNum = studentNum ? sNum === Number(studentNum) : true;
      return matchName && matchGrade && matchClass && matchNum;
    });

    if (!matched) {
      matched = busStudentsList.find(s => {
        const d = s.data;
        const matchName = clean(d.name) === targetName || clean(d.nameKo) === targetName || clean(d.nameEn) === targetName;
        const matchGrade = Number(d.grade) === Number(grade);
        const matchClass = Number(d.class || d.classNum) === Number(classNum);
        return matchName && matchGrade && matchClass;
      });
    }

    if (!matched) {
      matched = busStudentsList.find(s => {
        const d = s.data;
        return clean(d.name) === targetName || clean(d.nameKo) === targetName || clean(d.nameEn) === targetName;
      });
    }

    return matched;
  };

  // 학생별 수강신청 묶기
  const studentEnrollmentMap = new Map();
  allEnrolled.forEach(enroll => {
    const rawName = (enroll.name || enroll.studentName || '').trim();
    const busStudent = findBusStudent(rawName, Number(enroll.grade), Number(enroll.classNum), Number(enroll.studentNum));
    if (!busStudent) return;
    const key = busStudent.id;
    if (!studentEnrollmentMap.has(key)) {
      studentEnrollmentMap.set(key, []);
    }
    studentEnrollmentMap.get(key).push(enroll);
  });
  console.log(`수강신청 매칭 학생 수: ${studentEnrollmentMap.size}명`);

  let updatedCount = 0;
  let batch = writeBatch(busDb);
  let batchCount = 0;

  for (const docSnap of studentsSnap.docs) {
    const busStudent = { id: docSnap.id, ref: docSnap.ref, data: docSnap.data() };
    const enrolls = studentEnrollmentMap.get(busStudent.id);

    if (!enrolls || enrolls.length === 0) {
      continue;
    }

    const currentDests = { ...(busStudent.data.afterSchoolDestinations || {}) };
    const currentClassIds = { ...(busStudent.data.afterSchoolClassIds || {}) };
    const newDests = { ...currentDests };
    const newClassIds = { ...currentClassIds };
    let hasSaturday = false;

    const enrolledDays = new Set();

    enrolls.forEach(enroll => {
      const course = courseMap.get(enroll.courseId);
      if (!course) return;

      const classDays = extractCourseDays(course);
      if (classDays.length === 0) return;

      const isSat = classDays.includes('토') || Boolean(
        course.period?.includes('토') ||
        course.title?.includes('토요') ||
        course.title?.includes('토요일') ||
        course.title?.includes('오케스트라') ||
        course.title?.includes('basketball')
      );
      if (isSat) hasSaturday = true;

      if (enroll.kisbusNo === '-' || enroll.kisbusNo === '미신청' || enroll.needsBus === false) {
        return;
      }
      if (isSat && (!enroll.kisbusNo || enroll.kisbusNo === '-' || enroll.kisbusNo === '미신청')) {
        return;
      }
      const isRegularRider = !!(busStudent.data.afternoonDestinationId || busStudent.data.morningDestinationId || busStudent.data.morningBusNo || busStudent.data.afternoonBusNo);
      if (!isSat && !isRegularRider && !enroll.kisbusNo) {
        return;
      }

      const targetDays = classDays.map(d => dayMap[d]).filter(Boolean);
      targetDays.forEach(day => enrolledDays.add(day));

      let targetDestId = (
        (isSat ? (busStudent.data.satAfternoonDestinationId || busStudent.data.satMorningDestinationId) : null) ||
        busStudent.data.afternoonDestinationId ||
        busStudent.data.suggestedAfternoonDestination ||
        busStudent.data.morningDestinationId ||
        'UNSPECIFIED'
      );

      if (targetDestId && (targetDestId.includes('호차') || targetDestId === '미배정' || targetDestId === '방과후 미배정')) {
        targetDestId = busStudent.data.afternoonDestinationId || busStudent.data.morningDestinationId || 'UNSPECIFIED';
      }

      targetDays.forEach(day => {
        const existingDest = newDests[day];
        if (!existingDest || existingDest.includes('호차') || existingDest === '미배정' || existingDest === '방과후 미배정' || existingDest === 'UNSPECIFIED') {
          newDests[day] = targetDestId;
        }
        newClassIds[day] = course.id;
      });
    });

    let needsUpdate = false;
    enrolledDays.forEach(day => {
      if (newDests[day] !== currentDests[day] || newClassIds[day] !== currentClassIds[day]) {
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      console.log(`[복구 대상] ${busStudent.data.name || busStudent.data.nameKo} (${busStudent.data.grade}-${busStudent.data.class || busStudent.data.classNum})`);
      console.log(`  이전 목적지:`, JSON.stringify(currentDests));
      console.log(`  복구 목적지:`, JSON.stringify(newDests));

      const updateData = {
        afterSchoolDestinations: newDests,
        afterSchoolClassIds: newClassIds
      };

      if (hasSaturday) {
        if (!busStudent.data.satMorningDestinationId) {
          updateData.satMorningDestinationId = newDests['Saturday'] || busStudent.data.morningDestinationId;
        }
        if (!busStudent.data.satAfternoonDestinationId) {
          updateData.satAfternoonDestinationId = newDests['Saturday'] || busStudent.data.afternoonDestinationId;
        }
      }

      batch.update(busStudent.ref, updateData);
      updatedCount++;
      batchCount++;

      if (batchCount >= 400) {
        await batch.commit();
        batch = writeBatch(busDb);
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\n복구 완료! 총 업데이트된 학생 수: ${updatedCount}명`);
  process.exit(0);
}

runResync().catch(e => {
  console.error(e);
  process.exit(1);
});
