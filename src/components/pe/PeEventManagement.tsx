'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  PeEvent,
  PeEventType,
  PeEventSchedule,
  PeEventBudget,
  Student,
  PeGradeAssignment,
} from '@/lib/pe/types';
import type { DepartmentTask, OrgStructure, UserProfile } from '@/lib/types';
import {
  getPeEvents,
  savePeEvent,
  deletePeEvent,
  suggestPeEventToDepartment,
} from '@/lib/services/peService';
import {
  createDepartmentTask,
  onDepartmentTasksUpdate,
  deleteDepartmentTaskSubmission
} from '@/lib/services/departmentTaskService';
import { getOrgStructure, getPeriodSchedules } from '@/lib/services/settingsService';
import { getUsersDirectory } from '@/lib/services/userService';
import type { ClassPeriodSchedule } from '@/lib/types';
import { DEFAULT_PERIOD_SCHEDULES } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Edit,
  FileText,
  Send,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  Coins,
  DollarSign,
  Layers,
  ChevronRight,
  Sparkles,
  Search,
  RefreshCw,
  Building2,
  Flame,
  Activity,
  Award,
  CalendarDays,
  FileSpreadsheet,
  Inbox,
  UserPlus,
  Download,
  Presentation,
  Check,
  AlertTriangle,
  Link as LinkIcon,
  ExternalLink,
  RotateCcw,
  X,
  ChevronDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';

interface PeEventManagementProps {
  allStudents?: Student[];
}

export interface TeacherOption {
  email: string;
  name: string; // 실명
  role: string; // [1학년부장], [1-1 담임], [교과] 등
  grade?: string; // 소속 학년 ('1'~'6')
  dept?: string; // 소속 부서
}

// 시간대 프리셋
const TIME_PRESETS = [
  { label: '08:30 ~ 09:00 (개회식/준비)', time: '08:30 ~ 09:00' },
  { label: '09:00 ~ 11:30 (오전 경기)', time: '09:00 ~ 11:30' },
  { label: '09:00 ~ 09:40 (1교시)', time: '09:00 ~ 09:40' },
  { label: '09:50 ~ 10:30 (2교시)', time: '09:50 ~ 10:30' },
  { label: '10:40 ~ 11:20 (3교시)', time: '10:40 ~ 11:20' },
  { label: '11:30 ~ 12:10 (4교시)', time: '11:30 ~ 12:10' },
  { label: '13:00 ~ 15:00 (오후 경기)', time: '13:00 ~ 15:00' },
  { label: '15:00 ~ 15:30 (폐회/시상식)', time: '15:00 ~ 15:30' },
];

// 대상 학년 프리셋
const TARGET_PRESETS = [
  '전교생 (1~6학년)',
  '1, 2, 3학년 (저학년)',
  '4, 5, 6학년 (고학년)',
  '1학년',
  '2학년',
  '3학년',
  '4학년',
  '5학년',
  '6학년',
];

// 주요 장소 프리셋
const LOCATION_PRESETS = [
  '대운동장',
  '메인 체육관',
  '소체육관',
  '강당',
  '풋살장',
  '체력측정실',
  '각 학급 교실',
];

