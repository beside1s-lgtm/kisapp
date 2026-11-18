import { getDb, auth } from '@/lib/firebase';
import { doc, getDoc, getDocs, setDoc, collection, onSnapshot, updateDoc, deleteDoc, writeBatch, runTransaction, query, where, orderBy, QueryDocumentSnapshot } from 'firebase/firestore';
import type { DocConfig } from '@/lib/types';
import type { Course, Enrollment } from '@/lib/afterschool/types';
import { overlayEnrollmentsWithMaster, withEnrollmentMasterKey } from '@/lib/students/masterStudentResolver';

function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        newObj[key] = cleanUndefined(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

const getSettingsCol = () => collection(getDb(), 'settings');

export async function getDocConfig(): Promise<Partial<DocConfig>> {
  try {
    const snap = await getDoc(doc(getSettingsCol(), 'docConfig'));
    return snap.exists() ? (snap.data() as DocConfig) : {};
  } catch (e) {
    console.error("[SettingsService] getDocConfig error:", e);
    return {};
  }
}

export async function getPeriodSchedules(): Promise<import('@/lib/types').ClassPeriodSchedule[]> {
  try {
    const config = await getDocConfig();
    if (config.academicCalendar?.periodSchedules && config.academicCalendar.periodSchedules.length > 0) {
      return config.academicCalendar.periodSchedules;
    }
  } catch (e) {
    console.error("[SettingsService] getPeriodSchedules error:", e);
  }
  const { DEFAULT_PERIOD_SCHEDULES } = await import('@/lib/types');
  return DEFAULT_PERIOD_SCHEDULES;
}

export function onDocConfigUpdate(callback: (config: Partial<DocConfig>) => void) {
  return onSnapshot(doc(getSettingsCol(), 'docConfig'), (snap) => {
    if (snap.exists()) {
      callback(snap.data() as DocConfig);
    } else {
      callback({});
    }
  }, (err) => console.error("onDocConfigUpdate error:", err));
}

export async function saveDocConfig(payload: Partial<DocConfig>) {
  try {
    await setDoc(doc(getSettingsCol(), 'docConfig'), payload, { merge: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getOrgStructure(): Promise<Partial<import('@/lib/types').OrgStructure>> {
  try {
    const snap = await getDoc(doc(getSettingsCol(), 'orgStructure'));
    if (snap.exists()) {
      const data = snap.data() as import('@/lib/types').OrgStructure;
      return {
        ...data,
        afterschoolManagers: Array.from(new Set([...(data.afterschoolManagers || []), 'beside1s@kshcm.net'])),
        busManagers: Array.from(new Set([...(data.busManagers || []), 'beside1s@kshcm.net', 'bus@kshcm.net'])),
      };
    }
    return { afterschoolManagers: ['beside1s@kshcm.net'], busManagers: ['beside1s@kshcm.net', 'bus@kshcm.net'] };
  } catch (e) {
    console.error("[SettingsService] getOrgStructure error:", e);
    return { afterschoolManagers: ['beside1s@kshcm.net'], busManagers: ['beside1s@kshcm.net', 'bus@kshcm.net'] };
  }
}

export function onOrgStructureUpdate(callback: (org: Partial<import('@/lib/types').OrgStructure>) => void) {
  return onSnapshot(doc(getSettingsCol(), 'orgStructure'), (snap) => {
    if (snap.exists()) {
      const data = snap.data() as import('@/lib/types').OrgStructure;
      callback({
        ...data,
        afterschoolManagers: Array.from(new Set([...(data.afterschoolManagers || []), 'beside1s@kshcm.net'])),
        busManagers: Array.from(new Set([...(data.busManagers || []), 'beside1s@kshcm.net', 'bus@kshcm.net'])),
      });
    } else {
      callback({ afterschoolManagers: ['beside1s@kshcm.net'], busManagers: ['beside1s@kshcm.net', 'bus@kshcm.net'] });
    }
  }, (err) => console.error("onOrgStructureUpdate error:", err));
}

export async function saveOrgStructure(payload: Partial<import('@/lib/types').OrgStructure>) {
  try {
    const cleaned = cleanUndefined(payload);
    await setDoc(doc(getSettingsCol(), 'orgStructure'), cleaned, { merge: true });
    return { success: true };
  } catch (error: any) {
    console.error("[SettingsService] saveOrgStructure error:", error);
    return { success: false, error: error.message };
  }
}

export const DEFAULT_DELEGATION_RULES: import('@/lib/types').DelegationRule[] = [
  {
    id: 'rule-absence',
    category: '학부모 출결',
    mainType: '학부모 출결',
    subType: '결석계',
    detailType: '일반/질병/인정',
    intermediateApprover: 'NONE',
    finalApprover: 'GRADE_HEAD',
    description: '담임 ➡️ 학년부장 (전결)'
  },
  {
    id: 'rule-fieldtrip',
    category: '학부모 출결',
    mainType: '학부모 출결',
    subType: '체험학습신청서',
    detailType: '교외체험학습',
    intermediateApprover: 'GRADE_HEAD',
    finalApprover: 'VP',
    description: '담임 ➡️ 학년부장 ➡️ 교감 (전결)'
  },
  {
    id: 'rule-annual-plan',
    category: '일반 공문',
    mainType: '일반 공문',
    subType: '연간계획공문',
    detailType: '연간 운영계획',
    intermediateApprover: 'DEPT_HEAD',
    finalApprover: 'PRINCIPAL',
    description: '기안자 ➡️ 담당부장 ➡️ 교감 ➡️ 교장 (결재)'
  },
  {
    id: 'rule-detail-plan',
    category: '일반 공문',
    mainType: '일반 공문',
    subType: '세부계획공문',
    detailType: '세부 실행계획',
    intermediateApprover: 'DEPT_HEAD',
    finalApprover: 'VP',
    description: '기안자 ➡️ 담당부장 ➡️ 교감 (전결)'
  },
  {
    id: 'rule-vacation-major',
    category: '교원 복무',
    mainType: '교원 복무',
    subType: '휴가',
    detailType: '연가',
    intermediateApprover: 'DEPT_HEAD',
    finalApprover: 'PRINCIPAL',
    description: '기안자 ➡️ 부장 ➡️ 교감 ➡️ 교장 (결재)'
  },
  {
    id: 'rule-vacation-minor',
    category: '교원 복무',
    mainType: '교원 복무',
    subType: '휴가',
    detailType: '조퇴',
    intermediateApprover: 'DEPT_HEAD',
    finalApprover: 'VP',
    description: '기안자 ➡️ 부장 ➡️ 교감 (전결)'
  },
  {
    id: 'rule-trip-local',
    category: '교원 복무',
    mainType: '교원 복무',
    subType: '출장',
    detailType: '관내',
    intermediateApprover: 'DEPT_HEAD',
    finalApprover: 'VP',
    description: '기안자 ➡️ 부장 ➡️ 교감 (전결)'
  },
  {
    id: 'rule-trip-outside',
    category: '교원 복무',
    mainType: '교원 복무',
    subType: '출장',
    detailType: '관외',
    intermediateApprover: 'DEPT_HEAD',
    finalApprover: 'PRINCIPAL',
    description: '기안자 ➡️ 부장 ➡️ 교감 ➡️ 교장 (결재)'
  },
];

export async function getDelegationRules(): Promise<import('@/lib/types').DelegationRule[]> {
  try {
    const snap = await getDoc(doc(getSettingsCol(), 'delegationRules'));
    if (snap.exists() && Array.isArray(snap.data().rules) && snap.data().rules.length > 0) {
      return snap.data().rules as import('@/lib/types').DelegationRule[];
    }
    return DEFAULT_DELEGATION_RULES;
  } catch (e) {
    console.error("[SettingsService] getDelegationRules error:", e);
    return DEFAULT_DELEGATION_RULES;
  }
}

export async function saveDelegationRules(rules: import('@/lib/types').DelegationRule[]) {
  try {
    await setDoc(doc(getSettingsCol(), 'delegationRules'), { rules }, { merge: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getAfterschoolTimerConfig(): Promise<import('@/lib/afterschool/types').GlobalTimerConfig> {
  try {
    if (!auth.currentUser) {
      const { initialTimerConfig } = await import('@/lib/afterschool/mock/data');
      return initialTimerConfig;
    }
    const snap = await getDoc(doc(getSettingsCol(), 'afterschoolTimer'));
    if (snap.exists()) {
      return snap.data() as import('@/lib/afterschool/types').GlobalTimerConfig;
    }
    const { initialTimerConfig } = await import('@/lib/afterschool/mock/data');
    return initialTimerConfig;
  } catch (e) {
    console.error("[SettingsService] getAfterschoolTimerConfig error:", e);
    const { initialTimerConfig } = await import('@/lib/afterschool/mock/data');
    return initialTimerConfig;
  }
}

export async function saveAfterschoolTimerConfig(payload: Partial<import('@/lib/afterschool/types').GlobalTimerConfig>) {
  try {
    await setDoc(doc(getSettingsCol(), 'afterschoolTimer'), cleanUndefined(payload), { merge: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function onAfterschoolTimerUpdate(callback: (config: import('@/lib/afterschool/types').GlobalTimerConfig) => void): () => void {
  const docRef = doc(getSettingsCol(), 'afterschoolTimer');
  return onSnapshot(docRef, async (snap) => {
    if (snap.exists()) {
      callback(snap.data() as import('@/lib/afterschool/types').GlobalTimerConfig);
    } else {
      const { initialTimerConfig } = await import('@/lib/afterschool/mock/data');
      callback(initialTimerConfig);
    }
  });
}

export function onAfterschoolCoursesUpdate(
  callback: (courses: import('@/lib/afterschool/types').Course[]) => void,
  onError?: (error: Error) => void
): () => void {
  const colRef = collection(getDb(), 'afterschool_courses');
  return onSnapshot(
    colRef,
    (snap) => {
      if (snap.empty) {
        callback([]);
      } else {
        const list = snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as any)
        } as import('@/lib/afterschool/types').Course));
        callback(list.sort((a, b) => (a.id || '').localeCompare(b.id || '')));
      }
    },
    (err) => {
      console.warn('[settingsService] onAfterschoolCoursesUpdate error:', err);
      if (onError) onError(err);
      callback([]);
    }
  );
}

export async function getAfterschoolCoursesDirectly(): Promise<import('@/lib/afterschool/types').Course[]> {
  try {
    const colRef = collection(getDb(), 'afterschool_courses');
    const snap = await getDocs(colRef);
    if (snap.empty) return [];
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) } as import('@/lib/afterschool/types').Course))
      .sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  } catch (err) {
    console.warn('[settingsService] getAfterschoolCoursesDirectly error:', err);
    return [];
  }
}

export async function updateAfterschoolCourse(courseId: string, data: Partial<import('@/lib/afterschool/types').Course>): Promise<void> {
  const docRef = doc(getDb(), 'afterschool_courses', courseId);
  await setDoc(docRef, cleanUndefined(data), { merge: true });
}

export async function deleteAfterschoolCourse(courseId: string): Promise<void> {
  const { deleteDoc } = await import('firebase/firestore');
  const docRef = doc(getDb(), 'afterschool_courses', courseId);
  await deleteDoc(docRef);
}

export function onAfterschoolEnrollmentsUpdate(
  callback: (enrollments: import('@/lib/afterschool/types').Enrollment[]) => void,
  onError?: (error: Error) => void
): () => void {
  const colRef = collection(getDb(), 'afterschool_enrollments');
  let seq = 0;
  return onSnapshot(
    colRef,
    (snap) => {
      if (snap.empty) {
        seq++;
        callback([]);
      } else {
        const list = snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as any)
        } as import('@/lib/afterschool/types').Enrollment));
        // 화면에는 통합학생계정의 최신 이름·학년·반·번호를 보여 준다 (늦게 도착한 이전 결과는 버림)
        const mine = ++seq;
        overlayEnrollmentsWithMaster(list).then(shown => { if (mine === seq) callback(shown); });
      }
    },
    (err) => {
      console.warn('[settingsService] onAfterschoolEnrollmentsUpdate error:', err);
      if (onError) onError(err);
      callback([]);
    }
  );
}

/**
 * 학부모/학생 화면용: 본인(자녀) 신청 내역만 실시간 구독
 * - 전체 컬렉션 구독 시 신청 1건마다 모든 접속자에게 전송되어 오픈 직후 트래픽/읽기 비용이 폭증하므로 범위를 좁힌다.
 * - studentIds(in), studentEmail(in), name(==) 조건별로 구독 후 문서 ID 기준으로 병합 (호출 측에서 기존과 동일한 조건으로 최종 필터)
 */
export function onAfterschoolEnrollmentsForStudentUpdate(
  filters: { studentIds?: string[]; studentEmail?: string; name?: string },
  callback: (enrollments: import('@/lib/afterschool/types').Enrollment[]) => void,
  onError?: (error: Error) => void
): () => void {
  const colRef = collection(getDb(), 'afterschool_enrollments');
  const queries: ReturnType<typeof query>[] = [];

  const ids = Array.from(new Set((filters.studentIds || []).map(v => String(v || '').trim()).filter(Boolean)));
  for (let i = 0; i < ids.length; i += 30) {
    queries.push(query(colRef, where('studentId', 'in', ids.slice(i, i + 30))));
  }
  const email = String(filters.studentEmail || '').trim();
  if (email) {
    queries.push(query(colRef, where('studentEmail', 'in', Array.from(new Set([email, email.toLowerCase()])))));
  }
  const name = String(filters.name || '').trim();
  if (name) {
    queries.push(query(colRef, where('name', '==', name)));
  }

  if (queries.length === 0) {
    callback([]);
    return () => {};
  }

  const buckets: Map<string, import('@/lib/afterschool/types').Enrollment>[] = queries.map(() => new Map());
  let seq = 0;
  const emit = () => {
    const merged = new Map<string, import('@/lib/afterschool/types').Enrollment>();
    buckets.forEach(b => b.forEach((v, k) => merged.set(k, v)));
    const mine = ++seq;
    overlayEnrollmentsWithMaster(Array.from(merged.values())).then(shown => { if (mine === seq) callback(shown); });
  };

  const unsubs = queries.map((q, idx) => onSnapshot(
    q,
    (snap) => {
      const bucket = new Map<string, import('@/lib/afterschool/types').Enrollment>();
      snap.docs.forEach(d => bucket.set(d.id, { id: d.id, ...(d.data() as any) }));
      buckets[idx] = bucket;
      emit();
    },
    (err) => {
      console.warn('[settingsService] onAfterschoolEnrollmentsForStudentUpdate error:', err);
      if (onError) onError(err);
    }
  ));

  return () => unsubs.forEach(u => u());
}

export async function saveAfterschoolEnrollment(enrollment: import('@/lib/afterschool/types').Enrollment): Promise<void> {
  const docRef = doc(getDb(), 'afterschool_enrollments', enrollment.id);
  // 공통 학생 키(masterStudentId)가 없으면 통합학생계정에서 찾아 함께 저장
  const keyed = await withEnrollmentMasterKey(enrollment);
  await setDoc(docRef, cleanUndefined(keyed));
}

export async function saveAfterschoolEnrollmentsBatch(enrollments: import('@/lib/afterschool/types').Enrollment[]): Promise<void> {
  if (!enrollments || enrollments.length === 0) return;
  // 공통 학생 키(masterStudentId)가 없으면 통합학생계정에서 찾아 함께 저장
  const keyedList = await Promise.all(enrollments.map(item => withEnrollmentMasterKey(item)));
  const batch = writeBatch(getDb());
  keyedList.forEach(item => {
    const docRef = doc(getDb(), 'afterschool_enrollments', item.id);
    batch.set(docRef, cleanUndefined(item), { merge: true });
  });
  await batch.commit();
}

export async function cancelAfterschoolEnrollmentTransaction(
  enrollmentId: string
): Promise<{
  success: boolean;
  promotedStudentName?: string;
  promotedCourseTitle?: string;
  message?: string;
}> {
  const db = getDb();
  let promotedStudentName: string | undefined = undefined;
  let promotedCourseTitle: string | undefined = undefined;
  let cancelledEnrollmentData: Enrollment | null = null;

  try {
    await runTransaction(db, async (transaction) => {
      // 트랜잭션 재시도 시 이전 시도의 결과가 남지 않도록 초기화
      promotedStudentName = undefined;
      promotedCourseTitle = undefined;

      // ⚠️ Firestore 트랜잭션은 모든 읽기를 쓰기보다 먼저 수행해야 한다.
      // [읽기 단계] 1. 취소 대상 신청 내역
      const enrollRef = doc(db, 'afterschool_enrollments', enrollmentId);
      const enrollSnap = await transaction.get(enrollRef);

      if (!enrollSnap.exists()) {
        throw new Error('취소할 수강 신청 내역을 찾을 수 없습니다.');
      }

      const cancellingEnrollment = enrollSnap.data() as Enrollment;
      cancelledEnrollmentData = cancellingEnrollment;
      const { courseId, status: cancellingStatus } = cancellingEnrollment;

      // [읽기 단계] 2. 해당 강좌 정보
      const courseRef = courseId ? doc(db, 'afterschool_courses', courseId) : null;
      const courseSnap = courseRef ? await transaction.get(courseRef) : null;

      // [읽기 단계] 3. 확정자 취소 시 승격할 대기 1순위 확정
      //  - 대기자 목록 조회(query)는 트랜잭션 밖 읽기이므로 후보만 뽑고,
      //  - 각 후보를 transaction.get으로 다시 읽어 아직 WAITING인지 검증한다.
      //    (동시 취소 2건이 같은 대기자를 중복 승격하면 충돌로 재시도되어 다음 순위가 승격됨)
      let promoteTarget: { ref: ReturnType<typeof doc>; data: Enrollment } | null = null;
      if (courseSnap?.exists() && cancellingStatus === 'ENROLLED') {
        const q = query(
          collection(db, 'afterschool_enrollments'),
          where('courseId', '==', courseId),
          where('status', '==', 'WAITING')
        );
        const waitingSnaps = await getDocs(q);
        const candidates = waitingSnaps.docs
          .filter(d => d.id !== enrollmentId)
          .map(d => ({ id: d.id, data: d.data() as Enrollment }))
          .sort((a, b) => {
            const tA = a.data.timestampMs || new Date(a.data.registrationDate || 0).getTime();
            const tB = b.data.timestampMs || new Date(b.data.registrationDate || 0).getTime();
            return tA - tB;
          });

        for (const cand of candidates.slice(0, 10)) {
          const candRef = doc(db, 'afterschool_enrollments', cand.id);
          const fresh = await transaction.get(candRef);
          const freshData = fresh.exists() ? (fresh.data() as Enrollment) : null;
          if (freshData && freshData.status === 'WAITING' && freshData.courseId === courseId) {
            promoteTarget = { ref: candRef, data: freshData };
            break;
          }
        }
      }

      // [쓰기 단계] 1. 대상 신청 내역 삭제
      transaction.delete(enrollRef);

      if (!courseRef || !courseSnap?.exists()) return;

      const courseData = courseSnap.data() as Course;
      let newCurrentStudents = courseData.currentStudents || 0;
      let newWaitingStudents = courseData.waitingStudents || 0;

      // [쓰기 단계] 2. 수강 확정자(ENROLLED)가 취소한 경우: 대기 1순위 자동 승격
      if (cancellingStatus === 'ENROLLED') {
        newCurrentStudents = Math.max(0, newCurrentStudents - 1);

        if (promoteTarget) {
          transaction.update(promoteTarget.ref, {
            status: 'ENROLLED',
            promotedAt: new Date().toISOString(),
          });

          newCurrentStudents += 1;
          newWaitingStudents = Math.max(0, newWaitingStudents - 1);
          promotedStudentName = promoteTarget.data.studentName || promoteTarget.data.name;
          promotedCourseTitle = courseData.title;
        }
      } else if (cancellingStatus === 'WAITING') {
        newWaitingStudents = Math.max(0, newWaitingStudents - 1);
      }

      // [쓰기 단계] 3. 강좌 인원 카운터 업데이트
      transaction.update(courseRef, {
        currentStudents: newCurrentStudents,
        waitingStudents: newWaitingStudents,
      });
    });

    // 🌟 방과후 수강 취소 시 스쿨버스 정규 하교 버스로 즉시 복귀 연동
    if (cancelledEnrollmentData) {
      try {
        const { revertCancelledStudentToAfternoonBus } = await import('@/lib/kisbus/assignments');
        await revertCancelledStudentToAfternoonBus({
          studentId: (cancelledEnrollmentData as any).studentId,
          studentEmail: (cancelledEnrollmentData as any).studentEmail || (cancelledEnrollmentData as any).email,
          name: (cancelledEnrollmentData as any).name || (cancelledEnrollmentData as any).studentName,
          grade: (cancelledEnrollmentData as any).grade,
          classNum: (cancelledEnrollmentData as any).classNum
        });
      } catch (busErr) {
        console.warn('스쿨버스 하교 복귀 처리 실패 (방과후 취소는 정상 완료):', busErr);
      }
    }

    return {
      success: true,
      promotedStudentName,
      promotedCourseTitle,
      message: promotedStudentName 
        ? `수강 신청이 취소되었습니다. 대기 1순위였던 [${promotedStudentName}] 학생이 [${promotedCourseTitle}] 수강 명단으로 자동 승격되었습니다!`
        : '수강 신청 취소가 성공적으로 완료되었습니다.'
    };
  } catch (err: any) {
    console.error('cancelAfterschoolEnrollmentTransaction error:', err);
    return {
      success: false,
      message: err?.message || '수강 신청 취소 중 오류가 발생했습니다.'
    };
  }
}

export async function deleteAfterschoolEnrollment(enrollmentId: string): Promise<any> {
  return await cancelAfterschoolEnrollmentTransaction(enrollmentId);
}

export async function deleteAfterschoolEnrollmentsBatch(enrollmentIds: string[]): Promise<void> {
  if (!enrollmentIds || enrollmentIds.length === 0) return;
  const db = getDb();
  // Firestore batch limit is 500
  const chunkSize = 400;
  for (let i = 0; i < enrollmentIds.length; i += chunkSize) {
    const chunk = enrollmentIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((id) => {
      batch.delete(doc(db, 'afterschool_enrollments', id));
    });
    await batch.commit();
  }
}

/**
 * 수강생 명단 전체 비우기 (Firestore afterschool_enrollments 컬렉션 일괄 삭제 및 모든 강좌 인원수 0으로 초기화)
 */
export async function purgeAllAfterschoolEnrollments(): Promise<{ count: number }> {
  const db = getDb();
  const snapshot = await getDocs(collection(db, 'afterschool_enrollments'));
  if (snapshot.empty) return { count: 0 };

  const chunkSize = 400;
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  }

  // 모든 강좌의 수강 인원수를 0으로 리셋
  const coursesSnap = await getDocs(collection(db, 'afterschool_courses'));
  if (!coursesSnap.empty) {
    const courseDocs = coursesSnap.docs;
    for (let i = 0; i < courseDocs.length; i += chunkSize) {
      const chunk = courseDocs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((d) => {
        batch.update(d.ref, { currentStudents: 0, waitingStudents: 0 });
      });
      await batch.commit();
    }
  }

  return { count: docs.length };
}


