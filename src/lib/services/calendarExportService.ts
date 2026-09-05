import type { DepartmentTask, DepartmentWeeklySchedule, AcademicEvent } from '@/lib/types';

/**
 * .ics 포맷 날짜 유틸리티
 */
function formatDateToIcsDateOnly(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function getNextDayIcsDateOnly(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr.replace(/-/g, '');
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * 캘린더 파일 (.ics) 브라우저 다운로드
 */
export function downloadIcsFile(icsContent: string, filename: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.ics') ? filename : `${filename}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * 나에게 할당된 업무의 마감기한 오전 08:30 알림 포함 ICS 생성
 */
export function generateAssignedTasksIcs(tasks: DepartmentTask[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KSHCM//Assigned Tasks Calendar//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:호치민시한국국제학교 할당 업무 마감 일정',
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

  tasks.forEach((task) => {
    if (!task.deadline) return;
    const cleanDate = formatDateToIcsDateOnly(task.deadline);
    if (!/^\d{8}$/.test(cleanDate)) return;

    const dtStart = `${cleanDate}T083000`;
    const dtEnd = `${cleanDate}T090000`;
    const nowIso = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const safeTitle = (task.title || '업무 마감').replace(/\r?\n/g, ' ');
    const safeDept = (task.creatorDept || '부서').replace(/\r?\n/g, ' ');
    const safeCreator = (task.creatorName || '요청자').replace(/\r?\n/g, ' ');
    const safeDesc = (task.description || '').replace(/\r?\n/g, '\\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:task-${task.id}-${cleanDate}@kshcm.school`,
      `DTSTAMP:${nowIso}`,
      `SUMMARY:[업무마감] ${safeTitle}`,
      `DTSTART;TZID=Asia/Ho_Chi_Minh:${dtStart}`,
      `DTEND;TZID=Asia/Ho_Chi_Minh:${dtEnd}`,
      `DESCRIPTION:· 부서: ${safeDept}\\n· 요청자: ${safeCreator}\\n· 마감기한: ${task.deadline}\\n· 내용: ${safeDesc}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:[업무마감 알림] 오늘(${task.deadline})은 '${safeTitle}' 업무 마감일입니다.`,
      'TRIGGER:-PT0M',
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:[업무마감 사전알림] 내일(${task.deadline})은 '${safeTitle}' 업무 마감일입니다.`,
      'TRIGGER:-P1D',
      'END:VALARM',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export interface WeeklyMonthlyExportOptions {
  weeklySchedules?: DepartmentWeeklySchedule[];
  academicEvents?: AcademicEvent[];
  includeWeekly: boolean;
  includeMonthly: boolean;
  includeAlarm?: boolean;
}

/**
 * 주간/월간 업무 및 학사 일정 ICS 생성
 */
export function generateWeeklyMonthlyIcs(options: WeeklyMonthlyExportOptions): string {
  const {
    weeklySchedules = [],
    academicEvents = [],
    includeWeekly = true,
    includeMonthly = true,
    includeAlarm = true
  } = options;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KSHCM//School Schedules Calendar//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:호치민시한국국제학교 주간 및 월간 교육일정',
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

  const nowIso = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // 1. 주간 부서/학년 업무 일정
  if (includeWeekly && weeklySchedules.length > 0) {
    weeklySchedules.forEach((item) => {
      if (!item.startDate) return;
      const startClean = formatDateToIcsDateOnly(item.startDate);
      const endClean = item.endDate ? getNextDayIcsDateOnly(item.endDate) : getNextDayIcsDateOnly(item.startDate);

      const safeTitle = (item.title || '주간 일정').replace(/\r?\n/g, ' ');
      const safeDept = (item.deptName || '부서').replace(/\r?\n/g, ' ');
      const safeDesc = (item.content || '').replace(/\r?\n/g, '\\n');

      lines.push(
        'BEGIN:VEVENT',
        `UID:weekly-${item.id}-${startClean}@kshcm.school`,
        `DTSTAMP:${nowIso}`,
        `SUMMARY:[주간] [${safeDept}] ${safeTitle}`,
        `DTSTART;VALUE=DATE:${startClean}`,
        `DTEND;VALUE=DATE:${endClean}`,
        `DESCRIPTION:· 부서: ${safeDept}\\n· 기간: ${item.startDate} ~ ${item.endDate || item.startDate}\\n· 내용: ${safeDesc}`,
        'STATUS:CONFIRMED'
      );

      if (includeAlarm) {
        lines.push(
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:[주간일정 알림] 오늘(${item.startDate})부터 '[${safeDept}] ${safeTitle}' 일정이 시작됩니다.`,
          'TRIGGER:-PT0M',
          'END:VALARM'
        );
      }

      lines.push('END:VEVENT');
    });
  }

  // 2. 월간 학사 및 교육활동 일정
  if (includeMonthly && academicEvents.length > 0) {
    academicEvents.forEach((ev) => {
      if (!ev.date || !ev.title) return;
      const startClean = formatDateToIcsDateOnly(ev.date);
      const endClean = getNextDayIcsDateOnly(ev.date);

      const safeTitle = ev.title.replace(/\r?\n/g, ' ');
      const category = ev.type === 'PUBLIC_HOLIDAY' ? '공휴일' : ev.type === 'HOLIDAY' ? '휴업일' : '학사행사';

      lines.push(
        'BEGIN:VEVENT',
        `UID:monthly-${ev.id || startClean}-${startClean}@kshcm.school`,
        `DTSTAMP:${nowIso}`,
        `SUMMARY:[${category}] ${safeTitle}`,
        `DTSTART;VALUE=DATE:${startClean}`,
        `DTEND;VALUE=DATE:${endClean}`,
        `DESCRIPTION:· 구분: ${category}\\n· 일자: ${ev.date}\\n· 수업일: ${ev.isSchoolDay ? '수업일 포함' : '수업일 제외'}`,
        'STATUS:CONFIRMED'
      );

      if (includeAlarm) {
        lines.push(
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:[학사일정 알림] 오늘(${ev.date})은 '${safeTitle}' (${category}) 일정입니다.`,
          'TRIGGER:-PT0M',
          'END:VALARM'
        );
      }

      lines.push('END:VEVENT');
    });
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
