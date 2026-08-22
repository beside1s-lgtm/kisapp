import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const compressImage = (base64Str: string, maxWidth = 200): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png', 0.7)); // Adjusted quality
      } else {
        // Fallback to original if canvas fails
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      // Resolve with original string on error
      resolve(base64Str);
    }
  });
};

export interface ExcludedDayInfo {
  date: string;
  reason: string;
  type: 'weekend' | 'holiday' | 'vacation';
}

/**
 * 시작일(YYYY-MM-DD)부터 종료일(YYYY-MM-DD)까지
 * 주말(토, 일) 및 학사일정 상 학교 휴업일(공휴일, 재량휴업일, 방학 등)을 제외한 실제 수업일수(출석일수)를 계산합니다.
 */
export function getWorkingDaysCount(
  startDateStr: string,
  endDateStr: string,
  calendarConfig?: any
): number {
  if (!startDateStr || !endDateStr) return 0;
  const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);
  const [eYear, eMonth, eDay] = endDateStr.split('-').map(Number);
  if (!sYear || !sMonth || !sDay || !eYear || !eMonth || !eDay) return 0;

  const start = new Date(sYear, sMonth - 1, sDay);
  const end = new Date(eYear, eMonth - 1, eDay);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

  // 학사일정 events 매핑 (수업일이 아니거나 HOLIDAY / PUBLIC_HOLIDAY 인 날짜)
  const holidaySet = new Set<string>();
  if (calendarConfig?.events && Array.isArray(calendarConfig.events)) {
    calendarConfig.events.forEach((e: any) => {
      if (e && e.date) {
        if (e.isSchoolDay === false || e.type === 'HOLIDAY' || e.type === 'PUBLIC_HOLIDAY') {
          holidaySet.add(e.date);
        }
      }
    });
  }

  const vacationSummer = calendarConfig?.semesters?.vacationSummer;
  const vacationWinter = calendarConfig?.semesters?.vacationWinter;

  let count = 0;
  let curr = new Date(start);

  while (curr <= end) {
    const day = curr.getDay(); // 0=Sun, 6=Sat
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    const dateKey = `${yyyy}-${mm}-${dd}`;

    const isWeekend = day === 0 || day === 6;
    const isHoliday = holidaySet.has(dateKey);
    const isSummerVacation = vacationSummer?.startDate && vacationSummer?.endDate && dateKey >= vacationSummer.startDate && dateKey <= vacationSummer.endDate;
    const isWinterVacation = vacationWinter?.startDate && vacationWinter?.endDate && dateKey >= vacationWinter.startDate && dateKey <= vacationWinter.endDate;
    const isVacation = !!(isSummerVacation || isWinterVacation);

    if (!isWeekend && !isHoliday && !isVacation) {
      count++;
    }
    curr.setDate(curr.getDate() + 1);
  }

  return count;
}

/**
 * 날짜 범위 내에서 제외된 주말, 공휴일, 방학일 등의 상세 내역을 반환합니다.
 */
export function getExcludedDaysInRange(
  startDateStr: string,
  endDateStr: string,
  calendarConfig?: any
): ExcludedDayInfo[] {
  if (!startDateStr || !endDateStr) return [];
  const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);
  const [eYear, eMonth, eDay] = endDateStr.split('-').map(Number);
  if (!sYear || !sMonth || !sDay || !eYear || !eMonth || !eDay) return [];

  const start = new Date(sYear, sMonth - 1, sDay);
  const end = new Date(eYear, eMonth - 1, eDay);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

  const holidayMap = new Map<string, string>();
  if (calendarConfig?.events && Array.isArray(calendarConfig.events)) {
    calendarConfig.events.forEach((e: any) => {
      if (e && e.date && (e.isSchoolDay === false || e.type === 'HOLIDAY' || e.type === 'PUBLIC_HOLIDAY')) {
        holidayMap.set(e.date, e.title || '학교 휴업일');
      }
    });
  }

  const vacationSummer = calendarConfig?.semesters?.vacationSummer;
  const vacationWinter = calendarConfig?.semesters?.vacationWinter;

  const excluded: ExcludedDayInfo[] = [];
  let curr = new Date(start);

  while (curr <= end) {
    const day = curr.getDay();
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    const dateKey = `${yyyy}-${mm}-${dd}`;

    if (day === 0 || day === 6) {
      excluded.push({ date: dateKey, reason: day === 0 ? '일요일' : '토요일', type: 'weekend' });
    } else if (holidayMap.has(dateKey)) {
      excluded.push({ date: dateKey, reason: holidayMap.get(dateKey)!, type: 'holiday' });
    } else if (vacationSummer?.startDate && vacationSummer?.endDate && dateKey >= vacationSummer.startDate && dateKey <= vacationSummer.endDate) {
      excluded.push({ date: dateKey, reason: vacationSummer.name || '여름방학', type: 'vacation' });
    } else if (vacationWinter?.startDate && vacationWinter?.endDate && dateKey >= vacationWinter.startDate && dateKey <= vacationWinter.endDate) {
      excluded.push({ date: dateKey, reason: vacationWinter.name || '겨울방학', type: 'vacation' });
    }
    curr.setDate(curr.getDate() + 1);
  }

  return excluded;
}

export interface GateDutyIcsSlot {
  dateStr: string;
  dayOfWeekName?: string;
  semesterName?: string;
  startTime?: string;
  endTime?: string;
  roundNumber?: number;
}

