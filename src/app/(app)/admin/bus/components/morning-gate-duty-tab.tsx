'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getKisbusDb as db } from '@/lib/kisbus/firebase';
import type { Teacher } from '@/lib/kisbus/types';
import { cn } from '@/lib/kisbus/utils';
import { Calendar, Download, Printer, RefreshCw, Settings, UserCheck, Plus, Trash2, ArrowUp, ArrowDown, Info, Link as LinkIcon, Sun, School, Edit3 } from 'lucide-react';
import { getDocConfig } from '@/lib/services/settingsService';
import * as xlsx from 'xlsx';

// Default initial teacher rotation sequence based on official 2026 1학기 schedule
const DEFAULT_TEACHER_SEQUENCE = [
    '강지욱', '김태현', '이숙형', '윤한수', '김나영',
    '박지영', '최수연', '송다혜', '전은지', '김경훈',
    '박진성', '홍영도', '이한영', '장진철', '김홍빈',
    '양유정', '정다운', '최선미', '조현준', '정세훈',
    '차유빈', '정혜진', '이경진', '진중식', '강아라',
    '김현희', '박은솔', '권예림', '오형석', '이서정',
    '김채원', '김오경', '박정남', '이윤미', '조현수',
    '정유진', '김주연', '오혜령', '배유미'
];

// Default holiday dates for 2026 (공식 학사일정 기본값 연동)
const DEFAULT_HOLIDAYS = [
    '2026-09-02',
    '2026-09-25',
    '2026-10-09'
];

export interface DayDutySlot {
    dateStr: string; // YYYY-MM-DD
    dayOfWeekName: '월' | '화' | '수' | '목' | '금';
    teacherName: string;
    isHoliday: boolean;
    holidayName?: string;
    roundNumber?: number; // 회차 (1회차, 2회차...)
}

export interface WeekDutyRow {
    weekNum: number;
    periodStr: string; // e.g. "3.2~3.6"
    daysCount: number; // e.g. 5, 4, 0
    days: Record<'월' | '화' | '수' | '목' | '금', DayDutySlot>;
}

