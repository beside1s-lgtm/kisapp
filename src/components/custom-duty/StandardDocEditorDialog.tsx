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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, Paperclip, Save, Trash2, Upload } from 'lucide-react';
import RichEditor from '@/components/rich-editor';
import { useToast } from '@/hooks/use-toast';
import type { Attachment, OrgStructure } from '@/lib/types';
import type { CustomDutyStandardDoc } from '@/lib/types/customDuty';
import {
  getCustomDutyWorkspaceId,
  uploadCustomDutyAttachmentFile,
  upsertCustomDutyStandardDoc,
} from '@/lib/services/customDutyService';
import { saveStandardDocTemplateOverride } from '@/lib/services/standardDocTemplateService';
import { downloadAttachmentSafely, formatAttachmentSize } from './attachmentDownloadHelper';

interface StandardDocEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dutyName: string;
  userEmail: string;
  userName: string;
  org?: Partial<OrgStructure> | null;
  initialDoc?: CustomDutyStandardDoc | null;
  onSaved?: () => void;
}

const DEFAULT_BODY_TEMPLATE = `<p><strong>1. 관련</strong>: 2026학년도 학교 운영 기본 계획</p>
<p><strong>2. 목적</strong>: 본교의 원활한 업무 추진을 위하여 다음과 같이 세부 운영 계획을 수립하고자 합니다.</p>
<br/>
<p><strong>가. 추진 일정</strong>: </p>
<p><strong>나. 대상 및 장소</strong>: </p>
<p><strong>다. 세부 추진 내용</strong>: 붙임 파일 참조</p>
<br/>
<p>붙임 1. 관련 서식 및 세부 계획(안) 1부. 끝.</p>`;

