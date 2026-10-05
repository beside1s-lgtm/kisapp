'use client';

import React, { useEffect, useState, useRef } from 'react';
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
  const printContainerRef = useRef<HTMLDivElement>(null);

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

  // [전역 표준] 독립 팝업 창 일괄 인쇄 (부모 레이아웃 간섭 0% 차단 & @media print page-break 보장)
  const handlePrint = () => {
    if (!printContainerRef.current) {
      window.print();
      return;
    }

    // 스타일 태그 수집
    let styleTags = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
      styleTags += el.outerHTML + '\n';
    });

    const printHtml = printContainerRef.current.innerHTML;
    const printWin = window.open('', '_blank', 'width=900,height=1000');

    if (printWin) {
      printWin.document.open();
      printWin.document.write(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <base href="${window.location.origin}/">
          <title>${title} (총 ${documents.length}건)</title>
          ${styleTags}
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 10mm 8mm 10mm;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", Roboto, sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color: #000000;
            }
            .batch-doc-item {
              box-sizing: border-box !important;
              width: 100% !important;
              page-break-after: always !important;
              break-after: page !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            .batch-doc-item:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            @media print {
              body {
                background: #ffffff !important;
              }
              .batch-doc-item {
                page-break-after: always !important;
                break-after: page !important;
              }
              .batch-doc-item:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
            }
          </style>
        </head>
        <body>
          ${printHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 400);
            };
          </script>
        </body>
        </html>
      `);
      printWin.document.close();
    } else {
      // 팝업 차단 시 화면 인쇄 fallback
      window.print();
    }
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
              각 문서 사이에 독립 페이지 구분이 적용되어 A4 단위로 깔끔하게 분리 인쇄됩니다.
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
            <span>일괄 인쇄 실행 ({documents.length}건)</span>
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
          <div ref={printContainerRef} className="space-y-6 print:space-y-0 max-w-[220mm] mx-auto print:max-w-none print:w-[210mm]">
            {documents.map((doc, index) => {
              const isLast = index === documents.length - 1;
              return (
                <div
                  key={doc.id}
                  className="batch-doc-item bg-white shadow-md rounded-xl p-2 sm:p-4 print:shadow-none print:p-0 print:rounded-none"
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
