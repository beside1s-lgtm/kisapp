import React, { useState, useRef, useEffect } from 'react';
import type { Course, Enrollment, AttendanceRecord, Student, SyllabusSession, SubmittedApprovalDoc, SubstituteRecord } from '@/lib/afterschool/types';
import { generateCalendarSchedule, generateCalendarScheduleByDateRange, ScheduleDay, getCourseSessionsPerClass, extractHolidayDatesFromEvents } from '@/lib/afterschool/schedule';
import {
  Printer, Calendar, X, FileSpreadsheet,
  Send, FileText, UserCheck,
  Users, Package, AlertCircle, ChevronLeft, ChevronRight,
  Phone, CheckCircle2, UserPlus, UserMinus, Edit3, Trash2, Share2, XCircle
} from 'lucide-react';
import { exportAttendanceToExcel } from '@/lib/afterschool/excel';
import { getTeacherApplySettings, saveTeacherApplySettings, onTeacherApplySettingsUpdate, submitAfterschoolApprovalDoc, deleteAfterschoolApprovalDoc, onSubstituteRecordsUpdate, saveSubstituteRecord, deleteSubstituteRecord, onDocConfigUpdate, getDocConfig } from '@/lib/services/settingsService';
import { DEFAULT_ACADEMIC_CALENDAR_CONFIG } from '@/lib/services/academicCalendarService';
import type { DocConfig } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

import type { MasterStudent } from '@/lib/types/masterStudent';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface AttendanceManagementProps {
  courses: Course[];
  selectedCourseId?: string;
  setSelectedCourseId?: (id: string) => void;
  activeSubTab?: 'studentSheet' | 'teacherAttendance' | 'batchApproval';
  setActiveSubTab?: (tab: 'studentSheet' | 'teacherAttendance' | 'batchApproval') => void;
  enrollments: Enrollment[];
  attendanceRecords: AttendanceRecord[];
  setAttendanceRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  studentsList?: Student[];
  masterStudents?: MasterStudent[];
  approvalDocs: SubmittedApprovalDoc[];
  setApprovalDocs: React.Dispatch<React.SetStateAction<SubmittedApprovalDoc[]>>;
}

type MarkSymbol = 'O' | 'V' | 'X' | '';

