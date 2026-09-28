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
import { Bus, ShieldAlert, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const BUS_SAFETY_CONSENT_STORAGE_KEY = 'kisapp_bus_safety_consent_v1';

interface BusSafetyConsentModalProps {
  isOpen: boolean;
  onConsentGranted: () => void;
  onCancel?: () => void;
}

export function BusSafetyConsentModal({
  isOpen,
  onConsentGranted,
  onCancel,
}: BusSafetyConsentModalProps) {
  const [hasAgreed, setHasAgreed] = useState(false);

  const handleClose = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const handleSubmit = () => {
    if (!hasAgreed) return;
    try {
      localStorage.setItem(
        BUS_SAFETY_CONSENT_STORAGE_KEY,
        JSON.stringify({
          agreed: true,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (e) {
      console.error('Failed to save bus safety consent:', e);
    }
    onConsentGranted();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-2xl h-[88vh] sm:h-auto max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white shadow-2xl rounded-2xl border-slate-200 [&>button:last-child]:text-slate-300 [&>button:last-child]:hover:text-white [&>button:last-child]:hover:bg-slate-800 [&>button:last-child]:transition-colors [&>button:last-child]:top-3.5 [&>button:last-child]:right-3.5">
        {/* Header Section */}
        <DialogHeader className="p-4 sm:p-6 bg-slate-900 text-white space-y-2 shrink-0 relative">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-amber-500/20 rounded-lg text-amber-400">
                <Bus className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <Badge variant="outline" className="border-amber-400/50 text-amber-300 bg-amber-500/10 text-[11px] sm:text-xs font-semibold">
                학생생활지도규정 제31조 2 준수
              </Badge>
            </div>
            <ShieldAlert className="h-4 w-4 text-slate-400 hidden sm:block" />
          </div>

          <DialogTitle className="text-base sm:text-xl font-bold text-white tracking-tight font-headline text-left">
            스쿨버스 안전수칙 및 이용 규정 동의서
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-[11px] sm:text-xs leading-relaxed text-left">
            호치민시한국국제학교(KIS) 스쿨버스의 안전한 운행과 학생들의 안전 지도를 위해 아래 규정에 대한 학부모 및 학생의 동의가 필요합니다.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Terms Body (네이티브 부드러운 스크롤 컨테이너) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
          {/* 단일 필수 동의 카드 */}
          <div className="border border-amber-200/80 rounded-xl p-3.5 sm:p-4 space-y-3 bg-amber-50/30">
            <div className="flex items-start gap-3">
              <Checkbox
                id="bus-consent-required"
                checked={hasAgreed}
                onCheckedChange={(checked) => setHasAgreed(!!checked)}
                className="mt-0.5 h-5 w-5 border-amber-500 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
              />
              <div className="space-y-2 flex-1">
                <label htmlFor="bus-consent-required" className="font-bold text-slate-900 flex items-center gap-1.5 cursor-pointer select-none text-xs sm:text-sm">
                  <span className="text-amber-700 text-xs bg-amber-100 font-bold px-2 py-0.5 rounded-full shrink-0">필수</span>
                  <span>스쿨버스 안전수칙 및 이용 규정 준수 동의</span>
                </label>

                {/* 1. 안전수칙 9개 항목 */}
                <div className="text-xs text-slate-600 space-y-2.5 bg-white p-3.5 sm:p-4 rounded-lg border border-slate-200 mt-2 leading-relaxed">
                  <div className="font-bold text-slate-800 text-xs sm:text-sm border-b pb-1.5 flex items-center gap-1.5 text-amber-800">
                    <Bus className="w-4 h-4 text-amber-600" />
                    1. 스쿨버스 탑승 안전수칙
                  </div>
                  <ul className="space-y-1.5 text-[11px] sm:text-xs text-slate-700 pl-1">
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold shrink-0">•</span>
                      <span>차량 안전운행을 위해 지도 교사 및 차량 도우미, 학생 차장의 안내를 따릅니다.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold shrink-0">•</span>
                      <span>차량 승․하차 시 차례를 지켜서 타고 내립니다.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold shrink-0">•</span>
                      <span>좌석에 앉은 후 <strong>안전벨트를 반드시 착용</strong>하고 중간에 풀지 않습니다.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold shrink-0">•</span>
                      <span>차량이 운행하는 동안 절대 자리에서 일어나거나 돌아다니지 않습니다.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold shrink-0">•</span>
                      <span>차량 밖으로 손을 내밀거나 물건을 창문 밖으로 던지지 않습니다.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold shrink-0">•</span>
                      <span>타인에게 불쾌감을 주는 행동이나 언어적․신체적 폭력을 행사하지 않습니다.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold shrink-0">•</span>
                      <span>차량이 정차하기 전에 미리 안전벨트를 풀고 자리에서 일어나지 않습니다.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold shrink-0">•</span>
                      <span>차량 내에서 음식물 섭취를 하지 않고, 급한 통화, 음악 감상 목적 외의 핸드폰 사용을 하지 않습니다.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold shrink-0">•</span>
                      <span>
                        규정에 의거, 소지 불가한 물품(인화물질, 무기류, 전자담배, 주류, 기타 위험 물품)을 소지한 것이 적발되었을 경우 버스 승차가 금지될 수 있습니다. 또한, 규정에 따라 지도교사가 소지품 검사를 할 수 있습니다. 
                        <span className="text-muted-foreground block text-[10px] mt-0.5">(관련 규정: 호치민시한국학교 규정집 7-4장 26조)</span>
                      </span>
                    </li>
                  </ul>
                </div>

                {/* 2. 학생생활지도규정 위반 조치 안내 */}
                <div className="text-xs bg-red-50/70 border border-red-200/80 rounded-lg p-3 sm:p-3.5 space-y-2 mt-3">
                  <div className="font-bold text-red-900 text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>학생생활지도규정 제31조 2 (안전지도) - 『학교스쿨버스 이용』</span>
                  </div>
                  <p className="text-[11px] text-red-700 leading-snug">
                    ※ 위의 안전수칙을 어길 경우 <strong>‘지도 요청서’</strong>가 가정에 송부되며, 단계별로 아래 조치가 적용됩니다.
                  </p>
                  <div className="space-y-1.5 pt-1 text-[11px] text-slate-800">
                    <div className="p-2 bg-white rounded border border-red-100 flex items-start gap-1.5">
                      <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 shrink-0 font-bold">1차</Badge>
                      <span>반성문 및 지도요청서 가정 발송 / 학부모 소환 및 지도요청서 작성</span>
                    </div>
                    <div className="p-2 bg-white rounded border border-red-100 flex items-start gap-1.5">
                      <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 shrink-0 font-bold">2차</Badge>
                      <span>학부모 소환 및 2차 지도요청서 발송 / <strong>1주일 통학버스 탑승 제한</strong></span>
                    </div>
                    <div className="p-2 bg-white rounded border border-red-100 flex items-start gap-1.5">
                      <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 shrink-0 font-bold">3차</Badge>
                      <span>학부모 소환 및 3차 지도요청서 발송 / <strong>1개월 통학버스 탑승 제한</strong></span>
                    </div>
                    <div className="p-2 bg-white rounded border border-red-100 flex items-start gap-1.5">
                      <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 shrink-0 font-bold">4차</Badge>
                      <span><strong>통학버스 탑승 제한 (전출 및 졸업까지)</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 거부권 및 유의사항 안내 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex items-start gap-2 text-slate-700 text-[11px] sm:text-xs">
            <AlertCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <span>
              스쿨버스 안전수칙에 동의하지 않을 경우 탑승 신청이 제한될 수 있습니다. 탑승 중인 학생은 안전요원 및 지도교사의 지시에 항상 적극 협조해야 합니다.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-3.5 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between sm:justify-between gap-2 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            {hasAgreed ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1 text-[11px] sm:text-xs">
                <CheckCircle2 className="h-4 w-4" /> 규정 준수 동의 완료
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
              disabled={!hasAgreed}
              onClick={handleSubmit}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-4 sm:px-5 shadow-sm disabled:opacity-50"
            >
              동의하고 신청하기
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