export async function syncCourseStudentCounts(courseId: string, allEnrollments: import('@/lib/afterschool/types').Enrollment[]): Promise<void> {
  if (!courseId) return;
  const courseEnrollments = allEnrollments.filter(e => e.courseId === courseId);
  const enrolledCount = courseEnrollments.filter(e => e.status === 'ENROLLED').length;
  const waitingCount = courseEnrollments.filter(e => e.status === 'WAITING').length;
  await updateAfterschoolCourse(courseId, {
    currentStudents: enrolledCount,
    waitingStudents: waitingCount,
  });
}

export const defaultTeacherApplySettings = {
  afterschoolStageStatus: 'RECRUITING' as 'RECRUITING' | 'APPLYING' | 'CONFIRMED' | 'OPERATING' | 'CLOSED',
  isAfterschoolFinalized: false as boolean,
  afterschoolFinalizedAt: '' as string,
  masterStatus: 'AUTO' as 'AUTO' | 'FORCE_OPEN' | 'FORCE_LOCK' | 'PAUSED',
  applyStartDate: '2026-07-01 09:00:00',
  applyEndDate: '2026-07-15 18:00:00',
  semester: '1학기' as '1학기' | '여름방학' | '2학기' | '겨울방학' | '특별강좌',
  year: '2026',
  operatingStartDate: '2026-03-30',
  operatingEndDate: '2026-06-20',
  classTimeStart: '14:00',
  classTimeEnd: '15:20',
  teacherFee: 40000,
  teacherFeeType: '시간당' as '시간당' | '차시당' | '정액제',
  fundingSource: '수익자부담' as '수익자부담' | '학교예산' | '혼용',
  tuitionType: '수익자부담' as '수익자부담' | '학교예산',
  tuitionPerSession: 15000,
  allowedDays: ['월', '화', '수', '목', '금'] as string[],
  allowedPeriods: [1, 2, 3, 4, 5, 6, 7, 8, 9] as number[],
  tuitionCurrency: 'KRW' as 'KRW' | 'VND' | 'USD',
  teacherFeeCurrency: 'KRW' as 'KRW' | 'VND' | 'USD',
  operatingWeeks: 10,
  sessionsPerClass: 2,
  timeSlots: [
    { id: 'ts1', label: '학기 중 오후 (15:00~16:40)', startTime: '15:00', endTime: '16:40', type: 'SEMESTER' },
    { id: 'ts2', label: '오전 1교시 (08:30~10:00)', startTime: '08:30', endTime: '10:00', type: 'VACATION_OR_SAT' },
    { id: 'ts3', label: '오전 2교시 (10:10~11:40)', startTime: '10:10', endTime: '11:40', type: 'VACATION_OR_SAT' },
    { id: 'ts4', label: '오전 통합교시 (08:30~11:40)', startTime: '08:30', endTime: '11:40', type: 'VACATION_OR_SAT' },
  ] as Array<{ id: string; label: string; startTime: string; endTime: string; type: 'SEMESTER' | 'VACATION_OR_SAT' }>,
};

