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

    const currentRouteStops = useMemo(() => {
        if (!showRouteStops || !selectedBusId || selectedBusId === 'all') return null;
        const route = routes.find(r => r.busId === selectedBusId && r.dayOfWeek === selectedDay && r.type === selectedRouteType);
        if (!route || !route.stops || route.stops.length === 0) return t('no_route_info');

        const stopNames = route.stops.map(stopId => destinations.find(d => d.id === stopId)?.name).filter(Boolean) as string[];
        
        if (selectedRouteType === 'Afternoon') {
            return [...stopNames].reverse().join(' -> ');
        }
        
        return stopNames.join(' -> ');
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

                    {/* 모바일 3번째 줄: 검색창 및 학생명단 관리 버튼 */}
                    {rightContent && (
                        <div className="w-full">
                            {rightContent}
                        </div>
                    )}
                </div>

                {/* 🌟 데스크톱 전용 레이아웃: 기존 데스크톱 UI 100% 온전히 보존 */}
                <div className="hidden sm:flex sm:flex-row sm:flex-wrap sm:items-end gap-3">
                    <div className="w-auto">
                        <Label className="text-xs font-semibold text-slate-700">{t('bus')}</Label>
                        <Select value={selectedBusId || 'all'} onValueChange={setSelectedBusId}>
                            <SelectTrigger className="w-[180px] h-10 text-sm">
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
                    <div className="w-auto">
                        <Label className="text-xs font-semibold text-slate-700">{t('day')}</Label>
                        <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
                            <SelectTrigger className="w-[120px] h-10 text-sm">
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
                    <div className="w-auto">
                        <Label className="text-xs font-semibold text-slate-700">{t('route')}</Label>
                        <Tabs value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)} className="w-[300px]">
                            <TabsList className={cn("grid w-full h-10 p-0.5", (selectedDay === 'Saturday' || semesterMode === 'vacation') ? "grid-cols-2" : "grid-cols-3")}>
                                <TabsTrigger value="Morning" className="text-xs px-1">{t('route_type.morning')}</TabsTrigger>
                                <TabsTrigger value="Afternoon" className="text-xs px-1">{t('route_type.afternoon')}</TabsTrigger>
                                {(selectedDay !== 'Saturday' && semesterMode !== 'vacation') && <TabsTrigger value="AfterSchool" className="text-xs px-1">{t('route_type.after_school')}</TabsTrigger>}
                            </TabsList>
                        </Tabs>
                    </div>
                    {showRouteStops && currentRouteStops && (
                        <div className="flex-1 min-w-fit">
                            <Label className="text-xs font-semibold text-slate-700">{t('route')}</Label>
                            <p className="text-sm p-2 bg-muted rounded-md truncate">{currentRouteStops}</p>
                        </div>
                    )}
                    {rightContent && (
                        <div className="ml-auto flex items-end w-auto">
                            {rightContent}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

