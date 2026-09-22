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
import { v4 as uuidv4 } from 'uuid';
import { TeamsTabContent } from './team-balancer/TeamsTabContent';
import { SetupTabContent, type ClassSelection } from './team-balancer/SetupTabContent';
import { StudentsTabContent } from './team-balancer/StudentsTabContent';
import { StudentMoveDialog } from './team-balancer/StudentMoveDialog';
import { ScoutingReportDialog } from './team-balancer/ScoutingReportDialog';

interface TeamBalancerProps {
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
  teamGroups: TeamGroup[];
  onTeamGroupUpdate: (newGroup: TeamGroup) => void;
  onTeamGroupDelete: (groupId: string) => void;
  sportsClubs: SportsClub[];
}

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
          <TeamsTabContent
            teams={teams}
            selectedClassSummary={selectedClassSummary}
            targetStudents={targetStudents}
            selectedItemNames={selectedItemNames}
            setActiveTab={setActiveTab}
            handleBalanceTeams={handleBalanceTeams}
            scoreDeviation={scoreDeviation}
            teamOverallAverages={teamOverallAverages}
            showRadar={showRadar}
            setShowRadar={setShowRadar}
            selectedTeamTab={selectedTeamTab}
            setSelectedTeamTab={setSelectedTeamTab}
            teamAverages={teamAverages}
            studentScores={studentScores}
            setStudentToMove={setStudentToMove}
            handleRenameTeam={handleRenameTeam}
            leftoverStudents={leftoverStudents}
          />
        )}

        {/* ======================= TAB 2: 조건 및 대상 설정 뷰 ======================= */}
        {activeTab === 'setup' && (
          <SetupTabContent
            targetStudents={targetStudents}
            grades={grades}
            classSelection={classSelection}
            setClassSelection={setClassSelection}
            classNumsByGrade={classNumsByGrade}
            sportsClubs={sportsClubs}
            clubSelection={clubSelection}
            setClubSelection={setClubSelection}
            groupedItems={groupedItems}
            setSelectedItemNames={setSelectedItemNames}
            uniqueItems={uniqueItems}
            selectedItemNames={selectedItemNames}
            selectedGender={selectedGender}
            setSelectedGender={setSelectedGender}
            balancingStrategy={balancingStrategy}
            setBalancingStrategy={setBalancingStrategy}
            divideBy={divideBy}
            setDivideBy={setDivideBy}
            numTeams={numTeams}
            setNumTeams={setNumTeams}
            membersPerTeam={membersPerTeam}
            setMembersPerTeam={setMembersPerTeam}
            excludeNonParticipants={excludeNonParticipants}
            setExcludeNonParticipants={setExcludeNonParticipants}
            handleBalanceTeams={handleBalanceTeams}
          />
        )}

        {/* ======================= TAB 3: 대상 학생 명단 및 AI 분석 뷰 ======================= */}
        {activeTab === 'students' && (
          <StudentsTabContent
            studentSearchTerm={studentSearchTerm}
            setStudentSearchTerm={setStudentSearchTerm}
            candidateList={candidateList}
            filteredCandidates={filteredCandidates}
            handleGetScoutingReport={handleGetScoutingReport}
          />
        )}
      </div>

      {/* 학생 팀 이동 다이얼로그 (모바일 원터치) */}
      <StudentMoveDialog
        studentToMove={studentToMove}
        setStudentToMove={setStudentToMove}
        teams={teams}
        handleMoveStudentToTeam={handleMoveStudentToTeam}
      />

      {/* AI 스카우팅 리포트 다이얼로그 */}
      <ScoutingReportDialog
        analyzingStudent={analyzingStudent}
        setAnalyzingStudent={setAnalyzingStudent}
        isReportLoading={isReportLoading}
        studentScores={studentScores}
        scoutingReport={scoutingReport}
      />
    </div>
  );
}
