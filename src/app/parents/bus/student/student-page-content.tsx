'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  onBusesUpdate, 
  onStudentsUpdate, 
  onRoutesUpdate, 
  onDestinationsUpdate, 
  onLostItemsUpdate, 
  onAttendanceUpdate, 
  onGlobalSettingsUpdate 
} from '@/lib/kisbus';
import type { Bus, Student, Route, DayOfWeek, RouteType, Destination, LostItem, AttendanceRecord } from '@/lib/kisbus/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MainLayout } from '@/components/layout/main-layout';
import { format, getDay, isSunday } from 'date-fns';
import { LostAndFound } from '@/components/bus/lost-and-found';
import { useTranslation } from '@/hooks/use-translation';
import { Search, MapPin, Bell, BellOff, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, getStudentName, normalizeString } from '@/lib/kisbus/utils';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'next/navigation';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getGradeValue = (grade: string): number => {
  const upperGrade = (grade || '').trim().toUpperCase();
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

const sortBuses = (buses: Bus[]): Bus[] => {
  return [...buses].sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, ''), 10);
    const numB = parseInt(b.name.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.name.localeCompare(b.name, 'ko');
  });
};

export function StudentPageContent() {
  const { t, i18n } = useTranslation();
  const searchParams = useSearchParams();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [semesterMode, setSemesterMode] = useState<'regular' | 'vacation'>('regular');
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [assignedRoutes, setAssignedRoutes] = useState<Route[]>([]);
  const [viewingDay, setViewingDay] = useState<DayOfWeek | null>(null);
  const [viewingRouteType, setViewingRouteType] = useState<RouteType | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');

  const days: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);
  
  // 방학 중에는 AfterSchool 노선 없음(Afternoon이 하교 노선), 학기 중에는 3가지 모두
  const routeTypeOrder: RouteType[] = useMemo(() => {
    if (semesterMode === 'vacation') return ['Morning', 'Afternoon'];
    return ['Morning', 'Afternoon', 'AfterSchool'];
  }, [semesterMode]);
  
  useEffect(() => {
    setIsClient(true);
    const unsubscribers = [
      onBusesUpdate(data => setBuses(sortBuses(data))),
      onStudentsUpdate(setAllStudents),
      onRoutesUpdate(setAllRoutes),
      onDestinationsUpdate(setDestinations),
      onLostItemsUpdate(setLostItems),
    ];
    // 전역 설정(학기 중/방학 중 모드) 실시간 구독
    const unsubSettings = onGlobalSettingsUpdate((data) => {
      if (data?.semesterMode) {
        setSemesterMode(data.semesterMode);
      }
    });
    setLoading(false);

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      unsubSettings();
    };
  }, []);

  useEffect(() => {
    if (isClient && allStudents.length > 0) {
      const queryName = searchParams.get('name');
      if (queryName) {
        const student = allStudents.find(s => 
          normalizeString(s.nameKo) === normalizeString(queryName) ||
          normalizeString(s.nameEn) === normalizeString(queryName) ||
          normalizeString(s.name) === normalizeString(queryName)
        );
        if (student) {
          setSelectedStudent(student);
          localStorage.setItem('lastCheckedStudentId', student.id);
          return;
        }
      }

      if (!selectedStudent) {
        const savedStudentId = localStorage.getItem('lastCheckedStudentId');
        if (savedStudentId) {
            const student = allStudents.find(s => s.id === savedStudentId);
            if (student) {
                setSelectedStudent(student);
            }
        }
      }
    }
  }, [isClient, allStudents, selectedStudent, searchParams]);

  const formatStudentName = (student: Student | null) => {
    if (!student) return '';
    return `${student.grade.toUpperCase()}${student.class} ${getStudentName(student, i18n.language)}`;
  };

  useEffect(() => {
    if (selectedStudent && allRoutes.length > 0) {
        // 현재 semesterMode에 맞는 노선만 필터링
        const currentMode = semesterMode || 'regular';
        const studentRoutes = allRoutes.filter(route => {
            const routeMode = route.semesterMode || 'regular';
            return routeMode === currentMode &&
                route.seating.some(seat => seat.studentId === selectedStudent.id);
        });
        setAssignedRoutes(studentRoutes);

        const now = new Date();
        const vTime = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60000);
        const h = vTime.getHours(), d = vTime.getDay();
        let tDate = new Date(vTime);
        let tType: RouteType = 'Morning';

        if (d >= 1 && d <= 5) {
            if (h < 9) {
                tType = 'Morning';
            } else if (h < 16) {
                tType = 'Afternoon';
            } else if (h < 19) {
                tType = currentMode === 'vacation' ? 'Afternoon' : 'AfterSchool';
            } else {
                tDate.setDate(tDate.getDate() + 1);
                tType = 'Morning';
            }
        } else if (d === 6) {
            if (h < 9) {
                tType = 'Morning';
            } else if (h < 14) {
                tType = 'Afternoon';
            } else {
                tDate.setDate(tDate.getDate() + 2);
                tType = 'Morning';
            }
        } else {
            tDate.setDate(tDate.getDate() + 1);
            tType = 'Morning';
        }

        const dayIdx = tDate.getDay(); // 0=Sunday
        const calculatedDay = dayIdx === 0 ? 'Monday' : DAYS[dayIdx - 1];
        setViewingDay(calculatedDay);
        setViewingRouteType(tType);
        setSelectedDate(format(tDate, 'yyyy-MM-dd'));
    } else {
        setAssignedRoutes([]);
        setViewingDay(null);
        setViewingRouteType(null);
        setSelectedDate('');
    }
  }, [selectedStudent, allRoutes, semesterMode]);

  // 현재 semesterMode에 맞는 버스만 필터링 (방학 중 운행 안 하는 버스 제외)
  const activeBuses = useMemo(() => {
    const currentMode = semesterMode || 'regular';
    return buses.filter(b => {
      const busMode = b.semesterMode || 'regular';
      return busMode === currentMode;
    });
  }, [buses, semesterMode]);

  const studentRoute = useMemo(() => {
    if (!selectedStudent || !viewingDay || !viewingRouteType) return null;
    return assignedRoutes.find(r => 
        r.dayOfWeek === viewingDay && 
        r.type === viewingRouteType
    ) || null;
  }, [assignedRoutes, viewingDay, viewingRouteType, selectedStudent]);

  const boardedStudentIds = useMemo(() => attendance?.boarded || [], [attendance]);
  const notBoardingStudentIds = useMemo(() => attendance?.notBoarding || [], [attendance]);

  const selectedBus = useMemo(() => {
      if (!studentRoute) return null;
      return activeBuses.find(b => b.id === studentRoute.busId);
  }, [activeBuses, studentRoute]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (studentRoute && selectedDate) {
      unsubscribe = onAttendanceUpdate(studentRoute.id, selectedDate, setAttendance);
    } else {
      setAttendance(null);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [studentRoute, selectedDate]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = normalizeString(searchQuery);
    const scored = allStudents.map(student => {
      const grade = (student.grade || '').toLowerCase();
      const cls = (student.class || '').toLowerCase();
      const gradeClass = normalizeString(grade + cls);
      const contact = student.contact?.replace(/\D/g, '') || '';
      
      let score = 0;
      if (gradeClass === q) score += 2000;
      else if (gradeClass.startsWith(q)) score += 1500;
      
      const displayName = normalizeString(getStudentName(student, i18n.language));
      if (displayName.startsWith(q)) score += 500;
      else if (displayName.includes(q)) score += 300;
      else if (student.nameKo && normalizeString(student.nameKo).includes(q)) score += 200;
      else if (student.nameEn && normalizeString(student.nameEn).toLowerCase().includes(q)) score += 200;
      
      if (contact.startsWith(q)) score += 100;
      else if (contact.includes(q)) score += 50;
      
      return { student, score };
    });

    const results = scored
      .filter(item => item.score > 0)
      .sort((a, b) => {
        const ga = getGradeValue(a.student.grade), gb = getGradeValue(b.student.grade);
        if (ga !== gb) return ga - gb;
        const ca = a.student.class.localeCompare(b.student.class, undefined, { numeric: true });
        if (ca !== 0) return ca;
        return getStudentName(a.student, i18n.language).localeCompare(getStudentName(b.student, i18n.language), 'ko');
      })
      .map(item => item.student);

    setSearchResults(results.slice(0, 10));
  }, [searchQuery, allStudents, i18n.language]);

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    localStorage.setItem('lastCheckedStudentId', student.id);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleClearSelectedStudent = () => {
    setSelectedStudent(null);
    localStorage.removeItem('lastCheckedStudentId');
  };

  const currentBusStatus = useMemo(() => {
    if (!selectedBus) return 'ready';
    return selectedBus.status || 'ready';
  }, [selectedBus]);

  const statusAlert = useMemo(() => {
    if (!selectedStudent || !studentRoute) return null;
    const isBoarded = attendance?.boarded?.includes(selectedStudent.id);
    const isNotBoarding = attendance?.notBoarding?.includes(selectedStudent.id);
    const isDisembarked = attendance?.disembarked?.includes(selectedStudent.id);

    if (isNotBoarding) {
      return (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <BellOff className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800 font-bold">{t('student_page.status.not_boarding_today.title')}</AlertTitle>
          <AlertDescription className="text-red-700 text-xs mt-1">
            {t('student_page.status.not_boarding_today.description')}
          </AlertDescription>
        </Alert>
      );
    }

    if (isDisembarked) {
      return (
        <Alert className="bg-emerald-50 border-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800 font-bold">{t('student_page.status.disembarked.title')}</AlertTitle>
          <AlertDescription className="text-emerald-700 text-xs mt-1">
            {t('student_page.status.disembarked.description')}
          </AlertDescription>
        </Alert>
      );
    }

    if (isBoarded) {
      return (
        <Alert className="bg-blue-50 border-blue-200">
          <Bell className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800 font-bold">{t('student_page.status.boarded.title')}</AlertTitle>
          <AlertDescription className="text-blue-700 text-xs mt-1">
            {t('student_page.status.boarded.description')}
          </AlertDescription>
        </Alert>
      );
    }

    if (currentBusStatus === 'departed') {
      return (
        <Alert variant="destructive" className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 font-bold">{t('student_page.status.missed.title')}</AlertTitle>
          <AlertDescription className="text-amber-700 text-xs mt-1">
            {t('student_page.status.missed.description')}
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Alert className="bg-slate-50 border-slate-200">
        <Clock className="h-4 w-4 text-slate-500" />
        <AlertTitle className="text-slate-800 font-bold">{t('student_page.status.waiting.title')}</AlertTitle>
        <AlertDescription className="text-slate-600 text-xs mt-1">
          {t('student_page.status.waiting.description')}
        </AlertDescription>
      </Alert>
    );
  }, [selectedStudent, studentRoute, attendance, currentBusStatus, t]);

  const headerContent = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
        <div className="flex-1 max-w-md relative">
            <Label htmlFor="parent-student-search" className="sr-only">검색</Label>
            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    id="parent-student-search"
                    placeholder={t('student_page.search_placeholder')}
                    className="pl-9 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            {searchResults.length > 0 && (
                <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto shadow-lg">
                    <CardContent className="p-1">
                        {searchResults.map(student => (
                            <div
                                key={student.id}
                                className="p-2 text-sm hover:bg-accent rounded cursor-pointer"
                                onClick={() => handleSelectStudent(student)}
                            >
                                {formatStudentName(student)}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
        <Badge
            variant={semesterMode === 'vacation' ? 'destructive' : 'secondary'}
            className="h-7 px-3 text-sm whitespace-nowrap self-end"
        >
            {semesterMode === 'vacation' ? '방학 중 (방과후)' : '학기 중'}
        </Badge>
    </div>
  );

  return (
    <MainLayout headerContent={headerContent}>
      <div className="w-full max-w-6xl mx-auto">
        {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Skeleton className="w-16 h-16 rounded-full" />
                <Skeleton className="w-48 h-4 rounded" />
            </div>
        ) : !selectedStudent ? (
            <Card className="border-dashed border-2 py-20 text-center font-sans">
                <CardContent className="space-y-4">
                    <Search className="w-12 h-12 mx-auto text-muted-foreground opacity-40" />
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">{t('student_page.empty.title')}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{t('student_page.empty.description')}</p>
                    </div>
                </CardContent>
            </Card>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between py-4">
                            <div>
                                <CardTitle className="text-xl font-bold">{formatStudentName(selectedStudent)}</CardTitle>
                                <CardDescription className="mt-1">{t('student_page.student_info_desc')}</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleClearSelectedStudent} className="text-muted-foreground text-xs">
                                {t('student_page.change_student')}
                            </Button>
                        </CardHeader>
                        <CardContent className="border-t pt-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">{t('student.grade_class')}: </span>
                                    <span className="font-semibold text-slate-800">{selectedStudent.grade}학년 {selectedStudent.class}반</span>
                                </div>
                                {selectedStudent.number && (
                                    <div>
                                        <span className="text-muted-foreground">{t('student.number')}: </span>
                                        <span className="font-semibold text-slate-800">{selectedStudent.number}번</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {statusAlert && <div className="animate-in fade-in duration-300">{statusAlert}</div>}

                    {studentRoute && selectedBus ? (
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle>{t('student_page.route_map.title')}</CardTitle>
                                        <CardDescription className="mt-1">
                                            {t(`day.${viewingDay?.toLowerCase() || ''}`)} | {viewingRouteType === 'AfterSchool' ? t('route_type.after_school') : t(`route_type.${viewingRouteType?.toLowerCase() || ''}`)}
                                        </CardDescription>
                                    </div>
                                    <Badge variant={currentBusStatus === 'completed' ? 'secondary' : (currentBusStatus === 'departed' ? 'default' : 'outline')} className="h-6">
                                        {t(`teacher_page.bus_status_${currentBusStatus}`)}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="border-t pt-4">
                                {/* 노선 목적지 도착 트래킹 리스트 */}
                                {studentRoute.stops && studentRoute.stops.length > 0 && (
                                    <div className="mb-6 bg-slate-50 border rounded-lg p-4 font-sans">
                                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                                            <MapPin className="w-4 h-4 text-primary" />
                                            <span>실시간 버스 노선 경로</span>
                                        </h3>
                                        <div className="relative pl-6 space-y-4 border-l border-slate-300">
                                            {studentRoute.stops.map((stopId) => {
                                                const dest = destinations.find(d => d.id === stopId);
                                                if (!dest) return null;
                                                const isCompleted = attendance?.completedDestinations?.includes(stopId);
                                                return (
                                                    <div key={stopId} className="relative flex items-center justify-between gap-2">
                                                        <div className={cn(
                                                            "absolute -left-[31px] w-4.5 h-4.5 rounded-full border-2 bg-white flex items-center justify-center transition-all",
                                                            isCompleted ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-slate-400"
                                                        )}>
                                                            {isCompleted ? (
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                            ) : (
                                                                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                                                            )}
                                                        </div>
                                                        <span className={cn(
                                                            "text-xs font-semibold",
                                                            isCompleted ? "text-emerald-700 font-bold" : "text-slate-600"
                                                        )}>
                                                            {dest.name}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground bg-white px-2 py-0.5 rounded border">
                                                            {isCompleted ? "도착 완료" : "운행 중"}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <BusSeatMap 
                                    bus={selectedBus} 
                                    seating={studentRoute.seating} 
                                    students={[selectedStudent]} 
                                    destinations={destinations} 
                                    onSeatClick={() => {}} 
                                    onSeatContextMenu={() => {}}
                                    highlightedSeatNumber={studentRoute.seating.find(s => s.studentId === selectedStudent.id)?.seatNumber || null}
                                    boardedStudentIds={boardedStudentIds}
                                    notBoardingStudentIds={notBoardingStudentIds}
                                    routeType={viewingRouteType ?? undefined}
                                    dayOfWeek={viewingDay || 'Monday'}
                                />
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="py-12 text-center text-muted-foreground text-sm">
                            {t('student_page.no_bus_assigned')}
                        </Card>
                    )}
                </div>

                <div className="space-y-6">
                    {selectedStudent && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold">{t('student_page.assigned_routes')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {days.map(day => {
                                    const dayRoutes = assignedRoutes.filter(r => r.dayOfWeek === day);
                                    if (dayRoutes.length === 0) return null;
                                    
                                    return (
                                        <div key={day} className="border-b last:border-0 pb-2 last:pb-0 space-y-1">
                                            <div className="text-xs font-bold text-slate-500">{t(`day.${day.toLowerCase()}`)}</div>
                                            <div className="flex flex-col gap-1">
                                                {routeTypeOrder.map(type => {
                                                    const route = dayRoutes.find(r => r.type === type);
                                                    if (!route) return null;
                                                    const bus = buses.find(b => b.id === route.busId);
                                                    const seat = route.seating.find(s => s.studentId === selectedStudent.id);
                                                    
                                                    return (
                                                        <div 
                                                            key={type} 
                                                            onClick={() => {
                                                                setViewingDay(day);
                                                                setViewingRouteType(type);
                                                            }}
                                                            className={cn(
                                                                "flex justify-between items-center p-2 rounded-md text-xs cursor-pointer hover:bg-accent/60",
                                                                (viewingDay === day && viewingRouteType === type) 
                                                                    ? "bg-primary/10 border-primary/20 border" 
                                                                    : "bg-slate-50"
                                                            )}
                                                        >
                                                            <span className="font-medium">
                                                                {type === 'AfterSchool' ? t('route_type.after_school') : t(`route_type.${type.toLowerCase()}`)}
                                                            </span>
                                                            <span className="text-muted-foreground">
                                                                {bus ? bus.name : ''} {seat ? `(${seat.seatNumber}${t('seat_suffix')})` : ''}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                                {assignedRoutes.length === 0 && (
                                    <div className="text-xs text-muted-foreground text-center py-4">{t('student_page.no_bus_assigned')}</div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                    <LostAndFound lostItems={lostItems} setLostItems={setLostItems} buses={buses} isReadOnly={true} />
                </div>
            </div>
        )}
      </div>
    </MainLayout>
  );
}
