import { getAdminDb, getAdminAuth } from '@/lib/server/firebaseAdmin';
import {
  buildAfterschoolEnrollmentId,
  getAfterschoolStudentIdentity,
  isAfterschoolApplyOpen,
} from '@/lib/afterschool/enrollmentRules';
import { shouldForceWaiting } from '@/lib/afterschool/waitingRules';
import { initialTimerConfig } from '@/lib/afterschool/mock/data';
import type { Course, Enrollment } from '@/lib/afterschool/types';
import { buildMasterStudentIndex, resolveMasterStudentId, type MasterStudentIndex } from '@/lib/students/masterStudentKey';

/** 서버용 통합학생계정 색인 (짧게 캐시) */
let masterIndexCache: { at: number; index: MasterStudentIndex } | null = null;
async function getServerMasterIndex(): Promise<MasterStudentIndex> {
  if (masterIndexCache && Date.now() - masterIndexCache.at < 60_000) return masterIndexCache.index;
  const snap = await getAdminDb().collection('master_students').get();
  const index = buildMasterStudentIndex(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  masterIndexCache = { at: Date.now(), index };
  return index;
}

/** 로그인 프로필(학생 본인 또는 학부모)로 공통 학생 키(masterStudentId)를 찾는다. 특정 불가 시 '' */
async function resolveCallerMasterStudentId(caller: AfterschoolCaller): Promise<string> {
  try {
    const p = caller.profile || {};
    const isStudent = p.role === 'student' || p.role === '학생';
    const res = resolveMasterStudentId({
      masterStudentId: p.masterStudentId,
      email: p.studentEmail || (isStudent ? caller.email : ''),
      name: p.studentName || (isStudent ? p.name : ''),
      grade: p.studentGrade || (isStudent ? p.grade : ''),
      classNum: p.studentClass || (isStudent ? p.class : ''),
      studentNum: p.studentNumber || (isStudent ? p.number : ''),
    }, await getServerMasterIndex());
    return res.id || '';
  } catch (err) {
    console.warn('[afterschoolEnrollment] 통합학생 ID 조회 실패 (신청은 계속):', err);
    return '';
  }
}

/**
 * 방과후 수강신청/취소 서버 처리 (Admin SDK)
 * - 로그인 확인: Firebase ID 토큰을 검증하고, 신청자 정보는 클라이언트 값이 아닌 users 프로필에서 만든다.
 * - 시각 판정: 학생 기기 시계가 아닌 서버 시각(Date.now())으로 개시/마감을 판정한다.
 * - 정원/대기/중복/동시간대 2순위 판정과 인원 카운터 갱신을 하나의 트랜잭션으로 처리한다.
 */

export type AfterschoolApiErrorCode =
  | 'LOGIN_REQUIRED' | 'NOT_STUDENT' | 'BAD_REQUEST'
  | 'DUPLICATE' | 'CLOSED' | 'COURSE_LOCKED' | 'NOT_FOUND' | 'FORBIDDEN' | 'UNKNOWN';

export class AfterschoolApiError extends Error {
  code: AfterschoolApiErrorCode;
  status: number;
  constructor(code: AfterschoolApiErrorCode, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const STUDENT_ROLES = ['학부모', '학생', 'parent', 'student'];

export interface AfterschoolCaller {
  email: string;
  profile: any;
}

/** 요청자 확인: Bearer 토큰 → users/{email} 프로필. 개발 서버에서만 우회 로그인 프로필 허용 */
export async function resolveAfterschoolCaller(
  authorizationHeader: string | null,
  devProfile?: any
): Promise<AfterschoolCaller> {
  const token = authorizationHeader?.startsWith('Bearer ') ? authorizationHeader.slice(7).trim() : '';

  let caller: AfterschoolCaller | null = null;
  if (token) {
    let email = '';
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      email = String(decoded.email || '').toLowerCase().trim();
    } catch {
      throw new AfterschoolApiError('LOGIN_REQUIRED', 401, '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.');
    }
    if (!email) throw new AfterschoolApiError('LOGIN_REQUIRED', 401, '로그인 계정의 이메일을 확인할 수 없습니다.');
    const snap = await getAdminDb().collection('users').doc(email).get();
    if (!snap.exists) throw new AfterschoolApiError('NOT_STUDENT', 403, '등록된 재학생(학부모) 계정만 신청할 수 있습니다.');
    caller = { email, profile: { ...(snap.data() || {}), email } };
  } else if (process.env.NODE_ENV === 'development' && devProfile && typeof devProfile === 'object') {
    // 로컬 개발 서버의 '학부모 세션 주입' 테스트 전용 (운영 빌드에서는 무시됨)
    caller = { email: String(devProfile.email || '').toLowerCase(), profile: devProfile };
  }

  if (!caller) {
    throw new AfterschoolApiError('LOGIN_REQUIRED', 401, '방과후학교 수강신청은 로그인한 재학생(학부모)만 할 수 있습니다.');
  }

  const role = String(caller.profile?.role || '');
  if (!STUDENT_ROLES.includes(role) && !caller.profile?.isAdmin) {
    throw new AfterschoolApiError('NOT_STUDENT', 403, '방과후학교 수강신청은 재학생(학부모) 계정으로만 할 수 있습니다.');
  }
  return caller;
}

/** StudentView의 '내 신청' 판별과 같은 기준으로 해당 학생의 신청인지 확인 */
function belongsToCaller(e: any, caller: AfterschoolCaller, masterStudentId = ''): boolean {
  // 공통 학생 키가 양쪽에 있으면 그것만으로 판정 (같은 반 동명이인 구분)
  if (masterStudentId && e.masterStudentId) return String(e.masterStudentId) === masterStudentId;
  const { matchIds, studentName } = getAfterschoolStudentIdentity(caller.profile);
  if (e.studentId && matchIds.includes(String(e.studentId))) return true;
  if (caller.email && e.studentEmail && String(e.studentEmail).toLowerCase() === caller.email) return true;
  if (studentName && e.name === studentName) {
    const p = caller.profile || {};
    if (p.studentGrade && String(e.grade) !== String(p.studentGrade)) return false;
    if (p.studentClass && String(e.classNum) !== String(p.studentClass)) return false;
    return true;
  }
  return false;
}

/** Firestore 문서 ID로 쓸 수 없는 값(빈 값, '/', '.', '..', __예약__) 차단 */
const isValidDocId = (id: string) => !!id && id.length <= 700 && !id.includes('/') && id !== '.' && id !== '..' && !/^__.*__$/.test(id);

const isActiveStatus = (status: any) => String(status || '').toUpperCase() !== 'CANCELLED';

/**
 * 서버 내 순번 대기열 (키별 직렬 실행)
 * - 같은 강좌로 동시에 몰린 요청을 서버 도착 순서대로 하나씩 처리한다 (실제 선착순 대기열).
 * - Admin SDK 트랜잭션은 잠금 방식이라, 한 강좌 문서에 수십~수백 건이 동시에 몰리면 잠금 대기 시간 초과로 실패한다.
 *   App Hosting 인스턴스가 1개(maxInstances: 1)이므로 프로세스 내 대기열로 경합 자체를 없앤다.
 *   (인스턴스를 늘려도 트랜잭션이 정합성을 보장하며, 경합 시 재시도로 처리된다)
 */
const serialQueues = new Map<string, Promise<unknown>>();
function runSerialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = serialQueues.get(key) || Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  const tail = next.catch(() => undefined);
  serialQueues.set(key, tail);
  tail.then(() => { if (serialQueues.get(key) === tail) serialQueues.delete(key); });
  return next;
}

/** 일시적 경합(ABORTED 등) 시 짧게 재시도 */
async function withContentionRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (err instanceof AfterschoolApiError) throw err;
      lastErr = err;
      const code = err?.code;
      const retriable = code === 10 || code === 4 || code === 'aborted' || /ABORTED|contention|lock timeout/i.test(String(err?.message || ''));
      if (!retriable || i === attempts - 1) break;
      await new Promise(r => setTimeout(r, 50 + Math.floor(Math.random() * 100) * (i + 1)));
    }
  }
  throw lastErr;
}

