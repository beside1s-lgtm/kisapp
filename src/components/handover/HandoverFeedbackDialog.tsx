'use client';

import React, { useEffect, useState } from 'react';
import { HandoverDocument } from '@/lib/types/handover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Loader2, MessageSquareWarning, RotateCcw } from 'lucide-react';

export type HandoverFeedbackMode = 'revision' | 'reject';

interface HandoverFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: HandoverFeedbackMode;
  targetDoc: {
    id: string;
    authorName: string;
    authorEmail?: string;
    authorDepartment?: string;
    primaryDuty: string;
  } | null;
  isSubmitting?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
}

export function HandoverFeedbackDialog({
  open,
  onOpenChange,
  mode,
  targetDoc,
  isSubmitting = false,
  onConfirm,
}: HandoverFeedbackDialogProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open, targetDoc?.id, mode]);

  const isRevision = mode === 'revision';

  const handleSubmit = async () => {
    const trimmed =
      reason.trim() ||
      (isRevision
        ? '인수인계 내역 보완이 필요하여 수정을 요청합니다.'
        : '인수인계서 내용 보완이 필요하여 반려되었습니다. 수정 후 다시 제출해 주세요.');
    await onConfirm(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-md p-5 bg-white rounded-2xl shadow-xl border ${
          isRevision ? 'border-orange-200' : 'border-rose-200'
        }`}
      >
        <DialogHeader className="space-y-1.5 pb-2 border-b">
          <div className="flex items-center gap-1.5">
            {isRevision ? (
              <>
                <MessageSquareWarning className="w-4 h-4 text-orange-600" />
                <Badge className="bg-orange-600 hover:bg-orange-600 text-white font-bold text-xs">
                  인수인계서 수정 요청
                </Badge>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <Badge variant="destructive" className="font-bold text-xs">
                  인수인계서 반려
                </Badge>
              </>
            )}
          </div>
          <DialogTitle className="text-sm sm:text-base font-bold text-slate-900">
            {targetDoc?.authorName || '담당자'} 교사의 인계서 {isRevision ? '수정을 요청' : '반려 처리'}하시겠습니까?
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isRevision
              ? '수정 요청 처리 시 작성자에게 수정 요청 사유가 전달되며, 보완 후 교무부장 확인을 거쳐 다시 상신할 수 있습니다.'
              : '반려 처리 시 해당 교사의 인계서 상태가 반려로 전환되며, 접속 시 작성 팝업과 반려 사유가 다시 표시됩니다.'}
          </DialogDescription>
        </DialogHeader>

        {targetDoc && (
          <div className="space-y-3 py-2 text-xs">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 space-y-1">
              <div>
                <b>인계 대상 업무:</b> {targetDoc.primaryDuty}
              </div>
              <div>
                <b>소속 부서:</b> {targetDoc.authorDepartment || '미지정'}
                {targetDoc.authorEmail ? ` (${targetDoc.authorEmail})` : ''}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-700">
                {isRevision ? '수정 요청 사항 (작성자에게 표시됨)' : '반려 사유 (교사에게 표시됨)'}
              </Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  isRevision
                    ? '예: 2학기 행사 일정 및 예산 집행 폴더 링크를 보완한 후 재제출 바랍니다.'
                    : '예: 전년도 드라이브 폴더 링크 누락 및 주요 인계 사항 보완 필요'
                }
                rows={4}
                className="text-xs bg-white border-slate-300 resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="pt-2 border-t flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="h-8 text-xs"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`h-8 text-xs font-bold text-white gap-1 ${
              isRevision ? 'bg-orange-600 hover:bg-orange-700' : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isRevision ? (
              <MessageSquareWarning className="w-3.5 h-3.5" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span>{isRevision ? '수정 요청 전송' : '반려 처리 확정'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function buildFeedbackTargetFromDoc(doc: HandoverDocument) {
  return {
    id: doc.id,
    authorName: doc.authorName,
    authorEmail: doc.authorEmail,
    authorDepartment: doc.authorDepartment,
    primaryDuty: doc.primaryDuty,
  };
}
