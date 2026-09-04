export interface ScheduleDay {
  dayIndex: number;        // 회차 (1회차, 2회차, 3회차...)
  dateStr: string;         // "03/30(월)"
  fullDate: string;        // "2026-03-30"
  startSessionNo: number;  // 시작 차시 (e.g. 1차시)
  endSessionNo: number;    // 종료 차시 (e.g. 2차시)
  sessionNos: number[];    // [1, 2]
}

/**
 * 학사일정 events 목록에서 기간형(date ~ endDate) 및 단일 일자의 공휴일/휴업일 날짜(YYYY-MM-DD)를 완벽 전개하여 추출
 */
export function extractHolidayDatesFromEvents(events: Array<any> = []): string[] {
  const holidaySet = new Set<string>();

  (events || []).forEach(ev => {
    if (!ev) return;
    const isHoliday = !ev.isSchoolDay || ev.type === 'HOLIDAY' || ev.type === 'PUBLIC_HOLIDAY';
    if (!isHoliday) return;

    const startStr = ev.date;
    const endStr = ev.endDate || ev.date;

    if (!startStr) return;

    if (!endStr || startStr === endStr) {
      holidaySet.add(startStr);
      return;
    }

    let cur = new Date(startStr.replace(' ', 'T'));
    const end = new Date(endStr.replace(' ', 'T'));
    if (isNaN(cur.getTime()) || isNaN(end.getTime())) {
      holidaySet.add(startStr);
      if (endStr) holidaySet.add(endStr);
      return;
    }

    end.setHours(23, 59, 59, 999);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      holidaySet.add(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
    }
  });

  return Array.from(holidaySet).sort();
}

export function generateCalendarSchedule(
  startDateStr: string = '2026-03-30',
  operatingWeeks: number = 10,
  classDays: string[] = ['월'],
  sessionsPerClass: number = 2,
  holidayDates?: string[] | Set<string>
): ScheduleDay[] {
  const dayNameMap: { [key: number]: string } = {
    0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토'
  };

  const normalizedDays = (classDays && classDays.length > 0) ? classDays : ['월'];
  const holidaySet = holidayDates instanceof Set ? holidayDates : new Set(holidayDates || []);
  const schedule: ScheduleDay[] = [];

  let start = new Date(startDateStr.replace(' ', 'T'));
  if (isNaN(start.getTime())) {
    start = new Date('2026-03-30');
  }

  let current = new Date(start);
  let sessionCounter = 1;
  let dayCounter = 1;

  // 총 회차 수 = 주수 × 주당 수업 요일 개수
  const targetTotalDays = operatingWeeks * normalizedDays.length;
  const maxDaysToSearch = 365;
  let count = 0;

  while (schedule.length < targetTotalDays && count < maxDaysToSearch) {
    const dayOfWeek = dayNameMap[current.getDay()];
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const date = String(current.getDate()).padStart(2, '0');
    const fullDate = `${current.getFullYear()}-${month}-${date}`;

    if (normalizedDays.includes(dayOfWeek) && !holidaySet.has(fullDate)) {
      const dateStr = `${month}/${date}(${dayOfWeek})`;

      const sessionNos: number[] = [];
      for (let s = 0; s < sessionsPerClass; s++) {
        sessionNos.push(sessionCounter + s);
      }

      schedule.push({
        dayIndex: dayCounter,
        dateStr,
        fullDate,
        startSessionNo: sessionCounter,
        endSessionNo: sessionCounter + sessionsPerClass - 1,
        sessionNos,
      });

      sessionCounter += sessionsPerClass;
      dayCounter++;
    }

    current.setDate(current.getDate() + 1);
    count++;
  }

  return schedule;
}

/**
 * 운영 기간(startDate ~ endDate) + 수업 요일 기반으로 달력 스케줄 생성 [이슈 4]
 * - 마스터 설정의 operatingStartDate ~ operatingEndDate 및 allowedDays를 그대로 반영
 * - 학사일정 공휴일/휴업일(holidayDates) 자동 제외 지원
 */
export function generateCalendarScheduleByDateRange(
  startDateStr: string,
  endDateStr: string,
  classDays: string[] = ['월'],
  sessionsPerClass: number = 2,
  holidayDates?: string[] | Set<string>
): ScheduleDay[] {
  const dayNameMap: { [key: number]: string } = {
    0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토'
  };

  const normalizedDays = (classDays && classDays.length > 0) ? classDays : ['월'];
  const holidaySet = holidayDates instanceof Set ? holidayDates : new Set(holidayDates || []);
  const schedule: ScheduleDay[] = [];

  let start = new Date(startDateStr.replace(' ', 'T'));
  let end = new Date(endDateStr.replace(' ', 'T'));

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return [];
  }

  // 종료일을 하루 끝 시각으로 맞춤 (포함 처리)
  end.setHours(23, 59, 59, 999);

  let current = new Date(start);
  let sessionCounter = 1;
  let dayCounter = 1;

  while (current <= end) {
    const dayOfWeek = dayNameMap[current.getDay()];
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const date = String(current.getDate()).padStart(2, '0');
    const fullDate = `${current.getFullYear()}-${month}-${date}`;

    // 해당 요일이 수업 요일이고 학사일정 공휴일이 아닌 경우에만 포함
    if (normalizedDays.includes(dayOfWeek) && !holidaySet.has(fullDate)) {
      const dateStr = `${month}/${date}(${dayOfWeek})`;

      const sessionNos: number[] = [];
      for (let s = 0; s < sessionsPerClass; s++) {
        sessionNos.push(sessionCounter + s);
      }

      schedule.push({
        dayIndex: dayCounter,
        dateStr,
        fullDate,
        startSessionNo: sessionCounter,
        endSessionNo: sessionCounter + sessionsPerClass - 1,
        sessionNos,
      });

      sessionCounter += sessionsPerClass;
      dayCounter++;
    }

    current.setDate(current.getDate() + 1);
  }

  return schedule;
}

