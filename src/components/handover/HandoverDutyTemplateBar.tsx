'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { HandoverDutyTimelineTemplate, HandoverItem } from '@/lib/types/handover';
import { summarizeDutyTemplateCustomizations } from '@/lib/services/handoverDutyTemplateService';
import { RotateCcw, Save } from 'lucide-react';

interface HandoverDutyTemplateBarProps {
  selectedDuties: string[];
  dutyTimelineTemplates: HandoverDutyTimelineTemplate[];
  items: HandoverItem[];
  isEditable: boolean;
  compact?: boolean;
  onSyncNow: () => Promise<void>;
  onResetToDefault: () => Promise<void>;
}

/**
 * 선택된 업무에 대해 학습·저장된 타임라인 수정/추가/제외 표준 상태를 안내하고
 * 즉시 표준 반영 또는 기본값 복원을 실행하는 공용 바.
 */
export function HandoverDutyTemplateBar({
  selectedDuties,
  dutyTimelineTemplates,
  items,
  isEditable,
  compact = false,
  onSyncNow,
  onResetToDefault,
}: HandoverDutyTemplateBarProps) {
  const [isBusy, setIsBusy] = useState(false);

  const summary = useMemo(
    () => summarizeDutyTemplateCustomizations(selectedDuties, dutyTimelineTemplates),
    [selectedDuties, dutyTimelineTemplates]
  );

  const hasUnsyncedOrLearnableItems = useMemo(
    () =>
      items.some(
        (it) =>
          (it.sourceType === 'system_auto' && Boolean(it.userEdited)) ||
          (it.sourceType === 'manual' && it.includeInDutyTemplate !== false)
      ),
    [items]
  );

  if (selectedDuties.length === 0) return null;
  if (summary.totalCustomCount === 0 && !hasUnsyncedOrLearnableItems) return null;

  const primaryLabel = selectedDuties[0];
  const statParts: string[] = [];
  if (summary.overrideCount > 0) statParts.push(`수정 ${summary.overrideCount}건`);
  if (summary.addedCount > 0) statParts.push(`추가 ${summary.addedCount}건`);
  if (summary.hiddenCount > 0) statParts.push(`제외 ${summary.hiddenCount}건`);

  const handleSyncClick = async () => {
    setIsBusy(true);
    try {
      await onSyncNow();
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetClick = async () => {
    const confirmed = window.confirm(
      `'${primaryLabel}' 업무에 저장된 사용자 수정·추가·제외 내역을 초기화하고 시스템 기본 표준 타임라인으로 복원하시겠습니까?`
    );
    if (!confirmed) return;
    setIsBusy(true);
    try {
      await onResetToDefault();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-indigo-200/80 bg-indigo-50/70 ${
        compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-indigo-950 min-w-0">
        <span className="font-bold text-indigo-800 shrink-0">업무 표준 타임라인 연동</span>
        {summary.totalCustomCount > 0 ? (
          <span className="text-[11px] font-medium text-indigo-900">
            저장된 변경 내역({statParts.join(' · ')})이 다음 자동 작성 시에도 그대로 적용됩니다.
          </span>
        ) : (
          <span className="text-[11px] font-medium text-slate-600">
            타임라인에서 수정·추가한 내용을 업무 표준으로 반영하면 다음 작성 시에도 자동 적용됩니다.
          </span>
        )}
      </div>

      {isEditable && (
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {hasUnsyncedOrLearnableItems && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={handleSyncClick}
              className="h-7 px-2 text-[11px] font-bold bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-100/70 gap-1"
            >
              <Save className="w-3 h-3" />
              <span>현재 타임라인 표준 반영</span>
            </Button>
          )}
          {summary.totalCustomCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={handleResetClick}
              className="h-7 px-2 text-[11px] font-semibold bg-white border-slate-300 text-slate-700 hover:bg-slate-100 gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>기본 표준 복원</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
