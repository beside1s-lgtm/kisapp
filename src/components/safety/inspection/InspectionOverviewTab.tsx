'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Printer,
  RefreshCw,
  Plus,
  FileCheck2,
  Users,
  ShieldAlert,
  CheckCheck,
  UploadCloud,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { SchoolFacility, MonthlyInspectionRecord } from '@/lib/safety/types';
import {
  getSchoolFacilities,
  getMonthlyInspections,
  getTeacherPendingInspections,
  batchCompleteAllInspections,
} from '@/lib/services/safetyService';
import { MonthlyInspectionPopupModal } from './MonthlyInspectionPopupModal';
import { InspectionGridTable } from './InspectionGridTable';
import { UninspectedStatusCard } from './UninspectedStatusCard';
import { openSafetyInspectionPrintWindow, saveSafetyInspectionToGoogleDrive } from './InspectionPrintModal';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export function InspectionOverviewTab() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // 기본 연월: 현재 연월 ('2026-10', '2026-11' 등)
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [facilities, setFacilities] = useState<SchoolFacility[]>([]);
  const [records, setRecords] = useState<MonthlyInspectionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBatchCompleting, setIsBatchCompleting] = useState(false);
  const [isSavingDrive, setIsSavingDrive] = useState(false);

  // 모달 제어 상태
  const [isPopupModalOpen, setIsPopupModalOpen] = useState(false);

  // 내 담당 미점검 시설
  const [myPendingFacilities, setMyPendingFacilities] = useState<SchoolFacility[]>([]);

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      const [facList, recordList] = await Promise.all([
        getSchoolFacilities(),
        getMonthlyInspections(selectedYearMonth),
      ]);
      setFacilities(facList);
      setRecords(recordList);

      // 본인 미점검 시설 확인
      const pendingRes = await getTeacherPendingInspections(
        user?.email || undefined,
        profile?.name || user?.displayName || undefined,
        selectedYearMonth
      );
      setMyPendingFacilities(pendingRes.pendingFacilities);
    } catch (e) {
      console.error('Failed to load safety inspection data:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedYearMonth, user?.email, profile?.name, user?.displayName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // 통계 계산
  const stats = useMemo(() => {
    const activeFacilities = facilities.filter(f => f.isActive);
    const totalCount = activeFacilities.length;
    const recordMap: Record<string, MonthlyInspectionRecord> = {};
    records.forEach(r => {
      recordMap[r.facilityId] = r;
    });

    const completedCount = activeFacilities.filter(f => recordMap[f.id]?.isCompleted).length;
    const uninspectedCount = totalCount - completedCount;
    const issueCount = records.filter(r => r.needsFacilityTeamFix).length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      totalCount,
      completedCount,
      uninspectedCount,
      issueCount,
      completionRate,
    };
  }, [facilities, records]);

  const monthDisplay = parseInt(selectedYearMonth.split('-')[1], 10);
  const inspectorName = profile?.name || user?.displayName || '안전지도교사';
  const inspectorEmail = user?.email || 'safety@kshcm.net';

  // 상단 툴바 일괄 점검 완료
  const handleBatchCompleteAll = async () => {
    if (stats.uninspectedCount === 0) {
      toast({ title: '알림', description: '이미 모든 시설의 안전점검이 완료되었습니다.' });
      return;
    }

    if (
      !confirm(
        `${monthDisplay}월 미점검 시설 ${stats.uninspectedCount}개소를 모두 '양호(O)'로 일괄 완료 처리하시겠습니까?`
      )
    ) {
      return;
    }

    setIsBatchCompleting(true);
    try {
      const res = await batchCompleteAllInspections(selectedYearMonth, inspectorName, inspectorEmail);
      toast({
        title: '일괄 점검 완료',
        description: `${monthDisplay}월 미점검 시설 ${res.completedCount}개소가 모두 양호(O)로 완료 처리되었습니다.`,
      });
      loadData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: '일괄 완료 실패', description: e.message });
    } finally {
      setIsBatchCompleting(false);
    }
  };

  // Google Drive에 인쇄 서식 그대로 A4 가로 PDF 다이렉트 저장
  const handleSaveToDrive = async () => {
    setIsSavingDrive(true);
    try {
      const res = await saveSafetyInspectionToGoogleDrive(
        facilities,
        records,
        selectedYearMonth,
        'all'
      );

      if (!res.success) {
        throw new Error(res.error || '드라이브 저장에 실패했습니다.');
      }

      toast({
        title: 'Google Drive 저장 완료',
        description: `${monthDisplay}월 안전점검표가 인쇄 출력물과 100% 동일한 A4 가로 PDF로 Google Drive '07_안전점검표' 폴더에 저장되었습니다.`,
        action: res.webViewLink ? (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 gap-1"
            onClick={() => window.open(res.webViewLink, '_blank')}
          >
            열기 <ExternalLink className="w-3 h-3" />
          </Button>
        ) : undefined,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '드라이브 저장 실패',
        description: err.message || '저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSavingDrive(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. 상단 컨트롤 바: 연월 선택 및 액션 버튼들 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                매월 4일 정기 안전점검표 종합 현황
              </h3>
              <Badge variant="outline" className="text-[10px] font-bold text-amber-800 bg-amber-50 border-amber-200">
                정기 점검
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              학교 시설별 담당 교사 매칭 및 매월 4일 점검표 종합 취합·미점검 추적
            </p>
          </div>
        </div>

        {/* 연월 선택기 및 액션 버튼 */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedYearMonth} onValueChange={setSelectedYearMonth}>
            <SelectTrigger className="w-[125px] h-8 text-xs font-bold bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026-12">2026년 12월</SelectItem>
              <SelectItem value="2026-11">2026년 11월</SelectItem>
              <SelectItem value="2026-10">2026년 10월</SelectItem>
              <SelectItem value="2026-09">2026년 09월</SelectItem>
              <SelectItem value="2026-08">2026년 08월</SelectItem>
              <SelectItem value="2026-07">2026년 07월</SelectItem>
              <SelectItem value="2026-06">2026년 06월</SelectItem>
              <SelectItem value="2026-05">2026년 05월</SelectItem>
              <SelectItem value="2026-04">2026년 04월</SelectItem>
              <SelectItem value="2026-03">2026년 03월</SelectItem>
            </SelectContent>
          </Select>

          {stats.uninspectedCount > 0 && (
            <Button
              size="sm"
              onClick={handleBatchCompleteAll}
              disabled={isBatchCompleting}
              className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              title="미점검 시설 전원 일괄 점검 완료"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              {isBatchCompleting ? '처리 중...' : '일괄 점검 완료'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveToDrive}
            disabled={isSavingDrive}
            className="h-8 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-50 border-emerald-300 shadow-2xs"
            title="화면 인쇄 서식 그대로 A4 가로 PDF로 Google Drive에 저장합니다"
          >
            {isSavingDrive ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin text-emerald-600" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            )}
            <span>Google Drive에 저장</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => openSafetyInspectionPrintWindow(facilities, records, selectedYearMonth)}
            className="h-8 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border-slate-200"
            title="A4 1장 학교 공식 서식 인쇄"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            서식 인쇄
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 text-xs text-slate-500 hover:text-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 2. 4대 핵심 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <Card className="border border-slate-200 bg-white shadow-2xs">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-slate-500">점검 대상 시설</span>
            <div className="text-lg sm:text-xl font-black text-slate-900">
              {stats.totalCount} <span className="text-xs font-normal text-slate-500">개소</span>
            </div>
            <p className="text-[10px] text-slate-400">1~6학년 일반교실 및 전교 특별실</p>
          </CardContent>
        </Card>

        <Card className="border border-emerald-200 bg-emerald-50/30 shadow-2xs">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-emerald-800">점검 완료 시설</span>
            <div className="text-lg sm:text-xl font-black text-emerald-700 flex items-baseline gap-1.5">
              <span>{stats.completedCount}</span>
              <span className="text-xs font-bold text-emerald-600">({stats.completionRate}%)</span>
            </div>
            <p className="text-[10px] text-emerald-600">담당 교사 서명(인) 제출 완료</p>
          </CardContent>
        </Card>

        <Card className={`border shadow-2xs ${stats.uninspectedCount > 0 ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'}`}>
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-rose-800">미점검 시설</span>
            <div className="text-lg sm:text-xl font-black text-rose-600">
              {stats.uninspectedCount} <span className="text-xs font-normal text-slate-500">개소</span>
            </div>
            <p className="text-[10px] text-rose-500">접속 시 점검표 팝업 자동 독려</p>
          </CardContent>
        </Card>

        <Card className="border border-amber-200 bg-amber-50/30 shadow-2xs">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-amber-800">시설관리팀(520) 요청</span>
            <div className="text-lg sm:text-xl font-black text-amber-700">
              {stats.issueCount} <span className="text-xs font-normal text-slate-500">건</span>
            </div>
            <p className="text-[10px] text-amber-600">점검 중 이상 발견 및 보수 요청</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. 내 담당 미점검 시설 바로 점검 배너 (로그인 교사가 담당 시설이 있을 때) */}
      {myPendingFacilities.length > 0 && (
        <div className="bg-amber-500 text-white p-3 sm:p-4 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black flex items-center gap-2">
                <span>선생님의 {monthDisplay}월 안전점검표 작성이 필요합니다!</span>
                <Badge className="bg-white text-amber-900 font-bold text-[10px]">
                  미점검 {myPendingFacilities.length}개소
                </Badge>
              </div>
              <p className="text-xs text-amber-100 mt-0.5">
                담당 장소: {myPendingFacilities.map(f => f.fullName || f.name).join(', ')}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setIsPopupModalOpen(true)}
            className="bg-white text-amber-900 hover:bg-amber-50 font-bold text-xs h-9 px-4 shrink-0 shadow-xs"
          >
            지금 점검표 작성하기
          </Button>
        </div>
      )}

      {/* 4. 미점검 교사 및 시설 현황 추적 카드 */}
      <UninspectedStatusCard
        facilities={facilities}
        records={records}
        yearMonth={selectedYearMonth}
        onDataUpdated={loadData}
      />

      {/* 5. 학교 실제 서식 종합 점검표 그리드 */}
      <InspectionGridTable
        facilities={facilities}
        records={records}
        yearMonth={selectedYearMonth}
      />

      {/* 6. 모달 다이얼로그들 */}
      {myPendingFacilities.length > 0 && (
        <MonthlyInspectionPopupModal
          open={isPopupModalOpen}
          onOpenChange={setIsPopupModalOpen}
          pendingFacilities={myPendingFacilities}
          yearMonth={selectedYearMonth}
          onSubmitted={loadData}
        />
      )}
    </div>
  );
}
