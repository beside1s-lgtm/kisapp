import { getDb } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from 'firebase/firestore';
import { getKisbusDb } from '@/lib/kisbus/firebase';

export type HomeroomAttendanceStatus = 'ATTEND' | 'ABSENT' | 'EARLY_LEAVE' | 'INDIVIDUAL_DISMISSAL';

export interface HomeroomAttendanceRecord {
  id: string; // `${date}_${studentId}`
  date: string; // YYYY-MM-DD
  studentId: string;
  studentName: string;
  gradeClass: string;
  status: HomeroomAttendanceStatus;
  source: 'manual' | 'auto_field_trip' | 'auto_absence';
  reason?: string;
  updatedAt: string;
  updatedBy: string;
}

// ─── 1. 담임 일일 출석 실시간 구독 ──────────────────────────────────────────
// 복합 인덱스 없이 동작하도록 date 단일 쿼리 후 클라이언트에서 gradeClass 필터링

export function onHomeroomAttendanceUpdate(
  date: string,
  gradeClass: string,
  callback: (records: HomeroomAttendanceRecord[]) => void
): () => void {
  if (!date || !gradeClass) {
    callback([]);
    return () => {};
  }

  const db = getDb();
  const colRef = collection(db, 'homeroom_daily_attendance');
  // date 단일 필드 쿼리 → 복합 인덱스 불필요
  const q = query(colRef, where('date', '==', date));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as HomeroomAttendanceRecord))
        // 클라이언트에서 gradeClass 필터링
        .filter((r) => r.gradeClass === gradeClass);
      callback(list);
    },
    (err) => {
      console.warn('[HomeroomAttendance] onHomeroomAttendanceUpdate error:', err);
      callback([]);
    }
  );
}

// 특정 날짜의 전교 담임 출결 구독 (스쿨버스 실시간 연동용)
export function onAllHomeroomAttendanceByDateUpdate(
  date: string,
  callback: (records: HomeroomAttendanceRecord[]) => void
): () => void {
  const db = getDb();
  const colRef = collection(db, 'homeroom_daily_attendance');
  const q = query(colRef, where('date', '==', date));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as HomeroomAttendanceRecord));
      callback(list);
    },
    (err) => {
      console.warn('[HomeroomAttendance] onAllHomeroomAttendanceByDateUpdate error:', err);
      callback([]);
    }
  );
}

// ─── 2. 결석/체험학습 승인 문서 기반 자동 결석 대상 조회 ───────────────────

export async function getApprovedAbsenceStudentsForDate(
  date: string,
  gradeClass: string
): Promise<Map<string, { status: 'ABSENT'; reason: string; source: 'auto_field_trip' | 'auto_absence' }>> {
  const resultMap = new Map<string, { status: 'ABSENT'; reason: string; source: 'auto_field_trip' | 'auto_absence' }>();

  try {
    const db = getDb();
    const approvalsCol = collection(db, 'approvals');
    const q = query(
      approvalsCol,
      where('status', '==', 'approved'),
      where('docType', '==', 'parent')
    );

    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const data = d.data();
      const pData = data.parentFormData;
      if (!pData) return;

      const pGradeClass = pData.gradeClassNumber || data.gradeClass || '';
      // 학급 매칭 ("4-4" 또는 "4-4-15"의 앞부분 비교)
      if (!pGradeClass.startsWith(gradeClass)) return;

      const sName = (pData.studentName || data.studentName || '').trim();
      const docType = pData.type; // 'field-trip' | 'absence'

      // 날짜 포함 여부 체크
      let isDateInRange = false;
      let reason = '';

      if (docType === 'field-trip') {
        const period = pData.tripPeriod;
        if (period && period.startDate && period.endDate) {
          if (date >= period.startDate && date <= period.endDate) {
            isDateInRange = true;
            reason = pData.purpose || pData.destination || '체험학습';
          }
        }
      } else if (docType === 'absence') {
        const period = pData.absencePeriod;
        if (period && period.startDate && period.endDate) {
          if (date >= period.startDate && date <= period.endDate) {
            isDateInRange = true;
            reason = pData.absenceReason || pData.absenceType || '결석';
          }
        }
      }

      if (isDateInRange && sName) {
        resultMap.set(sName, {
          status: 'ABSENT',
          reason,
          source: docType === 'field-trip' ? 'auto_field_trip' : 'auto_absence',
        });
      }
    });
  } catch (err) {
    console.warn('[HomeroomAttendance] getApprovedAbsenceStudentsForDate error:', err);
  }

  return resultMap;
}

