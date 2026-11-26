import type { Course, Enrollment } from './types';

/**
 * 방과후 동시간대 2순위 대기 판정 규칙 (학생 화면 표시와 서버 신청 API가 같은 규칙을 사용)
 */

export type PeriodGroup = '8~9차시' | '1~2차시' | '3~4차시' | '1~4차시';

export function getCoursePeriodGroup(course: Course): PeriodGroup {
  const classTime = String(course.classTime || '').trim();
  const title = String(course.title || '').trim();
  const period = String(course.period || '').trim();
  const periodSlot = String(course.periodSlot || '').trim();
  const description = String(course.description || '').trim();
  const classDays = Array.isArray(course.classDays) ? course.classDays : [];
  const isSaturday = classDays.some(d => d.includes('토') || d.toLowerCase().includes('sat'));

  const combined = `${classTime} ${period} ${title} ${periodSlot} ${description}`.trim();

  // 1. 8~9차시 (평일 방과후 15:00~16:30 / 15:10~16:30 / 8~9차시 / 8-9차시)
  if (
    combined.includes('8~9') || 
    combined.includes('8-9') || 
    combined.includes('8,9') || 
    combined.includes('8~9차시') || 
    combined.includes('15:10') || 
    combined.includes('15:00') || 
    combined.includes('16:30') ||
    (!isSaturday && !combined.includes('08:30') && !combined.includes('10:10') && !combined.includes('1~4') && !combined.includes('1-4'))
  ) {
    return '8~9차시';
  }

  // 2. 1~4차시 (토요/방학 4차시 통합 / 08:30 ~ 11:40 / 1~4차시 / 전일제)
  if (
    combined.includes('1~4') || 
    combined.includes('1-4') || 
    combined.includes('1~4차시') || 
    combined.includes('11:40') || 
    combined.includes('전일제') || 
    combined.includes('통합')
  ) {
    return '1~4차시';
  }

  // 3. 3~4차시 (토요/방학 10:10 ~ 11:40 / 3~4차시 / 3-4차시)
  if (
    combined.includes('3~4') || 
    combined.includes('3-4') || 
    combined.includes('3~4차시') || 
    combined.includes('10:10')
  ) {
    return '3~4차시';
  }

  // 4. 1~2차시 (토요/방학 08:30 ~ 10:00 / 1~2차시 / 1-2차시)
  if (
    combined.includes('1~2') || 
    combined.includes('1-2') || 
    combined.includes('1~2차시') || 
    combined.includes('08:30') || 
    combined.includes('8:30')
  ) {
    return '1~2차시';
  }

  return isSaturday ? '1~2차시' : '8~9차시';
}

export function cleanClassTime(classTimeStr?: string): string {
  if (!classTimeStr) return '';
  return classTimeStr
    .replace(/\s*\(\s*[0-9]~[0-9]차시\s*\)/g, '')
    .replace(/\s*\(\s*[0-9]-[0-9]차시\s*\)/g, '')
    .replace(/\s*\(\s*전일제\s*\)/g, '')
    .replace(/\s*\(\s*통합\s*\)/g, '')
    .trim();
}

export function shouldForceWaiting(
  targetCourse: Course,
  studentEnrollments: Enrollment[],
  allCourses: Course[]
): { forceWaiting: boolean; reason?: string } {
  const targetPeriodGroup = getCoursePeriodGroup(targetCourse);
  const targetDays = Array.isArray(targetCourse.classDays) ? targetCourse.classDays : ['월'];

  const sortedEnrollments = [...studentEnrollments].sort((a, b) => {
    const tA = a.timestampMs || new Date(a.registrationDate || 0).getTime();
    const tB = b.timestampMs || new Date(b.registrationDate || 0).getTime();
    return tA - tB;
  });

  const appliedDetails = sortedEnrollments.map(e => {
    const c = allCourses.find(course => course.id === e.courseId);
    return {
      enrollment: e,
      course: c,
      periodGroup: c ? getCoursePeriodGroup(c) : '8~9차시',
      classDays: c && Array.isArray(c.classDays) ? c.classDays : ['월'],
    };
  }).filter(item => item.course !== undefined);

  // 1. 토요일: 이미 1~4차시 통합 강좌를 1순위로 신청한 경우 -> 토요 후속 신청은 대기자 처리
  const hasFirstChoice1To4 = appliedDetails.some(item => 
    item.periodGroup === '1~4차시' && item.classDays.some(d => targetDays.includes(d))
  );
  if (hasFirstChoice1To4) {
    return {
      forceWaiting: true,
      reason: '이미 1~4차시 통합 강좌를 신청하셨으므로, 이후 신청 강좌는 대기자 명단으로 등록됩니다.'
    };
  }

  // 2. 토요일: 신청하려는 강좌가 1~4차시인데, 이미 토요일 다른 차시(1~2차시 또는 3~4차시) 강좌를 신청한 경우 -> 대기자 처리
  if (targetPeriodGroup === '1~4차시') {
    const hasSatOther = appliedDetails.some(item => item.classDays.some(d => targetDays.includes(d)));
    if (hasSatOther) {
      return {
        forceWaiting: true,
        reason: '이미 다른 차시(1~2차시/3~4차시) 강좌를 신청하셨으므로, 1~4차시 통합 강좌는 대기자 명단으로 등록됩니다.'
      };
    }
  }

  // 3. 동일 요일 + 동일 차시 그룹(예: 월요일 8~9차시 또는 토요일 1~2차시)에서 이미 1순위 강좌를 신청한 경우 -> 2순위 강좌는 대기자 처리
  const existingInSameSlot = appliedDetails.filter(item => 
    item.periodGroup === targetPeriodGroup && item.classDays.some(d => targetDays.includes(d))
  );
  if (existingInSameSlot.length > 0) {
    return {
      forceWaiting: true,
      reason: `이미 해당 요일 ${targetPeriodGroup} 강좌(${existingInSameSlot[0].course?.title})를 1순위로 신청하셨으므로, 동시간대 2순위 신청 강좌는 대기자 명단으로 등록됩니다.`
    };
  }

  return { forceWaiting: false };
}

/**
 * 정원 외 대기 인원 한도 (실시간 제어실 > 수강신청 제어에서 설정, settings/afterschoolTimer.waitingLimit)
 *  - 없음 또는 음수: 무제한 (기존 동작)
 *  - 0: 대기 신청을 받지 않음 (정원이 차면 마감)
 *  - N: 강좌마다 대기 N명까지
 */
export function getWaitingLimit(cfg: { waitingLimit?: number | null } | null | undefined): number | null {
  const n = Number(cfg?.waitingLimit);
  return cfg?.waitingLimit === undefined || cfg?.waitingLimit === null || isNaN(n) || n < 0 ? null : Math.floor(n);
}

/** 이 강좌의 대기 자리가 다 찼는지 */
export function isWaitlistFull(course: { waitingStudents?: number }, cfg: { waitingLimit?: number | null } | null | undefined): boolean {
  const limit = getWaitingLimit(cfg);
  return limit !== null && (course.waitingStudents || 0) >= limit;
}
