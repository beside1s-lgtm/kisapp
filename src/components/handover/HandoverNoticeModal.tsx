'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HandoverNotice } from '@/lib/types/handover';
import { dismissHandoverNoticeForToday } from '@/lib/services/handoverService';
import { FileSpreadsheet, ArrowRight, BellRing, Clock } from 'lucide-react';

interface HandoverNoticeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notice: HandoverNotice;
  currentUserEmail: string;
}

export function HandoverNoticeModal({
  open,
  onOpenChange,
  notice,
  currentUserEmail,
}: HandoverNoticeModalProps) {
  const router = useRouter();

  const handleGoToWrite = () => {
    onOpenChange(false);
    router.push('/teacher/handover');
  };

  const handleDismissToday = () => {
    dismissHandoverNoticeForToday(currentUserEmail, notice.year);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-white border border-indigo-200 rounded-2xl shadow-xl">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-bold gap-1 px-2.5 py-0.5">
              <BellRing className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              교무기획부 공식 공지
            </Badge>
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3" />
              {notice.year}학년도 학년 말
            </span>
          </div>

          <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>{notice.title}</span>
          </DialogTitle>

          <DialogDescription className="text-xs sm:text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap pt-1.5 pb-2 border-y border-slate-100">
            {notice.message}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">발신 부서 / 발신자:</span>
            <span className="font-bold text-slate-800">교무기획부 ({notice.requestedByName || '교무부장'})</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">인계 데이터 연동:</span>
            <span className="font-bold text-indigo-600">지난 1년간 기안기 누적 문서 원클릭 불러오기 지원</span>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDismissToday}
            className="text-xs text-slate-500 hover:text-slate-800 h-8"
          >
            오늘 하루 보지 않기
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold h-9 px-3 border-slate-300"
            >
              닫기
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleGoToWrite}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white h-9 px-4 gap-1.5 shadow-xs"
            >
              <span>지금 작성하기</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
