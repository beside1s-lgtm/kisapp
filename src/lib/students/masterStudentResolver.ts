import { collection, getDocs } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import {
  buildMasterStudentIndex,
  resolveMasterStudentId,
  type MasterStudentIndex,
  type StudentHint,
} from './masterStudentKey';

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