export async function getTeacherApplySettings(): Promise<typeof defaultTeacherApplySettings> {
  try {
    const snap = await getDoc(doc(getSettingsCol(), 'afterschoolTeacherApplySettings'));
    return snap.exists() ? (snap.data() as typeof defaultTeacherApplySettings) : defaultTeacherApplySettings;
  } catch (e) {
    console.error("[SettingsService] getTeacherApplySettings error:", e);
    return defaultTeacherApplySettings;
  }
}

export async function saveTeacherApplySettings(payload: Partial<typeof defaultTeacherApplySettings>) {
  try {
    await setDoc(doc(getSettingsCol(), 'afterschoolTeacherApplySettings'), cleanUndefined(payload), { merge: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function onTeacherApplySettingsUpdate(callback: (settings: typeof defaultTeacherApplySettings) => void): () => void {
  const docRef = doc(getSettingsCol(), 'afterschoolTeacherApplySettings');
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as typeof defaultTeacherApplySettings);
    } else {
      callback(defaultTeacherApplySettings);
    }
  });
}

export type AfterschoolEnrollErrorCode = 'DUPLICATE' | 'CLOSED' | 'NOT_FOUND' | 'CONFLICT' | 'UNKNOWN';

class AfterschoolEnrollError extends Error {
  enrollCode: AfterschoolEnrollErrorCode;
  constructor(enrollCode: AfterschoolEnrollErrorCode, message: string) {
    super(message);
    this.enrollCode = enrollCode;
  }
}

