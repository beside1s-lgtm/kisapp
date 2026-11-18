/**
 * 공통 학생 키 (masterStudentId)
 *
 * - 통합학생계정(master_students) 문서 ID를 모든 모듈의 공통 학생 키로 쓴다.
 *   방과후 수강(afterschool_enrollments), 학급 출결(homeroom_daily_attendance),
 *   결석계·체험학습(approvals.parentFormData), 학부모 계정(users.masterStudentId / linkedStudents[].masterStudentId),
 *   스쿨버스 학생(kisbus students) 문서에 `masterStudentId` 필드로 저장한다.
 * - 이메일(studentEmail)은 보조 키. 이름·학년·반·번호는 화면 표시용이며,
 *   키가 없는 옛 데이터에서만 "한 명으로 확실히 특정될 때" 연결 근거로 쓴다.
 *
 * 이 파일은 Firebase에 의존하지 않는 순수 로직이라 브라우저·서버·관리 스크립트에서 함께 쓴다.
 */

export const MASTER_STUDENT_KEY_FIELD = 'masterStudentId' as const;

export interface MasterStudentLite {
  id: string;
  name?: string | null;
  nameKo?: string | null;
  nameEn?: string | null;
  grade?: string | number | null;
  classNum?: string | number | null;
  studentNum?: string | number | null;
  studentEmail?: string | null;
}

/** 학생을 가리키는 단서 (있는 것만 채움) */
export interface StudentHint {
  masterStudentId?: string | null;
  email?: string | null;
  name?: string | null;
  grade?: string | number | null;
  classNum?: string | number | null;
  studentNum?: string | number | null;
}

export type ResolveResult =
  | { id: string; via: 'id' | 'email' | 'identity' }
  | { id: null; reason: 'none' | 'ambiguous' | 'conflict'; candidates: string[] };

export const normalizeStudentName = (v: unknown) => String(v ?? '').replace(/\s+/g, '').toLowerCase();
export const normalizeEmail = (v: unknown) => String(v ?? '').trim().toLowerCase();
/** "05" → "5", "" → "" (숫자가 아니면 trim 원문) */
export const normalizeNum = (v: unknown) => {
  const t = String(v ?? '').trim();
  if (!t) return '';
  const n = Number(t);
  return Number.isFinite(n) ? String(n) : t;
};

/** 이름·학년이 없는 빈 문서(자동 복구로 생긴 껍데기)는 연결 대상에서 제외 */
export const isRealMasterStudent = (m: MasterStudentLite | null | undefined) =>
  Boolean(m && normalizeStudentName(m.name || m.nameKo) && normalizeNum(m.grade));

export interface MasterStudentIndex {
  byId: Map<string, MasterStudentLite>;
  byEmail: Map<string, MasterStudentLite[]>;
  byNameGradeClass: Map<string, MasterStudentLite[]>;
}

const ngcKey = (name: unknown, grade: unknown, classNum: unknown) =>
  `${normalizeStudentName(name)}|${normalizeNum(grade)}|${normalizeNum(classNum)}`;

export function buildMasterStudentIndex(masters: MasterStudentLite[]): MasterStudentIndex {
  const byId = new Map<string, MasterStudentLite>();
  const byEmail = new Map<string, MasterStudentLite[]>();
  const byNameGradeClass = new Map<string, MasterStudentLite[]>();
  const push = (map: Map<string, MasterStudentLite[]>, key: string, m: MasterStudentLite) => {
    const list = map.get(key);
    if (list) { if (!list.some(x => x.id === m.id)) list.push(m); } else map.set(key, [m]);
  };
  masters.filter(isRealMasterStudent).forEach(m => {
    byId.set(m.id, m);
    const e = normalizeEmail(m.studentEmail);
    if (e) push(byEmail, e, m);
    push(byNameGradeClass, ngcKey(m.name, m.grade, m.classNum), m);
    if (m.nameKo && normalizeStudentName(m.nameKo) !== normalizeStudentName(m.name)) {
      push(byNameGradeClass, ngcKey(m.nameKo, m.grade, m.classNum), m);
    }
  });
  return { byId, byEmail, byNameGradeClass };
}

/**
 * 이메일 등으로 찾은 학생이 단서에 적힌 이름·학년·반과 어긋나는지.
 * (번호는 학기 중 바뀌는 일이 있어 비교하지 않는다)
 */
