/**
 * 통합학생계정 정합성 점검·복구
 *
 * 통합학생계정(master_students)을 원본으로, 복사본이 같은 값을 갖고 있는지 확인한다.
 *  - 방과후 수강(현재 개설 강좌): 이름·학년·반·번호·이메일
 *  - 학생 계정(users, 학생 이메일 문서): 이름·학년·반·번호
 *  - 학부모 계정: 대표 자녀·형제자매 정보, 검색용 linkedMasterStudentIds
 *  - 스쿨버스 학생(키 연결된 학생, 한글학교 S·유치원 K 제외): 학년·반·번호
 * 과거 기록(지난 출결·승인 문서·지난 강좌 수강)은 당시 값을 유지하므로 점검하지 않는다.
 *
 * 사용법
 *   npx tsx --tsconfig tsconfig.json scripts/student-consistency.ts            # 점검만
 *   npx tsx --tsconfig tsconfig.json scripts/student-consistency.ts --apply    # 복구 (되돌리기 파일 저장 후)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

for (const line of readFileSync(join(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const APPLY = process.argv.includes('--apply');
const BUS_CONFIG = {
  apiKey: 'AIzaSyD98EXwu0qawhpLkL8fMe1erS5aBpXzv8w',
  projectId: 'studio-8176556433-7698a',
  appId: '1:89517826209:web:37c6d9f5cb30a03e1850e0',
};

(async () => {
  const K = await import('../src/lib/students/masterStudentKey');
  const P = await import('../src/lib/students/studentProfileSync');
  const { getAdminDb } = await import('../src/lib/server/firebaseAdmin');
  const app: any = await import('firebase/app');
  const fs: any = await import('firebase/firestore');
  const db = getAdminDb();
  const busDb = fs.getFirestore(app.initializeApp(BUS_CONFIG, 'consistency'));

  const [mSnap, eSnap, cSnap, uSnap, bSnap] = await Promise.all([
    db.collection('master_students').get(),
    db.collection('afterschool_enrollments').get(),
    db.collection('afterschool_courses').get(),
    db.collection('users').get(),
    fs.getDocs(fs.collection(busDb, 'students')),
  ]);
  const masters = new Map<string, any>();
  mSnap.docs.forEach((d) => {
    const m = { id: d.id, ...(d.data() as any) };
    if (K.isRealMasterStudent(m)) masters.set(d.id, m);
  });
  const byEmail = new Map<string, any>();
  masters.forEach((m) => {
    const e = K.normalizeEmail(m.studentEmail);
    if (e) byEmail.set(e, m);
  });
  const liveCourses = new Set(cSnap.docs.map((d) => d.id));
  const n = K.normalizeNum;

  type Fix = { target: 'main' | 'bus'; col: string; id: string; label: string; patch: Record<string, any>; before: Record<string, any> };
  const fixes: Fix[] = [];
  const pick = (o: any, keys: string[]) => Object.fromEntries(keys.map((k) => [k, o?.[k] ?? null]));
  const orphanKeys: string[] = [];

  // 1. 방과후 수강 (현재 강좌)
  eSnap.docs.forEach((d) => {
    const e: any = d.data();
    if (!e.masterStudentId || !liveCourses.has(String(e.courseId || ''))) return;
    const m = masters.get(e.masterStudentId);
    if (!m) return void orphanKeys.push(`방과후 ${d.id} → ${e.masterStudentId}`);
    const patch = P.buildEnrollmentProfilePatch(e, m);
    if (patch) fixes.push({ target: 'main', col: 'afterschool_enrollments', id: d.id, label: `방과후 ${e.name} ${e.grade}-${e.classNum}-${e.studentNum}`, patch, before: pick(e, Object.keys(patch)) });
  });

  // 2. 학생 계정 / 3. 학부모 계정
  uSnap.docs.forEach((d) => {
    const u: any = d.data();
    const own = byEmail.get(K.normalizeEmail(d.id)) || byEmail.get(K.normalizeEmail(u.email));
    if (own && (u.role === 'student' || !u.role)) {
      const patch: Record<string, any> = {};
      // 띄어쓰기만 다른 이름은 같은 이름으로 본다
      if (own.name && K.normalizeStudentName(u.name) !== K.normalizeStudentName(own.name)) patch.name = own.name;
      // 학생 계정은 grade/studentGrade 등 같은 값을 두 이름으로 저장한다. 둘 중 값이 있는 쪽으로 비교
      if (n(own.grade) && n(u.studentGrade ?? u.grade) !== n(own.grade)) Object.assign(patch, { grade: String(own.grade), studentGrade: String(own.grade) });
      if (n(own.classNum) && n(u.studentClass ?? u.class) !== n(own.classNum)) Object.assign(patch, { class: String(own.classNum), studentClass: String(own.classNum) });
      if (n(own.studentNum) && n(u.studentNumber ?? u.number) !== n(own.studentNum)) Object.assign(patch, { number: String(own.studentNum), studentNumber: String(own.studentNum) });
      if (Object.keys(patch).length) fixes.push({ target: 'main', col: 'users', id: d.id, label: `학생계정 ${own.name}`, patch, before: pick(u, Object.keys(patch)) });
      return;
    }
    const ids = P.collectParentMasterIds(u);
    if (!ids.length) return;
    let merged: Record<string, any> = { ...u };
    const patch: Record<string, any> = {};
    ids.forEach((id) => {
      const m = masters.get(id);
      if (!m) return void orphanKeys.push(`학부모 ${d.id} → ${id}`);
      const p = P.buildParentProfilePatch(merged, id, m);
      if (p) {
        Object.assign(patch, p);
        merged = { ...merged, ...p };
      }
    });
    if (Object.keys(patch).length) fixes.push({ target: 'main', col: 'users', id: d.id, label: `학부모 ${u.parentName || d.id} (자녀 ${u.studentName || ''})`, patch, before: pick(u, Object.keys(patch)) });
  });

  // 4. 스쿨버스 (키 연결, S·K 학년 제외)
  bSnap.docs.forEach((d: any) => {
    const b = d.data();
    if (!b.masterStudentId || /^[SK]/i.test(String(b.grade || '').trim())) return;
    const m = masters.get(b.masterStudentId);
    if (!m) return void orphanKeys.push(`버스 ${d.id} → ${b.masterStudentId}`);
    const patch: Record<string, any> = {};
    if (n(m.grade) && n(b.grade) !== n(m.grade)) patch.grade = String(m.grade);
    if (n(m.classNum) && n(b.class ?? b.classNum) !== n(m.classNum)) Object.assign(patch, { class: String(m.classNum), classNum: String(m.classNum) });
    if (n(m.studentNum) && n(b.number ?? b.studentNum) !== n(m.studentNum)) Object.assign(patch, { number: String(m.studentNum), studentNum: String(m.studentNum) });
    if (Object.keys(patch).length) fixes.push({ target: 'bus', col: 'students', id: d.id, label: `버스 ${b.nameKo || b.name} ${b.grade}-${b.class ?? b.classNum}`, patch, before: pick(b, Object.keys(patch)) });
  });

  const summary = fixes.reduce<Record<string, number>>((acc, f) => ((acc[f.label.split(' ')[0]] = (acc[f.label.split(' ')[0]] || 0) + 1), acc), {});
  console.log(`통합학생계정 ${masters.size}명 기준 점검 결과: 어긋난 복사본 ${fixes.length}건`, summary);
  fixes.slice(0, 60).forEach((f) => console.log(`  - ${f.label}: ${JSON.stringify(f.before)} → ${JSON.stringify(f.patch)}`));
  if (fixes.length > 60) console.log(`  … 외 ${fixes.length - 60}건`);
  if (orphanKeys.length) {
    console.log(`\n없는 통합학생계정을 가리키는 키 ${orphanKeys.length}건 (수동 확인 필요):`);
    orphanKeys.slice(0, 30).forEach((o) => console.log('  - ' + o));
  }

  if (process.argv.includes('--fields')) {
    const by: Record<string, number> = {};
    fixes.forEach((f) => { const k = f.label.split(' ')[0] + ':' + Object.keys(f.patch).sort().join(','); by[k] = (by[k] || 0) + 1; });
    console.log('\n항목별:', by);
    const filt = process.argv.find((a) => a.startsWith('--show='));
    if (filt) fixes.filter((f) => f.label.startsWith(filt.slice(7)) && Object.keys(f.patch).some((k) => k !== 'studentEmail')).slice(0, 25).forEach((f) => console.log('  * ' + f.label + ' ' + JSON.stringify(f.before) + ' → ' + JSON.stringify(f.patch)));
  }
  if (!APPLY) {
    console.log('\n점검만 했습니다. 복구하려면 --apply 를 붙여 다시 실행하세요.');
    process.exit(0);
  }
  if (!fixes.length) process.exit(0);

  const dir = join(homedir(), 'Documents', 'kisapp-student-key');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(dir, `정합성복구_되돌리기_${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(fixes, null, 2));
  console.log(`\n되돌리기 파일: ${backupPath}`);

  const main = fixes.filter((f) => f.target === 'main');
  for (let i = 0; i < main.length; i += 400) {
    const batch = db.batch();
    main.slice(i, i + 400).forEach((f) => batch.update(db.collection(f.col).doc(f.id), f.patch));
    await batch.commit();
  }
  const bus = fixes.filter((f) => f.target === 'bus');
  for (let i = 0; i < bus.length; i += 400) {
    const batch = fs.writeBatch(busDb);
    bus.slice(i, i + 400).forEach((f) => batch.update(fs.doc(busDb, f.col, f.id), f.patch));
    await batch.commit();
  }
  console.log(`복구 완료: 본 DB ${main.length}건, 스쿨버스 ${bus.length}건`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
