'use client';

/**
 * 방과후 강사료 증빙서류(출석부 / 강사출근부) 열람 전용 뷰어 — 교감 결재 페이지 등에서 사용
 * 관리자 화면의 서류 검토와 같은 계산(운영 기간·요일·휴업일 기준 회차)으로 공식 양식을 보여 준다.
 */
import React from 'react';
import type { AttendanceRecord, Course, Enrollment, SubmittedApprovalDoc, SubstituteRecord } from '@/lib/afterschool/types';
import {
  generateCalendarSchedule,
  generateCalendarScheduleByDateRange,
  getCourseSessionsPerClass,
  type ScheduleDay,
} from '@/lib/afterschool/schedule';
import { OfficialAttendanceSheet } from '@/components/afterschool/teacher/OfficialAttendanceSheet';
import { OfficialWorkRegister } from '@/components/afterschool/teacher/OfficialWorkRegister';
import { afterschoolDayMark, afterschoolTermHeader, attendanceMarkDisplay } from '@/lib/afterschool/attendanceMarks';
import { instructorSealEmail, findTeacherSignature, findSignatureFromRecords, type TeacherSignatureBook } from '@/lib/teachers/teacherRegistry';

export type EvidenceDocType = 'ATTENDANCE' | 'WORK_REGISTER';

export interface EvidenceDocViewerProps {
  course: Course;
  docType: EvidenceDocType;
  approvalDoc?: SubmittedApprovalDoc | null;
  enrollments: Enrollment[];
  attendanceRecords: AttendanceRecord[];
  substituteRecords: SubstituteRecord[];
  settings: any;
  holidayDates: string[] | Set<string> | any;
  sigBook: TeacherSignatureBook | null;
  onClose: () => void;
  /** 'page': 일괄 출력용 본문만 */
  variant?: 'modal' | 'page';
  /** 수기 결재용 출력: 부장·교감 서명 칸을 비워 둔다 */
  hideApprovalSignatures?: boolean;
  /** 보결 강사 서명을 다른 강좌 기록에서 찾을 때 쓰는 전체 증빙서류·강좌 */
  allDocs?: SubmittedApprovalDoc[];
  allCourses?: Course[];
}

export function buildCourseSchedule(c: Course, settings: any, holidayDates: any): ScheduleDay[] {
  const opStart = settings?.operatingStartDate || '';
  const opEnd = settings?.operatingEndDate || '';
  const classDays = c.classDays || ['월'];
  const effectiveDays = classDays && classDays.length > 0 ? classDays : settings?.allowedDays || ['월'];
  const effectiveSessions = getCourseSessionsPerClass(c, settings?.sessionsPerClass || 2);
  return opStart && opEnd
    ? generateCalendarScheduleByDateRange(opStart, opEnd, effectiveDays, effectiveSessions, holidayDates)
    : generateCalendarSchedule(c.startDate || '2026-03-30', c.operatingWeeks || 20, effectiveDays, effectiveSessions);
}

export function EvidenceDocViewer({
  course: c,
  docType,
  approvalDoc,
  enrollments,
  attendanceRecords,
  substituteRecords,
  settings,
  holidayDates,
  sigBook,
  onClose,
  variant = 'modal',
  hideApprovalSignatures = false,
  allDocs = [],
  allCourses = [],
}: EvidenceDocViewerProps) {
  const scheduleDays = React.useMemo(() => buildCourseSchedule(c, settings, holidayDates), [c, settings, holidayDates]);

  const getInstructorSeal = (instName: string): string => {
    if (!instName) return '';
    const cleanName = instName.trim();
    const docSigs = (approvalDoc as any)?.instructorSignatures;
    if (docSigs && docSigs[cleanName]) return docSigs[cleanName];
    return (
      findTeacherSignature(sigBook, cleanName, instructorSealEmail(c, cleanName, substituteRecords as any)) ||
      findSignatureFromRecords(sigBook, cleanName, allDocs as any, allCourses)
    );
  };

  const isManagerApproved = !hideApprovalSignatures && (approvalDoc?.status === 'APPROVED' || Boolean(approvalDoc?.managerApproved));
  const isVicePrincipalApproved = !hideApprovalSignatures && approvalDoc?.status === 'APPROVED' && Boolean(approvalDoc?.vicePrincipalApproved);

  if (docType === 'ATTENDANCE') {
    const courseStudents = enrollments.filter((e) => e.courseId === c.id && e.status === 'ENROLLED');
    return (
      <OfficialAttendanceSheet
        course={c as any}
        students={courseStudents.map((enr) => ({
          id: enr.id,
          studentId: enr.studentId,
          name: enr.name,
          grade: enr.grade,
          classNum: enr.classNum,
          studentNum: enr.studentNum,
          kisbusNo: enr.kisbusNo,
          parentPhone: enr.parentPhone,
        })) as any}
        scheduleDays={scheduleDays as any}
        getDayMark={(studentId, dayIndex) => {
          // 강사 출석부 출력과 같은 계산·기호 (lib/afterschool/attendanceMarks)
          const dayObj = scheduleDays.find((d) => d.dayIndex === dayIndex);
          const student = courseStudents.find((e) => e.studentId === studentId);
          return attendanceMarkDisplay(afterschoolDayMark(c.id, student as any, studentId, dayObj, attendanceRecords) || '');
        }}
        getInstructorSeal={getInstructorSeal}
        onClose={onClose}
        variant={variant}
      />
    );
  }

  return (
        <OfficialWorkRegister
          course={c as any}
          scheduleDays={scheduleDays as any}
          attendanceRecords={attendanceRecords as any}
          substituteRecords={substituteRecords as any}
          getInstructorSeal={getInstructorSeal}
          managerSignature={isManagerApproved ? approvalDoc?.managerSignature || '' : ''}
          vicePrincipalSignature={isVicePrincipalApproved ? approvalDoc?.vicePrincipalSignature || '' : ''}
          isManagerApproved={isManagerApproved}
          isVicePrincipalApproved={isVicePrincipalApproved}
          onClose={onClose}
          isModal={true}
          variant={variant}
          yearSemesterText={afterschoolTermHeader(settings)}
        />
  );
}
