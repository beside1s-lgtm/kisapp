/**
 * 교직원 정합성 점검·복구 — 시스템 설정(사용자 관리) 계정이 기준
 *
 *  1. 시스템 사용자 문서 ID에 공백·대문자가 섞인 계정 (예: " hyojukim@kshcm.net") → 정상 ID로 옮김
 *  2. 스쿨버스 교사(통근·방과후·토요): 시스템 계정 email 연결 + 이름을 시스템 이름으로
 *  3. 방과후 강좌 강사 칸: instructorEmails 연결 + 이름을 시스템 이름으로
 *  4. 조직도(담임·학년부장·부서·업무 담당 등): 시스템 교직원이 아닌 이메일 보고
 *  5. 스쿨버스 노선 담당 교사(teacherIds): 없는 교사를 가리키는 경우 보고
 * 시스템 계정이 없는 외부 강사·학급명(세종반 등)은 이름만 그대로 둔다.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/teacher-consistency.ts            # 점검만
 *   npx tsx --tsconfig tsconfig.json scripts/teacher-consistency.ts --apply    # 복구 (되돌리기 파일 저장 후)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

for (const line of readFileSync(join(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const APPLY = process.argv.includes('--apply');
const BUS_CONFIG = { apiKey: 'AIzaSyD98EXwu0qawhpLkL8fMe1erS5aBpXzv8w', projectId: 'studio-8176556433-7698a', appId: '1:89517826209:web:37c6d9f5cb30a03e1850e0' };
const INSTRUCTOR_FIELDS = ['instructorName', 'instructor2', 'instructor3', 'instructor4', 'instructor5', 'instructor6'];

(async () => {
  const T = await import('../src/lib/teachers/teacherKey');
  const { isFacultyMember } = await import('../src/lib/services/userService');
  const { getAdminDb } = await import('../src/lib/server/firebaseAdmin');
  const app: any = await import('firebase/app');
  const fs: any = await import('firebase/firestore');
  const db = getAdminDb();
  const busDb = fs.getFirestore(app.initializeApp(BUS_CONFIG, 'teacher-consistency'));

  const [uSnap, orgSnap, cSnap] = await Promise.all([db.collection('users').get(), db.collection('settings').doc('orgStructure').get(), db.collection('afterschool_courses').get()]);
  const busCols = ['teachers', 'afterSchoolTeachers', 'saturdayTeachers'];
  const [bT, bA, bS, bR] = await Promise.all([...busCols, 'routes'].map((c) => fs.getDocs(fs.collection(busDb, c))));

  type Fix = { target: 'main' | 'bus'; kind: 'update' | 'set' | 'delete'; path: string; data?: any; before?: any; label: string };
  const fixes: Fix[] = [];
  const reports: string[] = [];

  // 1. 문서 ID 이상
  uSnap.docs.forEach((d) => {
    const clean = d.id.trim().toLowerCase();
    if (clean === d.id) return;
    const exists = uSnap.docs.some((x) => x.id === clean);
    if (exists) return void reports.push(`[계정] "${d.id}" 와 "${clean}" 이 둘 다 있음 — 수동 확인`);
    const data = { ...d.data(), email: clean };
    fixes.push({ target: 'main', kind: 'set', path: `users/${clean}`, data, label: `계정 ID 정리 "${d.id}" → ${clean}` });
    fixes.push({ target: 'main', kind: 'delete', path: `users/${d.id}`, before: d.data(), label: `계정 ID 정리: 옛 문서 삭제 "${d.id}"` });
  });

  const faculty = uSnap.docs
    .map((d) => ({ ...(d.data() as any), email: d.id.trim().toLowerCase() }))
    .filter((u) => u.name && isFacultyMember(u));
  const idx = T.buildTeacherIndex(faculty);
  const unmatched: string[] = [];

  // 2. 스쿨버스 교사
  [bT, bA, bS].forEach((snap: any, i: number) =>
    snap.docs.forEach((d: any) => {
      const b = d.data();
      const r = T.resolveTeacher({ email: b.email, name: b.name }, idx);
      if (!r.email) return void unmatched.push(`버스 ${busCols[i]} ${b.name}${r.reason === 'ambiguous' ? ' (동명이인: ' + r.candidates.join(',') + ')' : ''}`);
      const sysName = idx.byEmail.get(r.email)?.name;
      const patch: any = {};
      if (b.email !== r.email) patch.email = r.email;
      if (sysName && b.name !== sysName) patch.name = sysName;
      if (Object.keys(patch).length) fixes.push({ target: 'bus', kind: 'update', path: `${busCols[i]}/${d.id}`, data: patch, before: { email: b.email ?? null, name: b.name }, label: `버스 ${busCols[i]} "${b.name}" → ${sysName} <${r.email}> (${r.via})` });
    })
  );

  // 3. 방과후 강사
  cSnap.docs.forEach((d) => {
    const c: any = d.data();
    const emails: Record<string, string> = { ...(c.instructorEmails || {}) };
    const patch: any = {};
    INSTRUCTOR_FIELDS.forEach((f) => {
      const name = String(c[f] || '').trim();
      if (!name) return;
      const prev = emails[f] && idx.byEmail.get(emails[f]);
      const r = prev ? { email: emails[f], via: 'email' } : T.resolveTeacher({ name }, idx);
      if (!r.email) return void unmatched.push(`방과후 ${c.title} ${f} ${name}`);
      emails[f] = r.email;
      const sysName = idx.byEmail.get(r.email)?.name;
      if (sysName && sysName !== name) patch[f] = sysName;
    });
    if (JSON.stringify(emails) !== JSON.stringify(c.instructorEmails || {})) patch.instructorEmails = emails;
    if (Object.keys(patch).length) fixes.push({ target: 'main', kind: 'update', path: `afterschool_courses/${d.id}`, data: patch, before: Object.fromEntries(Object.keys(patch).map((k) => [k, c[k] ?? null])), label: `방과후 ${c.title}: ${JSON.stringify(patch)}` });
  });

  // 4. 조직도
  const org: any = orgSnap.data() || {};
  const willExist = new Set(fixes.filter((f) => f.kind === 'set' && f.path.startsWith('users/')).map((f) => f.path.slice(6)));
  const chk = (where: string, e: any) => {
    const em = T.normalizeTeacherEmail(typeof e === 'string' ? e : e?.email);
    if (em && !idx.byEmail.has(em) && !willExist.has(em)) reports.push(`[조직도] ${where}: ${em} 시스템 교직원 계정 없음`);
  };
  ['principal', 'vicePrincipal', 'administrativeHead', 'academicHead', 'volunteerManager'].forEach((k) => chk(k, org[k]));
  Object.entries(org.gradeHeads || {}).forEach(([g, e]) => chk(`학년부장 ${g}`, e));
  Object.entries(org.homerooms || {}).forEach(([gc, e]) => chk(`담임 ${gc}`, e));
  Object.entries(org.gradeSubjects || {}).forEach(([g, l]: any) => (l || []).forEach((e: any) => chk(`학년교과 ${g}`, e)));
  ['afterschoolManagers', 'busManagers', 'systemManagers', 'peTeachers', 'healthTeachers', 'safetyManagers', 'specialTeachers', 'librarianTeachers', 'handoverManagers', 'returningTeacherEmails'].forEach((k) => (org[k] || []).forEach((e: any) => chk(k, e)));
  (org.departments || []).forEach((d: any) => { chk(`부서장 ${d.name}`, d.headEmail); (d.memberEmails || []).forEach((e: any) => chk(`부서원 ${d.name}`, e)); });
  (org.customDutyRoles || []).forEach((r: any) => (r.teacherEmails || []).forEach((e: any) => chk(`업무 ${r.roleName}`, e)));
  (org.subjectTeacherGroups || []).forEach((g: any) => (g.teacherEmails || []).forEach((e: any) => chk(`교과전담 ${g.subjectName || g.name || ''}`, e)));

  // 5. 노선 담당 교사
  const busIds = new Set<string>([bT, bA, bS].flatMap((s: any) => s.docs.map((d: any) => d.id)));
  bR.docs.forEach((d: any) => (d.data().teacherIds || []).forEach((id: string) => { if (id && !busIds.has(id)) reports.push(`[버스 노선] ${d.data().name || d.id}: 없는 교사 ${id}`); }));

  console.log(`시스템 교직원 ${faculty.length}명 기준 — 고칠 것 ${fixes.length}건`);
  fixes.forEach((f) => console.log('  - ' + f.label));
  if (reports.length) { console.log(`\n확인 필요 ${reports.length}건`); reports.forEach((r) => console.log('  - ' + r)); }
  if (unmatched.length) { console.log(`\n시스템 계정 없음(이름만 유지) ${unmatched.length}건`); unmatched.forEach((u) => console.log('  - ' + u)); }

  if (!APPLY) { console.log('\n점검만 했습니다. 복구하려면 --apply 를 붙여 다시 실행하세요.'); process.exit(0); }
  if (!fixes.length) process.exit(0);
  const dir = join(homedir(), 'Documents', 'kisapp-student-key');
  mkdirSync(dir, { recursive: true });
  const backup = join(dir, `교직원정합성_되돌리기_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(backup, JSON.stringify(fixes, null, 2));
  console.log(`\n되돌리기 파일: ${backup}`);
  const main = fixes.filter((f) => f.target === 'main');
  for (let i = 0; i < main.length; i += 400) {
    const b = db.batch();
    main.slice(i, i + 400).forEach((f) => (f.kind === 'delete' ? b.delete(db.doc(f.path)) : f.kind === 'set' ? b.set(db.doc(f.path), f.data) : b.update(db.doc(f.path), f.data)));
    await b.commit();
  }
  const bus = fixes.filter((f) => f.target === 'bus');
  for (let i = 0; i < bus.length; i += 400) {
    const b = fs.writeBatch(busDb);
    bus.slice(i, i + 400).forEach((f) => b.update(fs.doc(busDb, f.path), f.data));
    await b.commit();
  }
  console.log(`복구 완료: 본 DB ${main.length}건, 스쿨버스 ${bus.length}건`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