/**
 * 방과후 수강신청 선착순 트랜잭션
 * - 정원/대기 판정과 인원 카운터 증가를 하나의 트랜잭션으로 처리
 * - 강좌+학생 고정 ID 문서를 트랜잭션 안에서 확인하여 중복 신청 차단 (enrollmentId는 buildAfterschoolEnrollmentId 사용 권장)
 * - 트랜잭션 안에서 신청 타이머 설정을 다시 읽어, 화면이 오래 열려 있어도 잠금/마감 이후 신청은 거절
 * - options.skipOpenCheck: 관리자 스트레스 테스트 등 신청 기간 검사를 생략할 때만 사용
 */
export async function runAfterschoolEnrollmentTransaction(
  enrollmentId: string,
  courseId: string,
  studentId: string,
  studentProfile: {
    name: string;
    phone: string;
    parentPhone: string;
    kisbusNo?: string;
    grade?: number;
    classNum?: number;
    studentNum?: number;
    studentEmail?: string;
    needsBus?: boolean;
  },
  courseTuition: number,
  courseTextbookFee: number,
  courseMaterialFee: number,
  forceWaiting?: boolean,
  options?: { skipOpenCheck?: boolean }
): Promise<{ success: boolean; status: 'ENROLLED' | 'WAITING'; error?: string; errorCode?: AfterschoolEnrollErrorCode }> {
  const { isAfterschoolApplyOpen } = await import('@/lib/afterschool/enrollmentRules');
  const db = getDb();
  const enrollmentDocRef = doc(db, 'afterschool_enrollments', enrollmentId);
  const courseDocRef = doc(db, 'afterschool_courses', courseId);
  const timerDocRef = doc(getSettingsCol(), 'afterschoolTimer');

  // 사전 중복 검사: 고정 ID 도입 이전(관리자 수동 등록 등)에 만들어진 다른 ID의 신청 내역까지 확인
  try {
    const legacySnap = await getDocs(query(
      collection(db, 'afterschool_enrollments'),
      where('courseId', '==', courseId),
      where('studentId', '==', studentId)
    ));
    const hasActive = legacySnap.docs.some(d => d.id !== enrollmentId && String(d.data()?.status || '').toUpperCase() !== 'CANCELLED');
    if (hasActive) {
      return { success: false, status: 'WAITING', errorCode: 'DUPLICATE', error: '이미 신청(또는 대기 신청)된 강좌입니다.' };
    }
  } catch (e) {
    console.warn('[settingsService] 사전 중복 검사 실패 (트랜잭션 검사로 계속 진행):', e);
  }

  // Firestore SDK가 충돌 시 내부적으로 최대 5회 재시도하므로, 그 이후에도 충돌이 남은 경우에만 짧게 추가 재시도
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await runTransaction(db, async (transaction) => {
        // [읽기 단계] 강좌, 기존 신청, 신청 타이머
        const courseSnap = await transaction.get(courseDocRef);
        const existingSnap = await transaction.get(enrollmentDocRef);
        const timerSnap = options?.skipOpenCheck ? null : await transaction.get(timerDocRef);

        if (!courseSnap.exists()) {
          throw new AfterschoolEnrollError('NOT_FOUND', '존재하지 않는 강좌입니다.');
        }

        if (existingSnap.exists() && String(existingSnap.data()?.status || '').toUpperCase() !== 'CANCELLED') {
          throw new AfterschoolEnrollError('DUPLICATE', '이미 신청(또는 대기 신청)된 강좌입니다.');
        }

        if (!options?.skipOpenCheck) {
          let timerConfig: any = timerSnap?.exists() ? timerSnap.data() : null;
          if (!timerConfig) {
            const { initialTimerConfig } = await import('@/lib/afterschool/mock/data');
            timerConfig = initialTimerConfig;
          }
          // 이 클라이언트 경로는 관리자 도구(스트레스 테스트 등)용이며, 학생 신청은 서버 시각으로 판정하는 /api/afterschool/enroll을 사용한다
          if (!isAfterschoolApplyOpen(timerConfig, Date.now())) {
            throw new AfterschoolEnrollError('CLOSED', '현재 수강 신청 가능 시간이 아니거나 관리자에 의해 신청이 잠겨있습니다.');
          }
        }

        const courseData = courseSnap.data();
        const currentStudents = courseData.currentStudents || 0;
        const maxStudents = courseData.maxStudents || 0;
        const waitingStudents = courseData.waitingStudents || 0;

        const isFull = forceWaiting || (currentStudents >= maxStudents);
        const finalStatus: 'ENROLLED' | 'WAITING' = isFull ? 'WAITING' : 'ENROLLED';

        const newEnrollment = {
          id: enrollmentId,
          courseId,
          studentId,
          yearNo: 99,
          grade: studentProfile.grade || 1,
          classNum: studentProfile.classNum || 1,
          studentNum: studentProfile.studentNum || 1,
          studentEmail: studentProfile.studentEmail || '',
          needsBus: Boolean(studentProfile.needsBus),
          name: studentProfile.name,
          phone: studentProfile.phone,
          parentPhone: studentProfile.parentPhone,
          kisbusNo: studentProfile.kisbusNo || '-',
          tuition: courseTuition,
          textbookFee: isFull ? 0 : courseTextbookFee,
          materialFee: isFull ? 0 : courseMaterialFee,
          registrationDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
          status: finalStatus,
          timestampMs: Date.now(),
        };

        // [쓰기 단계] 1. 수강신청 문서 등록
        transaction.set(enrollmentDocRef, cleanUndefined(newEnrollment));

        // [쓰기 단계] 2. 카운트 안전 업데이트
        if (!isFull) {
          transaction.update(courseDocRef, { currentStudents: currentStudents + 1 });
        } else {
          transaction.update(courseDocRef, { waitingStudents: waitingStudents + 1 });
        }

        return { success: true, status: finalStatus };
      });

      return result;
    } catch (error: any) {
      if (error instanceof AfterschoolEnrollError) {
        return { success: false, status: 'WAITING', errorCode: error.enrollCode, error: error.message };
      }
      lastError = error;
      const isVersionConflict = error?.message?.includes('stored version') || error?.code === 'failed-precondition' || error?.code === 'aborted';
      if (!isVersionConflict) break;
      if (attempt < maxRetries) {
        // 동시성 충돌 시 무작위 Jitter 기반 백오프 지연 후 재시도
        const jitterDelay = Math.floor(Math.random() * 150) + 100 * attempt;
        await new Promise((res) => setTimeout(res, jitterDelay));
      }
    }
  }

  const isConflict = lastError?.code === 'failed-precondition' || lastError?.code === 'aborted';
  return {
    success: false,
    status: 'WAITING',
    errorCode: isConflict ? 'CONFLICT' : 'UNKNOWN',
    error: isConflict
      ? '신청이 몰려 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      : (lastError?.message || '알 수 없는 오류'),
  };
}

