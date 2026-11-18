/**
 * 교직원 정보 관리 — 시스템 설정(사용자 관리) 계정이 원본
 *
 * - 스쿨버스 교사(teachers / afterSchoolTeachers / saturdayTeachers)는 `email` 필드로 시스템 계정에 연결한다.
 * - 방과후 강좌는 강사 칸별로 `instructorEmails` { instructorName: 이메일, instructor2: 이메일 … }에 연결한다.
 * - 조직도(담임·학년부장·부서·업무 담당)는 처음부터 이메일로 저장한다.
 * - 화면에는 연결된 시스템 계정의 이름을 보여 주고, 시스템 설정에서 이름을 바꾸면 연결된 기록의 이름도 함께 바꾼다.
 * - 시스템 계정이 없는 외부 강사 등은 이름만 그대로 둔다(나중에 등록하면 자동 연결).
 */
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { getKisbusDb } from '@/lib/kisbus/firebase';
import type { UserProfile } from '@/lib/types';
import {
  buildTeacherIndex,
  normalizeTeacherEmail,
  normalizeTeacherName,
  resolveTeacher,
  type TeacherIndex,
  type TeacherLite,
} from './teacherKey';

export const BUS_TEACHER_COLLECTIONS = ['teachers', 'afterSchoolTeachers', 'saturdayTeachers'] as const;
export const COURSE_INSTRUCTOR_FIELDS = ['instructorName', 'instructor2', 'instructor3', 'instructor4', 'instructor5', 'instructor6'] as const;

const CACHE_TTL_MS = 60_000;
let cache: { at: number; index: TeacherIndex; list: TeacherLite[] } | null = null;
let inflight: Promise<TeacherIndex> | null = null;

/** 시스템 사용자 중 교직원만 추려 TeacherLite로 (교직원 판정은 userService.isFacultyMember) */
export function toFacultyList(
  users: Array<Partial<UserProfile> & { id?: string }>,
  isFaculty: (u: UserProfile) => boolean
): TeacherLite[] {
  return users
    .map((u) => ({ ...u, email: normalizeTeacherEmail(u.email || u.id) }) as UserProfile)
    .filter((u) => u.email && u.name && isFaculty(u))
    .map((u) => ({ email: u.email, name: u.name, nameEn: (u as any).nameEn || null, role: u.role || null, dept: u.dept || null }));
}

export async function getTeacherIndex(force = false): Promise<TeacherIndex> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.index;
  if (inflight) return inflight;
  inflight = (async () => {
    // userService ↔ settingsService ↔ 이 모듈의 순환 참조를 피하려고 필요할 때 불러온다
    const [{ isFacultyMember }, snap] = await Promise.all([
      import('@/lib/services/userService'),
      getDocs(collection(getDb(), 'users')),
    ]);
    const list = toFacultyList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })), isFacultyMember);
    const index = buildTeacherIndex(list);
    cache = { at: Date.now(), index, list };
    return index;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** 교직원 계정 저장 직후: 캐시의 그 사람만 새 값으로 */
export function updateCachedTeacher(t: TeacherLite): void {
  if (!cache) return;
  const email = normalizeTeacherEmail(t.email);
  const list = cache.list.filter((x) => x.email !== email);
  list.push({ ...(cache.index.byEmail.get(email) || {}), ...t, email });
  cache = { at: cache.at, index: buildTeacherIndex(list), list };
}

/** 이름(또는 이메일)으로 시스템 교직원 이메일을 찾는다. 한 명으로 특정되지 않으면 '' */
export async function findTeacherEmail(hint: { email?: unknown; name?: unknown }): Promise<string> {
  try {
    return resolveTeacher(hint, await getTeacherIndex()).email || '';
  } catch (err) {
    console.warn('[teacherRegistry] 교직원 조회 실패:', err);
    return '';
  }
}

/**
 * 스쿨버스 교사 문서 저장 전: 시스템 계정을 찾아 email을 채우고 이름을 시스템 이름으로 맞춘다.
 * 이름을 다른 사람으로 고친 경우 다시 찾고, 시스템 계정이 없으면 이메일 연결을 끊는다.
 */
export async function withBusTeacherAccount<T extends Record<string, any>>(data: T, previous?: Record<string, any> | null): Promise<T> {
  const nameChanged = data.name !== undefined && normalizeTeacherName(data.name) !== normalizeTeacherName(previous?.name);
  if (data.name === undefined && data.email === undefined) return data;
  try {
    const index = await getTeacherIndex();
    const hintEmail = data.email !== undefined ? data.email : nameChanged ? '' : previous?.email;
    const res = resolveTeacher({ email: hintEmail, name: data.name ?? previous?.name }, index);
    if (!res.email) return { ...data, ...(nameChanged || data.email !== undefined ? { email: null } : {}) };
    return { ...data, email: res.email, name: index.byEmail.get(res.email)?.name || data.name };
  } catch (err) {
    console.warn('[teacherRegistry] 버스 교사 계정 연결 실패:', err);
    return data;
  }
}

