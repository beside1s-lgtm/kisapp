/**
 * 방과후 강사료 정산 — 현재 학기 운영 현황(마스터 설정의 학기·운영 기간·휴업일) 기준
 *
 * 정산 원칙
 *  - 차시: 운영 기간 안에서 실제 수업한 회차(출석 체크가 된 회차)만 센다.
 *  - 강사: 공동 강사는 각자 출근한 차시 × 차시당 단가를 각자 받는다.
 *  - 결근: 그 강사의 그 회차 차시는 빠진다. 대강: 대강한 강사가 그 차시를 받는다.
 *
 * Firebase에 의존하지 않는 순수 계산 (loadSettlementTerm만 설정을 읽어 온다)
 */
import type { AttendanceRecord, Course, SubstituteRecord } from './types';
import {
  extractHolidayDatesFromEvents,
  generateCalendarSchedule,
  generateCalendarScheduleByDateRange,
  getCourseSessionsPerClass,
  type ScheduleDay,
} from './schedule';

export interface SettlementTerm {
  year: string;
  semester: string;
  startDate: string;
  endDate: string;
  allowedDays: string[];
  sessionsPerClass: number;
  holidayDates: string[];
  fee: number;
  currency: string;
  feeType: string;
}

export const termLabel = (t: Pick<SettlementTerm, 'year' | 'semester'>) => `${t.year}-${t.semester}`;
export const termPeriodLabel = (t: Pick<SettlementTerm, 'startDate' | 'endDate'>) =>
  t.startDate && t.endDate ? `${t.startDate} ~ ${t.endDate}` : '운영 기간 미설정';

export function termFromSettings(settings: any, holidayDates: string[] = []): SettlementTerm {
  return {
    year: String(settings?.year || new Date().getFullYear()),
    semester: String(settings?.semester || ''),
    startDate: String(settings?.operatingStartDate || ''),
    endDate: String(settings?.operatingEndDate || ''),
    allowedDays: settings?.allowedDays || ['월'],
    sessionsPerClass: Number(settings?.sessionsPerClass) || 2,
    holidayDates,
    fee: Number(settings?.teacherFee) || 0,
    currency: String(settings?.teacherFeeCurrency || 'VND'),
    feeType: String(settings?.teacherFeeType || '차시당'),
  };
}

/**
 * 운영 기간 = [실시간 제어실 › 강사 신청 제어]의 운영 시작일·종료일 (teacherApplySettings.operatingStartDate/EndDate)
 * 휴업일 = 학사일정(docConfig.academicCalendar) — 교사 출석부 회차 계산과 같은 기준
 */
export function termFromSettingsAndDocConfig(settings: any, docConfig: any, fallbackEvents: any[] = []): SettlementTerm {
  const events = docConfig?.academicCalendar?.events || fallbackEvents;
  return termFromSettings(settings, extractHolidayDatesFromEvents(events || []));
}

/** 마스터 설정 + 학사일정 휴업일을 읽어 현재 학기 정산 기준을 만든다 */
export async function loadSettlementTerm(): Promise<SettlementTerm> {
  const { getTeacherApplySettings, getDocConfig } = await import('@/lib/services/settingsService');
  const { DEFAULT_ACADEMIC_CALENDAR_CONFIG } = await import('@/lib/services/academicCalendarService');
  const [settings, docConfig] = await Promise.all([getTeacherApplySettings(), getDocConfig().catch(() => null)]);
  const events = (docConfig as any)?.academicCalendar?.events || DEFAULT_ACADEMIC_CALENDAR_CONFIG.events || [];
  return termFromSettings(settings, extractHolidayDatesFromEvents(events));
}

