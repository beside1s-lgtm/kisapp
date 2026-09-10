'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';
import type { OrgStructure, UserProfile } from '@/lib/types';
import { checkPeAccessPermission, checkHealthAccessPermission, checkHomeroomAccessPermission } from '@/lib/services/permissionService';

export interface TaskAssignmentContext {
  email: string;
  profile?: UserProfile | null;
  orgData?: Partial<OrgStructure> | null;
  isAdmin?: boolean;
  isHead?: boolean;
  homeroom?: string | null;
  department?: string | null;
  isAfterschoolManager?: boolean;
  isBusManager?: boolean;
  hasAfterschoolCourses?: boolean;
  hasAssignedBus?: boolean;
  canAccessPe?: boolean;
  canAccessHealth?: boolean;
  isHomeroomTeacher?: boolean;
}

export interface MajorTaskDefinition {
  id: string;
  name: string;
  badge: string;
  description: string;
  getHref: (isAdmin?: boolean, isHead?: boolean) => string;
  themeColor: 'teal' | 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'indigo' | 'sky';
  checkAssigned: (ctx: TaskAssignmentContext) => boolean;
}

export const ALL_MAJOR_TASKS: MajorTaskDefinition[] = [
  {
    id: 'homeroom',
    name: '담임 교원 업무',
    badge: '담임업무',
    description: '출결·체험학습 대리 신청, 학급 학생 관리',
    getHref: () => '/teacher/homeroom',
    themeColor: 'amber',
    checkAssigned: (ctx) => {
      if (ctx.profile?.role === '강사') return false;
      const { canAccess } = checkHomeroomAccessPermission(ctx.email, ctx.profile, ctx.orgData);
      return canAccess;
    },
  },
  {
    id: 'afterschool',
    name: '방과후학교 관리',
    badge: '방과후',
    description: '강좌 개설, 심사, 수강 확정 및 출석부 관리',
    getHref: (isAdmin) => (isAdmin ? '/admin/afterschool' : '/teacher/afterschool'),
    themeColor: 'teal',
    checkAssigned: (ctx) => {
      if (ctx.profile?.role === '강사') return true;
      if (ctx.isAdmin) return true;
      if (ctx.isAfterschoolManager) return true;
      if (ctx.hasAfterschoolCourses) return true;
      const emailLower = ctx.email.toLowerCase();
      if (ctx.orgData?.afterschoolManagers?.some((m) => m.toLowerCase() === emailLower)) return true;
      if (ctx.orgData?.afterschoolManager?.toLowerCase() === emailLower) return true;
      if (
        ctx.orgData?.customDutyRoles?.some(
          (r) =>
            (r.roleName.includes('방과후') || r.permissions?.features?.includes('afterschool_admin')) &&
            r.teacherEmails?.some((e) => e.toLowerCase() === emailLower)
        )
      )
        return true;
      if (
        ctx.orgData?.departments?.some((d) =>
          d.tasks?.some(
            (t) => t.taskName.includes('방과후') && t.assignedEmails?.some((e) => e.toLowerCase() === emailLower)
          )
        )
      )
        return true;
      return false;
    },
  },
  {
    id: 'bus',
    name: '스쿨버스 관리',
    badge: '스쿨버스',
    description: '버스 노선, 좌석 배정 및 실시간 탑승 관리',
    getHref: (isAdmin) => (isAdmin ? '/admin/bus' : '/teacher/bus'),
    themeColor: 'blue',
    checkAssigned: (ctx) => {
      if (ctx.profile?.role === '강사') return true;
      if (ctx.isAdmin) return true;
      if (ctx.isBusManager) return true;
      if (ctx.hasAssignedBus) return true;
      if ((ctx.profile as any)?.assignedBusId) return true;
      const emailLower = ctx.email.toLowerCase();
      if (ctx.orgData?.busManagers?.some((m) => m.toLowerCase() === emailLower)) return true;
      if (ctx.orgData?.busManager?.toLowerCase() === emailLower) return true;
      if (
        ctx.orgData?.customDutyRoles?.some(
          (r) =>
            (r.roleName.includes('버스') || r.roleName.includes('스쿨버스') || r.permissions?.features?.includes('bus_admin')) &&
            r.teacherEmails?.some((e) => e.toLowerCase() === emailLower)
        )
      )
        return true;
      if (
        ctx.orgData?.departments?.some((d) =>
          d.tasks?.some(
            (t) => (t.taskName.includes('버스') || t.taskName.includes('교통')) && t.assignedEmails?.some((e) => e.toLowerCase() === emailLower)
          )
        )
      )
        return true;
      return false;
    },
  },
  {
    id: 'sports',
    name: '학교 체육 (PAPS)',
    badge: '학교체육',
    description: 'PAPS 체력 측정, 리그전 및 체육 활동 관리',
    getHref: () => '/teacher/pe',
    themeColor: 'indigo',
    checkAssigned: (ctx) => {
      if (ctx.profile?.role === '강사') return false;
      if (ctx.isAdmin) return true;
      if (ctx.canAccessPe) return true;
      return checkPeAccessPermission(ctx.email, ctx.profile, ctx.orgData);
    },
  },
  {
    id: 'health',
    name: '학생 건강 (보건실)',
    badge: '보건실',
    description: '학생 건강기록, 보건실 방문 및 투약 관리',
    getHref: () => '/teacher/health',
    themeColor: 'emerald',
    checkAssigned: (ctx) => {
      if (ctx.profile?.role === '강사') return false;
      if (ctx.isAdmin) return true;
      if (ctx.canAccessHealth) return true;
      return checkHealthAccessPermission(ctx.email, ctx.profile, ctx.orgData);
    },
  },
  {
    id: 'duty',
    name: '교원 복무 관리',
    badge: '교원복무',
    description: '연가, 병가, 출장, 조퇴 신청 및 복무 잔여 현황',
    getHref: () => '/teacher/duty',
    themeColor: 'emerald',
    checkAssigned: (ctx) => {
      if (ctx.profile?.role === '강사') return false;
      if (ctx.isAdmin) return true;
      const roleLower = (ctx.profile?.role || '').toLowerCase();
      if (roleLower.includes('student') || roleLower.includes('parent')) return false;
      return true;
    },
  },
  {
    id: 'overtime',
    name: '초과근무 관리',
    badge: '초과근무',
    description: '시간외근무 신청 내역 및 누적 인정시간 조회',
    getHref: () => '/teacher/overtime',
    themeColor: 'sky',
    checkAssigned: (ctx) => {
      if (ctx.profile?.role === '강사') return false;
      if (ctx.isAdmin) return true;
      const roleLower = (ctx.profile?.role || '').toLowerCase();
      if (roleLower.includes('student') || roleLower.includes('parent')) return false;
      return true;
    },
  },
  {
    id: 'student-accounts',
    name: '통합 학생 계정 관리',
    badge: '학생계정',
    description: '학생 및 학부모 계정 발급, 비밀번호 초기화',
    getHref: () => '/admin/students',
    themeColor: 'violet',
    checkAssigned: (ctx) => {
      if (ctx.profile?.role === '강사') return false;
      if (ctx.isAdmin) return true;
      const emailLower = ctx.email.toLowerCase();
      if (ctx.orgData?.systemManagers?.some((m) => m.toLowerCase() === emailLower)) return true;
      if (
        ctx.orgData?.customDutyRoles?.some(
          (r) =>
            (r.roleName.includes('계정') || r.roleName.includes('학생') || r.roleName.includes('정보') || r.roleName.includes('전산') || r.permissions?.features?.includes('student_admin')) &&
            r.teacherEmails?.some((e) => e.toLowerCase() === emailLower)
        )
      )
        return true;
      if (
        ctx.orgData?.departments?.some((d) =>
          d.tasks?.some(
            (t) => (t.taskName.includes('학생') || t.taskName.includes('계정') || t.taskName.includes('정보') || t.taskName.includes('전산')) && t.assignedEmails?.some((e) => e.toLowerCase() === emailLower)
          )
        )
      )
        return true;
      return false;
    },
  },
  {
    id: 'parent-requests',
    name: '학부모 신청서 관리',
    badge: '신청서',
    description: '학부모 온라인 신청 내역 접수 및 출결/체험 대장',
    getHref: () => '/attendance-registry',
    themeColor: 'rose',
    checkAssigned: (ctx) => {
      if (ctx.profile?.role === '강사') return false;
      if (ctx.isAdmin) return true;
      if (ctx.isHomeroomTeacher || ctx.homeroom) return true;
      const emailLower = ctx.email.toLowerCase();
      if (ctx.orgData?.academicHead?.toLowerCase() === emailLower) return true;
      if (ctx.orgData?.systemManagers?.some((m) => m.toLowerCase() === emailLower)) return true;
      if (
        ctx.orgData?.customDutyRoles?.some(
          (r) =>
            (r.roleName.includes('출결') || r.roleName.includes('체험학습') || r.roleName.includes('학부모') || r.permissions?.documents?.includes('doc_absence')) &&
            r.teacherEmails?.some((e) => e.toLowerCase() === emailLower)
        )
      )
        return true;
      if (
        ctx.orgData?.departments?.some((d) =>
          d.tasks?.some(
            (t) => (t.taskName.includes('출결') || t.taskName.includes('신청서') || t.taskName.includes('학부모')) && t.assignedEmails?.some((e) => e.toLowerCase() === emailLower)
          )
        )
      )
        return true;
      return false;
    },
  },
  {
    id: 'vacation-bus',
    name: '방학 버스 관리',
    badge: '방학버스',
    description: '방학 중 스쿨버스 노선 및 수강생 탑승 관리',
    getHref: () => '/admin/bus',
    themeColor: 'indigo',
    checkAssigned: (ctx) => {
      if (ctx.profile?.role === '강사') return false;
      if (ctx.isAdmin) return true;
      if (ctx.isBusManager) return true;
      const emailLower = ctx.email.toLowerCase();
      if (ctx.orgData?.busManagers?.some((m) => m.toLowerCase() === emailLower)) return true;
      if (ctx.orgData?.busManager?.toLowerCase() === emailLower) return true;
      return false;
    },
  },
];

