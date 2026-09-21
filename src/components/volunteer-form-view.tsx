'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ApprovalDoc, VolunteerFormData } from '@/lib/types';
import { VolunteerDocumentPrint } from './volunteer-document-print';
import { Button } from '@/components/ui/button';
import { Printer, FileText, FileCheck } from 'lucide-react';

type VolunteerFormViewProps = {
  doc: ApprovalDoc;
  approverSignatures?: Record<string, string>;
};

export function VolunteerFormView({ doc, approverSignatures = {} }: VolunteerFormViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);
  const vData = (doc.volunteerFormData || doc.parentFormData || {}) as any;
  const hasReport = Boolean(vData.reportSubmitted || vData.type?.includes('report') || (doc as any).reportSubmitted);
  const [currentView, setCurrentView] = useState<'plan' | 'report'>(hasReport ? 'report' : 'plan');

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const targetWidth = 794; // 210mm in px
      if (containerWidth > 0 && containerWidth < targetWidth) {
        const availableWidth = Math.max(containerWidth - 12, 280);
        const newScale = Math.min(1, availableWidth / targetWidth);
        setScale(newScale);
      } else {
        setScale(1);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center w-full min-w-0" ref={containerRef}>
      {/* 상단 컨트롤 바 (확인서 전환 탭이 있는 경우에만 표시, 인쇄 시 숨김) */}
      {hasReport && (
        <div className="w-full max-w-[794px] flex items-center justify-start gap-1.5 mb-3 px-2 print:hidden">
          <Button
            size="sm"
            variant={currentView === 'plan' ? 'default' : 'outline'}
            className="h-8 text-xs font-bold"
            onClick={() => setCurrentView('plan')}
          >
            <FileText className="w-3.5 h-3.5 mr-1" />
            봉사활동 계획서
          </Button>
          <Button
            size="sm"
            variant={currentView === 'report' ? 'default' : 'outline'}
            className="h-8 text-xs font-bold"
            onClick={() => setCurrentView('report')}
          >
            <FileCheck className="w-3.5 h-3.5 mr-1" />
            봉사활동 확인서
          </Button>
        </div>
      )}

      {/* A4 서식 뷰 컨테이너 (모바일에서 축소 스케일링) */}
      <div
        className="w-full flex justify-center overflow-x-hidden"
        style={{
          minHeight: scale < 1 ? `${1123 * scale + 20}px` : 'auto',
          height: 'auto',
        }}
      >
        <div
          style={{
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'top center',
            width: '794px',
            minHeight: '1123px',
          }}
          className="bg-white shadow-md border rounded-sm print:shadow-none print:border-none mb-12"
        >
          <VolunteerDocumentPrint
            doc={doc}
            approverSignatures={approverSignatures}
            viewMode={currentView}
          />
        </div>
      </div>
    </div>
  );
}
