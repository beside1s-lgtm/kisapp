'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format } from 'date-fns';
import type { ApprovalDoc } from '@/lib/types';

export function RejectDialog({
  rejectModalDoc,
  setRejectModalDoc,
  rejectReason,
  setRejectReason,
  handleRejectSubmission,
}: {
  rejectModalDoc: ApprovalDoc | null;
  setRejectModalDoc: (doc: ApprovalDoc | null) => void;
  rejectReason: string;
  setRejectReason: (val: string) => void;
  handleRejectSubmission: () => void;
}) {
  return (
    <Dialog open={!!rejectModalDoc} onOpenChange={open => !open && setRejectModalDoc(null)}>
      <DialogContent className="max-w-md p-4 sm:p-6 space-y-3">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
            봉사활동 계획서 접수 반려
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            선택한 봉사활동 계획서를 수합하지 않고 기안자에게 반려합니다.
          </DialogDescription>
        </DialogHeader>

        {rejectModalDoc && (
          <div className="bg-muted/30 p-3 rounded-lg border text-xs space-y-1">
            <div><b>제목:</b> {rejectModalDoc.title}</div>
            <div><b>신청자:</b> {rejectModalDoc.requesterName} ({rejectModalDoc.requesterEmail})</div>
            <div><b>신청일:</b> {rejectModalDoc.createdAt ? format(new Date(rejectModalDoc.createdAt), 'yyyy-MM-dd') : '-'}</div>
          </div>
        )}

        <div>
          <Label className="text-xs font-bold">반려 사유</Label>
          <Textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="반려 사유를 구체적으로 입력하세요 (신청자에게 전달됩니다)"
            rows={3}
            className="text-xs mt-1"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRejectModalDoc(null)}
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="font-bold"
            onClick={handleRejectSubmission}
          >
            반려 확정
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
