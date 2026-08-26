'use client';

import { Suspense, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Settings, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getOrgStructure, getAfterschoolTimerConfig, saveAfterschoolTimerConfig, onAfterschoolTimerUpdate, onAfterschoolCoursesUpdate, onAfterschoolEnrollmentsUpdate, onAfterschoolClassroomsUpdate, saveAfterschoolClassroomsBatch, onAfterschoolApprovalDocsUpdate } from '@/lib/services/settingsService';
import { getDestinations } from '@/lib/kisbus/destinations';
import { onStudentsUpdate } from '@/lib/kisbus/students';
import { onRoutesUpdate } from '@/lib/kisbus/routes';
import { onBusesUpdate } from '@/lib/kisbus/buses';
import { AdminControlRoom } from '@/components/afterschool/teacher/AdminControlRoom';
import { AdminPanel } from '@/components/afterschool/teacher/AdminPanel';
import { MainLayout } from '@/components/layout/main-layout';
import { useTranslation } from '@/hooks/use-translation';

import {
  initialCourses,
  initialEnrollments,
  initialTimerConfig,
  initialPeriods,
  initialStudents,
} from '@/lib/afterschool/mock/data';
import type { Classroom, SubmittedApprovalDoc, SessionPeriod } from '@/lib/afterschool/types';

// 기본 교실 목록
const defaultClassrooms: Classroom[] = [
  { id: 'rm_1_1', name: '1-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_1_2', name: '1-2반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_1_3', name: '1-3반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_1_4', name: '1-4반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_2_1', name: '2-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_2_2', name: '2-2반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_2_3', name: '2-3반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_2_4', name: '2-4반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_3_1', name: '3-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_3_2', name: '3-2반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_3_3', name: '3-3반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_3_4', name: '3-4반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_4_1', name: '4-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_4_2', name: '4-2반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_4_3', name: '4-3반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_4_4', name: '4-4반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_5_1', name: '5-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_5_2', name: '5-2반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_5_3', name: '5-3반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_5_4', name: '5-4반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_6_1', name: '6-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_6_2', name: '6-2반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_6_3', name: '6-3반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_6_4', name: '6-4반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_music', name: '음악실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_art', name: '미술실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_gym', name: '체육관', capacity: 100, maxSimultaneousCourses: 2 },
  { id: 'rm_com', name: '컴퓨터실', capacity: 35, maxSimultaneousCourses: 1 },
  { id: 'rm_av', name: '시청각실', capacity: 80, maxSimultaneousCourses: 1 },
  { id: 'rm_lib', name: '도서관', capacity: 50, maxSimultaneousCourses: 1 },
  { id: 'rm_dance', name: '무용실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_sci', name: '과학실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_eng', name: '영어전용실', capacity: 30, maxSimultaneousCourses: 1 },
];