/**
 * 운영 기간 내 실제 수업 일수 카운트 [이슈 3 - 수강료 계산식에 사용]
 * 총 수강료 = sessionsPerClass × countOperatingDays × tuitionPerSession
 * - 학사일정 공휴일/휴업일(holidayDates) 자동 제외 지원
 */
export function countOperatingDays(
  startDateStr: string,
  endDateStr: string,
  classDays: string[] = ['월'],
  holidayDates?: string[] | Set<string>
): number {
  const dayNameMap: { [key: number]: string } = {
    0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토'
  };

  const normalizedDays = (classDays && classDays.length > 0) ? classDays : ['월'];
  const holidaySet = holidayDates instanceof Set ? holidayDates : new Set(holidayDates || []);

  let start = new Date(startDateStr.replace(' ', 'T'));
  let end = new Date(endDateStr.replace(' ', 'T'));

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

  end.setHours(23, 59, 59, 999);

  let count = 0;
  let current = new Date(start);
  while (current <= end) {
    const dayOfWeek = dayNameMap[current.getDay()];
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const date = String(current.getDate()).padStart(2, '0');
    const fullDate = `${current.getFullYear()}-${month}-${date}`;

    if (normalizedDays.includes(dayOfWeek) && !holidaySet.has(fullDate)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * 운영 기간 및 휴업일을 고려한 실제 수업 운영 주수 및 요일별 수업 횟수 자동 산출
 */
export function calculateRealOperatingWeeksAndDays(
  startDateStr: string,
  endDateStr: string,
  classDays: string[] = ['월', '화', '수', '목', '금'],
  holidayDates?: string[] | Set<string>
): {
  operatingWeeks: number;
  totalDays: number;
  daysByWeekday: Record<string, number>;
} {
  const dayNameMap: { [key: number]: string } = {
    0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토'
  };

  const normalizedDays = (classDays && classDays.length > 0) ? classDays : ['월', '화', '수', '목', '금'];
  const holidaySet = holidayDates instanceof Set ? holidayDates : new Set(holidayDates || []);
  const daysByWeekday: Record<string, number> = {};
  normalizedDays.forEach(d => { daysByWeekday[d] = 0; });

  let start = new Date(startDateStr.replace(' ', 'T'));
  let end = new Date(endDateStr.replace(' ', 'T'));

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return { operatingWeeks: 0, totalDays: 0, daysByWeekday };
  }

  end.setHours(23, 59, 59, 999);

  let totalDays = 0;
  let current = new Date(start);

  while (current <= end) {
    const dayOfWeek = dayNameMap[current.getDay()];
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const date = String(current.getDate()).padStart(2, '0');
    const fullDate = `${current.getFullYear()}-${month}-${date}`;

    if (normalizedDays.includes(dayOfWeek) && !holidaySet.has(fullDate)) {
      daysByWeekday[dayOfWeek] = (daysByWeekday[dayOfWeek] || 0) + 1;
      totalDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  // 평균 주수 (또는 가장 많은 요일 기준 주수)
  const maxDayCount = Math.max(0, ...Object.values(daysByWeekday));
  const operatingWeeks = maxDayCount;

  return {
    operatingWeeks,
    totalDays,
    daysByWeekday
  };
}

/**
 * 개별 강좌의 회당 차시 수(sessionsPerClass) 자동 판별
 * 1) 강좌 자체의 sessionsPerClass (명시적 지정)
 * 2) 강좌의 selectedPeriods 배열 길이 (엑셀 일괄 등록 등 교시 선택)
 * 3) classTime 텍스트 파싱 (예: "08:30 ~ 11:40 (1~4차시)" -> 4차시)
 * 4) fallback (마스터 설정 등 기본값)
 */
export function getCourseSessionsPerClass(course: any, fallback: number = 2): number {
  if (!course) return fallback;

  // 1. selectedPeriods 배열이 있는 경우 그 길이 우선 사용 (교시 선택 정보)
  if (Array.isArray(course.selectedPeriods) && course.selectedPeriods.length > 0) {
    return course.selectedPeriods.length;
  }

  // 2. classTime 텍스트에서 차시 범위 추출 (예: "08:30 ~ 11:40 (1~4차시)", "(1-4차시)")
  if (typeof course.classTime === 'string') {
    const rangeMatch = course.classTime.match(/(\d+)\s*[~-]\s*(\d+)\s*차시/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        return end - start + 1;
      }
    }

    const commaMatch = course.classTime.match(/([\d,\s]+)\s*차시/);
    if (commaMatch) {
      const nums = commaMatch[1].split(',').map((n: string) => parseInt(n.trim(), 10)).filter((n: number) => !isNaN(n));
      if (nums.length > 0) return nums.length;
    }
  }

  // 3. 강좌 객체에 sessionsPerClass가 명시되어 있고 0보다 크면 사용
  if (typeof course.sessionsPerClass === 'number' && course.sessionsPerClass > 0) {
    return course.sessionsPerClass;
  }

  return fallback;
}