export async function saveAfterschoolCoursesBatch(courses: import('@/lib/afterschool/types').Course[]): Promise<{ success: boolean; error?: string }> {
  try {
    const batch = writeBatch(getDb());
    const colRef = collection(getDb(), 'afterschool_courses');
    courses.forEach((course) => {
      const docRef = doc(colRef, course.id);
      batch.set(docRef, cleanUndefined(course));
    });
    await batch.commit();
    return { success: true };
  } catch (e: any) {
    console.error("[saveAfterschoolCoursesBatch] Batch failed:", e);
    return { success: false, error: e.message };
  }
}

// ─── 방과후학교 교실 관리 (Firestore: afterschool_classrooms) ───────────────

export function onAfterschoolClassroomsUpdate(
  callback: (classrooms: import('@/lib/afterschool/types').Classroom[]) => void
): () => void {
  const colRef = collection(getDb(), 'afterschool_classrooms');
  return onSnapshot(colRef, (snap) => {
    if (snap.empty) {
      callback([]);
    } else {
      const list = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as any),
      } as import('@/lib/afterschool/types').Classroom));
      callback(list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko')));
    }
  });
}

export async function addAfterschoolClassroom(
  room: import('@/lib/afterschool/types').Classroom
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(collection(getDb(), 'afterschool_classrooms'), room.id);
    await setDoc(docRef, cleanUndefined(room));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateAfterschoolClassroom(
  id: string,
  data: Partial<import('@/lib/afterschool/types').Classroom>
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getDb(), 'afterschool_classrooms', id);
    await setDoc(docRef, cleanUndefined(data), { merge: true });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteAfterschoolClassroom(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(getDb(), 'afterschool_classrooms', id));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function saveAfterschoolClassroomsBatch(
  rooms: import('@/lib/afterschool/types').Classroom[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const batch = writeBatch(getDb());
    const colRef = collection(getDb(), 'afterschool_classrooms');
    rooms.forEach((room) => {
      const docRef = doc(colRef, room.id);
      batch.set(docRef, cleanUndefined(room));
    });
    await batch.commit();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── 학습준비물 신청 관리 (Firestore: afterschool_material_requests) ──────────

export function onMaterialRequestsUpdate(
  callback: (requests: import('@/lib/afterschool/types').MaterialRequest[]) => void
): () => void {
  const colRef = collection(getDb(), 'afterschool_material_requests');
  const q = query(colRef, orderBy('submittedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback([]);
    } else {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      } as import('@/lib/afterschool/types').MaterialRequest));
      callback(list);
    }
  });
}

