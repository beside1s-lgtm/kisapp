/**
 * 방과후학교 [운영 종료]: 모든 강좌 폐강 + 모든 수강생을 출석부에서 제외
 *
 *  - 강좌: CANCELLED (이전 상태는 statusBeforeClose에 보관 → [운영 중]으로 되돌리면 복구)
 *  - 수강 신청(ENROLLED·WAITING 등): CANCELLED (이전 상태는 statusBeforeClose에 보관)
 *    → 방과후 출석부·담임 출석부(방과후 수강 현황)·출결 연동에서 모두 빠진다.
 *  - 출석 기록·지출증빙·결재 문서는 지우지 않는다(증빙 보존).
 *
 * 수천 건을 한 건씩 쓰거나 지우면 실시간 화면이 매 건마다 다시 그려져 앱이 멈추므로,
 * 400건씩 묶어서(writeBatch) 쓴다.
 */
import { getDb } from '@/lib/firebase';
import { collection, doc, getDocs, writeBatch, deleteField, type DocumentReference } from 'firebase/firestore';

const CHUNK = 400;

async function commitInChunks(updates: { ref: DocumentReference; data: Record<string, any> }[]) {
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = writeBatch(getDb());
    for (const u of updates.slice(i, i + CHUNK)) batch.update(u.ref, u.data);
    await batch.commit();
  }
}

// ─── 학년도·학기별 보관본: afterschool_term_archives/{학년도_학기} (+ courses, enrollments 하위 컬렉션) ───
export const TERM_ARCHIVE_COLLECTION = 'afterschool_term_archives';
export const termKeyOf = (year: string | number, semester: string) => `${year}_${semester}`;

export type TermArchiveMeta = {
  id: string;
  year: string;
  semester: string;
  closedAt: string;
  courseCount: number;
  enrollmentCount: number;
  instructorNames?: string[];
};

/** 이번 학기 강좌·수강 신청을 학년도·학기 보관본으로 복사 (같은 학기를 다시 종료하면 덮어씀) */
async function archiveTerm(
  year: string,
  semester: string,
  courses: { id: string; data: any }[],
  enrollments: { id: string; data: any }[],
  now: string,
) {
  const db = getDb();
  const termKey = termKeyOf(year, semester);
  const base = doc(db, TERM_ARCHIVE_COLLECTION, termKey);
  const instructorNames = Array.from(
    new Set(
      courses.flatMap((c) =>
        ['instructorName', 'instructor2', 'instructor3', 'instructor4', 'instructor5', 'instructor6']
          .map((k) => String(c.data[k] || '').trim())
          .filter(Boolean),
      ),
    ),
  ).sort((a, b) => a.localeCompare(b, 'ko'));
  const writes: { ref: DocumentReference; data: any }[] = [
    {
      ref: base,
      data: {
        year,
        semester,
        closedAt: now,
        courseCount: courses.length,
        enrollmentCount: enrollments.length,
        instructorNames,
      },
    },
    ...courses.map((c) => ({ ref: doc(base, 'courses', c.id), data: { ...c.data, archivedAt: now } })),
    ...enrollments.map((e) => ({ ref: doc(base, 'enrollments', e.id), data: { ...e.data, archivedAt: now } })),
  ];
  for (let i = 0; i < writes.length; i += CHUNK) {
    const batch = writeBatch(db);
    writes.slice(i, i + CHUNK).forEach((w) => batch.set(w.ref, w.data));
    await batch.commit();
  }
}

/** 보관된 학년도·학기 목록 (최근 순) */
export async function listTermArchives(): Promise<TermArchiveMeta[]> {
  const snap = await getDocs(collection(getDb(), TERM_ARCHIVE_COLLECTION));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }) as TermArchiveMeta)
    .sort((a, b) => (b.closedAt || '').localeCompare(a.closedAt || ''));
}

