'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  Settings,
  Plus,
  Save,
  Trash2,
  Printer,
  Copy,
  FolderOpen,
  Eye,
  CheckCircle2,
  Heart,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { MasterStudent } from '@/lib/types/masterStudent';
import type {
  SeatingPlan,
  SeatingConfig,
  DeskSlot,
  SeatingViewOptions,
} from '@/lib/types/seating';
import { DEFAULT_SEATING_CONFIG, DEFAULT_VIEW_OPTIONS } from '@/lib/types/seating';
import {
  getSeatingPlans,
  saveSeatingPlan,
  deleteSeatingPlan,
  buildInitialSlots,
  generateRandomSeating,
  extractPartnersFromSlots,
} from '@/lib/services/seatingService';
import { usePraisePoints, changePraisePoints, resetPraisePoints } from '@/lib/services/classPraiseStore';
import { SeatingBoardView } from './SeatingBoardView';
import { SeatingConfigModal } from './SeatingConfigModal';
import { StudentAssignModal } from './StudentAssignModal';
import { PraiseModal } from './PraiseModal';
import { PraisePromotionModal } from './promotion/PraisePromotionModal';
import { PraiseGaugeBar } from './PraiseGaugeBar';
import { SeatingPraiseWidget } from './SeatingPraiseWidget';
import { SeatingHomeworkWidget, type SeatingHomeworkOverlay } from './SeatingHomeworkWidget';
import { useSeatingDisplayPrefs } from './SeatingDisplayToggles';
import { SeatingPickerBar, type PickerOptions } from './SeatingPickerBar';
import { PickerResultModal } from './PickerResultModal';
import { SeatingTeamBar, type TeamSplitOptions } from './SeatingTeamBar';
import { TeamResultModal, type DisplayTeam } from './TeamResultModal';
import { TeamListModal } from './TeamListModal';
import { TEAM_COLOR_PALETTES, saveClassTeams } from '@/lib/types/teams';
import { isMaleStudent, isFemaleStudent } from '@/lib/services/seatingService';
import { ViewOptionsPopover } from './ViewOptionsPopover';
import { CountdownOverlay } from './CountdownOverlay';
import { getSavedClassTeams, type ClassTeamData } from '@/lib/types/teams';

interface SeatingTabContentProps {
  classKey: string;
  classLabel: string;
  students: MasterStudent[];
  userEmail?: string;
  isFullscreen?: boolean;
  isPickerBarOpen?: boolean;
  onClosePickerBar?: () => void;
  isTeamBarOpen?: boolean;
  onCloseTeamBar?: () => void;
  /** 숙제 [배치도에서 확인]을 켰을 때만 */
  homeworkOverlay?: SeatingHomeworkOverlay;
}

