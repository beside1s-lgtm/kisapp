'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Printer } from 'lucide-react';
import { VolunteerDocumentPrint } from '@/components/volunteer-document-print';
import type { ApprovalDoc } from '@/lib/types';

export function PrintPreviewDialog({
  previewDoc,
  setPreviewDoc,
}: {
  previewDoc: ApprovalDoc | null;
  setPreviewDoc: (doc: ApprovalDoc | null) => void;
}) {
  return (
    <Dialog open={!!previewDoc} onOpenChange={open => !open && setPreviewDoc(null)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center justify-between">
            <span>봉사활동 서식 인쇄 미리보기</span>
            <Button size="sm" onClick={() => window.print()} className="h-8 text-xs font-bold">
              <Printer className="w-3.5 h-3.5 mr-1" />
              인쇄하기
            </Button>
          </DialogTitle>
          <DialogDescription className="sr-only">
            봉사활동 서식 인쇄 미리보기 화면입니다.
          </DialogDescription>
        </DialogHeader>
        {previewDoc && (
          <div className="border rounded bg-white p-2">
            <VolunteerDocumentPrint doc={previewDoc} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
