'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BookmarkCheck, Loader2, RefreshCw, RotateCcw, Save } from 'lucide-react';
import {
  STANDARD_DOC_TEMPLATE_CATALOG,
  getStandardTemplateLabel,
} from '@/lib/services/standardDocTemplateService';
import type { ResolvedCustomDuty } from '@/lib/types/customDuty';

interface StandardTemplateBannerProps {
  activeTemplateKey: string | null;
  activeTemplateName?: string;
  hasCustomOverride: boolean;
  isSaving: boolean;
  isResetting: boolean;
  afterschoolMode?: string | null;
  customDuties: ResolvedCustomDuty[];
  onSaveAsDefault: (includeAttachments: boolean, targetOverride?: { templateKey?: string; customDutyName?: string; templateTitle?: string }) => Promise<void>;
  onResetDefault: () => Promise<void>;
  onRebuildAfterschoolLive?: () => void;
}

export function StandardTemplateBanner({
  activeTemplateKey,
  activeTemplateName,
  hasCustomOverride,
  isSaving,
  isResetting,
  afterschoolMode,
  customDuties,
  onSaveAsDefault,
  onResetDefault,
  onRebuildAfterschoolLive,
}: StandardTemplateBannerProps) {
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [customDutyInput, setCustomDutyInput] = useState('');

  const displayLabel = activeTemplateKey
    ? getStandardTemplateLabel(activeTemplateKey, activeTemplateName)
    : null;

  const handleConfirmAssign = async () => {
    if (!selectedTarget && !customDutyInput.trim()) return;
    if (selectedTarget.startsWith('duty:')) {
      const dutyName = selectedTarget.slice(5);
      await onSaveAsDefault(includeAttachments, { customDutyName: dutyName });
    } else if (selectedTarget === '__custom_input__' && customDutyInput.trim()) {
      await onSaveAsDefault(includeAttachments, { customDutyName: customDutyInput.trim() });
    } else if (selectedTarget) {
      await onSaveAsDefault(includeAttachments, { templateKey: selectedTarget });
    }
    setIsAssignDialogOpen(false);
  };

  return (
    <>
      <div className="p-2.5 sm:p-3 rounded-xl border border-indigo-200 bg-indigo-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <BookmarkCheck className="w-4 h-4 text-indigo-600 shrink-0" />
          {displayLabel ? (
            <>
              <span className="text-xs font-extrabold text-indigo-950 truncate">
                적용 표준 서식: {displayLabel}
              </span>
              {hasCustomOverride ? (
                <Badge className="bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                  수정된 기본값 적용 중
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-white text-slate-600 border-slate-200 text-[10px] font-bold shrink-0">
                  시스템 기본 틀
                </Badge>
              )}
            </>
          ) : (
            <span className="text-xs font-bold text-slate-700">
              현재 작성 중인 제목·본문·붙임을 담당 업무의 표준 기안문서 기본값으로 저장할 수 있습니다.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-white px-2 py-1 rounded-md border border-slate-200 cursor-pointer">
            <Checkbox
              checked={includeAttachments}
              onCheckedChange={(v) => setIncludeAttachments(Boolean(v))}
            />
            <span>붙임파일 포함</span>
          </label>

          {activeTemplateKey ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={isSaving}
                onClick={() => onSaveAsDefault(includeAttachments)}
                className="h-7 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>수정 내용을 기본값으로 저장</span>
              </Button>

              {hasCustomOverride && afterschoolMode && onRebuildAfterschoolLive && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onRebuildAfterschoolLive}
                  className="h-7 text-xs font-bold bg-white border-teal-200 text-teal-800 hover:bg-teal-50 gap-1"
                  title="현재 개설 강좌·수업료 데이터를 기준으로 본문을 다시 생성합니다."
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>현재 강좌 데이터로 채우기</span>
                </Button>
              )}

              {hasCustomOverride && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isResetting}
                  onClick={onResetDefault}
                  className="h-7 text-xs font-bold bg-white border-slate-200 text-slate-600 hover:text-rose-600 gap-1"
                >
                  {isResetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  <span>초기 서식 복원</span>
                </Button>
              )}
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedTarget(
                  customDuties[0] ? `duty:${customDuties[0].dutyName}` : STANDARD_DOC_TEMPLATE_CATALOG[0].key
                );
                setIsAssignDialogOpen(true);
              }}
              className="h-7 text-xs font-bold bg-white border-indigo-300 text-indigo-800 hover:bg-indigo-50 gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              <span>표준 서식 기본값으로 저장</span>
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-extrabold flex items-center gap-2">
              <BookmarkCheck className="w-4 h-4 text-indigo-600" />
              <span>표준 기안문서 기본값 등록 대상 선택</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              현재 작성된 제목·본문 틀{includeAttachments ? ' 및 첨부파일' : ''}을 어떤 업무의 기본 서식으로 저장할지 선택하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-800">저장 대상 업무/서식</Label>
              <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue placeholder="업무 또는 표준 서식을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {customDuties.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px] font-bold text-indigo-700">내 배정 커스텀 업무</SelectLabel>
                      {customDuties.map((cd) => (
                        <SelectItem key={cd.workspaceId} value={`duty:${cd.dutyName}`} className="text-xs font-semibold">
                          [커스텀 업무] {cd.dutyName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-bold text-slate-500">기존 시스템 표준 서식</SelectLabel>
                    {STANDARD_DOC_TEMPLATE_CATALOG.map((item) => (
                      <SelectItem key={item.key} value={item.key} className="text-xs">
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectItem value="__custom_input__" className="text-xs font-bold text-indigo-600">
                    + 업무명 직접 입력...
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedTarget === '__custom_input__' && (
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">업무명 입력</Label>
                <Input
                  value={customDutyInput}
                  onChange={(e) => setCustomDutyInput(e.target.value)}
                  placeholder="예: 신입생 모집"
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAssignDialogOpen(false)}>
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={handleConfirmAssign}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>기본값으로 저장</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
