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
import { findMasterStudentId } from '@/lib/students/masterStudentResolver';

export type HomeroomAttendanceStatus = 'ATTEND' | 'ABSENT' | 'EARLY_LEAVE' | 'INDIVIDUAL_DISMISSAL';

export interface HomeroomAttendanceRecord {
  id: string; // `${date}_${studentId}`
  date: string; // YYYY-MM-DD
  studentId: string;
  /** 공통 학생 키 (통합학생계정 문서 ID) */
  masterStudentId?: string;
  studentName: string;
  gradeClass: string;
  status: HomeroomAttendanceStatus;
  source: 'manual' | 'auto_field_trip' | 'auto_absence';
  reason?: string;
  updatedAt: string;
  updatedBy: string;
}

// ─── 0. 학급 키 정규화 ───────────────────────────────────────────────────────
// 학부모 신청서는 "6-6-1", "6학년 6반 1번" 등 학년-반-번호 형식으로 들어오고,
// 담임 출석부는 "6-6"(학년-반) 키로 조회하므로 저장·비교 시 항상 학년-반으로 맞춘다.

/** "6-6-1" / "6학년 6반 1번" / "6-6" → { grade: '6', classNum: '6', studentNum: '1' | '' } */
export function parseGradeClassNumber(raw: string | null | undefined): { grade: string; classNum: string; studentNum: string } {
  const nums = String(raw || '').match(/\d+/g) || [];
  const norm = (v?: string) => (v ? String(Number(v)) : '');
  return { grade: norm(nums[0]), classNum: norm(nums[1]), studentNum: norm(nums[2]) };
}

/** 학년-반 키("6-6"). 학년·반을 알 수 없으면 원문(trim)을 그대로 반환 */
export function normalizeGradeClassKey(raw: string | null | undefined): string {
  const { grade, classNum } = parseGradeClassNumber(raw);
  return grade && classNum ? `${grade}-${classNum}` : String(raw || '').trim();
}

/** 결석·체험학습 자동 결석 맵 키: 번호가 있으면 "이름#번호", 없으면 "이름" */
export function approvedAbsenceKey(name: string, studentNum?: string | number | null): string {
  const n = String(name || '').replace(/\s+/g, '');
  const num = studentNum !== undefined && studentNum !== null && String(studentNum).trim() !== ''
    ? String(Number(String(studentNum).trim()) || String(studentNum).trim())
    : '';
  return num ? `${n}#${num}` : n;
}

/** 공통 학생 키가 있는 신청서의 자동 결석 맵 키 */
export const approvedAbsenceMasterKey = (masterStudentId: string) => `mid:${masterStudentId}`;

/**
 * 학생에 해당하는 자동 결석 항목 조회.
 * - 공통 학생 키가 붙은 신청서는 키로만 찾는다 (동명이인 오표시 없음)
 * - 키가 없는 옛 신청서는 번호가 적혀 있으면 이름+번호, 없으면 이름으로 찾는다
 */
