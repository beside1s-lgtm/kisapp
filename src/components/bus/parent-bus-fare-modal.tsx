'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { onLatestActiveBillsUpdate, getBusFareBills, findStudentBill, confirmStudentBusFareBill } from '@/lib/kisbus/fareBills';
import type { BusFareBill } from '@/lib/kisbus/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    FileSpreadsheet, CheckCircle2, Calendar, MapPin, DollarSign, Users, 
    Sparkles, AlertCircle, Info, Receipt, ChevronRight, X
} from 'lucide-react';
import { cn } from '@/lib/kisbus/utils';

export function ParentBusFareModal() {
  const { user, profile } = useAuth();
  const [bill, setBill] = useState<BusFareBill | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeQuarterId, setActiveQuarterId] = useState<string | null>(null);

  // 최신 발행된 활성 청구서 포인터 실시간 감지
  useEffect(() => {
    const unsub = onLatestActiveBillsUpdate((data) => {
      if (data?.activeQuarterId) {
        setActiveQuarterId(data.activeQuarterId);
      }
    });
    return () => unsub();
  }, []);

  // 활성 분기 청구서 데이터 로드 및 현재 로그인 학부모 자녀 매칭
  useEffect(() => {
    if (!activeQuarterId) return;

    // 자녀 식별 정보
    const studentName = profile?.studentName || '';
    const grade = profile?.studentGrade || '';
    const studentClass = profile?.studentClass || '';
    const contact = profile?.phoneNumber || user?.phoneNumber || '';

    if (!studentName && !contact) return;

    getBusFareBills(activeQuarterId).then((store) => {
      if (!store || !store.bills || store.bills.length === 0) return;

      const matchedBill = findStudentBill(store.bills, {
        studentName,
        grade,
        studentClass,
        contact
      });

      if (matchedBill && matchedBill.isRiding) {
        setBill(matchedBill);

        // 이미 로컬스토리지에서 확인했는지 검사
        const storageKey = `kisbus_bill_confirmed_${matchedBill.id}_${matchedBill.issuedAt}`;
        const isLocallyConfirmed = typeof window !== 'undefined' && localStorage.getItem(storageKey) === 'true';

        if (!isLocallyConfirmed && !matchedBill.isConfirmed) {
          setIsOpen(true);
        }
      }
    }).catch(err => {
      console.error("Failed to load parent bus fare bill:", err);
    });
  }, [activeQuarterId, profile, user]);

  const handleConfirmBill = async () => {
    if (!bill) return;

    // 로컬스토리지에 확인 기록 저장
    const storageKey = `kisbus_bill_confirmed_${bill.id}_${bill.issuedAt}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, 'true');
    }

    setIsOpen(false);

    // Firestore에 확인 기록 비동기 저장
    try {
      await confirmStudentBusFareBill(bill.quarterId, bill.studentId);
    } catch (err) {
      console.error("Failed to confirm bill on server:", err);
    }
  };

  if (!bill) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border-indigo-200">
        {/* 상단 헤더 배너 */}
        <DialogHeader className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white p-5 pb-4 shrink-0 text-left">
          <div className="flex items-center justify-between">
            <Badge className="bg-blue-500/40 text-blue-100 border-blue-400/50 text-[11px] font-bold px-2 py-0.5">
              📅 평일 정규 등하교 버스 요금 청구
            </Badge>
            <span className="text-[11px] text-indigo-200">
              발행일: {new Date(bill.issuedAt).toLocaleDateString()}
            </span>
          </div>
          <DialogTitle className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-300" />
            ≪ {bill.quarterName} ≫ 평일 스쿨버스 청구서
          </DialogTitle>
          <DialogDescription className="text-xs text-indigo-200 mt-0.5">
            <b>{bill.studentName}</b> 학생 ({bill.grade ? `${bill.grade}학년 ${bill.studentClass}반` : '탑승 학생'})의 <b>평일(월~금) 정규 등하교 버스</b> 분기 이용료 산출 내역입니다.
          </DialogDescription>
        </DialogHeader>

        {/* 본문 산출 내역 5단계 상세 설명 */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs text-slate-700 flex-1">
          {/* 1. 최종 청구 금액 강조 카드 */}
          <div className="bg-gradient-to-br from-indigo-50 via-slate-50 to-blue-50/50 p-4 rounded-xl border border-indigo-200/90 text-center space-y-1 shadow-xs">
            <div className="text-[11px] text-indigo-900 font-bold">이번 분기 평일 버스 최종 납부 청구 금액</div>
            <div className="text-2xl sm:text-3xl font-black text-indigo-700 tracking-tight">
              {bill.finalQuarterFare.toLocaleString()} <span className="text-sm font-extrabold text-indigo-950">{bill.currency}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium pt-0.5">
              ※ 스쿨뱅킹 자동 출금 또는 가상계좌 개별 안내에 따라 납부됩니다.
            </div>
          </div>


          {/* 2. 산출 내역 단계별 분석 카드 */}
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-2xs">
            <div className="p-2.5 bg-slate-50/80 font-bold text-[11px] text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>청구 금액 산출 내역 상세</span>
            </div>

            {/* 1단계: 기간 및 적용 등교일수 */}
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  1. 분기 기간 & 적용 등교일수
                </span>
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-extrabold text-xs">
                  {bill.finalQuarterDays}일 적용
                </Badge>
              </div>
              <div className="text-[11px] text-slate-600 pl-5 leading-relaxed">
                • 운영 기간: {bill.quarterPeriod} (기본 평일 등교일수 {bill.baseQuarterDays}일)
                {bill.excludedDays > 0 && (
                  <div className="text-rose-600 font-bold pt-0.5">
                    • 학년별 공통 미이용 차감: -{bill.excludedDays}일 제외 ({bill.gradeExceptionReason || '수학여행 등'})
                  </div>
                )}
              </div>
            </div>

            {/* 2단계: 목적지 및 일일 요금 */}
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  2. 탑승 정류장 & 일일 요금
                </span>
                <span className="text-xs font-extrabold text-slate-900">
                  일일 {bill.totalDailyFare.toLocaleString()} {bill.currency}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 pl-5 leading-relaxed">
                • 탑승 목적지: <b>{bill.destinationName}</b> ({bill.zone})
                <div>• 거리별 기본요금: {bill.baseDailyFare.toLocaleString()} {bill.currency} / 일</div>
                {bill.isSmallGroup && bill.smallGroupSurcharge > 0 && (
                  <div className="text-rose-600 font-semibold pt-0.5">
                    • 3명 이하 소수 목적지 가산: +{bill.smallGroupSurcharge.toLocaleString()} {bill.currency} / 일 (총 {bill.destinationRiderCount}명 탑승)
                  </div>
                )}
              </div>
            </div>

            {/* 3단계: 기본 분기 요금 */}
            <div className="p-3 flex items-center justify-between bg-slate-50/50">
              <span className="font-semibold text-slate-700 pl-5">
                3. 분기 기본 원금 (일일 {bill.totalDailyFare.toLocaleString()} × {bill.finalQuarterDays}일)
              </span>
              <span className="font-bold text-slate-800">
                {bill.subtotalFare.toLocaleString()} {bill.currency}
              </span>
            </div>

            {/* 4단계: 형제/자매 복수 탑승 할인 */}
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-500" />
                  4. 형제/자매 복수 탑승 할인
                </span>
                {bill.isSiblingDiscounted ? (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-extrabold text-xs">
                    {bill.discountRate}% 할인 적용
                  </Badge>
                ) : (
                  <span className="text-slate-400 font-normal">해당 없음 (첫째 또는 단독 탑승)</span>
                )}
              </div>
              {bill.isSiblingDiscounted && (
                <div className="text-[11px] text-amber-800 pl-5 font-medium flex justify-between pt-0.5">
                  <span>• 둘째 이하 자녀 10% 감면:</span>
                  <span className="font-bold text-rose-600">-{bill.discountAmount.toLocaleString()} {bill.currency}</span>
                </div>
              )}
            </div>

            {/* 5단계: 관리자 개별 조정 (있는 경우) */}
            {bill.isAdjusted && bill.adjustmentAmount !== 0 && (
              <div className="p-3 space-y-1 bg-amber-50/40">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className="flex items-center gap-1.5 text-amber-900">
                    <Info className="w-3.5 h-3.5 text-amber-600" />
                    5. 특별 사유 개별 조정
                  </span>
                  <span className={cn("font-bold", bill.adjustmentAmount > 0 ? "text-indigo-700" : "text-rose-600")}>
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
          </div>

          {/* ℹ️ 방학 / 토요 방과후 버스비 분리 안내 박스 */}
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
            💡 <b>안내:</b> 본 청구서는 <b>평일(월~금) 정규 등하교 스쿨버스 이용료</b>입니다. (방학 및 토요 방과후학교 스쿨버스비는 방과후 수강료와 함께 별도 청구됩니다)
          </div>
        </div>

        {/* 하단 확인 버튼 */}
        <DialogFooter className="p-4 bg-slate-50 border-t flex flex-row items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            문의사항: 행정실 또는 담당 교사
          </div>
          <Button
            type="button"
            onClick={handleConfirmBill}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-xs cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            청구 내역 확인 완료
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
