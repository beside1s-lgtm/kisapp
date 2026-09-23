'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import type { FormValues } from '@/app/parents/apply/page';

export function ConfirmSubmitModal({
  showConfirmModal,
  setShowConfirmModal,
  pendingData,
  isSubmitting,
  confirmSubmit,
}: {
  showConfirmModal: boolean;
  setShowConfirmModal: (open: boolean) => void;
  pendingData: FormValues | null;
  isSubmitting: boolean;
  confirmSubmit: (skipPinCheck?: boolean) => void;
}) {
  return (
    <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
      <DialogContent className="w-[92%] sm:max-w-md rounded-2xl p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg font-bold">신청서 제출 확인</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-slate-600 pt-1">
            신청서를 전송하시겠습니까?
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
          {pendingData?.type === 'absence' && (
            <div>
              <span className="font-bold text-slate-800">[결석계]</span> {pendingData.studentName} ({pendingData.absencePeriod?.startDate} ~ {pendingData.absencePeriod?.endDate})
            </div>
          )}
          {pendingData?.type === 'field-trip' && (
            <div>
              <span className="font-bold text-slate-800">[교외체험학습 신청서]</span> {pendingData.studentName} ({pendingData.tripPeriod?.startDate} ~ {pendingData.tripPeriod?.endDate})
            </div>
          )}
          {pendingData?.type === 'field-trip-report' && (
            <div>
              <span className="font-bold text-slate-800">[교외체험학습 보고서]</span> {pendingData.studentName} ({pendingData.reportTitle})
            </div>
          )}
        </div>
        <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfirmModal(false)}
            disabled={isSubmitting}
            className="h-10 px-4"
          >
            취소
          </Button>
          <Button
            size="sm"
            onClick={() => confirmSubmit(true)}
            disabled={isSubmitting}
            className="h-10 px-4 bg-primary text-primary-foreground font-bold"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '전송'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
