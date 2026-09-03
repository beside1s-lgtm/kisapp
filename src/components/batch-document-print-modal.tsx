'use client';

import React, { useEffect, useState } from 'react';
import { ApprovalDoc } from '@/lib/types';
import { ParentFormView } from '@/components/parent-form-view';
import { getUserProfileByEmail } from '@/lib/services/userService';
import { Button } from '@/components/ui/button';
import { Printer, X, Loader2, FileText } from 'lucide-react';

interface BatchDocumentPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: ApprovalDoc[];
  title: string;
}

export function BatchDocumentPrintModal({
  isOpen,
  onClose,
  documents,
  title,
}: BatchDocumentPrintModalProps) {
  const [approverSignatures, setApproverSignatures] = useState<Record<string, string>>({});
  const [loadingSignatures, setLoadingSignatures] = useState(true);

  // 모든 선택된 문서의 결재자 서명 일괄 수집
  useEffect(() => {
    if (!isOpen || documents.length === 0) {
      setLoadingSignatures(false);
      return;
    }

    setLoadingSignatures(true);
    const emailSet = new Set<string>();
    documents.forEach((doc) => {
      doc.approvers?.forEach((ap) => {
        if (ap.email) emailSet.add(ap.email.trim().toLowerCase());
      });
    });

    const emails = Array.from(emailSet);
    if (emails.length === 0) {
      setLoadingSignatures(false);
      return;
    }

    Promise.all(emails.map((email) => getUserProfileByEmail(email)))
      .then((profiles) => {
        const sigs: Record<string, string> = {};
        profiles.forEach((p) => {
          if (p && p.signature && p.email) {
            sigs[p.email.trim().toLowerCase()] = p.signature;
          }
        });
        setApproverSignatures(sigs);
      })
      .catch((err) => console.error('[BatchPrint] 결재자 서명 로드 실패:', err))
      .finally(() => setLoadingSignatures(false));
  }, [isOpen, documents]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-slate-900/80 backdrop-blur-xs">
      {/* 상단 컨트롤 바 (인쇄 시 숨김) */}
      <div className="print:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-bold text-sm sm:text-base text-slate-900">
              {title} (총 {documents.length}건 선택)
            </h2>
            <p className="text-xs text-slate-500 hidden sm:block">
              A4 규격에 맞추어 각 문서가 순서대로 인쇄됩니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handlePrint}
            disabled={loadingSignatures}
            className="h-9 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-white flex items-center gap-1.5 shadow-sm"
          >
            {loadingSignatures ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            <span>인쇄 실행</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 px-3 text-xs font-bold border-slate-300 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">닫기</span>
          </Button>
        </div>
      </div>

      {/* 인쇄 영역 및 스크롤 뷰어 */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-6 bg-slate-100 print:bg-white print:p-0 print:overflow-visible">
        {loadingSignatures ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">직인 및 서명 정보를 불러오는 중입니다...</p>
          </div>
        ) : (
          <div className="space-y-6 print:space-y-0 max-w-[220mm] mx-auto print:max-w-none print:w-[210mm]">
            {documents.map((doc, index) => {
              const isLast = index === documents.length - 1;
              return (
                <div
                  key={doc.id}
                  className="bg-white shadow-md rounded-xl p-2 sm:p-4 print:shadow-none print:p-0 print:rounded-none"
                  style={{
                    breakAfter: isLast ? 'auto' : 'page',
                    pageBreakAfter: isLast ? 'auto' : 'always',
                  }}
                >
                  <ParentFormView
                    doc={doc}
                    approverSignatures={approverSignatures}
                    isParentPortal={false}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
