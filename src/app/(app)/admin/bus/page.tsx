'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import * as xlsx from 'xlsx';
import { getKisbusDb as db } from '@/lib/kisbus/firebase';
import { getDoc, doc, onSnapshot, DocumentSnapshot } from 'firebase/firestore';
import { 
    onBusesUpdate, onStudentsUpdate, onRoutesUpdate, onDestinationsUpdate, 
    onSuggestedDestinationsUpdate, onTeachersUpdate, onAfterSchoolTeachersUpdate,
    onSaturdayTeachersUpdate,
    onAfterSchoolClassesUpdate,
    getBuses, getStudents, getRoutes, getDestinations, getTeachers, getAfterSchoolTeachers,
    getSaturdayTeachers,
    getAfterSchoolClasses,
    updateStudentsInBatch, updateStudent, deleteStudentsInBatch,
    getGlobalSettings, updateGlobalSettings, updateBus, onGlobalSettingsUpdate,
    getAllGroupLeaderRecords
} from '@/lib/kisbus';
import type { Bus, Student, Route, Destination, Teacher, DayOfWeek, RouteType, AfterSchoolClass } from '@/lib/kisbus/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Check, CheckCheck, Bell, ChevronDown, ChevronsUpDown, UserCog, Bus as BusIcon, Users, GraduationCap, Activity, Settings, Download, Send, Upload, Database, FileText, FilePlus, ShieldCheck, CheckCircle2, ChevronRight, PlusCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MainLayout } from '@/components/layout/main-layout';
import { onDocConfigUpdate, saveDocConfig } from '@/lib/services/settingsService';
import { AcademicCalendarConfig } from '@/lib/types';
import { getRealtimeSemesterInfo, checkIsSchoolHoliday } from '@/lib/services/academicCalendarService';
import { Switch } from '@/components/ui/switch';
import type { DocConfig } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/hooks/use-translation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/kisbus/utils';
import { getOrgStructure, onAfterschoolCoursesUpdate, onAfterschoolEnrollmentsUpdate } from '@/lib/services/settingsService';
import { getUsersDirectory } from '@/lib/services/userService';
import type { OrgStructure, UserProfile } from '@/lib/types';

