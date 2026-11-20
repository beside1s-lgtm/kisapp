'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Trophy,
  RotateCcw,
  Crown,
  Settings,
  Pencil,
  Check,
  Plus,
  Minus,
  Sprout,
  Users,
  Grid,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DeskSlot, SeatingConfig } from '@/lib/types/seating';
import { PraiseGrowthSettingModal } from './PraiseGrowthSettingModal';
import { getSavedClassTeams, type ClassTeamData, TEAM_COLOR_PALETTES } from '@/lib/types/teams';

export type PraiseGoalPeriod = 'daily' | 'weekly' | 'monthly' | 'semester' | 'yearly';

export const GOAL_PERIOD_LABELS: Record<PraiseGoalPeriod, string> = {
  daily: '오늘의 목표',
  weekly: '이번 주 목표',
  monthly: '월간 목표',
  semester: '학기 목표',
  yearly: '연간 목표',
};

const DEFAULT_PERIOD_GOALS: Record<PraiseGoalPeriod, number> = {
  daily: 50,
  weekly: 250,
  monthly: 1000,
  semester: 4000,
  yearly: 8000,
};

const PRESET_GOALS_BY_PERIOD: Record<PraiseGoalPeriod, number[]> = {
  daily: [20, 30, 50, 70, 100],
  weekly: [100, 150, 200, 250, 300, 500],
  monthly: [500, 700, 1000, 1500, 2000],
  semester: [2000, 3000, 4000, 5000, 6000],
  yearly: [5000, 7000, 8000, 10000, 15000],
};

interface PraiseGaugeBarProps {
  slots: DeskSlot[];
  config: SeatingConfig;
  classKey?: string;
  targetGoal?: number;
  onChangeTargetGoal?: (newGoal: number) => void;
  onResetPraise: () => void;
  extraActions?: React.ReactNode;
}

