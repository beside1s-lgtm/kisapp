"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  calculateRanks,
  saveTeamGroup,
  deleteTeamGroup,
} from '@/lib/services/peService';
import { Student, MeasurementItem, MeasurementRecord, TeamGroup, Team, SportsClub } from '@/lib/pe/types';
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
  Search,
  Pencil,
  BarChart2,
  Info,
  CheckCircle2,
  Trophy,
  SlidersHorizontal,
  Users,
  Check,
  Crown,
  ArrowRightLeft,
  Sliders,
  Sparkles,
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
    };
  };
};

export default function TeamBalancer({
  allStudents,
  allItems,
  allRecords,
  teamGroups,
  onTeamGroupUpdate,
  onTeamGroupDelete,
  sportsClubs,
}: TeamBalancerProps) {
  const { user } = useAuth();
  const school = 'KISH';
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

  // 뷰 모드 및 서브 네비게이션: 'teams' | 'setup' | 'students'
  const [activeTab, setActiveTab] = useState<'teams' | 'setup' | 'students'>('setup');
  const [showRadar, setShowRadar] = useState(false);
  const [selectedTeamTab, setSelectedTeamTab] = useState<string>('all');

  // 학생 수동 이동 다이얼로그
  const [studentToMove, setStudentToMove] = useState<{ student: Student; sourceTeamId: string } | null>(null);

  // Student ID -> { totalScore (0-100), individualScores: [] }
  const [studentScores, setStudentScores] = useState<Map<string, { totalScore: number; scores: { item: string; score: number }[] }>>(new Map());
  const [balancingSelection, setBalancingSelection] = useState<Record<string, boolean>>({});
  const [teamGroupName, setTeamGroupName] = useState("");

  const [scoutingReport, setScoutingReport] = useState<ScoutingReportOutput | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [analyzingStudent, setAnalyzingStudent] = useState<Student | null>(null);

  const [isSending, setIsSending] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");

  const { grades, classNumsByGrade, groupedItems, uniqueItems } = useMemo(() => {
    const grades = [...new Set(allStudents.map((s) => s.grade))].sort((a, b) => parseInt(a) - parseInt(b));
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach((grade) => {
      const classes = [...new Set(allStudents.filter((s) => s.grade === grade).map((s) => s.classNum))].sort(
        (a, b) => parseInt(a) - parseInt(b)
      );
      classNumsByGrade[grade] = classes;
    });

    const seenNames = new Set<string>();
    const uniqueItems: MeasurementItem[] = [];
    const grouped: Record<string, MeasurementItem[]> = { PAPS: [] };

    allItems.forEach((item) => {
      if (item.isArchived || item.isDeactivated) return;
      const nameKey = (item.name || '').trim();
      if (!nameKey || seenNames.has(nameKey)) return;
      seenNames.add(nameKey);
      uniqueItems.push(item);

      const category = item.category || (item.isPaps ? "PAPS" : "기타");
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(item);
    });
    return { grades, classNumsByGrade, groupedItems: grouped, uniqueItems };
  }, [allStudents, allItems]);

  useEffect(() => {
    if (Object.keys(classSelection).length === 0 && grades.length > 0) {
      const initialSelection: ClassSelection = {};
      grades.forEach((grade) => {
        initialSelection[grade] = { all: false, classes: {} };
        classNumsByGrade[grade]?.forEach((classNum) => {
          initialSelection[grade].classes[classNum] = false;
        });
      });
      setClassSelection(initialSelection);
    }
  }, [grades, classNumsByGrade]);

  // 팀이 생성되면 자동으로 팀 탭으로 전환
  useEffect(() => {
    if (teams.length > 0) {
      setActiveTab('teams');
    }
  }, [teams.length]);

  const resetToNewTeam = () => {
    setSelectedTeamGroupId('');
    setTeamGroupName('');
    setTeams([]);
    setLeftoverStudents([]);
    setStudentScores(new Map());
    setBalancingSelection({});
    setAnalyzingStudent(null);
    setScoutingReport(null);
    setActiveTab('setup');
  };

  const handleLoadTeamGroup = (groupId: string) => {
    const group = teamGroups.find((g) => g.id === groupId);
    if (!group) return;
    setSelectedTeamGroupId(groupId);
    setTeamGroupName(group.description);
    const studentMap = new Map(allStudents.map((s) => [s.id, s]));
    const teamsWithMembers = group.teams.map((team) => {
      const members = team.memberIds.map((id) => studentMap.get(id)).filter((s): s is Student => !!s);
      members.sort((a, b) => {
        const scoreA = studentScores.get(a.id)?.totalScore ?? 0;
        const scoreB = studentScores.get(b.id)?.totalScore ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.name.localeCompare(b.name);
      });
      return {
        ...team,
        members,
      };
    });
    setTeams(teamsWithMembers);
    setSelectedGender(group.gender || 'all');
    setSelectedItemNames(group.itemNamesForBalancing || []);
    setDivideBy(group.divideBy || 'teams');
    setNumTeams(group.numTeams || 2);
    setMembersPerTeam(group.membersPerTeam || 4);
    setBalancingStrategy(group.balancingStrategy || 'balanced');
    setLeftoverStudents([]);
    setActiveTab('teams');
    toast({ title: "팀 편성 로드 완료" });
  };

  const targetStudents = useMemo(() => {
    const selectedStudentIds = new Set<string>();
    Object.entries(classSelection).forEach(([grade, selection]) => {
      Object.entries(selection.classes).forEach(([classNum, isSelected]) => {
        if (isSelected) {
          allStudents.forEach((s) => {
            if (s.grade === grade && s.classNum === classNum) selectedStudentIds.add(s.id);
          });
        }
      });
    });
    Object.entries(clubSelection).forEach(([clubId, isSelected]) => {
      if (isSelected) sportsClubs.find((c) => c.id === clubId)?.memberIds.forEach((id) => selectedStudentIds.add(id));
    });
    let students = Array.from(selectedStudentIds)
      .map((id) => allStudents.find((s) => s.id === id))
      .filter((s): s is Student => !!s);
    if (selectedGender !== "all" && selectedGender !== "separate") {
      students = students.filter((s) => s.gender === selectedGender);
    }
    return students;
  }, [classSelection, clubSelection, sportsClubs, selectedGender, allStudents]);

  useEffect(() => {
    if (school && targetStudents.length > 0 && selectedItemNames.length > 0) {
      const studentIdToRawScores = new Map<string, { totalScore: number; scores: { item: string; score: number }[] }>();
      const studentsForAnalysis = targetStudents.filter(
        (s) => !excludeNonParticipants || selectedItemNames.some((name) => allRecords.some((r) => r.studentId === s.id && r.item === name))
      );

      const ranksByGrade = new Map();
      const distinctGrades = [...new Set(studentsForAnalysis.map((s) => s.grade))];

      distinctGrades.forEach((g) => {
        if (!ranksByGrade.has(g)) {
          ranksByGrade.set(g, calculateRanks(school, uniqueItems, allRecords, allStudents, g));
        }
      });

      selectedItemNames.forEach((name) => {
        studentsForAnalysis.forEach((student) => {
          const gradeRanks = ranksByGrade.get(student.grade);
          const itemRanks = gradeRanks?.[name];
          let score = 0;
          if (itemRanks) {
            const rankInfo = itemRanks.find((r: any) => r.studentId === student.id);
            if (rankInfo && itemRanks.length > 0) {
              score = Math.round((1 - (rankInfo.rank - 1) / itemRanks.length) * 100);
            }
          }
          if (!studentIdToRawScores.has(student.id)) studentIdToRawScores.set(student.id, { totalScore: 0, scores: [] });
          studentIdToRawScores.get(student.id)!.scores.push({ item: name, score });
        });
      });

      const finalScores = new Map();
      studentIdToRawScores.forEach((data, id) => {
        const avgScore =
          data.scores.length > 0 ? Math.round(data.scores.reduce((acc, s) => acc + s.score, 0) / data.scores.length) : 0;
        finalScores.set(id, { ...data, totalScore: avgScore });
      });

      setStudentScores(finalScores);

      const newSel: Record<string, boolean> = {};
      finalScores.forEach((_, id) => (newSel[id] = true));
      setBalancingSelection(newSel);
    } else {
      setStudentScores(new Map());
      setBalancingSelection({});
    }
  }, [targetStudents, selectedItemNames, excludeNonParticipants, allRecords, allItems, school, allStudents, uniqueItems]);

  const candidateList = useMemo(() => {
    const list = targetStudents
      .map((s) => ({
        student: s,
        score: studentScores.get(s.id),
      }))
      .filter((item) => item.score !== undefined);

    return list.sort((a, b) => (b.score?.totalScore || 0) - (a.score?.totalScore || 0));
  }, [targetStudents, studentScores]);

  const filteredCandidates = useMemo(() => {
    if (!studentSearchTerm) return candidateList;
    return candidateList.filter((c) => c.student.name.includes(studentSearchTerm));
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
        abilityScores: scores.map((s) => {
          const itemInfo = allItems.find((i) => i.name === s.item);
          return { ...s, category: itemInfo?.category || (itemInfo?.isPaps ? 'PAPS' : '기타') };
        }),
        ranks: studentRanks,
        allItems: allItems,
      });
      setScoutingReport(result);
    } catch (e) {
      toast({ variant: "destructive", title: "AI 분석 실패" });
    } finally {
      setIsReportLoading(false);
    }
  };

  const handleBalanceTeams = () => {
    const ids = Object.entries(balancingSelection)
      .filter(([, s]) => s)
      .map(([id]) => id);
    if (!ids.length) {
      toast({ variant: "destructive", title: "학생을 선택하세요" });
      return;
    }

    let studentsToBalance = targetStudents.filter((s) => ids.includes(s.id));
    if (selectedGender === '남') {
      studentsToBalance = studentsToBalance.filter((s) => s.gender === '남');
    } else if (selectedGender === '여') {
      studentsToBalance = studentsToBalance.filter((s) => s.gender === '여');
    }

    if (!studentsToBalance.length) {
      toast({ variant: "destructive", title: "선택된 조건에 맞는 학생이 없습니다" });
      return;
    }

    const balanceList = (list: Student[], count: number): Student[][] => {
      if (count <= 0 || list.length === 0) return [];
      const result: Student[][] = Array.from({ length: count }, () => []);
      let baseList = [...list];

      if (balancingStrategy === 'random') {
        baseList.sort(() => Math.random() - 0.5);
      } else {
        baseList = baseList
          .map((s) => ({ s, score: studentScores.get(s.id)?.totalScore || 0 }))
          .sort((a, b) => b.score - a.score)
          .map((x) => x.s);
      }

      if (balancingStrategy === 'balanced') {
        let dir = 1,
          idx = 0;
        baseList.forEach((s) => {
          result[idx].push(s);
          idx += dir;
          if (idx < 0 || idx >= count) {
            dir *= -1;
            idx += dir;
          }
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

    const generatedTeams: { name: string; members: Student[] }[] = [];
    const allLeftovers: Student[] = [];

    if (selectedGender === 'separate') {
      const males = studentsToBalance.filter((s) => s.gender === '남');
      const females = studentsToBalance.filter((s) => s.gender === '여');

      if (divideBy === 'teams') {
        const maleTeamCount = males.length > 0 ? numTeams : 0;
        const femaleTeamCount = females.length > 0 ? numTeams : 0;

        const maleGroups = balanceList(males, maleTeamCount);
        const femaleGroups = balanceList(females, femaleTeamCount);

        maleGroups.forEach((arr, i) => {
          if (arr.length > 0) {
            const gradeClass = `${arr[0]?.grade || ''}-${arr[0]?.classNum || ''}`.replace(/^-|-$/, '');
            generatedTeams.push({
              name: gradeClass ? `${gradeClass} 남 ${i + 1}팀` : `남자 ${i + 1}팀`,
              members: arr,
            });
          }
        });

        femaleGroups.forEach((arr, i) => {
          if (arr.length > 0) {
            const gradeClass = `${arr[0]?.grade || ''}-${arr[0]?.classNum || ''}`.replace(/^-|-$/, '');
            generatedTeams.push({
              name: gradeClass ? `${gradeClass} 여 ${i + 1}팀` : `여자 ${i + 1}팀`,
              members: arr,
            });
          }
        });
        setLeftoverStudents([]);
      } else if (divideBy === 'members') {
        const maleTeamCount = Math.floor(males.length / membersPerTeam);
        const femaleTeamCount = Math.floor(females.length / membersPerTeam);

        if (maleTeamCount === 0 && femaleTeamCount === 0) {
          toast({ variant: "destructive", title: "인원이 팀당 인원 설정보다 적습니다" });
          return;
        }

        if (maleTeamCount > 0) {
          const toDistMale = males.slice(0, maleTeamCount * membersPerTeam);
          const leftoversMale = males.slice(maleTeamCount * membersPerTeam);
          allLeftovers.push(...leftoversMale);
          const maleGroups = balanceList(toDistMale, maleTeamCount);
          maleGroups.forEach((arr, i) => {
            const gradeClass = `${arr[0]?.grade || ''}-${arr[0]?.classNum || ''}`.replace(/^-|-$/, '');
            generatedTeams.push({
              name: gradeClass ? `${gradeClass} 남 ${i + 1}팀` : `남자 ${i + 1}팀`,
              members: arr,
            });
          });
        } else if (males.length > 0) {
          allLeftovers.push(...males);
        }

        if (femaleTeamCount > 0) {
          const toDistFemale = females.slice(0, femaleTeamCount * membersPerTeam);
          const leftoversFemale = females.slice(femaleTeamCount * membersPerTeam);
          allLeftovers.push(...leftoversFemale);
          const femaleGroups = balanceList(toDistFemale, femaleTeamCount);
          femaleGroups.forEach((arr, i) => {
            const gradeClass = `${arr[0]?.grade || ''}-${arr[0]?.classNum || ''}`.replace(/^-|-$/, '');
            generatedTeams.push({
              name: gradeClass ? `${gradeClass} 여 ${i + 1}팀` : `여자 ${i + 1}팀`,
              members: arr,
            });
          });
        } else if (females.length > 0) {
          allLeftovers.push(...females);
        }
        setLeftoverStudents(allLeftovers);
      } else {
        if (males.length > 0) generatedTeams.push({ name: "남자 단일팀", members: males });
        if (females.length > 0) generatedTeams.push({ name: "여자 단일팀", members: females });
        setLeftoverStudents([]);
      }
    } else {
      const baseList = [...studentsToBalance];
      let balancedArrays: Student[][] = [];

      if (divideBy === 'teams') {
        const count = numTeams;
        balancedArrays = balanceList(baseList, count);
        setLeftoverStudents([]);
      } else if (divideBy === 'members') {
        const teamCount = Math.floor(baseList.length / membersPerTeam);
        if (teamCount === 0) {
          toast({ variant: "destructive", title: "인원이 너무 적습니다" });
          return;
        }
        const toDist = baseList.slice(0, teamCount * membersPerTeam);
        const leftovers = baseList.slice(teamCount * membersPerTeam);
        balancedArrays = balanceList(toDist, teamCount);
        setLeftoverStudents(leftovers);
      } else {
        balancedArrays = [baseList];
        setLeftoverStudents([]);
      }

      const genderSuffix = selectedGender === '남' ? ' (남)' : selectedGender === '여' ? ' (여)' : '';

      balancedArrays.forEach((arr, i) => {
        if (arr.length > 0) {
          const gradeClass = `${arr[0]?.grade || ''}-${arr[0]?.classNum || ''}`.replace(/^-|-$/, '');
          generatedTeams.push({
            name: gradeClass ? `${gradeClass} ${i + 1}팀${genderSuffix}` : `${i + 1}팀${genderSuffix}`,
            members: arr,
          });
        }
      });
    }

    setTeams(
      generatedTeams.map((gt, i) => {
        const sortedMembers = [...gt.members].sort((a, b) => {
          const scoreA = studentScores.get(a.id)?.totalScore ?? 0;
          const scoreB = studentScores.get(b.id)?.totalScore ?? 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          return a.name.localeCompare(b.name);
        });
        return {
          id: uuidv4(),
          name: gt.name,
          teamIndex: i,
          memberIds: sortedMembers.map((s) => s.id),
          members: sortedMembers,
        };
      })
    );
    setActiveTab('teams');
    toast({ title: "팀 편성 완료" });
  };

  const handleRenameTeam = (teamId: string, newName: string) => {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name: newName } : t)));
  };

  const handleMoveStudentToTeam = (studentId: string, sourceTeamId: string, targetTeamId: string) => {
    const student = allStudents.find((s) => s.id === studentId);
    if (!student) return;

    setTeams((prev) => {
      return prev.map((t) => {
        if (t.id === sourceTeamId) {
          return {
            ...t,
            memberIds: t.memberIds.filter((id) => id !== studentId),
            members: t.members?.filter((m) => m.id !== studentId),
          };
        }
        if (t.id === targetTeamId) {
          const nextMembers = [...(t.members || []), student].sort((a, b) => {
            const scoreA = studentScores.get(a.id)?.totalScore ?? 0;
            const scoreB = studentScores.get(b.id)?.totalScore ?? 0;
            if (scoreB !== scoreA) return scoreB - scoreA;
            return a.name.localeCompare(b.name);
          });
          return {
            ...t,
            memberIds: nextMembers.map((m) => m.id),
            members: nextMembers,
          };
        }
        return t;
      });
    });
    setStudentToMove(null);
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
    if (!school || !teams.length || !teamGroupName.trim()) {
      toast({ variant: "destructive", title: "편성 이름을 입력해주세요" });
      return;
    }
    setIsSending(true);
    try {
      const input: TeamGroup = {
        id: selectedTeamGroupId || `teamgrp_${Date.now()}`,
        school,
        description: teamGroupName.trim(),
        analysisScope: 'class',
        gender: selectedGender,
        divideBy,
        numTeams,
        membersPerTeam,
        balancingStrategy,
        itemNamesForBalancing: selectedItemNames,
        teams: teams.map((t) => ({ id: t.id, teamIndex: t.teamIndex, memberIds: t.memberIds, name: t.name })),
        createdAt: new Date().toISOString(),
      };
      await saveTeamGroup(school, input);
      onTeamGroupUpdate(input);
      toast({ title: selectedTeamGroupId ? "업데이트 완료" : "팀 편성 저장 및 전달 완료" });
    } finally {
      setIsSending(false);
    }
  };

  const teamAverages = useMemo(() => {
    const map = new Map<string, { item: string; score: number }[]>();
    teams.forEach((t) => {
      const avgScores = selectedItemNames.map((name) => {
        const scores =
          t.members?.map((m) => {
            const sData = studentScores.get(m.id);
            return sData?.scores.find((s) => s.item === name)?.score || 0;
          }) || [];
        return { item: name, score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0 };
      });
      map.set(t.id, avgScores);
    });
    return map;
  }, [teams, studentScores, selectedItemNames]);

  // 팀별 전체 평균 점수 및 편차 계산
  const teamOverallAverages = useMemo(() => {
    return teams.map((t) => {
      const scores = t.members?.map((m) => studentScores.get(m.id)?.totalScore ?? 0) || [];
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return { teamId: t.id, name: t.name, count: scores.length, avg };
    });
  }, [teams, studentScores]);

  const scoreDeviation = useMemo(() => {
    if (teamOverallAverages.length < 2) return 0;
    const avgs = teamOverallAverages.map((t) => t.avg);
    return Math.max(...avgs) - Math.min(...avgs);
  }, [teamOverallAverages]);

  // 선택된 학급 요약 문자열
  const selectedClassSummary = useMemo(() => {
    const selected: string[] = [];
    Object.entries(classSelection).forEach(([grade, data]) => {
      const selectedClasses = Object.entries(data.classes)
        .filter(([, checked]) => checked)
        .map(([cn]) => `${cn}반`);
      if (selectedClasses.length > 0) {
        selected.push(`${grade}학년(${selectedClasses.join(',')})`);
      }
    });
    return selected.length > 0 ? selected.join(' ') : '학급 미선택';
  }, [classSelection]);

  if (!school) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <Skeleton className="h-10 w-48 mb-4" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div id="team-balancer-root" className="w-full h-full flex flex-col min-h-0 overflow-hidden bg-slate-50/50 rounded-xl border border-slate-200/90 shadow-xs">
      {/* 1. 상단 1열 컴팩트 컨트롤 툴바 (모바일 한 화면 최적화) */}
      <div className="px-2.5 py-1.5 bg-white border-b border-slate-200/90 shrink-0 flex items-center justify-between gap-1.5 overflow-hidden">
        {/* 좌측: 편성 로드/생성/삭제 */}
        <div className="flex items-center gap-1 shrink-0">
          <Select onValueChange={handleLoadTeamGroup} value={selectedTeamGroupId}>
            <SelectTrigger className="w-[105px] sm:w-[150px] h-7 px-2 text-[11px] font-bold bg-slate-50 border-slate-300">
              <span className="truncate">
                {selectedTeamGroupId
                  ? teamGroups.find((g) => g.id === selectedTeamGroupId)?.description || "편성 선택"
                  : "저장된 편성"}
              </span>
            </SelectTrigger>
            <SelectContent>
              {teamGroups.map((g) => (
                <SelectItem key={g.id} value={g.id} className="text-xs">
                  {g.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={resetToNewTeam}
            className="h-7 px-2 text-[11px] font-bold bg-slate-50 border-slate-300 text-slate-700"
            title="새 편성 시작"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">새 편성</span>
          </Button>

          {selectedTeamGroupId && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50" title="편성 삭제">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>편성 삭제</AlertDialogTitle>
                </AlertDialogHeader>
                <p className="text-xs text-slate-600">이 팀 편성 데이터를 영구히 삭제하시겠습니까?</p>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteTeamGroup} className="bg-red-600 text-white">
                    삭제
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* 우측: 팀 편성명 입력 + 저장/전송 */}
        <div className="flex items-center gap-1 flex-1 max-w-[200px] sm:max-w-[280px] justify-end">
          <Input
            value={teamGroupName}
            onChange={(e) => setTeamGroupName(e.target.value)}
            placeholder="편성 이름 (예: 5학년 축구)"
            className="h-7 text-[11px] px-2 font-bold bg-slate-50 border-slate-300"
          />
          <Button
            size="sm"
            onClick={handleSendTeams}
            disabled={isSending || teams.length === 0}
            className="h-7 px-2 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-xs"
            title="학생들에게 팀 정보 전달 및 저장"
          >
            {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3 sm:mr-1" />}
            <span className="hidden sm:inline">저장</span>
          </Button>
        </div>
      </div>

      {/* 2. 세그먼트 탭 헤더: 팀 배정 | 대상/조건 설정 | 학생 분석 */}
      <div className="px-2 pt-1 pb-1 bg-slate-100/80 border-b border-slate-200 shrink-0 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg shrink-0">
          <button
            type="button"
            data-tab="teams"
            onClick={() => setActiveTab('teams')}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1",
              activeTab === 'teams'
                ? "bg-white text-indigo-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Trophy className="w-3 h-3 text-amber-500" />
            <span>팀 배정</span>
            {teams.length > 0 && (
              <span className="ml-0.5 px-1 py-0.2 bg-indigo-100 text-indigo-800 rounded-full text-[9px] font-black">
                {teams.length}
              </span>
            )}
          </button>

          <button
            type="button"
            data-tab="setup"
            onClick={() => setActiveTab('setup')}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1",
              activeTab === 'setup'
                ? "bg-white text-indigo-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Sliders className="w-3 h-3" />
            <span>조건 설정</span>
            {targetStudents.length > 0 && (
              <span className="ml-0.5 px-1 py-0.2 bg-slate-100 text-slate-700 rounded-full text-[9px] font-black">
                {targetStudents.length}명
              </span>
            )}
          </button>

          <button
            type="button"
            data-tab="students"
            onClick={() => setActiveTab('students')}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1",
              activeTab === 'students'
                ? "bg-white text-indigo-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Users className="w-3 h-3" />
            <span>학생 분석</span>
            {candidateList.length > 0 && (
              <span className="ml-0.5 px-1 py-0.2 bg-slate-100 text-slate-700 rounded-full text-[9px] font-black">
                {candidateList.length}
              </span>
            )}
          </button>
        </div>

        {/* 퀵 편성/다시편성 액션 버튼 */}
        <Button
          id="btn-auto-balance"
          size="sm"
          onClick={handleBalanceTeams}
          disabled={targetStudents.length === 0 || selectedItemNames.length === 0}
          className="h-7 px-2 text-[11px] font-black bg-indigo-700 hover:bg-indigo-800 text-white shrink-0 shadow-xs flex items-center gap-1"
        >
          <Shuffle className="w-3 h-3" />
          <span>{teams.length > 0 ? "다시 편성" : "자동 편성"}</span>
        </Button>
      </div>

      {/* 3. 본문 뷰 (스크롤 없는 1화면 구조) */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {/* ======================= TAB 1: 팀 배정 결과 뷰 ======================= */}
        {activeTab === 'teams' && (
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
        )}

        {/* ======================= TAB 2: 조건 및 대상 설정 뷰 ======================= */}
        {activeTab === 'setup' && (
          <div className="w-full h-full overflow-y-auto overscroll-contain p-2 sm:p-3 space-y-2.5">
            {/* 카드 1: 대상 학년 & 반 선택 */}
            <div className="p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black text-slate-800 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  1. 대상 학급 및 클럽 선택
                </Label>
                <Badge variant="outline" className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border-indigo-200">
                  선택 대상 {targetStudents.length}명
                </Badge>
              </div>

              {/* 학년 및 반 칩 목록 */}
              <div className="space-y-1.5 pt-1">
                {grades.map((grade) => {
                  const isGradeAll = classSelection[grade]?.all || false;
                  return (
                    <div key={grade} className="p-1.5 bg-slate-50 rounded-lg border border-slate-200/60 flex flex-col sm:flex-row sm:items-center gap-1.5">
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...classSelection };
                            const newVal = !isGradeAll;
                            next[grade].all = newVal;
                            Object.keys(next[grade].classes).forEach((cn) => (next[grade].classes[cn] = newVal));
                            setClassSelection(next);
                          }}
                          className={cn(
                            "px-2 py-0.5 rounded text-xs font-black transition-all",
                            isGradeAll
                              ? "bg-indigo-600 text-white shadow-2xs"
                              : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          {grade}학년 전체
                        </button>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap pl-1">
                        {classNumsByGrade[grade]?.map((classNum) => {
                          const isChecked = classSelection[grade]?.classes[classNum] || false;
                          return (
                            <button
                              key={classNum}
                              type="button"
                              onClick={() => {
                                const next = { ...classSelection };
                                next[grade].classes[classNum] = !isChecked;
                                next[grade].all = Object.values(next[grade].classes).every(Boolean);
                                setClassSelection(next);
                              }}
                              className={cn(
                                "px-2 py-0.5 rounded text-[11px] font-bold transition-all",
                                isChecked
                                  ? "bg-indigo-100 border border-indigo-300 text-indigo-900"
                                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                              )}
                            >
                              {classNum}반
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* 스포츠 클럽 선택 */}
                {sportsClubs.length > 0 && (
                  <div className="pt-1 flex items-center gap-1 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500 mr-1">스포츠클럽:</span>
                    {sportsClubs.map((club) => {
                      const isChecked = clubSelection[club.id] || false;
                      return (
                        <button
                          key={club.id}
                          type="button"
                          onClick={() => setClubSelection({ ...clubSelection, [club.id]: !isChecked })}
                          className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-bold transition-all",
                            isChecked
                              ? "bg-amber-100 border border-amber-300 text-amber-900"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          {club.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 카드 2: 밸런스 기준 종목 선택 */}
            <div className="p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black text-slate-800 flex items-center gap-1">
                  <BarChart2 className="w-3.5 h-3.5 text-indigo-600" />
                  2. 밸런스 기준 종목 (다중 선택)
                </Label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const papsItems = (groupedItems['PAPS'] || []).map((i) => i.name);
                      setSelectedItemNames(papsItems);
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:underline px-1"
                  >
                    PAPS만
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedItemNames(uniqueItems.map((i) => i.name))}
                    className="text-[10px] font-bold text-indigo-600 hover:underline px-1"
                  >
                    전체선택
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedItemNames([])}
                    className="text-[10px] font-bold text-slate-500 hover:underline px-1"
                  >
                    해제
                  </button>
                </div>
              </div>

              {/* 종목 태그 칩 */}
              <div className="flex flex-wrap gap-1 pt-1 max-h-32 overflow-y-auto scrollbar-thin">
                {uniqueItems.map((item) => {
                  const isSelected = selectedItemNames.includes(item.name);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSelectedItemNames((prev) =>
                          isSelected ? prev.filter((n) => n !== item.name) : [...prev, item.name]
                        )
                      }
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1",
                        isSelected
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 카드 3: 상세 필터 및 편성 옵션 */}
            <div className="p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <Label className="text-xs font-black text-slate-800 flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                3. 편성 방식 및 필터 옵션
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* 성별 구분 */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500">성별 옵션</span>
                  <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 rounded-lg">
                    {[
                      { id: 'all', label: '혼성' },
                      { id: 'separate', label: '성별분리' },
                      { id: '남', label: '남학생만' },
                      { id: '여', label: '여학생만' },
                    ].map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGender(g.id as any)}
                        className={cn(
                          "py-1 text-[10px] font-bold rounded transition-all text-center",
                          selectedGender === g.id
                            ? "bg-white text-indigo-700 shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 밸런스 기준 */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500">편성 로직</span>
                  <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-lg">
                    {[
                      { id: 'balanced', label: '균등 실력' },
                      { id: 'by-ability', label: '실력순' },
                      { id: 'random', label: '무작위' },
                    ].map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBalancingStrategy(b.id as any)}
                        className={cn(
                          "py-1 text-[10px] font-bold rounded transition-all text-center",
                          balancingStrategy === b.id
                            ? "bg-white text-indigo-700 shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 팀 수 / 팀당 인원 기준 */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500">나누는 기준</span>
                  <div className="flex items-center gap-1">
                    <Select value={divideBy} onValueChange={(v) => setDivideBy(v as any)}>
                      <SelectTrigger className="h-7 text-xs font-bold bg-slate-50 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="teams" className="text-xs">팀 수 기준</SelectItem>
                        <SelectItem value="members" className="text-xs">팀당 인원 기준</SelectItem>
                      </SelectContent>
                    </Select>
                    {divideBy === 'teams' ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          type="number"
                          value={numTeams}
                          onChange={(e) => setNumTeams(Math.max(2, parseInt(e.target.value) || 2))}
                          className="w-16 h-7 text-xs font-bold text-center"
                          min={2}
                        />
                        <span className="text-[11px] font-bold text-slate-600">개 팀</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          type="number"
                          value={membersPerTeam}
                          onChange={(e) => setMembersPerTeam(Math.max(2, parseInt(e.target.value) || 2))}
                          className="w-16 h-7 text-xs font-bold text-center"
                          min={2}
                        />
                        <span className="text-[11px] font-bold text-slate-600">명씩</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 기록 없는 학생 제외 스위치 */}
                <div className="flex items-center gap-2 pt-3 sm:pt-4">
                  <Checkbox
                    id="ex-non"
                    checked={excludeNonParticipants}
                    onCheckedChange={(c) => setExcludeNonParticipants(!!c)}
                  />
                  <Label htmlFor="ex-non" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                    측정 기록 없는 학생 제외
                  </Label>
                </div>
              </div>
            </div>

            {/* 실행 버튼 */}
            <div className="pt-1">
              <Button
                id="btn-auto-balance-bottom"
                onClick={handleBalanceTeams}
                disabled={targetStudents.length === 0 || selectedItemNames.length === 0}
                className="w-full h-10 text-xs font-black bg-indigo-700 hover:bg-indigo-800 text-white shadow-md flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>선택된 조건으로 팀 편성 실행 ({targetStudents.length}명 대상)</span>
              </Button>
            </div>
          </div>
        )}

        {/* ======================= TAB 3: 대상 학생 명단 및 AI 분석 뷰 ======================= */}
        {activeTab === 'students' && (
          <div className="w-full h-full flex flex-col min-h-0 overflow-hidden p-2 space-y-1.5">
            {/* 상단 검색 & 카운터 바 */}
            <div className="flex items-center justify-between gap-2 px-2 py-1 bg-white rounded-lg border border-slate-200 shrink-0">
              <div className="relative flex-1 max-w-[200px]">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  id="input-student-search"
                  placeholder="학생 이름 검색..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="pl-7 h-7 text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[10px] font-bold text-slate-700">
                  전체 {candidateList.length}명
                </Badge>
              </div>
            </div>

            {/* 학생 목록 테이블 (화면 꽉 차게 내부 스크롤) */}
            <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 overflow-y-auto overscroll-contain">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow className="h-7">
                    <TableHead className="w-10 text-center text-[10px] font-black p-1">순위</TableHead>
                    <TableHead className="text-[10px] font-black p-1">이름</TableHead>
                    <TableHead className="text-[10px] font-black p-1 text-center">반</TableHead>
                    <TableHead className="text-[10px] font-black p-1 text-center">성별</TableHead>
                    <TableHead className="text-[10px] font-black p-1 text-center">능력치</TableHead>
                    <TableHead className="w-12 text-right text-[10px] font-black p-1 pr-2">AI분석</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates.map((c, idx) => {
                    const score = c.score?.totalScore || 0;
                    return (
                      <TableRow key={c.student.id} className="h-8 hover:bg-indigo-50/50">
                        <TableCell className="text-center font-bold text-[10px] text-slate-400 p-1">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-bold text-xs p-1 text-slate-900">
                          {c.student.name}
                        </TableCell>
                        <TableCell className="text-center text-[11px] p-1 text-slate-600">
                          {c.student.grade}-{c.student.classNum}
                        </TableCell>
                        <TableCell className="text-center text-[10px] p-1 text-slate-500">
                          {c.student.gender}
                        </TableCell>
                        <TableCell className="text-center p-1">
                          <Badge
                            variant={score >= 80 ? 'default' : score >= 50 ? 'secondary' : 'outline'}
                            className="font-black text-[10px] px-1.5 py-0 h-4.5"
                          >
                            {score}점
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right p-1 pr-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-indigo-600 hover:bg-indigo-50 btn-ai-scouting"
                            onClick={() => handleGetScoutingReport(c.student)}
                            title="AI 스카우팅 리포트"
                          >
                            <Search className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* 학생 팀 이동 다이얼로그 (모바일 원터치) */}
      <Dialog open={!!studentToMove} onOpenChange={(open) => !open && setStudentToMove(null)}>
        <DialogContent className="max-w-xs p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-sm font-black flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
              팀 변경: {studentToMove?.student.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              이동할 팀을 선택하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-1.5 py-2">
            {teams.map((t) => {
              const isCurrent = studentToMove?.sourceTeamId === t.id;
              return (
                <Button
                  key={t.id}
                  variant={isCurrent ? "secondary" : "outline"}
                  disabled={isCurrent}
                  onClick={() => {
                    if (studentToMove) {
                      handleMoveStudentToTeam(studentToMove.student.id, studentToMove.sourceTeamId, t.id);
                    }
                  }}
                  className={cn(
                    "w-full h-9 justify-between font-bold text-xs",
                    !isCurrent && "hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300"
                  )}
                >
                  <span>{t.name}</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {isCurrent ? "현재 팀" : `${t.members?.length || 0}명`}
                  </span>
                </Button>
              );
            })}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" size="sm" onClick={() => setStudentToMove(null)} className="w-full text-xs">
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 스카우팅 리포트 다이얼로그 */}
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
    </div>
  );
}
