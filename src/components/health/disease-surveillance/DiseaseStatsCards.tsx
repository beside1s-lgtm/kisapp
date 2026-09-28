'use client';

import React from 'react';
import { Activity, Building2, ShieldAlert, Stethoscope } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DiseaseStats } from './types';

interface DiseaseStatsCardsProps {
  stats: DiseaseStats;
  isAnnualMode: boolean;
  selectedMonth: string;
  schoolLevel: 'elementary' | 'secondary' | 'staff';
}

export function DiseaseStatsCards({
  stats,
  isAnnualMode,
  selectedMonth,
  schoolLevel,
}: DiseaseStatsCardsProps) {
  const isStaff = schoolLevel === 'staff';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200 rounded-xl p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-rose-700">
            {isStaff 
              ? (isAnnualMode ? '연간 총 질병 교직원' : `${selectedMonth}월 총 질병 교직원`)
              : (isAnnualMode ? '연간 총 결석 학생' : `${selectedMonth}월 총 결석 학생`)}
          </span>
          <Activity className="w-4 h-4 text-rose-600" />
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-rose-900">{stats.totalCount}</span>
          <span className="text-xs text-rose-600 font-semibold">명</span>
        </div>
        <p className="text-[11px] text-rose-600 mt-1">
          {isStaff ? '교직원 전체 병가/격리/질병 합계' : (schoolLevel === 'elementary' ? '초등 전 학년' : '중·고등 전 학년') + ' 병결/감염병 합계'}
        </p>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-blue-700">{isStaff ? '발생 부서 수' : '발생 학급 수'}</span>
          <Building2 className="w-4 h-4 text-blue-600" />
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-blue-900">{stats.classCount}</span>
          <span className="text-xs text-blue-600 font-semibold">{isStaff ? '개 부서' : '개 학급'}</span>
        </div>
        <p className="text-[11px] text-blue-600 mt-1">{isStaff ? '질병 발생 교직원 소속 부서' : '결석 발생 학급과 담임명만 표시'}</p>
      </div>

      <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-amber-700">{isStaff ? '현재 출근중지(격리)' : '현재 등교중지(격리)'}</span>
          <ShieldAlert className="w-4 h-4 text-amber-600" />
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-amber-900">{stats.isolatedCount}</span>
          <span className="text-xs text-amber-600 font-semibold">명</span>
        </div>
        <p className="text-[11px] text-amber-600 mt-1">{isStaff ? '법정감염병 및 병가 관리 중' : '법정감염병 유증상 관리 중'}</p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">주요 발생 병명</span>
          <Stethoscope className="w-4 h-4 text-slate-500" />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {stats.topDiseases.length > 0 ? (
            stats.topDiseases.map(([dName, cnt]) => (
              <Badge key={dName} variant="outline" className="text-[10px] font-bold bg-white text-slate-700 border-slate-200">
                {dName} <span className="text-rose-600 ml-1">{cnt}</span>
              </Badge>
            ))
          ) : (
            <span className="text-xs text-slate-400">발생 내역 없음</span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">기간 내 다발 질병 상위</p>
      </div>
    </div>
  );
}