function conflictsWithHint(m: MasterStudentLite, hint: StudentHint): boolean {
  const hn = normalizeStudentName(hint.name);
  if (hn && hn !== normalizeStudentName(m.name) && hn !== normalizeStudentName(m.nameKo)) return true;
  if (normalizeNum(hint.grade) && normalizeNum(hint.grade) !== normalizeNum(m.grade)) return true;
  if (normalizeNum(hint.classNum) && normalizeNum(hint.classNum) !== normalizeNum(m.classNum)) return true;
  return false;
}

/**
 * 단서로 통합학생 ID를 찾는다. 한 명으로 확실히 특정될 때만 ID를 돌려준다.
 * ① masterStudentId가 실제 학생 문서면 그대로
 * ② 이메일이 한 명과 일치하고, 단서의 이름·학년·반과도 어긋나지 않을 때
 *    (다른 모듈에 복사된 이메일이 같은 이름의 다른 학생 것으로 잘못 들어간 경우가 있어,
 *     어긋나면 이메일을 믿지 않고 ③으로 판정)
 * ③ 이름+학년+반(+번호)이 한 명과 일치
 */
export function resolveMasterStudentId(hint: StudentHint, index: MasterStudentIndex): ResolveResult {
  const directId = String(hint.masterStudentId || '').trim();
  if (directId && index.byId.has(directId)) return { id: directId, via: 'id' };

  let emailConflict: string[] = [];
  const email = normalizeEmail(hint.email);
  if (email && email.includes('@')) {
    const hits = (index.byEmail.get(email) || []).filter(m => {
      if (!conflictsWithHint(m, hint)) return true;
      emailConflict.push(m.id);
      return false;
    });
    if (hits.length === 1) return { id: hits[0].id, via: 'email' };
    if (hits.length > 1) {
      // 같은 이메일로 중복 등록된 학생: 번호까지 맞춰 한 명이 되면 그 학생
      const narrowed = narrowByIdentity(hits, hint);
      if (narrowed.length === 1) return { id: narrowed[0].id, via: 'email' };
      return { id: null, reason: 'ambiguous', candidates: hits.map(h => h.id) };
    }
  }

  if (!normalizeStudentName(hint.name) || !normalizeNum(hint.grade) || !normalizeNum(hint.classNum)) {
    return emailConflict.length
      ? { id: null, reason: 'conflict', candidates: emailConflict }
      : { id: null, reason: 'none', candidates: [] };
  }
  let hits = index.byNameGradeClass.get(ngcKey(hint.name, hint.grade, hint.classNum)) || [];
  if (hits.length > 1 && normalizeNum(hint.studentNum)) {
    hits = hits.filter(m => normalizeNum(m.studentNum) === normalizeNum(hint.studentNum));
  }
  if (hits.length === 1) return { id: hits[0].id, via: 'identity' };
  if (hits.length > 1) return { id: null, reason: 'ambiguous', candidates: hits.map(h => h.id) };
  if (emailConflict.length) return { id: null, reason: 'conflict', candidates: emailConflict };
  return { id: null, reason: 'none', candidates: [] };
}

function narrowByIdentity(list: MasterStudentLite[], hint: StudentHint) {
  let out = list;
  if (normalizeNum(hint.grade)) out = out.filter(m => normalizeNum(m.grade) === normalizeNum(hint.grade));
  if (normalizeNum(hint.classNum)) out = out.filter(m => normalizeNum(m.classNum) === normalizeNum(hint.classNum));
  if (out.length > 1 && normalizeNum(hint.studentNum)) out = out.filter(m => normalizeNum(m.studentNum) === normalizeNum(hint.studentNum));
  return out;
}

/** "6-6-1" / "6학년 6반 1번" → 학년·반·번호 */
export function parseGradeClassText(raw: unknown): { grade: string; classNum: string; studentNum: string } {
  const nums = String(raw ?? '').match(/\d+/g) || [];
  return { grade: normalizeNum(nums[0]), classNum: normalizeNum(nums[1]), studentNum: normalizeNum(nums[2]) };
}

/**
 * 레코드가 특정 통합학생의 것인지 판정 (조회용).
 * - 레코드에 masterStudentId가 있으면 그것만 비교한다 (이름이 같아도 다른 키면 다른 학생).
 * - 키가 없는 옛 레코드는 fallback 판정 함수에 맡긴다.
 */
export function recordBelongsToMaster(
  record: { masterStudentId?: string | null } | null | undefined,
  masterId: string,
  fallback: () => boolean
): boolean {
  const key = String(record?.masterStudentId || '').trim();
  if (key) return key === masterId;
  return fallback();
}
