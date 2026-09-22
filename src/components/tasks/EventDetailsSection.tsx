'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Clock, Coins, MapPin, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { ScheduleItem, BudgetItem } from './create-department-task-dialog';

const EVENT_TYPE_OPTIONS = [
  { value: 'sports_day', label: '스포츠 데이 (운동회 / 체육대회)' },
  { value: 'arts_festival', label: '학예발표회 (축제 / 전시회)' },
  { value: 'field_trip', label: '현장체험학습 (수련활동 / 수학여행)' },
  { value: 'career_volunteer', label: '진로체험 및 학생 봉사활동' },
  { value: 'competition', label: '교내 대회 및 특별 활동' },
  { value: 'general_event', label: '기타 교내외 주요 행사' },
];

const LOCATION_QUICK_TAGS = [
  '대운동장',
  '메인 체육관',
  '소체육관',
  '강당',
  '시청각실',
  '각 학급 교실',
  '풋살장',
  '도서관',
];

/**
 * "행사/프로젝트" 업무 카테고리 선택 시 표시되는 행사 기본정보 + 타임테이블 +
 * 예산 편성 섹션.
 *
 * create-department-task-dialog.tsx의 {taskCategory === 'event' && (...)}
 * 블록을 그대로 옮긴 것으로, 상태와 일정/예산 편집 로직은 전부
 * 부모(CreateDepartmentTaskDialog)에 남아 있고 이 컴포넌트는 순수하게
 * 마크업만 담당한다 (동작 변경 없음).
 */
export interface EventDetailsSectionProps {
  eventType: string;
  setEventType: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  location: string;
  setLocation: Dispatch<SetStateAction<string>>;
  purpose: string;
  setPurpose: (value: string) => void;

  schedules: ScheduleItem[];
  onAddScheduleItem: () => void;
  onUpdateScheduleItem: (id: string, field: keyof ScheduleItem, value: string) => void;
  onRemoveScheduleItem: (id: string) => void;

  budgets: BudgetItem[];
  totalBudget: number;
  onAddBudgetItem: () => void;
  onUpdateBudgetItem: (id: string, field: keyof BudgetItem, value: string | number) => void;
  onRemoveBudgetItem: (id: string) => void;
}

export function EventDetailsSection({
  eventType,
  setEventType,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  location,
  setLocation,
  purpose,
  setPurpose,
  schedules,
  onAddScheduleItem,
  onUpdateScheduleItem,
  onRemoveScheduleItem,
  budgets,
  totalBudget,
  onAddBudgetItem,
  onUpdateBudgetItem,
  onRemoveBudgetItem,
}: EventDetailsSectionProps) {
  return (
    <div className="space-y-4 pt-1">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700">행사 유형 *</Label>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger className="h-9 text-xs rounded-xl font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs font-medium">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700">운영 시작일 *</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 text-xs rounded-xl font-medium"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700">운영 종료일 *</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 text-xs rounded-xl font-medium"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
            주요 진행 장소 *
          </Label>
          <div className="flex flex-wrap gap-1">
            {LOCATION_QUICK_TAGS.slice(0, 4).map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setLocation(prev => prev ? `${prev}, ${tag}` : tag)}
                className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded text-slate-600 font-medium"
              >
                +{tag}
              </button>
            ))}
          </div>
        </div>
        <Input
          placeholder="예: 학교 대운동장 및 메인 체육관"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="h-9 text-xs rounded-xl"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-slate-700">추진 목적 및 방침</Label>
        <Textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          rows={2}
          placeholder="행사의 목적과 주요 운영 방침을 입력해주세요."
          className="text-xs rounded-xl resize-none"
        />
      </div>

      {/* 시간대별 타임테이블 */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            시간대별 프로그램 및 타임테이블 ({schedules.length}개 일정)
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddScheduleItem}
            className="h-6 px-2 text-[10px] font-semibold bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <Plus className="w-3 h-3 mr-1" />
            일정 추가
          </Button>
        </div>

        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {schedules.map((sc) => (
            <div key={sc.id} className="flex items-center gap-1.5 p-2 bg-white rounded-lg border border-slate-200 shadow-2xs text-xs">
              <Input
                placeholder="시간대"
                value={sc.time}
                onChange={(e) => onUpdateScheduleItem(sc.id, 'time', e.target.value)}
                className="h-7 text-[11px] w-28 shrink-0 font-medium"
              />
              <Input
                placeholder="프로그램 내용"
                value={sc.program}
                onChange={(e) => onUpdateScheduleItem(sc.id, 'program', e.target.value)}
                className="h-7 text-[11px] flex-1 font-semibold"
              />
              <Input
                placeholder="장소"
                value={sc.location}
                onChange={(e) => onUpdateScheduleItem(sc.id, 'location', e.target.value)}
                className="h-7 text-[11px] w-24 shrink-0 hidden sm:block"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveScheduleItem(sc.id)}
                className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* 소요 예산 계획 */}
      <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-600" />
            소요 예산 계획 (총 예산: 금 {totalBudget.toLocaleString()} VND)
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddBudgetItem}
            className="h-6 px-2 text-[10px] font-semibold bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
          >
            <Plus className="w-3 h-3 mr-1" />
            예산 추가
          </Button>
        </div>

        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          {budgets.map((b) => (
            <div key={b.id} className="flex items-center gap-1.5 p-2 bg-white rounded-lg border border-amber-200 shadow-2xs text-xs">
              <Input
                placeholder="항목명"
                value={b.item}
                onChange={(e) => onUpdateBudgetItem(b.id, 'item', e.target.value)}
                className="h-7 text-[11px] flex-1 font-semibold"
              />
              <Input
                type="number"
                placeholder="금액 (VND)"
                value={b.amount}
                onChange={(e) => onUpdateBudgetItem(b.id, 'amount', Number(e.target.value) || 0)}
                className="h-7 text-[11px] w-28 shrink-0 font-mono text-right"
              />
              <Input
                placeholder="비고 / 산출내역"
                value={b.note}
                onChange={(e) => onUpdateBudgetItem(b.id, 'note', e.target.value)}
                className="h-7 text-[11px] w-32 shrink-0 hidden sm:block"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveBudgetItem(b.id)}
                className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
