'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileEdit, History, Info, AlertCircle, Loader2, Bus as BusIcon, GraduationCap } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getSentDocuments, getStudentFieldTripDays, getStudentAbsenceDays } from '@/lib/services/documentService';
import { getDocConfig, onAfterschoolTimerUpdate } from '@/lib/services/settingsService';
import { ApprovalDoc, DocConfig } from '@/lib/types';
import type { GlobalTimerConfig } from '@/lib/afterschool/types';

export default function ParentsDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const [docsLoading, setDocsLoading] = useState(false);
  const [pendingReports, setPendingReports] = useState<ApprovalDoc[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [timerConfig, setTimerConfig] = useState<GlobalTimerConfig | null>(null);
  const [accumulatedFieldTripDays, setAccumulatedFieldTripDays] = useState<number>(0);
  const [accumulatedAbsenceDays, setAccumulatedAbsenceDays] = useState<number>(0);

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
    return () => {
      unsubTimer();
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

  if (authLoading || docsLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">학부모 서비스 대시보드</h1>
        <p className="text-muted-foreground text-lg">
          KISAPP 학부모 서비스에 오신 것을 환영합니다. 원하시는 메뉴를 선택해주세요.
        </p>
      </div>

      {/* 미제출 보고서 알림 배너 */}
      {pendingReports.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-lg text-amber-700 shrink-0">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-[16px]">보고서 제출 필요 {pendingReports.length}건</h4>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                승인된 교외체험학습 종료 후 7일 이내에 결과보고서를 제출해야 출석 처리가 최종 완료됩니다.
              </p>
            </div>
          </div>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0 self-end sm:self-auto transition-colors" asChild>
            <Link href="/parents/history">보고서 작성하러 가기</Link>
          </Button>
        </div>
      )}

      {/* 교외체험학습 및 출석 현황 현황판 */}
      {profile && (
        <Card className="border border-slate-200/60 shadow-sm bg-slate-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-indigo-600" />
              <span>{profile.studentName || '자녀'} 학생 출결 및 교외체험학습 현황</span>
            </CardTitle>
            <CardDescription className="text-xs">
              학년도 연간 총 수업일수 기준 한도 설정 현황입니다. (올해 기준 수업일수: {config?.annualSchoolDays || 190}일)
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            {/* 교외체험학습 한도 카드 */}
            <div className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm text-slate-700">교외체험학습 사용 일수</span>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">연간 10% 한도</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black text-slate-800">
                  {accumulatedFieldTripDays}일 <span className="text-xs font-normal text-slate-400">사용</span>
                </span>
                <span className="text-sm font-semibold text-slate-500">
                  최대 {Math.floor((config?.annualSchoolDays || 190) * 0.1)}일 중 {Math.max(Math.floor((config?.annualSchoolDays || 190) * 0.1) - accumulatedFieldTripDays, 0)}일 남음
                </span>
              </div>
              {/* 프로그레스바 */}
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min((accumulatedFieldTripDays / Math.max(Math.floor((config?.annualSchoolDays || 190) * 0.1), 1)) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* 결석 한도 카드 */}
            <div className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm text-slate-700">누적 결석 일수 (미인정/병결 등)</span>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">수업일수 2/3 출석 의무</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black text-rose-600">
                  {accumulatedAbsenceDays}일 <span className="text-xs font-normal text-slate-400">결석</span>
                </span>
                <span className="text-sm font-semibold text-slate-500">
                  최대 {(config?.annualSchoolDays || 190) - Math.ceil((config?.annualSchoolDays || 190) * 2 / 3)}일 허용 중 {Math.max(((config?.annualSchoolDays || 190) - Math.ceil((config?.annualSchoolDays || 190) * 2 / 3)) - accumulatedAbsenceDays, 0)}일 남음
                </span>
              </div>
              {/* 프로그레스바 */}
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div 
                  className="bg-rose-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min((accumulatedAbsenceDays / Math.max(((config?.annualSchoolDays || 190) - Math.ceil((config?.annualSchoolDays || 190) * 2 / 3)), 1)) * 100, 100)}%` }}
                ></div>
              </div>
              {accumulatedAbsenceDays >= ((config?.annualSchoolDays || 190) - Math.ceil((config?.annualSchoolDays || 190) * 2 / 3)) * 0.8 && (
                <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 animate-pulse">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>수업일수 부족으로 인한 미수료(유급) 위험이 있으니 주의하십시오.</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-all duration-300 border-primary/20 bg-gradient-to-br from-primary/5 to-background hover:-translate-y-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-primary">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileEdit className="h-6 w-6" />
              </div>
              신청서 제출
            </CardTitle>
            <CardDescription className="text-sm">
              학교에 제출할 각종 신청서 및 동의서를 간편하게 작성하고 제출합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full font-bold shadow-md hover:shadow-lg transition-all" asChild>
              <Link href="/parents/apply">바로가기</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 relative overflow-hidden border-slate-200">
          {pendingReports.length > 0 && (
            <div className="absolute top-3 right-3 bg-rose-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full animate-bounce">
              보고서 대기 {pendingReports.length}
            </div>
          )}
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                <History className="h-6 w-6" />
              </div>
              제출 내역
            </CardTitle>
            <CardDescription className="text-sm">
              이전에 제출하신 문서들의 상세 내용과 실시간 처리 상태를 확인합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full font-bold hover:bg-blue-500/5 hover:text-blue-600 transition-colors" asChild>
              <Link href="/parents/history">내역 보기</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                <Info className="h-6 w-6" />
              </div>
              학교 공지사항
            </CardTitle>
            <CardDescription className="text-sm">
              학교에서 안내하는 주요 공지사항과 가정통신문을 확인합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" className="w-full font-bold text-muted-foreground" disabled>
              준비 중입니다
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 프리미엄 연계 서비스 섹션 */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-xl font-bold text-foreground font-headline flex items-center gap-2">
          연계 교육 서비스
        </h3>
        <div className="grid gap-6 md:grid-cols-2">
          {/* 스쿨버스 카드 */}
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-amber-200 bg-gradient-to-br from-amber-500/5 to-background">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-amber-600 font-headline">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <BusIcon className="h-6 w-6" />
                </div>
                스쿨버스
              </CardTitle>
              <CardDescription className="text-sm">
                스쿨버스 탑승 신청 및 자녀의 배정 좌석, 버스 탑승 여부를 확인합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex gap-2">
                {config?.isBusApplyActive ? (
                  <Button className="flex-1 font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all" asChild>
                    <Link href="/parents/bus/apply">탑승 신청</Link>
                  </Button>
                ) : (
                  <Button className="flex-1 font-bold text-muted-foreground bg-slate-100 hover:bg-slate-100 cursor-not-allowed" variant="secondary" disabled>
                    탑승 신청 (기간 종료)
                  </Button>
                )}
                <Button variant="outline" className="flex-1 font-bold border-amber-200 text-amber-700 hover:bg-amber-50" asChild>
                  <Link href="/parents/bus/student">자녀 탑승 조회</Link>
                </Button>
              </div>
              {!config?.isBusApplyActive && (
                <p className="text-xs text-amber-600 text-center font-medium bg-amber-50 border border-amber-200/50 py-1.5 rounded-lg">
                  ※ 현재는 스쿨버스 탑승 신청 기간이 아닙니다.
                </p>
              )}
            </CardContent>
          </Card>

          {/* 방과후학교 카드 */}
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-violet-200 bg-gradient-to-br from-violet-500/5 to-background">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-violet-600 font-headline">
                <div className="p-2 bg-violet-500/10 rounded-lg">
                  <GraduationCap className="h-6 w-6" />
                </div>
                방과후학교
              </CardTitle>
              <CardDescription className="text-sm">
                방과후학교의 수강신청을 하거나 수강 신청된 강좌를 확인 및 취소합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex gap-2">
                {isAfterschoolActive ? (
                  <Button className="flex-1 font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-md transition-all" asChild>
                    <Link href="/parents/afterschool?tab=apply">수강 신청</Link>
                  </Button>
                ) : (
                  <Button className="flex-1 font-bold text-muted-foreground bg-slate-100 hover:bg-slate-100 cursor-not-allowed" variant="secondary" disabled>
                    수강 신청 (기간 종료)
                  </Button>
                )}
                <Button variant="outline" className="flex-1 font-bold border-violet-200 text-violet-700 hover:bg-violet-50" asChild>
                  <Link href="/parents/afterschool?tab=my">신청 확인 및 취소</Link>
                </Button>
              </div>
              {!isAfterschoolActive && (
                <p className="text-xs text-violet-600 text-center font-medium bg-violet-50 border border-violet-200/50 py-1.5 rounded-lg">
                  ※ 현재는 방과후학교 수강신청 기간이 아닙니다.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
