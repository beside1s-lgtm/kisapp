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
import { useTranslation } from '@/hooks/use-translation';

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

export type PeriodGroup = '8~9차시' | '1~2차시' | '3~4차시' | '1~4차시';

export function getCoursePeriodGroup(course: Course): PeriodGroup {
  const classTime = String(course.classTime || '').trim();
  const title = String(course.title || '').trim();
  const period = String(course.period || '').trim();
  const periodSlot = String(course.periodSlot || '').trim();
  const description = String(course.description || '').trim();
  const classDays = Array.isArray(course.classDays) ? course.classDays : [];
  const isSaturday = classDays.some(d => d.includes('토') || d.toLowerCase().includes('sat'));

  const combined = `${classTime} ${period} ${title} ${periodSlot} ${description}`.trim();

  // 1. 8~9차시 (평일 방과후 15:00~16:30 / 15:10~16:30 / 8~9차시 / 8-9차시)
  if (
    combined.includes('8~9') || 
    combined.includes('8-9') || 
    combined.includes('8,9') || 
    combined.includes('8~9차시') || 
    combined.includes('15:10') || 
    combined.includes('15:00') || 
    combined.includes('16:30') ||
    (!isSaturday && !combined.includes('08:30') && !combined.includes('10:10') && !combined.includes('1~4') && !combined.includes('1-4'))
  ) {
    return '8~9차시';
  }

  // 2. 1~4차시 (토요/방학 4차시 통합 / 08:30 ~ 11:40 / 1~4차시 / 전일제)
  if (
    combined.includes('1~4') || 
    combined.includes('1-4') || 
    combined.includes('1~4차시') || 
    combined.includes('11:40') || 
    combined.includes('전일제') || 
    combined.includes('통합')
  ) {
    return '1~4차시';
  }

  // 3. 3~4차시 (토요/방학 10:10 ~ 11:40 / 3~4차시 / 3-4차시)
  if (
    combined.includes('3~4') || 
    combined.includes('3-4') || 
    combined.includes('3~4차시') || 
    combined.includes('10:10')
  ) {
    return '3~4차시';
  }

  // 4. 1~2차시 (토요/방학 08:30 ~ 10:00 / 1~2차시 / 1-2차시)
  if (
    combined.includes('1~2') || 
    combined.includes('1-2') || 
    combined.includes('1~2차시') || 
    combined.includes('08:30') || 
    combined.includes('8:30')
  ) {
    return '1~2차시';
  }

  return isSaturday ? '1~2차시' : '8~9차시';
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
  const targetDays = Array.isArray(targetCourse.classDays) ? targetCourse.classDays : ['월'];

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
      periodGroup: c ? getCoursePeriodGroup(c) : '8~9차시',
      classDays: c && Array.isArray(c.classDays) ? c.classDays : ['월'],
    };
  }).filter(item => item.course !== undefined);

  // 1. 토요일: 이미 1~4차시 통합 강좌를 1순위로 신청한 경우 -> 토요 후속 신청은 대기자 처리
  const hasFirstChoice1To4 = appliedDetails.some(item => 
    item.periodGroup === '1~4차시' && item.classDays.some(d => targetDays.includes(d))
  );
  if (hasFirstChoice1To4) {
    return {
      forceWaiting: true,
      reason: '이미 1~4차시 통합 강좌를 신청하셨으므로, 이후 신청 강좌는 대기자 명단으로 등록됩니다.'
    };
  }

  // 2. 토요일: 신청하려는 강좌가 1~4차시인데, 이미 토요일 다른 차시(1~2차시 또는 3~4차시) 강좌를 신청한 경우 -> 대기자 처리
  if (targetPeriodGroup === '1~4차시') {
    const hasSatOther = appliedDetails.some(item => item.classDays.some(d => targetDays.includes(d)));
    if (hasSatOther) {
      return {
        forceWaiting: true,
        reason: '이미 다른 차시(1~2차시/3~4차시) 강좌를 신청하셨으므로, 1~4차시 통합 강좌는 대기자 명단으로 등록됩니다.'
      };
    }
  }

  // 3. 동일 요일 + 동일 차시 그룹(예: 월요일 8~9차시 또는 토요일 1~2차시)에서 이미 1순위 강좌를 신청한 경우 -> 2순위 강좌는 대기자 처리
  const existingInSameSlot = appliedDetails.filter(item => 
    item.periodGroup === targetPeriodGroup && item.classDays.some(d => targetDays.includes(d))
  );
  if (existingInSameSlot.length > 0) {
    return {
      forceWaiting: true,
      reason: `이미 해당 요일 ${targetPeriodGroup} 강좌(${existingInSameSlot[0].course?.title})를 1순위로 신청하셨으므로, 동시간대 2순위 신청 강좌는 대기자 명단으로 등록됩니다.`
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
  const { t, i18n } = useTranslation();
  const currentStudentName = (profile?.studentName || profile?.name || '').trim();
  const currentStudentId = profile?.uid || profile?.email || (currentStudentName ? `s_${currentStudentName}` : 's1');

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

  const formatClassDaysAndTimes = (course: Course | undefined, fallbackPeriodGroup?: PeriodGroup) => {
    if (!course) return '';
    const rawDays = Array.isArray(course.classDays) && course.classDays.length > 0 ? course.classDays : ['월'];
    const pGroup = fallbackPeriodGroup || getCoursePeriodGroup(course);

    const isVi = i18n?.language === 'vi';
    const isEn = i18n?.language === 'en';

    const dayMapVi: Record<string, string> = {
      '월': 'Thứ 2', '월요일': 'Thứ 2', 'Mon': 'Thứ 2', 'Monday': 'Thứ 2',
      '화': 'Thứ 3', '화요일': 'Thứ 3', 'Tue': 'Thứ 3', 'Tuesday': 'Thứ 3',
      '수': 'Thứ 4', '수요일': 'Thứ 4', 'Wed': 'Thứ 4', 'Wednesday': 'Thứ 4',
      '목': 'Thứ 5', '목요일': 'Thứ 5', 'Thu': 'Thứ 5', 'Thursday': 'Thứ 5',
      '금': 'Thứ 6', '금요일': 'Thứ 6', 'Fri': 'Thứ 6', 'Friday': 'Thứ 6',
      '토': 'Thứ 7', '토요일': 'Thứ 7', 'Sat': 'Thứ 7', 'Saturday': 'Thứ 7',
      '일': 'Chủ Nhật', '일요일': 'Chủ Nhật', 'Sun': 'Chủ Nhật', 'Sunday': 'Chủ Nhật',
    };

    const dayMapEn: Record<string, string> = {
      '월': 'Mon', '월요일': 'Mon', 'Mon': 'Mon', 'Monday': 'Mon',
      '화': 'Tue', '화요일': 'Tue', 'Tue': 'Tue', 'Tuesday': 'Tue',
      '수': 'Wed', '수요일': 'Wed', 'Wed': 'Wed', 'Wednesday': 'Wed',
      '목': 'Thu', '목요일': 'Thu', 'Thu': 'Thu', 'Thursday': 'Thu',
      '금': 'Fri', '금요일': 'Fri', 'Fri': 'Fri', 'Friday': 'Fri',
      '토': 'Sat', '토요일': 'Sat', 'Sat': 'Sat', 'Saturday': 'Sat',
      '일': 'Sun', '일요일': 'Sun', 'Sun': 'Sun', 'Sunday': 'Sun',
    };

    const dayMapKo: Record<string, string> = {
      '월': '월요일', '월요일': '월요일', 'Mon': '월요일',
      '화': '화요일', '화요일': '화요일', 'Tue': '화요일',
      '수': '수요일', '수요일': '수요일', 'Wed': '수요일',
      '목': '목요일', '목요일': '목요일', 'Thu': '목요일',
      '금': '금요일', '금요일': '금요일', 'Fri': '금요일',
      '토': '토요일', '토요일': '토요일', 'Sat': '토요일',
      '일': '일요일', '일요일': '일요일', 'Sun': '일요일',
    };

    const currentMap = isVi ? dayMapVi : isEn ? dayMapEn : dayMapKo;
    const translatedDays = rawDays.map(d => currentMap[d.trim()] || d).join(', ');

    let timeStr = course.classTime || (
      pGroup === '8~9차시' ? '15:10~16:30' : 
      pGroup === '1~4차시' ? '08:30~11:40' : 
      pGroup === '3~4차시' ? '10:10~11:40' : 
      '08:30~10:00'
    );

    if (isVi) {
      timeStr = timeStr.replace(/(\d+~\d+)차시/g, 'Tiết $1').replace(/(\d+)차시/g, 'Tiết $1');
    } else if (isEn) {
      timeStr = timeStr.replace(/(\d+~\d+)차시/g, 'Periods $1').replace(/(\d+)차시/g, 'Period $1');
    }

    return `${translatedDays} ${timeStr}`;
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
    if (i18n?.language === 'vi') {
      return `Ngoại khóa Học kỳ ${sem.replace(/\D/g, '') || '1'} Năm ${y}`;
    }
    if (i18n?.language === 'en') {
      return `${y} Semester ${sem.replace(/\D/g, '') || '1'} After-School`;
    }
    if (sem.includes('학기')) {
      return `${y}학년도 제${sem} 방과후학교`;
    }
    return `${y}학년도 ${sem} 방과후학교`;
  };

  const getDetailedStatusText = () => {
    const programName = getProgramName();
    if (!teacherApplySettings) return t('afterschool.status_waiting', { program: programName }) || '수강신청 대기 중';
    const nowMs = nowTime.getTime();

    // 1. 강사 강좌 개설 신청 접수 일정 체크
    const applyStart = safeParseDate(teacherApplySettings.applyStartDate).getTime();
    const applyEnd = safeParseDate(teacherApplySettings.applyEndDate).getTime();
    if (!isNaN(applyStart) && !isNaN(applyEnd) && nowMs >= applyStart && nowMs <= applyEnd) {
      return t('afterschool.status_recruiting', { program: programName }) || `${programName} 강사 모집 중`;
    }

    // 2. 수강 신청 중 체크
    const isApplyEnabled = () => {
      if (timerConfig.masterStatus === 'FORCE_LOCK' || timerConfig.masterStatus === 'PAUSED') return false;
      if (timerConfig.masterStatus === 'FORCE_OPEN') return true;
      return !isBeforeStart && !isAfterEnd;
    };

    if (isApplyEnabled()) {
      return t('afterschool.status_applying', { program: programName }) || `${programName} 수강신청 진행 중`;
    }

    // 3. 운영 시작일 ~ 운영 종료일 체크
    const opStart = new Date(teacherApplySettings.operatingStartDate || '').getTime();
    const opEnd = new Date(teacherApplySettings.operatingEndDate || '').getTime();
    if (!isNaN(opStart) && !isNaN(opEnd)) {
      if (nowMs >= opStart && nowMs <= opEnd) {
        return t('afterschool.status_operating', { program: programName }) || `${programName} 운영 중`;
      }
      if (nowMs > opEnd) {
        return t('afterschool.status_closed', { program: programName }) || `${programName} 운영 종료`;
      }
    }

    // 4. 수강 신청 대기 중
    if (nowMs < startTime) {
      return t('afterschool.status_waiting', { program: programName }) || `${programName} 수강신청 대기 중`;
    }

    return t('afterschool.status_disabled', { program: programName }) || `${programName} 수강신청 불가`;
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
        const needsBus = course.hasBusOption ? (needsBusMap[course.id] || false) : false;
        const studentProfile = {
          name: currentStudentName || profile?.studentName || profile?.name || '홍길동',
          grade: Number(profile?.studentGrade) || 1,
          classNum: Number(profile?.studentClass) || 1,
          studentNum: Number(profile?.studentNumber) || 1,
          phone: profile?.parentPhone || '',
          parentPhone: profile?.parentPhone || '',
          kisbusNo: needsBus ? '신청' : '-',
          needsBus: needsBus,
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

  const myEnrollments = enrollments.filter((e) => {
    // 1. studentId 일치
    if (e.studentId && (e.studentId === currentStudentId || e.studentId === profile?.uid || e.studentId === profile?.email)) {
      return true;
    }
    // 2. 학생 이름 + 학년/반 일치 (로그인 학생 정보가 있는 경우)
    if (currentStudentName && e.name === currentStudentName) {
      if (profile?.studentGrade && String(e.grade) !== String(profile.studentGrade)) return false;
      if (profile?.studentClass && String(e.classNum) !== String(profile.studentClass)) return false;
      return true;
    }
    // 3. 로그인 정보가 전혀 없을 때만 s1 fallback
    if (!currentStudentName && !profile?.email && e.studentId === 's1') {
      return true;
    }
    return false;
  });

  return (
    <div className="space-y-6">
      {/* Realtime Countdown Banner */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3 w-full max-w-full min-w-0 overflow-hidden flex-wrap md:flex-nowrap">
        <div className="flex items-center gap-3 min-w-[180px] w-full md:w-auto md:flex-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shrink-0">
            <Timer className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 font-medium">{t('afterschool.status_title') || '수강신청 진행 현황'}</div>
            <div className="text-sm font-bold text-slate-800 break-normal leading-snug">
              {getDetailedStatusText()}
            </div>
          </div>
        </div>

        {/* Digital Clock */}
        <div className="font-mono text-xs shrink-0 w-full md:w-auto flex justify-start md:justify-end pt-1 md:pt-0">
          {isBeforeStart ? (
            <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg font-bold text-sm inline-block">
              {formatCountdown(secondsUntilStart)}
            </span>
          ) : (
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg font-bold inline-block">
              {timerConfig.masterStatus === 'FORCE_LOCK' ? (t('afterschool.status_locked') || '신청 잠김') : (t('afterschool.status_open') || '신청 가능')}
            </span>
          )}
        </div>
      </div>

      {/* 수강신청 결과 최종 확정 공지 배너 */}
      {(docConfig?.isAfterschoolFinalized || (teacherApplySettings as any)?.afterschoolStageStatus === 'CONFIRMED') && (
        <div className="bg-violet-600 text-white p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3 animate-in fade-in duration-300 w-full max-w-full min-w-0 overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 w-full md:flex-1">
            <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold shrink-0 text-base">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-sm break-normal">2026학년도 1학기 방과후학교 수강신청 결과가 최종 확정되었습니다!</h4>
              <p className="text-xs text-violet-100 mt-0.5 break-normal">
                수강 확정 및 대기자 배정이 정정 완료되었습니다. 확정 결과를 확인해보세요.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowFinalizedResultModal(true)}
            className="bg-white text-violet-700 hover:bg-violet-50 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition shadow-2xs cursor-pointer self-start md:self-auto"
          >
            확정 결과 팝업 알림 보기
          </button>
        </div>
      )}

      {/* Student Banner Info */}
      <div className="bg-indigo-600 text-white p-4 sm:p-6 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full max-w-full min-w-0 overflow-hidden">
        <div className="min-w-[180px] sm:min-w-[240px] flex-1">
          <div className="text-xs font-semibold text-indigo-200">{getProgramName()} {t('afterschool.portal_suffix') || '포털'}</div>
          <h2 className="text-base sm:text-xl font-bold mt-1 break-normal leading-snug">
            {t('afterschool.student_info', {
              grade: profile?.studentGrade || '1',
              class: profile?.studentClass || '1',
              num: profile?.studentNumber || '1',
              name: profile?.studentName || '홍길동'
            }) || `${profile?.studentGrade || '1'}학년 ${profile?.studentClass || '1'}반 ${profile?.studentNumber || '1'}번 ${profile?.studentName || '홍길동'} 학생`}
          </h2>
        </div>

        <div className="flex gap-2 flex-wrap shrink-0">
          {isApplyEnabled() && (
            <button
              onClick={() => setActiveStudentTab('apply')}
              className={`px-3.5 py-2 rounded-lg font-bold text-xs transition ${
                activeStudentTab === 'apply'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'bg-indigo-700 text-white hover:bg-indigo-800'
              }`}
            >
              {t('afterschool.tab_courses') || '강좌 수강신청'}
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
            {t('afterschool.tab_my_history', { count: myEnrollments.length }) || `내 신청내역 (${myEnrollments.length}건)`}
          </button>
        </div>
      </div>

      {/* Tab 1: Course Apply List */}
      {activeStudentTab === 'apply' && (
        <div className="space-y-4">
          {/* 차시별 강좌 그룹 분류 탭 툴바 */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-800">{t('afterschool.available_courses_title') || '개설 강좌 목록'}</h3>
                <div className="flex items-center gap-1.5 flex-wrap text-[10px] sm:text-[11px] font-semibold">
                  <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200 whitespace-nowrap">
                    {t('afterschool.period_8_9_badge') || '평일 8~9차시 (15:10~16:30)'}
                  </span>
                  <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200 whitespace-nowrap">
                    {t('afterschool.period_1_2_badge') || '토요 1~2차시 (08:30~10:00)'}
                  </span>
                  <span className="bg-purple-50 text-purple-800 px-2 py-0.5 rounded-md border border-purple-200 whitespace-nowrap">
                    {t('afterschool.period_3_4_badge') || '토요 3~4차시 (10:10~11:40)'}
                  </span>
                  <span className="bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded-md border border-indigo-200 whitespace-nowrap">
                    {t('afterschool.period_1_4_badge') || '토요 1~4차시 통합 (08:30~11:40 / 4차시)'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {t('afterschool.guide_priority') || '동시간대(차시) 1순위 강좌는 선착순 배정되며, 동일 차시 2순위 이상 강좌는 대기자 명단으로 자동 분류됩니다.'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/70 shrink-0 overflow-x-auto max-w-full">
              {[
                { id: 'ALL', label: t('afterschool.tab_all_courses') || '전체 강좌', count: courses.length },
                { id: '8~9차시', label: t('afterschool.period_8_9') || '8~9차시 (평일)', count: courses.filter(c => getCoursePeriodGroup(c) === '8~9차시').length },
                { id: '1~2차시', label: t('afterschool.period_1_2') || '1~2차시 (토요)', count: courses.filter(c => getCoursePeriodGroup(c) === '1~2차시').length },
                { id: '3~4차시', label: t('afterschool.period_3_4') || '3~4차시 (토요)', count: courses.filter(c => getCoursePeriodGroup(c) === '3~4차시').length },
                { id: '1~4차시', label: t('afterschool.period_1_4') || '1~4차시 (토요통합)', count: courses.filter(c => getCoursePeriodGroup(c) === '1~4차시').length },
              ].filter(tab => tab.id === 'ALL' || tab.count > 0).map((tab) => (
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
                const daysText = Array.isArray(course.classDays) && course.classDays.length > 0 ? course.classDays.join(',') : '월';
                const tuitionFormatted = (course.tuition || 0).toLocaleString();

                return (
                  <div
                    key={course.id}
                    className="bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:border-indigo-300 transition p-3.5 flex flex-col gap-2 w-full min-w-0"
                  >
                    {/* 1행: 배지 (차시 + 신청가능/마감) + 우측 수강료 */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap shrink-0 ${
                          periodGroup === '8~9차시'
                            ? 'bg-blue-50 text-blue-900 border-blue-200'
                            : periodGroup === '1~2차시' 
                              ? 'bg-amber-50 text-amber-900 border-amber-200' 
                              : periodGroup === '3~4차시'
                                ? 'bg-purple-50 text-purple-900 border-purple-200'
                                : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                        }`}>
                          {periodGroup}
                        </span>

                        {isFull ? (
                          <span className="text-[11px] bg-rose-50 text-rose-700 border border-rose-200 font-bold px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                            {t('afterschool.badge_full') || '마감'}
                          </span>
                        ) : (
                          <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                            {t('afterschool.badge_available', { current: course.currentStudents, max: course.maxStudents }) || `신청가능 (${course.currentStudents}/${course.maxStudents})`}
                          </span>
                        )}
                      </div>

                      <span className="text-xs sm:text-sm font-black text-indigo-600 shrink-0">
                        {tuitionFormatted}동
                      </span>
                    </div>

                    {/* 2행: 강좌명 (전체 너비 확보하여 긴 제목도 절대 잘리지 않음) */}
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 break-words leading-snug">
                      {course.title}
                    </h4>

                    {/* 3행: 수업 요일/시간 및 강사 정보 */}
                    <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500 font-medium flex-wrap">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-semibold">
                        {formatClassDaysAndTimes(course, periodGroup)}
                      </span>
                      <span>👤 {instructorName}</span>
                    </div>

                    {/* 4행: 하단 액션 버튼들 나란히 배치 */}
                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 justify-end w-full min-w-0">
                      {/* 버스 체크박스 (강좌에 hasBusOption이 활성화된 경우에만 노출) */}
                      {!myRecord && !isLocked && course.hasBusOption && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-300 whitespace-nowrap mr-auto shadow-2xs">
                          <input
                            type="checkbox"
                            id={`bus-check-${course.id}`}
                            checked={needsBusMap[course.id] || false}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setNeedsBusMap(prev => ({ ...prev, [course.id]: val }));
                            }}
                            className="w-3.5 h-3.5 text-emerald-600 rounded border-emerald-400 focus:ring-emerald-500 cursor-pointer"
                          />
                          <label
                            htmlFor={`bus-check-${course.id}`}
                            className="text-[11px] font-bold text-emerald-800 cursor-pointer select-none whitespace-nowrap"
                          >
                            {t('afterschool.bus_checkbox') || '버스'}
                          </label>
                        </div>
                      )}

                      {/* 강의계획서 버튼 */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSyllabusCourse(course)}
                        className="text-xs h-8 px-2.5 font-bold text-slate-700 border-slate-300 hover:bg-slate-50 whitespace-nowrap rounded-lg"
                      >
                        <FileText className="w-3.5 h-3.5 sm:mr-1 text-slate-500" />
                        <span>{t('afterschool.btn_syllabus') || '계획서'}</span>
                      </Button>

                      {/* 수강신청 버튼 */}
                      <div className="relative flex items-center">
                        {forceInfo.forceWaiting && !myRecord && !isLocked && (
                          <span className="text-[9px] text-amber-700 font-bold whitespace-nowrap absolute -top-4 right-0">
                            2순위 대기
                          </span>
                        )}
                        {myRecord ? (
                          <div className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                            {myRecord.status === 'ENROLLED' ? (t('afterschool.btn_applied') || '✓ 신청완료') : (t('afterschool.btn_waiting_accepted') || '⏳ 대기접수')}
                          </div>
                        ) : isLocked ? (
                          <button
                            disabled
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-400 flex items-center gap-1 cursor-not-allowed whitespace-nowrap"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            {isBeforeStart ? formatCountdown(secondsUntilStart) : '잠김'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleApplyCourseWithQueue(course)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition flex items-center gap-1 whitespace-nowrap ${
                              forceInfo.forceWaiting || isFull
                                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                          >
                            <span>{forceInfo.forceWaiting ? (t('afterschool.btn_apply_waiting_2nd') || '대기자 신청 (2순위)') : isFull ? (t('afterschool.btn_apply_waiting') || '대기자 신청 (마감)') : (t('afterschool.btn_apply_1st') || '수강 신청 (1순위)')}</span>
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
            <h4 className="font-bold text-slate-900 text-sm">{t('afterschool.my_enrolled_title') || '신청한 강좌 목록'}</h4>

            {myEnrollments.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">{t('afterschool.my_enrolled_empty') || '신청한 강좌가 없습니다.'}</div>
            ) : (
              <>
                {/* 모바일 카드형 (sm 미만) */}
                <div className="sm:hidden space-y-2.5">
                  {myEnrollments.map((item) => {
                    const course = courses.find((c) => c.id === item.courseId);
                    const courseTitle = course?.title || (item as any).courseTitle || '강좌명 미확인';
                    const busNo = getAssignedBusNo(currentStudentName || profile?.studentName || '');
                    return (
                      <div key={item.id} className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">{courseTitle}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{formatClassDaysAndTimes(course) || (course ? '' : '개설 정보 없음')}</div>
                          </div>
                          <div className="shrink-0">
                            {item.status === 'ENROLLED' ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded font-bold">{t('afterschool.badge_enrolled') || '수강등록'}</span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5 rounded font-bold">{t('afterschool.badge_waiting') || '대기자'}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-indigo-600">{formatAmount(getCalculatedTuition(item))}</span>
                          {item.status === 'ENROLLED' && course && (
                            <button
                              onClick={() => { setSelectedPaymentCourse(course); setShowPaymentModal(true); }}
                              className="px-2 py-0.5 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded transition-colors"
                            >
                              {t('afterschool.btn_pay') || '납부'}
                            </button>
                          )}
                          {busNo && (
                            <button
                              onClick={() => router.push(`/parents/bus/student?name=${encodeURIComponent(currentStudentName || profile?.studentName || '')}`)}
                              className="text-blue-600 hover:text-blue-800 underline font-bold font-mono text-[11px]"
                            >
                              🚌 {busNo}
                            </button>
                          )}
                          <button
                            onClick={() => handleCancelEnrollment(item)}
                            className="ml-auto px-2 py-0.5 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded transition-colors"
                          >
                            {t('afterschool.btn_cancel') || '취소'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 데스크탑 테이블 (sm 이상) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 font-bold text-slate-700 border-b">
                      <tr>
                        <th className="p-3">{t('afterschool.th_course_name') || '강좌명'}</th>
                        <th className="p-3">{t('afterschool.th_time') || '강의시간'}</th>
                        <th className="p-3 text-right">{t('afterschool.th_tuition') || '수강료'}</th>
                        <th className="p-3 text-center">{t('afterschool.th_status') || '신청 상태'}</th>
                        <th className="p-3 text-center">{t('afterschool.th_bus') || '버스 번호'}</th>
                        <th className="p-3 text-center">{t('afterschool.th_cancel') || '신청 취소'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {myEnrollments.map((item) => {
                        const course = courses.find((c) => c.id === item.courseId);
                        const courseTitle = course?.title || (item as any).courseTitle || '강좌명 미확인';
                        const busNo = getAssignedBusNo(currentStudentName || profile?.studentName || '');

                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <span>{courseTitle}</span>
                                {course && (
                                  <button
                                    onClick={() => setSelectedSyllabusCourse(course)}
                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1 transition"
                                  >
                                    <FileText className="w-3 h-3" />
                                    {t('afterschool.btn_syllabus') || '계획서'}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-slate-600">{formatClassDaysAndTimes(course)}</td>
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
              </>
            )}
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
