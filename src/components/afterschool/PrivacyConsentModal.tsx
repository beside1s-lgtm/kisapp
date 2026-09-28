'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const DECREE13_CONSENT_STORAGE_KEY = 'kisapp_decree13_consent_v1';

interface PrivacyConsentModalProps {
  isOpen: boolean;
  onConsentGranted: (consentData: { required1: boolean; required2: boolean; optional1: boolean }) => void;
  onCancel?: () => void;
}

export function PrivacyConsentModal({
  isOpen,
  onConsentGranted,
  onCancel,
}: PrivacyConsentModalProps) {
  const [requiredConsent, setRequiredConsent] = useState(false);

  const handleClose = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const handleSubmit = () => {
    if (!requiredConsent) return;
    const consentPayload = {
      required1: true,
      required2: true,
      optional1: false,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(DECREE13_CONSENT_STORAGE_KEY, JSON.stringify(consentPayload));
    } catch (e) {
      console.error('Failed to save privacy consent state:', e);
    }
    onConsentGranted(consentPayload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-2xl h-[88vh] sm:h-auto max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white shadow-2xl rounded-2xl border-slate-200 [&>button:last-child]:text-slate-300 [&>button:last-child]:hover:text-white [&>button:last-child]:hover:bg-slate-800 [&>button:last-child]:transition-colors [&>button:last-child]:top-3.5 [&>button:last-child]:right-3.5">
        {/* Header Section */}
        <DialogHeader className="p-4 sm:p-6 bg-slate-900 text-white space-y-2 shrink-0 relative">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <Badge variant="outline" className="border-indigo-400/50 text-indigo-300 bg-indigo-500/10 text-[11px] sm:text-xs font-semibold">
                Decree 13/2023/ND-CP 준수
              </Badge>
            </div>
            <Lock className="h-4 w-4 text-slate-400 hidden sm:block" />
          </div>

          <DialogTitle className="text-base sm:text-xl font-bold text-white tracking-tight font-headline text-left">
            개인정보 수집·이용 및 제3자 제공 동의서
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-[11px] sm:text-xs leading-relaxed text-left">
            호치민시한국국제학교(KIS) 방과후학교 수강 신청을 위해 베트남 개인정보보호법(Decree 13)에 따라 아래 필수 개인정보 처리 항목에 대한 동의가 필요합니다.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Terms Body (네이티브 부드러운 스크롤 컨테이너) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
          {/* 단일 필수 동의 항목 */}
          <div className="border border-indigo-200/80 rounded-xl p-3.5 sm:p-4 space-y-3 bg-indigo-50/30">
            <div className="flex items-start gap-3">
              <Checkbox
                id="consent-required"
                checked={requiredConsent}
                onCheckedChange={(checked) => setRequiredConsent(!!checked)}
                className="mt-0.5 h-5 w-5 border-indigo-400 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
              />
              <div className="space-y-2 flex-1">
                <label htmlFor="consent-required" className="font-bold text-slate-900 flex items-center gap-1.5 cursor-pointer select-none text-xs sm:text-sm">
                  <span className="text-indigo-600 text-xs bg-indigo-100 font-bold px-2 py-0.5 rounded-full shrink-0">필수</span>
                  <span>개인정보 수집 및 이용 동의</span>
                </label>
                <div className="text-xs text-slate-600 space-y-3 bg-white p-3 sm:p-3.5 rounded-lg border border-slate-200 mt-2 leading-relaxed">
                  <div>
                    <div className="font-bold text-slate-800 mb-1">1. 개인정보 수집 및 이용</div>
                    <p>• <strong>수집 및 이용 목적:</strong> 방과후학교 수강신청, 학생 출결 관리, 강좌 관련 긴급 연락 및 수강료 정산 처리</p>
                    <p>• <strong>수집 항목:</strong> 학생 성명, 학년, 반, 번호, 학부모 성명, 학부모 비상 연락처</p>
                    <p>• <strong>보유 및 이용 기간:</strong> 해당 학년도 방과후학교 종료 시까지 (학사 기록 보관 목적에 따라 필요시 법정 기간 보관)</p>
                  </div>
                  <div className="pt-2.5 border-t border-slate-100">
                    <div className="font-bold text-slate-800 mb-1">2. 개인정보 제3자 제공</div>
                    <p>• <strong>제공받는 자:</strong> 외부 위탁 전문강사 및 스쿨버스 운송 협력업체</p>
                    <p>• <strong>제공 목적:</strong> 수업 출결 관리, 외부 강좌 지도, 하교 및 방과후 버스 탑승 동선 안내</p>
                    <p>• <strong>제공 항목:</strong> 학생 성명, 학년/반/번호, 학부모 비상 연락처</p>
                    <p>• <strong>보유 및 이용 기간:</strong> 위탁 계약 기간 및 위탁 강좌 종료 시까지</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 거부권 안내 및 Decree 13 안내 */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 sm:p-3.5 flex items-start gap-2 text-amber-900 text-[11px] sm:text-xs">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              귀하는 개인정보 수집 및 제공 동의를 거부할 권리가 있습니다. 단, 필수 항목 거부 시 방과후학교 수강 신청이 제한될 수 있습니다.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-3.5 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between sm:justify-between gap-2 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            {requiredConsent ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1 text-[11px] sm:text-xs">
                <CheckCircle2 className="h-4 w-4" /> 필수 항목 동의 완료
              </span>
            ) : (
              <span className="text-rose-500 font-medium text-[11px] sm:text-xs">※ 필수 항목에 동의해주세요.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose} className="text-xs h-9 px-3">
              취소
            </Button>
            <Button
              type="button"
              disabled={!requiredConsent}
              onClick={handleSubmit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 sm:px-5 shadow-sm disabled:opacity-50"
            >
              동의하고 시작
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
