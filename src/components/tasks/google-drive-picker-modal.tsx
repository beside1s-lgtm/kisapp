'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  FileSpreadsheet, 
  FileText, 
  Presentation, 
  Folder, 
  ExternalLink, 
  Link2, 
  Plus, 
  Check,
  HardDrive
} from 'lucide-react';
import { parseGoogleDriveUrl, getDriveTypeInfo, GoogleDriveItemType } from '@/lib/services/googleDriveService';
import { getGoogleDriveConfig } from '@/lib/services/settingsService';
import type { TaskAttachment, GoogleDriveConfig } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface GoogleDrivePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (attachment: TaskAttachment) => void;
}

export function GoogleDrivePickerModal({
  open,
  onOpenChange,
  onSelect
}: GoogleDrivePickerModalProps) {
  const { toast } = useToast();
  const [driveUrl, setDriveUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig | null>(null);

  // 중앙 저장소 설정 로드
  useEffect(() => {
    if (open) {
      getGoogleDriveConfig().then(cfg => {
        if (cfg && cfg.enabled) {
          setDriveConfig(cfg);
        }
      });
      setDriveUrl('');
      setCustomName('');
    }
  }, [open]);

  const parsed = parseGoogleDriveUrl(driveUrl);
  const typeInfo = getDriveTypeInfo(parsed.fileType);

  const handleAdd = () => {
    if (!parsed.isValid) {
      toast({
        variant: 'destructive',
        title: '유효하지 않은 링크',
        description: '올바른 Google Drive 또는 Docs/Sheets 링크를 입력해주세요.'
      });
      return;
    }

    const finalName = customName.trim() || parsed.suggestedName || 'Google Drive 참고자료';

    onSelect({
      name: finalName,
      url: parsed.viewUrl,
      size: 0,
      type: `application/vnd.google-apps.${parsed.fileType}`,
      isGoogleDrive: true,
      driveFileType: parsed.fileType,
      driveFileId: parsed.fileId
    });

    toast({
      title: 'Google Drive 참고자료 연결 완료',
      description: `[${finalName}] 자료가 등록되었습니다.`
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 rounded-2xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
            <HardDrive className="w-5 h-5 text-indigo-600" />
            Google Drive 참고자료 연결
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            학교 Google Drive 또는 공유 드라이브의 문서, 스프레드시트, PDF 링크를 등록합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {/* 학교 중앙 저장소 바로가기 배너 */}
          {driveConfig && driveConfig.rootFolderUrl && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">{driveConfig.sharedDriveName || '학교 중앙 저장소'}</span>
                </p>
                <p className="text-[11px] text-indigo-700">학교 공용 드라이브에서 파일을 복사해오세요.</p>
              </div>
              <a
                href={driveConfig.rootFolderUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 text-xs font-bold bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-100 rounded-lg flex items-center gap-1 shrink-0 shadow-2xs"
              >
                <span>드라이브 열기</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* 구글 드라이브 링크 입력창 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-indigo-600" />
              Google Drive 공유 링크 (URL) *
            </Label>
            <Input
              placeholder="https://docs.google.com/... 또는 https://drive.google.com/..."
              value={driveUrl}
              onChange={e => setDriveUrl(e.target.value)}
              className="h-9 text-xs rounded-xl font-medium"
              autoFocus
            />
            <p className="text-[10.5px] text-slate-400">
              * 링크 공유 설정이 '호치민시한국국제학교(@kshcm.net) 뷰어/편집자'로 되어 있는지 확인해주세요.
            </p>
          </div>

          {/* 링크 감지 결과 및 미리보기 */}
          {driveUrl.trim() && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600">감지된 항목 유형:</span>
                {parsed.isValid ? (
                  <Badge className={`${typeInfo.badgeColor} text-[10px] font-bold px-2 py-0.5`}>
                    {typeInfo.label}
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px] font-bold px-2 py-0.5">
                    지원되지 않는 링크
                  </Badge>
                )}
              </div>

              {parsed.isValid && (
                <div className="flex items-center gap-2 pt-1 text-xs">
                  {parsed.fileType === 'sheet' && <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />}
                  {parsed.fileType === 'doc' && <FileText className="w-4 h-4 text-blue-600 shrink-0" />}
                  {parsed.fileType === 'slide' && <Presentation className="w-4 h-4 text-amber-600 shrink-0" />}
                  {parsed.fileType === 'folder' && <Folder className="w-4 h-4 text-indigo-600 shrink-0" />}
                  {parsed.fileType === 'pdf' && <FileText className="w-4 h-4 text-rose-600 shrink-0" />}
                  {parsed.fileType === 'file' && <HardDrive className="w-4 h-4 text-slate-600 shrink-0" />}
                  <span className="font-semibold text-slate-800 truncate">{parsed.suggestedName}</span>
                </div>
              )}
            </div>
          )}

          {/* 자료명 커스텀 입력 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">참고자료 표기 명칭 (선택)</Label>
            <Input
              placeholder={parsed.suggestedName ? `예: ${parsed.suggestedName}` : '예: 2026 스포츠데이 운영계획 Google 시트'}
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              className="h-9 text-xs rounded-xl"
            />
          </div>
        </div>

        <DialogFooter className="pt-2 border-t flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs text-slate-500"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={!parsed.isValid}
            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            참고자료로 등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
