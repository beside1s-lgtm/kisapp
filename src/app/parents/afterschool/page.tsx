'use client';

import { Suspense, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft, Home } from 'lucide-react';
import { StudentView } from '@/components/afterschool/student/StudentView';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { onAfterschoolTimerUpdate, onAfterschoolCoursesUpdate, onAfterschoolEnrollmentsUpdate } from '@/lib/services/settingsService';
import type { GlobalTimerConfig } from '@/lib/afterschool/types';

import {
  initialCourses,
  initialEnrollments,
  initialTimerConfig,
} from '@/lib/afterschool/mock/data';

import { PrivacyConsentModal, DECREE13_CONSENT_STORAGE_KEY } from '@/components/afterschool/PrivacyConsentModal';
import { ShieldCheck } from 'lucide-react';

function AfterschoolEnrollment() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<import('@/lib/afterschool/types').Course[]>([]);
  const [enrollments, setEnrollments] = useState<import('@/lib/afterschool/types').Enrollment[]>([]);
  const [activeStudentTab, setActiveStudentTab] = useState<'apply' | 'my'>('apply');
  const [timerConfig, setTimerConfig] = useState<GlobalTimerConfig>(initialTimerConfig);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubTimer = onAfterschoolTimerUpdate((cfg) => setTimerConfig(cfg));
    const unsubCourses = onAfterschoolCoursesUpdate((list) => setCourses(list));
    const unsubEnrollments = onAfterschoolEnrollmentsUpdate((list) => setEnrollments(list));

    // Decree 13 동의 여부 확인
    try {
      const storedConsent = localStorage.getItem(DECREE13_CONSENT_STORAGE_KEY);
      if (storedConsent) {
        setHasConsented(true);
      } else {
        setHasConsented(false);
        setIsConsentModalOpen(true);
      }
    } catch (e) {
      setIsConsentModalOpen(true);
    }

    return () => {
      unsubTimer();
      unsubCourses();
      unsubEnrollments();
    };
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'my' || tabParam === 'apply') {
      setActiveStudentTab(tabParam);
    }
  }, [searchParams]);

  const handleConsentGranted = () => {
    setHasConsented(true);
    setIsConsentModalOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      {/* 통일된 상단 네비게이션 헤더 */}
      <div className="flex items-center justify-between print:hidden mb-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" className="bg-white hover:bg-slate-50 text-muted-foreground hover:text-foreground shadow-sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            뒤로가기
          </Button>
          <Button variant="outline" className="bg-white hover:bg-slate-50 text-muted-foreground hover:text-foreground shadow-sm" onClick={() => router.push('/parents')}>
            <Home className="mr-2 h-4 w-4" />
            홈
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 bg-white shadow-xs flex items-center gap-1.5"
          onClick={() => setIsConsentModalOpen(true)}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
          <span>개인정보 동의서 (Decree 13)</span>
          {hasConsented && <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.2 rounded">동의완료</span>}
        </Button>
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm mb-6">
        <h1 className="text-2xl font-bold font-headline text-slate-800">방과후학교 학생 수강신청</h1>
        <p className="text-sm text-muted-foreground mt-1">
          개설된 방과후학교 강좌 목록을 확인하고, 실시간으로 수강신청 및 대기신청을 진행할 수 있습니다.
        </p>
      </div>

      <Card className="border-slate-200/80 shadow-md bg-white">
        <CardContent className="p-6">
          <StudentView 
            courses={courses}
            enrollments={enrollments}
            setEnrollments={setEnrollments}
            activeStudentTab={activeStudentTab}
            setActiveStudentTab={setActiveStudentTab}
            timerConfig={timerConfig}
          />
        </CardContent>
      </Card>

      {/* 개인정보 처리 방침 동의 모달 (Decree 13) */}
      <PrivacyConsentModal
        isOpen={isConsentModalOpen}
        onConsentGranted={handleConsentGranted}
        onCancel={hasConsented ? () => setIsConsentModalOpen(false) : undefined}
      />
    </div>
  );
}

export default function AfterschoolEnrollmentPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <AfterschoolEnrollment />
    </Suspense>
  );
}
