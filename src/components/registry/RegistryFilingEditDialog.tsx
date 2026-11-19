'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FolderOpen, Loader2 } from 'lucide-react';
import type { ApprovalDoc } from '@/lib/types';
import type { DriveFilingFolderOption } from '@/lib/drive/deptFolderMapping';
import { updateApprovedDocFilingFolder } from '@/lib/services/documentService';

interface RegistryFilingEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docItem: ApprovalDoc | null;
  filingOptions: DriveFilingFolderOption[];
  driveEnabled: boolean;
  onSaved: (docId: string, updatedFields: Partial<ApprovalDoc>) => void;
}

/**
 * 이미 결재 완료된 문서의 편철(저장) 폴더를 지정하거나 수정하는 다이얼로그.
 */
export function RegistryFilingEditDialog({
  open,
  onOpenChange,
  docItem,
  filingOptions,
  driveEnabled,
  onSaved,
}: RegistryFilingEditDialogProps) {
  const { toast } = useToast();
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [alsoArchiveToDrive, setAlsoArchiveToDrive] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !docItem) return;
    const matched = filingOptions.find(
      (opt) =>
        (docItem.driveTargetFolderId && opt.folderId === docItem.driveTargetFolderId) ||
        (docItem.driveTargetFolderLabel && opt.label === docItem.driveTargetFolderLabel) ||
        (docItem.driveTargetDeptName &&
          docItem.driveTargetTaskName &&
          opt.deptName === docItem.driveTargetDeptName &&
          opt.folderName === docItem.driveTargetTaskName)
    );
    setSelectedValue(matched?.value || filingOptions[0]?.value || '');
    setAlsoArchiveToDrive(Boolean(driveEnabled && !docItem.driveFileId));
  }, [open, docItem, filingOptions, driveEnabled]);

  const handleSave = async () => {
    if (!docItem) return;
    const chosen = filingOptions.find((o) => o.value === selectedValue);
    if (!chosen) {
      toast({ variant: 'destructive', description: '편철할 저장 문서함을 선택해 주세요.' });
      return;
    }

    setSaving(true);
    try {
      const res = await updateApprovedDocFilingFolder({
        docData: docItem,
        folderId: chosen.folderId,
        folderUrl: chosen.folderUrl,
        folderLabel: chosen.label,
        deptName: chosen.deptName,
        folderName: chosen.folderName,
        alsoArchiveToDrive: driveEnabled && alsoArchiveToDrive,
      });

      onSaved(docItem.id, res.updatedFields);
      if (res.archiveError) {
        toast({
          variant: 'destructive',
          title: '편철 폴더 지정 완료 (Drive 저장 일부 실패)',
          description: `문서함은 '${chosen.label}'(으)로 지정되었으나 Google Drive PDF 업로드 중 오류가 발생했습니다: ${res.archiveError}`,
        });
      } else if (res.driveArchived) {
        toast({
          title: '편철 폴더 지정 및 Drive 저장 완료',
          description: `'${chosen.label}' 문서함에 지정되고 Google Drive에도 결재완료 PDF가 저장되었습니다.`,
        });
      } else {
        toast({
          title: '편철 폴더 지정 완료',
          description: `문서가 '${chosen.label}' 문서함으로 편철되었습니다.`,
        });
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error('[RegistryFilingEditDialog] save error:', err);
      toast({
        variant: 'destructive',
        title: '폴더 지정 실패',
        description:
          err?.message || '문서의 편철 폴더를 수정하는 중 오류가 발생했습니다. 권한을 확인해 주세요.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!docItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <FolderOpen className="w-4 h-4 text-indigo-600" />
            <span>결재 완료 문서 편철 폴더 지정</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            기존에 저장 문서함이 지정되지 않은 결재 문서를 부서/업무별 편철 폴더로 분류합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10.5px] font-mono bg-white">
                {docItem.docNo || '문서번호 없음'}
              </Badge>
              {docItem.isFaceToFace && (
                <Badge variant="outline" className="text-[10.5px] bg-amber-50 text-amber-800 border-amber-300">
                  대면결재
                </Badge>
              )}
              <span className="text-[11px] text-slate-500">기안자: {docItem.requesterName}</span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-900 break-words">
              {docItem.title}
            </p>
            <p className="text-[11px] text-slate-500">
              현재 편철 상태:{' '}
              <span className="font-semibold text-slate-700">
                {docItem.driveTargetFolderLabel ||
                  (docItem.driveTargetDeptName && docItem.driveTargetTaskName
                    ? `${docItem.driveTargetDeptName} > ${docItem.driveTargetTaskName}`
                    : '미지정 / 폴더 없음')}
              </span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-800">
              편철 저장 문서함 <span className="text-destructive">*</span>
            </Label>
            {filingOptions.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2.5">
                선택 가능한 편철 폴더 목록이 없습니다. 시스템 설정 &gt; Google Drive에서 폴더 동기화를 먼저 실행해 주세요.
              </p>
            ) : (
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger className="h-9 text-xs sm:text-sm bg-white">
                  <SelectValue placeholder="편철할 부서/업무 폴더를 선택하세요" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {filingOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs sm:text-sm">
                      {opt.label}
                      {opt.isVirtual ? ' (자동 생성)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {driveEnabled && (
            <label className="flex items-start gap-2 text-xs text-slate-700 bg-indigo-50/50 border border-indigo-200/80 rounded-lg p-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={alsoArchiveToDrive}
                onChange={(e) => setAlsoArchiveToDrive(e.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                선택한 Google Drive 편철 폴더로 결재완료문서 PDF 사본도 함께 저장합니다.
              </span>
            </label>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="h-8 text-xs"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || filingOptions.length === 0 || !selectedValue}
            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>편철 폴더 저장</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