export async function submitMaterialRequest(
  request: import('@/lib/afterschool/types').MaterialRequest
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getDb(), 'afterschool_material_requests', request.id);
    await setDoc(docRef, cleanUndefined(request));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateMaterialRequestStatus(
  requestId: string,
  status: 'APPROVED' | 'REJECTED',
  rejectReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getDb(), 'afterschool_material_requests', requestId);
    const updateData: any = {
      status,
      reviewedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    if (rejectReason) updateData.rejectReason = rejectReason;
    await setDoc(docRef, updateData, { merge: true });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteMaterialRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(getDb(), 'afterschool_material_requests', requestId));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// 학습준비물 예산 설정 (settings/materialBudgetSettings)
export async function getMaterialBudgetSettings(): Promise<{ totalBudget: number; maxPerCourse: number; currency: 'KRW' | 'VND' | 'USD' }> {
  try {
    const snap = await getDoc(doc(getSettingsCol(), 'materialBudgetSettings'));
    if (snap.exists()) {
      const data = snap.data();
      return {
        totalBudget: data.totalBudget ?? 500000,
        maxPerCourse: data.maxPerCourse ?? 50000,
        currency: data.currency || 'KRW',
      };
    }
    return { totalBudget: 500000, maxPerCourse: 50000, currency: 'KRW' };
  } catch {
    return { totalBudget: 500000, maxPerCourse: 50000, currency: 'KRW' };
  }
}

