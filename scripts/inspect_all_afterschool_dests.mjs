import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

const portalDb = getFirestore(initializeApp(portalConfig, 'portal2'));
const busDb = getFirestore(initializeApp(kisbusConfig, 'bus2'));

const dayMap = {
  '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday',
  '목': 'Thursday', '금': 'Friday', '토': 'Saturday'
};

const clean = (str) => String(str || '').replace(/\s+/g, '').toLowerCase();

async function inspectAll() {
  console.log("=== 전체 방과후 수강 확정생 vs 버스 DB 학생 afterSchoolDestinations 정밀 비교 ===");
  
  // 1. 강좌 조회
  const coursesSnap = await getDocs(collection(portalDb, 'afterschool_courses'));
  const courseMap = new Map();
  coursesSnap.forEach(d => courseMap.set(d.id, d.data()));

  const extractCourseDays = (course) => {
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

  // 2. 수강신청 조회 (ENROLLED)
  const enrollSnap = await getDocs(collection(portalDb, 'afterschool_enrollments'));
  const enrolledList = [];
  enrollSnap.forEach(d => {
    const data = d.data();
    if (data.status === 'ENROLLED') {
      enrolledList.push({ id: d.id, ...data });
    }
  });
  console.log(`전체 ENROLLED 수강신청 수: ${enrolledList.length}건`);

  // 3. 버스 학생 조회
  const studentsSnap = await getDocs(collection(busDb, 'students'));
  const busStudents = [];
  studentsSnap.forEach(d => busStudents.push({ id: d.id, ref: d.ref, ...d.data() }));
  console.log(`전체 스쿨버스 학생 수: ${busStudents.length}명`);

  const findBusStudent = (name, grade, classNum, studentNum) => {
    if (!name) return null;
    const targetName = clean(name);
    let m = busStudents.find(s => {
      const matchName = clean(s.name) === targetName || clean(s.nameKo) === targetName || clean(s.nameEn) === targetName;
      const matchGrade = Number(s.grade) === Number(grade);
      const matchClass = Number(s.class || s.classNum) === Number(classNum);
      const sNum = Number(s.studentNum || s.number || 0);
      const matchNum = studentNum ? sNum === Number(studentNum) : true;
      return matchName && matchGrade && matchClass && matchNum;
    });
    if (!m) {
      m = busStudents.find(s => {
        const matchName = clean(s.name) === targetName || clean(s.nameKo) === targetName || clean(s.nameEn) === targetName;
        const matchGrade = Number(s.grade) === Number(grade);
        const matchClass = Number(s.class || s.classNum) === Number(classNum);
        return matchName && matchGrade && matchClass;
      });
    }
    if (!m) {
      m = busStudents.find(s => {
        return clean(s.name) === targetName || clean(s.nameKo) === targetName || clean(s.nameEn) === targetName;
      });
    }
    return m;
  };

  // 학생별 수강신청 요일 집계
  const studentExpectedDays = new Map(); // studentId -> { student, expectedDays: Set, enrollments: [] }
  enrolledList.forEach(enroll => {
    if (enroll.kisbusNo === '-' || enroll.kisbusNo === '미신청' || enroll.needsBus === false) return;
    const busStudent = findBusStudent(enroll.name || enroll.studentName, enroll.grade, enroll.classNum, enroll.studentNum);
    if (!busStudent) {
      console.log(`[매칭 실패] 수강생 매칭 불가: ${enroll.name || enroll.studentName} (${enroll.grade}학년 ${enroll.classNum}반)`);
      return;
    }
    const course = courseMap.get(enroll.courseId);
    if (!course) return;
    const days = extractCourseDays(course);
    const dayEn = days.map(d => dayMap[d]).filter(Boolean);

    if (!studentExpectedDays.has(busStudent.id)) {
      studentExpectedDays.set(busStudent.id, {
        busStudent,
        expectedDays: new Set(),
        courses: []
      });
    }
    const info = studentExpectedDays.get(busStudent.id);
    dayEn.forEach(d => info.expectedDays.add(d));
    info.courses.push({ title: course.title, days, courseId: course.id });
  });

  console.log(`\n버스 탑승 대상 방과후 학생 수: ${studentExpectedDays.size}명`);

  const missingList = [];
  studentExpectedDays.forEach((info, studentId) => {
    const s = info.busStudent;
    const actualDests = s.afterSchoolDestinations || {};
    const actualDays = Object.keys(actualDests);

    const expectedArr = Array.from(info.expectedDays);
    const missingDays = expectedArr.filter(d => !actualDests[d]);

    if (missingDays.length > 0) {
      missingList.push({
        id: studentId,
        name: s.name || s.nameKo,
        grade: s.grade,
        class: s.class || s.classNum,
        expectedDays: expectedArr,
        actualDays,
        missingDays,
        courses: info.courses
      });
    }
  });

  console.log(`\n=== 요일 누락 학생 목록 (총 ${missingList.length}명) ===`);
  missingList.forEach(m => {
    console.log(`- [${m.grade}-${m.class}] ${m.name} (ID: ${m.id})`);
    console.log(`  기대 요일: ${m.expectedDays.join(', ')}`);
    console.log(`  실제 설정된 요일: ${m.actualDays.join(', ')}`);
    console.log(`  누락된 요일: ${m.missingDays.join(', ')}`);
    console.log(`  수강 강좌:`, JSON.stringify(m.courses));
  });

  process.exit(0);
}

inspectAll().catch(e => {
  console.error(e);
  process.exit(1);
});
