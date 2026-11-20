'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Pause,
  Play,
  CalendarClock,
  Info,
  Check,
  X,
} from 'lucide-react';
import type { RecurringHomework, RecurringFrequency, WeekDay } from '@/lib/types/homeroomClass';
import {
  onRecurringHomeworksUpdate,
  addRecurringHomework,
  updateRecurringHomework,
  deleteRecurringHomework,
} from '@/lib/services/homeroomClassService';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';

// ── 상수 ───────────────────────────────────────────────────────────────────────
const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const FREQ_LABEL: Record<RecurringFrequency, string> = {
  weekly: '매주',
  biweekly: '2주마다',
  monthly: '매월',
};

const FREQ_BADGE_COLOR: Record<RecurringFrequency, string> = {
  weekly: 'bg-sky-100 text-sky-800 border-sky-200',
  biweekly: 'bg-violet-100 text-violet-800 border-violet-200',
  monthly: 'bg-amber-100 text-amber-800 border-amber-200',
};

// 한국어 요일명 → 단순 텍스트
function describeSchedule(item: RecurringHomework): string {
  const freq = FREQ_LABEL[item.frequency];
  if (item.frequency === 'monthly' && item.monthDay != null) {
    return `${freq} ${item.monthDay}일`;
  }
  if (item.weekDay != null) {
    return `${freq} ${WEEK_DAYS[item.weekDay]}요일`;
  }
  return freq;
}

// 다음 예정일 계산
function getNextTriggerDate(item: RecurringHomework): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(item.startDate);
  start.setHours(0, 0, 0, 0);

  if (item.endDate) {
    const end = new Date(item.endDate);
    end.setHours(0, 0, 0, 0);
    if (today > end) return '종료됨';
  }

  if (item.frequency === 'monthly' && item.monthDay != null) {
    const candidate = new Date(today.getFullYear(), today.getMonth(), item.monthDay);
    if (candidate < today) {
      candidate.setMonth(candidate.getMonth() + 1);
    }
    if (candidate < start) {
      return format(start, 'yyyy-MM-dd');
    }
    return format(candidate, 'yyyy-MM-dd');
  }

  // weekly / biweekly
  if (item.weekDay != null) {
    const targetDay = item.weekDay;
    const baseDate = today >= start ? today : start;
    let candidate = new Date(baseDate);
    const diff = (targetDay - candidate.getDay() + 7) % 7;
    candidate.setDate(candidate.getDate() + (diff === 0 ? 0 : diff));

    if (item.frequency === 'biweekly') {
      // 시작일 기준으로 2주 단위 맞춤
      const msPerWeek = 7 * 24 * 3600 * 1000;
      const weeksSinceStart = Math.round((candidate.getTime() - start.getTime()) / msPerWeek);
      if (weeksSinceStart % 2 !== 0) {
        candidate.setDate(candidate.getDate() + 7);
      }
    }

    if (item.endDate) {
      const end = new Date(item.endDate);
      end.setHours(0, 0, 0, 0);
      if (candidate > end) return '종료됨';
    }
    return format(candidate, 'yyyy-MM-dd');
  }
  return null;
}

// ─── 폼 초기값 ─────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title: '',
  frequency: 'weekly' as RecurringFrequency,
  weekDay: 3 as WeekDay, // 수요일 기본
  monthDay: 1,
  startDate: format(new Date(), 'yyyy-MM-dd'),
  endDate: '',
  isActive: true,
};

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classKey: string;
}

