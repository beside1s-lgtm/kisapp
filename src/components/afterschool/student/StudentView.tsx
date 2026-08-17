import React, { useState, useEffect } from 'react';
import type { Course, Enrollment, GlobalTimerConfig, QueueTicket } from '@/lib/afterschool/types';
import { Bus, ChevronRight, Lock, Timer, Users, X, CreditCard, FileText, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { getRoutes } from '@/lib/kisbus/routes';
import { getStudents } from '@/lib/kisbus/students';
import { getDocConfig, saveAfterschoolEnrollment, deleteAfterschoolEnrollment, updateAfterschoolCourse, onTeacherApplySettingsUpdate, runAfterschoolEnrollmentTransaction } from '@/lib/services/settingsService';
import type { Route as BusRoute, Student as BusStudent } from '@/lib/kisbus/types';
import type { DocConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';

export const safeParseDate = (dateStr: any): Date => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  try {
    let s = String(dateStr).trim();
    const isPm = s.includes('오후');
    const isAm = s.includes('오전');
    s = s.replace('오전', '').replace('오후', '').replace(/\s+/g, ' ');
    
    const parts = s.split(' ');
    if (parts.length >= 2) {
      const datePart = parts[0].replace(/\./g, '-');
      const timePart = parts[1];
      const timeSpecs = timePart.split(':');
      let hour = parseInt(timeSpecs[0], 10) || 0;
      const min = parseInt(timeSpecs[1], 10) || 0;
      const sec = parseInt(timeSpecs[2], 10) || 0;
      
      if (isPm && hour < 12) hour += 12;
      if (isAm && hour === 12) hour = 0;
      
      const d = new Date(datePart);
      d.setHours(hour, min, sec);
      if (!isNaN(d.getTime())) return d;
    }
    
    const normalized = s.replace(/\./g, '-');
    const parsed = new Date(normalized);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch (err) {
    console.error("safeParseDate error:", err);
  }
  return new Date();
};

export type PeriodGroup = '1~2차시' | '3~4차시' | '1~4차시';

export function getCoursePeriodGroup(course: Course): PeriodGroup {
  const classTime = String(course.classTime || '').trim();
  const title = String(course.title || '').trim();
  const period = String(course.period || '').trim();
  const periodSlot = String(course.periodSlot || '').trim();
  const description = String(course.description || '').trim();
  const combined = `${classTime} ${period} ${title} ${periodSlot} ${description}`.trim();

  // 1. 1~4차시 (전일제 / 통합 / 08:30 ~ 11:40 / 1~4차시) 최우선 판별
  if (
    combined.includes('1~4') || 
    combined.includes('1-4') || 
    combined.includes('1~4차시') || 
    combined.includes('08:30 ~ 11:40') || 
    combined.includes('08:30~11:40') || 
    combined.includes('8:30~11:40') || 
    combined.includes('전일제') || 
    combined.includes('통합')
  ) {
    return '1~4차시';
  }

  // 2. 3~4차시 (10:10 ~ 11:40 / 10:00 ~ 11:40 / 3~4차시 / 3-4차시) 판별
  if (
    combined.includes('3~4') || 
    combined.includes('3-4') || 
    combined.includes('3~4차시') || 
    combined.includes('10:10') || 
    combined.includes('10:00 ~ 11:40') || 
    combined.includes('16:50') || 
    combined.includes('17:00')
  ) {
    return '3~4차시';
  }

  // 3. 1~2차시 (08:30 ~ 10:00 / 1~2차시 / 1-2차시 / 15:00) 판별
  if (
    combined.includes('1~2') || 
    combined.includes('1-2') || 
    combined.includes('1~2차시') || 
    combined.includes('08:30 ~ 10:00') || 
    combined.includes('08:30~10:00') || 
    combined.includes('8:30~10:00') || 
    combined.includes('15:00')
  ) {
    return '1~2차시';
  }

  return '1~2차시';
}

export function cleanClassTime(classTimeStr?: string): string {
  if (!classTimeStr) return '';
  return classTimeStr
    .replace(/\s*\(\s*[0-9]~[0-9]차시\s*\)/g, '')
    .replace(/\s*\(\s*[0-9]-[0-9]차시\s*\)/g, '')
    .replace(/\s*\(\s*전일제\s*\)/g, '')
    .replace(/\s*\(\s*통합\s*\)/g, '')
    .trim();
}

export function shouldForceWaiting(
  targetCourse: Course,
  studentEnrollments: Enrollment[],
  allCourses: Course[]
): { forceWaiting: boolean; reason?: string } {
  const targetPeriodGroup = getCoursePeriodGroup(targetCourse);

  const sortedEnrollments = [...studentEnrollments].sort((a, b) => {
    const tA = a.timestampMs || new Date(a.registrationDate || 0).getTime();
    const tB = b.timestampMs || new Date(b.registrationDate || 0).getTime();
    return tA - tB;
  });

  const appliedDetails = sortedEnrollments.map(e => {
    const c = allCourses.find(course => course.id === e.courseId);
    return {
      enrollment: e,
      course: c,
      periodGroup: c ? getCoursePeriodGroup(c) : '1~2차시'
    };
  }).filter(item => item.course !== undefined);

  // 1. 이미 1~4차시 통합 강좌를 1순위로 신청한 경우 -> 모든 후속 신청은 대기자 처리
  const hasFirstChoice1To4 = appliedDetails.some(item => item.periodGroup === '1~4차시');
  if (hasFirstChoice1To4) {
    return {
      forceWaiting: true,
      reason: '이미 1~4차시 통합 강좌를 신청하셨으므로, 이후 신청 강좌는 대기자 명단으로 등록됩니다.'
    };
  }

  // 2. 신청하려는 강좌가 1~4차시인데, 이미 다른 차시(1~2차시 또는 3~4차시) 강좌를 신청한 경우 -> 대기자 처리
  if (targetPeriodGroup === '1~4차시') {
    if (appliedDetails.length > 0) {
      return {
        forceWaiting: true,
        reason: '이미 다른 차시(1~2차시/3~4차시) 강좌를 신청하셨으므로, 1~4차시 통합 강좌는 대기자 명단으로 등록됩니다.'
      };
    }
  }

  // 3. 동일 차시 그룹(예: 1~2차시)에서 이미 1순위 강좌를 신청한 경우 -> 2순위 강좌는 대기자 처리
  const existingInSameGroup = appliedDetails.filter(item => item.periodGroup === targetPeriodGroup);
  if (existingInSameGroup.length > 0) {
    return {
      forceWaiting: true,
      reason: `이미 ${targetPeriodGroup} 강좌(${existingInSameGroup[0].course?.title})를 1순위로 신청하셨으므로, 동시간대 2순위 신청 강좌는 대기자 명단으로 등록됩니다.`
    };
  }

  return { forceWaiting: false };
}

interface StudentViewProps {
  courses: Course[];
  enrollments: Enrollment[];
  setEnrollments: React.Dispatch<React.SetStateAction<Enrollment[]>>;
  activeStudentTab: 'apply' | 'my';
  setActiveStudentTab: (tab: 'apply' | 'my') => void;
  timerConfig: GlobalTimerConfig;
}

export const StudentView: React.FC<StudentViewProps> = ({
  courses,
  enrollments,
  setEnrollments,
  activeStudentTab,
  setActiveStudentTab,
  timerConfig,
}) => {
  const { profile } = useAuth();
  const router = useRouter();
  const currentStudentId = 's1';

  // Bus & Settings States
  const [busStudents, setBusStudents] = useState<BusStudent[]>([]);
  const [busRoutes, setBusRoutes] = useState<BusRoute[]>([]);
  const [docConfig, setDocConfig] = useState<DocConfig | null>(null);
  const [teacherApplySettings, setTeacherApplySettings] = useState<any>(null);

  // Payment, Syllabus & Finalized Result Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentCourse, setSelectedPaymentCourse] = useState<Course | null>(null);
  const [selectedSyllabusCourse, setSelectedSyllabusCourse] = useState<Course | null>(null);
  const [showFinalizedResultModal, setShowFinalizedResultModal] = useState(false);
  const [needsBusMap, setNeedsBusMap] = useState<Record<string, boolean>>({});
  const [selectedPeriodTab, setSelectedPeriodTab] = useState<'ALL' | PeriodGroup>('ALL');

  useEffect(() => {
    getStudents().then(data => setBusStudents(data));
    getRoutes().then(data => setBusRoutes(data));
    getDocConfig().then(data => setDocConfig(data));
    const unsub = onTeacherApplySettingsUpdate((cfg) => {
      setTeacherApplySettings(cfg);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const isFinalized = docConfig?.isAfterschoolFinalized || (teacherApplySettings as any)?.afterschoolStageStatus === 'CONFIRMED';
    if (isFinalized && profile?.studentName) {
      const closed = localStorage.getItem(`finalizedNoticeClosed_${profile.studentName}`);
      if (!closed) {
        setShowFinalizedResultModal(true);
      }
    }
  }, [docConfig?.isAfterschoolFinalized, teacherApplySettings?.afterschoolStageStatus, profile?.studentName]);

  const getAssignedBusNo = (sName: string) => {
    if (!sName) return null;
    const busStudent = busStudents.find(
      (s) => s.nameKo === sName || s.nameEn === sName || s.name === sName
    );
    if (!busStudent) return null;
    const route = busRoutes.find((r) =>
      r.seating?.some((seat) => seat.studentId === busStudent.id)
    );
    if (!route) return null;
    const busNum = route.busId.replace(/\D/g, '');
    return busNum ? `${busNum}호차` : route.busId;
  };

  const getCalculatedTuition = (target: Course | Enrollment) => {
    if (teacherApplySettings?.tuitionType === '학교예산') return 0;
    const unit = teacherApplySettings?.tuitionPerSession ?? 15000;
    
    let sessions = 10;
    if (target && 'courseId' in target) {
      const matchedCourse = courses.find(c => c.id === target.courseId);
      if (matchedCourse) {
        sessions = matchedCourse.syllabusSessions?.length || 10;
      }
    } else if (target) {
      sessions = target.syllabusSessions?.length || 10;
    }
    return unit * sessions;
  };

  const getCurrencyLabel = (currencyCode: 'KRW' | 'VND' | 'USD') => {
    if (currencyCode === 'VND') return '동';
    if (currencyCode === 'USD') return '달러';
    return '원';
  };

  const formatAmount = (amount: number) => {
    const cur = teacherApplySettings?.tuitionCurrency || 'VND';
    const formatted = amount.toLocaleString();
    if (cur === 'USD') return `${formatted}`;
    return `${formatted} ${getCurrencyLabel(cur)}`;
  };

  // Timer Tick State
  const [nowTime, setNowTime] = useState<Date>(new Date());
  const [queueTicket, setQueueTicket] = useState<QueueTicket | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Time calculations
  const startTime = safeParseDate(timerConfig.startTime).getTime();
  const endTime = safeParseDate(timerConfig.endTime).getTime();
  const nowMs = nowTime.getTime();

  const getProgramName = () => {
    if (!teacherApplySettings) return '방과후학교';
    const y = teacherApplySettings.year || '2026';
    const sem = teacherApplySettings.semester || '1학기';
    if (sem.includes('학기')) {
      return `${y}학년도 제${sem} 방과후학교`;
    }
    return `${y}학년도 ${sem} 방과후학교`;
  };

  const getDetailedStatusText = () => {
    if (!teacherApplySettings) return '수강신청 대기 중';
    const programName = getProgramName();
    const nowMs = nowTime.getTime();

    // 1. 강사 강좌 개설 신청 접수 일정 체크
    const applyStart = safeParseDate(teacherApplySettings.applyStartDate).getTime();
    const applyEnd = safeParseDate(teacherApplySettings.applyEndDate).getTime();
    if (!isNaN(applyStart) && !isNaN(applyEnd) && nowMs >= applyStart && nowMs <= applyEnd) {
      return `${programName} 강사 모집 중`;
    }

    // 2. 수강 신청 중 체크
    const isApplyEnabled = () => {
      if (timerConfig.masterStatus === 'FORCE_LOCK' || timerConfig.masterStatus === 'PAUSED') return false;
      if (timerConfig.masterStatus === 'FORCE_OPEN') return true;
      return !isBeforeStart && !isAfterEnd;
    };

    if (isApplyEnabled()) {
      return `${programName} 수강신청 진행 중`;
    }

    // 3. 운영 시작일 ~ 운영 종료일 체크
    const opStart = new Date(teacherApplySettings.operatingStartDate || '').getTime();
    const opEnd = new Date(teacherApplySettings.operatingEndDate || '').getTime();
    if (!isNaN(opStart) && !isNaN(opEnd)) {
      if (nowMs >= opStart && nowMs <= opEnd) {
        return `${programName} 운영 중`;
      }
      if (nowMs > opEnd) {
        return `${programName} 운영 종료`;
      }
    }

    // 4. 수강 신청 대기 중
    if (nowMs < startTime) {
      return `${programName} 수강신청 대기 중`;
    }

    return `${programName} 수강신청 불가`;
  };

  const isBeforeStart = nowMs < startTime;
  const isAfterEnd = nowMs > endTime;

  const secondsUntilStart = Math.max(0, Math.floor((startTime - nowMs) / 1000));

  const formatCountdown = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isApplyEnabled = () => {
    if (timerConfig.masterStatus === 'FORCE_LOCK' || timerConfig.masterStatus === 'PAUSED') return false;
    if (timerConfig.masterStatus === 'FORCE_OPEN') return true;
    return !isBeforeStart && !isAfterEnd;
  };

  useEffect(() => {
    if (!isApplyEnabled() && activeStudentTab === 'apply') {
      setActiveStudentTab('my');
    }
  }, [nowTime, timerConfig, activeStudentTab]);

  const handleApplyCourseWithQueue = (course: Course) => {
    if (!isApplyEnabled()) {
      alert('현재 수강 신청 가능 시간이 아니거나 관리자에 의해 신청이 잠겨있습니다.');
      return;
    }

    const isEnrolledAlready = enrollments.some(
      (e) => e.courseId === course.id && e.studentId === currentStudentId && e.status === 'ENROLLED'
    );
    if (isEnrolledAlready) {
      alert('이미 수강 신청 완료된 강좌입니다.');
      return;
    }

    const isWaitingAlready = enrollments.some(
      (e) => e.courseId === course.id && e.studentId === currentStudentId && e.status === 'WAITING'
    );
    if (isWaitingAlready) {
      alert('이미 대기 신청 접수된 강좌입니다.');
      return;
    }

    const randomPos = Math.floor(Math.random() * 25) + 3;
    const ticket: QueueTicket = {
      ticketId: `t_${Date.now()}`,
      studentId: currentStudentId,
      studentName: profile?.studentName || '홍길동',
      courseId: course.id,
      position: randomPos,
      totalInQueue: randomPos + 40,
      estimatedWaitSec: Math.ceil(randomPos / 10),
      status: 'WAITING',
      createdAtMs: Date.now(),
    };

    setQueueTicket(ticket);

    let pos = randomPos;
    const interval = setInterval(() => {
      pos -= 5;
      if (pos <= 0) {
        clearInterval(interval);
        setQueueTicket(null);

        const enrollmentId = `e_student_${Date.now()}`;
        const needsBus = needsBusMap[course.id] || false;
        const studentProfile = {
          name: profile?.studentName || '홍길동',
          phone: profile?.parentPhone || '010-1234-5678',
          parentPhone: profile?.parentPhone || '010-5678-1234',
          kisbusNo: needsBus ? '신청' : '-',
        };

        const forceInfo = shouldForceWaiting(course, myEnrollments, courses);

        runAfterschoolEnrollmentTransaction(
          enrollmentId,
          course.id,
          currentStudentId,
          studentProfile,
          course.tuition,
          course.textbookFee || 0,
          course.materialFee || 0,
          forceInfo.forceWaiting
        ).then((res) => {
          if (res.success) {
            if (res.status === 'ENROLLED') {
              alert(`🎉 수강 신청에 성공하였습니다! ('${course.title}') - 1순위 선착순 명단 등록`);
            } else {
              if (forceInfo.forceWaiting) {
                alert(`⏳ [대기자 등록 완료]\n${forceInfo.reason || '동일 시간대 2순위 신청으로 대기자 명단에 등록되었습니다.'}`);
              } else {
                alert(`⏳ [대기자 등록 완료]\n'${course.title}' 강좌 정원이 마감되어 대기자 명단으로 등록되었습니다.`);
              }
            }
          } else {
            alert(`수강 신청 처리 중 오류가 발생했습니다: ${res.error || '알 수 없는 오류'}`);
          }
        });
      } else {
        setQueueTicket((prev) =>
          prev ? { ...prev, position: pos, estimatedWaitSec: Math.ceil(pos / 10) } : null
        );
      }
    }, 400);
  };

  const handleCancelEnrollment = async (enrollment: Enrollment) => {
    if (!confirm('정말로 해당 강좌의 수강 신청(또는 대기 신청)을 취소하시겠습니까?')) return;
    try {
      const res = await deleteAfterschoolEnrollment(enrollment.id);
      if (res && res.message) {
        alert(res.message);
      } else {
        alert('신청 취소가 성공적으로 처리되었습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('신청 취소 처리 중 오류가 발생했습니다.');
    }
  };

  const myEnrollments = enrollments.filter((e) => e.studentId === currentStudentId);

  return (
    <div className="space-y-6">
      {/* Realtime Countdown Banner */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">수강신청 진행 현황</div>
            <div className="text-sm font-bold text-slate-800">
              {getDetailedStatusText()}
            </div>
          </div>
        </div>

        {/* Digital Clock */}
        <div className="font-mono text-xs">
          {isBeforeStart ? (
            <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg font-bold text-sm">
              {formatCountdown(secondsUntilStart)}
            </span>
          ) : (
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg font-bold">
              {timerConfig.masterStatus === 'FORCE_LOCK' ? '신청 잠김' : '신청 가능'}
            </span>
          )}
        </div>
      </div>

      {/* 수강신청 결과 최종 확정 공지 배너 */}
      {(docConfig?.isAfterschoolFinalized || (teacherApplySettings as any)?.afterschoolStageStatus === 'CONFIRMED') && (
        <div className="bg-violet-600 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold shrink-0 text-base">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-sm">2026학년도 1학기 방과후학교 수강신청 결과가 최종 확정되었습니다!</h4>
              <p className="text-xs text-violet-100 mt-0.5">
                수강 확정 및 대기자 배정이 정정 완료되었습니다. 확정 결과를 확인해보세요.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowFinalizedResultModal(true)}
            className="bg-white text-violet-700 hover:bg-violet-50 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition shadow-2xs cursor-pointer"
          >
            확정 결과 팝업 알림 보기
          </button>
        </div>
      )}

      {/* Student Banner Info */}
      <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-xs font-semibold text-indigo-200">{getProgramName()} 포털</div>
          <h2 className="text-xl font-bold mt-1">
            {profile?.studentGrade || '1'}학년 {profile?.studentClass || '1'}반 {profile?.studentNumber || '1'}번 {profile?.studentName || '홍길동'} 학생
          </h2>
        </div>

        <div className="flex gap-2">
          {isApplyEnabled() && (
            <button
              onClick={() => setActiveStudentTab('apply')}
              className={`px-3.5 py-2 rounded-lg font-bold text-xs transition ${
                activeStudentTab === 'apply'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'bg-indigo-700 text-white hover:bg-indigo-800'
              }`}
            >
              강좌 수강신청
            </button>
          )}
          <button
            onClick={() => setActiveStudentTab('my')}
            className={`px-3.5 py-2 rounded-lg font-bold text-xs transition ${
              activeStudentTab === 'my'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'bg-indigo-700 text-white hover:bg-indigo-800'
            }`}
          >
            내 신청내역 ({myEnrollments.length}건)
          </button>
        </div>
      </div>

      {/* Tab 1: Course Apply List */}
      {activeStudentTab === 'apply' && (
        <div className="space-y-4">
          {/* 차시별 강좌 그룹 분류 탭 툴바 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-800">개설 강좌 목록</h3>
                <span className="text-[11px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-md border border-indigo-200/80 whitespace-nowrap">
                  수강료 & 시간 — 1~2차시/3~4차시: 800,000동 (08:30~10:00 / 10:10~11:40) | 1~4차시: 800,000동 (08:30~11:40)
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                동시간대(차시) 1순위 강좌는 수강 명단 선착순 배정, 2순위 이상 강좌는 대기자 명단으로 자동 분류됩니다.
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/70 shrink-0">
              {[
                { id: 'ALL', label: '전체 강좌', count: courses.length },
                { id: '1~2차시', label: '1~2차시', count: courses.filter(c => getCoursePeriodGroup(c) === '1~2차시').length },
                { id: '3~4차시', label: '3~4차시', count: courses.filter(c => getCoursePeriodGroup(c) === '3~4차시').length },
                { id: '1~4차시', label: '1~4차시 (통합)', count: courses.filter(c => getCoursePeriodGroup(c) === '1~4차시').length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedPeriodTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                    selectedPeriodTab === tab.id
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    selectedPeriodTab === tab.id ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 세로 목록형 개설 강좌 리스트 */}
          <div className="space-y-2.5">
            {courses
              .filter(c => selectedPeriodTab === 'ALL' || getCoursePeriodGroup(c) === selectedPeriodTab)
              .map((course) => {
                const myRecord = myEnrollments.find((e) => e.courseId === course.id);
                const isFull = course.currentStudents >= course.maxStudents;
                const isLocked = course.isForceLocked || !isApplyEnabled();
                const periodGroup = getCoursePeriodGroup(course);
                const forceInfo = shouldForceWaiting(course, myEnrollments, courses);
                const instructorName = course.instructorName || course.teacherName || '담당 교사';

                return (
                  <div
                    key={course.id}
                    className="bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:border-indigo-300 transition p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3"
                  >
                    {/* 1. 좌측 강좌 필수 정보 컬럼 그룹 (고정 너비 컬럼 정렬) */}
                    <div className="flex flex-wrap md:flex-nowrap items-center gap-3 flex-1 min-w-0">
                      {/* 컬럼 1: 차시 및 모집 상태 배지 (고정 너비: w-[180px]) */}
                      <div className="flex items-center gap-1.5 w-[180px] shrink-0">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${
                          periodGroup === '1~2차시' 
                            ? 'bg-amber-50 text-amber-900 border-amber-200' 
                            : periodGroup === '3~4차시'
                              ? 'bg-purple-50 text-purple-900 border-purple-200'
                              : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                        }`}>
                          {periodGroup}
                        </span>

                        {isFull ? (
                          <span className="text-[11px] bg-rose-50 text-rose-700 border border-rose-200 font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
                            마감 ({course.currentStudents}/{course.maxStudents})
                          </span>
                        ) : (
                          <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
                            신청가능 ({course.currentStudents}/{course.maxStudents})
                          </span>
                        )}
                      </div>

                      {/* 컬럼 2: 강좌명 및 강사명 (가변 가득 채움: flex-1) */}
                      <div className="flex items-center gap-2 flex-1 min-w-[220px] overflow-hidden">
                        <h4 className="text-sm font-bold text-slate-900 truncate whitespace-nowrap">{course.title}</h4>
                        <span className="text-xs text-slate-500 font-medium whitespace-nowrap shrink-0">
                          👤 강사: {instructorName}
                        </span>
                      </div>
                    </div>

                    {/* 2. 우측 제어 및 액션 버튼 컬럼 그룹 (수직 수평 100% 칼정렬) */}
                    <div className="flex items-center gap-2 shrink-0 justify-end">
                      {/* 컬럼 4: 스쿨버스 귀가 체크박스 (컴팩트 고정 너비: w-[80px]) */}
                      <div className="w-[80px] shrink-0 flex items-center justify-end">
                        {!myRecord && !isLocked ? (
                          <div className="flex items-center gap-1 px-1.5 py-1 bg-slate-50 rounded-lg border border-slate-200/80 whitespace-nowrap">
                            <input
                              type="checkbox"
                              id={`bus-check-${course.id}`}
                              checked={needsBusMap[course.id] || false}
                              onChange={(e) => {
                                const val = e.target.checked;
                                setNeedsBusMap(prev => ({ ...prev, [course.id]: val }));
                              }}
                              className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <label
                              htmlFor={`bus-check-${course.id}`}
                              className="text-[11px] font-bold text-slate-700 cursor-pointer select-none whitespace-nowrap"
                            >
                              버스
                            </label>
                          </div>
                        ) : (
                          <div className="w-[80px]" />
                        )}
                      </div>

                      {/* 컬럼 5: 강의계획서 버튼 (고정 너비: w-[100px]) */}
                      <div className="w-[100px] shrink-0 flex items-center justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSyllabusCourse(course)}
                          className="text-xs h-8 px-2.5 font-bold text-slate-700 border-slate-300 hover:bg-slate-50 whitespace-nowrap rounded-lg w-full"
                        >
                          <FileText className="w-3.5 h-3.5 mr-1 text-slate-500" />
                          계획서
                        </Button>
                      </div>

                      {/* 컬럼 6: 수강신청 / 대기신청 버튼 (고정 너비: w-[170px]) */}
                      <div className="w-[170px] shrink-0 flex flex-col items-end justify-center relative">
                        {forceInfo.forceWaiting && !myRecord && !isLocked && (
                          <span className="text-[9px] text-amber-700 font-bold whitespace-nowrap absolute -top-4 right-0">
                            2순위 대기자 배치
                          </span>
                        )}
                        {myRecord ? (
                          <div className="w-full px-2 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 text-center whitespace-nowrap">
                            {myRecord.status === 'ENROLLED' ? '신청 완료 (수강)' : '대기 접수 완료'}
                          </div>
                        ) : isLocked ? (
                          <button
                            disabled
                            className="w-full px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-400 flex items-center justify-center gap-1 cursor-not-allowed whitespace-nowrap"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            {isBeforeStart ? `대기중 (${formatCountdown(secondsUntilStart)})` : '신청 잠김'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleApplyCourseWithQueue(course)}
                            className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition flex items-center justify-center gap-1 whitespace-nowrap ${
                              forceInfo.forceWaiting || isFull
                                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                          >
                            {forceInfo.forceWaiting ? '대기자 신청 (2순위)' : isFull ? '대기자 신청 (마감)' : '수강 신청 (1순위)'}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tab 2: My Enrollments View */}
      {activeStudentTab === 'my' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h4 className="font-bold text-slate-900 text-sm">신청한 강좌 목록</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 font-bold text-slate-700 border-b">
                  <tr>
                    <th className="p-3">강좌명</th>
                    <th className="p-3">강의시간</th>
                    <th className="p-3 text-right">수강료</th>
                    <th className="p-3 text-center">신청 상태</th>
                    <th className="p-3 text-center">버스 번호</th>
                    <th className="p-3 text-center">신청 취소</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {myEnrollments.map((item) => {
                    const course = courses.find((c) => c.id === item.courseId);
                    const busNo = getAssignedBusNo(profile?.studentName || '홍길동');

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{course?.title}</span>
                            {course && (
                              <button
                                onClick={() => setSelectedSyllabusCourse(course)}
                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1 transition"
                              >
                                <FileText className="w-3 h-3" />
                                계획서
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600">{course?.classTime}</td>
                        <td className="p-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono font-bold text-indigo-600">
                              {formatAmount(getCalculatedTuition(item))}
                            </span>
                            {item.status === 'ENROLLED' && (
                              <button
                                onClick={() => {
                                  if (course) {
                                    setSelectedPaymentCourse(course);
                                    setShowPaymentModal(true);
                                  }
                                }}
                                className="px-2.5 py-1 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded transition-colors"
                              >
                                납부
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {item.status === 'ENROLLED' ? (
                            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded font-bold">
                              수강등록
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-bold">
                              대기자
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {busNo ? (
                            <button
                              onClick={() => router.push(`/parents/bus/student?name=${encodeURIComponent(profile?.studentName || '홍길동')}`)}
                              className="text-blue-600 hover:text-blue-800 underline font-bold font-mono text-[11px]"
                            >
                              {busNo}
                            </button>
                          ) : (
                            <span className="text-slate-400 font-medium text-[11px]">미등록</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleCancelEnrollment(item)}
                            className="px-2 py-1 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded transition-colors"
                          >
                            신청 취소
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 납부 안내 모달 */}
      {showPaymentModal && selectedPaymentCourse && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => {
                setShowPaymentModal(false);
                setSelectedPaymentCourse(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 border-b pb-4">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-headline">수강료 납부 안내</h3>
                <p className="text-xs text-slate-500 mt-0.5">신청하신 방과후학교 강좌의 수강료를 납부해주세요.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>강좌명</span>
                  <span className="font-bold text-slate-800">{selectedPaymentCourse.title}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>강의 시간</span>
                  <span className="text-slate-700">{selectedPaymentCourse.classTime}</span>
                </div>
                <div className="h-px bg-slate-200 my-2"></div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-bold">총 결제 금액</span>
                  <span className="text-lg font-extrabold text-indigo-600 font-mono">
                    {formatAmount(getCalculatedTuition(selectedPaymentCourse))}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-700 block">납부 계좌</span>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-800 select-all">
                    {docConfig?.afterschoolAccount || '미등록'}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-700 block">간편 납부 QR 코드</span>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center justify-center min-h-[160px]">
                    {docConfig?.afterschoolQrImage ? (
                      <div className="space-y-2 text-center">
                        <img 
                          src={docConfig.afterschoolQrImage} 
                          alt="납부 QR코드" 
                          className="h-32 w-32 object-contain mx-auto border bg-white p-1 rounded-lg" 
                        />
                        <span className="text-[10px] text-slate-400 block">카메라 앱 또는 은행 앱에서 QR 코드를 스캔하세요.</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">미등록</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedPaymentCourse(null);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                확인
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 1,000명 동시접속 대기열 순번표 모달 */}
      {queueTicket && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 p-6 space-y-4 text-center">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center mx-auto">
              <Users className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">접속자 폭주 대기 중</h3>
              <p className="text-xs text-slate-500 mt-1">
                순서대로 수강 신청 처리가 진행되고 있습니다.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <div className="text-xs text-slate-500 font-medium">대기 순번</div>
              <div className="text-3xl font-black text-indigo-600 font-mono">
                {queueTicket.position} <span className="text-xs text-slate-500 font-normal">번</span>
              </div>
              <div className="text-[11px] text-slate-400">
                예상 대기 시간: 약 {queueTicket.estimatedWaitSec}초
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 강의계획서 (Syllabus) 모달 */}
      {selectedSyllabusCourse && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 p-6 space-y-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  {getCoursePeriodGroup(selectedSyllabusCourse)}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedSyllabusCourse.title}</h3>
              </div>
              <button 
                onClick={() => setSelectedSyllabusCourse(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div><b className="text-slate-700">담당 강사:</b> {selectedSyllabusCourse.instructorName || selectedSyllabusCourse.teacherName || '담당 교사'}</div>
                <div><b className="text-slate-700">수업 장소:</b> {selectedSyllabusCourse.classroom || '지정 교실'}</div>
                <div><b className="text-slate-700">강의 시간:</b> {selectedSyllabusCourse.classTime}</div>
                <div><b className="text-slate-700">수강료:</b> <span className="font-bold text-indigo-600">{formatAmount(getCalculatedTuition(selectedSyllabusCourse))}</span></div>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  강좌 소개 및 운영 목표
                </h4>
                <p className="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">
                  {selectedSyllabusCourse.description || '강좌 개요 및 교육 목표 정보입니다.'}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs">
                    차시별 수업 계획 및 수업 날짜 ({selectedSyllabusCourse.syllabusSessions?.length || 0}차시)
                  </h4>
                </div>
                {selectedSyllabusCourse.syllabusSessions && selectedSyllabusCourse.syllabusSessions.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 font-bold text-slate-700">
                        <tr>
                          <th className="p-2.5 border-b w-16 text-center whitespace-nowrap">차시</th>
                          <th className="p-2.5 border-b w-24 text-center whitespace-nowrap">수업 일자</th>
                          <th className="p-2.5 border-b whitespace-nowrap">수업 주제 및 주요 학습 활동 내용</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {selectedSyllabusCourse.syllabusSessions.map((s) => (
                          <tr key={s.sessionNo} className="hover:bg-slate-50">
                            <td className="p-2.5 text-center font-bold text-indigo-700 font-mono whitespace-nowrap">{s.sessionNo}차시</td>
                            <td className="p-2.5 text-center font-mono text-slate-600 whitespace-nowrap bg-slate-50/50">
                              {s.dateStr || '-'}
                            </td>
                            <td className="p-2.5 text-slate-800 font-medium">{s.topic || '수업 계획 작성 중'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs italic bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                    세부 차시별 강의계획서 파일 준비 중입니다.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end">
              <Button 
                onClick={() => setSelectedSyllabusCourse(null)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4"
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* 수강신청 최종 확정 결과 안내 모달 팝업 */}
      {showFinalizedResultModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 p-6 space-y-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-base">
                  🎉
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">방과후학교 수강신청 최종 확정 결과</h3>
                  <p className="text-xs text-slate-500">{profile?.studentName || '학생'} 님의 최종 배정 결과입니다.</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  if (profile?.studentName) {
                    localStorage.setItem(`finalizedNoticeClosed_${profile.studentName}`, 'true');
                  }
                  setShowFinalizedResultModal(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 text-xs">
              {/* 학생 인적사항 */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-800">
                  👤 대상 학생: {profile?.studentGrade || '1'}학년 {profile?.studentClass || '1'}반 {profile?.studentName || '학생'}
                </span>
                <span className="bg-violet-100 text-violet-800 font-bold px-2 py-0.5 rounded-md text-[11px]">
                  결과 확정 완료
                </span>
              </div>

              {/* 🟢 수강 확정 (ENROLLED) 강좌 목록 */}
              <div className="space-y-2">
                <h4 className="font-bold text-emerald-800 text-xs flex items-center gap-1.5">
                  🟢 최종 수강 확정 강좌 ({myEnrollments.filter(e => e.status === 'ENROLLED').length}건)
                </h4>
                {myEnrollments.filter(e => e.status === 'ENROLLED').length > 0 ? (
                  <div className="space-y-2">
                    {myEnrollments.filter(e => e.status === 'ENROLLED').map((item) => {
                      const course = courses.find(c => c.id === item.courseId);
                      if (!course) return null;
                      const pGroup = getCoursePeriodGroup(course);
                      const busNo = getAssignedBusNo(profile?.studentName || '');

                      return (
                        <div key={item.id} className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-900 text-sm">{course.title}</span>
                            <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                              ✓ 수강 확정 (출석부 배정)
                            </span>
                          </div>
                          <div className="text-slate-600 font-mono text-[11px] flex items-center gap-2">
                            <span>{pGroup}</span>
                            <span>•</span>
                            <span>강사: {course.instructorName || course.teacherName || '담당 교사'}</span>
                          </div>
                          {item.needsBus && (
                            <div className="text-[11px] text-indigo-700 font-bold pt-1 border-t border-emerald-200/60">
                              귀가 스쿨버스 탑승 신청됨 {busNo ? `(${busNo} 배정)` : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                    최종 수강 확정된 강좌가 없습니다.
                  </p>
                )}
              </div>

              {/* ⏳ 대기 접수 (WAITING) 강좌 목록 */}
              {myEnrollments.filter(e => e.status === 'WAITING').length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-amber-800 text-xs flex items-center gap-1.5">
                    ⏳ 대기 접수 강좌 ({myEnrollments.filter(e => e.status === 'WAITING').length}건)
                  </h4>
                  <div className="space-y-2">
                    {myEnrollments.filter(e => e.status === 'WAITING').map((item) => {
                      const course = courses.find(c => c.id === item.courseId);
                      if (!course) return null;
                      const pGroup = getCoursePeriodGroup(course);

                      return (
                        <div key={item.id} className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-900 text-sm">{course.title}</span>
                            <span className="text-[11px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md">
                              ⏳ 대기 순번 접수중
                            </span>
                          </div>
                          <div className="text-slate-600 font-mono text-[11px]">
                            <span>{pGroup}</span> • <span>수강 취소자 발생 시 순서대로 자동 승격됩니다.</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 수강료 납부 계좌 안내 */}
              <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-1">
                <span className="font-bold text-indigo-900 block text-xs">💳 방과후학교 수강료 납부 계좌 안내</span>
                <div className="font-mono font-bold text-indigo-800 text-xs select-all bg-white p-2.5 rounded-lg border border-indigo-100">
                  {docConfig?.afterschoolAccount || '미등록 (스쿨뱅킹 자동 수납)'}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end">
              <Button 
                onClick={() => {
                  if (profile?.studentName) {
                    localStorage.setItem(`finalizedNoticeClosed_${profile.studentName}`, 'true');
                  }
                  setShowFinalizedResultModal(false);
                }}
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs px-5 rounded-xl shadow-xs"
              >
                확인 완료
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
