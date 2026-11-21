/**
 * 시스템 학년도 공용 규칙 (클라이언트·서버 공용, 외부 의존 없음)
 *
 * 앱 전체의 현재 학년도는 시스템 설정 > 학사 일정 관리에서 적용한 `docConfig.academicCalendar.year` 하나다.
 * 결재 문서번호·드라이브 보관 폴더·방과후·학급 데이터가 모두 이 값을 따른다.
 */

type CalendarLike = {
  year?: number;
  semesters?: { sem1?: { startDate?: string } };
};
type DocConfigLike = {
  academicCalendar?: CalendarLike | null;
  academicYearAppliedAt?: string;
} | null | undefined;

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 날짜로 짐작한 학년도 (3월 이후면 그해, 1~2월이면 전년도) */
export function estimateAcademicYearByDate(d: Date = new Date()): number {
  return d.getMonth() + 1 >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

/** 시스템 설정의 현재 학년도 (설정이 없으면 날짜로 짐작) */
export function systemAcademicYearOf(cfg: DocConfigLike, now: Date = new Date()): number {
  const y = Number(cfg?.academicCalendar?.year);
  return y > 2000 ? y : estimateAcademicYearByDate(now);
}

/**
 * 어떤 날짜(결재일·작성일 등)가 속한 학년도.
 *  - 현재 시스템 학년도가 시작된 뒤(1학기 시작일 또는 [학년도 적용]을 누른 날 중 이른 날)면 → 시스템 학년도
 *  - 그 전 날짜(지난 문서)면 → 날짜로 짐작한 학년도 (단, 시스템 학년도보다 크지 않게)
 */
export function academicYearForDate(date: Date | string | undefined, cfg: DocConfigLike): number {
  const d = date ? new Date(date) : new Date();
  const when = isNaN(d.getTime()) ? new Date() : d;
  const sys = Number(cfg?.academicCalendar?.year);
  if (!(sys > 2000)) return estimateAcademicYearByDate(when);
  const starts = [cfg?.academicCalendar?.semesters?.sem1?.startDate || `${sys}-03-01`];
  if (cfg?.academicYearAppliedAt) {
    const applied = new Date(cfg.academicYearAppliedAt);
    // [학년도 적용]이 이 학년도로 넘어가며 눌린 경우만 (지난 학년도 근처)
    if (!isNaN(applied.getTime()) && estimateAcademicYearByDate(applied) >= sys - 1) starts.push(ymd(applied));
  }
  const start = starts.sort()[0];
  if (ymd(when) >= start) return sys;
  return Math.min(estimateAcademicYearByDate(when), sys - 1);
}

/**
 * 학급 관리 데이터(homeroom_classes/…, 브라우저 저장 키)를 학년도별로 나누는 키.
 * 학년도 구분을 도입하기 전 데이터(2026학년도)는 원래 키("4-3")를 그대로 쓰고,
 * 그다음 학년도부터는 "2027_4-3"처럼 학년도를 붙인다 → 새 학년도 같은 반 담임에게 지난 기록이 보이지 않음.
 */
export const HOMEROOM_LEGACY_YEAR = 2026;
export function homeroomDataKey(classKey: string, year: number | null | undefined): string {
  if (!classKey || !year) return '';
  return year <= HOMEROOM_LEGACY_YEAR ? classKey : `${year}_${classKey}`;
}
