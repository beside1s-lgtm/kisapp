import { getDocConfig, onDocConfigUpdate } from './settingsService';
import type { AcademicCalendarConfig, AcademicSemesterPeriod, AcademicEvent, DocConfig } from '@/lib/types';
import { useState, useEffect } from 'react';

// 기본 2026학년도 학사일정 폴백
export const DEFAULT_ACADEMIC_CALENDAR_CONFIG: AcademicCalendarConfig = {
    year: 2026,
    annualSchoolDays: 190,
    semesters: {
        sem1: { id: 'sem1', name: '1학기', startDate: '2026-03-02', endDate: '2026-07-17', type: 'regular' },
        vacationSummer: { id: 'vacationSummer', name: '여름방학', startDate: '2026-07-18', endDate: '2026-08-16', type: 'vacation' },
        sem2: { id: 'sem2', name: '2학기', startDate: '2026-08-17', endDate: '2027-01-08', type: 'regular' },
        vacationWinter: { id: 'vacationWinter', name: '겨울방학', startDate: '2027-01-09', endDate: '2027-02-28', type: 'vacation' },
    },
    events: [
        { id: '1', date: '2026-03-02', title: '1학기 개학식 및 입학식', type: 'SCHOOL_EVENT', isSchoolDay: true },
        { id: '2', date: '2026-04-30', title: '남부해방기념일', type: 'PUBLIC_HOLIDAY', isSchoolDay: false },
        { id: '3', date: '2026-05-01', title: '국제노동절', type: 'PUBLIC_HOLIDAY', isSchoolDay: false },
        { id: '4', date: '2026-05-05', title: '어린이날', type: 'HOLIDAY', isSchoolDay: false },
        { id: '5', date: '2026-09-02', title: '베트남 국경일', type: 'PUBLIC_HOLIDAY', isSchoolDay: false },
        { id: '6', date: '2026-08-17', title: '2학기 개학일', type: 'SCHOOL_EVENT', isSchoolDay: true },
        { id: '7', date: '2027-01-08', title: '종업식 및 졸업식', type: 'SCHOOL_EVENT', isSchoolDay: true }
    ]
};

export interface CurrentSemesterResult {
    semesterId: 'sem1' | 'vacationSummer' | 'sem2' | 'vacationWinter';
    key: '2026_1' | '2026_summer' | '2026_2' | '2026_winter' | string;
    year: number;
    yearStr: string;
    name: string; // "1학기" | "여름방학" | "2학기" | "겨울방학"
    fullName: string; // "2026학년도 2학기"
    type: 'regular' | 'vacation';
    isVacation: boolean;
    startDate: string;
    endDate: string;
}

/**
 * 날짜 객체 또는 문자열을 'YYYY-MM-DD' 형식으로 정규화
 */
