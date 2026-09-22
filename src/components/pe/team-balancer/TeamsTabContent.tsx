'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";
import { Shuffle, Sliders, Sparkles, BarChart2, Crown, ArrowRightLeft, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Student, Team } from '@/lib/pe/types';

export function TeamsTabContent({
  teams,
  selectedClassSummary,
  targetStudents,
  selectedItemNames,
  setActiveTab,
  handleBalanceTeams,
  scoreDeviation,
  teamOverallAverages,
  showRadar,
  setShowRadar,
  selectedTeamTab,
  setSelectedTeamTab,
  teamAverages,
  studentScores,
  setStudentToMove,
  handleRenameTeam,
  leftoverStudents,
}: {
  teams: Team[];
  selectedClassSummary: string;
  targetStudents: Student[];
  selectedItemNames: string[];
  setActiveTab: (tab: 'teams' | 'setup' | 'students') => void;
  handleBalanceTeams: () => void;
  scoreDeviation: number;
  teamOverallAverages: { teamId: string; name: string; count: number; avg: number }[];
  showRadar: boolean;
  setShowRadar: (val: boolean) => void;
  selectedTeamTab: string;
  setSelectedTeamTab: (val: string) => void;
  teamAverages: Map<string, { item: string; score: number }[]>;
  studentScores: Map<string, { totalScore: number; scores: { item: string; score: number }[] }>;
  setStudentToMove: (val: { student: Student; sourceTeamId: string } | null) => void;
  handleRenameTeam: (teamId: string, newName: string) => void;
  leftoverStudents: Student[];
}) {
  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden p-1.5 sm:p-2 space-y-1.5">
      {teams.length === 0 ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-white rounded-xl border border-dashed border-slate-300">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <Shuffle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-slate-800 mb-1">아직 편성된 팀이 없습니다</h3>
          <p className="text-xs text-slate-500 mb-4">
            대상: <span className="font-bold text-slate-700">{selectedClassSummary}</span> ({targetStudents.length}명)
            <br />
            종목: <span className="font-bold text-slate-700">{selectedItemNames.join(', ') || '미선택'}</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('setup')}
              className="h-8 text-xs font-bold"
            >
              <Sliders className="w-3.5 h-3.5 mr-1" />
              조건 설정하기
            </Button>
            <Button
              size="sm"
              onClick={handleBalanceTeams}
              disabled={targetStudents.length === 0 || selectedItemNames.length === 0}
              className="h-8 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              팀 자동 편성 실행
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* 팀 요약 & 서브 필터 바 */}
          <div className="flex items-center justify-between gap-1 px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-slate-500">평균 편차:</span>
              <Badge
                variant={scoreDeviation <= 3 ? 'default' : 'secondary'}
                className={cn(
                  "text-[10px] font-black px-1.5 py-0 h-4.5",
                  scoreDeviation <= 3 ? "bg-emerald-600" : "bg-amber-500 text-white"
                )}
              >
                {scoreDeviation}점 {scoreDeviation <= 3 ? '(우수)' : '(보통)'}
              </Badge>
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-600">
                {teamOverallAverages.map((t) => (
                  <span key={t.teamId} className="font-bold">
                    {t.name}: <span className="text-indigo-600">{t.avg}점</span>({t.count}명)
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                id="btn-toggle-radar"
                variant="ghost"
                size="sm"
                onClick={() => setShowRadar(!showRadar)}
                className={cn(
                  "h-6 px-1.5 text-[10px] font-bold rounded",
                  showRadar ? "bg-indigo-50 text-indigo-700" : "text-slate-500"
                )}
                title="스파이더웹 차트 토글"
              >
                <BarChart2 className="w-3 h-3 mr-0.5" />
                차트 {showRadar ? 'ON' : 'OFF'}
              </Button>

              {/* 3팀 이상일 때 탭 스위처 */}
              {teams.length > 2 && (
                <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded">
                  <button
                    type="button"
                    onClick={() => setSelectedTeamTab('all')}
                    className={cn(
                      "px-1.5 py-0.5 text-[10px] font-bold rounded",
                      selectedTeamTab === 'all' ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600"
                    )}
                  >
                    전체
                  </button>
                  {teams.map((t, idx) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTeamTab(t.id)}
                      className={cn(
                        "px-1.5 py-0.5 text-[10px] font-bold rounded",
                        selectedTeamTab === t.id ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600"
                      )}
                    >
                      {idx + 1}팀
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 팀 카드 그리드 (스크롤 없는 2열 분할 또는 탭 뷰) */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <div
              className={cn(
                "w-full h-full gap-1.5",
                selectedTeamTab !== 'all'
                  ? "flex flex-col"
                  : teams.length === 2
                  ? "grid grid-cols-2"
                  : "grid grid-cols-2 md:grid-cols-3 overflow-y-auto overscroll-contain pr-0.5"
              )}
            >
              {teams
                .filter((t) => selectedTeamTab === 'all' || selectedTeamTab === t.id)
                .map((t, tIdx) => {
                  const tAvg = teamOverallAverages.find((a) => a.teamId === t.id);
                  return (
                    <div
                      key={t.id}
                      className="flex flex-col h-full min-h-0 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden"
                    >
                      {/* 팀 카드 헤더 */}
                      <div className="px-2 py-1.5 bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200 flex items-center justify-between gap-1 shrink-0">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <span className="w-4 h-4 rounded bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                            {tIdx + 1}
                          </span>
                          <Input
                            value={t.name}
                            onChange={(e) => handleRenameTeam(t.id, e.target.value)}
                            className="h-6 text-[11px] font-black bg-transparent border-none p-0 focus-visible:ring-0 shadow-none text-slate-800 truncate"
                            placeholder="팀 이름"
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className="text-[10px] font-black px-1 py-0 bg-white text-indigo-700 border-indigo-200">
                            평균 {tAvg?.avg || 0}점
                          </Badge>
                          <span className="text-[10px] font-bold text-slate-400">
                            {t.members?.length || 0}명
                          </span>
                        </div>
                      </div>

                      {/* 옵션: 레이더 차트 (토글 켜졌을 때만 75px 미니 렌더링) */}
                      {showRadar && (
                        <div className="h-[75px] shrink-0 border-b border-slate-100 bg-slate-50/40">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={teamAverages.get(t.id)} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                              <PolarGrid strokeOpacity={0.2} />
                              <PolarAngleAxis dataKey="item" tick={{ fontSize: 7, fontWeight: 700 }} />
                              <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* 팀 멤버 목록 (내부 스크롤, 컴팩트 1줄) */}
                      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-1 space-y-0.5 scrollbar-thin">
                        {t.members?.map((m, mIdx) => {
                          const score = studentScores.get(m.id)?.totalScore ?? 0;
                          const isCaptainCandidate = mIdx === 0;
                          return (
                            <div
                              key={m.id}
                              data-student-row={m.id}
                              onClick={() => setStudentToMove({ student: m, sourceTeamId: t.id })}
                              className="px-1.5 py-1 rounded bg-slate-50 hover:bg-indigo-50/70 border border-slate-100 flex items-center justify-between text-[11px] transition-colors cursor-pointer group"
                            >
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="text-[9px] font-bold text-slate-400 w-3 text-center">
                                  {mIdx + 1}
                                </span>
                                <span className="font-bold text-slate-900 truncate student-name-label">
                                  {m.name}
                                </span>
                                <span className="text-[9px] text-slate-400 font-medium">
                                  {m.gender}
                                </span>
                                {isCaptainCandidate && (
                                  <span className="text-[8px] font-black px-1 py-0 bg-amber-100 text-amber-800 rounded border border-amber-300 flex items-center gap-0.5 shrink-0">
                                    <Crown className="w-2.5 h-2.5 text-amber-600" />
                                    주장
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[10px] font-bold text-slate-600">
                                  {score}점
                                </span>
                                <ArrowRightLeft className="w-2.5 h-2.5 text-slate-300 group-hover:text-indigo-600" />
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

          {/* 잔여 인원 안내 배너 (팀당 인원 기준 편성 시) */}
          {leftoverStudents.length > 0 && (
            <div className="px-2 py-1 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-1.5 text-xs shrink-0">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-[11px] font-bold text-amber-900">
                잔여 학생 {leftoverStudents.length}명: {leftoverStudents.map((s) => s.name).join(', ')}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
