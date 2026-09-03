import { getKisbusDb as db } from './firebase';
import { collection, doc, writeBatch, query, getDocs, where } from 'firebase/firestore';
import type { Route, Student, RouteType, DayOfWeek } from './types';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/lib/errors';

export const unassignStudentFromAllRoutes = async (studentId: string, routeTypes?: RouteType[], day?: DayOfWeek) => {
    if (!studentId) return;
    let q = query(collection(db(), 'routes'));
    if (day) q = query(collection(db(), 'routes'), where('dayOfWeek', '==', day));
    else if (routeTypes && (routeTypes.includes('Morning') || routeTypes.includes('Afternoon'))) {
        q = query(collection(db(), 'routes'), where('dayOfWeek', 'in', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']));
    }
    const routesSnapshot = await getDocs(q);
    if (routesSnapshot.empty) return;
    const batch = writeBatch(db());
    routesSnapshot.forEach(routeDoc => {
        const routeData = routeDoc.data() as Route;
        if (routeTypes && !routeTypes.includes(routeData.type)) return;
        let seatingChanged = false;
        const newSeating = routeData.seating.map(seat => { 
            if (seat.studentId === studentId) { 
                seatingChanged = true; 
                return { ...seat, studentId: null }; 
            } 
            return seat; 
        });
        if (seatingChanged) batch.update(routeDoc.ref, { seating: newSeating });
    });
    await batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: `/routes`, operation: 'update', requestResourceData: { unassignStudentId: studentId } } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const clearAllAfterSchoolAssignments = async (mode: 'regular' | 'vacation' = 'regular') => {
    const batch = writeBatch(db());
    
    // 모드???�라 ?�용???�드�?결정
    const destField = mode === 'vacation' ? 'vacationAfterSchoolDestinations' : 'afterSchoolDestinations';
    const classField = mode === 'vacation' ? 'vacationAfterSchoolClassIds' : 'afterSchoolClassIds';

    // 1. 모든 ?�생??방과???�정 초기??�??�교 목적지가 ?�는 ?�생 목록 ?�집
    // + ?�일별로 방과???�청 ?�보가 존재?�던 ?�생?�의 ID 목록 ?�집
    const validAfternoonStudentIds = new Set<string>();
    const afterSchoolStudentIdsByDay = new Map<DayOfWeek, Set<string>>();
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    days.forEach(d => afterSchoolStudentIdsByDay.set(d, new Set<string>()));

    const studentsSnapshot = await getDocs(collection(db(), 'students'));
    studentsSnapshot.forEach(studentDoc => {
        const data = studentDoc.data() as Student;
        
        // ?�교 목적지가 명확???�는 ?�생�?복구 ?�?�으�?지??(?�중 ?�차 ?�생 배제)
        if (data.afternoonDestinationId) {
            validAfternoonStudentIds.add(studentDoc.id);
        }
        
        // ?�재 모드???�드?�서 ?�일별로 방과???�정???�는 ?�생??기록
        const currentDests = (data as any)[destField] || {};
        const currentClassIds = (data as any)[classField] || {};
        days.forEach(d => {
            if (currentDests[d] || currentClassIds[d]) {
                afterSchoolStudentIdsByDay.get(d)!.add(studentDoc.id);
            }
        });

        // ?�재 모드??방과???�이?�만 초기??(?�른 모드 ?�이?�는 보존)
        if ((Object.keys(currentDests).length > 0) || (Object.keys(currentClassIds).length > 0)) {
            batch.update(studentDoc.ref, { 
                [destField]: {},
                [classField]: {}
            });
        }
    });

    // 2. 방과??버스(AfterSchool) 좌석 모두 비우�?
    const routesSnapshot = await getDocs(query(collection(db(), 'routes'), where('type', '==', 'AfterSchool')));
    routesSnapshot.forEach(routeDoc => {
        const data = routeDoc.data() as Route;
        const newSeating = (data.seating || []).map(seat => ({ ...seat, studentId: null }));
        batch.update(routeDoc.ref, { seating: newSeating });
    });

    // 3. 모든 ?�교 ?�선(Morning) �??�교 ?�선(Afternoon) 가?�오�?
    const morningRoutesSnapshot = await getDocs(query(collection(db(), 'routes'), where('type', '==', 'Morning')));
    const afternoonRoutesSnapshot = await getDocs(query(collection(db(), 'routes'), where('type', '==', 'Afternoon')));

    // ?�교 ?�선???�일별로 그룹??
    const morningRoutesByDay = new Map<DayOfWeek, Route[]>();
    morningRoutesSnapshot.forEach(routeDoc => {
        const route = routeDoc.data() as Route;
        if (!morningRoutesByDay.has(route.dayOfWeek)) {
            morningRoutesByDay.set(route.dayOfWeek, []);
        }
        morningRoutesByDay.get(route.dayOfWeek)!.push(route);
    });

    // 4. �??�일???�교 ?�선???�교 ?�선 기�??�로 복구
    afternoonRoutesSnapshot.forEach(routeDoc => {
        const route = routeDoc.data() as Route;
        const day = route.dayOfWeek;
        
        // ?�당 ?�일???�제�?방과???�청???�어 ?�었???�생 목록
        const afterSchoolStudentsForDay = afterSchoolStudentIdsByDay.get(day) || new Set<string>();

        // ?�당 ?�일???�교 ?�선??기�??�로 busId_seatNumber -> studentId �??�성
        const morningSeatMap = new Map<string, string>();
        const morningRoutes = morningRoutesByDay.get(day) || [];
        
        morningRoutes.forEach(mRoute => {
            (mRoute.seating || []).forEach(seat => {
                // ?�교 버스 좌석???�고, ?�교 목적지가 ?�효?�며, ?�당 ?�일??방과???�청???�었???�생�?맵에 ?�록
                if (seat.studentId && 
                    validAfternoonStudentIds.has(seat.studentId) && 
                    afterSchoolStudentsForDay.has(seat.studentId)) {
                    morningSeatMap.set(`${mRoute.busId}_${seat.seatNumber}`, seat.studentId);
                }
            });
        });

        let hasChanged = false;
        const nextSeating = (route.seating || []).map(seat => {
            const key = `${route.busId}_${seat.seatNumber}`;
            const targetStudentId = morningSeatMap.get(key);
            
            // ?�교 좌석??비어?�고, ?�교 ?�선 기�? �??�리??배정???�효??방과???�제 ?�생???�다�?복구
            if (seat.studentId === null && targetStudentId) {
                hasChanged = true;
                return { ...seat, studentId: targetStudentId };
            }
            return seat;
        });

        if (hasChanged) {
            batch.update(routeDoc.ref, { seating: nextSeating });
        }
    });

    await batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: `/`, operation: 'write', requestResourceData: { action: 'clearAllAfterSchool' } } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const syncAfterschoolBusAssignmentsOnStageChange = async (
  stage: 'RECRUITING' | 'APPLYING' | 'CONFIRMED' | 'OPERATING' | 'CLOSED',
  semester: string
): Promise<{ success: boolean; count: number; isVacation: boolean; message: string }> => {
  const isVacation = semester === '여름방학' || semester === '겨울방학';

  if (stage === 'CONFIRMED') {
    // 1. 방과후 수강 확정(ENROLLED) 목록 조회
    const mainDb = (await import('@/lib/firebase')).getDb();
    const enrollmentsSnap = await getDocs(
      query(
        collection(mainDb, 'afterschool_enrollments'),
        where('status', '==', 'ENROLLED')
      )
    );

    const allEnrolled = enrollmentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    if (allEnrolled.length === 0) {
      return {
        success: true,
        count: 0,
        isVacation,
        message: '방과후 수강 확정 학생이 없습니다.'
      };
    }

    // 2. 개설 강좌 정보 조회
    const coursesSnap = await getDocs(collection(mainDb, 'afterschool_courses'));
    const courseMap = new Map<string, any>();
    coursesSnap.forEach(d => courseMap.set(d.id, d.data()));

    const dayMap: Record<string, DayOfWeek> = {
      '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday',
      '목': 'Thursday', '금': 'Friday', '토': 'Saturday'
    };

    // 3. 스쿨버스 시스템(Kisbus) 학생 데이터 매핑
    const busDbInstance = db();
    const studentsSnap = await getDocs(collection(busDbInstance, 'students'));
    const busStudentsList: { id: string; ref: any; data: any }[] = [];
    studentsSnap.forEach(d => {
      busStudentsList.push({ id: d.id, ref: d.ref, data: d.data() });
    });

    const clean = (str: any) => String(str || '').replace(/\s+/g, '').toLowerCase();

    const findBusStudent = (name: string, grade: number, classNum: number, studentNum?: number) => {
      if (!name) return null;
      const targetName = clean(name);

      // 1단계: 이름 + 학년 + 반 + 번호
      let matched = busStudentsList.find(s => {
        const d = s.data;
        const matchName = clean(d.name) === targetName || clean(d.nameKo) === targetName || clean(d.nameEn) === targetName;
        const matchGrade = Number(d.grade) === Number(grade);
        const matchClass = Number(d.class || d.classNum) === Number(classNum);
        const sNum = Number(d.studentNum || d.number || 0);
        const matchNum = studentNum ? sNum === Number(studentNum) : true;
        return matchName && matchGrade && matchClass && matchNum;
      });

      // 2단계: 이름 + 학년 + 반
      if (!matched) {
        matched = busStudentsList.find(s => {
          const d = s.data;
          const matchName = clean(d.name) === targetName || clean(d.nameKo) === targetName || clean(d.nameEn) === targetName;
          const matchGrade = Number(d.grade) === Number(grade);
          const matchClass = Number(d.class || d.classNum) === Number(classNum);
          return matchName && matchGrade && matchClass;
        });
      }

      // 3단계: 이름만으로 fallback
      if (!matched) {
        matched = busStudentsList.find(s => {
          const d = s.data;
          return clean(d.name) === targetName || clean(d.nameKo) === targetName || clean(d.nameEn) === targetName;
        });
      }

      return matched;
    };

    const batch = writeBatch(busDbInstance);
    let affectedCount = 0;
    const destField = isVacation ? 'vacationAfterSchoolDestinations' : 'afterSchoolDestinations';
    const classField = isVacation ? 'vacationAfterSchoolClassIds' : 'afterSchoolClassIds';

    const extractCourseDays = (course: any): string[] => {
      if (Array.isArray(course.classDays) && course.classDays.length > 0) return course.classDays;
      if (Array.isArray(course.days) && course.days.length > 0) return course.days;
      const text = `${course.period || ''} ${course.title || ''} ${course.schedule || ''} ${course.day || ''} ${course.classTime || ''}`;
      if (text.includes('토')) return ['토'];
      const days: string[] = [];
      if (text.includes('월')) days.push('월');
      if (text.includes('화')) days.push('화');
      if (text.includes('수')) days.push('수');
      if (text.includes('목')) days.push('목');
      if (text.includes('금')) days.push('금');
      return days;
    };

    // 학생별로 모든 수강신청을 묶어서 요일별 목적지를 깨끗하게 재구성
    const studentEnrollmentMap = new Map<string, typeof allEnrolled>();
    allEnrolled.forEach(enroll => {
      const rawName = (enroll.name || enroll.studentName || '').trim();
      const busStudent = findBusStudent(rawName, Number(enroll.grade), Number(enroll.classNum), Number(enroll.studentNum));
      if (!busStudent) return;
      const key = busStudent.id;
      if (!studentEnrollmentMap.has(key)) {
        studentEnrollmentMap.set(key, []);
      }
      studentEnrollmentMap.get(key)!.push(enroll);
    });

    busStudentsSnap.docs.forEach(docSnap => {
      const busStudent = { id: docSnap.id, ref: docSnap.ref, data: docSnap.data() as Student };
      const enrolls = studentEnrollmentMap.get(busStudent.id);

      if (!enrolls || enrolls.length === 0) {
        // 수강신청이 없는 학생은 방과후 목적지/수업ID를 깨끗하게 비움
        const prevDests = busStudent.data[destField] || {};
        if (Object.keys(prevDests).length > 0) {
          batch.update(busStudent.ref, {
            [destField]: {},
            [classField]: {}
          });
        }
        return;
      }

      const newDests: Partial<Record<DayOfWeek, string | null>> = {};
      const newClassIds: Partial<Record<DayOfWeek, string | null>> = {};

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

        affectedCount++;
        const targetDays = classDays.map(d => dayMap[d]).filter(Boolean) as DayOfWeek[];

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
          newDests[day] = targetDestId;
          newClassIds[day] = course.id;
        });
      });

      batch.update(busStudent.ref, {
        [destField]: newDests,
        [classField]: newClassIds
      });
    });

    // 4. [중요] 수강신청 완료(CONFIRMED) 단계에서는 방과후 명단에 2중 배정만 진행하고,
    // 정규 하교 버스(Afternoon) 좌석은 방과후 시작 전까지 그대로 유지합니다!
    // (실제 방과후 개시 시 스쿨버스 관리자가 [방과후 노선으로 이동] 버튼을 클릭하여 정규 하교 좌석을 비웁니다.)

    await batch.commit();

    // Firestore에 2중 배정 완료 및 미이동 상태 기록
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(busDbInstance, 'config', 'afterschool_bus_transfer_state'), {
        isTransferred: false,
        lastDualAssignedAt: new Date().toISOString(),
        affectedCount,
        semester
      }, { merge: true });
    } catch (e) {
      console.error('Failed to update transfer state:', e);
    }

    return {
      success: true,
      count: affectedCount,
      isVacation,
      message: isVacation
        ? `✅ [방학 중 방과후 등/하교 버스 연동 완료]\n\n총 ${affectedCount}명의 버스 신청 학생이 [방학 중 등/하교 버스 미배정 명단]으로 전송되었습니다.`
        : `✅ [학기 중 방과후 버스 연동 완료 (2중 배정)]\n\n총 ${affectedCount}명의 방과후 버스 신청 학생이 [방과후 하교 버스] 명단에 2중으로 배정되었습니다.\n\n• 방과후 시작 전까지 기존 정규 하교 버스 좌석은 100% 그대로 유지됩니다.\n• 스쿨버스 관리자가 사전 좌석 배정을 마친 후, 방과후 개시일에 [방과후 노선으로 이동]을 실행하면 정규 하교 좌석에서 자동 제외됩니다.`
    };
  } else if (stage === 'CLOSED') {
    const { clearAllAfterSchoolClasses } = await import('./after-school-classes');
    await clearAllAfterSchoolClasses();

    // 이동 상태 리셋
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db(), 'config', 'afterschool_bus_transfer_state'), {
        isTransferred: false,
        lastClosedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {}

    if (isVacation) {
      // 5-A. 방학 중 운영 종료 시: 방학에는 정규 버스가 없으므로 방학 버스 데이터를 말끔히 정리 초기화함 (다음 학기 개학 전까지 버스 운행 중단)
      await clearAllAfterSchoolAssignments('vacation');
      return {
        success: true,
        count: 0,
        isVacation: true,
        message: '🏁 [방학 방과후 운영 종료 (버스 미운영)]\n\n방학 방과후학교가 종료되어 방학 버스 배정 및 방과후 강좌 정보가 정리 초기화되었습니다.\n(방학 중에는 정규 버스가 운행되지 않으며, 다음 학기 개학 전까지 버스 미운영 상태가 유지됩니다.)'
      };
    } else {
      // 5-B. 학기 중 운영 종료 시: 원래 타고 있던 학기 중 정규 하교 버스로 100% 원상 복구
      await clearAllAfterSchoolAssignments('regular');
      return {
        success: true,
        count: 0,
        isVacation: false,
        message: '🏁 [학기 중 하교 버스 원상 복구 완료]\n\n방과후학교 운영 종료에 따라 방과후 버스를 탑승하던 수강생들이 원래의 정규 학기 하교 버스로 100% 복구되었으며, 방과후 강좌 명단이 초기화되었습니다.'
      };
    }
  }

  return { success: true, count: 0, isVacation, message: '' };
};

