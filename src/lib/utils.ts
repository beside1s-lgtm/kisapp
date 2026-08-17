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

export function getWorkingDaysCount(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (start > end) return 0;
  
  let count = 0;
  let curr = new Date(start);
  
  while (curr <= end) {
    const day = curr.getDay(); // 일요일(0), 토요일(6) 제외
    if (day !== 0 && day !== 6) {
      count++;
    }
    curr.setDate(curr.getDate() + 1);
  }
  
  return count;
}

export function generateAcademicIcsFile(academicCal: any, isParentUser = false): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KSHCM//Academic Calendar//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:한국초등학교 학사 일정',
    'X-WR-TIMEZONE:Asia/Ho_Chi_Minh'
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

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
