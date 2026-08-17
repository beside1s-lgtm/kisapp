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
import { AdminControlRoom } from '@/components/afterschool/teacher/AdminControlRoom';
import { AdminPanel } from '@/components/afterschool/teacher/AdminPanel';
import { MainLayout } from '@/components/layout/main-layout';

import {
  initialCourses,
  initialEnrollments,
  initialTimerConfig,
  initialPeriods,
  initialStudents,
} from '@/lib/afterschool/mock/data';
import type { Classroom, SubmittedApprovalDoc, SessionPeriod } from '@/lib/afterschool/types';

// 기본 교실 목록
const initialClassrooms: Classroom[] = [
  { id: 'rm1', name: '1-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm2', name: '1-2반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm3', name: '2-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm4', name: '3-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm5', name: '음악실', capacity: 25, maxSimultaneousCourses: 1 },
  { id: 'rm6', name: '미술실', capacity: 25, maxSimultaneousCourses: 1 },
  { id: 'rm7', name: '체육관', capacity: 100, maxSimultaneousCourses: 2 },
  { id: 'rm8', name: '컴퓨터실', capacity: 30, maxSimultaneousCourses: 1 },
];

function AfterschoolAdmin() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [courses, setCourses] = useState<import('@/lib/afterschool/types').Course[]>([]);
  const [enrollments, setEnrollments] = useState<import('@/lib/afterschool/types').Enrollment[]>([]);
  const [timerConfig, setTimerConfig] = useState(initialTimerConfig);
  const [classrooms, setClassrooms] = useState<Classroom[]>(initialClassrooms);
  const [approvalDocs, setApprovalDocs] = useState<SubmittedApprovalDoc[]>([]);
  const [tuitionPerSession, setTuitionPerSession] = useState<number>(15000);
  const [periods, setPeriods] = useState<SessionPeriod[]>(initialPeriods);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<string>('panel');
  const [destinations, setDestinations] = useState<any[]>([]);

  useEffect(() => {
    getDestinations().then(setDestinations);
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
    <MainLayout title="방과후학교 시스템 관리자 모듈">
      <div className="max-w-7xl mx-auto px-3 py-2 md:px-6 md:py-3 space-y-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
          <TabsList className="grid grid-cols-2 max-w-md h-auto p-1 bg-slate-100 rounded-xl border">
            <TabsTrigger value="panel" className="py-2 rounded-lg font-bold text-sm gap-2">
              <ShieldAlert size={16} /> 마스터 설정
            </TabsTrigger>
            <TabsTrigger value="control" className="py-2 rounded-lg font-bold text-sm gap-2">
              <Settings size={16} /> 실시간 제어실
            </TabsTrigger>
          </TabsList>

          <Card className="border-slate-200/80 shadow-md bg-white">
            <CardContent className="p-3 md:p-4">
              <TabsContent value="control" className="m-0 focus-visible:outline-none">
                <AdminControlRoom
                  timerConfig={timerConfig}
                  setTimerConfig={handleSetTimerConfig}
                  courses={courses}
                  setCourses={setCourses}
                  enrollments={enrollments}
                  setEnrollments={setEnrollments}
                />
              </TabsContent>

              <TabsContent value="panel" className="m-0 focus-visible:outline-none">
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
                  studentsList={initialStudents}
                  destinations={destinations}
                  onClose={() => setActiveTab('control')}
                />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
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