export async function saveMaterialBudgetSettings(
  settings: { totalBudget: number; maxPerCourse: number; currency?: 'KRW' | 'VND' | 'USD' }
): Promise<{ success: boolean; error?: string }> {
  try {
    await setDoc(doc(getSettingsCol(), 'materialBudgetSettings'), settings);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── 지출증빙서류 관리 (Firestore: afterschool_expense_proofs) ────────────────

export async function submitExpenseProof(proof: import('@/lib/afterschool/types').ExpenseProof): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanProof = cleanUndefined(proof);
    await setDoc(doc(getDb(), 'afterschool_expense_proofs', proof.id), cleanProof);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function onExpenseProofsUpdate(
  callback: (proofs: import('@/lib/afterschool/types').ExpenseProof[]) => void
): () => void {
  const colRef = collection(getDb(), 'afterschool_expense_proofs');
  const q = query(colRef, orderBy('submittedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback([]);
    } else {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      } as import('@/lib/afterschool/types').ExpenseProof));
      callback(list);
    }
  });
}

export async function deleteExpenseProof(proofId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(getDb(), 'afterschool_expense_proofs', proofId));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateExpenseProofStatus(
  proofId: string,
  status: 'APPROVED' | 'REJECTED'
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(getDb(), 'afterschool_expense_proofs', proofId), {
      status,
      reviewedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── 서류 제출 독촉 알림 (Firestore: afterschool_reminders) ───────────────────

export async function sendSubmissionReminder(
  reminder: import('@/lib/afterschool/types').SubmissionReminder
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanData = cleanUndefined(reminder);
    await setDoc(doc(getDb(), 'afterschool_reminders', reminder.id), cleanData);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function onTeacherRemindersUpdate(
  instructorName: string,
  callback: (reminders: import('@/lib/afterschool/types').SubmissionReminder[]) => void
): () => void {
  const colRef = collection(getDb(), 'afterschool_reminders');
  const q = query(colRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback([]);
    } else {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) } as import('@/lib/afterschool/types').SubmissionReminder))
        .filter((r) => !instructorName || !r.instructorName || r.instructorName === instructorName || instructorName.includes(r.instructorName) || r.instructorName.includes(instructorName));
      callback(list);
    }
  });
}

export async function markReminderAsRead(reminderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(getDb(), 'afterschool_reminders', reminderId), { isRead: true });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── 방과후 출석부 Firestore 저장/조회 ───────────────────────────────────────

export function onAttendanceRecordsUpdate(
  callback: (records: import('@/lib/afterschool/types').AttendanceRecord[]) => void
): () => void {
  const colRef = collection(getDb(), 'afterschool_attendance');
  return onSnapshot(colRef, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as import('@/lib/afterschool/types').AttendanceRecord));
    callback(list);
  }, (err) => {
    console.warn('[AttendanceService] onAttendanceRecordsUpdate error:', err);
    callback([]);
  });
}

export async function saveAttendanceRecordsBatch(
  toUpsert: import('@/lib/afterschool/types').AttendanceRecord[],
  toDeleteIds: string[] = []
): Promise<void> {
  const batch = writeBatch(getDb());
  toUpsert.forEach(record => {
    const docRef = doc(getDb(), 'afterschool_attendance', record.id);
    batch.set(docRef, cleanUndefined(record), { merge: true });
  });
  toDeleteIds.forEach(id => {
    const docRef = doc(getDb(), 'afterschool_attendance', id);
    batch.delete(docRef);
  });
  await batch.commit();
}

// ─── 방과후 결강/보결 등록 (Firestore: afterschool_substitutes) ─────────────

export function onSubstituteRecordsUpdate(
  callback: (records: import('@/lib/afterschool/types').SubstituteRecord[]) => void
): () => void {
  const colRef = collection(getDb(), 'afterschool_substitutes');
  return onSnapshot(colRef, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as import('@/lib/afterschool/types').SubstituteRecord));
    callback(list);
  }, (err) => {
    console.warn('[SubstituteService] onSubstituteRecordsUpdate error:', err);
    callback([]);
  });
}

export async function saveSubstituteRecord(
  record: import('@/lib/afterschool/types').SubstituteRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getDb(), 'afterschool_substitutes', record.id);
    await setDoc(docRef, cleanUndefined(record), { merge: true });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteSubstituteRecord(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getDb(), 'afterschool_substitutes', id);
    await deleteDoc(docRef);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * 방과후학교 운영 종료 시 출석부, 지출증빙, 준비물신청, 독촉알림 등
 * 실시간 운영 컬렉션을 초기화 및 정리합니다 (결재 문서 공문은 유지).
 */