export interface GateDutyIcsOption {
  includeGateDuty?: boolean;
  teacherName?: string;
  dutySlots?: GateDutyIcsSlot[];
}

export function generateAcademicIcsFile(
  academicCal: any, 
  isParentUser = false,
  gateDutyOption?: GateDutyIcsOption
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KSHCM//Academic Calendar//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:호치민시한국국제학교 학사 및 근무 일정',
    'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Ho_Chi_Minh',
    'X-LIC-LOCATION:Asia/Ho_Chi_Minh',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0700',
    'TZOFFSETTO:+0700',
    'TZNAME:+07',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  const formatIcsDate = (dateStr: string) => dateStr.replace(/-/g, '');

  if (academicCal?.semesters) {
    const sMap: Record<string, string> = {
      sem1: '2026학년도 1학기 운영 기간',
      vacationSummer: '2026학년도 여름방학 운영 기간',
      sem2: '2026학년도 2학기 운영 기간',
      vacationWinter: '2027학년도 겨울방학 운영 기간'
    };
    Object.entries(academicCal.semesters).forEach(([key, sem]: [string, any]) => {
      if (sem?.startDate && sem?.endDate) {
        const start = formatIcsDate(sem.startDate);
        const endDateObj = new Date(sem.endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        const end = endDateObj.toISOString().split('T')[0].replace(/-/g, '');

        lines.push(
          'BEGIN:VEVENT',
          `UID:sem-${key}-${start}@kshcm.school`,
          `SUMMARY:[학사일정] ${sem.name || sMap[key] || '학기'}`,
          `DTSTART;VALUE=DATE:${start}`,
          `DTEND;VALUE=DATE:${end}`,
          `DESCRIPTION:학교 공식 ${sem.name || '운영 기간'}입니다.`,
          'STATUS:CONFIRMED',
          'END:VEVENT'
        );
      }
    });
  }

  if (academicCal?.events && Array.isArray(academicCal.events)) {
    academicCal.events.forEach((ev: any) => {
      // 학부모 계정일 경우 학부모 비공개(isParentPrivate) 항목 제외
      if (isParentUser && ev?.isParentPrivate) return;

      if (ev?.date && ev?.title) {
        const start = formatIcsDate(ev.date);
        const endDateObj = new Date(ev.date);
        endDateObj.setDate(endDateObj.getDate() + 1);
        const end = endDateObj.toISOString().split('T')[0].replace(/-/g, '');
        const category = ev.type === 'PUBLIC_HOLIDAY' ? '법정공휴일' : ev.type === 'HOLIDAY' ? '재량휴업일' : '학교행사';

        lines.push(
          'BEGIN:VEVENT',
          `UID:ev-${ev.id || start}-${start}@kshcm.school`,
          `SUMMARY:[${category}] ${ev.title}`,
          `DTSTART;VALUE=DATE:${start}`,
          `DTEND;VALUE=DATE:${end}`,
          `DESCRIPTION:구분: ${category} (수업일 ${ev.isSchoolDay ? '포함' : '제외'})`,
          'STATUS:CONFIRMED',
          'END:VEVENT'
        );
      }
    });
  }

  // 3. Personalized Morning Gate Duty Events (개인별 등교지도 근무 일정)
  if (gateDutyOption?.includeGateDuty && gateDutyOption?.dutySlots && gateDutyOption.dutySlots.length > 0) {
    const teacherName = gateDutyOption.teacherName || '선생님';

    gateDutyOption.dutySlots.forEach((slot) => {
      if (!slot.dateStr) return;
      const cleanDate = slot.dateStr.replace(/-/g, ''); // YYYYMMDD
      const startHour = (slot.startTime || '07:40').replace(':', '') + '00'; // 074000
      const endHour = (slot.endTime || '08:20').replace(':', '') + '00';     // 082000

      const dtStart = `${cleanDate}T${startHour}`;
      const dtEnd = `${cleanDate}T${endHour}`;

      lines.push(
        'BEGIN:VEVENT',
        `UID:gateduty-${cleanDate}-${teacherName}@kshcm.school`,
        `SUMMARY:[등교지도] ${teacherName} 선생님 교문 등교 지도 (07:40~08:20)`,
        `DTSTART;TZID=Asia/Ho_Chi_Minh:${dtStart}`,
        `DTEND;TZID=Asia/Ho_Chi_Minh:${dtEnd}`,
        `DESCRIPTION:호치민시한국국제학교 오전 교문 등교지도 근무 시간입니다.\\n· 담당 교사: ${teacherName} 선생님\\n· 일자: ${slot.dateStr} (${slot.dayOfWeekName || ''}) ${slot.roundNumber ? `${slot.roundNumber}회차` : ''}\\n· 근무 시간: 오전 07:40 ~ 08:20 (40분간)\\n· 위치: 정문 교문 및 중앙현관\\n· 학생 이슈 발생 시 학생생활안전부 연락`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:[등교지도 사전알림] 내일(${slot.dateStr}) 오전 07:40 교문 등교지도 근무가 있습니다!`,
        'TRIGGER:-P1D',
        'END:VALARM',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:[등교지도 30분 전] 곧 교문 등교지도(07:40~08:20)가 시작됩니다!`,
        'TRIGGER:-PT30M',
        'END:VALARM',
        'END:VEVENT'
      );
    });
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
