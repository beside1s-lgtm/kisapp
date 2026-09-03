"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  calculateRanks,
  saveTeamGroup,
  deleteTeamGroup,
  updateTeamGroup,
} from '@/lib/services/peService';
import { Student, MeasurementItem, MeasurementRecord, TeamGroup, Team, TeamGroupInput, SportsClub } from '@/lib/pe/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  Shuffle,
  Loader2,
  Wand2,
  Send,
  Trash2,
  RefreshCw,
  Move,
  Search,
  Pencil,
  BarChart2,
  Info,
  CheckCircle2,
  Trophy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

import { getScoutingReport } from "@/ai/flows/scouting-report-flow";
import type { ScoutingReportOutput } from "@/ai/flows/scouting-report-flow";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { v4 as uuidv4 } from 'uuid';
import { Badge } from "@/components/ui/badge";

interface TeamBalancerProps {
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
  teamGroups: TeamGroup[];
  onTeamGroupUpdate: (newGroup: TeamGroup) => void;
  onTeamGroupDelete: (groupId: string) => void;
  sportsClubs: SportsClub[];
}

type ClassSelection = {
  [grade: string]: {
    all: boolean;
    classes: {
      [classNum: string]: boolean;
    }
  }
}

type MovingStudentState = {
  studentId: string;
  sourceTeamId: string;
} | null;

