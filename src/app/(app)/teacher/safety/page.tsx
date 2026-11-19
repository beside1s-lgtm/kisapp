'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { getOrgStructure } from '@/lib/services/settingsService';
import { getSafetyPermissionDetails } from '@/lib/services/permissionService';
import type { OrgStructure } from '@/lib/types';

import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert, Home, ShieldCheck, GraduationCap, CalendarCheck } from 'lucide-react';

import { SafetyDashboardHeader } from '@/components/safety/SafetyDashboardHeader';
import { SafetyStatsCards } from '@/components/safety/SafetyStatsCards';
import { InspectionOverviewTab } from '@/components/safety/inspection/InspectionOverviewTab';
import { SafetyEducationTab } from '@/components/safety/education/SafetyEducationTab';

function SafetySkeleton() {
  return (
    <div className="container mx-auto p-4 space-y-4">
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      <Skeleton className="h-[450px] w-full rounded-2xl" />
    </div>
  );
}

export type SafetyTabType = 'education' | 'inspection' | 'violence-prevention';

export default function TeacherSafetyPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [org, setOrg] = useState<Partial<OrgStructure> | null>(null);
  const [isOrgLoading, setIsOrgLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 3대 핵심 업무 탭 상태
  const [activeTab, setActiveTab] = useState<SafetyTabType>('education');

  // 1. 조직도 및 담당 업무 로드
  useEffect(() => {
    getOrgStructure()
      .then(data => {
        setOrg(data || null);
        setIsOrgLoading(false);
      })
      .catch(() => {
        setIsOrgLoading(false);
      });
  }, []);

  // 2. 권한 판별
  const permissionInfo = useMemo(() => {
    return getSafetyPermissionDetails(user?.email, profile, org);
  }, [user?.email, profile, org]);

  const hasAccess = permissionInfo.canAccess;

  // 3. 새로고침
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await getOrgStructure();
      setOrg(data || null);
    } catch (e) {
      console.error('Failed to refresh safety data:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // 안전지도 담당자 성명 계산
  const managerName = useMemo(() => {
    if (profile?.name) return profile.name;
    if (user?.displayName) return user.displayName;
    return undefined;
  }, [profile?.name, user?.displayName]);

  if (isOrgLoading) {
    return <SafetySkeleton />;
  }

  // 권한이 없는 경우 안내 화면
  if (!hasAccess) {
    return (
      <div className="flex-1 w-full h-full min-h-0 overflow-y-auto overscroll-contain">
        <div className="w-full max-w-2xl mx-auto py-12 px-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-2xs">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base sm:text-lg font-black text-slate-900">학생 안전지도 관리소 접근 권한 필요</h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                현재 계정({user?.email || '알 수 없음'})에는 안전지도 및 학교 안전 관리 권한이 부여되어 있지 않습니다.
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3.5 text-left text-xs text-slate-600 space-y-1.5 border border-slate-200/70 max-w-md mx-auto">
              <p className="font-bold text-slate-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                담당자 배정 및 권한 안내:
              </p>
              <p>1. 관리자 메뉴의 [설정] &gt; [업무 담당 설정] 탭으로 이동</p>
              <p>2. [안전지도 담당자 / 학생 안전] 직책에 본인 계정을 배정</p>
              <p>3. 또는 소속 부서 관리에서 [안전지도] 업무 담당자로 배정</p>
            </div>
            <div className="pt-2 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/inbox')}
                className="text-xs font-bold"
              >
                <Home className="w-3.5 h-3.5 mr-1" />
                메인 대시보드로 이동
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full min-h-0 overflow-y-auto overscroll-contain">
      <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 py-3.5 space-y-4 pb-32">
        {/* 1. 상단 대시보드 헤더 */}
        <SafetyDashboardHeader
          managerName={managerName}
          roleTitle={permissionInfo.roleTitle || '안전지도 담당자'}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />

        {/* 2. 3대 핵심 업무 현황 카드 (클릭 시 탭 전환) */}
        <SafetyStatsCards
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
        />

        {/* 3. 3대 핵심 업무 콘텐츠 (상단 카드로 탭 전환) */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as SafetyTabType)} className="w-full">
          {/* 탭 1: 학생 안전교육 (계획 수립, 7대 안전교육 이수 및 기안문 작성) */}
          <TabsContent value="education" className="m-0 focus-visible:outline-hidden">
            <SafetyEducationTab />
          </TabsContent>

          {/* 탭 2: 안전점검의 날 (학교 시설별 담당 교사 및 매월 4일 점검표 종합) */}
          <TabsContent value="inspection" className="m-0 focus-visible:outline-hidden">
            <InspectionOverviewTab />
          </TabsContent>

          {/* 탭 3: 학교폭력예방교육 (내용 추후 생성용 빈 컨테이너) */}
          <TabsContent value="violence-prevention" className="m-0 focus-visible:outline-hidden">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-14 text-center shadow-2xs space-y-3 min-h-[360px] flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shadow-2xs">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">학교폭력예방교육</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  학기별 학교폭력 예방교육 운영계획, 어울림 프로그램 및 실적 관리 영역입니다.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
