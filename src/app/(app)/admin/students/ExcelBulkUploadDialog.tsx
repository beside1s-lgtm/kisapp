'use client';

import type { RefObject } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';

/**
 * "엑셀 일괄 등록" 모달 (양식 다운로드 + 업로드 트리거).
 *
 * admin/students/page.tsx의 (제어되지 않은) Dialog 블록을 그대로
 * 옮긴 것으로, 실제 파싱/미리보기 로직은 전부 부모(page.tsx)에 남아
 * 있고 이 컴포넌트는 순수하게 마크업만 담당한다 (동작 변경 없음).
 */
export interface ExcelBulkUploadDialogProps {
  isLoading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onDownloadTemplate: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ExcelBulkUploadDialog({
  isLoading,
  fileInputRef,
  onDownloadTemplate,
  onFileUpload,
}: ExcelBulkUploadDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          className="h-8 text-xs px-2.5 font-bold whitespace-nowrap"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {isLoading ? '분석 중...' : '엑셀 일괄 등록'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Upload className="h-4 w-4 text-indigo-600" /> 엑셀 학생 일괄 등록
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            양식을 다운로드하여 작성한 후 업로드하면, 방과후 수강 현황과 스쿨버스 노선 연동 여부를 미리보기로 확인 후 최종 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Step 1: 양식 다운로드 */}
          <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
            <p className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> 1단계: 등록 양식 다운로드
            </p>
            <p className="text-[11px] text-indigo-700 leading-relaxed">
              <strong>학년 / 반 / 번호 / 이름 / 영문이름(선택) / 성별 / 계정(이메일) / 학부모 연락처(선택)</strong> 항목으로 구성된 양식입니다.
              이메일 계정은 <span className="font-mono bg-indigo-100 px-1 rounded">2023kangdongyun@kshcm.net</span> 형식을 따라야 합니다.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={onDownloadTemplate}
              className="w-full h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> 학생 일괄 등록 양식 (.xlsx) 다운로드
            </Button>
          </div>

          {/* Step 2: 파일 업로드 */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> 2단계: 작성된 파일 업로드
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              파일 업로드 시 방과후 수강 현황 및 스쿨버스 노선 연동 여부를 자동 조회하여 미리보기를 표시합니다.
            </p>
            <Input
              type="file"
              ref={fileInputRef}
              onChange={onFileUpload}
              accept=".xlsx, .xls"
              disabled={isLoading}
              className="text-xs h-9 cursor-pointer"
            />
            {isLoading && (
              <p className="text-xs text-indigo-600 font-medium animate-pulse">
                방과후 및 버스 데이터 연동 조회 중...
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
