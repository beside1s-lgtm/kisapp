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
  { id: 'rm1', name: '1-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm2', name: '1-2반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm3', name: '2-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm4', name: '3-1반 교실', capacity: 30, maxSimultaneousCourses: 1 },
  { id: 'rm5', name: '음악실', capacity: 25, maxSimultaneousCourses: 1 },
  { id: 'rm6', name: '미술실', capacity: 25, maxSimultaneousCourses: 1 },
  { id: 'rm7', name: '체육관', capacity: 100, maxSimultaneousCourses: 2 },
  { id: 'rm8', name: '컴퓨터실', capacity: 30, maxSimultaneousCourses: 1 },
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

  const myName = profile?.name || user?.displayName || '';
  const myCourses = courses.filter(c => 
    c.instructorName === myName || 
    c.assistantTeachers?.includes(myName)
  );

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
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        
        {/* 상단 타이틀 & 설명 배너 */}
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <BookOpen size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-headline flex items-center gap-2 text-slate-800">
              {t('afterschool.teacher.title')}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {t('afterschool.teacher.desc')}
            </p>
          </div>
        </div>

        {/* 탭 인터페이스 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 max-w-lg h-auto p-1 bg-slate-100/80 rounded-xl border border-slate-200">
            <TabsTrigger value="course" className="py-2.5 rounded-lg font-bold text-sm gap-2">
              <BookOpen size={16} /> {t('afterschool.teacher.my_courses')} ({myCourses.length})
            </TabsTrigger>
            <TabsTrigger value="student" className="py-2.5 rounded-lg font-bold text-sm gap-2">
              <Users size={16} /> {t('afterschool.teacher.enrolled_students')} ({myEnrollments.length})
            </TabsTrigger>
            <TabsTrigger value="attendance" className="py-2.5 rounded-lg font-bold text-sm gap-2">
              <ClipboardCheck size={16} /> {t('afterschool.teacher.attendance_check')}
            </TabsTrigger>
          </TabsList>

          <Card className="border-slate-200/80 shadow-md bg-white">
            <CardContent className="p-6">
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