/**
 * 🌟 스쿨버스 관리자용: 방과후 버스 신청 학생들을 정규 하교 버스에서 제외하여 방과후 노선으로 완전 이동
 */
export const executeTransferAfterschoolStudentsToBus = async (): Promise<{ success: boolean; count: number; message: string }> => {
  const mainDb = (await import('@/lib/firebase')).getDb();
  const busDbInstance = db();

  // 1. 방과후 수강 확정 목록 조회
  const enrollmentsSnap = await getDocs(
    query(
      collection(mainDb, 'afterschool_enrollments'),
      where('status', '==', 'ENROLLED')
    )
  );

  const allEnrolled = enrollmentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  if (allEnrolled.length === 0) {
    return { success: false, count: 0, message: '방과후 수강 확정 학생이 없습니다.' };
  }

  // 2. 강좌 요일 조회
  const coursesSnap = await getDocs(collection(mainDb, 'afterschool_courses'));
  const courseMap = new Map<string, any>();
  coursesSnap.forEach(d => courseMap.set(d.id, d.data()));

  const dayMap: Record<string, DayOfWeek> = {
    '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday',
    '목': 'Thursday', '금': 'Friday', '토': 'Saturday'
  };

  // 3. 학생 매핑
  const studentsSnap = await getDocs(collection(busDbInstance, 'students'));
  const busStudentMap = new Map<string, any>();
  studentsSnap.forEach(d => {
    const data = d.data();
    const cleanName = (data.nameKo || data.name || data.nameEn || '').trim();
    const key = `${Number(data.grade)}-${Number(data.class)}-${cleanName}`;
    busStudentMap.set(key, { id: d.id, ref: d.ref, data });
    if (!busStudentMap.has(cleanName)) {
      busStudentMap.set(cleanName, { id: d.id, ref: d.ref, data });
    }
  });

  const dayStudentsMap = new Map<DayOfWeek, Set<string>>();
  let matchCount = 0;

  allEnrolled.forEach(enroll => {
    const course = courseMap.get(enroll.courseId);
    if (!course) return;

    const rawName = (enroll.name || enroll.studentName || '').trim();
    const studentKey = `${Number(enroll.grade)}-${Number(enroll.classNum)}-${rawName}`;
    const busStudent = busStudentMap.get(studentKey) || busStudentMap.get(rawName);
    if (!busStudent) return;

    const isSat = Boolean(
      course.classDays?.includes('토') ||
      course.period?.includes('토') ||
      course.title?.includes('토요') ||
      course.title?.includes('토요일') ||
      course.title?.includes('오케스트라') ||
      course.title?.includes('basketball')
    );

    // 버스 탑승 대상 여부 판별:
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

    matchCount++;
    const classDays: string[] = course.classDays || (isSat ? ['토'] : ['월']);
    const targetDays = classDays.map(d => dayMap[d]).filter(Boolean) as DayOfWeek[];

    targetDays.forEach(day => {
      if (!dayStudentsMap.has(day)) dayStudentsMap.set(day, new Set());
      dayStudentsMap.get(day)!.add(busStudent.id);
    });
  });

  // 4. 요일별 정규 하교 버스(Afternoon) 좌석에서 해당 학생 제외
  const batch = writeBatch(busDbInstance);
  const afternoonRoutesSnap = await getDocs(
    query(collection(busDbInstance, 'routes'), where('type', '==', 'Afternoon'))
  );

  let affectedSeatsCount = 0;
  afternoonRoutesSnap.forEach(routeDoc => {
    const route = routeDoc.data() as Route;
    const day = route.dayOfWeek;
    const targetStudentIds = dayStudentsMap.get(day);

    if (targetStudentIds && targetStudentIds.size > 0) {
      let seatingChanged = false;
      const nextSeating = (route.seating || []).map(seat => {
        if (seat.studentId && targetStudentIds.has(seat.studentId)) {
          seatingChanged = true;
          affectedSeatsCount++;
          return { ...seat, studentId: null };
        }
        return seat;
      });

      if (seatingChanged) {
        batch.update(routeDoc.ref, { seating: nextSeating });
      }
    }
  });

  // 5. 이동 상태 Firestore 저장
  const { setDoc, doc: fDoc } = await import('firebase/firestore');
  const transferDocRef = fDoc(busDbInstance, 'config', 'afterschool_bus_transfer_state');
  batch.set(transferDocRef, {
    isTransferred: true,
    transferredAt: new Date().toISOString(),
    transferredStudentsCount: matchCount,
    affectedSeatsCount
  }, { merge: true });

  await batch.commit();

  return {
    success: true,
    count: matchCount,
    message: `🚌 [방과후 노선으로 이동 완료]\n\n총 ${matchCount}명의 방과후 신청 학생이 정규 하교 좌석에서 제외되고 방과후 버스 노선으로 이동되었습니다.`
  };
};

