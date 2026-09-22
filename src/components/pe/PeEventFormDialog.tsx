'use client';

import {
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  Coins,
  FileText,
  MapPin,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { PeEvent, PeEventType, PeEventSchedule, PeEventBudget } from '@/lib/pe/types';
import type { ClassPeriodSchedule } from '@/lib/types';

/**
 * "신규/수정 체육 행사 계획" 모달.
 *
 * PeEventManagement.tsx의 Dialog(isFormOpen) 블록을 그대로 옮긴 것으로,
 * 폼 상태와 저장/일정/예산 편집 로직은 전부 부모(PeEventManagement.tsx)에
 * 남아 있고 이 컴포넌트는 순수하게 마크업만 담당한다 (동작 변경 없음).
 */
export interface PeEventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEvent: PeEvent | null;

  formTitle: string;
  setFormTitle: (value: string) => void;
  formEventType: PeEventType;
  setFormEventType: (value: PeEventType) => void;
  formManager: string;
  setFormManager: (value: string) => void;
  formStartDate: string;
  setFormStartDate: (value: string) => void;
  formEndDate: string;
  setFormEndDate: (value: string) => void;
  formLocation: string;
  setFormLocation: (value: string) => void;
  formDescription: string;
  setFormDescription: (value: string) => void;

  availableGrades: string[];
  formTargetGrades: string[];
  onToggleAllGrades: () => void;
  onToggleGrade: (grade: string) => void;

  formSchedules: PeEventSchedule[];
  scheduleDates: string[];
  periodSchedules: ClassPeriodSchedule[];
  onAddNewDateSchedule: () => void;
  onAddSchedule: (dateStr: string) => void;
  onUpdateSchedule: (id: string, field: keyof PeEventSchedule, value: string) => void;
  onRemoveSchedule: (id: string) => void;
  onPeriodRangeChange: (id: string, startPeriod: string, endPeriod: string) => void;
  onTargetGradeSelect: (id: string, target: string) => void;

  formBudgets: PeEventBudget[];
  calculatedTotalBudget: number;
  onAddBudget: () => void;
  onUpdateBudget: (id: string, field: keyof PeEventBudget, value: string | number) => void;
  onRemoveBudget: (id: string) => void;

  onSaveEvent: () => void;
}

