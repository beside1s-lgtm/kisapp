'use client';

import { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, BookOpen, Users, ClipboardCheck, UserCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/hooks/use-translation';
import { MainLayout } from '@/components/layout/main-layout';
import { cn } from '@/lib/utils';

// 이식한 컴포넌트 임포트
import { CourseManagement } from '@/components/afterschool/teacher/CourseManagement';
import { StudentManagement } from '@/components/afterschool/teacher/StudentManagement';
import { AttendanceManagement } from '@/components/afterschool/teacher/AttendanceManagement';

// 이식한 초기 데이터 및 타입 임포트
import {
  initialCourses,
  initialStudents,
  initialEnrollments,
  initialAttendance,
  initialTimerConfig,
  initialPeriods,
} from '@/lib/afterschool/mock/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Classroom, SubmittedApprovalDoc, SessionPeriod } from '@/lib/afterschool/types';
import {
  onAfterschoolCoursesUpdate,
  getAfterschoolCoursesDirectly,
  onAfterschoolEnrollmentsUpdate,
  onAttendanceRecordsUpdate,
  saveAttendanceRecordsBatch,
  onAfterschoolClassroomsUpdate,
  onAfterschoolApprovalDocsUpdate,
  getTeacherApplySettings,
  saveTeacherApplySettings,
  onTeacherApplySettingsUpdate,
  getOrgStructure,
} from '@/lib/services/settingsService';
import { onMasterStudentsUpdate } from '@/lib/services/masterStudentService';
import type { MasterStudent } from '@/lib/types/masterStudent';
import { getUsersDirectory } from '@/lib/services/userService';
import type { UserProfile } from '@/lib/types';
import { onStudentsUpdate } from '@/lib/kisbus/students';
import { onRoutesUpdate } from '@/lib/kisbus/routes';
import { onBusesUpdate } from '@/lib/kisbus/buses';

// 기본 교실 목록
const initialClassrooms: Classroom[] = [
  { id: 'rm_1_1', name: '1-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_1_2', name: '1-2반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_1_3', name: '1-3반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_1_4', name: '1-4반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_2_1', name: '2-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_2_2', name: '2-2반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_2_3', name: '2-3반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_2_4', name: '2-4반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_3_1', name: '3-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_3_2', name: '3-2반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_3_3', name: '3-3반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_3_4', name: '3-4반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_4_1', name: '4-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_4_2', name: '4-2반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_4_3', name: '4-3반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_4_4', name: '4-4반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_5_1', name: '5-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_5_2', name: '5-2반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_5_3', name: '5-3반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_5_4', name: '5-4반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_6_1', name: '6-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_6_2', name: '6-2반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_6_3', name: '6-3반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_6_4', name: '6-4반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_music', name: '음악실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_art', name: '미술실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_gym', name: '체육관', capacity: 100, maxSimultaneousCourses: 2 },
  { id: 'rm_com', name: '컴퓨터실', capacity: 35, maxSimultaneousCourses: 1 },
  { id: 'rm_av', name: '시청각실', capacity: 80, maxSimultaneousCourses: 1 },
  { id: 'rm_lib', name: '도서관', capacity: 50, maxSimultaneousCourses: 1 },
  { id: 'rm_dance', name: '무용실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_sci', name: '과학실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm_eng', name: '영어전용실', capacity: 30, maxSimultaneousCourses: 1 },
];

function AfterschoolConsole() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryCourseId = searchParams.get('courseId');
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [isAfterschoolManager, setIsAfterschoolManager] = useState(false);

  // 관리자 권한 확인 (시스템 관리자, 학교 리더십, 또는 조직도에 등록된 방과후학교 담당자)
  const isAdmin = Boolean(
    profile?.isAdmin === true ||
    profile?.role === 'admin' ||
    profile?.role === '관리자' ||
    profile?.role === '부장' ||
    profile?.role === '교감' ||
    profile?.role === '교장' ||
    isAfterschoolManager ||
    user?.email?.toLowerCase() === 'beside1s@kshcm.net'
  );

  const [activeTab, setActiveTab] = useState<string>('course');

  // Shared States
  const [courses, setCourses] = useState<import('@/lib/afterschool/types').Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState<boolean>(true);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [buses, setBuses] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<import('@/lib/afterschool/types').Enrollment[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<import('@/lib/afterschool/types').AttendanceRecord[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  
  // 차시별 수강료 고정 금액 설정
  const [tuitionPerSession] = useState<number>(15000);
  const [periods, setPeriods] = useState<SessionPeriod[]>([]);
  const [schoolTeachers, setSchoolTeachers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!user) return;
    const loadTeachers = async () => {
      try {
        const users = await getUsersDirectory();
        const teachers = users.filter(
          (u) =>
            u.role === 'teacher' ||
            u.role === '교사' ||
            u.role === '부장' ||
            u.role === 'admin' ||
            u.role === '관리자' ||
            (u.dept && !u.studentName && u.role !== '학부모')
        );
        setSchoolTeachers(teachers);
      } catch (err) {
        console.warn("[AfterschoolConsole] Failed to load teachers:", err);
      }
    };
    loadTeachers();
  }, [user?.email]);

  // Firestore DB 실시간 연동 (강좌, 수강신청, 출석, 스쿨버스 노선/학생/버스)
  // isSavingRef: 출석 저장 중에는 snapshot으로 인한 로컬 state 덮어쓰기 차단
  const isSavingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // 안전 타임아웃: Firestore 연결 지연 또는 스냅샷 지연 시에도 최대 1200ms 후 무조건 로딩 해제 (무한 로딩 원천 차단)
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsLoadingCourses(false);
      }
    }, 1200);

    // 1회 직접 페치 병행 (캐시/서버로부터 snapshot보다 빠르게 1차 수신)
    getAfterschoolCoursesDirectly().then(list => {
      if (isMounted && list && list.length > 0) {
        setCourses(list);
        setIsLoadingCourses(false);
        clearTimeout(safetyTimer);
      }
    }).catch(err => console.warn('[AfterschoolConsole] getAfterschoolCoursesDirectly error:', err));

    const unsubCourses = onAfterschoolCoursesUpdate((data) => {
      if (!isMounted) return;
      if (data && data.length > 0) {
        setCourses(data);
      } else {
        setCourses(prev => (prev && prev.length > 0 ? prev : (initialCourses || [])));
      }
      setIsLoadingCourses(false);
      clearTimeout(safetyTimer);
    }, (err) => {
      if (!isMounted) return;
      console.warn('[AfterschoolConsole] courses update error:', err);
      setIsLoadingCourses(false);
      clearTimeout(safetyTimer);
    });
    const unsubEnrollments = onAfterschoolEnrollmentsUpdate((data) => {
      if (data && data.length > 0) setEnrollments(data);
    });
    const unsubAttendance = onAttendanceRecordsUpdate((data) => {
      // 저장 중(isSavingRef.current === true)에는 snapshot이 와도 로컬 state를 덮어쓰지 않음.
      // 저장이 완료된 뒤 Firestore에서 오는 최신 데이터만 반영하여 체크 풀림 방지.
      if (!isSavingRef.current && data && data.length > 0) {
        setAttendanceRecords(data);
      }
    });
    const unsubClassrooms = onAfterschoolClassroomsUpdate((data) => {
      if (data && data.length > 0) setClassrooms(data);
    });
    const unsubApprovalDocs = onAfterschoolApprovalDocsUpdate((data) => {
      setApprovalDocs(data);
    });
    const unsubStudents = onStudentsUpdate((list) => {
      if (list && list.length > 0) setStudentsList(list);
    });
    const unsubRoutes = onRoutesUpdate((list) => {
      if (list) setRoutes(list);
    });
    const unsubBuses = onBusesUpdate((list) => {
      if (list) setBuses(list);
    });
    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsubCourses();
      unsubEnrollments();
      unsubAttendance();
      unsubClassrooms();
      unsubApprovalDocs();
      unsubStudents();
      unsubRoutes();
      unsubBuses();
    };
  }, []);

  // 출석 변경 시 Firestore 저장 핸들러
  // isSavingRef.current = true 동안은 snapshot 리스너가 로컬 state를 덮어쓰지 않음
  // saveDebounceRef: 연속 체크 시 300ms 디바운스로 마지막 상태만 저장 (write stream exhausted 방지)
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{
    next: import('@/lib/afterschool/types').AttendanceRecord[];
    base: import('@/lib/afterschool/types').AttendanceRecord[];
  } | null>(null);

  const handleSaveAttendance = (
    nextRecords: import('@/lib/afterschool/types').AttendanceRecord[],
    prevRecords: import('@/lib/afterschool/types').AttendanceRecord[]
  ) => {
    // 이전에 예약된 저장이 있으면 취소하고 base(최초 prev)를 유지하여 diff 누락 방지
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    pendingSaveRef.current = {
      next: nextRecords,
      base: pendingSaveRef.current?.base ?? prevRecords, // 최초 prev 기준 유지
    };

    saveDebounceRef.current = setTimeout(async () => {
      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (!pending) return;

      const { next, base } = pending;
      const toUpsert = next.filter(r => {
        const orig = base.find(p => p.id === r.id);
        return !orig || JSON.stringify(orig) !== JSON.stringify(r);
      });
      const toDeleteIds = base
        .filter(p => !next.some(r => r.id === p.id))
        .map(p => p.id);

      if (toUpsert.length > 0 || toDeleteIds.length > 0) {
        isSavingRef.current = true;
        try {
          await saveAttendanceRecordsBatch(toUpsert, toDeleteIds);
        } catch (err) {
          console.error('[Attendance] Firestore 저장 오류:', err);
        } finally {
          // 저장 완료 후 500ms 뒤 잠금 해제 — Firestore snapshot echo가 먼저 오더라도 무시하고
          // 그 이후의 snapshot(외부 변경)은 정상 반영
          setTimeout(() => { isSavingRef.current = false; }, 500);
        }
      }
    }, 300); // 300ms 내 연속 체크는 묶어서 한 번만 저장
  };

  // Selected course for Student Management
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  // Submitted approval docs
  const [approvalDocs, setApprovalDocs] = useState<SubmittedApprovalDoc[]>([]);

  // 서브탭 뷰 관리 (출석부 / 강사출근부 / 증빙 문서 관리 / 강좌 카드)
  const [activeSubTab, setActiveSubTab] = useState<'studentSheet' | 'teacherAttendance' | 'batchApproval' | 'course'>('studentSheet');

  // 진행 상태 & 마스터 학생 데이터 연동
  const [stageStatus, setStageStatus] = useState<string>('RECRUITING');
  const [masterStudents, setMasterStudents] = useState<MasterStudent[]>([]);

  useEffect(() => {
    getTeacherApplySettings().then(s => {
      if (s?.afterschoolStageStatus) setStageStatus(s.afterschoolStageStatus);
    });
    getOrgStructure().then(orgData => {
      const emailLower = (profile?.email || user?.email || '').toLowerCase();
      const afterschoolManagers = orgData?.afterschoolManagers || (orgData?.afterschoolManager ? [orgData.afterschoolManager] : []);
      if (afterschoolManagers.some((m: string) => m.toLowerCase() === emailLower)) {
        setIsAfterschoolManager(true);
      }
    }).catch(err => console.warn('[AfterschoolConsole] Failed to load orgStructure:', err));

    const unsubStage = onTeacherApplySettingsUpdate(s => {
      if (s?.afterschoolStageStatus) setStageStatus(s.afterschoolStageStatus);
    });
    const unsubMaster = onMasterStudentsUpdate(data => {
      setMasterStudents(data);
    });
    return () => {
      unsubStage();
      unsubMaster();
    };
  }, [profile?.email, user?.email]);

  const handleToggleStageStatus = async () => {
    const nextStatus = stageStatus === 'OPERATING' ? 'CLOSED' : stageStatus === 'CLOSED' ? 'RECRUITING' : 'OPERATING';
    const nextLabel = nextStatus === 'OPERATING' ? '운영중' : nextStatus === 'CLOSED' ? '종료' : '대기중';
    if (window.confirm(`방과후학교 진행 상태를 [${nextLabel}] (으)로 변경하시겠습니까?`)) {
      await saveTeacherApplySettings({ afterschoolStageStatus: nextStatus });
      setStageStatus(nextStatus);
    }
  };

  const userSelectedCourseIdRef = useRef<string | null>(null);

  const handleSelectCourse = (courseId: string) => {
    userSelectedCourseIdRef.current = courseId;
    setSelectedCourseId(courseId);
    setActiveSubTab('studentSheet');
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('courseId', courseId);
      router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    } catch {
      // browser environment fallback
    }
  };

  const handleSelectCourseForStudent = (courseId: string) => {
    handleSelectCourse(courseId);
  };

  const myName = (profile?.name || user?.displayName || '').trim();
  const myUid = user?.uid || '';

  // 로그인한 교사의 본인 담당 강좌 (주강사, 보조강사, 추가강사 1~4)
  const myOwnCourses = useMemo(() => {
    if (!myName && !myUid) return [];
    return courses.filter(c => {
      if (c.teacherId && c.teacherId === myUid) return true;
      if (c.teacherName && c.teacherName.trim() === myName) return true;
      const instructors = [
        c.instructorName,
        c.instructor2,
        c.instructor3,
        c.instructor4,
        c.instructor5,
        c.instructor6,
        ...(c.assistantTeachers || [])
      ].filter(Boolean).map(s => String(s).trim());
      return instructors.includes(myName);
    });
  }, [courses, myName, myUid]);

  const teacherCourses = useMemo(() => {
    // 1. 관리자 권한이 있는 경우 (시스템 관리자, 학교 리더십, 방과후 담당자):
    //    전체 강좌 출석부를 열람하고 대리 출석체크할 수 있으며, 본인 담당 강좌가 있다면 최상단에 먼저 배치
    if (isAdmin) {
      const otherCourses = courses.filter(c => !myOwnCourses.some(mc => mc.id === c.id));
      const sortedOthers = [...otherCourses].sort((a, b) => {
        const instA = a.instructorName || '';
        const instB = b.instructorName || '';
        if (instA !== instB) return instA.localeCompare(instB);
        return a.title.localeCompare(b.title);
      });
      return [...myOwnCourses, ...sortedOthers];
    }

    // 2. 순수 외부 강사(직책: '강사', 관리자 권한 없음):
    //    오직 본인의 담당 강좌만 노출 (타 강좌 및 관리자/전체 fallback 완전 차단)
    const isInstructor = profile?.role === '강사';
    if (isInstructor) {
      return myOwnCourses;
    }

    // 3. 일반 교사: 본인 강좌가 있으면 본인 강좌, 없으면 전체 강좌
    if (myOwnCourses.length > 0) return myOwnCourses;
    return courses;
  }, [courses, myOwnCourses, isAdmin, profile?.role]);

  const myCourses = teacherCourses;

  // 교사 본인/관리 대상 강좌 ID 목록
  const myCourseIds = useMemo(() => myCourses.map(c => c.id), [myCourses]);

  // 해당 강좌의 수강신청 정보들 필터링
  const myEnrollments = useMemo(() => {
    return enrollments.filter(e => myCourseIds.includes(e.courseId));
  }, [enrollments, myCourseIds]);

  // 해당 강좌의 출석체크 정보들 필터링
  const myAttendanceRecords = useMemo(() => {
    return attendanceRecords.filter(a => myCourseIds.includes(a.courseId));
  }, [attendanceRecords, myCourseIds]);

  const hasAutoSelectedCourseRef = useRef(false);

  useEffect(() => {
    // 0. 사용자가 수동으로 특정 강좌를 직접 선택한 경우, 자동 선택 로직으로 덮어쓰지 않음
    if (userSelectedCourseIdRef.current) {
      if (selectedCourseId !== userSelectedCourseIdRef.current) {
        setSelectedCourseId(userSelectedCourseIdRef.current);
      }
      return;
    }

    // 1순위: URL 파라미터(queryCourseId)로 지정된 강좌가 목록에 존재하는 경우
    if (queryCourseId && myCourses.some(c => c.id === queryCourseId)) {
      setSelectedCourseId(queryCourseId);
      setActiveSubTab('studentSheet');
      hasAutoSelectedCourseRef.current = true;
      return;
    }

    // 이미 한 번 자동 선택을 완료했고 현재 선택된 강좌가 내 강좌 목록에 유효하게 존재한다면 유지
    if (hasAutoSelectedCourseRef.current && selectedCourseId && myCourses.some(c => c.id === selectedCourseId)) {
      return;
    }

    // 초기 1회 자동 선택:
    // 2순위: 로그인한 교사의 본인 담당 강좌가 있다면 그 강좌를 기본으로 선택!
    if (myOwnCourses.length > 0) {
      setSelectedCourseId(myOwnCourses[0].id);
      setActiveSubTab('studentSheet');
      hasAutoSelectedCourseRef.current = true;
      return;
    }

    // 3순위: 본인 담당 강좌가 없는 경우 전체 강좌 중 첫 번째 선택
    if (myCourses.length > 0) {
      setSelectedCourseId(myCourses[0].id);
      setActiveSubTab('studentSheet');
      hasAutoSelectedCourseRef.current = true;
    }
  }, [myCourses, myOwnCourses, queryCourseId, selectedCourseId]);

  // 진행 상태 뱃지 컴포넌트 (모바일에서는 완전히 숨기고 큰 디스플레이에서만 노출)
  const renderStageStatusBadge = (extraCls?: string) => (
    <button
      type="button"
      onClick={handleToggleStageStatus}
      className={cn(
        "hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-bold border items-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0 whitespace-nowrap",
        stageStatus === 'OPERATING'
          ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
          : stageStatus === 'CLOSED'
          ? "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
          : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100",
        extraCls
      )}
      title="클릭 시 방과후학교 진행 상태 변경"
    >
      <span className={cn(
        "w-1.5 h-1.5 rounded-full shrink-0",
        stageStatus === 'OPERATING' ? "bg-emerald-500 animate-pulse" : stageStatus === 'CLOSED' ? "bg-rose-500" : "bg-amber-500"
      )} />
      <span>
        {stageStatus === 'OPERATING' ? t('teacher_afterschool.status_operating', '운영중') : stageStatus === 'CLOSED' ? t('teacher_afterschool.status_closed', '종료') : t('teacher_afterschool.status_waiting', '대기중')}
      </span>
    </button>
  );

  // 현재 선택된 강좌 라벨
  const selectedCourse = myCourses.find(c => c.id === selectedCourseId);
  const isSelectedMine = myOwnCourses.some(mc => mc.id === selectedCourseId);
  const selectedCourseFullTitle = selectedCourse
    ? (isAdmin 
        ? (isSelectedMine ? `[내 수업] ${selectedCourse.title}` : (selectedCourse.instructorName ? `[${selectedCourse.instructorName}] ${selectedCourse.title}` : selectedCourse.title))
        : selectedCourse.title)
    : (t('teacher_afterschool.select_course', '강좌 선택'));
  // 모바일 표시용 고정 글자수 (최대 12자 + 말줄임)
  const selectedCourseMobileText = selectedCourseFullTitle.length > 12
    ? selectedCourseFullTitle.slice(0, 12) + '…'
    : selectedCourseFullTitle;

  // 데스크톱 전용 강좌 선택 셀렉트
  const renderCourseSelect = (triggerClassName?: string) => {
    if (isLoadingCourses) {
      return (
        <div className={cn("h-7.5 bg-slate-100 border border-slate-200 rounded-lg flex items-center px-2.5 gap-1.5 text-xs text-slate-400 animate-pulse", triggerClassName)}>
          <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
          <span>{t('common.loading', '강좌 로딩 중…')}</span>
        </div>
      );
    }
    if (myCourses.length === 0) return null;
    return (
      <Select
        value={selectedCourseId}
        onValueChange={(val) => {
          handleSelectCourse(val);
        }}
      >
        <SelectTrigger className={cn("h-7.5 text-xs bg-white border-slate-300 font-bold px-2 rounded-lg shadow-2xs text-slate-800 flex items-center justify-between gap-1 overflow-hidden [&>svg]:shrink-0", triggerClassName)}>
          <span className="truncate text-left min-w-0 flex-1">
            {selectedCourseFullTitle}
          </span>
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {myCourses.map(c => {
            const isMine = myOwnCourses.some(mc => mc.id === c.id);
            return (
              <SelectItem
                key={c.id}
                value={c.id}
                className={cn("text-xs font-semibold cursor-pointer", isMine && "font-bold text-teal-800 bg-teal-50/50")}
              >
                {isAdmin && (isMine ? `[내 수업] ` : (c.instructorName ? `[${c.instructorName}] ` : ''))}{c.title}
              </SelectItem>
            );
          })}
          <div
            className="px-2 py-1.5 border-t border-slate-100 text-[11px] font-extrabold text-indigo-600 hover:bg-indigo-50 cursor-pointer flex items-center gap-1 rounded-sm mt-1"
            onClick={() => setActiveSubTab('course')}
          >
            <BookOpen className="w-3 h-3 shrink-0 text-indigo-600" />
            <span>{t('teacher_afterschool.course_detail_card', '강좌 상세/수업계획 카드')}</span>
          </div>
        </SelectContent>
      </Select>
    );
  };

  // 모바일 전용 강좌 선택 셀렉트 (언어 선택 버튼 직전까지 100% 꽉 차게 확장 및 CSS 말줄임)
  const renderCourseSelectMobile = () => {
    if (isLoadingCourses) {
      return (
        <div className="h-8 bg-slate-100 border border-slate-200 rounded-lg flex items-center px-2.5 gap-1.5 text-xs text-slate-400 w-full animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />
          <span className="truncate">{t('common.loading', '강좌 로딩 중…')}</span>
        </div>
      );
    }
    if (myCourses.length === 0) return null;
    return (
      <Select
        value={selectedCourseId}
        onValueChange={(val) => {
          handleSelectCourse(val);
        }}
      >
        <SelectTrigger className="h-8 text-xs bg-white border-slate-300 font-bold px-2 w-full min-w-0 max-w-full rounded-lg shadow-2xs text-slate-800 flex items-center justify-between gap-1 overflow-hidden [&>svg]:shrink-0">
          <span className="truncate text-left min-w-0 flex-1">
            {selectedCourseFullTitle}
          </span>
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {myCourses.map(c => {
            const isMine = myOwnCourses.some(mc => mc.id === c.id);
            return (
              <SelectItem
                key={c.id}
                value={c.id}
                className={cn("text-xs font-semibold cursor-pointer", isMine && "font-bold text-teal-800 bg-teal-50/50")}
              >
                {isAdmin && (isMine ? `[내 수업] ` : (c.instructorName ? `[${c.instructorName}] ` : ''))}{c.title}
              </SelectItem>
            );
          })}
          <div
            className="px-2 py-1.5 border-t border-slate-100 text-[11px] font-extrabold text-indigo-600 hover:bg-indigo-50 cursor-pointer flex items-center gap-1 rounded-sm mt-1"
            onClick={() => setActiveSubTab('course')}
          >
            <BookOpen className="w-3 h-3 shrink-0 text-indigo-600" />
            <span>{t('teacher_afterschool.course_detail_card', '강좌 상세/수업계획 카드')}</span>
          </div>
        </SelectContent>
      </Select>
    );
  };

  return (
    <MainLayout
      title={
        <div className="hidden sm:flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-nowrap">
          {/* 관리자 대리 출석 모드 표시 및 관리자 홈 버튼 */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 shrink-0 mr-1">
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-2xs whitespace-nowrap">
                <UserCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>{t('teacher_afterschool.admin_proxy_mode', '관리자 대리 출석체크 모드')}</span>
              </span>
              <button
                type="button"
                onClick={() => router.push('/admin/afterschool')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-300 flex items-center gap-1 transition cursor-pointer shadow-2xs whitespace-nowrap"
                title="관리자 페이지로 돌아가기"
              >
                <ArrowLeft className="w-3 h-3 shrink-0" />
                <span>{t('teacher_afterschool.admin_home', '관리자 홈')}</span>
              </button>
            </div>
          )}

          {/* 데스크톱 1. 강의 선택 드롭다운 버튼 */}
          {renderCourseSelect("min-w-[120px] max-w-[240px] shrink-0")}

          {/* 데스크톱 2. 선생님 페이지 타이틀 */}
          <span className="text-sm sm:text-base font-bold font-headline text-slate-800 shrink-0 whitespace-nowrap">
            {t('page.title.teacher') || '선생님 페이지'}
          </span>

          {/* 데스크톱 3. 기능 선택 드롭다운 */}
          <div className="flex shrink-0">
            <Select value={activeSubTab} onValueChange={(val: any) => setActiveSubTab(val)}>
              <SelectTrigger className="h-7 text-xs bg-indigo-50 text-indigo-900 border-indigo-300 font-extrabold px-2.5 min-w-[100px] max-w-[140px] shrink-0 rounded-lg shadow-2xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="studentSheet" className="text-xs font-bold">
                  {t('teacher_afterschool.tab_attendance', '출석부')}
                </SelectItem>
                <SelectItem value="teacherAttendance" className="text-xs font-bold">
                  {t('teacher_afterschool.tab_teacher_work', '강사출근부')}
                </SelectItem>
                <SelectItem value="batchApproval" className="text-xs font-bold">
                  {t('teacher_afterschool.tab_docs', '증빙 문서 관리')}
                </SelectItem>
                <SelectItem value="course" className="text-xs font-bold text-indigo-700">
                  {t('teacher_afterschool.tab_courses', '강좌 관리 & 수업계획')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      }
      mobileHeaderRow1={
        /* 모바일 1행: [<-] [Home] [[김경훈] 3D 크리에이터 되기 ▾] | [🇰🇷 ▾] [로그아웃] (언어선택기 옆까지 100% 꽉 참) */
        <div className="w-full min-w-0 flex-1 flex items-center overflow-hidden">
          {renderCourseSelectMobile()}
        </div>
      }
      mobileSubHeader={
        /* 모바일 2행: [대리출석] [<- 관리자] (방과후 관리자에게만 노출, 일반 교사는 노출 안 됨) */
        isAdmin ? (
          <div className="flex items-center gap-1.5 w-full min-w-0">
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-2xs whitespace-nowrap shrink-0">
              <UserCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>{t('teacher_afterschool.admin_proxy_mode_short', '대리출석')}</span>
            </span>
            <button
              type="button"
              onClick={() => router.push('/admin/afterschool')}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-300 flex items-center gap-1 transition cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
              title="관리자 페이지로 돌아가기"
            >
              <ArrowLeft className="w-3 h-3 shrink-0" />
              <span>{t('teacher_afterschool.admin_home_short', '관리자')}</span>
            </button>
          </div>
        ) : null
      }
      rightActions={
        /* 큰 디스플레이(데스크톱)에서만 노출되는 진행 상태 뱃지 */
        renderStageStatusBadge()
      }
      titleActions={
        <div className="grid sm:hidden grid-cols-4 w-full bg-slate-100/90 p-0.5 rounded-lg border border-slate-200 gap-1 text-[11px] font-bold text-center">
          <button
            type="button"
            onClick={() => setActiveSubTab('studentSheet')}
            className={cn("py-1.5 rounded-md transition text-center", activeSubTab === 'studentSheet' ? "bg-white text-indigo-600 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900")}
          >
            {t('teacher_afterschool.tab_attendance_short', '출석')}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('teacherAttendance')}
            className={cn("py-1.5 rounded-md transition text-center", activeSubTab === 'teacherAttendance' ? "bg-white text-indigo-600 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900")}
          >
            {t('teacher_afterschool.tab_teacher_work_short', '출근')}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('batchApproval')}
            className={cn("py-1.5 rounded-md transition text-center", activeSubTab === 'batchApproval' ? "bg-white text-indigo-600 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900")}
          >
            {t('teacher_afterschool.tab_docs_short', '증빙')}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('course')}
            className={cn("py-1.5 rounded-md transition text-center", activeSubTab === 'course' ? "bg-white text-indigo-600 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900")}
          >
            {t('teacher_afterschool.tab_courses_short', '강좌')}
          </button>
        </div>
      }
      contentClassName="p-2 sm:p-3 pt-1.5 sm:pt-2"
    >
      <div className="max-w-7xl mx-auto space-y-2.5">
        {isLoadingCourses ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col items-center justify-center min-h-[360px] gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <div className="text-center">
              <p className="text-sm font-bold text-slate-800">{t('common.loading', '출석부 데이터를 불러오는 중입니다…')}</p>
              <p className="text-xs text-slate-400 mt-0.5">강좌 및 수강생 정보를 동기화하고 있습니다.</p>
            </div>
          </div>
        ) : activeSubTab === 'course' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-200/80 px-3.5 py-2 rounded-xl text-xs text-indigo-900">
              <span className="font-bold flex items-center gap-1.5">
                {t('teacher_afterschool.tab_courses', '강좌 관리 & 수업계획')}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveSubTab('studentSheet')}
                className="h-6 px-2.5 text-xs bg-white text-indigo-700 font-bold border-indigo-300 hover:bg-indigo-50 cursor-pointer shadow-2xs"
              >
                {t('teacher_afterschool.btn_to_attendance', '출석부로 이동')}
              </Button>
            </div>
            <CourseManagement
              courses={myCourses}
              setCourses={setCourses}
              onSelectCourseForStudent={handleSelectCourseForStudent}
              classrooms={classrooms.length > 0 ? classrooms : initialClassrooms}
              role="teacher"
              tuitionPerSession={tuitionPerSession}
              currentUserName={myName}
              periods={periods}
              schoolTeachers={schoolTeachers}
            />
          </div>
        ) : (
          <AttendanceManagement
            courses={myCourses}
            selectedCourseId={selectedCourseId}
            setSelectedCourseId={setSelectedCourseId}
            activeSubTab={activeSubTab}
            setActiveSubTab={setActiveSubTab}
            enrollments={myEnrollments}
            attendanceRecords={myAttendanceRecords}
            setAttendanceRecords={(updater) => {
              // React setState updater는 순수해야 하므로 async side-effect를 분리
              // prev를 먼저 읽어 next를 계산한 뒤, setState와 Firestore 저장을 독립 실행
              setAttendanceRecords(prev => {
                const next = typeof updater === 'function' ? updater(prev) : updater;
                // 저장은 다음 microtask로 분리 (updater 밖에서 실행)
                Promise.resolve().then(() => handleSaveAttendance(next, prev));
                return next;
              });
            }}
            studentsList={studentsList}
            masterStudents={masterStudents}
            routes={routes}
            buses={buses}
            approvalDocs={approvalDocs}
            setApprovalDocs={setApprovalDocs}
          />
        )}
      </div>
    </MainLayout>
  );
}

export default function AfterschoolConsolePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <AfterschoolConsole />
    </Suspense>
  );
}
