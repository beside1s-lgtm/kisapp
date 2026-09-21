'use client';

import React, { useMemo, useEffect } from 'react';
import type { Bus, Route, Destination, DayOfWeek, RouteType } from '@/lib/kisbus/types';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/kisbus/utils';

interface AdminPageFilterProps {
    buses: Bus[];
    routes: Route[];
    destinations?: Destination[];
    selectedBusId: string | null;
    setSelectedBusId: (id: string | null) => void;
    selectedDay: DayOfWeek;
    setSelectedDay: (day: DayOfWeek) => void;
    selectedRouteType: RouteType;
    setSelectedRouteType: (type: RouteType) => void;
    days: DayOfWeek[];
    filterConfiguredBusesOnly?: boolean;
    showRouteStops?: boolean;
    semesterMode?: 'regular' | 'vacation';
    rightContent?: React.ReactNode;
    activeTab?: string;
    onTabChange?: (tab: string) => void;
}

export const AdminPageFilter = ({
    buses,
    routes,
    destinations = [],
    selectedBusId,
    setSelectedBusId,
    selectedDay,
    setSelectedDay,
    selectedRouteType,
    setSelectedRouteType,
    days,
    filterConfiguredBusesOnly = false,
    showRouteStops = false,
    semesterMode = 'regular',
    rightContent,
    activeTab,
    onTabChange,
}: AdminPageFilterProps) => {
    const { t } = useTranslation();

    const filteredBuses = useMemo(() => {
        const activeBuses = buses.filter(bus => {
            if (selectedDay === 'Saturday' && selectedRouteType === 'AfterSchool') return false;
            return bus.isActive !== false;
        });
        if (!filterConfiguredBusesOnly) return activeBuses;

        const operationalBusIds = new Set<string>();
        routes.forEach(route => {
            if (route.dayOfWeek === selectedDay && route.type === selectedRouteType) {
                if ((route.stops?.length ?? 0) > 0) {
                    operationalBusIds.add(route.busId);
                }
            }
        });
        return activeBuses.filter(bus => operationalBusIds.has(bus.id));
    }, [buses, routes, selectedDay, selectedRouteType, filterConfiguredBusesOnly]);

    useEffect(() => {
        if (filterConfiguredBusesOnly) {
            if (selectedBusId && selectedBusId !== 'all' && !filteredBuses.some(b => b.id === selectedBusId)) {
                setSelectedBusId(filteredBuses.length > 0 ? filteredBuses[0].id : 'all');
            } else if (!selectedBusId && filteredBuses.length > 0) {
                setSelectedBusId('all');
            }
        } else {
             if (!selectedBusId && buses.length > 0) {
                setSelectedBusId('all');
            }
        }
    }, [filteredBuses, selectedBusId, setSelectedBusId, filterConfiguredBusesOnly, buses]);

    const { currentRouteStops, fullRouteStops } = useMemo(() => {
        if (!showRouteStops || !selectedBusId || selectedBusId === 'all') {
            return { currentRouteStops: null, fullRouteStops: null };
        }
        const route = routes.find(r => r.busId === selectedBusId && r.dayOfWeek === selectedDay && r.type === selectedRouteType);
        if (!route || !route.stops || route.stops.length === 0) {
            return { currentRouteStops: t('no_route_info'), fullRouteStops: t('no_route_info') };
        }

        const rawStopNames = route.stops.map(stopId => destinations.find(d => d.id === stopId)?.name).filter(Boolean) as string[];
        const orderedStops = selectedRouteType === 'Afternoon' ? [...rawStopNames].reverse() : rawStopNames;
        
        // 너무 길면 목적지 앞 7자리까지만 표시해서 한 줄 유지
        const formattedStops = orderedStops.map(name => {
            const trimmed = name.trim();
            return trimmed.length > 7 ? trimmed.slice(0, 7) : trimmed;
        });

        return {
            currentRouteStops: formattedStops.join(' -> '),
            fullRouteStops: orderedStops.join(' -> ')
        };
    }, [showRouteStops, selectedBusId, routes, selectedDay, selectedRouteType, destinations, t]);
    
    return (
        <Card className="mb-0">
            <CardContent className="p-2 sm:p-4">
                {/* 🌟 모바일 전용: 한 줄 3단 드롭다운 (기능 선택 | 버스 선택 | 요일 선택) */}
                <div className="flex flex-col gap-2 sm:hidden">
                    <div className="grid grid-cols-3 gap-1.5 w-full">
                        {/* 1. 기능 선택 */}
                        <div className="min-w-0">
                            <Select value={activeTab || 'student-management'} onValueChange={(val) => onTabChange?.(val)}>
                                <SelectTrigger className="w-full h-8 px-1.5 text-[11px] font-semibold bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="기능 선택" />
                                </SelectTrigger>
                                <SelectContent position="popper" side="bottom" sideOffset={4}>
                                    <SelectItem value="bus-registration">버스 등록</SelectItem>
                                    <SelectItem value="teacher-management">교사 관리</SelectItem>
                                    <SelectItem value="bus-configuration">버스 설정</SelectItem>
                                    <SelectItem value="student-management">학생 관리</SelectItem>
                                    <SelectItem value="after-school-management">방과후 조회</SelectItem>
                                    <SelectItem value="fare-management">요금 관리</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 2. 버스 선택 */}
                        <div className="min-w-0">
                            <Select value={selectedBusId || 'all'} onValueChange={setSelectedBusId}>
                                <SelectTrigger className="w-full h-8 px-1.5 text-[11px] font-semibold bg-slate-50 border-slate-200">
                                    <SelectValue placeholder={t('select_bus')} />
                                </SelectTrigger>
                                <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-[40vh] overflow-y-auto">
                                    <SelectItem value="all">전체 (All)</SelectItem>
                                    {filteredBuses.map((bus) => (
                                        <SelectItem key={bus.id} value={bus.id}>
                                            {bus.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 3. 요일 선택 */}
                        <div className="min-w-0">
                            <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
                                <SelectTrigger className="w-full h-8 px-1.5 text-[11px] font-semibold bg-slate-50 border-slate-200">
                                    <SelectValue placeholder={t('select_day')} />
                                </SelectTrigger>
                                <SelectContent position="popper" side="bottom" sideOffset={4}>
                                    {days.map((day) => (
                                        <SelectItem key={day} value={day}>
                                            {t(`day.${day.toLowerCase()}`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* 모바일 2번째 줄: 경로 탭 (등교 / 하교 / 방과후) */}
                    <div className="w-full">
                        <Tabs value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)} className="w-full">
                            <TabsList className={cn("grid w-full h-8 p-0.5", (selectedDay === 'Saturday' || semesterMode === 'vacation') ? "grid-cols-2" : "grid-cols-3")}>
                                <TabsTrigger value="Morning" className="text-xs px-1 py-1">{t('route_type.morning')}</TabsTrigger>
                                <TabsTrigger value="Afternoon" className="text-xs px-1 py-1">{t('route_type.afternoon')}</TabsTrigger>
                                {(selectedDay !== 'Saturday' && semesterMode !== 'vacation') && <TabsTrigger value="AfterSchool" className="text-xs px-1 py-1">{t('route_type.after_school')}</TabsTrigger>}
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* 모바일 3번째 줄: 학생 관리 탭이 아닐 때만 rightContent 표출 (학생 관리 탭은 student-management-tab에서 1줄 통합 바 제공) */}
                    {rightContent && activeTab !== 'student-management' && (
                        <div className="w-full">
                            {rightContent}
                        </div>
                    )}
                </div>

                {/* 🌟 데스크톱 전용 레이아웃: 경로탭 옆으로 노선도 한 줄 배치 */}
                <div className="hidden sm:flex sm:flex-row sm:items-end gap-2.5 w-full min-w-0">
                    <div className="w-[110px] lg:w-[125px] shrink-0">
                        <Label className="text-xs font-semibold text-slate-700">{t('bus')}</Label>
                        <Select value={selectedBusId || 'all'} onValueChange={setSelectedBusId}>
                            <SelectTrigger className="w-full h-10 text-sm">
                                <SelectValue placeholder={t('select_bus')} />
                            </SelectTrigger>
                            <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-[40vh] overflow-y-auto">
                                <SelectItem value="all">전체 (All)</SelectItem>
                                {filteredBuses.map((bus) => (
                                    <SelectItem key={bus.id} value={bus.id}>
                                        {bus.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-[105px] lg:w-[115px] shrink-0">
                        <Label className="text-xs font-semibold text-slate-700">{t('day')}</Label>
                        <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
                            <SelectTrigger className="w-full h-10 text-sm">
                                <SelectValue placeholder={t('select_day')} />
                            </SelectTrigger>
                            <SelectContent position="popper" side="bottom" sideOffset={4}>
                                {days.map((day) => (
                                    <SelectItem key={day} value={day}>
                                        {t(`day.${day.toLowerCase()}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-[190px] lg:w-[210px] shrink-0">
                        <Label className="text-xs font-semibold text-slate-700">{t('route')}</Label>
                        <Tabs value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)} className="w-full">
                            <TabsList className={cn("grid w-full h-10 p-0.5", (selectedDay === 'Saturday' || semesterMode === 'vacation') ? "grid-cols-2" : "grid-cols-3")}>
                                <TabsTrigger value="Morning" className="text-xs px-1">{t('route_type.morning')}</TabsTrigger>
                                <TabsTrigger value="Afternoon" className="text-xs px-1">{t('route_type.afternoon')}</TabsTrigger>
                                {(selectedDay !== 'Saturday' && semesterMode !== 'vacation') && <TabsTrigger value="AfterSchool" className="text-xs px-1">{t('route_type.after_school')}</TabsTrigger>}
                            </TabsList>
                        </Tabs>
                    </div>
                    {showRouteStops && currentRouteStops && (
                        <div className="flex-1 min-w-0">
                            <Label className="text-xs font-semibold text-slate-700">노선도</Label>
                            <div 
                                className="text-xs sm:text-sm h-10 px-2.5 flex items-center bg-muted/80 rounded-md border border-slate-200/60 truncate font-medium text-slate-800 cursor-default"
                                title={fullRouteStops || undefined}
                            >
                                <span className="truncate">{currentRouteStops}</span>
                            </div>
                        </div>
                    )}
                    {rightContent && (
                        <div className="shrink-0 flex items-end ml-auto">
                            {rightContent}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