export default function TeamBalancer({ allStudents, allItems, allRecords, teamGroups, onTeamGroupUpdate, onTeamGroupDelete, sportsClubs }: TeamBalancerProps) {
  const { user } = useAuth(); const school = 'KISH';
  const { toast } = useToast();

  const [selectedTeamGroupId, setSelectedTeamGroupId] = useState<string>('');
  const [classSelection, setClassSelection] = useState<ClassSelection>({});
  const [clubSelection, setClubSelection] = useState<Record<string, boolean>>({});
  const [selectedGender, setSelectedGender] = useState<"all" | "남" | "여" | "separate">("all");
  const [excludeNonParticipants, setExcludeNonParticipants] = useState(true);
  const [selectedItemNames, setSelectedItemNames] = useState<string[]>([]);
  const [numTeams, setNumTeams] = useState(2);
  const [membersPerTeam, setMembersPerTeam] = useState(4);
  const [divideBy, setDivideBy] = useState<"teams" | "members" | "single">("teams");
  const [balancingStrategy, setBalancingStrategy] = useState<'balanced' | 'by-ability' | 'random'>('balanced');
  const [teams, setTeams] = useState<Team[]>([]);
  const [leftoverStudents, setLeftoverStudents] = useState<Student[]>([]);
  
  // Student ID -> { totalScore (0-100), individualScores: [] }
  const [studentScores, setStudentScores] = useState<Map<string, { totalScore: number; scores: { item: string; score: number }[] }>>(new Map());
  const [balancingSelection, setBalancingSelection] = useState<Record<string, boolean>>({});
  const [teamGroupName, setTeamGroupName] = useState("");
  const [movingStudent, setMovingStudent] = useState<MovingStudentState>(null);
  
  const [scoutingReport, setScoutingReport] = useState<ScoutingReportOutput | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [analyzingStudent, setAnalyzingStudent] = useState<Student | null>(null);
  
  const [isSending, setIsSending] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");

  const { grades, classNumsByGrade, groupedItems } = useMemo(() => {
    const grades = [...new Set(allStudents.map((s) => s.grade))].sort((a,b) => parseInt(a) - parseInt(b));
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach((grade) => {
      const classes = [...new Set(allStudents.filter((s) => s.grade === grade).map((s) => s.classNum))].sort((a,b) => parseInt(a) - parseInt(b));
      classNumsByGrade[grade] = classes;
    });
    const grouped: Record<string, MeasurementItem[]> = { PAPS: [] };
    allItems.forEach((item) => {
      if (item.isArchived || item.isDeactivated) return;
      const category = item.category || (item.isPaps ? "PAPS" : "기타");
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(item);
    });
    return { grades, classNumsByGrade, groupedItems: grouped };
  }, [allStudents, allItems]);

  useEffect(() => {
    if (Object.keys(classSelection).length === 0 && grades.length > 0) {
        const initialSelection: ClassSelection = {};
        grades.forEach((grade) => {
            initialSelection[grade] = { all: false, classes: {} };
            classNumsByGrade[grade]?.forEach(classNum => {
                initialSelection[grade].classes[classNum] = false;
            });
        });
        setClassSelection(initialSelection);
    }
  }, [grades, classNumsByGrade]);

  const resetToNewTeam = () => {
    setSelectedTeamGroupId('');
    setTeamGroupName('');
    setTeams([]);
    setLeftoverStudents([]);
    setStudentScores(new Map());
    setBalancingSelection({});
    setAnalyzingStudent(null);
    setScoutingReport(null);
  };
  
  const handleLoadTeamGroup = (groupId: string) => {
    const group = teamGroups.find(g => g.id === groupId);
    if (!group) return;
    setSelectedTeamGroupId(groupId);
    setTeamGroupName(group.description);
    const studentMap = new Map(allStudents.map(s => [s.id, s]));
    const teamsWithMembers = group.teams.map(team => ({
        ...team,
        members: team.memberIds.map(id => studentMap.get(id)).filter((s): s is Student => !!s)
    }));
    setTeams(teamsWithMembers);
    setSelectedGender(group.gender || 'all');
    setSelectedItemNames(group.itemNamesForBalancing || []);
    setDivideBy(group.divideBy || 'teams');
    setNumTeams(group.numTeams || 2);
    setMembersPerTeam(group.membersPerTeam || 4);
    setBalancingStrategy(group.balancingStrategy || 'balanced');
    setLeftoverStudents([]);
    toast({ title: "팀 편성 로드 완료" });
  };

  const targetStudents = useMemo(() => {
    const selectedStudentIds = new Set<string>();
    Object.entries(classSelection).forEach(([grade, selection]) => {
      Object.entries(selection.classes).forEach(([classNum, isSelected]) => {
        if (isSelected) allStudents.forEach(s => { if (s.grade === grade && s.classNum === classNum) selectedStudentIds.add(s.id); });
      });
    });
    Object.entries(clubSelection).forEach(([clubId, isSelected]) => {
        if (isSelected) sportsClubs.find(c => c.id === clubId)?.memberIds.forEach(id => selectedStudentIds.add(id));
    });
    let students = Array.from(selectedStudentIds).map(id => allStudents.find(s => s.id === id)).filter((s): s is Student => !!s);
    if (selectedGender !== "all" && selectedGender !== "separate") students = students.filter((s) => s.gender === selectedGender);
    return students;
  }, [classSelection, clubSelection, sportsClubs, selectedGender, allStudents]);

  useEffect(() => {
    if (school && targetStudents.length > 0 && selectedItemNames.length > 0) {
      const studentIdToRawScores = new Map<string, { totalScore: number; scores: { item: string; score: number }[] }>();
      const studentsForAnalysis = targetStudents.filter(s => !excludeNonParticipants || selectedItemNames.some(name => allRecords.some(r => r.studentId === s.id && r.item === name)));
      
      const ranksByGrade = new Map();
      const distinctGrades = [...new Set(studentsForAnalysis.map(s => s.grade))];
      
      // Cache ranks by grade to avoid repeated calculations
      distinctGrades.forEach(g => {
          if (!ranksByGrade.has(g)) {
              ranksByGrade.set(g, calculateRanks(school, allItems, allRecords, allStudents, g));
          }
      });
      
      selectedItemNames.forEach(name => {
        studentsForAnalysis.forEach(student => {
            const gradeRanks = ranksByGrade.get(student.grade);
            const itemRanks = gradeRanks?.[name];
            let score = 0;
            if (itemRanks) {
                const rankInfo = itemRanks.find((r: any) => r.studentId === student.id);
                if (rankInfo && itemRanks.length > 0) {
                    // Pre-calculate percentile score
                    score = Math.round((1 - (rankInfo.rank - 1) / itemRanks.length) * 100);
                }
            }
            if (!studentIdToRawScores.has(student.id)) studentIdToRawScores.set(student.id, { totalScore: 0, scores: [] });
            studentIdToRawScores.get(student.id)!.scores.push({ item: name, score });
        });
      });

      const finalScores = new Map();
      studentIdToRawScores.forEach((data, id) => {
          const avgScore = data.scores.length > 0 ? Math.round(data.scores.reduce((acc, s) => acc + s.score, 0) / data.scores.length) : 0;
          finalScores.set(id, { ...data, totalScore: avgScore });
      });
      
      setStudentScores(finalScores);
      
      const newSel: Record<string, boolean> = {};
      finalScores.forEach((_, id) => newSel[id] = true);
      setBalancingSelection(newSel);
    } else {
        setStudentScores(new Map());
        setBalancingSelection({});
    }
  }, [targetStudents, selectedItemNames, excludeNonParticipants, allRecords, allItems, school, allStudents]);

  const candidateList = useMemo(() => {
    const list = targetStudents.map(s => ({
        student: s,
        score: studentScores.get(s.id)
    })).filter(item => item.score !== undefined);

    return list.sort((a, b) => (b.score?.totalScore || 0) - (a.score?.totalScore || 0));
  }, [targetStudents, studentScores]);

  const filteredCandidates = useMemo(() => {
    if (!studentSearchTerm) return candidateList;
    return candidateList.filter(c => c.student.name.includes(studentSearchTerm));
  }, [candidateList, studentSearchTerm]);

  const handleGetScoutingReport = async (student: Student) => {
    if (!school) return;
    setAnalyzingStudent(student);
    setIsReportLoading(true);
    setScoutingReport(null);
    try {
      const allItemRanks = calculateRanks(school, allItems, allRecords, allStudents, student.grade);
      const studentRanks: Record<string, string> = {};
      Object.entries(allItemRanks).forEach(([item, ranks]: [string, any]) => {
        const rankInfo = Array.isArray(ranks) ? ranks.find((r: any) => r.studentId === student.id) : null;
        if (rankInfo) {
          studentRanks[item] = `${ranks.length}명 중 ${rankInfo.rank}등`;
        }
      });
      
      const scores = studentScores.get(student.id)?.scores || [];
      const result = await getScoutingReport({
        studentName: student.name,
        abilityScores: scores.map(s => {
          const itemInfo = allItems.find(i => i.name === s.item);
          return { ...s, category: itemInfo?.category || (itemInfo?.isPaps ? 'PAPS' : '기타') };
        }),
        ranks: studentRanks,
        allItems: allItems
      });
      setScoutingReport(result);
    } catch (e) {
      toast({ variant: "destructive", title: "AI 분석 실패" });
    } finally {
      setIsReportLoading(false);
    }
  };

  const handleBalanceTeams = () => {
    const ids = Object.entries(balancingSelection).filter(([, s]) => s).map(([id]) => id);
    if (!ids.length) { toast({ variant: "destructive", title: "학생을 선택하세요" }); return; }
    
    const studentsToBalance = allStudents.filter(s => ids.includes(s.id));
    let balancedArrays: Student[][] = [];
    
    // Helper to balance a single list of students into N teams
    const balanceList = (list: Student[], count: number): Student[][] => {
        const result: Student[][] = Array.from({ length: count }, () => []);
        let baseList = [...list];
        
        if (balancingStrategy === 'random') {
            baseList.sort(() => Math.random() - 0.5);
        } else {
            baseList = baseList.map(s => ({ s, score: studentScores.get(s.id)?.totalScore || 0 }))
                       .sort((a,b) => b.score - a.score)
                       .map(x => x.s);
        }

        if (balancingStrategy === 'balanced') {
            let dir = 1, idx = 0;
            baseList.forEach(s => {
                result[idx].push(s);
                idx += dir;
                if (idx < 0 || idx >= count) { dir *= -1; idx += dir; }
            });
        } else if (balancingStrategy === 'by-ability') {
            const perTeam = baseList.length / count;
            baseList.forEach((s, i) => {
                const tIdx = Math.min(count - 1, Math.floor(i / perTeam));
                result[tIdx].push(s);
            });
        } else {
            baseList.forEach((s, i) => {
                result[i % count].push(s);
            });
        }
        return result;
    };

    if (selectedGender === 'separate') {
        const males = studentsToBalance.filter(s => s.gender === '남');
        const females = studentsToBalance.filter(s => s.gender === '여');
        
        let teamCount = 0;
        if (divideBy === 'teams') {
            teamCount = numTeams;
        } else {
            teamCount = Math.max(1, Math.floor(studentsToBalance.length / membersPerTeam));
        }

        const maleGroups = balanceList(males, teamCount);
        const femaleGroups = balanceList(females, teamCount);
        
        balancedArrays = Array.from({ length: teamCount }, (_, i) => {
            return [...maleGroups[i], ...femaleGroups[i]];
        });
        
        // Find leftovers for 'members-per-team' mode if any
        if (divideBy === 'members') {
            // Simplified: logic above already distributes everyone. 
            // If we want exact leftovers:
            setLeftoverStudents([]);
        }
    } else {
        // Original combined logic
        let baseList = [...studentsToBalance];
        
        if (balancingStrategy === 'random') {
            baseList.sort(() => Math.random() - 0.5);
        } else {
            baseList = baseList.map(s => ({ s, score: studentScores.get(s.id)?.totalScore || 0 }))
                       .sort((a,b) => b.score - a.score)
                       .map(x => x.s);
        }
        
        if (divideBy === 'teams') {
            const count = numTeams;
            balancedArrays = Array.from({ length: count }, () => []);
            
            if (balancingStrategy === 'balanced') {
                let dir = 1, idx = 0;
                baseList.forEach(s => {
                    balancedArrays[idx].push(s);
                    idx += dir;
                    if (idx < 0 || idx >= count) { dir *= -1; idx += dir; }
                });
            } else if (balancingStrategy === 'by-ability') {
                const perTeam = baseList.length / count;
                baseList.forEach((s, i) => {
                    const tIdx = Math.min(count - 1, Math.floor(i / perTeam));
                    balancedArrays[tIdx].push(s);
                });
            } else {
                baseList.forEach((s, i) => {
                    balancedArrays[i % count].push(s);
                });
            }
            setLeftoverStudents([]);
        } else if (divideBy === 'members') {
            const teamCount = Math.floor(baseList.length / membersPerTeam);
            if (teamCount === 0) { toast({ variant: "destructive", title: "인원이 너무 적습니다" }); return; }
            balancedArrays = Array.from({ length: teamCount }, () => []);
            const toDist = baseList.slice(0, teamCount * membersPerTeam);
            const leftovers = baseList.slice(teamCount * membersPerTeam);
            
            if (balancingStrategy === 'balanced') {
                let dir = 1, idx = 0;
                toDist.forEach(s => {
                    balancedArrays[idx].push(s);
                    idx += dir;
                    if (idx < 0 || idx >= teamCount) { dir *= -1; idx += dir; }
                });
            } else if (balancingStrategy === 'by-ability') {
                toDist.forEach((s, i) => {
                    const tIdx = Math.floor(i / membersPerTeam);
                    balancedArrays[tIdx].push(s);
                });
            } else {
                toDist.forEach((s, i) => {
                    balancedArrays[i % teamCount].push(s);
                });
            }
            setLeftoverStudents(leftovers);
        } else {
            balancedArrays = [baseList];
            setLeftoverStudents([]);
        }
    }

    setTeams(balancedArrays.map((arr, i) => ({
        id: uuidv4(),
        name: `${arr[0]?.grade || ''}-${arr[0]?.classNum || ''} 팀 ${i+1}`,
        teamIndex: i,
        memberIds: arr.sort((a,b) => {
            if (a.gender !== b.gender) return a.gender === '남' ? -1 : 1;
            return 0;
        }).map(s => s.id),
        members: arr.sort((a,b) => {
            if (a.gender !== b.gender) return a.gender === '남' ? -1 : 1;
            return 0;
        })
    })));
    toast({ title: "팀 편성 완료" });
  };

  const handleRenameTeam = (teamId: string, newName: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, name: newName } : t));
  };

  const handleMoveStudent = (studentId: string, sourceTeamId: string, targetTeamId: string) => {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    setTeams(prev => {
      return prev.map(t => {
        if (t.id === sourceTeamId) {
          return {
            ...t,
            memberIds: t.memberIds.filter(id => id !== studentId),
            members: t.members?.filter(m => m.id !== studentId)
          };
        }
        if (t.id === targetTeamId) {
          return {
            ...t,
            memberIds: [...t.memberIds, studentId],
            members: [...(t.members || []), student]
          };
        }
        return t;
      });
    });
    setMovingStudent(null);
    toast({ title: `${student.name} 학생 이동 완료` });
  };

  const handleDeleteTeamGroup = async () => {
    if (!school || !selectedTeamGroupId) return;
    try {
      await deleteTeamGroup(school, selectedTeamGroupId);
      onTeamGroupDelete(selectedTeamGroupId);
      resetToNewTeam();
      toast({ title: "팀 편성 삭제 완료" });
    } catch (error) {
      console.error("Failed to delete team group", error);
      toast({ variant: "destructive", title: "삭제 실패" });
    }
  };

  const handleSendTeams = async () => {
    if (!school || !teams.length || !teamGroupName) { toast({ variant: "destructive", title: "정보 부족" }); return; }
    setIsSending(true);
    try {
      const input: TeamGroup = {
        id: selectedTeamGroupId || `teamgrp_${Date.now()}`,
        school, 
        description: teamGroupName, 
        analysisScope: 'class', 
        gender: selectedGender, 
        divideBy, 
        numTeams, 
        membersPerTeam, 
        balancingStrategy, 
        itemNamesForBalancing: selectedItemNames,
        teams: teams.map(t => ({ id: t.id, teamIndex: t.teamIndex, memberIds: t.memberIds, name: t.name })),
        createdAt: new Date().toISOString(),
      };
      await saveTeamGroup(school, input);
      onTeamGroupUpdate(input);
      toast({ title: selectedTeamGroupId ? "업데이트 완료" : "학생들에게 팀 정보 전달 완료" });
    } finally { setIsSending(false); }
  };

  const teamAverages = useMemo(() => {
    const map = new Map();
    teams.forEach(t => {
        const avgScores = selectedItemNames.map(name => {
            const scores = t.members?.map(m => {
                const sData = studentScores.get(m.id);
                return sData?.scores.find(s => s.item === name)?.score || 0;
            }) || [];
            return { item: name, score: scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0 };
        });
        map.set(t.id, avgScores);
    });
    return map;
  }, [teams, studentScores, selectedItemNames]);

  if (!school) {
      return (
          <div className="space-y-6">
              <Card className="bg-transparent shadow-none border-none">
                  <CardHeader className="px-0"><Skeleton className="h-10 w-48" /></CardHeader>
                  <CardContent className="px-0 space-y-4">
                      <div className="flex gap-2"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-32" /></div>
                  </CardContent>
              </Card>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1,2,3,4,5,6].map(i => (
                      <Card key={i} className="p-4 space-y-3">
                          <Skeleton className="h-6 w-1/3" />
                          <div className="space-y-2">
                              {[1,2,3,4,5].map(j => <Skeleton key={j} className="h-10 w-full" />)}
                          </div>
                      </Card>
                  ))}
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-transparent shadow-none border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shuffle /> 팀 자동 편성</CardTitle>
          <div className="flex flex-wrap gap-2 pt-4 p-4 border rounded-md bg-muted/50">
              <Select onValueChange={handleLoadTeamGroup} value={selectedTeamGroupId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="저장된 편성 불러오기..." /></SelectTrigger>
                  <SelectContent>{teamGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.description}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" onClick={resetToNewTeam}><RefreshCw className="mr-2 h-4 w-4"/>새 편성</Button>
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={!selectedTeamGroupId}><Trash2 className="h-4 w-4"/></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle></AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteTeamGroup} className="bg-destructive text-destructive-foreground">삭제</AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border rounded-md space-y-4 bg-card/50">
              <h3 className="font-bold flex items-center gap-2 text-primary"><Info className="h-4 w-4" /> 1. 편성 대상 및 기준 설정</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase">대상 학급 및 클럽</Label>
                      <Accordion type="multiple" className="border rounded-md p-2 bg-background">
                          {grades.map(g => (
                              <AccordionItem key={g} value={g}>
                                  <div className="flex items-center gap-2 p-2">
                                      <Checkbox checked={classSelection[g]?.all || false} onCheckedChange={c => {
                                          const next = { ...classSelection };
                                          next[g].all = !!c;
                                          Object.keys(next[g].classes).forEach(cn => next[g].classes[cn] = !!c);
                                          setClassSelection(next);
                                      }} />
                                      <Label className="text-sm font-bold">{g}학년</Label><AccordionTrigger className="ml-auto" />
                                  </div>
                                  <AccordionContent className="grid grid-cols-3 gap-2 pl-8">
                                      {classNumsByGrade[g]?.map(cn => (
                                          <div key={cn} className="flex items-center gap-2">
                                              <Checkbox checked={classSelection[g]?.classes[cn] || false} onCheckedChange={c => {
                                                  const next = { ...classSelection };
                                                  next[g].classes[cn] = !!c;
                                                  next[g].all = Object.values(next[g].classes).every(Boolean);
                                                  setClassSelection(next);
                                              }} />
                                              <Label className="text-xs">{cn}반</Label>
                                          </div>
                                      ))}
                                  </AccordionContent>
                              </AccordionItem>
                          ))}
                          {sportsClubs.length > 0 && (
                              <AccordionItem value="clubs">
                                  <div className="flex items-center gap-2 p-2">
                                      <Label className="text-sm font-bold">스포츠 클럽</Label><AccordionTrigger className="ml-auto" />
                                  </div>
                                  <AccordionContent className="space-y-2 pl-8">
                                      {sportsClubs.map(club => (
                                          <div key={club.id} className="flex items-center gap-2">
                                              <Checkbox checked={clubSelection[club.id] || false} onCheckedChange={c => setClubSelection({...clubSelection, [club.id]: !!c})} />
                                              <Label className="text-xs">{club.name}</Label>
                                          </div>
                                      ))}
                                  </AccordionContent>
                              </AccordionItem>
                          )}
                      </Accordion>
                  </div>
                  <div className="space-y-4">
                      <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground uppercase">상세 필터</Label>
                          <Select value={selectedGender} onValueChange={v=>setSelectedGender(v as any)}>
                              <SelectTrigger className="w-full bg-background"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="all">전체(혼성)</SelectItem>
                                  <SelectItem value="separate">성별 분리 편성</SelectItem>
                                  <SelectItem value="남">남학생만</SelectItem>
                                  <SelectItem value="여">여학생만</SelectItem>
                              </SelectContent>
                          </Select>
                          <div className="flex items-center gap-2 pt-2">
                              <Checkbox id="ex" checked={excludeNonParticipants} onCheckedChange={c=>setExcludeNonParticipants(!!c)}/>
                              <Label htmlFor="ex" className="text-xs font-medium">기록 없는 학생 제외</Label>
                          </div>
                      </div>
                      <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground uppercase">편성 기준</Label>
                          <Select value={balancingStrategy} onValueChange={v => setBalancingStrategy(v as any)}>
                              <SelectTrigger className="w-full bg-background"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="balanced">능력치 균등 편성 (팀별 실력 비슷)</SelectItem>
                                  <SelectItem value="by-ability">능력별 편성 (실력순 팀 구성)</SelectItem>
                                  <SelectItem value="random">랜덤 편성 (무작위 섞기)</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground uppercase">편성 방식</Label>
                          <div className="flex gap-2">
                              <Select value={divideBy} onValueChange={v => setDivideBy(v as any)}>
                                  <SelectTrigger className="flex-1 bg-background"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="teams">팀 수 기준</SelectItem>
                                      <SelectItem value="members">팀당 인원 기준</SelectItem>
                                  </SelectContent>
                              </Select>
                              {divideBy === 'teams' ? (
                                  <Input type="number" value={numTeams} onChange={e => setNumTeams(parseInt(e.target.value))} className="w-20" min={2} />
                              ) : (
                                  <Input type="number" value={membersPerTeam} onChange={e => setMembersPerTeam(parseInt(e.target.value))} className="w-20" min={2} />
                              )}
                          </div>
                      </div>
                  </div>
              </div>
              <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">밸런스 기준 종목 (다중 선택)</Label>
                  <div className="p-3 border rounded-md bg-background flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                      {Object.entries(groupedItems).map(([cat, items]) => (
                          <div key={cat} className="contents">
                              {items.map(i => (
                                  <div key={i.id} className="flex items-center gap-2 bg-secondary/30 p-1.5 px-3 rounded-full hover:bg-secondary/50 transition-colors">
                                      <Checkbox id={`item-${i.id}`} checked={selectedItemNames.includes(i.name)} onCheckedChange={c => setSelectedItemNames(prev => c ? [...prev, i.name] : prev.filter(n=>n!==i.name))} />
                                      <Label htmlFor={`item-${i.id}`} className="text-xs font-bold cursor-pointer">{i.name}</Label>
                                  </div>
                              ))}
                          </div>
                      ))}
                  </div>
              </div>
          </div>

          {candidateList.length > 0 && (
              <div className="p-4 border rounded-md space-y-4 bg-card/50 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-center border-b pb-2">
                      <h3 className="font-bold flex items-center gap-2 text-primary"><BarChart2 className="h-4 w-4" /> 2. 대상 학생 명단 및 AI 분석</h3>
                      <div className="relative w-48">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input 
                              placeholder="학생 이름 검색..." 
                              value={studentSearchTerm} 
                              onChange={e => setStudentSearchTerm(e.target.value)} 
                              className="pl-9 h-9 text-xs"
                          />
                      </div>
                  </div>
                  <div className="border rounded-md overflow-hidden bg-background max-h-[400px] overflow-y-auto">
                      <Table>
                          <TableHeader className="bg-muted/50 sticky top-0 z-10">
                              <TableRow>
                                  <TableHead className="w-12 text-center">순위</TableHead>
                                  <TableHead>이름</TableHead>
                                  <TableHead>학년-반</TableHead>
                                  <TableHead className="text-center">능력치(평균)</TableHead>
                                  <TableHead className="text-right">AI 분석</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {filteredCandidates.map((c, idx) => (
                                  <TableRow key={c.student.id} className="hover:bg-muted/30">
                                      <TableCell className="text-center font-bold text-muted-foreground">{idx + 1}</TableCell>
                                      <TableCell className="font-bold">{c.student.name}</TableCell>
                                      <TableCell className="text-xs">{c.student.grade}-{c.student.classNum}</TableCell>
                                      <TableCell className="text-center">
                                          <Badge variant={c.score!.totalScore >= 80 ? 'default' : c.score!.totalScore >= 50 ? 'secondary' : 'outline'} className="font-black">
                                              {c.score!.totalScore}점
                                          </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">
                                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleGetScoutingReport(c.student)}>
                                              <Search className="h-4 w-4 text-primary" />
                                          </Button>
                                      </TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">* 능력치는 선택한 기준 종목들의 학년 내 백분위 점수 평균입니다.</p>
              </div>
          )}

          {teams.length > 0 && (
              <div className="p-4 border rounded-md space-y-4 bg-primary/5 animate-in zoom-in-95 duration-300" onClick={() => setMovingStudent(null)}>
                  <div className="flex flex-wrap gap-4 items-end border-b pb-4">
                      <div className="space-y-2">
                          <Label className="text-xs font-bold text-primary">편성 이름</Label>
                          <Input value={teamGroupName} onChange={e=>setTeamGroupName(e.target.value)} placeholder="예: 5학년 축구 대회" className="w-[240px] font-bold border-primary/20" />
                      </div>
                      <Button onClick={handleBalanceTeams} variant="outline" className="font-bold"><RefreshCw className="mr-2 h-4 w-4" /> 다시 편성</Button>
                      <Button onClick={handleSendTeams} disabled={isSending} className="ml-auto font-black shadow-lg">
                          {isSending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Send className="mr-2 h-4 w-4" />}
                          학생들에게 팀 정보 전달
                      </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {teams.map((t) => (
                          <Card key={t.id} className={cn(
                              "cursor-pointer transition-all border-2", 
                              movingStudent && movingStudent.sourceTeamId !== t.id ? "ring-2 ring-dashed ring-primary border-primary/50 animate-pulse" : "hover:border-primary/30"
                          )} onClick={() => movingStudent && movingStudent.sourceTeamId !== t.id ? handleMoveStudent(movingStudent.studentId, movingStudent.sourceTeamId, t.id) : null}>
                              <CardHeader className="p-3 border-b bg-muted/30">
                                  <div className="flex items-center gap-2 px-2">
                                      <Pencil className="w-3 h-3 text-muted-foreground shrink-0" />
                                      <Input 
                                          value={t.name} 
                                          onChange={e => handleRenameTeam(t.id, e.target.value)} 
                                          className="h-8 text-center font-black bg-transparent border-none focus-visible:ring-0 shadow-none p-0 text-sm" 
                                          placeholder="팀 이름"
                                      />
                                  </div>
                              </CardHeader>
                              <CardContent className="p-3 space-y-3">
                                  <div className="h-[120px]">
                                      <ResponsiveContainer width="100%" height="100%">
                                          <RadarChart data={teamAverages.get(t.id)}>
                                              <PolarGrid strokeOpacity={0.2} />
                                              <PolarAngleAxis dataKey="item" tick={{fontSize: 8, fontWeight: 700}} />
                                              <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                                          </RadarChart>
                                      </ResponsiveContainer>
                                  </div>
                                  <div className="space-y-1">
                                      {t.members?.map(m => (
                                          <div key={m.id} className={cn(
                                              "flex items-center gap-2 p-1.5 px-2 rounded text-xs transition-colors", 
                                              movingStudent?.studentId === m.id ? "bg-primary text-white" : "hover:bg-muted"
                                          )} onClick={(e) => { e.stopPropagation(); setMovingStudent({ studentId: m.id, sourceTeamId: t.id }); }}>
                                              <span className="font-bold">{m.name}</span>
                                              <span className="text-[9px] opacity-60 ml-auto">{studentScores.get(m.id)?.totalScore}점</span>
                                              {movingStudent?.studentId === m.id && <Move className="h-3 w-3" />}
                                          </div>
                                      ))}
                                  </div>
                              </CardContent>
                          </Card>
                      ))}
                  </div>
              </div>
          )}
          {!teams.length && targetStudents.length > 0 && selectedItemNames.length > 0 && (
              <Button onClick={handleBalanceTeams} className="w-full h-14 text-lg font-black shadow-xl hover:scale-[1.01] transition-transform">
                  조건에 맞춰 팀 편성하기
              </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!analyzingStudent} onOpenChange={(open) => !open && setAnalyzingStudent(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                      <Wand2 className="h-5 w-5 text-primary" />
                      {analyzingStudent?.name} 학생 실력 분석 및 AI 리포트
                  </DialogTitle>
                  <DialogDescription>선택된 기준 종목들의 학년 내 백분위 점수와 AI 분석 결과입니다.</DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto pr-2 py-4">
                {isReportLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
                        <p className="font-bold text-muted-foreground animate-pulse text-lg">데이터를 분석하고 리포트를 생성 중입니다...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                        {/* Left: Radar Chart */}
                        <div className="lg:col-span-2 space-y-4">
                            <Card className="border-primary/10 shadow-sm bg-muted/5">
                                <CardHeader className="p-4 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <BarChart2 className="h-4 w-4 text-primary" /> 능력치 스파이더웹
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-6 h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={studentScores.get(analyzingStudent?.id || '')?.scores || []}>
                                            <PolarGrid strokeOpacity={0.3} />
                                            <PolarAngleAxis dataKey="item" tick={{fontSize: 10, fontWeight: 700}} />
                                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                            <Radar
                                                name="능력치"
                                                dataKey="score"
                                                stroke="hsl(var(--primary))"
                                                fill="hsl(var(--primary))"
                                                fillOpacity={0.5}
                                            />
                                            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))' }} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                                <div className="p-3 bg-primary/5 text-center border-t">
                                    <p className="text-xs font-bold text-muted-foreground uppercase">평균 능력치 점수</p>
                                    <p className="text-2xl font-black text-primary">{studentScores.get(analyzingStudent?.id || '')?.totalScore}점</p>
                                </div>
                            </Card>
                        </div>

                        {/* Right: AI Scouting Report */}
                        <div className="lg:col-span-3 space-y-4">
                            {scoutingReport ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-green-50 rounded-2xl border border-green-100 shadow-sm">
                                            <h4 className="font-black text-green-700 text-sm flex items-center gap-1.5 mb-2">
                                                <CheckCircle2 className="h-4 w-4" /> 핵심 강점
                                            </h4>
                                            <p className="text-xs font-medium text-green-900 leading-relaxed whitespace-pre-wrap">{scoutingReport.strengths}</p>
                                        </div>
                                        <div className="p-4 bg-red-50 rounded-2xl border border-red-100 shadow-sm">
                                            <h4 className="font-black text-red-700 text-sm flex items-center gap-1.5 mb-2">
                                                <Info className="h-4 w-4" /> 보완점
                                            </h4>
                                            <p className="text-xs font-medium text-red-900 leading-relaxed whitespace-pre-wrap">{scoutingReport.weaknesses}</p>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 shadow-sm">
                                        <h4 className="font-black text-primary text-sm flex items-center gap-1.5 mb-2">
                                            <Trophy className="h-4 w-4" /> 종합 평가
                                        </h4>
                                        <p className="text-sm font-bold text-foreground leading-relaxed italic">{scoutingReport.assessment}</p>
                                    </div>
                                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 shadow-sm">
                                        <h4 className="font-black text-amber-700 text-sm flex items-center gap-1.5 mb-2">
                                            <Wand2 className="h-4 w-4" /> 추천 포지션
                                        </h4>
                                        <p className="text-sm font-black text-amber-900">{scoutingReport.position}</p>
                                    </div>
                                    <div className="p-4 bg-muted/30 rounded-2xl border border-dashed">
                                        <h4 className="font-black text-muted-foreground text-sm flex items-center gap-1.5 mb-2">
                                            <BarChart2 className="h-4 w-4" /> 맞춤 훈련법
                                        </h4>
                                        <p className="text-xs font-medium text-foreground/80 leading-relaxed whitespace-pre-wrap">{scoutingReport.suggestedTrainingMethods}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-3xl p-8">
                                    <Wand2 className="h-12 w-12 mb-4 opacity-20" />
                                    <p className="font-bold">분석 데이터가 로드되지 않았습니다.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
              </div>

              <DialogFooter className="border-t pt-4">
                  <Button onClick={() => setAnalyzingStudent(null)} className="font-bold">확인 완료</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
