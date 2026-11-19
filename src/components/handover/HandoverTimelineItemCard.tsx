'use client';

import React, { useEffect, useState } from 'react';
import type { HandoverItem } from '@/lib/types/handover';
import {
  HANDOVER_PERIOD_OPTIONS,
  getHandoverItemTimingMeta,
  normalizeHandoverPeriodLabel,
} from '@/lib/handover/systemDutyBlueprints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HandoverTimelineItemCardProps {
  item: HandoverItem;
  isEditing: boolean;
  readOnly?: boolean;
  compact?: boolean;
  showPeriodBadgeInMeta?: boolean;
  onStartEdit: (item: HandoverItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (
    itemId: string,
    patch: { period: string; documentTitle: string; summary: string }
  ) => void;
  onRemove: (itemId: string) => void;
}

export function HandoverTimelineItemCard({
  item,
  isEditing,
  readOnly = false,
  compact = false,
  showPeriodBadgeInMeta = false,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRemove,
}: HandoverTimelineItemCardProps) {
  const [periodVal, setPeriodVal] = useState(
    normalizeHandoverPeriodLabel(item.period) || HANDOVER_PERIOD_OPTIONS[0]
  );
  const [titleVal, setTitleVal] = useState(item.documentTitle || '');
  const [summaryVal, setSummaryVal] = useState(item.summary || '');

  useEffect(() => {
    if (isEditing) {
      setPeriodVal(normalizeHandoverPeriodLabel(item.period) || HANDOVER_PERIOD_OPTIONS[0]);
      setTitleVal(item.documentTitle || '');
      setSummaryVal(item.summary || '');
    }
  }, [isEditing, item.period, item.documentTitle, item.summary]);

  const timingMeta = getHandoverItemTimingMeta(item);

  const periodSelectOptions = HANDOVER_PERIOD_OPTIONS.includes(periodVal as any)
    ? [...HANDOVER_PERIOD_OPTIONS]
    : [periodVal, ...HANDOVER_PERIOD_OPTIONS];

  if (isEditing && !readOnly) {
    return (
      <div className="p-3 bg-indigo-50/50 border border-indigo-300 rounded-xl ring-1 ring-indigo-200 space-y-2.5 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
          <div className="sm:col-span-4 space-y-1">
            <label className="text-[10px] font-bold text-indigo-900 block">
              업무 시기
            </label>
            <Select value={periodVal} onValueChange={setPeriodVal}>
              <SelectTrigger className="h-8 text-xs bg-white border-indigo-200 font-semibold">
                <SelectValue placeholder="업무 시기 선택" />
              </SelectTrigger>
              <SelectContent>
                {periodSelectOptions.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs font-medium">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-8 space-y-1">
            <label className="text-[10px] font-bold text-indigo-900 block">
              제목
            </label>
            <Input
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              placeholder="업무명 또는 문서 제목을 입력하세요"
              className="h-8 text-xs font-bold bg-white border-indigo-200"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-indigo-900 block">
            내용 (주요 인계 사항 및 핵심 팁)
          </label>
          <Textarea
            value={summaryVal}
            onChange={(e) => setSummaryVal(e.target.value)}
            rows={2}
            placeholder="세부 업무 내용 및 후임자를 위한 주의사항을 입력하세요"
            className="text-xs bg-white border-indigo-200 min-h-[56px]"
          />
        </div>

        <div className="flex items-center justify-end gap-1.5 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancelEdit}
            className="h-7 px-2.5 text-xs bg-white border-slate-200 text-slate-600 gap-1"
          >
            <X className="w-3 h-3" />
            <span>취소</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onSaveEdit(item.id, {
              period: periodVal,
              documentTitle: titleVal,
              summary: summaryVal,
            })}
            className="h-7 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
          >
            <Check className="w-3 h-3" />
            <span>저장</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors shadow-2xs',
        compact ? 'p-2 rounded-lg' : 'p-3'
      )}
    >
      <div className="space-y-1 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {showPeriodBadgeInMeta && item.period && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-700 border-indigo-200 font-bold shrink-0"
            >
              {normalizeHandoverPeriodLabel(item.period)}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="bg-indigo-50 text-indigo-700 text-[10px] border-indigo-200 font-semibold"
          >
            {item.category}
          </Badge>
          {timingMeta.isSystemAuto && (
            <Badge
              variant="outline"
              className={cn('text-[10px] font-bold', timingMeta.timingBadgeClass)}
            >
              {timingMeta.timingBadgeText}
            </Badge>
          )}
          <span className="text-xs font-bold text-slate-900">
            {item.documentTitle}
          </span>
          {timingMeta.dateOrScheduleText && (
            <span className="text-[11px] text-slate-500 font-medium shrink-0">
              {timingMeta.dateOrScheduleText}
            </span>
          )}
        </div>

        {item.summary && (
          <p className={cn('text-[11px] text-slate-600', compact ? 'truncate' : 'line-clamp-2')}>
            {item.summary}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        {item.folderUrl && !compact && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open(item.folderUrl, '_blank')}
            className="h-7 text-[11px] text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-bold px-2 gap-1"
            title="관련 폴더/문서 열기"
          >
            <ExternalLink className="w-3 h-3" />
            <span>폴더/문서</span>
          </Button>
        )}

        {!readOnly && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onStartEdit(item)}
              className={cn(
                'text-slate-600 hover:text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 font-semibold gap-1 shrink-0',
                compact ? 'h-6 px-1.5 text-[10px]' : 'h-7 px-2 text-[11px]'
              )}
              title="항목 수정"
            >
              <Pencil className="w-3 h-3" />
              <span>수정</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemove(item.id)}
              className={cn(
                'p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0',
                compact ? 'h-6 w-6' : 'h-7 w-7'
              )}
              title="항목 제거"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
