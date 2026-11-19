'use client';

import React from 'react';
import { ShieldAlert, RefreshCw, PlusCircle, AlertTriangle, ClipboardCheck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface SafetyDashboardHeaderProps {
  managerName?: string;
  roleTitle?: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function SafetyDashboardHeader({
  managerName,
  roleTitle = '안전지도 담당자',
  isRefreshing,
  onRefresh,
}: SafetyDashboardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 flex items-center justify-center text-white shadow-md shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">학생 안전지도 관리</h1>
            <Badge variant="outline" className="text-[10px] font-bold text-rose-700 bg-rose-50 border-rose-200">
              {roleTitle}
            </Badge>
            {managerName && (
              <span className="text-[11px] font-semibold text-slate-500">
                담당: <b className="text-slate-800">{managerName}</b>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            안전교육, 안전점검의 날, 학교폭력예방교육 3대 핵심 업무 관리
          </p>
        </div>
      </div>

      {/* 퀵 액션 버튼 그룹 */}
      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-8 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border-slate-200"
          title="데이터 새로고침"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? 'animate-spin text-rose-600' : ''}`} />
          새로고침
        </Button>
      </div>
    </div>
  );
}