export function formatToDateStr(d?: Date | string): string {
    if (!d) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    if (typeof d === 'string') {
        return d.split('T')[0];
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * 시스템 학사일정 설정(AcademicCalendarConfig)에 따라 실시간 현재 학년도 및 학기/방학을 계산
 */
export function getRealtimeSemesterInfo(
    targetDate?: Date | string,
    calConfig?: AcademicCalendarConfig
): CurrentSemesterResult {
    const cal = calConfig || DEFAULT_ACADEMIC_CALENDAR_CONFIG;
    const dateStr = formatToDateStr(targetDate);
    const year = cal.year || 2026;
    const yearStr = String(year);

    const { sem1, vacationSummer, sem2, vacationWinter } = cal.semesters || DEFAULT_ACADEMIC_CALENDAR_CONFIG.semesters;

    // 1. 여름방학 범위 확인
    if (vacationSummer?.startDate && vacationSummer?.endDate && dateStr >= vacationSummer.startDate && dateStr <= vacationSummer.endDate) {
        return {
            semesterId: 'vacationSummer',
            key: `${yearStr}_summer`,
            year,
            yearStr,
            name: vacationSummer.name || '여름방학',
            fullName: `${yearStr}학년도 ${vacationSummer.name || '여름방학'}`,
            type: 'vacation',
            isVacation: true,
            startDate: vacationSummer.startDate,
            endDate: vacationSummer.endDate
        };
    }

    // 2. 겨울방학 범위 확인
    if (vacationWinter?.startDate && vacationWinter?.endDate && dateStr >= vacationWinter.startDate && dateStr <= vacationWinter.endDate) {
        return {
            semesterId: 'vacationWinter',
            key: `${yearStr}_winter`,
            year,
            yearStr,
            name: vacationWinter.name || '겨울방학',
            fullName: `${yearStr}학년도 ${vacationWinter.name || '겨울방학'}`,
            type: 'vacation',
            isVacation: true,
            startDate: vacationWinter.startDate,
            endDate: vacationWinter.endDate
        };
    }

    // 3. 2학기 범위 확인 (또는 여름방학 이후부터 겨울방학 전까지)
    if (sem2?.startDate && sem2?.endDate) {
        if (dateStr >= sem2.startDate && dateStr <= sem2.endDate) {
            return {
                semesterId: 'sem2',
                key: `${yearStr}_2`,
                year,
                yearStr,
                name: sem2.name || '2학기',
                fullName: `${yearStr}학년도 ${sem2.name || '2학기'}`,
                type: 'regular',
                isVacation: false,
                startDate: sem2.startDate,
                endDate: sem2.endDate
            };
        }
    }

    // 4. 1학기 범위 확인
    if (sem1?.startDate && sem1?.endDate) {
        if (dateStr >= sem1.startDate && dateStr <= sem1.endDate) {
            return {
                semesterId: 'sem1',
                key: `${yearStr}_1`,
                year,
                yearStr,
                name: sem1.name || '1학기',
                fullName: `${yearStr}학년도 ${sem1.name || '1학기'}`,
                type: 'regular',
                isVacation: false,
                startDate: sem1.startDate,
                endDate: sem1.endDate
            };
        }
    }

    // 5. 경계 날짜 처리 (1학기 시작 전이면 1학기로, 여름방학 이후면 2학기로 스마트 배정)
    if (sem1?.startDate && dateStr < sem1.startDate) {
        return {
            semesterId: 'sem1',
            key: `${yearStr}_1`,
            year,
            yearStr,
            name: sem1.name || '1학기',
            fullName: `${yearStr}학년도 ${sem1.name || '1학기'}`,
            type: 'regular',
            isVacation: false,
            startDate: sem1.startDate,
            endDate: sem1.endDate
        };
    }

    // 기본값은 2학기
    return {
        semesterId: 'sem2',
        key: `${yearStr}_2`,
        year,
        yearStr,
        name: sem2?.name || '2학기',
        fullName: `${yearStr}학년도 ${sem2?.name || '2학기'}`,
        type: 'regular',
        isVacation: false,
        startDate: sem2?.startDate || `${yearStr}-08-17`,
        endDate: sem2?.endDate || `${year + 1}-01-08`
    };
}

/**
 * 특정 날짜가 휴업일(주말 포함 또는 수업일수가 아닌 공휴일/재량휴업일)인지 확인
 */
export function checkIsSchoolHoliday(
    targetDate?: Date | string,
    calConfig?: AcademicCalendarConfig
): {
    isHoliday: boolean;
    isWeekend: boolean;
    reason?: string;
    event?: AcademicEvent;
} {
    const cal = calConfig || DEFAULT_ACADEMIC_CALENDAR_CONFIG;
    const dateStr = formatToDateStr(targetDate);
    const dateObj = new Date(dateStr + 'T00:00:00');
    const day = dateObj.getDay();
    const isWeekend = day === 0 || day === 6; // 0=일, 6=토

    // 학사일정 events 매칭
    const matchingEvent = (cal.events || []).find(e => e.date === dateStr);

    if (matchingEvent && (!matchingEvent.isSchoolDay || matchingEvent.type === 'HOLIDAY' || matchingEvent.type === 'PUBLIC_HOLIDAY')) {
        return {
            isHoliday: true,
            isWeekend,
            reason: matchingEvent.title,
            event: matchingEvent
        };
    }

    if (isWeekend) {
        return {
            isHoliday: true,
            isWeekend: true,
            reason: day === 0 ? '일요일' : '토요일',
            event: matchingEvent
        };
    }

    return {
        isHoliday: false,
        isWeekend: false,
        reason: matchingEvent ? matchingEvent.title : undefined,
        event: matchingEvent
    };
}

/**
 * React Component에서 시스템 학사일정을 실시간으로 반영하여
 * 현재 학년도, 학기, 오늘 휴업일 여부 등을 제공하는 커스텀 훅
 */
export function useAcademicCalendar() {
    const [calendarConfig, setCalendarConfig] = useState<AcademicCalendarConfig>(DEFAULT_ACADEMIC_CALENDAR_CONFIG);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsub = onDocConfigUpdate((docCfg: DocConfig | null) => {
            if (docCfg?.academicCalendar) {
                setCalendarConfig(docCfg.academicCalendar);
            }
            setIsLoading(false);
        });
        return () => unsub();
    }, []);

    const todayStr = formatToDateStr();
    const currentSemester = getRealtimeSemesterInfo(todayStr, calendarConfig);
    const todayHolidayCheck = checkIsSchoolHoliday(todayStr, calendarConfig);

    return {
        isLoading,
        calendarConfig,
        todayStr,
        currentYear: currentSemester.year,
        currentYearStr: currentSemester.yearStr,
        currentSemester, // { semesterId, key, name, fullName, isVacation, type, startDate, endDate }
        isTodayHoliday: todayHolidayCheck.isHoliday,
        isTodayWeekend: todayHolidayCheck.isWeekend,
        todayHolidayReason: todayHolidayCheck.reason,
        checkDateSemester: (d: Date | string) => getRealtimeSemesterInfo(d, calendarConfig),
        checkDateHoliday: (d: Date | string) => checkIsSchoolHoliday(d, calendarConfig)
    };
}
