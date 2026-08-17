export interface ScheduleDay {
  dayIndex: number;        // 회차 (1회차, 2회차, 3회차...)
  dateStr: string;         // "03/30(월)"
  fullDate: string;        // "2026-03-30"
  startSessionNo: number;  // 시작 차시 (e.g. 1차시)
  endSessionNo: number;    // 종료 차시 (e.g. 2차시)
  sessionNos: number[];    // [1, 2]
}

export function generateCalendarSchedule(
  startDateStr: string = '2026-03-30',
  operatingWeeks: number = 10,
  classDays: string[] = ['월'],
  sessionsPerClass: number = 2
): ScheduleDay[] {
  const dayNameMap: { [key: number]: string } = {
    0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토'
  };

  const normalizedDays = (classDays && classDays.length > 0) ? classDays : ['월'];
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
    if (normalizedDays.includes(dayOfWeek)) {
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const date = String(current.getDate()).padStart(2, '0');
      const dateStr = `${month}/${date}(${dayOfWeek})`;
      const fullDate = `${current.getFullYear()}-${month}-${date}`;

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
 */
export function generateCalendarScheduleByDateRange(
  startDateStr: string,
  endDateStr: string,
  classDays: string[] = ['월'],
  sessionsPerClass: number = 2
): ScheduleDay[] {
  const dayNameMap: { [key: number]: string } = {
    0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토'
  };

  const normalizedDays = (classDays && classDays.length > 0) ? classDays : ['월'];
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
    if (normalizedDays.includes(dayOfWeek)) {
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const date = String(current.getDate()).padStart(2, '0');
      const dateStr = `${month}/${date}(${dayOfWeek})`;
      const fullDate = `${current.getFullYear()}-${month}-${date}`;

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
 */
export function countOperatingDays(
  startDateStr: string,
  endDateStr: string,
  classDays: string[] = ['월']
): number {
  const dayNameMap: { [key: number]: string } = {
    0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토'
  };

  const normalizedDays = (classDays && classDays.length > 0) ? classDays : ['월'];

  let start = new Date(startDateStr.replace(' ', 'T'));
  let end = new Date(endDateStr.replace(' ', 'T'));

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

  end.setHours(23, 59, 59, 999);

  let count = 0;
  let current = new Date(start);
  while (current <= end) {
    const dayOfWeek = dayNameMap[current.getDay()];
    if (normalizedDays.includes(dayOfWeek)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
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

