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
import { collection, getDocs, writeBatch, deleteField, type DocumentReference } from 'firebase/firestore';

const CHUNK = 400;

async function commitInChunks(updates: { ref: DocumentReference; data: Record<string, any> }[]) {
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = writeBatch(getDb());
    for (const u of updates.slice(i, i + CHUNK)) batch.update(u.ref, u.data);
    await batch.commit();
  }
}

export async function closeAfterschoolSemester(): Promise<{ courses: number; enrollments: number; reminders: number }> {
  const db = getDb();
  const now = new Date().toISOString();
  const [coursesSnap, enrollSnap, remindersSnap] = await Promise.all([
    getDocs(collection(db, 'afterschool_courses')),
    getDocs(collection(db, 'afterschool_enrollments')),
    getDocs(collection(db, 'afterschool_reminders')).catch(() => null),
  ]);

  const courseUpdates = coursesSnap.docs
    .filter((d) => d.data().status !== 'CANCELLED')
    .map((d) => ({
      ref: d.ref,
      data: { status: 'CANCELLED', statusBeforeClose: d.data().status ?? null, closedBySemesterEndAt: now },
    }));
  const enrollUpdates = enrollSnap.docs
    .filter((d) => d.data().status !== 'CANCELLED')
    .map((d) => ({
      ref: d.ref,
      data: { status: 'CANCELLED', statusBeforeClose: d.data().status ?? null, closedBySemesterEndAt: now },
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

  return { courses: courseUpdates.length, enrollments: enrollUpdates.length, reminders: reminderRefs.length };
}

/** [운영 종료]를 되돌릴 때: 운영 종료로 폐강된 강좌·수강 신청만 원래 상태로 */
export async function reopenAfterschoolSemester(): Promise<{ courses: number; enrollments: number }> {
  const db = getDb();
  const [coursesSnap, enrollSnap] = await Promise.all([
    getDocs(collection(db, 'afterschool_courses')),
    getDocs(collection(db, 'afterschool_enrollments')),
  ]);
  const restore = (docs: typeof coursesSnap.docs, fallback: string) =>
    docs
      .filter((d) => d.data().closedBySemesterEndAt && d.data().status === 'CANCELLED')
      .map((d) => ({
        ref: d.ref,
        data: {
          status: d.data().statusBeforeClose || fallback,
          statusBeforeClose: deleteField(),
          closedBySemesterEndAt: deleteField(),
        },
      }));
  const c = restore(coursesSnap.docs, 'OPEN');
  const e = restore(enrollSnap.docs, 'ENROLLED');
  await commitInChunks(c);
  await commitInChunks(e);
  return { courses: c.length, enrollments: e.length };
}
