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
    // 1. 방과후 수강 확정(ENROLLED)이며 스쿨버스 신청(needsBus == true 또는 kisbusNo 보유)한 목록 조회
    const mainDb = (await import('@/lib/firebase')).getDb();
    const enrollmentsSnap = await getDocs(
      query(
        collection(mainDb, 'afterschool_enrollments'),
        where('status', '==', 'ENROLLED')
      )
    );

    const busEnrollments = enrollmentsSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(e => e.needsBus === true || (e.kisbusNo && e.kisbusNo !== '-' && e.kisbusNo !== '미신청'));

    if (busEnrollments.length === 0) {
      return {
        success: true,
        count: 0,
        isVacation,
        message: '스쿨버스 탑승을 신청한 학생이 없습니다.'
      };
    }

    // 2. 개설 강좌 요일 정보 조회
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

    const batch = writeBatch(busDbInstance);
    let affectedCount = 0;
    const dayStudentsMap = new Map<DayOfWeek, Set<string>>();

    busEnrollments.forEach(enroll => {
      const course = courseMap.get(enroll.courseId);
      if (!course) return;

      const rawName = (enroll.name || enroll.studentName || '').trim();
      const studentKey = `${Number(enroll.grade)}-${Number(enroll.classNum)}-${rawName}`;
      const busStudent = busStudentMap.get(studentKey) || busStudentMap.get(rawName);
      if (!busStudent) return;

      affectedCount++;
      const classDays: string[] = course.classDays || ['월'];
      const targetDays = classDays.map(d => dayMap[d]).filter(Boolean) as DayOfWeek[];

      targetDays.forEach(day => {
        if (!dayStudentsMap.has(day)) dayStudentsMap.set(day, new Set());
        dayStudentsMap.get(day)!.add(busStudent.id);
      });

      const destField = isVacation ? 'vacationAfterSchoolDestinations' : 'afterSchoolDestinations';
      const classField = isVacation ? 'vacationAfterSchoolClassIds' : 'afterSchoolClassIds';

      const currentDests = busStudent.data[destField] || {};
      const currentClassIds = busStudent.data[classField] || {};

      targetDays.forEach(day => {
        currentDests[day] = enroll.kisbusNo || '방과후 미배정';
        currentClassIds[day] = course.id;
      });

      batch.update(busStudent.ref, {
        [destField]: currentDests,
        [classField]: currentClassIds
      });
    });

    // 4. 학기 중(Semester): 요일별 정규 하교 버스(Afternoon) 좌석에서 해당 학생만 일시 제외 (등교 버스 유지)
    if (!isVacation) {
      const afternoonRoutesSnap = await getDocs(
        query(collection(busDbInstance, 'routes'), where('type', '==', 'Afternoon'))
      );

      afternoonRoutesSnap.forEach(routeDoc => {
        const route = routeDoc.data() as Route;
        const day = route.dayOfWeek;
        const targetStudentIds = dayStudentsMap.get(day);

        if (targetStudentIds && targetStudentIds.size > 0) {
          let seatingChanged = false;
          const nextSeating = (route.seating || []).map(seat => {
            if (seat.studentId && targetStudentIds.has(seat.studentId)) {
              seatingChanged = true;
              return { ...seat, studentId: null };
            }
            return seat;
          });

          if (seatingChanged) {
            batch.update(routeDoc.ref, { seating: nextSeating });
          }
        }
      });
    }

    await batch.commit();

    return {
      success: true,
      count: affectedCount,
      isVacation,
      message: isVacation
        ? `✅ [방학 중 방과후 등/하교 버스 연동 완료]\n\n총 ${affectedCount}명의 버스 신청 학생이 [방학 중 등/하교 버스 미배정 명단]으로 전송되었습니다.`
        : `✅ [학기 중 방과후 하교 버스 연동 완료]\n\n총 ${affectedCount}명의 버스 신청 학생이 요일별 정규 하교 버스에서 일시 제외되어 [방과후 하교 버스 미배정 명단]으로 전송되었습니다.\n(등교 버스에는 절대 영향을 주지 않습니다.)`
    };
  } else if (stage === 'CLOSED') {
    const { clearAllAfterSchoolClasses } = await import('./after-school-classes');
    await clearAllAfterSchoolClasses();

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