export async function enrollAfterschoolCourse(
  caller: AfterschoolCaller,
  input: { courseId: string; needsBus?: boolean },
  nowMs?: number
): Promise<{ status: 'ENROLLED' | 'WAITING'; enrollmentId: string; waitingReason?: string }> {
  const courseId = String(input.courseId || '').trim();
  if (!isValidDocId(courseId)) throw new AfterschoolApiError('BAD_REQUEST', 400, '강좌 정보가 올바르지 않습니다.');

  const db = getAdminDb();
  const profile = caller.profile || {};
  const identity = getAfterschoolStudentIdentity(profile);
  const enrollmentId = buildAfterschoolEnrollmentId(courseId, identity.studentId);

  const courseRef = db.collection('afterschool_courses').doc(courseId);
  const enrollRef = db.collection('afterschool_enrollments').doc(enrollmentId);
  const timerRef = db.collection('settings').doc('afterschoolTimer');
  const enrollCol = db.collection('afterschool_enrollments');

  // 같은 학생의 동시 요청(더블클릭·여러 강좌 동시 클릭)은 학생 단위로, 같은 강좌 요청은 강좌 단위로 순서대로 처리
  return runSerialized(`student:${identity.studentId}`, async () => {
    const masterStudentId = await resolveCallerMasterStudentId(caller);
    // 동시간대 판정용 전체 강좌 목록 / 학생 본인 신청 목록 (학생 단위 대기열 안이므로 트랜잭션 밖에서 읽어도 안전)
    const [coursesSnap, ...mineSnaps] = await Promise.all([
      db.collection('afterschool_courses').get(),
      enrollCol.where('studentId', 'in', identity.matchIds.slice(0, 30)).get(),
      ...(identity.studentName ? [enrollCol.where('name', '==', identity.studentName).get()] : []),
      ...(masterStudentId ? [enrollCol.where('masterStudentId', '==', masterStudentId).get()] : []),
    ]);
    const allCourses = coursesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Course));
    const myEnrollments = new Map<string, Enrollment>();
    mineSnaps.forEach(snap => snap.docs.forEach(d => {
      const data = { id: d.id, ...(d.data() as any) } as Enrollment;
      if (belongsToCaller(data, caller, masterStudentId) && isActiveStatus(data.status)) myEnrollments.set(d.id, data);
    }));
    const myList = Array.from(myEnrollments.values());
    if (myList.some(e => e.courseId === courseId)) {
      throw new AfterschoolApiError('DUPLICATE', 409, '이미 신청(또는 대기 신청)된 강좌입니다.');
    }

    return runSerialized(`course:${courseId}`, () => withContentionRetry(() => db.runTransaction(async (tx) => {
      // [읽기 단계] 강좌 / 고정 ID 신청 문서 / 신청 타이머
      const [courseSnap, existingSnap, timerSnap] = await Promise.all([tx.get(courseRef), tx.get(enrollRef), tx.get(timerRef)]);

      if (!courseSnap.exists) throw new AfterschoolApiError('NOT_FOUND', 404, '존재하지 않는 강좌입니다.');
      const course = { id: courseSnap.id, ...(courseSnap.data() as any) } as Course;

      // 서버 시각 기준 신청 기간/잠금 판정 (대기열에서 순서를 기다린 뒤 처리 시점 기준)
      const timerConfig = timerSnap.exists ? (timerSnap.data() as any) : initialTimerConfig;
      if (!isAfterschoolApplyOpen(timerConfig, nowMs ?? Date.now())) {
        throw new AfterschoolApiError('CLOSED', 409, '현재 수강 신청 가능 시간이 아니거나 관리자에 의해 신청이 잠겨있습니다.');
      }
      if (course.isForceLocked) {
        throw new AfterschoolApiError('COURSE_LOCKED', 409, '이 강좌는 관리자에 의해 신청이 잠겨 있습니다.');
      }
      if (existingSnap.exists && isActiveStatus(existingSnap.data()?.status)) {
        throw new AfterschoolApiError('DUPLICATE', 409, '이미 신청(또는 대기 신청)된 강좌입니다.');
      }

      const forceInfo = shouldForceWaiting(course, myList, allCourses);
      const currentStudents = course.currentStudents || 0;
      const maxStudents = course.maxStudents || 0;
      const waitingStudents = (course as any).waitingStudents || 0;
      const isFull = forceInfo.forceWaiting || currentStudents >= maxStudents;
      const finalStatus: 'ENROLLED' | 'WAITING' = isFull ? 'WAITING' : 'ENROLLED';
      const appliedAt = Date.now();

      const needsBus = course.hasBusOption ? Boolean(input.needsBus) : false;
      const newEnrollment: Record<string, any> = {
        id: enrollmentId,
        courseId,
        studentId: identity.studentId,
        ...(masterStudentId ? { masterStudentId } : {}),
        yearNo: 99,
        grade: Number(profile.studentGrade) || 1,
        classNum: Number(profile.studentClass) || 1,
        studentNum: Number(profile.studentNumber) || 1,
        studentEmail: profile.studentEmail || (profile.role === 'student' || profile.role === '학생' ? caller.email : '') || '',
        needsBus,
        name: identity.studentName || profile.name || '',
        phone: profile.parentPhone || '',
        parentPhone: profile.parentPhone || '',
        kisbusNo: needsBus ? '신청' : '-',
        tuition: course.tuition || 0,
        textbookFee: isFull ? 0 : (course.textbookFee || 0),
        materialFee: isFull ? 0 : (course.materialFee || 0),
        registrationDate: new Date(appliedAt).toISOString().replace('T', ' ').slice(0, 19),
        status: finalStatus,
        timestampMs: appliedAt,
        appliedVia: 'server',
        appliedByEmail: caller.email || '',
      };

      // [쓰기 단계]
      tx.set(enrollRef, newEnrollment);
      if (isFull) tx.update(courseRef, { waitingStudents: waitingStudents + 1 });
      else tx.update(courseRef, { currentStudents: currentStudents + 1 });

      return { status: finalStatus, enrollmentId, waitingReason: forceInfo.forceWaiting ? forceInfo.reason : undefined };
    })));
  });
}

