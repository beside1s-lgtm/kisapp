import type { SyllabusSession } from './types';
import type { AcademicEvent } from '@/lib/types';

const DAY_MAP: Record<string, number> = {
  '일': 0,
  '월': 1,
  '화': 2,
  '수': 3,
  '목': 4,
  '금': 5,
  '토': 6,
  'Sun': 0,
  'Mon': 1,
  'Tue': 2,
  'Wed': 3,
  'Thu': 4,
  'Fri': 5,
  'Sat': 6,
};

/**
 * 1회 수업 시간(또는 템플릿 라벨)을 기반으로 하루당 차시 수(sessionsPerLesson) 추론
 * 예: "08:30~11:40" (3시간 이상) 또는 "1~4차시" -> 4차시
 * 예: "15:00~16:30" (80~90분) 또는 "1~2차시", "3~4차시" -> 2차시
 * 예: 40~45분 -> 1차시
 */
export function inferSessionsPerLesson(
  timeSlotLabel?: string,
  timeStart?: string,
  timeEnd?: string,
  defaultSessions = 2
): number {
  if (timeSlotLabel) {
    if (timeSlotLabel.includes('1~4') || timeSlotLabel.includes('통합')) return 4;
    if (timeSlotLabel.includes('1~2') || timeSlotLabel.includes('3~4')) return 2;
  }

  if (timeStart && timeEnd) {
    try {
      const [sh, sm] = timeStart.split(':').map(Number);
      const [eh, em] = timeEnd.split(':').map(Number);
      const diffMins = (eh * 60 + em) - (sh * 60 + sm);
      if (diffMins >= 150) return 4; // 2시간 30분 이상 (통합 4차시)
      if (diffMins >= 70) return 2;  // 70분 이상 (2차시 블록)
      return 1;
    } catch {
      return defaultSessions;
    }
  }

  return defaultSessions;
}

/**
 * 관리자가 설정한 기간 및 학사일정(휴일 제외)과 강사의 선택 요일에 맞춰
 * 모든 강좌가 동일한 기간 내에 완벽하게 시작/종료되도록 수업일자와 차시를 자동 계산
 */
export function calculateCourseSessionDates(options: {
  operatingStartDate?: string;       // e.g. "2026-03-30"
  operatingEndDate?: string;         // e.g. "2026-06-20"
  selectedDays: string[];            // e.g. ["월", "수"]
  sessionsPerLesson?: number;        // 1회당 차시 수 (기본 2차시 또는 4차시)
  events?: AcademicEvent[];          // 학사일정 휴일 목록
  targetWeeks?: number;              // 목표 운영 주수 (기본 10주)
  existingTopics?: (string | undefined)[]; // 기존 주제 복사 시 매핑
}): SyllabusSession[] {
  const {
    operatingStartDate = '2026-03-30',
    operatingEndDate = '2026-06-20',
    selectedDays,
    sessionsPerLesson = 2,
    events = [],
    targetWeeks = 10,
    existingTopics = [],
  } = options;

  if (!selectedDays || selectedDays.length === 0) {
    return [];
  }

  // 1. 요일 숫자 매핑 (0~6)
  const targetDayNumbers = selectedDays
    .map((d) => DAY_MAP[d])
    .filter((n) => n !== undefined);

  if (targetDayNumbers.length === 0) return [];

  // 2. 휴일 및 비수업일 Set 구축 (YYYY-MM-DD)
  const holidayDateSet = new Set<string>();
  events.forEach((ev) => {
    const typeLower = String(ev.type || '').toLowerCase();
    if (typeLower.includes('holiday') || typeLower.includes('discretionary') || ev.isSchoolDay === false) {
      if (ev.date) {
        holidayDateSet.add(ev.date.trim());
      }
    }
  });

  // 3. 시작일 ~ 종료일 순회하며 수업 가능한 유효 날짜 수집
  const start = new Date(operatingStartDate);
  const end = new Date(operatingEndDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [];
  }

  const lessonDates: string[] = []; // YYYY-MM-DD
  const cur = new Date(start);

  while (cur <= end) {
    const dayOfWeek = cur.getDay();
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // 선택 요일에 해당하고 학사일정 휴일이 아닌 경우
    if (targetDayNumbers.includes(dayOfWeek) && !holidayDateSet.has(dateStr)) {
      lessonDates.push(dateStr);
    }

    cur.setDate(cur.getDate() + 1);
  }

  // 4. 차시 목록 생성
  // 하루에 sessionsPerLesson 만큼의 차시가 진행됨
  const sessions: SyllabusSession[] = [];
  let currentSessionNo = 1;

  lessonDates.forEach((fullDate) => {
    // MM/DD 표기 형식
    const parts = fullDate.split('-');
    const displayDate = parts.length === 3 ? `${parts[1]}/${parts[2]}` : fullDate;

    for (let p = 0; p < sessionsPerLesson; p++) {
      const topicIndex = currentSessionNo - 1;
      const topic =
        (existingTopics[topicIndex] && existingTopics[topicIndex]?.trim()) ||
        `${currentSessionNo}차시 수업계획 및 학습활동`;

      sessions.push({
        sessionNo: currentSessionNo,
        dateStr: displayDate,
        topic,
      });

      currentSessionNo++;
    }
  });

  return sessions;
}
