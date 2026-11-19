'use client';

import React, { useMemo } from 'react';
import type { DriveFilingFolderOption } from '@/lib/drive/deptFolderMapping';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FolderOpen, ExternalLink, CalendarClock } from 'lucide-react';

interface DriveFilingHandoverCardProps {
  options: DriveFilingFolderOption[];
  selectedValue: string;
  selectedOption: DriveFilingFolderOption | null;
  onSelectFolder: (value: string) => void;
  addToHandover: boolean;
  onToggleAddToHandover: (checked: boolean) => void;
  driveEnabled?: boolean;
  compact?: boolean;
  idSuffix?: string;
  folderTitle?: string;
  folderHelpText?: string;
  handoverLabel?: string;
  handoverHelpText?: string;
}

export function DriveFilingHandoverCard({
  options,
  selectedValue,
  selectedOption,
  onSelectFolder,
  addToHandover,
  onToggleAddToHandover,
  driveEnabled = true,
  compact = false,
  idSuffix = 'desktop',
  folderTitle = '저장 문서함 (편철)',
  folderHelpText,
  handoverLabel = '인수인계 타임라인에 추가',
  handoverHelpText = '결재 완료 시 학년 말 인수인계 타임라인(문서 제목·생성일자)에 자동 추가됩니다.',
}: DriveFilingHandoverCardProps) {
  const myAssignedOptions = useMemo(
    () => options.filter(o => o.isAssignedToUser),
    [options]
  );

  const otherDeptGroups = useMemo(() => {
    const others = options.filter(o => !o.isAssignedToUser);
    const map = new Map<string, DriveFilingFolderOption[]>();
    others.forEach(opt => {
      const groupName = opt.deptName || '기타 문서함';
      const arr = map.get(groupName) || [];
      arr.push(opt);
      map.set(groupName, arr);
    });
    return Array.from(map.entries());
  }, [options]);

  const checkboxId = `addToHandover_${idSuffix}`;

  return (
    <div
      className={
        compact
          ? 'w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2.5'
          : 'rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between gap-3.5 h-full'
      }
    >
      {/* 상단: 편철 저장 문서함 선택 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <FolderOpen className={compact ? 'w-3.5 h-3.5 text-primary shrink-0' : 'w-4 h-4 text-primary shrink-0'} />
            <Label className={compact ? 'text-xs font-bold text-slate-800 truncate' : 'text-sm sm:text-base font-bold text-slate-900 truncate'}>
              {folderTitle}
            </Label>
            {selectedOption?.isAssignedToUser && (
              <Badge
                variant="outline"
                className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border-indigo-200 px-1.5 py-0 shrink-0"
              >
                내 담당
              </Badge>
            )}
          </div>

          {selectedOption?.folderUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => window.open(selectedOption.folderUrl, '_blank', 'noopener,noreferrer')}
              className="h-6 px-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 shrink-0 gap-1"
              title="선택한 Google Drive 문서함 열기"
            >
              <ExternalLink className="w-3 h-3" />
              <span>열기</span>
            </Button>
          )}
        </div>

        <Select
          value={selectedOption?.value || ''}
          onValueChange={(val) => {
            if (!val) return;
            onSelectFolder(val);
          }}
          disabled={options.length === 0}
        >
          <SelectTrigger className={compact ? 'h-8 text-xs bg-white border-slate-300' : 'h-10 text-sm bg-white border-slate-300'}>
            <SelectValue placeholder={options.length === 0 ? '등록된 문서함이 없습니다' : '저장할 문서함 선택'} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {myAssignedOptions.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[11px] font-bold text-indigo-700">
                  내 담당 업무 문서함
                </SelectLabel>
                {myAssignedOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs sm:text-sm font-medium">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {otherDeptGroups.map(([deptName, groupOpts]) => (
              <SelectGroup key={deptName}>
                <SelectLabel className="text-[11px] font-bold text-slate-500">
                  {deptName}
                </SelectLabel>
                {groupOpts.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs sm:text-sm">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        {/* 복수 담당 업무 보유자용 빠른 전환 버튼 */}
        {myAssignedOptions.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {myAssignedOptions.map(opt => {
              const isSelected = selectedValue === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSelectFolder(opt.value)}
                  className={
                    isSelected
                      ? 'text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs transition-colors cursor-pointer'
                      : 'text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-700 transition-colors cursor-pointer'
                  }
                >
                  {opt.folderName}
                </button>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-slate-500 leading-snug">
          {folderHelpText ||
            (driveEnabled
              ? '최종 결재 완료 시 선택한 문서함 폴더에 결재완료문서가 자동 저장됩니다.'
              : 'Google Drive 설정 동기화 후 결재완료문서가 해당 부서 폴더에 자동 편철됩니다.')}
        </p>
      </div>

      {/* 하단: 인수인계 타임라인에 추가 체크박스 (기본 체크) */}
      <div className="pt-2.5 border-t border-slate-200/80 space-y-1">
        <div className="flex items-center gap-2">
          <Checkbox
            id={checkboxId}
            checked={addToHandover}
            onCheckedChange={checked => onToggleAddToHandover(!!checked)}
          />
          <label
            htmlFor={checkboxId}
            className="cursor-pointer font-bold text-xs sm:text-sm text-indigo-950 flex items-center gap-1.5 select-none"
          >
            <CalendarClock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>{handoverLabel}</span>
          </label>
        </div>
        <p className="text-[11px] text-indigo-700/90 pl-6 leading-snug">
          {handoverHelpText}
        </p>
      </div>
    </div>
  );
}