/** 강좌의 현재 학기 회차표 (교사 출석부·관리자 서류 검토와 같은 계산) */
export function courseScheduleForTerm(c: Partial<Course>, term: SettlementTerm): ScheduleDay[] {
  const classDays = c.classDays && c.classDays.length > 0 ? c.classDays : term.allowedDays;
  const sessions = getCourseSessionsPerClass(c, term.sessionsPerClass);
  return term.startDate && term.endDate
    ? generateCalendarScheduleByDateRange(term.startDate, term.endDate, classDays, sessions, term.holidayDates)
    : generateCalendarSchedule((c as any).startDate || `${term.year}-03-02`, (c as any).operatingWeeks || 20, classDays, sessions, term.holidayDates);
}

/** 강좌의 강사 명단 (주강사 → 강사2~6, 중복 제거) */
export function courseInstructors(c: Partial<Course>): string[] {
  const list = [c.instructorName, c.instructor2, c.instructor3, c.instructor4, c.instructor5, c.instructor6, ...((c as any).assistantTeachers || [])]
    .map((n) => String(n || '').trim())
    .filter(Boolean);
  return Array.from(new Set(list));
}

export type EvidenceStatusLabel = '교감 결재 완료' | '결재 진행 중' | '미제출';

export interface SubstituteEvent {
  courseId: string;
  courseTitle: string;
  dayIndex: number;
  date: string;
  dateStr: string;
  sessions: number;
  absentInstructor: string;
  substituteInstructor: string; // '' = 대강 없음
  conducted: boolean; // 그 회차 수업(출석 체크)이 있었는지
  reason: string;
}

export interface CourseSettlement {
  course: Course;
  instructors: string[];
  /** 강좌 실제 운영 기간 (운영 기간 안에서 요일·휴업일을 반영한 첫 수업일 ~ 마지막 수업일) */
  firstDate: string;
  lastDate: string;
  plannedLessons: number;
  plannedSessions: number;
  conductedLessons: number;
  conductedSessions: number;
  evidence: EvidenceStatusLabel;
  /** 강사별 이 강좌에서 받는 차시 { 정규, 대강 } */
  perInstructor: Map<string, { regular: number; covered: number; absent: number }>;
}

export interface InstructorSettlement {
  name: string;
  courses: Array<{ title: string; regular: number; covered: number; absent: number }>;
  regularSessions: number;
  coveredSessions: number;
  absentSessions: number;
  paidSessions: number;
  amount: number;
}

export interface SettlementResult {
  term: SettlementTerm;
  courses: CourseSettlement[];
  instructors: InstructorSettlement[];
  substituteEvents: SubstituteEvent[];
  totals: { courses: number; students: number; conductedSessions: number; paidSessions: number; amount: number; instructors: number };
}

const isChecked = (r: AttendanceRecord) => Boolean(r.status || (r as any).markSymbol);

