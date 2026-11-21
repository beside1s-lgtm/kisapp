import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { academicYearForDate } from '@/lib/academicYear';

/**
 * 서버(API)용: 시스템 설정의 학년도 기준으로 그 날짜의 학년도를 문자열로.
 * 설정을 못 읽으면 날짜로 짐작한다.
 */
export async function serverAcademicYearForDate(date?: Date | string): Promise<string> {
  let cfg: any = null;
  try {
    const snap = await getAdminDb().collection('settings').doc('docConfig').get();
    cfg = snap.exists ? snap.data() : null;
  } catch (e) {
    console.warn('[systemAcademicYear] docConfig 읽기 실패, 날짜로 학년도 판정:', e);
  }
  return String(academicYearForDate(date, cfg));
}