export const PraiseGaugeBar: React.FC<PraiseGaugeBarProps> = ({
  slots,
  config,
  classKey = 'default_class',
  targetGoal = 50,
  onChangeTargetGoal,
  onResetPraise,
  extraActions,
}) => {
  // 1. 집계 뷰 모드: 'ALL'(학급 전체) | 'DIVISION'(분단별) | 'GROUP'(모둠별)
  const [viewMode, setViewMode] = useState<'ALL' | 'DIVISION' | 'GROUP'>(
    config.layoutType === 'ROW' ? 'DIVISION' : config.layoutType === 'GROUP' ? 'GROUP' : 'ALL'
  );

  // 2. 목표 주기 상태 (드롭다운): daily | weekly | monthly | semester | yearly
  const [period, setPeriod] = useState<PraiseGoalPeriod>('daily');

  // 학급별 주기별 목표 점수 보관 상태
  const [periodGoals, setPeriodGoals] = useState<Record<PraiseGoalPeriod, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`kis_praise_period_goals_${classKey}`);
        if (saved) return { ...DEFAULT_PERIOD_GOALS, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_PERIOD_GOALS;
  });

  const currentGoal = periodGoals[period] || targetGoal || 50;

  // 3. 목표 설정 팝오버 상태
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const [customGoalInput, setCustomGoalInput] = useState<number>(currentGoal);

  // 4. 칭찬 성장 체계(티어) 모달 상태
  const [isGrowthModalOpen, setIsGrowthModalOpen] = useState(false);

  // 5. 팀 나누기 데이터 로드
  const [teams, setTeams] = useState<ClassTeamData[]>([]);
  useEffect(() => {
    setTeams(getSavedClassTeams(classKey));
    const handleUpdate = () => setTeams(getSavedClassTeams(classKey));
    window.addEventListener('class-teams-updated', handleUpdate);
    return () => window.removeEventListener('class-teams-updated', handleUpdate);
  }, [classKey]);

  useEffect(() => {
    setCustomGoalInput(currentGoal);
  }, [currentGoal]);

  // 학급 총 칭찬 포인트 계산
  const totalClassPraise = slots.reduce((acc, s) => {
    return s.studentId ? acc + (s.praisePoints || 0) : acc;
  }, 0);

  const pct = Math.min(100, Math.round((totalClassPraise / currentGoal) * 100));

  // 분단별 칭찬 포인트 집계 (분단 번호 기준: 1분단, 2분단, ...)
  const divisionStatsList = useMemo(() => {
    const divMap = new Map<number, { praiseTotal: number; studentCount: number }>();
    slots.forEach((s) => {
      if (!s.isActive || !s.studentId) return;
      const divNum = s.groupId || 1;
      const cur = divMap.get(divNum) || { praiseTotal: 0, studentCount: 0 };
      cur.praiseTotal += s.praisePoints || 0;
      cur.studentCount += 1;
      divMap.set(divNum, cur);
    });

    return Array.from(divMap.entries())
      .map(([divNum, stat]) => ({
        id: divNum,
        label: `${divNum}분단`,
        praiseTotal: stat.praiseTotal,
        studentCount: stat.studentCount,
        avg: stat.studentCount > 0 ? (stat.praiseTotal / stat.studentCount).toFixed(1) : '0',
      }))
      .sort((a, b) => a.id - b.id);
  }, [slots]);

  // 모둠별 칭찬 포인트 집계 (모둠 번호 또는 팀 나누기 팀 기준)
  const groupStatsList = useMemo(() => {
    if (teams && teams.length > 0) {
      // 팀 나누기 팀 기준 집계
      const studentPraiseMap = new Map<string, number>();
      slots.forEach((s) => {
        if (s.studentId) studentPraiseMap.set(s.studentId, s.praisePoints || 0);
        if (s.studentNum) studentPraiseMap.set(String(s.studentNum), s.praisePoints || 0);
      });

      return teams.map((team) => {
        const theme =
          TEAM_COLOR_PALETTES.find((p) => p.id === team.themeId) || TEAM_COLOR_PALETTES[0];
        let total = 0;
        let count = 0;
        team.memberStudentIds.forEach((mId) => {
          if (studentPraiseMap.has(mId)) {
            total += studentPraiseMap.get(mId) || 0;
            count += 1;
          }
        });

        return {
          id: team.id,
          label: team.name,
          theme,
          praiseTotal: total,
          studentCount: count || team.memberStudentIds.length,
          avg: count > 0 ? (total / count).toFixed(1) : '0',
        };
      });
    }

    // 모둠 번호 기준 집계 (config.layoutType === 'GROUP'인 경우)
    const grpMap = new Map<number, { praiseTotal: number; studentCount: number }>();
    slots.forEach((s) => {
      if (!s.isActive || !s.studentId) return;
      const gId = s.groupId || 1;
      const cur = grpMap.get(gId) || { praiseTotal: 0, studentCount: 0 };
      cur.praiseTotal += s.praisePoints || 0;
      cur.studentCount += 1;
      grpMap.set(gId, cur);
    });

    return Array.from(grpMap.entries())
      .map(([gId, stat]) => ({
        id: gId,
        label: `${gId}모둠`,
        theme: TEAM_COLOR_PALETTES[(gId - 1) % TEAM_COLOR_PALETTES.length],
        praiseTotal: stat.praiseTotal,
        studentCount: stat.studentCount,
        avg: stat.studentCount > 0 ? (stat.praiseTotal / stat.studentCount).toFixed(1) : '0',
      }))
      .sort((a, b) => a.id - b.id);
  }, [slots, teams]);

  // 분단/모둠 1등 판별
  const topDivisionId = useMemo(() => {
    if (divisionStatsList.length === 0) return null;
    const max = Math.max(...divisionStatsList.map((d) => d.praiseTotal));
    return max > 0 ? divisionStatsList.find((d) => d.praiseTotal === max)?.id || null : null;
  }, [divisionStatsList]);

  const topGroupId = useMemo(() => {
    if (groupStatsList.length === 0) return null;
    const max = Math.max(...groupStatsList.map((g) => g.praiseTotal));
    return max > 0 ? groupStatsList.find((g) => g.praiseTotal === max)?.id || null : null;
  }, [groupStatsList]);

  // 주기별 목표 점수 변경 저장
  const handleSaveGoal = (val: number) => {
    if (val < 1) return;
    const updated = { ...periodGoals, [period]: val };
    setPeriodGoals(updated);
    setCustomGoalInput(val);
    try {
      localStorage.setItem(`kis_praise_period_goals_${classKey}`, JSON.stringify(updated));
    } catch {}

    if (period === 'daily' && onChangeTargetGoal) {
      onChangeTargetGoal(val);
    }
    setIsSettingOpen(false);
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-50/60 via-amber-50/50 to-blue-50/60 border-2 border-slate-200/90 rounded-3xl p-3.5 sm:p-5 shadow-sm space-y-3.5 font-sans">
      {/* ─── 1. 상단 컨트롤 바: 타이틀 + 3대 뷰 탭 + 주기 드롭다운 + 칭찬 성장 체계 버튼 ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b-2 border-slate-200/80">
        {/* 좌측: 타이틀 및 목표 드롭다운 */}
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="w-11 h-11 rounded-2xl bg-[#C49832] text-white flex items-center justify-center shadow-md border-b-4 border-[#8E6D21] shrink-0"
          >
            <Trophy className="w-6 h-6 text-white" />
          </motion.div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight whitespace-nowrap break-keep">
                우리 반 칭찬 온도계
              </span>
              <Badge className="bg-[#C49832] text-white font-black text-xs px-2 py-0.5 rounded-full border-b-2 border-[#8E6D21] shadow-2xs whitespace-nowrap">
                총 {totalClassPraise}점
              </Badge>
              {totalClassPraise >= currentGoal && (
                <span className="text-xs font-black text-[#2471B2] animate-bounce flex items-center gap-1 bg-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                  <Sparkles className="w-3.5 h-3.5 text-[#2471B2]" /> {GOAL_PERIOD_LABELS[period]} 달성!
                </span>
              )}
            </div>

            {/* 주기 드롭다운 선택 & 목표 점수 수정 팝오버 */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {/* 드롭다운: 오늘의 목표 / 이번 주 목표 / 월간 목표 / 학기 목표 / 연간 목표 */}
              <Select value={period} onValueChange={(val: PraiseGoalPeriod) => setPeriod(val)}>
                <SelectTrigger className="h-7 w-32 text-xs font-bold bg-white border border-amber-300 rounded-xl px-2 shadow-2xs focus:ring-[#C49832]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-2 border-slate-200 shadow-lg">
                  <SelectItem value="daily" className="text-xs font-bold">오늘의 목표</SelectItem>
                  <SelectItem value="weekly" className="text-xs font-bold">이번 주 목표</SelectItem>
                  <SelectItem value="monthly" className="text-xs font-bold">월간 목표</SelectItem>
                  <SelectItem value="semester" className="text-xs font-bold">학기 목표</SelectItem>
                  <SelectItem value="yearly" className="text-xs font-bold">연간 목표</SelectItem>
                </SelectContent>
              </Select>

              {/* 목표 점수 연필 버튼 및 팝오버 */}
              <Popover open={isSettingOpen} onOpenChange={setIsSettingOpen}>
                <PopoverTrigger asChild>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border-2 border-amber-300 text-amber-950 font-black text-xs hover:bg-amber-50 shadow-xs transition-colors cursor-pointer group select-none whitespace-nowrap"
                    title={`${GOAL_PERIOD_LABELS[period]} 점수 수정`}
                  >
                    <span className="font-mono text-[#8E6D21]">{currentGoal}점</span>
                    <span className="text-slate-500 group-hover:text-amber-800">
                      ({pct}%)
                    </span>
                    <Pencil className="w-3 h-3 text-[#C49832] opacity-70 group-hover:opacity-100" />
                  </motion.button>
                </PopoverTrigger>

                <PopoverContent align="start" className="w-80 p-4 space-y-3 z-50 rounded-3xl border-2 border-slate-200 shadow-xl">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-100">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                      <Settings className="w-4 h-4 text-[#C49832]" />
                      {GOAL_PERIOD_LABELS[period]} 점수 설정
                    </span>
                    <Badge variant="outline" className="text-[10px] font-black text-[#8E6D21] bg-amber-50 border-amber-200 rounded-full">
                      현재 {currentGoal}점
                    </Badge>
                  </div>

                  {/* 추천 프리셋 */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">
                      추천 목표 점수
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PRESET_GOALS_BY_PERIOD[period].map((preset) => (
                        <motion.button
                          key={preset}
                          type="button"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleSaveGoal(preset)}
                          className={`h-8 rounded-xl text-xs font-black transition-all border-b-2 select-none ${
                            currentGoal === preset
                              ? 'bg-[#C49832] text-white border-[#8E6D21] shadow-xs'
                              : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-amber-50'
                          }`}
                        >
                          {preset}점
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* 직접 입력 */}
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-bold text-slate-600">
                      직접 입력
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-xl"
                        onClick={() => setCustomGoalInput((prev) => Math.max(5, prev - 10))}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Input
                        type="number"
                        min="5"
                        max="50000"
                        value={customGoalInput}
                        onChange={(e) => setCustomGoalInput(Number(e.target.value) || 0)}
                        className="h-8 text-xs font-bold font-mono text-center rounded-xl"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-xl"
                        onClick={() => setCustomGoalInput((prev) => prev + 10)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSaveGoal(customGoalInput)}
                        className="h-8 px-3 text-xs font-black bg-[#C49832] hover:bg-[#B0872A] text-white shrink-0 rounded-xl shadow-xs"
                      >
                        <Check className="w-3 h-3 mr-0.5" />
                        적용
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* 우측: 칭찬 조회 범위 드롭다운 + 배치도 확인/위젯 설정 액션 + 칭찬 성장 체계 버튼 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 칭찬 조회 범위 드롭다운 (가로폭 축소) */}
          <Select value={viewMode} onValueChange={(val: 'ALL' | 'DIVISION' | 'GROUP') => setViewMode(val)}>
            <SelectTrigger className="h-8 text-xs font-black bg-white border-2 border-slate-200/90 rounded-2xl px-2.5 w-[130px] sm:w-[140px] shrink-0 whitespace-nowrap break-keep shadow-2xs focus:ring-[#2471B2]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-2 border-slate-200 shadow-lg z-[100000]">
              <SelectItem value="ALL" className="text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  학급 전체
                </span>
              </SelectItem>
              <SelectItem value="DIVISION" className="text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  분단별 칭찬
                </span>
              </SelectItem>
              <SelectItem value="GROUP" className="text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5 text-purple-600" />
                  모둠별 칭찬
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* 그 옆자리로 배치된 추가 설정 (배치도에서 확인 토글 + 자리배치도 위젯 설정) */}
          {extraActions}

          {/* 칭찬 성장 체계(티어) 모달 열기 버튼 */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsGrowthModalOpen(true)}
            title="학생 칭찬 성장 체계 및 등급 설정"
            className="flex items-center gap-1.5 h-8 px-3 rounded-2xl text-xs font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs transition-all whitespace-nowrap"
          >
            <Sprout className="w-3.5 h-3.5 text-emerald-600" />
            <span>칭찬 시스템 설정</span>
          </motion.button>

          {/* 칭찬 전체 초기화 */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={onResetPraise}
            className="flex items-center gap-1 h-8 px-2.5 rounded-2xl text-xs font-bold bg-white hover:bg-rose-50 text-[#B01E23] border border-rose-200 shadow-2xs transition-all select-none whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3 text-[#B01E23]" />
            <span>초기화</span>
          </motion.button>
        </div>
      </div>

      {/* ─── 2. 메인 게이지 바 ─── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
          <span>{GOAL_PERIOD_LABELS[period]} 달성도</span>
          <span className="font-mono text-slate-800">{totalClassPraise}점 / {currentGoal}점 ({pct}%)</span>
        </div>
        <div className="relative w-full h-5 sm:h-6 bg-slate-100 rounded-full overflow-hidden border-2 border-slate-200/90 p-0.5 shadow-inner">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
            className="h-full bg-gradient-to-r from-[#2471B2] via-[#C49832] to-[#B01E23] rounded-full flex items-center justify-end pr-2 text-[10px] font-black text-white shadow-xs"
          >
            {pct > 12 && <span>{pct}%</span>}
          </motion.div>
        </div>
      </div>

      {/* ─── 3. 하단 집계 영역 (학급 전체 vs 분단별 vs 모둠별 뷰) ─── */}
      {/* 3-1. 학급 전체 칭찬 뷰 */}
      {viewMode === 'ALL' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-200/80 border-b-4 border-b-slate-300 shadow-2xs">
            <span className="text-xs font-bold text-slate-500 block mb-1">우리 반 학생수</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-900 font-mono">
                {slots.filter((s) => s.studentId).length}
              </span>
              <span className="text-xs text-slate-600">명 배정됨</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border-2 border-amber-200/90 border-b-4 border-b-amber-300 shadow-2xs">
            <span className="text-xs font-bold text-amber-800 block mb-1">학급 총 칭찬 포인트</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-[#8E6D21] font-mono">{totalClassPraise}</span>
              <span className="text-xs text-amber-700">점</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border-2 border-blue-200/90 border-b-4 border-b-blue-300 shadow-2xs">
            <span className="text-xs font-bold text-blue-800 block mb-1">학생 1인당 평균 칭찬</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-[#1A5384] font-mono">
                {slots.filter((s) => s.studentId).length > 0
                  ? (totalClassPraise / slots.filter((s) => s.studentId).length).toFixed(1)
                  : '0'}
              </span>
              <span className="text-xs text-blue-700">점</span>
            </div>
          </div>
        </div>
      )}

      {/* 3-2. 분단별 칭찬 뷰 */}
      {viewMode === 'DIVISION' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
            <span>분단별 칭찬 현황</span>
            <span>총 {divisionStatsList.length}개 분단</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {divisionStatsList.map((d) => {
              const isTop = topDivisionId === d.id && d.praiseTotal > 0;
              const maxTotal = Math.max(...divisionStatsList.map((x) => x.praiseTotal), 1);
              const barPct = Math.min(100, Math.round((d.praiseTotal / maxTotal) * 100));

              return (
                <motion.div
                  key={d.id}
                  whileHover={{ scale: 1.03, y: -2 }}
                  className={`p-3 rounded-2xl border-2 transition-all select-none ${
                    isTop
                      ? 'bg-amber-50/90 border-[#C49832] border-b-4 border-b-[#8E6D21] shadow-sm'
                      : 'bg-white border-slate-200/80 border-b-4 border-b-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-xs font-black text-slate-800 truncate">{d.label}</span>
                      {isTop && (
                        <Crown className="w-3.5 h-3.5 text-[#C49832] fill-[#C49832] animate-pulse shrink-0" />
                      )}
                    </div>
                    <span className="text-xs font-black text-[#8E6D21] font-mono shrink-0 ml-1">
                      {d.praiseTotal}점
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-1.5 border border-slate-200/60">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                      className={`h-full rounded-full ${isTop ? 'bg-[#C49832]' : 'bg-[#2471B2]'}`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                    <span>{d.studentCount}명</span>
                    <span>평균 {d.avg}점</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3-3. 모둠별 칭찬 뷰 (모둠 설정 시 또는 팀 나누기 팀) */}
      {viewMode === 'GROUP' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
            <span>
              {teams.length > 0 ? '팀 나누기 모둠별 칭찬 현황' : '모둠별 칭찬 현황'}
            </span>
            <span>총 {groupStatsList.length}개 모둠</span>
          </div>

          {groupStatsList.length === 0 ? (
            <div className="p-4 text-center border-2 border-dashed rounded-2xl bg-white text-xs text-slate-500">
              현재 설정된 모둠이나 팀이 없습니다. 상단 [팀 나누기] 탭에서 팀을 생성하시면 모둠별 칭찬이 실시간 연동됩니다.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {groupStatsList.map((g) => {
                const isTop = topGroupId === g.id && g.praiseTotal > 0;
                const maxTotal = Math.max(...groupStatsList.map((x) => x.praiseTotal), 1);
                const barPct = Math.min(100, Math.round((g.praiseTotal / maxTotal) * 100));

                return (
                  <motion.div
                    key={g.id}
                    whileHover={{ scale: 1.03, y: -2 }}
                    className={`p-3 rounded-2xl border-2 transition-all select-none ${
                      isTop
                        ? 'bg-amber-50/90 border-[#C49832] border-b-4 border-b-[#8E6D21] shadow-sm'
                        : `${g.theme?.bg || 'bg-white'} ${g.theme?.border || 'border-slate-200/80'} border-b-4 shadow-2xs`
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-xs font-black text-slate-800 truncate">{g.label}</span>
                        {isTop && (
                          <Crown className="w-3.5 h-3.5 text-[#C49832] fill-[#C49832] animate-pulse shrink-0" />
                        )}
                      </div>
                      <span className="text-xs font-black text-[#8E6D21] font-mono shrink-0 ml-1">
                        {g.praiseTotal}점
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-1.5 border border-slate-200/60">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barPct}%` }}
                        transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                        className={`h-full rounded-full ${isTop ? 'bg-[#C49832]' : g.theme?.badge || 'bg-[#2471B2]'}`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                      <span>{g.studentCount}명</span>
                      <span>평균 {g.avg}점</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 칭찬 성장 체계(티어) 및 보상 관리 모달 */}
      <PraiseGrowthSettingModal
        isOpen={isGrowthModalOpen}
        onOpenChange={setIsGrowthModalOpen}
        classKey={classKey}
        slots={slots}
      />
    </div>
  );
};