export function RecurringHomeworkDialog({ open, onOpenChange, classKey }: Props) {
  const { user } = useAuth();

  // 목록 상태
  const [items, setItems] = useState<RecurringHomework[]>([]);

  // 폼 상태
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // 삭제 확인 ID
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 실시간 구독
  useEffect(() => {
    if (!open || !classKey) return;
    const unsub = onRecurringHomeworksUpdate(classKey, setItems);
    return unsub;
  }, [open, classKey]);

  // 폼 초기화
  const resetForm = useCallback(() => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(false);
  }, []);

  // 편집 시작
  const startEdit = (item: RecurringHomework) => {
    setForm({
      title: item.title,
      frequency: item.frequency,
      weekDay: item.weekDay ?? 3,
      monthDay: item.monthDay ?? 1,
      startDate: item.startDate,
      endDate: item.endDate ?? '',
      isActive: item.isActive,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  // 저장 (추가 or 수정)
  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      // undefined 필드 없이 payload 구성 (Firestore 제약)
      const payload: Omit<RecurringHomework, 'id' | 'createdAt'> = {
        title: form.title.trim(),
        frequency: form.frequency,
        startDate: form.startDate,
        isActive: form.isActive,
        ...(form.frequency !== 'monthly' && { weekDay: form.weekDay as WeekDay }),
        ...(form.frequency === 'monthly' && { monthDay: form.monthDay }),
        ...(form.endDate ? { endDate: form.endDate } : {}),
      };

      if (editingId) {
        await updateRecurringHomework(classKey, editingId, payload);
      } else {
        await addRecurringHomework(classKey, payload, user?.email || '');
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  // 활성/일시중지 토글
  const toggleActive = async (item: RecurringHomework) => {
    await updateRecurringHomework(classKey, item.id, { isActive: !item.isActive });
  };

  // 삭제
  const handleDelete = async (id: string) => {
    await deleteRecurringHomework(classKey, id);
    setDeleteConfirmId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl">
        {/* 헤더 */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <CalendarClock className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-slate-900">정기 과제 설정</DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                주기적으로 반복되는 과제를 설정하면 해당 날짜에 자동으로 추가됩니다.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* 본문 스크롤 영역 */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">

          {/* ── 추가/수정 폼 ── */}
          {showForm ? (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3.5">
              <h3 className="text-sm font-black text-slate-800">
                {editingId ? '정기 과제 수정' : '새 정기 과제 추가'}
              </h3>

              {/* 과제명 */}
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">과제명 *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="예: 주제 일기, 수학 문제집 p.30~31"
                  className="h-9 text-sm bg-white"
                  autoFocus
                />
              </div>

              {/* 반복 주기 */}
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">반복 주기 *</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) => setForm((p) => ({ ...p, frequency: v as RecurringFrequency }))}
                >
                  <SelectTrigger className="h-9 text-sm bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">매주</SelectItem>
                    <SelectItem value="biweekly">2주마다 (격주)</SelectItem>
                    <SelectItem value="monthly">매월</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 요일 선택 (weekly/biweekly) */}
              {form.frequency !== 'monthly' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">반복 요일 *</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {WEEK_DAYS.map((name, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, weekDay: idx as WeekDay }))}
                        className={`w-9 h-9 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          form.weekDay === idx
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : idx === 0
                            ? 'bg-white text-rose-500 border-slate-200 hover:bg-rose-50'
                            : idx === 6
                            ? 'bg-white text-blue-500 border-slate-200 hover:bg-blue-50'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 날짜 선택 (monthly) */}
              {form.frequency === 'monthly' && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">반복 날짜 *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={form.monthDay}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, monthDay: Math.min(31, Math.max(1, Number(e.target.value))) }))
                      }
                      className="h-9 w-24 text-sm bg-white text-center"
                    />
                    <span className="text-sm font-semibold text-slate-600">일 (매월)</span>
                  </div>
                </div>
              )}

              {/* 기간 설정 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">시작일 *</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                    className="h-9 text-sm bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-500">종료일 (선택)</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    min={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                    className="h-9 text-sm bg-white"
                  />
                </div>
              </div>

              {/* 활성 여부 */}
              <div className="flex items-center gap-2.5 pt-1">
                <Switch
                  id="form-active"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
                />
                <Label htmlFor="form-active" className="text-xs font-bold text-slate-700 cursor-pointer">
                  {form.isActive ? '활성 (자동 추가 활성화)' : '일시중지 (자동 추가 중단)'}
                </Label>
              </div>

              {/* 버튼 */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  onClick={handleSave}
                  disabled={!form.title.trim() || saving}
                  className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 gap-1.5 cursor-pointer"
                >
                  {saving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  {editingId ? '수정 완료' : '추가'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={resetForm}
                  disabled={saving}
                  className="h-9 text-xs font-bold text-slate-500 hover:text-slate-700 px-3 gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="w-full h-10 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 cursor-pointer rounded-xl"
            >
              <Plus className="w-4 h-4" />
              새 정기 과제 추가
            </Button>
          )}

          {/* ── 안내 박스 ── */}
          <div className="flex items-start gap-2 bg-sky-50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-xs text-sky-800">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-sky-500" />
            <span>
              설정된 날짜가 되면 과제가 자동으로 미확인 숙제 목록에 추가됩니다.
              일시중지 중인 정기 과제는 해당 날짜에 추가되지 않습니다.
            </span>
          </div>

          {/* ── 목록 ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-black text-slate-800">등록된 정기 과제</h3>
              <Badge variant="outline" className="text-xs font-bold text-slate-600 border-slate-300">
                {items.length}개
              </Badge>
            </div>

            {items.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl py-10 text-center">
                <CalendarClock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-500">등록된 정기 과제가 없습니다</p>
                <p className="text-xs text-slate-400 mt-1">위의 버튼으로 반복 과제를 추가해 보세요.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const nextDate = getNextTriggerDate(item);
                  const isConfirmDelete = deleteConfirmId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`bg-white border rounded-xl px-4 py-3 transition-all ${
                        item.isActive
                          ? 'border-slate-200 shadow-xs'
                          : 'border-slate-100 bg-slate-50/80 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* 왼쪽: 과제 정보 */}
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          {/* 활성 토글 */}
                          <Switch
                            checked={item.isActive}
                            onCheckedChange={() => toggleActive(item)}
                            className="mt-0.5 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-black text-slate-900 truncate">
                                {item.title}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold px-1.5 py-0 h-4 border shrink-0 ${FREQ_BADGE_COLOR[item.frequency]}`}
                              >
                                {describeSchedule(item)}
                              </Badge>
                              {!item.isActive && (
                                <Badge className="text-[10px] font-bold px-1.5 py-0 h-4 bg-slate-200 text-slate-500 border-0">
                                  일시중지
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                              <span>시작: {item.startDate}</span>
                              {item.endDate && <span>~ {item.endDate}</span>}
                              {!item.endDate && <span className="text-emerald-600 font-semibold">무기한</span>}
                              {nextDate && (
                                <>
                                  <span>·</span>
                                  <span className={`font-bold ${nextDate === '종료됨' ? 'text-slate-400' : 'text-indigo-600'}`}>
                                    다음: {nextDate}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 오른쪽: 액션 버튼 */}
                        <div className="flex items-center gap-1 shrink-0">
                          {isConfirmDelete ? (
                            <>
                              <span className="text-[11px] font-bold text-rose-600 mr-1">삭제?</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(item.id)}
                                className="h-7 px-2 text-[11px] font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg cursor-pointer"
                              >
                                확인
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteConfirmId(null)}
                                className="h-7 w-7 p-0 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleActive(item)}
                                className={`h-7 w-7 p-0 rounded-lg cursor-pointer ${
                                  item.isActive
                                    ? 'text-amber-500 hover:bg-amber-50'
                                    : 'text-emerald-500 hover:bg-emerald-50'
                                }`}
                                title={item.isActive ? '일시중지' : '재개'}
                              >
                                {item.isActive ? (
                                  <Pause className="w-3.5 h-3.5" />
                                ) : (
                                  <Play className="w-3.5 h-3.5" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEdit(item)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                                title="수정"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteConfirmId(item.id)}
                                className="h-7 w-7 p-0 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 푸터 닫기 */}
        <div className="shrink-0 px-5 py-3.5 border-t border-slate-100 flex justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 text-xs font-bold border-slate-200 text-slate-700 cursor-pointer"
          >
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
