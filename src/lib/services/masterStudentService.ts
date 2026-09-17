import { getDb } from '@/lib/firebase';
import { getKisbusDb } from '@/lib/kisbus/firebase';
import { 
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch, getDocs, getDoc, query, where 
} from 'firebase/firestore';
import type { MasterStudent, NewMasterStudent } from '@/lib/types/masterStudent';

const COLLECTION_NAME = 'master_students';
const DELETED_COLLECTION_NAME = 'deleted_master_students';

export interface DeletedMasterStudent extends MasterStudent {
  deletedAt: string;
  deletedReason?: string;
  originalData?: any;
}

// 학생 계정 이메일 정규표현식 검증 유틸 (예: 2023kangdongyun@kshcm.net - 입학년도 4자리 + 영문이름 + @kshcm.net)
const STUDENT_EMAIL_REGEX = /^\d{4}[a-zA-Z0-9._-]+@kshcm\.net$/i;

export const isStudentEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  // 교직원 및 관리자 계정 배제
  if (lower === 'beside1s@kshcm.net' || lower.startsWith('teacher') || lower.startsWith('admin')) {
    return false;
  }
  // 입학년도 4자리 + 영문이름 + @kshcm.net 규칙만 허용 (예: 2023kangdongyun@kshcm.net)
  return /^\d{4}[a-zA-Z0-9._-]+@kshcm\.net$/i.test(lower);
};

/**
 * 학생 이메일 계정에서 영문 이름 추출
 * 형식: [입학년도 4자리][영문이름]@kshcm.net (예: 2022kangsoobin@kshcm.net -> kangsoobin)
 */
export const extractEnglishNameFromEmail = (email?: string | null): string => {
  if (!email) return '';
  const clean = email.trim();
  const atIdx = clean.indexOf('@');
  const localPart = atIdx !== -1 ? clean.slice(0, atIdx) : clean;
  // 앞의 입학년도(4자리 숫자 등) 제거
  const enName = localPart.replace(/^\d+/, '').replace(/^[^a-zA-Z]+/, '');
  return enName;
};

/**
 * 학생의 유효한 영문 이름 반환 (기존 nameEn 우선, 없으면 이메일에서 추출)
 */
export const getStudentEnglishName = (nameEn?: string | null, email?: string | null): string => {
  if (nameEn && nameEn.trim()) return nameEn.trim();
  return extractEnglishNameFromEmail(email);
};

export const getAllMasterStudents = async (): Promise<MasterStudent[]> => {
  try {
    const [masterSnap, userSnap, busSnap] = await Promise.all([
      getDocs(collection(getDb(), COLLECTION_NAME)),
      getDocs(collection(getDb(), 'users')),
      getDocs(collection(getKisbusDb(), 'students')),
    ]);
    
    const busStudentList: any[] = busSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    // 빠른 조회를 위한 버스 학생 인덱스 맵 생성
    const busByEmail = new Map<string, any>();
    const busByGradeClassNumber = new Map<string, any>();
    const busByGradeClassName = new Map<string, any>();
    const busByName = new Map<string, any>();

    busStudentList.forEach(bs => {
      if (bs.studentEmail) busByEmail.set(bs.studentEmail.toLowerCase().trim(), bs);
      const name = bs.nameKo || bs.name;
      const grade = String(bs.grade || '');
      const cls = String(bs.class || bs.classNum || '');
      const num = String(bs.number || bs.studentNum || '');

      if (grade && cls && num) {
        busByGradeClassNumber.set(`${grade}_${cls}_${num}`, bs);
      }
      if (grade && cls && name) {
        busByGradeClassName.set(`${grade}_${cls}_${name}`, bs);
      }
      if (name) {
        busByName.set(name, bs);
      }
    });

    const findBusStudent = (s: any, email?: string) => {
      if (email && busByEmail.has(email.toLowerCase().trim())) {
        return busByEmail.get(email.toLowerCase().trim());
      }
      const name = s.nameKo || s.name || s.studentName;
      const grade = String(s.grade || s.studentGrade || '');
      const cls = String(s.classNum || s.class || s.studentClass || '');
      const num = String(s.studentNum || s.number || s.studentNumber || '');

      if (grade && cls && name && busByGradeClassName.has(`${grade}_${cls}_${name}`)) {
        return busByGradeClassName.get(`${grade}_${cls}_${name}`);
      }
      if (grade && cls && num && busByGradeClassNumber.has(`${grade}_${cls}_${num}`)) {
        return busByGradeClassNumber.get(`${grade}_${cls}_${num}`);
      }
      if (name && busByName.has(name)) {
        return busByName.get(name);
      }
      return null;
    };

    const resolveGender = (rawGender: any, busStudent?: any, studentNum?: string): 'Male' | 'Female' => {
      if (rawGender) {
        const g = String(rawGender).trim().toLowerCase();
        if (g === 'female' || g === '여' || g === '여자' || g === 'f' || g === 'w') return 'Female';
        if (g === 'male' || g === '남' || g === '남자' || g === 'm') return 'Male';
      }
      if (busStudent && busStudent.gender) {
        const bg = String(busStudent.gender).trim().toLowerCase();
        if (bg === 'female' || bg === '여' || bg === '여자' || bg === 'f' || bg === 'w') return 'Female';
        if (bg === 'male' || bg === '남' || bg === '남자' || bg === 'm') return 'Male';
      }
      const n = parseInt(studentNum || '0', 10);
      if (n >= 21 && n <= 50) return 'Female';
      return 'Male';
    };

    const map = new Map<string, MasterStudent>();
    
    userSnap.docs.forEach(doc => {
      const u = doc.data();
      const email = (u.email || doc.id || '').trim().toLowerCase();
      // 교직원 계정 배제
      const isStaff = Boolean(u.isFaculty || u.dept || (u.role && !['학부모', '학생', 'parent', 'student'].includes(u.role)));
      if (isStaff) return;

      // 학년 정보가 없으면 임의로 1학년 1반에 배치하지 않고 배제
      const grade = u.grade || u.studentGrade;
      if (!grade) return;

      if (email && isStudentEmail(email)) {
        const studentName = u.studentName || u.nameKo || u.name || '';
        if (!studentName || studentName === '사용자' || studentName === '학생') return;

        const sNum = String(u.studentNum || u.number || u.studentNumber || '');
        const matchedBus = findBusStudent(u, email);
        const resolvedGen = resolveGender(u.gender, matchedBus, sNum);

        map.set(email, {
          studentEmail: email,
          studentId: doc.id,
          name: studentName,
          nameKo: studentName,
          grade: String(grade),
          classNum: String(u.classNum || u.class || u.studentClass || '1'),
          studentNum: sNum,
          gender: resolvedGen,
          contact: u.phone || u.parentPhone || u.contact || '',
          parentEmail: u.parentEmail || '',
          address: u.address || u.residenceDestinationId || '',
          kisbusNo: u.kisbusNo || '',
          photoUrl: u.photoUrl || '',
          peStudentId: u.peStudentId || '',
        } as MasterStudent);
      }
    });

    masterSnap.docs.forEach(doc => {
      const s = doc.data();
      const email = (s.studentEmail || s.email || '').trim().toLowerCase();
      const key = email || doc.id;
      const existing = email ? map.get(email) : map.get(doc.id);
      const studentName = s.nameKo || s.name || s.studentName || existing?.nameKo || existing?.name || '';
      const sNum = String(s.studentNum || s.number || s.studentNumber || existing?.studentNum || '');
      const matchedBus = findBusStudent(s, email) || (existing ? findBusStudent(existing, email) : null);
      const resolvedGen = resolveGender(s.gender || existing?.gender, matchedBus, sNum);
      
      map.set(key, {
        ...existing,
        ...s,
        id: doc.id,
        studentId: doc.id,
        studentEmail: email || existing?.studentEmail || '',
        name: studentName || '학생',
        nameKo: studentName || '학생',
        grade: String(s.grade || s.studentGrade || existing?.grade || '1'),
        classNum: String(s.classNum || s.class || s.studentClass || existing?.classNum || '1'),
        studentNum: sNum,
        gender: resolvedGen,
        photoUrl: s.photoUrl || (existing as any)?.photoUrl || '',
        peStudentId: (s as any).peStudentId || (existing as any)?.peStudentId || '',
      } as MasterStudent);
    });

    // 이름이 없는 학생 데이터 필터링 또는 정리
    return Array.from(map.values()).filter(s => s.name && s.name !== '학생');
  } catch (err) {
    console.error('getAllMasterStudents error:', err);
    return [];
  }
};

