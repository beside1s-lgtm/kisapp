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

/** 마스터 상태 + 개시/마감 시각 기준으로 지금 수강신청이 가능한지 판정 */
export function isAfterschoolApplyOpen(
  config: Partial<GlobalTimerConfig> | null | undefined,
  nowMs: number = Date.now()
): boolean {
  const status = config?.masterStatus || 'AUTO';
  if (status === 'FORCE_LOCK' || status === 'PAUSED') return false;
  if (status === 'FORCE_OPEN') return true;
  const start = safeParseDate(config?.startTime).getTime();
  const end = safeParseDate(config?.endTime).getTime();
  return !(nowMs < start) && !(nowMs > end);
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