const STORAGE_KEY_PREFIX = 'kis_dashboard_major_tasks_v2_';

export function getSavedMajorTaskIds(userEmail?: string, availableIds?: string[]): string[] {
  if (typeof window === 'undefined') {
    return availableIds && availableIds.length > 0 ? availableIds.slice(0, 3) : [];
  }
  const key = `${STORAGE_KEY_PREFIX}${userEmail?.toLowerCase() || 'default'}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (availableIds && availableIds.length > 0) {
          const filtered = parsed.filter((id) => availableIds.includes(id));
          if (filtered.length > 0) return filtered;
        } else {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved major tasks:', e);
  }
  return availableIds && availableIds.length > 0 ? availableIds.slice(0, 3) : [];
}

export function saveMajorTaskIds(ids: string[], userEmail?: string) {
  if (typeof window === 'undefined') return;
  const key = `${STORAGE_KEY_PREFIX}${userEmail?.toLowerCase() || 'default'}`;
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch (e) {
    console.warn('Failed to save major tasks:', e);
  }
}

interface MajorTasksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onSave: (ids: string[]) => void;
  availableTasks?: MajorTaskDefinition[];
  userEmail?: string;
}

export function MajorTasksModal({
  open,
  onOpenChange,
  selectedIds,
  onSave,
  availableTasks = ALL_MAJOR_TASKS,
  userEmail,
}: MajorTasksModalProps) {
  const [currentSelected, setCurrentSelected] = useState<string[]>(selectedIds);

  useEffect(() => {
    // 사용 가능한 업무 중 선택된 것만 반영
    const validIds = selectedIds.filter((id) => availableTasks.some((t) => t.id === id));
    setCurrentSelected(validIds);
  }, [selectedIds, availableTasks, open]);

  const handleToggle = (id: string) => {
    setCurrentSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // 최소 1개 유지
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
    const defaultIds = availableTasks.map((t) => t.id).slice(0, 3);
    setCurrentSelected(defaultIds);
  };

  const handleApply = () => {
    saveMajorTaskIds(currentSelected, userEmail);
    onSave(currentSelected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 rounded-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <span>주요 담당 업무 설정</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            선생님의 실제 담당 업무 중 대시보드 상단에 항상 노출할 항목을 최대 3개까지 선택하세요.
          </p>
        </DialogHeader>

        {availableTasks.length === 0 ? (
          <div className="py-8 px-4 text-center space-y-2 border border-dashed rounded-xl bg-slate-50/50">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-700">배정된 주요 담당 업무가 없습니다.</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              조직도에서 담임, 방과후, 스쿨버스, 체육/보건, 부서 업무 등이 배정되면 자동으로 선택 가능한 목록이 나타납니다.
            </p>
          </div>
        ) : (
          <div className="space-y-2 py-2 max-h-[360px] overflow-y-auto overscroll-contain">
            {availableTasks.map((task) => {
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
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span>선택됨: {currentSelected.length} / {Math.min(3, availableTasks.length)}개</span>
          {availableTasks.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>기본값 복원</span>
            </button>
          )}
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
            disabled={availableTasks.length === 0}
            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            설정 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
