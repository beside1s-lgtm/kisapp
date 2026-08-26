'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { 
  Course, 
  Enrollment, 
  Student, 
  AfterschoolFareBill, 
  StudentAfterschoolAdjustment 
} from '@/lib/afterschool/types';
import { 
  calculateAllStudentsAfterschoolFare, 
  issueAfterschoolBills, 
  getAfterschoolBills, 
  downloadAfterschoolFareExcel 
} from '@/lib/afterschool/fareBills';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Receipt, Send, Download, Edit3, Search, RefreshCw, CheckCircle2, Bus, BookOpen, Sparkles, DollarSign, Users, Info
} from 'lucide-react';
import { cn } from '@/lib/kisbus/utils';

interface AfterschoolBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  enrollments: Enrollment[];
  courses: Course[];
  studentsList?: Student[];
  destinations?: any[];
  saturdayBusFareSettings?: Record<string, number>;
  busFareSettings?: Record<string, number>;
  busFareCurrency?: string;
  teacherApplySettings?: any;
}

export function AfterschoolBillingModal({
  isOpen,
  onClose,
  enrollments,
  courses,
  studentsList = [],
  destinations = [],
  saturdayBusFareSettings,
  busFareSettings,
  busFareCurrency = 'VND',
  teacherApplySettings,
}: AfterschoolBillingModalProps) {
  const { toast } = useToast();

  const semesterId = useMemo(() => {
    return (teacherApplySettings as any)?.semesterId || 'sem_current';
  }, [teacherApplySettings]);

  const semesterName = useMemo(() => {
    return (teacherApplySettings as any)?.semester || '2026학년도 1학기 방과후학교';
  }, [teacherApplySettings]);

  // 학생별 개별 수정/조정 상태
  const [adjustments, setAdjustments] = useState<Record<string, StudentAfterschoolAdjustment>>({});
  const [lastIssuedAt, setLastIssuedAt] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // 필터 및 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [busFilter, setBusFilter] = useState<'all' | 'riding' | 'none'>('all');

  // 개별 학생 수정 다이얼로그 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<AfterschoolFareBill | null>(null);
  const [editCustomTotal, setEditCustomTotal] = useState('');
  const [editAdjAmount, setEditAdjAmount] = useState('');
  const [editAdjReason, setEditAdjReason] = useState('');
  const [editCustomBusFee, setEditCustomBusFee] = useState('');

  // 기존 발행 이력 로드
  useEffect(() => {
    if (semesterId) {
      getAfterschoolBills(semesterId).then((store) => {
        if (store?.issuedAt) {
          setLastIssuedAt(store.issuedAt);
        } else {
          setLastIssuedAt(null);
        }
      }).catch(() => setLastIssuedAt(null));
    }
  }, [semesterId]);

  // 전체 학생 수강료 및 버스비 계산
  const fareResult = useMemo(() => {
    return calculateAllStudentsAfterschoolFare({
      enrollments,
      courses,
      studentsList,
      destinations,
      saturdayBusFareSettings,
      busFareSettings,
      busFareCurrency,
      teacherApplySettings,
      adjustments,
      semesterId,
      semesterName,
    });
  }, [
    enrollments,
    courses,
    studentsList,
    destinations,
    saturdayBusFareSettings,
    busFareSettings,
    busFareCurrency,
    teacherApplySettings,
    adjustments,
    semesterId,
    semesterName,
  ]);

  // 학생별 개별 수정 모달 열기
  const handleOpenEditModal = (bill: AfterschoolFareBill) => {
    setEditingBill(bill);
    const existing = adjustments[bill.id.replace(`${semesterId}_`, '')];
    if (existing) {
      setEditCustomTotal(existing.customTotalFare !== undefined && existing.customTotalFare !== null ? String(existing.customTotalFare) : '');
      setEditAdjAmount(existing.adjustmentAmount !== undefined && existing.adjustmentAmount !== 0 ? String(existing.adjustmentAmount) : '');
      setEditAdjReason(existing.adjustmentReason || '');
      setEditCustomBusFee(existing.customBusFee !== undefined && existing.customBusFee !== null ? String(existing.customBusFee) : '');
    } else {
      setEditCustomTotal('');
      setEditAdjAmount('');
      setEditAdjReason('');
      setEditCustomBusFee('');
    }
    setIsEditModalOpen(true);
  };

  // 학생별 개별 수정 저장
  const handleSaveEdit = () => {
    if (!editingBill) return;
    const key = editingBill.id.replace(`${semesterId}_`, '');

    const hasCustomTotal = editCustomTotal.trim() !== '';
    const hasAdjAmount = editAdjAmount.trim() !== '' && parseInt(editAdjAmount, 10) !== 0;
    const hasCustomBus = editCustomBusFee.trim() !== '';
    const hasReason = editAdjReason.trim() !== '';

    if (hasCustomTotal || hasAdjAmount || hasCustomBus || hasReason) {
      setAdjustments((prev) => ({
        ...prev,
        [key]: {
          customTotalFare: hasCustomTotal ? Math.max(0, parseInt(editCustomTotal, 10) || 0) : null,
          adjustmentAmount: hasAdjAmount ? parseInt(editAdjAmount, 10) || 0 : 0,
          adjustmentReason: editAdjReason.trim() || undefined,
          customBusFee: hasCustomBus ? Math.max(0, parseInt(editCustomBusFee, 10) || 0) : null,
        },
      }));
    } else {
      setAdjustments((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }

    setIsEditModalOpen(false);
    toast({
      title: '수강료 조정 완료',
      description: `[${editingBill.studentName}] 학생의 수강료 조정 내역이 반영되었습니다.`,
    });
  };

  // 학생별 개별 수정 초기화
  const handleResetEdit = () => {
    if (!editingBill) return;
    const key = editingBill.id.replace(`${semesterId}_`, '');
    setAdjustments((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setIsEditModalOpen(false);
    toast({
      title: '기본값 복원',
      description: `[${editingBill.studentName}] 학생의 수강료가 기본 산출식으로 복원되었습니다.`,
    });
  };

  // 학부모 서비스로 청구서 일괄 발송
  const handleIssueBills = async () => {
    if (fareResult.bills.length === 0) {
      toast({ variant: 'destructive', title: '발송 불가', description: '발송할 수강생 청구서가 없습니다.' });
      return;
    }

    setIsIssuing(true);
    try {
      await issueAfterschoolBills(semesterId, semesterName, fareResult.bills);
      const nowStr = new Date().toISOString();
      setLastIssuedAt(nowStr);

      toast({
        title: '📩 방과후 수강료 청구서 발송 완료',
        description: `≪ ${semesterName} ≫ 총 ${fareResult.bills.length}명의 학생에게 수강료 및 버스비 청구서가 발송되었습니다. 학부모 로그인 시 팝업으로 전달됩니다.`,
      });
    } catch (err) {
      console.error('Failed to issue afterschool bills:', err);
      toast({
        variant: 'destructive',
        title: '청구서 발송 실패',
        description: '청구서를 발송하는 도중 오류가 발생했습니다.',
      });
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* 상단 헤더 */}
          <DialogHeader className="p-5 pb-3 border-b bg-gradient-to-r from-purple-50/80 via-slate-50 to-indigo-50/50 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-purple-600" />
                  ≪ {semesterName} ≫ 방과후 수강 확정 및 수강료 고지 내역서
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>수강 확정생 {fareResult.summary.totalStudents}명 ({fareResult.summary.totalEnrollments}건 강좌) • 무료강좌 자동구분 및 스쿨버스 요금 합산</span>
                  {lastIssuedAt && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] py-0">
                      최근 발송: {new Date(lastIssuedAt).toLocaleDateString()} {new Date(lastIssuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Badge>
                  )}
                </DialogDescription>
              </div>

              {/* 상단 액션 버튼 그룹 */}
              <div className="flex items-center gap-2 shrink-0">
                {/* 1. 학부모 서비스로 수강 확정 알림 일괄 발송 */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isIssuing || fareResult.bills.length === 0}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-8 shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isIssuing ? '발송 중...' : '📩 학부모 알림 발송'}</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-base font-bold flex items-center gap-2">
                        <Send className="w-5 h-5 text-purple-600" />
                        방과후학교 수강 확정 및 수강료 알림 발송
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-xs text-slate-600 space-y-2 pt-1">
                        <p>
                          <b>≪ {semesterName} ≫</b> 총 <b>{fareResult.bills.length}명</b>의 수강생 학부모 포털로 <b>수강 확정 안내 및 수강료 고지</b>를 전달합니다.
                        </p>
                        <div className="bg-slate-50 p-3 rounded-lg border text-[11px] text-slate-700 space-y-1">
                          <div>• <b>전달 방식:</b> 학부모가 로그인 시 팝업 형태로 수업 안내(강좌명, 장소, 시간, 강사명)가 전달됩니다.</div>
                          <div>• <b>스쿨버스:</b> 버스를 신청한 학생에게만 버스 호차 및 정류장이 안내되며, 미신청 학생에게는 버스 항목이 표시되지 않습니다.</div>
                          <div>• <b>수강료:</b> 0원인 부가비용(교재/재료비)은 미표시되며, 무료강좌는 '무료강좌'로 표시됩니다.</div>
                          <div>• <b>납부 방식:</b> 스쿨뱅킹 자동 출금 또는 가상계좌 납부 안내가 포함됩니다.</div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleIssueBills}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                      >
                        확인 및 발송하기
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>


                {/* 2. 엑셀 다운로드 */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isExportingExcel || fareResult.bills.length === 0}
                  onClick={async () => {
                    setIsExportingExcel(true);
                    try {
                      await downloadAfterschoolFareExcel(fareResult.bills, semesterName, busFareCurrency);
                      toast({ title: '엑셀 다운로드 완료', description: '방과후 수강료 청구서 파일이 다운로드되었습니다.' });
                    } catch (err) {
                      toast({ variant: 'destructive', title: '다운로드 실패', description: '엑셀 다운로드 중 오류가 발생했습니다.' });
                    } finally {
                      setIsExportingExcel(false);
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  {isExportingExcel ? '생성 중...' : '엑셀 다운로드 (XLSX)'}
                </Button>
              </div>
            </div>

            {/* 상단 통계 배너 */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3">
              <div className="bg-white p-2 rounded-lg border text-center">
                <div className="text-[10px] text-slate-500 font-medium">수강 확정 인원</div>
                <div className="text-sm font-extrabold text-purple-700">{fareResult.summary.totalStudents}명</div>
              </div>
              <div className="bg-white p-2 rounded-lg border text-center">
                <div className="text-[10px] text-slate-500 font-medium">총 순수 수강료</div>
                <div className="text-sm font-extrabold text-slate-800">{fareResult.summary.totalTuition.toLocaleString()}</div>
              </div>
              <div className="bg-white p-2 rounded-lg border text-center">
                <div className="text-[10px] text-slate-500 font-medium">교재/재료비 합계</div>
                <div className="text-sm font-extrabold text-slate-800">{(fareResult.summary.totalTextbook + fareResult.summary.totalMaterial).toLocaleString()}</div>
              </div>
              <div className="bg-white p-2 rounded-lg border text-center">
                <div className="text-[10px] text-slate-500 font-medium">스쿨버스 요금 (탑승 {fareResult.summary.busRidingStudents}명)</div>
                <div className="text-sm font-extrabold text-emerald-700">{fareResult.summary.totalBusFare.toLocaleString()}</div>
              </div>
              <div className="bg-purple-600 text-white p-2 rounded-lg text-center shadow-xs">
                <div className="text-[10px] text-purple-100 font-medium">총 청구 예정액</div>
                <div className="text-sm font-extrabold truncate">
                  {fareResult.summary.grandTotal.toLocaleString()} {busFareCurrency}
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* 검색 및 필터 툴바 */}
          <div className="p-3 border-b bg-slate-50/50 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="학생 이름 / 연락처 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs font-medium w-52 bg-white"
              />
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="h-8 text-xs font-bold border rounded-md px-2 bg-white text-slate-700"
              >
                <option value="all">전체 학년</option>
                <option value="1">1학년</option>
                <option value="2">2학년</option>
                <option value="3">3학년</option>
                <option value="4">4학년</option>
                <option value="5">5학년</option>
                <option value="6">6학년</option>
              </select>
              <select
                value={busFilter}
                onChange={(e) => setBusFilter(e.target.value as any)}
                className="h-8 text-xs font-bold border rounded-md px-2 bg-white text-slate-700"
              >
                <option value="all">전체 학생 보기</option>
                <option value="riding">버스 탑승 학생만</option>
                <option value="none">버스 미탑승 학생만</option>
              </select>
            </div>
            <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
              💡 감면 대상자 또는 수강료 오류는 우측 <b>[수정 ✏️]</b> 버튼으로 학생별 금액을 직접 조정할 수 있습니다.
            </div>
          </div>

          {/* 청구서 테이블 */}
          <div className="flex-1 overflow-auto p-0">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b z-10">
                <tr>
                  <th className="p-2 text-center w-10">#</th>
                  <th className="p-2">학생명</th>
                  <th className="p-2">학년/반</th>
                  <th className="p-2">신청 강좌 목록</th>
                  <th className="p-2 text-right">순수 수강료</th>
                  <th className="p-2 text-right">교재/재료비</th>
                  <th className="p-2">방과후 스쿨버스 (호차/목적지)</th>
                  <th className="p-2 text-right">버스 요금</th>
                  <th className="p-2 text-right font-extrabold text-purple-700">최종 청구액</th>
                  <th className="p-2 text-center w-16">금액 수정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {(() => {
                  const filtered = fareResult.bills.filter((b) => {
                    if (gradeFilter !== 'all' && String(b.grade) !== gradeFilter) return false;
                    if (busFilter === 'riding' && !b.isBusRiding) return false;
                    if (busFilter === 'none' && b.isBusRiding) return false;
                    if (searchQuery.trim()) {
                      const q = searchQuery.trim().toLowerCase();
                      const matchName = b.studentName.toLowerCase().includes(q);
                      const matchPhone = (b.contact || '').includes(q) || (b.parentPhone || '').includes(q);
                      if (!matchName && !matchPhone) return false;
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={10} className="text-center py-10 text-slate-400">
                          조건에 일치하는 방과후 수강생 청구 내역이 없습니다.
                        </td>
                      </tr>
                    );
                  }

                  return filtered.map((b, idx) => (
                    <tr key={b.id} className={cn("hover:bg-slate-50/80 transition", b.isAdjusted && "bg-amber-50/30")}>
                      <td className="p-2 text-center text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="p-2 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{b.studentName}</span>
                          {b.isAdjusted && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[9px] px-1 py-0" title={b.adjustmentReason || '수동 조정됨'}>
                              조정됨
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-slate-600">{b.grade}학년 {b.classNum}반</td>
                      <td className="p-2">
                        <div className="space-y-0.5 max-w-xs">
                          {b.courses.map((c, i) => (
                            <div key={i} className="flex items-center gap-1 text-[11px] text-slate-700">
                              <span className="font-semibold truncate">• {c.courseTitle}</span>
                              {c.classDays && (
                                <span className="text-[9px] text-purple-600 bg-purple-50 px-1 rounded border border-purple-200 shrink-0">
                                  {c.classDays.join(',')}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-2 text-right text-slate-800 font-medium">
                        {b.tuitionSubtotal.toLocaleString()}
                      </td>
                      <td className="p-2 text-right text-slate-600">
                        {(b.textbookSubtotal + b.materialSubtotal).toLocaleString()}
                      </td>
                      <td className="p-2">
                        {b.isBusRiding ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-emerald-700 flex items-center gap-1">
                              <Bus className="w-3 h-3" />
                              <span>{b.busNo}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">{b.destinationName} ({b.zone})</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">미신청 (0원)</span>
                        )}
                      </td>
                      <td className="p-2 text-right font-bold text-emerald-700">
                        {b.isBusRiding ? b.busFare.toLocaleString() : '-'}
                      </td>
                      <td className="p-2 text-right font-extrabold text-purple-700 text-xs">
                        <div>{b.finalTotalFare.toLocaleString()} {busFareCurrency}</div>
                        {b.isAdjusted && b.adjustmentAmount !== 0 && (
                          <div className="text-[10px] text-amber-700 font-normal">
                            ({b.adjustmentAmount && b.adjustmentAmount > 0 ? `+${b.adjustmentAmount.toLocaleString()}` : b.adjustmentAmount?.toLocaleString()})
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEditModal(b)}
                          className="h-7 px-2 text-xs font-bold text-purple-700 hover:bg-purple-50 border border-purple-200 cursor-pointer"
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

          {/* 하단 푸터 */}
          <DialogFooter className="p-3 border-t bg-slate-50 shrink-0 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">
              총 {fareResult.summary.totalStudents}명 • 합계: <b className="text-purple-700">{fareResult.summary.grandTotal.toLocaleString()} {busFareCurrency}</b>
            </div>
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✏️ 개별 학생 수강료 및 버스비 수정 다이얼로그 */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-purple-600" />
              방과후 수강료 & 버스비 개별 조정
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {editingBill?.studentName} ({editingBill?.grade}학년 {editingBill?.classNum}반) 학생의 청구 금액을 직접 조정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* 기본 계산 요약 */}
            <div className="bg-slate-50 p-3 rounded-lg border space-y-1 text-slate-700">
              <div className="flex justify-between">
                <span>신청 강좌 합계 ({editingBill?.courses.length}개):</span>
                <span className="font-bold">{editingBill?.coursesTotalFee.toLocaleString()} {busFareCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span>스쿨버스 이용료 ({editingBill?.isBusRiding ? editingBill.busNo : '미탑승'}):</span>
                <span className="font-bold">{editingBill?.busFare.toLocaleString()} {busFareCurrency}</span>
              </div>
              <div className="flex justify-between text-purple-700 border-t pt-1 font-extrabold">
                <span>현재 합계 청구액:</span>
                <span>{editingBill?.finalTotalFare.toLocaleString()} {busFareCurrency}</span>
              </div>
            </div>

            {/* 1. 가감 금액 */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">가감 금액 (+추가 / -감면)</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="예: -500000 (감면) 또는 50000 (추가)"
                  value={editAdjAmount}
                  onChange={(e) => setEditAdjAmount(e.target.value)}
                  className="h-8 text-xs font-bold pr-12 text-right"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {busFareCurrency}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">기존 계산 금액에 위 금액이 가산되거나 감면됩니다.</p>
            </div>

            {/* 2. 최종 청구 금액 직접 오버라이드 */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">최종 청구 금액 직접 지정 (선택사항)</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="비워둘 경우 자동 계산식 + 가감 금액 적용"
                  value={editCustomTotal}
                  onChange={(e) => setEditCustomTotal(e.target.value)}
                  className="h-8 text-xs font-bold pr-12 text-right bg-amber-50/40 border-amber-200"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {busFareCurrency}
                </span>
              </div>
            </div>

            {/* 3. 버스 요금 수동 오버라이드 */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">방과후 버스 요금 개별 지정 (선택사항)</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder={`기본: ${editingBill?.busFare.toLocaleString()} ${busFareCurrency}`}
                  value={editCustomBusFee}
                  onChange={(e) => setEditCustomBusFee(e.target.value)}
                  className="h-8 text-xs font-bold pr-12 text-right"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {busFareCurrency}
                </span>
              </div>
            </div>

            {/* 4. 사유 입력 */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">금액 조정 및 감면 사유</Label>
              <Input
                placeholder="예: 기초생활수급자 전액 감면, 교직원 자녀 할인 등"
                value={editAdjReason}
                onChange={(e) => setEditAdjReason(e.target.value)}
                className="h-8 text-xs font-medium"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetEdit}
              className="text-xs text-rose-600 hover:bg-rose-50 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 mr-1" /> 기본값 복원
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>취소</Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer"
              >
                조정 사항 저장
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
