'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Download, FileText, Image as ImageIcon, X } from 'lucide-react';
import { openFileInNewTab } from '@/lib/utils';

export interface EvidenceAttachmentItem {
  name: string;
  data: string; // Base64 data: URL 또는 Firebase Storage https: URL
  size?: number;
  type: 'pdf' | 'image' | 'file';
  formattedSize?: string;
}

interface AttachmentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: EvidenceAttachmentItem | null;
  onDownload?: (att: EvidenceAttachmentItem) => void;
}

export function AttachmentViewerModal({
  isOpen,
  onClose,
  attachment,
  onDownload,
}: AttachmentViewerModalProps) {
  if (!attachment) return null;

  const isPdf = attachment.type === 'pdf';
  const isImage = attachment.type === 'image';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden bg-white rounded-2xl shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isPdf ? 'bg-rose-100 text-rose-700' : isImage ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
            }`}>
              {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-slate-900 truncate">
                {attachment.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-mono mt-0.5">
                {attachment.formattedSize ? `파일 용량: ${attachment.formattedSize}` : '첨부 증빙서류 원본 뷰어'}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openFileInNewTab(attachment.data, attachment.name)}
              className="h-8 text-xs font-semibold gap-1 text-slate-700 hover:text-slate-900"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">새 탭에서 열기</span>
            </Button>
            {onDownload && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => onDownload(attachment)}
                className="h-8 text-xs font-semibold gap-1 bg-primary text-white"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">다운로드</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* 뷰어 본체 */}
        <div className="flex-1 min-h-[300px] max-h-[calc(92vh-120px)] overflow-auto bg-slate-100 rounded-xl p-2 sm:p-4 flex items-center justify-center relative">
          {isPdf ? (
            <div className="w-full h-full min-h-[500px] flex flex-col">
              <iframe
                src={attachment.data}
                title={attachment.name}
                className="w-full h-full min-h-[500px] rounded-lg bg-white border border-slate-200"
              />
            </div>
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
              <img
                src={attachment.data}
                alt={attachment.name}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
              />
            </div>
          ) : (
            <div className="text-center p-8 space-y-3">
              <FileText className="w-12 h-12 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                미리보기를 지원하지 않는 파일 형식입니다.
              </p>
              {onDownload && (
                <Button
                  onClick={() => onDownload(attachment)}
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  파일 다운로드
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