/** 화면 표시용: 연결된 교사는 시스템 이름으로 */
export async function overlayTeacherNames<T extends { email?: string | null; name?: string }>(list: T[]): Promise<T[]> {
  if (!list.some((t) => t?.email)) return list;
  try {
    const index = await getTeacherIndex();
    return list.map((t) => {
      const sys = t?.email ? index.byEmail.get(normalizeTeacherEmail(t.email)) : undefined;
      return sys?.name && sys.name !== t.name ? { ...t, name: sys.name } : t;
    });
  } catch {
    return list;
  }
}

/**
 * 방과후 강좌 저장 전: 강사 칸마다 시스템 계정을 찾아 instructorEmails에 기록하고 이름을 시스템 이름으로 맞춘다.
 * 부분 저장(merge)일 때는 넘어온 강사 칸만 다시 판정한다.
 */
export async function withCourseInstructorAccounts<T extends Record<string, any>>(course: T): Promise<T> {
  const fields = COURSE_INSTRUCTOR_FIELDS.filter((f) => course[f] !== undefined);
  if (!fields.length) return course;
  try {
    const index = await getTeacherIndex();
    const emails: Record<string, string> = { ...(course.instructorEmails || {}) };
    const next: Record<string, any> = { ...course };
    fields.forEach((f) => {
      const name = String(course[f] || '').trim();
      if (!name) {
        delete emails[f];
        return;
      }
      const prevEmail = emails[f];
      const prevSys = prevEmail ? index.byEmail.get(prevEmail) : undefined;
      // 이미 연결된 사람과 이름이 같으면 그대로, 아니면 이름으로 다시 찾는다
      const res = prevSys && normalizeTeacherName(prevSys.name) === normalizeTeacherName(name)
        ? { email: prevEmail }
        : resolveTeacher({ name }, index);
      if (res.email) {
        emails[f] = res.email;
        next[f] = index.byEmail.get(res.email)?.name || name;
      } else {
        delete emails[f];
      }
    });
    next.instructorEmails = emails;
    return next as T;
  } catch (err) {
    console.warn('[teacherRegistry] 방과후 강사 계정 연결 실패:', err);
    return course;
  }
}

/** 화면 표시용: 연결된 강사 칸은 시스템 이름으로 */
export async function overlayCourseInstructorNames<T extends Record<string, any>>(courses: T[]): Promise<T[]> {
  if (!courses.some((c) => c?.instructorEmails && Object.keys(c.instructorEmails).length)) return courses;
  try {
    const index = await getTeacherIndex();
    return courses.map((c) => {
      const emails = c?.instructorEmails || {};
      let changed = false;
      const next: Record<string, any> = { ...c };
      COURSE_INSTRUCTOR_FIELDS.forEach((f) => {
        const sys = emails[f] ? index.byEmail.get(emails[f]) : undefined;
        if (sys?.name && sys.name !== c[f]) {
          next[f] = sys.name;
          changed = true;
        }
      });
      return changed ? (next as T) : c;
    });
  } catch {
    return courses;
  }
}

/**
 * 시스템 설정에서 교직원 이름이 바뀐 뒤 호출: 연결된 스쿨버스 교사·방과후 강좌의 이름을 새 이름으로 바꾼다.
 * (조직도·업무는 이메일로만 저장하므로 고칠 것이 없다)
 */
export async function propagateTeacherProfile(email: string, name: string): Promise<{ bus: number; courses: number }> {
  const em = normalizeTeacherEmail(email);
  const newName = String(name || '').trim();
  if (!em || !newName) return { bus: 0, courses: 0 };
  updateCachedTeacher({ email: em, name: newName });
  let bus = 0;
  let courses = 0;
  try {
    const busDb = getKisbusDb();
    for (const col of BUS_TEACHER_COLLECTIONS) {
      const snap = await getDocs(query(collection(busDb, col), where('email', '==', em)));
      const targets = snap.docs.filter((d) => d.data().name !== newName);
      if (!targets.length) continue;
      const batch = writeBatch(busDb);
      targets.forEach((d) => batch.update(d.ref, { name: newName }));
      await batch.commit();
      bus += targets.length;
    }
  } catch (err) {
    console.warn('[teacherRegistry] 스쿨버스 교사 이름 반영 실패:', err);
  }
  try {
    const db = getDb();
    const snap = await getDocs(collection(db, 'afterschool_courses'));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      const c = d.data() as any;
      const patch: Record<string, string> = {};
      COURSE_INSTRUCTOR_FIELDS.forEach((f) => {
        if (c.instructorEmails?.[f] === em && c[f] !== newName) patch[f] = newName;
      });
      if (Object.keys(patch).length) {
        batch.update(d.ref, patch);
        courses++;
      }
    });
    if (courses) await batch.commit();
  } catch (err) {
    console.warn('[teacherRegistry] 방과후 강사 이름 반영 실패:', err);
  }
  return { bus, courses };
}
