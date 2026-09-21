'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { FileEdit, History, Info, AlertCircle, Loader2, Bus as BusIcon, GraduationCap, Calendar, UserCheck, CheckCircle2, Clock, MessageSquare, ArrowRight, CalendarPlus, HeartHandshake } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

// Google Calendar 원클릭 일정 등록 URL 생성 헬퍼
function getGoogleCalendarUrl({
  title,
  startDateStr,
  timeRange,
  description,
  location,
}: {
  title: string;
  startDateStr: string;
  timeRange: string;
  description?: string;
  location?: string;
}) {
  try {
    const times = timeRange.split('~').map(t => t.trim());
    const [startH, startM] = (times[0] || '13:40').split(':').map(Number);
    const [endH, endM] = (times[1] || '14:00').split(':').map(Number);

    const [year, month, day] = startDateStr.split('-').map(Number);

    const startDate = new Date(year, month - 1, day, startH, startM);
    const endDate = new Date(year, month - 1, day, endH, endM);

    const pad = (n: number) => String(n).padStart(2, '0');
    const formatUtc = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

    const datesParam = `${formatUtc(startDate)}/${formatUtc(endDate)}`;

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: datesParam,
      details: description || '',
      location: location || '교실 / 온라인',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  } catch (err) {
    console.error('Failed to generate Google Calendar URL:', err);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}`;
  }
}
import { getSentDocuments, getStudentFieldTripDays, getStudentAbsenceDays } from '@/lib/services/documentService';
import { getDocConfig, onAfterschoolTimerUpdate, onOrgStructureUpdate, onAfterschoolCoursesUpdate, onAfterschoolEnrollmentsUpdate } from '@/lib/services/settingsService';
import { onUsersDirectoryUpdate } from '@/lib/services/userService';
import { onBusesUpdate, onStudentsUpdate } from '@/lib/kisbus';
import { onConsultationConfigUpdate, onConsultationSlotsUpdate } from '@/lib/services/homeroomClassService';
import type { Bus, Student } from '@/lib/kisbus/types';
import type { Course, Enrollment, GlobalTimerConfig } from '@/lib/afterschool/types';
import type { ApprovalDoc, OrgStructure, UserProfile } from '@/lib/types';
import type { ConsultationConfig, BookingSlot } from '@/lib/types/homeroomClass';
import { ParentBusFareModal } from '@/components/bus/parent-bus-fare-modal';
import { ParentAfterschoolFareModal } from '@/components/afterschool/parent-afterschool-fare-modal';
import { ParentConsultationModal } from '@/components/parent-consultation-modal';
import { useTranslation } from '@/hooks/use-translation';




export default function ParentsDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const [docsLoading, setDocsLoading] = useState(false);
  const [pendingReports, setPendingReports] = useState<ApprovalDoc[]>([]);
  const [processingDocs, setProcessingDocs] = useState<ApprovalDoc[]>([]);
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

  // 학부모 상담 설정 및 예약 슬롯 실시간 연동
  const [consultationConfig, setConsultationConfig] = useState<ConsultationConfig | null>(null);
  const [consultationSlots, setConsultationSlots] = useState<Record<string, BookingSlot>>({});

  const classKey = useMemo(() => {
    if (!profile?.studentGrade || !profile?.studentClass) return '';
    const g = parseInt(profile.studentGrade, 10);
    const c = parseInt(profile.studentClass, 10);
    if (isNaN(g) || isNaN(c)) return '';
    return `${g}-${c}`;
  }, [profile]);

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

  // 학급별 상담 데이터 구독
  useEffect(() => {
    if (!classKey) return;
    const unsubConfig = onConsultationConfigUpdate(classKey, (cfg) => setConsultationConfig(cfg));
    const unsubSlots = onConsultationSlotsUpdate(classKey, (slots) => setConsultationSlots(slots || {}));
    return () => {
      unsubConfig();
      unsubSlots();
    };
  }, [classKey]);

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

        // 출결/체험학습 신청서 중 현재 결재 진행 중인 문서 필터
        const inProgress = docs.filter(
          (d: ApprovalDoc) => 
            d.docType === 'parent' && 
            d.status === 'pending'
        );
        setProcessingDocs(inProgress);

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

  // 2. 스쿨버스 탑승 차량 안내 텍스트 (예: 1호차 탑승 / 미신청)
  const busInfoText = useMemo(() => {
    if (!profile?.studentName) return '미신청';
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
      if (bus?.name) return `${bus.name} 탑승`;
    }
    return '미신청';
  }, [profile, user, busStudents, buses]);

  // 3. 방과후학교 수강 과목 안내 텍스트 (예: 월-KIS 배구부 / 미수강)
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

      if (e.status === 'CANCELLED') return false;
      const st = String(e.status || '').toUpperCase();
      const isEnrolled = st === 'ENROLLED' || st === 'CONFIRMED' || st === 'APPROVED' || !e.status;
      return (isSameName || isSameEmail) && isEnrolled;
    });

    const courseTitles = studentEnrollments.map(e => {
      const course = afterschoolCourses.find(c => c.id === e.courseId);
      const dayLabel = course?.days && course.days.length > 0 ? `${course.days.join(',')}-` : '';
      const title = course?.title || e.courseTitle || '';
      return `${dayLabel}${title}`.trim();
    }).filter(Boolean);

    const uniqueCourses = Array.from(new Set(courseTitles));
    if (uniqueCourses.length === 0) return '미수강';
    if (uniqueCourses.length === 1) return uniqueCourses[0];
    return `${uniqueCourses[0]} 외 ${uniqueCourses.length - 1}건`;
  }, [profile, user, afterschoolEnrollments, afterschoolCourses]);

  // 4. 학부모 상담 일정 및 신청 상태 판별
  // 1) 담임이 현재 학부모 신청 접수를 열어둔 상태 (신청 기간)
  const isConsultationApplyActive = useMemo(() => {
    if (!consultationConfig?.isOpen || !consultationConfig.startDate || !consultationConfig.endDate) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    return todayStr >= consultationConfig.startDate && todayStr <= consultationConfig.endDate;
  }, [consultationConfig]);

  // 2) 전체 상담 주간 기간 내에 속하는지 여부 (접수가 마감되었어도 상담 주간 기간 중인지 확인)
  const isConsultationPeriod = useMemo(() => {
    if (!consultationConfig?.startDate || !consultationConfig.endDate) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    return todayStr >= consultationConfig.startDate && todayStr <= consultationConfig.endDate;
  }, [consultationConfig]);

  // 3) 로그인한 자녀의 예약 확정 슬롯
  const myConsultationSlot = useMemo(() => {
    const slotList = Object.values(consultationSlots);
    if (!slotList.length || !profile?.studentName) return null;
    const sName = profile.studentName.trim().toLowerCase();
    const uEmail = user?.email?.toLowerCase();
    return slotList.find(s => {
      if (s.status !== 'BOOKED' || !s.bookedBy) return false;
      if (s.bookedBy.studentName && s.bookedBy.studentName.trim().toLowerCase() === sName) return true;
      if (uEmail && s.bookedBy.bookedByEmail && s.bookedBy.bookedByEmail.toLowerCase() === uEmail) return true;
      return false;
    }) || null;
  }, [consultationSlots, profile, user]);

  // 4) 내 상담 일정 표시 여부: 예약이 있고, 오늘 날짜가 해당 상담일 당일이거나 이전일 때만 표시 (상담일이 지나면 자동 숨김)
  const showMyConsultationSchedule = useMemo(() => {
    if (!myConsultationSlot?.date) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    // 상담일이 오늘보다 이전이면(과거) 화면에 노출하지 않음
    return myConsultationSlot.date >= todayStr;
  }, [myConsultationSlot]);

  // 현행 신청 알림에서 활성화된 신청 항목 수 계산
  const activeApplicationsCount = useMemo(() => {
    let count = 0;
    if (showMyConsultationSchedule || isConsultationApplyActive) count++;
    if (config?.isBusApplyActive) count++;
    if (isAfterschoolActive) count++;
    return count;
  }, [showMyConsultationSchedule, isConsultationApplyActive, config?.isBusApplyActive, isAfterschoolActive]);

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

      {/* 교외체험학습 및 출석 현황 현황판 (연간 누계 자동 계산 기능 활성화 시에만 노출) */}
      {profile && (config?.enableCumulativeStats !== false) && (
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

      {/* ── 출결/체험학습 신청서 실시간 결재 진행 현황 (제출 중인 건이 있을 때만 표출) ── */}
      {processingDocs.length > 0 && (
        <div className="bg-blue-50/90 border border-blue-200 text-blue-950 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-blue-100 rounded-xl text-blue-700 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-sm sm:text-base text-blue-900">
                  신청서 결재 진행 중 ({processingDocs.length}건)
                </h4>
                <Badge variant="outline" className="bg-blue-100/80 border-blue-300 text-blue-800 text-[10px] font-bold px-2 py-0.5">
                  심사 진행 중
                </Badge>
              </div>
              <p className="text-[11px] sm:text-xs text-blue-700 mt-0.5 truncate">
                {processingDocs[0].title || '신청서'} {processingDocs.length > 1 ? `외 ${processingDocs.length - 1}건` : ''} — 담임 및 교무실 결재가 진행되고 있습니다.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100 font-bold text-xs shrink-0 self-end sm:self-auto cursor-pointer" asChild>
            <Link href="/parents/history">처리 현황 보기 &rarr;</Link>
          </Button>
        </div>
      )}

      {/* ── 현행 신청 알림 (상담 주간, 스쿨버스/방과후 신청 기간) ── */}
      <Card className={`hover:shadow-lg transition-all duration-300 relative overflow-hidden ${
        showMyConsultationSchedule || isConsultationApplyActive || config?.isBusApplyActive || isAfterschoolActive 
          ? 'border-indigo-300 bg-gradient-to-br from-indigo-50/40 via-background to-background ring-1 ring-indigo-100' 
          : 'border-slate-200'
      }`}>
        {activeApplicationsCount > 0 && (
          <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-indigo-600 text-white text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full animate-pulse">
            {activeApplicationsCount}건 진행 중
          </div>
        )}
        <CardHeader className="p-3.5 sm:p-5 pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-foreground">
            <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${
              activeApplicationsCount > 0 ? 'bg-indigo-600/10 text-indigo-600' : 'bg-slate-100 text-slate-500'
            }`}>
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <span>현행 신청 알림</span>
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            {activeApplicationsCount > 0
              ? '현재 접수 중인 학교 주요 신청 및 일정을 안내합니다.'
              : '현재 진행 중인 정기 신청(상담, 버스, 방과후)이 없습니다.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-5 pt-0 sm:pt-0 space-y-2.5">
          {/* 1) 확정된 내 상담 일정 안내 (상담 접수가 마감되어도 상담일 당일까지는 계속 표시, 상담일 지나면 자동 숨김) */}
          {showMyConsultationSchedule && myConsultationSlot && (
            <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-2.5 sm:p-3 text-xs sm:text-sm space-y-1.5">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  상담 예약 확정
                </span>
                <Badge variant="outline" className="bg-emerald-100/70 border-emerald-300 text-emerald-800 text-[10px] font-bold">
                  {myConsultationSlot.date}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                <p className="text-[11px] sm:text-xs text-emerald-700">
                  시간: <span className="font-bold text-emerald-900">{myConsultationSlot.timeRange}</span> (담임: {homeroomTeacherName || '담임교사'})
                </p>
                <a
                  href={getGoogleCalendarUrl({
                    title: `[학부모 상담] ${profile?.studentName || ''} 학생 1:1 상담`,
                    startDateStr: myConsultationSlot.date,
                    timeRange: myConsultationSlot.timeRange,
                    description: `KIS 학부모 상담 주간 일정\n- 학생명: ${profile?.studentName || ''}\n- 학급: ${profile?.studentGrade || ''}학년 ${profile?.studentClass || ''}반\n- 담임교사: ${homeroomTeacherName || '담임교사'}\n- 일시: ${myConsultationSlot.date} ${myConsultationSlot.timeRange}`,
                    location: `${profile?.studentGrade || ''}학년 ${profile?.studentClass || ''}반 교실`,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 hover:text-emerald-900 bg-white/90 hover:bg-white border border-emerald-300 px-2 py-0.5 rounded-md shadow-2xs transition-colors cursor-pointer"
                  title="구글 캘린더에 바로 등록합니다"
                >
                  <CalendarPlus className="w-3 h-3 text-emerald-600" />
                  <span>캘린더에 등록</span>
                </a>
              </div>
            </div>
          )}

          {/* 2) 학부모 상담 접수 진행 중 안내 (아직 예약하지 않은 경우에만 표시) */}
          {isConsultationApplyActive && !myConsultationSlot && (
            <div className="rounded-xl bg-indigo-50/80 border border-indigo-200 p-2.5 sm:p-3 text-xs sm:text-sm space-y-1">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-indigo-600 shrink-0" />
                  학부모 상담 주간 접수 중
                </span>
                <Badge variant="outline" className="bg-indigo-100 border-indigo-200 text-indigo-800 text-[10px] font-bold">
                  ~ {consultationConfig?.endDate}
                </Badge>
              </div>
              <p className="text-[11px] sm:text-xs text-indigo-700">
                담임 선생님과의 1:1 상담 일정을 신청해 주세요.
              </p>
            </div>
          )}

          {/* 스쿨버스 탑승 신청 기간 */}
          {config?.isBusApplyActive && (
            <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-2.5 sm:p-3 flex items-center justify-between text-xs sm:text-sm">
              <span className="font-bold text-amber-900 flex items-center gap-1.5">
                <BusIcon className="h-4 w-4 text-amber-600 shrink-0" />
                스쿨버스 탑승 신청 기간
              </span>
              <Link href="/parents/bus/apply" className="text-[11px] text-amber-700 font-bold hover:underline">
                신청하기 &rarr;
              </Link>
            </div>
          )}

          {/* 방과후 수강 신청 기간 */}
          {isAfterschoolActive && (
            <div className="rounded-xl bg-violet-50/80 border border-violet-200 p-2.5 sm:p-3 flex items-center justify-between text-xs sm:text-sm">
              <span className="font-bold text-violet-900 flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-violet-600 shrink-0" />
                방과후학교 수강 신청 기간
              </span>
              <Link href="/parents/afterschool?tab=apply" className="text-[11px] text-violet-700 font-bold hover:underline">
                신청하기 &rarr;
              </Link>
            </div>
          )}

          {/* 액션 버튼: 예약이 있으면 일정 확인, 미예약이고 접수 중이면 신청하기 */}
          {showMyConsultationSchedule && myConsultationSlot ? (
            <Button variant="outline" className="w-full font-bold border-emerald-300 text-emerald-800 hover:bg-emerald-50 h-9 sm:h-10 text-xs sm:text-sm shadow-xs cursor-pointer" asChild>
              <Link href="/parents/consultation">
                {isConsultationApplyActive ? '상담 예약 확인 / 일정 변경' : '상담 예약 상세 일정 확인'}
              </Link>
            </Button>
          ) : isConsultationApplyActive ? (
            <Button className="w-full font-bold bg-indigo-600 hover:bg-indigo-700 text-white h-9 sm:h-10 text-xs sm:text-sm shadow-xs cursor-pointer" asChild>
              <Link href="/parents/consultation">학부모 상담 신청하기</Link>
            </Button>
          ) : config?.isBusApplyActive ? (
            <Button className="w-full font-bold bg-amber-600 hover:bg-amber-700 text-white h-9 sm:h-10 text-xs sm:text-sm shadow-xs cursor-pointer" asChild>
              <Link href="/parents/bus/apply">스쿨버스 탑승 신청하기</Link>
            </Button>
          ) : isAfterschoolActive ? (
            <Button className="w-full font-bold bg-violet-600 hover:bg-violet-700 text-white h-9 sm:h-10 text-xs sm:text-sm shadow-xs cursor-pointer" asChild>
              <Link href="/parents/afterschool?tab=apply">방과후 수강 신청하기</Link>
            </Button>
          ) : (
            <Button variant="secondary" className="w-full font-bold text-muted-foreground h-9 sm:h-10 text-xs sm:text-sm" disabled>
              진행 중인 신청 없음
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── 연계 교육 서비스 현행 정보 (가로폭 절반 나란히 2열 배치) ── */}
      <div className="space-y-2 sm:space-y-3 pt-2 sm:pt-3 border-t">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold text-foreground font-headline">
            {t('parents.connected_services') || '연계 교육 서비스'}
          </h3>
          <span className="text-[11px] text-muted-foreground">현재 이용 현황</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
          {/* 스쿨버스 미니멀 카드 */}
          <Link 
            href={busInfoText !== '미신청' ? '/parents/bus/student' : (config?.isBusApplyActive ? '/parents/bus/apply' : '/parents/bus')}
            className="group block p-3 sm:p-4 rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-500/10 via-amber-50/40 to-background hover:border-amber-400 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div className="p-1 sm:p-1.5 bg-amber-500/15 rounded-lg text-amber-700 shrink-0">
                  <BusIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <span className="font-extrabold text-xs sm:text-sm text-foreground truncate">스쿨버스</span>
              </div>
              <span className="text-[10px] text-amber-700 font-bold group-hover:translate-x-0.5 transition-transform shrink-0">
                &rarr;
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <span className={`text-xs sm:text-sm font-black truncate ${
                busInfoText !== '미신청' ? 'text-amber-800' : 'text-slate-500'
              }`}>
                {busInfoText}
              </span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                {busInfoText !== '미신청' ? '탑승 현황' : (config?.isBusApplyActive ? '신청 가능' : '노선 안내')}
              </span>
            </div>
          </Link>

          {/* 방과후학교 미니멀 카드 */}
          <Link 
            href={afterschoolInfoText !== '미수강' ? '/parents/afterschool?tab=my' : (isAfterschoolActive ? '/parents/afterschool?tab=apply' : '/parents/afterschool')}
            className="group block p-3 sm:p-4 rounded-2xl border border-violet-200/90 bg-gradient-to-br from-violet-500/10 via-violet-50/40 to-background hover:border-violet-400 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div className="p-1 sm:p-1.5 bg-violet-500/15 rounded-lg text-violet-700 shrink-0">
                  <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <span className="font-extrabold text-xs sm:text-sm text-foreground truncate">방과후학교</span>
              </div>
              <span className="text-[10px] text-violet-700 font-bold group-hover:translate-x-0.5 transition-transform shrink-0">
                &rarr;
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <span className={`text-xs sm:text-sm font-black truncate ${
                afterschoolInfoText !== '미수강' ? 'text-violet-800' : 'text-slate-500'
              }`}>
                {afterschoolInfoText}
              </span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                {afterschoolInfoText !== '미수강' ? '수강 확인' : (isAfterschoolActive ? '신청 가능' : '강좌 안내')}
              </span>
            </div>
          </Link>

          {/* 학생 봉사활동 카드 */}
          <Link 
            href="/parents/volunteer"
            className="group block p-3 sm:p-4 rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-500/10 via-sky-50/40 to-background hover:border-sky-400 hover:shadow-md transition-all duration-200 col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div className="p-1 sm:p-1.5 bg-sky-500/15 rounded-lg text-sky-700 shrink-0">
                  <HeartHandshake className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <span className="font-extrabold text-xs sm:text-sm text-foreground truncate">봉사활동</span>
              </div>
              <span className="text-[10px] text-sky-700 font-bold group-hover:translate-x-0.5 transition-transform shrink-0">
                &rarr;
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-xs sm:text-sm font-black truncate text-sky-800">
                신청 및 확인
              </span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                계획서·확인서
              </span>
            </div>
          </Link>
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

      {/* 스쿨버스 분기 청구서 전달 팝업 */}
      <ParentBusFareModal />

      {/* 방과후 수강료 & 버스비 청구서 전달 팝업 */}
      <ParentAfterschoolFareModal />

      {/* 학부모 상담 주간 유도 팝업 모달 */}
      <ParentConsultationModal 
        classKey={classKey} 
        studentName={profile?.studentName} 
        userEmail={user?.email || undefined} 
      />
    </div>
  );
}