export function PeEventManagement({ allStudents = [] }: PeEventManagementProps) {
  const { user, profile } = useAuth();
  const school = 'KISH';
  const router = useRouter();
  const { toast } = useToast();

  const [events, setEvents] = useState<PeEvent[]>([]);
  const [deptTasks, setDeptTasks] = useState<DepartmentTask[]>([]);
  const [orgStructure, setOrgStructure] = useState<Partial<OrgStructure>>({});
  const [usersDirectory, setUsersDirectory] = useState<UserProfile[]>([]);
  const [periodSchedules, setPeriodSchedules] = useState<ClassPeriodSchedule[]>(DEFAULT_PERIOD_SCHEDULES);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 행사 등록/수정 모달 상태
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PeEvent | null>(null);

  // 폼 입력 상태
  const [formTitle, setFormTitle] = useState('');
  const [formEventType, setFormEventType] = useState<PeEventType>('sports_day');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTargetGrades, setFormTargetGrades] = useState<string[]>(['1', '2', '3', '4', '5', '6']);
  const [formLocation, setFormLocation] = useState('학교 대운동장 및 메인 체육관');
  const [formManager, setFormManager] = useState(user?.displayName || '체육담당 교사');
  const [formDescription, setFormDescription] = useState('');
  const [formSchedules, setFormSchedules] = useState<PeEventSchedule[]>([]);
  const [formBudgets, setFormBudgets] = useState<PeEventBudget[]>([]);

  // 부장 건의 모달 상태
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [suggestTargetEvent, setSuggestTargetEvent] = useState<PeEvent | null>(null);
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestContent, setSuggestContent] = useState('');
  const [isSubmittingSuggest, setIsSubmittingSuggest] = useState(false);

  // 학년별 업무 요청 모달 상태
  const [isTaskRequestOpen, setIsTaskRequestOpen] = useState(false);
  const [targetEventForTask, setTargetEventForTask] = useState<PeEvent | null>(null);
  const [taskDeadline, setTaskDeadline] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [taskNotice, setTaskNotice] = useState(
    '각 학년별 스포츠 데이(체육대회) 세부 운영 계획을 타임테이블(시나리오) 형식으로 작성하여 제출해 주시기 바랍니다.\n진행에 필요한 PPT 자료나 캔바(Canva) 공유 링크가 있는 경우 함께 등록해 주세요.'
  );
  const [selectedGradesForTask, setSelectedGradesForTask] = useState<string[]>(['1', '2', '3', '4', '5', '6']);
  const [gradeAssignees, setGradeAssignees] = useState<{ [grade: string]: { email: string; name: string } }>({});
  const [isRequestingTask, setIsRequestingTask] = useState(false);

  // 학년별 제출 현황 상세 모달 상태
  const [isSubmissionsViewOpen, setIsSubmissionsViewOpen] = useState(false);
  const [targetEventForView, setTargetEventForView] = useState<PeEvent | null>(null);

  // 행사 및 조직도, 교직원 명부, 표준 교시 시간표 로드
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [evList, org, users, periods] = await Promise.all([
        getPeEvents(school),
        getOrgStructure(),
        getUsersDirectory(),
        getPeriodSchedules()
      ]);
      setEvents(evList);
      setOrgStructure(org || {});
      setUsersDirectory(users || []);
      setPeriodSchedules(periods || DEFAULT_PERIOD_SCHEDULES);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: '데이터 불러오기 실패' });
    } finally {
      setIsLoading(false);
    }
  };

  // 학교 표준 수업 시간대 기반 동적 프리셋
  const timePresets = useMemo(() => {
    const list: { label: string; time: string }[] = [];
    
    // 1. 학교 설정 표준 교시 시간표
    periodSchedules.forEach(p => {
      list.push({
        label: `${p.startTime} ~ ${p.endTime} (${p.name})`,
        time: `${p.startTime} ~ ${p.endTime}`
      });
    });

    // 2. 행사 전용 주요 블록 프리셋 (오전/오후/개회/폐회 등)
    list.push(
      { label: '08:30 ~ 09:00 (개회식/준비)', time: '08:30 ~ 09:00' },
      { label: '09:00 ~ 11:30 (오전 집중 경기)', time: '09:00 ~ 11:30' },
      { label: '13:00 ~ 15:00 (오후 집중 경기)', time: '13:00 ~ 15:00' },
      { label: '15:00 ~ 15:30 (폐회식/시상)', time: '15:00 ~ 15:30' }
    );

    const seen = new Set<string>();
    return list.filter(item => {
      if (seen.has(item.time)) return false;
      seen.add(item.time);
      return true;
    });
  }, [periodSchedules]);

  useEffect(() => {
    loadInitialData();

    // 부서/학년 업무 실시간 구독
    const unsub = onDepartmentTasksUpdate((tasks) => {
      setDeptTasks(tasks);
    });
    return () => unsub();
  }, [school]);

  // 사용 가능한 전체 학년 목록 (1~6학년 기본 보장)
  const availableGrades = useMemo(() => {
    const defaultGrades = ['1', '2', '3', '4', '5', '6'];
    const set = new Set<string>(defaultGrades);
    allStudents.forEach(s => {
      if (s.grade) set.add(String(s.grade));
    });
    return Array.from(set).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
  }, [allStudents]);

  // 전체 교직원 실명 및 직책 매핑 목록 (조직도: gradeHeads, homerooms, gradeSubjects, departments 및 usersDirectory 완벽 융합)
  const teacherList = useMemo<TeacherOption[]>(() => {
    const userMap = new Map<string, UserProfile>();
    usersDirectory.forEach(u => {
      if (u.email) userMap.set(u.email.toLowerCase().trim(), u);
    });

    const teacherMap = new Map<string, TeacherOption>();

    const getOrCreateTeacher = (email: string, fallbackName?: string): TeacherOption => {
      const lower = email.toLowerCase().trim();
      if (teacherMap.has(lower)) {
        return teacherMap.get(lower)!;
      }
      const profile = userMap.get(lower);
      const name = profile?.name || fallbackName || lower.split('@')[0];
      const newTeacher: TeacherOption = {
        email: lower,
        name,
        role: profile?.role || '교사',
        grade: profile?.grade ? String(profile.grade) : undefined,
        dept: profile?.dept || '교직원'
      };
      teacherMap.set(lower, newTeacher);
      return newTeacher;
    };

    // 1. usersDirectory 전체 교직원 정보 1차 등록 (프로필에 설정된 grade, classNum 자동 인식)
    usersDirectory.forEach(u => {
      if (!u.email || u.role === 'student' || u.studentName) return;
      const lower = u.email.toLowerCase().trim();
      const teacher = getOrCreateTeacher(lower, u.name);
      
      // 학년 및 학급 정보 정밀 추출
      let userGrade = u.grade ? String(u.grade).replace(/\D/g, '') : undefined;
      const userClass = (u as any).classNum || (u as any).class || (u as any).classNo;
      
      if (!userGrade && u.dept && u.dept.includes('학년')) {
        const match = u.dept.match(/(\d+)\s*학년/);
        if (match) userGrade = match[1];
      }

      if (userGrade) {
        teacher.grade = userGrade;
        teacher.dept = `${userGrade}학년부`;
        if (userClass) {
          teacher.role = `${userGrade}-${userClass} 담임`;
        } else if (!teacher.role || teacher.role === '교사') {
          teacher.role = `${userGrade}학년 교사`;
        }
      }
    });

    // 2. 조직도 학년부장 매핑 (gradeHeads: { '1': 'email', '2': 'email', ... })
    if (orgStructure.gradeHeads) {
      Object.entries(orgStructure.gradeHeads).forEach(([gradeKey, email]) => {
        if (!email) return;
        const grade = String(gradeKey).replace(/\D/g, '');
        const teacher = getOrCreateTeacher(email);
        teacher.grade = grade;
        teacher.dept = `${grade}학년부`;
        teacher.role = teacher.role && teacher.role.includes('담임')
          ? `${grade}학년 부장 (${teacher.role})`
          : `${grade}학년 부장`;
      });
    }

    // 3. 조직도 학급 담임교사 매핑 (homerooms: { '1-1': 'email', '1-2': 'email', '1-3': 'email', ... })
    if (orgStructure.homerooms) {
      Object.entries(orgStructure.homerooms).forEach(([gradeClassKey, email]) => {
        if (!email) return;
        const cleanKey = gradeClassKey.trim();
        const parts = cleanKey.split(/[-_.]/);
        const grade = parts[0]?.replace(/\D/g, '') || '';
        const classNum = parts[1]?.replace(/\D/g, '') || '';
        const gradeClassStr = classNum ? `${grade}-${classNum}` : cleanKey;

        const teacher = getOrCreateTeacher(email);
        teacher.grade = grade;
        teacher.dept = `${grade}학년부`;
        if (teacher.role.includes('부장')) {
          if (!teacher.role.includes('담임')) {
            teacher.role = `${teacher.role} (${gradeClassStr} 담임)`;
          }
        } else {
          teacher.role = `${gradeClassStr} 담임`;
        }
      });
    }

    // 4. 조직도 학년 교과 담당교사 매핑 (gradeSubjects: { '1': ['email1', 'email2'], ... })
    if (orgStructure.gradeSubjects) {
      Object.entries(orgStructure.gradeSubjects).forEach(([gradeKey, emails]) => {
        const grade = String(gradeKey).replace(/\D/g, '');
        (emails || []).forEach(email => {
          if (!email) return;
          const teacher = getOrCreateTeacher(email);
          if (!teacher.grade) teacher.grade = grade;
          if (!teacher.dept || teacher.dept === '교직원') teacher.dept = `${grade}학년부`;
          if (!teacher.role || teacher.role === '교사') {
            teacher.role = `${grade}학년 교과`;
          }
        });
      });
    }

    // 5. 조직도 행정/교무/기타 부서 (departments)
    (orgStructure.departments || []).forEach(d => {
      if (d.headEmail) {
        const teacher = getOrCreateTeacher(d.headEmail, d.headName);
        teacher.dept = d.name;
        if (!teacher.role.includes('부장')) {
          teacher.role = `${d.name} 부장`;
        }
      }

      (d.memberEmails || []).forEach(m => {
        if (!m) return;
        const teacher = getOrCreateTeacher(m);
        if (!teacher.dept || teacher.dept === '교직원') teacher.dept = d.name;
        if (!teacher.role || teacher.role === '교사') {
          teacher.role = `${d.name} 교사`;
        }
      });
    });

    const list = Array.from(teacherMap.values());
    // 이름 가나다순 정렬
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [orgStructure, usersDirectory]);

  // 필터링된 행사 목록
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchType = filterType === 'all' || e.eventType === filterType;
      const matchSearch = !searchTerm || e.title.toLowerCase().includes(searchTerm.toLowerCase()) || e.location.includes(searchTerm);
      return matchType && matchSearch;
    });
  }, [events, filterType, searchTerm]);

  // 신규 행사 등록 열기
  const handleOpenNewForm = (presetType: PeEventType = 'sports_day') => {
    setEditingEvent(null);
    setFormEventType(presetType);

    const todayStr = new Date().toISOString().split('T')[0];
    setFormStartDate(todayStr);
    setFormEndDate(todayStr);

    if (presetType === 'paps_week') {
      setFormTitle('2026학년도 1학기 학생건강체력평가(PAPS) 집중 측정주간 계획');
      setFormLocation('실내체육관, 체력측정실, 대운동장');
      setFormTargetGrades(['5', '6']);
      setFormDescription('초등 5~6학년 학생들의 5개 체력 영역(심폐지구력, 유연성, 근력/근지구력, 순발력, 비만도)을 체계적으로 측정하여 맞춤형 건강 관리 기초자료로 활용하고자 함.');
      setFormSchedules([
        { id: uuidv4(), date: todayStr, time: '09:00 ~ 11:30', title: '5학년 왕복오래달리기 & 50m 달리기', target: '5학년 전체', location: '대운동장' },
        { id: uuidv4(), date: todayStr, time: '13:00 ~ 15:30', title: '6학년 왕복오래달리기 & 50m 달리기', target: '6학년 전체', location: '대운동장' },
        { id: uuidv4(), date: todayStr, time: '09:00 ~ 15:00', title: '5~6학년 유연성 및 근지구력(체육관 순환)', target: '5, 6학년', location: '실내체육관' },
      ]);
      setFormBudgets([
        { id: uuidv4(), category: '운영비', item: '기록지 및 보조 용품', amount: 500000, note: '측정 기록지 인쇄' },
      ]);
    } else if (presetType === 'sports_day') {
      setFormTitle('2026학년도 초등 스포츠 데이(체육대회) 한마당 운영 계획');
      setFormLocation('학교 대운동장 및 메인 체육관');
      setFormTargetGrades(['1', '2', '3', '4', '5', '6']);
      setFormDescription('전교생이 함께 참여하는 스포츠 축제를 통해 기초 체력을 증진하고 협동심과 배려의 스포츠맨십을 함양함.');
      setFormSchedules([
        { id: uuidv4(), date: todayStr, time: '08:30 ~ 09:00', title: '개회식 및 전교생 준비체조', target: '전교생 (1~6학년)', location: '대운동장' },
        { id: uuidv4(), date: todayStr, time: '09:00 ~ 11:30', title: '저학년(1~3학년) 명랑운동회 & 단체경기', target: '1, 2, 3학년', location: '대운동장' },
        { id: uuidv4(), date: todayStr, time: '09:00 ~ 11:30', title: '고학년(4~6학년) 스포츠 리그전 (피구/풋살)', target: '4, 5, 6학년', location: '메인 체육관' },
        { id: uuidv4(), date: todayStr, time: '13:00 ~ 14:30', title: '전교생 한마당 릴레이 & 줄다리기 결선', target: '전교생 (1~6학년)', location: '대운동장' },
        { id: uuidv4(), date: todayStr, time: '14:30 ~ 15:00', title: '시상식 및 폐회식, 주변 정리', target: '전교생 (1~6학년)', location: '대운동장' },
      ]);
      setFormBudgets([
        { id: uuidv4(), category: '용품구입비', item: '경기 용품 및 단체 줄다리기 줄', amount: 3500000, note: '체육부 교구' },
        { id: uuidv4(), category: '시상비', item: '반별 참가 상품 및 우승 트로피', amount: 2000000, note: '전 학급 상품' },
        { id: uuidv4(), category: '음료비', item: '학생 및 교직원 생수/간식', amount: 1500000, note: '안전 지원' },
      ]);
    } else {
      setFormTitle('2026학년도 교내 스포츠 리그전 운영 계획');
      setFormLocation('메인 체육관 및 풋살장');
      setFormTargetGrades(['5', '6']);
      setFormDescription('방과후 및 점심시간을 활용한 학급 대항 스포츠 리그전을 개최하여 건전한 스포츠 문화 정착.');
      setFormSchedules([
        { id: uuidv4(), date: todayStr, time: '12:40 ~ 13:20', title: '점심시간 5학년 반대항 피구 리그전', target: '5학년', location: '체육관' },
        { id: uuidv4(), date: todayStr, time: '12:40 ~ 13:20', title: '점심시간 6학년 반대항 풋살 리그전', target: '6학년', location: '풋살장' },
      ]);
      setFormBudgets([
        { id: uuidv4(), category: '시상비', item: '리그전 우승/준우승 상품', amount: 1000000, note: '학급 상품' },
      ]);
    }

    setIsFormOpen(true);
  };

  // 기존 행사 수정 열기
  const handleOpenEditForm = (ev: PeEvent) => {
    setEditingEvent(ev);
    setFormTitle(ev.title);
    setFormEventType(ev.eventType);
    setFormStartDate(ev.startDate);
    setFormEndDate(ev.endDate);
    setFormTargetGrades(ev.targetGrades || ['1', '2', '3', '4', '5', '6']);
    setFormLocation(ev.location);
    setFormManager(ev.manager);
    setFormDescription(ev.description || '');
    setFormSchedules(ev.schedules || []);
    setFormBudgets(ev.budgets || []);
    setIsFormOpen(true);
  };

  // 대상 학년 토글
  const handleToggleGrade = (grade: string) => {
    setFormTargetGrades(prev =>
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade].sort()
    );
  };

  const handleToggleAllGrades = () => {
    if (formTargetGrades.length === availableGrades.length) {
      setFormTargetGrades([]);
    } else {
      setFormTargetGrades([...availableGrades]);
    }
  };

  // 일정표 조작
  const handleAddSchedule = (defaultDate?: string) => {
    const targetDate = defaultDate || formStartDate || new Date().toISOString().split('T')[0];
    const defaultStart = periodSchedules[0]?.name || '1교시';
    const defaultEnd = periodSchedules[2]?.name || '3교시';
    const startP = periodSchedules[0];
    const endP = periodSchedules[2] || periodSchedules[0];
    const timeStr = startP && endP ? `${startP.startTime} ~ ${endP.endTime} (${defaultStart}~${defaultEnd})` : '08:30 ~ 11:00 (1~3교시)';

    setFormSchedules(prev => [
      ...prev,
      {
        id: uuidv4(),
        date: targetDate,
        startPeriod: defaultStart,
        endPeriod: defaultEnd,
        time: timeStr,
        title: '1학년 스포츠 활동 (세부계획서 참조)',
        target: '1학년',
        location: formLocation || '대운동장',
      }
    ]);
  };

  // 새 날짜 추가 핸들러
  const handleAddNewDateSchedule = () => {
    let nextDateStr = formStartDate || new Date().toISOString().split('T')[0];
    if (scheduleDates.length > 0) {
      const lastDateStr = scheduleDates[scheduleDates.length - 1];
      const nextD = new Date(lastDateStr);
      nextD.setDate(nextD.getDate() + 1);
      nextDateStr = nextD.toISOString().split('T')[0];
    }
    handleAddSchedule(nextDateStr);
    toast({ title: '새 날짜 배정표 추가', description: `${nextDateStr} 날짜의 교시 배정 블록이 추가되었습니다.` });
  };

  // 시작 교시와 종료 교시를 이용한 시간 문자열 자동 계산
  const handlePeriodRangeChange = (
    scheduleId: string,
    startPName: string,
    endPName?: string
  ) => {
    const startP = periodSchedules.find(p => p.name === startPName || p.id === startPName) || periodSchedules[0];
    const endP = periodSchedules.find(p => p.name === (endPName || startPName) || p.id === (endPName || startPName)) || startP;
    if (!startP) return;

    const isSingle = startP.name === endP.name;
    const timeStr = isSingle
      ? `${startP.startTime} ~ ${startP.endTime} (${startP.name})`
      : `${startP.startTime} ~ ${endP.endTime} (${startP.name}~${endP.name})`;

    setFormSchedules(prev => prev.map(s => {
      if (s.id !== scheduleId) return s;
      return {
        ...s,
        startPeriod: startP.name,
        endPeriod: endP.name,
        time: timeStr,
      };
    }));
  };

  // 배정 학년 선택 시 title 스마트 동기화
  const handleTargetGradeSelect = (scheduleId: string, targetText: string) => {
    setFormSchedules(prev => prev.map(s => {
      if (s.id !== scheduleId) return s;
      const newTitle = (!s.title || s.title.includes('스포츠 활동') || s.title.includes('체육 활동') || s.title.includes('세부계획서'))
        ? `${targetText} 스포츠 활동 (세부계획서 참조)`
        : s.title;
      return {
        ...s,
        target: targetText,
        title: newTitle
      };
    }));
  };

  const handleUpdateSchedule = (id: string, field: keyof PeEventSchedule, value: string) => {
    setFormSchedules(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleRemoveSchedule = (id: string) => {
    setFormSchedules(prev => prev.filter(s => s.id !== id));
  };

  // 예산 조작
  const handleAddBudget = () => {
    setFormBudgets(prev => [
      ...prev,
      {
        id: uuidv4(),
        category: '용품구입비',
        item: '',
        amount: 0,
        note: '',
      }
    ]);
  };

  const handleUpdateBudget = (id: string, field: keyof PeEventBudget, value: any) => {
    setFormBudgets(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleRemoveBudget = (id: string) => {
    setFormBudgets(prev => prev.filter(b => b.id !== id));
  };

  // 총 예산 합계
  const calculatedTotalBudget = useMemo(() => {
    return formBudgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  }, [formBudgets]);

  // 행사 저장
  const handleSaveEvent = async () => {
    if (!formTitle.trim()) {
      toast({ variant: 'destructive', title: '행사명을 입력하세요' });
      return;
    }

    try {
      const eventToSave: PeEvent = {
        id: editingEvent ? editingEvent.id : uuidv4(),
        school,
        title: formTitle.trim(),
        eventType: formEventType,
        startDate: formStartDate,
        endDate: formEndDate,
        targetGrades: formTargetGrades,
        location: formLocation.trim(),
        manager: formManager.trim(),
        description: formDescription.trim(),
        totalBudget: calculatedTotalBudget,
        budgets: formBudgets,
        schedules: formSchedules,
        approvalStatus: editingEvent ? editingEvent.approvalStatus : 'DRAFT',
        approvalDocId: editingEvent?.approvalDocId,
        suggestion: editingEvent?.suggestion,
        linkedTaskId: editingEvent?.linkedTaskId,
        gradeAssignments: editingEvent?.gradeAssignments,
        createdAt: editingEvent ? editingEvent.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await savePeEvent(school, eventToSave);
      toast({
        title: editingEvent ? '행사 계획 수정 완료' : '행사 계획 수립 완료',
        description: `${formTitle} 계획이 정상적으로 저장되었습니다.`,
      });

      setIsFormOpen(false);
      loadInitialData();
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: '저장 실패', description: e.message });
    }
  };

  // 행사 삭제
  const handleDeleteEvent = async (ev: PeEvent) => {
    if (!confirm(`'${ev.title}' 계획을 정말 삭제하시겠습니까?`)) return;
    try {
      await deletePeEvent(school, ev.id);
      toast({ title: '행사 계획 삭제 완료' });
      loadInitialData();
    } catch (e: any) {
      toast({ variant: 'destructive', title: '삭제 실패', description: e.message });
    }
  };

  // =========================================================================
  // 1. 학년별 세부계획 업무 요청 모달 열기 및 발송
  // =========================================================================
  const handleOpenTaskRequest = (ev: PeEvent) => {
    setTargetEventForTask(ev);
    const targetGrades = ev.targetGrades && ev.targetGrades.length > 0 ? ev.targetGrades : ['1', '2', '3', '4', '5', '6'];
    setSelectedGradesForTask(targetGrades);

    // 기본 담당자 자동 매핑 (1순위: 해당 학년부장, 2순위: 1반 담임, 3순위: 해당 학년 소속 교사)
    const initialAssignees: { [grade: string]: { email: string; name: string } } = {};
    targetGrades.forEach(grade => {
      // 1순위: 해당 학년부장 (예: 1학년 부장)
      const gradeHead = teacherList.find(t => t.grade === grade && (t.role.includes(`${grade}학년 부장`) || t.role.includes(`${grade}학년부장`)));
      if (gradeHead) {
        initialAssignees[grade] = { email: gradeHead.email, name: gradeHead.name };
        return;
      }
      // 2순위: 해당 학년 1반 담임 (예: 1-1 담임)
      const firstClassTeacher = teacherList.find(t => t.grade === grade && (t.role.includes(`${grade}-1`) || t.role.includes(`${grade}-1 담임`)));
      if (firstClassTeacher) {
        initialAssignees[grade] = { email: firstClassTeacher.email, name: firstClassTeacher.name };
        return;
      }
      // 3순위: 해당 학년 소속 교사
      const gradeTeacher = teacherList.find(t => t.grade === grade);
      if (gradeTeacher) {
        initialAssignees[grade] = { email: gradeTeacher.email, name: gradeTeacher.name };
        return;
      }
      // 4순위: 전체 교사 중 매핑
      const defaultTeacher = teacherList[0];
      if (defaultTeacher) {
        initialAssignees[grade] = { email: defaultTeacher.email, name: defaultTeacher.name };
      }
    });

    setGradeAssignees(initialAssignees);
    setTaskDeadline(ev.startDate);
    setIsTaskRequestOpen(true);
  };

  const handleSendGradeTaskRequest = async () => {
    if (!targetEventForTask) return;
    setIsRequestingTask(true);
    try {
      const targetGradesToRequest = selectedGradesForTask;
      const targetEmails: string[] = [];
      const targetNames: { [email: string]: string } = {};
      const gradeAssignmentsList: PeGradeAssignment[] = [];

      targetGradesToRequest.forEach(grade => {
        const assigned = gradeAssignees[grade];
        if (assigned && assigned.email) {
          targetEmails.push(assigned.email);
          targetNames[assigned.email.toLowerCase()] = `${grade}학년 (${assigned.name})`;
          gradeAssignmentsList.push({
            grade,
            teacherEmail: assigned.email,
            teacherName: assigned.name,
            submitted: false,
          });
        }
      });

      // KIS 업무 관리 컬렉션(dept_tasks)에 신규 업무 생성
      const res = await createDepartmentTask({
        title: `[업무요청] ${targetEventForTask.title} 학년별 세부계획 제출`,
        description: `■ 행사명: ${targetEventForTask.title}\n■ 행사 일시: ${targetEventForTask.startDate} ~ ${targetEventForTask.endDate}\n■ 진행 장소: ${targetEventForTask.location}\n\n[안내 사항]\n${taskNotice}\n\n* 양식에 맞추어 세부 운영 타임테이블(시나리오)과 PPT 파일 또는 캔바(Canva) 공유 링크를 제출해 주시기 바랍니다.`,
        creatorEmail: user?.email || 'pe-teacher@kishc.org',
        creatorName: user?.displayName || '체육교과 담당교사',
        creatorDept: '예체능방과후부(체육)',
        targetType: 'custom',
        targetEmails,
        targetNames,
        taskType: 'file_submission',
        deadline: taskDeadline,
        status: 'active',
        eventSchedules: targetEventForTask.schedules || [],
      });

      if (!res.success || !res.id) {
        throw new Error(res.error || '업무 등록 실패');
      }

      // PeEvent 객체에 linkedTaskId 및 gradeAssignments 업데이트
      const updatedEvent: PeEvent = {
        ...targetEventForTask,
        linkedTaskId: res.id,
        gradeAssignments: gradeAssignmentsList,
      };

      await savePeEvent(school, updatedEvent);
      setEvents(prev => prev.map(e => e.id === targetEventForTask.id ? updatedEvent : e));

      setIsTaskRequestOpen(false);
      toast({
        title: '학년별 세부계획 업무 요청 완료',
        description: `총 ${targetGradesToRequest.length}개 학년 담당 교사 대시보드('나에게 할당된 업무')로 요청이 전달되었습니다.`,
      });
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: '업무 요청 실패', description: e.message });
    } finally {
      setIsRequestingTask(false);
    }
  };

  const getEventTaskSubmissions = (ev: PeEvent) => {
    if (!ev.linkedTaskId) return { task: null, submissions: {}, submittedCount: 0, totalCount: 0, percent: 0, requestedGrades: [] };
    const task = deptTasks.find(t => t.id === ev.linkedTaskId);
    if (!task) return { task: null, submissions: {}, submittedCount: 0, totalCount: 0, percent: 0, requestedGrades: [] };

    const targetEmails = task.targetEmails || [];
    const submissions = task.submissions || {};
    
    // 실제 업무가 요청/할당된 학년 목록 추출
    const gradesSet = new Set<string>();
    (ev.gradeAssignments || []).forEach(g => { if (g.grade) gradesSet.add(String(g.grade)); });
    Object.values(task.targetNames || {}).forEach(name => {
      const match = name.match(/([1-6])학년/);
      if (match) gradesSet.add(match[1]);
    });
    Object.values(submissions).forEach(s => {
      if (s.grade) gradesSet.add(String(s.grade));
    });

    if (gradesSet.size === 0) {
      if (ev.targetGrades && ev.targetGrades.length > 0) {
        ev.targetGrades.forEach(g => gradesSet.add(String(g)));
      } else {
        targetEmails.forEach((_, idx) => gradesSet.add(String(idx + 1)));
      }
    }

    const requestedGrades = Array.from(gradesSet).sort((a, b) => Number(a) - Number(b));

    // 요청된 학년 중 실제 제출 완료된 학년 수 계산
    const submittedGradesCount = requestedGrades.filter(grade => {
      const gradeKey = Object.keys(submissions).find(k => {
        const s = submissions[k];
        return String(s.grade) === String(grade) || k.endsWith(`_${grade}`);
      });
      return !!gradeKey || !!Object.values(submissions).find(s => String(s.grade) === String(grade));
    }).length;

    const totalCount = requestedGrades.length > 0 ? requestedGrades.length : targetEmails.length;
    const submittedCount = Math.min(submittedGradesCount, totalCount);
    const percent = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;

    return { task, submissions, submittedCount, totalCount, percent, requestedGrades };
  };

  // 특정 제출물 삭제/초기화
  const handleDeleteSubmissionItem = async (taskId: string, submissionKey: string) => {
    if (!confirm('해당 학년의 제출 내역을 삭제(초기화)하시겠습니까?')) return;
    try {
      const res = await deleteDepartmentTaskSubmission(taskId, submissionKey);
      if (res.success) {
        toast({ title: '제출 내역 삭제 완료', description: '해당 제출물이 성공적으로 정리되었습니다.' });
      } else {
        toast({ variant: 'destructive', title: '삭제 실패', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: e.message });
    }
  };

  // =========================================================================
  // 3. 전자결재 기안문 자동 생성 & 상신 연동 (본문 단순화 + 인쇄형 HTML 첨부문서)
  // =========================================================================
  const handleSendApprovalDraft = async (ev: PeEvent) => {
    try {
      const draftTitle = `[계획] ${ev.title}`;
      const formattedTotalBudget = ev.totalBudget.toLocaleString();
      const targetGradesText = ev.targetGrades && ev.targetGrades.length > 0 ? ev.targetGrades.join(', ') + '학년' : '전교생';

      const { task, submissions } = getEventTaskSubmissions(ev);
      const hasGradeSubmissions = task && Object.keys(submissions).length > 0;

      // -------------------------------------------------------------
      // 1. 공문서 기안문 본문 (단순하고 정제된 요약 양식)
      // -------------------------------------------------------------
      const bodyHtml = `
<p style="line-height: 1.8; margin-bottom: 8px; font-size: 13px;">1. 관련: 초등 체육과 교육과정 및 2026학년도 학교 체육 운영 계획</p>
<p style="line-height: 1.8; margin-bottom: 8px; font-size: 13px;">2. <strong>${ev.title}</strong>을 다음과 같이 추진하고자 하오니 결재하여 주시기 바랍니다.</p>
<p style="line-height: 1.8; margin-bottom: 4px; margin-left: 16px; font-size: 13px;">가. &nbsp;행사명: ${ev.title}</p>
<p style="line-height: 1.8; margin-bottom: 4px; margin-left: 16px; font-size: 13px;">나. &nbsp;운영 일시: ${ev.startDate} ~ ${ev.endDate}</p>
<p style="line-height: 1.8; margin-bottom: 4px; margin-left: 16px; font-size: 13px;">다. &nbsp;진행 장소: ${ev.location}</p>
<p style="line-height: 1.8; margin-bottom: 4px; margin-left: 16px; font-size: 13px;">라. &nbsp;대상 학년: ${targetGradesText}</p>
<p style="line-height: 1.8; margin-bottom: 8px; margin-left: 16px; font-size: 13px;">마. &nbsp;소요 예산: 금 ${formattedTotalBudget} VND</p>
<table style="width: 100%; border-collapse: collapse; border: none; margin-top: 24px; margin-bottom: 6px; line-height: 1.8; font-size: 13px;" class="attachment-table">
  <tbody>
    <tr>
      <td style="vertical-align: top; width: 36px; border: none; padding: 0 8px 3px 0; white-space: nowrap; font-weight: normal; color: inherit;">붙임</td>
      <td style="vertical-align: top; border: none; padding: 0 0 3px 0; font-weight: normal; color: inherit; word-break: keep-all;">1. &nbsp;${ev.title} 세부 운영 계획서 1부.</td>
    </tr>
    ${hasGradeSubmissions ? `
    <tr>
      <td style="border: none; padding: 0 8px 3px 0;"></td>
      <td style="vertical-align: top; border: none; padding: 0 0 3px 0; font-weight: normal; color: inherit; word-break: keep-all;">2. &nbsp;학년별 세부 운영 시나리오 및 타임테이블(취합본) 1부. &nbsp;&nbsp;끝.</td>
    </tr>` : `
    <tr>
      <td style="border: none; padding: 0 8px 3px 0;"></td>
      <td style="vertical-align: top; border: none; padding: 0 0 3px 0; font-weight: normal; color: inherit; word-break: keep-all;">끝.</td>
    </tr>`}
  </tbody>
</table>
      `.trim();

      // -------------------------------------------------------------
      // 2. [붙임 1] 세부 운영 계획서 HTML 문서 (PDF 인쇄 최적화)
      // -------------------------------------------------------------
      const schedulesTableRows = (ev.schedules || []).map((s, idx) => `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${s.date}${s.time ? `<br><span style="font-size: 11px; color: #64748b; font-weight: normal;">${s.time}</span>` : ''}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;"><strong>${s.title}</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${s.target || '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${s.location || '-'}</td>
        </tr>
      `).join('');

      const budgetsTableRows = (ev.budgets || []).map((b, idx) => `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: 600;">${b.category}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${b.item}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${b.amount.toLocaleString()} VND</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${b.note || '-'}</td>
        </tr>
      `).join('');

      const planHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${ev.title} 세부 운영 계획서</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap');
  body {
    font-family: 'Noto Sans KR', sans-serif;
    color: #1e293b;
    background-color: #f8fafc;
    margin: 0;
    padding: 30px 15px;
  }
  .page {
    max-width: 820px;
    margin: 0 auto 25px auto;
    background: #ffffff;
    padding: 50px 60px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    box-sizing: border-box;
  }
  .header-title {
    font-size: 22px;
    font-weight: 800;
    text-align: center;
    color: #0f172a;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
  }
  .header-decor {
    height: 4px;
    width: 100%;
    background: linear-gradient(to right, #4f46e5 70%, #06b6d4 30%);
    margin-bottom: 24px;
    border-radius: 2px;
  }
  .section-badge {
    font-size: 15px;
    font-weight: 800;
    color: #1e1b4b;
    border-bottom: 2px solid #4f46e5;
    padding-bottom: 4px;
    margin: 22px 0 10px 0;
  }
  p.indent-1 {
    margin: 6px 0;
    line-height: 1.7;
    font-size: 13px;
  }
  table.custom-table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 12px;
  }
  table.custom-table th, table.custom-table td {
    border: 1px solid #cbd5e1;
    padding: 8px 10px;
  }
  table.custom-table th {
    background-color: #f1f5f9;
    font-weight: 700;
    color: #0f172a;
    text-align: center;
  }
  .print-btn-container {
    text-align: center;
    margin-bottom: 20px;
  }
  .print-btn {
    background: #4f46e5;
    color: white;
    border: none;
    padding: 10px 22px;
    font-size: 14px;
    font-weight: 700;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(79,70,229,0.3);
    transition: all 0.2s;
  }
  .print-btn:hover {
    background: #4338ca;
  }
  @media print {
    @page { size: A4 portrait; margin: 12mm 15mm; }
    body { background: white; padding: 0; }
    .page { box-shadow: none; padding: 0; margin: 0; max-width: 100%; }
    .print-btn-container { display: none; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="print-btn-container">
    <button class="print-btn" onclick="window.print()">PDF 다운로드 / 인쇄하기</button>
  </div>
  
  <div class="page">
    <div class="header-title">${ev.title} 세부 운영 계획서</div>
    <div class="header-decor"></div>
    
    <div class="section-badge">1. 행사 기본 개요</div>
    <table class="custom-table">
      <tbody>
        <tr>
          <th style="width: 20%;">행사명</th>
          <td colspan="3"><strong>${ev.title}</strong></td>
        </tr>
        <tr>
          <th style="width: 20%;">운영 일시</th>
          <td>${ev.startDate} ~ ${ev.endDate}</td>
          <th style="width: 20%;">진행 장소</th>
          <td>${ev.location}</td>
        </tr>
        <tr>
          <th>대상 학년</th>
          <td>${targetGradesText}</td>
          <th>추진 담당</th>
          <td>${ev.manager}</td>
        </tr>
      </tbody>
    </table>

    <div class="section-badge">2. 목적 및 운영 방침</div>
    <p class="indent-1">${ev.description ? ev.description.replace(/\n/g, '<br>') : '학생들의 기초 체력 증진과 활기찬 스포츠 문화 형성을 목적으로 함.'}</p>

    <div class="section-badge">3. 총괄 운영 타임테이블 및 일정표</div>
    <table class="custom-table">
      <thead>
        <tr>
          <th style="width: 40px;">No</th>
          <th style="width: 140px;">일자 및 시간</th>
          <th>프로그램명</th>
          <th style="width: 110px;">대상</th>
          <th style="width: 120px;">장소</th>
        </tr>
      </thead>
      <tbody>
        ${schedulesTableRows || '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 12px;">등록된 일정이 없습니다.</td></tr>'}
      </tbody>
    </table>

    <div class="section-badge">4. 소요 예산 내역 (총계: 금 ${formattedTotalBudget} VND)</div>
    <table class="custom-table">
      <thead>
        <tr>
          <th style="width: 40px;">No</th>
          <th style="width: 100px;">항목 구분</th>
          <th>산출 내역</th>
          <th style="width: 130px;">금액</th>
          <th style="width: 120px;">비고</th>
        </tr>
      </thead>
      <tbody>
        ${budgetsTableRows || '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 12px;">소요 예산 내역이 없습니다.</td></tr>'}
      </tbody>
    </table>
  </div>
</body>
</html>`;

      // -------------------------------------------------------------
      // 3. [붙임 2] 학년별 세부 운영 시나리오 및 타임테이블 (취합본) HTML 문서
      // -------------------------------------------------------------
      let gradeSubmissionsHtml = '';
      if (hasGradeSubmissions) {
        // 학년별 고유 제출물 선별 (중복 키 제거 및 학년 오름차순 정렬)
        const uniqueSubmissionsByGrade = new Map<string, { key: string; sub: TaskSubmission }>();
        Object.entries(submissions).forEach(([key, sub]) => {
          let grade = sub.grade ? String(sub.grade) : '';
          if (!grade) {
            const match = key.match(/_([1-6])$/);
            if (match) grade = match[1];
          }
          if (!grade) grade = '5'; // fallback

          const existing = uniqueSubmissionsByGrade.get(grade);
          if (!existing || (sub.submittedAt && (!existing.sub.submittedAt || sub.submittedAt > existing.sub.submittedAt))) {
            uniqueSubmissionsByGrade.set(grade, { key, sub });
          }
        });

        const sortedGradeEntries = Array.from(uniqueSubmissionsByGrade.entries())
          .sort((a, b) => Number(a[0]) - Number(b[0]));

        const gradeSectionsHtml = sortedGradeEntries.map(([grade, { key, sub }]) => {
          const scenariosRows = (sub.scenarios || []).map((sc, idx) => `
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${sc.time}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #1e1b4b;">${sc.program}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">${sc.rules ? sc.rules.replace(/\n/g, '<br>') : '-'}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">${sc.preparations ? sc.preparations.replace(/\n/g, '<br>') : '-'}</td>
            </tr>
          `).join('');

          return `
            <div style="margin-bottom: 24px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; background-color: #ffffff;">
              <div style="font-size: 15px; font-weight: 800; color: #4338ca; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span>■ ${grade}학년 세부 운영 계획</span>
                <span style="font-size: 12px; color: #64748b; font-weight: normal;">작성 교사: ${sub.submitterName || key.split('@')[0]}</span>
              </div>
              
              ${sub.linkUrl ? `
                <div style="margin-bottom: 10px; font-size: 12px; background-color: #f5f3ff; border: 1px solid #ddd6fe; padding: 8px 12px; border-radius: 6px;">
                  <strong>발표 / 캔바(Canva) 자료:</strong> <a href="${sub.linkUrl}" target="_blank" style="color: #6366f1; text-decoration: underline; font-weight: bold;">${sub.linkTitle || sub.linkUrl}</a>
                </div>
              ` : ''}

              <table class="custom-table" style="margin-top: 8px;">
                <thead>
                  <tr>
                    <th style="width: 120px;">시간</th>
                    <th style="width: 160px;">프로그램명</th>
                    <th>경기 규칙 및 진행 요령</th>
                    <th style="width: 150px;">비품 / 교사 배치</th>
                  </tr>
                </thead>
                <tbody>
                  ${scenariosRows || '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 12px;">작성된 시나리오가 없습니다.</td></tr>'}
                </tbody>
              </table>

              ${sub.note ? `<p style="font-size: 12px; color: #475569; margin: 8px 0 0 0; background: #f8fafc; padding: 6px 10px; border-radius: 4px;"><strong>특이사항 및 안내:</strong> ${sub.note}</p>` : ''}
            </div>
          `;
        }).join('');

        gradeSubmissionsHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${ev.title} 학년별 세부 운영 시나리오 및 타임테이블 (취합본)</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap');
  body {
    font-family: 'Noto Sans KR', sans-serif;
    color: #1e293b;
    background-color: #f8fafc;
    margin: 0;
    padding: 30px 15px;
  }
  .page {
    max-width: 820px;
    margin: 0 auto 25px auto;
    background: #ffffff;
    padding: 50px 60px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    box-sizing: border-box;
  }
  .header-title {
    font-size: 22px;
    font-weight: 800;
    text-align: center;
    color: #0f172a;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
  }
  .header-decor {
    height: 4px;
    width: 100%;
    background: linear-gradient(to right, #6366f1 70%, #ec4899 30%);
    margin-bottom: 24px;
    border-radius: 2px;
  }
  table.custom-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 12px;
  }
  table.custom-table th, table.custom-table td {
    border: 1px solid #cbd5e1;
    padding: 8px 10px;
  }
  table.custom-table th {
    background-color: #f1f5f9;
    font-weight: 700;
    color: #0f172a;
    text-align: center;
  }
  .print-btn-container {
    text-align: center;
    margin-bottom: 20px;
  }
  .print-btn {
    background: #6366f1;
    color: white;
    border: none;
    padding: 10px 22px;
    font-size: 14px;
    font-weight: 700;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(99,102,241,0.3);
    transition: all 0.2s;
  }
  .print-btn:hover {
    background: #4f46e5;
  }
  @media print {
    @page { size: A4 portrait; margin: 12mm 15mm; }
    body { background: white; padding: 0; }
    .page { box-shadow: none; padding: 0; margin: 0; max-width: 100%; }
    .print-btn-container { display: none; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="print-btn-container">
    <button class="print-btn" onclick="window.print()">PDF 다운로드 / 인쇄하기</button>
  </div>
  
  <div class="page">
    <div class="header-title">${ev.title} 학년별 세부 운영 시나리오 및 타임테이블 (취합본)</div>
    <div class="header-decor"></div>
    ${gradeSectionsHtml}
  </div>
</body>
</html>`;
      }

      // -------------------------------------------------------------
      // 4. 첨부파일 목록 구성 (스쿨버스 공문서 방식)
      // -------------------------------------------------------------
      const attachments = [
        {
          name: `붙임 1. ${ev.title} 세부 운영 계획서.html`,
          size: planHtml.length * 2,
          data: 'data:text/html;charset=utf-8,' + encodeURIComponent(planHtml)
        },
        ...(hasGradeSubmissions ? [{
          name: `붙임 2. 학년별 세부 운영 시나리오 및 타임테이블 (취합본).html`,
          size: gradeSubmissionsHtml.length * 2,
          data: 'data:text/html;charset=utf-8,' + encodeURIComponent(gradeSubmissionsHtml)
        }] : [])
      ];

      // sessionStorage에 공문서 기안 데이터 저장
      sessionStorage.setItem('pending_doc_draft', JSON.stringify({
        title: draftTitle,
        content: bodyHtml,
        attachments
      }));

      toast({
        title: '체육 행사 기안문 생성 완료',
        description: `전자결재 기안 작성 페이지로 이동합니다. (붙임 ${attachments.length}건 탑재됨)`,
      });

      router.push('/new?peTemplate=true');
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: '기안문 생성 실패', description: e.message });
    }
  };

  // =========================================================================
  // 4. 결재 완료 후 부장 건의 모달 열기 및 건의 전송
  // =========================================================================
  const handleOpenSuggestModal = (ev: PeEvent) => {
    setSuggestTargetEvent(ev);
    setSuggestTitle(`[체육행사] ${ev.title} 주간/월간 학사일정 반영 건의`);
    setSuggestContent(
      `■ 행사명: ${ev.title}\n` +
      `■ 행사 기간: ${ev.startDate} ~ ${ev.endDate}\n` +
      `■ 진행 장소: ${ev.location}\n` +
      `■ 대상 학년: ${ev.targetGrades && ev.targetGrades.length > 0 ? ev.targetGrades.join(', ') + '학년' : '전교생'}\n` +
      `■ 주요 내용: ${ev.description || '체육 행사 진행'}\n\n` +
      `위 행사가 내부 결재 완료되었으므로, 교무 주간교육계획 및 월간 학사일정에 공식 반영을 요청드립니다.`
    );
    setIsSuggestModalOpen(true);
  };

  const handleSendSuggestion = async () => {
    if (!suggestTargetEvent) return;
    if (!user) {
      toast({ variant: 'destructive', title: '로그인이 필요합니다.' });
      return;
    }

    setIsSubmittingSuggest(true);
    try {
      await suggestPeEventToDepartment(
        school,
        suggestTargetEvent.id,
        user.email || 'teacher@kishc.org',
        user.displayName || '체육담당 교사',
        suggestTitle.trim(),
        suggestContent.trim()
      );

      toast({
        title: '부장 건의 완료',
        description: '교무기획부 및 소속 부서 주간/월간 교육계획으로 일정이 제안되었습니다.',
      });

      setIsSuggestModalOpen(false);
      loadInitialData();
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: '건의 실패', description: e.message });
    } finally {
      setIsSubmittingSuggest(false);
    }
  };

  // 날짜 목록 추출 (행사 기간 기준 또는 기존 스케줄 기준)
  const scheduleDates = useMemo(() => {
    const dates = new Set<string>();
    if (formStartDate) dates.add(formStartDate);
    if (formEndDate) dates.add(formEndDate);
    formSchedules.forEach(s => {
      if (s.date) dates.add(s.date);
    });
    return Array.from(dates).sort();
  }, [formStartDate, formEndDate, formSchedules]);

  return (
    <div className="space-y-4">
      {/* 1. 상단 액션 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                filterType === 'all' ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              전체 행사 ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('paps_week')}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                filterType === 'paps_week' ? "bg-blue-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              PAPS 측정주간
            </button>
            <button
              type="button"
              onClick={() => setFilterType('sports_day')}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                filterType === 'sports_day' ? "bg-amber-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              스포츠 데이 (운동회)
            </button>
          </div>

          <div className="relative w-44 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="행사명 / 장소 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-300"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadInitialData}
            className="h-8 px-2 border-slate-300 text-slate-600"
            title="새로고침"
          >
            <RefreshCw className={isLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          </Button>
        </div>

        {/* 신규 계획 수립 버튼 그룹 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            onClick={() => handleOpenNewForm('paps_week')}
            className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
          >
            <Activity className="mr-1 h-3.5 w-3.5" />
            PAPS 측정주간 수립
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenNewForm('sports_day')}
            className="h-8 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs"
          >
            <Flame className="mr-1 h-3.5 w-3.5" />
            스포츠데이 수립
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenNewForm('tournament')}
            className="h-8 text-xs font-bold border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            기타 행사 계획
          </Button>
        </div>
      </div>

      {/* 2. 행사 목록 그리드 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredEvents.map(ev => {
          const isPaps = ev.eventType === 'paps_week';
          const isSportsDay = ev.eventType === 'sports_day';
          const { task, submissions, submittedCount, totalCount, percent } = getEventTaskSubmissions(ev);

          return (
            <Card key={ev.id} className="border border-slate-200/90 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white flex flex-col justify-between overflow-hidden">
              <CardHeader className="p-4 pb-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Badge className={cn(
                      "text-[10px] font-bold px-2 py-0.5",
                      isPaps ? "bg-blue-100 text-blue-800" : isSportsDay ? "bg-amber-100 text-amber-900" : "bg-purple-100 text-purple-800"
                    )}>
                      {isPaps ? 'PAPS 측정주간' : isSportsDay ? '스포츠 데이' : '대회/리그전'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-medium bg-slate-50 text-slate-600">
                      {ev.approvalStatus === 'APPROVED' ? '결재 완료' : ev.approvalStatus === 'SUBMITTED' ? '기안 상신중' : '계획 수립'}
                    </Badge>
                  </div>

                  {ev.suggestion && (
                    <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-bold">
                      ✓ 부장 건의 완료
                    </Badge>
                  )}
                </div>

                <CardTitle className="text-sm sm:text-base font-black text-slate-900 leading-snug line-clamp-1">
                  {ev.title}
                </CardTitle>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-600 pt-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{ev.startDate} ~ {ev.endDate}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{ev.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>대상: {ev.targetGrades && ev.targetGrades.length > 0 ? ev.targetGrades.join(', ') + '학년' : '전교생'} ({ev.schedules?.length || 0}개 프로그램)</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate font-bold text-amber-800">
                    <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>총 예산: {ev.totalBudget.toLocaleString()} VND</span>
                  </div>
                </div>

                {isSportsDay && (
                  <div className="pt-2 border-t border-slate-100 mt-2 space-y-1.5">
                    {task ? (
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-700 flex items-center gap-1">
                            <Inbox className="w-3.5 h-3.5 text-indigo-600" />
                            학년별 세부계획 제출 현황
                          </span>
                          <span className="text-indigo-600 font-extrabold">{submittedCount}/{totalCount}개 학년 ({percent}%)</span>
                        </div>
                        <Progress value={percent} className="h-1.5 bg-slate-200" />
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                          <span>마감: {task.deadline}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setTargetEventForView(ev);
                              setIsSubmissionsViewOpen(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                          >
                            제출 세부계획 열람/취합 →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-2 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs">
                        <span className="text-indigo-900 font-medium text-[11px]">각 학년 세부계획(타임테이블) 요청 필요</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenTaskRequest(ev)}
                          className="h-6 text-[11px] text-indigo-700 font-bold hover:bg-indigo-100 px-2 rounded-lg"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          업무 요청하기
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardHeader>

              <CardFooter className="p-4 pt-2.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-b-2xl gap-1.5 flex-wrap">
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenEditForm(ev)}
                    className="h-7 text-xs text-slate-600 hover:text-slate-900"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteEvent(ev)}
                    className="h-7 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    삭제
                  </Button>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSendApprovalDraft(ev)}
                    className="h-7 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-2xs"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    기안문 상신
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleOpenSuggestModal(ev)}
                    className={cn(
                      "h-7 text-xs font-bold shadow-2xs",
                      ev.suggestion ? "bg-slate-100 text-slate-700 border border-slate-300" : "bg-teal-600 hover:bg-teal-700 text-white"
                    )}
                  >
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    {ev.suggestion ? '일정 재건의' : '부장 일정 건의'}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* =========================================================================
          행사 등록 및 수정 다이얼로그 (개편된 요일/시간대 배정표 탑재)
         ========================================================================= */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] sm:max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* 상단 고정 헤더 (X 버튼과 함께 스크롤 무관 항상 고정) */}
          <DialogHeader className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-white shrink-0 sticky top-0 z-20 text-left">
            <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 pr-8">
              <CalendarDays className="w-5 h-5 text-indigo-600 shrink-0" />
              {editingEvent ? '체육 행사 계획 수정' : '신규 체육 행사 계획 수립'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              측정주간, 스포츠데이, 교내 리그전 등의 일정과 예산을 수립하고 결재 기안을 상신합니다.
            </DialogDescription>
          </DialogHeader>

          {/* 스크롤 가능한 본문 폼 영역 */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
            {/* 1. 기본 정보 */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                1. 기본 행사 정보
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">행사명</Label>
                  <Input
                    placeholder="예: 2026학년도 초등 스포츠 데이 한마당 계획"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    className="h-8 text-xs bg-white font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">행사 유형</Label>
                  <Select value={formEventType} onValueChange={(v: PeEventType) => setFormEventType(v)}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sports_day">스포츠 데이 (운동회 / 체육대회)</SelectItem>
                      <SelectItem value="paps_week">PAPS 집중 측정주간</SelectItem>
                      <SelectItem value="tournament">교내 리그전 및 기타 대회</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">추진 담당 교사</Label>
                  <Input
                    value={formManager}
                    onChange={e => setFormManager(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">운영 시작일</Label>
                  <Input
                    type="date"
                    value={formStartDate}
                    onChange={e => setFormStartDate(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">운영 종료일</Label>
                  <Input
                    type="date"
                    value={formEndDate}
                    onChange={e => setFormEndDate(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">주요 진행 장소</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="예: 학교 대운동장 및 메인 체육관"
                      value={formLocation}
                      onChange={e => setFormLocation(e.target.value)}
                      className="h-8 text-xs bg-white flex-1"
                    />
                    <div className="hidden sm:flex items-center gap-1">
                      {['대운동장', '메인 체육관', '소체육관'].map(loc => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => setFormLocation(loc)}
                          className="px-2 py-1 text-[11px] font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700">대상 학년 선택 (전체 학년 지원)</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleToggleAllGrades}
                      className="h-6 text-[11px] text-indigo-600 px-2 hover:bg-indigo-50 font-bold"
                    >
                      전체선택/해제
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {availableGrades.map(g => {
                      const isSelected = formTargetGrades.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => handleToggleGrade(g)}
                          className={cn(
                            "px-3 py-1 text-xs font-bold rounded-lg border transition-all",
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                          )}
                        >
                          {g}학년
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">추진 목적 및 방침</Label>
                  <Textarea
                    placeholder="행사의 추진 목적, 운영 방침, 주요 기대 효과를 입력하세요."
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    rows={2}
                    className="text-xs bg-white resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 2. 학년별 요일/교시 시간대 배정표 (개편: 교시 범위 선택 & 학년 배정 중심) */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-indigo-600" />
                    2. 학년별 요일 / 교시 시간대 배정표 ({formSchedules.length}건 배정됨)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    교시별로 어떤 학년이 활동할지 배정하세요. 세부 경기 종목 및 시나리오는 각 학년 선생님이 제출할 세부계획서에 반영됩니다.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddNewDateSchedule}
                  className="h-7 text-xs font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50 bg-white shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  날짜 추가
                </Button>
              </div>

              {/* 날짜별 그룹 렌더링 */}
              <div className="space-y-3">
                {scheduleDates.map((dateStr) => {
                  const dateSchedules = formSchedules.filter(s => s.date === dateStr);

                  return (
                    <div key={dateStr} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      {/* 날짜 헤더 */}
                      <div className="bg-indigo-50/70 px-3.5 py-2 border-b border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-indigo-600" />
                          <span className="font-bold text-xs text-indigo-950">{dateStr}</span>
                          <Badge variant="secondary" className="text-[10px] font-semibold bg-white text-indigo-800">
                            {dateSchedules.length}개 교시 블록 배정
                          </Badge>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAddSchedule(dateStr)}
                          className="h-6 px-2 text-[11px] font-bold text-indigo-600 hover:bg-indigo-100 rounded-lg"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          이 날짜에 교시 배정 추가
                        </Button>
                      </div>

                      {/* 시간대 프로그램 목록 */}
                      <div className="p-3 space-y-3 divide-y divide-slate-100">
                        {dateSchedules.map((s, idx) => {
                          const currentStartP = s.startPeriod || periodSchedules[0]?.name || '1교시';
                          const currentEndP = s.endPeriod || s.startPeriod || periodSchedules[0]?.name || '1교시';

                          return (
                            <div key={s.id} className={cn("space-y-2.5 text-xs", idx > 0 && "pt-3")}>
                              {/* 1행: 교시 범위 선택 & 시간대 프리셋 & 삭제 버튼 */}
                              <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap bg-slate-50/80 p-2 rounded-lg border border-slate-200/60">
                                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                                  <Badge variant="outline" className="text-[10px] font-bold bg-white text-slate-700 shrink-0">
                                    #{idx + 1}
                                  </Badge>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[11px] font-bold text-slate-600">교시:</span>
                                    {/* 시작 교시 */}
                                    <Select
                                      value={currentStartP}
                                      onValueChange={(val) => handlePeriodRangeChange(s.id, val, currentEndP)}
                                    >
                                      <SelectTrigger className="h-7 w-[95px] text-xs font-bold bg-white border-slate-300">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {periodSchedules.map(p => (
                                          <SelectItem key={p.id} value={p.name} className="text-xs">
                                            {p.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    <span className="text-slate-400 font-bold">~</span>

                                    {/* 종료 교시 */}
                                    <Select
                                      value={currentEndP}
                                      onValueChange={(val) => handlePeriodRangeChange(s.id, currentStartP, val)}
                                    >
                                      <SelectTrigger className="h-7 w-[95px] text-xs font-bold bg-white border-slate-300">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {periodSchedules.map(p => (
                                          <SelectItem key={p.id} value={p.name} className="text-xs">
                                            {p.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* 계산된 시간대 표시 / 직접 수정 */}
                                  <div className="flex items-center gap-1 flex-1 min-w-[150px]">
                                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <Input
                                      value={s.time || ''}
                                      onChange={e => handleUpdateSchedule(s.id, 'time', e.target.value)}
                                      placeholder="08:30 ~ 11:00 (1~3교시)"
                                      className="h-7 text-xs font-mono font-bold bg-white border-slate-200"
                                      title="시간대를 직접 수정할 수도 있습니다."
                                    />
                                  </div>
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveSchedule(s.id)}
                                  className="h-7 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                                  title="배정 삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>

                              {/* 2행: 핵심 배정 대상 학년 & 진행 장소 */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2 sm:pl-3">
                                {/* 배정 대상 학년 (교시별 어떤 학년이 참여하는지 선택) */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                                      배정 대상 학년
                                    </span>
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {['1학년', '2학년', '3학년', '4학년', '5학년', '6학년'].map(gr => (
                                        <button
                                          key={gr}
                                          type="button"
                                          onClick={() => handleTargetGradeSelect(s.id, gr)}
                                          className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded font-bold transition-all",
                                            s.target === gr
                                              ? "bg-indigo-600 text-white"
                                              : "bg-slate-100 hover:bg-indigo-50 text-slate-700"
                                          )}
                                        >
                                          {gr}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <div className="flex items-center gap-1 shrink-0">
                                      {['전교생', '1~3학년', '4~6학년'].map(tg => (
                                        <button
                                          key={tg}
                                          type="button"
                                          onClick={() => handleTargetGradeSelect(s.id, tg)}
                                          className={cn(
                                            "text-[9px] px-1.5 py-0.5 rounded font-semibold transition-all",
                                            s.target === tg
                                              ? "bg-indigo-100 text-indigo-800 border border-indigo-300"
                                              : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                                          )}
                                        >
                                          {tg}
                                        </button>
                                      ))}
                                    </div>
                                    <Input
                                      placeholder="예: 1학년, 4~5학년"
                                      value={s.target || ''}
                                      onChange={e => handleUpdateSchedule(s.id, 'target', e.target.value)}
                                      className="h-7 text-xs bg-white font-bold flex-1"
                                    />
                                  </div>
                                </div>

                                {/* 진행 장소 */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                      진행 장소
                                    </span>
                                    <div className="flex items-center gap-1">
                                      {['대운동장', '메인 체육관', '소체육관', '강당'].map(loc => (
                                        <button
                                          key={loc}
                                          type="button"
                                          onClick={() => handleUpdateSchedule(s.id, 'location', loc)}
                                          className={cn(
                                            "text-[9px] px-1.5 py-0.5 rounded font-medium",
                                            s.location === loc
                                              ? "bg-slate-800 text-white"
                                              : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                          )}
                                        >
                                          {loc}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <Input
                                    placeholder="예: 대운동장"
                                    value={s.location || ''}
                                    onChange={e => handleUpdateSchedule(s.id, 'location', e.target.value)}
                                    className="h-7 text-xs bg-white"
                                  />
                                </div>
                              </div>

                              {/* 3행: 활동 개요 및 세부계획서 연동 메모 */}
                              <div className="pl-2 sm:pl-3 pt-0.5 flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">활동 개요:</span>
                                <Input
                                  placeholder="예: 1학년 스포츠 활동 (세부 운영 시나리오는 학년 계획서 참조)"
                                  value={s.title || ''}
                                  onChange={e => handleUpdateSchedule(s.id, 'title', e.target.value)}
                                  className="h-6 text-[11px] bg-slate-50/50 flex-1 border-dashed"
                                />
                                <span className="text-[10px] text-slate-400 hidden md:inline shrink-0">
                                  * 세부 경기 종목은 학년별 계획서에서 수합
                                </span>
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

            {/* 3. 소요 예산 편성 */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-600" />
                    3. 소요 예산 내역 (총 {calculatedTotalBudget.toLocaleString()} VND)
                  </h3>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddBudget}
                  className="h-7 text-xs font-bold text-amber-700 border-amber-200 hover:bg-amber-50 bg-white"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  예산 항목 추가
                </Button>
              </div>

              <div className="space-y-2">
                {formBudgets.map((b, idx) => (
                  <div key={b.id} className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center gap-2 flex-wrap sm:flex-nowrap text-xs">
                    <Badge variant="secondary" className="text-[10px] font-bold shrink-0">#{idx + 1}</Badge>
                    <Input
                      placeholder="구분 (예: 용품비)"
                      value={b.category}
                      onChange={e => handleUpdateBudget(b.id, 'category', e.target.value)}
                      className="h-7 text-xs w-[110px] shrink-0"
                    />
                    <Input
                      placeholder="산출 내역 / 품명"
                      value={b.item}
                      onChange={e => handleUpdateBudget(b.id, 'item', e.target.value)}
                      className="h-7 text-xs flex-1 min-w-[140px]"
                    />
                    <Input
                      type="number"
                      placeholder="금액(VND)"
                      value={b.amount || ''}
                      onChange={e => handleUpdateBudget(b.id, 'amount', parseInt(e.target.value) || 0)}
                      className="h-7 text-xs w-[130px] font-bold text-right shrink-0"
                    />
                    <Input
                      placeholder="비고"
                      value={b.note || ''}
                      onChange={e => handleUpdateBudget(b.id, 'note', e.target.value)}
                      className="h-7 text-xs w-[120px] shrink-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveBudget(b.id)}
                      className="h-6 px-1 text-rose-500 hover:text-rose-700 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 하단 고정 푸터 (계획 저장 완료 버튼 항상 고정) */}
          <DialogFooter className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50/95 backdrop-blur-xs shrink-0 flex items-center justify-between sticky bottom-0 z-20">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFormOpen(false)}
              className="text-xs"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveEvent}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
            >
              {editingEvent ? '수정사항 저장' : '계획 저장 완료'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          업무 요청 모달 (교사 실명 & 학년부 스마트 필터링 & 검색 선택창 탑재)
         ========================================================================= */}
      <Dialog open={isTaskRequestOpen} onOpenChange={setIsTaskRequestOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* 상단 고정 헤더 */}
          <DialogHeader className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-white shrink-0 sticky top-0 z-20 text-left">
            <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 pr-8">
              <Send className="w-5 h-5 text-indigo-600 shrink-0" />
              학년별 세부 운영계획 업무 요청
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              각 학년 담당 교사(학년부장/담임교사)를 지정하여 세부 타임테이블 시나리오 및 PPT 제출을 요청합니다.
            </DialogDescription>
          </DialogHeader>

          {targetEventForTask && (
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">제출 마감일 설정</Label>
                  <Input
                    type="date"
                    value={taskDeadline}
                    onChange={e => setTaskDeadline(e.target.value)}
                    className="h-8 text-xs bg-white font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">요청 지침 및 안내 사항</Label>
                  <Textarea
                    value={taskNotice}
                    onChange={e => setTaskNotice(e.target.value)}
                    rows={3}
                    className="text-xs bg-white resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* 학년별 담당자 지정 (학년 선택 시 소속 교사 명단이 인라인으로 쭉 펼쳐지고 체크 선택) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    업무 요청 대상 학년 및 담당 교사 지정 ({selectedGradesForTask.length}개 학년 선택됨)
                  </Label>
                  <span className="text-[11px] text-slate-500">
                    학년 체크 후 원하는 담당 선생님을 클릭해 주세요.
                  </span>
                </div>
                
                <div className="space-y-3">
                  {(targetEventForTask.targetGrades && targetEventForTask.targetGrades.length > 0 ? targetEventForTask.targetGrades : ['1', '2', '3', '4', '5', '6']).map(grade => {
                    const current = gradeAssignees[grade] || { email: '', name: '' };
                    const isChecked = selectedGradesForTask.includes(grade);

                    // 해당 학년 소속 교사 (부장, 담임, 교과 등) 필터링
                    const gradeTeachers = teacherList.filter(t => {
                      return (
                        t.grade === grade ||
                        (t.role && (
                          t.role.includes(`${grade}학년`) ||
                          t.role.startsWith(`${grade}-`) ||
                          t.role.includes(`(${grade}-`) ||
                          t.role.includes(` ${grade}-`)
                        )) ||
                        (t.dept && (
                          t.dept.includes(`${grade}학년`) ||
                          t.dept.startsWith(`${grade}-`)
                        ))
                      );
                    });

                    // 타 학년/부서 교직원
                    const otherTeachers = teacherList.filter(t => !gradeTeachers.some(gt => gt.email.toLowerCase() === t.email.toLowerCase()));

                    return (
                      <div
                        key={grade}
                        className={cn(
                          "rounded-2xl border transition-all overflow-hidden",
                          isChecked
                            ? "bg-white border-indigo-200 shadow-xs"
                            : "bg-slate-50/70 border-slate-200 opacity-70"
                        )}
                      >
                        {/* 학년 카드 헤더 (체크박스 및 현재 선택된 담당자 요약) */}
                        <div
                          className={cn(
                            "p-3 flex items-center justify-between gap-3 cursor-pointer select-none",
                            isChecked ? "bg-indigo-50/40 border-b border-indigo-100" : "bg-transparent"
                          )}
                          onClick={() => {
                            setSelectedGradesForTask(prev =>
                              isChecked ? prev.filter(g => g !== grade) : [...prev, grade]
                            );
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                setSelectedGradesForTask(prev =>
                                  checked ? [...prev, grade] : prev.filter(g => g !== grade)
                                );
                              }}
                              onClick={e => e.stopPropagation()}
                            />
                            <Badge className={cn(
                              "font-bold text-xs px-2.5 py-0.5",
                              isChecked ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                            )}>
                              {grade}학년
                            </Badge>
                            <span className="text-xs font-bold text-slate-900">
                              {grade}학년 세부 운영계획서 제출 요청
                            </span>
                          </div>

                          {isChecked && current.name && (
                            <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>지정 교사: {current.name}</span>
                              <span className="text-[10px] text-slate-400 font-normal">({current.email})</span>
                            </div>
                          )}
                        </div>

                        {/* 학년 체크 시 인라인으로 펼쳐지는 교사 명단 그리드 (체크/라디오 선택) */}
                        {isChecked && (
                          <div className="p-3.5 space-y-2.5 bg-white">
                            <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                              <span>★ {grade}학년부 소속 선생님 ({gradeTeachers.length}명) - 담당자로 지정할 교사를 체크하세요:</span>
                            </div>

                            {gradeTeachers.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {gradeTeachers.map(teacher => {
                                  const isSelected = current.email.toLowerCase() === teacher.email.toLowerCase();
                                  return (
                                    <button
                                      key={teacher.email}
                                      type="button"
                                      onClick={() => {
                                        setGradeAssignees(prev => ({
                                          ...prev,
                                          [grade]: {
                                            email: teacher.email,
                                            name: teacher.name
                                          }
                                        }));
                                      }}
                                      className={cn(
                                        "p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer",
                                        isSelected
                                          ? "bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs text-indigo-950"
                                          : "bg-slate-50/60 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30 text-slate-700"
                                      )}
                                    >
                                      {/* 체크/라디오 아이콘 */}
                                      <div className={cn(
                                        "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                                        isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"
                                      )}>
                                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                      </div>

                                      {/* 교사 이름 & 직책 */}
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-black text-xs">{teacher.name}</span>
                                          <Badge className={cn(
                                            "text-[9px] px-1.5 py-0 h-4 font-bold border-0",
                                            isSelected ? "bg-indigo-600 text-white" : "bg-slate-200/80 text-slate-700"
                                          )}>
                                            {teacher.role}
                                          </Badge>
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                                          {teacher.email}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="py-2 text-center text-xs text-slate-400">
                                등록된 {grade}학년부 교사가 없습니다.
                              </div>
                            )}

                            {/* 타 학년/부서 교사 선택이 필요한 경우 인라인 셀렉트 */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                              <span className="text-[11px] text-slate-500 font-medium">
                                목록 외 다른 교사를 지정하시겠습니까?
                              </span>
                              <Select
                                value={current.email}
                                onValueChange={(val) => {
                                  const found = teacherList.find(t => t.email.toLowerCase() === val.toLowerCase());
                                  if (found) {
                                    setGradeAssignees(prev => ({
                                      ...prev,
                                      [grade]: {
                                        email: found.email,
                                        name: found.name
                                      }
                                    }));
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs bg-slate-50 w-[240px]">
                                  <SelectValue placeholder="전체 교직원 목록에서 직접 선택..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-56">
                                  {teacherList.map(t => (
                                    <SelectItem key={t.email} value={t.email} className="text-xs">
                                      {t.name} ({t.role} - {t.email})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 하단 고정 푸터 (취소 및 업무 요청 발송 버튼 상시 고정) */}
          <DialogFooter className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50/95 backdrop-blur-xs shrink-0 flex items-center justify-between sticky bottom-0 z-20">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTaskRequestOpen(false)}
              disabled={isRequestingTask}
              className="text-xs"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSendGradeTaskRequest}
              disabled={isRequestingTask || selectedGradesForTask.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>업무 요청 발송 ({selectedGradesForTask.length}개 학년)</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          3. 학년별 제출 현황 및 세부 시나리오/PPT/캔바 열람 및 정리 모달
         ========================================================================= */}
      <Dialog open={isSubmissionsViewOpen} onOpenChange={setIsSubmissionsViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white shadow-2xl">
          <DialogHeader className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-white shrink-0 sticky top-0 z-20 text-left">
            <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 pr-8">
              <Layers className="w-5 h-5 text-indigo-600 shrink-0" />
              학년별 세부계획 제출 현황 및 취합 내역
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              지정된 학년 담당 교사들이 제출한 타임테이블 시나리오와 자료를 확인하고 정리합니다.
            </DialogDescription>
          </DialogHeader>

          {targetEventForView && (() => {
            const { task, submissions, submittedCount, totalCount, percent, requestedGrades } = getEventTaskSubmissions(targetEventForView);
            if (!task) return <div className="py-6 text-center text-xs text-slate-400">연결된 업무가 없습니다.</div>;

            return (
              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">전체 제출 진행률: {submittedCount}/{totalCount}개 학년 제출 완료</span>
                    <span className="text-indigo-600 font-extrabold">{percent}%</span>
                  </div>
                  <Progress value={percent} className="h-2 bg-slate-200" />
                </div>

                <div className="space-y-3">
                  {requestedGrades.map(grade => {
                    const gradeKey = Object.keys(submissions).find(k => {
                      const s = submissions[k];
                      return String(s.grade) === String(grade) || k.endsWith(`_${grade}`);
                    });
                    const sub = gradeKey ? submissions[gradeKey] : Object.values(submissions).find(s => String(s.grade) === String(grade));

                    return (
                      <div key={grade} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-indigo-600 text-white font-bold text-xs">
                              {grade}학년
                            </Badge>
                            {sub ? (
                              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                제출 완료 (작성: {sub.submitterName || '담당교사'})
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                미제출 (대기 중)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {sub?.fileUrl && (
                              <a
                                href={sub.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 h-6 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors"
                              >
                                <Download className="w-3 h-3 text-indigo-600" />
                                <span>{sub.fileName || '문서 다운'}</span>
                              </a>
                            )}
                            {sub?.linkUrl && (
                              <a
                                href={sub.linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 h-6 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-colors"
                              >
                                <ExternalLink className="w-3 h-3 text-purple-600" />
                                <span>{sub.linkTitle || '캔바 자료'}</span>
                              </a>
                            )}
                            {sub && gradeKey && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSubmissionItem(task.id, gradeKey)}
                                className="h-6 px-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="제출 내역 삭제"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {sub ? (
                          <div className="space-y-2 text-xs">
                            {sub.scenarios && sub.scenarios.length > 0 ? (
                              <div className="border border-slate-100 rounded-lg overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                                    <tr>
                                      <th className="p-1.5 text-center w-24">시간</th>
                                      <th className="p-1.5 text-left">프로그램명</th>
                                      <th className="p-1.5 text-left">경기 규칙</th>
                                      <th className="p-1.5 text-left">준비물/역할</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {sub.scenarios.map((sc, i) => (
                                      <tr key={sc.id || i} className="hover:bg-slate-50/50">
                                        <td className="p-1.5 text-center font-bold text-indigo-700">{sc.time}</td>
                                        <td className="p-1.5 font-bold text-slate-900">{sc.program}</td>
                                        <td className="p-1.5 text-slate-600">{sc.rules || '-'}</td>
                                        <td className="p-1.5 text-slate-600">{sc.preparations || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-slate-400 italic text-[11px]">작성된 시나리오가 없습니다.</p>
                            )}
                            {sub.note && (
                              <p className="text-slate-600 bg-slate-50 p-2 rounded-lg text-[11px]">
                                <strong className="text-slate-800">특이사항:</strong> {sub.note}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="py-2 text-center text-slate-400 text-[11px]">
                            해당 학년의 세부 운영 계획이 아직 제출되지 않았습니다.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* 하단 고정 푸터 */}
          <DialogFooter className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50/95 backdrop-blur-xs shrink-0 flex items-center justify-end sticky bottom-0 z-20">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSubmissionsViewOpen(false)}
              className="text-xs"
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          4. 부장 건의 모달
         ========================================================================= */}
      <Dialog open={isSuggestModalOpen} onOpenChange={setIsSuggestModalOpen}>
        <DialogContent className="max-w-xl p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-600" />
              부장 건의 (주간/월간 학사일정 공식 반영 요청)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              결재가 완료된 체육 행사를 교무부장/학년부장에게 건의하여 학교 주간학습안내 및 월간 일정에 공식 등록합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">건의 제목</Label>
              <Input
                value={suggestTitle}
                onChange={e => setSuggestTitle(e.target.value)}
                className="h-8 text-xs bg-white font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">건의 내용 및 전달 사항</Label>
              <Textarea
                value={suggestContent}
                onChange={e => setSuggestContent(e.target.value)}
                rows={6}
                className="text-xs bg-white font-mono leading-relaxed resize-none"
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSuggestModalOpen(false)}
              disabled={isSubmittingSuggest}
              className="text-xs"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSendSuggestion}
              disabled={isSubmittingSuggest || !suggestTitle.trim()}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>건의안 전송</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


