'use client';

import { Suspense, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft, Home } from 'lucide-react';
import { StudentView } from '@/components/afterschool/student/StudentView';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { onAfterschoolTimerUpdate, onAfterschoolCoursesUpdate, onAfterschoolEnrollmentsUpdate } from '@/lib/services/settingsService';
import type { GlobalTimerConfig } from '@/lib/afterschool/types';
import { useTranslation } from '@/hooks/use-translation';

import {
  initialCourses,
  initialEnrollments,
  initialTimerConfig,
} from '@/lib/afterschool/mock/data';

import { PrivacyConsentModal, DECREE13_CONSENT_STORAGE_KEY } from '@/components/afterschool/PrivacyConsentModal';
import { ParentAfterschoolFareModal } from '@/components/afterschool/parent-afterschool-fare-modal';
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
  const { t } = useTranslation();

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
    <div className="max-w-7xl mx-auto p-2.5 sm:p-4 md:p-8 space-y-3 sm:space-y-6">
      {/* 통일된 상단 네비게이션 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 print:hidden mb-2 w-full max-w-full min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm bg-white hover:bg-slate-50 text-muted-foreground hover:text-foreground shadow-xs shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {t('back') || '뒤로가기'}
          </Button>
          <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm bg-white hover:bg-slate-50 text-muted-foreground hover:text-foreground shadow-xs shrink-0" onClick={() => router.push('/parents')}>
            <Home className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {t('page.title.home') || '홈'}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 bg-white shadow-xs flex items-center gap-1.5 w-full md:w-auto h-auto min-h-8 py-1.5 px-2.5 sm:px-3 max-w-full min-w-0 justify-between md:justify-start shrink-0"
          onClick={() => setIsConsentModalOpen(true)}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span className="truncate min-w-0 font-medium">{t('parents.privacy_consent') || '개인정보 동의서 (Decree 13)'}</span>
          </div>
          {hasConsented && <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded shrink-0 ml-1.5 whitespace-nowrap">{t('parents.consent_granted') || '동의완료'}</span>}
        </Button>
      </div>

      <div className="bg-white p-3.5 sm:p-6 rounded-xl sm:rounded-2xl border shadow-xs sm:shadow-sm mb-3 sm:mb-6">
        <h1 className="text-lg sm:text-2xl font-bold font-headline text-slate-800">
          {t('parents.afterschool_title') || '방과후학교 학생 수강신청'}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
          {t('parents.afterschool_desc') || '개설된 방과후학교 강좌 목록을 확인하고, 실시간으로 수강신청 및 대기신청을 진행할 수 있습니다.'}
        </p>
      </div>


      <Card className="border-slate-200/80 shadow-xs sm:shadow-md bg-white">
        <CardContent className="p-3 sm:p-6">
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

      {/* 방과후 수강료 & 버스비 합산 청구서 팝업 */}
      <ParentAfterschoolFareModal />
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