export interface MasterStudentFilterOptions {
  grade?: string;
  classNum?: string;
}

// 1. 실시간 통합 학생 마스터 구독 (그룹/학년 필터 옵션 지원 - 온디맨드 로딩으로 속도 극대화)
export const onMasterStudentsUpdate = (
  callback: (students: MasterStudent[]) => void,
  filterOptions?: MasterStudentFilterOptions
) => {
  let masterList: MasterStudent[] = [];
  let userList: MasterStudent[] = [];
  let busStudentList: any[] = [];
  let destinationList: any[] = [];
  let routeList: any[] = [];
  let busList: any[] = [];
  let afterschoolCourseList: any[] = [];
  let afterschoolEnrollmentList: any[] = [];
  let afterschoolClassroomList: any[] = [];

  const targetGrade = filterOptions?.grade;
  const isFilteringByGrade = targetGrade && targetGrade !== 'all' && targetGrade !== 'none' && targetGrade !== '';
  
  let gradeValues: any[] = [];
  if (isFilteringByGrade) {
    const num = parseInt(targetGrade, 10);
    if (!isNaN(num)) {
      gradeValues = [targetGrade, num];
    } else {
      gradeValues = [targetGrade];
    }
  }

  const mergeAndEmit = () => {
    const map = new Map<string, MasterStudent>();
    const destMap = new Map<string, string>();
    destinationList.forEach(d => {
      if (d.id) destMap.set(d.id, d.name || d.id);
    });

    const busNameMap = new Map<string, string>();
    busList.forEach(b => {
      if (b.id) busNameMap.set(b.id, b.name || b.id);
    });

    const classroomMap = new Map<string, string>();
    afterschoolClassroomList.forEach(c => {
      if (c.id) classroomMap.set(c.id, c.name || c.id);
    });

    const courseMap = new Map<string, any>();
    afterschoolCourseList.forEach(c => {
      if (c.id) courseMap.set(c.id, c);
    });

    // 1. users 컬렉션 (시스템에 직접 등록된 실제 학생 계정만 필터링)
    userList.forEach(s => {
      const key = (s.studentEmail || s.studentId).toLowerCase();
      if (key && isStudentEmail(key)) {
        map.set(key, s);
      }
    });

    // 2. master_students 컬렉션 (통합 마스터 학생 DB)
    masterList.forEach(s => {
      const key = (s.studentEmail || s.studentId).toLowerCase();
      if (key && isStudentEmail(key)) {
        const existing = map.get(key);
        map.set(key, { ...existing, ...s });
      }
    });

    // 3. 방과후 수강 신청 및 스쿨버스 학생 & 목적지 & 노선 정보와 양방향 100% 통합 매칭
    map.forEach((master, key) => {
      // (1) 방과후 수강 신청 실시간 연동 매칭
      const matchedEnrollments = afterschoolEnrollmentList.filter(e => {
        if (e.status === 'CANCELLED') return false;
        const idMatches = e.studentId && (e.studentId === master.studentId || e.studentId.toLowerCase() === master.studentEmail.toLowerCase());
        const nameMatches = (e.name === master.name || e.name === master.nameKo);
        const gradeClassMatches = String(e.grade) === String(master.grade) && String(e.classNum || e.class) === String(master.classNum);
        const phoneMatches = master.contact && e.parentPhone && master.contact.replace(/\D/g, '') === e.parentPhone.replace(/\D/g, '');
        const kisbusNoMatches = master.kisbusNo && e.kisbusNo && master.kisbusNo === e.kisbusNo;
        return idMatches || (nameMatches && gradeClassMatches) || (nameMatches && phoneMatches) || kisbusNoMatches;
      });

      const enrolledCourses = matchedEnrollments.map(e => {
        const c = courseMap.get(e.courseId) || {} as any;
        const days = (e.selectedDays && e.selectedDays.length > 0) ? e.selectedDays : (c.classDays || []);
        const classroom = c.classroom || (c.classroomId ? classroomMap.get(c.classroomId) : '') || '';
        return {
          courseId: e.courseId,
          title: c.title || e.courseTitle || '방과후 강좌',
          days: Array.isArray(days) ? days : [String(days)],
          classroom: classroom || undefined,
          classTime: c.classTime || undefined,
          instructorName: c.instructorName || undefined,
          kisbusNo: e.kisbusNo || c.kisbusDepartureTime || undefined,
        };
      });

      const enrolledCourseIds = enrolledCourses.map(c => c.courseId);
      const enrolledCourseTitles = enrolledCourses.map(c => c.title);
      const totalTuition = matchedEnrollments.reduce((sum, e) => sum + (Number(e.tuition) || 0) + (Number(e.materialFee) || 0) + (Number(e.textbookFee) || 0), 0);

      master.afterschoolSummary = {
        enrolledCourseIds,
        enrolledCourseTitles,
        enrolledCourses,
        totalTuition,
        paymentStatus: (master.afterschoolSummary?.paymentStatus as any) || (totalTuition > 0 ? 'UNPAID' : 'PAID')
      };

      // (2) 스쿨버스 거주지(주소) 명칭 동기화
      if (master.address && destMap.has(master.address)) {
        master.address = destMap.get(master.address)!;
      }

      // 스쿨버스 학생 매칭
      const matchedBusStudent = busStudentList.find(bs => {
        const nameMatches = bs.name === master.name || bs.nameKo === master.name || (bs.name && bs.name.includes(master.name));
        const gradeClassMatches = String(bs.grade) === String(master.grade) && String(bs.class) === String(master.classNum);
        const contactMatches = master.contact && bs.contact && master.contact.replace(/\D/g, '') === bs.contact.replace(/\D/g, '');
        const kisbusNoMatches = master.kisbusNo && bs.kisbusNo && master.kisbusNo === bs.kisbusNo;
        return (nameMatches && gradeClassMatches) || (nameMatches && contactMatches) || kisbusNoMatches || nameMatches;
      });

      let morningDestId: string | null = null;
      let afternoonDestId: string | null = null;
      let assignedBusName: string | null = null;
      let assignedBusId: string | null = null;
      let assignedSeatNumber: number | null = null;

      if (matchedBusStudent) {
        if (matchedBusStudent.gender) {
          const bg = String(matchedBusStudent.gender).toLowerCase().trim();
          master.gender = bg === 'female' || bg === '여' || bg === '여자' || bg === 'f' || bg === 'w' ? 'Female' : 'Male';
        }
        morningDestId = matchedBusStudent.morningDestinationId || matchedBusStudent.suggestedMorningDestination || null;
        afternoonDestId = matchedBusStudent.afternoonDestinationId || matchedBusStudent.suggestedAfternoonDestination || null;
        const destName = (morningDestId ? (destMap.get(morningDestId) || morningDestId) : null) || 
                         (afternoonDestId ? (destMap.get(afternoonDestId) || afternoonDestId) : null);

        if ((!master.address || destMap.has(master.address)) && destName) {
          master.address = destName;
        }

        for (const route of routeList) {
          const seat = (route.seating || []).find((se: any) => se.studentId === matchedBusStudent.id);
          if (seat) {
            assignedBusId = route.busId || null;
            assignedBusName = busNameMap.get(route.busId) || null;
            assignedSeatNumber = seat.seatNumber || null;
            break;
          }
        }
      }

      // (3) 다중 스쿨버스 노선 분리 산출 (정규 하교 버스 + 방과후 수강 요일별 버스)
      const afterSchoolDays = Array.from(new Set(enrolledCourses.flatMap(c => c.days || [])));
      const weekdays = ['월', '화', '수', '목', '금'];
      const regularBusDays = weekdays.filter(day => !afterSchoolDays.includes(day));

      let regularBusName: string | null = null;
      if (matchedBusStudent) {
        const afternoonRoute = routeList.find((r: any) => 
          r.type === 'Afternoon' && (r.seating || []).some((se: any) => se.studentId === matchedBusStudent.id)
        );
        if (afternoonRoute) {
          regularBusName = busNameMap.get(afternoonRoute.busId) || afternoonRoute.name || null;
        } else if (matchedBusStudent.afternoonDestinationId) {
          const destRoute = routeList.find((r: any) => 
            r.type === 'Afternoon' && (r.destinationIds || []).includes(matchedBusStudent.afternoonDestinationId)
          );
          if (destRoute) {
            regularBusName = busNameMap.get(destRoute.busId) || destRoute.name || null;
          }
        }
      }
      if (!regularBusName) {
        regularBusName = assignedBusName || master.busSummary?.assignedBusName || null;
      }

      const afterSchoolBuses: { day: string; busName: string; courseTitle?: string }[] = [];
      for (const day of afterSchoolDays) {
        const courseOnDay = enrolledCourses.find(c => c.days?.includes(day));
        let busForDay: string | null = null;

        if (matchedBusStudent) {
          const asRoute = routeList.find((r: any) => {
            if (r.type !== 'AfterSchool') return false;
            if (r.operatingDays && Array.isArray(r.operatingDays) && !r.operatingDays.includes(day)) return false;
            return (r.seating || []).some((se: any) => {
              if (se.studentId !== matchedBusStudent.id) return false;
              if (se.days && Array.isArray(se.days) && !se.days.includes(day)) return false;
              return true;
            });
          });
          if (asRoute) {
            busForDay = busNameMap.get(asRoute.busId) || asRoute.name || null;
          }

          if (!busForDay && matchedBusStudent.afterSchoolDestinations?.[day]) {
            const destId = matchedBusStudent.afterSchoolDestinations[day];
            const destRoute = routeList.find((r: any) => 
              r.type === 'AfterSchool' && (r.destinationIds || []).includes(destId)
            );
            if (destRoute) {
              busForDay = busNameMap.get(destRoute.busId) || destRoute.name || null;
            }
          }
        }

        if (!busForDay && courseOnDay?.kisbusNo) {
          busForDay = courseOnDay.kisbusNo;
        }

        if (busForDay) {
          afterSchoolBuses.push({
            day,
            busName: busForDay,
            courseTitle: courseOnDay?.title
          });
        }
      }

      master.busSummary = {
        ...(master.busSummary || {}),
        morningDestinationId: morningDestId,
        afternoonDestinationId: afternoonDestId,
        assignedBusId,
        assignedBusName: assignedBusName || regularBusName || master.busSummary?.assignedBusName || null,
        assignedSeatNumber,
        afterSchoolDestinations: matchedBusStudent?.afterSchoolDestinations || master.busSummary?.afterSchoolDestinations || {},
        regularBusName: regularBusName || null,
        regularBusDays,
        afterSchoolBuses,
      };
    });

    callback(Array.from(map.values()));
  };

  // 1. master_students 실시간 리스너 (선택 학년 온디맨드 쿼리)
  const masterQuery = isFilteringByGrade
    ? query(collection(getDb(), COLLECTION_NAME), where('grade', 'in', gradeValues))
    : collection(getDb(), COLLECTION_NAME);
  const unsubMaster = onSnapshot(masterQuery, (snapshot) => {
    masterList = snapshot.docs.map(doc => {
      const data = doc.data();
      const email = data.studentEmail || '';
      return {
        studentId: doc.id,
        ...data,
        nameEn: data.nameEn || extractEnglishNameFromEmail(email)
      } as MasterStudent;
    });
    mergeAndEmit();
  }, (err) => console.error('master_students snapshot error:', err));

  // 2. users 실시간 리스너 (선택 학년 온디맨드 쿼리)
  const usersQuery = isFilteringByGrade
    ? query(collection(getDb(), 'users'), where('grade', 'in', gradeValues))
    : collection(getDb(), 'users');
  const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
    const rawUsers = snapshot.docs.map(doc => {
      const data = doc.data();
      const userEmail = (data.email || doc.id || '').trim();
      return {
        ...data,
        docId: doc.id,
        email: userEmail
      };
    });

    const filtered = rawUsers.filter((u: any) => {
      if (!isStudentEmail(u.email)) return false;
      const isStaff = Boolean(u.isFaculty || u.dept || (u.role && !['학부모', '학생', 'parent', 'student'].includes(u.role)));
      if (isStaff) return false;
      // 학년 정보가 없는 계정은 1학년 1반 기본값으로 생성하지 않고 제외
      const grade = u.grade || u.studentGrade;
      if (!grade) return false;
      if (isFilteringByGrade && String(grade) !== String(targetGrade)) return false;
      const studentName = u.studentName || u.nameKo || u.name || '';
      if (!studentName || studentName === '사용자' || studentName === '학생') return false;
      return true;
    });
    
    userList = filtered.map((u: any) => ({
      studentEmail: u.email,
      studentId: u.docId || u.email,
      name: u.studentName || u.nameKo || u.name,
      nameKo: u.studentName || u.nameKo || u.name,
      nameEn: u.nameEn || extractEnglishNameFromEmail(u.email),
      grade: String(u.grade || u.studentGrade),
      classNum: String(u.class || u.classNum || u.studentClass || '1'),
      studentNum: String(u.number || u.studentNum || u.studentNumber || ''),
      gender: u.gender === 'Female' || u.gender === '여' ? 'Female' : 'Male',
      contact: u.phone || u.parentPhone || u.contact || '',
      parentEmail: u.parentEmail || '',
      address: u.address || u.residenceDestinationId || '',
      kisbusNo: u.kisbusNo || '',
      afterschoolSummary: {
        enrolledCourseIds: [],
        enrolledCourseTitles: [],
        enrolledCourses: [],
      },
      busSummary: {
        assignedBusName: u.busName || null,
      }
    } as MasterStudent));

    mergeAndEmit();
  }, (err) => console.error('users snapshot error:', err));

  // 3. 스쿨버스 students 실시간 리스너 (선택 학년 온디맨드 쿼리)
  const busStudentsQuery = isFilteringByGrade
    ? query(collection(getKisbusDb(), 'students'), where('grade', 'in', gradeValues))
    : collection(getKisbusDb(), 'students');
  const unsubBusStudents = onSnapshot(busStudentsQuery, (snapshot) => {
    busStudentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('kisbus students snapshot error:', err));

  // 4. 스쿨버스 destinations 실시간 리스너
  const unsubDestinations = onSnapshot(collection(getKisbusDb(), 'destinations'), (snapshot) => {
    destinationList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('kisbus destinations snapshot error:', err));

  // 5. 스쿨버스 routes 실시간 리스너
  const unsubRoutes = onSnapshot(collection(getKisbusDb(), 'routes'), (snapshot) => {
    routeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('kisbus routes snapshot error:', err));

  // 6. 스쿨버스 buses 실시간 리스너
  const unsubBuses = onSnapshot(collection(getKisbusDb(), 'buses'), (snapshot) => {
    busList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('kisbus buses snapshot error:', err));

  // 7. 방과후 courses 실시간 리스너
  const unsubCourses = onSnapshot(collection(getDb(), 'afterschool_courses'), (snapshot) => {
    afterschoolCourseList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('afterschool_courses snapshot error:', err));

  // 8. 방과후 enrollments 실시간 리스너 (선택 학년 온디맨드 쿼리)
  const enrollmentsQuery = isFilteringByGrade
    ? query(collection(getDb(), 'afterschool_enrollments'), where('grade', 'in', gradeValues))
    : collection(getDb(), 'afterschool_enrollments');
  const unsubEnrollments = onSnapshot(enrollmentsQuery, (snapshot) => {
    afterschoolEnrollmentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('afterschool_enrollments snapshot error:', err));

  // 9. 방과후 classrooms 실시간 리스너
  const unsubClassrooms = onSnapshot(collection(getDb(), 'afterschool_classrooms'), (snapshot) => {
    afterschoolClassroomList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('afterschool_classrooms snapshot error:', err));

  return () => {
    unsubMaster();
    unsubUsers();
    unsubBusStudents();
    unsubDestinations();
    unsubRoutes();
    unsubBuses();
    unsubCourses();
    unsubEnrollments();
    unsubClassrooms();
  };
};

// 2. 단일 마스터 학생 생성 (users & master_students & kisbus students 동시 연동)
export const createMasterStudent = async (studentData: NewMasterStudent): Promise<string> => {
  const colRef = collection(getDb(), COLLECTION_NAME);
  const docRef = doc(colRef);
  const now = new Date().toISOString();
  
  const payload: MasterStudent = {
    ...studentData,
    studentId: docRef.id,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, payload);

  // users 컬렉션에도 동시 등록/업데이트하여 연동 완벽 보장 (난수 ID가 아닌 이메일 기반 doc ID 사용 및 필드 완결 저장)
  if (studentData.studentEmail) {
    const cleanEmail = studentData.studentEmail.trim();
    const userPayload: any = {
      email: cleanEmail,
      name: studentData.name,
      studentName: studentData.name,
      displayName: studentData.name,
      studentGrade: studentData.grade,
      grade: studentData.grade,
      studentClass: studentData.classNum,
      class: studentData.classNum,
      studentNumber: studentData.studentNum || '',
      number: studentData.studentNum || '',
      gender: studentData.gender || 'Male',
      phone: studentData.contact || '',
      parentPhone: studentData.contact || '',
      address: studentData.address || '',
      photoUrl: studentData.photoUrl || '',
      role: 'student'
    };

    const q = query(collection(getDb(), 'users'), where("email", "==", cleanEmail));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      for (const userDoc of snapshot.docs) {
        await updateDoc(doc(getDb(), 'users', userDoc.id), userPayload);
      }
    } else {
      const userRef = doc(getDb(), 'users', cleanEmail.toLowerCase());
      await setDoc(userRef, {
        uid: cleanEmail.toLowerCase(),
        ...userPayload
      }, { merge: true });
    }
  }

  // 스쿨버스 students 컬렉션에도 거주지 주소(목적지), 성별, 연락처 완결 동기화
  if (studentData.name) {
    await syncAddressToKisbusStudent(
      studentData.name, 
      studentData.grade, 
      studentData.classNum, 
      studentData.address || '', 
      studentData.contact,
      studentData.gender || 'Male',
      studentData.studentEmail
    );
  }

  return docRef.id;
};

// 3. 마스터 학생 정보 수정 (기본 프로필 + users 컬렉션 + 스쿨버스 students 동시 양방향 업데이트)
export const updateMasterStudent = async (studentId: string, updateData: Partial<MasterStudent>): Promise<void> => {
  const db = getDb();
  let targetRef = doc(db, COLLECTION_NAME, studentId);
  const existingSnap = await getDoc(targetRef);
  let existingData: MasterStudent | null = existingSnap.exists() ? (existingSnap.data() as MasterStudent) : null;

  const emailToSearch = (updateData.studentEmail || existingData?.studentEmail || (isStudentEmail(studentId) ? studentId : '')).trim();

  // 만약 id로 찾지 못했고 이메일이 있다면, master_students에서 email로 기존 문서 검색
  if (!existingData && emailToSearch) {
    const q = query(collection(db, COLLECTION_NAME), where("studentEmail", "==", emailToSearch));
    const snap = await getDocs(q);
    if (!snap.empty) {
      targetRef = snap.docs[0].ref;
      existingData = snap.docs[0].data() as MasterStudent;
    }
  }

  const now = new Date().toISOString();
  
  // setDoc({ merge: true })를 사용하여 문서가 이미 삭제되었거나 없어도 'No document to update' 에러 없이 자동 생성/복구(Self-Healing)
  await setDoc(targetRef, {
    ...updateData,
    studentId: targetRef.id,
    updatedAt: now,
    ...(existingData ? {} : { createdAt: now })
  }, { merge: true });

  const nameToUse = updateData.name || existingData?.name;
  const nameEnToUse = updateData.nameEn !== undefined ? updateData.nameEn : existingData?.nameEn;
  const gradeToUse = updateData.grade || existingData?.grade;
  const classToUse = updateData.classNum || existingData?.classNum;
  const numToUse = updateData.studentNum !== undefined ? updateData.studentNum : existingData?.studentNum;
  const genderToUse = updateData.gender || existingData?.gender;
  const contactToUse = updateData.contact !== undefined ? updateData.contact : existingData?.contact;
  const addressToUse = updateData.address !== undefined ? updateData.address : existingData?.address;
  const photoToUse = updateData.photoUrl !== undefined ? updateData.photoUrl : existingData?.photoUrl;

  // users 컬렉션 동시 업데이트
  if (emailToSearch) {
    const cleanEmail = emailToSearch.toLowerCase();
    const q = query(collection(db, 'users'), where("email", "==", emailToSearch));
    const snapshot = await getDocs(q);
    const userPayload: any = {};
    if (nameToUse) {
      userPayload.name = nameToUse;
      userPayload.studentName = nameToUse;
    }
    if (nameEnToUse !== undefined) {
      userPayload.nameEn = nameEnToUse;
    }
    if (gradeToUse) {
      userPayload.grade = gradeToUse;
      userPayload.studentGrade = gradeToUse;
    }
    if (classToUse) {
      userPayload.class = classToUse;
      userPayload.studentClass = classToUse;
    }
    if (numToUse !== undefined) {
      userPayload.number = numToUse;
      userPayload.studentNumber = numToUse;
    }
    if (genderToUse) {
      userPayload.gender = genderToUse;
    }
    if (contactToUse !== undefined) {
      userPayload.phone = contactToUse;
      userPayload.parentPhone = contactToUse;
    }
    if (addressToUse !== undefined) {
      userPayload.address = addressToUse;
    }
    if (photoToUse !== undefined) {
      userPayload.photoUrl = photoToUse;
    }

    if (!snapshot.empty) {
      for (const userDoc of snapshot.docs) {
        await setDoc(doc(db, 'users', userDoc.id), userPayload, { merge: true });
      }
    } else {
      const directRef = doc(db, 'users', cleanEmail);
      await setDoc(directRef, {
        uid: cleanEmail,
        email: emailToSearch,
        role: 'student',
        ...userPayload
      }, { merge: true });
    }
  }

  // 스쿨버스 students 컬렉션 동시 양방향 동기화 (성별, 목적지, 연락처, 영문이름, 학년, 반, 번호 등)
  if (nameToUse) {
    await syncAddressToKisbusStudent(
      nameToUse, 
      gradeToUse, 
      classToUse, 
      addressToUse, 
      contactToUse,
      genderToUse,
      emailToSearch,
      nameEnToUse,
      numToUse
    );
  }

  // 학교체육(PAPS) 측정 기록 성별 동기화
  if (genderToUse) {
    try {
      const { syncStudentGenderToPeRecords } = await import('./peService');
      await syncStudentGenderToPeRecords('KISH', targetRef.id, genderToUse);
      if (emailToSearch && emailToSearch !== targetRef.id) {
        await syncStudentGenderToPeRecords('KISH', emailToSearch, genderToUse);
      }
    } catch (peErr) {
      console.warn('[MasterStudentService] syncStudentGenderToPeRecords failed:', peErr);
    }
  }
};

// 스쿨버스 학생 목적지 및 성별 동기화 헬퍼 함수
export const syncAddressToKisbusStudent = async (
  name: string, 
  grade?: string, 
  classNum?: string, 
  address?: string | null,
  contact?: string | null,
  gender?: 'Male' | 'Female',
  studentEmail?: string | null,
  nameEn?: string | null,
  studentNum?: string | null
) => {
  try {
    if (!name) return;
    const busDb = getKisbusDb();
    
    // 1. 목적지 목록에서 목적지 ID 조회 (address가 제공된 경우)
    let destIdToSet: string | null = null;
    if (address) {
      const destSnap = await getDocs(collection(busDb, 'destinations'));
      const destinations = destSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const matchedDest = destinations.find((d: any) => d.name === address || d.id === address);
      destIdToSet = matchedDest ? matchedDest.id : address;
    }

    // 2. 스쿨버스 students 컬렉션에서 학생 조회
    const studSnap = await getDocs(collection(busDb, 'students'));
    const busStudents = studSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const targetStudent = busStudents.find((s: any) => {
      if (studentEmail && s.studentEmail && s.studentEmail.toLowerCase() === studentEmail.toLowerCase()) {
        return true;
      }
      const nameMatches = s.name === name || s.nameKo === name || (s.name && s.name.includes(name));
      const gradeMatches = !grade || String(s.grade) === String(grade);
      const classMatches = !classNum || String(s.class) === String(classNum);
      return nameMatches && gradeMatches && classMatches;
    }) || busStudents.find((s: any) => s.name === name || s.nameKo === name);

    if (targetStudent) {
      const busPayload: any = {};
      if (destIdToSet) {
        busPayload.morningDestinationId = destIdToSet;
        busPayload.afternoonDestinationId = destIdToSet;
        busPayload.suggestedMorningDestination = destIdToSet;
        busPayload.suggestedAfternoonDestination = destIdToSet;
      }
      if (grade !== undefined && grade !== null && grade !== '') {
        busPayload.grade = String(grade);
      }
      if (classNum !== undefined && classNum !== null && classNum !== '') {
        busPayload.class = String(classNum);
        busPayload.classNum = String(classNum);
      }
      if (studentNum !== undefined && studentNum !== null && studentNum !== '') {
        busPayload.number = String(studentNum);
        busPayload.studentNum = String(studentNum);
      }
      if (contact !== undefined && contact !== null) {
        busPayload.contact = contact ? contact.replace(/\D/g, '') : (targetStudent as any).contact;
      }
      if (gender) {
        busPayload.gender = gender;
      }
      if (studentEmail) {
        busPayload.studentEmail = studentEmail;
      }
      if (nameEn !== undefined && nameEn !== null) {
        busPayload.nameEn = nameEn;
      }
      if (Object.keys(busPayload).length > 0) {
        await updateDoc(doc(busDb, 'students', targetStudent.id), busPayload);
      }
    }
  } catch (err) {
    console.error("Error syncing to kisbus student:", err);
  }
};

// 4. 마스터 학생 삭제 (안전 모드: 휴지통 백업 아카이브 저장 + 스쿨버스/방과후 원천 데이터 100% 안전 보존)
export const deleteMasterStudent = async (
  studentIdOrEmail: string,
  extraInfo?: { studentEmail?: string; name?: string; grade?: string; classNum?: string }
): Promise<void> => {
  try {
    const db = getDb();
    const isEmail = isStudentEmail(studentIdOrEmail) || studentIdOrEmail.includes('@');
    let emailToClean = (extraInfo?.studentEmail || (isEmail ? studentIdOrEmail : '')).trim().toLowerCase();
    let studentName = extraInfo?.name || '';
    let grade = extraInfo?.grade || '';
    let classNum = extraInfo?.classNum || '';
    let docIdToDelete = isEmail ? '' : studentIdOrEmail;

    let snapshotData: any = null;

    // 1) master_students 컬렉션 문서 확인 및 스냅샷 백업
    if (docIdToDelete) {
      const directSnap = await getDoc(doc(db, COLLECTION_NAME, docIdToDelete));
      if (directSnap.exists()) {
        snapshotData = { ...directSnap.data(), studentId: directSnap.id };
        const d = directSnap.data();
        if (!emailToClean && d.studentEmail) emailToClean = d.studentEmail.trim().toLowerCase();
        if (!studentName && (d.name || d.nameKo)) studentName = d.name || d.nameKo;
        if (!grade && d.grade) grade = String(d.grade);
        if (!classNum && d.classNum) classNum = String(d.classNum);

        // 형제자매 그룹 해제
        if (d.siblingGroupId) {
          try {
            await unlinkMasterStudentSibling(docIdToDelete);
          } catch (sibErr) {
            console.warn('형제자매 해제 중 경고 (삭제 계속):', sibErr);
          }
        }

        // master_students 활성 문서 삭제
        await deleteDoc(directSnap.ref);
      }
    }

    // 2) 이메일로 매칭되는 master_students 문서 전체 삭제 및 스냅샷 보강
    if (emailToClean) {
      const qMaster = query(collection(db, COLLECTION_NAME), where('studentEmail', '==', emailToClean));
      const masterSnap = await getDocs(qMaster);
      for (const d of masterSnap.docs) {
        if (!snapshotData) {
          snapshotData = { ...d.data(), studentId: d.id };
        }
        if (d.id !== docIdToDelete) {
          const data = d.data();
          if (data.siblingGroupId) {
            try {
              await unlinkMasterStudentSibling(d.id);
            } catch (e) {}
          }
          await deleteDoc(d.ref);
        }
      }
    }

    // 3) users 컬렉션에서 스냅샷 보완 및 계정 정리 (활성 목록 리스너 잔존 방지)
    if (emailToClean) {
      const directUserRef = doc(db, 'users', emailToClean);
      const directUserSnap = await getDoc(directUserRef);
      if (directUserSnap.exists()) {
        const ud = directUserSnap.data();
        if (!snapshotData) {
          snapshotData = {
            studentId: docIdToDelete || emailToClean,
            studentEmail: emailToClean,
            name: ud.studentName || ud.name || studentName || '학생',
            nameKo: ud.studentName || ud.name || studentName || '학생',
            grade: String(ud.grade || ud.studentGrade || grade || '1'),
            classNum: String(ud.class || ud.studentClass || classNum || '1'),
            studentNum: String(ud.number || ud.studentNumber || ''),
            gender: ud.gender || 'Male',
            contact: ud.phone || ud.parentPhone || '',
            address: ud.address || '',
          };
        }
        await deleteDoc(directUserRef);
      }

      const qUser = query(collection(db, 'users'), where('email', '==', emailToClean));
      const userSnap = await getDocs(qUser);
      for (const uDoc of userSnap.docs) {
        if (!snapshotData) {
          const ud = uDoc.data();
          snapshotData = {
            studentId: docIdToDelete || emailToClean,
            studentEmail: emailToClean,
            name: ud.studentName || ud.name || studentName || '학생',
            nameKo: ud.studentName || ud.name || studentName || '학생',
            grade: String(ud.grade || ud.studentGrade || grade || '1'),
            classNum: String(ud.class || ud.studentClass || classNum || '1'),
            studentNum: String(ud.number || ud.studentNumber || ''),
            gender: ud.gender || 'Male',
            contact: ud.phone || ud.parentPhone || '',
            address: ud.address || '',
          };
        }
        await deleteDoc(uDoc.ref);
      }
    }

    if (docIdToDelete) {
      const userByIdRef = doc(db, 'users', docIdToDelete);
      const userByIdSnap = await getDoc(userByIdRef);
      if (userByIdSnap.exists()) {
        await deleteDoc(userByIdRef);
      }
    }

    // 4) 휴지통(deleted_master_students)에 전체 데이터 스냅샷 백업 저장 (실수 삭제 100% 복구 보장)
    const backupId = emailToClean ? emailToClean.replace(/[^a-zA-Z0-9_-]/g, '_') : (docIdToDelete || `del_${Date.now()}`);
    const backupPayload: DeletedMasterStudent = {
      ...(snapshotData || {}),
      studentId: docIdToDelete || emailToClean || backupId,
      studentEmail: emailToClean || snapshotData?.studentEmail || '',
      name: studentName || snapshotData?.name || '학생',
      grade: grade || snapshotData?.grade || '1',
      classNum: classNum || snapshotData?.classNum || '1',
      deletedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, DELETED_COLLECTION_NAME, backupId), backupPayload, { merge: true });

    // ★★★ [중요: 스쿨버스 및 방과후 데이터 원천 보존 원칙] ★★★
    // 스쿨버스 DB(kisbusDb.students)와 방과후 수강 DB(afterschool_courses, enrollments)는 절대 물리 삭제하지 않습니다!
    // 실수로 계정을 삭제하더라도 기존 버스 배정(좌석, 정류장)과 방과후 수강/출결 이력은 안전하게 보존되며,
    // [휴지통]에서 복구하거나 재등록 시 즉시 원래 상태로 100% 다시 바인딩됩니다.
  } catch (err) {
    console.error('deleteMasterStudent error:', err);
    throw err;
  }
};

// 4-1. 삭제된 학생 목록 실시간 구독
export const onDeletedMasterStudentsUpdate = (callback: (students: DeletedMasterStudent[]) => void) => {
  return onSnapshot(collection(getDb(), DELETED_COLLECTION_NAME), (snap) => {
    const list = snap.docs.map(d => ({
      ...d.data(),
      studentId: d.id
    } as DeletedMasterStudent));
    callback(list);
  }, (err) => console.error('onDeletedMasterStudentsUpdate error:', err));
};

// 4-2. 휴지통에서 학생 계정 즉시 복구 (Restore)
export const restoreMasterStudent = async (backupDocId: string): Promise<void> => {
  const db = getDb();
  const backupRef = doc(db, DELETED_COLLECTION_NAME, backupDocId);
  const backupSnap = await getDoc(backupRef);
  if (!backupSnap.exists()) {
    throw new Error('복구할 삭제 학생 데이터를 찾을 수 없습니다.');
  }

  const data = backupSnap.data() as DeletedMasterStudent;
  const originalStudentId = data.studentId || backupDocId;
  const targetEmail = (data.studentEmail || '').trim().toLowerCase();
  const now = new Date().toISOString();

  // 1) master_students 컬렉션에 복원
  const restoreDocRef = doc(db, COLLECTION_NAME, originalStudentId);
  const { deletedAt, deletedReason, originalData, ...cleanStudentData } = data;
  await setDoc(restoreDocRef, {
    ...cleanStudentData,
    studentId: originalStudentId,
    updatedAt: now,
  }, { merge: true });

  // 2) users 컬렉션에 계정 복원
  if (targetEmail) {
    const userRef = doc(db, 'users', targetEmail);
    await setDoc(userRef, {
      uid: targetEmail,
      email: targetEmail,
      name: data.name,
      studentName: data.name,
      displayName: data.name,
      grade: data.grade,
      studentGrade: data.grade,
      class: data.classNum,
      studentClass: data.classNum,
      number: data.studentNum || '',
      studentNumber: data.studentNum || '',
      gender: data.gender || 'Male',
      phone: data.contact || '',
      parentPhone: data.contact || '',
      address: data.address || '',
      photoUrl: data.photoUrl || '',
      role: 'student',
      updatedAt: now,
    }, { merge: true });
  }

  // 3) 스쿨버스 students 컬렉션과 즉시 다시 양방향 재연결 동기화
  if (data.name) {
    await syncAddressToKisbusStudent(
      data.name,
      data.grade,
      data.classNum,
      data.address || '',
      data.contact,
      data.gender || 'Male',
      targetEmail,
      data.nameEn,
      data.studentNum
    );
  }

  // 4) 휴지통에서 해당 백업 문서 제거
  await deleteDoc(backupRef);
};

// 4-3. 휴지통에서 백업 영구 삭제 (Permanent Delete Backup)
export const permanentlyDeleteMasterStudent = async (backupDocId: string): Promise<void> => {
  const db = getDb();
  await deleteDoc(doc(db, DELETED_COLLECTION_NAME, backupDocId));
};

/**
 * 4-4. 전학 / 자퇴 학생 전용 완전 영구 삭제 (Purge)
 * - master_students 및 users 계정 영구 삭제 (로그인 차단)
 * - 휴지통(deleted_master_students) 백업 영구 삭제
 * - 스쿨버스 DB(students) 삭제 및 모든 노선(routes) 좌석 배정 해제(빈자리 반환)
 * - 방과후 수강 신청(afterschool_enrollments) 전수 삭제 및 정원 반환
 * - 형제자매 연결 완전 해제
 */
export const purgeMasterStudent = async (
  studentIdOrEmail: string,
  extraInfo?: { studentEmail?: string; name?: string; grade?: string; classNum?: string }
): Promise<{ busSeatsReleased: number; enrollmentsRemoved: number }> => {
  const db = getDb();
  const kisbusDb = getKisbusDb();
  const isEmail = isStudentEmail(studentIdOrEmail) || studentIdOrEmail.includes('@');
  let emailToClean = (extraInfo?.studentEmail || (isEmail ? studentIdOrEmail : '')).trim().toLowerCase();
  let studentName = extraInfo?.name || '';
  let grade = extraInfo?.grade || '';
  let classNum = extraInfo?.classNum || '';
  let docIdToDelete = isEmail ? '' : studentIdOrEmail;

  // 1. 기존 데이터에서 누락된 정보 보완
  if (docIdToDelete) {
    const directSnap = await getDoc(doc(db, COLLECTION_NAME, docIdToDelete));
    if (directSnap.exists()) {
      const d = directSnap.data();
      if (!emailToClean && d.studentEmail) emailToClean = d.studentEmail.trim().toLowerCase();
      if (!studentName && (d.name || d.nameKo)) studentName = d.name || d.nameKo;
      if (!grade && d.grade) grade = String(d.grade);
      if (!classNum && d.classNum) classNum = String(d.classNum);
    }
  }

  // 휴지통에서도 정보 보완 시도
  const backupId = emailToClean ? emailToClean.replace(/[^a-zA-Z0-9_-]/g, '_') : docIdToDelete;
  if (backupId) {
    const bSnap = await getDoc(doc(db, DELETED_COLLECTION_NAME, backupId));
    if (bSnap.exists()) {
      const bd = bSnap.data();
      if (!emailToClean && bd.studentEmail) emailToClean = bd.studentEmail.trim().toLowerCase();
      if (!studentName && bd.name) studentName = bd.name;
      if (!grade && bd.grade) grade = String(bd.grade);
      if (!classNum && bd.classNum) classNum = String(bd.classNum);
    }
  }

  // 2. 형제자매 그룹 해제
  if (docIdToDelete) {
    try {
      await unlinkMasterStudentSibling(docIdToDelete);
    } catch (e) {}
  }

  // 3. master_students 컬렉션 문서 삭제
  if (docIdToDelete) {
    await deleteDoc(doc(db, COLLECTION_NAME, docIdToDelete));
  }
  if (emailToClean) {
    const qMaster = query(collection(db, COLLECTION_NAME), where('studentEmail', '==', emailToClean));
    const masterSnap = await getDocs(qMaster);
    for (const d of masterSnap.docs) {
      await deleteDoc(d.ref);
    }
  }

  // 4. users 컬렉션 문서 영구 삭제
  if (emailToClean) {
    const directUserRef = doc(db, 'users', emailToClean);
    const directUserSnap = await getDoc(directUserRef);
    if (directUserSnap.exists()) {
      await deleteDoc(directUserRef);
    }

    const qUser = query(collection(db, 'users'), where('email', '==', emailToClean));
    const userSnap = await getDocs(qUser);
    for (const uDoc of userSnap.docs) {
      await deleteDoc(uDoc.ref);
    }
  }
  if (docIdToDelete) {
    const userByIdRef = doc(db, 'users', docIdToDelete);
    const userByIdSnap = await getDoc(userByIdRef);
    if (userByIdSnap.exists()) {
      await deleteDoc(userByIdRef);
    }
  }

  // 5. 휴지통(deleted_master_students) 백업 문서 영구 삭제
  if (backupId) {
    await deleteDoc(doc(db, DELETED_COLLECTION_NAME, backupId));
  }
  if (emailToClean && backupId !== emailToClean) {
    await deleteDoc(doc(db, DELETED_COLLECTION_NAME, emailToClean));
  }

  // 6. 스쿨버스 DB(kisbusDb) 연동 완전 삭제 및 모든 노선 좌석 배정 해제 (빈자리 반환)
  let busSeatsReleased = 0;
  try {
    const busStudentsCol = collection(kisbusDb, 'students');
    const matchedBusStudentIds = new Set<string>();

    if (docIdToDelete) matchedBusStudentIds.add(docIdToDelete);

    if (emailToClean) {
      const qBus = query(busStudentsCol, where('studentEmail', '==', emailToClean));
      const busSnap = await getDocs(qBus);
      for (const bDoc of busSnap.docs) {
        matchedBusStudentIds.add(bDoc.id);
        await deleteDoc(bDoc.ref);
      }
    }

    if (studentName && grade) {
      const qBusName = query(busStudentsCol, where('name', '==', studentName));
      const busSnapName = await getDocs(qBusName);
      for (const bDoc of busSnapName.docs) {
        const bd = bDoc.data();
        if (String(bd.grade) === String(grade) && (!classNum || String(bd.class) === String(classNum))) {
          matchedBusStudentIds.add(bDoc.id);
          await deleteDoc(bDoc.ref);
        }
      }
    }

    // 모든 노선(routes)에서 해당 학생 좌석 배정 해제
    if (matchedBusStudentIds.size > 0 || emailToClean || studentName) {
      const routesSnap = await getDocs(collection(kisbusDb, 'routes'));
      for (const rDoc of routesSnap.docs) {
        const routeData = rDoc.data();
        const seating = routeData.seating || [];
        let routeModified = false;

        const newSeating = seating.map((seat: any) => {
          const isSeatMatched = (seat.studentId && matchedBusStudentIds.has(seat.studentId)) ||
                                (emailToClean && seat.studentEmail && seat.studentEmail.toLowerCase() === emailToClean) ||
                                (studentName && seat.studentName === studentName && (!grade || String(seat.grade) === String(grade)));
          if (isSeatMatched) {
            routeModified = true;
            busSeatsReleased++;
            return {
              seatNumber: seat.seatNumber,
              studentId: null,
              studentName: null,
              studentEmail: null,
              grade: null,
              class: null,
              stopId: null,
            };
          }
          return seat;
        });

        if (routeModified) {
          await updateDoc(rDoc.ref, { seating: newSeating });
        }
      }
    }
  } catch (busErr) {
    console.warn('스쿨버스 전학 정리 중 경고 (진행 계속):', busErr);
  }

  // 7. 방과후 DB(afterschool_enrollments) 수강 신청 전수 삭제 및 취소
  let enrollmentsRemoved = 0;
  try {
    const enrollmentsCol = collection(db, 'afterschool_enrollments');
    const matchedEnrollmentRefs: any[] = [];

    if (emailToClean) {
      const qEnroll = query(enrollmentsCol, where('studentEmail', '==', emailToClean));
      const eSnap = await getDocs(qEnroll);
      eSnap.forEach(d => matchedEnrollmentRefs.push(d.ref));
    }

    if (docIdToDelete) {
      const qEnrollId = query(enrollmentsCol, where('studentId', '==', docIdToDelete));
      const eSnapId = await getDocs(qEnrollId);
      eSnapId.forEach(d => {
        if (!matchedEnrollmentRefs.some(r => r.id === d.id)) {
          matchedEnrollmentRefs.push(d.ref);
        }
      });
    }

    if (studentName && grade) {
      const qEnrollName = query(enrollmentsCol, where('studentName', '==', studentName));
      const eSnapName = await getDocs(qEnrollName);
      eSnapName.forEach(d => {
        const ed = d.data();
        if (String(ed.grade) === String(grade) && (!classNum || String(ed.class) === String(classNum))) {
          if (!matchedEnrollmentRefs.some(r => r.id === d.id)) {
            matchedEnrollmentRefs.push(d.ref);
          }
        }
      });
    }

    for (const ref of matchedEnrollmentRefs) {
      await deleteDoc(ref);
      enrollmentsRemoved++;
    }
  } catch (asErr) {
    console.warn('방과후 수강 취소 정리 중 경고 (진행 계속):', asErr);
  }

  return { busSeatsReleased, enrollmentsRemoved };
};

// 5. 전교생 엑셀 일괄 동기화 (Batch Import)
export const batchImportMasterStudents = async (students: NewMasterStudent[]): Promise<number> => {
  const batch = writeBatch(getDb());
  const colRef = collection(getDb(), COLLECTION_NAME);
  let count = 0;
  const now = new Date().toISOString();

  students.forEach((s) => {
    if (!isStudentEmail(s.studentEmail)) return;
    const docRef = doc(colRef);
    const payload: MasterStudent = {
      ...s,
      studentId: docRef.id,
      createdAt: now,
      updatedAt: now,
    };
    batch.set(docRef, payload);
    count++;
  });

  await batch.commit();
  return count;
};

// 6. 학년/반 일괄 진급 처리 (Grade Advancement Batch Update + Automatic Academic Year Archiving)
export const batchPromoteStudents = async (advancements: { studentEmail: string; newGrade: string; newClassNum: string; newStudentNum: string }[]): Promise<number> => {
  const batch = writeBatch(getDb());
  const kisbusDb = getKisbusDb();
  const kisbusBatch = writeBatch(kisbusDb);
  let count = 0;
  const currentYear = new Date().getFullYear();
  const previousAcademicYear = currentYear - 1; // 진급 전 학학년도 (예: 2025학년도)

  // 스쿨버스 전체 학생 사전 로드
  let busStudents: { id: string; ref: any; data: any }[] = [];
  try {
    const busSnap = await getDocs(collection(kisbusDb, 'students'));
    busStudents = busSnap.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() }));
  } catch (bLoadErr) {
    console.warn('Failed to load kisbus students for promote:', bLoadErr);
  }

  for (const item of advancements) {
    if (!item.studentEmail) continue;
    const cleanEmail = item.studentEmail.trim().toLowerCase();

    const qMaster = query(collection(getDb(), COLLECTION_NAME), where("studentEmail", "==", item.studentEmail.trim()));
    const snapMaster = await getDocs(qMaster);
    snapMaster.forEach(d => {
      const data = d.data();
      const existingHistory = Array.isArray(data.academicHistory) ? data.academicHistory : [];
      
      // 진급 전 기존 학학년도의 학년/반/번호 아카이브 스냅샷 보존
      const alreadyArchived = existingHistory.some((h: any) => h.academicYear === previousAcademicYear);
      let updatedHistory = existingHistory;
      if (!alreadyArchived && data.grade) {
        updatedHistory = [
          ...existingHistory,
          {
            academicYear: previousAcademicYear,
            grade: String(data.grade),
            classNum: String(data.classNum || '1'),
            studentNum: String(data.studentNum || ''),
            archivedAt: new Date().toISOString()
          }
        ];
      }

      batch.update(doc(getDb(), COLLECTION_NAME, d.id), {
        grade: item.newGrade,
        classNum: item.newClassNum,
        studentNum: item.newStudentNum,
        academicHistory: updatedHistory,
        updatedAt: new Date().toISOString()
      });
    });

    const qUser = query(collection(getDb(), 'users'), where("email", "==", item.studentEmail.trim()));
    const snapUser = await getDocs(qUser);
    snapUser.forEach(d => {
      batch.update(doc(getDb(), 'users', d.id), {
        grade: item.newGrade,
        studentGrade: item.newGrade,
        class: item.newClassNum,
        studentClass: item.newClassNum,
        number: item.newStudentNum,
        studentNumber: item.newStudentNum
      });
    });

    // 스쿨버스 students 컬렉션 진급 일괄 업데이트
    const matchedBus = busStudents.find(bs => 
      bs.data.studentEmail && bs.data.studentEmail.trim().toLowerCase() === cleanEmail
    );
    if (matchedBus) {
      kisbusBatch.update(matchedBus.ref, {
        grade: item.newGrade,
        class: item.newClassNum,
        number: item.newStudentNum
      });
    }

    count++;
  }

  await batch.commit();
  try {
    await kisbusBatch.commit();
  } catch (bErr) {
    console.warn('kisbus batch promote error:', bErr);
  }
  return count;
};

// 7. 이메일 기반 단일 마스터 학생 조회
export const getMasterStudentByEmail = async (email: string): Promise<MasterStudent | null> => {
  if (!email) return null;
  const q = query(collection(getDb(), COLLECTION_NAME), where("studentEmail", "==", email.trim()));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const firstDoc = snapshot.docs[0];
  return { studentId: firstDoc.id, ...firstDoc.data() } as MasterStudent;
};

/**
 * 8. 통합 마스터 학생 형제·자매 연결 함수
 * 선택된 학생들을 하나의 siblingGroupId로 묶고, 스쿨버스 DB(students)에도 실시간 동기화
 */
export const linkMasterStudentSiblings = async (studentIds: string[]): Promise<string> => {
  if (studentIds.length < 2) throw new Error('최소 2명 이상의 학생을 선택해야 합니다.');
  
  let targetGroupId: string | null = null;
  const masterSnaps = await Promise.all(
    studentIds.map(id => getDoc(doc(getDb(), COLLECTION_NAME, id)))
  );

  for (const snap of masterSnaps) {
    if (snap.exists() && snap.data()?.siblingGroupId) {
      targetGroupId = snap.data().siblingGroupId;
      break;
    }
  }

  if (!targetGroupId) {
    targetGroupId = `group_${Date.now()}`;
  }

  const batch = writeBatch(getDb());
  const studentEmails: string[] = [];
  const studentNames: { name: string; grade: string; classNum: string }[] = [];

  masterSnaps.forEach((snap, idx) => {
    if (snap.exists()) {
      batch.update(doc(getDb(), COLLECTION_NAME, studentIds[idx]), {
        siblingGroupId: targetGroupId,
        updatedAt: new Date().toISOString()
      });
      const data = snap.data();
      if (data.studentEmail) studentEmails.push(data.studentEmail.trim().toLowerCase());
      studentNames.push({
        name: data.name || '',
        grade: String(data.grade || ''),
        classNum: String(data.classNum || '')
      });
    }
  });
  await batch.commit();

  try {
    const kisbusDb = getKisbusDb();
    const busSnap = await getDocs(collection(kisbusDb, 'students'));
    const kisbusBatch = writeBatch(kisbusDb);
    let kisbusUpdateCount = 0;

    busSnap.forEach(d => {
      const bData = d.data();
      const bEmail = (bData.studentEmail || '').trim().toLowerCase();
      const bName = (bData.nameKo || bData.name || '').trim();
      const bGrade = String(bData.grade || '').trim();
      const bClass = String(bData.class || '').trim();

      const matchedByEmail = bEmail && studentEmails.includes(bEmail);
      const matchedByNameGrade = studentNames.some(sn => 
        sn.name === bName && sn.grade === bGrade && sn.classNum === bClass
      );

      if (matchedByEmail || matchedByNameGrade) {
        kisbusBatch.update(d.ref, { siblingGroupId: targetGroupId });
        kisbusUpdateCount++;
      }
    });

    if (kisbusUpdateCount > 0) {
      await kisbusBatch.commit();
    }
  } catch (err) {
    console.warn('스쿨버스 DB 형제자매 동기화 오류 (진행 지속):', err);
  }

  return targetGroupId;
};

/**
 * 9. 통합 마스터 학생 형제·자매 연결 해제 함수
 */
export const unlinkMasterStudentSibling = async (targetStudentId: string): Promise<void> => {
  const targetDoc = await getDoc(doc(getDb(), COLLECTION_NAME, targetStudentId));
  if (!targetDoc.exists()) return;
  const oldGroupId = targetDoc.data()?.siblingGroupId;
  const targetEmail = (targetDoc.data()?.studentEmail || '').trim().toLowerCase();
  const targetName = (targetDoc.data()?.name || '').trim();
  const targetGrade = String(targetDoc.data()?.grade || '').trim();
  const targetClass = String(targetDoc.data()?.classNum || '').trim();

  await updateDoc(doc(getDb(), COLLECTION_NAME, targetStudentId), {
    siblingGroupId: null,
    updatedAt: new Date().toISOString()
  });

  if (oldGroupId) {
    const qRemaining = query(collection(getDb(), COLLECTION_NAME), where("siblingGroupId", "==", oldGroupId));
    const snapRemaining = await getDocs(qRemaining);
    if (snapRemaining.size === 1) {
      await updateDoc(doc(getDb(), COLLECTION_NAME, snapRemaining.docs[0].id), {
        siblingGroupId: null,
        updatedAt: new Date().toISOString()
      });
    }
  }

  try {
    const kisbusDb = getKisbusDb();
    const busSnap = await getDocs(collection(kisbusDb, 'students'));
    const kisbusBatch = writeBatch(kisbusDb);
    let kisbusUpdateCount = 0;

    busSnap.forEach(d => {
      const bData = d.data();
      const bEmail = (bData.studentEmail || '').trim().toLowerCase();
      const bName = (bData.nameKo || bData.name || '').trim();
      const bGrade = String(bData.grade || '').trim();
      const bClass = String(bData.class || '').trim();

      if ((targetEmail && bEmail === targetEmail) || (bName === targetName && bGrade === targetGrade && bClass === targetClass)) {
        kisbusBatch.update(d.ref, { siblingGroupId: null });
        kisbusUpdateCount++;
      }
    });

    if (kisbusUpdateCount > 0) {
      await kisbusBatch.commit();
    }
  } catch (err) {
    console.warn('스쿨버스 DB 형제자매 해제 동기화 오류:', err);
  }
};

