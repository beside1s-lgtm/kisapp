'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    updateStudent, deleteStudentsInBatch, updateRouteSeating,
    copySeatingPlan, copyAllBusesSeatingPlan, unassignStudentFromAllRoutes, updateStudentsInBatch,
    addStudent, addDestinationsInBatch, getDestinations, updateRoute
} from '@/lib/kisbus';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, SeatingAssignment, NewStudent, AfterSchoolClass, Teacher } from '@/lib/kisbus/types';
import { BusSeatMap, getLayoutInfo } from '@/components/bus/bus-seat-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Shuffle, RotateCcw, Copy, AlertCircle, UserPlus, PlusCircle, Download, Upload, Search, Trash2, Clock, Sparkles, Trash } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/hooks/use-translation';
import { normalizeString, sanitizeDataForSystem, getStudentName } from '@/lib/kisbus/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { StudentUnassignedPanel } from './student-unassigned-panel';
import { StudentGlobalSearchPanel } from './student-global-search-panel';

const getGradeValue = (grade: string): number => {
  const upperGrade = grade?.trim()?.toUpperCase() || '';
  if (upperGrade === 'S') return -50; 
  if (upperGrade.startsWith('S')) {
      const num = parseInt(upperGrade.replace('S', ''), 10);
      return isNaN(num) ? -50 : -50 + (num / 100);
  }
  if (upperGrade.startsWith('K')) {
      const num = parseInt(upperGrade.replace('K', ''), 10);
      return isNaN(num) ? -100 : -100 + num;
  }
  const num = parseInt(upperGrade.replace(/\D/g, ''), 10);
  return isNaN(num) ? 999 : num;
};

const generateInitialSeating = (capacity: number): SeatingAssignment[] => {
    const extra = capacity === 45 ? 1 : 0;
    return Array.from({ length: capacity + extra }, (_, i) => ({
        seatNumber: capacity === 45 ? i : i + 1,
        studentId: null,
    }));
};

const getOptimizedSeatIndices = (assignCount: number, emptyIdx: number[], seatingArray: SeatingAssignment[]): number[] => {
    const M = emptyIdx.length;
    const N = assignCount;
    if (N === 0) return [];
    if (N >= M) return emptyIdx.slice(0, N);

    const k = Math.min(N, M - N);
    const pairedCount = N - k;
    const targetIndices: number[] = [];

    for (let i = 0; i < pairedCount; i++) targetIndices.push(emptyIdx[i]);

    const singles: number[] = [];
    let backCursor = M - 1;
    for (let i = 0; i < k; i++) {
        const idx1 = emptyIdx[backCursor];
        const idx2 = backCursor > 0 ? emptyIdx[backCursor - 1] : undefined;
        
        const seat1 = seatingArray[idx1];
        const seat2 = idx2 !== undefined ? seatingArray[idx2] : null;

        const isWin1 = seat1 && (seat1.seatNumber % 4 === 1 || seat1.seatNumber % 4 === 0);
        const isWin2 = seat2 && (seat2.seatNumber % 4 === 1 || seat2.seatNumber % 4 === 0);

        if (seat2 && isWin2 && !isWin1) {
            singles.push(idx2!);
        } else {
            singles.push(idx1);
        }
        backCursor -= 2;
    }
    
    singles.reverse();
    targetIndices.push(...singles);

    return targetIndices;
};

interface StudentManagementTabProps {
    students: Student[];
    buses: Bus[];
    routes: Route[];
    destinations: Destination[];
    selectedBusId: string | null;
    selectedDay: DayOfWeek;
    selectedRouteType: RouteType;
    days: DayOfWeek[];
    selectedGlobalStudent: Student | null;
    setSelectedGlobalStudent: React.Dispatch<React.SetStateAction<Student | null>>;
    afterSchoolClasses: AfterSchoolClass[];
    teachers: Teacher[];
    afterSchoolTeachers: Teacher[];
    saturdayTeachers: Teacher[];
    semesterMode?: 'regular' | 'vacation';
    isTransferred?: boolean;
}

