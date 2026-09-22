'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getKisbusDb as db } from '@/lib/kisbus/firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/kisbus/utils';
import type { Bus, Teacher, Route, DayOfWeek, RouteType } from '@/lib/kisbus/types';
import { sortBuses } from './bus-page-utils';

/**
 * "담당 교사 배정 현황" 다이얼로그 본문 (teacher/bus/page.tsx에서 순수 이동).
 *
 * 원래부터 TeacherPage 내부 클로저를 참조하지 않는, props만으로 동작하는
 * 독립 컴포넌트였기 때문에 그대로 파일만 옮긴 것이다 (동작 변경 없음).
 * 부모는 <Dialog><TeacherAssignmentViewDialog .../></Dialog> 형태로 감싸서 사용한다.
 */
export const TeacherAssignmentViewDialog = ({
    buses,
    teachers,
    afterSchoolTeachers,
    saturdayTeachers,
    selectedDay: initialDay,
    selectedRouteType: initialRouteType,
    semesterMode = 'regular',
    t
}: {
    buses: Bus[];
    teachers: Teacher[];
    afterSchoolTeachers: Teacher[];
    saturdayTeachers: Teacher[];
    selectedDay: DayOfWeek;
    selectedRouteType: RouteType;
    semesterMode?: 'regular' | 'vacation';
    t: any;
}) => {
    // Mode: 'commute' (통학버스 [등·하교 통합]), 'afterSchool' (방과후 요일별), 'saturday' (토요)
    const [viewCategory, setViewCategory] = useState<'commute' | 'afterSchool' | 'saturday'>(() => {
        if (initialDay === 'Saturday') return 'saturday';
        if (initialRouteType === 'AfterSchool') return 'afterSchool';
        return 'commute';
    });

    const [afterSchoolDay, setAfterSchoolDay] = useState<DayOfWeek>(() => {
        return initialDay === 'Saturday' ? 'Monday' : initialDay;
    });

    const [routesList, setRoutesList] = useState<Route[]>([]);
    const [loading, setLoading] = useState(true);

    // Sync initial state on open
    useEffect(() => {
        if (initialDay === 'Saturday') {
            setViewCategory('saturday');
        } else if (initialRouteType === 'AfterSchool') {
            setViewCategory('afterSchool');
            setAfterSchoolDay(initialDay);
        } else {
            setViewCategory('commute');
        }
    }, [initialDay, initialRouteType]);

    // Real-time listener for current selected category/day, strictly filtering by semesterMode
    useEffect(() => {
        setLoading(true);
        let q;
        if (viewCategory === 'commute') {
            // Commute uses Afternoon / Morning routes (which are strictly synchronized)
            q = query(
                collection(db(), 'routes'),
                where('dayOfWeek', '==', 'Monday'),
                where('type', '==', 'Afternoon')
            );
        } else if (viewCategory === 'afterSchool') {
            q = query(
                collection(db(), 'routes'),
                where('dayOfWeek', '==', afterSchoolDay),
                where('type', '==', semesterMode === 'vacation' ? 'Afternoon' : 'AfterSchool')
            );
        } else {
            q = query(
                collection(db(), 'routes'),
                where('dayOfWeek', '==', 'Saturday')
            );
        }

        const unsub = onSnapshot(q, (snap) => {
            const fetched = snap.docs
                .map((d: any) => ({ id: d.id, ...d.data() } as Route))
                .filter(r => (r.semesterMode || 'regular') === semesterMode);
            setRoutesList(fetched);
            setLoading(false);
        }, (e: any) => {
            console.error("Assignment dialog real-time fetch error:", e);
            setLoading(false);
        });

        return () => unsub();
    }, [viewCategory, afterSchoolDay, semesterMode]);

    // Unified teacher lookup map across all teacher categories (filtered by current semesterMode)
    const allTeachersMap = useMemo(() => {
        const map = new Map<string, Teacher>();
        (teachers || []).filter(tc => (tc.semesterMode || 'regular') === semesterMode).forEach(tc => { if (tc?.id) map.set(tc.id, tc); });
        (afterSchoolTeachers || []).filter(tc => (tc.semesterMode || 'regular') === semesterMode).forEach(tc => { if (tc?.id && !map.has(tc.id)) map.set(tc.id, tc); });
        (saturdayTeachers || []).filter(tc => (tc.semesterMode || 'regular') === semesterMode).forEach(tc => { if (tc?.id && !map.has(tc.id)) map.set(tc.id, tc); });
        return map;
    }, [teachers, afterSchoolTeachers, saturdayTeachers, semesterMode]);

    // Filter to active, operational buses strictly belonging to the CURRENT semesterMode and viewCategory
    const operationalBuses = useMemo(() => {
        return sortBuses(
            (buses || []).filter(b => {
                if ((b.semesterMode || 'regular') !== semesterMode) return false;
                if (b.isActive === false) return false;

                // 노선 구분별 배정 제외 플래그 (GEMINI.md 스쿨버스 도메인 규칙 3)
                const isExcluded = viewCategory === 'commute'
                    ? (b.excludeFromAssignmentByType?.commute ?? b.excludeFromAssignment ?? false)
                    : viewCategory === 'afterSchool'
                        ? (b.excludeFromAssignmentByType?.afterSchool ?? b.excludeFromAssignment ?? false)
                        : (b.excludeFromAssignmentByType?.saturday ?? b.excludeFromAssignment ?? false);
                if (isExcluded) return false;

                // 실운행 검증: 해당 구분의 routesList에 해당 버스 노선이 존재하고 정류장/탑승 학생이 있는지 확인 (GEMINI.md 스쿨버스 도메인 규칙 5)
                const matchingRoutes = routesList.filter(r => r.busId === b.id);
                if (matchingRoutes.length === 0) return false;

                const hasStops = matchingRoutes.some(r => Array.isArray(r.stops) && r.stops.length > 0);
                if (semesterMode === 'vacation') {
                    if (!hasStops) return false;
                } else {
                    const hasStudents = matchingRoutes.some(r => Array.isArray(r.seating) && r.seating.some(s => s && s.studentId !== null));
                    if (!hasStops || !hasStudents) return false;
                }

                return true;
            })
        );
    }, [buses, semesterMode, viewCategory, routesList]);

    const getAssignedNames = (busId: string): string[] => {
        const r = routesList.find(x => x.busId === busId);

        // 1. Authoritative Route assignment
        if (r) {
            if (r.teacherIds && r.teacherIds.filter(Boolean).length > 0) {
                const names = r.teacherIds
                    .map(id => allTeachersMap.get(id)?.name)
                    .filter((n): n is string => Boolean(n));
                if (names.length > 0) return Array.from(new Set(names));
            }
            // Route exists but has no assigned teachers -> correctly return empty (미배정)
            return [];
        }

        // 2. Fallback only if no route document exists at all in database
        if (viewCategory === 'commute') {
            const busTeachers = (teachers || []).filter(tc =>
                (tc.semesterMode || 'regular') === semesterMode &&
                tc.assignedBusId === busId
            );
            if (busTeachers.length > 0) {
                return Array.from(new Set(busTeachers.map(tc => tc.name).filter(Boolean)));
            }
        }
        return [];
    };

    return (
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-5">
            <DialogHeader className="space-y-1.5 pb-2 border-b">
                <div className="flex items-center justify-between gap-2">
                    <DialogTitle className="text-base sm:text-lg font-extrabold text-slate-900 whitespace-nowrap truncate">
                        {t('teacher_page.assignments_dialog.title')}
                    </DialogTitle>
                    <Badge
                        variant={semesterMode === 'vacation' ? 'destructive' : 'secondary'}
                        className="text-[10px] font-bold px-2 py-0.5 shrink-0"
                    >
                        {semesterMode === 'vacation' ? (t('vacation') || '방학 중') : (t('regular') || '학기 중')}
                    </Badge>
                </div>
                <DialogDescription className="text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
                    {t('teacher_page.assignments_dialog.description')}
                </DialogDescription>
            </DialogHeader>

            {/* Filter Selector Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b bg-slate-50/80 -mx-5 px-5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">구분:</span>
                    <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setViewCategory('commute')}
                            className={cn(
                                "px-2.5 py-1 text-xs font-bold rounded-md transition-all",
                                viewCategory === 'commute' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            통학 (등·하교)
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewCategory('afterSchool')}
                            className={cn(
                                "px-2.5 py-1 text-xs font-bold rounded-md transition-all",
                                viewCategory === 'afterSchool' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            방과후
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewCategory('saturday')}
                            className={cn(
                                "px-2.5 py-1 text-xs font-bold rounded-md transition-all",
                                viewCategory === 'saturday' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            토요 버스
                        </button>
                    </div>
                </div>

                {viewCategory === 'afterSchool' && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600">요일:</span>
                        <Select value={afterSchoolDay} onValueChange={(val) => setAfterSchoolDay(val as DayOfWeek)}>
                            <SelectTrigger className="h-8 text-xs font-semibold w-[100px] bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as DayOfWeek[]).map(d => (
                                    <SelectItem key={d} value={d} className="text-xs font-medium">
                                        {t(`day.${d.toLowerCase()}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            <div className="mt-2 border rounded-xl overflow-y-auto flex-1 min-h-[260px] shadow-xs">
                {loading ? (
                    <div className="flex justify-center items-center py-16 text-xs text-muted-foreground">
                        {t('loading')}...
                    </div>
                ) : operationalBuses.length === 0 ? (
                    <div className="flex justify-center items-center py-16 text-xs text-muted-foreground">
                        운행 중인 버스가 없습니다.
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-slate-100 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-[100px] font-bold text-slate-800">{t('admin.bus_registration.bus_number')}</TableHead>
                                <TableHead className="w-[80px] font-bold text-slate-800">{t('type')}</TableHead>
                                <TableHead className="font-bold text-slate-800">
                                    {viewCategory === 'commute' ? '통학버스 담당 교사 (등·하교 공통)' : (viewCategory === 'afterSchool' ? '방과후 담당 교사' : '토요 담당 교사')}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {operationalBuses.map((b: Bus) => {
                                const namesList = getAssignedNames(b.id);
                                const isUnassigned = namesList.length === 0;

                                return (
                                    <TableRow key={b.id} className="hover:bg-slate-50/80">
                                        <TableCell className="font-bold whitespace-nowrap text-slate-900">{b.name}</TableCell>
                                        <TableCell className="whitespace-nowrap text-xs text-slate-600">{t(`bus_type.${b.type}`)}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1.5 items-center">
                                                {isUnassigned ? (
                                                    <span className="text-slate-400 italic text-xs">{t('unassigned')}</span>
                                                ) : (
                                                    namesList.map((nameStr: string, i: number) => (
                                                        <Badge key={i} variant="secondary" className="font-bold text-xs bg-indigo-50 text-indigo-700 border-indigo-200 py-0.5 px-2 whitespace-nowrap">
                                                            {nameStr}
                                                        </Badge>
                                                    ))
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>
        </DialogContent>
    );
};
