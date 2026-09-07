import type { RoutineScheduleConfig } from './types';

/**
 * 주어진 기준일(now)에 대해 해당 루틴 업무의 이번 주기 시작일 및 마감일을 계산합니다.
 */
export function calculateCurrentRoutineCycle(
  config?: RoutineScheduleConfig,
  baseDate: Date = new Date()
): {
  cycleStart: Date;
  cycleDeadline: Date;
  isCurrentCycleActive: boolean; // 주초/월초 등 알람 활성 상태 (예: 이번 주기 진행 중)
  reminderText: string;
} {
  const now = new Date(baseDate);
  const nowTime = now.getTime();

  if (!config) {
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    return {
      cycleStart: now,
      cycleDeadline: end,
      isCurrentCycleActive: true,
      reminderText: '상시 업무'
    };
  }

  const duration = config.durationDays || (config.cycle === 'weekly' ? 5 : 7);

  if (config.cycle === 'weekly') {
    // 0: 일, 1: 월, 2: 화, 3: 수, 4: 목, 5: 금, 6: 토
    const targetDay = config.dayOfWeek !== undefined ? config.dayOfWeek : 1; // 기본 월요일(1)
    const currentDay = now.getDay();
    
    // 이번 주의 targetDay 날짜 찾기
    // 월요일 기준으로 이번 주 월요일:
    const diff = currentDay - targetDay;
    const cycleStart = new Date(now);
    cycleStart.setDate(now.getDate() - diff);
    cycleStart.setHours(0, 0, 0, 0);

    // 만약 오늘이 targetDay보다 이전이면 (예: 일요일이거나 이전 주말)
    // 주간 루틴은 보통 월요일 시작
    const cycleDeadline = new Date(cycleStart);
    cycleDeadline.setDate(cycleStart.getDate() + duration);
    cycleDeadline.setHours(23, 59, 59, 999);

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const targetDayName = dayNames[targetDay] || '월';

    // 활성 상태: 현재 날짜가 주기 시작일과 마감일 사이
    const isCurrentCycleActive = nowTime >= cycleStart.getTime() && nowTime <= cycleDeadline.getTime();

    return {
      cycleStart,
      cycleDeadline,
      isCurrentCycleActive,
      reminderText: `매주 ${targetDayName}요일 루틴 (${duration}일간 제출)`
    };
  } else {
    // 월간
    const targetDay = Math.max(1, Math.min(31, config.dayOfMonth || 1));
    const year = now.getFullYear();
    const month = now.getMonth();

    const cycleStart = new Date(year, month, targetDay, 0, 0, 0, 0);
    const cycleDeadline = new Date(cycleStart);
    cycleDeadline.setDate(cycleStart.getDate() + duration);
    cycleDeadline.setHours(23, 59, 59, 999);

    const isCurrentCycleActive = nowTime >= cycleStart.getTime() && nowTime <= cycleDeadline.getTime();

    return {
      cycleStart,
      cycleDeadline,
      isCurrentCycleActive,
      reminderText: `매월 ${targetDay}일 루틴 (${duration}일간 제출)`
    };
  }
}

/**
 * Date 객체를 YYYY-MM-DD 형식 문자열로 변환
 */
export function formatDateToYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
