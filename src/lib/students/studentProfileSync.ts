/**
 * 통합학생계정(master_students) 중심 학생 정보 관리 — 순수 로직
 *
 * 원칙
 * - 학생 신상 정보(아래 REGISTRY_FIELDS)의 원본은 통합학생계정 하나뿐이다.
 * - 방과후·스쿨버스·담임·체육·건강·학부모 등 어느 기능에서 바꾸든 통합학생계정에 먼저 저장하고,
 *   통합학생계정이 복사본(학생 계정, 학부모 자녀 정보, 방과후 수강, 스쿨버스, 체육 기록)에 다시 내려보낸다.
 * - 과거 기록(지난 출결, 승인된 결석계·체험학습, 이전 학년 측정 기록)은 당시 값을 그대로 두고 공통 학생 키로만 연결한다.
 */

export const REGISTRY_FIELDS = [
  'name',
  'nameEn',
  'grade',
  'classNum',
  'studentNum',
  'gender',
  'studentEmail',
  'contact',
  'address',
  'photoUrl',
] as const;

export type RegistryField = (typeof REGISTRY_FIELDS)[number];

export const REGISTRY_FIELD_LABELS: Record<RegistryField, string> = {
  name: '이름',
  nameEn: '영문 이름',
  grade: '학년',
  classNum: '반',
  studentNum: '번호',
  gender: '성별',
  studentEmail: '이메일',
  contact: '연락처',
  address: '주소·목적지',
  photoUrl: '사진',
};

/** 변경 출처: 어느 기능에서 바꿨는지 */
export type StudentChangeSource =
  | 'admin-students'
  | 'homeroom'
  | 'settings'
  | 'photo'
  | 'bus'
  | 'afterschool'
  | 'promotion'
  | 'parent'
  | 'system';

export interface StudentChangeOptions {
  source?: StudentChangeSource;
  /** 변경한 사람(이메일). 없으면 현재 로그인 사용자 */
  actor?: string;
  /** 변경이 스쿨버스에서 시작된 경우 버스로 다시 내려보내지 않음 */
  skipBus?: boolean;
  note?: string;
}

export interface FieldChange {
  field: RegistryField;
  before: string | null;
  after: string | null;
}

export type MasterProfile = Partial<Record<RegistryField, any>> & { id?: string };

const str = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/** 숫자처럼 보이는 학년·반·번호는 앞의 0을 무시하고 비교 (예: '03' = '3') */
const comparable = (field: RegistryField, v: unknown): string | null => {
  const s = str(v);
  if (s === null) return null;
  if ((field === 'grade' || field === 'classNum' || field === 'studentNum') && /^\d+$/.test(s)) return String(Number(s));
  if (field === 'studentEmail') return s.toLowerCase();
  if (field === 'contact') return s.replace(/\D/g, '') || null;
  return s;
};

/** patch 중 실제로 값이 바뀐 신상 항목만 추린다. patch에 없는(undefined) 항목은 바뀌지 않은 것으로 본다. */
export function diffRegistryFields(before: MasterProfile | null | undefined, patch: MasterProfile): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of REGISTRY_FIELDS) {
    if (!(field in patch) || patch[field] === undefined) continue;
    const a = comparable(field, before?.[field]);
    const b = comparable(field, patch[field]);
    if (a !== b) changes.push({ field, before: str(before?.[field]), after: str(patch[field]) });
  }
  return changes;
}

const toEnrollmentNumber = (v: unknown): number | string | undefined => {
  const s = str(v);
  if (s === null) return undefined;
  return /^\d+$/.test(s) ? Number(s) : s;
};

/**
 * 방과후 수강 문서를 통합학생계정 값에 맞추는 수정분. 바꿀 것이 없으면 null.
 * 수강 문서는 학년·반·번호를 숫자로 저장한다.
 */
