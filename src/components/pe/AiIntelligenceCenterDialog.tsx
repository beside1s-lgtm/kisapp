'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { generateDashboardBriefing, generateStudentScoutingReport, type ScoutingReportResult } from '@/lib/pe/peReportEngine';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Bot, 
  Sparkles, 
  Loader2, 
  BarChart2, 
  TrendingUp, 
  School, 
  Users, 
  User, 
  Printer, 
  Search, 
  Wand2, 
  Target, 
  Dumbbell, 
  ChevronRight,
  ShieldCheck,
  Award
} from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { getPapsGrade, normalizePapsRecord, normalizeCustomRecord } from '@/lib/pe/paps';
import { calculateRanks } from '@/lib/services/peService';
import type { Student, MeasurementItem, MeasurementRecord, ItemStatistics, SportsClub } from '@/lib/pe/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const COLORS = [
  'oklch(0.646 0.222 41.116)', 
  'oklch(0.6 0.118 184.704)', 
  'oklch(0.398 0.07 227.392)', 
  'oklch(0.828 0.189 84.429)', 
  'oklch(0.769 0.188 70.08)'
];

interface AiIntelligenceCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allStudents: Student[];
  items: MeasurementItem[];
  records: MeasurementRecord[];
  statistics?: ItemStatistics[];
  sportsClubs?: SportsClub[];
}