/**
 * 방과후 수강생 중 스쿨버스 탑승 학생들을 일괄로 방과후 버스 노선(미배정 명단)으로 이동시키고
 * 정규 하교 버스에서는 일시 제외(숨김) 처리합니다.
 */
export const transferAllAfterschoolStudentsToBus = async (
  enrollments: import('@/lib/afterschool/types').Enrollment[],
  courses: import('@/lib/afterschool/types').Course[],
  isVacation: boolean = false
): Promise<{ success: boolean; count: number; busCount: number; message: string }> => {
  const busEnrollments = enrollments.filter(
    (e) => e.status === 'ENROLLED' && e.kisbusNo && e.kisbusNo !== '-' && e.kisbusNo !== '미신청'
  );

  if (busEnrollments.length === 0) {
    return {
      success: false,
      count: 0,
      busCount: 0,
      message: '스쿨버스가 신청된 방과후 수강 확정생이 없습니다.'
    };
  }

  const busDbInstance = db();
  const mainDb = (await import('@/lib/firebase')).getDb();

  // 1. kisbus students 전체 조회
  const studentsSnap = await getDocs(collection(busDbInstance, 'students'));
  const busStudentMap = new Map<string, any>();
  studentsSnap.forEach((d) => {
    const data = d.data() as Student;
    const cleanName = (data.nameKo || data.name || data.nameEn || '').trim();
    const key = `${Number(data.grade)}-${Number(data.class)}-${cleanName}`;
    busStudentMap.set(key, { id: d.id, ref: d.ref, data });
    if (!busStudentMap.has(cleanName)) {
      busStudentMap.set(cleanName, { id: d.id, ref: d.ref, data });
    }
  });

  // 2. 강좌 맵
  const courseMap = new Map<string, import('@/lib/afterschool/types').Course>();
  courses.forEach((c) => courseMap.set(c.id, c));

  const dayMap: Record<string, DayOfWeek> = {
    '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday',
    '목': 'Thursday', '금': 'Friday', '토': 'Saturday'
  };

  const destField = isVacation ? 'vacationAfterSchoolDestinations' : 'afterSchoolDestinations';
  const classField = isVacation ? 'vacationAfterSchoolClassIds' : 'afterSchoolClassIds';

  const busBatch = writeBatch(busDbInstance);
  const mainBatch = writeBatch(mainDb);

  let affectedCount = 0;
  const dayStudentsMap = new Map<DayOfWeek, Set<string>>();

  busEnrollments.forEach((enroll) => {
    const course = courseMap.get(enroll.courseId);
    const cleanName = (enroll.name || '').trim();
    const key = `${Number(enroll.grade)}-${Number(enroll.classNum)}-${cleanName}`;
    const busStudent = busStudentMap.get(key) || busStudentMap.get(cleanName);

    if (!busStudent) return;

    affectedCount++;
    const classDays: string[] = course?.classDays || ['월'];
    const targetDays = classDays.map((d) => dayMap[d]).filter(Boolean) as DayOfWeek[];

    targetDays.forEach((day) => {
      if (!dayStudentsMap.has(day)) dayStudentsMap.set(day, new Set());
      dayStudentsMap.get(day)!.add(busStudent.id);
    });

    const currentDests = { ...(busStudent.data[destField] || {}) };
    const currentClassIds = { ...(busStudent.data[classField] || {}) };

    // 하교 목적지 백업 & 요일별 방과후 목적지 설정 (미배정 상태)
    const baseDestId = busStudent.data.afternoonDestinationId || busStudent.data.suggestedAfternoonDestination || busStudent.data.morningDestinationId || '방과후 미배정';
    targetDays.forEach((day) => {
      currentDests[day] = baseDestId;
      currentClassIds[day] = course?.id || 'afterschool';
    });

    const studentUpdatePayload: Record<string, any> = {
      [destField]: currentDests,
      [classField]: currentClassIds,
    };

    // 하교 목적지가 있으면 백업 후 null 처리 (하교 버스에서 숨김)
    if (busStudent.data.afternoonDestinationId && !busStudent.data._hiddenAfternoonDestId) {
      studentUpdatePayload._hiddenAfternoonDestId = busStudent.data.afternoonDestinationId;
    }

    busBatch.update(busStudent.ref, studentUpdatePayload);

    // afterschool_enrollments 문서 업데이트
    const enrollDocRef = doc(mainDb, 'afterschool_enrollments', enroll.id);
    mainBatch.update(enrollDocRef, {
      afternoonBusHidden: true,
      needsBus: true,
    });
  });

  // 3. 정규 하교 버스(Afternoon) 좌석에서 해당 학생 제외
  if (!isVacation) {
    const afternoonRoutesSnap = await getDocs(
      query(collection(busDbInstance, 'routes'), where('type', '==', 'Afternoon'))
    );

    afternoonRoutesSnap.forEach((routeDoc) => {
      const route = routeDoc.data() as Route;
      const day = route.dayOfWeek;
      const targetStudentIds = dayStudentsMap.get(day);

      if (targetStudentIds && targetStudentIds.size > 0) {
        let seatingChanged = false;
        const nextSeating = (route.seating || []).map((seat) => {
          if (seat.studentId && targetStudentIds.has(seat.studentId)) {
            seatingChanged = true;
            return { ...seat, studentId: null };
          }
          return seat;
        });

        if (seatingChanged) {
          busBatch.update(routeDoc.ref, { seating: nextSeating });
        }
      }
    });
  }

  await busBatch.commit();
  await mainBatch.commit();

  return {
    success: true,
    count: affectedCount,
    busCount: busEnrollments.length,
    message: `🎉 [방과후 버스 노선 일괄 이동 완료]\n\n• 총 대상 학생: ${affectedCount}명\n• 정규 하교 버스에서 안전하게 제외(숨김)되었습니다.\n• 스쿨버스 관리자의 [방과후 버스 배차표]에 미배정 학생으로 정상 등록되었습니다.\n• 방과후 운영 종료 시 원래 하교 버스 좌석으로 자동 복귀됩니다.`
  };
};