export function buildEnrollmentProfilePatch(enrollment: Record<string, any>, master: MasterProfile): Record<string, any> | null {
  const patch: Record<string, any> = {};
  const name = str(master.name);
  if (name && str(enrollment.name) !== name) patch.name = name;
  if (name && enrollment.studentName !== undefined && str(enrollment.studentName) !== name) patch.studentName = name;

  const pairs: [string, RegistryField][] = [['grade', 'grade'], ['classNum', 'classNum'], ['studentNum', 'studentNum']];
  for (const [key, field] of pairs) {
    const next = toEnrollmentNumber(master[field]);
    if (next === undefined) continue;
    if (comparable(field, enrollment[key]) !== comparable(field, next)) patch[key] = next;
  }

  const email = comparable('studentEmail', master.studentEmail);
  if (email && comparable('studentEmail', enrollment.studentEmail) !== email) patch.studentEmail = email;

  if (master.id && enrollment.masterStudentId !== master.id) patch.masterStudentId = master.id;
  return Object.keys(patch).length ? patch : null;
}

/**
 * 학부모 계정의 자녀 정보(대표 자녀·형제자매)를 통합학생계정 값에 맞추는 수정분. 바꿀 것이 없으면 null.
 */
export function buildParentProfilePatch(user: Record<string, any>, masterId: string, master: MasterProfile): Record<string, any> | null {
  const patch: Record<string, any> = {};
  const name = str(master.name);
  const grade = str(master.grade);
  const classNum = str(master.classNum);
  const num = str(master.studentNum);
  const nameEn = str(master.nameEn);

  if (user.masterStudentId === masterId) {
    if (name && str(user.studentName) !== name) patch.studentName = name;
    if (nameEn && str(user.studentNameEn) !== nameEn) patch.studentNameEn = nameEn;
    if (grade && comparable('grade', user.studentGrade) !== comparable('grade', grade)) patch.studentGrade = grade;
    if (classNum && comparable('classNum', user.studentClass) !== comparable('classNum', classNum)) patch.studentClass = classNum;
    if (num && comparable('studentNum', user.studentNumber) !== comparable('studentNum', num)) patch.studentNumber = num;
  }

  const linked: any[] = Array.isArray(user.linkedStudents) ? user.linkedStudents : [];
  let linkedChanged = false;
  const nextLinked = linked.map((s) => {
    if (!s || s.masterStudentId !== masterId) return s;
    const n = { ...s };
    if (name && str(s.nameKo) !== name) n.nameKo = name;
    if (nameEn && str(s.nameEn) !== nameEn) n.nameEn = nameEn;
    if (grade && comparable('grade', s.grade) !== comparable('grade', grade)) n.grade = grade;
    if (classNum && comparable('classNum', s.studentClass) !== comparable('classNum', classNum)) n.studentClass = classNum;
    if (num && comparable('studentNum', s.studentNumber) !== comparable('studentNum', num)) n.studentNumber = num;
    if (master.gender && s.gender !== master.gender && (master.gender === 'Male' || master.gender === 'Female')) n.gender = master.gender;
    const changed = Object.keys(n).some((k) => n[k] !== s[k]);
    if (changed) linkedChanged = true;
    return changed ? n : s;
  });
  if (linkedChanged) patch.linkedStudents = nextLinked;

  const ids = collectParentMasterIds({ ...user, ...patch });
  const prevIds: string[] = Array.isArray(user.linkedMasterStudentIds) ? user.linkedMasterStudentIds : [];
  if (ids.join('|') !== [...prevIds].sort().join('|')) patch.linkedMasterStudentIds = ids;

  return Object.keys(patch).length ? patch : null;
}

/** 학부모 계정이 연결한 모든 자녀의 공통 학생 키 (검색용 배열 필드 linkedMasterStudentIds) */
export function collectParentMasterIds(profile: Record<string, any>): string[] {
  const ids = new Set<string>();
  const add = (v: unknown) => {
    const s = str(v);
    if (s) ids.add(s);
  };
  add(profile.masterStudentId);
  (Array.isArray(profile.linkedStudents) ? profile.linkedStudents : []).forEach((s: any) => add(s?.masterStudentId));
  return Array.from(ids).sort();
}

/** 화면 표시용: 키가 있는 기록에 통합학생계정의 최신 이름·학년·반·번호를 덧씌운다 (저장하지 않음) */
export function overlayMasterProfile<T extends Record<string, any>>(record: T, master: MasterProfile | undefined): T {
  if (!master) return record;
  const patch = buildEnrollmentProfilePatch(record, master);
  if (!patch) return record;
  delete patch.masterStudentId;
  return { ...record, ...patch };
}
