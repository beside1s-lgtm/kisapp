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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Paperclip, Send, Sparkles, Trash2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Attachment, OrgStructure } from '@/lib/types';
import type {
  CustomDutyModuleKey,
  CustomDutyWorkspace,
} from '@/lib/types/customDuty';
import {
  submitCustomFeatureUpgradeRequest,
  uploadCustomDutyAttachmentFile,
} from '@/lib/services/customDutyService';
import { formatAttachmentSize } from './attachmentDownloadHelper';

interface FeatureUpgradeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: CustomDutyWorkspace;
  userEmail: string;
  userName: string;
  org?: Partial<OrgStructure> | null;
  onSubmitted?: () => void;
}

const MODULE_OPTIONS: Array<{ key: CustomDutyModuleKey; label: string; desc: string }> = [
  { key: 'custom_table', label: '데이터 취합/관리 표', desc: '대상자 명단·진행 현황 입력, 검색 및 엑셀 다운로드' },
  { key: 'checklist', label: '연간 추진 체크리스트', desc: '시기별 업무 점검 항목 및 완료율 추적' },
  { key: 'approval_history', label: '관련 결재문서 자동 연동', desc: '이 업무명으로 기안·결재 완료된 공문서 자동 모아보기' },
];

export function FeatureUpgradeRequestDialog({
  open,
  onOpenChange,
  workspace,
  userEmail,
  userName,
  org,
  onSubmitted,
}: FeatureUpgradeRequestDialogProps) {
  const { toast } = useToast();
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [desiredModules, setDesiredModules] = useState<CustomDutyModuleKey[]>([
    'custom_table',
    'checklist',
    'approval_history',
  ]);
  const [desiredColumnsText, setDesiredColumnsText] = useState('');
  const [extraAttachments, setExtraAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRequestTitle(`[${workspace.dutyName}] 업무기능 추가 및 시스템 업그레이드 요청`);
    setRequestDescription('');
    setDesiredColumnsText(
      workspace.customTableColumns?.join(', ') ||
        '구분, 대상자/항목명, 연락처/소속, 진행상태, 비고'
    );
    setExtraAttachments([]);
  }, [open, workspace.dutyName, workspace.customTableColumns]);

  const toggleModule = (modKey: CustomDutyModuleKey) => {
    setDesiredModules((prev) =>
      prev.includes(modKey) ? prev.filter((k) => k !== modKey) : [...prev, modKey]
    );
  };

  const handleUploadExtra = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files)) {
        const res = await uploadCustomDutyAttachmentFile(file, `${workspace.id}/requests`);
        uploaded.push(res.attachment);
      }
      setExtraAttachments((prev) => [...prev, ...uploaded]);
      toast({
        title: '파일 첨부 완료',
        description: `${uploaded.length}개의 문서가 요청서에 첨부되었습니다.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '첨부 실패',
        description: err?.message || '파일 업로드 중 오류가 발생했습니다.',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!requestTitle.trim()) {
      toast({ variant: 'destructive', title: '제목 필요', description: '요청 제목을 입력하세요.' });
      return;
    }
    if (!requestDescription.trim()) {
      toast({ variant: 'destructive', title: '내용 필요', description: '필요한 업무기능 설명을 입력하세요.' });
      return;
    }

    setSubmitting(true);
    try {
      const combinedAttachments = [
        ...(workspace.referenceFiles || []),
        ...extraAttachments,
      ];

      await submitCustomFeatureUpgradeRequest({
        dutyName: workspace.dutyName,
        deptName: workspace.deptName,
        requesterEmail: userEmail,
        requesterName: userName,
        requestTitle: requestTitle.trim(),
        requestDescription: requestDescription.trim(),
        desiredModules,
        desiredColumnsText,
        uploadedDocs: workspace.standardDocs || [],
        attachments: combinedAttachments,
        org,
      });

      toast({
        title: '업무기능 추가 요청 발송 완료',
        description: '시스템 담당자가 포털 접속 시 알림 팝업을 받아 업로드한 서류를 검토하고 기능을 업그레이드합니다.',
      });
      onSubmitted?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '요청 전송 실패',
        description: err?.message || '업무기능 요청 전송 중 오류가 발생했습니다.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[660px] max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-5 py-4 border-b bg-indigo-50/60 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-slate-900">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>시스템 담당자에게 업무기능 추가 요청</span>
            <Badge className="bg-indigo-600 text-white text-[10px] font-bold">
              {workspace.dutyName}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600">
            등록된 표준 기안문서와 붙임문서를 함께 전송하여 시스템 담당자가 맞춤 업무기능으로 업그레이드할 수 있도록 요청합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 font-medium">요청 업무:</span>{' '}
              <strong className="text-slate-900">{workspace.dutyName}</strong>
              {workspace.deptName && (
                <span className="text-slate-500 ml-1">({workspace.deptName})</span>
              )}
            </div>
            <div>
              <span className="text-slate-500 font-medium">요청자:</span>{' '}
              <strong className="text-slate-900">{userName}</strong>{' '}
              <span className="text-slate-400">({userEmail})</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-800">요청 제목 *</Label>
            <Input
              value={requestTitle}
              onChange={(e) => setRequestTitle(e.target.value)}
              className="h-9 text-sm font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-800">필요한 업무기능 및 상세 요청 내용 *</Label>
            <Textarea
              value={requestDescription}
              onChange={(e) => setRequestDescription(e.target.value)}
              rows={4}
              placeholder="예: 신입생 입학원서 접수 현황을 온라인으로 취합하고, 면접 일정/준비물 체크리스트 및 모집요강·합격통지 공문을 바로 기안할 수 있는 기능이 필요합니다."
              className="text-xs leading-relaxed"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-800">희망 기능 모듈 선택</Label>
            <div className="grid grid-cols-1 gap-2">
              {MODULE_OPTIONS.map((opt) => {
                const checked = desiredModules.includes(opt.key);
                return (
                  <label
                    key={opt.key}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleModule(opt.key)}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-900 block">{opt.label}</span>
                      <span className="text-[11px] text-slate-500 block">{opt.desc}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {desiredModules.includes('custom_table') && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">희망 데이터 표 항목 (쉼표로 구분)</Label>
              <Input
                value={desiredColumnsText}
                onChange={(e) => setDesiredColumnsText(e.target.value)}
                placeholder="예: 수험번호, 학생명, 생년월일, 보호자연락처, 지원과정, 상태"
                className="h-8 text-xs"
              />
            </div>
          )}

          <div className="space-y-2 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-xs font-bold text-slate-800">
                함께 전달될 표준 기안문서({workspace.standardDocs.length}건) 및 붙임파일({(workspace.referenceFiles?.length || 0) + extraAttachments.length}건)
              </Label>
              <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-bold cursor-pointer">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>{uploading ? '업로드 중...' : '요청 첨부파일 추가'}</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={handleUploadExtra}
                />
              </label>
            </div>

            {workspace.standardDocs.length === 0 &&
            (workspace.referenceFiles?.length || 0) === 0 &&
            extraAttachments.length === 0 ? (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                아직 첨부된 표준 기안문서나 붙임문서가 없습니다. 표준 서식이나 참고 양식을 업로드하면 시스템 담당자가 더 정확하게 기능을 구축할 수 있습니다.
              </p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {workspace.standardDocs.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white border border-indigo-100"
                  >
                    <span className="font-semibold text-indigo-900 truncate">
                      [표준 기안] {d.title} (붙임 {d.attachments?.length || 0}건)
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0">자동 포함</Badge>
                  </div>
                ))}
                {(workspace.referenceFiles || []).map((f, idx) => (
                  <div
                    key={`ref_${idx}`}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white border border-slate-200"
                  >
                    <span className="truncate text-slate-700 flex items-center gap-1.5">
                      <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                      {f.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0">워크스페이스 자료</Badge>
                  </div>
                ))}
                {extraAttachments.map((f, idx) => (
                  <div
                    key={`ext_${idx}`}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white border border-emerald-200"
                  >
                    <span className="truncate text-emerald-900 flex items-center gap-1.5">
                      <Paperclip className="w-3 h-3 text-emerald-600 shrink-0" />
                      {f.name} ({formatAttachmentSize(f.size)})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-rose-600"
                      onClick={() => setExtraAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-slate-50/70 shrink-0 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={submitting || uploading}
            onClick={handleSubmit}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>시스템 담당자에게 요청 보내기</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
