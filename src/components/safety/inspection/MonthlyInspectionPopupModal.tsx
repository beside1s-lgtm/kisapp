'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  PhoneCall,
  Check,
  FileCheck2,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import type { SchoolFacility, MonthlyInspectionRecord, InspectionScore } from '@/lib/safety/types';
import { SAFETY_INSPECTION_ITEMS } from '@/lib/safety/types';
import { saveMonthlyInspection } from '@/lib/services/safetyService';
import { getTeacherStampSignature } from '@/lib/safety/stampHelper';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface MonthlyInspectionPopupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingFacilities: SchoolFacility[];
  yearMonth?: string; // 기본값: 현재 월 'YYYY-MM'
  onSubmitted?: () => void;
}

export function MonthlyInspectionPopupModal({
  open,
  onOpenChange,
  pendingFacilities,
  yearMonth,
  onSubmitted,
}: MonthlyInspectionPopupModalProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const currentYM = yearMonth || format(new Date(), 'yyyy-MM');
  const monthDisplay = parseInt(currentYM.split('-')[1], 10);

  // 현재 선택된 점검 시설
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');

  useEffect(() => {
    if (pendingFacilities.length > 0 && (!selectedFacilityId || !pendingFacilities.some(f => f.id === selectedFacilityId))) {
      setSelectedFacilityId(pendingFacilities[0].id);
    }
  }, [pendingFacilities, selectedFacilityId]);

  const activeFacility = useMemo(() => {
    return pendingFacilities.find(f => f.id === selectedFacilityId) || pendingFacilities[0];
  }, [pendingFacilities, selectedFacilityId]);

  // 점검 항목 결과 상태 { [itemId]: 'O' | '△' | '×' }
  const [scores, setScores] = useState<Record<string, InspectionScore>>({});
  const [notes, setNotes] = useState('');
  const [needsFacilityTeamFix, setNeedsFacilityTeamFix] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 시설 바뀔 때 초기화
  useEffect(() => {
    if (activeFacility) {
      // 기본적으로 모든 항목을 'O'로 세팅하여 교사의 빠른 확인 지원
      const initial: Record<string, InspectionScore> = {};
      SAFETY_INSPECTION_ITEMS.forEach(item => {
        initial[item.id] = 'O';
      });
      setScores(initial);
      setNotes('');
      setNeedsFacilityTeamFix(false);
    }
  }, [activeFacility?.id]);

  // 점검자 성명 및 날인 이미지
  const inspectorName = profile?.name || user?.displayName || activeFacility?.assignedTeacherName || '담당 교사';
  const stampSignatureUrl = useMemo(() => {
    return getTeacherStampSignature(inspectorName, profile?.signature);
  }, [inspectorName, profile?.signature]);

  // 개별 점검 항목 스코어 변경
  const handleScoreChange = (itemId: string, score: InspectionScore) => {
    setScores(prev => ({ ...prev, [itemId]: score }));
  };

  // 전체 'O' 일괄 체크
  const handleAllGood = () => {
    const updated: Record<string, InspectionScore> = {};
    SAFETY_INSPECTION_ITEMS.forEach(item => {
      updated[item.id] = 'O';
    });
    setScores(updated);
    toast({ title: '전체 양호(O) 설정', description: '모든 점검 항목이 양호(O)로 설정되었습니다.' });
  };

  // 점검 완료 제출
  const handleSubmit = async () => {
    if (!activeFacility) return;

    // 미체크 항목 검사
    const unselected = SAFETY_INSPECTION_ITEMS.filter(item => !scores[item.id]);
    if (unselected.length > 0) {
      toast({
        variant: 'destructive',
        title: '점검 미완료 항목 존재',
        description: `${unselected[0].name} 등 ${unselected.length}개 항목을 체크해주세요.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      await saveMonthlyInspection({
        yearMonth: currentYM,
        facilityId: activeFacility.id,
        facilityName: activeFacility.name,
        grade: activeFacility.grade,
        classNum: activeFacility.classNum,
        category: activeFacility.category,
        assignedTeacherName: activeFacility.assignedTeacherName || inspectorName,
        assignedTeacherEmail: activeFacility.assignedTeacherEmail || user?.email || '',
        inspectorName,
        inspectorEmail: user?.email || '',
        inspectionDate: today,
        isCompleted: true,
        scores,
        notes,
        needsFacilityTeamFix,
        signature: stampSignatureUrl,
      });

      toast({
        title: '안전점검표 제출 완료',
        description: `${activeFacility.fullName || activeFacility.name}의 ${monthDisplay}월 안전점검이 완료되었습니다.`,
      });

      // 남은 미점검 시설이 있는지 확인
      const remaining = pendingFacilities.filter(f => f.id !== activeFacility.id);
      if (remaining.length > 0) {
        setSelectedFacilityId(remaining[0].id);
        toast({
          title: '다음 점검 장소 안내',
          description: `남은 미점검 장소(${remaining[0].fullName || remaining[0].name})의 점검표로 이동합니다.`,
        });
      } else {
        onOpenChange(false);
        onSubmitted?.();
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '제출 실패', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeFacility) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="max-w-2xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden bg-white rounded-2xl shadow-2xl border-amber-300 [&>button.absolute]:hidden">
        <DialogHeader className="space-y-1.5 shrink-0 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>{currentYM.split('-')[0]} 학교생활 안전점검표 ({monthDisplay}월)</span>
                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold">
                  매월 4일 정기 점검
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                안전지도 관리 규정에 따라 시설 담당 교사는 매월 점검을 완료해야 합니다.
              </DialogDescription>
            </div>
          </div>

          {/* 여러 시설 담당 시 탭 선택기 */}
          {pendingFacilities.length > 1 && (
            <div className="pt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-bold text-slate-500 shrink-0">담당 장소:</span>
              {pendingFacilities.map(fac => (
                <button
                  key={fac.id}
                  onClick={() => setSelectedFacilityId(fac.id)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    fac.id === activeFacility.id
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {fac.fullName || fac.name}
                </button>
              ))}
            </div>
          )}

          {/* 서식 필수 안내 박스 */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 text-xs text-amber-900 space-y-0.5">
            <p className="font-semibold flex items-center gap-1 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              * 매월 4일(해당일 휴일인 경우 그 전후)에 점검을 실시합니다.
            </p>
            <p className="font-semibold flex items-center gap-1 text-[11px] text-rose-800">
              <PhoneCall className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              * 각 항목 점검 후 이상이 있을 시, 시설관리팀(내선 520)에 연락합니다.
            </p>
          </div>
        </DialogHeader>

        {/* 점검표 테이블 본문 */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 py-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-xs font-bold text-slate-700">점검 장소:</span>
                <span className="text-xs font-black text-slate-900">
                  {activeFacility.fullName || activeFacility.name} ({activeFacility.location})
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAllGood}
                className="h-7 text-xs font-bold text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 px-2.5 shadow-2xs shrink-0"
              >
                <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                전체 양호(O) 일괄 선택
              </Button>
            </div>
            <div className="flex items-center gap-1.5 text-xs shrink-0">
              <span className="text-slate-500">담당자:</span>
              <span className="font-bold text-slate-900">{inspectorName}</span>
            </div>
          </div>

          {/* 1. 실내 점검 항목 (8개) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-100/90 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800">실내 점검 항목</span>
              <span className="text-[10px] text-slate-500">1~8번 항목</span>
            </div>
            <div className="divide-y divide-slate-100">
              {SAFETY_INSPECTION_ITEMS.filter(i => i.section === '실내').map(item => (
                <div key={item.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/60">
                  <span className="text-xs font-semibold text-slate-700">
                    {item.index}. {item.name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {(['O', '△', '×'] as InspectionScore[]).map(score => {
                      const isSelected = scores[item.id] === score;
                      const colorMap = {
                        O: isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700',
                        '△': isSelected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700',
                        '×': isSelected ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700',
                      };
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => handleScoreChange(item.id, score)}
                          className={`w-8 h-7 rounded-md text-xs font-black transition-all ${colorMap[score as 'O' | '△' | '×']}`}
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. 복도 및 계단 점검 항목 (6개) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-100/90 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800">복도 및 계단 점검 항목</span>
              <span className="text-[10px] text-slate-500">1~6번 항목</span>
            </div>
            <div className="divide-y divide-slate-100">
              {SAFETY_INSPECTION_ITEMS.filter(i => i.section === '복도 및 계단').map(item => (
                <div key={item.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/60">
                  <span className="text-xs font-semibold text-slate-700">
                    {item.index}. {item.name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {(['O', '△', '×'] as InspectionScore[]).map(score => {
                      const isSelected = scores[item.id] === score;
                      const colorMap = {
                        O: isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700',
                        '△': isSelected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700',
                        '×': isSelected ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700',
                      };
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => handleScoreChange(item.id, score)}
                          className={`w-8 h-7 rounded-md text-xs font-black transition-all ${colorMap[score as 'O' | '△' | '×']}`}
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. 이상 조치 및 비고 */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fix-needed"
                checked={needsFacilityTeamFix}
                onCheckedChange={checked => setNeedsFacilityTeamFix(Boolean(checked))}
              />
              <Label htmlFor="fix-needed" className="font-bold text-rose-700 cursor-pointer flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                이상이 있어 시설관리팀(내선 520)에 연락 및 보수가 필요합니다.
              </Label>
            </div>
            <div>
              <Label className="text-[11px] font-bold text-slate-700">특이사항 및 비고 (이상 발견 시 상세 기재)</Label>
              <Textarea
                placeholder="예: 2번 창틀 잠금장치 헐거움, 복도 소화기 압력 정상 확인 등"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="mt-1 h-14 text-xs bg-white"
              />
            </div>
          </div>

          {/* 범례 표시 */}
          <div className="flex items-center justify-end gap-3 text-[11px] font-bold text-slate-500 pr-1">
            <span className="text-emerald-700">좋음 : O</span>
            <span className="text-amber-700">보통 : △</span>
            <span className="text-rose-700">나쁨 : ×</span>
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-700 font-bold">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>점검자: {inspectorName}</span>
            <div className="relative inline-flex items-center justify-center w-12 h-7 bg-white border border-slate-200 rounded px-1 shadow-2xs">
              <span className="text-[10px] text-slate-300 font-bold select-none">(인)</span>
              {stampSignatureUrl && (
                <img
                  src={stampSignatureUrl}
                  alt=""
                  onError={(e) => {
                    const fallbackStamp = getTeacherStampSignature(inspectorName || '교사');
                    if (e.currentTarget.src !== fallbackStamp) {
                      e.currentTarget.src = fallbackStamp;
                    }
                  }}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-multiply"
                />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold"
            >
              다음에 점검
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
            >
              <FileCheck2 className="w-3.5 h-3.5 mr-1" />
              {isSubmitting ? '제출 중...' : '점검 완료 제출'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
