'use client';

import React, { useState } from 'react';
import { ApprovalDoc } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Image as ImageIcon, ExternalLink, Download, Eye, Paperclip, AlertCircle } from 'lucide-react';
import { openFileInNewTab } from '@/lib/utils';
import { AttachmentViewerModal, EvidenceAttachmentItem } from './AttachmentViewerModal';

/**
 * 결재 문서 내 모든 첨부파일 및 학부모 결석계 증빙서류를 누락 없이 전수 추출하는 헬퍼
 */
export function extractAllEvidenceAttachments(doc: ApprovalDoc): EvidenceAttachmentItem[] {
  const result: EvidenceAttachmentItem[] = [];
  const seenUrls = new Set<string>();

  const detectType = (name: string, dataUrl: string): 'pdf' | 'image' | 'file' => {
    const lowerName = (name || '').toLowerCase();
    const lowerData = (dataUrl || '').toLowerCase();
    if (lowerName.endsWith('.pdf') || lowerData.includes('application/pdf')) {
      return 'pdf';
    }
    if (
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.webp') ||
      lowerName.endsWith('.gif') ||
      lowerData.startsWith('data:image/') ||
      lowerData.includes('/image%2f') ||
      lowerData.includes('.jpg') ||
      lowerData.includes('.png') ||
      lowerData.includes('.jpeg')
    ) {
      return 'image';
    }
    return 'file';
  };

  const calculateFormattedSize = (size?: number, dataStr?: string): string => {
    let bytes = size;
    if (!bytes && dataStr && dataStr.startsWith('data:')) {
      // Base64 데이터 크기 추정: 문자열 길이 * 3/4
      const base64Len = dataStr.split(',')[1]?.length || dataStr.length;
      bytes = Math.round((base64Len * 3) / 4);
    }
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addItem = (name: string, dataOrUrl: string, size?: number) => {
    if (!dataOrUrl || typeof dataOrUrl !== 'string') return;
    const cleanUrl = dataOrUrl.trim();
    if (!cleanUrl || seenUrls.has(cleanUrl)) return;
    seenUrls.add(cleanUrl);

    const type = detectType(name, cleanUrl);
    const formattedSize = calculateFormattedSize(size, cleanUrl);

    result.push({
      name: name || (type === 'pdf' ? '결석계_증빙서류.pdf' : '결석계_증빙서류.jpg'),
      data: cleanUrl,
      size,
      type,
      formattedSize: formattedSize || undefined,
    });
  };

  // 1. 문서 루트의 attachments 검사
  if (Array.isArray(doc.attachments)) {
    doc.attachments.forEach((att: any) => {
      if (att) {
        const fileData = att.data || att.url || att.downloadUrl || att.fileUrl;
        if (fileData) addItem(att.name || '첨부파일', fileData, att.size);
      }
    });
  }

  // 2. parentFormData 내부의 attachments 검사
  const pData = doc.parentFormData as any;
  if (pData && Array.isArray(pData.attachments)) {
    pData.attachments.forEach((att: any) => {
      if (att) {
        const fileData = att.data || att.url || att.downloadUrl || att.fileUrl;
        if (fileData) addItem(att.name || '증빙서류', fileData, att.size);
      }
    });
  }

  // 3. medicalCertificateUrl 단일 필드 검사 (하위 호환성)
  if (pData?.medicalCertificateUrl) {
    addItem(pData.medicalCertificateName || '소견서_진단서.jpg', pData.medicalCertificateUrl, pData.medicalCertificateSize);
  }

  // 4. doc 루트의 medicalCertificateUrl 검사
  if ((doc as any).medicalCertificateUrl) {
    addItem((doc as any).medicalCertificateName || '소견서_진단서.jpg', (doc as any).medicalCertificateUrl);
  }

  return result;
}

interface EvidenceAttachmentSectionProps {
  doc: ApprovalDoc;
  hasPermission: boolean;
  onDownload: (file: { name: string; data: string }) => void;
  className?: string;
}

export function EvidenceAttachmentSection({
  doc,
  hasPermission,
  onDownload,
  className = '',
}: EvidenceAttachmentSectionProps) {
  const [selectedAttachment, setSelectedAttachment] = useState<EvidenceAttachmentItem | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const attachments = extractAllEvidenceAttachments(doc);
  const isAbsenceDoc = doc.docType === 'parent' && doc.parentFormData?.type === 'absence';

  if (!hasPermission) return null;
  if (attachments.length === 0 && !isAbsenceDoc) return null;

  const handleOpenViewer = (att: EvidenceAttachmentItem) => {
    setSelectedAttachment(att);
    setIsViewerOpen(true);
  };

  return (
    <>
      <div className={`print:hidden rounded-xl border border-indigo-200/90 bg-indigo-50/50 p-4 shadow-sm space-y-3 ${className}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                <span>{isAbsenceDoc ? '결석계 첨부 증빙서류 (병원 소견서·진단서·처방전)' : '문서 첨부파일'}</span>
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 border-indigo-200 text-xs px-2 py-0.5">
                  총 {attachments.length}건
                </Badge>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isAbsenceDoc 
                  ? '결재선에 있는 교직원은 진단서 원본 이미지 및 PDF 문서를 바로 확인하거나 다운로드할 수 있습니다.' 
                  : '등록된 첨부파일을 미리보거나 다운로드할 수 있습니다.'}
              </p>
            </div>
          </div>
        </div>

        {attachments.length === 0 ? (
          <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-indigo-100 text-xs text-slate-600">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>학부모가 제출한 첨부 증빙서류(진단서/소견서)가 없습니다. (미첨부 결석계)</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {attachments.map((file, idx) => {
              const isPdf = file.type === 'pdf';
              const isImage = file.type === 'image';

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200/90 hover:border-indigo-300 hover:shadow-xs transition-all gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isPdf
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : isImage
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'bg-slate-50 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {isPdf ? (
                        <FileText className="w-4 h-4" />
                      ) : isImage ? (
                        <ImageIcon className="w-4 h-4" />
                      ) : (
                        <Paperclip className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate" title={file.name}>
                        {file.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                        <span className="uppercase font-semibold text-slate-600">
                          {isPdf ? 'PDF 문서' : isImage ? '이미지' : '파일'}
                        </span>
                        {file.formattedSize && (
                          <>
                            <span>·</span>
                            <span className="font-mono">{file.formattedSize}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* 미리보기 버튼 */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenViewer(file)}
                      className="h-8 px-2 text-xs font-semibold text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1"
                      title="뷰어로 바로보기"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">미리보기</span>
                    </Button>

                    {/* 새 탭 열기 버튼 */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openFileInNewTab(file.data, file.name)}
                      className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900"
                      title="새 탭에서 열기"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>

                    {/* 다운로드 버튼 */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDownload(file)}
                      className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900"
                      title="다운로드"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 첨부파일 통합 팝업 뷰어 */}
      <AttachmentViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        attachment={selectedAttachment}
        onDownload={onDownload}
      />
    </>
  );
}