export function computeSettlement(
  courses: Course[],
  attendanceRecords: AttendanceRecord[],
  substituteRecords: SubstituteRecord[],
  approvalDocs: Array<{ courseId: string; status?: string; vicePrincipalApproved?: boolean }>,
  term: SettlementTerm
): SettlementResult {
  const byInstructor = new Map<string, InstructorSettlement>();
  const ensure = (name: string) => {
    let s = byInstructor.get(name);
    if (!s) {
      s = { name, courses: [], regularSessions: 0, coveredSessions: 0, absentSessions: 0, paidSessions: 0, amount: 0 };
      byInstructor.set(name, s);
    }
    return s;
  };
  const events: SubstituteEvent[] = [];
  const checkedByCourse = new Map<string, Set<number>>();
  (attendanceRecords || []).forEach((r) => {
    if (!isChecked(r) || !r.sessionNo) return;
    (checkedByCourse.get(r.courseId) || checkedByCourse.set(r.courseId, new Set()).get(r.courseId)!).add(r.sessionNo);
  });

  const courseResults: CourseSettlement[] = courses.map((c) => {
    const days = courseScheduleForTerm(c, term);
    const instructors = courseInstructors(c);
    const main = instructors[0] || '';
    const checked = checkedByCourse.get(c.id) || new Set<number>();
    const subs = (substituteRecords || []).filter((s) => s.courseId === c.id);
    const per = new Map<string, { regular: number; covered: number; absent: number }>();
    const bump = (name: string, k: 'regular' | 'covered' | 'absent', n: number) => {
      const v = per.get(name) || { regular: 0, covered: 0, absent: 0 };
      v[k] += n;
      per.set(name, v);
    };
    instructors.forEach((n) => per.set(n, { regular: 0, covered: 0, absent: 0 }));

    let conductedLessons = 0;
    let conductedSessions = 0;
    const usedSubs = new Set<string>();
    days.forEach((d) => {
      const n = d.sessionNos.length;
      const conducted = d.sessionNos.some((no) => checked.has(no));
      if (conducted) {
        conductedLessons++;
        conductedSessions += n;
      }
      // 강사 명단에 없는 사람을 대상으로 한 결근·대강 기록도 빠뜨리지 않는다
      const extra = subs
        .filter((s) => s.dayIndex === d.dayIndex && s.targetInstructor && !instructors.includes(String(s.targetInstructor).trim()))
        .map((s) => String(s.targetInstructor).trim());
      [...instructors, ...Array.from(new Set(extra))].forEach((inst) => {
        const sub = subs.find((s) => !usedSubs.has(s.id) && s.dayIndex === d.dayIndex && (s.targetInstructor ? String(s.targetInstructor).trim() === inst : inst === main));
        if (sub) {
          usedSubs.add(sub.id);
          const absentee = sub.targetInstructor || sub.originalInstructor || inst;
          const isAbs = Boolean(sub.isAbsence || sub.recordType === 'ABSENCE');
          const substitute = isAbs ? '' : String(sub.substituteInstructor || '').trim();
          events.push({
            courseId: c.id,
            courseTitle: c.title,
            dayIndex: d.dayIndex,
            date: d.fullDate,
            dateStr: d.dateStr,
            sessions: n,
            absentInstructor: absentee,
            substituteInstructor: substitute,
            conducted,
            reason: sub.reason || '',
          });
          if (!conducted) return;
          bump(inst, 'absent', n);
          if (substitute) bump(substitute, 'covered', n);
          return;
        }
        if (conducted) bump(inst, 'regular', n);
      });
    });

    const docs = (approvalDocs || []).filter((d) => d.courseId === c.id);
    const evidence: EvidenceStatusLabel = docs.some((d) => d.status === 'APPROVED' || d.vicePrincipalApproved)
      ? '교감 결재 완료'
      : docs.length > 0
        ? '결재 진행 중'
        : '미제출';

    per.forEach((v, name) => {
      if (!v.regular && !v.covered && !v.absent) return;
      const s = ensure(name);
      s.courses.push({ title: c.title, ...v });
      s.regularSessions += v.regular;
      s.coveredSessions += v.covered;
      s.absentSessions += v.absent;
    });

    return {
      course: c,
      instructors,
      firstDate: days[0]?.fullDate || '',
      lastDate: days[days.length - 1]?.fullDate || '',
      plannedLessons: days.length,
      plannedSessions: days.reduce((sum, d) => sum + d.sessionNos.length, 0),
      conductedLessons,
      conductedSessions,
      evidence,
      perInstructor: per,
    };
  });

  const instructors = Array.from(byInstructor.values())
    .map((s) => {
      const paid = s.regularSessions + s.coveredSessions;
      return { ...s, paidSessions: paid, amount: paid * term.fee };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  events.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.courseTitle.localeCompare(b.courseTitle, 'ko'));

  return {
    term,
    courses: courseResults,
    instructors,
    substituteEvents: events,
    totals: {
      courses: courses.length,
      students: courses.reduce((sum, c) => sum + (c.currentStudents || 0), 0),
      conductedSessions: courseResults.reduce((sum, r) => sum + r.conductedSessions, 0),
      paidSessions: instructors.reduce((sum, s) => sum + s.paidSessions, 0),
      amount: instructors.reduce((sum, s) => sum + s.amount, 0),
      instructors: instructors.length,
    },
  };
}