function AfterschoolAdmin() {
  const { t } = useTranslation();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [courses, setCourses] = useState<import('@/lib/afterschool/types').Course[]>([]);
  const [enrollments, setEnrollments] = useState<import('@/lib/afterschool/types').Enrollment[]>([]);
  const [timerConfig, setTimerConfig] = useState(initialTimerConfig);
  const [classrooms, setClassrooms] = useState<Classroom[]>(defaultClassrooms);
  const [approvalDocs, setApprovalDocs] = useState<SubmittedApprovalDoc[]>([]);
  const [tuitionPerSession, setTuitionPerSession] = useState<number>(15000);
  const [periods, setPeriods] = useState<SessionPeriod[]>(initialPeriods);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<string>('panel');
  const [destinations, setDestinations] = useState<any[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [buses, setBuses] = useState<any[]>([]);

  useEffect(() => {
    getDestinations().then(setDestinations);
    const unsubStudents = onStudentsUpdate((list) => setStudentsList(list));
    const unsubRoutes = onRoutesUpdate((list) => setRoutes(list));
    const unsubBuses = onBusesUpdate((list) => setBuses(list));
    const unsubTimer = onAfterschoolTimerUpdate((cfg) => setTimerConfig(cfg));
    const unsubCourses = onAfterschoolCoursesUpdate((list) => setCourses(list));
    const unsubEnrollments = onAfterschoolEnrollmentsUpdate((list) => setEnrollments(list));
    const unsubClassrooms = onAfterschoolClassroomsUpdate((list) => {
      setClassrooms(list);
    });
    const unsubApprovalDocs = onAfterschoolApprovalDocsUpdate((list) => {
      setApprovalDocs(list);
    });

    return () => {
      unsubStudents();
      unsubRoutes();
      unsubBuses();
      unsubTimer();
      unsubCourses();
      unsubEnrollments();
      unsubClassrooms();
      unsubApprovalDocs();
    };
  }, []);

  const handleSetTimerConfig = async (newCfg: any) => {
    setTimerConfig((prev) => {
      const updated = typeof newCfg === 'function' ? newCfg(prev) : newCfg;
      saveAfterschoolTimerConfig(updated).then(res => {
        if (!res.success) {
          toast({ variant: 'destructive', title: '설정 저장 실패', description: res.error });
        }
      });
      return updated;
    });
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      getOrgStructure().then(orgData => {
        const emailLower = (profile?.email || user?.email || '').toLowerCase();
        const afterschoolManagers = orgData?.afterschoolManagers || (orgData?.afterschoolManager ? [orgData.afterschoolManager] : []);
        const isAfterschoolManager = afterschoolManagers.some((m: string) => m.toLowerCase() === emailLower);
        const isSystemAdmin = profile?.isAdmin === true || emailLower === 'beside1s@kshcm.net';

        if (isSystemAdmin || isAfterschoolManager) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
          toast({
            variant: 'destructive',
            title: '접근 권한 없음',
            description: '방과후학교 담당자 또는 시스템 관리자만 접근할 수 있습니다.'
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

  if (authLoading || isAuthorized === null || isAuthorized === false) {
    return (
      <div className="flex justify-center py-40">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <MainLayout
      title={t('afterschool.admin.title') || "방과후학교 관리자"}
      titleActions={
        <div className="flex items-center gap-1 bg-slate-100/90 p-0.5 sm:p-1 rounded-xl border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('panel')}
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg font-bold text-xs sm:text-xs transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'panel'
                ? 'bg-white text-amber-800 shadow-xs border border-amber-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border border-transparent'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{t('afterschool.admin.master_settings') || "마스터 설정"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('control')}
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg font-bold text-xs sm:text-xs transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'control'
                ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border border-transparent'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>{t('afterschool.admin.control_room') || "실시간 제어실"}</span>
          </button>
        </div>
      }
    >
      <div className="max-w-7xl mx-auto px-1.5 py-1 sm:px-3 md:px-5 md:py-2 min-w-0 w-full overflow-hidden">
        {activeTab === 'control' ? (
          <AdminControlRoom
            timerConfig={timerConfig}
            setTimerConfig={handleSetTimerConfig}
            courses={courses}
            setCourses={setCourses}
            enrollments={enrollments}
            setEnrollments={setEnrollments}
          />
        ) : (
          <AdminPanel
            courses={courses}
            setCourses={setCourses}
            classrooms={classrooms}
            setClassrooms={setClassrooms}
            approvalDocs={approvalDocs}
            setApprovalDocs={setApprovalDocs}
            tuitionPerSession={tuitionPerSession}
            setTuitionPerSession={setTuitionPerSession}
            periods={periods}
            setPeriods={setPeriods}
            timerConfig={timerConfig}
            enrollments={enrollments}
            setEnrollments={setEnrollments}
            studentsList={studentsList}
            destinations={destinations}
            routes={routes}
            buses={buses}
            onClose={() => setActiveTab('control')}
          />
        )}
      </div>
    </MainLayout>
  );
}

export default function AfterschoolAdminPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <AfterschoolAdmin />
    </Suspense>
  );
}