export async function purgeAfterschoolOperationalData(): Promise<{ success: boolean; error?: string }> {
  try {
    const collectionsToPurge = [
      'afterschool_attendance',
      'afterschool_expense_proofs',
      'afterschool_material_requests',
      'afterschool_reminders',
    ];
    for (const colName of collectionsToPurge) {
      const snap = await getDocs(collection(getDb(), colName));
      if (!snap.empty) {
        const batchList: Promise<void>[] = [];
        snap.docs.forEach((d: QueryDocumentSnapshot) => {
          batchList.push(deleteDoc(d.ref));
        });
        await Promise.all(batchList);
      }
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── 결재 상신 서류 (SubmittedApprovalDoc: afterschool_approval_docs) ───────

export function onAfterschoolApprovalDocsUpdate(
  callback: (docs: import('@/lib/afterschool/types').SubmittedApprovalDoc[]) => void
): () => void {
  const colRef = collection(getDb(), 'afterschool_approval_docs');
  return onSnapshot(colRef, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as import('@/lib/afterschool/types').SubmittedApprovalDoc));
    callback(list);
  }, (err) => {
    console.warn('[ApprovalDocService] onAfterschoolApprovalDocsUpdate error:', err);
    callback([]);
  });
}

export async function submitAfterschoolApprovalDoc(
  docItem: import('@/lib/afterschool/types').SubmittedApprovalDoc
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getDb(), 'afterschool_approval_docs', docItem.id);
    await setDoc(docRef, cleanUndefined(docItem), { merge: true });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateAfterschoolApprovalDocStatus(
  id: string,
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getDb(), 'afterschool_approval_docs', id);
    await updateDoc(docRef, { status });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteAfterschoolApprovalDoc(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(getDb(), 'afterschool_approval_docs', id));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── 환불 내역 관리 (RefundRequest / RefundRecord: afterschool_refunds) ──────

export function onAfterschoolRefundsUpdate(
  callback: (refunds: import('@/lib/afterschool/types').RefundRecord[]) => void
): () => void {
  const colRef = collection(getDb(), 'afterschool_refunds');
  return onSnapshot(colRef, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as import('@/lib/afterschool/types').RefundRecord));
    callback(list);
  }, (err) => {
    console.warn('[RefundService] onAfterschoolRefundsUpdate error:', err);
    callback([]);
  });
}

export async function submitAfterschoolRefund(
  refundItem: import('@/lib/afterschool/types').RefundRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getDb(), 'afterschool_refunds', refundItem.id);
    await setDoc(docRef, cleanUndefined(refundItem), { merge: true });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── 개인정보처리방침 Firestore 관리 ────────────────────────────────────────

export interface PrivacyPolicyMeta {
  effectiveDate: string;      // 시행일 (예: '2026년 3월 1일')
  lastUpdated: string;        // 최종 개정일 (예: '2026년 8월 14일')
  version: string;            // 버전 (예: 'v2.1')
  changeLog: Array<{
    date: string;
    description: string;
  }>;
  customSections?: Record<string, string>; // 향후 섹션별 커스터마이징 지원
  updatedBy?: string;
  updatedAt?: string;
}

const PRIVACY_POLICY_DOC = 'privacyPolicy';

export async function getPrivacyPolicy(): Promise<PrivacyPolicyMeta | null> {
  try {
    const snap = await getDoc(doc(getSettingsCol(), PRIVACY_POLICY_DOC));
    return snap.exists() ? (snap.data() as PrivacyPolicyMeta) : null;
  } catch (e) {
    console.error('[SettingsService] getPrivacyPolicy error:', e);
    return null;
  }
}

export function onPrivacyPolicyUpdate(callback: (policy: PrivacyPolicyMeta | null) => void): () => void {
  return onSnapshot(doc(getSettingsCol(), PRIVACY_POLICY_DOC), (snap) => {
    callback(snap.exists() ? (snap.data() as PrivacyPolicyMeta) : null);
  }, (err) => {
    console.error('[SettingsService] onPrivacyPolicyUpdate error:', err);
    callback(null);
  });
}

export async function savePrivacyPolicy(
  payload: PrivacyPolicyMeta,
  updaterEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const data = cleanUndefined({
      ...payload,
      updatedBy: updaterEmail || '관리자',
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(getSettingsCol(), PRIVACY_POLICY_DOC), data, { merge: true });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── Google Drive 중앙 저장소 설정 ─────────────────────────────────────
const GOOGLE_DRIVE_DOC = 'googleDriveConfig';

export const DEFAULT_GOOGLE_DRIVE_CONFIG: import('@/lib/types').GoogleDriveConfig = {
  enabled: false,
  rootFolderId: '',
  rootFolderUrl: '',
  sharedDriveName: 'KIS_학교행정_중앙저장소'
};

export async function getGoogleDriveConfig(): Promise<import('@/lib/types').GoogleDriveConfig> {
  try {
    const snap = await getDoc(doc(getSettingsCol(), GOOGLE_DRIVE_DOC));
    if (snap.exists()) {
      return { ...DEFAULT_GOOGLE_DRIVE_CONFIG, ...(snap.data() as import('@/lib/types').GoogleDriveConfig) };
    }
    return DEFAULT_GOOGLE_DRIVE_CONFIG;
  } catch (e) {
    console.error('[SettingsService] getGoogleDriveConfig error:', e);
    return DEFAULT_GOOGLE_DRIVE_CONFIG;
  }
}

export function onGoogleDriveConfigUpdate(callback: (config: import('@/lib/types').GoogleDriveConfig) => void): () => void {
  return onSnapshot(doc(getSettingsCol(), GOOGLE_DRIVE_DOC), (snap) => {
    if (snap.exists()) {
      callback({ ...DEFAULT_GOOGLE_DRIVE_CONFIG, ...(snap.data() as import('@/lib/types').GoogleDriveConfig) });
    } else {
      callback(DEFAULT_GOOGLE_DRIVE_CONFIG);
    }
  }, (err) => {
    console.warn('[SettingsService] onGoogleDriveConfigUpdate fallback:', err);
    callback(DEFAULT_GOOGLE_DRIVE_CONFIG);
  });
}

export async function saveGoogleDriveConfig(
  payload: Partial<import('@/lib/types').GoogleDriveConfig>,
  updaterEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const data = cleanUndefined({
      ...payload,
      updatedBy: updaterEmail || '관리자',
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(getSettingsCol(), GOOGLE_DRIVE_DOC), data, { merge: true });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}



