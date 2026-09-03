'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, BookOpen, Users, ClipboardCheck } from 'lucide-react';
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
import { onAfterschoolCoursesUpdate, onAfterschoolEnrollmentsUpdate, onAttendanceRecordsUpdate, saveAttendanceRecordsBatch, onAfterschoolClassroomsUpdate, onAfterschoolApprovalDocsUpdate, getTeacherApplySettings, saveTeacherApplySettings, onTeacherApplySettingsUpdate } from '@/lib/services/settingsService';
import { onMasterStudentsUpdate } from '@/lib/services/masterStudentService';
import type { MasterStudent } from '@/lib/types/masterStudent';
import { getUsersDirectory } from '@/lib/services/userService';
import type { UserProfile } from '@/lib/types';

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
  const { user, profile } = useAuth();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<string>('course');

  // Shared States
  const [courses, setCourses] = useState<import('@/lib/afterschool/types').Course[]>(initialCourses);
  const [studentsList] = useState(initialStudents);
  const [enrollments, setEnrollments] = useState<import('@/lib/afterschool/types').Enrollment[]>(initialEnrollments);
  const [attendanceRecords, setAttendanceRecords] = useState<import('@/lib/afterschool/types').AttendanceRecord[]>(initialAttendance);
  const [classrooms, setClassrooms] = useState<Classroom[]>(initialClassrooms);
  
  // 차시별 수강료 고정 금액 설정
  const [tuitionPerSession] = useState<number>(15000);
  const [periods, setPeriods] = useState<SessionPeriod[]>(initialPeriods);
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

  // Firestore DB 실시간 연동 (강좌, 수강신청, 출석)
  useEffect(() => {
    const unsubCourses = onAfterschoolCoursesUpdate((data) => {
      if (data && data.length > 0) setCourses(data);
    });
    const unsubEnrollments = onAfterschoolEnrollmentsUpdate((data) => {
      if (data && data.length > 0) setEnrollments(data);
    });
    const unsubAttendance = onAttendanceRecordsUpdate((data) => {
      if (data && data.length > 0) setAttendanceRecords(data);
    });
    const unsubClassrooms = onAfterschoolClassroomsUpdate((data) => {
      if (data && data.length > 0) setClassrooms(data);
    });
    const unsubApprovalDocs = onAfterschoolApprovalDocsUpdate((data) => {
      setApprovalDocs(data);
    });
    return () => {
      unsubCourses();
      unsubEnrollments();
      unsubAttendance();
      unsubClassrooms();
      unsubApprovalDocs();
    };
  }, []);

  // 출석 변경 시 Firestore 저장 핸들러
  const handleSaveAttendance = async (
    nextRecords: import('@/lib/afterschool/types').AttendanceRecord[],
    prevRecords: import('@/lib/afterschool/types').AttendanceRecord[]
  ) => {
    // 새로 추가/변경된 레코드 upsert
    const toUpsert = nextRecords.filter(r => {
      const prev = prevRecords.find(p => p.id === r.id);
      return !prev || JSON.stringify(prev) !== JSON.stringify(r);
    });
    // 삭제된 레코드 id
    const toDeleteIds = prevRecords
      .filter(p => !nextRecords.some(r => r.id === p.id))
      .map(p => p.id);
    if (toUpsert.length > 0 || toDeleteIds.length > 0) {
      await saveAttendanceRecordsBatch(toUpsert, toDeleteIds).catch(err =>
        console.error('[Attendance] Firestore 저장 오류:', err)
      );
    }
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
  }, []);

  const handleToggleStageStatus = async () => {
    const nextStatus = stageStatus === 'OPERATING' ? 'CLOSED' : stageStatus === 'CLOSED' ? 'RECRUITING' : 'OPERATING';
    const nextLabel = nextStatus === 'OPERATING' ? '운영중' : nextStatus === 'CLOSED' ? '종료' : '대기중';
    if (window.confirm(`방과후학교 진행 상태를 [${nextLabel}] (으)로 변경하시겠습니까?`)) {
      await saveTeacherApplySettings({ afterschoolStageStatus: nextStatus });
      setStageStatus(nextStatus);
    }
  };

  const handleSelectCourseForStudent = (courseId: string) => {
    setSelectedCourseId(courseId);
    setActiveSubTab('studentSheet');
  };

  const myName = (profile?.name || user?.displayName || '').trim();
  const teacherCourses = useMemo(() => {
    if (!myName) return courses;
    const filtered = courses.filter(c => {
      const instructors = [
        c.instructorName,
        c.instructor2,
        c.instructor3,
        c.instructor4,
        ...(c.assistantTeachers || [])
      ].filter(Boolean).map(s => String(s).trim());
      return instructors.includes(myName);
    });
    return filtered.length > 0 ? filtered : courses;
  }, [courses, myName]);

  const myCourses = teacherCourses;

  // 교사 본인 강좌 ID 목록
  const myCourseIds = useMemo(() => myCourses.map(c => c.id), [myCourses]);

  // 교사 본인 강좌의 수강신청 정보들만 필터링
  const myEnrollments = useMemo(() => {
    return enrollments.filter(e => myCourseIds.includes(e.courseId));
  }, [enrollments, myCourseIds]);

  // 교사 본인 강좌의 출석체크 정보들만 필터링
  const myAttendanceRecords = useMemo(() => {
    return attendanceRecords.filter(a => myCourseIds.includes(a.courseId));
  }, [attendanceRecords, myCourseIds]);

  useEffect(() => {
    if (myCourses.length > 0 && (!selectedCourseId || !myCourses.some(c => c.id === selectedCourseId))) {
      setSelectedCourseId(myCourses[0].id);
    }
  }, [myCourses, selectedCourseId]);

  return (
    <MainLayout
      title={
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-nowrap">
          {/* 1. 강의 선택 드롭다운 버튼 (요청 1: 선생님 페이지 앞으로 이동!) */}
          {myCourses.length > 0 && (
            <Select
              value={selectedCourseId}
              onValueChange={(val) => {
                setSelectedCourseId(val);
                setActiveSubTab('course'); // 드롭다운 선택 시 해당 강좌 카드로 이동!
              }}
            >
              <SelectTrigger className="h-7 text-xs bg-white border-slate-300 font-bold px-2 min-w-[105px] max-w-[160px] shrink-0 rounded-lg shadow-2xs text-slate-800">
                <SelectValue placeholder="강좌 선택" />
              </SelectTrigger>
              <SelectContent>
                {myCourses.map(c => (
                  <SelectItem
                    key={c.id}
                    value={c.id}
                    className="text-xs font-semibold cursor-pointer"
                    onClick={() => {
                      setSelectedCourseId(c.id);
                      setActiveSubTab('course');
                    }}
                  >
                    {c.title}
                  </SelectItem>
                ))}
                <div
                  className="px-2 py-1.5 border-t border-slate-100 text-[11px] font-extrabold text-indigo-600 hover:bg-indigo-50 cursor-pointer flex items-center gap-1 rounded-sm mt-1"
                  onClick={() => setActiveSubTab('course')}
                >
                  <BookOpen className="w-3 h-3 shrink-0 text-indigo-600" />
                  <span>강좌 상세/수업계획 카드</span>
                </div>
              </SelectContent>
            </Select>
          )}

          {/* 2. 선생님 페이지 타이틀 */}
          <span className="text-sm sm:text-base font-bold font-headline text-slate-800 shrink-0">
            {t('page.title.teacher') || '선생님 페이지'}
          </span>

          {/* 3. 출석부/강사출근부/증빙 문서 관리 드롭다운 버튼 (요청 2: 최상단 헤더 선생님 페이지 오른쪽 자리로 이동!) */}
          <Select value={activeSubTab} onValueChange={(val: any) => setActiveSubTab(val)}>
            <SelectTrigger className="h-7 text-xs bg-indigo-50 text-indigo-900 border-indigo-300 font-extrabold px-2.5 min-w-[100px] max-w-[140px] shrink-0 rounded-lg shadow-2xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="studentSheet" className="text-xs font-bold">
                📋 출석부
              </SelectItem>
              <SelectItem value="teacherAttendance" className="text-xs font-bold">
                📝 강사출근부
              </SelectItem>
              <SelectItem value="batchApproval" className="text-xs font-bold">
                📦 증빙 문서 관리
              </SelectItem>
              <SelectItem value="course" className="text-xs font-bold text-indigo-700">
                📖 강좌 관리 & 수업계획
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
      rightActions={
        /* 진행 상태 뱃지 */
        <button
          type="button"
          onClick={handleToggleStageStatus}
          className={cn(
            "px-2 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 transition-all cursor-pointer shadow-2xs shrink-0",
            stageStatus === 'OPERATING'
              ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
              : stageStatus === 'CLOSED'
              ? "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
              : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
          )}
          title="클릭 시 방과후학교 진행 상태 변경"
        >
          <span className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            stageStatus === 'OPERATING' ? "bg-emerald-500 animate-pulse" : stageStatus === 'CLOSED' ? "bg-rose-500" : "bg-amber-500"
          )} />
          <span>
            {stageStatus === 'OPERATING' ? '운영중' : stageStatus === 'CLOSED' ? '종료' : '대기중'}
          </span>
        </button>
      }
      titleActions={
        <div className="flex sm:hidden items-center w-full grid grid-cols-4 bg-slate-100/90 p-0.5 rounded-lg border border-slate-200 gap-0.5 text-[10.5px] font-bold text-center">
          <button
            type="button"
            onClick={() => setActiveSubTab('studentSheet')}
            className={cn("py-1 rounded-md transition", activeSubTab === 'studentSheet' ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-600")}
          >
            📋 출석
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('teacherAttendance')}
            className={cn("py-1 rounded-md transition", activeSubTab === 'teacherAttendance' ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-600")}
          >
            📝 출근
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('batchApproval')}
            className={cn("py-1 rounded-md transition", activeSubTab === 'batchApproval' ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-600")}
          >
            📦 증빙
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('course')}
            className={cn("py-1 rounded-md transition", activeSubTab === 'course' ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-600")}
          >
            📖 강좌
          </button>
        </div>
      }
      contentClassName="p-2 sm:p-3 pt-1.5 sm:pt-2"
    >
      <div className="max-w-7xl mx-auto space-y-2.5">
        {activeSubTab === 'course' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-200/80 px-3.5 py-2 rounded-xl text-xs text-indigo-900">
              <span className="font-bold flex items-center gap-1.5">
                📖 강좌 관리 & 수업계획 카드
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveSubTab('studentSheet')}
                className="h-6 px-2.5 text-xs bg-white text-indigo-700 font-bold border-indigo-300 hover:bg-indigo-50 cursor-pointer shadow-2xs"
              >
                📋 출석부로 이동
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
              setAttendanceRecords(prev => {
                const next = typeof updater === 'function' ? updater(prev) : updater;
                handleSaveAttendance(next, prev);
                return next;
              });
            }}
            studentsList={studentsList}
            masterStudents={masterStudents}
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