export function PeEventFormDialog({
  open,
  onOpenChange,
  editingEvent,
  formTitle,
  setFormTitle,
  formEventType,
  setFormEventType,
  formManager,
  setFormManager,
  formStartDate,
  setFormStartDate,
  formEndDate,
  setFormEndDate,
  formLocation,
  setFormLocation,
  formDescription,
  setFormDescription,
  availableGrades,
  formTargetGrades,
  onToggleAllGrades,
  onToggleGrade,
  formSchedules,
  scheduleDates,
  periodSchedules,
  onAddNewDateSchedule,
  onAddSchedule,
  onUpdateSchedule,
  onRemoveSchedule,
  onPeriodRangeChange,
  onTargetGradeSelect,
  formBudgets,
  calculatedTotalBudget,
  onAddBudget,
  onUpdateBudget,
  onRemoveBudget,
  onSaveEvent,
}: PeEventFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] sm:max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 상단 고정 헤더 (X 버튼과 함께 스크롤 무관 항상 고정) */}
        <DialogHeader className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-white shrink-0 sticky top-0 z-20 text-left">
          <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 pr-8">
            <CalendarDays className="w-5 h-5 text-indigo-600 shrink-0" />
            {editingEvent ? '체육 행사 계획 수정' : '신규 체육 행사 계획 수립'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            측정주간, 스포츠데이, 교내 리그전 등의 일정과 예산을 수립하고 결재 기안을 상신합니다.
          </DialogDescription>
        </DialogHeader>

        {/* 스크롤 가능한 본문 폼 영역 */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {/* 1. 기본 정보 */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600" />
              1. 기본 행사 정보
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700">행사명</Label>
                <Input
                  placeholder="예: 2026학년도 초등 스포츠 데이 한마당 계획"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="h-8 text-xs bg-white font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">행사 유형</Label>
                <Select value={formEventType} onValueChange={(v: PeEventType) => setFormEventType(v)}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sports_day">스포츠 데이 (운동회 / 체육대회)</SelectItem>
                    <SelectItem value="paps_week">PAPS 집중 측정주간</SelectItem>
                    <SelectItem value="tournament">교내 리그전 및 기타 대회</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">추진 담당 교사</Label>
                <Input
                  value={formManager}
                  onChange={e => setFormManager(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">운영 시작일</Label>
                <Input
                  type="date"
                  value={formStartDate}
                  onChange={e => setFormStartDate(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">운영 종료일</Label>
                <Input
                  type="date"
                  value={formEndDate}
                  onChange={e => setFormEndDate(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700">주요 진행 장소</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="예: 학교 대운동장 및 메인 체육관"
                    value={formLocation}
                    onChange={e => setFormLocation(e.target.value)}
                    className="h-8 text-xs bg-white flex-1"
                  />
                  <div className="hidden sm:flex items-center gap-1">
                    {['대운동장', '메인 체육관', '소체육관'].map(loc => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setFormLocation(loc)}
                        className="px-2 py-1 text-[11px] font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700">대상 학년 선택 (전체 학년 지원)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onToggleAllGrades}
                    className="h-6 text-[11px] text-indigo-600 px-2 hover:bg-indigo-50 font-bold"
                  >
                    전체선택/해제
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {availableGrades.map(g => {
                    const isSelected = formTargetGrades.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => onToggleGrade(g)}
                        className={cn(
                          "px-3 py-1 text-xs font-bold rounded-lg border transition-all",
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        {g}학년
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700">추진 목적 및 방침</Label>
                <Textarea
                  placeholder="행사의 추진 목적, 운영 방침, 주요 기대 효과를 입력하세요."
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  rows={2}
                  className="text-xs bg-white resize-none"
                />
              </div>
            </div>
          </div>

          {/* 2. 학년별 요일/교시 시간대 배정표 */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-indigo-600" />
                  2. 학년별 요일 / 교시 시간대 배정표 ({formSchedules.length}건 배정됨)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  교시별로 어떤 학년이 활동할지 배정하세요. 세부 경기 종목 및 시나리오는 각 학년 선생님이 제출할 세부계획서에 반영됩니다.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onAddNewDateSchedule}
                className="h-7 text-xs font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50 bg-white shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                날짜 추가
              </Button>
            </div>

            {/* 날짜별 그룹 렌더링 */}
            <div className="space-y-3">
              {scheduleDates.map((dateStr) => {
                const dateSchedules = formSchedules.filter(s => s.date === dateStr);

                return (
                  <div key={dateStr} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    {/* 날짜 헤더 */}
                    <div className="bg-indigo-50/70 px-3.5 py-2 border-b border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-indigo-600" />
                        <span className="font-bold text-xs text-indigo-950">{dateStr}</span>
                        <Badge variant="secondary" className="text-[10px] font-semibold bg-white text-indigo-800">
                          {dateSchedules.length}개 교시 블록 배정
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onAddSchedule(dateStr)}
                        className="h-6 px-2 text-[11px] font-bold text-indigo-600 hover:bg-indigo-100 rounded-lg"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        이 날짜에 교시 배정 추가
                      </Button>
                    </div>

                    {/* 시간대 프로그램 목록 */}
                    <div className="p-3 space-y-3 divide-y divide-slate-100">
                      {dateSchedules.map((s, idx) => {
                        const currentStartP = s.startPeriod || periodSchedules[0]?.name || '1교시';
                        const currentEndP = s.endPeriod || s.startPeriod || periodSchedules[0]?.name || '1교시';

                        return (
                          <div key={s.id} className={cn("space-y-2.5 text-xs", idx > 0 && "pt-3")}>
                            {/* 1행: 교시 범위 선택 & 시간대 프리셋 & 삭제 버튼 */}
                            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap bg-slate-50/80 p-2 rounded-lg border border-slate-200/60">
                              <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                                <Badge variant="outline" className="text-[10px] font-bold bg-white text-slate-700 shrink-0">
                                  #{idx + 1}
                                </Badge>

                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[11px] font-bold text-slate-600">교시:</span>
                                  {/* 시작 교시 */}
                                  <Select
                                    value={currentStartP}
                                    onValueChange={(val) => onPeriodRangeChange(s.id, val, currentEndP)}
                                  >
                                    <SelectTrigger className="h-7 w-[95px] text-xs font-bold bg-white border-slate-300">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {periodSchedules.map(p => (
                                        <SelectItem key={p.id} value={p.name} className="text-xs">
                                          {p.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  <span className="text-slate-400 font-bold">~</span>

                                  {/* 종료 교시 */}
                                  <Select
                                    value={currentEndP}
                                    onValueChange={(val) => onPeriodRangeChange(s.id, currentStartP, val)}
                                  >
                                    <SelectTrigger className="h-7 w-[95px] text-xs font-bold bg-white border-slate-300">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {periodSchedules.map(p => (
                                        <SelectItem key={p.id} value={p.name} className="text-xs">
                                          {p.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* 계산된 시간대 표시 / 직접 수정 */}
                                <div className="flex items-center gap-1 flex-1 min-w-[150px]">
                                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <Input
                                    value={s.time || ''}
                                    onChange={e => onUpdateSchedule(s.id, 'time', e.target.value)}
                                    placeholder="08:30 ~ 11:00 (1~3교시)"
                                    className="h-7 text-xs font-mono font-bold bg-white border-slate-200"
                                    title="시간대를 직접 수정할 수도 있습니다."
                                  />
                                </div>
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onRemoveSchedule(s.id)}
                                className="h-7 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                                title="배정 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>

                            {/* 2행: 핵심 배정 대상 학년 & 진행 장소 */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2 sm:pl-3">
                              {/* 배정 대상 학년 */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                                    배정 대상 학년
                                  </span>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {['1학년', '2학년', '3학년', '4학년', '5학년', '6학년'].map(gr => (
                                      <button
                                        key={gr}
                                        type="button"
                                        onClick={() => onTargetGradeSelect(s.id, gr)}
                                        className={cn(
                                          "text-[10px] px-1.5 py-0.5 rounded font-bold transition-all",
                                          s.target === gr
                                            ? "bg-indigo-600 text-white"
                                            : "bg-slate-100 hover:bg-indigo-50 text-slate-700"
                                        )}
                                      >
                                        {gr}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <div className="flex items-center gap-1 shrink-0">
                                    {['전교생', '1~3학년', '4~6학년'].map(tg => (
                                      <button
                                        key={tg}
                                        type="button"
                                        onClick={() => onTargetGradeSelect(s.id, tg)}
                                        className={cn(
                                          "text-[9px] px-1.5 py-0.5 rounded font-semibold transition-all",
                                          s.target === tg
                                            ? "bg-indigo-100 text-indigo-800 border border-indigo-300"
                                            : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                                        )}
                                      >
                                        {tg}
                                      </button>
                                    ))}
                                  </div>
                                  <Input
                                    placeholder="예: 1학년, 4~5학년"
                                    value={s.target || ''}
                                    onChange={e => onUpdateSchedule(s.id, 'target', e.target.value)}
                                    className="h-7 text-xs bg-white font-bold flex-1"
                                  />
                                </div>
                              </div>

                              {/* 진행 장소 */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                    진행 장소
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {['대운동장', '메인 체육관', '소체육관', '강당'].map(loc => (
                                      <button
                                        key={loc}
                                        type="button"
                                        onClick={() => onUpdateSchedule(s.id, 'location', loc)}
                                        className={cn(
                                          "text-[9px] px-1.5 py-0.5 rounded font-medium",
                                          s.location === loc
                                            ? "bg-slate-800 text-white"
                                            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                        )}
                                      >
                                        {loc}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <Input
                                  placeholder="예: 대운동장"
                                  value={s.location || ''}
                                  onChange={e => onUpdateSchedule(s.id, 'location', e.target.value)}
                                  className="h-7 text-xs bg-white"
                                />
                              </div>
                            </div>

                            {/* 3행: 활동 개요 및 세부계획서 연동 메모 */}
                            <div className="pl-2 sm:pl-3 pt-0.5 flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">활동 개요:</span>
                              <Input
                                placeholder="예: 1학년 스포츠 활동 (세부 운영 시나리오는 학년 계획서 참조)"
                                value={s.title || ''}
                                onChange={e => onUpdateSchedule(s.id, 'title', e.target.value)}
                                className="h-6 text-[11px] bg-slate-50/50 flex-1 border-dashed"
                              />
                              <span className="text-[10px] text-slate-400 hidden md:inline shrink-0">
                                * 세부 경기 종목은 학년별 계획서에서 수합
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. 소요 예산 편성 */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-600" />
                  3. 소요 예산 내역 (총 {calculatedTotalBudget.toLocaleString()} VND)
                </h3>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onAddBudget}
                className="h-7 text-xs font-bold text-amber-700 border-amber-200 hover:bg-amber-50 bg-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                예산 항목 추가
              </Button>
            </div>

            <div className="space-y-2">
              {formBudgets.map((b, idx) => (
                <div key={b.id} className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center gap-2 flex-wrap sm:flex-nowrap text-xs">
                  <Badge variant="secondary" className="text-[10px] font-bold shrink-0">#{idx + 1}</Badge>
                  <Input
                    placeholder="구분 (예: 용품비)"
                    value={b.category}
                    onChange={e => onUpdateBudget(b.id, 'category', e.target.value)}
                    className="h-7 text-xs w-[110px] shrink-0"
                  />
                  <Input
                    placeholder="산출 내역 / 품명"
                    value={b.item}
                    onChange={e => onUpdateBudget(b.id, 'item', e.target.value)}
                    className="h-7 text-xs flex-1 min-w-[140px]"
                  />
                  <Input
                    type="number"
                    placeholder="금액(VND)"
                    value={b.amount || ''}
                    onChange={e => onUpdateBudget(b.id, 'amount', parseInt(e.target.value) || 0)}
                    className="h-7 text-xs w-[130px] font-bold text-right shrink-0"
                  />
                  <Input
                    placeholder="비고"
                    value={b.note || ''}
                    onChange={e => onUpdateBudget(b.id, 'note', e.target.value)}
                    className="h-7 text-xs w-[120px] shrink-0"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveBudget(b.id)}
                    className="h-6 px-1 text-rose-500 hover:text-rose-700 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 하단 고정 푸터 */}
        <DialogFooter className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50/95 backdrop-blur-xs shrink-0 flex items-center justify-between sticky bottom-0 z-20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSaveEvent}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
          >
            {editingEvent ? '수정사항 저장' : '계획 저장 완료'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
