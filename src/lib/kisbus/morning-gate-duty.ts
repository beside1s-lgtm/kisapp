import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { getKisbusDb as db } from './firebase';

export interface DayDutySlot {
    dateStr: string; // YYYY-MM-DD
    dayOfWeekName: '월' | '화' | '수' | '목' | '금';
    teacherName: string;
    isHoliday: boolean;
    holidayName?: string;
    roundNumber?: number;
}

export interface WeekDutyRow {
    weekNum: number;
    periodStr: string;
    daysCount: number;
    days: Record<'월' | '화' | '수' | '목' | '금', DayDutySlot>;
}

export interface SemesterPeriodInfo {
    id: string;
    name: string;
    type: 'regular' | 'vacation';
    startDate: string;
    endDate: string;
    isVacationFixedMode?: boolean;
    vacationFixedTeacherName?: string;
}

export interface MultiSemesterMorningGateDutyConfig {
    activeSemesterId: string;
    semesters: Record<string, SemesterPeriodInfo>;
    teacherSequence: string[];
    holidays: string[];
    schedules: Record<string, WeekDutyRow[]>;
    startTimeStr: string;
    endTimeStr: string;
    studentIssueContact: string;
    healthIssueContact: string;
}

export interface TeacherDutySlotDetail {
    dateStr: string; // YYYY-MM-DD
    dayOfWeekName: string; // 월, 화, ...
    roundNumber?: number;
    semesterId: string;
    semesterName: string;
    teacherName: string;
    startTime: string; // e.g. "07:40"
    endTime: string; // e.g. "08:20"
}

export const onMorningGateDutyUpdate = (callback: (config: MultiSemesterMorningGateDutyConfig | null) => void) => {
    return onSnapshot(doc(db(), 'config', 'morningGateDutyMulti'), (snap) => {
        if (snap.exists()) {
            callback(snap.data() as MultiSemesterMorningGateDutyConfig);
        } else {
            callback(null);
        }
    }, (err) => {
        console.warn('onMorningGateDutyUpdate error:', err);
        callback(null);
    });
};

export const getMorningGateDutyConfig = async (): Promise<MultiSemesterMorningGateDutyConfig | null> => {
    try {
        const snap = await getDoc(doc(db(), 'config', 'morningGateDutyMulti'));
        if (snap.exists()) {
            return snap.data() as MultiSemesterMorningGateDutyConfig;
        }
        return null;
    } catch (e) {
        console.warn('getMorningGateDutyConfig error:', e);
        return null;
    }
};

/**
 * 특정 교사의 모든 학기 등교지도 근무일 목록 추출
 */
export const extractTeacherDutySlots = (
    config: MultiSemesterMorningGateDutyConfig | null,
    targetTeacherName: string
): TeacherDutySlotDetail[] => {
    if (!config || !config.schedules || !targetTeacherName.trim()) return [];

    const cleanName = targetTeacherName.trim();
    const results: TeacherDutySlotDetail[] = [];

    const startTime = config.startTimeStr || '07:40';
    const endTime = config.endTimeStr || '08:20';

    Object.entries(config.schedules).forEach(([semId, rows]) => {
        const semInfo = config.semesters?.[semId];
        const semName = semInfo?.name || semId;

        (rows || []).forEach(row => {
            if (!row.days) return;
            Object.entries(row.days).forEach(([dKey, slot]) => {
                if (
                    slot &&
                    !slot.isHoliday &&
                    slot.teacherName &&
                    slot.teacherName.trim() === cleanName &&
                    slot.dateStr
                ) {
                    results.push({
                        dateStr: slot.dateStr,
                        dayOfWeekName: slot.dayOfWeekName || (dKey as any),
                        roundNumber: slot.roundNumber,
                        semesterId: semId,
                        semesterName: semName,
                        teacherName: cleanName,
                        startTime,
                        endTime
                    });
                }
            });
        });
    });

    // Sort by date ascending
    return results.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
};