// 대한민국 학교 공식 붉은색 원형 직인/서명 도장 컴포넌트
export const OfficialSeal: React.FC<{ name: string; signatureUrl?: string; size?: 'sm' | 'md' }> = ({
  name,
  signatureUrl,
  size = 'sm',
}) => {
  if (signatureUrl && (signatureUrl.startsWith('http') || signatureUrl.startsWith('data:') || signatureUrl.startsWith('/') || signatureUrl.length > 50)) {
    return (
      <img
        src={signatureUrl}
        alt={`${name} 직인`}
        className={size === 'md' ? 'w-8 h-8 object-contain mx-auto' : 'w-6 h-6 object-contain inline-block shrink-0'}
      />
    );
  }
  const char = name ? (name.length >= 3 ? name.slice(-2) : name) : '인';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border border-red-600 font-serif font-black text-red-600 select-none shrink-0 bg-red-50/50 leading-none shadow-2xs ${
        size === 'md' ? 'w-7 h-7 text-[10px] border-[1.5px]' : 'w-5 h-5 text-[8.5px]'
      }`}
      style={{ letterSpacing: '-0.06em' }}
      title={`${name} 직인`}
    >
      {char}
    </span>
  );
};

// =========================================================
// AttendMarkCell: 데스크탑 드롭다운 셀
// =========================================================
const AttendMarkCell: React.FC<{
  mark: string;
  onSelect: (val: MarkSymbol) => void;
  isActiveSession: boolean;
}> = ({ mark, onSelect, isActiveSession }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  let display = '·';
  let colorClass = 'text-slate-300';
  if (mark === 'O' || mark === '○') { display = '○'; colorClass = 'text-emerald-600 font-black'; }
  else if (mark === 'V' || mark === '△') { display = '△'; colorClass = 'text-purple-600 font-black'; }
  else if (mark === 'X' || mark === '×') { display = '×'; colorClass = 'text-rose-600 font-black'; }

  const options: { val: MarkSymbol; label: string; color: string }[] = [
    { val: 'O', label: '○ 출석', color: 'text-emerald-700 hover:bg-emerald-50' },
    { val: 'V', label: '△ 지각/개별하교', color: 'text-purple-700 hover:bg-purple-50' },
    { val: 'X', label: '× 결석', color: 'text-rose-700 hover:bg-rose-50' },
    { val: '', label: '― 미체크', color: 'text-slate-500 hover:bg-slate-50' },
  ];

  return (
    <td
      ref={ref}
      className={`relative border-r text-center select-none cursor-pointer transition
        ${isActiveSession ? 'bg-indigo-50/50' : ''}`}
      style={{ minWidth: '36px', padding: '4px 2px' }}
      onClick={() => setOpen((v) => !v)}
    >
      <span className={`text-sm ${colorClass}`}>{display}</span>
      {open && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl min-w-max overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.val}
              className={`w-full text-left px-4 py-2 text-xs font-bold ${opt.color} transition`}
              onMouseDown={(e) => {
                e.stopPropagation();
                onSelect(opt.val);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </td>
  );
};

// =========================================================
// MobileMarkButton: 모바일 단일 차시 출결 버튼
// =========================================================
const MobileMarkButton: React.FC<{
  studentId: string;
  sessionNo: number;
  mark: string;
  onSelect: (val: MarkSymbol) => void;
}> = ({ mark, onSelect }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOut = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleOut);
    return () => document.removeEventListener('mousedown', handleOut);
  }, [open]);

  const getDisplay = () => {
    if (mark === 'O' || mark === '○') return { symbol: '○', bg: 'bg-emerald-500', text: 'text-white', label: '출석' };
    if (mark === 'V' || mark === '△') return { symbol: '△', bg: 'bg-purple-500', text: 'text-white', label: '지각' };
    if (mark === 'X' || mark === '×') return { symbol: '×', bg: 'bg-rose-500', text: 'text-white', label: '결석' };
    return { symbol: '―', bg: 'bg-slate-100', text: 'text-slate-400', label: '미체크' };
  };

  const { symbol, bg, text, label } = getDisplay();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-sm transition ${bg} ${text} shadow-sm min-w-[80px] justify-center`}
      >
        <span className="text-base leading-none">{symbol}</span>
        <span className="text-xs">{label}</span>
      </button>

      {open && (
        <div className="absolute z-50 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden min-w-[140px]">
          {[
            { val: 'O' as MarkSymbol, label: '○ 출석', cls: 'text-emerald-700 hover:bg-emerald-50' },
            { val: 'V' as MarkSymbol, label: '△ 지각/개별하교', cls: 'text-purple-700 hover:bg-purple-50' },
            { val: 'X' as MarkSymbol, label: '× 결석', cls: 'text-rose-700 hover:bg-rose-50' },
            { val: '' as MarkSymbol, label: '― 미체크', cls: 'text-slate-500 hover:bg-slate-50' },
          ].map((opt) => (
            <button
              key={opt.val}
              className={`w-full text-left px-4 py-2.5 text-sm font-bold ${opt.cls} transition border-b border-slate-100 last:border-0`}
              onMouseDown={(e) => {
                e.stopPropagation();
                onSelect(opt.val);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// =========================================================
// Main Component
// =========================================================
export const AttendanceManagement: React.FC<AttendanceManagementProps> = ({
  courses,
  selectedCourseId: externalSelectedCourseId,
  setSelectedCourseId: externalSetSelectedCourseId,
  activeSubTab: externalActiveSubTab,
  setActiveSubTab: externalSetActiveSubTab,
  enrollments,
  attendanceRecords,
  setAttendanceRecords,
  studentsList = [],
  masterStudents = [],
  approvalDocs,
  setApprovalDocs,
}) => {
  const { t } = useTranslation();
  const [internalSelectedCourseId, setInternalSelectedCourseId] = useState<string>(courses?.[0]?.id || 'c1');
  const selectedCourseId = externalSelectedCourseId || internalSelectedCourseId;
  const setSelectedCourseId = externalSetSelectedCourseId || setInternalSelectedCourseId;

  const [internalActiveSubTab, setInternalActiveSubTab] = useState<'studentSheet' | 'teacherAttendance' | 'batchApproval'>('studentSheet');
  const activeSubTab = externalActiveSubTab || internalActiveSubTab;
  const setActiveSubTab = externalSetActiveSubTab || setInternalActiveSubTab;
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [activeSessionNo, setActiveSessionNo] = useState<number>(1);

  // 학생 카드 모달 팝업 상태 (요청 6: 학생 이름 클릭 시 사진/학년/반/이름/버스번호/학부모연락처 팝업)
  const [modalStudent, setModalStudent] = useState<{
    photoUrl: string;
    name: string;
    grade: string;
    classNum: string;
    studentNum: string;
    busNo: string;
    contact: string;
  } | null>(null);

  const [stageStatus, setStageStatus] = useState<string>('RECRUITING');
  const [substituteRecords, setSubstituteRecords] = useState<SubstituteRecord[]>([]);
  const [isSubModalOpen, setIsSubModalOpen] = useState<boolean>(false);
  const [subTargetDay, setSubTargetDay] = useState<ScheduleDay | null>(null);
  const [subTeacherName, setSubTeacherName] = useState<string>('');
  const [subReason, setSubReason] = useState<string>('');
  const [subRecordType, setSubRecordType] = useState<'SUBSTITUTE' | 'ABSENCE'>('SUBSTITUTE');
  const [subTargetInstructor, setSubTargetInstructor] = useState<string>('');

  useEffect(() => {
    getTeacherApplySettings().then(settings => {
      if (settings?.afterschoolStageStatus) {
        setStageStatus(settings.afterschoolStageStatus);
      }
    });
    const unsubSubs = onSubstituteRecordsUpdate((data) => {
      setSubstituteRecords(data);
    });
    return () => unsubSubs();
  }, []);

  const handleActivateOperating = async () => {
    await saveTeacherApplySettings({ afterschoolStageStatus: 'OPERATING' });
    setStageStatus('OPERATING');
    alert('🎉 방과후학교 진행 상태가 [운영 중]으로 변경되었습니다! 출석부가 공식 활성화되었습니다.');
  };

  const { profile } = useAuth();
  const { toast } = useToast();
  const currentCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];

  // 외부 강사용 공유 출석부 링크 복사 핸들러
  const handleCopyShareLink = () => {
    if (!currentCourse?.id) return;
    const shareUrl = `${window.location.origin}/attendance/share/${currentCourse.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({
        title: '공유 링크 복사 완료',
        description: `외부 강사용 출석부 링크가 클립보드에 복사되었습니다. 해당 링크로 접속 시 출석 체크만 가능하며, 다른 시스템 기능에는 접근할 수 없습니다.`,
      });
    }).catch(() => {
      // clipboard API 실패 시 fallback
      const el = document.createElement('textarea');
      el.value = shareUrl;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      toast({ title: '공유 링크 복사 완료', description: shareUrl });
    });
  };

  // 보결/결근 등록 및 수정 핸들러
  const handleOpenSubstituteModal = (day: ScheduleDay, targetInst?: string) => {
    setSubTargetDay(day);
    const instructors = [
      currentCourse?.instructorName,
      currentCourse?.instructor2,
      currentCourse?.instructor3,
      currentCourse?.instructor4,
      ...(currentCourse?.assistantTeachers || [])
    ].filter(Boolean) as string[];

    const defaultInst = targetInst || instructors[0] || currentCourse?.instructorName || '';
    setSubTargetInstructor(defaultInst);

    const existing = substituteRecords.find(
      (s) => s.courseId === currentCourse?.id && s.dayIndex === day.dayIndex && (!s.targetInstructor || s.targetInstructor === defaultInst)
    );
    if (existing) {
      setSubRecordType(existing.recordType || (existing.isAbsence ? 'ABSENCE' : 'SUBSTITUTE'));
      setSubTeacherName(existing.isAbsence ? '' : existing.substituteInstructor);
      setSubReason(existing.reason || '');
      if (existing.targetInstructor) setSubTargetInstructor(existing.targetInstructor);
    } else {
      setSubRecordType('SUBSTITUTE');
      setSubTeacherName('');
      setSubReason('개인사정/병가');
    }
    setIsSubModalOpen(true);
  };

  const handleSaveSubstitute = async () => {
    if (!subTargetDay || !currentCourse) return;
    if (subRecordType === 'SUBSTITUTE' && !subTeacherName.trim()) {
      alert('보결 강사 성명을 입력해 주세요.');
      return;
    }
    const isAbs = subRecordType === 'ABSENCE';
    const subRecord: SubstituteRecord = {
      id: `sub_${currentCourse.id}_d${subTargetDay.dayIndex}_${(subTargetInstructor || 'lead').replace(/\s+/g, '')}`,
      courseId: currentCourse.id,
      courseTitle: currentCourse.title,
      dayIndex: subTargetDay.dayIndex,
      dateStr: subTargetDay.dateStr,
      sessionNos: subTargetDay.sessionNos,
      sessionCount: subTargetDay.sessionNos.length,
      originalInstructor: subTargetInstructor || currentCourse.instructorName || '원강사',
      targetInstructor: subTargetInstructor || currentCourse.instructorName || '원강사',
      substituteInstructor: isAbs ? '결근' : subTeacherName.trim(),
      recordType: subRecordType,
      isAbsence: isAbs,
      reason: subReason.trim(),
      createdAt: new Date().toLocaleString('ko-KR'),
    };
    await saveSubstituteRecord(subRecord);
    setIsSubModalOpen(false);
    if (isAbs) {
      alert(`[${subTargetDay.dayIndex}회차 (${subTargetDay.dateStr})] [${subTargetInstructor || '강사'}] 결근 처리가 완료되었습니다.`);
    } else {
      alert(`[${subTargetDay.dayIndex}회차 (${subTargetDay.dateStr})] 보결 강사(${subTeacherName.trim()})가 성공적으로 등록되었습니다.`);
    }
  };

  const handleDeleteSubstitute = async (subId: string) => {
    if (!window.confirm('등록된 보결/결근 정보를 삭제하시겠습니까? 정상 출근 상태로 복원됩니다.')) return;
    await deleteSubstituteRecord(subId);
    setIsSubModalOpen(false);
  };
  
  // 로그인한 사용자(강사) 프로필에 등록된 공식 서명/도장 연동
  const instructorSignature = profile?.signature || '';

  // 부장/교감 결재 문서 승인 상태 연동
  const targetApprovalDoc = approvalDocs.find((d) => d.courseId === currentCourse?.id);
  const isManagerApproved = targetApprovalDoc?.status === 'APPROVED' || (targetApprovalDoc as any)?.managerApproved;
  const isVicePrincipalApproved = targetApprovalDoc?.status === 'APPROVED' && (targetApprovalDoc as any)?.vicePrincipalApproved;
  const managerSignature = isManagerApproved ? ((targetApprovalDoc as any)?.managerSignature || '') : '';
  const vicePrincipalSignature = isVicePrincipalApproved ? ((targetApprovalDoc as any)?.vicePrincipalSignature || '') : '';

  // 확정 수강생만 필터링 (대기자 WAITING 제외)
  const courseStudents = enrollments.filter(
    (e) => e.courseId === currentCourse?.id && e.status === 'ENROLLED'
  );

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const sessionScrollRef = useRef<HTMLDivElement>(null);

  // 오늘 날짜("YYYY-MM-DD")와 가장 가까운 회차 자동 탐색
  const findInitialDayIndex = (days: ScheduleDay[]): number => {
    if (!days || days.length === 0) return 1;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    // 1) 오늘 날짜와 정확히 일치하는 회차 탐색
    const exactMatch = days.find(d => d.fullDate === todayStr);
    if (exactMatch) return exactMatch.dayIndex;

    // 2) 오늘 이후 가장 빠른 다음 수업일 탐색
    const upcoming = days.find(d => d.fullDate >= todayStr);
    if (upcoming) return upcoming.dayIndex;

    // 3) 모든 수업이 지난 경우 마지막 회차, 아직 개강 전이면 1회차
    const past = [...days].reverse().find(d => d.fullDate <= todayStr);
    if (past) return past.dayIndex;

    return 1;
  };

  // 강좌 설정 기반 달력 스케줄 자동 산우 ([이슈 4] 운영기간 연동)
  const sessionsPerClass = currentCourse?.sessionsPerClass || 2;
  const operatingWeeks = currentCourse?.operatingWeeks || 20;
  const classDays = currentCourse?.classDays || ['월'];
  const startDateStr = currentCourse?.startDate || '2026-03-30';

  // 마스터 설정 구독 (operatingStartDate, operatingEndDate, allowedDays)
  const [masterSettings, setMasterSettings] = useState<any>(null);
  const [docConfig, setDocConfig] = useState<DocConfig | null>(null);

  useEffect(() => {
    getTeacherApplySettings().then(s => { if (s) setMasterSettings(s); });
    getDocConfig().then(c => { if (c) setDocConfig(c as DocConfig); });

    const unsub = onTeacherApplySettingsUpdate((s) => setMasterSettings(s));
    const unsubDoc = onDocConfigUpdate((c) => setDocConfig(c as DocConfig));
    return () => {
      unsub();
      unsubDoc();
    };
  }, []);

  const holidayDates = React.useMemo(() => {
    return extractHolidayDatesFromEvents(docConfig?.academicCalendar?.events || DEFAULT_ACADEMIC_CALENDAR_CONFIG.events || []);
  }, [docConfig]);

  // 운영기간 기반 달력 생성 (마스터 설정 우선, fallback: operatingWeeks 기반)
  const scheduleDays: ScheduleDay[] = React.useMemo(() => {
    const opStart = masterSettings?.operatingStartDate || '';
    const opEnd = masterSettings?.operatingEndDate || '';
    // 강좌의 classDays 우선, 없으면 마스터 allowedDays fallback
    const effectiveDays = (classDays && classDays.length > 0) ? classDays : (masterSettings?.allowedDays || ['월']);
    const effectiveSessions = getCourseSessionsPerClass(currentCourse, masterSettings?.sessionsPerClass || 2);

    if (opStart && opEnd) {
      // 운영기간 내의 날짜 범위를 달력에 사용 (학사일정 공휴일/휴업일 전개 반영)
      return generateCalendarScheduleByDateRange(opStart, opEnd, effectiveDays, effectiveSessions, holidayDates);
    }
    // fallback: 기존 operatingWeeks 기반 방식
    return generateCalendarSchedule(startDateStr, operatingWeeks, effectiveDays, effectiveSessions, holidayDates);
  }, [masterSettings?.operatingStartDate, masterSettings?.operatingEndDate, masterSettings?.allowedDays, masterSettings?.sessionsPerClass, classDays, currentCourse, holidayDates, startDateStr, operatingWeeks]);

  // 최초 로드 및 강좌 변경 시 오늘 날짜 수업 회차로 자동 이동
  useEffect(() => {
    if (scheduleDays.length > 0) {
      const targetIdx = findInitialDayIndex(scheduleDays);
      setActiveSessionNo(targetIdx);
      setTimeout(() => {
        const btn = document.getElementById(`session-btn-${targetIdx}`);
        if (btn) {
          btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        if (tableContainerRef.current) {
          const thElem = document.getElementById(`day-th-${targetIdx}`);
          if (thElem) {
            thElem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
      }, 150);
    }
  }, [selectedCourseId, scheduleDays.length]);

  const activeDay = scheduleDays.find((d) => d.dayIndex === activeSessionNo) || scheduleDays[0];

  // 엑셀 내보내기 및 호환용 sessions 맵핑
  const sessions: SyllabusSession[] = scheduleDays.flatMap((day) =>
    day.sessionNos.map((sNo) => ({
      sessionNo: sNo,
      dateStr: day.dateStr,
    }))
  );

  // 회차 클릭 시 자동 스크롤 핸들러
  const handleSelectDay = (dayIndex: number) => {
    setActiveSessionNo(dayIndex);
    setTimeout(() => {
      const btn = document.getElementById(`session-btn-${dayIndex}`);
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
      if (!tableContainerRef.current) return;
      const thElem = document.getElementById(`day-th-${dayIndex}`);
      if (thElem) {
        const container = tableContainerRef.current;
        const thLeft = thElem.offsetLeft;
        const thWidth = thElem.offsetWidth;
        const containerWidth = container.clientWidth;
        const scrollTarget = Math.max(0, thLeft - (containerWidth / 2) + (thWidth / 2));
        container.scrollTo({ left: scrollTarget, behavior: 'smooth' });
      }
    }, 50);
  };

  const getDayMark = (studentId: string, dayIndex: number): string => {
    const day = scheduleDays.find((d) => d.dayIndex === dayIndex);
    if (!day) return '';
    const firstSessionNo = day.startSessionNo;
    const record = attendanceRecords.find(
      (r) => r.courseId === currentCourse.id && r.studentId === studentId && r.sessionNo === firstSessionNo
    );
    if (!record) return '';
    if (record.markSymbol) return record.markSymbol;
    if (record.status === 'ATTEND') return record.isIndividualDismissal ? '△' : '○';
    if (record.status === 'LATE' || record.status === 'EARLY_LEAVE') return '△';
    if (record.status === 'ABSENT') return '×';
    return '';
  };

  // 버스 시스템 결석/개별하교 연동 헬퍼 (날짜 단위)
  // - 'X' (결석), 'V' (개별하교) → kisbus routes/{routeId}/attendance/{fullDate} notBoarding 추가
  // - 'O' (출석), '' (미체크) → notBoarding 해제
  const syncBusAbsenceForDay = async (studentId: string, dayIndex: number, mark: MarkSymbol) => {
    const day = scheduleDays.find((d) => d.dayIndex === dayIndex);
    if (!day) return;
    const student = courseStudents.find((s) => s.studentId === studentId);
    const studentName = student ? student.name : '학생';

    // 정확한 YYYY-MM-DD 날짜 문자열 사용
    const targetDateStr = day.fullDate || (day.dateStr?.includes('-') ? day.dateStr : new Date().toISOString().split('T')[0]);

    const isAbsent = mark === 'X' || mark === 'V'; // 결석 or 개별하교 모두 버스 미탑승 ('오늘 안 탐')

    try {
      const { doc, setDoc, collection, getDocs, arrayUnion, arrayRemove } = await import('firebase/firestore');
      const { getKisbusDb } = await import('@/lib/kisbus/firebase');
      const kisbusDb = getKisbusDb();

      // 한글 요일 파싱 및 타임존 오차 없는 요일 매핑
      const koreanDayMap: Record<string, string> = {
        '일': 'Sunday', '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday',
        '목': 'Thursday', '금': 'Friday', '토': 'Saturday'
      };
      const dayOfWeekMap: Record<number, string> = {
        0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday'
      };
      const match = day.dateStr.match(/\(([월화수목금토일])\)/);
      const korDay = match ? match[1] : '';
      const targetDayOfWeek = korDay ? koreanDayMap[korDay] : dayOfWeekMap[new Date(day.fullDate + 'T12:00:00').getDay()];
      if (!targetDayOfWeek) return;

      const routesSnap = await getDocs(collection(kisbusDb, 'routes'));
      let matchedCount = 0;

      for (const routeDoc of routesSnap.docs) {
        const routeData = routeDoc.data();
        if (routeData.dayOfWeek !== targetDayOfWeek) continue;
        const seating: any[] = routeData.seating || [];
        if (!seating.some((s: any) => s.studentId === studentId)) continue;

        const attendanceRef = doc(kisbusDb, 'routes', routeDoc.id, 'attendance', targetDateStr);
        await setDoc(attendanceRef, {
          notBoarding: isAbsent ? arrayUnion(studentId) : arrayRemove(studentId),
          ...(isAbsent ? { boarded: arrayRemove(studentId), disembarked: arrayRemove(studentId) } : {}),
        }, { merge: true });
        matchedCount++;
      }

      if (matchedCount > 0) {
        const label = mark === 'V' ? '개별하교 (버스 미탑승)' : mark === 'X' ? '결석 (버스 미탑승)' : '출석 (탑승 복구)';
        console.log(`[BusSync] ${studentName} ${targetDateStr} [${label}] → kisbus ${matchedCount}개 노선 동기화 완료`);
      }
    } catch (err) {
      console.error('[BusSync] 버스 연동 오류:', err);
    }
  };

  // 날짜(회차) 단위 1회 출결 체크 저장 핸들러
  const handleSetDayMark = (studentId: string, dayIndex: number, nextMark: MarkSymbol) => {
    const day = scheduleDays.find((d) => d.dayIndex === dayIndex);
    if (!day) return;

    // 버스 결석 연동 전송
    syncBusAbsenceForDay(studentId, dayIndex, nextMark);

    setAttendanceRecords((prev) => {
      // 해당 회차의 모든 차시 레코드 필터 제거
      const filtered = prev.filter(
        (r) => !(r.courseId === currentCourse.id && r.studentId === studentId && day.sessionNos.includes(r.sessionNo || 0))
      );
      if (!nextMark) return filtered;

      // 해당 회차의 모든 차시에 동일한 출결 마크 생성
      const newRecords: AttendanceRecord[] = day.sessionNos.map((sNo) => ({
        id: `att_${studentId}_s${sNo}`,
        courseId: currentCourse.id,
        studentId,
        sessionNo: sNo,
        date: day.dateStr,
        status: nextMark === 'X' ? 'ABSENT' : 'ATTEND',
        markSymbol: nextMark,
        isIndividualDismissal: nextMark === 'V',
      }));

      return [...filtered, ...newRecords];
    });
  };

  // 현재 활성 회차의 모든 확정 수강생 전원 출석 처리
  const handleBulkAttendDay = (dayIndex: number) => {
    const day = scheduleDays.find((d) => d.dayIndex === dayIndex);
    if (!day) return;

    courseStudents.forEach((st) => {
      syncBusAbsenceForDay(st.studentId, dayIndex, 'O');
      setAttendanceRecords((prev) => {
        const filtered = prev.filter(
          (r) => !(r.courseId === currentCourse.id && r.studentId === st.studentId && day.sessionNos.includes(r.sessionNo || 0))
        );
        const newRecords: AttendanceRecord[] = day.sessionNos.map((sNo) => ({
          id: `att_${st.studentId}_s${sNo}`,
          courseId: currentCourse.id,
          studentId: st.studentId,
          sessionNo: sNo,
          date: day.dateStr,
          status: 'ATTEND',
          markSymbol: 'O',
          isIndividualDismissal: false,
        }));
        return [...filtered, ...newRecords];
      });
    });
  };

  // 부장에게 서류 전송
  const handleSendToDeptHead = async () => {
    const already = approvalDocs.find((d) => d.courseId === currentCourse.id && d.status === 'PENDING');
    if (already) {
      alert('이미 해당 강좌의 서류가 전송 대기 중입니다.');
      return;
    }
    const newDoc: SubmittedApprovalDoc = {
      id: `doc_${Date.now()}`,
      courseId: currentCourse.id,
      courseTitle: currentCourse.title,
      instructorName: currentCourse.instructorName || '김강사',
      instructorSignature: profile?.signature || '',
      submittedAt: new Date().toLocaleString('ko-KR'),
      selected: true,
      status: 'PENDING',
      type: 'ATTENDANCE_AND_WORK' as any,
      docType: 'ATTENDANCE' as any,
      title: `${currentCourse.title} 출석부 및 출근부`,
    };
    setApprovalDocs((prev) => [...prev, newDoc]);
    await submitAfterschoolApprovalDoc(newDoc).catch(err => console.error('[ApprovalDoc] Firestore 저장 실패:', err));
    alert(`[${currentCourse.title}] 출석부/출근부가 담당 부장에게 전송되었습니다.`);
  };

  const teacherPeriods = [
    { periodRange: '1-2', sessionNos: [1, 2] }, { periodRange: '3-4', sessionNos: [3, 4] },
    { periodRange: '5-6', sessionNos: [5, 6] }, { periodRange: '7-8', sessionNos: [7, 8] },
    { periodRange: '9-10', sessionNos: [9, 10] },
  ];

const getTeacherAttendanceRow = (sNos: number[]) => {
    const records = attendanceRecords.filter(
      (r) => r.courseId === currentCourse.id && sNos.includes(r.sessionNo || 0)
    );
    const hasChecked = records.length > 0;
    const sessionObj = sessions.find((s) => sNos.includes(s.sessionNo));
    const dateStr = hasChecked ? records[0]?.date || sessionObj?.dateStr || '' : sessionObj?.dateStr || '';
    return { hasChecked, dateStr: hasChecked ? `2026/${dateStr}` : '', signed: hasChecked };
  };

  // 학생 프로필 사진 & 스쿨버스 번호 & 학부모 연락처 통합 연동 헬퍼
  const getStudentInfo = (studentId: string, studentName: string, grade?: any, classNum?: any) => {
    // 동명이인 오매칭 방지: 이름+학년+반이 모두 일치할 때만 매칭 (이름만 fallback 제거)
    const m = (masterStudents || []).find(ms =>
      ms.studentId === studentId ||
      ms.studentEmail?.toLowerCase() === studentId?.toLowerCase() ||
      (ms.name === studentName && String(ms.grade) === String(grade) && String(ms.classNum) === String(classNum))
    );
    const s = (studentsList || []).find(st => st.id === studentId || (st.name === studentName && String(st.grade) === String(grade) && String(st.class) === String(classNum)));

    const photoUrl = m?.photoUrl || (s as any)?.photoUrl || (s as any)?.photo || '';
    let rawBus = (m?.busSummary as any)?.assignedBusName || (m?.busSummary as any)?.busName || m?.kisbusNo || (s as any)?.kisbusNo || (s as any)?.busNo || '';
    if (rawBus && !rawBus.includes('호') && !rawBus.includes('버스') && !rawBus.includes('자율')) {
      rawBus = `${rawBus}호차`;
    }
    const contact = m?.contact || (s as any)?.parentPhone || (s as any)?.phone || (s as any)?.contact || '';

    return {
      photoUrl,
      busNo: rawBus || '미지정',
      contact: contact ? contact.trim() : '',
      grade: String(m?.grade || grade || '1'),
      classNum: String(m?.classNum || classNum || '1'),
      studentNum: String(m?.studentNum || (s as any)?.number || ''),
      name: studentName
    };
  };

  const markDisplay = (mark: string) => {
    if (mark === 'O' || mark === '○') return { symbol: '○', color: 'text-emerald-600 font-black' };
    if (mark === 'V' || mark === '△') return { symbol: '△', color: 'text-purple-600 font-black' };
    if (mark === 'X' || mark === '×') return { symbol: '×', color: 'text-rose-600 font-black' };
    return { symbol: '·', color: 'text-slate-300' };
  };

  // 폐강(CANCELLED)되거나 삭제된 강좌의 서류는 제외하고 유효한 서류만 필터링
  const validCourseIds = new Set(courses.filter((c) => c.status !== 'CANCELLED').map((c) => c.id));
  const validApprovalDocs = approvalDocs.filter((d) => validCourseIds.has(d.courseId));
  const pendingApprovals = validApprovalDocs.filter((d) => d.status === 'PENDING').length;

  // 서류 회수/삭제 핸들러
  const handleDeleteApprovalDoc = async (docId: string, courseTitle: string) => {
    if (!window.confirm(`[${courseTitle}] 제출된 서류를 회수(삭제)하시겠습니까?\n삭제 시 관리자 검토 대기 목록 및 제출함에서 즉시 제거됩니다.`)) {
      return;
    }
    const res = await deleteAfterschoolApprovalDoc(docId);
    if (res.success) {
      setApprovalDocs((prev) => prev.filter((d) => d.id !== docId));
      alert('제출된 서류가 성공적으로 회수(삭제)되었습니다.');
    } else {
      alert(`서류 삭제 실패: ${res.error}`);
    }
  };

  if (!courses || courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
        <div className="p-3 bg-slate-100 rounded-full text-slate-400 mb-3">
          <Users className="h-8 w-8" />
        </div>
        <p className="text-sm font-bold text-slate-800">배정된 수강 학생이 없습니다.</p>
        <p className="text-xs text-slate-500 mt-1">담당하고 있는 나의 강좌에 등록된 수강생이 존재하지 않습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">

      {/* ===== TAB 1: STUDENT ATTENDANCE ===== */}
      {activeSubTab === 'studentSheet' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Session header / controls */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            {/* Active session / Day display */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-bold text-slate-800 text-sm">
                  {activeDay?.dateStr || ''}
                  <span className="text-slate-500 font-normal text-xs ml-1.5">
                    ({activeDay?.dayIndex || 1}회차 / {activeDay?.startSessionNo}~{activeDay?.endSessionNo}차시)
                  </span>
                </span>
                <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[11px] px-2 py-0.5 rounded-full ml-1">
                  수강 확정생 {courseStudents.length}명
                </span>
              </div>
              {/* Prev/Next session navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSelectDay(Math.max(1, activeSessionNo - 1))}
                  disabled={activeSessionNo <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-slate-500 font-mono px-1">
                  {activeSessionNo}/{scheduleDays.length}회차
                </span>
                <button
                  onClick={() => handleSelectDay(Math.min(scheduleDays.length, activeSessionNo + 1))}
                  disabled={activeSessionNo >= scheduleDays.length}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Session selector & Fixed Bulk Attend Button */}
            <div ref={sessionScrollRef} className="flex items-center gap-2 overflow-x-auto pb-0.5">
              {/* 맨 왼쪽에 전원출석 버튼 고정 */}
              <button
                onClick={() => handleBulkAttendDay(activeSessionNo)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition shadow-sm shrink-0 flex items-center gap-1 cursor-pointer"
                title="현재 선택한 날짜의 모든 수강 확정생을 출석(○) 처리합니다"
              >
                <UserCheck className="w-3.5 h-3.5" />
                전원출석
              </button>
              {/* 외부 강사용 공유 출석부 링크 복사 버튼 */}
              <button
                onClick={handleCopyShareLink}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition shadow-sm shrink-0 flex items-center gap-1 cursor-pointer"
                title="외부 강사가 로그인 없이 접속하여 출석 체크만 할 수 있는 전용 링크를 클립보드에 복사합니다"
              >
                <Share2 className="w-3.5 h-3.5" />
                출석부 공유
              </button>
              <div className="h-5 w-[1px] bg-slate-300 shrink-0" />


              {/* 날짜(회차) 중심 버튼 스크롤 */}
              {scheduleDays.map((day) => {
                const isSelected = day.dayIndex === activeSessionNo;
                const now = new Date();
                const todayFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const isToday = day.fullDate === todayFormatted;

                return (
                  <button
                    key={day.dayIndex}
                    id={`session-btn-${day.dayIndex}`}
                    onClick={() => handleSelectDay(day.dayIndex)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 flex flex-col items-center cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
                        : isToday
                        ? 'bg-amber-50/80 border-2 border-amber-400 text-slate-800 hover:bg-amber-100'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isToday && (
                      <span className={`text-[8.5px] font-black px-1 rounded-xs mb-0.5 ${isSelected ? 'bg-amber-300 text-amber-950' : 'bg-amber-500 text-white'}`}>
                        오늘
                      </span>
                    )}
                    <span className="text-xs leading-none font-extrabold">{day.dateStr}</span>
                    <span className="text-[9px] opacity-90 font-normal mt-0.5">
                      {day.dayIndex}회차
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===== MOBILE VIEW: Today-session-only list ===== */}
          <div className="block md:hidden divide-y divide-slate-100">
            {courseStudents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">수강 등록된 학생이 없습니다.</div>
            ) : (
              courseStudents.map((enrollment) => {
                const sInfo = getStudentInfo(enrollment.studentId, enrollment.name, enrollment.grade, enrollment.classNum);
                const mark = getDayMark(enrollment.studentId, activeSessionNo);

                return (
                  <div key={enrollment.id} className="px-3.5 py-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50 transition">
                    <button
                      type="button"
                      onClick={() => setModalStudent(sInfo)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer group"
                    >
                      <Avatar className="w-10 h-10 rounded-xl border border-slate-200 shrink-0 shadow-2xs">
                        {sInfo.photoUrl ? (
                          <AvatarImage src={sInfo.photoUrl} alt={sInfo.name} className="object-cover rounded-xl" />
                        ) : (
                          <AvatarFallback className="bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl">
                            {sInfo.name.slice(0, 2)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-sm group-hover:text-indigo-600 transition">
                            {sInfo.name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">
                            {sInfo.grade}-{sInfo.classNum}
                          </span>
                          <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded-full shrink-0">
                            {sInfo.busNo}
                          </span>
                        </div>
                        {sInfo.contact ? (
                          <span className="text-[11px] text-indigo-600 flex items-center gap-0.5 mt-0.5 font-bold">
                            <Phone className="w-3 h-3 shrink-0" />
                            {sInfo.contact}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 block mt-0.5">연락처 없음 (클릭 시 상세보기)</span>
                        )}
                      </div>
                    </button>
                    <MobileMarkButton
                      studentId={enrollment.studentId}
                      sessionNo={activeSessionNo}
                      mark={mark}
                      onSelect={(val) => handleSetDayMark(enrollment.studentId, activeSessionNo, val)}
                    />
                  </div>
                );
              })
            )}

            {/* Summary footer */}
            {courseStudents.length > 0 && (
              <div className="px-4 py-3 bg-slate-50 flex gap-4 text-xs font-bold border-t border-slate-200">
                <span className="text-emerald-700">
                  출석 {courseStudents.filter(e => {
                    const m = getDayMark(e.studentId, activeSessionNo);
                    return m === 'O' || m === '○';
                  }).length}명
                </span>
                <span className="text-purple-700">
                  지각/개별 {courseStudents.filter(e => {
                    const m = getDayMark(e.studentId, activeSessionNo);
                    return m === 'V' || m === '△';
                  }).length}명
                </span>
                <span className="text-rose-700">
                  결석 {courseStudents.filter(e => {
                    const m = getDayMark(e.studentId, activeSessionNo);
                    return m === 'X' || m === '×';
                  }).length}명
                </span>
                <span className="text-slate-400 ml-auto">
                  미체크 {courseStudents.filter(e => !getDayMark(e.studentId, activeSessionNo)).length}명
                </span>
              </div>
            )}
          </div>

          {/* ===== DESKTOP VIEW: Full grid table ===== */}
          <div ref={tableContainerRef} className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                <tr>
                  <th className="p-2 border-r w-8">순</th>
                  <th className="p-2 border-r w-8">학년</th>
                  <th className="p-2 border-r w-8">반</th>
                  <th className="p-2 border-r w-8">번</th>
                  <th className="p-2 border-r text-center whitespace-nowrap px-3 min-w-[120px]">학생 (사진/성명)</th>
                  {scheduleDays.map((day) => (
                    <th
                      key={day.dayIndex}
                      id={`day-th-${day.dayIndex}`}
                      className={`p-2 border-r min-w-[50px] font-bold cursor-pointer transition hover:bg-indigo-100 ${
                        activeSessionNo === day.dayIndex ? 'bg-indigo-100 text-indigo-900 ring-2 ring-indigo-400 inset-0' : ''
                      }`}
                      onClick={() => handleSelectDay(day.dayIndex)}
                    >
                      <div className="font-extrabold text-[11px]">{day.dateStr}</div>
                      <div className="text-[9px] text-slate-500 font-normal mt-0.5">{day.dayIndex}회차</div>
                    </th>
                  ))}
                  <th className="p-2 border-r w-16">탑승 버스</th>
                  <th className="p-2 w-24">학부모 연락처</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courseStudents.length === 0 ? (
                  <tr><td colSpan={scheduleDays.length + 7} className="py-8 text-center text-slate-400">수강 등록된 학생이 없습니다.</td></tr>
                ) : (
                  courseStudents.map((enrollment, enrollIdx) => {
                    const sInfo = getStudentInfo(enrollment.studentId, enrollment.name, enrollment.grade, enrollment.classNum);
                    return (
                      <tr key={enrollment.id} className="hover:bg-slate-50/80">
                        <td className="p-2 border-r font-mono text-slate-400">{enrollIdx + 1}</td>
                        <td className="p-2 border-r font-bold">{sInfo.grade}</td>
                        <td className="p-2 border-r">{sInfo.classNum}</td>
                        <td className="p-2 border-r">{sInfo.studentNum || '-'}</td>
                        <td className="p-2 border-r text-center whitespace-nowrap px-3 min-w-[140px]">
                          <button
                            type="button"
                            onClick={() => setModalStudent(sInfo)}
                            className="inline-flex items-center gap-2.5 hover:bg-indigo-50/80 p-1.5 rounded-xl transition cursor-pointer group"
                            title="학생 프로필 카드 보기"
                          >
                            <Avatar className="w-9 h-9 rounded-xl border border-slate-200 shrink-0 shadow-2xs">
                              {sInfo.photoUrl ? (
                                <AvatarImage src={sInfo.photoUrl} alt={sInfo.name} className="object-cover rounded-xl" />
                              ) : (
                                <AvatarFallback className="bg-indigo-100 text-indigo-700 font-black text-xs rounded-xl">
                                  {sInfo.name.slice(0, 2)}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div className="flex flex-col items-start leading-tight">
                              <span className="font-extrabold text-slate-900 text-xs group-hover:text-indigo-600 transition">
                                {sInfo.name}
                              </span>
                              <span className="text-[10px] bg-sky-100 text-sky-800 font-extrabold px-1.5 py-0.2 rounded-md mt-0.5 border border-sky-200">
                                {sInfo.busNo}
                              </span>
                            </div>
                          </button>
                        </td>
                        {scheduleDays.map((day) => (
                          <AttendMarkCell
                            key={day.dayIndex}
                            mark={getDayMark(enrollment.studentId, day.dayIndex)}
                            onSelect={(val) => handleSetDayMark(enrollment.studentId, day.dayIndex, val)}
                            isActiveSession={activeSessionNo === day.dayIndex}
                          />
                        ))}
                        <td className="p-2 border-r font-bold text-[11px] text-sky-800">
                          <span className="bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 inline-block">
                            {sInfo.busNo}
                          </span>
                        </td>
                        <td className="p-2 text-[11px]">
                          {sInfo.contact ? (
                            <a href={`tel:${sInfo.contact.replace(/\D/g, '')}`} className="text-indigo-600 hover:underline font-bold">
                              {sInfo.contact}
                            </a>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== TAB 2: TEACHER ATTENDANCE SHEET ===== */}
      {activeSubTab === 'teacherAttendance' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
            <div>
              <span className="font-bold text-indigo-900">강사출근부 실시간 차시 연동 작동 중</span>
              <p className="text-indigo-700 mt-0.5">학생 출석부 체크 시 해당 날짜 회차에 강사 서명이 자동 연동되어 기입됩니다.</p>
            </div>
          </div>

          <div className="max-w-2xl mx-auto bg-white p-5 border border-slate-300 rounded-xl shadow space-y-4">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <div className="text-[11px] text-slate-500">2026학년도 1학기 방과후학교</div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">강사출근부 ({currentCourse.title})</h3>
              </div>
              <table className="border-collapse border border-slate-800 text-xs text-center">
                <tbody>
                  <tr>
                    <td rowSpan={2} className="border border-slate-800 bg-slate-100 px-1 py-2 font-bold w-5 leading-tight text-[10px]">결<br />재</td>
                    <td className="border border-slate-800 px-2 py-0.5 font-bold w-12 bg-slate-50 text-[11px]">부장</td>
                    <td className="border border-slate-800 px-2 py-0.5 font-bold w-12 bg-slate-50 text-[11px]">교감</td>
                  </tr>
                  <tr className="h-9">
                    <td className="border border-slate-800 p-0.5">
                      {isManagerApproved ? (
                        managerSignature ? (
                          <img src={managerSignature} alt="부장" className="w-7 h-7 object-contain mx-auto" />
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-300">승인</span>
                        )
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="border border-slate-800 p-0.5">
                      {isVicePrincipalApproved ? (
                        vicePrincipalSignature ? (
                          <img src={vicePrincipalSignature} alt="교감" className="w-7 h-7 object-contain mx-auto" />
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-300">승인</span>
                        )
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <table className="w-full border-collapse border border-slate-800 text-xs text-center">
              <thead className="bg-indigo-50 font-bold">
                <tr>
                  <th className="border border-slate-800 p-2">회차 (차시)</th>
                  <th className="border border-slate-800 p-2">수업 날짜</th>
                  <th className="border border-slate-800 p-2">강사 서명 (출근 날인)</th>
                  <th className="border border-slate-800 p-2 w-32">보결 / 결근 관리</th>
                </tr>
              </thead>
              <tbody>
                {scheduleDays.map((day) => {
                  const records = attendanceRecords.filter(
                    (r) => r.courseId === currentCourse.id && day.sessionNos.includes(r.sessionNo || 0) && Boolean(r.status || (r as any).markSymbol)
                  );
                  const hasChecked = records.length > 0;

                  // 강좌에 배정된 모든 강사 목록 (복수 강사 지원: 주강사 + 강사2 + 보조강사 등)
                  const allCourseInstructors = [
                    currentCourse.instructorName,
                    currentCourse.instructor2,
                    currentCourse.instructor3,
                    currentCourse.instructor4,
                    ...(currentCourse.assistantTeachers || [])
                  ].filter(Boolean) as string[];
                  const instructors = allCourseInstructors.length > 0 ? allCourseInstructors : [currentCourse.instructorName || '강사'];

                  // 해당 회차의 모든 보결/결근 기록 조회
                  const daySubs = substituteRecords.filter(
                    (s) => s.courseId === currentCourse.id && s.dayIndex === day.dayIndex
                  );

                  return (
                    <tr key={day.dayIndex} className={`h-10 hover:bg-slate-50 ${daySubs.length > 0 ? 'bg-amber-50/40' : ''}`}>
                      <td className="border border-slate-800 font-mono font-bold bg-slate-50 text-[11px] px-2 py-1">
                        {day.dayIndex}회차 ({day.startSessionNo}~{day.endSessionNo}차시)
                      </td>
                      <td className="border border-slate-800 font-mono text-[11px] text-indigo-900 px-2 py-1">
                        <div>{day.dateStr} ({day.fullDate})</div>
                        {daySubs.map(s => (
                          <div key={s.id} className="text-[10px] text-amber-800 font-sans font-medium">
                            {s.targetInstructor ? `[${s.targetInstructor}] ` : ''}{s.isAbsence ? '결근' : `보결(${s.substituteInstructor})`}: {s.reason || '-'}
                          </div>
                        ))}
                      </td>
                      <td className="border border-slate-800 px-2 py-1">
                        {hasChecked ? (
                          <div className="flex flex-col gap-1 items-center justify-center">
                            {instructors.map((inst) => {
                              const sub = daySubs.find(s => !s.targetInstructor || s.targetInstructor === inst);
                              if (sub?.isAbsence) {
                                return (
                                  <div key={inst} className="flex items-center gap-1">
                                    <span className="text-[10px] bg-rose-100 text-rose-800 border border-rose-300 px-1 py-0.5 rounded font-bold">결근</span>
                                    <span className="line-through text-slate-400 font-bold text-[11px]">{inst}</span>
                                    <span className="text-[10px] text-slate-500">({sub.reason || '사유미기재'})</span>
                                  </div>
                                );
                              }
                              if (sub) {
                                return (
                                  <div key={inst} className="flex items-center gap-1">
                                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1 py-0.5 rounded font-bold">보결</span>
                                    <span className="font-bold text-[11px] text-amber-900">{sub.substituteInstructor}</span>
                                    <OfficialSeal name={sub.substituteInstructor} signatureUrl="" size="sm" />
                                    <span className="text-[9px] text-slate-400 font-sans">(원: {inst})</span>
                                  </div>
                                );
                              }
                              return (
                                <div key={inst} className="flex items-center gap-1.5">
                                  <span className="font-bold text-[11px] text-slate-900">{inst}</span>
                                  <OfficialSeal name={inst} signatureUrl={instructorSignature} size="sm" />
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 items-center justify-center text-slate-400">
                            {daySubs.map(s => (
                              <span key={s.id} className="text-[10px] text-amber-700 font-bold">
                                [{s.targetInstructor || '강사'} {s.isAbsence ? '결근' : `보결: ${s.substituteInstructor}`}]
                              </span>
                            ))}
                            <span>미출근 (체크 전)</span>
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-800 px-1 py-1">
                        <div className="flex flex-col gap-1 items-center justify-center">
                          {instructors.map((inst) => {
                            const sub = daySubs.find(s => !s.targetInstructor || s.targetInstructor === inst);
                            return (
                              <button
                                key={inst}
                                onClick={() => handleOpenSubstituteModal(day, inst)}
                                className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded border transition flex items-center justify-center gap-1 w-full max-w-[120px] ${
                                  sub
                                    ? sub.isAbsence
                                      ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                                      : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                }`}
                                title={sub ? '보결/결근 정보 수정/삭제' : `${inst} 보결 등록 또는 결근 처리`}
                              >
                                <UserPlus className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                <span className="truncate">{instructors.length > 1 ? `${inst}: ` : ''}{sub ? (sub.isAbsence ? '결근 수정' : '보결 수정') : '보결/결근'}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== TAB 3: BATCH APPROVAL / DOCUMENT MANAGEMENT (요청 3: 일괄결재 -> 증빙 문서 관리 및 3개 버튼 통합) ===== */}
      {activeSubTab === 'batchApproval' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" />증빙 문서 관리 & 전자결재 제출함
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                출석부와 강사출근부 증빙 서류를 부장에게 전송하거나 엑셀/공식 A4 서식으로 인쇄할 수 있습니다.
              </p>
            </div>

            {/* 증빙 서류 바로가기 버튼 3종 (요청 3: 일괄결재 탭으로 옮김) */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                onClick={handleSendToDeptHead}
                className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                title="담당 부장에게 결재 서류 전송"
              >
                <Send className="w-3.5 h-3.5" />
                <span>증빙 서류 부장 전송</span>
              </button>

              <button
                onClick={() => exportAttendanceToExcel(currentCourse, enrollments, sessions, attendanceRecords)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                title="엑셀 다운로드"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>엑셀 다운로드</span>
              </button>

              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                title="A4 인쇄"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>공식 출석부 인쇄</span>
              </button>
            </div>
          </div>

          {validApprovalDocs.length === 0 ? (
            <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-slate-500 font-bold text-sm">전송된 증빙 서류가 없습니다.</p>
              <p className="text-xs text-slate-400">상단의 [증빙 서류 부장 전송] 버튼을 눌러 서류를 기안함으로 전송하세요.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {validApprovalDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">{doc.courseTitle}</div>
                    <div className="text-[11px] text-slate-500">강사: {doc.instructorName} · {doc.submittedAt}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      doc.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {doc.status === 'APPROVED' ? '결재완료' : '검토중'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteApprovalDoc(doc.id, doc.courseTitle)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      title="제출 서류 회수(삭제)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>회수/삭제</span>
                    </button>
                  </div>
                </div>
              ))}

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs text-blue-800">
                <div className="font-bold flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />결재 방법 안내</div>
                <p className="mt-0.5">예체능방과후부장(관리자)이 [방과후학교 관리자] → [강좌 현황 & 승인] 탭(강좌별 서류 검토) 및 [전자결재 일괄 기안] 탭에서 kisapp으로 최종 일괄 결재 상신합니다.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== STUDENT CARD POPUP MODAL (요청 6: 학생 카드 팝업 모달) ===== */}
      {modalStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 p-5 space-y-4 relative animate-in zoom-in-95">
            <button
              type="button"
              onClick={() => setModalStudent(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-3 pt-2">
              {/* 대형 프로필 사진 (모서리 둥근 사각형 프레임) */}
              <Avatar className="w-28 h-28 mx-auto rounded-2xl border-2 border-indigo-200 shadow-md">
                {modalStudent.photoUrl ? (
                  <AvatarImage src={modalStudent.photoUrl} alt={modalStudent.name} className="object-cover rounded-2xl" />
                ) : (
                  <AvatarFallback className="bg-indigo-100 text-indigo-800 font-black text-2xl rounded-2xl">
                    {modalStudent.name.slice(0, 2)}
                  </AvatarFallback>
                )}
              </Avatar>

              <div>
                <h3 className="text-xl font-extrabold text-slate-900">{modalStudent.name}</h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  {modalStudent.grade}학년 {modalStudent.classNum}반 {modalStudent.studentNum ? `${modalStudent.studentNum}번` : ''}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              {/* 버스 정보 */}
              <div className="flex items-center justify-between bg-sky-50/70 p-3 rounded-2xl border border-sky-100">
                <span className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                  🚌 탑승 스쿨버스
                </span>
                <span className="text-xs font-extrabold text-sky-800 bg-white px-2.5 py-1 rounded-xl border border-sky-200 shadow-2xs">
                  {modalStudent.busNo}
                </span>
              </div>

              {/* 학부모 연락처 & 클릭 시 모바일 전화 연결 */}
              <div className="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-100 space-y-1.5">
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-indigo-600" /> 학부모 연락처
                </span>
                {modalStudent.contact ? (
                  <a
                    href={`tel:${modalStudent.contact.replace(/\D/g, '')}`}
                    className="flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl transition shadow-sm cursor-pointer"
                  >
                    <Phone className="w-4 h-4" />
                    <span>{modalStudent.contact} (전화 걸기)</span>
                  </a>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-1 font-semibold">등록된 연락처가 없습니다.</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalStudent(null)}
              className="w-full py-2.5 font-bold text-xs rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer transition"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ===== A4 PRINT MODAL ===== */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 p-4 md:p-6 space-y-4 my-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" />공식 A4 출석부 & 강사출근부
              </h3>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="bg-indigo-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1">
                  <Printer className="w-3.5 h-3.5" />인쇄
                </button>
                <button onClick={() => setIsPrintModalOpen(false)} className="text-slate-400 p-1"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {/* A4 Print Area - Student Attendance */}
            <div className="bg-white p-6 border border-slate-300 rounded-lg font-serif space-y-3 text-slate-900">
              <div className="text-xs text-slate-700 font-bold">2026-1 KIS방과후학교</div>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">{currentCourse.title}</h2>
                  <div className="text-xs mt-1 space-y-0.5 font-sans">
                    <div>기간: {currentCourse.period || '2026/03/30-06/20'}</div>
                    <div className="flex items-center gap-1.5">
                      강사: <span className="font-bold text-slate-900">{[currentCourse.instructorName, currentCourse.instructor2, currentCourse.instructor3, currentCourse.instructor4, ...(currentCourse.assistantTeachers || [])].filter(Boolean).join(' · ') || '강사'}</span>
                      <OfficialSeal
                        name={currentCourse.instructorName || '강사'}
                        signatureUrl={instructorSignature}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
                <table className="border-collapse border border-slate-800 text-xs text-center font-sans">
                  <tbody>
                    <tr>
                      <td rowSpan={2} className="border border-slate-800 bg-slate-100 px-1 py-2 font-bold w-5 leading-tight text-[10px]">결<br/>재</td>
                      <td className="border border-slate-800 px-2 py-0.5 font-bold w-12 bg-slate-50 text-[11px]">부장</td>
                      <td className="border border-slate-800 px-2 py-0.5 font-bold w-12 bg-slate-50 text-[11px]">교감</td>
                    </tr>
                    <tr className="h-9">
                      <td className="border border-slate-800 p-0.5">
                        {isManagerApproved ? (
                          managerSignature ? (
                            <img src={managerSignature} alt="부장" className="w-8 h-8 object-contain mx-auto" />
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-800">승인</span>
                          )
                        ) : null}
                      </td>
                      <td className="border border-slate-800 p-0.5">
                        {isVicePrincipalApproved ? (
                          vicePrincipalSignature ? (
                            <img src={vicePrincipalSignature} alt="교감" className="w-8 h-8 object-contain mx-auto" />
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-800">승인</span>
                          )
                        ) : null}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <table className="w-full border-collapse border border-slate-800 text-xs text-center font-sans table-fixed">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="border border-slate-800 p-1 w-6">순</th>
                    <th className="border border-slate-800 p-1 w-6">학년</th>
                    <th className="border border-slate-800 p-1 w-6">반</th>
                    <th className="border border-slate-800 p-1 w-6">번</th>
                    <th className="border border-slate-800 p-1 w-16">이름</th>
                    {scheduleDays.map((d) => (
                      <th key={d.dayIndex} className="border border-slate-800 p-0.5 text-[9px] min-w-[20px]">
                        <div>{d.dateStr}</div>
                        <div className="text-[8px] font-normal">{d.dayIndex}회</div>
                      </th>
                    ))}
                    <th className="border border-slate-800 p-1 w-10">버스</th>
                    <th className="border border-slate-800 p-1 w-20">학부모</th>
                  </tr>
                </thead>
                <tbody>
                  {courseStudents.map((enrollment, idx) => {
                    const matchedStudent = studentsList.find((s) => s.id === enrollment.studentId);
                    return (
                      <tr key={enrollment.id} className="h-6">
                        <td className="border border-slate-800">{idx + 1}</td>
                        <td className="border border-slate-800">{enrollment.grade}</td>
                        <td className="border border-slate-800">{enrollment.classNum}</td>
                        <td className="border border-slate-800">{enrollment.studentNum}</td>
                        <td className="border border-slate-800 font-bold text-center">{enrollment.name}</td>
                        {scheduleDays.map((d) => {
                          const mark = getDayMark(enrollment.studentId, d.dayIndex);
                          const { symbol } = markDisplay(mark);
                          return <td key={d.dayIndex} className="border border-slate-800 font-bold">{symbol !== '·' ? symbol : ''}</td>;
                        })}
                        <td className="border border-slate-800 text-[10px]">{matchedStudent?.kisbusNo || enrollment.kisbusNo || ''}</td>
                        <td className="border border-slate-800 text-[10px]">{enrollment.parentPhone || matchedStudent?.parentPhone || ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== SUBSTITUTE & ABSENCE REGISTRATION MODAL ===== */}
      {isSubModalOpen && subTargetDay && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-amber-600 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                <h3 className="font-bold text-base">강사 출결 및 보결/결근 관리</h3>
              </div>
              <button
                onClick={() => setIsSubModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-sm">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-1">
                <div className="font-bold text-amber-950">{currentCourse?.title}</div>
                <div className="text-xs text-amber-800">
                  대상 회차: <strong>{subTargetDay.dayIndex}회차 ({subTargetDay.startSessionNo}~{subTargetDay.endSessionNo}차시)</strong> · 일자: {subTargetDay.dateStr} ({subTargetDay.fullDate})
                </div>
              </div>

              {/* 대상 강사 선택 (복수 강사인 경우) */}
              {(() => {
                const allInsts = [
                  currentCourse?.instructorName,
                  currentCourse?.instructor2,
                  currentCourse?.instructor3,
                  currentCourse?.instructor4,
                  ...(currentCourse?.assistantTeachers || [])
                ].filter(Boolean) as string[];

                if (allInsts.length <= 1) return null;

                return (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">대상 강사</label>
                    <select
                      value={subTargetInstructor}
                      onChange={(e) => setSubTargetInstructor(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      {allInsts.map(inst => (
                        <option key={inst} value={inst}>{inst}</option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              {/* 보결 vs 결근 선택 탭 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">처리 유형 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSubRecordType('SUBSTITUTE')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      subRecordType === 'SUBSTITUTE'
                        ? 'bg-amber-100 border-amber-400 text-amber-900 ring-1 ring-amber-400 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>보결 강사 등록</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubRecordType('ABSENCE')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      subRecordType === 'ABSENCE'
                        ? 'bg-rose-100 border-rose-400 text-rose-900 ring-1 ring-rose-400 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>결근 처리 (보결 없음)</span>
                  </button>
                </div>
              </div>

              {subRecordType === 'SUBSTITUTE' ? (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <label className="block text-xs font-bold text-slate-700">
                    보결 강사 성명 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="대강을 진행할 보결 강사 이름 입력"
                    value={subTeacherName}
                    onChange={(e) => setSubTeacherName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-500">
                    ※ 보결 강사로 등록 시 출근부에 보결자 도장이 날인되며, 강사료 정산 시 수당이 보결 강사에게 책정됩니다.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1 animate-in fade-in duration-150">
                  <p className="font-bold">※ 결근 처리 시 안내사항</p>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    해당 회차는 보결 강사 없이 <strong>결근 처리</strong>되며, 출근부에서 출근 날인이 생략됩니다. (단, 학생 출석체크는 다른 강사가 정상 진행할 수 있습니다.)
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">{subRecordType === 'SUBSTITUTE' ? '결강 및 보결 사유' : '결근 사유'}</label>
                <input
                  type="text"
                  placeholder="예: 병가, 공결, 출장, 개인사정 등"
                  value={subReason}
                  onChange={(e) => setSubReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                {substituteRecords.some(s => s.courseId === currentCourse?.id && s.dayIndex === subTargetDay.dayIndex && (!s.targetInstructor || s.targetInstructor === subTargetInstructor)) && (
                  <button
                    onClick={() => {
                      const existing = substituteRecords.find(s => s.courseId === currentCourse?.id && s.dayIndex === subTargetDay.dayIndex && (!s.targetInstructor || s.targetInstructor === subTargetInstructor));
                      if (existing) handleDeleteSubstitute(existing.id);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    삭제
                  </button>
                )}
                <button
                  onClick={() => setIsSubModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition"
                >
                  닫기
                </button>
                <button
                  onClick={handleSaveSubstitute}
                  className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 ${
                    subRecordType === 'SUBSTITUTE' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {subRecordType === 'SUBSTITUTE' ? '보결 강사 저장' : '결근 처리 완료'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
