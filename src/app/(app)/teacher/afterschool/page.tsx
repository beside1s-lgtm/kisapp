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
import type { Classroom, SubmittedApprovalDoc, SessionPeriod } from '@/lib/afterschool/types';
import { onAfterschoolCoursesUpdate, onAfterschoolEnrollmentsUpdate, onAttendanceRecordsUpdate, saveAttendanceRecordsBatch, onAfterschoolClassroomsUpdate, onAfterschoolApprovalDocsUpdate } from '@/lib/services/settingsService';
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
  const [courses, setCourses] = useState<import('@/lib/afterschool/types').Course[]>([]);
  const [studentsList] = useState(initialStudents);
  const [enrollments, setEnrollments] = useState<import('@/lib/afterschool/types').Enrollment[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<import('@/lib/afterschool/types').AttendanceRecord[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  
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
      setCourses(data);
    });
    const unsubEnrollments = onAfterschoolEnrollmentsUpdate((data) => {
      setEnrollments(data);
    });
    const unsubAttendance = onAttendanceRecordsUpdate((data) => {
      setAttendanceRecords(data);
    });
    const unsubClassrooms = onAfterschoolClassroomsUpdate((data) => {
      setClassrooms(data);
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

  const handleSelectCourseForStudent = (courseId: string) => {
    setSelectedCourseId(courseId);
    setActiveTab('student');
  };

  const myName = (profile?.name || user?.displayName || '').trim();
  const myCourses = courses.filter(c => {
    if (!myName) return true;
    const instructors = [
      c.instructorName,
      c.instructor2,
      c.instructor3,
      c.instructor4,
      ...(c.assistantTeachers || [])
    ].filter(Boolean).map(s => String(s).trim());
    return instructors.includes(myName);
  });

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
    if (myCourses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(myCourses[0].id);
    }
  }, [myCourses, selectedCourseId]);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto p-2.5 sm:p-4 md:p-8 space-y-3 sm:space-y-6">
        
        {/* 상단 타이틀 & 설명 배너 */}
        <div className="bg-white p-3.5 sm:p-6 rounded-xl sm:rounded-2xl border shadow-xs sm:shadow-sm flex items-center gap-2.5 sm:gap-3">
          <div className="p-2 sm:p-3 bg-indigo-50 text-indigo-600 rounded-lg sm:rounded-xl shrink-0">
            <BookOpen className="w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-base sm:text-2xl font-bold font-headline flex items-center gap-2 text-slate-800">
              {t('afterschool.teacher.title')}
            </h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
              {t('afterschool.teacher.desc')}
            </p>
          </div>
        </div>

        {/* 탭 인터페이스 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 sm:space-y-6">
          <TabsList className="grid grid-cols-3 max-w-lg w-full h-auto p-1 bg-slate-100/80 rounded-xl border border-slate-200 gap-0.5">
            <TabsTrigger value="course" className="py-1.5 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm gap-1 sm:gap-2 px-1 truncate">
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">{t('afterschool.teacher.my_courses')}</span>
              <span className="text-[10px] sm:text-xs text-slate-500">({myCourses.length})</span>
            </TabsTrigger>
            <TabsTrigger value="student" className="py-1.5 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm gap-1 sm:gap-2 px-1 truncate">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">{t('afterschool.teacher.enrolled_students')}</span>
              <span className="text-[10px] sm:text-xs text-slate-500">({myEnrollments.length})</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="py-1.5 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm gap-1 sm:gap-2 px-1 truncate">
              <ClipboardCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">{t('afterschool.teacher.attendance_check')}</span>
            </TabsTrigger>
          </TabsList>

          <Card className="border-slate-200/80 shadow-xs sm:shadow-md bg-white">
            <CardContent className="p-3 sm:p-6">
              <TabsContent value="course" className="m-0 focus-visible:outline-none">
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
              </TabsContent>

              <TabsContent value="student" className="m-0 focus-visible:outline-none">
                <StudentManagement
                  courses={myCourses}
                  selectedCourseId={selectedCourseId}
                  setSelectedCourseId={setSelectedCourseId}
                  enrollments={myEnrollments}
                  setEnrollments={setEnrollments}
                  studentsList={studentsList}
                />
              </TabsContent>

              <TabsContent value="attendance" className="m-0 focus-visible:outline-none">
                <AttendanceManagement
                  courses={myCourses}
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
                  approvalDocs={approvalDocs}
                  setApprovalDocs={setApprovalDocs}
                />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
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
