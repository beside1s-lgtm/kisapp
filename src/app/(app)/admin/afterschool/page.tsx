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