export function StandardDocEditorDialog({
  open,
  onOpenChange,
  dutyName,
  userEmail,
  userName,
  org,
  initialDoc,
  onSaved,
}: StandardDocEditorDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState(DEFAULT_BODY_TEMPLATE);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDefault, setIsDefault] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialDoc) {
      setTitle(initialDoc.title || '');
      setDescription(initialDoc.description || '');
      setContent(initialDoc.content || DEFAULT_BODY_TEMPLATE);
      setAttachments(initialDoc.attachments || []);
      setIsDefault(initialDoc.isDefault ?? true);
    } else {
      setTitle(`[${dutyName}] 2026학년도 운영 계획 수립(안)`);
      setDescription('표준 기안 및 결재 상신 시 기본으로 불러올 공식 문서 서식');
      setContent(DEFAULT_BODY_TEMPLATE);
      setAttachments([]);
      setIsDefault(true);
    }
  }, [open, initialDoc, dutyName]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const workspaceId = getCustomDutyWorkspaceId(dutyName);
    let insertedBodyPreview = false;

    try {
      const nextAtts: Attachment[] = [];
      for (const file of Array.from(files)) {
        const res = await uploadCustomDutyAttachmentFile(file, workspaceId);
        nextAtts.push(res.attachment);
        if (
          res.extractedHtml &&
          !insertedBodyPreview &&
          (!content || content === DEFAULT_BODY_TEMPLATE)
        ) {
          setContent(res.extractedHtml);
          insertedBodyPreview = true;
        }
      }

      setAttachments((prev) => [...prev, ...nextAtts]);
      toast({
        title: '파일 업로드 완료',
        description: insertedBodyPreview
          ? `${nextAtts.length}개 파일이 추가되었으며, 본문 내용도 자동으로 채워졌습니다.`
          : `${nextAtts.length}개의 표준 문서/붙임파일이 업로드되었습니다.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '업로드 실패',
        description: err?.message || '파일 업로드 중 오류가 발생했습니다.',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '표준 문서 제목을 입력하세요.' });
      return;
    }

    setSaving(true);
    try {
      const workspaceId = getCustomDutyWorkspaceId(dutyName);
      const docId = initialDoc?.id || `doc_${Date.now()}`;
      const templateKey = initialDoc?.templateKey || `custom_duty__${workspaceId}__${docId}`;
      const now = new Date().toISOString();

      const standardDoc: CustomDutyStandardDoc = {
        id: docId,
        templateKey,
        title: title.trim(),
        description: description.trim(),
        content: content || '<p></p>',
        docType: 'internal',
        attachments,
        isDefault,
        updatedAt: now,
        updatedBy: userEmail,
        updatedByName: userName,
      };

      await upsertCustomDutyStandardDoc(dutyName, standardDoc, org);

      if (isDefault) {
        await saveStandardDocTemplateOverride({
          templateKey,
          templateName: `${dutyName} - ${standardDoc.title}`,
          dutyName,
          title: standardDoc.title,
          content: standardDoc.content,
          docType: 'internal',
          includeAttachments: true,
          attachments: standardDoc.attachments,
          updatedBy: userEmail,
          updatedByName: userName,
        });
      }

      toast({
        title: '표준 기안문서 저장 완료',
        description: isDefault
          ? '수정된 문서 틀이 기본값으로 설정되어 다음 업무 기안 시 자동으로 적용됩니다.'
          : '표준 기안문서 목록에 저장되었습니다.',
      });
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '저장 실패',
        description: err?.message || '표준 문서 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[780px] max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-5 py-4 border-b bg-slate-50/70 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-slate-900">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>{initialDoc ? '표준 기안문서 수정' : '새 표준 기안문서 및 붙임 등록'}</span>
            <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-bold">
              {dutyName}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            표준 기안문서 양식을 직접 작성하거나 기존 파일(한글·워드·엑셀·PDF·HTML)을 첨부하여 기본 서식으로 저장합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-800">표준 기안문서 제목 *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`예: [${dutyName}] 2026학년도 운영 계획(안)`}
              className="h-9 text-sm font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">서식 용도 설명 (선택)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 학기 초 기본계획 결재 상신 및 붙임 요강 포함"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-bold text-slate-800">기안문 본문 표준 틀</Label>
              <span className="text-[11px] text-slate-400">다음 기안 시 이 본문이 기본으로 불러와집니다.</span>
            </div>
            <div className="border rounded-xl overflow-hidden bg-white">
              <RichEditor value={content} onChange={setContent} />
            </div>
          </div>

          <div className="space-y-2 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                <span>표준 붙임문서 / 참고 서식 파일 ({attachments.length}건)</span>
              </Label>
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-bold cursor-pointer transition-colors">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>{uploading ? '업로드 중...' : '파일 업로드 (HWP/DOCX/XLSX/PDF/HTML)'}</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            {attachments.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-2">
                첨부된 표준 붙임문서가 없습니다. 기안 시 함께 첨부될 기본 서식이 있다면 업로드하세요.
              </p>
            ) : (
              <div className="space-y-1.5">
                {attachments.map((att, idx) => (
                  <div
                    key={`${att.name}_${idx}`}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => downloadAttachmentSafely(att)}
                      className="flex items-center gap-2 min-w-0 text-left hover:underline text-indigo-700 font-semibold"
                    >
                      <Paperclip className="w-3 h-3 shrink-0" />
                      <span className="truncate">{att.name}</span>
                      {att.size ? (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          ({formatAttachmentSize(att.size)})
                        </span>
                      ) : null}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-rose-600 shrink-0"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-indigo-200 bg-indigo-50/60 cursor-pointer">
            <Checkbox
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(Boolean(checked))}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-extrabold text-indigo-950 block">
                이 표준 문서를 &apos;{dutyName}&apos; 기본 기안 틀로 설정 및 저장
              </span>
              <span className="text-[11px] text-indigo-800 block">
                활성화하면 이후 이 업무의 기안문을 작성할 때 방금 수정한 제목·본문·붙임문서가 기본값으로 자동 로드됩니다.
              </span>
            </div>
          </label>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-slate-50/70 shrink-0 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || uploading}
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>기본값으로 설정 및 저장</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