export async function cancelAfterschoolCourse(
  caller: AfterschoolCaller,
  input: { enrollmentId: string }
): Promise<{ promotedStudentName?: string; promotedCourseTitle?: string; cancelled: any }> {
  const enrollmentId = String(input.enrollmentId || '').trim();
  if (!isValidDocId(enrollmentId)) throw new AfterschoolApiError('BAD_REQUEST', 400, '신청 정보가 올바르지 않습니다.');

  const db = getAdminDb();
  const enrollRef = db.collection('afterschool_enrollments').doc(enrollmentId);

  // 같은 강좌의 신청/취소와 같은 대기열에서 순서대로 처리 (동시 취소 시 대기자 중복 승격·잠금 충돌 방지)
  const preSnap = await enrollRef.get();
  if (!preSnap.exists) throw new AfterschoolApiError('NOT_FOUND', 404, '취소할 수강 신청 내역을 찾을 수 없습니다.');
  const queueCourseId = String(preSnap.data()?.courseId || '');

  return runSerialized(`course:${queueCourseId}`, () => withContentionRetry(() => db.runTransaction(async (tx) => {
    // [읽기 단계]
    const enrollSnap = await tx.get(enrollRef);
    if (!enrollSnap.exists) throw new AfterschoolApiError('NOT_FOUND', 404, '취소할 수강 신청 내역을 찾을 수 없습니다.');
    const cancelling = { id: enrollSnap.id, ...(enrollSnap.data() as any) } as Enrollment;
    if (!belongsToCaller(cancelling, caller) && !caller.profile?.isAdmin) {
      throw new AfterschoolApiError('FORBIDDEN', 403, '본인(자녀)의 신청만 취소할 수 있습니다.');
    }

    const courseRef = cancelling.courseId ? db.collection('afterschool_courses').doc(cancelling.courseId) : null;
    const courseSnap = courseRef ? await tx.get(courseRef) : null;

    let promote: { ref: FirebaseFirestore.DocumentReference; data: any } | null = null;
    if (courseSnap?.exists && cancelling.status === 'ENROLLED') {
      // Admin SDK 트랜잭션은 쿼리 읽기도 잠금 대상이므로 동시 취소 시 같은 대기자가 중복 승격되지 않는다
      const waitingSnap = await tx.get(
        db.collection('afterschool_enrollments')
          .where('courseId', '==', cancelling.courseId)
          .where('status', '==', 'WAITING')
      );
      const top = waitingSnap.docs
        .filter(d => d.id !== enrollmentId)
        .map(d => ({ ref: d.ref, data: d.data() as any }))
        .sort((a, b) => {
          const tA = a.data.timestampMs || new Date(a.data.registrationDate || 0).getTime();
          const tB = b.data.timestampMs || new Date(b.data.registrationDate || 0).getTime();
          return tA - tB;
        })[0];
      if (top) promote = top;
    }

    // [쓰기 단계]
    tx.delete(enrollRef);
    let promotedStudentName: string | undefined;
    let promotedCourseTitle: string | undefined;

    if (courseRef && courseSnap?.exists) {
      const courseData = courseSnap.data() as any;
      let cur = courseData.currentStudents || 0;
      let wait = courseData.waitingStudents || 0;
      if (cancelling.status === 'ENROLLED') {
        cur = Math.max(0, cur - 1);
        if (promote) {
          tx.update(promote.ref, { status: 'ENROLLED', promotedAt: new Date().toISOString() });
          cur += 1;
          wait = Math.max(0, wait - 1);
          promotedStudentName = promote.data.studentName || promote.data.name;
          promotedCourseTitle = courseData.title;
        }
      } else if (cancelling.status === 'WAITING') {
        wait = Math.max(0, wait - 1);
      }
      tx.update(courseRef, { currentStudents: cur, waitingStudents: wait });
    }

    return { promotedStudentName, promotedCourseTitle, cancelled: cancelling };
  })));
}