// ─── 3. 스쿨버스 & 방과후 출석부 자동 연동 저장 ──────────────────────────────

export async function saveHomeroomAttendanceAndSync(
  record: Omit<HomeroomAttendanceRecord, 'id' | 'updatedAt'>
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const docId = `${record.date}_${record.studentId}`;
    const docRef = doc(db, 'homeroom_daily_attendance', docId);

    const fullRecord: HomeroomAttendanceRecord = {
      ...record,
      id: docId,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, fullRecord, { merge: true });

    // 스쿨버스 및 방과후 출석부 연동 비동기 실행 (결과는 기다리되 UI 차단 최소화)
    await syncToBusAndAfterschool(fullRecord);

    return { success: true };
  } catch (err: any) {
    console.error('[HomeroomAttendance] save error:', err);
    return { success: false, error: err.message };
  }
}

// ─── 4. 스쿨버스 및 방과후 연동 세부 로직 ──────────────────────────────────

async function syncToBusAndAfterschool(record: HomeroomAttendanceRecord) {
  const { date, studentId, studentName, gradeClass, status } = record;
  const db = getDb();

  const [grade, classNum] = (gradeClass || '').split('-');

  // 마스터 학생 정보 조회 (이메일 및 정확한 프로필 확보)
  let studentEmail = '';
  try {
    const masterDoc = await getDoc(doc(db, 'master_students', studentId));
    if (masterDoc.exists()) {
      studentEmail = (masterDoc.data()?.studentEmail || masterDoc.data()?.email || '').trim().toLowerCase();
    }
  } catch (err) {
    console.warn('[HomeroomSync] Master student lookup failed:', err);
  }

  const dayOfWeekMap: Record<number, string> = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  };
  const targetDayOfWeek = dayOfWeekMap[new Date(date + 'T12:00:00').getDay()];

  // 1) 스쿨버스 (kisbusDb) 연동: 스쿨버스 학생 고유 ID 역추적
  try {
    const kisbusDb = getKisbusDb();
    const clean = (str: any) => String(str || '').replace(/\s+/g, '').toLowerCase();
    const targetCleanName = clean(studentName);

    // 스쿨버스 students 컬렉션에서 해당 학생 역추적
    const busStudentsSnap = await getDocs(collection(kisbusDb, 'students'));
    const matchedBusStudent = busStudentsSnap.docs.find(d => {
      const s = d.data();
      if (d.id === studentId) return true;
      if (studentEmail && s.studentEmail && s.studentEmail.toLowerCase() === studentEmail) return true;
      const nameMatch = clean(s.name) === targetCleanName || clean(s.nameKo) === targetCleanName || clean(s.nameEn) === targetCleanName;
      const gradeMatch = !grade || String(s.grade) === String(grade);
      const classMatch = !classNum || String(s.class || s.classNum) === String(classNum);
      return nameMatch && gradeMatch && classMatch;
    });

    const targetBusStudentIds = Array.from(new Set([
      studentId, 
      matchedBusStudent ? matchedBusStudent.id : null
    ].filter(Boolean) as string[]));

    // 해당 요일(targetDayOfWeek) 노선만 단독 타겟팅 조회
    const routesQuery = query(
      collection(kisbusDb, 'routes'),
      where('dayOfWeek', '==', targetDayOfWeek)
    );
    const routesSnap = await getDocs(routesQuery);

    for (const rDoc of routesSnap.docs) {
      const rData = rDoc.data();
      const seating: any[] = rData.seating || [];
      const isStudentInRoute = seating.some((s: any) => targetBusStudentIds.includes(s.studentId));
      if (!isStudentInRoute) continue;

      const routeType = rData.type; // 'Morning' | 'Afternoon' | 'AfterSchool'
      const attendanceRef = doc(kisbusDb, 'routes', rDoc.id, 'attendance', date);

      if (status === 'ABSENT') {
        // 결석: 등교, 하교, 방과후 모든 버스 notBoarding 추가
        await setDoc(
          attendanceRef,
          {
            notBoarding: arrayUnion(...targetBusStudentIds),
            boarded: arrayRemove(...targetBusStudentIds),
            disembarked: arrayRemove(...targetBusStudentIds),
          },
          { merge: true }
        );
      } else if (status === 'EARLY_LEAVE' || status === 'INDIVIDUAL_DISMISSAL') {
        // 조퇴 or 개별하교: 하교 및 방과후 버스 notBoarding 추가
        if (routeType === 'Afternoon' || routeType === 'AfterSchool') {
          await setDoc(
            attendanceRef,
            {
              notBoarding: arrayUnion(...targetBusStudentIds),
              boarded: arrayRemove(...targetBusStudentIds),
              disembarked: arrayRemove(...targetBusStudentIds),
            },
            { merge: true }
          );
        }
      } else if (status === 'ATTEND') {
        // 출석: 이전에 등록된 notBoarding 해제 (탑승 복구)
        await setDoc(
          attendanceRef,
          {
            notBoarding: arrayRemove(...targetBusStudentIds),
          },
          { merge: true }
        );
      }
    }
  } catch (busErr) {
    console.warn('[HomeroomSync] Kisbus sync failed:', busErr);
  }

  // 2) 방과후 출석부 (getDb()) 연동: 학생 ID 및 복합 조건 검색
  try {
    const koreanDays = ['일', '월', '화', '수', '목', '금', '토'];
    const korDay = koreanDays[new Date(date + 'T12:00:00').getDay()];

    // 1차: studentId 직접 조회
    const enrollmentsRef = collection(db, 'afterschool_enrollments');
    let targetEnrollments: any[] = [];
    const directSnap = await getDocs(query(enrollmentsRef, where('studentId', '==', studentId), where('status', '==', 'ENROLLED')));
    targetEnrollments = directSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 2차: 직접 조회 결과가 없을 시 학생 이름/학년/반 및 이메일로 검색
    if (targetEnrollments.length === 0 && studentName) {
      const clean = (str: any) => String(str || '').replace(/\s+/g, '').toLowerCase();
      const targetCleanName = clean(studentName);
      const allEnrolledSnap = await getDocs(query(enrollmentsRef, where('status', '==', 'ENROLLED')));
      targetEnrollments = allEnrolledSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((e: any) => {
          const nameMatch = clean(e.name || e.studentName) === targetCleanName;
          const gradeMatch = !grade || String(e.grade) === String(grade);
          const classMatch = !classNum || String(e.classNum || e.class) === String(classNum);
          const emailMatch = studentEmail && e.studentEmail && e.studentEmail.toLowerCase() === studentEmail;
          return emailMatch || (nameMatch && gradeMatch && classMatch);
        });
    }

    if (targetEnrollments.length > 0) {
      for (const enroll of targetEnrollments) {
        const courseId = enroll.courseId;
        const enrollStudentId = enroll.studentId || studentId;

        // 해당 강좌가 오늘(korDay) 수업하는지 확인
        const courseDoc = await getDoc(doc(db, 'afterschool_courses', courseId));
        if (!courseDoc.exists()) continue;
        const cData = courseDoc.data();
        const classDays: string[] = cData.classDays || cData.days || [];
        if (!classDays.includes(korDay)) continue;

        // 출석 레코드 ID 및 데이터 생성
        const attId = `att_${enrollStudentId}_${courseId}_${date}`;
        const attRef = doc(db, 'afterschool_attendance', attId);

        if (status === 'ABSENT') {
          // 방과후 출석부 결석(X) 기록
          await setDoc(
            attRef,
            {
              id: attId,
              courseId,
              studentId: enrollStudentId,
              date,
              status: 'ABSENT',
              markSymbol: 'X',
              isIndividualDismissal: false,
              source: 'homeroom_sync',
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } else if (status === 'EARLY_LEAVE' || status === 'INDIVIDUAL_DISMISSAL') {
          // 조퇴/개별하교: 방과후 출석부 개별하교(V) 기록
          await setDoc(
            attRef,
            {
              id: attId,
              courseId,
              studentId: enrollStudentId,
              date,
              status: 'ATTEND',
              markSymbol: 'V',
              isIndividualDismissal: true,
              source: 'homeroom_sync',
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } else if (status === 'ATTEND') {
          // 출석인 경우: 담임 연동으로 등록했던 레코드가 있다면 삭제
          const existingSnap = await getDoc(attRef);
          if (existingSnap.exists() && existingSnap.data()?.source === 'homeroom_sync') {
            await deleteDoc(attRef);
          }
        }
      }
    }
  } catch (afterschoolErr) {
    console.warn('[HomeroomSync] Afterschool attendance sync failed:', afterschoolErr);
  }
}
