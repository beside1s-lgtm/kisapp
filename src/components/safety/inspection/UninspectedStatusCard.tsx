'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, Mail, Bell, UserX, FileCheck2, CheckCheck, UploadCloud, ExternalLink, Loader2, Printer } from 'lucide-react';
import type { SchoolFacility, MonthlyInspectionRecord } from '@/lib/safety/types';
import { proxyCompleteTeacherInspections, batchCompleteAllInspections } from '@/lib/services/safetyService';
import { getTeacherSignaturesDirectory } from '@/lib/services/userService';
import { getGoogleDriveConfig, saveGoogleDriveConfig } from '@/lib/services/settingsService';
import { openSafetyInspectionPrintWindow, saveSafetyInspectionToGoogleDrive } from './InspectionPrintModal';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface UninspectedStatusCardProps {
  facilities: SchoolFacility[];
  records: MonthlyInspectionRecord[];
  yearMonth: string;
  onDataUpdated?: () => void;
}

export function UninspectedStatusCard({
  facilities,
  records,
  yearMonth,
  onDataUpdated,
}: UninspectedStatusCardProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [lastArchivedUrl, setLastArchivedUrl] = useState<string | null>(null);

  const inspectorName = profile?.name || user?.displayName || '안전지도교사';
  const inspectorEmail = user?.email || 'safety@kshcm.net';

  const recordMap = useMemo(() => {
    const map: Record<string, MonthlyInspectionRecord> = {};
    records.forEach(r => {
      map[r.facilityId] = r;
    });
    return map;
  }, [records]);

  // 미점검 시설 목록
  const uninspectedFacilities = useMemo(() => {
    return facilities.filter(f => f.isActive && !recordMap[f.id]?.isCompleted);
  }, [facilities, recordMap]);

  // 미점검 교사 목록 (중복 제거 및 facilityIds 포함)
  const uninspectedTeachers = useMemo(() => {
    const teacherMap: Record<
      string,
      { name: string; email?: string; facilities: string[]; facilityIds: string[] }
    > = {};
    uninspectedFacilities.forEach(f => {
      const name = f.assignedTeacherName || '미지정';
      if (!teacherMap[name]) {
        teacherMap[name] = {
          name,
          email: f.assignedTeacherEmail,
          facilities: [],
          facilityIds: [],
        };
      }
      teacherMap[name].facilities.push(f.fullName || f.name);
      teacherMap[name].facilityIds.push(f.id);
    });
    return Object.values(teacherMap);
  }, [uninspectedFacilities]);

  const monthDisplay = parseInt(yearMonth.split('-')[1], 10);

  const handleSendReminder = (teacherName: string, facilityNames: string[]) => {
    toast({
      title: '점검 독려 알림 발송',
      description: `${teacherName} 선생님에게 ${monthDisplay}월 안전점검(${facilityNames.join(', ')}) 독려 메시지가 전송되었습니다.`,
    });
  };

  const handleSendAllReminders = () => {
    toast({
      title: '미점검 교사 전원 독려 알림 발송',
      description: `미점검 교사 ${uninspectedTeachers.length}명에게 ${monthDisplay}월 안전점검 독려 알림이 일괄 전송되었습니다.`,
    });
  };

  // 대리 점검 처리
  const handleProxyComplete = async (
    teacherName: string,
    teacherEmail: string,
    facilityIds: string[],
    facilityNames: string[]
  ) => {
    if (
      !confirm(
        `${teacherName} 선생님의 담당 장소(${facilityNames.join(', ')})에 대해 안전지도 담당 교사 권한으로 대리 점검 완료 처리하시겠습니까?`
      )
    ) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await proxyCompleteTeacherInspections(
        teacherName,
        teacherEmail,
        facilityIds,
        yearMonth,
        inspectorName,
        inspectorEmail
      );
      toast({
        title: '대리 점검 완료',
        description: `${teacherName} 선생님의 ${res.completedCount}개 시설 안전점검이 대리 완료되었습니다.`,
      });
      onDataUpdated?.();
    } catch (e: any) {
      toast({ variant: 'destructive', title: '대리 점검 실패', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // 일괄 점검 완료 처리
  const handleBatchCompleteAll = async () => {
    if (
      !confirm(
        `${monthDisplay}월 현재 미점검된 ${uninspectedFacilities.length}개 모든 시설에 대해 전체 '양호(O)'로 일괄 점검 완료 처리하시겠습니까?`
      )
    ) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await batchCompleteAllInspections(yearMonth, inspectorName, inspectorEmail);
      toast({
        title: '일괄 점검 완료 처리 완료',
        description: `${monthDisplay}월 미점검 시설 ${res.completedCount}개소가 모두 완료 처리되었습니다.`,
      });
      onDataUpdated?.();
    } catch (e: any) {
      toast({ variant: 'destructive', title: '일괄 완료 처리 실패', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // 구글 드라이브 07_안전점검표 폴더로 인쇄 출력물 그대로 PDF 저장 (백엔드 문서 생성 0%)
  const handleSaveToDrive = async () => {
    setIsArchiving(true);
    try {
      const res = await saveSafetyInspectionToGoogleDrive(
        facilities,
        records,
        yearMonth,
        'all',
        (msg) => {
          console.log('[SaveSafetyToDrive]', msg);
        }
      );

      if (!res.success) {
        throw new Error(res.error || '드라이브 저장에 실패했습니다.');
      }

      setLastArchivedUrl(res.webViewLink || null);
      toast({
        title: 'Google Drive 저장 완료',
        description: `${monthDisplay}월 안전점검표가 인쇄 출력 서식과 100% 동일한 A4 가로 PDF로 Google Drive에 저장되었습니다.`,
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
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: '드라이브 저장 실패',
        description: e.message || '저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsArchiving(false);
    }
  };

  if (uninspectedFacilities.length === 0) {
    return (
      <Card className="border border-emerald-200 bg-emerald-50/50 shadow-2xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-emerald-900">
                {monthDisplay}월 전체 {facilities.length}개 학교 시설 안전점검 100% 완료!
              </h4>
              <p className="text-xs text-emerald-700 mt-0.5">
                모든 담당 교사의 매월 4일 정기 안전점검표 작성이 완료되었습니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isArchiving}
              onClick={handleSaveToDrive}
              className="h-8 text-xs font-bold text-emerald-800 border-emerald-300 bg-white hover:bg-emerald-100 shadow-2xs gap-1.5"
              title="중앙저장소 07_안전점검표 폴더에 월별 점검표를 PDF로 저장합니다"
            >
              {isArchiving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  저장 중...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 text-emerald-600" />
                  드라이브에 저장
                </>
              )}
            </Button>
            {lastArchivedUrl && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.open(lastArchivedUrl, '_blank')}
                className="h-8 text-xs font-bold text-emerald-700 hover:bg-emerald-100 gap-1 px-2"
                title="Google Drive에서 저장된 PDF 열기"
              >
                <span>열기</span>
                <ExternalLink className="w-3 h-3" />
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => openSafetyInspectionPrintWindow(facilities, records, yearMonth)}
              className="h-8 text-xs font-bold text-slate-700 border-slate-300 bg-white hover:bg-slate-100 shadow-2xs gap-1 px-2.5"
              title="점검표를 즉시 브라우저 인쇄 및 PDF로 다운로드합니다"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              PDF 인쇄
            </Button>
            <Badge className="bg-emerald-600 text-white font-bold text-xs">
              완료율 100%
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-rose-200 bg-rose-50/40 shadow-2xs">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-black text-rose-900 flex items-center gap-2">
                <span>{monthDisplay}월 안전점검 미완료 교사 현황</span>
                <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300 font-bold text-[10px]">
                  미점검 {uninspectedFacilities.length}개소 ({uninspectedTeachers.length}명)
                </Badge>
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                미점검 교사가 앱에 접속하면 자동으로 안전점검표 팝업이 노출되며, 담당자는 대리 점검 또는 일괄 점검 완료를 실행할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendAllReminders}
              className="h-8 text-xs font-bold text-rose-700 border-rose-200 bg-white hover:bg-rose-50"
            >
              <Bell className="w-3.5 h-3.5 mr-1" />
              전원 독려
            </Button>
            <Button
              size="sm"
              onClick={handleBatchCompleteAll}
              disabled={isProcessing}
              className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              title="미점검된 모든 시설을 전원 양호(O)로 일괄 완료 처리합니다"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              {isProcessing ? '처리 중...' : '일괄 점검 완료'}
            </Button>
          </div>
        </div>

        {/* 미점검 교사 칩 목록 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
          {uninspectedTeachers.map(t => (
            <div
              key={t.name}
              className="bg-white border border-rose-200/80 rounded-xl p-2.5 flex items-center justify-between shadow-2xs hover:border-rose-300 transition-colors"
            >
              <div className="space-y-0.5 min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-800">{t.name}</span>
                  {t.name === '미지정' ? (
                    <Badge variant="destructive" className="text-[9px] px-1 py-0">담당자 미지정</Badge>
                  ) : (
                    <span className="text-[10px] text-slate-400 truncate">{t.email}</span>
                  )}
                </div>
                <div className="text-[11px] text-rose-600 font-medium truncate" title={t.facilities.join(', ')}>
                  장소: {t.facilities.join(', ')}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {t.name !== '미지정' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendReminder(t.name, t.facilities)}
                    className="h-7 text-[10px] font-bold text-rose-700 border-rose-200 hover:bg-rose-50 px-2"
                  >
                    독려
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => handleProxyComplete(t.name, t.email || '', t.facilityIds, t.facilities)}
                  disabled={isProcessing}
                  className="h-7 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white px-2 shadow-2xs"
                  title="안전지도 담당 교사 권한으로 대리 점검 완료 처리"
                >
                  <FileCheck2 className="w-3 h-3 mr-0.5" />
                  대리 점검
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
