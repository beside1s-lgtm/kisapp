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
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const [requiredConsent1, setRequiredConsent1] = useState(false);
  const [requiredConsent2, setRequiredConsent2] = useState(false);
  const [optionalConsent1, setOptionalConsent1] = useState(false);

  const allRequiredChecked = requiredConsent1 && requiredConsent2;
  const isAllChecked = requiredConsent1 && requiredConsent2 && optionalConsent1;

  const handleSelectAll = (checked: boolean) => {
    setRequiredConsent1(checked);
    setRequiredConsent2(checked);
    setOptionalConsent1(checked);
  };

  const handleSubmit = () => {
    if (!allRequiredChecked) return;
    const consentPayload = {
      required1: requiredConsent1,
      required2: requiredConsent2,
      optional1: optionalConsent1,
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && onCancel) onCancel(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white shadow-2xl rounded-2xl border-slate-200">
        {/* Header Section */}
        <DialogHeader className="p-6 bg-slate-900 text-white space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <Badge variant="outline" className="border-indigo-400/50 text-indigo-300 bg-indigo-500/10 text-xs font-semibold">
                Decree 13/2023/ND-CP 준수
              </Badge>
            </div>
            <Lock className="h-5 w-5 text-slate-400" />
          </div>
          <DialogTitle className="text-xl font-bold text-white tracking-tight font-headline">
            개인정보 수집·이용 및 제3자 제공 동의서
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-xs leading-relaxed">
            호치민시한국국제학교(KIS) 방과후학교 수강 신청을 위해 베트남 개인정보보호법(Decree 13)에 따라 아래 필수 개인정보 처리 항목에 대한 동의가 필요합니다.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Terms Body */}
        <ScrollArea className="flex-1 p-6 space-y-6 max-h-[55vh]">
          {/* 전체 동의 체크박스 */}
          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-4 flex items-center gap-3 transition-colors mb-4">
            <Checkbox
              id="consent-all"
              checked={isAllChecked}
              onCheckedChange={(checked) => handleSelectAll(!!checked)}
              className="h-5 w-5 border-indigo-400 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
            />
            <label htmlFor="consent-all" className="font-bold text-sm text-indigo-950 cursor-pointer select-none">
              개인정보 수집 및 제3자 제공 약관 전체 동의 (선택 포함)
            </label>
          </div>

          <div className="space-y-4 text-sm">
            {/* 항목 1: [필수] 수집 및 이용 동의 */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent-req1"
                  checked={requiredConsent1}
                  onCheckedChange={(checked) => setRequiredConsent1(!!checked)}
                  className="mt-0.5 h-4 w-4 border-slate-400 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                />
                <div className="space-y-1 flex-1">
                  <label htmlFor="consent-req1" className="font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer select-none">
                    <span className="text-indigo-600 text-xs bg-indigo-100 font-bold px-2 py-0.5 rounded-full shrink-0">필수</span>
                    <span>개인정보 수집 및 이용 동의</span>
                  </label>
                  <div className="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-lg border border-slate-100 mt-2 leading-relaxed">
                    <p>• <strong>수집 및 이용 목적:</strong> 방과후학교 수강신청, 학생 출결 관리, 강좌 관련 긴급 연락 및 수강료 정산 처리</p>
                    <p>• <strong>수집 항목:</strong> 학생 성명, 학학년, 반, 번호, 학부모 성명, 학부모 비상 연락처</p>
                    <p>• <strong>보유 및 이용 기간:</strong> 해당 학년도 방과후학교 종료 시까지 (학사 기록 보관 목적에 따라 필요시 법정 기간 보관)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 항목 2: [필수] 제3자 제공 동의 */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent-req2"
                  checked={requiredConsent2}
                  onCheckedChange={(checked) => setRequiredConsent2(!!checked)}
                  className="mt-0.5 h-4 w-4 border-slate-400 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                />
                <div className="space-y-1 flex-1">
                  <label htmlFor="consent-req2" className="font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer select-none">
                    <span className="text-indigo-600 text-xs bg-indigo-100 font-bold px-2 py-0.5 rounded-full shrink-0">필수</span>
                    <span>개인정보 제3자 제공 동의</span>
                  </label>
                  <div className="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-lg border border-slate-100 mt-2 leading-relaxed">
                    <p>• <strong>제공받는 자:</strong> 외부 위탁 전문강사 및 스쿨버스 운송 협력업체</p>
                    <p>• <strong>제공 목적:</strong> 수업 출결 관리, 외부 강좌 지도, 하교 및 방과후 버스 탑승 동선 안내</p>
                    <p>• <strong>제공 항목:</strong> 학생 성명, 학학년/반/번호, 학부모 비상 연락처</p>
                    <p>• <strong>보유 및 이용 기간:</strong> 위탁 계약 기간 및 위탁 강좌 종료 시까지</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 항목 3: [선택] 마케팅/알림 수신 동의 */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent-opt1"
                  checked={optionalConsent1}
                  onCheckedChange={(checked) => setOptionalConsent1(!!checked)}
                  className="mt-0.5 h-4 w-4 border-slate-400 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                />
                <div className="space-y-1 flex-1">
                  <label htmlFor="consent-opt1" className="font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer select-none">
                    <span className="text-slate-500 text-xs bg-slate-200 font-bold px-2 py-0.5 rounded-full shrink-0">선택</span>
                    <span>학교 안내 메시지 및 알림 수신 동의</span>
                  </label>
                  <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-100 mt-2 leading-relaxed">
                    <p>• <strong>이용 목적:</strong> 차기 방과후학교 개설 안내, 특강 및 이벤트 소식 SMS/Zalo 알림발송</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 거부권 안내 및 Decree 13 안내 */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-900 text-xs mt-4">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              귀하는 개인정보 수집 및 제공 동의를 거부할 권리가 있습니다. 단, 필수 항목 거부 시 방과후학교 수강 신청이 제한될 수 있습니다.
            </span>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <DialogFooter className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between sm:justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            {allRequiredChecked ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> 필수 항목 동의 완료
              </span>
            ) : (
              <span className="text-rose-500 font-medium">※ 필수 항목 2개에 모두 동의해주세요.</span>
            )}
          </div>
          <div className="flex gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} className="text-xs">
                취소
              </Button>
            )}
            <Button
              type="button"
              disabled={!allRequiredChecked}
              onClick={handleSubmit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 shadow-sm disabled:opacity-50"
            >
              동의하고 수강신청 시작하기
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
