'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  UploadCloud,
  FileText,
  ExternalLink,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  File,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  Download,
  HardDrive
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getGoogleDriveConfig } from '@/lib/services/settingsService';
import type { GoogleDriveConfig } from '@/lib/types';
import { cn } from '@/lib/utils';

interface GradeMaterialsTabProps {
  classKey: string;
  classLabel?: string;
  userEmail?: string;
}

interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  size: number;
  modifiedTime?: string;
  isFolder: boolean;
}

const GRADE_LIST = [
  { key: '1', label: '1학년' },
  { key: '2', label: '2학년' },
  { key: '3', label: '3학년' },
  { key: '4', label: '4학년' },
  { key: '5', label: '5학년' },
  { key: '6', label: '6학년' },
];

/**
 * 학급 키에서 숫자 학년(1~6) 추출
 */
function extractGradeFromClassKey(key: string): string {
  if (!key) return '1';
  const match = key.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (num >= 1 && num <= 6) return String(num);
  }
  return '1';
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string, fileName: string) {
  const lower = (fileName || '').toLowerCase();
  if (mimeType.includes('spreadsheet') || lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
    return <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />;
  }
  if (mimeType.includes('presentation') || lower.endsWith('.pptx') || lower.endsWith('.ppt')) {
    return <Presentation className="w-5 h-5 text-amber-600 shrink-0" />;
  }
  if (mimeType.includes('pdf') || lower.endsWith('.pdf')) {
    return <FileText className="w-5 h-5 text-rose-600 shrink-0" />;
  }
  if (mimeType.includes('image') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return <ImageIcon className="w-5 h-5 text-blue-600 shrink-0" />;
  }
  if (mimeType.includes('document') || lower.endsWith('.docx') || lower.endsWith('.hwp')) {
    return <FileText className="w-5 h-5 text-indigo-600 shrink-0" />;
  }
  return <File className="w-5 h-5 text-slate-500 shrink-0" />;
}

