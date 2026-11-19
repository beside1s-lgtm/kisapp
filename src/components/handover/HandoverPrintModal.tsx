'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, ExternalLink } from 'lucide-react';
import { HandoverDocument } from '@/lib/types/handover';
import { generateHandoverA4Html, withResolvedHandoverSignatures } from '@/lib/services/handoverService';

interface HandoverPrintModalProps {
  document: HandoverDocument;
}

export function HandoverPrintModal({ document }: HandoverPrintModalProps) {
  const handlePrint = async () => {
    // 팝업 차단을 피하려고 창은 클릭 즉시 열고, 등록 서명 조회 후 내용을 채운다
    const printWindow = window.open('', '_blank', 'width=850,height=1000');
    if (!printWindow) {
      alert('팝업 차단이 감지되었습니다. 팝업 허용 후 다시 시도해 주세요.');
      return;
    }
    const html = generateHandoverA4Html(await withResolvedHandoverSignatures(document));

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    // 팝업 로딩 후 자동 인쇄 다이얼로그 호출
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 250);
    };
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handlePrint}
      className="h-8 text-xs font-bold border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 shadow-2xs gap-1.5"
      title="A4 규격 인쇄 및 PDF 저장"
    >
      <Printer className="w-3.5 h-3.5 text-indigo-600" />
      <span>A4 인쇄 / PDF</span>
    </Button>
  );
}