export function lookupApprovedAbsence<T>(map: Map<string, T>, name: string, studentNum?: string | number | null, masterStudentId?: string | null): T | undefined {
  if (masterStudentId) {
    const byKey = map.get(approvedAbsenceMasterKey(masterStudentId));
    if (byKey) return byKey;
  }
  return map.get(approvedAbsenceKey(name, studentNum)) ?? map.get(approvedAbsenceKey(name));
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
  const targetKey = normalizeGradeClassKey(gradeClass);

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as HomeroomAttendanceRecord))
        // 클라이언트에서 gradeClass 필터링 ("6-6-1" 형식으로 저장된 기존 기록도 "6-6"으로 맞춰 비교)
        .filter((r) => normalizeGradeClassKey(r.gradeClass) === targetKey);
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
      where('docType', '==', 'parent')
    );

    const snap = await getDocs(q);
    const targetKey = normalizeGradeClassKey(gradeClass);
    snap.docs.forEach((d) => {
      const data = d.data();
      const pData = data.parentFormData;
      if (!pData) return;

      // 반려, 회수, 취소된 문서는 출석부 결석 대상에서 제외하고, 접수(pending) 및 승인(approved) 문서는 모두 반영
      if (data.status === 'rejected' || data.status === 'recalled' || data.status === 'cancelled') return;

      const pGradeClass = pData.gradeClassNumber || data.gradeClass || '';
      // 학급 매칭 ("6-6", "6학년 6반", "6-6-1" 모두 학년-반으로 정규화 후 정확히 비교 → "1-1"이 "1-10"에 매칭되지 않음)
      if (normalizeGradeClassKey(pGradeClass) !== targetKey) return;
      const pStudentNum = parseGradeClassNumber(pGradeClass).studentNum;

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
        // 공통 학생 키가 있으면 키로, 없으면 번호가 적힌 신청서는 "이름#번호"로 저장 → 같은 반 동명이인에게 함께 표시되지 않음
        const mapKey = pData.masterStudentId
          ? approvedAbsenceMasterKey(String(pData.masterStudentId))
          : approvedAbsenceKey(sName, pStudentNum);
        resultMap.set(mapKey, {
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

    // 공통 학생 키: 지정되지 않았으면 studentId가 통합학생계정 문서인지 확인해 채운다
    let masterStudentId = record.masterStudentId || '';
    let masterEmail = '';
    try {
      const masterSnap = await getDoc(doc(db, 'master_students', masterStudentId || record.studentId));
      if (masterSnap.exists() && (masterSnap.data()?.name || masterSnap.data()?.grade)) {
        masterStudentId = masterSnap.id;
        masterEmail = String(masterSnap.data()?.studentEmail || '').trim().toLowerCase();
      }
    } catch (err) {
      console.warn('[HomeroomAttendance] master lookup failed:', err);
    }

    const fullRecord: HomeroomAttendanceRecord = {
      ...record,
      ...(masterStudentId ? { masterStudentId } : {}),
      id: docId,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, fullRecord, { merge: true });

    // 스쿨버스 및 방과후 출석부 연동 비동기 실행 (결과는 기다리되 UI 차단 최소화)
    await syncToBusAndAfterschool(fullRecord, masterEmail);

    return { success: true };
  } catch (err: any) {
    console.error('[HomeroomAttendance] save error:', err);
    return { success: false, error: err.message };
  }
}

// ─── 4. 스쿨버스 및 방과후 연동 세부 로직 ──────────────────────────────────

async function syncToBusAndAfterschool(record: HomeroomAttendanceRecord, masterEmail = '') {
  const { date, studentId, studentName, gradeClass, status } = record;
  const masterId = record.masterStudentId || '';
  const db = getDb();

  const { grade, classNum } = parseGradeClassNumber(gradeClass);
  const studentEmail = masterEmail;

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
    // ① 공통 학생 키 ② 버스 학생 ID ③ 이메일 ④ (키 없는 버스 학생만) 이름+학년+반이 한 명일 때
    const matchedBusStudent =
      (masterId ? busStudentsSnap.docs.find(d => d.data().masterStudentId === masterId) : undefined) ||
      busStudentsSnap.docs.find(d => d.id === studentId) ||
      (studentEmail ? busStudentsSnap.docs.find(d => String(d.data().studentEmail || '').trim().toLowerCase() === studentEmail) : undefined) ||
      (() => {
        if (!grade || !classNum || !targetCleanName) return undefined;
        const hits = busStudentsSnap.docs.filter(d => {
          const s = d.data();
          if (masterId && s.masterStudentId && s.masterStudentId !== masterId) return false;
          const nameMatch = clean(s.name) === targetCleanName || clean(s.nameKo) === targetCleanName || clean(s.nameEn) === targetCleanName;
          return nameMatch && String(s.grade) === String(grade) && String(s.class ?? s.classNum) === String(classNum);
        });
        return hits.length === 1 ? hits[0] : undefined;
      })();

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

    // 1차: 공통 학생 키(masterStudentId) + studentId 직접 조회
    const enrollmentsRef = collection(db, 'afterschool_enrollments');
    const found = new Map<string, any>();
    const directSnaps = await Promise.all([
      getDocs(query(enrollmentsRef, where('studentId', '==', studentId), where('status', '==', 'ENROLLED'))),
      ...(masterId ? [getDocs(query(enrollmentsRef, where('masterStudentId', '==', masterId), where('status', '==', 'ENROLLED')))] : []),
    ]);
    directSnaps.forEach(snap => snap.docs.forEach(d => {
      const e: any = { id: d.id, ...d.data() };
      // 다른 학생 키가 붙은 신청은 제외
      if (masterId && e.masterStudentId && e.masterStudentId !== masterId) return;
      found.set(d.id, e);
    }));
    let targetEnrollments: any[] = Array.from(found.values());

    // 2차: 직접 조회 결과가 없을 시 (키가 없는 옛 신청에 한해) 이메일 또는 이름/학년/반으로 검색
    if (targetEnrollments.length === 0 && studentName) {
      const clean = (str: any) => String(str || '').replace(/\s+/g, '').toLowerCase();
      const targetCleanName = clean(studentName);
      const allEnrolledSnap = await getDocs(query(enrollmentsRef, where('status', '==', 'ENROLLED')));
      targetEnrollments = allEnrolledSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((e: any) => {
          if (e.masterStudentId && e.masterStudentId !== masterId) return false;
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

// ─── 5. 학부모 신청서(결석/체험학습) 기간 전체 자동 동기화 ─────────────────

/**
 * 시작일~종료일 사이의 모든 평일(월~금) 날짜 배열을 반환합니다.
 */
export function getWeekdayDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    if (startDate && startDate === endDate) return [startDate];
    return [];
  }
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) { // 일요일(0), 토요일(6) 제외
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth() + 1).padStart(2, '0');
      const dd = String(cur.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/**
 * 학부모 신청서(결석계 / 교외체험학습) 접수 시 신청 기간의 모든 날짜에 대해
 * 1) 담임 출석부(homeroom_daily_attendance) 결석(ABSENT) 체크
 * 2) 스쿨버스 해당 날짜 '오늘 안 탐'(notBoarding) 반영
 * 3) 방과후 출석부 해당 날짜 강좌 결석('X') 반영
 */
export async function syncParentApplicationDatesToAttendance(
  pData: any,
  submitterEmail: string = '',
  knownStudentId?: string
): Promise<{ success: boolean; dates: string[]; error?: string }> {
  try {
    if (!pData) return { success: false, dates: [] };

    const docType = pData.type; // 'field-trip' | 'absence'
    if (docType !== 'field-trip' && docType !== 'absence') {
      return { success: true, dates: [] };
    }

    let startDate = '';
    let endDate = '';
    let reason = '';
    const source = docType === 'field-trip' ? 'auto_field_trip' : 'auto_absence';

    if (docType === 'field-trip') {
      startDate = pData.tripPeriod?.startDate || '';
      endDate = pData.tripPeriod?.endDate || '';
      reason = pData.purpose || pData.destination || '교외체험학습';
    } else {
      startDate = pData.absencePeriod?.startDate || '';
      endDate = pData.absencePeriod?.endDate || '';
      reason = pData.absenceReason || pData.absenceType || '결석';
    }

    if (!startDate || !endDate) {
      return { success: false, dates: [], error: '기간 정보가 누락되었습니다.' };
    }

    const dates = getWeekdayDatesInRange(startDate, endDate);
    if (dates.length === 0) {
      return { success: true, dates: [] };
    }

    const studentName = (pData.studentName || '').trim();
    const rawGradeClass = pData.gradeClassNumber || pData.gradeClass || '';
    // 출석부는 학년-반("6-6") 키로 조회하므로 저장도 학년-반으로 맞춘다
    const gradeClass = normalizeGradeClassKey(rawGradeClass);
    const db = getDb();

    // 공통 학생 키 식별: 신청서의 masterStudentId → 넘겨받은 ID(통합학생 문서일 때) → 이름+학년+반(+번호)이 한 명일 때
    const { grade: targetG, classNum: targetC, studentNum: targetN } = parseGradeClassNumber(rawGradeClass);
    const known = String(knownStudentId || '').trim();
    const masterStudentId = await findMasterStudentId({
      masterStudentId: pData.masterStudentId || known,
      email: known.includes('@') ? known : '',
      name: studentName,
      grade: targetG,
      classNum: targetC,
      studentNum: targetN,
    });
    if (!masterStudentId) {
      console.warn(`[HomeroomSync] ${studentName}(${rawGradeClass}) 학생을 통합학생계정에서 한 명으로 특정하지 못했습니다.`);
    }

    const effectiveStudentId = masterStudentId || known || studentName;

    // 기간 내 모든 평일 날짜에 대해 출석부 저장 및 스쿨버스/방과후 동기화
    for (const d of dates) {
      await saveHomeroomAttendanceAndSync({
        date: d,
        studentId: effectiveStudentId,
        ...(masterStudentId ? { masterStudentId } : {}),
        studentName,
        gradeClass,
        status: 'ABSENT',
        source,
        reason,
        updatedBy: submitterEmail || 'system_parent_sync',
      });
    }

    console.log(`[HomeroomSync] Successfully synced parent application: ${studentName}, dates=${dates.join(', ')}`);
    return { success: true, dates };
  } catch (err: any) {
    console.error('[HomeroomSync] syncParentApplicationDatesToAttendance failed:', err);
    return { success: false, dates: [], error: err.message };
  }
}