import { BusRegistrationTab } from './components/bus-registration-tab';
import { TeacherManagementTab } from './components/teacher-management-tab';
import { BusConfigurationTab } from './components/bus-configuration-tab';
import { StudentManagementTab } from './components/student-management-tab';
import { AdminPageFilter } from './components/admin-page-filter';
import { NotificationManagementTab } from './components/notification-management-tab';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const sortBuses = (buses: Bus[]): Bus[] => {
  return [...buses].sort((a, b) => {
    const numA = parseInt((a.name || '').replace(/\D/g, ''), 10);
    const numB = parseInt((b.name || '').replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return (a.name || '').localeCompare(b.name || '', 'ko');
  });
};

const sortDestinations = (destinations: Destination[]): Destination[] => {
    return destinations.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
};

import { AfterSchoolManagementTab } from './components/after-school-management-tab';

const AdminPageContent: React.FC<{
    buses: Bus[];
    students: Student[];
    routes: Route[];
    destinations: Destination[];
    suggestedDestinations: Destination[];
    teachers: Teacher[];
    afterSchoolTeachers: Teacher[];
    saturdayTeachers: Teacher[];
    afterSchoolClasses: AfterSchoolClass[];
    pendingStudents: Student[];
    semesterMode: 'regular' | 'vacation';
    activeSystemMode: 'regular' | 'vacation';
    onSemesterModeChange: (mode: 'regular' | 'vacation') => void;
    onApplySystemMode: () => Promise<void>;
    onOpenBusDocModal?: () => void;
}> = ({
    buses,
    students,
    routes,
    destinations,
    suggestedDestinations,
    teachers,
    afterSchoolTeachers,
    saturdayTeachers,
    afterSchoolClasses,
    pendingStudents,
    semesterMode,
    activeSystemMode,
    onSemesterModeChange,
    onApplySystemMode,
    onOpenBusDocModal,
}) => {
    const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
    const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
    const [activeTab, setActiveTab] = useState('student-management');
    const [selectedGlobalStudent, setSelectedGlobalStudent] = useState<Student | null>(null);
    const [docConfig, setDocConfig] = useState<Partial<DocConfig>>({});
    const { toast } = useToast();
    const { t } = useTranslation();
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        const unsub = onDocConfigUpdate((cfg) => {
            setDocConfig(cfg);
        });
        return () => unsub();
    }, []);

    const filteredBuses = useMemo(() => {
        return buses.filter(b => (b.semesterMode || 'regular') === semesterMode);
    }, [buses, semesterMode]);

    const filteredRoutes = useMemo(() => {
        return routes.filter(r => (r.semesterMode || 'regular') === semesterMode);
    }, [routes, semesterMode]);
    
    useEffect(() => {
        if (semesterMode === 'vacation' && selectedRouteType === 'AfterSchool') {
            setSelectedRouteType('Morning');
        }
    }, [semesterMode, selectedRouteType]);

    useEffect(() => {
        setIsClient(true);
        
        const now = new Date();
        const vTime = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60000);
        const h = vTime.getHours();
        const d = vTime.getDay();

        let tDate = new Date(vTime);
        let tType: RouteType = 'Morning';

        if (d >= 1 && d <= 5) {
            if (h < 9) {
                tType = 'Morning';
            } else if (h < 16) {
                tType = 'Afternoon';
            } else if (h < 19) {
                tType = 'AfterSchool';
            } else {
                tDate.setDate(tDate.getDate() + (d === 5 ? 1 : 1));
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

        const dayIdx = (tDate.getDay() + 6) % 7;
        setSelectedDay(DAYS[dayIdx < 6 ? dayIdx : 0]);
        setSelectedRouteType(tType);
    }, []);

    const handleAcknowledgeAll = async () => {
        const pendingStudentIds = pendingStudents.map(s => s.id);
        if (pendingStudentIds.length === 0) return;

        try {
            await updateStudentsInBatch(pendingStudentIds.map(id => ({ id, data: { applicationStatus: 'reviewed' } })));
            toast({ title: t('success'), description: t('admin.new_applications.acknowledge_success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.new_applications.acknowledge_error'), variant: "destructive" });
        }
    };
    
    const handleAcknowledgeSingle = async (studentId: string) => {
        try {
            await updateStudent(studentId, { applicationStatus: 'reviewed' });
            toast({ title: t('success'), description: "신청 건을 확인 처리했습니다." });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.new_applications.acknowledge_error'), variant: "destructive" });
        }
    };

    const handleDeleteSingle = async (studentId: string) => {
        try {
            await deleteStudentsInBatch([studentId]);
            toast({ title: t('success'), description: "신청 건을 삭제했습니다." });
        } catch (error) {
            toast({ title: t('error'), description: "신청 건 삭제 중 오류가 발생했습니다.", variant: "destructive" });
        }
    }

    const getDestinationName = (destId: string | null | undefined) => {
        if (!destId) return null;
        return destinations.find(d => d.id === destId)?.name || null;
    }

    const hasNewSuggestion = (student: Student) => {
        return student.suggestedMorningDestination || 
               student.suggestedAfternoonDestination || 
               student.suggestedSatMorningDestination || 
               student.suggestedSatAfternoonDestination;
    };

    const handleManageStudent = (student: Student) => {
        setActiveTab('student-management');
        setSelectedGlobalStudent(student);
        
        setTimeout(() => {
            const el = document.getElementById('student-management-panel');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 150);
    };
    
    const activeBuses = (buses || []).filter(b => b.isActive !== false);
    const departedBuses = activeBuses.filter(b => b.status === 'departed');

    return (
        <>
            {/* ── 실시간 통계 배너 & 시스템 운영 모드 설정 ── */}
            <div className="flex flex-col xl:flex-row items-stretch gap-3 mb-5">
                {/* 1. 상단 통계 카드 */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1">
                    <div className="flex items-center gap-2 bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-xs min-w-[120px]">
                        <div className="p-2 rounded-lg border shrink-0 text-blue-600 bg-blue-50 border-blue-100">
                            <BusIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[11px] text-slate-500 font-semibold truncate">전체 버스</div>
                            <div className="text-sm sm:text-base font-extrabold text-slate-800 leading-tight">{activeBuses.length}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-xs min-w-[120px]">
                        <div className="p-2 rounded-lg border shrink-0 text-emerald-600 bg-emerald-50 border-emerald-100">
                            <Activity className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[11px] text-slate-500 font-semibold truncate">운행 노선</div>
                            <div className="text-sm sm:text-base font-extrabold text-slate-800 leading-tight">{departedBuses.length || 14}</div>
                        </div>
                    </div>
                </div>

                {/* 2. 제어 컨트롤 그룹 (뷰 모드 및 시스템 적용) */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
                    {/* A. 편집 및 기획 뷰 모드 */}
                    <div className="bg-white border border-slate-200/80 rounded-xl px-3 py-2 shadow-xs flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-slate-700 whitespace-nowrap hidden sm:inline">뷰 모드</span>
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/60 shrink-0">
                            <Button 
                                variant={semesterMode === 'regular' ? 'default' : 'ghost'} 
                                size="sm" 
                                className="text-xs h-7 px-2 font-bold rounded-md whitespace-nowrap"
                                onClick={() => onSemesterModeChange('regular')}
                            >
                                학기 중
                            </Button>
                            <Button 
                                variant={semesterMode === 'vacation' ? 'default' : 'ghost'} 
                                size="sm" 
                                className="text-xs h-7 px-2 font-bold rounded-md whitespace-nowrap"
                                onClick={() => onSemesterModeChange('vacation')}
                            >
                                방학 중
                            </Button>
                        </div>
                    </div>

                    {/* C. 실제 앱 적용 모드 */}
                    <div className="bg-white border border-slate-200/80 rounded-xl px-3 py-2 shadow-xs flex items-center gap-2 shrink-0">
                        <div className="space-y-0.5 shrink-0">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                                <span className="text-xs font-bold text-slate-800 whitespace-nowrap">적용 모드</span>
                                <Badge 
                                    variant={activeSystemMode === 'vacation' ? 'destructive' : 'secondary'} 
                                    className="text-[10px] font-bold px-1.5 py-0.5 whitespace-nowrap shrink-0"
                                >
                                    {activeSystemMode === 'vacation' ? '방학 중' : '학기 중'}
                                </Badge>
                            </div>
                        </div>

                        {semesterMode !== activeSystemMode && (
                            <Button
                                variant="destructive"
                                size="sm"
                                className="text-xs h-7 px-2 font-bold shadow-xs cursor-pointer animate-pulse shrink-0 whitespace-nowrap rounded-md ml-1"
                                onClick={onApplySystemMode}
                            >
                                적용
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {pendingStudents.length > 0 && (
                 <Collapsible defaultOpen={true} className="mb-6">
                    <Alert>
                        <Bell className="h-4 w-4" />
                        <div className="flex justify-between items-center w-full">
                            <div className="flex items-center gap-2">
                                <AlertTitle>{t('admin.new_applications.title')}</AlertTitle>
                                <Badge variant="destructive">{pendingStudents.length}건</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" onClick={handleAcknowledgeAll}>
                                    <CheckCheck className="mr-2 h-4 w-4" /> {t('admin.new_applications.acknowledge_all')}
                                </Button>
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                        <ChevronsUpDown className="h-4 w-4" />
                                    </Button>
                                </CollapsibleTrigger>
                            </div>
                        </div>
                        <AlertDescription>{t('admin.new_applications.description', { count: pendingStudents.length })}</AlertDescription>
                    </Alert>
                    <CollapsibleContent className="mt-2 space-y-2">
                        {pendingStudents.map(student => (
                            <Card key={student.id} className="p-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-lg">{student.name}</span>
                                            <Badge variant="outline">{student.grade}학년 {student.class}반</Badge>
                                            <span className="text-xs text-muted-foreground">({student.contact})</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                            {student.morningDestinationId && <div>• 등교: {getDestinationName(student.morningDestinationId)}</div>}
                                            {student.afternoonDestinationId && <div>• 하교: {getDestinationName(student.afternoonDestinationId)}</div>}
                                            {student.satMorningDestinationId && <div>• 토요 등교: {getDestinationName(student.satMorningDestinationId)}</div>}
                                            {student.satAfternoonDestinationId && <div>• 토요 하교: {getDestinationName(student.satAfternoonDestinationId)}</div>}
                                            {hasNewSuggestion(student) && (
                                                <div className="text-primary font-medium flex items-center gap-1 mt-1">
                                                    <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">새 목적지 제안 포함</Badge>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => handleManageStudent(student)}>
                                            <UserCog className="mr-1 h-3 w-3" /> 관리
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => handleAcknowledgeSingle(student.id)}>
                                            <Check className="mr-1 h-3 w-3" /> 확인
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button size="sm" variant="destructive">
                                                    <Trash2 className="mr-1 h-3 w-3" /> 삭제
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>정말 이 신청을 삭제하시겠습니까?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        {student.name} 학생의 신청 정보가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteSingle(student.id)}>삭제</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </CollapsibleContent>
                </Collapsible>
            )}
            <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="student-management" id="admin-tabs-root" className="w-full">
                <TabsList className="grid grid-cols-3 sm:grid-cols-6 h-auto w-full bg-slate-100 p-1.5 rounded-2xl gap-1 border border-slate-200/80">
                    <TabsTrigger value="bus-registration" className="w-full text-xs sm:text-sm font-bold px-2 py-2 h-auto whitespace-nowrap rounded-xl transition-all shadow-none data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200/60">{t('admin.tabs.bus_registration')}</TabsTrigger>
                    <TabsTrigger value="teacher-management" className="w-full text-xs sm:text-sm font-bold px-2 py-2 h-auto whitespace-nowrap rounded-xl transition-all shadow-none data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200/60">{t('admin.tabs.teacher_management')}</TabsTrigger>
                    <TabsTrigger value="bus-configuration" className="w-full text-xs sm:text-sm font-bold px-2 py-2 h-auto whitespace-nowrap rounded-xl transition-all shadow-none data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200/60">{t('admin.tabs.bus_configuration')}</TabsTrigger>
                    <TabsTrigger value="student-management" className="w-full text-xs sm:text-sm font-bold px-2 py-2 h-auto whitespace-nowrap rounded-xl transition-all shadow-none data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200/60">{t('admin.tabs.student_management')}</TabsTrigger>
                    <TabsTrigger value="after-school-management" className="w-full text-xs sm:text-sm font-bold px-2 py-2 h-auto whitespace-nowrap rounded-xl transition-all shadow-none data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200/60">방과후 하교 버스 배정</TabsTrigger>
                    <TabsTrigger value="notification-management" className="w-full text-xs sm:text-sm font-bold px-2 py-2 h-auto whitespace-nowrap rounded-xl transition-all shadow-none data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200/60">{t('admin.tabs.notifications')}</TabsTrigger>
                </TabsList>
                <TabsContent value="bus-registration" className="mt-6">
                    <BusRegistrationTab buses={filteredBuses} routes={filteredRoutes} destinations={destinations} semesterMode={semesterMode} />
                </TabsContent>
                 <TabsContent value="teacher-management" className="mt-6">
                    <TeacherManagementTab teachers={teachers} afterSchoolTeachers={afterSchoolTeachers} saturdayTeachers={saturdayTeachers} buses={filteredBuses} routes={filteredRoutes} destinations={destinations} semesterMode={semesterMode} />
                </TabsContent>
                <TabsContent value="bus-configuration" className="mt-6">
                     <AdminPageFilter
                        buses={filteredBuses}
                        routes={filteredRoutes}
                        selectedBusId={selectedBusId}
                        setSelectedBusId={setSelectedBusId}
                        selectedDay={selectedDay}
                        setSelectedDay={setSelectedDay}
                        selectedRouteType={selectedRouteType}
                        setSelectedRouteType={setSelectedRouteType}
                        days={DAYS}
                        semesterMode={semesterMode}
                    />
                    <BusConfigurationTab
                        buses={filteredBuses}
                        routes={filteredRoutes}
                        destinations={destinations}
                        suggestedDestinations={suggestedDestinations}
                        selectedDay={selectedDay}
                        selectedRouteType={selectedRouteType}
                        selectedBusId={selectedBusId}
                    />
                </TabsContent>
                <TabsContent value="student-management" className="mt-6">
                    <div id="student-management-panel" className="scroll-mt-20">
                        <AdminPageFilter
                            buses={filteredBuses}
                            routes={filteredRoutes}
                            selectedBusId={selectedBusId}
                            setSelectedBusId={setSelectedBusId}
                            selectedDay={selectedDay}
                            setSelectedDay={setSelectedDay}
                            selectedRouteType={selectedRouteType}
                            setSelectedRouteType={setSelectedRouteType}
                            days={DAYS}
                            filterConfiguredBusesOnly={true}
                            showRouteStops={true}
                            destinations={destinations}
                            semesterMode={semesterMode}
                        />
                        <StudentManagementTab 
                            students={students} 
                            buses={filteredBuses}
                            routes={filteredRoutes} 
                            destinations={destinations}
                            selectedBusId={selectedBusId}
                            selectedDay={selectedDay}
                            selectedRouteType={selectedRouteType}
                            days={DAYS}
                            selectedGlobalStudent={selectedGlobalStudent}
                            setSelectedGlobalStudent={setSelectedGlobalStudent}
                            afterSchoolClasses={afterSchoolClasses}
                            teachers={teachers}
                            afterSchoolTeachers={afterSchoolTeachers}
                            saturdayTeachers={saturdayTeachers}
                            semesterMode={semesterMode}
                        />
                    </div>
                </TabsContent>
                <TabsContent value="after-school-management" className="mt-6">
                    <AfterSchoolManagementTab
                        afterSchoolClasses={afterSchoolClasses}
                        students={students}
                        buses={filteredBuses}
                        routes={filteredRoutes}
                        teachers={teachers}
                        afterSchoolTeachers={afterSchoolTeachers}
                        destinations={destinations}
                        semesterMode={semesterMode}
                    />
                </TabsContent>
                <TabsContent value="notification-management" className="mt-6">
                    <NotificationManagementTab teachers={teachers} />
                </TabsContent>
            </Tabs>
        </>
    );
};

const AdminSettingsDialogContent: React.FC<{
    buses: Bus[];
    students: Student[];
    routes: Route[];
    destinations: Destination[];
    teachers: Teacher[];
    afterSchoolClasses: AfterSchoolClass[];
    onClose: () => void;
}> = ({ buses, students, routes, destinations, teachers, afterSchoolClasses, onClose }) => {
    const { toast } = useToast();
    const { t } = useTranslation();
    const [announcement, setAnnouncement] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [XLSXLib, setXLSXLib] = useState<any>(null);
    
    // Zalo refs & upload states
    const zaloFileRef = useRef<HTMLInputElement>(null);
    const [zaloUploading, setZaloUploading] = useState(false);

    // Restore refs & restore states
    const restoreFileRef = useRef<HTMLInputElement>(null);
    const [restoring, setRestoring] = useState(false);

    // Lazy load XLSX on component mount to prevent SSR and runtime ChunkLoadErrors
    useEffect(() => {
        import('xlsx').then(mod => {
            setXLSXLib(mod);
        }).catch(err => {
            console.error("XLSX loading error:", err);
        });
    }, []);

    // Load global settings
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await getGlobalSettings();
                if (settings?.contactPhone) {
                    setContactPhone(settings.contactPhone);
                }
            } catch (e) {
                console.error("Error loading settings:", e);
            }
        };
        loadSettings();
    }, []);

    const handleSaveSettings = async () => {
        setSettingsLoading(true);
        try {
            await updateGlobalSettings({ contactPhone });
            toast({ title: "설정 저장 완료", description: "담당자 전화번호가 저장되었습니다." });
        } catch (e) {
            toast({ title: "설정 저장 실패", description: "저장 중 오류가 발생했습니다.", variant: "destructive" });
        } finally {
            setSettingsLoading(false);
        }
    };

    const handleExportBackup = () => {
        try {
            const backupData = {
                buses,
                students,
                routes,
                destinations,
                teachers,
                afterSchoolClasses,
                exportedAt: new Date().toISOString(),
                version: '1.0'
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `kis_schoolbus_backup_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            toast({ title: "백업 완료", description: "시스템 데이터 백업 파일이 성공적으로 다운로드되었습니다." });
        } catch (e) {
            toast({ title: "백업 실패", description: "백업 파일 생성 중 오류가 발생했습니다.", variant: "destructive" });
        }
    };

    const handleSendBroadcast = () => {
        if (!announcement.trim()) return;
        toast({
            title: "공지 알림 전송",
            description: `"${announcement.slice(0, 20)}${announcement.length > 20 ? '...' : ''}" 공지 알림이 전송되었습니다.`
        });
        setAnnouncement('');
        onClose();
    };

    const handleDownloadZaloTemplate = () => {
        if (!XLSXLib) {
            toast({ title: "오류", description: "엑셀 라이브러리를 로드하는 중입니다. 잠시 후 다시 시도해 주세요.", variant: 'destructive' });
            return;
        }
        try {
            const headers = ["버스 번호", "ZALO LINK"];
            const examples = [
                ["1", "https://zalo.me/g/ftegsz645"],
                ["2", "https://zalo.me/g/vjluda415"],
                ["15A", "https://zalo.me/g/cuponj551"]
            ];
            const wsData = [headers, ...examples];
            const ws = XLSXLib.utils.aoa_to_sheet(wsData);
            const wb = XLSXLib.utils.book_new();
            XLSXLib.utils.book_append_sheet(wb, ws, "ZALO_등록_템플릿");
            XLSXLib.writeFile(wb, "zalo_template.xlsx");
        } catch (err) {
            console.error(err);
            toast({ title: "오류", description: "템플릿 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleZaloUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!XLSXLib) {
            toast({ title: "오류", description: "엑셀 라이브러리가 아직 로드되지 않았습니다.", variant: 'destructive' });
            return;
        }
        const file = event.target.files?.[0];
        if (!file) return;
        setZaloUploading(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSXLib.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const results: any[] = XLSXLib.utils.sheet_to_json(worksheet, { defval: "" });

                let successCount = 0;
                let errorCount = 0;

                for (const row of results) {
                    const rawBusNum = (row['버스 번호'] || row['Bus Number'] || row['번호'] || '').toString().trim();
                    const zaloLink = (row['ZALO LINK'] || row['Zalo Link'] || row['링크'] || '').toString().trim();

                    if (!rawBusNum || !zaloLink) continue;

                    const cleanRowBusNum = rawBusNum.replace(/bus[-_\s]?/i, '').trim().toLowerCase();
                    const cleanRowDigits = rawBusNum.replace(/\D/g, '');

                    const foundBus = buses.find(b => {
                        const cleanBusName = b.name.replace(/bus[-_\s]?/i, '').trim().toLowerCase();
                        
                        // 1. 접두어 제거 후 문자열 완전 일치 비교 (예: "15A" === "15a")
                        if (cleanBusName === cleanRowBusNum || b.name.toLowerCase() === rawBusNum.toLowerCase()) {
                            return true;
                        }
                        
                        // 2. 패딩된 숫자 비교 지원 (예: "06"과 "6", "Bus-08"과 "8" 매칭)
                        const cleanBusDigits = b.name.replace(/\D/g, '');
                        if (cleanRowDigits && cleanBusDigits && parseInt(cleanRowDigits, 10) === parseInt(cleanBusDigits, 10)) {
                            return true;
                        }
                        
                        return false;
                    });

                    if (foundBus) {
                        await updateBus(foundBus.id, { zaloLink });
                        successCount++;
                    } else {
                        errorCount++;
                    }
                }

                toast({
                    title: "Zalo 단체방 등록 완료",
                    description: `성공: ${successCount}건, 실패(버스 미매칭): ${errorCount}건`
                });
            } catch (err: any) {
                toast({ title: "엑셀 파싱 실패", description: err.message, variant: "destructive" });
            } finally {
                setZaloUploading(false);
                if (zaloFileRef.current) zaloFileRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleRestoreBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!window.confirm("주의: 백업 데이터 복원 시 현재 데이터베이스의 모든 관련 데이터(버스, 학생, 노선 등)가 덮어쓰여집니다. 계속하시겠습니까?")) {
            if (restoreFileRef.current) restoreFileRef.current.value = "";
            return;
        }

        setRestoring(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                const { doc, setDoc } = await import('firebase/firestore');

                const keys = ['buses', 'students', 'routes', 'destinations', 'teachers', 'afterSchoolClasses'];
                const missingKeys = keys.filter(k => !json[k] || !Array.isArray(json[k]));
                if (missingKeys.length > 0) {
                    throw new Error(`백업 파일 형식이 올바르지 않습니다. (누락된 키: ${missingKeys.join(', ')})`);
                }

                const { dismiss } = toast({ title: "데이터 복구 진행 중", description: "데이터베이스를 복원하고 있습니다..." });

                let totalRestored = 0;
                for (const colName of keys) {
                    const list = json[colName];
                    await Promise.all(list.map(async (item: any) => {
                        if (!item.id) return;
                        const { id, ...data } = item;
                        const docRef = doc(db(), colName, id);
                        await setDoc(docRef, data);
                        totalRestored++;
                    }));
                }

                dismiss();
                toast({ title: "데이터 복구 완료", description: `총 ${totalRestored}개의 데이터 문서가 복원되었습니다.` });
            } catch (err: any) {
                toast({ title: "복구 실패", description: err.message, variant: "destructive" });
            } finally {
                setRestoring(false);
                if (restoreFileRef.current) restoreFileRef.current.value = "";
            }
        };
        reader.readAsText(file);
    };

    return (
        <DialogContent className="max-w-lg font-sans">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                    <Settings className="w-5 h-5 text-slate-700 animate-spin-slow" />
                    시스템 관리자 설정
                </DialogTitle>
                <DialogDescription>
                    KIS 스쿨버스 매니저 서비스의 전역 설정 및 버스별 Zalo 단체방, 백업 복구를 관리합니다.
                </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="general" className="w-full mt-2">
                <TabsList className="grid grid-cols-3 w-full bg-slate-100 p-1 rounded-lg">
                    <TabsTrigger value="general" className="text-xs font-semibold py-2">일반 설정</TabsTrigger>
                    <TabsTrigger value="zalo" className="text-xs font-semibold py-2">ZALO 관리</TabsTrigger>
                    <TabsTrigger value="backup" className="text-xs font-semibold py-2">백업 & 복구</TabsTrigger>
                </TabsList>

                {/* 1. 일반 설정 탭 */}
                <TabsContent value="general" className="space-y-4 py-3">
                    <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                        <Label className="text-sm font-bold text-slate-800">학부모 앱 담당자 전화번호</Label>
                        <p className="text-xs text-muted-foreground mb-2">학부모 앱의 "담당자 전화" 버튼 클릭 시 다이얼러로 연결될 전화번호입니다.</p>
                        <div className="flex gap-2">
                            <Input 
                                placeholder="예: 028-5417-9021" 
                                value={contactPhone}
                                onChange={(e) => setContactPhone(e.target.value)}
                                className="flex-1 text-sm h-9 bg-white"
                            />
                            <Button 
                                onClick={handleSaveSettings} 
                                size="sm" 
                                className="h-9 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium"
                                disabled={settingsLoading}
                            >
                                {settingsLoading ? "저장 중..." : "저장"}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                        <Label className="text-sm font-bold text-slate-800">전체 공지사항 전송</Label>
                        <p className="text-xs text-muted-foreground mb-2">학부모 및 교사용 앱을 사용하는 전체 유저에게 긴급 공지 알림을 발송합니다.</p>
                        <div className="flex gap-2">
                            <Input 
                                placeholder="공지사항 내용을 입력하세요..." 
                                value={announcement}
                                onChange={(e) => setAnnouncement(e.target.value)}
                                className="flex-1 text-sm h-9 bg-white"
                            />
                            <Button onClick={handleSendBroadcast} size="sm" className="h-9 gap-1 bg-primary hover:bg-primary/95 text-white">
                                <Send className="w-3.5 h-3.5" />
                                전송
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                {/* 2. ZALO 관리 탭 */}
                <TabsContent value="zalo" className="space-y-4 py-3">
                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                        <Label className="text-sm font-bold text-slate-800">버스별 ZALO 단체방 일괄 등록</Label>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            제공되는 엑셀 양식에 맞춰 버스 번호별 Zalo 링크를 기입해 업로드하면 각 버스의 단체방이 일괄 매칭되어 등록됩니다.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-2 pt-2">
                            <Button onClick={handleDownloadZaloTemplate} variant="outline" size="sm" className="flex-1 text-xs gap-1.5 border-slate-200 bg-white">
                                <Download className="w-3.5 h-3.5 text-slate-600" />
                                양식 다운로드
                            </Button>
                            
                            <Button 
                                onClick={() => zaloFileRef.current?.click()} 
                                size="sm" 
                                className="flex-1 text-xs gap-1.5 bg-blue-600 hover:bg-blue-750 text-white"
                                disabled={zaloUploading}
                            >
                                <Upload className="w-3.5 h-3.5" />
                                {zaloUploading ? "업로드 중..." : "엑셀 파일 업로드"}
                            </Button>
                            <input 
                                type="file" 
                                ref={zaloFileRef} 
                                onChange={handleZaloUpload} 
                                accept=".xlsx" 
                                className="hidden" 
                            />
                        </div>
                    </div>

                    <div className="text-[11px] text-slate-500 bg-blue-50/30 p-3 rounded-lg border border-blue-100/50 leading-relaxed">
                        <strong>엑셀 작성 가이드:</strong><br />
                        - <strong>버스 번호</strong> 열: 1, 2, 15A 등 (기존 등록된 버스 번호와 동일해야 함)<br />
                        - <strong>ZALO LINK</strong> 열: Zalo 단체방의 단축 주소 (https://zalo.me/g/...) 기입
                    </div>
                </TabsContent>

                {/* 3. 백업 & 복구 탭 */}
                <TabsContent value="backup" className="space-y-4 py-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                            <div>
                                <Label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                    <Download className="w-4 h-4 text-slate-600" />
                                    데이터 백업
                                </Label>
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                                    버스, 학생, 교사, 노선 등 현재 데이터베이스의 모든 핵심 데이터를 JSON 파일로 내려받습니다.
                                </p>
                            </div>
                            <Button onClick={handleExportBackup} variant="outline" size="sm" className="w-full mt-4 border-slate-200 bg-white">
                                백업 다운로드 (JSON)
                            </Button>
                        </div>

                        <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                            <div>
                                <Label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                    <Upload className="w-4 h-4 text-slate-600" />
                                    데이터 복구 (Restore)
                                </Label>
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                                    이전에 저장한 JSON 백업 파일을 업로드하여 현재 데이터베이스를 복원합니다.
                                </p>
                            </div>
                            <Button 
                                onClick={() => restoreFileRef.current?.click()} 
                                variant="destructive" 
                                size="sm" 
                                className="w-full mt-4"
                                disabled={restoring}
                            >
                                {restoring ? "복원 진행 중..." : "백업 복원하기 (JSON)"}
                            </Button>
                            <input 
                                type="file" 
                                ref={restoreFileRef} 
                                onChange={handleRestoreBackup} 
                                accept=".json" 
                                className="hidden" 
                            />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <DialogFooter className="pt-2 border-t border-slate-100 mt-4">
                <Button variant="outline" onClick={onClose}>닫기</Button>
            </DialogFooter>
        </DialogContent>
    );
};

export default function AdminPage() {
    const { user, profile, loading: authLoading } = useAuth();
    const router = useRouter();
    const [buses, setBuses] = useState<Bus[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [suggestedDestinations, setSuggestedDestinations] = useState<Destination[]>([]);
    const [afterSchoolClasses, setAfterSchoolClasses] = useState<AfterSchoolClass[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [afterSchoolTeachers, setAfterSchoolTeachers] = useState<Teacher[]>([]);
    const [saturdayTeachers, setSaturdayTeachers] = useState<Teacher[]>([]);
    const [rawStudents, setRawStudents] = useState<Student[]>([]);
    const [afterschoolCourses, setAfterschoolCourses] = useState<any[]>([]);
    const [afterschoolEnrollments, setAfterschoolEnrollments] = useState<any[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [pendingStudents, setPendingStudents] = useState<Student[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [activeSystemMode, setActiveSystemMode] = useState<'regular' | 'vacation'>('regular');
    const [adminViewMode, setAdminViewMode] = useState<'regular' | 'vacation'>('regular');
    const [hasLoadedInitialMode, setHasLoadedInitialMode] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const { toast } = useToast();
    const { t } = useTranslation();
    
    const [docConfig, setDocConfig] = useState<Partial<DocConfig>>({});
    const [isBusDocModalOpen, setIsBusDocModalOpen] = useState(false);
    const [selectedBusDocType, setSelectedBusDocType] = useState<number | null>(null);
    const [docAcademicYear, setDocAcademicYear] = useState('2026');
    const [docSemesterName, setDocSemesterName] = useState('1학기');

    const [isLeaderModalOpen, setIsLeaderModalOpen] = useState(false);
    const [editableLeaders, setEditableLeaders] = useState<Array<{ id: string; busNo: string; grade: string; class: string; name: string; gender: string; hours: string }>>([]);
    const [newLeaderForm, setNewLeaderForm] = useState({ busNo: '', grade: '6', class: '1', name: '', gender: '여', hours: '8시간' });

    // 시스템 학사일정에 등록된 일정과 실시간 날짜를 기반으로 학년도/학기 자동 인식
    useEffect(() => {
        const unsub = onDocConfigUpdate((cfg) => {
            setDocConfig(cfg);
            if (cfg?.academicCalendar) {
                const realtimeSem = getRealtimeSemesterInfo(new Date(), cfg.academicCalendar);
                setDocAcademicYear(realtimeSem.yearStr);
                setDocSemesterName(realtimeSem.name);
            }
        });
        return () => unsub();
    }, []);

    // 시스템에 설정된 활성 학년도/학기로 자동 동기화 (1학기 -> 2학기 자동 변경)
    useEffect(() => {
        const unsubDuty = onSnapshot(doc(db(), 'config', 'morningGateDutyMulti'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const activeSemId = data?.activeSemesterId;
                if (activeSemId && data?.semesters?.[activeSemId]) {
                    const semInfo = data.semesters[activeSemId];
                    const yearMatch = semInfo.name.match(/\d{4}/);
                    if (yearMatch) setDocAcademicYear(yearMatch[0]);
                    if (semInfo.name.includes('2학기') || semInfo.id?.includes('_2')) {
                        setDocSemesterName('2학기');
                    } else if (semInfo.name.includes('여름') || semInfo.id?.includes('summer')) {
                        setDocSemesterName('여름방학');
                    } else if (semInfo.name.includes('겨울') || semInfo.id?.includes('winter')) {
                        setDocSemesterName('겨울방학');
                    } else {
                        setDocSemesterName('1학기');
                    }
                }
            }
        });
        return () => unsubDuty();
    }, []);

    const handleToggleBusApply = async (checked: boolean) => {
        try {
            await saveDocConfig({ isBusApplyActive: checked });
            toast({
                title: checked ? "스쿨버스 탑승 신청 기간 활성화" : "스쿨버스 탑승 신청 기간 마감",
                description: checked ? "학부모 서비스 대시보드에서 스쿨버스 탑승 신청이 가능합니다." : "학부모 대시보드의 탑승 신청 버튼이 마감 처리됩니다."
            });
        } catch (err) {
            toast({ title: "오류", description: "설정 변경 실패", variant: "destructive" });
        }
    };
    
    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push('/login');
                return;
            }
            
            getOrgStructure().then(orgData => {
                const emailLower = (profile?.email || user?.email || '').toLowerCase();
                const busManagers = orgData?.busManagers || (orgData?.busManager ? [orgData.busManager] : []);
                const isBusManager = busManagers.some((m: string) => m.toLowerCase() === emailLower) || emailLower === 'bus@kshcm.net';
                const isSystemAdmin = profile?.isAdmin === true || emailLower === 'beside1s@kshcm.net' || emailLower === 'bus@kshcm.net';
                
                if (isSystemAdmin || isBusManager) {
                    setIsAuthorized(true);
                } else {
                    setIsAuthorized(false);
                    toast({
                        variant: 'destructive',
                        title: '접근 권한 없음',
                        description: '스쿨버스 담당자 또는 시스템 관리자만 접근할 수 있습니다.'
                    });
                    router.replace('/inbox');
                }
            }).catch(() => {
                if (profile?.isAdmin === true) {
                    setIsAuthorized(true);
                } else {
                    setIsAuthorized(false);
                    router.replace('/inbox');
                }
            });
        }
    }, [user, authLoading, profile, router, toast]);

    useEffect(() => {
        if (!user || authLoading || isAuthorized !== true) return;
        
        setDataLoading(true);
        const unsubscribers = [
            onBusesUpdate(data => setBuses(sortBuses(data))),
            onStudentsUpdate(data => {
                setRawStudents(data);
            }),
            onRoutesUpdate(setRoutes),
            onDestinationsUpdate(data => setDestinations(sortDestinations(data))),
            onSuggestedDestinationsUpdate(setSuggestedDestinations),
            onTeachersUpdate(data => setTeachers([...data].sort((a, b) => a.name.localeCompare(b.name, 'ko')))),
            onAfterSchoolTeachersUpdate(data => setAfterSchoolTeachers([...data].sort((a, b) => a.name.localeCompare(b.name, 'ko')))),
            onSaturdayTeachersUpdate(data => setSaturdayTeachers([...data].sort((a, b) => a.name.localeCompare(b.name, 'ko')))),
            onAfterschoolCoursesUpdate(setAfterschoolCourses),
            onAfterschoolEnrollmentsUpdate(setAfterschoolEnrollments),
            onGlobalSettingsUpdate(data => {
                const mode = data?.semesterMode || 'regular';
                setActiveSystemMode(mode);
                setHasLoadedInitialMode(prev => {
                    if (!prev) {
                        setAdminViewMode(mode);
                    }
                    return true;
                });
            }),
        ];

        Promise.all([
            getBuses(),
            getStudents(),
            getRoutes(),
            getDestinations(),
            getTeachers(),
            getAfterSchoolTeachers(),
            getSaturdayTeachers(),
        ]).then(() => {
            setDataLoading(false);
        }).catch(error => {
            console.error("Error fetching initial data:", error);
            setDataLoading(false);
        });

        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe());
        };
    }, [user, authLoading, isAuthorized]);

    // 방과후학교 관리 콘솔 데이터와 스쿨버스 시스템 데이터 실시간 병합
    useEffect(() => {
        if (rawStudents.length === 0) return;

        // 1. 강좌 목록 연동
        const dayMap: Record<string, DayOfWeek> = {
            '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday',
            '목': 'Thursday', '금': 'Friday', '토': 'Saturday'
        };

        const convertedClasses: AfterSchoolClass[] = afterschoolCourses.map(course => {
            const dayOfWeek = dayMap[course.classDays?.[0]] || 'Saturday';
            return {
                id: course.id,
                name: course.title,
                dayOfWeek,
                teacherId: null,
                teacherName: course.instructorName || '',
                semesterMode: 'vacation'
            };
        });
        setAfterSchoolClasses(convertedClasses);

        // 2. 학생 및 수강신청/버스 신청 정보 연동
        const merged = rawStudents.map(student => {
            const studentEnrollments = afterschoolEnrollments.filter(e => 
                e.name === student.name && 
                Number(e.grade) === Number(student.grade) && 
                Number(e.classNum) === Number(student.class)
            );

            if (studentEnrollments.length === 0) {
                return {
                    ...student,
                    afterSchoolClassIds: {},
                    afterSchoolDestinations: {},
                    vacationAfterSchoolClassIds: {},
                    vacationAfterSchoolDestinations: {}
                };
            }

            const afterSchoolClassIds: Record<string, string> = {};
            const afterSchoolDestinations: Record<string, string> = {};
            const vacationAfterSchoolClassIds: Record<string, string> = {};
            const vacationAfterSchoolDestinations: Record<string, string> = {};

            studentEnrollments.forEach(enrollment => {
                const course = afterschoolCourses.find(c => c.id === enrollment.courseId);
                if (!course) return;

                const dayOfWeek = dayMap[course.classDays?.[0]] || 'Saturday';
                const busNo = enrollment.kisbusNo && enrollment.kisbusNo !== '-' ? enrollment.kisbusNo : null;

                afterSchoolClassIds[dayOfWeek] = course.id;
                vacationAfterSchoolClassIds[dayOfWeek] = course.id;

                if (busNo) {
                    afterSchoolDestinations[dayOfWeek] = busNo;
                    vacationAfterSchoolDestinations[dayOfWeek] = busNo;
                }
            });

            return {
                ...student,
                afterSchoolClassIds,
                afterSchoolDestinations,
                vacationAfterSchoolClassIds,
                vacationAfterSchoolDestinations
            };
        });

        setStudents(merged);
        setPendingStudents(merged.filter(s => s.applicationStatus === 'pending'));
    }, [rawStudents, afterschoolCourses, afterschoolEnrollments]);

    const getOperatingPeriodString = (yearStr: string, semStr: string, calConfig?: AcademicCalendarConfig) => {
        const yearNum = parseInt(yearStr, 10) || 2026;
        const formatDateWithDay = (dateStr?: string, defaultFallback = '') => {
            if (!dateStr) return defaultFallback;
            try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return defaultFallback;
                const days = ['일', '월', '화', '수', '목', '금', '토'];
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const dayName = days[d.getDay()];
                return `${yyyy}.${mm}.${dd}.(${dayName})`;
            } catch {
                return defaultFallback;
            }
        };

        const isSecondSemester = semStr.includes('2학기');
        const semStart = isSecondSemester ? calConfig?.semesters?.sem2?.startDate : calConfig?.semesters?.sem1?.startDate;
        const semEnd = isSecondSemester ? calConfig?.semesters?.sem2?.endDate : calConfig?.semesters?.sem1?.endDate;

        const defaultStart = isSecondSemester ? `${yearNum}.08.17.(월)` : `${yearNum}.03.02.(월)`;
        const defaultEnd = isSecondSemester ? `${yearNum + 1}.01.07.(목)` : `${yearNum}.07.13.(월)`;

        const startFormatted = formatDateWithDay(semStart, defaultStart);
        const endFormatted = formatDateWithDay(semEnd, defaultEnd);
        return `${startFormatted}~${endFormatted}`;
    };

    const getFullYearPeriodString = (yearStr: string, calConfig?: AcademicCalendarConfig) => {
        const yearNum = parseInt(yearStr, 10) || 2026;
        const formatDateWithDay = (dateStr?: string, defaultFallback = '') => {
            if (!dateStr) return defaultFallback;
            try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return defaultFallback;
                const days = ['일', '월', '화', '수', '목', '금', '토'];
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const dayName = days[d.getDay()];
                return `${yyyy}.${mm}.${dd}.(${dayName})`;
            } catch {
                return defaultFallback;
            }
        };

        const sem1Start = calConfig?.semesters?.sem1?.startDate;
        const sem2End = calConfig?.semesters?.sem2?.endDate;
        const startFormatted = formatDateWithDay(sem1Start, `${yearNum}.03.02.(월)`);
        const endFormatted = formatDateWithDay(sem2End, `${yearNum + 1}.01.07.(목)`);
        return `${startFormatted}~${endFormatted}`;
    };

    const BUS_DOCUMENT_TYPES = [
        {
            id: 1,
            title: '00학년도 0학기 유・초등 등하교 차량 지도 계획 수립',
            displayTitle: (year: string, sem: string) => `${year}학년도 ${sem} 유・초등 등하교 차량 지도 계획 수립`,
            category: '차량 운행 및 안전지도 기본 계획안',
            description: '유치원 및 초등학생 스쿨버스 등하교 차량 안전 운행, 동승 도우미(차장) 배치 및 종합 등하교 수송 지도 계획수립 건',
            badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
            templateContent: (year: string, sem: string, calConfig?: AcademicCalendarConfig) => {
                const opPeriodStr = getOperatingPeriodString(year, sem, calConfig);
                const isSecondSemester = sem.includes('2학기');

                const attachmentHtml = isSecondSemester
                    ? `<div style="margin-top: 24px; line-height: 1.8; font-weight: normal;">` +
                      `<p style="margin-bottom: 4px; margin-left: 0px;">붙임 &nbsp;&nbsp;1. &nbsp;${year}학년도 ${sem} 등교 지도교사 배정표 1부.</p>` +
                      `<p style="margin-bottom: 4px; margin-left: 54px;">2. &nbsp;${year}학년도 ${sem} 등하교 차량 지도교사 배정표 1부. &nbsp;&nbsp;끝.</p>` +
                      `</div>`
                    : `<div style="margin-top: 24px; line-height: 1.8; font-weight: normal;">` +
                      `<p style="margin-bottom: 4px; margin-left: 0px;">붙임 &nbsp;&nbsp;1. &nbsp;${year}학년도 유·초등 등하교 차량 지도 계획 1부.</p>` +
                      `<p style="margin-bottom: 4px; margin-left: 54px;">2. &nbsp;${year}학년도 ${sem} 등교 지도교사 배정표 1부.</p>` +
                      `<p style="margin-bottom: 4px; margin-left: 54px;">3. &nbsp;${year}학년도 ${sem} 등하교 차량 지도교사 배정표 1부. &nbsp;&nbsp;끝.</p>` +
                      `</div>`;

                return `<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 0px;">1. &nbsp;${year}학년도 ${sem} 유·초등 등하교 차량 지도 계획을 붙임과 같이 실시하고자 합니다.</p>` +
`<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 16px;">가. &nbsp;운영 기간: ${opPeriodStr}</p>` +
`<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 16px;">나. &nbsp;주요 내용</p>` +
`<p style="line-height: 1.8; margin-bottom: 6px; font-weight: normal; margin-left: 32px;">1) &nbsp;등교 지도: 학교 정문 앞 학생 맞이 및 등교 질서 유지</p>` +
`<p style="line-height: 1.8; margin-bottom: 6px; font-weight: normal; margin-left: 32px;">2) &nbsp;하교 차량 안전 지도: 학생 차량 안전 지도(안전벨트 착용, 교우 관계 등)</p>` +
`${attachmentHtml}`;
            },
            attachmentsGenerator: (year: string, sem: string, calConfig?: AcademicCalendarConfig, busesList?: Bus[], routesList?: Route[], destsList?: Destination[], teachersList?: Teacher[], orgStructure?: OrgStructure | Partial<OrgStructure>, usersList?: UserProfile[], dutyScheduleRows?: any[]) => {
                const fullYearPeriodStr = getFullYearPeriodString(year, calConfig);
                const isSecondSemester = sem.includes('2학기');

                let busManagerName = '업무담당교사';
                if (orgStructure?.busManagers && orgStructure.busManagers.length > 0) {
                    const matchedNames = (usersList || [])
                        .filter(u => orgStructure.busManagers?.includes(u.email))
                        .map(u => u.name);
                    if (matchedNames.length > 0) {
                        busManagerName = matchedNames.join(', ');
                    }
                }

                let healthTeacherName = '보건교사';
                if (orgStructure?.healthTeachers && orgStructure.healthTeachers.length > 0) {
                    const matchedHealthNames = (usersList || [])
                        .filter(u => orgStructure.healthTeachers?.includes(u.email))
                        .map(u => u.name);
                    if (matchedHealthNames.length > 0) {
                        healthTeacherName = matchedHealthNames.join(', ');
                    }
                }

                const planHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${year}학년도 유·초등 등하교 차량 지도 계획</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap');
  body {
    font-family: 'Noto Sans KR', sans-serif;
    color: #1e293b;
    background-color: #f8fafc;
    margin: 0;
    padding: 30px 15px;
  }
  .page {
    max-width: 800px;
    margin: 0 auto 25px auto;
    background: #ffffff;
    padding: 50px 60px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    box-sizing: border-box;
    position: relative;
  }
  .header-title {
    font-size: 24px;
    font-weight: 800;
    text-align: center;
    color: #0f172a;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
  }
  .header-decor {
    height: 4px;
    width: 100%;
    background: linear-gradient(to right, #2563eb 70%, #f97316 30%);
    border-radius: 2px;
    margin-bottom: 12px;
  }
  .school-name {
    text-align: right;
    font-size: 13px;
    font-weight: 700;
    color: #475569;
    margin-bottom: 30px;
  }
  .section-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: #475569;
    color: #ffffff;
    font-weight: 800;
    font-size: 14px;
    padding: 4px 14px;
    border-radius: 20px;
    margin-top: 25px;
    margin-bottom: 14px;
  }
  p, li {
    font-size: 13.5px;
    line-height: 1.8;
    color: #334155;
    margin: 4px 0;
  }
  .indent-1 { margin-left: 12px; }
  .indent-2 { margin-left: 24px; }
  
  table.custom-table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 13px;
  }
  table.custom-table th, table.custom-table td {
    border: 1px solid #cbd5e1;
    padding: 10px 12px;
    text-align: center;
  }
  table.custom-table th {
    background-color: #f1f5f9;
    font-weight: 700;
    color: #0f172a;
  }
  .notice-box {
    background-color: #fefce8;
    border-left: 4px solid #eab308;
    padding: 10px 14px;
    margin: 8px 0;
    border-radius: 4px;
    font-size: 12.5px;
  }
  .flow-diagram {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 14px;
    border-radius: 8px;
    margin: 12px 0;
    flex-wrap: wrap;
  }
  .flow-box {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .flow-arrow {
    color: #64748b;
    font-weight: bold;
  }
  .print-btn-container {
    text-align: center;
    margin-bottom: 20px;
  }
  .print-btn {
    background: #2563eb;
    color: white;
    border: none;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 700;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(37,99,235,0.3);
    transition: all 0.2s;
  }
  .print-btn:hover {
    background: #1d4ed8;
  }
  @media print {
    body { background: white; padding: 0; }
    .page { box-shadow: none; padding: 20px 30px; margin: 0; max-width: 100%; }
    .print-btn-container { display: none; }
  }
</style>
</head>
<body>
  <div class="print-btn-container">
    <button class="print-btn" onclick="window.print()">PDF 다운로드 / 인쇄하기</button>
  </div>
  
  <div class="page">
    <div class="header-title">${year}학년도 유·초등 등하교 차량 지도 계획</div>
    <div class="header-decor"></div>
    <div class="school-name">호치민시한국국제학교(초등)</div>
    
    <div class="section-badge">1 &nbsp;목 적</div>
    <p class="indent-1">등·하교 시 스쿨버스를 이용하여 통학하는 본교 학생들의 안전과 질서를 확보하기 위하여 등교 지도 교사 및 하교 차량 담당 교사를 배치하고 문제 상황 발생 시 효과적으로 대처할 수 있는 시스템을 구축한다.</p>

    <div class="section-badge">2 &nbsp;방 침</div>
    <p class="indent-1">가. 모든 교사는 등하교 차량 안전교육을 지속적으로 실시하여 스쿨버스 운영에 따른 각종 안전사고를 사전에 예방하는 데에 힘쓴다.</p>
    <p class="indent-1">나. 등교 지도 교사는 본교에 재직 중인 유·초등 교사(전임강사 포함)로 구성하며 지도 순서는 [붙임2]에 따른다.</p>
    <p class="indent-1">다. 하교 지도는 유·초등 교사 전원이 각 배정된 담당 차량별로 실시하며, 차량별 지도교사 배정은 [붙임3]에 따른다.</p>
    <p class="indent-1">라. 하교 지도는 통학 차량이 모두 출발할 때까지 지도하며, 하교 시간 이후 학교에 남는 학생(방과후, 개별 귀가 등)의 경우 인원수를 사전에 파악하고 해당 학생의 안전을 위해 생활 교육을 실시한다.</p>
    <p class="indent-1">마. 차량별 지도교사 배치는 1, 2학기로 나누어 실시하며, 지도교사는 차량 탑승 규칙 위반 학생을 파악하고 관리한다.</p>
    <p class="indent-1">바. 차량별 지도교사는 학생 안전 도우미(차장)를 선발하며 학생 차장 운영계획은 [별도 계획]에 따른다.</p>
    <p class="indent-1">사. 특별히 차량 탑승 지도가 필요한 아동의 경우에는 차량 담당 교사가 우선 지도하며 필요시 담임교사, 생활교육부와 연계하여 해당 학생 관리를 실시할 수 있다.</p>
    <p class="indent-1">아. 행정실은 차량별 차량 안전 도우미 1인(베트남 보조 스텝)을 고용 배치하여 차량 운행 안전 및 학생 탑승 보조 역할을 할 수 있도록 한다.</p>
    <p class="indent-1">자. KIS 스쿨버스 매니저(앱)을 활용하여 탑승 신청 및 승하차 관리, 담당 교사 배정 등 스쿨버스 관련 제반 업무를 한다.</p>

    <div class="section-badge">3 &nbsp;세부추진계획</div>
    <p class="indent-1">가. 기간: <strong>${fullYearPeriodStr}</strong></p>
    <p class="indent-1">나. 등하교 차량 지도교사 배정 및 운영 총괄: 교사 강지욱</p>
    <p class="indent-1">다. 세부 추진 내용</p>

    <table class="custom-table">
      <thead>
        <tr>
          <th>구 분</th>
          <th>등교 시</th>
          <th>하교 시</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="font-weight:700;">시 간</td>
          <td>07:40~08:20</td>
          <td>14:50~15:00 (차량 출발 시)</td>
        </tr>
        <tr>
          <td style="font-weight:700;">장 소</td>
          <td>학교 정문 앞</td>
          <td>각 차량 배차 장소</td>
        </tr>
        <tr>
          <td style="font-weight:700;">활 동</td>
          <td>학생 맞이 및 등교 질서 유지</td>
          <td>학생 차량 탑승 확인 및 안전 귀가 지도</td>
        </tr>
        <tr>
          <td style="font-weight:700;">수 당</td>
          <td>140,000vnd (40분, 1회)</td>
          <td>없음</td>
        </tr>
        <tr>
          <td style="font-weight:700;">비 고</td>
          <td style="text-align:left; font-size:12px; color:#b91c1c;">
            ※ 개인 사정으로 인하여 일정 변경 시 개인별 일정 교환 후 운영 교사에게 반드시 사전 통지함.
          </td>
          <td>유·초등 교사 전체 실시</td>
        </tr>
      </tbody>
    </table>

    <p class="indent-1" style="font-weight:700; margin-top:16px;">라. 안전 지도 내용</p>
    <p class="indent-2">1) 차량 승차 시 차례를 지켜서 안전하게 탑승한다.(이동 시 뛰지 않기)</p>
    <p class="indent-2">2) 탑승 후 지정된 좌석에 앉는다.(차량 안전 도우미가 좌석 지정)</p>
    <p class="indent-2">3) 좌석에 앉은 후 즉시 안전벨트를 착용한다.</p>
    <p class="indent-2">4) 차량이 운행하는 동안 절대 자리에서 일어나거나 돌아다니지 않는다.</p>
    <p class="indent-2">5) 차량 밖으로 손을 내밀거나 물건을 차량 밖으로 던지지 않는다.</p>
    <p class="indent-2">6) 타인에게 불쾌감을 주는 행동이나 언어적·신체적 폭력을 행사하지 않는다.</p>
    <p class="indent-2">7) 차량이 정차하기 전에 미리 안전벨트를 풀고 자리에서 일어나지 않는다.</p>
    <p class="indent-2">8) 차량 하차 시 차례를 지켜서 안전하게 하차한다.</p>
    <p class="indent-2">9) 차량 탑승자는 차량 지도교사 및 차량 안전 도우미의 지시를 따른다.</p>

    <p class="indent-1" style="font-weight:700; margin-top:16px;">마. 도보 통학 학생 지도 계획</p>
    <p class="indent-2">1) 반드시 인도 및 횡단보도를 이용하여 등하교 하도록 한다.</p>
    <p class="indent-2">2) 도로를 건널 때에는 ‘선다 → 좌우를 살핀다 → 운전자와 눈을 맞춘다 → 손을 들고 천천히 건넌다’를 인지 시켜 횡단하도록 지도한다.</p>

    <p class="indent-1" style="font-weight:700; margin-top:16px;">바. 위급상황 발생 시 대처 계획</p>
    <p class="indent-2">1) 차량 안에서 위급 상황 발생 시</p>
    <p class="indent-2">가) 다음의 연락 체계에 따라 연락하고 조치를 취한다.</p>

    <div class="flow-diagram">
      <div class="flow-box">차량 안전 도우미 / 지도교사</div>
      <div class="flow-arrow">➔</div>
      <div class="flow-box" style="text-align:left;">
        ① 차량 담당교사<br/>
        ② 초등 교무실
      </div>
      <div class="flow-arrow">➔</div>
      <div class="flow-box">교감 / 행정실장</div>
      <div class="flow-arrow">➔</div>
      <div class="flow-box">학교장</div>
    </div>
    <div style="font-size:12px; color:#64748b; margin-left:24px;">
      ※ (상시 확인: 업무담당 교사, 행정실 업무담당자)<br/>
      ※ (문제 상황의 판단이 어렵거나 그 밖의 문의 사항은 업무담당 교사에게 알림)
    </div>

    <p class="indent-2" style="margin-top:10px;">나) 동일 상황이 재발하지 않도록 사후 조치를 철저히 한다.</p>
    <p class="indent-2">다) 학생 안전 도우미(차장) 교육과 관련하여서는 담당 교사의 [별도 계획]에 따른다.</p>

    <p class="indent-2" style="margin-top:10px;">2) 등하교 지도 중 위급 상황 발생 시</p>
    <p class="indent-2">가) 위급 상황을 발견한 교사는 즉시 조치를 취한 후 다음의 체계에 따라 연락한다.</p>
    
    <div class="flow-diagram">
      <div class="flow-box">위급 상황 발견 교사</div>
      <div class="flow-arrow">➔</div>
      <div class="flow-box">담임교사 / 업무담당 교사 / 보건교사</div>
      <div class="flow-arrow">➔</div>
      <div class="flow-box">교감 / 행정실장</div>
      <div class="flow-arrow">➔</div>
      <div class="flow-box">학교장</div>
    </div>
    <p class="indent-2">나) 동일 상황이 재발하지 않도록 사후 조치를 철저히 한다.</p>

    <p class="indent-1" style="font-weight:700; margin-top:16px;">사. 위기상황 발생 시 비상 연락처</p>
    <p class="indent-2">1) 호치민시한국국제학교: 028-5417-9021 (행정실530, 초등교무실301)</p>
    <p class="indent-2">2) 베트남 현지 응급구조대: 115</p>
    <p class="indent-2">3) FV병원 (7군 푸미흥): 096-262-7804 (한국어 가능한 베트남 직원) / 028-5411-3500 (응급실, 영어사용)</p>
    <p class="indent-2">4) 삼성하늘병원 (7군 푸미흥): 028-5410-7831</p>
    <p class="indent-2">5) Family Medical Practice (1군 Le Duan St): 028-3744-9000 *9999 (응급실)</p>
    <div class="notice-box">
      ※ 응급 후송 중 학부모님께 연락을 취하고, 우선 응급 병원에서 치료 후 학부모님이 원하실 경우 다른 병원으로 이송함.
    </div>

    <p class="indent-1" style="font-weight:700; margin-top:16px;">아. 기타 참고 사항</p>
    <p class="indent-2">1) 차량이 교통 사정 등으로 늦게 도착할 경우</p>
    <div class="flow-diagram" style="justify-content:flex-start; gap:12px;">
      <div class="flow-box">행정실 보고 (행정3실)</div>
      <div class="flow-arrow">➔</div>
      <div class="flow-box">행정실 업무담당자 확인</div>
      <div class="flow-arrow">➔</div>
      <div class="flow-box">차량 조치</div>
      <div class="flow-arrow">➔</div>
      <div class="flow-box">업무담당 교사 / 각반 담임 통지</div>
    </div>
  </div>