export const StudentManagementTab: React.FC<StudentManagementTabProps> = ({
    students,
    buses,
    routes,
    destinations,
    selectedBusId,
    selectedDay,
    selectedRouteType,
    days,
    selectedGlobalStudent,
    setSelectedGlobalStudent,
    afterSchoolClasses,
    teachers,
    afterSchoolTeachers,
    saturdayTeachers,
    semesterMode = 'regular',
    isTransferred = false,
}) => {
    const { toast } = useToast();
    const { t, i18n } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const afterSchoolFileRef = useRef<HTMLInputElement>(null);
    
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [unassignedSearchQuery, setUnassignedSearchQuery] = useState('');
    const [filteredUnassignedStudents, setFilteredUnassignedStudents] = useState<Student[]>([]);
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [seatingHistory, setSeatingHistory] = useState<SeatingAssignment[][]>([]);
    const [selectedSeat, setSelectedSeat] = useState<{ seatNumber: number; studentId: string | null } | null>(null);
    const [swapSourceSeat, setSwapSourceSeat] = useState<number | null>(null);
    const [unassignableStudents, setUnassignableStudents] = useState<(Student & { errorReason: string })[]>([]);
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const dayOrder: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);
    
    const [isCopySeatingDialogOpen, setIsCopySeatingDialogOpen] = useState(false);
    const [copyScope, setCopyScope] = useState<'single' | 'all'>('single');
    const [daysToCopySeatingTo, setDaysToCopySeatingTo] = useState<Partial<Record<DayOfWeek, boolean>>>(() => dayOrder.reduce((acc, day) => ({ ...acc, [day]: true }), {}));
    const [routeTypesToCopySeatingTo, setRouteTypesToCopySeatingTo] = useState<Partial<Record<'Morning' | 'Afternoon', boolean>>>({ Morning: true, Afternoon: true });

    const [isGlobalClearDialogOpen, setIsGlobalClearDialogOpen] = useState(false);
    const [clearDays, setClearDays] = useState<Partial<Record<DayOfWeek, boolean>>>({});
    const [clearRouteTypes, setClearRouteTypes] = useState<Partial<Record<RouteType, boolean>>>({});
    const [clearBuses, setClearBuses] = useState<Record<string, boolean>>({});

    const [isAfterSchoolDialogOpen, setIsAfterSchoolDialogOpen] = useState(false);
    const [afterSchoolTargetDay, setAfterSchoolTargetDay] = useState<DayOfWeek>('Monday');

    const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
    const [newStudent, setNewStudent] = useState<Partial<NewStudent>>({
        name: '', grade: '', class: '', number: '', gender: 'Male', contact: '',
        afterSchoolDestinations: {}, applicationStatus: 'reviewed'
    });

    const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);
    const currentRoute = useMemo(() => routes.find(r => r.busId === selectedBusId && r.dayOfWeek === selectedDay && r.type === selectedRouteType), [routes, selectedBusId, selectedDay, selectedRouteType]);
    const assignedStudentsCount = useMemo(() => currentRoute ? currentRoute.seating.filter(s => !!s.studentId).length : 0, [currentRoute]);
    const [unassignedView, setUnassignedView] = useState<'current' | 'all'>('current');

    // 모드에 따라 올바른 방과후 필드 이름 반환 헬퍼
    const afterSchoolDestField = semesterMode === 'vacation' ? 'vacationAfterSchoolDestinations' : 'afterSchoolDestinations';
    const afterSchoolClassField = semesterMode === 'vacation' ? 'vacationAfterSchoolClassIds' : 'afterSchoolClassIds';

    // 학생의 현재 모드에 해당하는 방과후 목적지 반환 (해당 요일에 실제 방과후가 있는 경우만 반환)
    const getAfterSchoolDest = (s: Student, day: DayOfWeek): string | null => {
        const destMap = semesterMode === 'vacation' 
            ? (s.vacationAfterSchoolDestinations || {})
            : (s.afterSchoolDestinations || {});
        const classMap = semesterMode === 'vacation'
            ? (s.vacationAfterSchoolClassIds || {})
            : (s.afterSchoolClassIds || {});

        // [요청 2] 해당 day에 수업(classId)이나 목적지(dest)가 실제로 등록되어 있지 않다면 null 반환!
        const hasClassOnDay = Boolean(classMap[day]);
        const hasDestOnDay = Boolean(destMap[day]);
        if (!hasClassOnDay && !hasDestOnDay) {
            return null;
        }

        let dest = destMap[day] || null;

        // 호차 번호('1호차' 등)나 임시 텍스트가 들어있거나 없을 때만 학생의 실제 하교 목적지로 매칭
        if (!dest || dest.includes('호차') || dest === '미배정' || dest === '방과후 미배정' || dest === 'UNSPECIFIED') {
            dest = day === 'Saturday'
                ? (s.satAfternoonDestinationId || s.satMorningDestinationId || s.afternoonDestinationId || s.morningDestinationId || null)
                : (s.afternoonDestinationId || s.morningDestinationId || null);
        }

        return dest;
    };

    // 학생의 현재 모드에 해당하는 방과후 목적지 맵 전체 반환
    const getAfterSchoolDests = (s: Student): Partial<Record<DayOfWeek, string | null>> => {
        if (semesterMode === 'vacation') {
            return s.vacationAfterSchoolDestinations || {};
        }
        return s.afterSchoolDestinations || {};
    };

    // 학생의 현재 모드에 해당하는 방과후 수업ID 맵 전체 반환
    const getAfterSchoolClassIds = (s: Student): Partial<Record<DayOfWeek, string | null>> => {
        if (semesterMode === 'vacation') {
            return s.vacationAfterSchoolClassIds || {};
        }
        return s.afterSchoolClassIds || {};
    };

    const globalSearchResults = useMemo(() => {
        if (!globalSearchQuery.trim()) return [];
        const q = normalizeString(globalSearchQuery);
        return students.map(student => {
            const grade = (student.grade || '').toLowerCase();
            const cls = (student.class || '').toLowerCase();
            const gradeClass = normalizeString(grade + cls);
            const nameKo = normalizeString(student.nameKo || '');
            const nameEn = normalizeString(student.nameEn || '');
            const nameLegacy = normalizeString(student.name || '');
            const contact = student.contact?.replace(/\D/g, '') || '';
            let score = 0;
            if (gradeClass === q) score += 1000; else if (gradeClass.startsWith(q)) score += 800;
            if (nameKo.startsWith(q) || nameEn.startsWith(q) || nameLegacy.startsWith(q)) score += 500; 
            else if (nameKo.includes(q) || nameEn.includes(q) || nameLegacy.includes(q)) score += 300;
            if (contact.startsWith(q)) score += 100; else if (contact.includes(q)) score += 50;
            return { student, score };
        }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.student).slice(0, 10);
    }, [students, globalSearchQuery]);

    const assignedRoutesForSelectedStudent = useMemo(() => {
        if (!selectedGlobalStudent) return [];
        return routes.filter(route => route.seating.some(seat => seat.studentId === selectedGlobalStudent.id)).sort((a, b) => {
            const busA = buses.find(bus => bus.id === a.busId);
            const busB = buses.find(bus => bus.id === b.busId);
            const busNameA = busA?.name || '';
            const busNameB = busB?.name || '';
            const numA = parseInt(busNameA.replace(/\D/g, ''), 10) || Infinity;
            const numB = parseInt(busNameB.replace(/\D/g, ''), 10) || Infinity;
            if (numA !== numB) return numA - numB;
            return dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
        });
    }, [selectedGlobalStudent, routes, buses, dayOrder]);

    useEffect(() => {
        if (!routes.length || !students.length) return;
        const allAssignedIds = new Set<string>();
        routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => r.seating.forEach(s => { if (s.studentId) allAssignedIds.add(s.studentId); }));
        const validStopIds = new Set<string>();
        routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => r.stops.forEach(s => validStopIds.add(s)));
        const unassignables: (Student & { errorReason: string })[] = [];
        students.forEach(student => {
            if (allAssignedIds.has(student.id)) return;
            let destId: string | null = null, errorKey = '';
            
            if (semesterMode === 'vacation') {
                const vacClassIds = student.vacationAfterSchoolClassIds || {};
                const regClassIds = student.afterSchoolClassIds || {};
                const enrolledClassIds = new Set([
                    ...Object.values(vacClassIds).filter(Boolean),
                    ...Object.values(regClassIds).filter(Boolean)
                ]);
                const hasVacationClass = afterSchoolClasses.some(c => 
                    c.semesterMode === 'vacation' && enrolledClassIds.has(c.id)
                );
                if (!hasVacationClass) return;
                
                if (selectedRouteType === 'Morning') {
                    destId = student.morningDestinationId;
                    errorKey = 'admin.student_management.unassignable.error_morning';
                } else if (selectedRouteType === 'Afternoon') {
                    const vacDests = student.vacationAfterSchoolDestinations || {};
                    const regDests = student.afterSchoolDestinations || {};
                    destId = vacDests[selectedDay] || regDests[selectedDay] || 
                             Object.values(vacDests).find(v => v && v !== 'UNSPECIFIED') || 
                             Object.values(regDests).find(v => v && v !== 'UNSPECIFIED') || null;
                    errorKey = 'admin.student_management.unassignable.error_afternoon';
                }
            } else {
                if (selectedDay === 'Saturday') {
                    if (selectedRouteType === 'Morning') { destId = student.satMorningDestinationId; errorKey = 'admin.student_management.unassignable.error_sat_morning'; }
                    else if (selectedRouteType === 'Afternoon') { destId = student.satAfternoonDestinationId; errorKey = 'admin.student_management.unassignable.error_sat_afternoon'; }
                } else {
                    if (selectedRouteType === 'Morning') { destId = student.morningDestinationId; errorKey = 'admin.student_management.unassignable.error_morning'; }
                    else if (selectedRouteType === 'Afternoon') { destId = student.afternoonDestinationId; errorKey = 'admin.student_management.unassignable.error_afternoon'; }
                    else if (selectedRouteType === 'AfterSchool') { destId = getAfterSchoolDest(student, selectedDay); errorKey = 'admin.student_management.unassignable.error_after_school'; }
                }
            }
            
            if (destId && !validStopIds.has(destId)) {
                const destName = destinations.find(d => d.id === destId)?.name || '알 수 없음';
                unassignables.push({ ...student, errorReason: `${t(errorKey, { day: t(`day_short.${selectedDay.toLowerCase()}`) })} (${destName})` });
            }
        });
        setUnassignableStudents(unassignables);
    }, [students, routes, selectedDay, selectedRouteType, destinations, t, semesterMode]);


    useEffect(() => {
        const getStudentDestId = (s: Student) => {
            if (semesterMode === 'vacation') {
                const vacClassIds = s.vacationAfterSchoolClassIds || {};
                const regClassIds = s.afterSchoolClassIds || {};
                const enrolledClassIds = new Set([
                    ...Object.values(vacClassIds).filter(Boolean),
                    ...Object.values(regClassIds).filter(Boolean)
                ]);
                const hasVacationClass = afterSchoolClasses.some(c => 
                    c.semesterMode === 'vacation' && enrolledClassIds.has(c.id)
                );
                if (!hasVacationClass) return null;
                
                if (selectedRouteType === 'Morning') return s.morningDestinationId;
                if (selectedRouteType === 'Afternoon') {
                    const vacDests = s.vacationAfterSchoolDestinations || {};
                    const regDests = s.afterSchoolDestinations || {};
                    const dest = vacDests[selectedDay] || regDests[selectedDay] || 
                                 Object.values(vacDests).find(v => v && v !== 'UNSPECIFIED') || 
                                 Object.values(regDests).find(v => v && v !== 'UNSPECIFIED') || null;
                    return dest || 'VACATION_CLASS_ENROLLED';
                }
                return null;
            }
            if (selectedDay === 'Saturday') {
                const explicitSatDest = selectedRouteType === 'Morning' ? s.satMorningDestinationId : s.satAfternoonDestinationId;
                if (explicitSatDest && explicitSatDest !== '-' && explicitSatDest !== '미신청') return explicitSatDest;

                // 토요 방과후 수강생 중 "버스 탑승 신청자"만 판별 (미신청/자차 등 미탑승자는 제외)
                const satDest = s.afterSchoolDestinations?.['Saturday'];
                const isSatBusApplied = Boolean(
                    satDest &&
                    satDest !== '-' &&
                    satDest !== '미신청' &&
                    satDest !== '방과후 미배정' &&
                    (s as any).needsBus !== false
                );

                if (isSatBusApplied) {
                    const fallbackDest = satDest ||
                        (selectedRouteType === 'Morning' ? (s.morningDestinationId || s.suggestedMorningDestination || (s as any).residenceDestinationId) : (s.afternoonDestinationId || s.suggestedAfternoonDestination || (s as any).residenceDestinationId)) ||
                        'SATURDAY_AFTERSCHOOL';
                    return fallbackDest;
                }
                return null;
            }
            if (selectedRouteType === 'Morning') return s.morningDestinationId;
            if (selectedRouteType === 'Afternoon') return s.afternoonDestinationId;
            if (selectedRouteType === 'AfterSchool') return getAfterSchoolDest(s, selectedDay);
            return null;
        };
        const allAssignedIds = new Set<string>();
        routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => r.seating.forEach(s => { if (s.studentId) allAssignedIds.add(s.studentId); }));
        const targetStopIds = new Set<string>();
        if (selectedBusId === 'all') routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => r.stops.forEach(s => targetStopIds.add(s)));
        else if (currentRoute) currentRoute.stops.forEach(s => targetStopIds.add(s));

        const allValidStopIds = new Set<string>();
        routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => r.stops.forEach(s => allValidStopIds.add(s)));

        let unassigned = students.filter(s => {
            if (allAssignedIds.has(s.id)) return false;

            // 학기 중 정규 하교(Afternoon) 필터링: 방과후 노선 이동(isTransferred === true)이 완료된 경우에만 하교 미배정에서 제외 (단, 토요일은 토요 등하교 버스 유지)
            if (semesterMode !== 'vacation' && selectedRouteType === 'Afternoon' && selectedDay !== 'Saturday') {
                if (isTransferred && getAfterSchoolDest(s, selectedDay)) return false;
            }

            const destId = getStudentDestId(s);
            if (!destId) return false;

            // 방학 중 방과후 모드: 등록 학생은 노선 stop 매칭 무관하게 표시
            if (semesterMode === 'vacation' && selectedRouteType === 'Afternoon') {
                if (destId === 'VACATION_CLASS_ENROLLED') return true;
                return unassignedView === 'current' ? targetStopIds.has(destId) : true;
            }

            // 토요일 토요방과후 학생: 목적지 정류장 매칭 무관하게 미배정 목록에 노출
            if (selectedDay === 'Saturday' && (destId === 'SATURDAY_AFTERSCHOOL' || destId === 'UNSPECIFIED')) {
                return true;
            }

            // [사용자 요청 3] 전체 버스 선택(selectedBusId === 'all') 또는 전체 보기 탭(unassignedView === 'all')일 때 모든 미배정 학생 표시
            if (selectedBusId === 'all' || unassignedView === 'all') return true;

            // 개별 버스 선택 시(selectedBusId !== 'all'):
            // 1) 현재 버스의 stops에 포함된 학생
            // 2) 어떤 버스 노선에도 정류장이 없어 수동 배정이 필요한 학생(목적지 오류/미경유 학생)도 관리자가 근방 버스에 배정할 수 있도록 노출!
            const isMatchCurrentStop = targetStopIds.has(destId) || targetStopIds.size === 0;
            const isUnmatchedInAnyRoute = !allValidStopIds.has(destId) || destId === 'UNSPECIFIED';

            return isMatchCurrentStop || isUnmatchedInAnyRoute;
        });
        if (unassignedSearchQuery) {
            const lq = normalizeString(unassignedSearchQuery);
            unassigned = unassigned.filter(s => 
                normalizeString(s.nameKo || '').includes(lq) || 
                normalizeString(s.nameEn || '').includes(lq) || 
                normalizeString(s.name || '').includes(lq) || 
                (s.contact && s.contact.includes(unassignedSearchQuery.replace(/\D/g, '')))
            );
        }
        setFilteredUnassignedStudents(unassigned.sort((a, b) => {
            const gA = getGradeValue(a.grade), gB = getGradeValue(b.grade);
            if (gA !== gB) return gA - gB;
            const nameA = getStudentName(a, i18n.language);
            const nameB = getStudentName(b, i18n.language);
            return nameA.localeCompare(nameB, i18n.language === 'ko' ? 'ko' : 'en');
        }));
    }, [students, routes, currentRoute, selectedRouteType, selectedDay, unassignedSearchQuery, unassignedView, selectedBusId, semesterMode, afterSchoolClasses]);

    const updateRouteSeatingWithVacationSync = useCallback(async (routeId: string, seating: SeatingAssignment[]) => {
        const targetRoute = routes.find(r => r.id === routeId);
        if (!targetRoute) {
            await updateRouteSeating(routeId, seating);
            return;
        }

        const isVac = (targetRoute.semesterMode === 'vacation') || (semesterMode === 'vacation');
        if (isVac && (targetRoute.dayOfWeek !== 'Saturday')) {
            const matchingRoutes = routes.filter(r => 
                (r.semesterMode === 'vacation') &&
                r.busId === targetRoute.busId &&
                r.type === targetRoute.type &&
                r.dayOfWeek !== 'Saturday'
            );

            const newSeatMap = new Map(seating.map(s => [s.seatNumber, s.studentId]));
            const currentSeatMap = new Map(targetRoute.seating.map(s => [s.seatNumber, s.studentId]));
            const changedSeatNumbers = Array.from(new Set([...currentSeatMap.keys(), ...newSeatMap.keys()]));

            const updates: Promise<void>[] = [];
            for (const r of matchingRoutes) {
                const nextSeating = [...r.seating];
                for (const seatNum of changedSeatNumbers) {
                    const newSid = newSeatMap.get(seatNum);
                    if (newSid) {
                        nextSeating.forEach((s, idx) => {
                            if (s.studentId === newSid && s.seatNumber !== seatNum) {
                                nextSeating[idx] = { ...s, studentId: null };
                            }
                        });
                    }
                    const targetIdx = nextSeating.findIndex(s => s.seatNumber === seatNum);
                    if (targetIdx !== -1) {
                        nextSeating[targetIdx] = { ...nextSeating[targetIdx], studentId: newSid || null };
                    } else if (seatNum > 0) {
                        nextSeating.push({ seatNumber: seatNum, studentId: newSid || null });
                    }
                }
                updates.push(updateRouteSeating(r.id, nextSeating));
            }
            await Promise.all(updates);
        } else {
            await updateRouteSeating(routeId, seating);
        }
    }, [routes, semesterMode, updateRouteSeating]);

    const handleSeatUpdate = useCallback(async (newSeating: SeatingAssignment[]) => {
        if (!currentRoute) return;
        setSeatingHistory(prev => [currentRoute.seating, ...prev].slice(0, 5));
        await updateRouteSeatingWithVacationSync(currentRoute.id, newSeating);
    }, [currentRoute, updateRouteSeatingWithVacationSync]);

    const handleUndo = useCallback(async () => {
        if (!currentRoute || seatingHistory.length === 0) return;
        const [prev, ...rest] = seatingHistory;
        await updateRouteSeatingWithVacationSync(currentRoute.id, prev);
        setSeatingHistory(rest);
        toast({ title: "취소 완료" });
    }, [currentRoute, seatingHistory, updateRouteSeatingWithVacationSync, toast]);

    const handleSeatClick = useCallback(async (num: number, sid: string | null) => {
        if (!currentRoute) return;
        setSwapSourceSeat(null);
        const next = [...currentRoute.seating];
        if (!next.some(x => x.seatNumber === num)) next.push({ seatNumber: num, studentId: null });
        if (selectedSeat && !next.some(x => x.seatNumber === selectedSeat.seatNumber)) next.push({ seatNumber: selectedSeat.seatNumber, studentId: null });
        
        if (selectedSeat) {
            const sIdx = next.findIndex(x => x.seatNumber === selectedSeat.seatNumber), tIdx = next.findIndex(x => x.seatNumber === num);
            if (selectedSeat.seatNumber === num) next[sIdx].studentId = null;
            else { const temp = next[sIdx].studentId; next[sIdx].studentId = next[tIdx].studentId; next[tIdx].studentId = temp; }
            setSelectedSeat(null); handleSeatUpdate(next); 
        } else setSelectedSeat({ seatNumber: num, studentId: sid });
    }, [currentRoute, selectedSeat, handleSeatUpdate, students, setSelectedGlobalStudent, i18n.language]);

    const handleSeatContextMenu = (e: React.MouseEvent, seatNumber: number) => {
        e.preventDefault();
        if (!currentRoute) return;
        
        // 좌석 선택 상태에서 우클릭 시 선택 해제 처리
        if (selectedSeat) {
            setSelectedSeat(null);
            return;
        }

        if (swapSourceSeat === null) {
            setSwapSourceSeat(seatNumber);
            toast({ title: t('teacher_page.seat_selected'), description: "다른 좌석을 우클릭하면 교체되고, 같은 좌석을 다시 우클릭하면 비워집니다." });
        } else {
            if (swapSourceSeat === seatNumber) {
                const next = currentRoute.seating.map(s => s.seatNumber === seatNumber ? { ...s, studentId: null } : s);
                // Also remove if missing:
                if (!next.some(s => s.seatNumber === seatNumber)) next.push({ seatNumber, studentId: null });
                setSwapSourceSeat(null); handleSeatUpdate(next).then(() => { toast({ title: "좌석 비우기 완료" }); });
                return;
            }
            const next = [...currentRoute.seating];
            if (!next.some(s => s.seatNumber === swapSourceSeat)) next.push({ seatNumber: swapSourceSeat, studentId: null });
            if (!next.some(s => s.seatNumber === seatNumber)) next.push({ seatNumber, studentId: null });
            const sIdx = next.findIndex(s => s.seatNumber === swapSourceSeat), tIdx = next.findIndex(s => s.seatNumber === seatNumber);
            if (sIdx > -1 && tIdx > -1) {
                const temp = next[sIdx].studentId; next[sIdx].studentId = next[tIdx].studentId; next[tIdx].studentId = temp;
                setSwapSourceSeat(null); handleSeatUpdate(next).then(() => { toast({ title: t('teacher_page.swap_success') }); });
            }
        }
    };

    const handleStudentCardClick = useCallback(async (sid: string) => {
        if (currentRoute && selectedSeat && !selectedSeat.studentId) {
            const next = [...currentRoute.seating], idx = next.findIndex(s => s.seatNumber === selectedSeat.seatNumber);
            if (idx > -1) { next[idx].studentId = sid; setSelectedSeat(null); handleSeatUpdate(next); }
        }
    }, [currentRoute, selectedSeat, handleSeatUpdate]);

    const handleAssignStudentFromSearch = useCallback(async () => {
        if (!selectedGlobalStudent || !selectedSeat || selectedSeat.studentId) { toast({ title: t('notice'), description: t('admin.student_management.seat.select_empty_seat_prompt') }); return; }
        await handleStudentCardClick(selectedGlobalStudent.id);
    }, [selectedGlobalStudent, selectedSeat, handleStudentCardClick, t]);

    const handleRandomAssign = useCallback(async () => {
        if (!currentRoute || !selectedBus) return;
        const getStudentDestId = (s: Student): string | null => {
            if (semesterMode === 'vacation') {
                // 방학 중: 방과후 수업 등록 여부를 두 필드에서 모두 확인
                const vacClassIds = s.vacationAfterSchoolClassIds || {};
                const regClassIds = s.afterSchoolClassIds || {};
                const enrolledClassIds = new Set([
                    ...Object.values(vacClassIds).filter(Boolean),
                    ...Object.values(regClassIds).filter(Boolean)
                ]);
                const hasVacationClass = afterSchoolClasses.some(c =>
                    c.semesterMode === 'vacation' && enrolledClassIds.has(c.id)
                );
                if (!hasVacationClass) return null;

                if (selectedRouteType === 'Morning') return s.morningDestinationId;
                if (selectedRouteType === 'Afternoon') {
                    const vacDests = s.vacationAfterSchoolDestinations || {};
                    const regDests = s.afterSchoolDestinations || {};
                    return vacDests[selectedDay] || regDests[selectedDay] ||
                           Object.values(vacDests).find(v => v && v !== 'UNSPECIFIED') ||
                           Object.values(regDests).find(v => v && v !== 'UNSPECIFIED') || null;
                }
                return null;
            }
            if (selectedDay === 'Saturday') return selectedRouteType === 'Morning' ? s.satMorningDestinationId : s.satAfternoonDestinationId;
            if (selectedRouteType === 'Morning') return s.morningDestinationId;
            if (selectedRouteType === 'Afternoon') return s.afternoonDestinationId;
            if (selectedRouteType === 'AfterSchool') return getAfterSchoolDest(s, selectedDay);
            return null;
        };
        const allAssignedIds = new Set<string>();
        routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => r.seating.forEach(s => { if (s.studentId) allAssignedIds.add(s.studentId); }));
        const routeStopIds = new Set(currentRoute.stops);
        
        const eligibleStudents = students.filter(s => { 
            if (allAssignedIds.has(s.id)) return false; 
            if (semesterMode !== 'vacation' && selectedRouteType === 'Afternoon' && getAfterSchoolDest(s, selectedDay)) return false;
            const destId = getStudentDestId(s);
            if (!destId) return false;
            // 방학 중 Afternoon: 목적지가 없어도 수업 등록 되어 있으면 배정 허용
            return routeStopIds.has(destId); 
        });
        
        if (eligibleStudents.length === 0) { toast({ title: t('notice'), description: "배정할 수 있는 대기 학생이 없습니다." }); return; }
        
        let targetStudents = eligibleStudents;
        if (selectedStudentIds.size > 0) {
            targetStudents = eligibleStudents.filter(s => selectedStudentIds.has(s.id));
            if (targetStudents.length === 0) { toast({ title: t('notice'), description: "선택된 학생 중에 이 버스에 배정될 수 있는 학생이 없습니다." }); return; }
            setSelectedStudentIds(new Set());
        }

        const { seatMap } = getLayoutInfo(selectedBus.capacity);
        const validSeatNumbers = new Set(seatMap.filter(n => n !== null) as number[]);
        const next = [...currentRoute.seating], emptyIdx = next.reduce((acc, seat, idx) => { if (validSeatNumbers.has(seat.seatNumber) && !seat.studentId && seat.seatNumber !== 0) acc.push(idx); return acc; }, [] as number[]);
        if (emptyIdx.length === 0) { toast({ title: t('notice'), description: "남은 좌석이 없습니다." }); return; }

        const sortedStudents = targetStudents.sort((a, b) => {
            const gradeDiff = getGradeValue(a.grade) - getGradeValue(b.grade);
            if (gradeDiff !== 0) return gradeDiff;
            return a.gender.localeCompare(b.gender) || Math.random() - 0.5;
        });

        const assignCount = Math.min(sortedStudents.length, emptyIdx.length);
        const targetEmptyIndices = getOptimizedSeatIndices(assignCount, emptyIdx, next);

        for (let i = 0; i < assignCount; i++) {
            next[targetEmptyIndices[i]].studentId = sortedStudents[i].id;
        }

        await handleSeatUpdate(next); toast({ title: t('success'), description: t('admin.student_management.seat.random_assign_success') });
    }, [currentRoute, selectedBus, students, routes, selectedDay, selectedRouteType, handleSeatUpdate, t, selectedStudentIds, semesterMode, afterSchoolClasses]);

    const handleGlobalRandomAssign = useCallback(async () => {
        const currentType = selectedRouteType;
        const currentDay = selectedDay;
        const currentMode = semesterMode || 'regular';
        
        const targetRoutes = routes.filter(r => r.dayOfWeek === currentDay && r.type === currentType);
        if (targetRoutes.length === 0) {
            toast({ title: t('notice'), description: "이 설정에 해당하는 버스 노선이 없습니다." });
            return;
        }
        
        const getStudentDestId = (s: Student): string | null => {
            if (currentMode === 'vacation') {
                // 방학 중: 두 필드에서 방과후 수업 등록 여부 확인
                const vacClassIds = s.vacationAfterSchoolClassIds || {};
                const regClassIds = s.afterSchoolClassIds || {};
                const enrolledClassIds = new Set([
                    ...Object.values(vacClassIds).filter(Boolean),
                    ...Object.values(regClassIds).filter(Boolean)
                ]);
                const hasVacationClass = afterSchoolClasses.some(c =>
                    c.semesterMode === 'vacation' && enrolledClassIds.has(c.id)
                );
                if (!hasVacationClass) return null;

                if (currentDay === 'Saturday') return currentType === 'Morning' ? s.satMorningDestinationId : s.satAfternoonDestinationId;
                if (currentType === 'Morning') return s.morningDestinationId;
                if (currentType === 'Afternoon') {
                    const vacDests = s.vacationAfterSchoolDestinations || {};
                    const regDests = s.afterSchoolDestinations || {};
                    return vacDests[currentDay] || regDests[currentDay] ||
                           Object.values(vacDests).find(v => v && v !== 'UNSPECIFIED') ||
                           Object.values(regDests).find(v => v && v !== 'UNSPECIFIED') || null;
                }
                return null;
            }
            if (currentDay === 'Saturday') return currentType === 'Morning' ? s.satMorningDestinationId : s.satAfternoonDestinationId;
            if (currentType === 'Morning') return s.morningDestinationId;
            if (currentType === 'Afternoon') return s.afternoonDestinationId;
            if (currentType === 'AfterSchool') return getAfterSchoolDest(s, currentDay);
            return null;
        };

        const allAssignedIds = new Set<string>();
        targetRoutes.forEach(r => r.seating.forEach(s => { if (s.studentId) allAssignedIds.add(s.studentId); }));

        const routeMap = new Map<string, Route>(targetRoutes.map(r => [r.id, { ...r, seating: [...r.seating] }]));

        const eligibleStudents = students.filter(s => { 
            if (allAssignedIds.has(s.id)) return false; 
            if (currentMode !== 'vacation' && currentType === 'Afternoon' && getAfterSchoolDest(s, currentDay)) return false;
            return getStudentDestId(s) !== null; 
        });

        const studentsByDest = new Map<string, Student[]>();
        for (const s of eligibleStudents) {
            const destId = getStudentDestId(s);
            if (destId) {
                if (!studentsByDest.has(destId)) studentsByDest.set(destId, []);
                studentsByDest.get(destId)!.push(s);
            }
        }

        const busAssignments = new Map<string, Student[]>();
        for (const route of routeMap.values()) busAssignments.set(route.id, []);
        
        let totalAssignedGlobal = 0;

        for (const [destId, groupStudents] of studentsByDest.entries()) {
            const sortedGroup = groupStudents.sort((a, b) => {
                const gradeDiff = getGradeValue(a.grade) - getGradeValue(b.grade);
                if (gradeDiff !== 0) return gradeDiff;
                return a.gender.localeCompare(b.gender) || Math.random() - 0.5;
            });

            const validRoutes = Array.from(routeMap.values()).filter(r => r.stops.includes(destId));
            if (validRoutes.length === 0) continue;

            const routeCapacities = validRoutes.map(r => ({
                id: r.id,
                emptySeats: r.seating.filter(s => !s.studentId && s.seatNumber !== 0).length - busAssignments.get(r.id)!.length
            })).filter(r => r.emptySeats > 0);

            if (routeCapacities.length === 0) continue;

            const totalEmpty = routeCapacities.reduce((sum, r) => sum + r.emptySeats, 0);
            const assignCount = Math.min(sortedGroup.length, totalEmpty);
            
            let groupIndex = 0;
            for (const rc of routeCapacities) {
                if (groupIndex >= assignCount) break;
                
                let share = Math.round(assignCount * (rc.emptySeats / totalEmpty));
                share = Math.max(0, Math.min(share, rc.emptySeats, assignCount - groupIndex));
                
                if (share > 0) {
                    const chunk = sortedGroup.slice(groupIndex, groupIndex + share);
                    busAssignments.get(rc.id)!.push(...chunk);
                    groupIndex += share;
                    totalAssignedGlobal += share;
                }
            }

            while (groupIndex < assignCount) {
                const rc = routeCapacities.find(r => r.emptySeats > busAssignments.get(r.id)!.length);
                if (rc) {
                    busAssignments.get(rc.id)!.push(sortedGroup[groupIndex]);
                    totalAssignedGlobal++;
                    groupIndex++;
                } else break;
            }
        }

        const routeUpdates: Promise<void>[] = [];
        for (const route of routeMap.values()) {
            const assignedSts = busAssignments.get(route.id)!;
            if (assignedSts.length === 0) continue;

            const bus = buses.find(b => b.id === route.busId);
            if (!bus) continue;

            const { seatMap } = getLayoutInfo(bus.capacity);
            const validSeatNumbers = new Set(seatMap.filter(n => n !== null) as number[]);
            const next = [...route.seating];
            const emptyIdx = next.reduce((acc, seat, idx) => { 
                if (validSeatNumbers.has(seat.seatNumber) && !seat.studentId && seat.seatNumber !== 0) acc.push(idx); 
                return acc; 
            }, [] as number[]);
            
            assignedSts.sort((a, b) => {
                const gradeDiff = getGradeValue(a.grade) - getGradeValue(b.grade);
                if (gradeDiff !== 0) return gradeDiff;
                return a.gender.localeCompare(b.gender) || Math.random() - 0.5;
            });

            const placeCount = Math.min(assignedSts.length, emptyIdx.length);
            const targetEmptyIndices = getOptimizedSeatIndices(placeCount, emptyIdx, next);

            for (let i = 0; i < placeCount; i++) {
                next[targetEmptyIndices[i]].studentId = assignedSts[i].id;
            }

            routeUpdates.push(updateRouteSeating(route.id, next));
        }

        if (totalAssignedGlobal > 0) {
            await Promise.all(routeUpdates);
            toast({ title: t('success'), description: `총 ${totalAssignedGlobal}명의 학생이 요일/경로 전체 버스에 분산 배정되었습니다.` });
        } else {
            toast({ title: t('notice'), description: "배정 확정 상태이거나 여유 좌석이 없습니다." });
        }
    }, [routes, selectedRouteType, selectedDay, students, buses, updateRouteSeating, toast, t, semesterMode, afterSchoolClasses]);

    const handleOpenGlobalClearDialog = useCallback(() => {
        setClearDays({ [selectedDay]: true });
        setClearRouteTypes({ [selectedRouteType]: true });
        const allBuses = buses.reduce((acc, b) => ({ ...acc, [b.id]: true }), {});
        setClearBuses(allBuses);
        setIsGlobalClearDialogOpen(true);
    }, [buses, selectedDay, selectedRouteType]);

    const handleExecuteGlobalClearSeats = async () => {
        const selectedDays = dayOrder.filter(d => clearDays[d]);
        const selectedTypes = (['Morning', 'Afternoon', 'AfterSchool'] as const).filter(t => clearRouteTypes[t]);
        const selectedBuses = buses.filter(b => clearBuses[b.id]);

        if (selectedDays.length === 0 || selectedTypes.length === 0 || selectedBuses.length === 0) {
            toast({ title: t('error'), description: "요일, 경로, 버스 중 하나 이상이 선택되지 않았습니다.", variant: "destructive" });
            return;
        }

        const selectedBusIds = new Set(selectedBuses.map(b => b.id));

        const ObjectRoutes = routes.filter(r => 
            selectedDays.includes(r.dayOfWeek) && 
            selectedTypes.includes(r.type as any) && 
            selectedBusIds.has(r.busId)
        );

        if (ObjectRoutes.length === 0) {
            toast({ title: t('notice'), description: "선택한 조건에 해당하는 노선이 없습니다." });
            return;
        }

        const { dismiss } = toast({ title: t('processing'), description: "선택한 조건의 좌석을 초기화 중..." });
        const routeUpdates: Promise<void>[] = [];

        for (const route of ObjectRoutes) {
            const bus = buses.find(b => b.id === route.busId);
            if (bus) {
                const emptySeating = generateInitialSeating(bus.capacity);
                routeUpdates.push(updateRouteSeating(route.id, emptySeating));
            }
        }

        try {
            await Promise.all(routeUpdates);
            dismiss();
            toast({ title: t('success'), description: "선택하신 노선의 좌석이 모두 초기화되었습니다." });
            setIsGlobalClearDialogOpen(false);
        } catch (error) {
            dismiss();
            toast({ title: t('error'), description: "좌석 초기화 중 오류가 발생했습니다.", variant: "destructive" });
        }
    };

    const handleCopySeating = useCallback(async () => {
        if (!currentRoute) { toast({ title: t('error'), description: t('admin.student_management.seat.copy.no_source_error'), variant: "destructive" }); return; }
        const selectedDays = dayOrder.filter(day => daysToCopySeatingTo[day]);
        const selectedTypes = (['Morning', 'Afternoon'] as const).filter(type => routeTypesToCopySeatingTo[type]);
        if (selectedDays.length === 0 || selectedTypes.length === 0) { toast({ title: t('notice'), description: t('admin.student_management.seat.copy.no_selection_error') }); return; }
        
        try { 
            if (copyScope === 'all') {
                await copyAllBusesSeatingPlan(selectedDay, selectedRouteType, semesterMode, selectedDays, selectedTypes);
                toast({ title: t('success'), description: "선택하신 요일/경로로 모든 버스의 좌석 배치가 일괄 복사되었습니다." });
            } else {
                await copySeatingPlan(currentRoute.id, currentRoute.busId, selectedDays, selectedTypes); 
                toast({ title: t('success'), description: t('admin.student_management.seat.copy.success') }); 
            }
            setIsCopySeatingDialogOpen(false); 
        }
        catch (error) { toast({ title: t('error'), description: t('admin.student_management.seat.copy.error'), variant: "destructive" }); }
    }, [currentRoute, routes, daysToCopySeatingTo, routeTypesToCopySeatingTo, copyScope, selectedDay, selectedRouteType, semesterMode, t, dayOrder]);

    const handleManualAddStudent = async () => {
        if (!newStudent.name || !newStudent.grade || !newStudent.class) {
            toast({ title: t('error'), description: t('admin.student_management.add_student.validation_error'), variant: 'destructive' });
            return;
        }
        try {
            const added = await addStudent({
                ...newStudent,
                name: newStudent.nameEn || newStudent.nameKo || '',
            } as NewStudent);
            setNewStudent({ name: '', nameKo: '', nameEn: '', grade: '', class: '', number: '', gender: 'Male', contact: '', afterSchoolDestinations: {}, applicationStatus: 'reviewed' });
            setIsAddStudentDialogOpen(false);
            toast({ title: t('success'), description: t('admin.student_management.add_student.success') });
            setSelectedGlobalStudent(added);
        } catch (error) {
            toast({ title: t('error'), description: t('admin.student_management.add_student.error'), variant: 'destructive' });
        }
    };

    const handleDownloadAllStudents = useCallback(() => {
        if (students.length === 0) { toast({ title: t('notice'), description: "등록된 학생이 없습니다." }); return; }
        const headers = ["한글 이름", "영문 이름", "학년", "반", "번호", "성별", "연락처", "등교 목적지", "하교 목적지", "토요 등교", "토요 하교", "월 방과후", "화 방과후", "수 방과후", "목 방과후", "금 방과후"];
        const csvRows = students.map(s => {
            const morningDest = destinations.find(d => d.id === s.morningDestinationId)?.name || '';
            const afternoonDest = destinations.find(d => d.id === s.afternoonDestinationId)?.name || '';
            const satMorning = destinations.find(d => d.id === s.satMorningDestinationId)?.name || '';
            const satAfternoon = destinations.find(d => d.id === s.satAfternoonDestinationId)?.name || '';
            
            const afterSchools = (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as DayOfWeek[]).map(day => {
                const destId = getAfterSchoolDest(s, day);
                return destinations.find(d => d.id === destId)?.name || '';
            });

            const escape = (val: string) => val.toString();
            return [
                escape(s.nameKo || ''), escape(s.nameEn || s.name || ''),
                escape(s.grade), escape(s.class), escape(s.number || ''),
                escape(s.gender === 'Male' ? '남자' : '여자'), escape(s.contact || ''), 
                escape(morningDest), escape(afternoonDest), 
                escape(satMorning), escape(satAfternoon),
                ...afterSchools.map(escape)
            ];
        });
        import('xlsx').then(XLSX => {
            const wsData = [headers, ...csvRows.map(row => row.map(cell => cell.toString().replace(/^"|"$/g, '').replace(/""/g, '"')))];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "학생목록");
            XLSX.writeFile(wb, `KIS_All_Students_${new Date().toISOString().split('T')[0]}.xlsx`);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    }, [students, destinations, t]);

    const handleDownloadUnassignedStudents = useCallback(() => {
        if (filteredUnassignedStudents.length === 0) { 
            toast({ title: t('notice'), description: "미배정 학생이 없습니다." }); 
            return; 
        }
        const headers = ["한글 이름", "영문 이름", "학년", "반", "번호", "성별", "연락처", "미배정 구분", "목적지"];
        const csvRows = filteredUnassignedStudents.map(s => {
            let typeStr = "";
            let destName = "";
            if (selectedDay === 'Saturday' && selectedRouteType === 'Morning') {
                typeStr = "토요 등교";
                destName = destinations.find(d => d.id === s.satMorningDestinationId)?.name || '';
            } else if (selectedDay === 'Saturday' && selectedRouteType === 'Afternoon') {
                typeStr = "토요 하교";
                destName = destinations.find(d => d.id === s.satAfternoonDestinationId)?.name || '';
            } else if (selectedRouteType === 'Morning') {
                typeStr = "등교";
                destName = destinations.find(d => d.id === s.morningDestinationId)?.name || '';
            } else if (selectedRouteType === 'Afternoon') {
                typeStr = "하교";
                destName = destinations.find(d => d.id === s.afternoonDestinationId)?.name || '';
            } else if (selectedRouteType === 'AfterSchool') {
                typeStr = "방과후";
                const destId = getAfterSchoolDest(s, selectedDay);
                destName = destinations.find(d => d.id === destId)?.name || '';
            }

            return [
                s.nameKo || '',
                s.nameEn || s.name || '',
                s.grade,
                s.class,
                s.number || '',
                s.gender === 'Male' ? '남자' : '여자',
                s.contact || '',
                typeStr,
                destName
            ];
        });
        import('xlsx').then(XLSX => {
            const wsData = [headers, ...csvRows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "미배정학생");
            XLSX.writeFile(wb, `KIS_Unassigned_Students_${selectedRouteType}_${selectedDay}_${new Date().toISOString().split('T')[0]}.xlsx`);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    }, [filteredUnassignedStudents, selectedRouteType, selectedDay, destinations, t]);

    const handleDownloadRouteAssignments = useCallback(() => {
        if (students.length === 0 || routes.length === 0) { toast({ title: t('notice'), description: "출력할 데이터가 없습니다." }); return; }
        const headers = ["버스 번호", "요일", "등하교", "경로/목적지", "학생 한글 이름", "학생 영문 이름", "학년", "반", "번호", "성별", "연락처", "정류장(좌석 번호)"];
        const csvRows: any[][] = [];
        const escape = (val: string) => val.toString();
        
        for (const route of routes) {
            const bus = buses.find(b => b.id === route.busId);
            if (!bus || (route.seating || []).length === 0) continue;
            route.seating.forEach(seat => {
                if (seat.studentId) {
                    const student = students.find(s => s.id === seat.studentId);
                    if (student) {
                        const routeTypeLabel = route.type === 'AfterSchool' ? '방과후' : (route.type === 'Morning' ? '등교' : '하교');
                        let destName = '';
                        if (route.type === 'AfterSchool') {
                            const destId = getAfterSchoolDest(student, route.dayOfWeek);
                            destName = destinations.find(d => d.id === destId)?.name || '하교 목적지';
                        } else if (route.type === 'Morning') {
                            destName = destinations.find(d => d.id === student.morningDestinationId)?.name || '';
                        } else if (route.type === 'Afternoon') {
                            destName = destinations.find(d => d.id === student.afternoonDestinationId)?.name || '';
                        } else {
                            destName = '';
                        }
                        
                        csvRows.push([
                            escape(bus.name),
                            escape(t(`day.${route.dayOfWeek.toLowerCase()}`)),
                            escape(routeTypeLabel),
                            escape(destName),
                            escape(student.nameKo || ''),
                            escape(student.nameEn || student.name || ''),
                            escape(student.grade),
                            escape(student.class),
                            escape(student.number || ''),
                            escape(student.gender === 'Male' ? '남자' : '여자'),
                            escape(student.contact || ''),
                            escape(`${seat.seatNumber}`)
                        ] as any);
                    }
                }
            });
        }
        
        csvRows.sort((a, b) => a[0].localeCompare(b[0]));
        
        if (csvRows.length === 0) { toast({ title: t('notice'), description: "배정된 학생 데이터가 없습니다." }); return; }
        import('xlsx').then(XLSX => {
            const wsData = [headers, ...csvRows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "배차현황");
            XLSX.writeFile(wb, `KIS_Bus_Assignments_${new Date().toISOString().split('T')[0]}.xlsx`);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    }, [students, routes, buses, destinations, t]);

    const handleDownloadStudentTemplate = () => {
        import('xlsx').then(XLSX => {
            const headers = ["한글 이름", "영문 이름", "학년", "반", "번호", "성별", "연락처", "등교 목적지", "하교 목적지", "토요 등교", "토요 하교", "월 방과후", "화 방과후", "수 방과후", "목 방과후", "금 방과후"];
            const examples = [
                ["김민준", "Minjun Kim", "1", "1", "15", "남자", "01012345678", "Stop-A", "Stop-B", "Stop-Sat-A", "Stop-Sat-B", "Stop-AS-Mon", "Stop-AS-Tue", "", "Stop-AS-Thu", ""]
            ];
            const wsData = [headers, ...examples];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "학생_등록_템플릿");
            XLSX.writeFile(wb, "student_template.xlsx");
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    };

    const handleStudentFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const XLSX = await import('xlsx');
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const results: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                const { dismiss } = toast({ title: t('processing'), description: t('admin.student_management.batch_upload.processing') });
                try {
                    const freshDests = await getDestinations();
                    const newDests: string[] = [];
                    results.forEach((row: any) => {
                        const targetCols = [
                            '등교 목적지', 'morningDestination',
                            '하교 목적지', 'afternoonDestination',
                            '토요 등교', 'satMorningDestination',
                            '토요 하교', 'satAfternoonDestination',
                            '월 방과후', '화 방과후', '수 방과후', '목 방과후', '금 방과후'
                        ];
                        targetCols.forEach(col => {
                            const val = (row[col] || '').toString().trim();
                            if (val && !freshDests.find(d => normalizeString(d.name) === normalizeString(val))) {
                                newDests.push(val);
                            }
                        });
                    });
                    if (newDests.length > 0) await addDestinationsInBatch(Array.from(new Set(newDests)).map(name => ({ name })));
                    
                    const updatedDests = await getDestinations();
                    const studentsToProcess = results.map((row: any) => {
                        const mName = (row['등교 목적지'] || row['morningDestination'] || '').trim();
                        const aName = (row['하교 목적지'] || row['afternoonDestination'] || '').trim();
                        const satMName = (row['토요 등교'] || row['satMorningDestination'] || '').trim();
                        const satAName = (row['토요 하교'] || row['satAfternoonDestination'] || '').trim();
                        
                        const afterSchoolDests: Partial<Record<DayOfWeek, string | null>> = {};
                        const dayMap: Record<string, DayOfWeek> = {
                            '월 방과후': 'Monday', '화 방과후': 'Tuesday', '수 방과후': 'Wednesday', '목 방과후': 'Thursday', '금 방과후': 'Friday'
                        };
                        Object.entries(dayMap).forEach(([col, day]) => {
                            const val = (row[col] || '').toString().trim();
                            if (val) afterSchoolDests[day] = updatedDests.find((d: any) => normalizeString(d.name) === normalizeString(val))?.id || null;
                        });

                        const studentData: any = {
                            grade: (row['학년'] || row['grade'] || '').toString().trim(),
                            class: (row['반'] || row['class'] || '').toString().trim(),
                            number: (row['번호'] || row['number'] || row['출석번호'] || '').toString().trim() || null,
                            applicationStatus: 'reviewed' as const
                        };

                        const nameKo = (row['한글 이름'] || row['nameKo'] || '').trim();
                        const nameEn = (row['영문 이름'] || row['nameEn'] || row['이름'] || row['name'] || '').trim();
                        if (nameKo) studentData.nameKo = nameKo;
                        if (nameEn) studentData.nameEn = nameEn;
                        
                        const gender = (row['성별'] || row['gender'] || '').toString().trim();
                        if (gender) studentData.gender = (gender === '여자' || gender === 'Female') ? 'Female' : 'Male';
                        
                        const contact = (row['연락처'] || row['contact'] || '').toString().trim();
                        if (contact) studentData.contact = contact;

                        if (mName) studentData.morningDestinationId = updatedDests.find((d: any) => normalizeString(d.name) === normalizeString(mName))?.id || null;
                        if (aName) studentData.afternoonDestinationId = updatedDests.find((d: any) => normalizeString(d.name) === normalizeString(aName))?.id || null;
                        if (satMName) studentData.satMorningDestinationId = updatedDests.find((d: any) => normalizeString(d.name) === normalizeString(satMName))?.id || null;
                        if (satAName) studentData.satAfternoonDestinationId = updatedDests.find((d: any) => normalizeString(d.name) === normalizeString(satAName))?.id || null;
                        if (Object.keys(afterSchoolDests).length > 0) studentData.afterSchoolDestinations = afterSchoolDests;

                        return studentData;
                    }).filter((s: Record<string, any>) => s.grade && s.class && (s.nameKo || s.nameEn));

                    const studentsToUpsert = studentsToProcess.map((s: Record<string, any>) => {
                        const existingStudent = students.find(ex => {
                            const sameGradeClass = normalizeString(ex.grade) === normalizeString(s.grade) && normalizeString(ex.class) === normalizeString(s.class);
                            if (!sameGradeClass) return false;
                            if (s.number && ex.number) {
                                return normalizeString(ex.number) === normalizeString(s.number);
                            }
                            return (normalizeString(ex.nameEn || ex.name) === normalizeString(s.nameEn) || normalizeString(ex.nameKo) === normalizeString(s.nameKo));
                        });
                        return {
                            ...s,
                            name: s.nameEn || s.nameKo,
                            id: existingStudent?.id || undefined
                        };
                    });

                    // Direct import from kisbus module
                    const { upsertStudent } = await import('@/lib/kisbus');
                    await Promise.all(studentsToUpsert.map((s: any) => upsertStudent(s)));
                    dismiss();
                    toast({ title: t('success'), description: t('admin.student_management.batch_upload.success', { count: studentsToProcess.length }) });
                } catch (error) {
                    dismiss();
                    toast({ title: t('error'), description: t('admin.student_management.batch_upload.error'), variant: "destructive" });
                }
            } catch (err: any) {
                toast({ title: t('admin.file_parse_error'), description: err.message, variant: "destructive" });
            }
        };
        reader.readAsArrayBuffer(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleDownloadAfterSchoolTemplate = () => {
        import('xlsx').then(XLSX => {
            const isVacation = semesterMode === 'vacation';
            const headers = isVacation 
                ? ["이름", "학년", "반", "번호", "수업명"] 
                : ["이름", "학년", "반", "번호", "월", "화", "수", "목", "금", "토"];
            const examples = isVacation 
                ? [["Gildong Hong", "1", "1", "15", "영어회화"]]
                : [["Gildong Hong", "1", "1", "15", "축구부", "", "바이올린", "", "", ""]];
            const wsData = [headers, ...examples];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            const sheetName = isVacation ? "방학_방과후_명단_템플릿" : "방과후_명단_템플릿";
            const fileName = isVacation ? "vacation_after_school_registration_template.xlsx" : "after_school_registration_template.xlsx";
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            XLSX.writeFile(wb, fileName);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    };

    const handleAfterSchoolFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const XLSX = await import('xlsx');
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const results: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                const { dismiss } = toast({ title: t('processing'), description: "방과후 명단을 처리 중입니다..." });
                try {
                    let updatedCount = 0;
                    const dayColumns: Record<string, DayOfWeek> = {
                        '월': 'Monday',
                        '화': 'Tuesday',
                        '수': 'Wednesday',
                        '목': 'Thursday',
                        '금': 'Friday',
                        '토': 'Saturday'
                    };

                    for (const row of results as any[]) {
                        const name = (row['이름'] || row['name'] || '').toString().trim();
                        const grade = (row['학년'] || row['grade'] || '').toString().trim();
                        const cls = (row['반'] || row['class'] || '').toString().trim();
                        const num = (row['번호'] || row['출석번호'] || row['number'] || '').toString().trim();
                        
                        if (!name) continue;
                        
                        const student = students.find(s => {
                            const sameGradeClass = normalizeString(s.grade) === normalizeString(grade) && normalizeString(s.class) === normalizeString(cls);
                            if (!sameGradeClass) return false;
                            if (num && s.number) {
                                return normalizeString(s.number) === normalizeString(num);
                            }
                            return (normalizeString(s.name) === normalizeString(name) || 
                                    normalizeString(s.nameKo || '') === normalizeString(name) || 
                                    normalizeString(s.nameEn || '') === normalizeString(name));
                        });
                        
                        if (student) {
                            const newAfterSchoolDests = { ...getAfterSchoolDests(student) };
                            const newAfterSchoolClassIds = { ...getAfterSchoolClassIds(student) };
                            let hasAnyChange = false;

                            for (const [col, day] of Object.entries(dayColumns)) {
                                const classInput = (row[col] || row[day] || '').toString().trim();
                                
                                const targetClass = afterSchoolClasses.find(c => 
                                    c.dayOfWeek === day && 
                                    (normalizeString(c.name) === normalizeString(classInput))
                                );

                                if (classInput && targetClass) {
                                    newAfterSchoolDests[day] = student.afternoonDestinationId || "UNSPECIFIED";
                                    newAfterSchoolClassIds[day] = targetClass.id;
                                    hasAnyChange = true;

                                    if (day !== 'Saturday') {
                                        const afternoonRoutes = routes.filter(r => r.dayOfWeek === day && r.type === 'Afternoon');
                                        for (const route of afternoonRoutes) {
                                            if (route.seating.some(seat => seat.studentId === student.id)) {
                                                const nextSeating = route.seating.map(seat => 
                                                    seat.studentId === student.id ? { ...seat, studentId: null } : seat
                                                );
                                                await updateRouteSeating(route.id, nextSeating);
                                            }
                                        }
                                    }
                                } else if (!classInput) {
                                    if (newAfterSchoolDests[day] || newAfterSchoolClassIds[day]) {
                                        delete newAfterSchoolDests[day];
                                        delete newAfterSchoolClassIds[day];
                                        hasAnyChange = true;

                                        if (day !== 'Saturday') {
                                            const afterSchoolRoutes = routes.filter(r => r.dayOfWeek === day && r.type === 'AfterSchool');
                                            for (const route of afterSchoolRoutes) {
                                                if (route.seating.some(seat => seat.studentId === student.id)) {
                                                    const nextSeating = route.seating.map(seat => 
                                                        seat.studentId === student.id ? { ...seat, studentId: null } : seat
                                                    );
                                                    await updateRouteSeating(route.id, nextSeating);
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            if (hasAnyChange) {
                                await updateStudent(student.id, {
                                    [afterSchoolDestField]: newAfterSchoolDests,
                                    [afterSchoolClassField]: newAfterSchoolClassIds
                                });
                                updatedCount++;
                            }
                        }
                    }
                    dismiss();
                    toast({ title: t('success'), description: `${updatedCount}명의 학생이 방과후 학생으로 등록되었으며, 해당 요일의 하교 좌석에서 제외되었습니다.` });
                    setIsAfterSchoolDialogOpen(false);
                } catch (error) {
                    dismiss();
                    console.error("After-school batch update failed:", error);
                    toast({ title: t('error'), description: "처리 중 오류가 발생했습니다.", variant: "destructive" });
                }
            } catch (err: any) {
                toast({ title: t('admin.file_parse_error'), description: err.message, variant: "destructive" });
            }
        };
        reader.readAsArrayBuffer(file);
        if (afterSchoolFileRef.current) afterSchoolFileRef.current.value = "";
    };

    const handleFinishAfterSchool = async () => {
        if (!confirm("모든 학생의 방과후 설정을 종료하고 하교 노선으로 복귀시키겠습니까? 학생들의 방과후 목적지 정보와 방과후 노선 배정 정보가 모두 삭제됩니다.")) return;
        
        try {
            const { dismiss } = toast({ title: t('processing'), description: "방과후 설정을 종료하는 중입니다..." });
            const { clearAllAfterSchoolAssignments } = await import('@/lib/kisbus');
            await clearAllAfterSchoolAssignments(semesterMode);
            dismiss();
            toast({ title: t('success'), description: "모든 학생이 하교 노선 미배정 명단으로 복귀되었습니다." });
            setIsAfterSchoolDialogOpen(false);
        } catch (error) {
            toast({ title: t('error'), description: "초기화 중 오류가 발생했습니다.", variant: "destructive" });
        }
    };

    return (
        <div className="space-y-6" onContextMenu={(e) => { e.preventDefault(); setSwapSourceSeat(null); }}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {unassignableStudents.length > 0 && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4"/><AlertTitle>{t('admin.student_management.unassignable.title')}</AlertTitle>
                            <AlertDescription><div className="mt-2 space-y-1 max-h-[300px] overflow-y-auto pr-2">{unassignableStudents.map(s => <div key={s.id} className="text-xs flex justify-between items-center border-b border-destructive/20 py-1.5 cursor-pointer hover:bg-destructive/10" onClick={() => setSelectedGlobalStudent(s)}><span className="font-medium">{s.name} ({s.grade} {s.class})</span><span className="text-[10px]">{s.errorReason}</span></div>)}</div></AlertDescription>
                        </Alert>
                    )}
                    <Card>
                        <CardHeader>
                            <CardTitle className="whitespace-nowrap text-lg font-bold text-slate-800">
                                {t('admin.student_management.seat.title')} {currentRoute && <span className="text-sm font-normal text-indigo-600 ml-1.5 font-sans">({assignedStudentsCount}명 배정됨)</span>}
                            </CardTitle>
                            <CardDescription>
                                버스 좌석표를 확인하고 좌석을 클릭하여 학생 배치 및 변경 작업을 진행하세요.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* 버튼 하단 통합 툴바 */}
                            <div className="flex flex-wrap gap-2 items-center justify-start bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/80">
                                <Dialog open={isAddStudentDialogOpen} onOpenChange={setIsAddStudentDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            <UserPlus className="mr-2 h-4 w-4" /> {t('admin.student_management.add_student.button')}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[500px]">
                                        <DialogHeader>
                                            <DialogTitle>{t('admin.student_management.add_student.title')}</DialogTitle>
                                            <DialogDescription>직접 새로운 학생 정보를 등록합니다.</DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="nameKo" className="text-right">{t('student.name_ko', '한글 이름')}</Label>
                                                <Input id="nameKo" value={newStudent.nameKo || ''} onChange={e => setNewStudent({...newStudent, nameKo: e.target.value})} className="col-span-3" placeholder={t('student.name_ko_placeholder', '한글 성함')} />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="nameEn" className="text-right">{t('student.name_en', '영문 이름')}</Label>
                                                <Input id="nameEn" value={newStudent.nameEn || ''} onChange={e => setNewStudent({...newStudent, nameEn: e.target.value})} className="col-span-3" placeholder={t('student.name_en_placeholder', 'English Name')} />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="grade" className="text-right">학년</Label>
                                                <Input id="grade" value={newStudent.grade || ''} onChange={e => setNewStudent({...newStudent, grade: e.target.value})} className="col-span-3" placeholder="예: 1" />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="class" className="text-right">반</Label>
                                                <Input id="class" value={newStudent.class || ''} onChange={e => setNewStudent({...newStudent, class: e.target.value})} className="col-span-3" placeholder="예: 1" />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="gender" className="text-right">성별</Label>
                                                <Select value={newStudent.gender} onValueChange={(v: any) => setNewStudent({...newStudent, gender: v})}>
                                                    <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Male">{t('student.male')}</SelectItem>
                                                        <SelectItem value="Female">{t('student.female')}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="contact" className="text-right">연락처</Label>
                                                <Input id="contact" value={newStudent.contact || ''} onChange={e => setNewStudent({...newStudent, contact: e.target.value})} className="col-span-3" placeholder="베트남 전화번호" />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button onClick={handleManualAddStudent} className="w-full">{t('add')}</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                                <Button variant="outline" size="sm" onClick={handleRandomAssign} disabled={!currentRoute} title={t('admin.student_management.seat.random_assign_button')}><Shuffle className="h-4 w-4" /></Button>
                                <Dialog open={isCopySeatingDialogOpen} onOpenChange={setIsCopySeatingDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" disabled={!currentRoute} title={t('admin.student_management.seat.copy.button')}><Copy className="h-4 w-4" /></Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader><DialogTitle>{t('admin.student_management.seat.copy.title')}</DialogTitle></DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div>
                                                <Label>{t('admin.student_management.seat.copy.select_days')}</Label>
                                                <div className="grid grid-cols-3 gap-2 mt-2">
                                                    {dayOrder.map(day => (
                                                        <div key={`seating-day-${day}`} className="flex items-center space-x-2">
                                                            <Checkbox id={`seating-day-${day}`} checked={!!daysToCopySeatingTo[day]} onCheckedChange={(checked) => setDaysToCopySeatingTo(prev => ({ ...prev, [day]: checked as boolean }))} />
                                                            <Label htmlFor={`seating-day-${day}`}>{t(`day.${day.toLowerCase()}`)}</Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <Label>{t('admin.student_management.seat.copy.select_route_types')}</Label>
                                                <div className="flex items-center space-x-4 mt-2">
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox id="seating-type-morning" checked={!!routeTypesToCopySeatingTo.Morning} onCheckedChange={(checked) => setRouteTypesToCopySeatingTo(prev => ({ ...prev, Morning: checked as boolean }))} />
                                                        <Label htmlFor="seating-type-morning">{t('route_type.morning')}</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox id="seating-type-afternoon" checked={!!routeTypesToCopySeatingTo.Afternoon} onCheckedChange={(checked) => setRouteTypesToCopySeatingTo(prev => ({ ...prev, Afternoon: checked as boolean }))} />
                                                        <Label htmlFor="seating-type-afternoon">{t('route_type.afternoon')}</Label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter><Button onClick={handleCopySeating} className="w-full">{t('copy')}</Button></DialogFooter>
                                    </DialogContent>
                                </Dialog>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleUndo} 
                                    disabled={seatingHistory.length === 0}
                                    className="border-orange-200 text-orange-600 hover:bg-orange-50"
                                    title="마지막 좌석 변경 취소"
                                >
                                    <RotateCcw className="h-4 w-4 mr-1"/> Undo
                                </Button>
                                <Button variant="outline" size="sm" onClick={async () => { if (currentRoute && selectedBus) await handleSeatUpdate(generateInitialSeating(selectedBus.capacity)); }} title="좌석 초기화"><RotateCcw className="h-4 w-4"/></Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                                            <Sparkles className="h-4 w-4 mr-1" /> 일괄 도구
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-64">
                                        <DropdownMenuItem onClick={handleGlobalRandomAssign}>
                                            <Shuffle className="mr-2 h-4 w-4" /> 미배정 학생 일괄 전체 배정
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleOpenGlobalClearDialog} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                            <Trash className="mr-2 h-4 w-4" /> 버스/경로/요일 선택 초기화
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Dialog open={isGlobalClearDialogOpen} onOpenChange={setIsGlobalClearDialogOpen}>
                                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle>일괄 버스 좌석 초기화</DialogTitle>
                                            <DialogDescription>초기화할 버스, 요일, 경로를 선택하세요. 선택된 조건에 해당하는 모든 노선의 좌석이 비워집니다.</DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-6 py-4">
                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <Label className="text-lg font-semibold block mb-3">요일 선택</Label>
                                                    <div className="space-y-2">
                                                        {dayOrder.map(day => (
                                                            <div key={`cday-${day}`} className="flex items-center space-x-2">
                                                                <Checkbox id={`cday-${day}`} checked={!!clearDays[day]} onCheckedChange={(checked) => setClearDays(prev => ({ ...prev, [day]: checked as boolean }))} />
                                                                <Label htmlFor={`cday-${day}`}>{t(`day.${day.toLowerCase()}`)}</Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="text-lg font-semibold block mb-3">경로 선택</Label>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox id="ctype-morning" checked={!!clearRouteTypes.Morning} onCheckedChange={(checked) => setClearRouteTypes(prev => ({ ...prev, Morning: checked as boolean }))} />
                                                            <Label htmlFor="ctype-morning">{t('route_type.morning')}</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox id="ctype-afternoon" checked={!!clearRouteTypes.Afternoon} onCheckedChange={(checked) => setClearRouteTypes(prev => ({ ...prev, Afternoon: checked as boolean }))} />
                                                            <Label htmlFor="ctype-afternoon">{t('route_type.afternoon')}</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox id="ctype-afterschool" checked={!!clearRouteTypes.AfterSchool} onCheckedChange={(checked) => setClearRouteTypes(prev => ({ ...prev, AfterSchool: checked as boolean }))} />
                                                            <Label htmlFor="ctype-afterschool">{t('route_type.afterschool')}</Label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between items-center mb-3">
                                                    <Label className="text-lg font-semibold">버스 선택</Label>
                                                    <div className="space-x-2">
                                                        <Button variant="outline" size="sm" onClick={() => setClearBuses(buses.reduce((acc, b) => ({ ...acc, [b.id]: true }), {}))}>전체 선택</Button>
                                                        <Button variant="outline" size="sm" onClick={() => setClearBuses({})}>전체 해제</Button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border p-4 rounded-md min-h-[150px] max-h-[300px] overflow-y-auto">
                                                    {buses.map(bus => (
                                                        <div key={`cbus-${bus.id}`} className="flex items-center space-x-2">
                                                            <Checkbox id={`cbus-${bus.id}`} checked={!!clearBuses[bus.id]} onCheckedChange={(checked) => setClearBuses(prev => ({ ...prev, [bus.id]: checked as boolean }))} />
                                                            <Label htmlFor={`cbus-${bus.id}`} className="truncate w-32" title={bus.name}>{bus.name}</Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setIsGlobalClearDialogOpen(false)}>취소</Button>
                                            <Button variant="destructive" onClick={handleExecuteGlobalClearSeats}>초기화 실행</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>

                            </div>

                            {selectedBus && currentRoute ? <BusSeatMap bus={selectedBus} seating={currentRoute.seating} students={students} destinations={destinations} onSeatClick={handleSeatClick} onSeatContextMenu={handleSeatContextMenu} highlightedSeatNumber={swapSourceSeat || selectedSeat?.seatNumber} boardedStudentIds={[]} notBoardingStudentIds={[]} routeType={selectedRouteType} dayOfWeek={selectedDay} /> : <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">{t('admin.student_management.seat.select_bus_prompt')}</div>}
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-1 space-y-4">
                    <StudentUnassignedPanel filteredUnassignedStudents={filteredUnassignedStudents} destinations={destinations} selectedStudentIds={selectedStudentIds} unassignedSearchQuery={unassignedSearchQuery} setUnassignedSearchQuery={setUnassignedSearchQuery} unassignedView={unassignedView} setUnassignedView={setUnassignedView} unassignedTitle={t('admin.student_management.unassigned.title_simple', '미배정 학생')} selectedRouteType={selectedRouteType} selectedDay={selectedDay} handleDownloadUnassignedStudents={handleDownloadUnassignedStudents} handleToggleSelectAll={() => { if (selectedStudentIds.size === filteredUnassignedStudents.length) setSelectedStudentIds(new Set()); else setSelectedStudentIds(new Set(filteredUnassignedStudents.map(s => s.id))); }} handleDeleteSelectedStudents={() => deleteStudentsInBatch(Array.from(selectedStudentIds))} handleToggleStudentSelection={(id, checked) => { const next = new Set(selectedStudentIds); if (checked) next.add(id); else next.delete(id); setSelectedStudentIds(next); }} handleUnassignedStudentClick={setSelectedGlobalStudent} handleStudentCardClick={handleStudentCardClick}/>
                    <StudentGlobalSearchPanel 
                        students={students} 
                        destinations={destinations} 
                        buses={buses} 
                        routes={routes} 
                        selectedRouteType={selectedRouteType} 
                        dayOrder={dayOrder} 
                        selectedGlobalStudent={selectedGlobalStudent} 
                        setSelectedGlobalStudent={setSelectedGlobalStudent} 
                        globalSearchQuery={globalSearchQuery} 
                        setGlobalSearchQuery={setGlobalSearchQuery} 
                        globalSearchResults={globalSearchResults} 
                        handleGlobalStudentClick={(student) => setSelectedGlobalStudent(student)} 
                        handleDownloadAllStudents={handleDownloadAllStudents} 
                        handleDownloadRouteAssignments={handleDownloadRouteAssignments} 
                        handleDownloadStudentTemplate={handleDownloadStudentTemplate} 
                        fileInputRef={fileInputRef} 
                        handleStudentFileUpload={handleStudentFileUpload} 
                        handleDeleteAllStudents={async () => { if (confirm(t('confirm_delete_all'))) { await deleteStudentsInBatch(students.map(s => s.id)); setSelectedGlobalStudent(null); } }} 
                        handleUnassignAllFromStudent={async () => { if (selectedGlobalStudent) { await unassignStudentFromAllRoutes(selectedGlobalStudent.id); toast({ title: t('success') }); } }} 
                        handleAssignStudentFromSearch={handleAssignStudentFromSearch} 
                        handleStudentInfoChange={async (id, field, val) => { await updateStudent(id, { [field]: sanitizeDataForSystem(val) }); setSelectedGlobalStudent(prev => prev && prev.id === id ? { ...prev, [field]: sanitizeDataForSystem(val) } : prev); }} 
                        handleDestinationChange={async (sid, val, type, day) => { 
                            const realVal = val === '_NONE_' ? null : val; 
                            const updates: any = {}; 
                            if (type === 'morning') {
                                updates.morningDestinationId = realVal; 
                                updates.suggestedMorningDestination = null;
                            } else if (type === 'afternoon') {
                                updates.afternoonDestinationId = realVal; 
                                updates.suggestedAfternoonDestination = null;
                            } else if (type === 'satMorning') {
                                updates.satMorningDestinationId = realVal; 
                                updates.suggestedSatMorningDestination = null;
                            } else if (type === 'satAfternoon') {
                                updates.satAfternoonDestinationId = realVal; 
                                updates.suggestedSatAfternoonDestination = null;
                            } else if (type === 'afterSchool' && day) { 
                                const targetStudent = students.find(s => s.id === sid);
                                const current = {
                                    ...(targetStudent ? getAfterSchoolDests(targetStudent) : {}),
                                    ...(selectedGlobalStudent?.id === sid ? getAfterSchoolDests(selectedGlobalStudent) : {})
                                };
                                updates[afterSchoolDestField] = { ...current, [day]: realVal }; 
                                
                                // Clear after school suggestion if it exists for this day
                                if (selectedGlobalStudent?.suggestedAfterSchoolDestinations?.[day]) {
                                    const currentSug = { ...selectedGlobalStudent.suggestedAfterSchoolDestinations };
                                    delete currentSug[day];
                                    updates.suggestedAfterSchoolDestinations = currentSug;
                                }

                                if (realVal) {
                                    const afternoonRoutes = routes.filter(r => r.dayOfWeek === day && r.type === 'Afternoon');
                                    for (const r of afternoonRoutes) {
                                        if (r.seating.some(seat => seat.studentId === sid)) {
                                            const nextSeating = r.seating.map(seat => seat.studentId === sid ? { ...seat, studentId: null } : seat);
                                            await updateRouteSeating(r.id, nextSeating);
                                        }
                                    }
                                }
                            } 
                            await updateStudent(sid, updates); 
                            
                            // Also update local state for immediate UI feedback
                            if (selectedGlobalStudent?.id === sid) {
                                setSelectedGlobalStudent(prev => prev ? { ...prev, ...updates } : null);
                            }
                        }} 
                        handleUnassignStudentFromRoute={async (rid, sid) => { 
                            const route = routes.find(r => r.id === rid); 
                            if (route) { 
                                const next = route.seating.map(s => s.studentId === sid ? { ...s, studentId: null } : s); 
                                await updateRouteSeatingWithVacationSync(rid, next); 
                                toast({ title: t('success') }); 
                            } 
                        }} 
                        assignedRoutesForSelectedStudent={assignedRoutesForSelectedStudent}
                        afterSchoolClasses={afterSchoolClasses}
                        semesterMode={semesterMode}
                        onAddStudentToClass={async (studentId: string, classId: string) => {
                            const targetClass = afterSchoolClasses.find(c => c.id === classId);
                            const targetStudent = students.find(s => s.id === studentId);
                            if (!targetClass || !targetStudent) return;
                            
                            try {
                                if (semesterMode === 'vacation') {
                                    const updatedClassIds = { ...(targetStudent.vacationAfterSchoolClassIds || {}) };
                                    const updatedDestinations = { ...(targetStudent.vacationAfterSchoolDestinations || {}) };
                                    const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                                    const siblingClasses = afterSchoolClasses.filter(c => c.semesterMode === 'vacation' && c.name === targetClass.name);
                                    siblingClasses.forEach(sc => {
                                        updatedClassIds[sc.dayOfWeek] = sc.id;
                                        if (!updatedDestinations[sc.dayOfWeek]) {
                                            updatedDestinations[sc.dayOfWeek] = targetStudent.afternoonDestinationId || '';
                                        }
                                    });
                                    await updateStudent(studentId, {
                                        vacationAfterSchoolClassIds: updatedClassIds,
                                        vacationAfterSchoolDestinations: updatedDestinations
                                    });
                                } else {
                                    const updatedClassIds = { ...(targetStudent.afterSchoolClassIds || {}) };
                                    const updatedDestinations = { ...(targetStudent.afterSchoolDestinations || {}) };
                                    updatedClassIds[targetClass.dayOfWeek] = targetClass.id;
                                    if (!updatedDestinations[targetClass.dayOfWeek]) {
                                        updatedDestinations[targetClass.dayOfWeek] = targetStudent.afternoonDestinationId || '';
                                    }
                                    await updateStudent(studentId, {
                                        afterSchoolClassIds: updatedClassIds,
                                        afterSchoolDestinations: updatedDestinations
                                    });
                                }
                                setSelectedGlobalStudent(prev => {
                                    if (!prev || prev.id !== studentId) return prev;
                                    const fieldKey = semesterMode === 'vacation' ? 'vacationAfterSchoolClassIds' : 'afterSchoolClassIds';
                                    const current = (prev[fieldKey] as any) || {};
                                    if (semesterMode === 'vacation') {
                                        const siblingClasses = afterSchoolClasses.filter(c => c.semesterMode === 'vacation' && c.name === targetClass.name);
                                        const updated = { ...current };
                                        siblingClasses.forEach(sc => { updated[sc.dayOfWeek] = sc.id; });
                                        return { ...prev, [fieldKey]: updated };
                                    }
                                    return { ...prev, [fieldKey]: { ...current, [targetClass.dayOfWeek]: targetClass.id } };
                                });
                                toast({ title: t('success'), description: "방과후 수업 명단에 등록되었습니다." });
                            } catch (error) {
                                console.error('방과후 명단 추가 실패:', error);
                                toast({ title: t('error'), description: "추가 중 오류가 발생했습니다.", variant: 'destructive' });
                            }
                        }}
                        onRemoveStudentFromClass={async (studentId: string, className: string) => {
                            const targetStudent = students.find(s => s.id === studentId);
                            if (!targetStudent) return;

                            try {
                                if (semesterMode === 'vacation') {
                                    const allVacClassesSameName = afterSchoolClasses.filter(
                                        c => c.semesterMode === 'vacation' && c.name === className
                                    );

                                    const updatedVacClassIds = { ...(targetStudent.vacationAfterSchoolClassIds || {}) };
                                    const updatedVacDestinations = { ...(targetStudent.vacationAfterSchoolDestinations || {}) };
                                    const updatedRegClassIds = { ...(targetStudent.afterSchoolClassIds || {}) };
                                    const updatedRegDestinations = { ...(targetStudent.afterSchoolDestinations || {}) };

                                    for (const cls of allVacClassesSameName) {
                                        delete updatedVacClassIds[cls.dayOfWeek];
                                        delete updatedVacDestinations[cls.dayOfWeek];
                                        if (updatedRegClassIds[cls.dayOfWeek] === cls.id) {
                                            delete updatedRegClassIds[cls.dayOfWeek];
                                            delete updatedRegDestinations[cls.dayOfWeek];
                                        }
                                    }

                                    await updateStudent(studentId, {
                                        vacationAfterSchoolClassIds: updatedVacClassIds,
                                        vacationAfterSchoolDestinations: updatedVacDestinations,
                                        afterSchoolClassIds: updatedRegClassIds,
                                        afterSchoolDestinations: updatedRegDestinations
                                    });

                                    // 모든 요일의 Morning 및 Afternoon 버스 좌석에서 일괄 제거
                                    for (const cls of allVacClassesSameName) {
                                        const targetRoutes = routes.filter(r => 
                                            r.dayOfWeek === cls.dayOfWeek && 
                                            (r.type === 'Morning' || r.type === 'Afternoon') &&
                                            r.seating.some(seat => seat.studentId === studentId)
                                        );
                                        for (const route of targetRoutes) {
                                            const nextSeating = route.seating.map(seat => 
                                                seat.studentId === studentId ? { ...seat, studentId: null } : seat
                                            );
                                            await updateRouteSeatingWithVacationSync(route.id, nextSeating);
                                        }
                                    }

                                    setSelectedGlobalStudent(prev => {
                                        if (!prev || prev.id !== studentId) return prev;
                                        return {
                                            ...prev,
                                            vacationAfterSchoolClassIds: updatedVacClassIds,
                                            vacationAfterSchoolDestinations: updatedVacDestinations,
                                            afterSchoolClassIds: updatedRegClassIds,
                                            afterSchoolDestinations: updatedRegDestinations
                                        };
                                    });
                                } else {
                                    const targetClasses = afterSchoolClasses.filter(
                                        c => (c.semesterMode || 'regular') === 'regular' && c.name === className
                                    );

                                    const updatedClassIds = { ...(targetStudent.afterSchoolClassIds || {}) };
                                    const updatedDestinations = { ...(targetStudent.afterSchoolDestinations || {}) };

                                    for (const cls of targetClasses) {
                                        delete updatedClassIds[cls.dayOfWeek];
                                        delete updatedDestinations[cls.dayOfWeek];
                                    }

                                    await updateStudent(studentId, {
                                        afterSchoolClassIds: updatedClassIds,
                                        afterSchoolDestinations: updatedDestinations
                                    });

                                    for (const cls of targetClasses) {
                                        const targetRoutes = routes.filter(r => 
                                            r.dayOfWeek === cls.dayOfWeek && 
                                            r.type === 'AfterSchool' &&
                                            r.seating.some(seat => seat.studentId === studentId)
                                        );
                                        for (const route of targetRoutes) {
                                            const nextSeating = route.seating.map(seat => 
                                                seat.studentId === studentId ? { ...seat, studentId: null } : seat
                                            );
                                            await updateRouteSeatingWithVacationSync(route.id, nextSeating);
                                        }
                                    }

                                    setSelectedGlobalStudent(prev => {
                                        if (!prev || prev.id !== studentId) return prev;
                                        return {
                                            ...prev,
                                            afterSchoolClassIds: updatedClassIds,
                                            afterSchoolDestinations: updatedDestinations
                                        };
                                    });
                                }

                                toast({ title: t('success'), description: `'${className}' 수업 및 관련 버스 배정이 해제되었습니다.` });
                            } catch (error) {
                                console.error('방과후 명단 제거 실패:', error);
                                toast({ title: t('error'), description: "제거 중 오류가 발생했습니다.", variant: 'destructive' });
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
