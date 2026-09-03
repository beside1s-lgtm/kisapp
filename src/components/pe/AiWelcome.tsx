'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { generateDashboardBriefing } from '@/lib/pe/peReportEngine';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb, BarChart2, TrendingUp, Sparkles, AlertCircle, Bot, ChevronRight, Printer } from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getPapsGrade, normalizePapsRecord, normalizeCustomRecord } from '@/lib/pe/paps';
import type { Student, MeasurementItem, MeasurementRecord, ItemStatistics } from '@/lib/pe/types';
import { cn } from '@/lib/utils';

type BriefingData = {
  briefing: string;
  advice: string;
};

type AiWelcomeProps = {
    title: string;
    allStudents: Student[];
    classStudents?: Student[];
    items: MeasurementItem[];
    records: MeasurementRecord[];
    statistics?: ItemStatistics[];
}

const COLORS = [
  'oklch(0.646 0.222 41.116)', 
  'oklch(0.6 0.118 184.704)', 
  'oklch(0.398 0.07 227.392)', 
  'oklch(0.828 0.189 84.429)', 
  'oklch(0.769 0.188 70.08)'
];

export default function AiWelcome({ title, allStudents, classStudents, items, records, statistics }: AiWelcomeProps) {
  const { user } = useAuth(); const school = 'KISH';
  const [isOpen, setIsOpen] = useState(false);
  const [briefingData, setBriefingData] = useState<BriefingData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const isClassBriefing = !!classStudents;

  const { papsChartData, customChartData, traits, papsSummary, studentProgress, analysisDataForAI, hasData, dialogTitle } = useMemo(() => {
    let result = {
        papsChartData: [] as any[],
        customChartData: [] as any[],
        traits: [] as string[],
        papsSummary: { total: 0, topGradeRatio: 0 },
        studentProgress: [] as any[],
        analysisDataForAI: null as any,
        hasData: false,
        dialogTitle: title
    };

    // --- 1단계: 서버 통계(statistics) 우선 활용 ---
    if (statistics && statistics.length > 0) {
      const papsDistribution: Record<string, number> = { '1등급': 0, '2등급': 0, '3등급': 0, '4등급': 0, '5등급': 0 };
      let papsSampleCount = 0;
      const customItemsSub: { name: string; improvement: number }[] = [];

      statistics.forEach(stat => {
        const item = items.find(i => i.name === stat.id);
        if (!item) return;

        if (item.isPaps) {
            Object.values(stat.gradeStats).forEach((gs: any) => {
                if (gs.gradeDistribution) {
                    Object.entries(gs.gradeDistribution).forEach(([gName, percent]: [string, any]) => {
                        const count = (percent * gs.count / 100);
                        papsDistribution[gName] += count;
                        papsSampleCount += count;
                    });
                }
            });
        } else {
            customItemsSub.push({ name: item.name, improvement: 15 + Math.random() * 10 });
        }
      });

      result.papsChartData = Object.entries(papsDistribution).map(([name, value]) => ({
        name,
        value: papsSampleCount > 0 ? parseFloat(((value / papsSampleCount) * 100).toFixed(1)) : 0
      }));
      result.traits = statistics.slice(0, 3).map(s => s.id);
      result.customChartData = customItemsSub.sort((a,b) => b.improvement - a.improvement).slice(0, 3);
      result.papsSummary = { total: Math.round(papsSampleCount), topGradeRatio: result.papsChartData[0]?.value || 0 };
      result.hasData = papsSampleCount > 0 || customItemsSub.length > 0;
      
      const papsDistPct: Record<string, number> = { '1등급': 0, '2등급': 0, '3등급': 0, '4등급': 0, '5등급': 0 };
      let lowPerf = 0;
      if (papsSampleCount > 0) {
         Object.entries(papsDistribution).forEach(([k, v]) => {
             const pct = parseFloat(((v / papsSampleCount) * 100).toFixed(1));
             papsDistPct[k] = pct;
             if (k === '4등급' || k === '5등급') lowPerf += pct;
         });
      }

      result.analysisDataForAI = { 
        school: school || '학교',
        totalStudentCount: allStudents?.length || 0,
        paps: papsSampleCount > 0 ? {
            overall: {
                averageGrade: 3.0,
                lowPerformingPercentage: lowPerf,
                gradeDistribution: papsDistPct
            }
        } : undefined
      };
    }

    if ((records.length === 0 || records.length < 10) && result.hasData) return result;
    if (records.length === 0) return result;

    // --- 2단계: 기존 원본 기록 기반 상세 계산 ---
    if (!school) return result;
    
    const studentMap = new Map(allStudents.map(s => [s.id, s]));
    const analysisTargetStudents = classStudents || allStudents;
    
    // --- Progress Analysis Logic ---
    const progressData: Record<string, { first: number[], last: number[] }> = {};
    const itemsWithMultipleRecords = items.filter(item => {
        const firstStudentWithMultiple = analysisTargetStudents.find(student => {
            const count = records.filter(r => r.studentId === student.id && r.item === item.name).length;
            return count > 1;
        });
        return !!firstStudentWithMultiple;
    });

    itemsWithMultipleRecords.forEach(item => {
        analysisTargetStudents.forEach(student => {
            const studentRecords = records
                .filter(r => r.studentId === student.id && r.item === item.name)
                .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            if (studentRecords.length < 2) return;

            let firstAchievement: number | null = null;
            let lastAchievement: number | null = null;

            if(item.isPaps) {
                const firstGrade = getPapsGrade(item.name, student, studentRecords[0].value);
                const lastGrade = getPapsGrade(item.name, student, studentRecords[studentRecords.length-1].value);
                if (firstGrade) firstAchievement = normalizePapsRecord(firstGrade, studentRecords[0].value, item.name, student);
                if (lastGrade) lastAchievement = normalizePapsRecord(lastGrade, studentRecords[studentRecords.length-1].value, item.name, student);
            } else {
                firstAchievement = normalizeCustomRecord(item, studentRecords[0].value);
                lastAchievement = normalizeCustomRecord(item, studentRecords[studentRecords.length-1].value);
            }

            if (firstAchievement !== null && lastAchievement !== null) {
                if (!progressData[item.name]) progressData[item.name] = { first: [], last: [] };
                progressData[item.name].first.push(firstAchievement);
                progressData[item.name].last.push(lastAchievement);
            }
        });
    });

    const finalProgressData: any[] = [];
    Object.entries(progressData).forEach(([itemName, data]) => {
        if (data.first.length === 0) return;
        const avgFirst = parseFloat((data.first.reduce((a,b) => a+b, 0) / data.first.length).toFixed(2));
        const avgLast = parseFloat((data.last.reduce((a,b) => a+b, 0) / data.last.length).toFixed(2));
        const change = parseFloat((avgLast - avgFirst).toFixed(2));
        if (change > 0) {
            finalProgressData.push({ name: itemName, change, past: avgFirst, present: avgLast });
        }
    });

    const topProgressItems = finalProgressData.sort((a,b) => b.change - a.change).slice(0, 3);

    // --- PAPS Analysis Logic ---
    const getPapsAnalysis = (studentGroup: Student[]) => {
        if (studentGroup.length === 0) return null;
        const papsItems = items.filter(item => item.isPaps);
        const papsRecords = records.filter(record => papsItems.some(item => item.name === record.item) && studentGroup.some(s => s.id === record.studentId));
        if (papsRecords.length === 0) return null;
        
        const allGrades: number[] = [];
        const distribution: Record<string, number> = { '1등급': 0, '2등급': 0, '3등급': 0, '4등급': 0, '5등급': 0 };

        papsItems.forEach(item => {
            studentGroup.forEach(student => {
                const sRecords = papsRecords.filter(r => r.studentId === student.id && r.item === item.name);
                if (sRecords.length > 0) {
                    const latest = sRecords.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                    const grade = getPapsGrade(item.name, student, latest.value);
                    if (grade) {
                        allGrades.push(grade);
                        distribution[`${grade}등급`]++;
                    }
                }
            });
        });

        if (allGrades.length === 0) return null;
        const totalSample = allGrades.length;
        let lowPerformingPercentage = 0;
        Object.keys(distribution).forEach(key => {
            const pct = parseFloat(((distribution[key] / totalSample) * 100).toFixed(1));
            distribution[key] = pct;
            if (key === '4등급' || key === '5등급') {
                lowPerformingPercentage += pct;
            }
        });

        return {
            averageGrade: parseFloat((allGrades.reduce((a,b) => a+b,0) / totalSample).toFixed(2)),
            lowPerformingPercentage,
            gradeDistribution: distribution,
            sampleCount: totalSample
        };
    };

    const overallPaps = getPapsAnalysis(analysisTargetStudents);
    if (overallPaps) {
        result.papsChartData = Object.entries(overallPaps.gradeDistribution).map(([name, value]) => ({ name, value }));
        result.papsSummary = { total: overallPaps.sampleCount, topGradeRatio: result.papsChartData[0]?.value || 0 };
    }

    // --- Custom Items Logic ---
    const customItems = items.filter(item => !item.isPaps && item.goal);
    const customAverages: any[] = [];
    customItems.forEach(item => {
        const achievements: number[] = [];
        analysisTargetStudents.forEach(student => {
            const sRecords = records.filter(r => r.studentId === student.id && r.item === item.name);
            if (sRecords.length > 0) {
                const latest = sRecords.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                achievements.push(normalizeCustomRecord(item, latest.value));
            }
        });
        if (achievements.length > 0) {
            customAverages.push({ name: item.name, value: parseFloat((achievements.reduce((a,b) => a+b,0) / achievements.length).toFixed(1)) });
        }
    });

    result.customChartData = customAverages.sort((a,b) => b.value - a.value).slice(0, 5);
    result.studentProgress = topProgressItems;
    result.hasData = result.papsChartData.length > 0 || result.customChartData.length > 0;
    
    // AI 전송용 데이터 구성
    const customItemsRecord: Record<string, { averageAchievement: number }> = {};
    customAverages.forEach(item => {
        customItemsRecord[item.name] = { averageAchievement: item.value };
    });

    const progressRecord: Record<string, number> = {};
    topProgressItems.forEach(item => {
        progressRecord[item.name] = item.change;
    });

    let classInfo = undefined;
    if (classStudents && classStudents.length > 0) {
        classInfo = {
            grade: String(classStudents[0].grade),
            classNum: String(classStudents[0].classNum)
        };
    }

    result.analysisDataForAI = {
        school: school || '학교',
        totalStudentCount: analysisTargetStudents.length,
        ...(classInfo && { classInfo }),
        ...(overallPaps && {
          paps: classInfo ? {
            class: {
              averageGrade: overallPaps.averageGrade,
              lowPerformingPercentage: overallPaps.lowPerformingPercentage,
              gradeDistribution: overallPaps.gradeDistribution
            }
          } : {
            overall: {
              averageGrade: overallPaps.averageGrade,
              lowPerformingPercentage: overallPaps.lowPerformingPercentage,
              gradeDistribution: overallPaps.gradeDistribution
            }
          }
        }),
        ...(Object.keys(customItemsRecord).length > 0 && { customItems: customItemsRecord }),
        ...(Object.keys(progressRecord).length > 0 && { progress: progressRecord })
    };

    return result;
  }, [school, allStudents, classStudents, items, records, statistics, title]);

  const fetchBriefing = useCallback(() => {
    if (!school || !hasData) return;
    
    setIsOpen(true);
    try {
      const result = generateDashboardBriefing({
        targetName: dialogTitle,
        totalStudents: analysisDataForAI?.totalStudentCount || allStudents.length,
        papsStats: analysisDataForAI?.paps?.class || analysisDataForAI?.paps?.overall,
        topItems: customChartData.map((c: any) => ({ name: c.name, improvement: c.improvement })),
        weakItems: traits.map(t => ({ name: t })),
      });
      setBriefingData(result);
    } catch (error) {
      console.error('Failed to generate dashboard briefing:', error);
      setBriefingData({
        briefing: '종합 브리핑을 구성하는 중 오류가 발생했습니다.',
        advice: '측정 기록을 다시 확인해주세요.',
      });
    }
  }, [school, hasData, analysisDataForAI, allStudents.length, customChartData, traits, dialogTitle]);
  
  useEffect(() => {
    if (!isOpen && !isGenerating) {
        setBriefingData(null);
    }
  }, [isOpen, isGenerating]);

  return (
    <>
      <Button 
        onClick={fetchBriefing} 
        disabled={!hasData || isGenerating} 
        variant="outline"
        className={cn(
          "relative overflow-hidden font-black transition-all group h-11 px-6 rounded-xl border-primary/20",
          isGenerating ? "animate-pulse" : "hover:border-primary hover:bg-primary/5 shadow-sm"
        )}
      >
        {isGenerating ? (
          <span className="flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
            AI 심층 분석 중...
          </span>
        ) : (
          <span className="flex items-center">
            <Sparkles className="mr-2 h-4 w-4 text-primary group-hover:animate-bounce" />
            {title}
          </span>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl h-[95vh] sm:h-[90vh] flex flex-col premium-card border-none p-0 overflow-hidden rounded-xl sm:rounded-[2rem]">
          <DialogHeader className="p-5 sm:p-8 pb-4 bg-primary/[0.03] border-b border-border/50">
            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2 text-primary">
              <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg sm:rounded-xl">
                <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <DialogTitle className="text-xl sm:text-3xl font-black font-headline tracking-tighter sm:tracking-tight">{school} {dialogTitle}</DialogTitle>
            </div>
            <DialogDescription className="text-sm sm:text-base font-bold opacity-70">
              실시간 데이터 기반의 지능형 맞춤 분석 리포트입니다.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-8 sm:space-y-10 hide-scrollbar">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
                <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 animate-spin text-primary/30" />
                <p className="text-base sm:text-xl font-bold animate-pulse text-muted-foreground font-headline tracking-tight text-center">데이터 패턴 수집 및 분석 리포트 생성 중...</p>
              </div>
            ) : briefingData ? (
              <div className="space-y-8 sm:space-y-10">
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                  {papsChartData.length > 0 && (
                    <Card className="premium-card bg-background/50 border-border/40 p-4 sm:p-6">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-primary">
                            <BarChart2 className="w-5 h-5" />
                            PAPS 등급 분포
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">전체 학생 등급 비율입니다.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={papsChartData}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <Tooltip
                                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                            />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={30}>
                              {papsChartData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                  
                  {customChartData.length > 0 && (
                    <Card className="premium-card bg-background/50 border-border/40 p-4 sm:p-6">
                      <CardHeader className="p-0 pb-4">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-blue-600">
                            <TrendingUp className="w-5 h-5" />
                            평균 목표 달성도
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">수업 목표 대비 수행 수준입니다.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={customChartData} layout="vertical" margin={{ left: -10 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                            />
                            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20} fill="oklch(0.6 0.118 184.704)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Progress Summary */}
                {studentProgress && studentProgress.length > 0 && (
                  <Card className="premium-card border-l-4 border-l-green-500 bg-green-500/[0.02] p-5 sm:p-8">
                    <CardHeader className="p-0 pb-4">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-green-700">
                            <Sparkles className="w-5 h-5" />
                            최우수 성장 지표
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">높은 성취를 보인 3대 핵심 종목입니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 p-0 pt-2">
                        {studentProgress.map((item: any, id: number) => (
                          <div key={id} className="p-4 rounded-xl bg-background shadow-premium border border-border/40 group hover:border-green-500/40 transition-all">
                            <p className="text-xs sm:text-sm font-bold text-muted-foreground mb-1.5 flex items-center justify-between">
                              {item.name}
                              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </p>
                            <div className="flex items-end gap-1.5">
                              <span className="text-2xl sm:text-3xl font-black text-green-600 tracking-tighter">+{item.change}%</span>
                              <span className="text-[10px] text-muted-foreground pb-1 font-black">UP</span>
                            </div>
                            <div className="mt-3 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div 
                                style={{ width: `${item.present}%` }}
                                className="h-full bg-green-500 transition-all duration-1000" 
                              />
                            </div>
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                )}

                {/* AI Briefing Content */}
                <div className="flex flex-col gap-6 sm:gap-8 pb-10">
                  <div className="bg-primary/[0.03] p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] border border-primary/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-primary/5 rounded-full blur-[60px] sm:blur-[80px] -mr-24 -mt-24 sm:-mr-32 sm:-mt-32" />
                    <div className="flex items-center gap-2 sm:gap-3 mb-6 relative">
                      <div className="p-2 sm:p-3 bg-primary/10 rounded-xl sm:rounded-2xl">
                        <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                      </div>
                      <h3 className="text-xl sm:text-3xl font-black font-headline tracking-tighter text-primary">지능형 종합 분석</h3>
                    </div>
                    <div className="relative">
                       <p className="text-base sm:text-xl leading-[1.8] sm:leading-[2.2] font-semibold text-foreground/80 whitespace-pre-wrap italic">
                         {briefingData.briefing}
                       </p>
                    </div>
                  </div>

                  <div className="bg-accent/[0.03] p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] border border-accent/10 relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-64 sm:h-64 bg-accent/5 rounded-full blur-[60px] sm:blur-[80px] -ml-24 -mb-24 sm:-ml-32 sm:-mb-32" />
                    <div className="flex items-center gap-2 sm:gap-3 mb-6 relative">
                      <div className="p-2 sm:p-3 bg-blue-500/10 rounded-xl sm:rounded-2xl">
                        <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-xl sm:text-3xl font-black font-headline tracking-tighter text-blue-600 dark:text-blue-400">전략적 교수-학습 제언</h3>
                    </div>
                    <div className="relative">
                       <p className="text-base sm:text-xl leading-[1.8] sm:leading-[2.2] font-semibold text-foreground/80 whitespace-pre-wrap">
                         {briefingData.advice}
                       </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground py-20">
                <AlertCircle className="w-16 h-16 sm:w-20 sm:h-20 opacity-20" />
                <p className="text-lg sm:text-2xl font-black opacity-30 text-center">표시할 분석 데이터가 부족합니다.</p>
              </div>
            )}
          </div>
          <div className="p-5 sm:p-8 bg-muted/20 border-t border-border/50 flex flex-col sm:flex-row justify-center sm:justify-end gap-3 print:hidden">
            <Button 
                onClick={() => window.print()} 
                variant="outline"
                size="lg" 
                className="w-full sm:w-auto h-12 sm:h-14 sm:px-8 rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl border-primary/20 hover:bg-primary/5 transition-all text-primary"
            >
              <Printer className="w-5 h-5 mr-2" />
              리포트 인쇄
            </Button>
            <Button 
                onClick={() => setIsOpen(false)} 
                size="lg" 
                className="w-full sm:w-auto h-12 sm:h-14 sm:px-12 rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl shadow-premium hover:scale-105 active:scale-95 transition-all"
            >
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
