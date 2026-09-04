'use client';

import React, { useState, useMemo } from 'react';
import type { AfterSchoolClass, Student, Bus, Route, Teacher, DayOfWeek, Destination } from '@/lib/kisbus/types';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Search, GraduationCap, Bus as BusIcon } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { getStudentName, normalizeString } from '@/lib/kisbus/utils';

interface AfterSchoolInquiryDialogProps {
    afterSchoolClasses: AfterSchoolClass[];
    afterSchoolTeachers: Teacher[];
    students: Student[];
    buses: Bus[];
    routes: Route[];
    destinations: Destination[];
    semesterMode?: 'regular' | 'vacation';
    isAfterSchoolActive?: boolean;
    afterschoolStageStatus?: string;
}

export const AfterSchoolInquiryDialog = ({
    afterSchoolClasses,
    afterSchoolTeachers,
    students,
    buses,
    routes,
    destinations,
    semesterMode = 'regular',
    isAfterSchoolActive,
    afterschoolStageStatus,
}: AfterSchoolInquiryDialogProps) => {
    const { t, i18n } = useTranslation();
    const isVacationMode = semesterMode === 'vacation';
    const isOperating = isAfterSchoolActive ?? (afterschoolStageStatus ? (afterschoolStageStatus === 'CONFIRMED' || afterschoolStageStatus === 'OPERATING') : true);

    const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>('all');
    const [selectedTeacherId, setSelectedTeacherId] = useState<string | 'all'>('all');
    const [classSearchQuery, setClassSearchQuery] = useState('');
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [showBusRidersOnly, setShowBusRidersOnly] = useState(false);

    const filteredClasses = useMemo(() => {
        return afterSchoolClasses.filter(c => {
            if ((c.semesterMode || 'regular') !== semesterMode) return false;
            if (selectedDay !== 'all' && c.dayOfWeek !== selectedDay) return false;
            if (selectedTeacherId !== 'all' && c.teacherId !== selectedTeacherId) return false;
            if (classSearchQuery.trim()) {
                const q = normalizeString(classSearchQuery.trim());
                const nameMatch = normalizeString(c.name).includes(q);
                const teacherMatch = c.teacherName && normalizeString(c.teacherName).includes(q);
                if (!nameMatch && !teacherMatch) return false;
            }
            return true;
        }).sort((a, b) => {
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            if (a.dayOfWeek !== b.dayOfWeek) return days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
            return a.name.localeCompare(b.name, 'ko');
        });
    }, [afterSchoolClasses, selectedDay, selectedTeacherId, classSearchQuery, semesterMode]);

    const displayClasses = useMemo(() => {
        const seenIds = new Set<string>();
        const seenNames = isVacationMode ? new Set<string>() : null;

        return filteredClasses.filter(c => {
            if (!c.id || seenIds.has(c.id)) return false;
            seenIds.add(c.id);

            if (seenNames) {
                if (seenNames.has(c.name)) return false;
                seenNames.add(c.name);
            }
            return true;
        });
    }, [filteredClasses, isVacationMode]);

    const classStudents = useMemo(() => {
        if (!selectedClassId) return [];
        const targetClass = afterSchoolClasses.find(c => c.id === selectedClassId);
        if (!targetClass) return [];

        const isSaturday = targetClass.dayOfWeek === 'Saturday';

        return students
            .filter(s => {
                if (isVacationMode) {
                    const targetClassIds = afterSchoolClasses
                        .filter(c => c.semesterMode === 'vacation' && c.name === targetClass.name)
                        .map(c => c.id);
                    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                    const hasId = days.some(day => {
                        const classId = s.afterSchoolClassIds?.[day] || s.vacationAfterSchoolClassIds?.[day];
                        return classId && targetClassIds.includes(classId);
                    });
                    if (hasId) return true;
                }
                const dayMatch = s.afterSchoolClassIds?.[targetClass.dayOfWeek] === targetClass.id;
                if (dayMatch) return true;

                // 이름 기반 매칭 fallback
                const titles = (s as any).enrolledCourseTitles || (s as any).afterSchoolCourseTitles || [];
                const singleTitle = (s as any).afterSchoolCourseTitle;
                return titles.some((t: string) => t === targetClass.name) || singleTitle === targetClass.name;
            })
            .map(s => {
                // 토요일은 AfterSchool 노선이 없고 일반 등하교(Morning/Afternoon) 노선을 사용
                const studentRoute = routes.find(r =>
                    (r.semesterMode || 'regular') === semesterMode &&
                    r.dayOfWeek === targetClass.dayOfWeek &&
                    (isSaturday
                        ? (r.type === 'Morning' || r.type === 'Afternoon')
                        : r.type === 'AfterSchool'
                    ) &&
                    r.seating.some(seat => seat.studentId === s.id)
                );
                const bus = buses.find(b => b.id === studentRoute?.busId && (b.semesterMode || 'regular') === semesterMode);
                const busName = bus?.name || t('unassigned');
                return { ...s, busName };
            })
            .sort((a, b) => {
                const gA = parseInt(a.grade) || 0;
                const gB = parseInt(b.grade) || 0;
                if (gA !== gB) return gA - gB;
                const cA = parseInt(a.class) || 0;
                const cB = parseInt(b.class) || 0;
                if (cA !== cB) return cA - cB;
                return getStudentName(a, i18n.language).localeCompare(getStudentName(b, i18n.language), 'ko');
            });
    }, [selectedClassId, students, afterSchoolClasses, routes, buses, t, i18n.language, isOperating, isVacationMode, semesterMode]);

    const displayedClassStudents = useMemo(() => {
        if (!showBusRidersOnly) return classStudents;
        return classStudents.filter(s => s.busName && s.busName !== t('unassigned') && s.busName !== '-');
    }, [classStudents, showBusRidersOnly, t]);

    const handleDownload = () => {
        if (!selectedClassId || displayedClassStudents.length === 0) return;
        const targetClass = afterSchoolClasses.find(c => c.id === selectedClassId);
        if (!targetClass) return;
        const headers = ['학년', '반', '이름', '방과후 버스번호'];
        const rows = displayedClassStudents.map(s => [s.grade, s.class, getStudentName(s, i18n.language), s.busName].join(','));
        const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.body.appendChild(document.createElement('a'));
        link.setAttribute('href', url);
        const filterSuffix = showBusRidersOnly ? '_버스탑승자만' : '';
        link.setAttribute('download', `${targetClass.name}_명단${filterSuffix}.csv`);
        link.click();
        document.body.removeChild(link);
    };

    const selectedClass = afterSchoolClasses.find(c => c.id === selectedClassId);

    return (
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-5">
            <DialogHeader className="space-y-1.5 pb-2 border-b">
                <div className="flex items-center justify-between gap-2">
                    <DialogTitle className="text-base sm:text-lg font-extrabold text-slate-900 whitespace-nowrap truncate flex items-center gap-2">
                        <Search className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                        <span>방과후 명단 조회</span>
                    </DialogTitle>
                    <Badge 
                        variant={!isOperating ? 'outline' : (isVacationMode ? 'destructive' : 'secondary')}
                        className="text-[10px] font-bold px-2 py-0.5 shrink-0"
                    >
                        {!isOperating ? '운영 종료' : (isVacationMode ? '방학 중' : '학기 중')}
                    </Badge>
                </div>
                <DialogDescription className="text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
                    수업별 학생 목록과 탑승 버스를 확인합니다.
                </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 flex-1 min-h-0 pt-2">
                {!isOperating || displayClasses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border rounded-xl bg-slate-50/70 my-auto">
                        <div className="p-3.5 bg-white border shadow-xs rounded-2xl mb-3 text-slate-400">
                            <GraduationCap className="h-9 w-9 text-slate-400" />
                        </div>
                        <h3 className="font-extrabold text-sm text-slate-800 mb-1.5">
                            {afterschoolStageStatus === 'CLOSED' || !isOperating ? '방과후학교 운영이 종료되었습니다' : '조회 가능한 방과후 수업이 없습니다'}
                        </h3>
                        <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                            {afterschoolStageStatus === 'CLOSED' || !isOperating
                                ? '방과후학교 관리자가 학기 운영을 종료하여 현재 등록된 방과후 수업 및 탑승 명단이 없습니다. 새로운 학기 방과후학교가 시작되기 전까지 비활성화됩니다.'
                                : '새로운 학기 방과후학교 개설 및 수강신청 버스 연동이 완료된 후 강좌와 탑승 명단이 자동으로 활성화됩니다.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* 필터 영역 */}
                        {!isVacationMode && (
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-700">요일 선택</Label>
                                <Select value={selectedDay} onValueChange={(v: any) => { setSelectedDay(v); setSelectedClassId(null); }}>
                                    <SelectTrigger className="h-8 text-xs font-medium"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">전체</SelectItem>
                                        {(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as DayOfWeek[]).map(d => (
                                            <SelectItem key={d} value={d} className="text-xs">{t(`day.${d.toLowerCase()}`)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-700">수업명 또는 교사명 검색</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    className="h-8 pl-8 text-xs"
                                    placeholder="수업명 또는 교사명으로 검색..."
                                    value={classSearchQuery}
                                    onChange={e => { setClassSearchQuery(e.target.value); setSelectedClassId(null); }}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-700">수업 선택</Label>
                            <Select
                                value={selectedClassId || 'none'}
                                onValueChange={v => setSelectedClassId(v === 'none' ? null : v)}
                            >
                                <SelectTrigger className="h-10 text-xs font-medium">
                                    <SelectValue placeholder="수업을 선택하세요" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none" className="text-xs font-semibold text-slate-400">수업 선택 안 함</SelectItem>
                                    {displayClasses.map(c => {
                                        const teachersList = [c.teacherName, c.teacherName2].filter(Boolean);
                                        const teachersLabel = teachersList.length > 0 ? teachersList.join(', ') : '교사 미정';
                                        return (
                                            <SelectItem key={c.id} value={c.id} className="text-xs">
                                                {isVacationMode ? '' : `[${t(`day_short.${c.dayOfWeek.toLowerCase()}`)}] `}
                                                {c.name} ({teachersLabel})
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 학생 목록 */}
                        {selectedClassId && (
                            <div className="flex flex-col gap-2 flex-1 min-h-0">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-xs font-medium text-slate-600">
                                        총 <strong className="text-slate-900 font-bold">{classStudents.length}</strong>명
                                        {classStudents.length > 0 && (
                                            <> (버스 탑승: <strong className="text-indigo-600 font-bold">{classStudents.filter(s => s.busName && s.busName !== t('unassigned') && s.busName !== '-').length}</strong>명)</>
                                        )}
                                        {showBusRidersOnly && (
                                            <span className="ml-1 text-indigo-600 font-semibold">
                                                [필터: {displayedClassStudents.length}명]
                                            </span>
                                        )}
                                        {selectedClass && (
                                            <span className="ml-1 text-slate-500">
                                                — {t(`day.${selectedClass.dayOfWeek.toLowerCase()}`)} {selectedClass.name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            variant={showBusRidersOnly ? "default" : "outline"}
                                            size="sm"
                                            className="h-7 text-xs font-semibold gap-1 px-2"
                                            onClick={() => setShowBusRidersOnly(prev => !prev)}
                                        >
                                            <BusIcon className="h-3 w-3" />
                                            {showBusRidersOnly ? '전체 보기' : '버스 탑승자만'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs font-semibold gap-1 px-2"
                                            onClick={handleDownload}
                                            disabled={displayedClassStudents.length === 0}
                                        >
                                            <Download className="h-3 w-3" /> 명단 다운로드
                                        </Button>
                                    </div>
                                </div>
                                <div className="rounded-xl border overflow-y-auto flex-1 min-h-[160px]">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead className="w-[60px] text-xs font-bold">학년</TableHead>
                                                <TableHead className="w-[50px] text-xs font-bold">반</TableHead>
                                                <TableHead className="text-xs font-bold">이름</TableHead>
                                                <TableHead className="text-right text-xs font-bold">방과후 버스</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {displayedClassStudents.length > 0 ? (
                                                displayedClassStudents.map(s => (
                                                    <TableRow key={s.id}>
                                                        <TableCell className="text-xs font-medium">{s.grade}</TableCell>
                                                        <TableCell className="text-xs font-medium">{s.class}</TableCell>
                                                        <TableCell className="font-bold text-xs text-slate-900">{getStudentName(s, i18n.language)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Badge variant={s.busName === t('unassigned') ? 'outline' : 'secondary'} className="text-xs py-0.5">
                                                                {s.busName}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                                                        {showBusRidersOnly ? '버스 탑승 학생이 없습니다.' : '배정된 학생이 없습니다.'}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </DialogContent>
    );
};

