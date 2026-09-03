import { getDb } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import type { DepartmentWeeklySchedule, AcademicEvent } from '@/lib/types';
import { getDocConfig, saveDocConfig } from './settingsService';

const getSchedulesCol = () => collection(getDb(), 'department_weekly_schedules');

/**
 * 부서별 주간 일정 생성
 */
export async function createDepartmentWeeklySchedule(
  data: Omit<DepartmentWeeklySchedule, 'id' | 'createdAt'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const newDocRef = doc(getSchedulesCol());
    const newSchedule: DepartmentWeeklySchedule = {
      ...data,
      id: newDocRef.id,
      createdAt: new Date().toISOString()
    };

    await setDoc(newDocRef, newSchedule);

    // 학사일정으로 전송 선택 시 academicCalendar.events에 자동 동기화
    if (data.sendToAcademicCalendar) {
      await syncScheduleToAcademicEvents(newSchedule);
    }

    return { success: true, id: newDocRef.id };
  } catch (error: any) {
    console.error('[departmentWeeklyScheduleService] create error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 부서별 주간 일정 실시간 구독
 */
export function onDepartmentWeeklySchedulesUpdate(
  callback: (schedules: DepartmentWeeklySchedule[]) => void
) {
  const q = query(getSchedulesCol(), orderBy('startDate', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const list: DepartmentWeeklySchedule[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as DepartmentWeeklySchedule);
    });
    callback(list);
  }, (err) => {
    console.error('[departmentWeeklyScheduleService] listen error:', err);
    callback([]);
  });
}

/**
 * 부서별 주간 일정 삭제
 */
