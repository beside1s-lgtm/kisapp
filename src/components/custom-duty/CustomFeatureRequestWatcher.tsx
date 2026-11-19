'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { usePopupSlot } from '@/lib/popupQueue';
import { onOrgStructureUpdate } from '@/lib/services/settingsService';
import type { OrgStructure } from '@/lib/types';
import type { CustomFeatureUpgradeRequest } from '@/lib/types/customDuty';
import { onCustomFeatureRequestsUpdate } from '@/lib/services/customDutyService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, BellRing, Clock, FileText, Sparkles } from 'lucide-react';

const DISMISSED_SIGNATURE_KEY = 'kis_dismissed_custom_feature_req_sig';

export function CustomFeatureRequestWatcher() {
  const { user, profile, loading, isParent } = useAuth();
  const pathname = usePathname();

  const [orgData, setOrgData] = useState<Partial<OrgStructure> | null>(null);
  const [requests, setRequests] = useState<CustomFeatureUpgradeRequest[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsub = onOrgStructureUpdate((org) => setOrgData(org));
    return () => unsub();
  }, []);

  const isSystemManagerOrAdmin = useMemo(() => {
    if (loading || !user?.email || isParent || !profile) return false;
    if (profile.isAdmin === true) return true;
    const emailLower = user.email.toLowerCase();
    return Boolean(
      orgData?.systemManagers?.some((m) => m?.trim().toLowerCase() === emailLower)
    );
  }, [loading, user?.email, isParent, profile, orgData?.systemManagers]);

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'pending'),
    [requests]
  );

  useEffect(() => {
    if (!isSystemManagerOrAdmin) return;
    if (pathname.includes('/print') || pathname === '/login') return;

    const unsub = onCustomFeatureRequestsUpdate((list) => {
      setRequests(list);
      const pending = list.filter((r) => r.status === 'pending');
      if (pending.length === 0) {
        setIsOpen(false);
        return;
      }

      const sig = pending.map((r) => `${r.id}:${r.updatedAt}`).join('|');
      try {
        const dismissedSig = sessionStorage.getItem(DISMISSED_SIGNATURE_KEY);
        if (dismissedSig !== sig) {
          setIsOpen(true);
        }
      } catch {
        setIsOpen(true);
      }
    });

    return () => unsub();
  }, [isSystemManagerOrAdmin, pathname]);

  const dismissCurrentSignature = () => {
    if (pendingRequests.length === 0) return;
    const sig = pendingRequests.map((r) => `${r.id}:${r.updatedAt}`).join('|');
    try {
      sessionStorage.setItem(DISMISSED_SIGNATURE_KEY, sig);
    } catch {
      // ignore storage failure
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setIsOpen(nextOpen);
    if (!nextOpen) {
      dismissCurrentSignature();
    }
  };

  const handleGoToFeatureManager = () => {
    dismissCurrentSignature();
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('openCustomFeatureRequestManager'));
  };

  const eligible = Boolean(isSystemManagerOrAdmin && user?.email && profile && pendingRequests.length > 0);
  // 안전점검·인수인계 등 다른 자동 팝업과 겹치지 않도록 차례가 올 때만 표시
  const canShow = usePopupSlot('custom-feature-request', eligible && isOpen);

  if (!eligible || !canShow) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] flex flex-col overflow-hidden p-0 rounded-2xl">
        <DialogHeader className="px-5 py-4 border-b bg-slate-900 text-white shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
            <BellRing className="w-4 h-4 text-amber-400 shrink-0" />
            <span>신규 업무기능 추가 요청 알림</span>
            <Badge className="bg-rose-600 text-white text-[11px] font-extrabold px-2 py-0.5 shrink-0">
              미처리 {pendingRequests.length}건
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-300">
            교직원이 커스텀 업무 페이지에서 접수한 신규 업무기능 추가 요청이 총{' '}
            <strong className="text-white">{pendingRequests.length}건</strong> 대기 중입니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-2.5 bg-slate-50/70">
          {pendingRequests.map((req, index) => (
            <div
              key={req.id}
              className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Badge className="bg-indigo-600 text-white text-[10px] font-bold shrink-0">
                    {index + 1}. {req.dutyName}
                  </Badge>
                  {req.deptName && (
                    <Badge variant="outline" className="text-[10px] bg-slate-50 shrink-0">
                      {req.deptName}
                    </Badge>
                  )}
                </div>
                <span className="text-[10.5px] text-slate-400 flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3" />
                  {req.createdAt ? new Date(req.createdAt).toLocaleDateString('ko-KR') : ''}
                </span>
              </div>

              <div className="text-xs font-extrabold text-slate-900 line-clamp-1">
                {req.requestTitle}
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>
                  요청자: <strong className="text-slate-700">{req.requesterName}</strong>
                </span>
                <span className="flex items-center gap-1 text-indigo-700 font-semibold shrink-0">
                  <FileText className="w-3 h-3" />
                  표준서식 {req.uploadedDocs?.length || 0}건 · 붙임 {req.attachments?.length || 0}건
                </span>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-white shrink-0 flex items-center justify-between sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            className="h-8 text-xs font-semibold"
          >
            나중에 보기
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleGoToFeatureManager}
            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>업무기능 추가 요청 관리</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
