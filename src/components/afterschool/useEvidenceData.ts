'use client';

/**
 * 방과후 강사료 증빙서류 화면(교감 결재 / 일괄 출력) 공통: 접근 권한 + 필요한 데이터 구독
 * - 열람: 교감, 교장, 방과후 담당 부장, 시스템 관리자
 * - 결재: 교감만 (isVicePrincipal)
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  getOrgStructure,
  getTeacherApplySettings,
  onAfterschoolApprovalDocsUpdate,
  onAfterschoolCoursesUpdate,
  onAfterschoolEnrollmentsUpdate,
  onAttendanceRecordsUpdate,
  onDocConfigUpdate,
  onSubstituteRecordsUpdate,
} from '@/lib/services/settingsService';
import { extractHolidayDatesFromEvents } from '@/lib/afterschool/schedule';
import { DEFAULT_ACADEMIC_CALENDAR_CONFIG } from '@/lib/services/academicCalendarService';
import type { AttendanceRecord, Course, Enrollment, SubmittedApprovalDoc, SubstituteRecord } from '@/lib/afterschool/types';
import { getTeacherSignatureBook, type TeacherSignatureBook } from '@/lib/teachers/teacherRegistry';

export interface EvidenceAccess {
  canView: boolean;
  isVicePrincipal: boolean;
  isManager: boolean;
}

export function useEvidenceData() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const myEmail = String(profile?.email || user?.email || '').trim().toLowerCase();
  const myName = String(profile?.name || '').trim();

  const [access, setAccess] = useState<EvidenceAccess | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [docs, setDocs] = useState<SubmittedApprovalDoc[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [substituteRecords, setSubstituteRecords] = useState<SubstituteRecord[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [docConfig, setDocConfig] = useState<any>(null);
  const [sigBook, setSigBook] = useState<TeacherSignatureBook | null>(null);
  const [loaded, setLoaded] = useState({ courses: false, docs: false });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    getOrgStructure()
      .then((org: any) => {
        const eq = (v: unknown) => String(v || '').trim().toLowerCase() === myEmail;
        const managers: string[] = org?.afterschoolManagers || (org?.afterschoolManager ? [org.afterschoolManager] : []);
        const isVicePrincipal = eq(org?.vicePrincipal);
        const isManager = managers.some(eq);
        const canView = isVicePrincipal || isManager || eq(org?.principal) || profile?.isAdmin === true;
        setAccess({ canView, isVicePrincipal, isManager });
      })
      .catch(() => setAccess({ canView: profile?.isAdmin === true, isVicePrincipal: false, isManager: false }));
  }, [authLoading, user, profile, myEmail, router]);

  useEffect(() => {
    if (!access?.canView) return;
    getTeacherApplySettings().then(setSettings).catch(() => {});
    getTeacherSignatureBook().then(setSigBook).catch(() => {});
    const unsubs = [
      onAfterschoolCoursesUpdate((list) => {
        setCourses(list);
        setLoaded((p) => ({ ...p, courses: true }));
      }),
      onAfterschoolApprovalDocsUpdate((list) => {
        setDocs(list);
        setLoaded((p) => ({ ...p, docs: true }));
      }),
      onAfterschoolEnrollmentsUpdate((list) => setEnrollments(list)),
      onAttendanceRecordsUpdate((list) => setAttendanceRecords(list)),
      onSubstituteRecordsUpdate((list) => setSubstituteRecords(list)),
      onDocConfigUpdate((cfg) => cfg && setDocConfig(cfg)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [access?.canView]);

  const holidayDates = useMemo(
    () => extractHolidayDatesFromEvents(docConfig?.academicCalendar?.events || DEFAULT_ACADEMIC_CALENDAR_CONFIG.events || []),
    [docConfig]
  );
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  return {
    authLoading,
    profile,
    myEmail,
    myName,
    access,
    courses,
    courseById,
    docs,
    enrollments,
    attendanceRecords,
    substituteRecords,
    settings,
    holidayDates,
    sigBook,
    setSigBook,
    ready: loaded.courses && loaded.docs,
    reloadSigBook: () => getTeacherSignatureBook(true).then(setSigBook).catch(() => {}),
  };
}
