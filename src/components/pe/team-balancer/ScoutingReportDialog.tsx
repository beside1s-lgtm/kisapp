'use client';

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip as RechartsTooltip,
} from "recharts";
import { Loader2, Wand2, CheckCircle2, Info, Trophy } from "lucide-react";
import type { Student } from '@/lib/pe/types';
import type { ScoutingReportOutput } from "@/ai/flows/scouting-report-flow";

export function ScoutingReportDialog({
  analyzingStudent,
  setAnalyzingStudent,
  isReportLoading,
  studentScores,
  scoutingReport,
}: {
  analyzingStudent: Student | null;
  setAnalyzingStudent: (val: Student | null) => void;
  isReportLoading: boolean;
  studentScores: Map<string, { totalScore: number; scores: { item: string; score: number }[] }>;
  scoutingReport: ScoutingReportOutput | null;
}) {
  return (
    <Dialog open={!!analyzingStudent} onOpenChange={(open) => !open && setAnalyzingStudent(null)}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-4">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="flex items-center gap-1.5 text-base font-black">
            <Wand2 className="h-4 w-4 text-indigo-600" />
            {analyzingStudent?.name} 학생 AI 분석 리포트
          </DialogTitle>
          <DialogDescription className="text-xs">
            {analyzingStudent?.grade}학년 백분위 기준 및 AI 추천 포지션
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-3 scrollbar-thin">
          {isReportLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 opacity-60" />
              <p className="font-bold text-xs text-slate-500 animate-pulse">
                AI 분석 리포트를 생성 중입니다...
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 레이더 차트 */}
              <div className="bg-slate-50 rounded-xl p-2 border border-slate-200">
                <div className="flex justify-between items-center mb-1 px-1">
                  <span className="text-[11px] font-black text-slate-700">능력치 스파이더웹</span>
                  <Badge className="text-[10px] font-black bg-indigo-600">
                    평균 {studentScores.get(analyzingStudent?.id || '')?.totalScore}점
                  </Badge>
                </div>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius="75%"
                      data={studentScores.get(analyzingStudent?.id || '')?.scores || []}
                    >
                      <PolarGrid strokeOpacity={0.2} />
                      <PolarAngleAxis dataKey="item" tick={{ fontSize: 9, fontWeight: 700 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                      <RechartsTooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* AI 스카우팅 결과 */}
              {scoutingReport ? (
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                    <span className="font-black text-emerald-800 flex items-center gap-1 mb-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 핵심 강점
                    </span>
                    <p className="text-[11px] text-emerald-950 leading-relaxed whitespace-pre-wrap">
                      {scoutingReport.strengths}
                    </p>
                  </div>

                  <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200">
                    <span className="font-black text-rose-800 flex items-center gap-1 mb-1 text-[11px]">
                      <Info className="w-3.5 h-3.5" /> 보완점
                    </span>
                    <p className="text-[11px] text-rose-950 leading-relaxed whitespace-pre-wrap">
                      {scoutingReport.weaknesses}
                    </p>
                  </div>

                  <div className="p-2.5 bg-indigo-50/70 rounded-lg border border-indigo-200">
                    <span className="font-black text-indigo-900 flex items-center gap-1 mb-1 text-[11px]">
                      <Trophy className="w-3.5 h-3.5" /> 종합 평가
                    </span>
                    <p className="text-[11px] text-indigo-950 leading-relaxed italic">
                      {scoutingReport.assessment}
                    </p>
                  </div>

                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="font-black text-amber-800 flex items-center gap-1 mb-1 text-[11px]">
                      <Wand2 className="w-3.5 h-3.5" /> 추천 포지션
                    </span>
                    <p className="text-[11px] font-black text-amber-950">
                      {scoutingReport.position}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-xs text-slate-400 py-6">분석 결과가 없습니다.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-2">
          <Button onClick={() => setAnalyzingStudent(null)} size="sm" className="w-full text-xs font-bold">
            확인 완료
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