/** 보관된 학기의 강좌 목록 (강사 정보 포함) */
export async function getArchivedCourses(termKey: string): Promise<any[]> {
  const snap = await getDocs(collection(getDb(), TERM_ARCHIVE_COLLECTION, termKey, 'courses'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function closeAfterschoolSemester(term: { year: string; semester: string }): Promise<{
  courses: number;
  enrollments: number;
  reminders: number;
  archived: string;
}> {
  const db = getDb();
  const now = new Date().toISOString();
  const [coursesSnap, enrollSnap, remindersSnap] = await Promise.all([
    getDocs(collection(db, 'afterschool_courses')),
    getDocs(collection(db, 'afterschool_enrollments')),
    getDocs(collection(db, 'afterschool_reminders')).catch(() => null),
  ]);

  // 이번 학기 자료 = 지난 학기 운영 종료로 이미 정리된 것(closedBySemesterEndAt)을 뺀 나머지
  const termCourses = coursesSnap.docs.filter((d) => !d.data().closedBySemesterEndAt);
  const termEnrolls = enrollSnap.docs.filter((d) => !d.data().closedBySemesterEndAt);

  // 1. 폐강 처리 전에 원래 상태 그대로 학년도·학기 보관본 저장
  await archiveTerm(
    term.year,
    term.semester,
    termCourses.map((d) => ({ id: d.id, data: d.data() })),
    termEnrolls.map((d) => ({ id: d.id, data: d.data() })),
    now,
  );

  // 2. 폐강·수강 취소 (어느 학기 자료인지 표시)
  const stamp = { closedBySemesterEndAt: now, closedTermKey: termKeyOf(term.year, term.semester) };
  const courseUpdates = termCourses.map((d) => ({
    ref: d.ref,
    data:
      d.data().status !== 'CANCELLED'
        ? { status: 'CANCELLED', statusBeforeClose: d.data().status ?? null, ...stamp }
        : { statusBeforeClose: 'CANCELLED', ...stamp },
  }));
  const enrollUpdates = termEnrolls.map((d) => ({
    ref: d.ref,
    data:
      d.data().status !== 'CANCELLED'
        ? { status: 'CANCELLED', statusBeforeClose: d.data().status ?? null, ...stamp }
        : { statusBeforeClose: 'CANCELLED', ...stamp },
  }));

  await commitInChunks(courseUpdates);
  await commitInChunks(enrollUpdates);

  // 독촉 알림은 운영 중에만 의미가 있으므로 정리
  const reminderRefs = remindersSnap?.docs.map((d) => d.ref) || [];
  for (let i = 0; i < reminderRefs.length; i += CHUNK) {
    const batch = writeBatch(db);
    reminderRefs.slice(i, i + CHUNK).forEach((r) => batch.delete(r));
    await batch.commit();
  }

  return {
    courses: termCourses.filter((d) => d.data().status !== 'CANCELLED').length,
    enrollments: termEnrolls.filter((d) => d.data().status !== 'CANCELLED').length,
    reminders: reminderRefs.length,
    archived: `${term.year}학년도 ${term.semester}`,
  };
}

/** [운영 종료]를 되돌릴 때: 운영 종료로 폐강된 강좌·수강 신청만 원래 상태로 */
export async function reopenAfterschoolSemester(): Promise<{ courses: number; enrollments: number }> {
  const db = getDb();
  const [coursesSnap, enrollSnap] = await Promise.all([
    getDocs(collection(db, 'afterschool_courses')),
    getDocs(collection(db, 'afterschool_enrollments')),
  ]);
  // 가장 최근에 운영 종료한 학기 자료만 되돌림 (그 전 학기 자료는 그대로)
  const latest = [...coursesSnap.docs, ...enrollSnap.docs]
    .map((d) => String(d.data().closedBySemesterEndAt || ''))
    .reduce((m, v) => (v > m ? v : m), '');
  const restore = (docs: typeof coursesSnap.docs, fallback: string) =>
    docs
      .filter((d) => latest && d.data().closedBySemesterEndAt === latest)
      .map((d) => ({
        ref: d.ref,
        data: {
          status: d.data().statusBeforeClose || fallback,
          statusBeforeClose: deleteField(),
          closedBySemesterEndAt: deleteField(),
          closedTermKey: deleteField(),
        },
      }));
  const c = restore(coursesSnap.docs, 'OPEN');
  const e = restore(enrollSnap.docs, 'ENROLLED');
  await commitInChunks(c);
  await commitInChunks(e);
  return { courses: c.length, enrollments: e.length };
}
