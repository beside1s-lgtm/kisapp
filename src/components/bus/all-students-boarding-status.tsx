'use client';

import { useMemo } from 'react';
import { arrayUnion, arrayRemove } from 'firebase/firestore';
import { Crown, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { updateAttendance } from '@/lib/kisbus';
import { cn, getStudentName } from '@/lib/kisbus/utils';
import type { Bus, Student, Route, AttendanceRecord } from '@/lib/kisbus/types';
import { getGradeValue } from './bus-page-utils';

/**
 * "전체 버스 탑승 현황" 카드 (teacher/bus/page.tsx에서 순수 이동).
 *
 * 원래부터 TeacherPage 내부 클로저를 참조하지 않는, props만으로 동작하는
 * 독립 컴포넌트였기 때문에 그대로 파일만 옮긴 것이다 (동작 변경 없음).
 */
export const AllStudentsBoardingStatus = ({ relevantRoutes, students, buses, allAttendance, selectedDate, formatStudentName, t, afterschoolAbsentStudentIds, onSelectStudent }: { relevantRoutes: Route[]; students: Student[]; buses: Bus[]; allAttendance: Record<string, AttendanceRecord | null>; selectedDate?: string; formatStudentName: (student: Student) => string; t: any; afterschoolAbsentStudentIds?: Set<string>; onSelectStudent?: (student: Student) => void; }) => {
    const { toast } = useToast();
    const { i18n } = useTranslation();

    const allStudentsOnDay = useMemo(() => {
        const studentsList: (Student & { busName: string; routeId: string; status: 'boarded' | 'notRiding' | 'disembarked' | 'not_boarded' })[] = [];
        relevantRoutes.forEach(route => {
            const bus = buses.find(b => b.id === route.busId);
            if (!bus) return;
            route.seating.forEach(seat => {
                if (!seat.studentId) return;
                const student = students.find(s => s.id === seat.studentId);
                if (student) {
                    const record = allAttendance[route.id];
                    const isAfterschoolAbsent = route.type === 'AfterSchool' && afterschoolAbsentStudentIds?.has(student.id);
                    let status: any = 'not_boarded';
                    if (record?.boarded?.includes(student.id)) status = 'boarded';
                    else if (record?.notBoarding?.includes(student.id) || isAfterschoolAbsent) status = 'notRiding';
                    else if (record?.disembarked?.includes(student.id)) status = 'disembarked';
                    if (!studentsList.some(s => s.id === student.id)) studentsList.push({ ...student, busName: bus.name, routeId: route.id, status });
                }
            });
        });
        return studentsList.sort((a,b) => {
            const priority = (s: string) => {
                if (s === 'not_boarded') return 1;
                if (s === 'notRiding') return 2;
                if (s === 'boarded') return 3;
                if (s === 'disembarked') return 4;
                return 5;
            };
            if (priority(a.status) !== priority(b.status)) return priority(a.status) - priority(b.status);
            const busCmp = a.busName.localeCompare(b.busName, undefined, { numeric: true });
            if (busCmp !== 0) return busCmp;
            if (getGradeValue(a.grade) !== getGradeValue(b.grade)) return getGradeValue(a.grade) - getGradeValue(b.grade);
            if (a.class !== b.class) return a.class.localeCompare(b.class, undefined, { numeric: true });
            return getStudentName(a, i18n.language).localeCompare(getStudentName(b, i18n.language), 'ko');
        });
    }, [relevantRoutes, students, buses, allAttendance, i18n.language, afterschoolAbsentStudentIds]);

    const handleToggleAttendance = async (s: Student & { busName: string; routeId: string; status: 'boarded' | 'notRiding' | 'disembarked' | 'not_boarded' }) => {
        if (!s.routeId || !selectedDate) return;
        const currentRecord = allAttendance[s.routeId];
        const isB = currentRecord?.boarded?.includes(s.id) || s.status === 'boarded';
        const isD = currentRecord?.disembarked?.includes(s.id) || s.status === 'disembarked';

        const updates: any = {};

        if (isD) {
            // 하차완료 -> 미탑승
            updates.disembarked = arrayRemove(s.id);
            updates.boarded = arrayRemove(s.id);
        } else if (isB) {
            // 탑승 -> 하차완료
            updates.boarded = arrayRemove(s.id);
            updates.disembarked = arrayUnion(s.id);
        } else {
            // 미탑승 또는 오늘 안 탐 -> 탑승
            updates.boarded = arrayUnion(s.id);
            updates.notBoarding = arrayRemove(s.id);
            updates.disembarked = arrayRemove(s.id);
        }

        try {
            await updateAttendance(s.routeId, selectedDate, updates);
        } catch (error) {
            console.error("Failed to toggle attendance:", error);
            toast({
                title: t('error') || '오류',
                description: '탑승 상태 변경에 실패했습니다.',
                variant: 'destructive'
            });
        }
    };

    const getStatusLabel = (status: string) => {
        if (status === 'boarded') return t('teacher_page.status_boarded') || '탑승';
        if (status === 'disembarked') return t('teacher_page.status_disembarked') || '하차 완료';
        if (status === 'notRiding') return t('teacher_page.status_not_riding_today') || t('teacher_page.status_notRiding') || '오늘 안 탐';
        return t('teacher_page.status_not_boarded') || '미탑승';
    };

    const handleCopyNotBoarded = () => {
        const notBoardedStudents = allStudentsOnDay.filter(s => s.status === 'not_boarded');

        if (notBoardedStudents.length === 0) {
            toast({
                title: t('success') || '알림',
                description: '미탑승자가 없습니다.'
            });
            return;
        }

        const busGroups: Record<string, string[]> = {};
        notBoardedStudents.forEach(s => {
            if (!busGroups[s.busName]) {
                busGroups[s.busName] = [];
            }
            busGroups[s.busName].push(formatStudentName(s));
        });

        const firstRoute = relevantRoutes[0];
        const dayName = firstRoute ? t(`days.${firstRoute.dayOfWeek}`) : '';
        const routeTypeName = firstRoute ? t(`route_type.${firstRoute.type.toLowerCase()}`) : '';

        let text = `[미탑승자 명단 (${dayName} ${routeTypeName})]\n`;

        const sortedBusNames = Object.keys(busGroups).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''), 10);
            const numB = parseInt(b.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b, 'ko');
        });

        sortedBusNames.forEach(busName => {
            text += `- ${busName}: ${busGroups[busName].join(', ')}\n`;
        });

        navigator.clipboard.writeText(text).then(() => {
            toast({
                title: t('success') || '성공',
                description: '미탑승자 명단이 복사되었습니다.'
            });
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            toast({
                title: t('error') || '오류',
                description: '클립보드 복사에 실패했습니다.',
                variant: 'destructive'
            });
        });
    };

    return (
        <Card id="all-students-boarding-section" className="border-none shadow-none lg:border lg:shadow-sm w-full h-full scroll-mt-20">
            <CardHeader className="px-2 py-3 sm:px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base sm:text-lg">{t('teacher_page.all_buses_view.title')}</CardTitle>
                <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 sm:px-3 text-xs flex items-center gap-1.5 shrink-0"
                        onClick={handleCopyNotBoarded}
                        title={t('teacher_page.all_buses_view.copy_button') || '미탑승자 복사'}
                    >
                        <Copy className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t('teacher_page.all_buses_view.copy_button') || '미탑승자 복사'}</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="lg:hidden h-8 w-8 p-0 text-amber-700 bg-amber-50/70 border-amber-200 hover:bg-amber-100 flex items-center justify-center shrink-0"
                        onClick={() => {
                            document.getElementById('all-group-leaders-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        title={t('teacher_page.all_buses_view.goto_group_leaders') || '조장 현황 바로가기'}
                    >
                        <Crown className="h-4 w-4 text-amber-600 shrink-0" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="px-1 sm:px-2 max-h-[70vh] overflow-y-auto">
                <Table className="w-full">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="whitespace-nowrap w-px">{t('student.name')}</TableHead>
                            <TableHead className="whitespace-nowrap w-px">{t('bus')}</TableHead>
                            <TableHead className="whitespace-nowrap">{t('teacher_page.status')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allStudentsOnDay.map(s => (
                            <TableRow
                                key={s.id}
                                className="hover:bg-slate-100/80 transition-colors group select-none"
                            >
                                <TableCell
                                    className="whitespace-nowrap font-medium text-xs sm:text-sm py-2 sm:py-2.5 cursor-pointer"
                                    onClick={() => onSelectStudent?.(s)}
                                >
                                    <span className="group-hover:text-primary font-bold text-slate-900 transition-colors">{formatStudentName(s)}</span>
                                </TableCell>
                                <TableCell
                                    className="whitespace-nowrap text-xs text-muted-foreground py-2 sm:py-2.5 cursor-pointer"
                                    onClick={() => onSelectStudent?.(s)}
                                >
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 font-medium text-slate-700">{s.busName}</span>
                                </TableCell>
                                <TableCell
                                    className="whitespace-nowrap text-right py-1.5 sm:py-2"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleToggleAttendance(s);
                                        }}
                                        className={cn(
                                            "cursor-pointer select-none text-xs font-bold transition-all active:scale-95 shadow-2xs",
                                            "h-7 sm:h-8 px-2.5 sm:px-3 py-1 rounded-lg inline-flex items-center justify-center whitespace-nowrap min-w-[62px] sm:min-w-[70px] border",
                                            s.status === 'boarded' && "bg-slate-900 hover:bg-slate-800 text-white border-slate-900",
                                            s.status === 'disembarked' && "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300",
                                            s.status === 'notRiding' && "bg-rose-500 hover:bg-rose-600 text-white border-rose-500",
                                            s.status === 'not_boarded' && "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
                                        )}
                                        title="클릭 시 탑승/하차완료/미탑승 순환 변경"
                                    >
                                        {getStatusLabel(s.status)}
                                    </button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {allStudentsOnDay.length === 0 && <div className="text-center text-xs text-muted-foreground py-8">{t('no_students')}</div>}
            </CardContent>
        </Card>
    );
};