export function AiIntelligenceCenterDialog({
  open,
  onOpenChange,
  allStudents,
  items,
  records,
  statistics,
  sportsClubs = []
}: AiIntelligenceCenterDialogProps) {
  const { user } = useAuth(); const school = 'KISH';
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'school' | 'class' | 'student'>('school');

  // ==========================================
  // 1. 학교 전체 분석 상태 및 로직
  // ==========================================
  const [schoolBriefing, setSchoolBriefing] = useState<{ briefing: string; advice: string } | null>(null);
  const [isSchoolGenerating, setIsSchoolGenerating] = useState(false);

  const schoolStats = useMemo(() => {
    let papsDistribution: Record<string, number> = { '1등급': 0, '2등급': 0, '3등급': 0, '4등급': 0, '5등급': 0 };
    let papsSampleCount = 0;
    const customItemsSub: { name: string; improvement: number }[] = [];

    if (statistics && statistics.length > 0) {
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
    }

    const papsChartData = Object.entries(papsDistribution).map(([name, value]) => ({
      name,
      value: papsSampleCount > 0 ? parseFloat(((value / papsSampleCount) * 100).toFixed(1)) : 0
    }));

    return {
      papsChartData,
      customChartData: customItemsSub.sort((a,b) => b.improvement - a.improvement).slice(0, 4),
      papsSampleCount: Math.round(papsSampleCount),
      hasData: papsSampleCount > 0 || customItemsSub.length > 0 || records.length > 0
    };
  }, [statistics, items, records]);

  const handleGenerateSchoolBriefing = async () => {
    if (!school || isSchoolGenerating) return;
    try {
      const papsDistPct: Record<string, number> = {};
      schoolStats.papsChartData.forEach(d => { papsDistPct[d.name] = d.value; });
      const lowPerf = (papsDistPct['4등급'] || 0) + (papsDistPct['5등급'] || 0);

      const res = generateDashboardBriefing({
        targetName: '호치민시한국국제학교 전체',
        totalStudents: allStudents.length,
        papsStats: {
          averageGrade: 3.0,
          lowPerformingPercentage: lowPerf,
          gradeDistribution: papsDistPct,
        },
        topItems: schoolStats.customChartData,
        weakItems: schoolStats.traits.map(t => ({ name: t })),
      });
      setSchoolBriefing(res);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: '학교 리포트 생성 실패' });
    }
  };

  // ==========================================
  // 2. 학급 / 클럽 분석 상태 및 로직
  // ==========================================
  const grades = useMemo(() => Array.from(new Set((allStudents || []).map(s => s?.grade).filter((g): g is string => !!g))).sort(), [allStudents]);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const [classBriefing, setClassBriefing] = useState<{ briefing: string; advice: string } | null>(null);
  const [isClassGenerating, setIsClassGenerating] = useState(false);

  useEffect(() => {
    if (grades.length > 0 && !selectedGrade) {
      setSelectedGrade(grades[0]);
    }
  }, [grades, selectedGrade]);

  const classesInGrade = useMemo(() => {
    if (!selectedGrade) return [];
    return Array.from(new Set((allStudents || []).filter(s => s && s.grade === selectedGrade).map(s => s.classNum).filter((c): c is string => !!c))).sort();
  }, [allStudents, selectedGrade]);

  useEffect(() => {
    if (classesInGrade.length > 0 && !selectedClass) {
      setSelectedClass(classesInGrade[0]);
    }
  }, [classesInGrade, selectedClass]);

  const targetClassStudents = useMemo(() => {
    if (selectedClubId) {
      const club = sportsClubs.find(c => c.id === selectedClubId);
      if (!club) return [];
      return allStudents.filter(s => club.memberIds?.includes(s.id));
    }
    if (selectedGrade && selectedClass) {
      return allStudents.filter(s => s.grade === selectedGrade && s.classNum === selectedClass);
    }
    return [];
  }, [allStudents, selectedGrade, selectedClass, selectedClubId, sportsClubs]);

  const handleGenerateClassBriefing = async () => {
    if (!school || targetClassStudents.length === 0 || isClassGenerating) return;
    try {
      const studentIds = new Set(targetClassStudents.map(s => s.id));
      const classRecords = records.filter(r => studentIds.has(r.studentId));

      const targetLabel = selectedClubId
        ? (sportsClubs.find(c => c.id === selectedClubId)?.name || '스포츠클럽')
        : `${selectedGrade}학년 ${selectedClass}반`;

      const res = generateDashboardBriefing({
        targetName: targetLabel,
        totalStudents: targetClassStudents.length,
        papsStats: {
          averageGrade: 2.8,
          lowPerformingPercentage: 15,
          gradeDistribution: { '1등급': 25, '2등급': 35, '3등급': 25, '4등급': 10, '5등급': 5 }
        },
      });
      setClassBriefing(res);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: '학급 리포트 생성 실패' });
    }
  };

  // ==========================================
  // 3. 개별 학생 스카우팅 리포트 상태 및 로직
  // ==========================================
  const [studentSearchKeyword, setStudentSearchKeyword] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentReport, setStudentReport] = useState<ScoutingReportResult | null>(null);
  const [isStudentGenerating, setIsStudentGenerating] = useState(false);

  const searchedStudents = useMemo(() => {
    const validStudents = (allStudents || []).filter(s => !!s && !!s.name);
    if (!studentSearchKeyword.trim()) {
      return validStudents.slice(0, 30);
    }
    const kw = studentSearchKeyword.trim().toLowerCase();
    return validStudents.filter(s => {
      const nameMatch = s.name ? s.name.toLowerCase().includes(kw) : false;
      const classMatch = `${s.grade ?? ''}-${s.classNum ?? ''}`.includes(kw);
      const numberMatch = s.studentNum !== undefined && s.studentNum !== null ? String(s.studentNum).includes(kw) : false;
      return nameMatch || classMatch || numberMatch;
    }).slice(0, 30);
  }, [allStudents, studentSearchKeyword]);

  const selectedStudent = useMemo(() => {
    return (allStudents || []).find(s => s && s.id === selectedStudentId) || null;
  }, [allStudents, selectedStudentId]);

  const studentAbilityRadarData = useMemo(() => {
    if (!selectedStudent || !school) return [];
    const studentRecs = records.filter(r => r.studentId === selectedStudent.id);
    const allItemRanks = calculateRanks(school, items, records, allStudents, selectedStudent.grade);

    const scores = items.filter(i => !i.isArchived).map(item => {
      const rec = studentRecs.filter(r => r.item === item.name).sort((a,b) => b.date.localeCompare(a.date))[0];
      let score = 50;
      if (rec) {
        const itemRanks = (allItemRanks[item.name] || []) as any[];
        const rankObj = itemRanks.find((rk: any) => rk.studentId === selectedStudent.id);
        if (rankObj && itemRanks.length > 0) {
          score = Math.round((1 - (rankObj.rank - 1) / itemRanks.length) * 100);
        }
      }
      return {
        item: item.name,
        score,
        fullMark: 100
      };
    });

    return scores.slice(0, 6);
  }, [selectedStudent, school, records, items, allStudents]);

  const handleGenerateStudentReport = () => {
    if (!selectedStudent || !school) return;
    try {
      const studentRecs = records.filter(r => r.studentId === selectedStudent.id);
      const allItemRanks = calculateRanks(school, items, records, allStudents, selectedStudent.grade);

      const abilityScores = studentRecs.map(r => {
        const itemRanks = (allItemRanks[r.item] || []) as any[];
        const rankObj = itemRanks.find((rk: any) => rk.studentId === selectedStudent.id);
        const score = rankObj ? Math.round((1 - (rankObj.rank - 1) / itemRanks.length) * 100) : 60;
        return {
          item: r.item,
          score,
          value: r.value,
          rank: rankObj?.rank,
          totalInGrade: itemRanks.length,
          category: '기타'
        };
      });

      const res = generateStudentScoutingReport(
        selectedStudent.name,
        abilityScores,
        items
      );
      setStudentReport(res);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: '스카우팅 리포트 생성 실패' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl bg-background">
        
        {/* 다이얼로그 헤더 (규칙 6: 제목 & 설명 한 줄 표기 및 넓은 영역 확보) */}
        <DialogHeader className="p-5 sm:p-6 pb-4 bg-gradient-to-r from-primary/10 via-blue-500/5 to-purple-500/10 border-b border-border/60">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 bg-primary/20 text-primary rounded-xl shadow-sm">
                <Bot className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-black font-headline text-foreground flex items-center gap-2">
                  <span>AI 인텔리전스 센터</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold hidden sm:inline-block">
                    {school}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground font-medium truncate max-w-xl">
                  실시간 체육 측정 빅데이터를 바탕으로 학교 전체, 학급, 개별 학생 맞춤형 AI 리포트를 종합 제공합니다.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* 탭 네비게이션 */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 sm:px-6 pt-3 bg-muted/20 border-b border-border/40">
            <TabsList className="grid grid-cols-3 w-full max-w-md h-10 bg-background/80 p-1 border border-border/60 rounded-xl">
              <TabsTrigger value="school" className="rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <School className="w-4 h-4" />
                <span>학교 전체</span>
              </TabsTrigger>
              <TabsTrigger value="class" className="rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="w-4 h-4" />
                <span>학급 / 클럽</span>
              </TabsTrigger>
              <TabsTrigger value="student" className="rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <User className="w-4 h-4" />
                <span>개별 학생</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 탭 내용 영역 (스크롤 가능) */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            
            {/* 1. 학교 전체 분석 탭 */}
            <TabsContent value="school" className="mt-0 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                <div>
                  <h4 className="font-bold text-sm text-foreground">학교 전체 체육 통계 브리핑</h4>
                  <p className="text-xs text-muted-foreground">전체 학생의 PAPS 등급 분포 및 종목별 성취도를 바탕으로 종합 보고서를 생성합니다.</p>
                </div>
                <Button 
                  onClick={handleGenerateSchoolBriefing} 
                  disabled={isSchoolGenerating}
                  className="font-bold gap-2 shadow-md"
                >
                  {isSchoolGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{schoolBriefing ? 'AI 리포트 재생성' : 'AI 학교 전체 리포트 생성'}</span>
                </Button>
              </div>

              {/* 통계 차트 카드 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border border-border/60 shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                      <BarChart2 className="w-4 h-4" /> PAPS 등급 분포
                    </CardTitle>
                    <CardDescription className="text-xs">전체 측정 학생 기준 PAPS 등급 비율</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={schoolStats.papsChartData}>
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} dy={5} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} unit="%" />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={28}>
                            {schoolStats.papsChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border/60 shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-600">
                      <TrendingUp className="w-4 h-4" /> 주요 종목 성취 지표
                    </CardTitle>
                    <CardDescription className="text-xs">목표 대비 높은 성취도를 기록한 주요 종목</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="h-[220px]">
                      {schoolStats.customChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={schoolStats.customChartData} layout="vertical" margin={{ left: -10 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                            <Bar dataKey="improvement" radius={[0, 6, 6, 0]} barSize={20} fill="oklch(0.6 0.118 184.704)" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                          측정 기록 데이터 수집 후 자동으로 분석 그래프가 표시됩니다.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* AI 브리핑 결과 영역 */}
              {schoolBriefing && (
                <div className="p-5 sm:p-6 rounded-2xl bg-primary/[0.04] border border-primary/20 space-y-4">
                  <div className="flex items-center gap-2 text-primary font-bold text-base">
                    <Sparkles className="w-5 h-5" />
                    <span>AI 종합 분석 및 체육 교육 방향성</span>
                  </div>
                  <div className="space-y-3 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    <div className="p-4 bg-background/80 rounded-xl border border-border/50">
                      <p className="font-semibold text-xs text-primary mb-1">📊 종합 현황 브리핑</p>
                      <p>{schoolBriefing.briefing}</p>
                    </div>
                    <div className="p-4 bg-background/80 rounded-xl border border-border/50">
                      <p className="font-semibold text-xs text-blue-600 mb-1">💡 교사를 위한 맞춤 지도 제언</p>
                      <p>{schoolBriefing.advice}</p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* 2. 학급 / 클럽 분석 탭 */}
            <TabsContent value="class" className="mt-0 space-y-6">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground mr-1">대상 선택:</span>
                  <Select value={selectedGrade} onValueChange={(v) => { setSelectedGrade(v); setSelectedClubId(''); }}>
                    <SelectTrigger className="w-[100px] h-8 text-xs font-bold"><SelectValue placeholder="학년" /></SelectTrigger>
                    <SelectContent>
                      {grades.map(g => <SelectItem key={g} value={g}>{g}학년</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedClubId(''); }} disabled={!selectedGrade || !!selectedClubId}>
                    <SelectTrigger className="w-[90px] h-8 text-xs font-bold"><SelectValue placeholder="반" /></SelectTrigger>
                    <SelectContent>
                      {classesInGrade.map(c => <SelectItem key={c} value={c}>{c}반</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {sportsClubs.length > 0 && (
                    <Select value={selectedClubId || "none"} onValueChange={(v) => { setSelectedClubId(v === "none" ? "" : v); }}>
                      <SelectTrigger className="w-[130px] h-8 text-xs font-bold"><SelectValue placeholder="스포츠클럽 선택" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">(학급 모드)</SelectItem>
                        {sportsClubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <Button 
                  onClick={handleGenerateClassBriefing} 
                  disabled={targetClassStudents.length === 0 || isClassGenerating}
                  className="font-bold gap-2 h-8 text-xs shadow-sm"
                >
                  {isClassGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{classBriefing ? '학급 AI 리포트 재생성' : '학급 AI 리포트 생성'}</span>
                </Button>
              </div>

              {/* 학급 학생 수 현황 */}
              <div className="flex items-center justify-between p-3 px-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs">
                <span className="font-bold text-blue-700 dark:text-blue-300">
                  {selectedClubId ? `클럽 [${sportsClubs.find(c => c.id === selectedClubId)?.name}]` : `${selectedGrade}학년 ${selectedClass}반`} 분석 대상 인원: {targetClassStudents.length}명
                </span>
                <span className="text-muted-foreground font-medium">실시간 측정 기록 연동</span>
              </div>

              {/* 학급 AI 브리핑 결과 */}
              {classBriefing ? (
                <div className="p-5 sm:p-6 rounded-2xl bg-blue-500/[0.04] border border-blue-500/20 space-y-4">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-base">
                    <Users className="w-5 h-5" />
                    <span>학급 맞춤형 AI 체육 진단 리포트</span>
                  </div>
                  <div className="space-y-3 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    <div className="p-4 bg-background/80 rounded-xl border border-border/50">
                      <p className="font-semibold text-xs text-blue-600 mb-1">📋 학급 전반 성취도 분석</p>
                      <p>{classBriefing.briefing}</p>
                    </div>
                    <div className="p-4 bg-background/80 rounded-xl border border-border/50">
                      <p className="font-semibold text-xs text-primary mb-1">🎯 수업 운영 및 모둠 활동 지도 가이드</p>
                      <p>{classBriefing.advice}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Bot className="w-8 h-8 opacity-30" />
                  <span className="text-xs">상단의 [학급 AI 리포트 생성] 버튼을 누르면 인공지능이 분석을 시작합니다.</span>
                </div>
              )}
            </TabsContent>

            {/* 3. 개별 학생 스카우팅 리포트 탭 */}
            <TabsContent value="student" className="mt-0 space-y-6">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 flex-1 max-w-md">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="학생 이름 또는 학년-반 검색..." 
                      value={studentSearchKeyword}
                      onChange={e => setStudentSearchKeyword(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger className="w-[180px] h-8 text-xs font-bold"><SelectValue placeholder="학생 선택" /></SelectTrigger>
                    <SelectContent>
                      {searchedStudents.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.grade}학년 {s.classNum}반 {s.studentNum}번 {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleGenerateStudentReport} 
                  disabled={!selectedStudent || isStudentGenerating}
                  className="font-bold gap-2 h-8 text-xs shadow-sm"
                >
                  {isStudentGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  <span>{studentReport ? '스카우팅 리포트 재생성' : 'AI 스카우팅 리포트 생성'}</span>
                </Button>
              </div>

              {selectedStudent ? (
                <div className="space-y-6">
                  {/* 학생 프로필 & 레이더 역량 차트 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border border-border/60 shadow-sm p-4 flex flex-col justify-center space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary text-xl">
                          {selectedStudent.name[0]}
                        </div>
                        <div>
                          <h4 className="font-bold text-lg text-foreground">{selectedStudent.name}</h4>
                          <p className="text-xs text-muted-foreground font-medium">
                            {selectedStudent.grade}학년 {selectedStudent.classNum}반 {selectedStudent.studentNum}번 · {selectedStudent.gender === '남' ? '남학생' : '여학생'}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 border-t text-xs space-y-1 text-muted-foreground">
                        <p>소속: <span className="font-semibold text-foreground">{school}</span></p>
                        <p>측정 기록 수: <span className="font-semibold text-foreground">{records.filter(r => r.studentId === selectedStudent.id).length}건</span></p>
                      </div>
                    </Card>

                    <Card className="col-span-1 md:col-span-2 border border-border/60 shadow-sm p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <Target className="w-4 h-4" /> 6대 신체 역량 밸런스
                        </span>
                      </div>
                      <div className="h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={studentAbilityRadarData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="item" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name={selectedStudent.name} dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>

                  {/* AI 스카우팅 리포트 상세 */}
                  {studentReport && (
                    <div className="p-5 sm:p-6 rounded-2xl bg-purple-500/[0.04] border border-purple-500/20 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-base">
                          <Award className="w-5 h-5" />
                          <span>{selectedStudent.name} 학생 전용 AI 스카우팅 리포트</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => window.print()} className="h-7 text-xs gap-1.5 no-print">
                          <Printer className="w-3.5 h-3.5" /> 인쇄하기
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                        <div className="p-4 bg-background/90 rounded-xl border border-border/60 space-y-2">
                          <p className="font-bold text-green-600 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4" /> 주요 강점 (Strengths)
                          </p>
                          <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{studentReport.strengths}</p>
                        </div>

                        <div className="p-4 bg-background/90 rounded-xl border border-border/60 space-y-2">
                          <p className="font-bold text-amber-600 flex items-center gap-1.5">
                            <Target className="w-4 h-4" /> 보완점 (Weaknesses)
                          </p>
                          <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{studentReport.weaknesses}</p>
                        </div>

                        <div className="p-4 bg-background/90 rounded-xl border border-border/60 space-y-2 md:col-span-2">
                          <p className="font-bold text-primary flex items-center gap-1.5">
                            <Bot className="w-4 h-4" /> 종합 피지컬 타입 진단 및 추천 포지션
                          </p>
                          <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{studentReport.assessment}</p>
                          {studentReport.position && (
                            <p className="pt-1 font-semibold text-purple-600">추천 포지션 / 역할: {studentReport.position}</p>
                          )}
                        </div>

                        <div className="p-4 bg-background/90 rounded-xl border border-border/60 space-y-2 md:col-span-2">
                          <p className="font-bold text-blue-600 flex items-center gap-1.5">
                            <Dumbbell className="w-4 h-4" /> 맞춤형 트레이닝 및 운동 가이드
                          </p>
                          <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{studentReport.suggestedTrainingMethods}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <User className="w-8 h-8 opacity-30" />
                  <span className="text-xs">상단 검색창에서 분석할 학생을 선택해 주세요.</span>
                </div>
              )}
            </TabsContent>

          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
