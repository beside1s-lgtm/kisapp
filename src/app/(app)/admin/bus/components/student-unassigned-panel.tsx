'use client';

import React, { useRef, useCallback, KeyboardEvent } from 'react';
import { Search, Download, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { StudentCard } from '@/components/bus/draggable-student-card';
import { useTranslation } from '@/hooks/use-translation';
import type { Student, Destination, DayOfWeek, RouteType } from '@/lib/kisbus/types';

interface StudentUnassignedPanelProps {
    filteredUnassignedStudents: Student[];
    destinations: Destination[];
    selectedStudentIds: Set<string>;
    unassignedSearchQuery: string;
    setUnassignedSearchQuery: (query: string) => void;
    unassignedView: 'current' | 'all';
    setUnassignedView: (view: 'current' | 'all') => void;
    unassignedTitle: string;
    selectedRouteType: RouteType;
    selectedDay: DayOfWeek;
    handleDownloadUnassignedStudents: () => void;
    handleToggleSelectAll: () => void;
    handleDeleteSelectedStudents: () => void;
    handleToggleStudentSelection: (id: string, isChecked: boolean) => void;
    handleUnassignedStudentClick: (student: Student) => void;
    handleStudentCardClick: (id: string) => void;
}

export const StudentUnassignedPanel = ({
    filteredUnassignedStudents, destinations, selectedStudentIds, unassignedSearchQuery, setUnassignedSearchQuery,
    unassignedView, setUnassignedView, unassignedTitle, selectedRouteType, selectedDay,
    handleDownloadUnassignedStudents, handleToggleSelectAll, handleDeleteSelectedStudents,
    handleToggleStudentSelection, handleUnassignedStudentClick, handleStudentCardClick
}: StudentUnassignedPanelProps) => {
    const { t } = useTranslation();
    const listRef = useRef<HTMLDivElement>(null);

    const siblingCount = filteredUnassignedStudents.filter(s => !!s.siblingGroupId).length;

    // 검색어 입력 또는 엔터 시 첫 번째 카드로 스크롤
    const scrollToFirstMatch = useCallback(() => {
        if (!listRef.current || filteredUnassignedStudents.length === 0) return;
        const firstCard = listRef.current.querySelector('[data-student-card]') as HTMLElement | null;
        if (firstCard) {
            firstCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            // 시각적 하이라이트 효과
            firstCard.style.outline = '2px solid #6366f1';
            firstCard.style.borderRadius = '8px';
            setTimeout(() => {
                if (firstCard) {
                    firstCard.style.outline = '';
                    firstCard.style.borderRadius = '';
                }
            }, 1500);
        }
    }, [filteredUnassignedStudents]);

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            scrollToFirstMatch();
        }
    }, [scrollToFirstMatch]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="whitespace-nowrap font-headline text-lg">{unassignedTitle}</CardTitle>
                <CardDescription className="flex items-center justify-between flex-wrap gap-1 mt-1">
                    <span>
                        {unassignedView === 'current' ? '현재 노선에 맞는 학생들입니다.' : '아직 배정되지 않은 모든 학생들입니다.'}
                    </span>
                    {siblingCount > 0 && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            <Users className="w-3.5 h-3.5" /> 형제/자매: {siblingCount}명
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-3">
                {/* 탭 구분 & 검색창 하단 통합 툴바 */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <Tabs value={unassignedView} onValueChange={(v) => setUnassignedView(v as 'current'|'all')} className="shrink-0">
                        <TabsList className="h-9">
                            <TabsTrigger value="current" className="text-xs px-3">현재 노선</TabsTrigger>
                            <TabsTrigger value="all" className="text-xs px-3">전체</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <div className="relative flex-1 min-w-[140px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder={`${t('admin.student_management.unassigned.search_placeholder')} (Enter: 카드로 이동)`}
                            className="pl-8 w-full h-9 text-xs"
                            value={unassignedSearchQuery}
                            onChange={(e) => setUnassignedSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                </div>

                {/* 하단 액션 버튼들 */}
                <div className="flex justify-end gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={handleDownloadUnassignedStudents} className="h-8 text-xs">
                        <Download className="mr-1.5 h-3.5 w-3.5" /> {t('admin.student_management.unassigned.download_list')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleToggleSelectAll} className="h-8 text-xs">
                        {selectedStudentIds.size === filteredUnassignedStudents.length && filteredUnassignedStudents.length > 0 ? t('deselect_all') : t('select_all')}
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" disabled={selectedStudentIds.size === 0} className="h-8 text-xs">
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> {t('delete_selected')}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('admin.student_management.unassigned.delete_confirm_title')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t('admin.student_management.unassigned.delete_confirm_description', { count: selectedStudentIds.size })}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteSelectedStudents}>{t('delete')}</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
                <div ref={listRef} className="min-h-[200px] max-h-[30vh] overflow-y-auto pr-1">
                    {filteredUnassignedStudents.map((student, idx) => (
                        <div key={student.id} data-student-card={student.id}>
                            <StudentCard 
                                student={student} 
                                destinations={destinations}
                                isChecked={selectedStudentIds.has(student.id)}
                                onCheckedChange={(isChecked) => handleToggleStudentSelection(student.id, isChecked)}
                                onCardClick={() => handleUnassignedStudentClick(student)}
                                onAssignClick={() => handleStudentCardClick(student.id)}
                                routeType={selectedRouteType}
                                dayOfWeek={selectedDay}
                            />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
