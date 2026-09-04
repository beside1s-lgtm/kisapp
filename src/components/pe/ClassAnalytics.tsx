"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  calculateRanks,
  deleteRecord,
  addOrUpdateRecord,
} from '@/lib/services/peService';
import { Student, MeasurementRecord, MeasurementItem, SportsClub, MeasurementPeriod } from '@/lib/pe/types';
import type { ScoutingReportOutput } from "@/ai/flows/scouting-report-flow";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { generateStudentScoutingReport, type ScoutingReportResult } from "@/lib/pe/peReportEngine";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Search,
  Wand2,
  X as XIcon,
  ArrowUpDown,
  Trash2,
  Pencil,
  CalendarIcon,
  History,
  Award,
  Target,
  Dumbbell
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getPapsGrade,
  getCustomItemGrade,
  normalizePapsRecord,
  normalizeCustomRecord,
  calculatePapsScore,
} from '@/lib/pe/paps';
import AiWelcome from "./AiWelcome";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const CustomBarTooltipContent = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2.5 text-xs bg-background/95 border rounded-lg shadow-lg space-y-1">
        <p className="font-bold text-foreground">{label}</p>
        {payload.map((p: any) => {
          const rawVal = p.payload.originalRecords?.[p.dataKey]?.value;
          const formattedVal = typeof rawVal === 'number' ? rawVal.toFixed(1) : (rawVal || 'N/A');
          const unit = p.payload.originalRecords?.[p.dataKey]?.unit || '';
          const percent = typeof p.value === 'number' ? p.value.toFixed(1) : p.value;
          return (
            <div key={p.dataKey} className="flex items-center gap-1.5" style={{ color: p.color }}>
              <span className="font-semibold">{p.name}:</span>
              <span>{percent}% ({formattedVal}{unit})</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function ClassAnalytics({
  allStudents,
  allItems,
  allRecords,
  onRecordUpdate,
  sportsClubs,
}: {
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
  onRecordUpdate: (recordsOrId?: MeasurementRecord[] | string, action?: 'update' | 'delete') => void;
  sportsClubs: SportsClub[];
}) {
  const { user } = useAuth(); const school = 'KISH';
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedClassNum, setSelectedClassNum] = useState("all");
  const [selectedClubId, setSelectedClubId] = useState("");

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentRecords, setStudentRecords] = useState<MeasurementRecord[]>([]);
  const [progressChartItem, setProgressChartItem] = useState<string>("PAPS 종합 점수");
  const [aiAnalysis, setAiAnalysis] = useState<ScoutingReportOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiButtonDisabled, setIsAiButtonDisabled] = useState(false);
  const [analyzeType, setAnalyzeType] = useState<"best" | "all">("best");

  const [comparisonType, setComparisonType] = useState<"paps" | "custom">("paps");
  const studentDetailRef = useRef<HTMLDivElement>(null);

  const activeItems = useMemo(() => allItems.filter(i => !i.isArchived && !i.isDeactivated), [allItems]);
  const papsItems = useMemo(() => activeItems.filter(i => i.isPaps), [activeItems]);
  const measurementPeriods = useMemo(() => (school as any)?.measurementPeriods || [], [school]);

  const { grades, classNumsByGrade } = useMemo(() => {
    const grades = [...new Set(allStudents.map((s) => s.grade))].sort((a,b) => parseInt(a)-parseInt(b));
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach((grade) => {
      classNumsByGrade[grade] = [...new Set(allStudents.filter((s) => s.grade === grade).map((s) => s.classNum))].sort((a,b) => parseInt(a)-parseInt(b));
    });
    return { grades, classNumsByGrade };
  }, [allStudents]);

  const filteredStudents = useMemo(() => {
    if (selectedClubId) {
        const club = sportsClubs.find(c => c.id === selectedClubId);
        if (club) return allStudents.filter(s => club.memberIds.includes(s.id));
    }
    if (selectedGrade) {
      let students = allStudents.filter((s) => s.grade === selectedGrade);
      if (selectedClassNum !== "all") students = students.filter((s) => s.classNum === selectedClassNum);
      return students.sort((a, b) => parseInt(a.studentNum) - parseInt(b.studentNum));
    }
    return [];
  }, [allStudents, selectedGrade, selectedClassNum, selectedClubId, sportsClubs]);

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    const recs = allRecords.filter(r => r.studentId === student.id || (student.peStudentId && r.studentId === student.peStudentId));
    setStudentRecords(recs);
    setAiAnalysis(null);
    if (!progressChartItem && activeItems.length) setProgressChartItem(activeItems[0].name);
    setTimeout(() => {
      studentDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleSearch = () => {
    if (!searchTerm) return;
    const found = allStudents.filter(s => s.name.includes(searchTerm));
    if (found.length === 1) {
      handleSelectStudent(found[0]);
      setSelectedGrade(""); setSelectedClubId("");
    } else if (found.length > 1) {
      toast({ title: "여러 명의 학생이 검색됨", description: "아래 명단에서 분석할 학생을 선택해 주세요." });
    } else {
      toast({ variant: "destructive", title: "학생을 찾을 수 없습니다." });
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!school) return;
    try {
      await deleteRecord(school, recordId);
      onRecordUpdate(recordId, 'delete');
      // Update local state for immediate feedback
      setStudentRecords(prev => prev.filter(r => r.id !== recordId));
      toast({ title: "기록 삭제 완료" });
    } catch (e) { toast({ variant: "destructive", title: "삭제 실패" }); }
  };

  const handleAiAnalysis = () => {
    if (!selectedStudent || !school) return;
    try {
      const allItemRanks = calculateRanks(school, allItems, allRecords, allStudents, selectedStudent.grade);
      
      // 종목별 최신 기록 1건만 추출
      const latestMap = new Map<string, MeasurementRecord>();
      studentRecords.forEach(r => {
        const exist = latestMap.get(r.item);
        if (!exist || r.date > exist.date) {
          latestMap.set(r.item, r);
        }
      });

      const abilityScores = Array.from(latestMap.values()).map(r => {
        const itemObj = allItems.find(i => i.name === r.item || i.id === r.item);
        const itemRanks = (allItemRanks[r.item] || []) as any[];
        const rankObj = itemRanks.find((rk: any) => 
          rk.studentId === selectedStudent.id || (selectedStudent.peStudentId && rk.studentId === selectedStudent.peStudentId)
        );
        const score = rankObj && itemRanks.length > 0 ? Math.round((1 - (rankObj.rank - 1) / itemRanks.length) * 100) : 50;
        return {
          item: r.item,
          score,
          value: r.value,
          unit: itemObj?.unit || '',
          rank: rankObj?.rank,
          totalInGrade: itemRanks.length,
          category: itemObj?.category || (itemObj?.isPaps ? 'PAPS' : '기타')
        };
      });

      const result = generateStudentScoutingReport(
        selectedStudent.name,
        abilityScores,
        allItems
      );
      setAiAnalysis(result);
    } catch (e) {
      console.error('Scouting report generation error:', e);
      toast({ variant: "destructive", title: "스카우팅 리포트 생성 실패" });
    }
  };

  const calculateAverageGrades = (studentList: Student[], isPaps: boolean) => {
    if (studentList.length === 0) return {};
    const itemsToAnalyze = isPaps ? allItems.filter((i) => i.isPaps) : allItems.filter((i) => !i.isPaps && i.goal);
    const averageData: Record<string, any> = {};

    itemsToAnalyze.forEach((item) => {
      let totalP = 0, totalV = 0, count = 0;
      studentList.forEach((student) => {
        const studentRecs = allRecords.filter(r => 
          (r.studentId === student.id || (student.peStudentId && r.studentId === student.peStudentId)) && 
          r.item === item.name
        );
        if (studentRecs.length > 0) {
          const latest = studentRecs.sort((a,b) => b.date.localeCompare(a.date))[0];
          const p = isPaps ? normalizePapsRecord(getPapsGrade(item.name, student, latest.value) || 5, latest.value, item.name, student) : normalizeCustomRecord(item, latest.value);
          totalP += p; totalV += latest.value; count++;
        }
      });
      if (count > 0) averageData[item.name] = { percentage: totalP / count, avgValue: totalV / count, unit: item.unit };
    });
    return averageData;
  };

  const comparisonData = useMemo(() => {
    if (!school || (!selectedGrade && !selectedClubId && !selectedStudent)) return { data: [], targetLabel: "대상" };
    const itemsToAnalyze = comparisonType === "paps" ? allItems.filter((i) => i.isPaps) : allItems.filter((i) => !i.isPaps && i.goal);
    let targetData: Record<string, any> = {};
    let label = "선택 대상";

    if (selectedStudent) {
      label = selectedStudent.name;
      itemsToAnalyze.forEach(item => {
        const studentRecs = allRecords.filter(r => 
          (r.studentId === selectedStudent.id || (selectedStudent.peStudentId && r.studentId === selectedStudent.peStudentId)) && 
          r.item === item.name
        );
        if (studentRecs.length > 0) {
          const latest = studentRecs.sort((a,b) => b.date.localeCompare(a.date))[0];
          const p = comparisonType === 'paps' ? normalizePapsRecord(getPapsGrade(item.name, selectedStudent, latest.value) || 5, latest.value, item.name, selectedStudent) : normalizeCustomRecord(item, latest.value);
          targetData[item.name] = { percentage: p, avgValue: latest.value, unit: item.unit };
        }
      });
    } else {
      label = selectedClubId ? sportsClubs.find(c=>c.id === selectedClubId)?.name || '클럽' : (selectedClassNum === 'all' ? `${selectedGrade}학년 전체` : `${selectedGrade}학년 ${selectedClassNum}반`);
      targetData = calculateAverageGrades(filteredStudents, comparisonType === "paps");
    }

    const gradeAvg = calculateAverageGrades(allStudents.filter(s => s.grade === (selectedStudent?.grade || selectedGrade || '5')), comparisonType === "paps");

    return {
      data: itemsToAnalyze.map(item => ({
        name: item.name,
        target: targetData[item.name]?.percentage || 0,
        average: gradeAvg[item.name]?.percentage || 0,
        originalRecords: {
          target: { value: targetData[item.name]?.avgValue, unit: targetData[item.name]?.unit },
          average: { value: gradeAvg[item.name]?.avgValue, unit: gradeAvg[item.name]?.unit }
        }
      })).filter(d => d.target > 0 || d.average > 0),
      targetLabel: label
    };
  }, [selectedStudent, selectedGrade, selectedClassNum, selectedClubId, allRecords, allItems, comparisonType, filteredStudents, allStudents, school, sportsClubs]);

  const growthData = useMemo(() => {
    if (!selectedStudent || !progressChartItem || studentRecords.length === 0) return [];

    if (progressChartItem === "PAPS 종합 점수") {
      // 날짜별로 그룹화하여 날짜별 PAPS 종합 점수 계산
      const dateMap = new Map<string, MeasurementRecord[]>();
      studentRecords.filter(r => papsItems.some(pi => pi.name === r.item)).forEach(r => {
        if (!dateMap.has(r.date)) dateMap.set(r.date, []);
        dateMap.get(r.date)!.push(r);
      });

      const sortedDates = Array.from(dateMap.keys()).sort();

      return sortedDates.map(dateStr => {
        const dayRecs = dateMap.get(dateStr)!;
        let total = 0;
        let foundAny = false;

        papsItems.forEach((item: MeasurementItem) => {
          const itemRecs = dayRecs.filter(r => r.item === item.name);
          if (itemRecs.length > 0) {
            let best;
            if (item.recordType === 'time') best = itemRecs.sort((a, b) => a.value - b.value)[0];
            else best = itemRecs.sort((a, b) => b.value - a.value)[0];
            const score = calculatePapsScore(item.name, selectedStudent, best.value);
            if (score !== null) {
              total += score;
              foundAny = true;
            }
          }
        });

        const formattedDate = dateStr.length >= 10 ? dateStr.substring(5) : dateStr;
        return {
          name: formattedDate,
          fullDate: dateStr,
          value: foundAny ? total : null,
          displayValue: foundAny ? `${total}점` : '-'
        };
      }).filter(d => d.value !== null);

    } else {
      const item = allItems.find(i => i.name === progressChartItem);
      const itemRecs = studentRecords.filter(r => r.item === progressChartItem);
      if (itemRecs.length === 0) return [];

      const dateMap = new Map<string, MeasurementRecord[]>();
      itemRecs.forEach(r => {
        if (!dateMap.has(r.date)) dateMap.set(r.date, []);
        dateMap.get(r.date)!.push(r);
      });

      const sortedDates = Array.from(dateMap.keys()).sort();

      return sortedDates.map(dateStr => {
        const dayRecs = dateMap.get(dateStr)!;
        let best;
        if (item?.recordType === 'time') best = dayRecs.sort((a, b) => a.value - b.value)[0];
        else best = dayRecs.sort((a, b) => b.value - a.value)[0];

        const formattedDate = dateStr.length >= 10 ? dateStr.substring(5) : dateStr;
        return {
          name: formattedDate,
          fullDate: dateStr,
          value: best.value,
          displayValue: `${best.value}${item?.unit || ''}`
        };
      });
    }
  }, [selectedStudent, progressChartItem, studentRecords, allItems, papsItems]);

  const isGrowthChartAvailable = useMemo(() => {
    return growthData.length >= 2;
  }, [growthData]);

  return (
    <div className="w-full space-y-3">
      {/* 슬림 검색 및 필터 컨트롤 바 */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 grow">
          <div className="flex items-center gap-1">
            <Input placeholder="학생 이름 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="w-32 sm:w-44 h-8 text-xs bg-slate-50" />
            <Button size="sm" onClick={handleSearch} className="h-8 text-xs px-2.5 font-bold"><Search className="mr-1 h-3.5 w-3.5" /> 검색</Button>
          </div>
          <span className="text-slate-400 text-xs hidden sm:inline">|</span>
          <Select value={selectedGrade} onValueChange={v => { setSelectedGrade(v); setSelectedClubId(""); setSelectedClassNum("all"); setSelectedStudent(null); }}>
            <SelectTrigger className="w-[72px] h-8 text-xs bg-slate-50"><SelectValue placeholder="학년" /></SelectTrigger>
            <SelectContent>{grades.map(g=><SelectItem key={g} value={g}>{g}학년</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedClassNum} onValueChange={v => { setSelectedClassNum(v); setSelectedStudent(null); }} disabled={!selectedGrade}>
            <SelectTrigger className="w-[62px] h-8 text-xs bg-slate-50"><SelectValue placeholder="반" /></SelectTrigger>
            <SelectContent><SelectItem value="all">전체</SelectItem>{classNumsByGrade[selectedGrade]?.map(c=><SelectItem key={c} value={c}>{c}반</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedClubId} onValueChange={v => { setSelectedClubId(v); setSelectedGrade(""); setSelectedStudent(null); }}>
            <SelectTrigger className="w-[120px] h-8 text-xs bg-slate-50"><SelectValue placeholder="클럽 선택" /></SelectTrigger>
            <SelectContent>{sportsClubs.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          {(selectedGrade || selectedClubId || selectedStudent) && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-slate-500" onClick={() => { setSelectedGrade(""); setSelectedClubId(""); setSelectedStudent(null); setSearchTerm(""); }}>
              <XIcon className="h-3.5 w-3.5 mr-1" /> 초기화
            </Button>
          )}
        </div>
      </div>

      <CardContent className="space-y-8">
        {(selectedGrade || selectedClubId || selectedStudent) && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="border-2 border-primary/10 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">성취도 비교 분석</CardTitle>
                    <CardDescription>{comparisonData.targetLabel} vs 학년 평균</CardDescription>
                  </div>
                  <Select value={comparisonType} onValueChange={v => setComparisonType(v as any)}>
                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="paps">PAPS</SelectItem><SelectItem value="custom">기타</SelectItem></SelectContent>
                  </Select>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData.data}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={10} angle={-45} textAnchor="end" height={60} interval={0} />
                      <YAxis domain={[0, 100]} unit="%" />
                      <Tooltip content={<CustomBarTooltipContent />} cursor={{ fill: 'transparent' }} />
                      <Legend />
                      <Bar dataKey="target" name={comparisonData.targetLabel} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="average" name="학년 평균" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
                {!selectedStudent && (
                  <CardFooter className="bg-primary/5 p-4 border-t">
                    <AiWelcome title="학급/클럽 AI 브리핑" allStudents={allStudents} classStudents={filteredStudents} items={allItems} records={allRecords} />
                  </CardFooter>
                )}
              </Card>

              {selectedStudent && (
                <Card className="border-2 border-primary/10 shadow-sm" ref={studentDetailRef}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{selectedStudent.name} 성장 분석</CardTitle>
                      <CardDescription>{selectedStudent.grade}학년 {selectedStudent.classNum}반 · 개별 성취도 및 AI 코칭</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedStudent(null)}><XIcon className="h-4 w-4" /></Button>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      <div className="flex items-center justify-between mb-4">
                        <Select value={progressChartItem} onValueChange={setProgressChartItem}>
                          <SelectTrigger className="w-[180px] h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="PAPS 종합 점수">PAPS 종합 점수</SelectItem>
                              {activeItems.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <span className="text-[10px] text-muted-foreground font-semibold">
                            {isGrowthChartAvailable ? '일자별 성장 곡선' : '기록 현황'}
                        </span>
                      </div>
                      {growthData.length > 0 ? (
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={growthData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
                              <CartesianGrid vertical={false} strokeDasharray="3 3" />
                              <XAxis dataKey="name" fontSize={11} tick={{ fontWeight: 'bold' }} />
                              <YAxis domain={[0, progressChartItem === "PAPS 종합 점수" ? 100 : 'auto']} fontSize={10} />
                              <Tooltip 
                                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || _}
                                formatter={(value: any, name: any, item: any) => [item?.payload?.displayValue || value, '측정 기록']}
                              />
                              <Line type="monotone" dataKey="value" name="기록" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 6, fill: "hsl(var(--primary))" }} label={{ position: 'top', fontSize: 11, fill: 'hsl(var(--primary))', fontWeight: 'bold' }} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center border rounded-md bg-muted/20 text-xs text-muted-foreground italic">
                          선택한 종목의 측정 기록이 없습니다.
                        </div>
                      )}
                    <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                      {aiAnalysis ? (
                        <div className="space-y-3 text-xs">
                          <div className="flex items-center justify-between border-b pb-2 border-slate-200">
                            <div className="flex items-center gap-1.5 font-black text-indigo-900 text-sm">
                              <Award className="w-4 h-4 text-indigo-600" />
                              스카우팅 종합 진단
                            </div>
                            <Button size="sm" variant="ghost" onClick={handleAiAnalysis} className="h-6 px-2 text-[11px] text-slate-500 hover:text-slate-900">
                              다시 생성
                            </Button>
                          </div>

                          {/* 선수 유형 및 추천 포지션 */}
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                            <div className="font-bold text-slate-800 flex items-center gap-1">
                              <Target className="w-3.5 h-3.5 text-indigo-600" />
                              선수 유형: <span className="text-indigo-700">{aiAnalysis.assessment}</span>
                            </div>
                            <div className="text-[11px] text-slate-600">
                              <strong>추천 포지션:</strong> {aiAnalysis.position}
                            </div>
                          </div>

                          {/* 강점 및 보완점 */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="bg-emerald-50/70 border border-emerald-200 p-2.5 rounded-lg space-y-1">
                              <span className="font-bold text-emerald-800 text-[11px]">핵심 강점</span>
                              <div className="text-[11px] text-emerald-950 whitespace-pre-line leading-relaxed">
                                {aiAnalysis.strengths}
                              </div>
                            </div>
                            <div className="bg-amber-50/70 border border-amber-200 p-2.5 rounded-lg space-y-1">
                              <span className="font-bold text-amber-800 text-[11px]">보완 영역</span>
                              <div className="text-[11px] text-amber-950 whitespace-pre-line leading-relaxed">
                                {aiAnalysis.weaknesses}
                              </div>
                            </div>
                          </div>

                          {/* 맞춤 훈련 가이드 */}
                          <div className="bg-blue-50/60 border border-blue-200 p-2.5 rounded-lg space-y-1">
                            <span className="font-bold text-blue-900 text-[11px] flex items-center gap-1">
                              <Dumbbell className="w-3.5 h-3.5 text-blue-600" />
                              맞춤 체력 향상 처방
                            </span>
                            <div className="text-[11px] text-blue-950 whitespace-pre-line leading-relaxed">
                              {aiAnalysis.suggestedTrainingMethods}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-2 space-y-2">
                          <p className="text-xs text-muted-foreground">학생의 측정 기록을 바탕으로 즉시 스카우팅 리포트를 생성합니다.</p>
                          <Button size="sm" onClick={handleAiAnalysis} className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Award className="mr-1.5 h-3.5 w-3.5" />스카우팅 리포트 생성
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Individual Records List for Selection Deletion */}
            {selectedStudent && (
              <Card className="border-2 border-destructive/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    측정 기록 명단 및 삭제
                  </CardTitle>
                  <CardDescription>{selectedStudent.name} 학생의 전체 측정 기록입니다. 잘못 입력된 데이터는 개별 삭제할 수 있습니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>측정일</TableHead>
                          <TableHead>종목명</TableHead>
                          <TableHead>기록</TableHead>
                          <TableHead className="text-right">삭제</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentRecords.length > 0 ? (
                          studentRecords.sort((a,b) => b.date.localeCompare(a.date)).map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="text-sm">{record.date}</TableCell>
                              <TableCell className="font-bold text-sm">{record.item}</TableCell>
                              <TableCell className="text-sm">{record.value}{allItems.find(i=>i.name === record.item)?.unit}</TableCell>
                              <TableCell className="text-right">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>기록 삭제</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        정말로 {record.date}에 측정된 {record.item} 기록을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>취소</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDeleteRecord(record.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        삭제
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">측정 기록이 없습니다.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="border rounded-md shadow-sm">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>번호</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>성별</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map(s => (
                  <TableRow key={s.id} className={cn(selectedStudent?.id === s.id && "bg-primary/5 font-bold")}>
                    <TableCell>{s.studentNum}</TableCell>
                    <TableCell>
                        <div className="flex flex-col">
                            <span className="font-bold">{s.name}</span>
                            <span className="text-[10px] text-muted-foreground">{s.grade}학년 {s.classNum}반</span>
                        </div>
                    </TableCell>
                    <TableCell>{s.gender}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="link" size="sm" onClick={() => handleSelectStudent(s)} className="font-bold">분석 & 관리</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">대상을 선택하거나 이름을 검색해주세요.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </div>
  );
}
