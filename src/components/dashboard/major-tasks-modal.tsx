'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, CheckCircle2, RotateCcw } from 'lucide-react';

export interface MajorTaskDefinition {
  id: string;
  name: string;
  badge: string;
  description: string;
  getHref: (isAdmin?: boolean, isHead?: boolean) => string;
  themeColor: 'teal' | 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'indigo';
}

export const ALL_MAJOR_TASKS: MajorTaskDefinition[] = [
  {
    id: 'afterschool',
    name: '방과후학교 관리',
    badge: '방과후',
    description: '강좌 개설, 심사, 수강 확정 및 출석부 총괄',
    getHref: (isAdmin) => (isAdmin ? '/admin/afterschool' : '/teacher/afterschool'),
    themeColor: 'teal',
  },
  {
    id: 'bus',
    name: '스쿨버스 관리',
    badge: '스쿨버스',
    description: '버스 노선, 좌석 배정 및 실시간 탑승 관리',
    getHref: (isAdmin) => (isAdmin ? '/admin/bus' : '/teacher/bus'),
    themeColor: 'blue',
  },
  {
    id: 'sports',
    name: '학교 체육 (PAPS)',
    badge: '학교체육',
    description: 'PAPS 체력 측정, 리그전 및 체육 활동 관리',
    getHref: () => '/admin/sports',
    themeColor: 'emerald',
  },
  {
    id: 'homeroom',
    name: '담임 교원 업무',
    badge: '담임업무',
    description: '호결 및 교외체험 대리 신청, 학급 학생 관리',
    getHref: () => '/teacher/homeroom',
    themeColor: 'amber',
  },
  {
    id: 'student-accounts',
    name: '통합 학생 계정 관리',
    badge: '학생계정',
    description: '학생 및 학부모 계정 발급, 비밀번호 초기화',
    getHref: () => '/admin/student-accounts',
    themeColor: 'violet',
  },
  {
    id: 'parent-requests',
    name: '학부모 신청서 관리',
    badge: '신청서',
    description: '학부모 온라인 신청 내역 접수 및 처리',
    getHref: () => '/admin/parent-requests',
    themeColor: 'rose',
  },
  {
    id: 'vacation-bus',
    name: '방학 버스 관리',
    badge: '방학버스',
    description: '방학 중 스쿨버스 노선 및 수강생 탑승 관리',
    getHref: () => '/admin/vacation-bus',
    themeColor: 'indigo',
  },
];

const STORAGE_KEY = 'kis_dashboard_major_tasks_v1';

export function getSavedMajorTaskIds(): string[] {
  if (typeof window === 'undefined') return ['afterschool', 'bus'];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ['afterschool', 'bus'];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {
    console.warn('Failed to parse saved major tasks:', e);
  }
  return ['afterschool', 'bus'];
}

export function saveMajorTaskIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (e) {
    console.warn('Failed to save major tasks:', e);
  }
}

interface MajorTasksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onSave: (ids: string[]) => void;
}

export function MajorTasksModal({ open, onOpenChange, selectedIds, onSave }: MajorTasksModalProps) {
  const [currentSelected, setCurrentSelected] = useState<string[]>(selectedIds);

  useEffect(() => {
    setCurrentSelected(selectedIds);
  }, [selectedIds, open]);

  const handleToggle = (id: string) => {
    setCurrentSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // 최소 1개는 유지
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 3) {
        // 최대 3개까지 선택 가능 (3개 초과 시 첫 번째 항목 제거 후 추가)
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const handleReset = () => {
    setCurrentSelected(['afterschool', 'bus']);
  };

  const handleApply = () => {
    saveMajorTaskIds(currentSelected);
    onSave(currentSelected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 rounded-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <span>주요 업무 바로가기 설정</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            대시보드 상단에 항상 노출할 주요 업무를 최대 3개까지 선택하세요.
          </p>
        </DialogHeader>

        <div className="space-y-2 py-2 max-h-[360px] overflow-y-auto">
          {ALL_MAJOR_TASKS.map((task) => {
            const isChecked = currentSelected.includes(task.id);
            const orderIndex = currentSelected.indexOf(task.id);

            return (
              <div
                key={task.id}
                onClick={() => handleToggle(task.id)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 select-none ${
                  isChecked
                    ? 'border-indigo-300 bg-indigo-50/50 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      isChecked
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {task.name}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 font-semibold bg-white">
                        {task.badge}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {task.description}
                    </p>
                  </div>
                </div>

                {isChecked && (
                  <Badge className="bg-indigo-600 text-white text-[9px] px-1.5 py-0 font-bold shrink-0">
                    배치 {orderIndex + 1}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span>선택됨: {currentSelected.length} / 3개</span>
          <button
            type="button"
            onClick={handleReset}
            className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>기본값 복원</span>
          </button>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-semibold"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            설정 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
