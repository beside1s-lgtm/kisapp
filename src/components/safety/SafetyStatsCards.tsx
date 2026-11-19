'use client';

import React from 'react';
import { GraduationCap, CalendarCheck, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface SafetyStatsCardsProps {
  activeTab?: string;
  onSelectTab?: (tab: 'education' | 'inspection' | 'violence-prevention') => void;
}

export function SafetyStatsCards({ activeTab, onSelectTab }: SafetyStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
      {/* 1. 안전교육 카드 */}
      <Card
        onClick={() => onSelectTab?.('education')}
        className={`border shadow-2xs transition-all cursor-pointer relative overflow-hidden ${
          activeTab === 'education'
            ? 'border-rose-400 bg-rose-50/50 ring-2 ring-rose-200 shadow-xs'
            : 'border-slate-200 bg-white hover:border-rose-200 hover:bg-slate-50/60'
        }`}
      >
        <CardContent className="p-3 sm:p-3.5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-rose-800">1. 학생 안전교육</span>
            <div className="text-xs sm:text-sm font-black text-slate-800">
              학생 안전교육
            </div>
            <p className="text-[10px] text-slate-500 font-medium">7대 안전교육 이수 및 연간 계획</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* 2. 안전점검의 날 카드 */}
      <Card
        onClick={() => onSelectTab?.('inspection')}
        className={`border shadow-2xs transition-all cursor-pointer relative overflow-hidden ${
          activeTab === 'inspection'
            ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-200 shadow-xs'
            : 'border-slate-200 bg-white hover:border-amber-200 hover:bg-slate-50/60'
        }`}
      >
        <CardContent className="p-3 sm:p-3.5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-amber-800">2. 안전점검의 날</span>
            <div className="text-xs sm:text-sm font-black text-slate-800">
              매월 4일 정기 안전점검
            </div>
            <p className="text-[10px] text-slate-500 font-medium">교내외 시설물 및 방재 점검표</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* 3. 학교폭력예방교육 카드 */}
      <Card
        onClick={() => onSelectTab?.('violence-prevention')}
        className={`border shadow-2xs transition-all cursor-pointer relative overflow-hidden ${
          activeTab === 'violence-prevention'
            ? 'border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-200 shadow-xs'
            : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50/60'
        }`}
      >
        <CardContent className="p-3 sm:p-3.5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-indigo-800">3. 학교폭력예방교육</span>
            <div className="text-xs sm:text-sm font-black text-slate-800">
              학기별 학폭 예방 교육
            </div>
            <p className="text-[10px] text-slate-500 font-medium">어울림 프로그램 및 예방 캠페인</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