export async function deleteDepartmentWeeklySchedule(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getSchedulesCol(), id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as DepartmentWeeklySchedule;
      if (data.sendToAcademicCalendar) {
        await removeScheduleFromAcademicEvents(id);
      }
    }
    await deleteDoc(docRef);
    return { success: true };
  } catch (error: any) {
    console.error('[departmentWeeklyScheduleService] delete error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 학사 일정 events 배열에 부서 일정 추가 동기화
 */
async function syncScheduleToAcademicEvents(schedule: DepartmentWeeklySchedule) {
  try {
    const docConfig = await getDocConfig();
    const currentCal = docConfig.academicCalendar || {
      year: 2026,
      annualSchoolDays: 190,
      semesters: {
        sem1: { id: 'sem1', name: '1학기', startDate: '2026-03-02', endDate: '2026-07-17', type: 'regular' },
        vacationSummer: { id: 'vacationSummer', name: '여름방학', startDate: '2026-07-18', endDate: '2026-08-16', type: 'vacation' },
        sem2: { id: 'sem2', name: '2학기', startDate: '2026-08-17', endDate: '2027-01-08', type: 'regular' },
        vacationWinter: { id: 'vacationWinter', name: '겨울방학', startDate: '2027-01-09', endDate: '2027-02-28', type: 'vacation' },
      },
      events: []
    };

    const eventId = `dept_event_${schedule.id}`;
    let titlePrefix = `[${schedule.deptName}]`;
    if (schedule.syncTargetType === 'dept') {
      titlePrefix = `[${schedule.deptName} 전용]`;
    } else if (schedule.syncTargetType === 'grade' && schedule.syncTargetGrade) {
      titlePrefix = `[${schedule.syncTargetGrade}]`;
    }

    const newEvent: AcademicEvent = {
      id: eventId,
      date: schedule.startDate,
      endDate: schedule.endDate > schedule.startDate ? schedule.endDate : undefined,
      title: `${titlePrefix} ${schedule.title}`,
      type: 'SCHOOL_EVENT',
      isSchoolDay: true,
      isParentPrivate: true, // 교직원 내부 그룹 동기화
      targetGroupType: schedule.syncTargetType || 'all',
      targetGrade: schedule.syncTargetGrade,
      targetDept: schedule.deptName
    };

    // 기존 동일 ID 이벤트 제거 후 추가
    const filteredEvents = (currentCal.events || []).filter(e => e.id !== eventId);
    filteredEvents.push(newEvent);

    await saveDocConfig({
      ...docConfig,
      academicCalendar: {
        ...currentCal,
        events: filteredEvents
      }
    });
  } catch (e) {
    console.error('[departmentWeeklyScheduleService] sync to academic calendar error:', e);
  }
}

/**
 * 학사 일정 events 배열에서 부서 일정 제거 동기화
 */
async function removeScheduleFromAcademicEvents(scheduleId: string) {
  try {
    const docConfig = await getDocConfig();
    if (!docConfig.academicCalendar?.events) return;

    const eventId = `dept_event_${scheduleId}`;
    const filteredEvents = docConfig.academicCalendar.events.filter(e => e.id !== eventId);

    await saveDocConfig({
      ...docConfig,
      academicCalendar: {
        ...docConfig.academicCalendar,
        events: filteredEvents
      }
    });
  } catch (e) {
    console.error('[departmentWeeklyScheduleService] remove from academic calendar error:', e);
  }
}

const getProposalsCol = () => collection(getDb(), 'department_weekly_proposals');

/**
 * 부서원: 부장에게 주간 일정 제안/요청 생성
 */
export async function createWeeklyProposal(
  data: Omit<import('@/lib/types').DepartmentWeeklyProposal, 'id' | 'status' | 'createdAt'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const newDocRef = doc(getProposalsCol());
    const proposal: import('@/lib/types').DepartmentWeeklyProposal = {
      ...data,
      id: newDocRef.id,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    await setDoc(newDocRef, proposal);
    return { success: true, id: newDocRef.id };
  } catch (error: any) {
    console.error('[departmentWeeklyScheduleService] create proposal error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 주간 일정 제안 실시간 구독
 */
export function onWeeklyProposalsUpdate(
  callback: (proposals: import('@/lib/types').DepartmentWeeklyProposal[]) => void
) {
  const q = query(getProposalsCol(), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const list: import('@/lib/types').DepartmentWeeklyProposal[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as import('@/lib/types').DepartmentWeeklyProposal);
    });
    callback(list);
  }, (err) => {
    console.error('[departmentWeeklyScheduleService] listen proposals error:', err);
    callback([]);
  });
}

/**
 * 부장: 부서원 제안 검토 및 승인/부서내종결/반려 처리
 */
export async function reviewWeeklyProposal(
  proposalId: string,
  decision: 'approved' | 'closed_internal' | 'rejected',
  options: {
    deptName: string;
    title: string;
    startDate: string;
    endDate: string;
    content?: string;
    isWeeklyEvent?: boolean;
    isWeeklyDeptContent?: boolean;
    isMonthlySchedule?: boolean;
    sendToAcademicCalendar?: boolean;
    syncTargetType?: import('@/lib/types').CalendarSyncTargetType;
    syncTargetGrade?: string;
    isMainSchoolSchedule?: boolean;
    reviewComment?: string;
    reviewerName?: string;
    reviewerEmail?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(getProposalsCol(), proposalId);
    
    // 1. 승인하여 부서 일정으로 보낼 경우 -> 실제 DepartmentWeeklySchedule 생성
    if (decision === 'approved') {
      await createDepartmentWeeklySchedule({
        deptName: options.deptName,
        creatorEmail: options.reviewerEmail || '',
        creatorName: options.reviewerName || '부장',
        title: options.title,
        startDate: options.startDate,
        endDate: options.endDate,
        content: options.content,
        isWeeklyEvent: options.isWeeklyEvent,
        isWeeklyDeptContent: options.isWeeklyDeptContent,
        isWeeklySchedule: options.isWeeklyEvent || options.isWeeklyDeptContent,
        isMonthlySchedule: options.isMonthlySchedule,
        sendToAcademicCalendar: !!options.sendToAcademicCalendar,
        syncTargetType: options.syncTargetType,
        syncTargetGrade: options.syncTargetGrade,
        isMainSchoolSchedule: options.isMainSchoolSchedule !== false
      });
    } else if (decision === 'closed_internal') {
      // 2. 부서내 종결 -> 자체 종료 업무(sendToAcademicCalendar: false, isMainSchoolSchedule: false)로 일정 생성하여 부서내에만 노출
      await createDepartmentWeeklySchedule({
        deptName: options.deptName,
        creatorEmail: options.reviewerEmail || '',
        creatorName: options.reviewerName || '부장',
        title: options.title,
        startDate: options.startDate,
        endDate: options.endDate,
        content: options.content ? `[부서내 종결] ${options.content}` : '[부서내 자체 종결 업무]',
        isWeeklyEvent: false,
        isWeeklyDeptContent: false,
        isWeeklySchedule: false,
        isMonthlySchedule: false,
        sendToAcademicCalendar: false,
        isMainSchoolSchedule: false
      });
    }

    // 제안 문서 상태 업데이트
    await setDoc(docRef, {
      status: decision,
      reviewComment: options.reviewComment || '',
      reviewedBy: options.reviewerName || '',
      reviewedAt: new Date().toISOString()
    }, { merge: true });

    return { success: true };
  } catch (error: any) {
    console.error('[departmentWeeklyScheduleService] review proposal error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 주간 일정 제안 삭제
 */
export async function deleteWeeklyProposal(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(getProposalsCol(), id));
    return { success: true };
  } catch (error: any) {
    console.error('[departmentWeeklyScheduleService] delete proposal error:', error);
    return { success: false, error: error.message };
  }
}

