'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { getGlobalSettings, updateGlobalSettings } from '@/lib/kisbus/settings';
import type { Destination, Student, BusQuarterSetting, BusFareConfig, StudentFareAdjustment, BusFareBill } from '@/lib/kisbus/types';
import type { AcademicCalendarConfig } from '@/lib/types';
import { calculateSchoolDays } from '@/lib/services/academicCalendarService';
import { getDefaultQuarters, calculateAllStudentsBusFare, downloadBusFareExcel, StudentBusFareDetail } from '@/lib/kisbus/fareCalculator';
import { issueBusFareBills, getBusFareBills } from '@/lib/kisbus/fareBills';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { 
    Trash2, PlusCircle, Download, X, Search, Check, Calendar, DollarSign, Users, FileSpreadsheet,
    GraduationCap, CheckCircle2, ChevronRight, Edit3, Send, AlertTriangle, RefreshCw, Sparkles, MessageSquare
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/kisbus/utils';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';

interface BusFareManagementTabProps {
  students?: Student[];
  destinations?: Destination[];
  academicCalendar?: AcademicCalendarConfig;
}

export function BusFareManagementTab({
  students = [],
  destinations = [],
  academicCalendar
}: BusFareManagementTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  // ── 요금제 및 분기 설정 상태 ──
  const [busFareSettings, setBusFareSettings] = useState<Record<string, number>>({});
  const [saturdayBusFareSettings, setSaturdayBusFareSettings] = useState<Record<string, number>>({});
  const [busFareCurrency, setBusFareCurrency] = useState<'VND' | 'KRW' | 'USD'>('VND');
  const [busFareTab, setBusFareTab] = useState<'weekday' | 'saturday'>('weekday');
  const [isFareSaving, setIsFareSaving] = useState(false);

  // 분기 기간 목록 & 현재 활성 분기 ID
  const [quarters, setQuarters] = useState<BusQuarterSetting[]>(() => getDefaultQuarters());
  const [activeQuarterId, setActiveQuarterId] = useState<string>('q1');

  // 신규 분기 추가 모달 상태
  const [isAddQuarterDialogOpen, setIsAddQuarterDialogOpen] = useState(false);
  const [newQuarterName, setNewQuarterName] = useState('');
  const [newQuarterStartDate, setNewQuarterStartDate] = useState('');
  const [newQuarterEndDate, setNewQuarterEndDate] = useState('');

  // 3명 이하 목적지 일일 추가요금 & 형제/자매 복수 탑승 할인율
  const [under3Surcharge, setUnder3Surcharge] = useState<number>(20000);
  const [siblingDiscountRate, setSiblingDiscountRate] = useState<number>(10);

  // 학년별 제외일수 입력 폼 상태
  const [selectedExceptionGrade, setSelectedExceptionGrade] = useState<string>('6');
  const [exceptionDaysInput, setExceptionDaysInput] = useState<number>(3);
  const [exceptionReasonInput, setExceptionReasonInput] = useState<string>('수학여행');

  // 청구서 모달 상태
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isIssuingBills, setIsIssuingBills] = useState(false);
  const [lastIssuedAt, setLastIssuedAt] = useState<string | null>(null);
  const [billingGradeFilter, setBillingGradeFilter] = useState<string>('all');
  const [billingRidingFilter, setBillingRidingFilter] = useState<'all' | 'riding'>('riding');
  const [billingSearchQuery, setBillingSearchQuery] = useState('');

  // ── 학생별 개별 금액 오류 수정/조정 모달 상태 ──
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [editingStudentDetail, setEditingStudentDetail] = useState<StudentBusFareDetail | null>(null);
  const [adjCustomFare, setAdjCustomFare] = useState<string>('');
  const [adjAmount, setAdjAmount] = useState<string>('');
  const [adjReason, setAdjReason] = useState<string>('');
  const [adjCustomDays, setAdjCustomDays] = useState<string>('');
  const [adjForceSibling, setAdjForceSibling] = useState<'auto' | 'yes' | 'no'>('auto');
  const [adjDiscountRate, setAdjDiscountRate] = useState<string>('');

  // 초기 글로벌 설정 및 발행 이력 로드
  useEffect(() => {
      getGlobalSettings().then(settings => {
          if (settings?.busFareSettings) setBusFareSettings(settings.busFareSettings);
          if (settings?.saturdayBusFareSettings) setSaturdayBusFareSettings(settings.saturdayBusFareSettings);
          if (settings?.busFareCurrency) setBusFareCurrency(settings.busFareCurrency);
          if (settings?.quarters && settings.quarters.length > 0) setQuarters(settings.quarters);
          if (settings?.activeQuarterId) setActiveQuarterId(settings.activeQuarterId);
          if (settings?.under3Surcharge !== undefined) setUnder3Surcharge(settings.under3Surcharge);
          if (settings?.siblingDiscountRate !== undefined) setSiblingDiscountRate(settings.siblingDiscountRate);
      }).catch(err => {
          console.error('Failed to load bus fare settings:', err);
      });
  }, []);

  // 현재 활성 분기 객체
  const currentQuarter = useMemo(() => {
      return quarters.find(q => q.id === activeQuarterId) || quarters[0] || getDefaultQuarters()[0];
  }, [quarters, activeQuarterId]);

  // 활성 분기의 기존 청구서 발송 이력 확인
  useEffect(() => {
      if (currentQuarter?.id) {
          getBusFareBills(currentQuarter.id).then(store => {
              if (store?.issuedAt) {
                  setLastIssuedAt(store.issuedAt);
              } else {
                  setLastIssuedAt(null);
              }
          }).catch(() => setLastIssuedAt(null));
      }
  }, [currentQuarter?.id]);

  // 현재 활성 분기의 학사일정 연동 평일 등교일수
  const currentQuarterDaysInfo = useMemo(() => {
      return calculateSchoolDays(currentQuarter.startDate, currentQuarter.endDate, academicCalendar);
  }, [currentQuarter.startDate, currentQuarter.endDate, academicCalendar]);

  // 전체 학생 분기별 요금 계산 결과
  const fareCalculationResult = useMemo(() => {
      return calculateAllStudentsBusFare({
          students,
          destinations,
          fareConfig: {
              busFareSettings,
              saturdayBusFareSettings,
              busFareCurrency,
              quarters,
              activeQuarterId,
              under3Surcharge,
              siblingDiscountRate
          },
          selectedQuarter: currentQuarter,
          academicCalendar
      });
  }, [students, destinations, busFareSettings, saturdayBusFareSettings, busFareCurrency, quarters, activeQuarterId, under3Surcharge, siblingDiscountRate, currentQuarter, academicCalendar]);

  const handleSaveFareSettings = async () => {
      setIsFareSaving(true);
      try {
          await updateGlobalSettings({ 
              busFareSettings, 
              saturdayBusFareSettings, 
              busFareCurrency,
              quarters,
              activeQuarterId,
              under3Surcharge,
              siblingDiscountRate
          });
          toast({
              title: "요금제 및 분기 설정 저장 완료",
              description: `[평일/토요일] 요금제, 분기 기간, 학년별 제외일수, 개별 조정 내역이 성공적으로 저장되었습니다.`
          });
      } catch (err) {
          toast({
              variant: "destructive",
              title: "저장 실패",
              description: "요금 설정을 저장하는 도중 오류가 발생했습니다."
          });
      } finally {
          setIsFareSaving(false);
      }
  };

  // 특정 학년 제외일수 추가
  const handleAddGradeException = () => {
      if (!selectedExceptionGrade || exceptionDaysInput <= 0) {
          toast({ variant: "destructive", title: "입력 오류", description: "학년과 1일 이상의 제외 일수를 입력해주세요." });
          return;
      }

      setQuarters(prev => prev.map(q => {
          if (q.id !== currentQuarter.id) return q;
          const currentExceptions = { ...(q.gradeExceptions || {}) };
          const currentReasons = { ...(q.gradeExceptionReasons || {}) };
          currentExceptions[selectedExceptionGrade] = exceptionDaysInput;
          if (exceptionReasonInput.trim()) {
              currentReasons[selectedExceptionGrade] = exceptionReasonInput.trim();
          } else {
              delete currentReasons[selectedExceptionGrade];
          }
          return {
              ...q,
              gradeExceptions: currentExceptions,
              gradeExceptionReasons: currentReasons
          };
      }));

      toast({
          title: "학년별 제외일수 반영",
          description: `${selectedExceptionGrade}학년 등교일수 -${exceptionDaysInput}일 (${exceptionReasonInput || '특정 활동'}) 제외가 적용되었습니다.`
      });
  };

  // 특정 학년 제외일수 삭제
  const handleRemoveGradeException = (grade: string) => {
      setQuarters(prev => prev.map(q => {
          if (q.id !== currentQuarter.id) return q;
          const currentExceptions = { ...(q.gradeExceptions || {}) };
          const currentReasons = { ...(q.gradeExceptionReasons || {}) };
          delete currentExceptions[grade];
          delete currentReasons[grade];
          return {
              ...q,
              gradeExceptions: currentExceptions,
              gradeExceptionReasons: currentReasons
          };
      }));
      toast({
          title: "제외일수 삭제",
          description: `${grade}학년 제외일수 설정이 해제되었습니다.`
      });
  };

  // ── 학생별 개별 수정 다이얼로그 열기 ──
  const handleOpenAdjustmentModal = (detail: StudentBusFareDetail) => {
      setEditingStudentDetail(detail);
      const existingAdj = currentQuarter.studentAdjustments?.[detail.studentId];
      if (existingAdj) {
          setAdjCustomFare(existingAdj.customFare !== undefined && existingAdj.customFare !== null ? String(existingAdj.customFare) : '');
          setAdjAmount(existingAdj.adjustmentAmount !== undefined && existingAdj.adjustmentAmount !== 0 ? String(existingAdj.adjustmentAmount) : '');
          setAdjReason(existingAdj.adjustmentReason || '');
          setAdjCustomDays(existingAdj.customDays !== undefined && existingAdj.customDays !== null ? String(existingAdj.customDays) : '');
          if (existingAdj.forceSiblingDiscount === true) setAdjForceSibling('yes');
          else if (existingAdj.forceSiblingDiscount === false) setAdjForceSibling('no');
          else setAdjForceSibling('auto');
          setAdjDiscountRate(existingAdj.customDiscountRate !== undefined && existingAdj.customDiscountRate !== null ? String(existingAdj.customDiscountRate) : '');
      } else {
          setAdjCustomFare('');
          setAdjAmount('');
          setAdjReason('');
          setAdjCustomDays('');
          setAdjForceSibling('auto');
          setAdjDiscountRate('');
      }
      setIsAdjustmentModalOpen(true);
  };

  // ── 학생별 개별 수정 저장 ──
  const handleSaveStudentAdjustment = async () => {
      if (!editingStudentDetail) return;
      const sId = editingStudentDetail.studentId;

      const hasCustomFare = adjCustomFare.trim() !== '';
      const hasAdjAmount = adjAmount.trim() !== '' && parseInt(adjAmount, 10) !== 0;
      const hasCustomDays = adjCustomDays.trim() !== '';
      const hasForceSibling = adjForceSibling !== 'auto';
      const hasCustomDiscountRate = adjDiscountRate.trim() !== '';

      const isAnyAdjustment = hasCustomFare || hasAdjAmount || hasCustomDays || hasForceSibling || hasCustomDiscountRate || adjReason.trim() !== '';

      const newAdjustment: StudentFareAdjustment = {
          customFare: hasCustomFare ? Math.max(0, parseInt(adjCustomFare, 10) || 0) : null,
          adjustmentAmount: hasAdjAmount ? parseInt(adjAmount, 10) || 0 : 0,
          adjustmentReason: adjReason.trim() || undefined,
          customDays: hasCustomDays ? Math.max(0, parseInt(adjCustomDays, 10) || 0) : null,
          forceSiblingDiscount: adjForceSibling === 'yes' ? true : adjForceSibling === 'no' ? false : null,
          customDiscountRate: hasCustomDiscountRate ? Math.max(0, Math.min(100, parseInt(adjDiscountRate, 10) || 0)) : null
      };

      const updatedQuarters = quarters.map(q => {
          if (q.id !== currentQuarter.id) return q;
          const currentAdjustments = { ...(q.studentAdjustments || {}) };
          if (isAnyAdjustment) {
              currentAdjustments[sId] = newAdjustment;
          } else {
              delete currentAdjustments[sId];
          }
          return {
              ...q,
              studentAdjustments: currentAdjustments
          };
      });

      setQuarters(updatedQuarters);
      setIsAdjustmentModalOpen(false);

      // 글로벌 설정 자동 동기화
      try {
          await updateGlobalSettings({ quarters: updatedQuarters });
          toast({
              title: "학생 금액 수정 반영 완료",
              description: `[${editingStudentDetail.studentName}] 학생의 요금 산출 조정 내용이 저장되었습니다.`
          });
      } catch (err) {
          toast({ variant: "destructive", title: "저장 실패", description: "설정 동기화 중 오류가 발생했습니다." });
      }
  };

  // ── 학생별 개별 수정 초기화 ──
  const handleResetStudentAdjustment = async () => {
      if (!editingStudentDetail) return;
      const sId = editingStudentDetail.studentId;

      const updatedQuarters = quarters.map(q => {
          if (q.id !== currentQuarter.id) return q;
          const currentAdjustments = { ...(q.studentAdjustments || {}) };
          delete currentAdjustments[sId];
          return {
              ...q,
              studentAdjustments: currentAdjustments
          };
      });

      setQuarters(updatedQuarters);
      setIsAdjustmentModalOpen(false);

      try {
          await updateGlobalSettings({ quarters: updatedQuarters });
          toast({
              title: "수정 초기화 완료",
              description: `[${editingStudentDetail.studentName}] 학생의 요금이 기본 계산식으로 복원되었습니다.`
          });
      } catch (err) {
          toast({ variant: "destructive", title: "초기화 실패", description: "설정 동기화 중 오류가 발생했습니다." });
      }
  };

  // ── 학부모 서비스로 청구서 일괄 발송 ──
  const handleIssueBillsToParents = async () => {
      const ridingStudents = fareCalculationResult.studentDetails.filter(d => d.isRiding);
      if (ridingStudents.length === 0) {
          toast({ variant: "destructive", title: "발송 불가", description: "탑승 학생이 없어 발송할 청구서가 없습니다." });
          return;
      }

      setIsIssuingBills(true);
      try {
          const bills: BusFareBill[] = ridingStudents.map(d => ({
              id: `${currentQuarter.id}_${d.studentId}`,
              quarterId: currentQuarter.id,
              quarterName: currentQuarter.name,
              quarterPeriod: `${currentQuarter.startDate} ~ ${currentQuarter.endDate}`,
              studentId: d.studentId,
              studentName: d.studentName,
              grade: d.grade,
              studentClass: d.studentClass,
              contact: d.contact,
              destinationName: d.destinationName,
              zone: d.zone,
              isRiding: d.isRiding,
              baseQuarterDays: d.baseQuarterDays,
              excludedDays: d.excludedDays,
              gradeExceptionReason: d.gradeExceptionReason,
              finalQuarterDays: d.quarterDays,
              baseDailyFare: d.baseDailyFare,
              destinationRiderCount: d.destinationRiderCount,
              isSmallGroup: d.isSmallGroup,
              smallGroupSurcharge: d.smallGroupSurcharge,
              totalDailyFare: d.totalDailyFare,
              subtotalFare: d.rawQuarterFare,
              isSiblingDiscounted: d.isSiblingDiscounted,
              discountRate: d.discountRate,
              discountAmount: d.discountAmount,
              isAdjusted: d.isAdjusted,
              adjustmentAmount: d.adjustmentAmount,
              adjustmentReason: d.adjustmentReason,
              finalQuarterFare: d.finalQuarterFare,
              currency: busFareCurrency,
              issuedAt: new Date().toISOString(),
              isConfirmed: false
          }));

          await issueBusFareBills(currentQuarter.id, currentQuarter.name, bills);
          const nowStr = new Date().toISOString();
          setLastIssuedAt(nowStr);

          toast({
              title: "📩 학부모 서비스 청구서 발송 완료",
              description: `≪ ${currentQuarter.name} ≫ 총 ${ridingStudents.length}명의 학생 청구서가 발송되었습니다. 학부모 로그인 시 팝업으로 상세 산출 내역이 전달됩니다.`
          });
      } catch (err) {
          console.error("Failed to issue bus fare bills:", err);
          toast({
              variant: "destructive",
              title: "청구서 발송 실패",
              description: "청구서를 발송하는 도중 오류가 발생했습니다."
          });
      } finally {
          setIsIssuingBills(false);
      }
  };

  return (
    <div className="space-y-6">
        <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-slate-50 border-b border-indigo-100/80 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-lg font-extrabold text-indigo-950 flex items-center gap-2">
                            <span className="text-xl">💲</span> 스쿨버스 요금제 및 분기별 정산 설정
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-600 mt-1">
                            분기별 학사일정(등교일수), 3명 이하 소수 목적지 일일 추가금, 형제 복수탑승 할인(둘째 이하 10%) 및 Zone별 거리 요금을 통합 관리합니다.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsBillingModalOpen(true)}
                            className="text-xs font-bold h-9 bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                            <span>📋 {currentQuarter.name} 요금 청구서 확인 ({students.length}명)</span>
                        </Button>
                    </div>
                </div>

                {/* 탭 전환: 평일 요금제 vs 토요일 요금제 */}
                <div className="flex gap-2 pt-3">
                    <button
                        type="button"
                        onClick={() => setBusFareTab('weekday')}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border",
                            busFareTab === 'weekday'
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        <span>📅 평일 요금제 (월~금 정규/등하교)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setBusFareTab('saturday')}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border",
                            busFareTab === 'saturday'
                                ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        <span>🚌 토요일 요금제 (토요 방과후 전용)</span>
                    </button>
                </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
                {/* 화폐 단위 및 기본 안내 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-3">
                        <Label className="text-xs font-bold text-slate-700 whitespace-nowrap">기본 화폐 단위 설정</Label>
                        <select
                            value={busFareCurrency}
                            onChange={(e) => setBusFareCurrency(e.target.value as any)}
                            className="h-8 text-xs border border-slate-300 rounded-md px-2.5 font-bold text-slate-800 bg-white"
                        >
                            <option value="VND">VND (베트남 동)</option>
                            <option value="KRW">KRW (대한민국 원)</option>
                            <option value="USD">USD (미국 달러)</option>
                        </select>
                    </div>
                    <div className="text-xs text-slate-600 font-medium">
                        {busFareTab === 'weekday' ? (
                            <span className="text-indigo-800 font-bold">ℹ️ 평일 요금은 일일요금(거리별+소수탑승가산) × 분기 등교일수(휴업일 및 학년제외 차감) - 형제할인(10%)으로 산출됩니다.</span>
                        ) : (
                            <span className="text-amber-800 font-bold">ℹ️ 토요 방과후학교 신청자에게 적용될 토요일 전용 거리별 요금을 설정합니다.</span>
                        )}
                    </div>
                </div>

                {/* ─────────────────────────────────────────────────────────── */}
                {/* [평일 요금제 전용 옵션 1] 분기(Quarter) 기간 및 학사일정 등교일수 설정 */}
                {/* ─────────────────────────────────────────────────────────── */}
                {busFareTab === 'weekday' && (
                    <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 p-4 rounded-xl border border-indigo-100/80 space-y-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-600" />
                                <Label className="text-xs font-bold text-slate-800">
                                    📅 분기(Quarter) 기간 설정 & 학사일정 평일 등교일수 연동
                                </Label>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIsAddQuarterDialogOpen(true)}
                                    className="h-7 text-[11px] font-bold text-indigo-700 bg-white border-indigo-200 hover:bg-indigo-50"
                                >
                                    <PlusCircle className="w-3 h-3 mr-1" /> 새 분기 추가
                                </Button>
                            </div>
                        </div>

                        {/* 분기 선택 탭 */}
                        <div className="flex flex-wrap gap-1.5 items-center">
                            {quarters.map((q) => (
                                <button
                                    key={q.id}
                                    type="button"
                                    onClick={() => setActiveQuarterId(q.id)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border",
                                        activeQuarterId === q.id
                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                    )}
                                >
                                    <span>{q.name}</span>
                                    {activeQuarterId === q.id && <Check className="w-3 h-3 ml-0.5" />}
                                </button>
                            ))}
                        </div>

                        {/* 활성 분기 기간 편집 폼 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3.5 rounded-lg border border-slate-200">
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-slate-600">분기 명칭</Label>
                                <Input
                                    value={currentQuarter.name}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setQuarters(prev => prev.map(q => q.id === currentQuarter.id ? { ...q, name: val } : q));
                                    }}
                                    className="h-8 text-xs font-bold"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-slate-600">분기 시작일</Label>
                                <Input
                                    type="date"
                                    value={currentQuarter.startDate}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setQuarters(prev => prev.map(q => q.id === currentQuarter.id ? { ...q, startDate: val } : q));
                                    }}
                                    className="h-8 text-xs font-bold"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-slate-600">분기 종료일</Label>
                                <Input
                                    type="date"
                                    value={currentQuarter.endDate}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setQuarters(prev => prev.map(q => q.id === currentQuarter.id ? { ...q, endDate: val } : q));
                                    }}
                                    className="h-8 text-xs font-bold"
                                />
                            </div>
                        </div>

                        {/* 학사일정 자동 연동 계산 결과 표시 */}
                        <div className="bg-indigo-50/70 border border-indigo-200/80 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div className="space-y-1">
                                <div className="font-bold text-indigo-950 flex items-center gap-1.5 flex-wrap">
                                    <span>🗓️ 기본 평일 등교일수:</span>
                                    <Badge className="bg-indigo-600 text-white font-bold text-xs px-2 py-0.5">
                                        {currentQuarter.manualDays ? `${currentQuarter.manualDays}일 (수동 지정)` : `${currentQuarterDaysInfo.schoolDays}일 (학사일정 연동)`}
                                    </Badge>
                                    <span className="text-slate-500 text-[11px] font-normal">
                                        ({currentQuarter.startDate} ~ {currentQuarter.endDate})
                                    </span>
                                </div>
                                <div className="text-[11px] text-slate-600">
                                    • 전체 기간 {currentQuarterDaysInfo.totalDays}일 중 평일(월~금) {currentQuarterDaysInfo.weekdays}일, 
                                    학사일정 상 공휴일/휴업일 <span className="font-bold text-rose-600">{currentQuarterDaysInfo.holidays.length}일 제외</span>됨
                                </div>
                                {currentQuarterDaysInfo.holidays.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        {currentQuarterDaysInfo.holidays.map((h, i) => (
                                            <span key={i} className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded font-medium">
                                                {h.date.slice(5)} {h.reason || '휴업일'}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {quarters.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            if (confirm(`"${currentQuarter.name}" 분기를 삭제하시겠습니까?`)) {
                                                const remaining = quarters.filter(q => q.id !== currentQuarter.id);
                                                setQuarters(remaining);
                                                setActiveQuarterId(remaining[0].id);
                                            }
                                        }}
                                        className="h-7 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 mr-1" /> 분기 삭제
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* 🎓 학년별 등교일수 제외(차감) 설정 (수학여행, 현장체험학습 등) */}
                        <div className="bg-white p-3.5 rounded-lg border border-indigo-200/90 shadow-2xs space-y-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                                    <Label className="text-xs font-bold text-slate-800">
                                        🎓 학년별 등교일수 제외(차감) 설정
                                    </Label>
                                </div>
                                <span className="text-[11px] text-slate-500">
                                    💡 특정 학년의 수학여행, 수련활동 등 사전 계획된 미이용 일수를 차감합니다.
                                </span>
                            </div>

                            {/* 입력 폼 */}
                            <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 rounded-md border">
                                <div className="flex items-center gap-1">
                                    <Label className="text-[11px] font-bold text-slate-600 shrink-0">대상 학년:</Label>
                                    <select
                                        value={selectedExceptionGrade}
                                        onChange={(e) => setSelectedExceptionGrade(e.target.value)}
                                        className="h-8 text-xs font-bold border rounded-md px-2 bg-white text-slate-800"
                                    >
                                        <option value="K">유치원(K)</option>
                                        <option value="1">1학년</option>
                                        <option value="2">2학년</option>
                                        <option value="3">3학년</option>
                                        <option value="4">4학년</option>
                                        <option value="5">5학년</option>
                                        <option value="6">6학년</option>
                                        <option value="7">7학년</option>
                                        <option value="8">8학년</option>
                                        <option value="9">9학년</option>
                                        <option value="10">10학년</option>
                                        <option value="11">11학년</option>
                                        <option value="12">12학년</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-1">
                                    <Label className="text-[11px] font-bold text-slate-600 shrink-0">제외일수:</Label>
                                    <div className="relative w-20">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={60}
                                            value={exceptionDaysInput}
                                            onChange={(e) => setExceptionDaysInput(parseInt(e.target.value, 10) || 0)}
                                            className="h-8 text-xs font-bold pr-5 text-right bg-white"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-bold">일</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                                    <Label className="text-[11px] font-bold text-slate-600 shrink-0">사유:</Label>
                                    <Input
                                        type="text"
                                        placeholder="예: 6학년 수학여행"
                                        value={exceptionReasonInput}
                                        onChange={(e) => setExceptionReasonInput(e.target.value)}
                                        className="h-8 text-xs font-medium bg-white"
                                    />
                                </div>

                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleAddGradeException}
                                    className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 cursor-pointer"
                                >
                                    <PlusCircle className="w-3.5 h-3.5 mr-1" /> 제외 적용
                                </Button>
                            </div>

                            {/* 등록된 학년별 제외 내역 목록 */}
                            <div className="space-y-1.5">
                                {Object.keys(currentQuarter.gradeExceptions || {}).length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(currentQuarter.gradeExceptions || {}).map(([grd, days]) => {
                                            const reason = currentQuarter.gradeExceptionReasons?.[grd];
                                            const baseDays = currentQuarter.manualDays || currentQuarterDaysInfo.schoolDays;
                                            const actualDays = Math.max(0, baseDays - days);
                                            return (
                                                <div
                                                    key={grd}
                                                    className="flex items-center gap-1.5 bg-indigo-50/90 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs font-medium shadow-2xs"
                                                >
                                                    <span className="font-bold text-indigo-800">{grd}학년</span>
                                                    <Badge variant="destructive" className="text-[10px] py-0 h-4 px-1.5 font-extrabold">
                                                        -{days}일 제외
                                                    </Badge>
                                                    {reason && <span className="text-[11px] text-slate-600">({reason})</span>}
                                                    <span className="text-emerald-700 font-bold bg-white px-1.5 py-0.2 rounded border border-emerald-200 text-[11px]">
                                                        ➜ 최종 {actualDays}일 적용
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveGradeException(grd)}
                                                        className="text-slate-400 hover:text-rose-600 ml-1 p-0.5 rounded-full hover:bg-rose-50 transition cursor-pointer"
                                                        title="제외 설정 해제"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-slate-400 italic">
                                        현재 설정된 학년별 제외 일수가 없습니다. (모든 학년에게 기본 {currentQuarterDaysInfo.schoolDays}일이 동일하게 적용됩니다)
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─────────────────────────────────────────────────────────── */}
                {/* [평일 요금제 전용 옵션 2] 3명 이하 추가금 및 형제/자매 할인율 설정 */}
                {/* ─────────────────────────────────────────────────────────── */}
                {busFareTab === 'weekday' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1) 3명 이하 목적지 일일 추가요금 */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-rose-500" />
                                    3명 이하 목적지 탑승 시 일일 추가요금
                                </Label>
                                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                                    소수 탑승지 가산
                                </Badge>
                            </div>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={under3Surcharge}
                                    onChange={(e) => setUnder3Surcharge(parseInt(e.target.value, 10) || 0)}
                                    className="pr-12 text-right font-bold text-slate-800 text-xs bg-white"
                                    placeholder="0"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                    {busFareCurrency === 'KRW' ? '원' : busFareCurrency === 'USD' ? '$' : 'VND'}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                💡 동일 목적지 탑승 인원이 <b>1~3명</b>인 경우 일일 기본요금에 위 금액이 합산되어 분기 등교일수만큼 청구됩니다.
                            </p>
                        </div>

                        {/* 2) 형제/자매 복수 탑승 시 둘째 이하 할인율 */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-indigo-500" />
                                    형제/자매 복수 탑승 시 둘째 이하 할인율
                                </Label>
                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                                    형제 할인
                                </Badge>
                            </div>
                            <div className="relative">
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={siblingDiscountRate}
                                    onChange={(e) => setSiblingDiscountRate(parseInt(e.target.value, 10) || 0)}
                                    className="pr-12 text-right font-bold text-slate-800 text-xs bg-white"
                                    placeholder="10"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                    %
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                💡 형제가 <b>2명 이상 복수 탑승</b>할 때, 최고 학년(첫째)은 100% 정상 납부하고 둘째 이하 동생들에게 위 할인율이 적용됩니다.
                            </p>
                        </div>
                    </div>
                )}

                {/* ─────────────────────────────────────────────────────────── */}
                {/* 목적지 그룹(Zone)별 거리 요금표 */}
                {/* ─────────────────────────────────────────────────────────── */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <DollarSign className="w-4 h-4 text-emerald-600" />
                            {busFareTab === 'weekday' ? '📅 평일 목적지 그룹(Zone)별 일일 요금표' : '🚌 토요일 목적지 그룹(Zone)별 1회 탑승 요금표'}
                        </Label>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                const newGroupName = prompt('추가할 목적지 그룹(Zone) 이름을 입력하세요 (예: Zone D (특수거리)):');
                                if (newGroupName && newGroupName.trim()) {
                                    const trimmed = newGroupName.trim();
                                    if (busFareTab === 'weekday') {
                                        setBusFareSettings(prev => ({ ...prev, [trimmed]: 0 }));
                                    } else {
                                        setSaturdayBusFareSettings(prev => ({ ...prev, [trimmed]: 0 }));
                                    }
                                }
                            }}
                            className="h-7 text-xs font-bold text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                        >
                            <PlusCircle className="w-3.5 h-3.5 mr-1" /> 새 목적지 그룹(Zone) 추가
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(busFareTab === 'weekday' ? busFareSettings : saturdayBusFareSettings).map(([groupName, price]) => (
                            <div key={groupName} className="p-3 rounded-lg border bg-white shadow-2xs space-y-1.5 flex flex-col justify-between">
                                <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-bold text-slate-800 truncate" title={groupName}>{groupName}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirm(`"${groupName}" 그룹을 요금표에서 삭제하시겠습니까?`)) {
                                                if (busFareTab === 'weekday') {
                                                    setBusFareSettings(prev => {
                                                        const copy = { ...prev };
                                                        delete copy[groupName];
                                                        return copy;
                                                    });
                                                } else {
                                                    setSaturdayBusFareSettings(prev => {
                                                        const copy = { ...prev };
                                                        delete copy[groupName];
                                                        return copy;
                                                    });
                                                }
                                            }
                                        }}
                                        className="text-slate-400 hover:text-rose-500 p-0.5"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={price}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value, 10) || 0;
                                            if (busFareTab === 'weekday') {
                                                setBusFareSettings(prev => ({ ...prev, [groupName]: val }));
                                            } else {
                                                setSaturdayBusFareSettings(prev => ({ ...prev, [groupName]: val }));
                                            }
                                        }}
                                        className="pr-12 text-right font-bold text-slate-800 text-xs"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                        {busFareCurrency === 'KRW' ? '원' : busFareCurrency === 'USD' ? '$' : 'VND'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>

            <CardFooter className="bg-slate-50/80 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-500 font-medium">
                    설정을 수정한 후 반드시 <b>[요금 및 분기 설정 저장]</b> 버튼을 눌러야 반영됩니다.
                </div>
                <Button
                    type="button"
                    onClick={handleSaveFareSettings}
                    disabled={isFareSaving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 h-9 shrink-0 shadow-sm cursor-pointer"
                >
                    {isFareSaving ? '저장 중...' : '💾 요금 및 분기 설정 저장'}
                </Button>
            </CardFooter>
        </Card>

        {/* 새 분기 추가 모달 */}
        <Dialog open={isAddQuarterDialogOpen} onOpenChange={setIsAddQuarterDialogOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base font-bold">새 분기 추가</DialogTitle>
                    <DialogDescription className="text-xs">
                        새로운 분기의 명칭과 기간을 입력하세요.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <div className="space-y-1">
                        <Label className="text-xs font-bold">분기 명칭</Label>
                        <Input
                            placeholder="예: 2026학년도 1분기"
                            value={newQuarterName}
                            onChange={(e) => setNewQuarterName(e.target.value)}
                            className="h-8 text-xs font-bold"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">시작일</Label>
                            <Input
                                type="date"
                                value={newQuarterStartDate}
                                onChange={(e) => setNewQuarterStartDate(e.target.value)}
                                className="h-8 text-xs font-bold"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">종료일</Label>
                            <Input
                                type="date"
                                value={newQuarterEndDate}
                                onChange={(e) => setNewQuarterEndDate(e.target.value)}
                                className="h-8 text-xs font-bold"
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddQuarterDialogOpen(false)}>취소</Button>
                    <Button
                        onClick={() => {
                            if (!newQuarterName || !newQuarterStartDate || !newQuarterEndDate) {
                                toast({ variant: "destructive", title: "입력 오류", description: "모든 항목을 입력해주세요." });
                                return;
                            }
                            const newQ: BusQuarterSetting = {
                                id: `q_${Date.now()}`,
                                name: newQuarterName.trim(),
                                startDate: newQuarterStartDate,
                                endDate: newQuarterEndDate,
                                manualDays: null
                            };
                            setQuarters(prev => [...prev, newQ]);
                            setActiveQuarterId(newQ.id);
                            setNewQuarterName('');
                            setNewQuarterStartDate('');
                            setNewQuarterEndDate('');
                            setIsAddQuarterDialogOpen(false);
                            toast({ title: "분기 추가 완료", description: `"${newQ.name}" 분기가 추가되었습니다.` });
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                    >
                        추가하기
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* 📋 분기별 학생 스쿨버스 요금 청구서 / 정산표 모달 */}
        {/* ─────────────────────────────────────────────────────────── */}
        <Dialog open={isBillingModalOpen} onOpenChange={setIsBillingModalOpen}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-5 pb-3 border-b bg-slate-50/80 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
                        <div>
                            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                                ≪ {currentQuarter.name} ≫ 평일 정규 등하교 버스 요금 청구 내역서
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>평일 등교일수 {fareCalculationResult.summary.quarterDays}일 기준 • 소수탑승(3명이하) 가산 및 형제할인(10%) 적용</span>
                                {lastIssuedAt && (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] py-0">
                                        최근 발송: {new Date(lastIssuedAt).toLocaleDateString()} {new Date(lastIssuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Badge>
                                )}
                            </DialogDescription>
                        </div>
                        
                        {/* 액션 버튼 그룹 */}
                        <div className="flex items-center gap-2 shrink-0">
                            {/* 1. 학부모 서비스로 청구서 일괄 발송 버튼 */}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={isIssuingBills || fareCalculationResult.summary.ridingStudents === 0}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 shadow-xs cursor-pointer flex items-center gap-1.5"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        <span>{isIssuingBills ? "발송 중..." : "📩 학부모 서비스로 청구서 발송"}</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-base font-bold flex items-center gap-2">
                                            <Send className="w-5 h-5 text-indigo-600" />
                                            평일 스쿨버스 요금 청구서 학부모 발송
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="text-xs text-slate-600 space-y-2 pt-1">
                                            <p>
                                                <b>≪ {currentQuarter.name} ≫</b> <b>평일(월~금) 정규 등하교 버스 신청 학생 (총 {fareCalculationResult.summary.ridingStudents}명)</b>에게만 청구서가 발송됩니다.
                                            </p>
                                            <div className="bg-slate-50 p-3 rounded-lg border text-[11px] text-slate-700 space-y-1">
                                                <div>• <b>전달 대상:</b> 평일 목적지가 배정된 탑승 신청 학생 계정으로만 개별 전달됩니다. (미탑승 학생 미발송)</div>
                                                <div>• <b>방학/토요 버스 제외:</b> 방학 및 토요 방과후학교 버스요금은 방과후 수강료와 함께 별도 청구됩니다.</div>
                                                <div>• <b>전달 방식:</b> 해당 학부모가 서비스 로그인 시 팝업(모달)으로 산출 내역이 즉시 전달됩니다.</div>
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>취소</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleIssueBillsToParents}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                                        >
                                            확인 및 발송하기
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {/* 2. 엑셀 다운로드 버튼 */}
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isExportingExcel}
                                onClick={async () => {
                                    setIsExportingExcel(true);
                                    try {
                                        await downloadBusFareExcel(fareCalculationResult.studentDetails, currentQuarter, busFareCurrency);
                                        toast({ title: "엑셀 다운로드 완료", description: "스쿨버스 요금 청구서 파일이 다운로드되었습니다." });
                                    } catch (err) {
                                        toast({ variant: "destructive", title: "다운로드 실패", description: "엑셀 다운로드 중 오류가 발생했습니다." });
                                    } finally {
                                        setIsExportingExcel(false);
                                    }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 shrink-0 cursor-pointer"
                            >
                                <Download className="w-3.5 h-3.5 mr-1" />
                                {isExportingExcel ? "생성 중..." : "엑셀 다운로드 (XLSX)"}
                            </Button>
                        </div>
                    </div>

                    {/* 상단 요약 통계 배너 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
                        <div className="bg-white p-2 rounded-lg border text-center">
                            <div className="text-[10px] text-slate-500 font-medium">탑승 학생</div>
                            <div className="text-sm font-extrabold text-indigo-700">
                                {fareCalculationResult.summary.ridingStudents}명 
                                <span className="text-[10px] text-slate-400 font-normal ml-1">/ 전체 {fareCalculationResult.summary.totalStudents}명</span>
                            </div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border text-center">
                            <div className="text-[10px] text-slate-500 font-medium">분기 평일 등교일수</div>
                            <div className="text-sm font-extrabold text-slate-800">{fareCalculationResult.summary.quarterDays}일</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border text-center">
                            <div className="text-[10px] text-slate-500 font-medium">소수(3명이하) / 형제할인</div>
                            <div className="text-sm font-extrabold text-slate-800">
                                <span className="text-rose-600">{fareCalculationResult.summary.smallGroupStudents}명</span> / <span className="text-amber-600">{fareCalculationResult.summary.discountedStudents}명</span>
                            </div>
                        </div>
                        <div className="bg-indigo-600 text-white p-2 rounded-lg text-center shadow-xs">
                            <div className="text-[10px] text-indigo-100 font-medium">분기 총 청구 예정액</div>
                            <div className="text-sm font-extrabold truncate">
                                {fareCalculationResult.summary.totalAmount.toLocaleString()} {busFareCurrency}
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                {/* 필터 및 검색 바 */}
                <div className="p-3 border-b bg-slate-50/50 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Input
                            placeholder="학생 이름 / 연락처 / 목적지 검색..."
                            value={billingSearchQuery}
                            onChange={(e) => setBillingSearchQuery(e.target.value)}
                            className="h-8 text-xs font-medium w-52 bg-white"
                        />
                        <select
                            value={billingGradeFilter}
                            onChange={(e) => setBillingGradeFilter(e.target.value)}
                            className="h-8 text-xs font-bold border rounded-md px-2 bg-white text-slate-700"
                        >
                            <option value="all">전체 학년</option>
                            <option value="K">유치원(K)</option>
                            <option value="1">1학년</option>
                            <option value="2">2학년</option>
                            <option value="3">3학년</option>
                            <option value="4">4학년</option>
                            <option value="5">5학년</option>
                            <option value="6">6학년</option>
                            <option value="7">7학년</option>
                            <option value="8">8학년</option>
                            <option value="9">9학년</option>
                            <option value="10">10학년</option>
                            <option value="11">11학년</option>
                            <option value="12">12학년</option>
                        </select>
                        <select
                            value={billingRidingFilter}
                            onChange={(e) => setBillingRidingFilter(e.target.value as any)}
                            className="h-8 text-xs font-bold border rounded-md px-2 bg-white text-slate-700"
                        >
                            <option value="riding">탑승 학생만 보기</option>
                            <option value="all">전체 학생 보기</option>
                        </select>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
                        💡 금액에 오류가 있거나 전출/특수 감면이 필요한 경우 우측 <b>[수정 ✏️]</b> 버튼으로 학생별 금액을 직접 조정할 수 있습니다.
                    </div>
                </div>

                {/* 학생 요금 목록 테이블 */}
                <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b z-10">
                            <tr>
                                <th className="p-2 text-center w-10">#</th>
                                <th className="p-2">학생명</th>
                                <th className="p-2">학년/반</th>
                                <th className="p-2">목적지 / Zone</th>
                                <th className="p-2 text-center">목적지 탑승인원</th>
                                <th className="p-2 text-right">일일 기본요금</th>
                                <th className="p-2 text-right">소수추가금</th>
                                <th className="p-2 text-right font-bold text-slate-900">일일합계</th>
                                <th className="p-2 text-center">등교일수</th>
                                <th className="p-2 text-center">형제 할인</th>
                                <th className="p-2 text-right font-extrabold text-indigo-700">최종 청구 요금</th>
                                <th className="p-2 text-center w-16">금액 수정</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {(() => {
                                const filtered = fareCalculationResult.studentDetails.filter((d) => {
                                    if (billingRidingFilter === 'riding' && !d.isRiding) return false;
                                    if (billingGradeFilter !== 'all' && d.grade !== billingGradeFilter) return false;
                                    if (billingSearchQuery.trim()) {
                                        const q = billingSearchQuery.trim().toLowerCase();
                                        const matchName = d.studentName.toLowerCase().includes(q);
                                        const matchContact = d.contact.toLowerCase().includes(q);
                                        const matchDest = d.destinationName.toLowerCase().includes(q);
                                        if (!matchName && !matchContact && !matchDest) return false;
                                    }
                                    return true;
                                });

                                if (filtered.length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan={12} className="text-center py-10 text-slate-400">
                                                조건에 해당하는 학생 요금 내역이 없습니다.
                                            </td>
                                        </tr>
                                    );
                                }

                                return filtered.map((d, idx) => (
                                    <tr key={d.studentId} className={cn("hover:bg-slate-50/80 transition", !d.isRiding && "opacity-50 bg-slate-50", d.isAdjusted && "bg-amber-50/30")}>
                                        <td className="p-2 text-center text-slate-400 text-[11px]">{idx + 1}</td>
                                        <td className="p-2 font-bold text-slate-900">
                                            <div className="flex items-center gap-1.5">
                                                <span>{d.studentName}</span>
                                                {d.isAdjusted && (
                                                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[9px] px-1 py-0" title={d.adjustmentReason || '수동 조정됨'}>
                                                        수정됨
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-2 text-slate-600">{d.grade ? `${d.grade}학년 ${d.studentClass}반` : '-'}</td>
                                        <td className="p-2">
                                            <div className="font-semibold text-slate-800">{d.destinationName}</div>
                                            <div className="text-[10px] text-slate-400">{d.zone}</div>
                                        </td>
                                        <td className="p-2 text-center">
                                            {d.isRiding ? (
                                                <span className={cn(
                                                    "px-1.5 py-0.5 rounded text-[10px] font-bold border",
                                                    d.isSmallGroup ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-100 text-slate-600"
                                                )}>
                                                    {d.destinationRiderCount}명 {d.isSmallGroup ? '(소수)' : ''}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="p-2 text-right text-slate-700">{d.baseDailyFare.toLocaleString()}</td>
                                        <td className="p-2 text-right text-rose-600 font-semibold">
                                            {d.smallGroupSurcharge > 0 ? `+${d.smallGroupSurcharge.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="p-2 text-right font-bold text-slate-900 bg-slate-50/50">
                                            {d.totalDailyFare.toLocaleString()}
                                        </td>
                                        <td className="p-2 text-center">
                                            <div className="font-bold text-slate-800">{d.quarterDays}일</div>
                                            {d.excludedDays > 0 && (
                                                <div className="text-[10px] text-rose-600 font-semibold leading-tight">
                                                    (-{d.excludedDays}일 {d.gradeExceptionReason || '수학여행'})
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2 text-center">
                                            {d.isSiblingDiscounted ? (
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]">
                                                    {d.discountRate}% 할인 (-{d.discountAmount.toLocaleString()})
                                                </Badge>
                                            ) : d.siblingRiderCount >= 2 ? (
                                                <span className="text-[10px] text-slate-400 font-medium">첫째 (0%)</span>
                                            ) : (
                                                <span className="text-[10px] text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="p-2 text-right font-extrabold text-indigo-700 text-xs">
                                            <div>{d.finalQuarterFare.toLocaleString()} {busFareCurrency}</div>
                                            {d.isAdjusted && d.adjustmentAmount !== 0 && (
                                                <div className="text-[10px] text-amber-700 font-normal">
                                                    ({d.adjustmentAmount > 0 ? `+${d.adjustmentAmount.toLocaleString()}` : d.adjustmentAmount.toLocaleString()})
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2 text-center">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleOpenAdjustmentModal(d)}
                                                className="h-7 px-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 cursor-pointer"
                                                title="금액 오류 수정 및 예외 조정"
                                            >
                                                <Edit3 className="w-3 h-3 mr-1" /> 수정
                                            </Button>
                                        </td>
                                    </tr>
                                ));
                            })()}
                        </tbody>
                    </table>
                </div>
                <DialogFooter className="p-3 border-t bg-slate-50 shrink-0 flex items-center justify-between">
                    <div className="text-xs text-slate-500 font-medium">
                        총 {fareCalculationResult.summary.ridingStudents}명 탑승 • 합계: <b className="text-indigo-700">{fareCalculationResult.summary.totalAmount.toLocaleString()} {busFareCurrency}</b>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsBillingModalOpen(false)} className="text-xs">닫기</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* ✏️ 개별 학생 금액 오류 수정 및 예외 조정 모달 */}
        {/* ─────────────────────────────────────────────────────────── */}
        <Dialog open={isAdjustmentModalOpen} onOpenChange={setIsAdjustmentModalOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-indigo-600" />
                        스쿨버스 요금 개별 수정 및 예외 조정
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        {editingStudentDetail?.studentName} ({editingStudentDetail?.grade}학년 {editingStudentDetail?.studentClass}반) 학생의 요금 산출 내역을 직접 조정합니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2 text-xs">
                    {/* 현재 기본 산출 요약 */}
                    <div className="bg-slate-50 p-3 rounded-lg border space-y-1 text-slate-700">
                        <div className="flex justify-between">
                            <span>목적지 및 Zone:</span>
                            <span className="font-bold">{editingStudentDetail?.destinationName} ({editingStudentDetail?.zone})</span>
                        </div>
                        <div className="flex justify-between">
                            <span>일일 요금 (기본+소수):</span>
                            <span className="font-bold">{editingStudentDetail?.totalDailyFare.toLocaleString()} {busFareCurrency}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>기본 적용 등교일수:</span>
                            <span className="font-bold">{editingStudentDetail?.quarterDays}일</span>
                        </div>
                        <div className="flex justify-between text-indigo-700 border-t pt-1 font-extrabold">
                            <span>현재 청구 요금:</span>
                            <span>{editingStudentDetail?.finalQuarterFare.toLocaleString()} {busFareCurrency}</span>
                        </div>
                    </div>

                    {/* 1. 가감 금액 (할인 또는 추가금) */}
                    <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-700">
                            가감 금액 (+추가금 / -할인액)
                        </Label>
                        <div className="relative">
                            <Input
                                type="number"
                                placeholder="예: -50000 (할인) 또는 20000 (추가)"
                                value={adjAmount}
                                onChange={(e) => setAdjAmount(e.target.value)}
                                className="h-8 text-xs font-bold pr-12 text-right"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                {busFareCurrency}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                            기존 계산된 금액에 위 금액이 더해지거나 감액됩니다.
                        </p>
                    </div>

                    {/* 2. 최종 금액 직접 지정 (오버라이드) */}
                    <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-700">
                            최종 청구 금액 직접 지정 (선택사항)
                        </Label>
                        <div className="relative">
                            <Input
                                type="number"
                                placeholder="비워둘 경우 자동 계산식 + 가감 금액 적용"
                                value={adjCustomFare}
                                onChange={(e) => setAdjCustomFare(e.target.value)}
                                className="h-8 text-xs font-bold pr-12 text-right bg-amber-50/40 border-amber-200"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                {busFareCurrency}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                            여기에 금액을 입력하면 다른 계산식을 무시하고 이 금액으로 최종 청구됩니다.
                        </p>
                    </div>

                    {/* 3. 학생 개별 등교일수 수동 지정 */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-700">등교일수 개별 지정</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    placeholder={`기본: ${currentQuarterDaysInfo.schoolDays}일`}
                                    value={adjCustomDays}
                                    onChange={(e) => setAdjCustomDays(e.target.value)}
                                    className="h-8 text-xs font-bold pr-7 text-right"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">일</span>
                            </div>
                        </div>

                        {/* 4. 형제 할인 수동 제어 */}
                        <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-700">형제 할인 강제 적용</Label>
                            <select
                                value={adjForceSibling}
                                onChange={(e) => setAdjForceSibling(e.target.value as any)}
                                className="w-full h-8 text-xs font-bold border rounded-md px-2 bg-white text-slate-800"
                            >
                                <option value="auto">자동 감지 (기본값)</option>
                                <option value="yes">형제 할인 강제 적용 (10%)</option>
                                <option value="no">형제 할인 미적용 (첫째/단독)</option>
                            </select>
                        </div>
                    </div>

                    {/* 5. 조정 사유 입력 */}
                    <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-700">
                            금액 수정 사유 (학부모 청구서에 표시)
                        </Label>
                        <Input
                            placeholder="예: 5월 10일 전학으로 일할 감액, 장기 질병 결석 감면 등"
                            value={adjReason}
                            onChange={(e) => setAdjReason(e.target.value)}
                            className="h-8 text-xs font-medium"
                        />
                    </div>
                </div>

                <DialogFooter className="flex items-center justify-between pt-2 border-t">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResetStudentAdjustment}
                        className="text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                        <RefreshCw className="w-3 h-3 mr-1" /> 기본값으로 복원
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsAdjustmentModalOpen(false)}>취소</Button>
                        <Button
                            size="sm"
                            onClick={handleSaveStudentAdjustment}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                        >
                            조정 사항 저장
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