export interface SemesterPeriodInfo {
    id: string; // e.g. "2026_1", "2026_summer", "2026_2", "2026_winter"
    name: string; // e.g. "2026학년도 1학기"
    type: 'regular' | 'vacation';
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    isVacationFixedMode?: boolean; // 방학 1인 고정 근무 여부
    vacationFixedTeacherName?: string; // 방학 고정 교사 이름
    startFromLastSemesterContinuity?: boolean; // 이전 학기 연속 순환 연결 여부
    startTeacherName?: string; // 특정 교사부터 시작 시 교사명
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

function sanitizeForFirestore<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

const DEFAULT_SEMESTERS: Record<string, SemesterPeriodInfo> = {
    '2026_1': {
        id: '2026_1',
        name: '2026학년도 1학기',
        type: 'regular',
        startDate: '2026-03-02',
        endDate: '2026-07-17',
        isVacationFixedMode: false,
        startFromLastSemesterContinuity: false
    },
    '2026_summer': {
        id: '2026_summer',
        name: '2026학년도 여름방학 방과후',
        type: 'vacation',
        startDate: '2026-07-20',
        endDate: '2026-08-21',
        isVacationFixedMode: true,
        vacationFixedTeacherName: '',
        startFromLastSemesterContinuity: false
    },
    '2026_2': {
        id: '2026_2',
        name: '2026학년도 2학기',
        type: 'regular',
        startDate: '2026-08-24',
        endDate: '2026-12-31',
        isVacationFixedMode: false,
        startFromLastSemesterContinuity: true // 1학기 이어서 계속 순환!
    },
    '2026_winter': {
        id: '2026_winter',
        name: '2026학년도 겨울방학 방과후',
        type: 'vacation',
        startDate: '2027-01-04',
        endDate: '2027-02-19',
        isVacationFixedMode: true,
        vacationFixedTeacherName: '',
        startFromLastSemesterContinuity: false
    }
};

interface MorningGateDutyTabProps {
    teachers: Teacher[];
    semesterMode?: 'regular' | 'vacation';
}

export function MorningGateDutyTab({ teachers, semesterMode = 'regular' }: MorningGateDutyTabProps) {
    const { toast } = useToast();

    const [config, setConfig] = useState<MultiSemesterMorningGateDutyConfig>({
        activeSemesterId: '2026_1',
        semesters: DEFAULT_SEMESTERS,
        teacherSequence: DEFAULT_TEACHER_SEQUENCE,
        holidays: DEFAULT_HOLIDAYS,
        schedules: {},
        startTimeStr: '07:40',
        endTimeStr: '08:20',
        studentIssueContact: '강지욱 [☎ 0784207093]',
        healthIssueContact: '양선정 [☎ 0902421953]'
    });

    // Dialog state
    const [isSequenceDialogOpen, setIsSequenceDialogOpen] = useState(false);
    const [isHolidayDialogOpen, setIsHolidayDialogOpen] = useState(false);
    const [isSemesterConfigOpen, setIsSemesterConfigOpen] = useState(false);
    const [isEditSlotDialogOpen, setIsEditSlotDialogOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ weekIndex: number; dayKey: '월' | '화' | '수' | '목' | '금'; slot: DayDutySlot } | null>(null);

    // Edit Slot State
    const [editTeacherName, setEditTeacherName] = useState('');
    const [editIsHoliday, setEditIsHoliday] = useState(false);

    // Temp Sequence & Holidays State
    const [tempSequence, setTempSequence] = useState<string[]>([]);
    const [newTeacherInput, setNewTeacherInput] = useState('');
    const [tempHolidays, setTempHolidays] = useState<string[]>([]);
    const [newHolidayInput, setNewHolidayInput] = useState('');

    // Temp Semester Edit State
    const [editSemesterInfo, setEditSemesterInfo] = useState<SemesterPeriodInfo>({
        id: '2026_1',
        name: '2026학년도 1학기',
        type: 'regular',
        startDate: '2026-03-02',
        endDate: '2026-07-17'
    });

    // Sync with prop semesterMode if user switches top tab mode
    useEffect(() => {
        if (semesterMode === 'vacation') {
            if (config.activeSemesterId !== '2026_summer' && config.activeSemesterId !== '2026_winter') {
                setConfig(prev => ({ ...prev, activeSemesterId: '2026_summer' }));
            }
        } else {
            if (config.activeSemesterId === '2026_summer' || config.activeSemesterId === '2026_winter') {
                // 이전 선택이 2학기였으면 2학기 유지, 기본은 2학기 또는 1학기
                setConfig(prev => ({ ...prev, activeSemesterId: prev.activeSemesterId === '2026_winter' ? '2026_2' : (prev.activeSemesterId || '2026_2') }));
            }
        }
    }, [semesterMode]);

    // Load multi-semester configuration from Firestore & sync central academic calendar
    useEffect(() => {
        const unsub = onSnapshot(doc(db(), 'config', 'morningGateDutyMulti'), async (docSnap) => {
            let docData: Partial<MultiSemesterMorningGateDutyConfig> = {};
            if (docSnap.exists()) {
                docData = docSnap.data() as MultiSemesterMorningGateDutyConfig;
            }

            // Sync with Central Academic Calendar from System Admin Config
            try {
                const sysDoc = await getDocConfig();
                if (sysDoc?.academicCalendar) {
                    const cal = sysDoc.academicCalendar;
                    const centralSemesters: Record<string, SemesterPeriodInfo> = {
                        '2026_1': {
                            id: '2026_1',
                            name: cal.semesters?.sem1?.name || '2026학년도 1학기',
                            type: 'regular',
                            startDate: cal.semesters?.sem1?.startDate || '2026-03-02',
                            endDate: cal.semesters?.sem1?.endDate || '2026-07-17'
                        },
                        '2026_summer': {
                            id: '2026_summer',
                            name: cal.semesters?.vacationSummer?.name || '2026학년도 여름방학',
                            type: 'vacation',
                            startDate: cal.semesters?.vacationSummer?.startDate || '2026-07-18',
                            endDate: cal.semesters?.vacationSummer?.endDate || '2026-08-23',
                            isVacationFixedMode: true,
                            vacationFixedTeacherName: ''
                        },
                        '2026_2': {
                            id: '2026_2',
                            name: cal.semesters?.sem2?.name || '2026학년도 2학기',
                            type: 'regular',
                            startDate: cal.semesters?.sem2?.startDate || '2026-08-24',
                            endDate: cal.semesters?.sem2?.endDate || '2026-12-31',
                            startFromLastSemesterContinuity: true
                        },
                        '2026_winter': {
                            id: '2026_winter',
                            name: cal.semesters?.vacationWinter?.name || '2027학년도 겨울방학',
                            type: 'vacation',
                            startDate: cal.semesters?.vacationWinter?.startDate || '2027-01-01',
                            endDate: cal.semesters?.vacationWinter?.endDate || '2027-02-28',
                            isVacationFixedMode: true,
                            vacationFixedTeacherName: ''
                        }
                    };

                    const holidayEvents = (cal.events || []).filter(e => !e.isSchoolDay || e.type === 'HOLIDAY' || e.type === 'PUBLIC_HOLIDAY');
                    const centralHolidays = holidayEvents.map(e => e.date);
                    const holidayNameMap: Record<string, string> = {};
                    holidayEvents.forEach(e => {
                        holidayNameMap[e.date] = e.title;
                    });

                    const mergedSemesters = { ...DEFAULT_SEMESTERS, ...(docData.semesters || {}), ...centralSemesters };
                    
                    // Central academic calendar is the authoritative source for holidays
                    const effectiveHolidays = centralHolidays.length > 0 
                        ? centralHolidays 
                        : (docData.holidays ? docData.holidays.filter(d => d !== '2026-09-24') : DEFAULT_HOLIDAYS);

                    // Check if existing saved holidays or schedule had outdated dummy dates (e.g. 2026-09-24)
                    const hadOutdatedHoliday = docData.holidays && docData.holidays.includes('2026-09-24') && !centralHolidays.includes('2026-09-24');
                    const hasEmptySchedule = !docData.schedules || Object.keys(docData.schedules).length === 0;

                    if (!docSnap.exists() || hadOutdatedHoliday || hasEmptySchedule) {
                        await initAndSaveAllSemesters(
                            mergedSemesters, 
                            docData.teacherSequence || DEFAULT_TEACHER_SEQUENCE, 
                            effectiveHolidays, 
                            holidayNameMap
                        );
                    } else {
                        setConfig(prev => ({
                            ...prev,
                            ...docData,
                            semesters: mergedSemesters,
                            holidays: effectiveHolidays
                        }));
                    }
                    return;
                }
            } catch (e) {
                console.error('Failed to sync central academic calendar:', e);
            }

            if (docSnap.exists()) {
                const cleanedHolidays = (docData.holidays || DEFAULT_HOLIDAYS).filter(d => d !== '2026-09-24');
                setConfig(prev => ({
                    ...prev,
                    ...docData,
                    holidays: cleanedHolidays,
                    semesters: { ...DEFAULT_SEMESTERS, ...(docData.semesters || {}) }
                }));
            } else {
                initAndSaveAllSemesters(DEFAULT_SEMESTERS, DEFAULT_TEACHER_SEQUENCE, DEFAULT_HOLIDAYS);
            }
        });
        return () => unsub();
    }, []);

    // Get last assigned teacher from previous regular semester (e.g. 1학기) for continuity
    const getLastTeacherFromSemester = (targetSemesterId: string, currentSchedules: Record<string, WeekDutyRow[]>): string | null => {
        const targetSchedule = currentSchedules[targetSemesterId];
        if (!targetSchedule || targetSchedule.length === 0) return null;

        // Traverse backwards from last week and last day to find last non-holiday teacher
        for (let w = targetSchedule.length - 1; w >= 0; w--) {
            const week = targetSchedule[w];
            const daysKeys: ('금' | '목' | '수' | '화' | '월')[] = ['금', '목', '수', '화', '월'];
            for (const dKey of daysKeys) {
                const slot = week.days[dKey];
                if (slot && !slot.isHoliday && slot.teacherName) {
                    return slot.teacherName;
                }
            }
        }
        return null;
    };

    // Calculate start index in teacher sequence
    const getStartIndexForSemester = (
        semInfo: SemesterPeriodInfo, 
        sequence: string[], 
        currentSchedules: Record<string, WeekDutyRow[]>
    ): number => {
        if (semInfo.startFromLastSemesterContinuity) {
            // Find 1학기 or previous semester ID
            const prevId = semInfo.id === '2026_2' ? '2026_1' : '2026_1';
            const lastTeacherName = getLastTeacherFromSemester(prevId, currentSchedules);
            if (lastTeacherName) {
                const lastIdx = sequence.indexOf(lastTeacherName);
                if (lastIdx !== -1) {
                    return (lastIdx + 1) % sequence.length; // Next teacher in line!
                }
            }
        } else if (semInfo.startTeacherName) {
            const idx = sequence.indexOf(semInfo.startTeacherName);
            if (idx !== -1) return idx;
        }
        return 0;
    };

    // Generate schedule rows for a specific semester
    const generateSemesterRows = (
        semInfo: SemesterPeriodInfo,
        sequence: string[],
        holidayList: string[],
        allSchedules: Record<string, WeekDutyRow[]>,
        holidayNameMap: Record<string, string> = {}
    ): WeekDutyRow[] => {
        if (!semInfo.startDate || !semInfo.endDate) return [];
        const start = new Date(semInfo.startDate);
        const end = new Date(semInfo.endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

        const activeSequence = sequence.length > 0 ? sequence : DEFAULT_TEACHER_SEQUENCE;
        const holidaySet = new Set(holidayList);

        let curr = new Date(start);
        const dayOfWeek = curr.getDay();
        if (dayOfWeek !== 1) {
            const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            curr.setDate(curr.getDate() + diff);
        }

        const rows: WeekDutyRow[] = [];
        let weekCounter = 1;
        
        const semesterStartIndex = getStartIndexForSemester(semInfo, activeSequence, allSchedules);
        let sequenceIndex = semesterStartIndex;
        let roundCounter = 1;
        let isFirstWorkingDayOfSemester = true;

        while (curr <= end) {
            const weekStartDate = new Date(curr);
            const weekEndDate = new Date(curr);
            weekEndDate.setDate(weekEndDate.getDate() + 4);

            const periodStr = `${weekStartDate.getMonth() + 1}.${weekStartDate.getDate()}~${weekEndDate.getMonth() + 1}.${weekEndDate.getDate()}`;
            const daysMap: Record<'월' | '화' | '수' | '목' | '금', DayDutySlot> = {} as any;
            const dayKeys: ('월' | '화' | '수' | '목' | '금')[] = ['월', '화', '수', '목', '금'];
            let validDaysCount = 0;

            for (let i = 0; i < 5; i++) {
                const dayDate = new Date(curr);
                dayDate.setDate(dayDate.getDate() + i);

                const dateString = dayDate.toISOString().split('T')[0];
                const dayKey = dayKeys[i];
                const isOutOfBounds = dayDate < start || dayDate > end;
                const isHoliday = isOutOfBounds || holidaySet.has(dateString);

                if (!isHoliday) {
                    validDaysCount++;
                    let assignedName = '';
                    let currentRound: number | undefined = undefined;

                    if (semInfo.type === 'vacation' && semInfo.isVacationFixedMode) {
                        // 방학 1인 고정 근무 처리
                        assignedName = semInfo.vacationFixedTeacherName || '';
                    } else {
                        // 순환 연속 근무 처리 - 해당 학기의 첫 근무자를 기준점(1회차)으로 카운트
                        if (isFirstWorkingDayOfSemester) {
                            currentRound = roundCounter;
                            isFirstWorkingDayOfSemester = false;
                        } else if (sequenceIndex === semesterStartIndex) {
                            roundCounter++;
                            currentRound = roundCounter;
                        }

                        assignedName = activeSequence[sequenceIndex];

                        sequenceIndex++;
                        if (sequenceIndex >= activeSequence.length) {
                            sequenceIndex = 0;
                        }
                    }

                    daysMap[dayKey] = {
                        dateStr: dateString,
                        dayOfWeekName: dayKey,
                        teacherName: assignedName,
                        isHoliday: false,
                        roundNumber: currentRound
                    };
                } else {
                    const customLabel = holidayNameMap[dateString];
                    daysMap[dayKey] = {
                        dateStr: dateString,
                        dayOfWeekName: dayKey,
                        teacherName: '',
                        isHoliday: true,
                        holidayName: isOutOfBounds ? '' : (customLabel || (holidaySet.has(dateString) ? '휴업일' : ''))
                    };
                }
            }

            rows.push({
                weekNum: weekCounter,
                periodStr,
                daysCount: validDaysCount,
                days: daysMap
            });

            weekCounter++;
            curr.setDate(curr.getDate() + 7);
        }

        return rows;
    };

    // Initialize all default schedules and save
    const initAndSaveAllSemesters = async (
        semestersMap = DEFAULT_SEMESTERS,
        seq = DEFAULT_TEACHER_SEQUENCE,
        hols = DEFAULT_HOLIDAYS,
        holidayNameMap: Record<string, string> = {}
    ) => {
        const newSchedules: Record<string, WeekDutyRow[]> = {};
        
        // Process in chronological order (2026_1 -> 2026_summer -> 2026_2 -> 2026_winter)
        const sortedSemesterIds = Object.keys(semestersMap).sort((a, b) => {
            return (semestersMap[a].startDate || '').localeCompare(semestersMap[b].startDate || '');
        });

        sortedSemesterIds.forEach(id => {
            const semInfo = semestersMap[id];
            newSchedules[id] = generateSemesterRows(semInfo, seq, hols, newSchedules, holidayNameMap);
        });

        const newConfig: MultiSemesterMorningGateDutyConfig = {
            activeSemesterId: '2026_1',
            semesters: semestersMap,
            teacherSequence: seq,
            holidays: hols,
            schedules: newSchedules,
            startTimeStr: '07:40',
            endTimeStr: '08:20',
            studentIssueContact: '강지욱 [☎ 0784207093]',
            healthIssueContact: '양선정 [☎ 0902421953]'
        };

        setConfig(newConfig);
        try {
            await setDoc(doc(db(), 'config', 'morningGateDutyMulti'), sanitizeForFirestore(newConfig));
        } catch (err) {
            console.error('Init Multi Semester Error:', err);
        }
    };

    // Save and re-generate current active semester
    const saveAndGenerateActiveSemester = async (
        updatedSemesters = config.semesters, 
        updatedSeq = config.teacherSequence, 
        updatedHols?: string[]
    ) => {
        let effectiveHolidays = updatedHols || config.holidays;
        let holidayNameMap: Record<string, string> = {};

        try {
            const sysDoc = await getDocConfig();
            if (sysDoc?.academicCalendar) {
                const cal = sysDoc.academicCalendar;
                const holidayEvents = (cal.events || []).filter(e => !e.isSchoolDay || e.type === 'HOLIDAY' || e.type === 'PUBLIC_HOLIDAY');
                if (holidayEvents.length > 0 && !updatedHols) {
                    effectiveHolidays = holidayEvents.map(e => e.date);
                }
                holidayEvents.forEach(e => {
                    holidayNameMap[e.date] = e.title;
                });
            }
        } catch (e) {
            console.error('Failed to get academic calendar on save:', e);
        }

        // Clean out any obsolete hardcoded dummy dates
        effectiveHolidays = effectiveHolidays.filter(d => d !== '2026-09-24' || holidayNameMap['2026-09-24']);

        const newSchedules = { ...config.schedules };

        // Re-generate in chronological order to maintain continuity
        const sortedSemesterIds = Object.keys(updatedSemesters).sort((a, b) => {
            return (updatedSemesters[a].startDate || '').localeCompare(updatedSemesters[b].startDate || '');
        });

        sortedSemesterIds.forEach(id => {
            const semInfo = updatedSemesters[id];
            newSchedules[id] = generateSemesterRows(semInfo, updatedSeq, effectiveHolidays, newSchedules, holidayNameMap);
        });

        const newConfig: MultiSemesterMorningGateDutyConfig = {
            ...config,
            semesters: updatedSemesters,
            teacherSequence: updatedSeq,
            holidays: effectiveHolidays,
            schedules: newSchedules
        };

        setConfig(newConfig);
        try {
            await setDoc(doc(db(), 'config', 'morningGateDutyMulti'), sanitizeForFirestore(newConfig));
            toast({ title: '배정표 업데이트 성공', description: '학사일정이 동기화되어 등교 지도 배정표가 최신화되었습니다.' });
        } catch (err) {
            console.error('Save Multi Semester Error:', err);
            toast({ title: '저장 오류', description: '배정표 저장 중 오류가 발생했습니다.', variant: 'destructive' });
        }
    };

    // Open Sequence Dialog
    const handleOpenSequenceDialog = () => {
        setTempSequence([...config.teacherSequence]);
        setIsSequenceDialogOpen(true);
    };

    const handleSaveSequence = async () => {
        setIsSequenceDialogOpen(false);
        await saveAndGenerateActiveSemester(config.semesters, tempSequence, config.holidays);
    };

    const handleMoveSequence = (index: number, direction: 'up' | 'down') => {
        const newSeq = [...tempSequence];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newSeq.length) return;
        const temp = newSeq[index];
        newSeq[index] = newSeq[targetIndex];
        newSeq[targetIndex] = temp;
        setTempSequence(newSeq);
    };

    const handleAddTeacherToSequence = (nameToAdd: string) => {
        if (!nameToAdd.trim()) return;
        if (tempSequence.includes(nameToAdd.trim())) {
            toast({ title: '안내', description: '이미 순환 명단에 포함된 교사입니다.' });
            return;
        }
        setTempSequence([...tempSequence, nameToAdd.trim()]);
        setNewTeacherInput('');
    };

    // Open Holiday Dialog
    const handleOpenHolidayDialog = () => {
        setTempHolidays([...config.holidays]);
        setIsHolidayDialogOpen(true);
    };

    const handleSaveHolidays = async () => {
        setIsHolidayDialogOpen(false);
        await saveAndGenerateActiveSemester(config.semesters, config.teacherSequence, tempHolidays);
    };

    const handleAddHoliday = () => {
        if (!newHolidayInput) return;
        if (tempHolidays.includes(newHolidayInput)) {
            toast({ title: '안내', description: '이미 등록된 날짜입니다.' });
            return;
        }
        setTempHolidays([...tempHolidays, newHolidayInput].sort());
        setNewHolidayInput('');
    };

    // Open Semester Config Dialog
    const handleOpenSemesterConfig = () => {
        const currentSem = config.semesters[config.activeSemesterId];
        if (currentSem) {
            setEditSemesterInfo({ ...currentSem });
            setIsSemesterConfigOpen(true);
        }
    };

    const handleSaveSemesterConfig = async () => {
        const newSemesters = {
            ...config.semesters,
            [editSemesterInfo.id]: { ...editSemesterInfo }
        };
        setIsSemesterConfigOpen(false);
        await saveAndGenerateActiveSemester(newSemesters);
    };

    // Open Edit Slot Dialog
    const handleOpenSlotEdit = (weekIndex: number, dayKey: '월' | '화' | '수' | '목' | '금', slot: DayDutySlot) => {
        setSelectedSlot({ weekIndex, dayKey, slot });
        setEditTeacherName(slot.teacherName);
        setEditIsHoliday(slot.isHoliday);
        setIsEditSlotDialogOpen(true);
    };

    const handleSaveSlotEdit = async () => {
        if (!selectedSlot) return;
        const currentSchedule = config.schedules[config.activeSemesterId] || [];
        const newSchedule = [...currentSchedule];
        const targetWeek = { ...newSchedule[selectedSlot.weekIndex] };
        const targetDays = { ...targetWeek.days };

        targetDays[selectedSlot.dayKey] = {
            ...selectedSlot.slot,
            teacherName: editIsHoliday ? '' : editTeacherName.trim(),
            isHoliday: editIsHoliday,
            holidayName: editIsHoliday ? '휴업일' : undefined
        };

        const validCount = Object.values(targetDays).filter(d => !d.isHoliday).length;
        targetWeek.daysCount = validCount;
        targetWeek.days = targetDays;
        newSchedule[selectedSlot.weekIndex] = targetWeek;

        const newSchedules = {
            ...config.schedules,
            [config.activeSemesterId]: newSchedule
        };

        const newConfig = { ...config, schedules: newSchedules };
        setConfig(newConfig);
        setIsEditSlotDialogOpen(false);

        try {
            await setDoc(doc(db(), 'config', 'morningGateDutyMulti'), sanitizeForFirestore(newConfig));
            toast({ title: '근무자 변경 완료', description: `${selectedSlot.slot.dateStr} (${selectedSlot.dayKey}) 근무 정보가 저장되었습니다.` });
        } catch (err) {
            console.error(err);
            toast({ title: '오류', description: '수정사항 저장 실패', variant: 'destructive' });
        }
    };

    // Excel Export Function
    const handleExportExcel = () => {
        try {
            const activeSem = config.semesters[config.activeSemesterId];
            const activeSchedule = config.schedules[config.activeSemesterId] || [];
            const semTitle = activeSem ? activeSem.name : config.activeSemesterId;

            const excelRows: any[] = [];
            
            excelRows.push([`≪ ${semTitle} ≫ 등교 지도 교사 배정표`]);
            excelRows.push(['1. 등교 지도는 한국인 교사 1명으로 운영']);
            excelRows.push([`2. 등교 지도 시간: ${config.startTimeStr} ~ ${config.endTimeStr} (※시간 엄수: 수당 지급 근거)`]);
            excelRows.push(['3. 등교 지도 시 할 일: 학교 건물 바깥 중앙 출입문에서 학생 맞이 및 차량 하차 후 안전한 학교 진입 유도']);
            excelRows.push(['4. 개인 사정으로 등교 지도일 변경 시 일대일 교환(개별적으로) 후 반드시 담당 교사에게 사전 연락']);
            excelRows.push([`   ☆ 담당교사: ${config.studentIssueContact} / 보건교사: ${config.healthIssueContact}`]);
            excelRows.push(['5. 순번 배정은 교과(전임강사 포함)/고학년/저학년 순으로 순환 배치함']);
            excelRows.push(['6. 담당 학급의 특성상 유치원, 도움반, 보건교사는 배정하지 않음']);
            excelRows.push([]);

            excelRows.push(['주', '기간', '등교일', '월', '화', '수', '목', '금']);

            activeSchedule.forEach(row => {
                const getTeacherDisplay = (slot: DayDutySlot) => {
                    if (slot.isHoliday) return '휴업일';
                    return slot.roundNumber ? `(${slot.roundNumber}회차) ${slot.teacherName}` : slot.teacherName;
                };

                excelRows.push([
                    row.weekNum,
                    row.periodStr,
                    row.daysCount,
                    getTeacherDisplay(row.days['월']),
                    getTeacherDisplay(row.days['화']),
                    getTeacherDisplay(row.days['수']),
                    getTeacherDisplay(row.days['목']),
                    getTeacherDisplay(row.days['금'])
                ]);
            });

            const worksheet = xlsx.utils.aoa_to_sheet(excelRows);
            worksheet['!cols'] = [
                { wch: 6 },
                { wch: 14 },
                { wch: 8 },
                { wch: 16 },
                { wch: 16 },
                { wch: 16 },
                { wch: 16 },
                { wch: 16 },
            ];

            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, '등교 지도 배정표');
            xlsx.writeFile(workbook, `등교지도교사배정표_${semTitle.replace(/\s+/g, '')}.xlsx`);

            toast({ title: '엑셀 다운로드 완료', description: '등교 지도 교사 배정표가 엑셀 파일로 저장되었습니다.' });
        } catch (err) {
            console.error('Excel Export Error:', err);
            toast({ title: '다운로드 실패', description: '엑셀 파일 생성 중 오류가 발생했습니다.', variant: 'destructive' });
        }
    };

