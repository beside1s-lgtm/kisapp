'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { FileEdit, History, Info, AlertCircle, Loader2, Bus as BusIcon, GraduationCap, Calendar, UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getSentDocuments, getStudentFieldTripDays, getStudentAbsenceDays } from '@/lib/services/documentService';
import { getDocConfig, onAfterschoolTimerUpdate, onOrgStructureUpdate, onAfterschoolCoursesUpdate, onAfterschoolEnrollmentsUpdate } from '@/lib/services/settingsService';
import { onUsersDirectoryUpdate } from '@/lib/services/userService';
import { onBusesUpdate, onStudentsUpdate } from '@/lib/kisbus';
import type { Bus, Student } from '@/lib/kisbus/types';
import type { Course, Enrollment, GlobalTimerConfig } from '@/lib/afterschool/types';
import { ApprovalDoc, DocConfig, OrgStructure, UserProfile } from '@/lib/types';
import { PwaInstallBanner } from '@/components/pwa-install-banner';
import { ParentBusFareModal } from '@/components/bus/parent-bus-fare-modal';
import { ParentAfterschoolFareModal } from '@/components/afterschool/parent-afterschool-fare-modal';
import { useTranslation } from '@/hooks/use-translation';




export default function ParentsDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const [docsLoading, setDocsLoading] = useState(false);
  const [pendingReports, setPendingReports] = useState<ApprovalDoc[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [timerConfig, setTimerConfig] = useState<GlobalTimerConfig | null>(null);
  const [accumulatedFieldTripDays, setAccumulatedFieldTripDays] = useState<number>(0);
  const [accumulatedAbsenceDays, setAccumulatedAbsenceDays] = useState<number>(0);
  const { t } = useTranslation();


  // 실시간 연동 상태 (조직도, 교직원, 스쿨버스, 방과후)
  const [orgStructure, setOrgStructure] = useState<Partial<OrgStructure> | null>(null);
  const [usersDirectory, setUsersDirectory] = useState<UserProfile[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [busStudents, setBusStudents] = useState<Student[]>([]);
  const [afterschoolCourses, setAfterschoolCourses] = useState<Course[]>([]);
  const [afterschoolEnrollments, setAfterschoolEnrollments] = useState<Enrollment[]>([]);

  const isAfterschoolActive = (() => {
    if (!timerConfig) return false;
    if (timerConfig.masterStatus === 'FORCE_LOCK' || timerConfig.masterStatus === 'PAUSED') return false;
    if (timerConfig.masterStatus === 'FORCE_OPEN') return true;

    const now = new Date().getTime();
    const safeParseDate = (dStr: any) => {
      if (!dStr) return new Date(0);
      return new Date(dStr);
    };
    
    const startTime = safeParseDate(timerConfig.startTime).getTime();
    const endTime = safeParseDate(timerConfig.endTime).getTime();
    
    return now >= startTime && now <= endTime;
  })();

  useEffect(() => {
    getDocConfig().then(cfg => setConfig(cfg));
    const unsubTimer = onAfterschoolTimerUpdate((cfg) => setTimerConfig(cfg));
    const unsubOrg = onOrgStructureUpdate((org) => setOrgStructure(org));
    const unsubUsers = onUsersDirectoryUpdate((users) => setUsersDirectory(users));
    const unsubBuses = onBusesUpdate((bList) => setBuses(bList || []));
    const unsubBusStudents = onStudentsUpdate((sList) => setBusStudents(sList || []));
    const unsubCourses = onAfterschoolCoursesUpdate((cList) => setAfterschoolCourses(cList || []));
    const unsubEnrollments = onAfterschoolEnrollmentsUpdate((eList) => setAfterschoolEnrollments(eList || []));

    return () => {
      unsubTimer();
      unsubOrg();
      unsubUsers();
      unsubBuses();
      unsubBusStudents();
      unsubCourses();
      unsubEnrollments();
    };
  }, []);

  useEffect(() => {
    async function loadStats() {
      if (!user) return;
      setDocsLoading(true);
      try {
        const docs = await getSentDocuments(user.uid, user.email || '');
        // 승인 완료되었고, 체험학습 종료일이 지났으며, 아직 보고서가 제출되지 않은 신청서 필터
        const todayStr = new Date().toISOString().split('T')[0];
        const pending = docs.filter(
          (d: ApprovalDoc) => 
            d.docType === 'parent' && 
            d.parentFormData?.type === 'field-trip' && 
            d.status === 'approved' &&
            !d.parentFormData?.reportSubmitted &&
            (d.parentFormData?.tripPeriod?.endDate ? d.parentFormData.tripPeriod.endDate <= todayStr : true)
        );
        setPendingReports(pending);

        // 자녀 이름 및 반/번호 획득 후 누적 통계 조회
        const studentName = profile?.studentName || '';
        const gradeClassNumber = (profile?.studentGrade && profile?.studentClass && profile?.studentNumber)
          ? `${profile.studentGrade}-${profile.studentClass}-${profile.studentNumber}`
          : '';
        
        if (studentName && gradeClassNumber) {
          const currentYear = new Date().getFullYear().toString();
          const [ftDays, absDays] = await Promise.all([
            getStudentFieldTripDays(studentName, gradeClassNumber, currentYear),
            getStudentAbsenceDays(studentName, gradeClassNumber, currentYear)
          ]);
          setAccumulatedFieldTripDays(ftDays);
          setAccumulatedAbsenceDays(absDays);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setDocsLoading(false);
      }
    }
    if (user && profile) {
      loadStats();
    }
  }, [user, profile]);

  // 1. 담임 선생님 성명 자동 매칭 (실시간 조직도 & 교직원 DB)
  const homeroomTeacherName = useMemo(() => {
    if (!profile?.studentGrade || !profile?.studentClass) return '';
    const g = String(parseInt(profile.studentGrade, 10) || profile.studentGrade).trim();
    const c = String(parseInt(profile.studentClass, 10) || profile.studentClass).trim();
    const gradeClassKey = `${g}-${c}`;
    
    const teacherEmail = orgStructure?.homerooms?.[gradeClassKey] || 
                         orgStructure?.homerooms?.[`${profile.studentGrade}-${profile.studentClass}`] ||
                         Object.entries(orgStructure?.homerooms || {}).find(([k]) => {
                           const [kg, kc] = k.split('-').map(s => String(parseInt(s, 10) || s).trim());
                           return kg === g && kc === c;
                         })?.[1];

    if (!teacherEmail) return '';
    const teacherUser = usersDirectory.find(u => u.email?.toLowerCase() === teacherEmail.toLowerCase());
    return teacherUser?.name || teacherEmail.split('@')[0];
  }, [profile, orgStructure, usersDirectory]);

  // 2. 스쿨버스 탑승 차량 안내 텍스트 (예: 1호차 / 버스 미탑승)
  const busInfoText = useMemo(() => {
    if (!profile?.studentName) return '버스 미탑승';
    const sName = profile.studentName.trim().toLowerCase();
    const sGrade = String(parseInt(profile.studentGrade || '', 10) || profile.studentGrade || '').trim();
    const sClass = String(parseInt(profile.studentClass || '', 10) || profile.studentClass || '').trim();

    const matchedStudent = busStudents.find(s => {
      const busName = (s.name || '').trim().toLowerCase();
      const busGrade = String(parseInt(s.grade || '', 10) || s.grade || '').trim();
      const busClass = String(parseInt(s.class || '', 10) || s.class || '').trim();
      
      const isSameName = busName === sName;
      const isSameClass = (!sGrade || busGrade === sGrade) && (!sClass || busClass === sClass);
      const isSameEmail = s.studentEmail && user?.email && s.studentEmail.toLowerCase() === user.email.toLowerCase();
      const isSamePhone = s.contact && profile.parentPhone && s.contact.replace(/\D/g, '') === profile.parentPhone.replace(/\D/g, '');

      return (isSameName && isSameClass) || isSameEmail || (isSameName && isSamePhone);
    });

    if (matchedStudent?.assignedBusId) {
      const bus = buses.find(b => b.id === matchedStudent.assignedBusId);
      if (bus?.name) return bus.name;
    }
    return '버스 미탑승';
  }, [profile, user, busStudents, buses]);

  // 3. 방과후학교 수강 과목 안내 텍스트 (예: 축구교실, 창의로봇 / 미수강)
  const afterschoolInfoText = useMemo(() => {
    if (!profile?.studentName) return '미수강';
    const sName = profile.studentName.trim().toLowerCase();
    const sGrade = String(parseInt(profile.studentGrade || '', 10) || profile.studentGrade || '').trim();
    const sClass = String(parseInt(profile.studentClass || '', 10) || profile.studentClass || '').trim();

    const studentEnrollments = afterschoolEnrollments.filter(e => {
      const eName = (e.studentName || '').trim().toLowerCase();
      const eGrade = String(parseInt(e.studentGrade || '', 10) || e.studentGrade || '').trim();
      const eClass = String(parseInt(e.studentClass || '', 10) || e.studentClass || '').trim();

      const isSameName = eName === sName;
      const isSameClass = (!sGrade || eGrade === sGrade) && (!sClass || eClass === sClass);
      const isSameEmail = e.studentEmail && user?.email && e.studentEmail.toLowerCase() === user.email.toLowerCase();

      const isEnrolled = e.status === 'enrolled' || e.status === 'confirmed' || e.status === 'approved' || !e.status;
      return (isSameName || isSameEmail) && isEnrolled;
    });

    const courseTitles = studentEnrollments.map(e => {
      const course = afterschoolCourses.find(c => c.id === e.courseId);
      return course?.title || e.courseTitle || '';
    }).filter(Boolean);

    const uniqueCourses = Array.from(new Set(courseTitles));
    return uniqueCourses.length > 0 ? uniqueCourses.join(', ') : '미수강';
  }, [profile, user, afterschoolEnrollments, afterschoolCourses]);

  if (authLoading || docsLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-body">
      {/* ── 학부모 서비스 대시보드 헤더 ── */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline text-foreground">
            {t('parents.dashboard') || '학부모 서비스 대시보드'}
          </h1>
          {profile?.studentGrade && profile?.studentClass && (
            <Badge variant="outline" className="bg-indigo-50/80 border-indigo-200 text-indigo-800 text-xs sm:text-sm font-semibold px-2.5 sm:px-3 py-1 rounded-full shadow-xs">
              ( {profile.studentGrade}학년 {profile.studentClass}반 {profile.studentNumber ? `${profile.studentNumber}번` : ''}, 담임: {homeroomTeacherName || '미배정'} )
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-xs sm:text-base">
          {t('parents.welcome_desc') || 'KISAPP 학부모 서비스에 오신 것을 환영합니다. 원하시는 메뉴를 선택해주세요.'}
        </p>
      </div>


      {/* 미제출 보고서 알림 배너 */}
      {pendingReports.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 shadow-xs sm:shadow-sm">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-amber-100 rounded-lg text-amber-700 shrink-0">
              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm sm:text-base">보고서 제출 필요 {pendingReports.length}건</h4>
              <p className="text-[11px] sm:text-xs text-amber-700 mt-0.5 sm:mt-1 leading-relaxed">
                승인된 교외체험학습 종료 후 7일 이내에 결과보고서를 제출해야 출석 처리가 최종 완료됩니다.
              </p>
            </div>
          </div>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shrink-0 self-end sm:self-auto transition-colors" asChild>
            <Link href="/parents/history">보고서 작성하러 가기</Link>
          </Button>
        </div>
      )}

      {/* 교외체험학습 및 출석 현황 현황판 */}
      {profile && (
        <Card className="border border-slate-200/60 shadow-xs sm:shadow-sm bg-slate-50/50 w-full min-w-0 overflow-hidden">
          <CardHeader className="p-3.5 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 flex-wrap">
              <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 shrink-0" />
              <span className="break-words">{profile.studentName ? `${profile.studentName} ` : ''}{t('parents.stats_title') || '학생 출결 및 체험학습 현황'}</span>
            </CardTitle>
            <CardDescription className="text-[11px] sm:text-xs break-words">
              {t('parents.stats_desc') || '학년도 연간 총 수업일수 기준 한도 설정 현황입니다.'} (수업일수: {config?.annualSchoolDays || 190}일)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-6 pt-0 sm:pt-0 grid gap-3 sm:gap-6 md:grid-cols-2">
            {/* 교외체험학습 한도 카드 */}
            <div className="bg-white border rounded-xl p-3 sm:p-4 shadow-xs space-y-2.5 sm:space-y-3 w-full min-w-0">
              <div className="flex justify-between items-center gap-1 flex-wrap">
                <span className="font-semibold text-xs sm:text-sm text-slate-700">{t('parents.field_trip_used') || '체험학습 사용 일수'}</span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{t('parents.field_trip_limit') || '연간 10% 한도'}</span>
              </div>
              <div className="flex justify-between items-baseline gap-1 flex-wrap">
                <span className="text-xl sm:text-2xl font-black text-slate-800">
                  {accumulatedFieldTripDays}일 <span className="text-[11px] sm:text-xs font-normal text-slate-400">사용</span>
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-500">
                  최대 {Math.floor((config?.annualSchoolDays || 190) * 0.1)}일 중 {Math.max(Math.floor((config?.annualSchoolDays || 190) * 0.1) - accumulatedFieldTripDays, 0)}일 남음
                </span>
              </div>
              {/* 프로그레스바 */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 sm:h-2">
                <div 
                  className="bg-indigo-600 h-1.5 sm:h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min((accumulatedFieldTripDays / Math.max(Math.floor((config?.annualSchoolDays || 190) * 0.1), 1)) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* 결석 한도 카드 */}
            <div className="bg-white border rounded-xl p-3 sm:p-4 shadow-xs space-y-2.5 sm:space-y-3 w-full min-w-0">
              <div className="flex justify-between items-center gap-1 flex-wrap">
                <span className="font-semibold text-xs sm:text-sm text-slate-700">{t('parents.absence_used') || '누적 결석 일수'}</span>
                <span className="text-[10px] sm:text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">{t('parents.absence_limit') || '수업일수 2/3 출석 의무'}</span>
              </div>
              <div className="flex justify-between items-baseline gap-1 flex-wrap">
                <span className="text-xl sm:text-2xl font-black text-rose-600">
                  {accumulatedAbsenceDays}일 <span className="text-[11px] sm:text-xs font-normal text-slate-400">결석</span>
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-500">
                  최대 {(config?.annualSchoolDays || 190) - Math.ceil((config?.annualSchoolDays || 190) * 2 / 3)}일 허용 중 {Math.max(((config?.annualSchoolDays || 190) - Math.ceil((config?.annualSchoolDays || 190) * 2 / 3)) - accumulatedAbsenceDays, 0)}일 남음
                </span>
              </div>
              {/* 프로그레스바 */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 sm:h-2">
                <div 
                  className="bg-rose-500 h-1.5 sm:h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min((accumulatedAbsenceDays / Math.max(((config?.annualSchoolDays || 190) - Math.ceil((config?.annualSchoolDays || 190) * 2 / 3)), 1)) * 100, 100)}%` }}
                ></div>
              </div>
              {accumulatedAbsenceDays >= ((config?.annualSchoolDays || 190) - Math.ceil((config?.annualSchoolDays || 190) * 2 / 3)) * 0.8 && (
                <p className="text-[10px] sm:text-[11px] text-rose-600 font-semibold flex items-center gap-1 animate-pulse">
                  <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                  <span>수업일수 부족으로 인한 미수료(유급) 위험이 있으니 주의하십시오.</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-all duration-300 border-primary/20 bg-gradient-to-br from-primary/5 to-background hover:-translate-y-1">
          <CardHeader className="p-3.5 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-xl text-primary">
              <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg shrink-0">
                <FileEdit className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              {t('parents.apply_title') || '신청서 제출'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              {t('parents.apply_desc') || '학교에 제출할 각종 신청서 및 동의서를 간편하게 작성하고 제출합니다.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-6 pt-0 sm:pt-0">
            <Button className="w-full font-bold shadow-xs sm:shadow-md hover:shadow-lg transition-all h-9 sm:h-10 text-xs sm:text-sm" asChild>
              <Link href="/parents/apply">{t('parents.go_btn') || '바로가기'}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 relative overflow-hidden border-slate-200">
          {pendingReports.length > 0 && (
            <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-rose-500 text-white text-[10px] sm:text-[11px] font-black px-1.5 sm:px-2 py-0.5 rounded-full animate-bounce">
              보고서 대기 {pendingReports.length}
            </div>
          )}
          <CardHeader className="p-3.5 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
              <div className="p-1.5 sm:p-2 bg-blue-500/10 text-blue-500 rounded-lg shrink-0">
                <History className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              {t('parents.history_title') || '제출 내역'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              {t('parents.history_desc') || '이전에 제출하신 문서들의 상세 내용과 실시간 처리 상태를 확인합니다.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-6 pt-0 sm:pt-0">
            <Button variant="outline" className="w-full font-bold hover:bg-blue-500/5 hover:text-blue-600 transition-colors h-9 sm:h-10 text-xs sm:text-sm" asChild>
              <Link href="/parents/history">{t('parents.go_btn') || '내역 보기'}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="p-3.5 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
              <div className="p-1.5 sm:p-2 bg-green-500/10 text-green-500 rounded-lg shrink-0">
                <Info className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              {t('parents.notices') || '학교 공지사항'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              {t('parents.notices_desc') || '학교에서 안내하는 주요 공지사항과 가정통신문을 확인합니다.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-6 pt-0 sm:pt-0">
            <Button variant="secondary" className="w-full font-bold text-muted-foreground h-9 sm:h-10 text-xs sm:text-sm" disabled>
              {t('parents.coming_soon') || '준비 중입니다'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 프리미엄 연계 서비스 섹션 */}
      <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t">
        <h3 className="text-xl font-bold text-foreground font-headline flex items-center gap-2">
          {t('parents.connected_services') || '연계 교육 서비스'}
        </h3>
        <div className="grid gap-6 md:grid-cols-2">
          {/* 스쿨버스 카드 */}
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-amber-200 bg-gradient-to-br from-amber-500/5 to-background">
            <CardHeader className="p-3.5 sm:p-6">
              <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-xl text-amber-600 font-headline flex-wrap">
                <div className="p-1.5 sm:p-2 bg-amber-500/10 rounded-lg shrink-0">
                  <BusIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <span>{t('parents.bus_title') || '스쿨버스'}</span>
                <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-800 text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full">
                  {busInfoText}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                {t('parents.bus_desc') || '스쿨버스 탑승 신청 및 자녀의 배정 좌석, 버스 탑승 여부를 확인합니다.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-6 pt-0 sm:pt-0 flex flex-col gap-2.5 sm:gap-3">
              <div className="flex gap-2">
                {config?.isBusApplyActive ? (
                  <Button className="flex-1 font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs sm:shadow-md transition-all h-9 sm:h-10 text-xs sm:text-sm" asChild>
                    <Link href="/parents/bus/apply">{t('parents.bus_apply_btn') || '탑승 신청'}</Link>
                  </Button>
                ) : (
                  <Button className="flex-1 font-bold text-muted-foreground bg-slate-100 hover:bg-slate-100 cursor-not-allowed h-9 sm:h-10 text-xs sm:text-sm" variant="secondary" disabled>
                    {t('parents.bus_apply_closed') || '탑승 신청 (기간 종료)'}
                  </Button>
                )}
                {busInfoText !== '버스 미탑승' ? (
                  <Button variant="outline" className="flex-1 font-bold border-amber-200 text-amber-700 hover:bg-amber-50 h-9 sm:h-10 text-xs sm:text-sm" asChild>
                    <Link href="/parents/bus/student">{t('parents.bus_status_btn') || '자녀 탑승 조회'}</Link>
                  </Button>
                ) : (
                  <Button variant="outline" className="flex-1 font-bold border-slate-200 text-slate-600 hover:bg-slate-50 h-9 sm:h-10 text-xs sm:text-sm" asChild>
                    <Link href="/parents/bus">{t('parents.bus_title') || '스쿨버스 안내'}</Link>
                  </Button>
                )}
              </div>
              {!config?.isBusApplyActive && (
                <p className="text-[11px] sm:text-xs text-amber-600 text-center font-medium bg-amber-50 border border-amber-200/50 py-1.5 rounded-lg">
                  ※ {t('parents.bus_not_period') || '현재는 스쿨버스 탑승 신청 기간이 아닙니다.'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* 방과후학교 카드 */}
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-violet-200 bg-gradient-to-br from-violet-500/5 to-background">
            <CardHeader className="p-3.5 sm:p-6">
              <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-xl text-violet-600 font-headline flex-wrap">
                <div className="p-1.5 sm:p-2 bg-violet-500/10 rounded-lg shrink-0">
                  <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <span>{t('parents.afterschool_title') || '방과후학교'}</span>
                <Badge variant="outline" className="bg-violet-50 border-violet-200 text-violet-800 text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full">
                  {afterschoolInfoText}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                {t('parents.afterschool_desc') || '방과후학교의 수강신청을 하거나 수강 신청된 강좌를 확인 및 취소합니다.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-6 pt-0 sm:pt-0 flex flex-col gap-2.5 sm:gap-3">
              <div className="flex gap-2">
                {isAfterschoolActive ? (
                  <Button className="flex-1 font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-xs sm:shadow-md transition-all h-9 sm:h-10 text-xs sm:text-sm" asChild>
                    <Link href="/parents/afterschool?tab=apply">{t('parents.afterschool_apply_btn') || '수강 신청'}</Link>
                  </Button>
                ) : (
                  <Button className="flex-1 font-bold text-muted-foreground bg-slate-100 hover:bg-slate-100 cursor-not-allowed h-9 sm:h-10 text-xs sm:text-sm" variant="secondary" disabled>
                    {t('parents.afterschool_apply_closed') || '수강 신청 (기간 종료)'}
                  </Button>
                )}
                <Button variant="outline" className="flex-1 font-bold border-violet-200 text-violet-700 hover:bg-violet-50" asChild>
                  <Link href="/parents/afterschool?tab=my">{t('parents.afterschool_status_btn') || '신청 확인 및 취소'}</Link>
                </Button>
              </div>
              {!isAfterschoolActive && (
                <p className="text-xs text-violet-600 text-center font-medium bg-violet-50 border border-violet-200/50 py-1.5 rounded-lg">
                  ※ {t('parents.afterschool_not_period') || '현재는 방과후학교 수강신청 기간이 아닙니다.'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>


      {/* 맨 하단: 2026학년도 학사 일정 캘린더 동기화 배너 */}
      <div className="pt-2 w-full min-w-0">
        <div 
          onClick={() => window.dispatchEvent(new CustomEvent('openAcademicCalendarSyncModal'))}
          className="group cursor-pointer p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-blue-50/70 to-slate-50/90 border border-indigo-200/80 hover:border-indigo-400 hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full min-w-0"
        >
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-slate-900 text-sm sm:text-base break-words">
                  {t('parents.calendar_sync_title') || '2026학년도 학교 학사 일정 캘린더 동기화'}
                </span>
                <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-[10px] font-bold border-indigo-200 shrink-0">
                  {t('parents.calendar_sync_badge') || '학부모 공유'}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 break-words">
                {t('parents.calendar_sync_desc') || '학기 및 방학 운영 기간, 재량휴업일, 학교 행사를 내 구글/스마트폰 캘린더에 연동합니다.'}
              </p>
            </div>
          </div>
          <Button 
            type="button" 
            size="sm" 
            className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs shrink-0 whitespace-nowrap self-stretch sm:self-auto"
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            {t('parents.calendar_sync_btn') || '학사일정 캘린더 연동'}
          </Button>
        </div>
      </div>

      {/* 학부모 대시보드 하단 KIS 전용 앱 설치 배너 */}
      <PwaInstallBanner className="mt-4 mb-2" />

      {/* 스쿨버스 분기 청구서 전달 팝업 */}
      <ParentBusFareModal />

      {/* 방과후 수강료 & 버스비 청구서 전달 팝업 */}
      <ParentAfterschoolFareModal />
    </div>
  );
}


