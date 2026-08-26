'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { 
  onLatestActiveAfterschoolBillsUpdate, 
  getAfterschoolBills, 
  findStudentAfterschoolBill, 
  confirmStudentAfterschoolBill 
} from '@/lib/afterschool/fareBills';
import type { AfterschoolFareBill } from '@/lib/afterschool/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, Bus, CheckCircle2, Sparkles, Info, MapPin, Calendar, Clock, User, Check
} from 'lucide-react';
import { cn } from '@/lib/kisbus/utils';

export function ParentAfterschoolFareModal() {
  const { user, profile } = useAuth();
  const [bill, setBill] = useState<AfterschoolFareBill | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null);

  // 최신 활성 수강확정 알림 포인터 감지
  useEffect(() => {
    const unsub = onLatestActiveAfterschoolBillsUpdate((data) => {
      if (data?.activeSemesterId) {
        setActiveSemesterId(data.activeSemesterId);
      }
    });
    return () => unsub();
  }, []);

  // 활성 기수 데이터 로드 및 자녀 매칭
  useEffect(() => {
    if (!activeSemesterId) return;

    const studentName = profile?.studentName || '';
    const grade = profile?.studentGrade || '';
    const classNum = profile?.studentClass || '';
    const contact = profile?.phoneNumber || user?.phoneNumber || '';

    if (!studentName && !contact) return;

    getAfterschoolBills(activeSemesterId).then((store) => {
      if (!store || !store.bills || store.bills.length === 0) return;

      const matchedBill = findStudentAfterschoolBill(store.bills, {
        studentName,
        grade,
        classNum,
        contact,
      });

      if (matchedBill) {
        setBill(matchedBill);

        // 로컬스토리지 확인 여부 검사
        const storageKey = `afterschool_confirm_${matchedBill.id}_${matchedBill.issuedAt}`;
        const isLocallyConfirmed = typeof window !== 'undefined' && localStorage.getItem(storageKey) === 'true';

        if (!isLocallyConfirmed && !matchedBill.isConfirmed) {
          setIsOpen(true);
        }
      }
    }).catch((err) => {
      console.error('Failed to load parent afterschool bill:', err);
    });
  }, [activeSemesterId, profile, user]);

  const handleConfirmBill = async () => {
    if (!bill) return;

    const storageKey = `afterschool_confirm_${bill.id}_${bill.issuedAt}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, 'true');
    }

    setIsOpen(false);

    try {
      await confirmStudentAfterschoolBill(bill.semesterId, bill.id);
    } catch (err) {
      console.error('Failed to confirm afterschool bill:', err);
    }
  };

  if (!bill) return null;

  const isTotalFree = bill.finalTotalFare === 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border-purple-200">
        {/* 상단 헤더 배너: 수강 확정 안내 */}
        <DialogHeader className="bg-gradient-to-r from-purple-700 via-indigo-800 to-slate-900 text-white p-5 pb-4 shrink-0 text-left">
          <div className="flex items-center justify-between">
            <Badge className="bg-emerald-500/40 text-emerald-100 border-emerald-400/50 text-[11px] font-bold px-2 py-0.5">
              ✓ 수강 확정 완료
            </Badge>
            <span className="text-[11px] text-purple-200">
              안내일: {new Date(bill.issuedAt).toLocaleDateString()}
            </span>
          </div>
          <DialogTitle className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            ≪ {bill.semesterName} ≫ 방과후학교 수강 확정 안내
          </DialogTitle>
          <DialogDescription className="text-xs text-purple-200 mt-0.5">
            <b>{bill.studentName}</b> 학생 ({bill.grade}학년 {bill.classNum}반)의 <b>방과후학교 수강 강좌 및 수업 일정 안내</b>입니다.
          </DialogDescription>
        </DialogHeader>

        {/* 본문 안내 상세 */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs text-slate-700 flex-1">
          {/* 1. 수강료 납부 요약 카드 (금액이 있는 경우와 전액 무료인 경우 구분) */}
          <div className={cn(
            "p-4 rounded-xl border text-center space-y-1 shadow-xs",
            isTotalFree 
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-950" 
              : "bg-gradient-to-br from-purple-50 via-slate-50 to-indigo-50/50 border-purple-200/90 text-purple-950"
          )}>
            <div className="text-[11px] font-bold text-slate-600">
              {isTotalFree ? '수강료 안내' : '이번 기수 최종 납부 예정 수강료'}
            </div>

            {isTotalFree ? (
              <div className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight flex items-center justify-center gap-1.5 py-0.5">
                <Check className="w-5 h-5" />
                <span>납부하실 금액이 없습니다 (전액 무료)</span>
              </div>
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-purple-700 tracking-tight">
                {bill.finalTotalFare.toLocaleString()} <span className="text-sm font-extrabold text-purple-950">{bill.currency}</span>
              </div>
            )}

            {!isTotalFree && (
              <div className="text-[10px] text-slate-500 font-medium pt-0.5">
                ※ 수강료는 등록된 <b>스쿨뱅킹 자동 출금</b> 또는 <b>가상계좌</b>로 납부됩니다.
              </div>
            )}
          </div>

          {/* 2. 수강 확정 강좌 상세 카드 목록 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between font-bold text-[11px] text-slate-800">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                수강 확정 강좌 안내 (총 {bill.courses.length}개 강좌)
              </span>
            </div>

            <div className="space-y-2.5">
              {bill.courses.map((c, i) => {
                const isCourseFree = c.isFree || c.tuition === 0;
                return (
                  <div key={i} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    {/* 강좌 헤더: 강좌명 및 무료 배지 */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                        <span>{c.courseTitle}</span>
                        {c.classDays && c.classDays.length > 0 && (
                          <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 font-bold px-1.5 py-0">
                            {c.classDays.join(', ')}요일
                          </Badge>
                        )}
                      </div>
                      {isCourseFree ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] font-extrabold border-emerald-300">
                          무료 강좌
                        </Badge>
                      ) : (
                        <span className="font-extrabold text-purple-700 text-xs">
                          {c.courseSubtotal.toLocaleString()} {bill.currency}
                        </span>
                      )}
                    </div>

                    {/* 수업 정보: 수업 시간, 수업 장소, 담당 강사 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-600">
                      {c.classTime && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>수업 시간: <b className="text-slate-800">{c.classTime}</b></span>
                        </div>
                      )}
                      {c.classroom && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>수업 장소: <b className="text-slate-800">{c.classroom}</b></span>
                        </div>
                      )}
                      {c.instructorName && (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>담당 강사: <b className="text-slate-800">{c.instructorName}</b></span>
                        </div>
                      )}
                    </div>

                    {/* 수강료 세부 내역 (0원인 항목은 아예 미표시, 청구액이 있는 경우만 표시) */}
                    {!isCourseFree && (
                      <div className="flex items-center gap-3 pt-1 text-[10px] text-slate-500 border-t border-slate-100">
                        {c.tuition > 0 && <span>수강료: <b>{c.tuition.toLocaleString()} {bill.currency}</b></span>}
                        {c.textbookFee > 0 && <span>• 교재비: <b>{c.textbookFee.toLocaleString()} {bill.currency}</b></span>}
                        {c.materialFee > 0 && <span>• 재료비: <b>{c.materialFee.toLocaleString()} {bill.currency}</b></span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. 스쿨버스 탑승 안내 (스쿨버스를 신청한 경우에만 노출!) */}
          {bill.isBusRiding && (
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span className="flex items-center gap-1.5 text-emerald-800">
                  <Bus className="w-4 h-4 text-emerald-600" />
                  스쿨버스 탑승 안내
                </span>
                {bill.busFare > 0 && (
                  <span className="font-extrabold text-emerald-700 text-xs">
                    +{bill.busFare.toLocaleString()} {bill.currency}
                  </span>
                )}
              </div>

              <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-100 text-[11px] text-slate-700 space-y-1">
                {bill.busNo && (
                  <div>• 탑승 버스: <b className="text-emerald-900 font-extrabold">{bill.busNo}</b></div>
                )}
                {bill.destinationName && bill.destinationName !== '-' && (
                  <div>• 탑승/하교 정류장: <b>{bill.destinationName}</b> {bill.zone && `(${bill.zone})`}</div>
                )}
                {bill.busFare > 0 && (
                  <div className="text-[10px] text-emerald-700 font-medium pt-0.5">
                    ✓ 거리별 방과후 버스 요금이 수강료에 포함되었습니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. 특별 감면 및 개별 조정 (0원이 아닌 경우에만 노출) */}
          {bill.isAdjusted && bill.adjustmentAmount !== undefined && bill.adjustmentAmount !== 0 && (
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-1">
              <div className="flex items-center justify-between font-bold text-amber-950">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  특별 감면 및 조정 내역
                </span>
                <span className={cn("font-extrabold", bill.adjustmentAmount > 0 ? "text-indigo-700" : "text-rose-600")}>
                  {bill.adjustmentAmount > 0 ? `+${bill.adjustmentAmount.toLocaleString()}` : bill.adjustmentAmount.toLocaleString()} {bill.currency}
                </span>
              </div>
              {bill.adjustmentReason && (
                <div className="text-[11px] text-amber-900 pl-5">
                  • 사유: {bill.adjustmentReason}
                </div>
              )}
            </div>
          )}

          {/* 하단 친절 안내문 */}
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
            💡 <b>수업 준비:</b> 첫 수업 시간 5분 전까지 해당 교실로 입실할 수 있도록 지도 바랍니다. (문의: 방과후지원센터 또는 행정실)
          </div>
        </div>

        {/* 하단 확인 버튼 */}
        <DialogFooter className="p-4 bg-slate-50 border-t flex flex-row items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            KIS 방과후학교지원센터
          </div>
          <Button
            type="button"
            onClick={handleConfirmBill}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-xs cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            수강 확정 및 안내 확인 완료
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
