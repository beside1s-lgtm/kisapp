import type { GlobalTimerConfig } from './types';

/**
 * 방과후 수강신청 공통 판정 유틸.
 * - 학생 화면(StudentView)과 신청 트랜잭션(settingsService)이 같은 기준으로 판단하도록 한 곳에 모은다.
 */

/** '2026-07-10 오후 06:00', '2026.07.10 18:00:00', ISO 문자열 등을 Date로 변환 (실패 시 현재 시각) */
export const safeParseDate = (dateStr: any): Date => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  try {
    let s = String(dateStr).trim();
    const isPm = s.includes('오후');
    const isAm = s.includes('오전');
    s = s.replace('오전', '').replace('오후', '').replace(/\s+/g, ' ');

    const parts = s.split(' ');
    if (parts.length >= 2) {
      const datePart = parts[0].replace(/\./g, '-');
      const timePart = parts[1];
      const timeSpecs = timePart.split(':');
      let hour = parseInt(timeSpecs[0], 10) || 0;
      const min = parseInt(timeSpecs[1], 10) || 0;
      const sec = parseInt(timeSpecs[2], 10) || 0;

      if (isPm && hour < 12) hour += 12;
      if (isAm && hour === 12) hour = 0;

      const d = new Date(datePart);
      d.setHours(hour, min, sec);
      if (!isNaN(d.getTime())) return d;
    }

    const normalized = s.replace(/\./g, '-');
    const parsed = new Date(normalized);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch (err) {
    console.error("safeParseDate error:", err);
  }
  return new Date();
};

/** 학교 표준 시간대: 신청 개시/마감 시각은 학교 현지 시각(벽시계)으로 입력·저장된다 */
export const SCHOOL_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** 해당 시간대의 UTC 대비 오프셋(ms) 계산 */
function getTimeZoneOffsetMs(timeZone: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts: Record<string, number> = {};
  dtf.formatToParts(new Date(utcMs)).forEach(p => {
    if (p.type !== 'literal') parts[p.type] = parseInt(p.value, 10);
  });
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return asUtc - utcMs;
}

/** 학교 현지 벽시계 시각(년,월,일,시,분,초) → 절대 시각(ms) */
export function schoolWallTimeToMs(y: number, mo: number, d: number, h = 0, mi = 0, s = 0, timeZone = SCHOOL_TIME_ZONE): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const offset = getTimeZoneOffsetMs(timeZone, guess);
  return guess - offset;
}

/**
 * 신청 개시/마감 문자열을 학교 시간대 기준 절대 시각(ms)으로 변환.
 * - 기기(학생 PC/서버)의 시간대 설정과 무관하게 같은 결과를 낸다.
 * - 'Z' 또는 +07:00 같은 시간대가 명시된 문자열은 그대로 해석.
 * - 해석 불가 시 NaN
 */
export function parseSchoolDateMs(value: any, timeZone = SCHOOL_TIME_ZONE): number {
  if (value === null || value === undefined || value === '') return NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const str = String(value).trim();
  if (/\d{2}:\d{2}(:\d{2}(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})$/i.test(str)) {
    const t = Date.parse(str);
    if (!isNaN(t)) return t;
  }
  const m = str.match(/(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})\.?(?:[\sT]+(오전|오후|AM|PM)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(오전|오후|AM|PM)?)?/i);
  if (!m) return NaN;
  const [, y, mo, d, ap1, hh, mm, ss, ap2] = m;
  let hour = hh ? parseInt(hh, 10) : 0;
  const ampm = (ap1 || ap2 || '').toUpperCase();
  if ((ampm === '오후' || ampm === 'PM') && hour < 12) hour += 12;
  if ((ampm === '오전' || ampm === 'AM') && hour === 12) hour = 0;
  return schoolWallTimeToMs(parseInt(y, 10), parseInt(mo, 10), parseInt(d, 10), hour, mm ? parseInt(mm, 10) : 0, ss ? parseInt(ss, 10) : 0, timeZone);
}

/** 절대 시각(ms) → 학교 현지 'YYYY-MM-DD HH:mm:ss' 문자열 (타이머 저장 형식) */
export function formatSchoolDateTime(ms: number, timeZone = SCHOOL_TIME_ZONE): string {
  const shifted = new Date(ms + getTimeZoneOffsetMs(timeZone, ms));
  return shifted.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * 마스터 상태 + 개시/마감 시각 기준으로 지금 수강신청이 가능한지 판정.
 * nowMs는 반드시 서버(인터넷) 시각을 넘긴다: 서버 API는 Date.now(), 화면은 getServerNowMs().
 */
export function isAfterschoolApplyOpen(
  config: Partial<GlobalTimerConfig> | null | undefined,
  nowMs: number
): boolean {
  const status = config?.masterStatus || 'AUTO';
  if (status === 'FORCE_LOCK' || status === 'PAUSED') return false;
  if (status === 'FORCE_OPEN') return true;
  const start = parseSchoolDateMs(config?.startTime);
  const end = parseSchoolDateMs(config?.endTime);
  if (!isNaN(start) && nowMs < start) return false;
  if (!isNaN(end) && nowMs > end) return false;
  return true;
}

/**
 * 수강신청 문서 고정 ID: 강좌 + 학생 1건만 존재하도록 강제하여
 * 더블클릭/다중 기기 중복 신청과 Date.now() 기반 ID 충돌(덮어쓰기)을 DB 차원에서 차단한다.
 */
export function buildAfterschoolEnrollmentId(courseId: string, studentId: string): string {
  const safe = (v: string) => String(v || '').trim().replace(/[\/\s]+/g, '_');
  return `${safe(courseId)}__${safe(studentId)}`;
}

/** 로그인 프로필 기준 방과후 학생 식별자 (StudentView와 학부모 페이지 구독 범위가 같은 기준을 쓰도록 공유) */
export function getAfterschoolStudentIdentity(profile: any): {
  studentId: string;
  studentName: string;
  matchIds: string[];
} {
  const studentName = String(profile?.studentName || profile?.name || '').trim();
  const grade = profile?.studentGrade || profile?.grade || '1';
  const classNum = profile?.studentClass || profile?.class || '1';
  const number = profile?.studentNumber || profile?.number || '';
  // 자녀 고유 식별자: 학부모 UID 단독 사용을 배제하고 학년-반-번호-이름 복합 고유 키 또는 학생 이메일 우선 사용 (다자녀 중복 신청 충돌 방지)
  const studentId = (profile?.role === 'student' && profile?.email)
    ? String(profile.email).toLowerCase()
    : `s_${grade}_${classNum}_${number || '0'}_${studentName || profile?.email || 'student'}`;
  const matchIds = Array.from(new Set([studentId, profile?.uid, profile?.email].filter(Boolean).map(String)));
  return { studentId, studentName, matchIds };
}
