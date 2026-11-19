'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { HandoverAdminView } from './HandoverAdminView';
import { UserProfile } from '@/lib/types';
import { CURRENT_SCHOOL_YEAR } from '@/lib/services/handoverService';
import { ShieldCheck } from 'lucide-react';

interface HandoverAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserProfile: UserProfile;
  year?: number;
}

export function HandoverAdminModal({
  open,
  onOpenChange,
  currentUserProfile,
  year = CURRENT_SCHOOL_YEAR,
}: HandoverAdminModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-6 bg-white border border-slate-200 rounded-2xl shadow-2xl">
        <DialogHeader className="space-y-1 text-left border-b pb-3">
          <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            학년 말 인수인계 및 교원 업무 배정 총괄 관리
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {year}학년도 전체 교원 담당 업무(Primary / Sub)를 지정하고, 전 교원 인수인계 요청 팝업 발송 및 차년도 인수자 자동 배정을 총괄합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <HandoverAdminView
            currentUserProfile={currentUserProfile}
            year={year}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
