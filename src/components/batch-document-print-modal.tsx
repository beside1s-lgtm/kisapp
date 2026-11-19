'use client';

import React, { useEffect, useState, useRef } from 'react';
import { buildStaffAuthHeaders } from '@/lib/staffApiHeaders';
import { ApprovalDoc } from '@/lib/types';
import { ParentFormView } from '@/components/parent-form-view';
import { getUserProfileByEmail } from '@/lib/services/userService';
import { Button } from '@/components/ui/button';
import { Printer, X, Loader2, FileText, UploadCloud, ExternalLink, CheckCircle2 } from 'lucide-react';
import { generateA4PdfBlob } from '@/lib/pdf-export';
import { getGoogleDriveConfig } from '@/lib/services/settingsService';
import { doc as firestoreDoc, updateDoc as firestoreUpdateDoc, serverTimestamp } from 'firebase/firestore';
import { getApprovalsCol } from '@/lib/services/documentService';
import { useToast } from '@/hooks/use-toast';

interface BatchDocumentPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: ApprovalDoc[];
  title: string;
  autoStartDriveSave?: boolean;
}

export function BatchDocumentPrintModal({
  isOpen,
  onClose,
  documents,
  title,
  autoStartDriveSave = false,
}: BatchDocumentPrintModalProps) {
  const { toast } = useToast();
  const [approverSignatures, setApproverSignatures] = useState<Record<string, string>>({});
  const [loadingSignatures, setLoadingSignatures] = useState(true);
  const printContainerRef = useRef<HTMLDivElement>(null);

  // 구글 드라이브 저장 진행 상태
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number; message: string }>({
    current: 0,
    total: 0,
    message: '',
  });
  const [lastFolderUrl, setLastFolderUrl] = useState<string | null>(null);
  const hasAutoStartedRef = useRef(false);

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

  // 구글 드라이브 일괄 저장 핸들러 (인쇄 서식과 100% 동일한 A4 PDF 생성)
  const handleSaveToDrive = async () => {
    if (!printContainerRef.current || documents.length === 0) return;

    setIsSavingToDrive(true);
    setSaveProgress({ current: 0, total: documents.length, message: 'Google Drive 설정 확인 중...' });

    try {
      const driveConfig = await getGoogleDriveConfig();
      const academicYear = '2026';
      const yearFolders = driveConfig.yearlyFolders?.[academicYear];

      let successCount = 0;
      let failCount = 0;
      let folderUrl = '';

      for (let i = 0; i < documents.length; i++) {
        const docItem = documents[i];
        const pfd = (docItem.parentFormData || {}) as any;
        const isAbsence = pfd.type === 'absence';
        const isReport = pfd.type === 'field-trip-report';

        const docTypeLabel = isAbsence ? '결석계' : isReport ? '체험학습보고서' : '체험학습신청서';
        const studentInfo = pfd.gradeClassNumber ? `${pfd.gradeClassNumber} ` : '';
        const studentName = pfd.studentName || docItem.requesterName || '학생';
        const fileName = `[${docTypeLabel}] ${studentInfo}${studentName}.pdf`;

        // 타깃 폴더 ID 결정
        const targetFolderId = isAbsence
          ? yearFolders?.absenceDoneId
          : yearFolders?.fieldTripDoneId;

        if (isAbsence && yearFolders?.absenceDoneUrl) folderUrl = yearFolders.absenceDoneUrl;
        if (!isAbsence && yearFolders?.fieldTripDoneUrl) folderUrl = yearFolders.fieldTripDoneUrl;

        if (!targetFolderId) {
          throw new Error(`Google Drive '${isAbsence ? '결석계(완료)' : '체험학습신청서(완료)'}' 폴더가 설정되지 않았습니다. 시스템 설정의 조직도(부서 관리) 또는 일반 탭에서 드라이브 동기화를 먼저 진행해주세요.`);
        }

        setSaveProgress({
          current: i + 1,
          total: documents.length,
          message: `[${i + 1}/${documents.length}] ${studentName} 학생 ${docTypeLabel} A4 출력물 캡처 중...`,
        });

        // 1. 해당 문서의 렌더링 엘리먼트 찾기
        const docWrapper = printContainerRef.current.querySelector(`[data-doc-id="${docItem.id}"]`) as HTMLElement;
        let sheetElements: HTMLElement[] = [];
        if (docWrapper) {
          sheetElements = Array.from(docWrapper.querySelectorAll('.a4-print-sheet')) as HTMLElement[];
          if (sheetElements.length === 0) {
            sheetElements = [docWrapper];
          }
        }

        if (sheetElements.length === 0) {
          console.warn(`[SaveToDrive] 문서 ${docItem.id}의 출력 요소를 찾을 수 없어 건너뜁니다.`);
          failCount++;
          continue;
        }

        // 2. 화면에 렌더링된 출력물 그대로 A4 PDF Blob 생성
        const pdfBlob = await generateA4PdfBlob(sheetElements, (msg) => {
          setSaveProgress(prev => ({ ...prev, message: `[${i + 1}/${documents.length}] ${msg}` }));
        });

        // 3. Google Drive 업로드 API 호출
        setSaveProgress(prev => ({
          ...prev,
          message: `[${i + 1}/${documents.length}] Google Drive 업로드 중...`,
        }));

        const formData = new FormData();
        formData.append('file', pdfBlob, fileName);
        formData.append('folderId', targetFolderId);
        formData.append('fileName', fileName);

        const uploadRes = await fetch('/api/drive/upload-file', {
          method: 'POST',
          headers: await buildStaffAuthHeaders(),
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success) {
          throw new Error(uploadData.error || `${fileName} 업로드 실패`);
        }

        // 4. Firestore 문서 상태 업데이트
        try {
          const fileData = uploadData.file;
          await firestoreUpdateDoc(firestoreDoc(getApprovalsCol(), docItem.id), {
            driveArchived: true,
            driveFileId: fileData.id,
            driveWebViewLink: fileData.webViewLink,
            driveArchivedAt: serverTimestamp(),
          });
        } catch (dbErr) {
          console.warn(`[SaveToDrive] DB 상태 갱신 실패 (${docItem.id}):`, dbErr);
        }

        successCount++;
      }

      setLastFolderUrl(folderUrl);
      toast({
        title: 'Google Drive 저장 완료',
        description: `총 ${documents.length}건 중 ${successCount}건이 인쇄 출력물과 100% 동일한 A4 PDF로 Google Drive에 저장되었습니다.${failCount > 0 ? ` (실패 ${failCount}건)` : ''}`,
      });
    } catch (err: any) {
      console.error('[SaveToDrive] 전체 저장 오류:', err);
      toast({
        variant: 'destructive',
        title: 'Google Drive 저장 실패',
        description: err.message || '저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSavingToDrive(false);
      setSaveProgress({ current: 0, total: 0, message: '' });
    }
  };

  // autoStartDriveSave 옵션 동작
  useEffect(() => {
    if (autoStartDriveSave && !loadingSignatures && !hasAutoStartedRef.current && documents.length > 0) {
      hasAutoStartedRef.current = true;
      // 화면 렌더링 안정화 후 실행
      const timer = setTimeout(() => {
        handleSaveToDrive();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoStartDriveSave, loadingSignatures, documents]);

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
          {lastFolderUrl && (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(lastFolderUrl, '_blank')}
              className="h-9 px-3 text-xs font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1.5 shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Drive 폴더 열기</span>
            </Button>
          )}

          <Button
            type="button"
            onClick={handleSaveToDrive}
            disabled={loadingSignatures || isSavingToDrive}
            className="h-9 px-3.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs"
            title="현재 화면에 표시된 A4 인쇄 출력물 그대로 Google Drive에 PDF로 저장합니다"
          >
            {isSavingToDrive ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>저장 중 ({saveProgress.current}/{saveProgress.total})</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Google Drive에 저장 ({documents.length}건)</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            onClick={handlePrint}
            disabled={loadingSignatures || isSavingToDrive}
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

      {/* 구글 드라이브 실시간 진행 바 */}
      {isSavingToDrive && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-between text-xs text-emerald-800 shrink-0 animate-pulse">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
            <span className="font-semibold">{saveProgress.message}</span>
          </div>
          <div className="font-mono text-[11px] font-bold text-emerald-700">
            {saveProgress.current} / {saveProgress.total} 완료 ({Math.round((saveProgress.current / (saveProgress.total || 1)) * 100)}%)
          </div>
        </div>
      )}

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
                  data-doc-id={doc.id}
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
