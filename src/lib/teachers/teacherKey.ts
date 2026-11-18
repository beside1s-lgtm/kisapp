/**
 * 교직원 공통 키 = 시스템 설정(사용자 관리)에 등록된 계정 이메일 (users 문서 ID, 소문자)
 *
 * - 스쿨버스 교사(teachers / afterSchoolTeachers / saturdayTeachers), 방과후 강좌 강사, 조직도(담임·부서·업무)는
 *   모두 이 이메일로 시스템 사용자 한 명을 가리키고, 이름은 시스템 사용자 값을 따른다.
 * - 이메일이 없는 옛 기록은 이름(또는 Mr./Ms. 등을 뗀 짧은 이름)이 한 명에게만 맞을 때만 연결한다.
 *
 * Firebase에 의존하지 않는 순수 로직이라 브라우저·서버·관리 스크립트에서 함께 쓴다.
 */

export interface TeacherLite {
  email: string;
  name?: string | null;
  nameEn?: string | null;
  role?: string | null;
  dept?: string | null;
}

export interface TeacherIndex {
  byEmail: Map<string, TeacherLite>;
  byName: Map<string, TeacherLite[]>;
  byAlias: Map<string, TeacherLite[]>;
}

export type TeacherResolveResult =
  | { email: string; via: 'email' | 'name' | 'alias' }
  | { email: null; reason: 'none' | 'ambiguous'; candidates: string[] };

export const normalizeTeacherEmail = (v: unknown) => String(v ?? '').trim().toLowerCase();
export const normalizeTeacherName = (v: unknown) => String(v ?? '').replace(/\s+/g, '').toLowerCase();

const TITLE_RE = /^(mr|mrs|ms|miss|dr|teacher)\.?\s+|\s+(mr|mrs|ms|jr|sr)\.?$/gi;

/** 짧은 이름 후보: "Mr. Brendan" → brendan, "Justin No" → justin, "Rene Jr" → rene, "강지욱" → 강지욱 */
export function teacherNameAliases(name: unknown): string[] {
  const raw = String(name ?? '').trim();
  if (!raw) return [];
  const out = new Set<string>();
  let stripped = raw;
  for (let i = 0; i < 3; i++) stripped = stripped.replace(TITLE_RE, '').trim();
  out.add(normalizeTeacherName(stripped));
  if (/^[a-z .'-]+$/i.test(stripped)) {
    const first = stripped.split(/\s+/)[0];
    if (first) out.add(normalizeTeacherName(first));
  }
  out.delete(normalizeTeacherName(raw));
  return Array.from(out).filter(Boolean);
}

export function buildTeacherIndex(teachers: TeacherLite[]): TeacherIndex {
  const byEmail = new Map<string, TeacherLite>();
  const byName = new Map<string, TeacherLite[]>();
  const byAlias = new Map<string, TeacherLite[]>();
  const push = (m: Map<string, TeacherLite[]>, k: string, t: TeacherLite) => {
    if (!k) return;
    const list = m.get(k) || [];
    if (!list.some((x) => x.email === t.email)) list.push(t);
    m.set(k, list);
  };
  teachers.forEach((t0) => {
    const email = normalizeTeacherEmail(t0.email);
    if (!email) return;
    const t = { ...t0, email };
    byEmail.set(email, t);
    push(byName, normalizeTeacherName(t.name), t);
    if (t.nameEn) push(byName, normalizeTeacherName(t.nameEn), t);
    [...teacherNameAliases(t.name), ...teacherNameAliases(t.nameEn)].forEach((a) => push(byAlias, a, t));
  });
  return { byEmail, byName, byAlias };
}

/** 이메일 → 전체 이름 → 짧은 이름 순으로, 한 명으로 특정될 때만 연결 */
export function resolveTeacher(hint: { email?: unknown; name?: unknown }, index: TeacherIndex): TeacherResolveResult {
  const email = normalizeTeacherEmail(hint.email);
  if (email && index.byEmail.has(email)) return { email, via: 'email' };
  const n = normalizeTeacherName(hint.name);
  if (!n) return { email: null, reason: 'none', candidates: [] };
  const exact = index.byName.get(n) || [];
  if (exact.length === 1) return { email: exact[0].email, via: 'name' };
  if (exact.length > 1) return { email: null, reason: 'ambiguous', candidates: exact.map((t) => t.email) };
  const aliasKeys = [n, ...teacherNameAliases(hint.name)];
  const hits = new Map<string, TeacherLite>();
  aliasKeys.forEach((k) => (index.byAlias.get(k) || []).forEach((t) => hits.set(t.email, t)));
  aliasKeys.forEach((k) => (index.byName.get(k) || []).forEach((t) => hits.set(t.email, t)));
  if (hits.size === 1) return { email: Array.from(hits.keys())[0], via: 'alias' };
  if (hits.size > 1) return { email: null, reason: 'ambiguous', candidates: Array.from(hits.keys()) };
  return { email: null, reason: 'none', candidates: [] };
}

/** 표시 이름: 시스템 사용자 이름 우선, 없으면 기록에 남은 이름 */
export function teacherDisplayName(email: unknown, fallback: unknown, index: TeacherIndex): string {
  const t = index.byEmail.get(normalizeTeacherEmail(email));
  return String(t?.name || fallback || '').trim();
}
