/**
 * 통합학생계정 중심 학생 정보 관리 — Firestore 연동부
 *
 * updateMasterStudent(masterStudentService)가 학생 정보 수정의 단일 창구이며,
 * 저장 후 이 모듈의 함수로 방과후 수강·학부모 자녀 정보에 내려보내고 변경 이력을 남긴다.
 * (학생 계정 users, 스쿨버스, 체육 기록 성별은 updateMasterStudent 안에서 함께 처리)
 */
import { addDoc, collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { auth, getDb } from '@/lib/firebase';
import { getMasterStudentIndex, updateCachedMasterStudent } from './masterStudentResolver';
import { resolveMasterStudentId } from './masterStudentKey';
import {
  buildEnrollmentProfilePatch,
  buildParentProfilePatch,
  collectParentMasterIds,
  type FieldChange,
  type MasterProfile,
  type StudentChangeOptions,
} from './studentProfileSync';

const BATCH_LIMIT = 400;

async function commitInChunks(updates: { path: [string, string]; data: Record<string, any> }[]): Promise<void> {
  const db = getDb();
  for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    updates.slice(i, i + BATCH_LIMIT).forEach((u) => batch.update(doc(db, u.path[0], u.path[1]), u.data));
    await batch.commit();
  }
}

/**
 * 방과후 수강 문서를 통합학생계정 값에 맞춘다.
 * 현재 개설된 강좌(afterschool_courses에 남아 있는 강좌)의 수강 기록만 고치고, 지난 강좌 기록은 당시 값으로 둔다.
 */
export async function propagateToAfterschool(masterId: string, master: MasterProfile): Promise<number> {
  const db = getDb();
  const [enrollSnap, courseSnap] = await Promise.all([
    getDocs(query(collection(db, 'afterschool_enrollments'), where('masterStudentId', '==', masterId))),
    getDocs(collection(db, 'afterschool_courses')),
  ]);
  if (enrollSnap.empty) return 0;
  const liveCourses = new Set(courseSnap.docs.map((d) => d.id));
  const updates = enrollSnap.docs
    .filter((d) => liveCourses.has(String(d.data().courseId || '')))
    .map((d) => ({ id: d.id, patch: buildEnrollmentProfilePatch(d.data(), { ...master, id: masterId }) }))
    .filter((u): u is { id: string; patch: Record<string, any> } => Boolean(u.patch))
    .map((u) => ({ path: ['afterschool_enrollments', u.id] as [string, string], data: u.patch }));
  await commitInChunks(updates);
  return updates.length;
}

/** 이 학생을 자녀로 연결한 학부모 계정의 자녀 정보(대표 자녀·형제자매)를 통합학생계정 값에 맞춘다. */
export async function propagateToParents(masterId: string, master: MasterProfile): Promise<number> {
  const db = getDb();
  const usersCol = collection(db, 'users');
  const [byPrimary, byLinked] = await Promise.all([
    getDocs(query(usersCol, where('masterStudentId', '==', masterId))),
    getDocs(query(usersCol, where('linkedMasterStudentIds', 'array-contains', masterId))),
  ]);
  const seen = new Map<string, Record<string, any>>();
  [...byPrimary.docs, ...byLinked.docs].forEach((d) => seen.set(d.id, d.data()));
  const updates: { path: [string, string]; data: Record<string, any> }[] = [];
  seen.forEach((data, id) => {
    const patch = buildParentProfilePatch(data, masterId, master);
    if (patch) updates.push({ path: ['users', id], data: patch });
  });
  await commitInChunks(updates);
  return updates.length;
}

/** 변경 이력: master_students/{id}/history */
export async function recordStudentChange(masterId: string, changes: FieldChange[], opts: StudentChangeOptions = {}): Promise<void> {
  if (!changes.length) return;
  try {
    await addDoc(collection(getDb(), 'master_students', masterId, 'history'), {
      at: new Date().toISOString(),
      source: opts.source || 'system',
      actor: opts.actor || auth?.currentUser?.email || '',
      changes,
      ...(opts.note ? { note: opts.note } : {}),
    });
  } catch (err) {
    console.warn('[studentRegistry] 변경 이력 저장 실패:', err);
  }
}

/** 통합학생계정 저장 직후 호출: 복사본에 내려보내고 캐시의 그 학생 값을 갱신한다. 실패해도 원본 저장은 유지된다. */
export async function propagateMasterStudentProfile(masterId: string, master: MasterProfile): Promise<{ enrollments: number; parents: number }> {
  updateCachedMasterStudent(masterId, master as Record<string, any>);
  const [enrollments, parents] = await Promise.all([
    propagateToAfterschool(masterId, master).catch((err) => {
      console.warn('[studentRegistry] 방과후 수강 정보 반영 실패:', err);
      return 0;
    }),
    propagateToParents(masterId, master).catch((err) => {
      console.warn('[studentRegistry] 학부모 자녀 정보 반영 실패:', err);
      return 0;
    }),
  ]);
  return { enrollments, parents };
}

/**
 * 학부모·학생 프로필 저장 전: 자녀 정보로 공통 학생 키를 찾아 채우고, 검색용 linkedMasterStudentIds를 만든다.
 * 자녀 정보가 없는 저장(로그인 갱신 등)은 그대로 돌려준다.
 */
export async function withParentMasterKeys<T extends Record<string, any>>(profile: T): Promise<T> {
  const hasPrimary = Boolean(String(profile.studentName || '').trim());
  const linked: any[] | null = Array.isArray(profile.linkedStudents) ? profile.linkedStudents : null;
  if (!hasPrimary && !linked) return profile;
  try {
    const index = await getMasterStudentIndex();
    const find = (hint: Parameters<typeof resolveMasterStudentId>[0]) => resolveMasterStudentId(hint, index).id || '';
    const next: Record<string, any> = { ...profile };
    if (hasPrimary && !profile.masterStudentId) {
      const id = find({ name: profile.studentName, grade: profile.studentGrade, classNum: profile.studentClass, studentNum: profile.studentNumber });
      if (id) next.masterStudentId = id;
    }
    if (linked) {
      next.linkedStudents = linked.map((s) =>
        s && !s.masterStudentId
          ? { ...s, masterStudentId: find({ name: s.nameKo, grade: s.grade, classNum: s.studentClass, studentNum: s.studentNumber }) }
          : s
      );
    }
    // 형제자매 목록을 함께 저장할 때만 검색용 배열을 갱신 (대표 자녀만 저장할 때 기존 형제 키를 지우지 않도록)
    if (linked) next.linkedMasterStudentIds = collectParentMasterIds(next);
    return next as T;
  } catch (err) {
    console.warn('[studentRegistry] 자녀 공통 학생 키 확인 실패:', err);
    return profile;
  }
}