export function GradeMaterialsTab({ classKey, classLabel }: GradeMaterialsTabProps) {
  const { toast } = useToast();
  const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // 현재 학년도 산출 (3월 기준)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentAcademicYear = String(currentMonth >= 3 ? currentYear : currentYear - 1);

  // 기본 선택 학년: classKey 기반
  const initialGrade = extractGradeFromClassKey(classKey);
  const [selectedGrade, setSelectedGrade] = useState<string>(initialGrade);

  // 파일 목록 상태
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // 업로드 상태
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Drive 설정 로드
  const loadConfig = useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const cfg = await getGoogleDriveConfig();
      setDriveConfig(cfg);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // classKey가 바뀌면 해당 학년으로 자동 전환
  useEffect(() => {
    setSelectedGrade(extractGradeFromClassKey(classKey));
  }, [classKey]);

  // 현재 선택된 학년의 Drive 폴더 정보
  const currentYearData = driveConfig?.yearlyFolders?.[currentAcademicYear]
    || (driveConfig?.yearlyFolders ? Object.values(driveConfig.yearlyFolders)[0] : undefined);

  const gradeFolderInfo = currentYearData?.gradeSubFolders?.[selectedGrade];
  const gradeFolderId = gradeFolderInfo?.id;
  const gradeFolderUrl = gradeFolderInfo?.url;

  // 파일 목록 조회
  const fetchFiles = useCallback(async () => {
    if (!gradeFolderId) {
      setFiles([]);
      return;
    }
    setIsLoadingFiles(true);
    try {
      const res = await fetch(`/api/drive/list-files?folderId=${encodeURIComponent(gradeFolderId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        setFiles(data.files);
      } else {
        setFiles([]);
      }
    } catch (err) {
      console.error(err);
      toast({ title: '파일 목록 조회 실패', description: 'Google Drive 목록을 가져오는 중 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setIsLoadingFiles(false);
    }
  }, [gradeFolderId, toast]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // 파일 업로드 처리
  const handleUploadFiles = async (fileList: FileList | File[]) => {
    if (!gradeFolderId) {
      toast({ title: '업로드 불가', description: '해당 학년의 Google Drive 폴더가 아직 생성되지 않았습니다.', variant: 'destructive' });
      return;
    }

    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const f of filesArray) {
      try {
        const formData = new FormData();
        formData.append('folderId', gradeFolderId);
        formData.append('file', f);

        const res = await fetch('/api/drive/upload-file', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        failCount++;
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast({
        title: '업로드 완료',
        description: `${successCount}개 파일이 ${selectedGrade}학년 Google Drive 폴더에 등록되었습니다.`
      });
      fetchFiles();
    }
    if (failCount > 0) {
      toast({
        title: '일부 파일 업로드 실패',
        description: `${failCount}개 파일 업로드에 실패했습니다.`,
        variant: 'destructive'
      });
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Google Drive 미설정 또는 미동기화 상태 처리
  if (!isLoadingConfig && (!driveConfig || !driveConfig.enabled || !driveConfig.rootFolderId)) {
    return (
      <Card className="rounded-2xl border-slate-200 shadow-xs">
        <CardContent className="p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <HardDrive className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-base">Google Drive 중앙 저장소가 연동되지 않았습니다</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              학교 Google Workspace 드라이브 중앙 저장소 연동이 완료되면, 각 학년별 수업자료 폴더(1~6학년)가 자동 연결되어 파일을 공유하고 업로드할 수 있습니다.
            </p>
          </div>
          <p className="text-[11px] text-amber-700 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 inline-block">
            * 시스템 관리자 설정 메뉴에서 [Google Drive 중앙 저장소 연동]을 활성화해 주세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. 상단 학년 선택 및 Google Drive 바로가기 헤더 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-black text-slate-800">
                {currentAcademicYear}학년도 학년별 수업자료 공유소
              </h3>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-bold">
                05_학년별 수업자료 공유
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              담임 교사 및 동학년 교사들이 학년별 수업자료, 지도안, 학습지를 열람하고 Google Drive에 직접 업로드합니다.
            </p>
          </div>

          {/* Google Drive 원터치 새 창 열기 버튼 */}
          {gradeFolderUrl ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => window.open(gradeFolderUrl, '_blank')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 px-3.5 text-xs shadow-xs shrink-0 cursor-pointer gap-1.5"
            >
              <FolderOpen className="w-4 h-4" />
              <span>{selectedGrade}학년 Drive 폴더 열기</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </Button>
          ) : (
            <Badge variant="secondary" className="text-xs text-slate-400 font-medium py-1 px-2.5">
              폴더 동기화 필요
            </Badge>
          )}
        </div>

        {/* 학년 탭 선택 버튼 (1~6학년) */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 overflow-x-auto">
          <span className="text-xs font-bold text-slate-500 mr-1 shrink-0">학년 선택:</span>
          {GRADE_LIST.map((g) => {
            const isSelected = selectedGrade === g.key;
            const isMyClassGrade = initialGrade === g.key;
            return (
              <Button
                key={g.key}
                size="sm"
                variant={isSelected ? 'default' : 'outline'}
                onClick={() => setSelectedGrade(g.key)}
                className={cn(
                  "h-8 text-xs font-bold px-3 rounded-lg shrink-0 transition-all",
                  isSelected
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
              >
                <span>{g.label}</span>
                {isMyClassGrade && (
                  <span className={cn(
                    "ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-semibold",
                    isSelected ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"
                  )}>
                    내 학년
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* 2. 드래그 앤 드롭 파일 업로드 영역 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-6 text-center transition-all bg-white",
          dragOver ? "border-indigo-500 bg-indigo-50/50 scale-[0.99]" : "border-slate-300 hover:border-indigo-300",
          isUploading && "pointer-events-none opacity-60"
        )}
      >
        <input
          type="file"
          id="grade-material-file-input"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          disabled={!gradeFolderId || isUploading}
        />

        <div className="space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            ) : (
              <UploadCloud className="w-6 h-6 text-indigo-600" />
            )}
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-sm">
              {isUploading ? `${selectedGrade}학년 폴더에 파일 업로드 중...` : `${selectedGrade}학년 수업자료 파일 업로드`}
            </h4>
            <p className="text-xs text-slate-500">
              학습지, 지도안, 프레젠테이션(PPT), 문서, PDF, 이미지 등을 여기에 끌어다 놓으세요.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1">
            <label htmlFor="grade-material-file-input">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!gradeFolderId || isUploading}
                className="h-8 text-xs font-bold text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                onClick={() => document.getElementById('grade-material-file-input')?.click()}
              >
                <span>컴퓨터에서 파일 선택</span>
              </Button>
            </label>

            {gradeFolderUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => window.open(gradeFolderUrl, '_blank')}
                className="h-8 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                <span>Google Drive에서 직접 관리</span>
              </Button>
            )}
          </div>

          {!gradeFolderId && (
            <p className="text-[11px] text-amber-600 font-semibold">
              * 시스템 설정에서 Google Drive '표준 폴더 동기화'를 실행해야 업로드가 가능합니다.
            </p>
          )}
        </div>
      </div>

      {/* 3. 현재 학년 폴더 내 파일 목록 */}
      <Card className="rounded-2xl border-slate-200 shadow-xs">
        <CardHeader className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <CardTitle className="text-sm font-bold text-slate-800">
                {selectedGrade}학년 공유 자료 목록 ({files.length}개)
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchFiles}
              disabled={isLoadingFiles || !gradeFolderId}
              className="h-7 text-xs font-medium text-slate-500 hover:text-slate-800 gap-1"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoadingFiles && "animate-spin")} />
              <span>새로고침</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {isLoadingFiles ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="text-xs">Google Drive 자료 목록을 불러오는 중...</span>
            </div>
          ) : !gradeFolderId ? (
            <div className="py-12 text-center text-xs text-slate-400">
              해당 학년의 Google Drive 폴더가 아직 연동되지 않았습니다.
            </div>
          ) : files.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-500">등록된 수업자료가 없습니다.</p>
              <p>위 업로드 영역에 파일을 끌어다 놓거나 Google Drive에서 추가하세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="p-3 bg-slate-50/80 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition-all flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {getFileIcon(file.mimeType, file.name)}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-[10.5px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{formatFileSize(file.size)}</span>
                        {file.modifiedTime && (
                          <>
                            <span>·</span>
                            <span>{new Date(file.modifiedTime).toLocaleDateString('ko-KR')}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <span>열람</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
