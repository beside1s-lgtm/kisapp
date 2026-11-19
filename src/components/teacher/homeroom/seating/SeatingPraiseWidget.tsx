'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Crown,
  ChevronDown,
  ChevronUp,
  Users,
  Grid,
  Layers,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DeskSlot, SeatingConfig } from '@/lib/types/seating';
import { getSavedClassTeams, type ClassTeamData, TEAM_COLOR_PALETTES } from '@/lib/types/teams';

export type PraiseWidgetViewMode = 'ALL' | 'DIVISION' | 'GROUP';

export interface PraiseWidgetConfig {
  defaultMode: PraiseWidgetViewMode;
  defaultOpen: boolean;
}

export const DEFAULT_PRAISE_WIDGET_CONFIG: PraiseWidgetConfig = {
  defaultMode: 'DIVISION',
  defaultOpen: false,
};

interface SeatingPraiseWidgetProps {
  slots: DeskSlot[];
  config: SeatingConfig;
  classKey?: string;
  targetGoal?: number;
}

export const SeatingPraiseWidget: React.FC<SeatingPraiseWidgetProps> = ({
  slots,
  config,
  classKey = 'default_class',
  targetGoal = 50,
}) => {
  // 1. 위젯 디폴트 설정 로드 (칭찬 탭에서 설정 가능)
  const [widgetConfig, setWidgetConfig] = useState<PraiseWidgetConfig>(() => {
    if (typeof window !== 'undefined' && classKey) {
      try {
        const saved = localStorage.getItem(`kis_praise_widget_config_${classKey}`);
        if (saved) return { ...DEFAULT_PRAISE_WIDGET_CONFIG, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_PRAISE_WIDGET_CONFIG;
  });

  // 2. 현재 위젯 열림/접힘 상태
  const [isOpen, setIsOpen] = useState<boolean>(() => widgetConfig.defaultOpen);

  // 3. 현재 선택된 뷰 모드 ('ALL' | 'DIVISION' | 'GROUP')
  const [viewMode, setViewMode] = useState<PraiseWidgetViewMode>(() => widgetConfig.defaultMode);

  // 4. 팀 나누기 데이터 로드
  const [teams, setTeams] = useState<ClassTeamData[]>([]);
  useEffect(() => {
    if (!classKey) return;
    setTeams(getSavedClassTeams(classKey));
    const handleTeamsUpdate = () => setTeams(getSavedClassTeams(classKey));
    window.addEventListener('class-teams-updated', handleTeamsUpdate);
    return () => window.removeEventListener('class-teams-updated', handleTeamsUpdate);
  }, [classKey]);

  // 5. 칭찬 탭에서의 위젯 설정 변경 이벤트 감지
  useEffect(() => {
    if (!classKey) return;
    const handleConfigUpdate = () => {
      try {
        const saved = localStorage.getItem(`kis_praise_widget_config_${classKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setWidgetConfig(parsed);
          setViewMode(parsed.defaultMode || 'DIVISION');
          setIsOpen(parsed.defaultOpen ?? false);
        }
      } catch {}
    };
    window.addEventListener('kis_praise_widget_config_updated', handleConfigUpdate);
    return () => window.removeEventListener('kis_praise_widget_config_updated', handleConfigUpdate);
  }, [classKey]);

  // 학급 총 칭찬 포인트 계산
  const totalClassPraise = useMemo(() => {
    return slots.reduce((acc, s) => {
      return s.studentId ? acc + (s.praisePoints || 0) : acc;
    }, 0);
  }, [slots]);

  const pct = Math.min(100, Math.round((totalClassPraise / (targetGoal || 50)) * 100));

  // 분단별 칭찬 포인트 집계
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

  // 모둠/팀별 칭찬 포인트 집계
  const groupStatsList = useMemo(() => {
    if (teams && teams.length > 0) {
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
        theme: undefined,
        praiseTotal: stat.praiseTotal,
        studentCount: stat.studentCount,
        avg: stat.studentCount > 0 ? (stat.praiseTotal / stat.studentCount).toFixed(1) : '0',
      }))
      .sort((a, b) => a.id - b.id);
  }, [slots, teams]);

  // 1위 분단 / 1위 모둠
  const topDivId = useMemo(() => {
    if (divisionStatsList.length === 0) return null;
    const sorted = [...divisionStatsList].sort((a, b) => b.praiseTotal - a.praiseTotal);
    return sorted[0]?.praiseTotal > 0 ? sorted[0].id : null;
  }, [divisionStatsList]);

  const topGroupId = useMemo(() => {
    if (groupStatsList.length === 0) return null;
    const sorted = [...groupStatsList].sort((a, b) => b.praiseTotal - a.praiseTotal);
    return sorted[0]?.praiseTotal > 0 ? sorted[0].id : null;
  }, [groupStatsList]);

  return (
    <div className="w-full bg-white/95 rounded-2xl border-2 border-slate-200/90 shadow-xs p-2 sm:p-2.5 mb-2 select-none transition-all">
      {/* ─── 위젯 헤더 바 (접힘/펼침 공통 상시 노출) ─── */}
      <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        {/* 좌측: 타이틀 및 학급/팀/분단 선택 드롭다운 */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white shadow-xs shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <span className="text-xs sm:text-sm font-black text-slate-800 tracking-tight shrink-0">
            칭찬 현황
          </span>

          {/* 학급 / 분단 / 모둠 선택 드롭다운 */}
          <Select
            value={viewMode}
            onValueChange={(val: PraiseWidgetViewMode) => setViewMode(val)}
          >
            <SelectTrigger className="h-7 text-xs font-bold bg-slate-50 border-slate-200 hover:bg-slate-100 rounded-lg px-2 w-[115px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
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
                  모둠·팀별 칭찬
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* 총 칭찬 점수 및 달성률 */}
          <span className="text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
            총 {totalClassPraise}점 / 목표 {targetGoal}점 ({pct}%)
          </span>
        </div>

        {/* 우측: 미니 게이지 바 및 접기/펼치기 토글 버튼 */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* 미니 프로그레스 바 */}
          <div className="w-20 sm:w-28 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shrink-0">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.3 }}
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
            />
          </div>

          {/* 접기/펼치기 토글 버튼 */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            title={isOpen ? '칭찬 현황 접기' : '칭찬 상세 현황 펼치기'}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer shrink-0"
          >
            <span>{isOpen ? '접기' : '상세보기'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ─── 위젯 펼쳐진 상태 (상세 카드 그리드) ─── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pt-2.5 border-t border-slate-100 mt-2"
          >
            {/* 1. 학급 전체 뷰 */}
            {viewMode === 'ALL' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500">학급 총 칭찬</div>
                  <div className="text-base sm:text-lg font-black text-amber-700">{totalClassPraise}점</div>
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500">목표 달성도</div>
                  <div className="text-base sm:text-lg font-black text-blue-700">{pct}%</div>
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500">학생당 평균</div>
                  <div className="text-base sm:text-lg font-black text-emerald-700">
                    {slots.filter((s) => s.studentId).length > 0
                      ? (totalClassPraise / slots.filter((s) => s.studentId).length).toFixed(1)
                      : 0}
                    점
                  </div>
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 text-center">
                  <div className="text-[10px] font-bold text-slate-500">칭찬받은 학생</div>
                  <div className="text-base sm:text-lg font-black text-purple-700">
                    {slots.filter((s) => s.studentId && (s.praisePoints || 0) > 0).length}명
                  </div>
                </div>
              </div>
            )}

            {/* 2. 분단별 칭찬 뷰 */}
            {viewMode === 'DIVISION' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {divisionStatsList.map((d) => {
                  const isTop = topDivId === d.id && d.praiseTotal > 0;
                  const maxTotal = Math.max(...divisionStatsList.map((x) => x.praiseTotal), 1);
                  const barPct = Math.min(100, Math.round((d.praiseTotal / maxTotal) * 100));

                  return (
                    <div
                      key={d.id}
                      className={`p-2 rounded-xl border transition-all ${
                        isTop
                          ? 'bg-amber-50/90 border-[#C49832] shadow-2xs'
                          : 'bg-white border-slate-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-black text-slate-800">{d.label}</span>
                          {isTop && <Crown className="w-3 h-3 text-[#C49832] fill-[#C49832]" />}
                        </div>
                        <span className="text-xs font-black text-[#8E6D21] font-mono">{d.praiseTotal}점</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                        <div
                          style={{ width: `${barPct}%` }}
                          className={`h-full rounded-full ${isTop ? 'bg-[#C49832]' : 'bg-[#2471B2]'}`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold">
                        <span>{d.studentCount}명</span>
                        <span>평균 {d.avg}점</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. 모둠/팀별 칭찬 뷰 */}
            {viewMode === 'GROUP' && (
              <div>
                {groupStatsList.length === 0 ? (
                  <div className="p-3 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                    현재 설정된 모둠이나 팀이 없습니다. 상단 [팀 나누기]에서 팀을 생성하시면 실시간 연동됩니다.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {groupStatsList.map((g) => {
                      const isTop = topGroupId === g.id && g.praiseTotal > 0;
                      const maxTotal = Math.max(...groupStatsList.map((x) => x.praiseTotal), 1);
                      const barPct = Math.min(100, Math.round((g.praiseTotal / maxTotal) * 100));

                      return (
                        <div
                          key={g.id}
                          className={`p-2 rounded-xl border transition-all ${
                            isTop
                              ? 'bg-amber-50/90 border-[#C49832] shadow-2xs'
                              : `${g.theme?.bg || 'bg-white'} ${g.theme?.border || 'border-slate-200'} shadow-2xs`
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-xs font-black text-slate-800 truncate">{g.label}</span>
                              {isTop && <Crown className="w-3 h-3 text-[#C49832] fill-[#C49832] shrink-0" />}
                            </div>
                            <span className="text-xs font-black text-[#8E6D21] font-mono shrink-0 ml-1">
                              {g.praiseTotal}점
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                            <div
                              style={{ width: `${barPct}%` }}
                              className={`h-full rounded-full ${isTop ? 'bg-[#C49832]' : g.theme?.badge || 'bg-[#2471B2]'}`}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold">
                            <span>{g.studentCount}명</span>
                            <span>평균 {g.avg}점</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
