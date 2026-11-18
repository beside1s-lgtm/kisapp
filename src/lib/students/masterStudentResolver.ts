import { collection, getDocs } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import {
  buildMasterStudentIndex,
  resolveMasterStudentId,
  type MasterStudentIndex,
  type StudentHint,
} from './masterStudentKey';
import { overlayMasterProfile } from './studentProfileSync';

/**
 * 브라우저용 공통 학생 키 조회기.
 * master_students 전체를 짧게 캐시해 두고 단서(이메일·이름·학년·반·번호)로 masterStudentId를 찾는다.
 */

const CACHE_TTL_MS = 60_000;
let cache: { at: number; index: MasterStudentIndex } | null = null;
let inflight: Promise<MasterStudentIndex> | null = null;

export async function getMasterStudentIndex(force = false): Promise<MasterStudentIndex> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.index;
  if (inflight) return inflight;
  inflight = (async () => {
    const snap = await getDocs(collection(getDb(), 'master_students'));
    const index = buildMasterStudentIndex(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    cache = { at: Date.now(), index };
    return index;
  })().finally(() => { inflight = null; });
  return inflight;
}

/** 통합학생계정을 고친 직후 다음 조회가 최신 값을 읽도록 캐시를 비운다 */
export function invalidateMasterStudentIndex(): void {
  cache = null;
}

/**
 * 통합학생계정 한 명을 고친 직후 캐시의 그 학생만 새 값으로 바꾼다.
 * (일괄 수정 중 매번 전체를 다시 읽지 않도록 메모리에서 색인만 다시 만든다)
 */
export function updateCachedMasterStudent(id: string, data: Record<string, any>): void {
  if (!cache) return;
  const list = Array.from(cache.index.byId.values()).filter((m) => m.id !== id);
  list.push({ ...(cache.index.byId.get(id) || {}), ...data, id } as any);
  cache = { at: cache.at, index: buildMasterStudentIndex(list) };
}

/** 단서로 masterStudentId를 찾는다. 한 명으로 특정되지 않거나 조회 실패 시 '' */
export async function findMasterStudentId(hint: StudentHint): Promise<string> {
  try {
    const index = await getMasterStudentIndex();
    const res = resolveMasterStudentId(hint, index);
    return res.id || '';
  } catch (err) {
    console.warn('[masterStudentResolver] 통합학생 ID 조회 실패:', err);
    return '';
  }
}

/** 방과후 수강 문서에 masterStudentId가 없으면 채워서 돌려준다 */
export async function withEnrollmentMasterKey<T extends Record<string, any>>(enrollment: T): Promise<T> {
  if (enrollment?.masterStudentId) return enrollment;
  const id = await findMasterStudentId({
    email: enrollment.studentEmail || (String(enrollment.studentId || '').includes('@') ? enrollment.studentId : ''),
    name: enrollment.name || enrollment.studentName,
    grade: enrollment.grade,
    classNum: enrollment.classNum,
    studentNum: enrollment.studentNum,
  });
  return id ? { ...enrollment, masterStudentId: id } : enrollment;
}

/**
 * 화면 표시용: 키가 있는 방과후 수강 목록에 통합학생계정의 최신 이름·학년·반·번호를 덧씌운다.
 * 반영이 늦거나 실패한 복사본이 있어도 화면은 항상 통합학생계정 값을 보여 준다.
 */
export async function overlayEnrollmentsWithMaster<T extends Record<string, any>>(list: T[]): Promise<T[]> {
  if (!list.some((e) => e?.masterStudentId)) return list;
  try {
    let index = await getMasterStudentIndex();
    const differs = (idx: MasterStudentIndex) =>
      list.some((e) => e?.masterStudentId && overlayMasterProfile(e, idx.byId.get(e.masterStudentId) as any) !== e);
    // 다른 화면에서 방금 고친 값이 캐시보다 새로울 수 있으므로, 차이가 보이면 5초 이상 된 캐시는 새로 읽는다
    if (differs(index) && cache && Date.now() - cache.at > 5_000) index = await getMasterStudentIndex(true);
    return list.map((e) => (e?.masterStudentId ? overlayMasterProfile(e, index.byId.get(e.masterStudentId) as any) : e));
  } catch (err) {
    console.warn('[masterStudentResolver] 통합학생 정보 표시 실패:', err);
    return list;
  }
}
