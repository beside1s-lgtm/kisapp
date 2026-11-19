'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { OrgStructure } from '@/lib/types';
import { getOrgStructure } from '@/lib/services/settingsService';
import { getAssignedDutiesForTeacher } from '@/lib/services/handoverService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, Search, PlusCircle, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

export const STANDARD_SYSTEM_DUTIES = [
  '학교 체육/PAPS 관리',
  '학생 건강/보건실 관리',
  '학생 안전지도 관리',
  '방과후학교 총괄 관리',
  '스쿨버스 운영 관리',
  '학생출결 및 학적 총괄 관리',
  '교원 복무/근태 관리',
  '학년 말 인수인계 총괄 관리',
  '특수교육 지원 관리',
  '도서관/사서 관리',
  '봉사활동 총괄 관리',
  '시스템 설정 관리',
];

interface PrimaryDutyComboboxProps {
  values: string[];
  onChange: (vals: string[]) => void;
  orgStructure?: Partial<OrgStructure> | null;
  userEmail?: string;
  placeholder?: string;
  className?: string;
}

export function PrimaryDutyCombobox({
  values,
  onChange,
  orgStructure,
  userEmail,
  placeholder = '담당 업무를 선택하거나 직접 추가하세요 (복수 선택)',
  className,
}: PrimaryDutyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loadedOrg, setLoadedOrg] = useState<Partial<OrgStructure> | null>(orgStructure || null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!orgStructure) {
      getOrgStructure().then(org => {
        if (org) setLoadedOrg(org);
      });
    } else {
      setLoadedOrg(orgStructure);
    }
  }, [orgStructure]);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const dialogEl = triggerRef.current.closest('[role="dialog"]') as HTMLElement | null;

    setPortalTarget(dialogEl || document.body);

    const cs = dialogEl ? window.getComputedStyle(dialogEl) : null;
    const bTop = cs ? parseFloat(cs.borderTopWidth) || 0 : 0;
    const bLeft = cs ? parseFloat(cs.borderLeftWidth) || 0 : 0;
    const bBottom = cs ? parseFloat(cs.borderBottomWidth) || 0 : 0;

    const containerRect = dialogEl
      ? dialogEl.getBoundingClientRect()
      : { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };

    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const openUpward = spaceBelow < 300 && triggerRect.top > spaceBelow;

    const nextStyle: React.CSSProperties = {
      position: 'fixed',
      zIndex: 9999,
      width: Math.max(triggerRect.width, 320),
      maxWidth: 'calc(100vw - 24px)',
    };

    if (openUpward) {
      nextStyle.bottom = containerRect.bottom - bBottom - triggerRect.top + 4;
    } else {
      nextStyle.top = triggerRect.bottom - (containerRect.top + bTop) + 4;
    }

    const leftOffset = triggerRect.left - (containerRect.left + bLeft);
    nextStyle.left = Math.max(8, leftOffset);

    setDropdownStyle(nextStyle);
  };

  useEffect(() => {
    if (!open) return;

    updatePosition();
    const focusTimer = setTimeout(() => searchInputRef.current?.focus(), 0);

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!panelRef.current || !panelRef.current.contains(target))
      ) {
        setOpen(false);
        setSearch('');
      }
    };

    const handleScrollOrResize = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) {
        return;
      }
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open]);

  // 접속한 교원에게 조직도 상 배정된 업무 목록 (상단 우선 노출용)
  const assignedDuties = useMemo(() => {
    if (!userEmail || !loadedOrg) return [];
    return getAssignedDutiesForTeacher(userEmail, loadedOrg);
  }, [userEmail, loadedOrg]);

  const assignedSet = useMemo(() => new Set(assignedDuties), [assignedDuties]);
  const selectedSet = useMemo(() => new Set(values), [values]);

  // 조직도 및 시스템 설정에 등록된 공식 업무 목록 + 현재 선택된 업무 (담임/교과전담 배제)
  const allDuties = useMemo(() => {
    const list = new Set<string>(assignedDuties);
    values.forEach(v => {
      if (v && v !== '일반 교무 업무') list.add(v);
    });
    STANDARD_SYSTEM_DUTIES.forEach(d => list.add(d));

    if (loadedOrg) {
      // 1. 시스템 설정 > 업무 담당 설정의 커스텀 업무 직책
      (loadedOrg.customDutyRoles || []).forEach(r => {
        if (r.roleName && !r.roleName.includes('담임') && !r.roleName.includes('교과')) {
          list.add(r.roleName);
        }
      });

      // 2. 부서 관리의 소관 업무
      (loadedOrg.departments || []).forEach(dept => {
        if (dept.name) list.add(`${dept.name} 총괄 업무`);
        (dept.tasks || []).forEach(t => {
          if (t.taskName && !t.taskName.includes('담임') && !t.taskName.includes('교과')) {
            list.add(t.taskName);
          }
        });
      });
    }

    return Array.from(list);
  }, [loadedOrg, assignedDuties, values]);

  // 검색 필터링
  const filteredDuties = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allDuties;
    return allDuties.filter(d => d.toLowerCase().includes(q));
  }, [allDuties, search]);

  const hasExactMatch = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allDuties.some(d => d.toLowerCase() === q);
  }, [allDuties, search]);

  const toggleDuty = (duty: string) => {
    if (selectedSet.has(duty)) {
      onChange(values.filter(v => v !== duty));
    } else {
      onChange([...values, duty]);
    }
  };

  const handleCustomSubmit = () => {
    const trimmed = search.trim();
    if (!trimmed) return;
    if (!selectedSet.has(trimmed)) {
      onChange([...values, trimmed]);
    }
    setSearch('');
  };

  const dropdownPanel = open && portalTarget ? createPortal(
    <div
      ref={panelRef}
      style={dropdownStyle}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className="p-2 bg-white border border-slate-200 shadow-2xl rounded-xl space-y-2 animate-in fade-in-0 zoom-in-95"
    >
      {/* 검색창 */}
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
        <Input
          ref={searchInputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!hasExactMatch && search.trim()) {
                handleCustomSubmit();
              } else if (filteredDuties.length > 0) {
                toggleDuty(filteredDuties[0]);
              }
            }
          }}
          placeholder="업무명 검색 또는 직접 입력 후 Enter..."
          className="h-8 pl-8 pr-2 text-xs bg-slate-50 border-slate-200 focus:bg-white"
        />
      </div>

      {/* 목록에 없는 경우 새 업무명 직접 추가 버튼 */}
      {search.trim() && !hasExactMatch && (
        <button
          type="button"
          onClick={handleCustomSubmit}
          className="w-full flex items-center justify-between p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors border border-indigo-200"
        >
          <div className="flex items-center gap-1.5 truncate">
            <PlusCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">직접 추가: &quot;{search.trim()}&quot;</span>
          </div>
          <Badge variant="outline" className="text-[10px] bg-white text-indigo-600 border-indigo-200 shrink-0">
            Enter
          </Badge>
        </button>
      )}

      {/* 업무 목록 스크롤 뷰 (복수 선택 토글) */}
      <div
        className="max-h-56 overflow-y-auto space-y-0.5 divide-y divide-slate-50 pr-0.5"
        onWheel={(e) => e.stopPropagation()}
      >
        {filteredDuties.length === 0 && !search.trim() && (
          <div className="p-3 text-center text-xs text-slate-400">등록된 업무 목록이 없습니다.</div>
        )}
        {filteredDuties.length === 0 && search.trim() && hasExactMatch && (
          <div className="p-3 text-center text-xs text-slate-400">검색 결과가 없습니다.</div>
        )}
        {filteredDuties.map(duty => {
          const isSelected = selectedSet.has(duty);
          const isAssigned = assignedSet.has(duty);
          return (
            <button
              key={duty}
              type="button"
              onClick={() => toggleDuty(duty)}
              className={cn(
                'w-full flex items-center justify-between gap-2 p-2 text-left text-xs rounded-md transition-colors',
                isSelected
                  ? 'bg-indigo-50/80 text-indigo-900 font-bold'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium'
              )}
            >
              <div className="flex items-center gap-2 truncate min-w-0">
                <span
                  className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                    isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-300 text-transparent'
                  )}
                >
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </span>
                <Briefcase className={cn('w-3.5 h-3.5 shrink-0', isSelected || isAssigned ? 'text-indigo-600' : 'text-slate-400')} />
                <span className="truncate">{duty}</span>
                {isAssigned && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-indigo-50 text-indigo-700 border-indigo-200 font-bold shrink-0">
                    배정 업무
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 하단 요약 및 선택 완료 닫기 버튼 */}
      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-500">
          총 <span className="text-indigo-700 font-bold">{values.length}개</span> 선택됨
        </span>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setOpen(false);
            setSearch('');
          }}
          className="h-7 px-2.5 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          선택 완료
        </Button>
      </div>
    </div>,
    portalTarget
  ) : null;

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open) {
            updatePosition();
            setOpen(true);
          } else {
            setOpen(false);
            setSearch('');
          }
        }}
        className="h-9 w-full flex items-center justify-between gap-2 px-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50/70 text-left text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {values.length === 0 ? (
            <span className="text-slate-400 truncate font-normal">{placeholder}</span>
          ) : (
            <>
              <span className="font-semibold text-slate-900 truncate">{values[0]}</span>
              {values.length > 1 && (
                <Badge className="bg-indigo-100 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold px-1.5 py-0 h-4.5 shrink-0">
                  외 {values.length - 1}건
                </Badge>
              )}
            </>
          )}
        </div>
        <ChevronsUpDown className="h-4 w-4 text-slate-400 shrink-0" />
      </button>
      {dropdownPanel}
    </div>
  );
}
