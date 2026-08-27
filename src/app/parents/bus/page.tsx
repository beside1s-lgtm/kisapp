'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CalendarCheck, Search, ArrowLeft, Home, Bus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getDocConfig } from '@/lib/services/settingsService';
import { DocConfig } from '@/lib/types';
import { ParentBusFareModal } from '@/components/bus/parent-bus-fare-modal';
import { useAuth } from '@/hooks/use-auth';
import { onStudentsUpdate, onBusesUpdate } from '@/lib/kisbus';
import type { Bus as BusType, Student as BusStudent } from '@/lib/kisbus/types';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';

export default function ParentsBusIndexPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [config, setConfig] = useState<DocConfig | null>(null);
  const [buses, setBuses] = useState<BusType[]>([]);
  const [busStudents, setBusStudents] = useState<BusStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getDocConfig().then(cfg => setConfig(cfg));
    const unsubBuses = onBusesUpdate((bList) => setBuses(bList || []));
    const unsubStudents = onStudentsUpdate((sList) => {
      setBusStudents(sList || []);
      setIsLoading(false);
    });

    return () => {
      unsubBuses();
      unsubStudents();
    };
  }, []);

  // 자녀의 스쿨버스 탑승 여부 실시간 매칭
  const matchedStudent = useMemo(() => {
    if (!profile?.studentName) return null;
    const sName = profile.studentName.trim().toLowerCase();
    const sGrade = String(parseInt(profile.studentGrade || '', 10) || profile.studentGrade || '').trim();
    const sClass = String(parseInt(profile.studentClass || '', 10) || profile.studentClass || '').trim();

    return busStudents.find(s => {
      const studentName = (s.name || '').trim().toLowerCase();
      const studentGrade = String(parseInt(s.grade || '', 10) || s.grade || '').trim();
      const studentClass = String(parseInt(s.class || '', 10) || s.class || '').trim();

      const isSameName = studentName === sName;
      const isSameClass = (!sGrade || studentGrade === sGrade) && (!sClass || studentClass === sClass);
      const isSameEmail = s.parentEmail && user?.email && s.parentEmail.toLowerCase() === user.email.toLowerCase();
      const isSamePhone = s.contact && profile.parentPhone && s.contact.replace(/\D/g, '') === profile.parentPhone.replace(/\D/g, '');

      return (isSameName && isSameClass) || isSameEmail || (isSameName && isSamePhone);
    });
  }, [profile, user, busStudents]);

  const isBoarding = !!(matchedStudent && (matchedStudent.assignedBusId || matchedStudent.routeId || matchedStudent.stationId));
  const assignedBus = matchedStudent?.assignedBusId ? buses.find(b => b.id === matchedStudent.assignedBusId) : null;

  return (
    <div className="max-w-4xl mx-auto py-2 px-1 sm:py-6 sm:px-4 space-y-3 sm:space-y-6">
      {/* 통일된 상단 네비게이션 헤더 */}
      <div className="flex items-center gap-1.5 sm:gap-2 print:hidden">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 sm:h-9 text-xs sm:text-sm bg-card hover:bg-muted text-muted-foreground hover:text-foreground shadow-2xs" 
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          {t('back') || '뒤로가기'}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 sm:h-9 text-xs sm:text-sm bg-card hover:bg-muted text-muted-foreground hover:text-foreground shadow-2xs" 
          onClick={() => router.push('/parents')}
        >
          <Home className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          {t('nav.home') || '홈'}
        </Button>
      </div>

      {/* 페이지 헤더 */}
      <div className="bg-card p-3.5 sm:p-5 rounded-xl border border-border shadow-xs">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold font-headline text-foreground">
                {t('parents.bus_title') || '스쿨버스 서비스'}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('parents.bus_desc') || '자녀의 스쿨버스 탑승 신청 및 배정 좌석, 운행 정보를 확인합니다.'}
              </p>
            </div>
          </div>
          
          {profile?.studentName && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">{profile.studentName}:</span>
              {isBoarding ? (
                <Badge className="bg-green-100 text-green-800 border-green-200 font-bold text-xs">
                  {t('parents.bus.boarding_status') || '탑승 중'} ({assignedBus?.name || '배정 대기'})
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 font-bold text-xs">
                  {t('parents.bus.non_boarding') || '버스 미탑승'}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:gap-6 md:grid-cols-2">
        {/* 1. 탑승 신청 카드 */}
        <Card className={`hover:border-amber-400 transition-all ${config?.isBusApplyActive ? 'border-amber-200 bg-card' : 'border-border opacity-90'} w-full min-w-0`}>
          <CardHeader className="p-3.5 sm:p-5 pb-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-amber-600 font-headline">
              <CalendarCheck className="h-5 w-5 text-amber-500 shrink-0" />
              <span>{t('parents.bus.apply_title') || '스쿨버스 탑승 신청'}</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {t('parents.bus.apply_desc') || '정규 학기 등하교 버스 및 토요 방과후학교 버스 탑승 신청을 작성합니다.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-5 pt-0 space-y-2.5">
            {config?.isBusApplyActive ? (
              <Button className="w-full font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs h-8 sm:h-9 text-xs sm:text-sm" asChild>
                <Link href="/parents/bus/apply">{t('parents.bus.apply_btn') || '탑승 신청하기'}</Link>
              </Button>
            ) : (
              <div className="space-y-2">
                <Button className="w-full font-bold text-muted-foreground bg-muted hover:bg-muted cursor-not-allowed h-8 sm:h-9 text-xs sm:text-sm" variant="secondary" disabled>
                  {t('parents.bus.apply_closed') || '탑승 신청 (기간 종료)'}
                </Button>
                <p className="text-[11px] text-amber-600 text-center font-medium bg-amber-50/70 border border-amber-200/50 py-1 rounded-md">
                  {t('parents.bus.closed_notice') || '※ 현재는 스쿨버스 탑승 신청 기간이 아닙니다.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. 자녀 탑승 조회 카드 (탑승 신청한 경우만 조회 버튼 노출 / 미탑승 시 '버스 미탑승' 안내) */}
        {isBoarding ? (
          <Card className="hover:border-blue-400 transition-all border-blue-200 bg-card w-full min-w-0">
            <CardHeader className="p-3.5 sm:p-5 pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-base sm:text-lg text-blue-600 font-headline flex-wrap">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-blue-500 shrink-0" />
                  <span>{t('parents.bus_status_btn') || '자녀 탑승 조회'}</span>
                </div>
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-bold text-[11px]">
                  {assignedBus?.name || '노선 배정'}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {t('parents.bus_desc') || '자녀의 노선 배정 결과, 좌석 번호, 등하교 탑승 여부를 실시간으로 조회합니다.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5 pt-0">
              <Button className="w-full font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs h-8 sm:h-9 text-xs sm:text-sm" asChild>
                <Link href="/parents/bus/student">{t('parents.bus.lookup_btn') || '탑승 정보 조회'}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-muted/20 w-full min-w-0">
            <CardHeader className="p-3.5 sm:p-5 pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-base sm:text-lg text-muted-foreground font-headline flex-wrap">
                <div className="flex items-center gap-2">
                  <Bus className="h-5 w-5 text-muted-foreground shrink-0 opacity-70" />
                  <span>{t('parents.bus.status_title') || '스쿨버스 이용 상태'}</span>
                </div>
                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 font-bold text-[11px]">
                  {t('parents.bus.non_boarding') || '버스 미탑승'}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {t('parents.bus.non_boarding_desc') || '현재 자녀는 스쿨버스 탑승 신청 내역이 없습니다. (버스 미탑승)'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5 pt-0">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-center">
                <p className="text-xs text-slate-500 font-medium">
                  {config?.isBusApplyActive 
                    ? (t('parents.bus.non_boarding_guide') || '스쿨버스 이용을 원하시면 왼쪽의 [탑승 신청하기]를 진행해 주세요.')
                    : (t('parents.bus.non_boarding_desc') || '현재는 버스를 이용하지 않는 학생입니다.')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 스쿨버스 분기 요금 청구서 팝업 (탑승 학생에게만 청구서 모달 활성화) */}
      {isBoarding && <ParentBusFareModal />}
    </div>
  );
}