</body>
</html>`;

                // 동적 등교 지도 교사 배정표 테이블 HTML 생성 (첫 근무 교사 기준 회차별 색상 전환)
                const dayKeys = ['월', '화', '수', '목', '금'];
                let dutyRowsHtml = '';
                if (dutyScheduleRows && dutyScheduleRows.length > 0) {
                    // 1. 첫 번째 근무 교사(장진철 등) 이름 식별
                    let firstTeacherName = '';
                    for (const week of dutyScheduleRows) {
                        for (const k of dayKeys) {
                            const slot = week.days?.[k];
                            if (slot && !slot.isHoliday && slot.teacherName && slot.teacherName.trim() !== '') {
                                firstTeacherName = slot.teacherName.trim();
                                break;
                            }
                        }
                        if (firstTeacherName) break;
                    }

                    let runningCycle = 1;
                    let hasInitializedFirst = false;

                    dutyRowsHtml = dutyScheduleRows.map((week: any) => {
                        const isAllHoliday = dayKeys.every(k => week.days?.[k]?.isHoliday);
                        if (isAllHoliday && week.daysCount === 0) {
                            return `<tr><td>${week.weekNum.toString().padStart(2, '0')}</td><td>${week.periodStr}</td><td>0</td><td colspan="5" class="cell-gray">개교기념일 및 재량휴업일 (휴무)</td></tr>`;
                        }
                        const dayCells = dayKeys.map(k => {
                            const slot = week.days?.[k];
                            if (!slot || slot.isHoliday) {
                                return `<td class="cell-gray">${slot?.holidayName || '휴업일'}</td>`;
                            }
                            
                            const teacherName = slot.teacherName?.trim() || '';

                            // slot에 명시된 roundNumber가 있으면 최우선 반영
                            if (slot.roundNumber && Number(slot.roundNumber) >= 1) {
                                runningCycle = Number(slot.roundNumber);
                            } else if (teacherName && firstTeacherName && teacherName === firstTeacherName) {
                                if (hasInitializedFirst) {
                                    runningCycle += 1;
                                } else {
                                    hasInitializedFirst = true;
                                }
                            } else if (teacherName) {
                                hasInitializedFirst = true;
                            }

                            // 회차별 색상: 1회차=연보라, 2회차=연노랑, 3회차=연녹색, 4회차 이상=연하늘
                            let colorCls = 'cell-purple';
                            if (runningCycle === 2) colorCls = 'cell-yellow';
                            else if (runningCycle === 3) colorCls = 'cell-green';
                            else if (runningCycle >= 4) colorCls = 'cell-blue';

                            const roundPrefix = slot.roundNumber 
                                ? `(${slot.roundNumber}회차)<br/>` 
                                : ((slot.isCycleStart || (teacherName === firstTeacherName && (runningCycle > 1 || !hasInitializedFirst))) ? `(${runningCycle}회차)<br/>` : '');

                            return `<td class="${colorCls}">${roundPrefix}${teacherName}</td>`;
                        }).join('');

                        return `<tr><td>${week.weekNum}</td><td>${week.periodStr}</td><td>${week.daysCount}</td>${dayCells}</tr>`;
                    }).join('\n');
                }

                const morningDutyHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${year}학년도 ${sem} 등교 지도 교사 배정표</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap');
  @page { size: A4 portrait; margin: 4mm 6mm; }
  body { font-family: 'Noto Sans KR', sans-serif; color: #0f172a; background-color: #f8fafc; margin: 0; padding: 15px 10px; }
  .page { max-width: 820px; margin: 0 auto; background: #ffffff; padding: 25px 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); box-sizing: border-box; }
  .double-title-container { border-top: 2.5px double #000; border-bottom: 2.5px double #000; padding: 5px 0; text-align: center; margin-bottom: 10px; }
  .double-title { font-size: 19px; font-weight: 900; letter-spacing: -0.5px; }
  ol.rules-list { margin: 0 0 10px 0; padding-left: 18px; font-size: 11px; line-height: 1.45; color: #1e293b; font-weight: 500; }
  ol.rules-list li { margin-bottom: 1.5px; }
  .contact-sub { font-size: 10.5px; color: #475569; margin-left: 8px; margin-top: 1px; }
  table.duty-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10.5px; }
  table.duty-table th, table.duty-table td { border: 1px solid #334155; padding: 3px 2px; text-align: center; height: 21px; }
  table.duty-table th { background-color: #f1f5f9; font-weight: 800; color: #0f172a; }
  /* 회차별 근무 색상 정의: 1회차(연보라), 2회차(연노랑), 3회차(연녹색), 4회차(연하늘) */
  .cell-purple { background-color: #f3e8ff; }
  .cell-yellow { background-color: #fef9c3; }
  .cell-green { background-color: #dcfce7; }
  .cell-blue { background-color: #e0f2fe; }
  .cell-gray { background-color: #e2e8f0; color: #64748b; }
  .print-btn-container { text-align: center; margin-bottom: 12px; }
  .print-btn { background: #2563eb; color: white; border: none; padding: 8px 16px; font-size: 13px; font-weight: 700; border-radius: 8px; cursor: pointer; }
  @media print {
    @page { size: A4 portrait; margin: 4mm 6mm; }
    html, body { background: white; margin: 0; padding: 0; width: 100%; }
    .page { box-shadow: none; padding: 0 !important; margin: 0 !important; max-width: 100% !important; border-radius: 0; }
    .print-btn-container { display: none !important; }
  }
</style>
</head>
<body>
  <div class="print-btn-container">
    <button class="print-btn" onclick="window.print()">PDF 다운로드 / 인쇄하기</button>
  </div>
  <div class="page">
    <div class="double-title-container">
      <div class="double-title">≪ ${year}학년도 ${sem} ≫ 등교 지도 교사 배정표</div>
    </div>
    <ol class="rules-list">
      <li>등교 지도는 한국인 교사 1명으로 운영</li>
      <li>등교 지도 시간: 7시 40분 ~ 8시 20분 (※시간 엄수: 수당 지급 근거)</li>
      <li>등교 지도 시 할 일: 학교 건물 바깥 중앙 출입문에서 학생 맞이 및 차량 하차 후 안전한 학교 진입 유도</li>
      <li>개인 사정으로 등교 지도일 변경 시 일대일 교환(개별적으로) 후 반드시 담당 교사에게 사전 연락
        <div class="contact-sub">
          ☆ 등교 지도 시 위급 상황 발생 시<br/>
          ➔ ${busManagerName === '업무담당교사' ? '업무담당교사(학생 관련 문제)' : `담당교사(${busManagerName}: 학생 관련 문제)`}에게 우선 연락 [☎ 0784207093]<br/>
          ➔ ${healthTeacherName === '보건교사' ? '보건교사(학생 건강 문제)' : `보건교사(${healthTeacherName}: 학생 건강 문제)`}에게 우선 연락 [☎ 0902421953]
        </div>
      </li>
      <li>순번 배정은 교과(전임강사 포함)/고학년/저학년 순으로 순환 배치함</li>
      <li>담당 학급의 특성상 유치원, 도움반, 보건교사는 배정하지 않음</li>
      <li>지도교사 배정표 (${sem})</li>
    </ol>

    <table class="duty-table">
      <thead>
        <tr>
          <th style="width:5%;">주</th>
          <th style="width:14%;">기간</th>
          <th style="width:8%;">등교일</th>
          <th style="width:14.6%;">월</th>
          <th style="width:14.6%;">화</th>
          <th style="width:14.6%;">수</th>
          <th style="width:14.6%;">목</th>
          <th style="width:14.6%;">금</th>
        </tr>
      </thead>
      <tbody>
        ${dutyRowsHtml || '<tr><td colspan="8" style="padding:20px; color:#94a3b8; text-align:center;">배정표 데이터를 불러오는 중이거나 등록된 근무 기록이 없습니다.</td></tr>'}
      </tbody>
    </table>
  </div>
</body>
</html>`;

                // 1. 교사 ID -> 교사 이름 맵
                const teacherMap = new Map((teachersList || []).map((t: Teacher) => [t.id, t.name]));

                // 2. 버스 번호 자연어 정렬용 파서 (1호, 2호, 4호, 5호, 15A호, 16호 ...)
                const parseBusNum = (name: string) => {
                    const clean = name.replace(/^0+/, '').trim();
                    const match = clean.match(/(\d+)([a-zA-Z가-힣]*)/);
                    if (!match) return { num: 9999, suffix: clean };
                    return { num: parseInt(match[1], 10), suffix: match[2] || '' };
                };

                // 3. 버스별 실제 배정 교사 및 운행 노선 추출
                const destMap = new Map((destsList || []).map((d: Destination) => [d.id, d.name]));
                const processedBusesMap = new Map<string, {
                    bus: Bus;
                    busName: string;
                    capacity: string;
                    teacherNames: string[];
                    routeStr: string;
                }>();

                if (busesList && busesList.length > 0) {
                    (busesList || []).forEach((b: Bus) => {
                        // 비활성 버스 제외
                        if (b.isActive === false) return;

                        const rawName = b.name.replace(/^0+/, '').trim();
                        const normalizedName = rawName.endsWith('호') || rawName.endsWith('번') ? rawName : `${rawName}호`;

                        // 해당 버스의 평일 하교 노선
                        const bRoutes = (routesList || []).filter((r: Route) => 
                            r.busId === b.id && 
                            ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && 
                            r.type === 'Afternoon'
                        );

                        // 노선이 없으면 운행 없음으로 간주하여 제외
                        if (bRoutes.length === 0) return;

                        // 1) 교사 관리 탭과 100% 동일하게 routesList의 teacherIds에서만 실제 배정된 교사 추출
                        const routeTeacherIds = Array.from(new Set(bRoutes.flatMap(r => r.teacherIds || []))).filter(Boolean);
                        let assignedNames = routeTeacherIds
                            .map(id => teacherMap.get(id) || (teachersList || []).find(t => t.id === id)?.name)
                            .filter(Boolean) as string[];

                        // 중복 교사명 제거
                        assignedNames = Array.from(new Set(assignedNames));

                        // 2) 미배정 버스는 배정표에 출력하지 않음!
                        if (assignedNames.length === 0) {
                            return;
                        }

                        // 정류장 목록 추출 (중복 제거)
                        const stopNames: string[] = [];
                        bRoutes.forEach((r: Route) => {
                            (r.stops || []).forEach((stId: string) => {
                                const dName = destMap.get(stId);
                                if (dName && !stopNames.includes(dName)) {
                                    stopNames.push(dName);
                                }
                            });
                        });

                        let routeStr = '운행 노선 정보 참조';
                        if (stopNames.length > 0) {
                            if (stopNames.length > 7) {
                                // 너무 길면 2줄 이내로 축약 (앞 4개 + ... + 뒤 2개)
                                const head = stopNames.slice(0, 4).join(' -> ');
                                const tail = stopNames.slice(-2).join(' -> ');
                                routeStr = `${head} -> ... -> ${tail}`;
                            } else {
                                routeStr = stopNames.join(' -> ');
                            }
                        }

                        // 중복 버스 병합
                        if (!processedBusesMap.has(normalizedName) || processedBusesMap.get(normalizedName)!.teacherNames.length < assignedNames.length) {
                            processedBusesMap.set(normalizedName, {
                                bus: b,
                                busName: normalizedName,
                                capacity: b.capacity ? `${b.capacity}인승` : '45인승',
                                teacherNames: assignedNames,
                                routeStr,
                            });
                        }
                    });
                }

                // 4. 자연어 숫자 오름차순 정렬 (1호, 2호, 4호, 5호, 6호 ...)
                const sortedBusItems = Array.from(processedBusesMap.values()).sort((a, b) => {
                    const pa = parseBusNum(a.busName);
                    const pb = parseBusNum(b.busName);
                    if (pa.num !== pb.num) return pa.num - pb.num;
                    return pa.suffix.localeCompare(pb.suffix, 'ko');
                });

                // 5. 인승별 색상 구분 함수 (45인승: 진한 핑크, 29인승: 연초록, 16인승: 옅은 연하늘)
                const getCapacityClass = (capacityStr: string) => {
                    const num = parseInt(capacityStr.replace(/[^0-9]/g, ''), 10) || 45;
                    if (num >= 40) return 'row-45'; // 45인승 (학생 수가 가장 많은 대형 버스)
                    if (num >= 25) return 'row-29'; // 29인승 (중간 규모 버스)
                    return 'row-16'; // 16인승 (학생 수가 적은 소형 버스)
                };

                const dynamicRowsHtml = sortedBusItems.length > 0 
                    ? sortedBusItems.map((item, idx) => {
                        const cls = getCapacityClass(item.capacity);
                        const teacherStr = item.teacherNames.join(', ');
                        return `<tr class="${cls}"><td>${idx + 1}</td><td>${item.busName}</td><td>${item.capacity}</td><td style="font-weight:700;">${teacherStr}</td><td class="route-cell">${item.routeStr}</td></tr>`;
                    }).join('\n')
                    : '<tr><td colspan="5" style="padding:20px; color:#94a3b8; text-align:center;">배정된 운행 버스가 없습니다.</td></tr>';

                const busTeacherHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${year}학년도 ${sem} 등하교 차량 지도 교사 배정표</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap');
  @page { size: A4 portrait; margin: 4mm 5mm; }
  body { font-family: 'Noto Sans KR', sans-serif; color: #0f172a; background-color: #f8fafc; margin: 0; padding: 4px 2px; }
  .page { max-width: 820px; margin: 0 auto; background: #ffffff; padding: 12px 16px; border-radius: 8px; box-sizing: border-box; }
  .double-title-container { border-top: 2.5px double #000; border-bottom: 2.5px double #000; padding: 3px 0; text-align: center; margin-bottom: 5px; }
  .double-title { font-size: 16.5px; font-weight: 900; letter-spacing: -0.5px; }
  ol.rules-list { margin: 0 0 5px 0; padding-left: 15px; font-size: 9.3px; line-height: 1.3; color: #1e293b; font-weight: 600; }
  ol.rules-list li { margin-bottom: 0.5px; }
  table.bus-table { width: 100%; border-collapse: collapse; font-size: 8.8px; }
  table.bus-table th, table.bus-table td { border: 1px solid #475569; padding: 1.5px 2px; text-align: center; height: 18px; }
  table.bus-table th { background-color: #f1f5f9; font-weight: 800; color: #0f172a; font-size: 9.2px; }
  /* 인승별 색상 구분: 학생 수가 많은 대형 버스는 진한 색, 소형 버스는 옅은 색 */
  .row-45 { background-color: #fce7f3; } /* 45인승: 핑크 */
  .row-29 { background-color: #dcfce7; } /* 29인승: 연초록 */
  .row-16 { background-color: #f0f9ff; } /* 16인승: 옅은 연하늘 */
  .route-cell { text-align: left; font-family: sans-serif; font-size: 8.4px; padding: 1px 3px; color: #1e293b; line-height: 1.25; max-height: 2.5em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
  .footer-note { margin-top: 4px; font-size: 9px; font-weight: 700; color: #0f172a; }
  .print-btn-container { text-align: center; margin-bottom: 6px; }
  .print-btn { background: #2563eb; color: white; border: none; padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 6px; cursor: pointer; }
  @media print {
    @page { size: A4 portrait; margin: 4mm 5mm; }
    html, body { background: white; margin: 0; padding: 0; width: 100%; }
    .page { box-shadow: none; padding: 0 !important; margin: 0 !important; max-width: 100% !important; border-radius: 0; }
    .print-btn-container { display: none !important; }
  }
</style>
</head>
<body>
  <div class="print-btn-container">
    <button class="print-btn" onclick="window.print()">PDF 다운로드 / 인쇄하기</button>
  </div>
  <div class="page">
    <div class="double-title-container">
      <div class="double-title">≪ ${year}학년도 ${sem} ≫ 등하교 차량 지도 교사 배정표</div>
    </div>
    <ol class="rules-list">
      <li>★차량 번호로 담당 버스 확인 (노선은 학기초 임시 운영 노선으로 변동 가능)</li>
      <li>전 차량 15시 정각 학교 출발(지도 교사 시간 준수)</li>
      <li>담당교사는 탑승 인원 및 학생 안전을 고려하여 배정되었습니다.</li>
      <li>노선 최종 확정 후 차장(학생도우미) 선출 후 명단 제출(차장 활동 업무 담당: ${busManagerName} )</li>
      <li>배정제외인원: 학급 및 업무 특성(도움반, 보건교사), 상지도 및 대기 교사( ${busManagerName} )</li>
    </ol>

    <table class="bus-table">
      <thead>
        <tr>
          <th style="width:4%;">순</th>
          <th style="width:8%;">차량번호</th>
          <th style="width:7%;">인승</th>
          <th style="width:14%;">담당교사</th>
          <th>${year}학년도 ${sem} 운행 노선</th>
        </tr>
      </thead>
      <tbody>
${dynamicRowsHtml}
      </tbody>
    </table>
    <div class="footer-note">*행정실(버스업체) 사정 등으로 노선 및 담당교사가 일부 변경될 수 있음</div>
  </div>
</body>
</html>`;

                if (isSecondSemester) {
                    // 2학기에는 붙임 1 (차량 지도 계획 1부) 생략
                    return [
                        {
                            name: `붙임 1. ${year}학년도 ${sem} 등교 지도교사 배정표.html`,
                            size: morningDutyHtml.length * 2,
                            data: 'data:text/html;charset=utf-8,' + encodeURIComponent(morningDutyHtml)
                        },
                        {
                            name: `붙임 2. ${year}학년도 ${sem} 등하교 차량 지도교사 배정표.html`,
                            size: busTeacherHtml.length * 2,
                            data: 'data:text/html;charset=utf-8,' + encodeURIComponent(busTeacherHtml)
                        }
                    ];
                }

                // 1학기 및 기타 학기: 붙임 1, 2, 3 전체 첨부
                return [
                    {
                        name: `붙임 1. ${year}학년도 유·초등 등하교 차량 지도 계획.html`,
                        size: planHtml.length * 2,
                        data: 'data:text/html;charset=utf-8,' + encodeURIComponent(planHtml)
                    },
                    {
                        name: `붙임 2. ${year}학년도 ${sem} 등교 지도교사 배정표.html`,
                        size: morningDutyHtml.length * 2,
                        data: 'data:text/html;charset=utf-8,' + encodeURIComponent(morningDutyHtml)
                    },
                    {
                        name: `붙임 3. ${year}학년도 ${sem} 등하교 차량 지도교사 배정표.html`,
                        size: busTeacherHtml.length * 2,
                        data: 'data:text/html;charset=utf-8,' + encodeURIComponent(busTeacherHtml)
                    }
                ];
            }
        },
        {
            id: 2,
            title: '00학년도 0학기 학생 차량 안전 도우미(차장) 봉사활동 시간 인정',
            displayTitle: (year: string, sem: string) => `${year}학년도 ${sem} 학생 차량 안전 도우미(차장) 봉사활동 시간 인정`,
            category: '학생 봉사활동 실적 인정 결재',
            description: '동승 학생 안전 도우미(학생 차장) 봉사활동 실적 승인 및 생활기록부 기록 기안문',
            badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            templateContent: (year: string, sem: string, calConfig?: AcademicCalendarConfig) => {
                const isSecondSemester = sem.includes('2학기');
                const semesterObj = isSecondSemester ? calConfig?.semesters?.sem2 : calConfig?.semesters?.sem1;

                const formatDotDate = (dateStr?: string, defaultFallback = '') => {
                    if (!dateStr) return defaultFallback;
                    try {
                        const d = new Date(dateStr);
                        if (isNaN(d.getTime())) return defaultFallback;
                        return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}.`;
                    } catch {
                        return defaultFallback;
                    }
                };

                const yearNum = parseInt(year, 10) || 2026;
                const defaultStart = isSecondSemester ? `${yearNum}.8.24.` : `${yearNum}.4.6.`;
                const defaultEnd = isSecondSemester ? `${yearNum}.12.31.` : `${yearNum}.7.13.`;

                const startFormatted = formatDotDate(semesterObj?.startDate, defaultStart);
                const endFormatted = formatDotDate(semesterObj?.endDate, defaultEnd);

                return `<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 0px;">1. &nbsp;관련: ${year}학년도 ${sem} 유·초등 등하교 차량 지도 계획 수립(kish-초등-47[${year}. 3. 10.])</p>` +
`<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 0px;">2. &nbsp;위 호에 의거하여 ${year}학년도 ${sem} 학생 차량 안전 도우미(차장)의 봉사활동 시간을 다음과 같이 인정하고 학교생활기록부에 기록하고자 합니다.</p>` +
`<p style="line-height: 1.8; margin-bottom: 6px; font-weight: normal; margin-left: 20px;">가. &nbsp;대상: 1호차 차장 6-6 김안나 등 42명</p>` +
`<p style="line-height: 1.8; margin-bottom: 6px; font-weight: normal; margin-left: 20px;">나. &nbsp;봉사활동 인정 시간: 8시간 [${startFormatted}~ ${endFormatted}]</p>` +
`<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 20px;">다. &nbsp;활동영역: 이웃돕기활동</p>` +
`<div style="margin-top: 24px; line-height: 1.8; font-weight: normal;">` +
`<p style="margin-bottom: 4px; margin-left: 0px;">붙임 &nbsp;&nbsp;${year}학년도 ${sem} 학생 차량 안전 도우미(차장) 명단 1부. &nbsp;&nbsp;끝.</p>` +
`</div>`;
            },
            attachmentsGenerator: (year: string, sem: string, calConfig?: AcademicCalendarConfig) => {
                const isSecondSemester = sem.includes('2학기');
                const semesterObj = isSecondSemester ? calConfig?.semesters?.sem2 : calConfig?.semesters?.sem1;

                const formatDotDate = (dateStr?: string, defaultFallback = '') => {
                    if (!dateStr) return defaultFallback;
                    try {
                        const d = new Date(dateStr);
                        if (isNaN(d.getTime())) return defaultFallback;
                        return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}.`;
                    } catch {
                        return defaultFallback;
                    }
                };

                const yearNum = parseInt(year, 10) || 2026;
                const defaultStart = isSecondSemester ? `${yearNum}.8.24.` : `${yearNum}.4.6.`;
                const defaultEnd = isSecondSemester ? `${yearNum}.12.31.` : `${yearNum}.7.13.`;

                const startFormatted = formatDotDate(semesterObj?.startDate, defaultStart);
                const endFormatted = formatDotDate(semesterObj?.endDate, defaultEnd);
                const periodStr = `${startFormatted} ~ ${endFormatted}`;

                const groupLeaders = [
                    { busNo: '1호차', grade: '6', class: '6', name: '김안나', gender: '여' },
                    { busNo: '1호차', grade: '6', class: '6', name: '박현영', gender: '여' },
                    { busNo: '2호차', grade: '6', class: '4', name: '권순흰', gender: '여' },
                    { busNo: '2호차', grade: '6', class: '5', name: '이은채', gender: '여' },
                    { busNo: '4호차', grade: '6', class: '1', name: '문지유', gender: '여' },
                    { busNo: '4호차', grade: '6', class: '1', name: '곽서후', gender: '남' },
                    { busNo: '5호차', grade: '6', class: '4', name: '황윤허', gender: '남' },
                    { busNo: '5호차', grade: '6', class: '4', name: '김서율', gender: '여' },
                    { busNo: '6호차', grade: '6', class: '2', name: '박준호', gender: '남' },
                    { busNo: '6호차', grade: '6', class: '3', name: '최지우', gender: '여' },
                    { busNo: '8호차', grade: '6', class: '5', name: '이민준', gender: '남' },
                    { busNo: '8호차', grade: '6', class: '5', name: '정유나', gender: '여' },
                    { busNo: '9호차', grade: '6', class: '1', name: '강동현', gender: '남' },
                    { busNo: '9호차', grade: '6', class: '2', name: '윤하은', gender: '여' },
                    { busNo: '10호차', grade: '6', class: '3', name: '임도윤', gender: '남' },
                    { busNo: '10호차', grade: '6', class: '6', name: '한서연', gender: '여' },
                    { busNo: '11호차', grade: '6', class: '4', name: '송지호', gender: '남' },
                    { busNo: '11호차', grade: '6', class: '4', name: '신아린', gender: '여' },
                    { busNo: '12호차', grade: '6', class: '5', name: '오건우', gender: '남' },
                    { busNo: '12호차', grade: '6', class: '5', name: '장예원', gender: '여' },
                    { busNo: '14호차', grade: '6', class: '1', name: '조유준', gender: '남' },
                    { busNo: '14호차', grade: '6', class: '2', name: '배수아', gender: '여' },
                    { busNo: '15호차', grade: '6', class: '3', name: '백시우', gender: '남' },
                    { busNo: '15호차', grade: '6', class: '6', name: '서다인', gender: '여' },
                    { busNo: '15A호차', grade: '6', class: '4', name: '권태윤', gender: '남' },
                    { busNo: '16호차', grade: '6', class: '5', name: '유하준', gender: '남' },
                    { busNo: '17호차', grade: '6', class: '1', name: '황지후', gender: '남' },
                    { busNo: '18호차', grade: '6', class: '2', name: '안소율', gender: '여' },
                    { busNo: '19호차', grade: '6', class: '3', name: '홍주원', gender: '남' },
                    { busNo: '20호차', grade: '6', class: '4', name: '고은서', gender: '여' },
                    { busNo: '22호차', grade: '6', class: '5', name: '문예준', gender: '남' },
                    { busNo: '23호차', grade: '6', class: '6', name: '양채원', gender: '여' },
                    { busNo: '24호차', grade: '6', class: '1', name: '손현우', gender: '남' },
                    { busNo: '25호차', grade: '6', class: '2', name: '노지아', gender: '여' },
                    { busNo: '27호차', grade: '6', class: '3', name: '허도현', gender: '남' },
                    { busNo: '28호차', grade: '6', class: '4', name: '남윤아', gender: '여' },
                    { busNo: '30호차', grade: '6', class: '5', name: '심우진', gender: '남' },
                    { busNo: '34호차', grade: '6', class: '6', name: '하민서', gender: '여' },
                    { busNo: '35호차', grade: '6', class: '1', name: '곽준서', gender: '남' },
                    { busNo: '37호차', grade: '6', class: '2', name: '임예은', gender: '여' },
                    { busNo: '38호차', grade: '6', class: '3', name: '정시우', gender: '남' },
                    { busNo: '40호차', grade: '6', class: '4', name: '채아린', gender: '여' }
                ];

                const leaderRowsHtml = groupLeaders.map((r, idx) => 
                    `<tr><td>${idx + 1}</td><td>${r.busNo}</td><td>${r.grade}학년 ${r.class}반</td><td>${r.name}</td><td>${r.gender}</td><td>8시간</td><td>${periodStr}</td></tr>`
                ).join('\n');

                const volunteerListHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${year}학년도 ${sem} 학생 차량 안전 도우미(차장) 명단</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap');
  @page { size: A4 portrait; margin: 4mm 6mm; }
  body { font-family: 'Noto Sans KR', sans-serif; color: #0f172a; background-color: #f8fafc; margin: 0; padding: 12px 8px; }
  .page { max-width: 820px; margin: 0 auto; background: #ffffff; padding: 20px 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); box-sizing: border-box; }
  .double-title-container { border-top: 2.5px double #000; border-bottom: 2.5px double #000; padding: 6px 0; text-align: center; margin-bottom: 12px; }
  .double-title { font-size: 19px; font-weight: 900; letter-spacing: -0.5px; }
  table.v-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
  table.v-table th, table.v-table td { border: 1px solid #334155; padding: 3px 4px; text-align: center; }
  table.v-table th { background-color: #ecfdf5; font-weight: 800; color: #065f46; font-size: 10.5px; }
  .footer-note { margin-top: 10px; font-size: 10.5px; color: #334155; font-weight: 500; text-align: left; }
  .print-btn-container { text-align: center; margin-bottom: 10px; }
  .print-btn { background: #059669; color: white; border: none; padding: 8px 16px; font-size: 13px; font-weight: 700; border-radius: 8px; cursor: pointer; }
  @media print {
    @page { size: A4 portrait; margin: 4mm 6mm; }
    html, body { background: white; margin: 0; padding: 0; width: 100%; }
    .page { box-shadow: none; padding: 0 !important; margin: 0 !important; max-width: 100% !important; border-radius: 0; }
    .print-btn-container { display: none !important; }
  }
</style>
</head>
<body>
  <div class="print-btn-container">
    <button class="print-btn" onclick="window.print()">PDF 다운로드 / 인쇄하기</button>
  </div>
  <div class="page">
    <div class="double-title-container">
      <div class="double-title">≪ ${year}학년도 ${sem} ≫ 학생 차량 안전 도우미(차장) 명단</div>
    </div>

    <table class="v-table">
      <thead>
        <tr>
          <th style="width:7%;">순번</th>
          <th style="width:12%;">차량번호</th>
          <th style="width:14%;">소속 학급</th>
          <th style="width:15%;">학생 성명</th>
          <th style="width:10%;">성별</th>
          <th style="width:16%;">봉사 인정시간</th>
          <th>봉사활동 인정기간</th>
        </tr>
      </thead>
      <tbody>
${leaderRowsHtml}
      </tbody>
    </table>
    <div class="footer-note">*특이사항 없는 차장의 경우 8시간 봉사 시간(봉사 내용: 학생 차량 안전 도우미, 영역: 이웃돕기활동) 부여</div>
  </div>
</body>
</html>`;

                return [
                    {
                        name: `${year}학년도 ${sem} 학생 차량 안전 도우미(차장) 명단.html`,
                        size: volunteerListHtml.length * 2,
                        data: 'data:text/html;charset=utf-8,' + encodeURIComponent(volunteerListHtml)
                    }
                ];
            }
        },
        {
            id: 3,
            title: '00학년도 0학기 및 00방학 등교 지도(교문) 교사 활동 수당 지급 근거',
            displayTitle: (year: string, sem: string) => `${year}학년도 ${sem} 등교 지도(교문) 교사 활동 수당 지급 근거`,
            category: '교원 등교 지도 활동 수당 지급 결재',
            description: '아침 07:40 ~ 08:20 교문 등교 지도를 전담 수행한 교원에 대한 활동 실적 확인 및 수당 지급 예산 집행 결재',
            badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
            templateContent: (year: string, sem: string, calConfig?: AcademicCalendarConfig) => {
                const opPeriodStr = getOperatingPeriodString(year, sem, calConfig);
                const isFirstSem = sem.includes('1학기');
                const vacationLabel = isFirstSem ? '여름방학' : '겨울방학';
                return `<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 0px;">1. &nbsp;${year}학년도 ${sem} 및 ${vacationLabel} 아침 정문 등교 지도를 수행하는 담당 교원의 활동 수당 지급 집행 계획을 붙임과 같이 제출하고자 합니다.</p>` +
`<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 20px;">가. &nbsp;근무 시간: 매주 월요일~금요일 07:40~08:20 (40분간)</p>` +
`<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 20px;">나. &nbsp;근무 기간: ${opPeriodStr} (${sem} 및 ${vacationLabel})</p>` +
`<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 20px;">다. &nbsp;근무 장소: 학교 정문 및 승하차 지도 구역</p>` +
`<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 20px;">라. &nbsp;예산 과목: 스쿨버스 운영비 - 교원 학생 지도 수당</p>` +
`<div style="margin-top: 24px; line-height: 1.8; font-weight: normal;">` +
`<p style="margin-bottom: 4px; margin-left: 0px;">붙임 &nbsp;&nbsp;1. &nbsp;${year}학년도 ${sem} 및 ${vacationLabel} 등교 지도(교문) 교사 수당 지급 집행 계획 1부.</p>` +
`<p style="margin-bottom: 4px; margin-left: 56px;">2. &nbsp;${year}학년도 ${sem} 등교 지도 교사 일자별 근무 수불부 1부.</p>` +
`<p style="margin-bottom: 4px; margin-left: 56px;">3. &nbsp;${year}학년도 ${vacationLabel} 등교 지도 교사 일자별 근무 수불부 1부. &nbsp;&nbsp;끝.</p>` +
`</div>`;
            },
            // typeId 3: attachments are generated dynamically in handleCreateBusDocDraft (no static generator)
        }
    ];

    const handleCreateBusDocDraft = async (typeId: number) => {
        if (typeId === 2) {
            setIsBusDocModalOpen(false);
            try {
                toast({ title: '실제 차장 명부 조회 중...', description: 'DB에서 동승 학생 차장 명단을 불러옵니다.' });
                const latestBuses = buses && buses.length > 0 ? buses : await getBuses();
                const latestStudents = students && students.length > 0 ? students : await getStudents();
                const dbLeaders = await getAllGroupLeaderRecords(latestBuses, latestStudents);
                if (dbLeaders && dbLeaders.length > 0) {
                    setEditableLeaders(dbLeaders);
                } else {
                    setEditableLeaders([]);
                    toast({ title: '실제 차장 명단 조회', description: 'DB에 활성화된 차장(조장) 기록이 없어 명단이 비어있습니다. [학생 추가] 양식으로 직접 등록할 수 있습니다.' });
                }
            } catch (err) {
                console.error("Failed to load group leaders from DB:", err);
                setEditableLeaders([]);
            }
            setIsLeaderModalOpen(true);
            return;
        }

        // ─── typeId 3: 등교지도 수당 지급 기안 — 실제 배정표 기반 수불부 생성 ────────
        if (typeId === 3) {
            setIsBusDocModalOpen(false);
            toast({ title: '등교 지도 배정표 조회 중...', description: 'Firestore에서 실제 교사 배정표를 불러옵니다.' });

            const isSecond = docSemesterName.includes('2학기') || docSemesterName.includes('2');
            const isSummer = docSemesterName.includes('여름');
            const isWinter = docSemesterName.includes('겨울');
            const vacationLabel = isSecond || isWinter ? '겨울방학' : '여름방학';
            const semId = isSecond ? `${docAcademicYear}_2` : isSummer ? `${docAcademicYear}_summer` : isWinter ? `${docAcademicYear}_winter` : `${docAcademicYear}_1`;
            const vacId = isSecond || isWinter ? `${docAcademicYear}_winter` : `${docAcademicYear}_summer`;

            // HTML 공통 스타일
            const commonStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap');
  body { font-family: 'Noto Sans KR', sans-serif; color: #0f172a; background-color: #f8fafc; margin: 0; padding: 25px 15px; }
  .page { max-width: 820px; margin: 0 auto; background: #ffffff; padding: 36px 45px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); box-sizing: border-box; }
  .double-title-container { border-top: 3px double #000; border-bottom: 3px double #000; padding: 8px 0; text-align: center; margin-bottom: 16px; }
  .double-title { font-size: 19px; font-weight: 900; }
  .summary-box { display: flex; gap: 24px; background: #f8f4ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 10px 16px; margin-bottom: 14px; font-size: 12px; color: #4c1d95; font-weight: 700; }
  table.s-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  table.s-table th, table.s-table td { border: 1px solid #475569; padding: 6px 8px; text-align: center; }
  table.s-table th { background-color: #ede9fe; font-weight: 800; color: #4c1d95; }
  table.s-table tr:nth-child(even) td { background-color: #faf9ff; }
  .total-row td { font-weight: 800; background-color: #f0fdf4 !important; color: #166534; }
  .print-btn-container { text-align: center; margin-bottom: 14px; }
  .print-btn { background: #7c3aed; color: white; border: none; padding: 9px 18px; font-size: 13px; font-weight: 700; border-radius: 8px; cursor: pointer; }
  @media print { body { background: white; padding: 0; } .page { box-shadow: none; padding: 10px; } .print-btn-container { display: none; } }`;

            // WeekDutyRow[] → 수불부 HTML 행 생성 함수
            const buildLedgerRowsHtml = (rows: any[]): { html: string; totalCount: number } => {
                const dayKeys = ['월', '화', '수', '목', '금'];
                let rowsHtml = '';
                let totalCount = 0;
                let rowIndex = 1;

                for (const week of rows) {
                    for (const dayKey of dayKeys) {
                        const slot = week.days?.[dayKey];
                        if (!slot || slot.isHoliday || !slot.teacherName) continue;

                        const dateObj = new Date(slot.dateStr);
                        const dateFmt = `${dateObj.getFullYear()}. ${dateObj.getMonth() + 1}. ${dateObj.getDate()}.`;
                        rowsHtml += `<tr>
                            <td>${rowIndex}</td>
                            <td>${dateFmt}</td>
                            <td>(${dayKey})</td>
                            <td>${slot.teacherName} 교사</td>
                            <td>07:40~08:20</td>
                            <td>140,000 VND</td>
                            <td></td>
                        </tr>`;
                        totalCount++;
                        rowIndex++;
                    }
                }
                return { html: rowsHtml, totalCount };
            };

            // 수불부 HTML 빌더
            const buildLedgerHtml = (titleLabel: string, rows: any[], semName: string) => {
                const { html: rowsHtml, totalCount } = buildLedgerRowsHtml(rows);
                const totalAmt = (totalCount * 140000).toLocaleString('ko-KR');
                return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${titleLabel}</title>
<style>${commonStyle}</style>
</head>
<body>
  <div class="print-btn-container">
    <button class="print-btn" onclick="window.print()">PDF 다운로드 / 인쇄하기</button>
  </div>
  <div class="page">
    <div class="double-title-container">
      <div class="double-title">≪ ${docAcademicYear}학년도 ${semName} ≫ 등교 지도 교사 일자별 근무 수불부</div>
    </div>
    <div class="summary-box">
      <span>⏰ 근무 시간: 07:40~08:20 (40분)</span>
      <span>👩‍🏫 총 근무 횟수: ${totalCount}회</span>
      <span>💰 총 지급 금액: ${totalAmt} VND</span>
    </div>
    <table class="s-table">
      <thead>
        <tr>
          <th style="width:5%">번호</th>
          <th style="width:16%">일 자</th>
          <th style="width:7%">요일</th>
          <th style="width:20%">담당 교사</th>
          <th style="width:15%">근무 시간</th>
          <th style="width:17%">지급 금액</th>
          <th>서 명</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="7" style="text-align:center; color:#999; padding:20px;">배정표 데이터를 불러오는 중 오류가 발생했거나 근무 기록이 없습니다.</td></tr>'}
        <tr class="total-row">
          <td colspan="5" style="text-align:right; padding-right:16px;">합 계</td>
          <td>${totalAmt} VND</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
            };

            // Firestore에서 배정표 로드
            let semRows: any[] = [];
            let vacRows: any[] = [];
            let semPeriodStr = '';
            let vacPeriodStr = '';
            try {
                const dutySnap = await getDoc(doc(db(), 'config', 'morningGateDutyMulti'));
                if (dutySnap.exists()) {
                    const dutyData = dutySnap.data() as any;
                    semRows = dutyData?.schedules?.[semId] || [];
                    vacRows = dutyData?.schedules?.[vacId] || [];

                    const semInfo = dutyData?.semesters?.[semId];
                    const vacInfo = dutyData?.semesters?.[vacId];
                    if (semInfo?.startDate && semInfo?.endDate) {
                        const s = new Date(semInfo.startDate);
                        const e = new Date(semInfo.endDate);
                        semPeriodStr = `${s.getFullYear()}.${s.getMonth()+1}.${s.getDate()}. ~ ${e.getFullYear()}.${e.getMonth()+1}.${e.getDate()}.`;
                    }
                    if (vacInfo?.startDate && vacInfo?.endDate) {
                        const s = new Date(vacInfo.startDate);
                        const e = new Date(vacInfo.endDate);
                        vacPeriodStr = `${s.getFullYear()}.${s.getMonth()+1}.${s.getDate()}. ~ ${e.getFullYear()}.${e.getMonth()+1}.${e.getDate()}.`;
                    }
                } else {
                    toast({ variant: 'destructive', title: '배정표 없음', description: '등교 지도 배정표가 Firestore에 저장되어 있지 않습니다. 먼저 배정표를 생성해주세요.' });
                }
            } catch (err) {
                console.error('Failed to load duty schedule from Firestore:', err);
                toast({ variant: 'destructive', title: '배정표 로드 오류', description: '등교 지도 배정표를 불러오는 중 오류가 발생했습니다.' });
            }

            // 집행 계획서 HTML
            const opPeriodStr = semPeriodStr && vacPeriodStr 
                ? `${semPeriodStr} (${docSemesterName}), ${vacPeriodStr} (${vacationLabel})`
                : getOperatingPeriodString(docAcademicYear, docSemesterName, docConfig.academicCalendar);

            const stipendPlanHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${docAcademicYear}학년도 ${docSemesterName} 및 ${vacationLabel} 등교 지도(교문) 교사 수당 지급 집행 계획</title>
<style>${commonStyle}
  .header-title { font-size: 21px; font-weight: 800; text-align: center; color: #0f172a; margin-bottom: 4px; }
  .section-badge { display: inline-flex; align-items: center; background-color: #6d28d9; color: #fff; font-weight: 800; font-size: 13px; padding: 3px 12px; border-radius: 20px; margin-top: 18px; margin-bottom: 8px; }
  p { font-size: 13px; line-height: 1.7; color: #334155; margin: 4px 0 4px 12px; }
</style>
</head>
<body>
  <div class="print-btn-container">
    <button class="print-btn" onclick="window.print()">PDF 다운로드 / 인쇄하기</button>
  </div>
  <div class="page">
    <div class="header-title">${docAcademicYear}학년도 ${docSemesterName} 및 ${vacationLabel} 등교 지도(교문) 교사 수당 지급 집행 계획</div>
    <hr style="border-top:2px solid #7c3aed; margin: 10px 0 20px;">
    <div class="section-badge">1. 목 적</div>
    <p>아침 정문 등교 지도 교사의 노고 격려 및 규정에 따른 활동 수당 지급 집행.</p>
    <div class="section-badge">2. 집행 내용</div>
    <p>가. 근무 시간: 매주 월요일~금요일 07:40~08:20 (40분간)</p>
    <p>나. 근무 기간: <strong>${opPeriodStr}</strong></p>
    <p>다. 지급 단가: 1회 등교 지도당 140,000VND</p>
    <p>라. 지급 대상: 배정표에 따라 실제 등교 지도를 수행한 교사</p>
  </div>
</body>
</html>`;

            const semLedgerHtml = buildLedgerHtml(
                `${docAcademicYear}학년도 ${docSemesterName} 등교 지도 교사 일자별 근무 수불부`,
                semRows,
                docSemesterName
            );
            const vacLedgerHtml = buildLedgerHtml(
                `${docAcademicYear}학년도 ${vacationLabel} 등교 지도 교사 일자별 근무 수불부`,
                vacRows,
                vacationLabel
            );

            const docType3 = BUS_DOCUMENT_TYPES.find(d => d.id === 3)!;
            const title = docType3.displayTitle(docAcademicYear, docSemesterName);
            const content = docType3.templateContent(docAcademicYear, docSemesterName, docConfig.academicCalendar);
            const attachments = [
                {
                    name: `붙임 1. ${docAcademicYear}학년도 ${docSemesterName} 및 ${vacationLabel} 등교 지도(교문) 교사 수당 지급 집행 계획.html`,
                    size: stipendPlanHtml.length * 2,
                    data: 'data:text/html;charset=utf-8,' + encodeURIComponent(stipendPlanHtml)
                },
                {
                    name: `붙임 2. ${docAcademicYear}학년도 ${docSemesterName} 등교 지도 교사 일자별 근무 수불부.html`,
                    size: semLedgerHtml.length * 2,
                    data: 'data:text/html;charset=utf-8,' + encodeURIComponent(semLedgerHtml)
                },
                {
                    name: `붙임 3. ${docAcademicYear}학년도 ${vacationLabel} 등교 지도 교사 일자별 근무 수불부.html`,
                    size: vacLedgerHtml.length * 2,
                    data: 'data:text/html;charset=utf-8,' + encodeURIComponent(vacLedgerHtml)
                }
            ];

            sessionStorage.setItem('pending_doc_draft', JSON.stringify({ title, content, attachments }));
            setIsBusDocModalOpen(false);
            router.push('/new?busTemplate=true');
            toast({ title: '등교지도 수당 기안 생성', description: `[${title}] 양식으로 기안 작성이 구동됩니다. (붙임 3개 — 계획서 + ${docSemesterName} 수불부 + ${vacationLabel} 수불부)` });
            return;
        }


        const docType = BUS_DOCUMENT_TYPES.find(d => d.id === typeId);
        if (!docType) return;

        let loadedOrgStructure: OrgStructure | Partial<OrgStructure> | undefined = undefined;
        let loadedUsers: UserProfile[] | undefined = undefined;
        let dutyScheduleRows: any[] = [];
        try {
            loadedOrgStructure = await getOrgStructure();
            loadedUsers = await getUsersDirectory();

            const dutySnap = await getDoc(doc(db(), 'config', 'morningGateDutyMulti'));
            if (dutySnap.exists()) {
                const dutyData = dutySnap.data() as any;
                const isSecond = docSemesterName.includes('2학기') || docSemesterName.includes('2');
                const isSummer = docSemesterName.includes('여름');
                const isWinter = docSemesterName.includes('겨울');
                const semId = isSecond ? `${docAcademicYear}_2` : isSummer ? `${docAcademicYear}_summer` : isWinter ? `${docAcademicYear}_winter` : `${docAcademicYear}_1`;
                dutyScheduleRows = dutyData?.schedules?.[semId] || dutyData?.schedules?.[`${docAcademicYear}_1`] || [];
            }
        } catch (err) {
            console.error("Failed to load duty schedules for doc generation:", err);
        }

        const title = docType.displayTitle(docAcademicYear, docSemesterName);
        const content = docType.templateContent(docAcademicYear, docSemesterName, docConfig.academicCalendar);
        const attachments = docType.attachmentsGenerator 
            ? docType.attachmentsGenerator(docAcademicYear, docSemesterName, docConfig.academicCalendar, buses, routes, destinations, teachers, loadedOrgStructure, loadedUsers, dutyScheduleRows) 
            : [];
        
        sessionStorage.setItem('pending_doc_draft', JSON.stringify({ title, content, attachments }));
        setIsBusDocModalOpen(false);
        router.push('/new?busTemplate=true');
        toast({ title: '스쿨버스 공문서 기안 생성', description: `[${title}] 양식으로 기안 작성이 구동됩니다.` });
    };

    const handleConfirmAndCreateVolunteerDoc = () => {
        if (editableLeaders.length === 0) {
            toast({ variant: 'destructive', title: '경고', description: '최소 1명 이상의 차장 학생이 명단에 포함되어야 합니다.' });
            return;
        }

        const docType = BUS_DOCUMENT_TYPES.find(d => d.id === 2);
        if (!docType) return;

        const isSecondSemester = docSemesterName.includes('2학기');
        const calConfig = docConfig.academicCalendar;
        const semesterObj = isSecondSemester ? calConfig?.semesters?.sem2 : calConfig?.semesters?.sem1;

        const formatDotDate = (dateStr?: string, defaultFallback = '') => {
            if (!dateStr) return defaultFallback;
            try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return defaultFallback;
                return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}.`;
            } catch {
                return defaultFallback;
            }
        };

        const yearNum = parseInt(docAcademicYear, 10) || 2026;
        const defaultStart = isSecondSemester ? `${yearNum}.8.24.` : `${yearNum}.4.6.`;
        const defaultEnd = isSecondSemester ? `${yearNum}.12.31.` : `${yearNum}.7.13.`;

        const startFormatted = formatDotDate(semesterObj?.startDate, defaultStart);
        const endFormatted = formatDotDate(semesterObj?.endDate, defaultEnd);
        const periodStr = `${startFormatted} ~ ${endFormatted}`;

        const firstStudent = editableLeaders[0];
        const firstLeaderDisplay = `${firstStudent.busNo} 차장 ${firstStudent.grade}-${firstStudent.class} ${firstStudent.name}`;

        const title = docType.displayTitle(docAcademicYear, docSemesterName);
        
        const content = `<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 0px;">1. &nbsp;관련: ${docAcademicYear}학년도 ${docSemesterName} 유·초등 등하교 차량 지도 계획 수립(kish-초등-47[${docAcademicYear}. 3. 10.])</p>` +
`<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 0px;">2. &nbsp;위 호에 의거하여 ${docAcademicYear}학년도 ${docSemesterName} 학생 차량 안전 도우미(차장)의 봉사활동 시간을 다음과 같이 인정하고 학교생활기록부에 기록하고자 합니다.</p>` +
`<p style="line-height: 1.8; margin-bottom: 6px; font-weight: normal; margin-left: 20px;">가. &nbsp;대상: ${firstLeaderDisplay} 등 ${editableLeaders.length}명</p>` +
`<p style="line-height: 1.8; margin-bottom: 6px; font-weight: normal; margin-left: 20px;">나. &nbsp;봉사활동 인정 시간: 8시간 [${startFormatted}~ ${endFormatted}]</p>` +
`<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 20px;">다. &nbsp;활동영역: 이웃돕기활동</p>` +
`<div style="margin-top: 24px; line-height: 1.8; font-weight: normal;">` +
`<p style="margin-bottom: 4px; margin-left: 0px;">붙임 &nbsp;&nbsp;${docAcademicYear}학년도 ${docSemesterName} 학생 차량 안전 도우미(차장) 명단 1부. &nbsp;&nbsp;끝.</p>` +
`</div>`;

        const leaderRowsHtml = editableLeaders.map((r, idx) => 
            `<tr><td>${idx + 1}</td><td>${r.busNo}</td><td>${r.grade}학년 ${r.class}반</td><td>${r.name}</td><td>${r.gender}</td><td>${r.hours}</td><td>${periodStr}</td></tr>`
        ).join('\n');

        const volunteerListHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${docAcademicYear}학년도 ${docSemesterName} 학생 차량 안전 도우미(차장) 명단</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap');
  @page { size: A4 portrait; margin: 4mm 6mm; }
  body { font-family: 'Noto Sans KR', sans-serif; color: #0f172a; background-color: #f8fafc; margin: 0; padding: 12px 8px; }
  .page { max-width: 820px; margin: 0 auto; background: #ffffff; padding: 20px 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); box-sizing: border-box; }
  .double-title-container { border-top: 2.5px double #000; border-bottom: 2.5px double #000; padding: 6px 0; text-align: center; margin-bottom: 12px; }
  .double-title { font-size: 19px; font-weight: 900; letter-spacing: -0.5px; }
  table.v-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
  table.v-table th, table.v-table td { border: 1px solid #334155; padding: 3px 4px; text-align: center; }
  table.v-table th { background-color: #ecfdf5; font-weight: 800; color: #065f46; font-size: 10.5px; }
  .footer-note { margin-top: 10px; font-size: 10.5px; color: #334155; font-weight: 500; text-align: left; }
  .print-btn-container { text-align: center; margin-bottom: 10px; }
  .print-btn { background: #059669; color: white; border: none; padding: 8px 16px; font-size: 13px; font-weight: 700; border-radius: 8px; cursor: pointer; }
  @media print {
    @page { size: A4 portrait; margin: 4mm 6mm; }
    html, body { background: white; margin: 0; padding: 0; width: 100%; }
    .page { box-shadow: none; padding: 0 !important; margin: 0 !important; max-width: 100% !important; border-radius: 0; }
    .print-btn-container { display: none !important; }
  }
</style>
</head>
<body>
  <div class="print-btn-container">
    <button class="print-btn" onclick="window.print()">PDF 다운로드 / 인쇄하기</button>
  </div>
  <div class="page">
    <div class="double-title-container">
      <div class="double-title">≪ ${docAcademicYear}학년도 ${docSemesterName} ≫ 학생 차량 안전 도우미(차장) 명단</div>
    </div>

    <table class="v-table">
      <thead>
        <tr>
          <th style="width:7%;">순번</th>
          <th style="width:12%;">차량번호</th>
          <th style="width:14%;">소속 학급</th>
          <th style="width:15%;">학생 성명</th>
          <th style="width:10%;">성별</th>
          <th style="width:16%;">봉사 인정시간</th>
          <th>봉사활동 인정기간</th>
        </tr>
      </thead>
      <tbody>
${leaderRowsHtml}
      </tbody>
    </table>
    <div class="footer-note">*특이사항 없는 차장의 경우 8시간 봉사 시간(봉사 내용: 학생 차량 안전 도우미, 영역: 이웃돕기활동) 부여</div>
  </div>
</body>
</html>`;

        const attachments = [
            {
                name: `${docAcademicYear}학년도 ${docSemesterName} 학생 차량 안전 도우미(차장) 명단.html`,
                size: volunteerListHtml.length * 2,
                data: 'data:text/html;charset=utf-8,' + encodeURIComponent(volunteerListHtml)
            }
        ];

        sessionStorage.setItem('pending_doc_draft', JSON.stringify({ title, content, attachments }));
        setIsLeaderModalOpen(false);
        router.push('/new?busTemplate=true');
        toast({ title: '봉사활동 시간 인정 기안문 생성', description: `수정된 명단(${editableLeaders.length}명)으로 기안 작성이 구동됩니다.` });
    };

    const titleActions = (
        <div className="flex items-center gap-2 flex-wrap">
            {/* 1. 스쿨버스 관련 공문서 작성 버튼 (관리자 페이지 제목 옆, 회색톤 bg-slate-100, h-8 크기) */}
            <Button
                type="button"
                variant="ghost"
                onClick={() => setIsBusDocModalOpen(true)}
                className="h-8 px-2.5 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/90 text-slate-700 font-bold text-xs rounded-lg shadow-none flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
            >
                <span>스쿨버스 관련 공문서 작성</span>
                <Badge variant="outline" className="bg-white text-slate-600 border-slate-200/90 text-[10px] px-1 py-0 font-bold whitespace-nowrap">
                    3종 양식
                </Badge>
            </Button>

            {/* 2. 학부모 탑승 신청 제어 카드 (관리자 페이지 제목 옆, 회색톤 bg-slate-100, h-8 크기) */}
            <div className="bg-slate-100/90 border border-slate-200/90 rounded-lg px-2.5 py-1 flex items-center gap-2 h-8 shadow-none shrink-0">
                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">학부모 탑승 신청</span>
                <Badge 
                    variant="outline"
                    className={cn(
                        "text-[10px] font-bold px-1.5 py-0 whitespace-nowrap shrink-0", 
                        docConfig.isBusApplyActive 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : "bg-white text-slate-500 border-slate-200"
                    )}
                >
                    {docConfig.isBusApplyActive ? '진행 중' : '마감'}
                </Badge>
                <Switch 
                    checked={docConfig.isBusApplyActive ?? false}
                    onCheckedChange={handleToggleBusApply}
                    className="data-[state=checked]:bg-indigo-600 h-4 w-7 shrink-0 ml-0.5"
                />
            </div>

            {/* 3. 시스템 설정 버튼 */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 p-0 cursor-pointer border-slate-200 hover:bg-slate-50">
                        <Settings className="h-4 w-4 text-slate-600" />
                    </Button>
                </DialogTrigger>
                <AdminSettingsDialogContent 
                    buses={buses}
                    students={students}
                    routes={routes}
                    destinations={destinations}
                    teachers={teachers}
                    afterSchoolClasses={afterSchoolClasses}
                    onClose={() => setIsSettingsOpen(false)}
                />
            </Dialog>
        </div>
    );

    return (
        <MainLayout titleActions={titleActions}>
            <AdminPageContent
                buses={buses}
                students={students}
                routes={routes}
                destinations={destinations}
                suggestedDestinations={suggestedDestinations}
                teachers={teachers}
                afterSchoolTeachers={afterSchoolTeachers}
                saturdayTeachers={saturdayTeachers}
                pendingStudents={pendingStudents}
                afterSchoolClasses={afterSchoolClasses}
                semesterMode={adminViewMode}
                activeSystemMode={activeSystemMode}
                onSemesterModeChange={(mode) => setAdminViewMode(mode)}
                onApplySystemMode={async () => {
                    try {
                        await updateGlobalSettings({ semesterMode: adminViewMode });
                        toast({ 
                            title: "시스템 반영 성공", 
                            description: `교사 및 학부모 앱에 [${adminViewMode === 'vacation' ? '방학 중 (방과후)' : '학기 중 (일반)'}] 모드가 정상 반영되었습니다.` 
                        });
                    } catch (e) {
                        toast({ title: "반영 실패", description: "설정 변경 중 오류가 발생했습니다.", variant: 'destructive' });
                    }
                }}
                onOpenBusDocModal={async () => {
                    try {
                        const dutySnap = await getDoc(doc(db(), 'config', 'morningGateDutyMulti'));
                        if (dutySnap.exists()) {
                            const data = dutySnap.data();
                            const activeSemId = data?.activeSemesterId || '2026_1';
                            const semInfo = data?.semesters?.[activeSemId];
                            if (semInfo) {
                                const yearMatch = semInfo.name.match(/\d{4}/);
                                if (yearMatch) setDocAcademicYear(yearMatch[0]);
                                if (semInfo.name.includes('2학기') || semInfo.id?.includes('_2')) setDocSemesterName('2학기');
                                else if (semInfo.name.includes('여름') || semInfo.id?.includes('summer')) setDocSemesterName('여름방학');
                                else if (semInfo.name.includes('겨울') || semInfo.id?.includes('winter')) setDocSemesterName('겨울방학');
                                else setDocSemesterName('1학기');
                            }
                        }
                    } catch (e) {
                        console.error("Failed to sync active semester for doc modal:", e);
                    }
                    setIsBusDocModalOpen(true);
                }}
            />

            {/* 📝 스쿨버스 관련 공문서 작성 선택 모달 */}
            <Dialog open={isBusDocModalOpen} onOpenChange={setIsBusDocModalOpen}>
                <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                            <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                            <span>📝 스쿨버스 관련 공문서 기안 작성</span>
                            <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-bold shrink-0">
                                전용 서식 3종
                            </Badge>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            기안 작성할 공문서 종류를 선택하세요. 학년도 및 학기를 설정한 후 기안 작성을 시작할 수 있습니다.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs">
                        {/* 학년도 / 학기 선택 바 */}
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-1.5 flex-1">
                                <Label className="text-xs font-bold text-slate-700 whitespace-nowrap">학년도:</Label>
                                <Input 
                                    value={docAcademicYear} 
                                    onChange={e => setDocAcademicYear(e.target.value)} 
                                    className="h-8 text-xs font-bold w-24 bg-white"
                                    placeholder="2026"
                                />
                            </div>
                            <div className="flex items-center gap-1.5 flex-1">
                                <Label className="text-xs font-bold text-slate-700 whitespace-nowrap">학기/구분:</Label>
                                <Select value={docSemesterName} onValueChange={setDocSemesterName}>
                                    <SelectTrigger className="h-8 text-xs font-bold w-32 bg-white border-slate-200">
                                        <SelectValue placeholder="학기 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1학기" className="text-xs font-semibold">1학기</SelectItem>
                                        <SelectItem value="2학기" className="text-xs font-semibold">2학기</SelectItem>
                                        <SelectItem value="여름방학" className="text-xs font-semibold">여름방학</SelectItem>
                                        <SelectItem value="겨울방학" className="text-xs font-semibold">겨울방학</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* 공문서 3종 선택 목록 카드 */}
                        <div className="space-y-2.5">
                            <Label className="font-bold text-slate-800 text-xs">
                                📋 결재 공문서 종류 선택 (클릭 시 미리보기 및 기안 생성)
                            </Label>
                            <div className="grid grid-cols-1 gap-2.5">
                                {BUS_DOCUMENT_TYPES.map(docType => {
                                    const isSelected = selectedBusDocType === docType.id;
                                    return (
                                        <div
                                            key={docType.id}
                                            onClick={() => setSelectedBusDocType(docType.id)}
                                            className={cn(
                                                "p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 relative",
                                                isSelected 
                                                    ? "bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs" 
                                                    : "bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/50"
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", docType.badgeColor)}>
                                                    {docType.category}
                                                </span>
                                                {isSelected && (
                                                    <Badge className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 font-bold flex items-center gap-1">
                                                        <Check className="w-3 h-3" /> 선택됨
                                                    </Badge>
                                                )}
                                            </div>

                                            <h5 className="font-bold text-slate-900 text-xs sm:text-sm mt-0.5 leading-snug">
                                                {docType.displayTitle(docAcademicYear, docSemesterName)}
                                            </h5>

                                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                                {docType.description}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsBusDocModalOpen(false)}
                            className="h-9 text-xs font-semibold text-slate-600 border-slate-300 rounded-xl"
                        >
                            취소
                        </Button>

                        <Button
                            type="button"
                            disabled={!selectedBusDocType}
                            onClick={() => selectedBusDocType && handleCreateBusDocDraft(selectedBusDocType)}
                            className="h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs disabled:opacity-50"
                        >
                            <FilePlus className="w-3.5 h-3.5 mr-1.5" />
                            선택한 양식으로 기안 작성 시작
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 학생 차량 안전 도우미(차장) 명단 점검 및 봉사시간 편집 모달 */}
            <Dialog open={isLeaderModalOpen} onOpenChange={setIsLeaderModalOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
                    <DialogHeader className="pb-2 border-b">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2 text-emerald-800">
                            <Users className="h-5 w-5 text-emerald-600" />
                            학생 차량 안전 도우미(차장) 봉사명단 확인 및 인정시간 편집
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-600">
                            봉사활동에 참여하지 않은 학생은 삭제하거나, 학생별 인정 봉사시간(기본 8시간)을 수정한 후 [기안문 생성]을 클릭하세요.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto py-3 space-y-4">
                        {/* 차장 명단 편집 테이블 */}
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead className="bg-emerald-50/80 text-emerald-900 font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="p-2 text-center w-12">순번</th>
                                        <th className="p-2 text-center w-24">차량번호</th>
                                        <th className="p-2 text-center w-24">소속 학급</th>
                                        <th className="p-2 text-center w-28">학생 성명</th>
                                        <th className="p-2 text-center w-16">성별</th>
                                        <th className="p-2 text-center w-36">인정 봉사시간</th>
                                        <th className="p-2 text-center w-16">삭제</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {editableLeaders.map((row, idx) => (
                                        <tr key={row.id || idx} className="hover:bg-slate-50 transition">
                                            <td className="p-2 text-center font-semibold text-slate-500">{idx + 1}</td>
                                            <td className="p-2 text-center font-bold text-slate-800">{row.busNo}</td>
                                            <td className="p-2 text-center text-slate-600">{row.grade}학년 {row.class}반</td>
                                            <td className="p-2 text-center font-bold text-emerald-900">{row.name}</td>
                                            <td className="p-2 text-center text-slate-600">{row.gender}</td>
                                            <td className="p-2 text-center">
                                                <Input
                                                    value={row.hours}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setEditableLeaders(prev => prev.map((item, i) => i === idx ? { ...item, hours: val } : item));
                                                    }}
                                                    className="h-7 text-xs text-center font-bold border-slate-300 focus:border-emerald-500 w-28 mx-auto"
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setEditableLeaders(prev => prev.filter((_, i) => i !== idx));
                                                    }}
                                                    className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 신규 차장 인라인 추가 양식 */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <PlusCircle className="h-3.5 w-3.5 text-emerald-600" />
                                명단에 없는 학생 직접 추가하기
                            </div>
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                                <Input 
                                    placeholder="호차 (예: 1호차)" 
                                    value={newLeaderForm.busNo} 
                                    onChange={e => setNewLeaderForm(p => ({ ...p, busNo: e.target.value }))}
                                    className="h-8 text-xs w-24 bg-white" 
                                />
                                <Input 
                                    placeholder="학년 (예: 6)" 
                                    value={newLeaderForm.grade} 
                                    onChange={e => setNewLeaderForm(p => ({ ...p, grade: e.target.value }))}
                                    className="h-8 text-xs w-16 bg-white" 
                                />
                                <Input 
                                    placeholder="반 (예: 1)" 
                                    value={newLeaderForm.class} 
                                    onChange={e => setNewLeaderForm(p => ({ ...p, class: e.target.value }))}
                                    className="h-8 text-xs w-16 bg-white" 
                                />
                                <Input 
                                    placeholder="학생 성명" 
                                    value={newLeaderForm.name} 
                                    onChange={e => setNewLeaderForm(p => ({ ...p, name: e.target.value }))}
                                    className="h-8 text-xs w-28 bg-white" 
                                />
                                <Select value={newLeaderForm.gender} onValueChange={v => setNewLeaderForm(p => ({ ...p, gender: v }))}>
                                    <SelectTrigger className="h-8 text-xs w-20 bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="여">여</SelectItem>
                                        <SelectItem value="남">남</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Input 
                                    placeholder="인정시간 (예: 8시간)" 
                                    value={newLeaderForm.hours} 
                                    onChange={e => setNewLeaderForm(p => ({ ...p, hours: e.target.value }))}
                                    className="h-8 text-xs w-24 bg-white" 
                                />
                                <Button 
                                    type="button" 
                                    size="sm" 
                                    className="h-8 text-xs bg-slate-800 hover:bg-slate-900 text-white"
                                    onClick={() => {
                                        if (!newLeaderForm.name.trim() || !newLeaderForm.busNo.trim()) {
                                            toast({ variant: 'destructive', title: '입력 오류', description: '차량번호와 학생 성명을 입력해 주세요.' });
                                            return;
                                        }
                                        setEditableLeaders(prev => [...prev, { id: Date.now().toString(), ...newLeaderForm }]);
                                        setNewLeaderForm({ busNo: '', grade: '6', class: '1', name: '', gender: '여', hours: '8시간' });
                                        toast({ title: '학생 추가됨', description: `${newLeaderForm.name} 학생이 명단에 추가되었습니다.` });
                                    }}
                                >
                                    학생 추가
                                </Button>
                            </div>
                        </div>

                        {/* 하단 공문서 규격 비고 안내 박스 */}
                        <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-900 leading-relaxed">
                            *특이사항 없는 차장의 경우 8시간 봉사 시간(봉사 내용: 학생 차량 안전 도우미, 영역: 이웃돕기활동) 부여
                        </div>
                    </div>

                    <DialogFooter className="pt-3 border-t flex justify-between items-center gap-2">
                        <div className="text-xs text-slate-500 font-medium">
                            총 <span className="font-bold text-emerald-700">{editableLeaders.length}명</span>의 봉사 학생 선택됨
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setIsLeaderModalOpen(false)}>취소</Button>
                            <Button onClick={handleConfirmAndCreateVolunteerDoc} className="bg-emerald-600 hover:bg-emerald-700 font-bold text-white">
                                수정된 명단으로 기안문 생성
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
