'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription 
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    Calendar, 
    Clock, 
    Download, 
    Printer, 
    UserCheck, 
    Sun, 
    AlertCircle, 
    Phone, 
    School,
    CheckCircle2,
    CalendarCheck,
    Info
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getKisbusDb as db } from '@/lib/kisbus/firebase';
import { cn } from '@/lib/kisbus/utils';
import { format, addDays } from 'date-fns';
import * as XLSX from 'xlsx';

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

interface MorningGateDutyDialogProps {
    currentTeacherName?: string;
    semesterMode?: 'regular' | 'vacation';
    lang?: string;
}

export const MorningGateDutyDialog = ({
    currentTeacherName,
    semesterMode = 'regular',
    lang = 'ko'
}: MorningGateDutyDialogProps) => {
    const [config, setConfig] = useState<MultiSemesterMorningGateDutyConfig | null>(null);
    const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // Subscribe to morning gate duty multi-semester configuration
    useEffect(() => {
        const unsub = onSnapshot(doc(db(), 'config', 'morningGateDutyMulti'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as MultiSemesterMorningGateDutyConfig;
                setConfig(data);
                
                // Determine initial selected semester matching semesterMode or activeSemesterId
                setSelectedSemesterId(prev => {
                    if (prev && data.semesters?.[prev]) return prev;
                    if (data.activeSemesterId && data.semesters?.[data.activeSemesterId]) {
                        return data.activeSemesterId;
                    }
                    if (semesterMode === 'vacation') {
                        return data.semesters?.['2026_summer'] ? '2026_summer' : (data.activeSemesterId || '2026_2');
                    }
                    return data.semesters?.['2026_2'] ? '2026_2' : (data.activeSemesterId || '2026_1');
                });
            }
            setLoading(false);
        }, (err) => {
            console.error("Error loading morning gate duty:", err);
            setLoading(false);
        });

        return () => unsub();
    }, [semesterMode]);

    // Current date (Local Vietnam/Korea context)
    const { todayStr, tomorrowStr, todayDate, tomorrowDate } = useMemo(() => {
        const now = new Date();
        const vTime = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60000);
        const tStr = format(vTime, 'yyyy-MM-dd');
        const nextDay = addDays(vTime, 1);
        const tmStr = format(nextDay, 'yyyy-MM-dd');
        return {
            todayStr: tStr,
            tomorrowStr: tmStr,
            todayDate: vTime,
            tomorrowDate: nextDay
        };
    }, []);

    // Current active schedule for selected semester
    const currentSchedule: WeekDutyRow[] = useMemo(() => {
        if (!config?.schedules || !selectedSemesterId) return [];
        return config.schedules[selectedSemesterId] || [];
    }, [config, selectedSemesterId]);

    const activeSemesterInfo = useMemo(() => {
        return config?.semesters?.[selectedSemesterId] || null;
    }, [config, selectedSemesterId]);

    // Flatten all slots for easy lookup
    const allSlots = useMemo(() => {
        const slots: (DayDutySlot & { weekNum: number })[] = [];
        const daysKeys: ('월' | '화' | '수' | '목' | '금')[] = ['월', '화', '수', '목', '금'];
        currentSchedule.forEach(week => {
            daysKeys.forEach(k => {
                const s = week.days[k];
                if (s && s.dateStr) {
                    slots.push({ ...s, weekNum: week.weekNum });
                }
            });
        });
        return slots;
    }, [currentSchedule]);

    // Today's duty slot
    const todayDutySlot = useMemo(() => {
        return allSlots.find(s => s.dateStr === todayStr) || null;
    }, [allSlots, todayStr]);

    // Tomorrow's duty slot (or next school day if tomorrow is weekend)
    const tomorrowDutySlot = useMemo(() => {
        // Direct match with tomorrow's date
        const direct = allSlots.find(s => s.dateStr === tomorrowStr);
        if (direct) return direct;

        // If tomorrow is not in schedule (e.g. weekend), find the next upcoming slot after today
        return allSlots.find(s => s.dateStr > todayStr && !s.isHoliday) || null;
    }, [allSlots, tomorrowStr, todayStr]);

    const isMyDutyToday = useMemo(() => {
        return Boolean(currentTeacherName && todayDutySlot && todayDutySlot.teacherName === currentTeacherName && !todayDutySlot.isHoliday);
    }, [todayDutySlot, currentTeacherName]);

    const isMyDutyTomorrow = useMemo(() => {
        return Boolean(currentTeacherName && tomorrowDutySlot && tomorrowDutySlot.teacherName === currentTeacherName && !tomorrowDutySlot.isHoliday);
    }, [tomorrowDutySlot, currentTeacherName]);

    // Excel Export
    const handleExportExcel = () => {
        if (!currentSchedule || currentSchedule.length === 0) return;
        const semName = activeSemesterInfo?.name || '아침_등교지도_근무표';
        const headers = ['주차', '기간', '월요일', '화요일', '수요일', '목요일', '금요일'];
        const rows = currentSchedule.map(w => [
            `${w.weekNum}주차`,
            w.periodStr,
            w.days['월']?.isHoliday ? `[휴일] ${w.days['월']?.holidayName || '공휴일'}` : w.days['월']?.teacherName || '',
            w.days['화']?.isHoliday ? `[휴일] ${w.days['화']?.holidayName || '공휴일'}` : w.days['화']?.teacherName || '',
            w.days['수']?.isHoliday ? `[휴일] ${w.days['수']?.holidayName || '공휴일'}` : w.days['수']?.teacherName || '',
            w.days['목']?.isHoliday ? `[휴일] ${w.days['목']?.holidayName || '공휴일'}` : w.days['목']?.teacherName || '',
            w.days['금']?.isHoliday ? `[휴일] ${w.days['금']?.holidayName || '공휴일'}` : w.days['금']?.teacherName || '',
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            [`${semName} 아침 교문맞이(등교지도) 근무표`],
            [`근무 시간: ${config?.startTimeStr || '08:00'} ~ ${config?.endTimeStr || '08:30'}`],
            [],
            headers,
            ...rows
        ]);
        XLSX.utils.book_append_sheet(wb, ws, '등교지도배정표');
        XLSX.writeFile(wb, `${semName}_아침_등교지도_배정표.xlsx`);
    };

    const handlePrint = () => {
        window.print();
    };

    const daysKeys: ('월' | '화' | '수' | '목' | '금')[] = ['월', '화', '수', '목', '금'];

    return (
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
            {/* 1. Header (Title & Subtitle in Single Line + Semester Selector) */}
            <DialogHeader className="space-y-1 pb-3 border-b">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <DialogTitle className="text-base sm:text-lg font-extrabold text-slate-900 whitespace-nowrap truncate flex items-center gap-2">
                        <Sun className="h-5 w-5 text-amber-500 flex-shrink-0 animate-pulse" />
                        <span>아침 등교 지도교사 배정표</span>
                    </DialogTitle>

                    {/* Semester Selector */}
                    {config?.semesters && Object.keys(config.semesters).length > 0 && (
                        <div className="flex items-center gap-2">
                            <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
                                <SelectTrigger className="h-8 text-xs font-bold w-[190px] bg-slate-50 border-slate-300">
                                    <SelectValue placeholder="학기 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.values(config.semesters).map(sem => (
                                        <SelectItem key={sem.id} value={sem.id} className="text-xs font-medium">
                                            {sem.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Badge 
                                variant={activeSemesterInfo?.type === 'vacation' ? 'destructive' : 'secondary'} 
                                className="text-[10px] font-bold px-2 py-0.5 shrink-0"
                            >
                                {activeSemesterInfo?.type === 'vacation' ? '방학 중' : '학기 중'}
                            </Badge>
                        </div>
                    )}
                </div>
                <DialogDescription className="text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-2">
                    <span>근무 시간: <strong>{config?.startTimeStr || '08:00'} ~ {config?.endTimeStr || '08:30'}</strong></span>
                    <span>•</span>
                    <span>위치: <strong>교문 앞</strong></span>
                    {config?.studentIssueContact && (
                        <>
                            <span>•</span>
                            <span>학생 이슈: <strong>{config.studentIssueContact}</strong></span>
                        </>
                    )}
                </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 flex-1 min-h-0 pt-2 overflow-y-auto pr-0.5">
                {/* 2. Top Banner: My Duty Notification (if logged in teacher has upcoming duty) */}
                {(isMyDutyToday || isMyDutyTomorrow) && (
                    <div className={cn(
                        "p-3 rounded-xl border flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1",
                        isMyDutyToday 
                            ? "bg-amber-500/15 border-amber-400/60 text-amber-950" 
                            : "bg-sky-500/15 border-sky-400/60 text-sky-950"
                    )}>
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className={cn(
                                "p-2 rounded-lg text-white font-bold text-xs shrink-0",
                                isMyDutyToday ? "bg-amber-600 shadow-xs" : "bg-sky-600 shadow-xs"
                            )}>
                                {isMyDutyToday ? '오늘 당번' : '내일 당번'}
                            </div>
                            <div className="text-xs truncate">
                                <span className="font-extrabold text-sm">
                                    {currentTeacherName} 선생님, {isMyDutyToday ? '오늘' : '내일'} 아침 등교 지도 당번입니다!
                                </span>
                                <span className="block text-[11px] opacity-80 mt-0.5">
                                    시간: {config?.startTimeStr || '08:00'} ~ {config?.endTimeStr || '08:30'} (교문 앞)
                                </span>
                            </div>
                        </div>
                        <Badge className={cn("text-[11px] font-bold px-2.5 py-1 shrink-0", isMyDutyToday ? "bg-amber-600" : "bg-sky-600")}>
                            {isMyDutyToday ? '08:00 근무 시작' : '내일 아침 준비'}
                        </Badge>
                    </div>
                )}

                {/* 3. Quick Cards: Today & Tomorrow Duty Teachers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Today Card */}
                    <div className="p-3.5 rounded-xl border bg-gradient-to-br from-amber-50/90 to-orange-50/60 border-amber-300/80 shadow-xs flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                                <Sun className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[10px] font-extrabold px-1.5 py-0">
                                        오늘 근무
                                    </Badge>
                                    <span className="text-xs font-semibold text-amber-900">
                                        {format(todayDate, 'M월 d일 (E)')}
                                    </span>
                                </div>
                                <div className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                                    {todayDutySlot ? (
                                        todayDutySlot.isHoliday ? (
                                            <span className="text-rose-600 font-bold">
                                                휴일 ({todayDutySlot.holidayName || '공휴일'})
                                            </span>
                                        ) : (
                                            <span className="text-amber-950 flex items-center gap-1.5">
                                                <span>{todayDutySlot.teacherName} 선생님</span>
                                                {todayDutySlot.roundNumber && (
                                                    <span className="text-[11px] font-semibold text-amber-700">
                                                        ({todayDutySlot.roundNumber}회차)
                                                    </span>
                                                )}
                                                {todayDutySlot.teacherName === currentTeacherName && (
                                                    <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700 bg-amber-100 font-bold">
                                                        본인
                                                    </Badge>
                                                )}
                                            </span>
                                        )
                                    ) : (
                                        <span className="text-slate-400 font-normal text-xs italic">
                                            배정된 근무자 없음 (주말/방학)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tomorrow Card */}
                    <div className="p-3.5 rounded-xl border bg-gradient-to-br from-sky-50/90 to-blue-50/60 border-sky-300/80 shadow-xs flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                                <CalendarCheck className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <Badge className="bg-sky-500 text-white hover:bg-sky-600 text-[10px] font-extrabold px-1.5 py-0">
                                        내일 근무
                                    </Badge>
                                    <span className="text-xs font-semibold text-sky-900">
                                        {tomorrowDutySlot?.dateStr 
                                            ? `${tomorrowDutySlot.dateStr.slice(5).replace('-', '/')} (${tomorrowDutySlot.dayOfWeekName})`
                                            : format(tomorrowDate, 'M월 d일 (E)')}
                                    </span>
                                </div>
                                <div className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                                    {tomorrowDutySlot ? (
                                        tomorrowDutySlot.isHoliday ? (
                                            <span className="text-rose-600 font-bold">
                                                휴일 ({tomorrowDutySlot.holidayName || '공휴일'})
                                            </span>
                                        ) : (
                                            <span className="text-sky-950 flex items-center gap-1.5">
                                                <span>{tomorrowDutySlot.teacherName} 선생님</span>
                                                {tomorrowDutySlot.roundNumber && (
                                                    <span className="text-[11px] font-semibold text-sky-700">
                                                        ({tomorrowDutySlot.roundNumber}회차)
                                                    </span>
                                                )}
                                                {tomorrowDutySlot.teacherName === currentTeacherName && (
                                                    <Badge variant="outline" className="text-[10px] border-sky-500 text-sky-700 bg-sky-100 font-bold">
                                                        본인
                                                    </Badge>
                                                )}
                                            </span>
                                        )
                                    ) : (
                                        <span className="text-slate-400 font-normal text-xs italic">
                                            배정된 근무자 없음
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Full Schedule Table */}
                <div className="border rounded-xl overflow-hidden shadow-2xs flex flex-col flex-1 min-h-[300px] bg-white">
                    <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-indigo-600" />
                            <span>{activeSemesterInfo?.name || '전체 배정표'} ({currentSchedule.length}주차)</span>
                        </span>
                        <div className="flex items-center gap-3 text-[11px] font-semibold">
                            <span className="flex items-center gap-1 text-amber-800">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block border border-amber-500" />
                                오늘
                            </span>
                            <span className="flex items-center gap-1 text-sky-800">
                                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block border border-sky-500" />
                                내일
                            </span>
                            <span className="flex items-center gap-1 text-indigo-800">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-200 inline-block border border-indigo-400" />
                                본인
                            </span>
                            <span className="flex items-center gap-1 text-rose-700">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-200 inline-block border border-rose-300" />
                                휴일
                            </span>
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 max-h-[46vh]">
                        <Table className="w-full text-xs">
                            <TableHeader className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-10 shadow-2xs">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-[50px] text-center font-bold text-slate-700 py-2">주차</TableHead>
                                    <TableHead className="w-[85px] text-center font-bold text-slate-700 py-2">기간</TableHead>
                                    <TableHead className="text-center font-bold text-slate-700 py-2">월요일</TableHead>
                                    <TableHead className="text-center font-bold text-slate-700 py-2">화요일</TableHead>
                                    <TableHead className="text-center font-bold text-slate-700 py-2">수요일</TableHead>
                                    <TableHead className="text-center font-bold text-slate-700 py-2">목요일</TableHead>
                                    <TableHead className="text-center font-bold text-slate-700 py-2">금요일</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-slate-400">
                                            배정표를 불러오는 중입니다...
                                        </TableCell>
                                    </TableRow>
                                ) : currentSchedule.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-slate-400">
                                            등록된 등교지도 배정표가 없습니다.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    currentSchedule.map((row) => (
                                        <TableRow key={row.weekNum} className="hover:bg-slate-50/50">
                                            {/* Week Num */}
                                            <TableCell className="text-center font-bold text-slate-600 bg-slate-50/60 py-2 border-r">
                                                {row.weekNum}
                                            </TableCell>
                                            {/* Period */}
                                            <TableCell className="text-center text-[11px] text-slate-500 whitespace-nowrap py-2 border-r font-mono">
                                                {row.periodStr}
                                            </TableCell>
                                            {/* Days Mon-Fri */}
                                            {daysKeys.map((dayKey) => {
                                                const slot = row.days[dayKey];
                                                if (!slot) {
                                                    return (
                                                        <TableCell key={dayKey} className="text-center text-slate-300 py-2 border-r">
                                                            -
                                                        </TableCell>
                                                    );
                                                }

                                                const isToday = slot.dateStr === todayStr;
                                                const isTomorrow = slot.dateStr === tomorrowStr;
                                                const isMyDuty = Boolean(currentTeacherName && slot.teacherName === currentTeacherName && !slot.isHoliday);
                                                const isHoliday = slot.isHoliday;

                                                // Date label format: "8.18"
                                                const shortDate = slot.dateStr ? slot.dateStr.slice(5).replace('-', '.') : '';

                                                return (
                                                    <TableCell
                                                        key={dayKey}
                                                        className={cn(
                                                            "text-center py-2 px-1 border-r transition-all relative",
                                                            isToday && "bg-amber-100/90 font-black text-amber-950 ring-2 ring-amber-400 shadow-xs z-1",
                                                            isTomorrow && !isToday && "bg-sky-100/90 font-black text-sky-950 ring-2 ring-sky-400 shadow-xs z-1",
                                                            isMyDuty && !isToday && !isTomorrow && "bg-indigo-50/90 font-bold text-indigo-900 border-indigo-300",
                                                            isHoliday && !isToday && !isTomorrow && "bg-rose-50/80 text-rose-500 font-medium"
                                                        )}
                                                    >
                                                        <div className="flex flex-col items-center justify-center gap-0.5">
                                                            {/* Date & Today/Tomorrow Badge */}
                                                            <div className="flex items-center gap-1">
                                                                <span className={cn(
                                                                    "text-[10px] font-mono",
                                                                    isToday ? "text-amber-800 font-extrabold" : (isTomorrow ? "text-sky-800 font-extrabold" : "text-slate-400")
                                                                )}>
                                                                    {shortDate}
                                                                </span>
                                                                {isToday && (
                                                                    <Badge className="bg-amber-500 text-white text-[9px] px-1 py-0 h-3.5 leading-none">
                                                                        오늘
                                                                    </Badge>
                                                                )}
                                                                {isTomorrow && !isToday && (
                                                                    <Badge className="bg-sky-500 text-white text-[9px] px-1 py-0 h-3.5 leading-none">
                                                                        내일
                                                                    </Badge>
                                                                )}
                                                            </div>

                                                            {/* Teacher or Holiday Name */}
                                                            {isHoliday ? (
                                                                <span className="text-[11px] font-semibold text-rose-600 truncate max-w-[90px]">
                                                                    {slot.holidayName || '공휴일'}
                                                                </span>
                                                            ) : (
                                                                <span className={cn(
                                                                    "text-xs truncate max-w-[95px]",
                                                                    isToday ? "font-black text-amber-950" : (isTomorrow ? "font-black text-sky-950" : (isMyDuty ? "font-bold text-indigo-900" : "font-semibold text-slate-800"))
                                                                )}>
                                                                    {slot.teacherName}
                                                                    {isMyDuty && !isToday && !isTomorrow && (
                                                                        <span className="text-[10px] text-indigo-600 ml-0.5 font-bold">
                                                                            (본인)
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {/* 5. Footer (Action Buttons Side-by-Side matching Rule 6) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t bg-slate-50/50 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 sm:p-6">
                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>개인 사정 등으로 근무 교체가 필요할 경우 담당자에게 사전 연락 바랍니다.</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs font-semibold gap-1"
                        onClick={handleExportExcel}
                        disabled={currentSchedule.length === 0}
                    >
                        <Download className="h-3.5 w-3.5" />
                        <span>엑셀 다운로드</span>
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs font-semibold gap-1"
                        onClick={handlePrint}
                        disabled={currentSchedule.length === 0}
                    >
                        <Printer className="h-3.5 w-3.5" />
                        <span>인쇄</span>
                    </Button>
                </div>
            </div>
        </DialogContent>
    );
};