export const SeatingTabContent: React.FC<SeatingTabContentProps> = ({
  classKey,
  classLabel,
  students,
  userEmail,
  isFullscreen = false,
  isPickerBarOpen,
  onClosePickerBar,
  isTeamBarOpen,
  onCloseTeamBar,
  homeworkOverlay,
}) => {
  const { toast } = useToast();

  // ─── 칭찬·숙제 탭의 [배치도에서 확인] 설정 (현황 바 / 책상 표시)
  const [displayPrefs] = useSeatingDisplayPrefs(classKey);
  const showPraiseBar = displayPrefs.praiseBar;
  const showHwBar = displayPrefs.hwBar;

  // ─── 발표자 뽑기 탭 바 및 팝업 상태 ───
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isPickingAnimation, setIsPickingAnimation] = useState(false);
  const [pickerWinners, setPickerWinners] = useState<DeskSlot[]>([]);
  const [isPickerResultModalOpen, setIsPickerResultModalOpen] = useState(false);
  const [pickedHistorySlotIds, setPickedHistorySlotIds] = useState<string[]>([]);
  const [highlightedSlotIds, setHighlightedSlotIds] = useState<Set<string>>(new Set());

  // ─── 팀 나누기 탭 바 및 팝업 상태 ───
  const [isTeamBarOpenLocal, setIsTeamBarOpenLocal] = useState(false);
  const [isTeamingAnimation, setIsTeamingAnimation] = useState(false);
  const [generatedDisplayTeams, setGeneratedDisplayTeams] = useState<DisplayTeam[]>([]);
  const [isTeamResultModalOpen, setIsTeamResultModalOpen] = useState(false);
  const [isTeamListModalOpen, setIsTeamListModalOpen] = useState(false);

  useEffect(() => {
    if (isPickerBarOpen !== undefined) setIsPickerOpen(isPickerBarOpen);
  }, [isPickerBarOpen]);

  useEffect(() => {
    if (isTeamBarOpen !== undefined) setIsTeamBarOpenLocal(isTeamBarOpen);
  }, [isTeamBarOpen]);

  useEffect(() => {
    const handleOpenPicker = () => {
      setIsPickerOpen(true);
      setIsTeamBarOpenLocal(false);
    };
    const handleOpenTeams = () => {
      setIsTeamBarOpenLocal(true);
      setIsPickerOpen(false);
    };
    window.addEventListener('open-seating-picker', handleOpenPicker);
    window.addEventListener('open-seating-teams', handleOpenTeams);
    return () => {
      window.removeEventListener('open-seating-picker', handleOpenPicker);
      window.removeEventListener('open-seating-teams', handleOpenTeams);
    };
  }, []);

  const handleClosePickerBar = () => {
    setIsPickerOpen(false);
    setHighlightedSlotIds(new Set());
    if (onClosePickerBar) onClosePickerBar();
  };

  const handleCloseTeamBar = () => {
    setIsTeamBarOpenLocal(false);
    setHighlightedSlotIds(new Set());
    if (onCloseTeamBar) onCloseTeamBar();
  };

  // ─── 발표자 뽑기 실행 (자리배치도 룰렛 애니메이션 후 팝업 표출) ───
  const handleStartPick = (options: PickerOptions) => {
    const activeStudentSlots = currentSlots.filter((s) => s.isActive && s.studentId);
    if (activeStudentSlots.length === 0) {
      toast({
        title: '뽑을 학생이 없습니다',
        description: '자리배치도에 배치된 학생이 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    let candidateSlots = activeStudentSlots.filter((s) => {
      if (options.avoidPrevious && pickedHistorySlotIds.includes(s.id)) return false;
      if (options.genderFilter === 'male') {
        const student = studentsMap.get(s.studentId!);
        return student ? isMaleStudent(student) : (s.studentGender !== '여' && s.studentGender !== 'Female');
      }
      if (options.genderFilter === 'female') {
        const student = studentsMap.get(s.studentId!);
        return student ? isFemaleStudent(student) : (s.studentGender === '여' || s.studentGender === 'Female');
      }
      return true;
    });

    if (candidateSlots.length === 0) {
      toast({
        title: '선택 조건에 맞는 학생이 없습니다',
        description: '모든 학생이 이미 뽑혔거나 성별 조건에 맞는 학생이 없습니다. 이력을 초기화해주세요.',
        variant: 'destructive',
      });
      return;
    }

    const targetCount = Math.min(options.count, candidateSlots.length);
    setIsPickingAnimation(true);

    // 룰렛 애니메이션: 2.2초 동안 75ms 주기로 무작위 N개 슬롯 번갈아 하이라이트!
    let ticks = 0;
    const maxTicks = 24;
    const interval = setInterval(() => {
      ticks++;
      const randSlots = [...candidateSlots].sort(() => Math.random() - 0.5).slice(0, targetCount);
      setHighlightedSlotIds(new Set(randSlots.map((s) => s.id)));

      if (ticks >= maxTicks) {
        clearInterval(interval);
        // 최종 당첨자 확정
        const finalWinners = [...candidateSlots].sort(() => Math.random() - 0.5).slice(0, targetCount);
        setPickerWinners(finalWinners);
        setHighlightedSlotIds(new Set(finalWinners.map((s) => s.id)));
        setPickedHistorySlotIds((prev) => [...prev, ...finalWinners.map((s) => s.id)]);
        setIsPickingAnimation(false);
        setIsPickerResultModalOpen(true);
      }
    }, 85);
  };

  // ─── 팀 나누기 실행 (자리배치도 파도타기 애니메이션 후 팝업 표출 & 자리배치도 색상 실시간 반영) ───
  const handleStartTeamSplit = (options: TeamSplitOptions) => {
    const activeStudentSlots = currentSlots.filter((s) => s.isActive && s.studentId);
    if (activeStudentSlots.length === 0) {
      toast({
        title: '팀을 나눌 학생이 없습니다',
        description: '자리배치도에 배치된 학생이 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    setIsTeamingAnimation(true);
    const teamCount = options.teamCount;

    // 팀 컨테이너 초기화
    const newDisplayTeams: DisplayTeam[] = Array.from({ length: teamCount }, (_, idx) => {
      const theme = TEAM_COLOR_PALETTES[idx % TEAM_COLOR_PALETTES.length];
      return {
        id: idx + 1,
        name: `${idx + 1}모둠 (${theme.name.split(' ')[0]})`,
        themeId: theme.id,
        theme,
        members: [],
      };
    });

    const activeStudents: MasterStudent[] = activeStudentSlots
      .map((s) => studentsMap.get(s.studentId!) || {
        id: s.studentId!,
        studentId: s.studentId!,
        name: s.studentName || '',
        studentNum: s.studentNum || '',
        gender: s.studentGender || '',
        photoUrl: s.studentPhotoUrl || '',
      })
      .filter(Boolean) as MasterStudent[];

    if (options.method === 'GENDER_BALANCE') {
      const boys = activeStudents.filter(isMaleStudent).sort(() => Math.random() - 0.5);
      const girls = activeStudents.filter(isFemaleStudent).sort(() => Math.random() - 0.5);

      let tIdx = 0;
      boys.forEach((b) => {
        newDisplayTeams[tIdx % teamCount].members.push(b);
        tIdx++;
      });
      tIdx = teamCount - 1;
      girls.forEach((g) => {
        newDisplayTeams[((tIdx % teamCount) + teamCount) % teamCount].members.push(g);
        tIdx--;
      });
    } else if (options.method === 'NUMBER_ORDER') {
      const sorted = [...activeStudents].sort((a, b) => (Number(a.studentNum) || 0) - (Number(b.studentNum) || 0));
      sorted.forEach((s, idx) => {
        newDisplayTeams[idx % teamCount].members.push(s);
      });
    } else {
      const shuffled = [...activeStudents].sort(() => Math.random() - 0.5);
      shuffled.forEach((s, idx) => {
        newDisplayTeams[idx % teamCount].members.push(s);
      });
    }

    // 각 팀 내부 번호순 정렬
    newDisplayTeams.forEach((t) => {
      t.members.sort((a, b) => (Number(a.studentNum) || 0) - (Number(b.studentNum) || 0));
    });

    // 1.8초 동안 자리배치도에 파도타기 애니메이션
    let waveTicks = 0;
    const interval = setInterval(() => {
      waveTicks++;
      const randSub = [...activeStudentSlots].sort(() => Math.random() - 0.5).slice(0, Math.ceil(activeStudentSlots.length / 2));
      setHighlightedSlotIds(new Set(randSub.map((s) => s.id)));

      if (waveTicks >= 14) {
        clearInterval(interval);
        setHighlightedSlotIds(new Set());
        setIsTeamingAnimation(false);

        // 저장 및 자리배치도 즉시 동기화!
        const exportData: ClassTeamData[] = newDisplayTeams.map((t) => ({
          id: t.id,
          name: t.name,
          themeId: t.themeId,
          leaderStudentId: null,
          memberStudentIds: t.members.map((m) => m.studentId || m.id || m.studentNum || ''),
        }));

        saveClassTeams(classKey, exportData);
        setClassTeams(exportData);
        setGeneratedDisplayTeams(newDisplayTeams);
        setIsTeamResultModalOpen(true);

        toast({
          title: '🎨 팀 나누기 완료 & 색상 반영!',
          description: `총 ${activeStudents.length}명의 학생이 ${teamCount}개 팀으로 편성되었으며, 자리배치도 책상에 팀 색상이 실시간 반영되었습니다.`,
        });
      }
    }, 110);
  };

  // 저장된 배치도 목록
  const [plans, setPlans] = useState<SeatingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 현재 작업 중인 배치도 상태
  const [currentTitle, setCurrentTitle] = useState(`${new Date().getMonth() + 1}월 자리배치도`);
  const [currentConfig, setCurrentConfig] = useState<SeatingConfig>(DEFAULT_SEATING_CONFIG);
  const [currentSlots, setCurrentSlots] = useState<DeskSlot[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // 칭찬 점수: 학생별 단일 저장소의 값을 배치도 슬롯에 덮어씀 (배치도마다 따로 저장하지 않음)
  const praiseMap = usePraisePoints(classKey);
  useEffect(() => {
    setCurrentSlots((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        if (!s.studentId) return s;
        const p = praiseMap[s.studentId] ?? 0;
        if ((s.praisePoints ?? 0) === p) return s;
        changed = true;
        return { ...s, praisePoints: p };
      });
      return changed ? next : prev;
    });
  }, [praiseMap, currentSlots]);

  // 보기 옵션 (사진, 칭찬, 게이지, 성별)
  const [viewOptions, setViewOptions] = useState<SeatingViewOptions>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('kis_seating_view_options');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_VIEW_OPTIONS;
  });
  // 책상 카드 칭찬 등급 배지: 칭찬 탭의 [배치도에서 확인 › 책상 등급]을 끄면 숨김
  const boardViewOptions = React.useMemo(
    () => ({ ...viewOptions, showPraise: viewOptions.showPraise && displayPrefs.praiseCards }),
    [viewOptions, displayPrefs.praiseCards]
  );

  // 칭찬 온도계 목표 점수 상태 (기본 50점)
  const [praiseTargetGoal, setPraiseTargetGoal] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`kis_praise_target_goal_${classKey}`);
        if (saved) return Number(saved) || 50;
      } catch (e) {}
    }
    return 50;
  });

  const handleChangeTargetGoal = (newGoal: number) => {
    setPraiseTargetGoal(newGoal);
    try {
      localStorage.setItem(`kis_praise_target_goal_${classKey}`, String(newGoal));
    } catch (e) {}
    setIsDirty(true);
    toast({
      title: '칭찬 목표 점수 설정',
      description: `오늘의 칭찬 목표 점수가 ${newGoal}점으로 설정되었습니다.`,
    });
  };

  // 팀 나누기 연동: 학급 팀 편성 데이터 로드 및 실시간 동기화
  const [classTeams, setClassTeams] = useState<ClassTeamData[]>(() => getSavedClassTeams(classKey));
  useEffect(() => {
    setClassTeams(getSavedClassTeams(classKey));
    const handleTeamsUpdate = (e: any) => {
      if (e?.detail?.classKey === classKey && e?.detail?.teams) {
        setClassTeams(e.detail.teams);
      } else {
        setClassTeams(getSavedClassTeams(classKey));
      }
    };
    window.addEventListener('class-teams-updated', handleTeamsUpdate);
    return () => window.removeEventListener('class-teams-updated', handleTeamsUpdate);
  }, [classKey]);

  const handleViewOptionsChange = (newOpts: SeatingViewOptions) => {
    setViewOptions(newOpts);
    try {
      localStorage.setItem('kis_seating_view_options', JSON.stringify(newOpts));
    } catch (e) {}
  };

  // 학생 빠른 조회를 위한 Map (ID 매핑 및 성명 fallback 매핑)
  const studentsMap = useMemo(() => {
    const map = new Map<string, MasterStudent>();
    students.forEach((s) => {
      const sid = s.studentId || s.id;
      if (sid) map.set(sid, s);
    });
    return map;
  }, [students]);

  const studentsByNameMap = useMemo(() => {
    const map = new Map<string, MasterStudent>();
    students.forEach((s) => {
      if (s.name) map.set(s.name, s);
    });
    return map;
  }, [students]);

  // 슬롯 데이터를 최신 통합학생정보(MasterStudent SSOT)와 100% 동기화하는 헬퍼
  const syncSlotWithLatestStudent = (s: DeskSlot): DeskSlot => {
    const st =
      (s.studentId ? studentsMap.get(s.studentId) : null) ||
      (s.studentName ? studentsByNameMap.get(s.studentName) : null);
    if (!st) return s;
    return {
      ...s,
      studentId: st.studentId || st.id || s.studentId,
      studentName: st.name || s.studentName,
      studentNum: st.studentNum ? String(st.studentNum) : (s.studentNum ? String(s.studentNum) : null),
      studentGender: st.gender || s.studentGender,
      studentPhotoUrl: st.photoUrl || s.studentPhotoUrl || null,
      praisePoints: s.praisePoints ?? 0,
    };
  };

  // 모달 상태
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedSlotForAssign, setSelectedSlotForAssign] = useState<DeskSlot | null>(null);

  const [isPraiseModalOpen, setIsPraiseModalOpen] = useState(false);
  const [selectedSlotForPraise, setSelectedSlotForPraise] = useState<DeskSlot | null>(null);

  const [isCountdownOpen, setIsCountdownOpen] = useState(false);
  const [movingSourceSlot, setMovingSourceSlot] = useState<DeskSlot | null>(null);

  // 상단 자리배치도 설정 바 접기/펼치기 상태 (평소에는 화면 공간 확보를 위해 접힌 상태)
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);

  // '한 명씩 보기' 효과 상태
  const [revealedCount, setRevealedCount] = useState<number | undefined>(undefined);
  const revealTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 데이터 로드
  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const list = await getSeatingPlans(classKey);
      setPlans(list);
      if (list.length > 0) {
        if (!selectedPlanId || !list.some((p) => p.id === selectedPlanId)) {
          applyPlan(list[0]);
        }
      } else {
        // 저장된 배치도가 없으면 기본 분단형으로 초기화
        initDefaultPlan();
      }
    } catch (err) {
      console.error('[SeatingTab] load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [classKey]);

  // 기본 배치도 초기화
  const initDefaultPlan = () => {
    const title = `${new Date().getMonth() + 1}월 자리배치도`;
    const cfg = { ...DEFAULT_SEATING_CONFIG, title };
    const slots = buildInitialSlots(cfg, students.length);
    setCurrentTitle(title);
    setCurrentConfig(cfg);
    setCurrentSlots(slots);
    setSelectedPlanId(null);
    setIsDirty(true);
    setRevealedCount(undefined);
  };

  // 기존 저장된 배치도 적용
  const applyPlan = (plan: SeatingPlan) => {
    setSelectedPlanId(plan.id);
    setCurrentTitle(plan.title);
    setCurrentConfig(plan.config);
    // 통합학생정보(MasterStudent) 최신 성별/사진/번호/이름 실시간 동기화
    const syncedSlots = plan.slots.map(syncSlotWithLatestStudent);
    setCurrentSlots(syncedSlots);
    if (plan.praiseTargetGoal) {
      setPraiseTargetGoal(plan.praiseTargetGoal);
    }
    setIsDirty(false);
    setRevealedCount(undefined);
    setMovingSourceSlot(null);
  };

  // 학생 목록(students)이 비동기로 로드되거나 최신화될 때 현재 슬롯들의 성별/사진/정보를 실시간 자동 동기화
  useEffect(() => {
    if (students.length > 0 && currentSlots.length > 0) {
      setCurrentSlots((prevSlots) =>
        prevSlots.map((s) => {
          if (!s.studentId && !s.studentName) return s;
          const st =
            (s.studentId ? studentsMap.get(s.studentId) : null) ||
            (s.studentName ? studentsByNameMap.get(s.studentName) : null);
          if (!st) return s;
          if (
            s.studentGender !== st.gender ||
            s.studentPhotoUrl !== (st.photoUrl || null) ||
            s.studentName !== st.name
          ) {
            return {
              ...s,
              studentId: st.studentId || st.id || s.studentId,
              studentName: st.name || s.studentName,
              studentNum: st.studentNum ? String(st.studentNum) : (s.studentNum ? String(s.studentNum) : null),
              studentGender: st.gender || s.studentGender,
              studentPhotoUrl: st.photoUrl || s.studentPhotoUrl || null,
            };
          }
          return s;
        })
      );
    }
  }, [students, studentsMap, studentsByNameMap]);

  // 배치도 선택 핸들러
  const handleSelectPlan = (planId: string) => {
    if (planId === '__new__') {
      initDefaultPlan();
      return;
    }
    const found = plans.find((p) => p.id === planId);
    if (found) {
      applyPlan(found);
    }
  };

  // 대형 설정 변경 반영
  const handleApplyConfig = (newConfig: SeatingConfig) => {
    setCurrentConfig(newConfig);
    setCurrentTitle(newConfig.title);

    // 새 대형에 맞추어 슬롯 재생성
    const newSlots = buildInitialSlots(newConfig, students.length);

    // 기존 고정 학생 좌석은 가능한 한 인덱스 일치 슬롯에 보존
    const oldFixedSlots = currentSlots.filter((s) => s.isFixed && s.studentId);
    if (oldFixedSlots.length > 0) {
      oldFixedSlots.forEach((oldS, idx) => {
        if (newSlots[idx]) {
          newSlots[idx].studentId = oldS.studentId;
          newSlots[idx].studentName = oldS.studentName;
          newSlots[idx].studentNum = oldS.studentNum;
          newSlots[idx].studentGender = oldS.studentGender;
          newSlots[idx].studentPhotoUrl = oldS.studentPhotoUrl;
          newSlots[idx].praisePoints = oldS.praisePoints;
          newSlots[idx].isFixed = true;
        }
      });
    }

    setCurrentSlots(newSlots);
    setIsDirty(true);
    setRevealedCount(undefined);
  };

  // 특정 좌석 학생 배정 / 고정 / 비우기 처리
  const handleAssignStudent = (slotId: string, student: MasterStudent | null, isFixed: boolean) => {
    setCurrentSlots((prev) => {
      // 1. 해당 학생이 다른 좌석에 이미 지정되어 있었다면 그 좌석 비우기
      const next = prev.map((s) => {
        if (student && s.studentId === (student.studentId || student.id) && s.id !== slotId) {
          return {
            ...s,
            studentId: null,
            studentName: null,
            studentNum: null,
            studentGender: null,
            studentPhotoUrl: null,
            isFixed: false,
          };
        }
        return s;
      });

      // 2. 타겟 슬롯 업데이트
      return next.map((s) => {
        if (s.id === slotId) {
          if (!student) {
            return {
              ...s,
              studentId: null,
              studentName: null,
              studentNum: null,
              studentGender: null,
              studentPhotoUrl: null,
              isFixed: false,
            };
          }
          return {
            ...s,
            studentId: student.studentId || student.id,
            studentName: student.name,
            studentNum: student.studentNum || null,
            studentGender: student.gender,
            studentPhotoUrl: student.photoUrl || null,
            praisePoints: s.praisePoints ?? 0,
            isFixed,
          };
        }
        return s;
      });
    });

    setIsDirty(true);
  };

  // 칭찬 포인트 증감 핸들러
  //  칭찬 점수는 학생별 단일 저장소(칭찬 탭과 공유, 서버 즉시 저장)에 기록 — 배치도 [저장] 불필요
  const handlePraiseChange = (slotId: string, delta: number) => {
    const target = currentSlots.find((s) => s.id === slotId);
    if (!target || !target.studentId) return;

    // 학생 마스터 메타 정보 조회 (사진, 번호, 성별)
    const stMaster = studentsMap.get(target.studentId);
    const photoUrl = stMaster?.photoUrl || target.studentPhotoUrl || null;
    const studentNum = stMaster?.studentNum || target.studentNum || null;
    const gender = stMaster?.gender || target.studentGender || null;

    // 늘어난 점수는 포인트 통장에도 함께 적립되며, 등급 승급 시 축하 팝업이 순차 표출됨
    changePraisePoints(classKey, target.studentId, target.studentName || '학생', delta, {
      studentNum,
      gender,
      photoUrl,
    });
  };

  // 칭찬 포인트 0점 초기화
  const handlePraiseReset = (slotId: string) => {
    const target = currentSlots.find((s) => s.id === slotId);
    if (target?.studentId) resetPraisePoints(classKey, [target.studentId]);
  };

  // 학급 전체 칭찬 포인트 초기화
  const handleResetAllPraise = () => {
    if (confirm('학급 전체 학생의 칭찬 점수를 0점으로 초기화하시겠습니까?')) {
      resetPraisePoints(
        classKey,
        Array.from(
          new Set([
            ...currentSlots.map((s) => s.studentId || ''),
            ...students.map((s) => s.studentId || s.id || ''),
            ...Object.keys(praiseMap),
          ])
        ).filter(Boolean)
      );
      toast({
        title: '칭찬 초기화 완료',
        description: '모든 학생의 칭찬 점수가 0점으로 초기화되었습니다.',
      });
    }
  };

  // 좌석 고정 토글
  const handleToggleFixed = (slotId: string) => {
    setCurrentSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, isFixed: !s.isFixed } : s))
    );
    setIsDirty(true);
  };

  // 좌석 비우기
  const handleClearSeat = (slotId: string) => {
    setCurrentSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              studentId: null,
              studentName: null,
              studentNum: null,
              studentGender: null,
              studentPhotoUrl: null,
              isFixed: false,
              praisePoints: 0,
            }
          : s
      )
    );
    setIsDirty(true);
  };

  // 자리 클릭 핸들러: 학생이 있으면 칭찬&관리 모달, 없으면 지정 모달
  const handleSlotClick = (slot: DeskSlot) => {
    if (slot.studentId) {
      setSelectedSlotForPraise(slot);
      setIsPraiseModalOpen(true);
    } else {
      setSelectedSlotForAssign(slot);
      setIsAssignModalOpen(true);
    }
  };

  // 자리 이동 모드 시작
  const handleStartMove = (slot: DeskSlot) => {
    setMovingSourceSlot(slot);
    toast({
      title: '자리 이동 모드',
      description: `[${slot.studentNum ? `${slot.studentNum}번 ` : ''}${slot.studentName}] 학생을 옮길 위치(빈 자리 또는 다른 학생 자리)를 클릭하세요.`,
    });
  };

  const handleCancelMove = () => {
    setMovingSourceSlot(null);
  };

  // 두 좌석 간 학생 이동 또는 맞교환(Swap)
  const handleMoveOrSwap = (sourceSlotId: string, targetSlotId: string) => {
    if (sourceSlotId === targetSlotId) {
      setMovingSourceSlot(null);
      return;
    }

    setCurrentSlots((prev) => {
      const sourceSlot = prev.find((s) => s.id === sourceSlotId);
      const targetSlot = prev.find((s) => s.id === targetSlotId);

      if (!sourceSlot || !targetSlot) return prev;

      const sourceData = {
        studentId: sourceSlot.studentId,
        studentName: sourceSlot.studentName,
        studentNum: sourceSlot.studentNum,
        studentGender: sourceSlot.studentGender,
        studentPhotoUrl: sourceSlot.studentPhotoUrl,
        praisePoints: sourceSlot.praisePoints,
        isFixed: sourceSlot.isFixed,
      };

      const targetData = {
        studentId: targetSlot.studentId,
        studentName: targetSlot.studentName,
        studentNum: targetSlot.studentNum,
        studentGender: targetSlot.studentGender,
        studentPhotoUrl: targetSlot.studentPhotoUrl,
        praisePoints: targetSlot.praisePoints,
        isFixed: targetSlot.isFixed,
      };

      return prev.map((s) => {
        if (s.id === targetSlotId) {
          return {
            ...s,
            studentId: sourceData.studentId || null,
            studentName: sourceData.studentName || null,
            studentNum: sourceData.studentNum || null,
            studentGender: sourceData.studentGender || null,
            studentPhotoUrl: sourceData.studentPhotoUrl || null,
            praisePoints: sourceData.praisePoints ?? 0,
            isFixed: sourceData.isFixed || false,
          };
        }
        if (s.id === sourceSlotId) {
          return {
            ...s,
            studentId: targetData.studentId || null,
            studentName: targetData.studentName || null,
            studentNum: targetData.studentNum || null,
            studentGender: targetData.studentGender || null,
            studentPhotoUrl: targetData.studentPhotoUrl || null,
            praisePoints: targetData.praisePoints ?? 0,
            isFixed: targetData.isFixed || false,
          };
        }
        return s;
      });
    });

    const srcName = movingSourceSlot?.studentName || '학생';
    const targetSlot = currentSlots.find((s) => s.id === targetSlotId);
    const tgtName = targetSlot?.studentName;

    setMovingSourceSlot(null);
    setIsDirty(true);

    toast({
      title: '자리 이동 완료',
      description: tgtName
        ? `[${srcName}] ↔ [${tgtName}] 자리가 맞교환되었습니다.`
        : `[${srcName}] 학생이 선택한 자리로 이동했습니다.`,
    });
  };

  // 랜덤 자리 배정 트리거 (카운트다운 시작)
  const handleStartRandomSeating = () => {
    if (students.length === 0) {
      toast({
        title: '배정할 학생 없음',
        description: '학급에 등록된 학생이 없습니다.',
        variant: 'destructive',
      });
      return;
    }
    setIsCountdownOpen(true);
  };

  // 학생 목록이 비동기로 로드되었을 때 기본 슬롯 자동 보강
  useEffect(() => {
    if (students.length > 0 && currentSlots.length <= 1) {
      const slots = buildInitialSlots(currentConfig, students.length);
      setCurrentSlots(slots);
    }
  }, [students.length, currentConfig]);

  // 카운트다운 종료 시 실제 배치 완료 및 효과 연출
  const handleCountdownFinished = () => {
    setIsCountdownOpen(false);

    // 슬롯 수가 학생 수보다 부족하면 학생 수에 맞추어 슬롯 자동 보강
    let baseSlots = currentSlots;
    if (baseSlots.length < students.length || baseSlots.filter((s) => s.isActive).length < students.length) {
      baseSlots = buildInitialSlots(currentConfig, students.length);
      const fixedSlots = currentSlots.filter((s) => s.isFixed && s.studentId);
      fixedSlots.forEach((fs, idx) => {
        if (baseSlots[idx]) {
          baseSlots[idx].studentId = fs.studentId;
          baseSlots[idx].studentName = fs.studentName;
          baseSlots[idx].studentNum = fs.studentNum;
          baseSlots[idx].studentGender = fs.studentGender;
          baseSlots[idx].studentPhotoUrl = fs.studentPhotoUrl;
          baseSlots[idx].isFixed = true;
        }
      });
    }

    // 이전 배치도들의 짝꿍 이력 수집
    const prevPartners = plans.flatMap((p) => p.historyPartners || []);

    // 랜덤 배정 계산
    const updated = generateRandomSeating(baseSlots, students, currentConfig, prevPartners);
    setCurrentSlots(updated);
    setIsDirty(true);

    if (currentConfig.revealEffect === 'ONE_BY_ONE') {
      // 한 명씩 보기 효과: 0번부터 순차 오픈
      setRevealedCount(0);
      const activeTotal = updated.filter((s) => s.isActive).length;
      let cur = 0;

      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      revealTimerRef.current = setInterval(() => {
        cur++;
        setRevealedCount(cur);
        if (cur >= activeTotal) {
          if (revealTimerRef.current) clearInterval(revealTimerRef.current);
        }
      }, 250);
    } else {
      // 한 번에 보기
      setRevealedCount(undefined);
    }

    toast({
      title: '랜덤 자리 배정 완료',
      description: '사전 고정 좌석을 제외한 모든 학생의 자리가 새롭게 배정되었습니다!',
    });
  };

  // 자리배치도 저장
  const handleSavePlan = async () => {
    try {
      const planId = selectedPlanId || `plan_${Date.now()}`;
      const partners = extractPartnersFromSlots(currentSlots);

      const planData: SeatingPlan = {
        id: planId,
        classKey,
        classLabel,
        title: currentTitle,
        config: currentConfig,
        slots: currentSlots.map(syncSlotWithLatestStudent),
        historyPartners: partners,
        praiseTargetGoal,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userEmail,
      };

      await saveSeatingPlan(classKey, planData);
      setSelectedPlanId(planId);
      setIsDirty(false);
      await loadPlans();

      toast({
        title: '자리배치도 저장 완료',
        description: `"${currentTitle}"가 성공적으로 저장되었습니다.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: '저장 실패',
        description: '자리배치도를 저장하는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  // 자리배치도 삭제
  const handleDeletePlan = async () => {
    if (!selectedPlanId) return;
    if (!confirm(`"${currentTitle}" 자리배치도를 정말 삭제하시겠습니까?`)) return;

    try {
      await deleteSeatingPlan(classKey, selectedPlanId);
      toast({
        title: '자리배치도 삭제 완료',
      });
      await loadPlans();
    } catch (err) {
      console.error(err);
      toast({
        title: '삭제 실패',
        variant: 'destructive',
      });
    }
  };

  // 자리배치도 클립보드 텍스트 복사
  const handleCopyClipboard = () => {
    let text = `[${classLabel} ${currentTitle}]\n\n`;

    if (currentConfig.layoutType === 'ROW') {
      const { divisionCount } = currentConfig.rowConfig;
      for (let div = 1; div <= divisionCount; div++) {
        text += `■ ${div}분단:\n`;
        const divSlots = currentSlots.filter((s) => s.groupId === div);
        const rows = Array.from(new Set(divSlots.map((s) => s.row))).sort((a, b) => a - b);
        rows.forEach((r) => {
          const rSlots = divSlots.filter((s) => s.row === r).sort((a, b) => a.col - b.col);
          const line = rSlots
            .map((s) => (s.studentName ? `${s.studentNum ? `${s.studentNum}.` : ''}${s.studentName}` : '(빈자리)'))
            .join(' | ');
          text += `  ${r + 1}줄: ${line}\n`;
        });
        text += '\n';
      }
    } else {
      const groupIds = Array.from(new Set(currentSlots.map((s) => s.groupId).filter(Boolean))) as number[];
      groupIds.sort((a, b) => a - b);
      groupIds.forEach((g) => {
        text += `■ ${g}모둠:\n`;
        const gSlots = currentSlots.filter((s) => s.groupId === g);
        const members = gSlots
          .map((s) => (s.studentName ? `${s.studentNum ? `${s.studentNum}.` : ''}${s.studentName}` : '(빈자리)'))
          .join(', ');
        text += `  ${members}\n\n`;
      });
    }

    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: '명단 복사 완료',
        description: '자리배치 텍스트가 클립보드에 복사되었습니다.',
      });
    });
  };

  // A4 독립 팝업 인쇄
  const handlePrintA4 = () => {
    const popup = window.open('', '_blank', 'width=900,height=750');
    if (!popup) {
      toast({
        title: '팝업 차단됨',
        description: '인쇄 팝업을 허용해주세요.',
        variant: 'destructive',
      });
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${classLabel} 자리배치도 (${currentTitle})</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          body { font-family: 'Pretendard', 'Noto Sans KR', sans-serif; margin: 0; padding: 10px; color: #111; }
          .header { text-align: center; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .subtitle { font-size: 13px; color: #666; }
          .board { background: #064e3b; color: #fff; text-align: center; padding: 8px; font-weight: bold; font-size: 16px; border-radius: 8px; margin: 0 auto 25px auto; width: 60%; letter-spacing: 4px; }
          .grid-container { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
          .division { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc; text-align: center; }
          .div-title { font-size: 12px; font-weight: bold; color: #334155; margin-bottom: 8px; }
          .row { display: flex; gap: 8px; margin-bottom: 8px; justify-content: center; }
          .desk { width: 85px; height: 55px; border: 1.5px solid #d97706; background: #fffbeb; border-radius: 6px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
          .num { font-size: 9px; color: #92400e; }
          .name { font-size: 12px; font-weight: bold; margin-top: 2px; }
          .praise { font-size: 9px; color: #b45309; font-weight: bold; margin-top: 1px; }
          .empty { border: 1px dashed #cbd5e1; background: #fff; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${classLabel} 자리배치도</div>
          <div class="subtitle">${currentTitle} | 출력일: ${new Date().toLocaleDateString()}</div>
        </div>
        <div class="board">칠 판 [앞]</div>
        <div class="grid-container">
          ${renderPrintDivisionsHtml()}
        </div>
      </body>
      </html>
    `;

    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(() => {
      popup.print();
    }, 300);
  };

  function renderPrintDivisionsHtml() {
    const groupIds = Array.from(new Set(currentSlots.map((s) => s.groupId).filter(Boolean))) as number[];
    groupIds.sort((a, b) => a - b);
    const maxRow = Math.max(...currentSlots.map((s) => s.row), 0);

    return groupIds
      .map((gNum) => {
        const gSlots = currentSlots.filter((s) => s.groupId === gNum);
        let rowsHtml = '';
        for (let r = 0; r <= maxRow; r++) {
          const rSlots = gSlots.filter((s) => s.row === r).sort((a, b) => (a.pairIndex || 0) - (b.pairIndex || 0));
          if (rSlots.length === 0) continue;
          const desksHtml = rSlots
            .map((s) => {
              if (!s.isActive) return '<div style="width:85px;height:55px;"></div>';
              if (s.studentName) {
                return `
                  <div class="desk">
                    <div class="num">${s.studentNum ? `${s.studentNum}번` : ''}</div>
                    <div class="name">${s.studentName}</div>
                    ${s.praisePoints ? `<div class="praise">★ ${s.praisePoints}점</div>` : ''}
                  </div>
                `;
              }
              return '<div class="desk empty"></div>';
            })
            .join('');
          rowsHtml += `<div class="row">${desksHtml}</div>`;
        }
        return `
          <div class="division">
            <div class="div-title">${currentConfig.layoutType === 'ROW' ? `${gNum}분단` : `${gNum}모둠`}</div>
            ${rowsHtml}
          </div>
        `;
      })
      .join('');
  }

  // 배정 완료된 학생 수
  const assignedCount = currentSlots.filter((s) => s.studentId).length;
  const fixedCount = currentSlots.filter((s) => s.isFixed && s.studentId).length;

  return (
    <div className={`w-full font-sans ${isFullscreen ? 'h-full flex-1 min-h-0 flex flex-col overflow-hidden select-none gap-1' : 'space-y-2 sm:space-y-3'}`}>
      {/* ─── 상단 툴바: 파워포인트 리본메뉴 스타일 꺽쇠 접기/펼치기 (접었을 때 수직 공간 0px 극대화) ─── */}
      <AnimatePresence>
        {!isToolbarOpen ? (
          /* [접힌 상태 (평소 기본 모드)] - 파워포인트 스타일: 별도 바 없이 얇은 인라인 꺽쇠 버튼만 최소화 노출 */
          <div className="flex items-center justify-between px-1.5 py-0.5 shrink-0 select-none">
            <div className="flex items-center gap-1.5 min-w-0 opacity-80 hover:opacity-100 transition-opacity">
              <FolderOpen className="w-3.5 h-3.5 text-[#2471B2] shrink-0" />
              <span className="text-xs font-black text-slate-700 truncate">
                {currentTitle}
              </span>
              <Badge className="bg-[#2471B2]/90 text-white font-black text-[9px] px-1.5 py-0.2 rounded-full whitespace-nowrap shrink-0">
                {currentConfig.layoutType === 'ROW'
                  ? `분단형 (${currentConfig.rowConfig.rowType}열, ${currentConfig.rowConfig.divisionCount}분단)`
                  : currentConfig.layoutType === 'GROUP'
                  ? `모둠형 (${currentConfig.groupConfig.groupSize}인)`
                  : '자유형'}
              </Badge>
              {isDirty && (
                <Badge variant="outline" className="text-[8px] font-black bg-amber-50 text-amber-700 border border-amber-300 rounded-full px-1 py-0 shrink-0">
                  미저장
                </Badge>
              )}
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setIsToolbarOpen(true)}
              title="자리배치 설정 리본 메뉴 펼치기"
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 border border-slate-300/80 cursor-pointer shadow-2xs transition-colors shrink-0"
            >
              <Settings className="w-3 h-3 text-slate-500" />
              <span className="text-[11px] hidden sm:inline">설정 리본</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
            </motion.button>
          </div>
        ) : (
          /* [펼친 상태] - 상세 설정 풀 툴바 + 맨 우측 파워포인트 스타일 [^ 꺽쇠 리본 접기] 버튼 */
          <motion.div
            key="toolbar-expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden shrink-0"
          >
            <div className="flex items-center justify-between gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-2xl bg-white border-2 border-slate-200/90 shadow-sm flex-nowrap overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0">
                {/* 배치도 선택 드롭다운 */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <FolderOpen className="w-4 h-4 text-[#2471B2] shrink-0" />
                  <Select value={selectedPlanId || '__new__'} onValueChange={handleSelectPlan}>
                    <SelectTrigger className="h-8 sm:h-9 text-xs font-bold border-2 border-slate-200 bg-slate-50/80 rounded-2xl focus:ring-[#2471B2] w-[155px] sm:w-[175px] px-2.5 shrink-0 whitespace-nowrap break-keep [&>span]:truncate">
                      <SelectValue placeholder="배치도 선택..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-2 border-slate-200 shadow-lg z-[100000]">
                      <SelectItem value="__new__" className="text-xs font-black text-[#2471B2]">
                        + 새 배치도 만들기
                      </SelectItem>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs font-medium">
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 자리배치정보 배지 */}
                <Badge className="bg-[#2471B2] text-white font-black text-xs px-2.5 py-1 rounded-2xl shadow-2xs whitespace-nowrap shrink-0 ml-0.5 sm:ml-1">
                  {currentConfig.layoutType === 'ROW'
                    ? `분단형 (${currentConfig.rowConfig.rowType}열, ${currentConfig.rowConfig.divisionCount}분단)`
                    : currentConfig.layoutType === 'GROUP'
                    ? `모둠형 (${currentConfig.groupConfig.groupSize}인 모둠)`
                    : '자유형'}
                </Badge>

                {/* 대형 설정 모달 오픈 */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.95, y: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  onClick={() => setIsConfigModalOpen(true)}
                  className="flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-2xl text-xs font-black bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-b-4 border-slate-300 transition-all select-none whitespace-nowrap break-keep shrink-0 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  <span>대형 설정</span>
                </motion.button>

                {/* 보기 설정 드롭다운 */}
                <ViewOptionsPopover
                  options={viewOptions}
                  onChange={handleViewOptionsChange}
                />

                {/* 랜덤 자리 배정 버튼 */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.95, y: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  onClick={handleStartRandomSeating}
                  className="flex items-center gap-1.5 h-8 sm:h-9 px-3 sm:px-3.5 rounded-2xl text-xs font-black bg-[#C49832] hover:bg-[#B0872A] text-white border-b-4 border-[#8E6D21] shadow-md transition-all select-none whitespace-nowrap break-keep shrink-0 cursor-pointer active:translate-y-0.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-white animate-spin" />
                  <span>랜덤 자리 배정</span>
                </motion.button>

                {isDirty && (
                  <Badge variant="outline" className="text-[10px] font-black bg-amber-50 text-amber-700 border-2 border-amber-300 rounded-full px-2 py-0.5 shrink-0">
                    수정됨 (미저장)
                  </Badge>
                )}
              </div>

              {/* 오른쪽 액션 버튼군: 명단 복사 / A4 인쇄 / 삭제 / 저장하기 / [파워포인트 스타일 ^ 꺽쇠 접기] */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap shrink-0 ml-auto">
                {/* 명단 복사 */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05, y: -1 }}
                  whileTap={{ scale: 0.95, y: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  onClick={handleCopyClipboard}
                  title="학생 명단 복사"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl flex items-center justify-center bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-b-4 border-slate-300 transition-all select-none shrink-0 cursor-pointer shadow-xs"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                </motion.button>

                {/* A4 인쇄 */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05, y: -1 }}
                  whileTap={{ scale: 0.95, y: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  onClick={handlePrintA4}
                  title="A4 규격 인쇄"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl flex items-center justify-center bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-b-4 border-slate-300 transition-all select-none shrink-0 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                </motion.button>

                {/* 삭제 (기존 저장된 배치도일 때만) */}
                {selectedPlanId && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.95, y: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    onClick={handleDeletePlan}
                    title="이 배치도 삭제"
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl flex items-center justify-center bg-rose-50 hover:bg-rose-100/80 text-[#B01E23] border-b-4 border-[#B01E23]/30 transition-all select-none shrink-0 cursor-pointer shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#B01E23]" />
                  </motion.button>
                )}

                {/* 저장하기 (학교 공식 블루 #2471B2) */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95, y: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  onClick={handleSavePlan}
                  title="배치도 저장하기"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl flex items-center justify-center bg-[#2471B2] hover:bg-[#1E629D] text-white border-b-4 border-[#1A5384] shadow-sm transition-all select-none shrink-0 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-white" />
                </motion.button>

                {/* 파워포인트 스타일 리본 메뉴 접기 꺽쇠 (^) */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  onClick={() => setIsToolbarOpen(false)}
                  title="설정 리본 메뉴 접기"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 transition-all select-none shrink-0 cursor-pointer shadow-xs ml-0.5"
                >
                  <ChevronUp className="w-4 h-4 text-slate-700" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* '한 명씩 보기' 진행 중 컨트롤 바 */}
      {revealedCount !== undefined && (
        <div className="p-2 sm:p-2.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 font-bold text-blue-900">
            <Eye className="w-4 h-4 text-blue-600 animate-pulse" />
            <span>
              한 명씩 자리 공개 중... ({revealedCount} / {currentSlots.filter((s) => s.isActive).length}석)
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRevealedCount(undefined)}
            className="h-7 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border-blue-300"
          >
            한 번에 전체 공개
          </Button>
        </div>
      )}

      {/* ─── 발표자 뽑기 탭 바 (상단에서 스르륵 내려오는 슬라이드 다운 탭 바) ─── */}
      <SeatingPickerBar
        isOpen={isPickerOpen}
        onClose={handleClosePickerBar}
        totalStudentsCount={currentSlots.filter((s) => s.isActive && s.studentId).length}
        isPicking={isPickingAnimation}
        onStartPick={handleStartPick}
        pickedHistoryCount={pickedHistorySlotIds.length}
        onResetHistory={() => setPickedHistorySlotIds([])}
      />

      {/* ─── 팀 나누기 탭 바 (상단에서 스르륵 내려오는 슬라이드 다운 탭 바) ─── */}
      <SeatingTeamBar
        isOpen={isTeamBarOpenLocal}
        onClose={handleCloseTeamBar}
        totalStudentsCount={currentSlots.filter((s) => s.isActive && s.studentId).length}
        isTeaming={isTeamingAnimation}
        onStartTeamSplit={handleStartTeamSplit}
        onOpenTeamList={() => setIsTeamListModalOpen(true)}
        hasExistingTeams={classTeams.length > 0}
        existingTeamCount={classTeams.length}
      />

      {/* ─── 칭찬 현황 바 · 과제 현황 바 (칭찬·숙제 탭의 [배치도에서 확인]으로 켜고 끔)
               둘 다 켜면 넓은 화면에서 한 줄에 반씩, 하나만 켜면 한 줄 전체 ─── */}
      {(showPraiseBar || showHwBar) && (
        <div className="w-full flex flex-col lg:flex-row lg:items-start gap-x-2 mb-2">
          {showPraiseBar && (
            <div className="flex-1 min-w-0 [&>div]:!mb-0 mb-2 lg:mb-0">
              <SeatingPraiseWidget
                slots={currentSlots}
                config={currentConfig}
                classKey={classKey}
                targetGoal={praiseTargetGoal}
              />
            </div>
          )}
          {showHwBar && homeworkOverlay && (
            <div className="flex-1 min-w-0 [&>div]:!mb-0">
              <SeatingHomeworkWidget items={homeworkOverlay.items} classKey={classKey} />
            </div>
          )}
        </div>
      )}

      {/* ─── 메인 칠판 및 좌석 배치도 보드 (어떤 디스플레이 크기에서든 100% 꽉 채우고 양 옆 잘림 방지) ─── */}
      <div className={`bg-white border-2 border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-sm w-full overflow-hidden ${
        isFullscreen
          ? 'flex-1 min-h-0 flex flex-col p-1 sm:p-2'
          : 'p-1.5 sm:p-2.5 lg:p-3.5 min-h-[420px]'
      }`}>
        <SeatingBoardView
          slots={currentSlots}
          config={currentConfig}
          revealedCount={revealedCount}
          movingSourceSlot={movingSourceSlot}
          viewOptions={boardViewOptions}
          studentsMap={studentsMap}
          teams={classTeams}
          isFullscreen={isFullscreen}
          classKey={classKey}
          classLabel={classLabel}
          highlightedSlotIds={highlightedSlotIds}
          onSlotClick={handleSlotClick}
          onStartMove={handleStartMove}
          onCancelMove={handleCancelMove}
          onMoveOrSwap={handleMoveOrSwap}
          onQuickPraise={handlePraiseChange}
          onPraiseChange={handlePraiseChange}
          homeworkOverlay={displayPrefs.hwCards ? homeworkOverlay : undefined}
        />
      </div>

      {/* ─── 발표자 뽑기 당첨 결과 팝업 모달 (애니메이션 종료 후 표출) ─── */}
      <PickerResultModal
        isOpen={isPickerResultModalOpen}
        onOpenChange={(open) => {
          setIsPickerResultModalOpen(open);
          if (!open) setHighlightedSlotIds(new Set());
        }}
        winners={pickerWinners}
        studentsMap={studentsMap}
        classKey={classKey}
        onGrantPraise={handlePraiseChange}
        onRePick={() => {
          setIsPickerResultModalOpen(false);
          handleStartPick({
            count: pickerWinners.length || 1,
            genderFilter: 'all',
            avoidPrevious: true,
          });
        }}
      />

      {/* ─── 팀 나누기 결과 팝업 모달 (애니메이션 종료 후 표출 & 색상 즉시 반영) ─── */}
      <TeamResultModal
        isOpen={isTeamResultModalOpen}
        onOpenChange={setIsTeamResultModalOpen}
        teams={generatedDisplayTeams}
      />

      {/* ─── 팀별 명단 및 설정 모달 ─── */}
      <TeamListModal
        isOpen={isTeamListModalOpen}
        onOpenChange={setIsTeamListModalOpen}
        teams={classTeams}
        studentsMap={studentsMap}
        classKey={classKey}
        onTeamsUpdated={() => setClassTeams(getSavedClassTeams(classKey))}
      />

      {/* ─── 카운트다운 오버레이 ─── */}
      <CountdownOverlay
        isOpen={isCountdownOpen}
        onFinished={handleCountdownFinished}
      />

      {/* ─── 자리배치도 설정 모달 ─── */}
      <SeatingConfigModal
        isOpen={isConfigModalOpen}
        onOpenChange={setIsConfigModalOpen}
        initialConfig={currentConfig}
        studentCount={students.length}
        onApplyConfig={handleApplyConfig}
      />

      {/* ─── 특정 좌석 학생 지정(사전 고정) 모달 ─── */}
      <StudentAssignModal
        isOpen={isAssignModalOpen}
        onOpenChange={setIsAssignModalOpen}
        targetSlot={selectedSlotForAssign}
        allSlots={currentSlots}
        students={students}
        onAssignStudent={handleAssignStudent}
        onStartMove={handleStartMove}
      />

      {/* ─── 학생 칭찬 부여/차감 & 좌석 관리 모달 ─── */}
      <PraiseModal
        isOpen={isPraiseModalOpen}
        onOpenChange={setIsPraiseModalOpen}
        classKey={classKey}
        targetSlot={
          selectedSlotForPraise
            ? currentSlots.find((s) => s.id === selectedSlotForPraise.id) || selectedSlotForPraise
            : null
        }
        student={selectedSlotForPraise?.studentId ? studentsMap.get(selectedSlotForPraise.studentId) || null : null}
        onPraiseChange={handlePraiseChange}
        onPraiseReset={handlePraiseReset}
        onToggleFixed={handleToggleFixed}
        onStartMove={handleStartMove}
        onClearSeat={handleClearSeat}
      />
      {/* ─── 칭찬 성장 등급 승급 축하 순차 팝업 모달 ─── */}
      <PraisePromotionModal classKey={classKey} />
    </div>
  );
};
