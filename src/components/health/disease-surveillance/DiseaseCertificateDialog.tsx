'use client';

import React, { useRef, useState } from 'react';
import { FileCheck, Camera, X, Check, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DiseaseRecord } from '@/lib/services/healthService';
import { compressCertificateImage } from '@/lib/imageResize';

interface DiseaseCertificateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: DiseaseRecord | null;
  onUpdateCertificate: (record: DiseaseRecord, submitted: boolean, newUrl?: string) => Promise<void>;
}

export function DiseaseCertificateDialog({
  open,
  onOpenChange,
  record,
  onUpdateCertificate,
}: DiseaseCertificateDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!record) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const compressed = await compressCertificateImage(file);
      await onUpdateCertificate(record, true, compressed);
    } catch (err: any) {
      alert(err.message || '사진 처리에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleStatus = async (submitted: boolean) => {
    setIsProcessing(true);
    try {
      await onUpdateCertificate(record, submitted);
      onOpenChange(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <FileCheck className="w-5 h-5 text-indigo-600" />
            소견서 / 진단서 확인 및 직권 관리
          </DialogTitle>
          <DialogDescription className="text-xs">
            <span className="font-bold text-slate-800">
              [{record.grade}-{record.classNum}] {record.studentName} 학생
            </span>
            의 결석 증빙서류 확인 및 보건교사 직권 제출 여부 설정
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* 현재 상태 배지 */}
          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-600">현재 소견서 등록 상태:</span>
            {record.medicalCertificateSubmitted ? (
              <Badge className="bg-sky-600 text-white font-bold text-xs px-2 py-0.5">
                제출 완료
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-xs px-2 py-0.5">
                미제출
              </Badge>
            )}
          </div>

          {/* 소견서 이미지 뷰어 */}
          <div className="border rounded-xl p-2 bg-slate-50/50 flex flex-col items-center justify-center min-h-[180px]">
            {record.medicalCertificateUrl ? (
              <div className="space-y-2 text-center w-full">
                <div className="max-h-[300px] overflow-auto rounded-lg border bg-white p-1">
                  <img
                    src={record.medicalCertificateUrl}
                    alt="의사 소견서/진단서 사진"
                    className="max-h-[280px] mx-auto object-contain rounded"
                  />
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-7 text-xs gap-1 font-semibold"
                    disabled={isProcessing}
                  >
                    <Camera className="w-3.5 h-3.5 text-indigo-600" />
                    사진 교체 등록
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 px-4 space-y-2.5">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-700">첨부된 소견서 사진이 없습니다.</p>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    사진 서류가 없더라도 보건교사 직권으로 [제출 완료] 처리할 수 있습니다.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 text-xs gap-1 font-semibold bg-white"
                  disabled={isProcessing}
                >
                  <Camera className="w-3.5 h-3.5 text-indigo-600" />
                  소견서 사진 직접 첨부하기
                </Button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
          {record.medicalCertificateSubmitted ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={() => handleToggleStatus(false)}
              className="w-full sm:w-auto h-8 text-xs text-rose-600 border-rose-300 hover:bg-rose-50 font-bold"
            >
              미제출로 변경
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={isProcessing}
              onClick={() => handleToggleStatus(true)}
              className="w-full sm:w-auto h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              보건교사 직권 제출완료 처리
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto h-8 text-xs"
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