    // Print Handler
    const handlePrint = () => {
        window.print();
    };

    const currentSemesterInfo = config.semesters[config.activeSemesterId] || DEFAULT_SEMESTERS['2026_1'];
    const currentScheduleRows = config.schedules[config.activeSemesterId] || [];

    // Continuity info for 2학기
    const prevTeacherInfoForContinuity = useMemo(() => {
        if (currentSemesterInfo.startFromLastSemesterContinuity && currentSemesterInfo.id === '2026_2') {
            const lastTeacher = getLastTeacherFromSemester('2026_1', config.schedules);
            if (lastTeacher) {
                const nextIdx = (config.teacherSequence.indexOf(lastTeacher) + 1) % config.teacherSequence.length;
                return {
                    lastTeacher,
                    nextTeacher: config.teacherSequence[nextIdx] || '강지욱'
                };
            }
        }
        return null;
    }, [currentSemesterInfo, config.schedules, config.teacherSequence]);

    return (
        <div className="space-y-6">
            {/* Semester Selector Bar */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/20 rounded-xl border border-amber-400/30">
                        {currentSemesterInfo.type === 'vacation' ? (
                            <Sun className="w-5 h-5 text-amber-400" />
                        ) : (
                            <School className="w-5 h-5 text-indigo-400" />
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">학기/방학 선택:</span>
                            <Badge className={cn(
                                "font-bold text-xs",
                                currentSemesterInfo.type === 'vacation' 
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40" 
                                    : "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                            )}>
                                {currentSemesterInfo.type === 'vacation' ? '방학 방과후' : '정규 학기'}
                            </Badge>
                        </div>
                        <h2 className="text-lg font-extrabold text-white mt-0.5">
                            {currentSemesterInfo.name} ({currentSemesterInfo.startDate} ~ {currentSemesterInfo.endDate})
                        </h2>
                    </div>
                </div>

                {/* Semester Selector Dropdown */}
                <div className="flex flex-wrap items-center gap-2">
                    <Select 
                        value={config.activeSemesterId} 
                        onValueChange={async (val) => {
                            setConfig(prev => ({ ...prev, activeSemesterId: val }));
                            try {
                                await setDoc(doc(db(), 'config', 'morningGateDutyMulti'), { activeSemesterId: val }, { merge: true });
                            } catch (err) {
                                console.error('Failed to save activeSemesterId to Firestore:', err);
                            }
                        }}
                    >
                        <SelectTrigger className="w-[240px] bg-slate-800 border-slate-700 text-white font-bold text-xs h-9">
                            <SelectValue placeholder="학기/방학 선택..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 text-white border-slate-700">
                            {Object.values(config.semesters).map(sem => (
                                <SelectItem key={sem.id} value={sem.id} className="text-xs font-semibold focus:bg-slate-700 focus:text-white">
                                    {sem.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={handleOpenSemesterConfig} 
                        className="h-9 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border-slate-700 rounded-xl"
                    >
                        <Edit3 className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                        학기/방학 설정 및 방식 변경
                    </Button>
                </div>
            </div>

            {/* Top Action Toolbar */}
            <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden">
                {/* 1. 상단 제목 & 부제목 (각각 한 줄 표기) */}
                <div className="space-y-1.5 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 whitespace-nowrap tracking-tight">
                            ≪ {currentSemesterInfo.name} ≫ 등교 지도 관리
                        </h3>
                        {prevTeacherInfoForContinuity && (
                            <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-bold text-xs whitespace-nowrap">
                                <LinkIcon className="w-3 h-3 mr-1 shrink-0" />
                                1학기({prevTeacherInfoForContinuity.lastTeacher}) ➔ 2학기('{prevTeacherInfoForContinuity.nextTeacher}'부터 연속 순환)
                            </Badge>
                        )}
                        {currentSemesterInfo.type === 'vacation' && currentSemesterInfo.isVacationFixedMode && (
                            <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-xs whitespace-nowrap">
                                방학 1인 고정 근무: {currentSemesterInfo.vacationFixedTeacherName || '강지욱'}
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
                        매일 아침 07:40~08:20 정문 등교 지도를 담당하는 교사 배정표를 확인하고 수정합니다.
                    </p>
                </div>

                {/* 2. 하단 버튼 그룹 (나란히 균등 배분 정렬) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
                    <Button variant="outline" size="sm" onClick={handleOpenSequenceDialog} className="h-9 text-xs font-bold bg-white hover:bg-slate-50 border-slate-300 rounded-xl w-full whitespace-nowrap">
                        <Settings className="w-3.5 h-3.5 mr-1.5 text-indigo-600 shrink-0" />
                        순환 교사 명단 ({config.teacherSequence.length}명)
                    </Button>

                    <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => saveAndGenerateActiveSemester()} 
                        className="h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs w-full whitespace-nowrap"
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                        배정표 자동 재생성
                    </Button>

                    <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-9 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 rounded-xl w-full whitespace-nowrap">
                        <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-700 shrink-0" />
                        엑셀 다운로드
                    </Button>

                    <Button variant="outline" size="sm" onClick={handlePrint} className="h-9 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 rounded-xl w-full whitespace-nowrap">
                        <Printer className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                        인쇄 / PDF
                    </Button>
                </div>
            </div>

            {/* Printable & Screen Notice Card */}
            <Card className="border-slate-300 shadow-sm rounded-2xl overflow-hidden print:shadow-none print:border-black print:rounded-none">
                <CardHeader className="bg-slate-50 border-b border-slate-200 py-4 px-6 print:bg-white print:p-2">
                    <div className="text-center space-y-1">
                        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight underline underline-offset-4 decoration-2 print:text-2xl print:no-underline">
                            ≪ {currentSemesterInfo.name} ≫ 등교 지도 교사 배정표
                        </h1>
                    </div>

                    {/* Notice Rules List */}
                    <div className="mt-4 bg-white p-4 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5 print:border-none print:p-0 print:text-xs">
                        <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                            <Info className="w-4 h-4 text-indigo-600 print:hidden" />
                            <span>등교 지도 안내 및 지침사항</span>
                        </div>
                        <p>1. 등교 지도는 한국인 교사 1명으로 운영</p>
                        <p>2. 등교 지도 시간: <strong>{config.startTimeStr} ~ {config.endTimeStr}</strong> (※시간 엄수: 수당 지급 근거)</p>
                        <p>3. 등교 지도 시 할 일: 학교 건물 바깥 중앙 출입문에서 학생 맞이 및 차량 하차 후 안전한 학교 진입 유도</p>
                        <p>4. 개인 사정으로 등교 지도일 변경 시 일대일 교환(개별적으로) 후 반드시 담당 교사에게 사전 연락</p>
                        <div className="pl-4 text-amber-900 font-semibold space-y-0.5">
                            <p>☆ 등교 지도 시 위급 상황 발생 시</p>
                            <p>→ 담당교사({config.studentIssueContact}: 학생 관련 문제)에게 우선 연락</p>
                            <p>→ 보건교사({config.healthIssueContact}: 학생 건강 문제)에게 우선 연락</p>
                        </div>
                        <p>5. 순번 배정은 교과(전임강사 포함)/고학년/저학년 순으로 순환 배치함</p>
                        <p>6. 담당 학급의 특성상 유치원, 도움반, 보건교사는 배정하지 않음</p>
                    </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-6 print:p-0">
                    {/* Weekly Schedule Table */}
                    <div className="overflow-x-auto border border-slate-300 rounded-xl print:border-black print:rounded-none">
                        <Table className="w-full text-center border-collapse">
                            <TableHeader className="bg-slate-100 print:bg-slate-200">
                                <TableRow className="border-b border-slate-300 divide-x divide-slate-300 print:divide-black">
                                    <TableHead className="w-[60px] text-center font-bold text-slate-900 py-2.5 whitespace-nowrap">주</TableHead>
                                    <TableHead className="w-[120px] text-center font-bold text-slate-900 py-2.5 whitespace-nowrap">기간</TableHead>
                                    <TableHead className="w-[70px] text-center font-bold text-slate-900 py-2.5 whitespace-nowrap">등교일</TableHead>
                                    <TableHead className="w-[14%] text-center font-bold text-slate-900 py-2.5 whitespace-nowrap">월</TableHead>
                                    <TableHead className="w-[14%] text-center font-bold text-slate-900 py-2.5 whitespace-nowrap">화</TableHead>
                                    <TableHead className="w-[14%] text-center font-bold text-slate-900 py-2.5 whitespace-nowrap">수</TableHead>
                                    <TableHead className="w-[14%] text-center font-bold text-slate-900 py-2.5 whitespace-nowrap">목</TableHead>
                                    <TableHead className="w-[14%] text-center font-bold text-slate-900 py-2.5 whitespace-nowrap">금</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentScheduleRows.length > 0 ? (
                                    currentScheduleRows.map((row, weekIdx) => {
                                        const isNoDutyWeek = row.daysCount === 0;

                                        return (
                                            <TableRow 
                                                key={row.weekNum} 
                                                className={cn(
                                                    "border-b border-slate-200 divide-x divide-slate-200 hover:bg-indigo-50/40 transition print:divide-black print:border-black",
                                                    isNoDutyWeek && "bg-slate-100/80 text-slate-400"
                                                )}
                                            >
                                                <TableCell className="font-bold text-slate-800 py-2">{row.weekNum}</TableCell>
                                                <TableCell className="font-mono text-xs text-slate-700 py-2">{row.periodStr}</TableCell>
                                                <TableCell className="font-bold text-slate-800 py-2">{row.daysCount}</TableCell>

                                                {(['월', '화', '수', '목', '금'] as const).map(dayKey => {
                                                    const slot = row.days[dayKey];
                                                    const isRoundStart = slot.roundNumber && !slot.isHoliday;

                                                    if (slot.isHoliday) {
                                                        return (
                                                            <TableCell key={dayKey} className="bg-slate-100/90 text-slate-400 py-2 text-xs">
                                                                {slot.holidayName || ''}
                                                            </TableCell>
                                                        );
                                                    }

                                                    return (
                                                        <TableCell 
                                                            key={dayKey} 
                                                            onClick={() => handleOpenSlotEdit(weekIdx, dayKey, slot)}
                                                            className={cn(
                                                                "py-2 font-medium text-slate-900 cursor-pointer hover:bg-indigo-100/80 transition relative text-xs",
                                                                isRoundStart && "bg-amber-50 font-bold"
                                                            )}
                                                        >
                                                            {isRoundStart && (
                                                                <span className="block text-[10px] text-amber-800 font-bold underline mb-0.5">
                                                                    ({slot.roundNumber}회차)
                                                                </span>
                                                            )}
                                                            <span>{slot.teacherName || '-'}</span>
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                                            생성된 등교 지도 배정표가 없습니다. 상단의 `[배정표 자동 재생성]` 버튼을 눌러주세요.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* 1. Semester Edit & Vacation Duty Dialog */}
            <Dialog open={isSemesterConfigOpen} onOpenChange={setIsSemesterConfigOpen}>
                <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold">
                            <Edit3 className="w-5 h-5 text-indigo-600" />
                            <span>학기 / 방학 등교 지도 방식 설정</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            현재 선택된 학기/방학의 운영 일정 및 근무 방식을 변경합니다.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs">
                        <div className="space-y-1.5">
                            <Label className="font-bold text-slate-700">학기/방학 명칭</Label>
                            <Input 
                                value={editSemesterInfo.name} 
                                onChange={e => setEditSemesterInfo({ ...editSemesterInfo, name: e.target.value })} 
                                className="text-xs font-bold"
                            />
                        </div>

                        {/* 시스템 관리자 학사일정 연동 운영 기간 안내 (임의 변경 불가) */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="font-bold text-slate-700 text-xs">운영 기간 (학사일정 기준)</Label>
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                    시스템 관리자 마스터 연동
                                </span>
                            </div>
                            <div className="text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
                                <span>{editSemesterInfo.startDate} ~ {editSemesterInfo.endDate}</span>
                                <span className="text-[11px] font-sans font-normal text-slate-500">
                                    {editSemesterInfo.type === 'vacation' ? '방학 운영' : '정규 학기'}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-500">
                                ※ 학기 및 방학의 시작일/종료일은 시스템 관리자(학사일정) 설정에 따라 일괄 적용됩니다.
                            </p>
                        </div>

                        {/* Vacation Duty Specific Settings */}
                        {editSemesterInfo.type === 'vacation' ? (
                            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="font-bold text-amber-950 text-xs">방학 중 1인 고정 근무 설정</Label>
                                        <p className="text-[11px] text-amber-800">방학 기간 동안 한 명의 교사가 고정으로 근무하도록 설정합니다.</p>
                                    </div>
                                    <Switch 
                                        checked={editSemesterInfo.isVacationFixedMode ?? true} 
                                        onCheckedChange={checked => setEditSemesterInfo({ ...editSemesterInfo, isVacationFixedMode: checked })} 
                                    />
                                </div>

                                {editSemesterInfo.isVacationFixedMode && (
                                    <div className="space-y-2 pt-1">
                                        <Label className="font-bold text-amber-900 text-xs">방학 고정 근무 교사 지정</Label>
                                        <Input 
                                            value={editSemesterInfo.vacationFixedTeacherName || ''} 
                                            onChange={e => setEditSemesterInfo({ ...editSemesterInfo, vacationFixedTeacherName: e.target.value })} 
                                            placeholder="교사 성명 입력 (예: 강지욱)..." 
                                            className="bg-white text-xs font-bold text-amber-950 border-amber-300"
                                        />
                                        
                                        {/* Quick search match filter */}
                                        {editSemesterInfo.vacationFixedTeacherName && editSemesterInfo.vacationFixedTeacherName.trim().length > 0 && (
                                            <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto pt-1">
                                                {teachers
                                                    .filter(t => t.name.includes(editSemesterInfo.vacationFixedTeacherName || ''))
                                                    .slice(0, 10)
                                                    .map(t => (
                                                        <button
                                                            key={t.id}
                                                            type="button"
                                                            onClick={() => setEditSemesterInfo({ ...editSemesterInfo, vacationFixedTeacherName: t.name })}
                                                            className="px-2 py-0.5 rounded text-[11px] bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-semibold"
                                                        >
                                                            {t.name} ✓
                                                        </button>
                                                    ))
                                                }
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Regular Semester Continuity Settings (e.g. 2학기) */
                            <div className="p-3.5 bg-indigo-50 rounded-xl border border-indigo-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="font-bold text-indigo-950 text-xs">🔗 이전 학기(1학기)에 이어 연속 순환 배정</Label>
                                        <p className="text-[11px] text-indigo-800">1학기 마지막 교사의 다음 순번부터 2학기 첫날을 이어 배정합니다.</p>
                                    </div>
                                    <Switch 
                                        checked={editSemesterInfo.startFromLastSemesterContinuity ?? false} 
                                        onCheckedChange={checked => setEditSemesterInfo({ ...editSemesterInfo, startFromLastSemesterContinuity: checked })} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsSemesterConfigOpen(false)}>취소</Button>
                        <Button size="sm" onClick={handleSaveSemesterConfig} className="bg-indigo-600 text-white font-bold">
                            설정 저장 및 배정표 생성
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 2. Sequence Settings Dialog */}
            <Dialog open={isSequenceDialogOpen} onOpenChange={setIsSequenceDialogOpen}>
                <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold">
                            <Settings className="w-5 h-5 text-indigo-600" />
                            <span>등교 지도 교사 순환 순서 설정</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            순환 배치 순서를 조정합니다. 배정표 자동 생성 시 이 명단 순서대로 매일 1명씩 자동 순환 배정됩니다.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs">
                        <div className="flex gap-2">
                            <Input 
                                placeholder="추가할 교사 성명 입력..." 
                                value={newTeacherInput} 
                                onChange={e => setNewTeacherInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddTeacherToSequence(newTeacherInput)}
                                className="text-xs"
                            />
                            <Button type="button" onClick={() => handleAddTeacherToSequence(newTeacherInput)} size="sm" className="bg-indigo-600 text-white font-bold whitespace-nowrap">
                                <Plus className="w-3.5 h-3.5 mr-1" /> 추가
                            </Button>
                        </div>

                        {teachers.length > 0 && (
                            <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <Label className="text-[11px] font-bold text-slate-700">시스템 등록 교사 클릭 시 순환 명단에 추가:</Label>
                                <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pt-1">
                                    {teachers.map(t => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => handleAddTeacherToSequence(t.name)}
                                            className={cn(
                                                "px-2 py-1 rounded-md text-[11px] font-semibold border transition",
                                                tempSequence.includes(t.name) 
                                                    ? "bg-indigo-50 border-indigo-300 text-indigo-800" 
                                                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                                            )}
                                        >
                                            {t.name} {tempSequence.includes(t.name) ? '✓' : '+'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                            <Table className="w-full text-xs">
                                <TableHeader className="bg-slate-100 sticky top-0">
                                    <TableRow>
                                        <TableHead className="w-[60px] text-center">순번</TableHead>
                                        <TableHead>교사 성명</TableHead>
                                        <TableHead className="w-[120px] text-center">순서 변경</TableHead>
                                        <TableHead className="w-[50px] text-center">삭제</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tempSequence.map((name, idx) => (
                                        <TableRow key={idx} className="hover:bg-slate-50">
                                            <TableCell className="text-center font-bold">{idx + 1}</TableCell>
                                            <TableCell className="font-bold text-slate-800">{name}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center gap-1">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-6 w-6" 
                                                        disabled={idx === 0} 
                                                        onClick={() => handleMoveSequence(idx, 'up')}
                                                    >
                                                        <ArrowUp className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-6 w-6" 
                                                        disabled={idx === tempSequence.length - 1} 
                                                        onClick={() => handleMoveSequence(idx, 'down')}
                                                    >
                                                        <ArrowDown className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => setTempSequence(tempSequence.filter((_, i) => i !== idx))}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsSequenceDialogOpen(false)}>취소</Button>
                        <Button size="sm" onClick={handleSaveSequence} className="bg-indigo-600 text-white font-bold">
                            순서 저장 및 배정표 생성
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 3. Holiday Settings Dialog */}
            <Dialog open={isHolidayDialogOpen} onOpenChange={setIsHolidayDialogOpen}>
                <DialogContent className="sm:max-w-[450px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold">
                            <Calendar className="w-5 h-5 text-amber-600" />
                            <span>등교 미운영 / 휴업일 및 공휴일 관리</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            등교 지도를 진행하지 않는 공휴일, 재량휴업일, 방학일 등의 날짜를 등록합니다.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs">
                        <div className="flex gap-2">
                            <Input 
                                type="date" 
                                value={newHolidayInput} 
                                onChange={e => setNewHolidayInput(e.target.value)} 
                                className="text-xs"
                            />
                            <Button type="button" onClick={handleAddHoliday} size="sm" className="bg-amber-600 text-white font-bold whitespace-nowrap">
                                <Plus className="w-3.5 h-3.5 mr-1" /> 휴업일 추가
                            </Button>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
                            <Table className="w-full text-xs">
                                <TableHeader className="bg-slate-100">
                                    <TableRow>
                                        <TableHead className="w-[60px] text-center">번호</TableHead>
                                        <TableHead>휴업 날짜 (YYYY-MM-DD)</TableHead>
                                        <TableHead className="w-[50px] text-center">삭제</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tempHolidays.map((hDate, idx) => (
                                        <TableRow key={hDate} className="hover:bg-slate-50">
                                            <TableCell className="text-center font-bold">{idx + 1}</TableCell>
                                            <TableCell className="font-mono text-slate-800">{hDate}</TableCell>
                                            <TableCell className="text-center">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => setTempHolidays(tempHolidays.filter(d => d !== hDate))}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsHolidayDialogOpen(false)}>취소</Button>
                        <Button size="sm" onClick={handleSaveHolidays} className="bg-amber-600 text-white font-bold">
                            휴업일 저장 및 배정표 생성
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 4. Slot Edit Dialog */}
            <Dialog open={isEditSlotDialogOpen} onOpenChange={setIsEditSlotDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-indigo-600" />
                            <span>특정 날짜 근무 교사 수정</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {selectedSlot && `${selectedSlot.slot.dateStr} (${selectedSlot.dayKey}) 등교 지도 근무자 변경` }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3 text-xs">
                        <div className="flex items-center space-x-2">
                            <Switch 
                                id="is-holiday-switch" 
                                checked={editIsHoliday} 
                                onCheckedChange={setEditIsHoliday} 
                            />
                            <Label htmlFor="is-holiday-switch" className="font-bold text-slate-800 cursor-pointer">
                                이 날짜를 휴업일(미운영)로 설정
                            </Label>
                        </div>

                        {!editIsHoliday && (
                            <div className="space-y-2">
                                <Label className="font-bold text-slate-700">근무 교사 성명</Label>
                                <Input 
                                    value={editTeacherName} 
                                    onChange={e => setEditTeacherName(e.target.value)} 
                                    placeholder="교사 성명 입력..." 
                                    className="text-xs font-bold"
                                />

                                {teachers.length > 0 && (
                                    <div className="space-y-1 pt-2">
                                        <Label className="text-[11px] text-slate-500">등록 교사 중 선택:</Label>
                                        <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto">
                                            {teachers.map(t => (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => setEditTeacherName(t.name)}
                                                    className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-indigo-100 text-slate-800 hover:text-indigo-900 border border-slate-200"
                                                >
                                                    {t.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsEditSlotDialogOpen(false)}>취소</Button>
                        <Button size="sm" onClick={handleSaveSlotEdit} className="bg-indigo-600 text-white font-bold">
                            저장하기
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
