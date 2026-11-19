/**
 * 방과후 출석부 칸 표시 — 강사 출석부 화면·출력과 부장/교감 증빙서류 출력이 같은 기호를 쓰도록 한 곳에서 계산
 */
import type { AttendanceRecord } from './types';
import type { ScheduleDay } from './schedule';

export function scheduleDayKor(day: Pick<ScheduleDay, 'dateStr' | 'fullDate'> | null | undefined): string {
  if (!day) return '';
  const match = day.dateStr?.match(/\(([월화수목금토일])\)/);
  if (match) return match[1];
  if (day.fullDate) {
    const koreanDays = ['일', '월', '화', '수', '목', '금', '토'];
    return koreanDays[new Date(day.fullDate + 'T12:00:00').getDay()];
  }
  return '';
}

/**
 * 학생·회차의 출석부 기호
 * - '―': 그 요일을 수강하지 않는 학생 (주 2회 강좌의 주 1회 수강생)
 * - 기록이 있으면 '○' / '△'(지각·조퇴·개별하교) / '×' / 저장된 기호, 상태가 비어 있으면 ''
 * - null: 그 회차 출결 기록이 아직 없음
 */
export function afterschoolDayMark(
  courseId: string,
  student: { selectedDays?: string[] } | null | undefined,
  studentId: string,
  day: ScheduleDay | null | undefined,
  attendanceRecords: AttendanceRecord[]
): string | null {
  if (!day) return '';
  if (student?.selectedDays && student.selectedDays.length > 0) {
    const dayKor = scheduleDayKor(day);
    if (dayKor && !student.selectedDays.includes(dayKor)) return '―';
  }
  const record = attendanceRecords.find(
    (r) => r.courseId === courseId && r.studentId === studentId && r.sessionNo === day.startSessionNo
  );
  if (!record) return null;
  if ((record as any).markSymbol) return (record as any).markSymbol;
  if (record.status === 'ATTEND') return (record as any).isIndividualDismissal ? '△' : '○';
  if (record.status === 'LATE' || (record.status as string) === 'EARLY_LEAVE') return '△';
  if (record.status === 'ABSENT') return '×';
  return '';
}

/** 출석부 칸에 찍는 기호와 색 */
export function attendanceMarkDisplay(mark: string) {
  if (mark === 'O' || mark === '○') return { symbol: '○', color: 'text-emerald-600 font-black' };
  if (mark === 'V' || mark === '△') return { symbol: '△', color: 'text-purple-600 font-black' };
  if (mark === 'X' || mark === '×') return { symbol: '×', color: 'text-rose-600 font-black' };
  return { symbol: '·', color: 'text-slate-300' };
}

/** 출근부·출석부 머리글의 학기 문구 (예: 2026학년도 2학기 방과후학교) */
export function afterschoolTermHeader(settings: { year?: string | number; semester?: string } | null | undefined): string {
  const year = settings?.year || new Date().getFullYear();
  const semester = settings?.semester || '';
  return `${year}학년도 ${semester ? semester + ' ' : ''}방과후학교`;
}
