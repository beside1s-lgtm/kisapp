import React, { useState, useEffect } from 'react';
import type { GlobalTimerConfig, Course, Enrollment, MaterialRequest, ExpenseProof } from '@/lib/afterschool/types';
import {
  Lock,
  Unlock,
  Pause,
  Timer,
  Activity,
  Zap,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Calendar,
  X,
  Check,
  Play,
  AlertCircle,
  Plus,
  Trash2,
  Save,
  FileText,
  Settings,
  Package,
  DollarSign,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  Printer,
  FileCheck,
  CreditCard,
  ImageIcon,
  RotateCw
} from 'lucide-react';
import { safeParseDate } from '../student/StudentView';
import {
  updateAfterschoolCourse,
  onTeacherApplySettingsUpdate,
  defaultTeacherApplySettings,
  runAfterschoolEnrollmentTransaction,
  deleteAfterschoolEnrollment,
  saveTeacherApplySettings,
  onMaterialRequestsUpdate,
  updateMaterialRequestStatus,
  deleteMaterialRequest,
  getMaterialBudgetSettings,
  saveMaterialBudgetSettings,
  onExpenseProofsUpdate,
  updateExpenseProofStatus,
  deleteExpenseProof
} from '@/lib/services/settingsService';
import { PrintExpenseProofModal } from './PrintExpenseProofModal';
import { ELEMENTARY_PERIOD_TIMES } from '@/lib/afterschool/excel';
import { onDocConfigUpdate, saveDocConfig } from '@/lib/services/settingsService';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/kisbus/utils';
import type { DocConfig } from '@/lib/types';
import { generateCalendarSchedule, calculateRealOperatingWeeksAndDays } from '@/lib/afterschool/schedule';
import { DEFAULT_ACADEMIC_CALENDAR_CONFIG } from '@/lib/services/academicCalendarService';

interface AdminControlRoomProps {
  timerConfig: GlobalTimerConfig;
  setTimerConfig: React.Dispatch<React.SetStateAction<GlobalTimerConfig>>;
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  enrollments: Enrollment[];
  setEnrollments: React.Dispatch<React.SetStateAction<Enrollment[]>>;
}

export const AdminControlRoom: React.FC<AdminControlRoomProps> = ({
  timerConfig,
  setTimerConfig,
  courses,
  setCourses,
  setEnrollments,
}) => {
  // Real-time calculation state
  const [nowTime, setNowTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [controlTab, setControlTab] = useState<'enroll' | 'teacher' | 'material'>('enroll');
  const [docConfig, setDocConfig] = useState<Partial<DocConfig>>({});
  const [draftAccount, setDraftAccount] = useState('');
  const [draftQrImage, setDraftQrImage] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  useEffect(() => {
    const unsub = onDocConfigUpdate((cfg) => {
      setDocConfig(cfg);
      if (cfg) {
        setDraftAccount(cfg.afterschoolAccount || '');
        setDraftQrImage(cfg.afterschoolQrImage || '');
      }
    });
    return () => unsub();
  }, []);

  const handleSavePaymentInfo = async () => {
    setIsSavingAccount(true);
    try {
      await saveDocConfig({
        afterschoolAccount: draftAccount,
        afterschoolQrImage: draftQrImage
      });
      alert('학부모 수강료 납부 계좌 및 QR 코드가 성공적으로 저장되었습니다.');
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleToggleAfterschoolApply = async (checked: boolean) => {
    try {
      await saveDocConfig({ isAfterschoolApplyActive: checked });
    } catch (err) {
      console.error(err);
    }
  };

  // ─── 학습준비물 신청 제어 상태 ───────────────────────────────────────────────
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [totalBudget, setTotalBudget] = useState(500000);
  const [maxPerCourse, setMaxPerCourse] = useState(50000);
  const [materialCurrency, setMaterialCurrency] = useState<'KRW' | 'VND' | 'USD'>('KRW');
  const [draftTotalBudget, setDraftTotalBudget] = useState(500000);
  const [draftMaxPerCourse, setDraftMaxPerCourse] = useState(50000);
  const [draftMaterialCurrency, setDraftMaterialCurrency] = useState<'KRW' | 'VND' | 'USD'>('KRW');
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const formatMoney = (amount: number, cur: 'KRW' | 'VND' | 'USD' = materialCurrency) => {
    const formatted = amount.toLocaleString();
    if (cur === 'VND') return `${formatted} VND`;
    if (cur === 'USD') return `$${formatted}`;
    return `${formatted}원`;
  };

  const [expenseProofs, setExpenseProofs] = useState<ExpenseProof[]>([]);
  const [previewProofAdmin, setPreviewProofAdmin] = useState<ExpenseProof | null>(null);

  useEffect(() => {
    getMaterialBudgetSettings().then((s) => {
      setTotalBudget(s.totalBudget);
      setMaxPerCourse(s.maxPerCourse);
      setMaterialCurrency(s.currency || 'KRW');
      setDraftTotalBudget(s.totalBudget);
      setDraftMaxPerCourse(s.maxPerCourse);
      setDraftMaterialCurrency(s.currency || 'KRW');
    });
    const unsubReq = onMaterialRequestsUpdate((list) => setMaterialRequests(list));
    const unsubProof = onExpenseProofsUpdate((list) => setExpenseProofs(list));
    return () => {
      unsubReq();
      unsubProof();
    };
  }, []);

  const handleSaveBudgetSettings = async () => {
    setIsSavingBudget(true);
    const res = await saveMaterialBudgetSettings({
      totalBudget: draftTotalBudget,
      maxPerCourse: draftMaxPerCourse,
      currency: draftMaterialCurrency,
    });
    setIsSavingBudget(false);
    if (res.success) {
      setTotalBudget(draftTotalBudget);
      setMaxPerCourse(draftMaxPerCourse);
      setMaterialCurrency(draftMaterialCurrency);
      alert('예산 및 화폐 단위 설정이 저장되었습니다.');
    } else {
      alert(`저장 실패: ${res.error}`);
    }
  };

  const handleApprove = async (requestId: string) => {
    const res = await updateMaterialRequestStatus(requestId, 'APPROVED');
    if (!res.success) alert(`승인 실패: ${res.error}`);
  };

  const handleReject = async (requestId: string) => {
    if (!rejectReason.trim()) { alert('반려 사유를 입력해주세요.'); return; }
    const res = await updateMaterialRequestStatus(requestId, 'REJECTED', rejectReason);
    if (res.success) { setRejectingId(null); setRejectReason(''); }
    else alert(`반려 실패: ${res.error}`);
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('이 신청 항목을 삭제하시겠습니까?')) return;
    await deleteMaterialRequest(requestId);
  };

  const approvedTotal = materialRequests
    .filter(r => r.status === 'APPROVED')
    .reduce((s, r) => s + r.totalAmount, 0);
  const pendingTotal = materialRequests
    .filter(r => r.status === 'PENDING')
    .reduce((s, r) => s + r.totalAmount, 0);

  const [teacherApplySettings, setTeacherApplySettings] = useState(defaultTeacherApplySettings);
  const [draftTeacherApply, setDraftTeacherApply] = useState(defaultTeacherApplySettings);
  const [isSavingTeacherApply, setIsSavingTeacherApply] = useState(false);

  useEffect(() => {
    const unsub = onTeacherApplySettingsUpdate((cfg) => {
      setTeacherApplySettings(cfg);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setDraftTeacherApply(teacherApplySettings);
  }, [teacherApplySettings]);

  const handleSaveTeacherApplySettings = async () => {
    setIsSavingTeacherApply(true);
    const res = await saveTeacherApplySettings(draftTeacherApply);
    setIsSavingTeacherApply(false);
    if (res.success) {
      alert('강사용 강좌 개설(신청) 권한 설정이 성공적으로 저장 및 적용되었습니다!');
    } else {
      alert(`설정 저장 실패: ${res.error}`);
    }
  };

  const handleApplyDateChange = (field: 'applyStartDate' | 'applyEndDate', datetimeLocalVal: string) => {
    if (!datetimeLocalVal) return;
    const formatted = datetimeLocalVal.replace('T', ' ') + ':00';
    setDraftTeacherApply(prev => ({ ...prev, [field]: formatted }));
  };

  // 학사일정 기반 학기별 시작일/종료일 및 휴업일 자동 연동
  const getSemesterDatesFromAcademicCalendar = (semName: string) => {
    const cal = docConfig?.academicCalendar || DEFAULT_ACADEMIC_CALENDAR_CONFIG;
    const { sem1, vacationSummer, sem2, vacationWinter } = cal.semesters || DEFAULT_ACADEMIC_CALENDAR_CONFIG.semesters;
    
    if (semName === '1학기' && sem1) {
      return { startDate: sem1.startDate || '2026-03-02', endDate: sem1.endDate || '2026-07-17', year: String(cal.year || 2026) };
    }
    if (semName === '여름방학' && vacationSummer) {
      return { startDate: vacationSummer.startDate || '2026-07-18', endDate: vacationSummer.endDate || '2026-08-16', year: String(cal.year || 2026) };
    }
    if (semName === '2학기' && sem2) {
      return { startDate: sem2.startDate || '2026-08-17', endDate: sem2.endDate || '2027-01-08', year: String(cal.year || 2026) };
    }
    if (semName === '겨울방학' && vacationWinter) {
      return { startDate: vacationWinter.startDate || '2027-01-09', endDate: vacationWinter.endDate || '2027-02-28', year: String(cal.year || 2026) };
    }
    return { startDate: draftTeacherApply.operatingStartDate, endDate: draftTeacherApply.operatingEndDate, year: String(cal.year || 2026) };
  };

  const handleSemesterChange = (newSem: string) => {
    const { startDate, endDate, year } = getSemesterDatesFromAcademicCalendar(newSem);
    const holidayDates = (docConfig?.academicCalendar?.events || DEFAULT_ACADEMIC_CALENDAR_CONFIG.events || [])
      .filter(e => !e.isSchoolDay || e.type === 'HOLIDAY' || e.type === 'PUBLIC_HOLIDAY')
      .map(e => e.date);
    const allowedDays = draftTeacherApply.allowedDays || ['월', '화', '수', '목', '금'];
    const { operatingWeeks } = calculateRealOperatingWeeksAndDays(startDate, endDate, allowedDays, holidayDates);

    setDraftTeacherApply(prev => ({
      ...prev,
      semester: newSem as any,
      year: year || prev.year,
      operatingStartDate: startDate,
      operatingEndDate: endDate,
      operatingWeeks: operatingWeeks > 0 ? operatingWeeks : prev.operatingWeeks
    }));
  };

  const handleOperatingDateChange = (field: 'operatingStartDate' | 'operatingEndDate', val: string) => {
    const nextStart = field === 'operatingStartDate' ? val : draftTeacherApply.operatingStartDate;
    const nextEnd = field === 'operatingEndDate' ? val : draftTeacherApply.operatingEndDate;
    const holidayDates = (docConfig?.academicCalendar?.events || DEFAULT_ACADEMIC_CALENDAR_CONFIG.events || [])
      .filter(e => !e.isSchoolDay || e.type === 'HOLIDAY' || e.type === 'PUBLIC_HOLIDAY')
      .map(e => e.date);
    const allowedDays = draftTeacherApply.allowedDays || ['월', '화', '수', '목', '금'];
    const { operatingWeeks } = calculateRealOperatingWeeksAndDays(nextStart, nextEnd, allowedDays, holidayDates);

    setDraftTeacherApply(prev => ({
      ...prev,
      [field]: val,
      operatingWeeks: operatingWeeks > 0 ? operatingWeeks : prev.operatingWeeks
    }));
  };

  const handleSyncWithAcademicCalendar = () => {
    const currentSem = draftTeacherApply.semester || '2학기';
    handleSemesterChange(currentSem);
  };

  // 실시간 운영 통계 (휴업일 제외 실제 수업일수 및 요일별 횟수)
  const realtimeOperatingStats = React.useMemo(() => {
    const holidayDates = (docConfig?.academicCalendar?.events || DEFAULT_ACADEMIC_CALENDAR_CONFIG.events || [])
      .filter(e => !e.isSchoolDay || e.type === 'HOLIDAY' || e.type === 'PUBLIC_HOLIDAY')
      .map(e => e.date);
    const allowedDays = draftTeacherApply.allowedDays || ['월', '화', '수', '목', '금'];
    return calculateRealOperatingWeeksAndDays(
      draftTeacherApply.operatingStartDate || '2026-08-17',
      draftTeacherApply.operatingEndDate || '2027-01-08',
      allowedDays,
      holidayDates
    );
  }, [draftTeacherApply.operatingStartDate, draftTeacherApply.operatingEndDate, draftTeacherApply.allowedDays, docConfig?.academicCalendar]);

  // 수업 시간대 템플릿 관리용 임시 상태
  const [newSlotLabel, setNewSlotLabel] = useState('');
  const [newSlotStart, setNewSlotStart] = useState('15:00');
  const [newSlotEnd, setNewSlotEnd] = useState('16:40');
  const [newSlotType, setNewSlotType] = useState<'SEMESTER' | 'VACATION_OR_SAT'>('SEMESTER');

  const handleAddClockSlot = () => {
    if (!newSlotLabel.trim()) return;
    const newSlot = {
      id: `ts_${Date.now()}`,
      label: `${newSlotLabel.trim()} (${newSlotStart}~${newSlotEnd})`,
      startTime: newSlotStart,
      endTime: newSlotEnd,
      type: newSlotType,
    };
    setDraftTeacherApply((prev: any) => ({
      ...prev,
      timeSlots: [...(prev.timeSlots || []), newSlot]
    }));
    setNewSlotLabel('');
  };

  const handleRemoveClockSlot = (id: string) => {
    setDraftTeacherApply((prev: any) => ({
      ...prev,
      timeSlots: (prev.timeSlots || []).filter((s: any) => s.id !== id)
    }));
  };

  const startTime = safeParseDate(timerConfig.startTime).getTime();
  const endTime = safeParseDate(timerConfig.endTime).getTime();
  const nowMs = nowTime.getTime();

  const isBeforeStart = nowMs < startTime;
  const isAfterEnd = nowMs > endTime;

  const isApplyEnabled = () => {
    if (timerConfig.masterStatus === 'FORCE_LOCK' || timerConfig.masterStatus === 'PAUSED') return false;
    if (timerConfig.masterStatus === 'FORCE_OPEN') return true;
    return !isBeforeStart && !isAfterEnd;
  };

  const getStatusText = () => {
    if (timerConfig.masterStatus === 'FORCE_LOCK') return '긴급 강제 마감 상태 (신청 불가)';
    if (timerConfig.masterStatus === 'PAUSED') return '일시 정지 상태 (신청 불가)';
    if (timerConfig.masterStatus === 'FORCE_OPEN') return '강제 신청 진행 중 (신청 가능)';
    
    if (isBeforeStart) return '수강신청 대기 중 (신청 불가)';
    if (isAfterEnd) return '수강신청 기간 만료 (신청 마감)';
    return '실시간 수강 신청 진행 중 (신청 가능)';
  };

  const getDetailedStatusText = () => {
    if (!teacherApplySettings) return getStatusText();

    const y = teacherApplySettings.year || '2026';
    const sem = teacherApplySettings.semester || '1학기';
    const programName = sem.includes('학기') ? `${y}학년도 제${sem} 방과후학교` : `${y}학년도 ${sem} 방과후학교`;

    // 마스터 설정 상태가 직접 지정되어 있는 경우 최우선 반영
    const stageStatus = (teacherApplySettings as any).afterschoolStageStatus;
    if (stageStatus === 'RECRUITING') return `${programName} 강사 모집 중`;
    if (stageStatus === 'APPLYING') return `${programName} 수강 신청 중`;
    if (stageStatus === 'CONFIRMED') return `${programName} 수강신청 완료 (결과 확정 통보)`;
    if (stageStatus === 'OPERATING') return `${programName} 운영 중 (출석부 활성화)`;
    if (stageStatus === 'CLOSED') return `${programName} 운영 종료`;

    const nowMs = nowTime.getTime();

    // 1. 강사 강좌 개설 신청 접수 일정 체크
    const isTeacherApplyActive = (() => {
      const status = (teacherApplySettings as any).masterStatus || 'AUTO';
      if (status === 'FORCE_LOCK' || status === 'PAUSED') return false;
      if (status === 'FORCE_OPEN') return true;

      const applyStart = safeParseDate(teacherApplySettings.applyStartDate).getTime();
      const applyEnd = safeParseDate(teacherApplySettings.applyEndDate).getTime();
      return !isNaN(applyStart) && !isNaN(applyEnd) && nowMs >= applyStart && nowMs <= applyEnd;
    })();

    if (isTeacherApplyActive) {
      return `${programName} 강사 모집 중`;
    }

    // 2. 수강 신청 중 체크
    const isApplyOn = isApplyEnabled();
    if (isApplyOn) {
      return `${programName} 수강신청 진행 중`;
    }

    // 3. 운영 시작일 ~ 운영 종료일 체크
    const opStart = new Date(teacherApplySettings.operatingStartDate || '').getTime();
    const opEnd = new Date(teacherApplySettings.operatingEndDate || '').getTime();
    if (!isNaN(opStart) && !isNaN(opEnd)) {
      if (nowMs >= opStart && nowMs <= opEnd) {
        return `${programName} 운영 중 (출석부 활성화)`;
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

  // Simulator State & Modal Toggle
  const [isStressTestModalOpen, setIsStressTestModalOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [testMode, setTestMode] = useState<'single' | 'multi'>('single');
  const [useRealDb, setUseRealDb] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState(0);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [simResults, setSimResults] = useState<{
    totalBots: number;
    successEnrolled: number;
    assignedWaiting: number;
    rejected: number;
    elapsedMs: number;
  } | null>(null);

  const [selectedSimCourseId, setSelectedSimCourseId] = useState<string>(courses[0]?.id || 'c1');

  // Draft Datetime States (사용자가 확인 버튼을 누를 때까지 임시 보관)
  const [draftStartTime, setDraftStartTime] = useState<string>(timerConfig.startTime);
  const [draftEndTime, setDraftEndTime] = useState<string>(timerConfig.endTime);
  const [isSaveNoticeVisible, setIsSaveNoticeVisible] = useState(false);

  // Convert Date String <-> datetime-local input string (YYYY-MM-DDTHH:mm)
  const formatForDatetimeInput = (dateStr: string) => {
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return '';
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const handleDatetimeDraftChange = (field: 'startTime' | 'endTime', datetimeLocalVal: string) => {
    if (!datetimeLocalVal) return;
    const formatted = datetimeLocalVal.replace('T', ' ') + ':00';
    if (field === 'startTime') {
      setDraftStartTime(formatted);
    } else {
      setDraftEndTime(formatted);
    }
  };

  // [✓ 타이머 설정 확인 및 적용] 버튼 클릭 핸들러
  const handleConfirmAndApplyTimer = () => {
    setTimerConfig((prev) => ({
      ...prev,
      startTime: draftStartTime,
      endTime: draftEndTime,
    }));
    setIsSaveNoticeVisible(true);
    setTimeout(() => setIsSaveNoticeVisible(false), 2500);
  };

  // Change master lock status
  const handleSetMasterStatus = (status: GlobalTimerConfig['masterStatus']) => {
    setTimerConfig((prev) => ({ ...prev, masterStatus: status }));
  };

  // 마스터 운영 단계 (강사모집 / 수강신청 / 운영중 / 종료) 상태 변경
  const handleUpdateStageStatus = async (status: 'RECRUITING' | 'APPLYING' | 'OPERATING' | 'CLOSED') => {
    if (!teacherApplySettings) return;
    const updated = { ...teacherApplySettings, afterschoolStageStatus: status };
    setTeacherApplySettings(updated as any);
    await saveTeacherApplySettings({ afterschoolStageStatus: status });
    const labelMap = {
      RECRUITING: '강사 모집 중',
      APPLYING: '수강 신청 중',
      OPERATING: '방과후학교 운영 중 (출석부 활성화)',
      CLOSED: '운영 종료',
    };
    alert(`방과후학교 진행 상태가 [${labelMap[status]}]로 성공적으로 변경되었습니다.`);
  };

  // Quick timer preset: "10초 후 시작"
  const handleSetQuickTimer = (secondsFromNow: number) => {
    const start = new Date(Date.now() + secondsFromNow * 1000);
    const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const startStr = start.toISOString().replace('T', ' ').slice(0, 19);
    const endStr = end.toISOString().replace('T', ' ').slice(0, 19);

    setDraftStartTime(startStr);
    setDraftEndTime(endStr);
    setTimerConfig((prev) => ({
      ...prev,
      startTime: startStr,
      endTime: endStr,
      masterStatus: 'AUTO',
    }));
    setIsSaveNoticeVisible(true);
    setTimeout(() => setIsSaveNoticeVisible(false), 2500);
  };

  // Toggle single course lock
  const handleToggleCourseLock = async (courseId: string) => {
    const course = courses.find((c) => c.id === courseId);
    if (course) {
      await updateAfterschoolCourse(courseId, { isForceLocked: !course.isForceLocked });
    }
  };

  // 1,000명 동시접속 스트레스 테스트 시뮬레이터 실행
  const handleRun1000BotsTrafficSimulation = async () => {
    setIsSimulating(true);
    setSimProgress(0);
    setSimLogs([
      `[0ms] 1,000명 동시 수강신청 패킷 진입`,
      `[10ms] 가상 대기열 순번표(Queue Token) 1,000건 발급`,
      `[50ms] 수강 처리 연산 시작...`
    ]);
    setSimResults(null);

    const startTime = Date.now();

    // 1. 실제 파이어베이스 DB 연동 테스트 모드인 경우
    if (useRealDb) {
      try {
        setSimLogs((prev) => [`[실제 DB 모드] 1,000명 트랜잭션 동시성 쏘기 시작...`, ...prev]);
        
        let enrolled = 0;
        let waiting = 0;
        let failed = 0;

        // 1000명의 가상 봇 생성
        const bots = Array.from({ length: 1000 }, (_, i) => {
          // 다중 분산일 때는 courses 내의 임의 강좌 선택, 단일일 때는 selectedSimCourseId 선택
          const target = testMode === 'multi' 
            ? courses[Math.floor(Math.random() * courses.length)] 
            : (courses.find((c) => c.id === selectedSimCourseId) || courses[0]);
          return {
            id: `sim_bot_${Date.now()}_${i + 1}`,
            course: target,
            index: i + 1
          };
        });

        // 동시성 락 경합 방지를 위해 20개씩 청킹하여 날림
        const CHUNK_SIZE = 20;
        for (let i = 0; i < bots.length; i += CHUNK_SIZE) {
          const chunk = bots.slice(i, i + CHUNK_SIZE);
          
          await Promise.all(
            chunk.map(async (bot) => {
              // 봇 개별 무작위 Micro-Jitter (0ms~40ms) 지연을 부여하여 트랜잭션 락 집중 해소
              await new Promise(r => setTimeout(r, Math.floor(Math.random() * 40)));

              const res = await runAfterschoolEnrollmentTransaction(
                bot.id,
                bot.course.id,
                `bot_s_${bot.index}`,
                {
                  name: `가상학생_${bot.index}`,
                  phone: '010-9999-0000',
                  parentPhone: '010-9999-0000',
                },
                bot.course.tuition,
                bot.course.textbookFee || 0,
                bot.course.materialFee || 0
              );

              if (res.success) {
                if (res.status === 'ENROLLED') enrolled++;
                else waiting++;
              } else {
                failed++;
              }
            })
          );

          const progress = Math.min(100, Math.floor(((i + CHUNK_SIZE) / 1000) * 100));
          setSimProgress(progress);
          setSimLogs((prev) => [
            `[${Date.now() - startTime}ms] 실제 DB 트랜잭션 처리 중: ${Math.min(1000, i + CHUNK_SIZE)} / 1000명 (성공:${enrolled}, 대기:${waiting}, 실패:${failed})`,
            ...prev.slice(0, 5)
          ]);
        }

        const elapsedTime = Date.now() - startTime;
        setSimResults({
          totalBots: 1000,
          successEnrolled: enrolled,
          assignedWaiting: waiting,
          rejected: failed,
          elapsedMs: elapsedTime,
        });
        setSimLogs((prev) => [`[완료] 실제 DB 1,000명 동시 트랜잭션 테스트 완료!`, ...prev]);

      } catch (err: any) {
        setSimLogs((prev) => [`[에러 발생] ${err.message}`, ...prev]);
      } finally {
        setIsSimulating(false);
      }
      return;
    }

    // 2. 가상 메모리 시뮬레이션 모드인 경우
    let currentCount = 0;
    const interval = setInterval(() => {
      currentCount += 100;
      const progress = Math.min(100, Math.floor((currentCount / 1000) * 100));
      setSimProgress(progress);

      setSimLogs((prev) => [
        `[${Date.now() - startTime}ms] 대기열 시뮬레이션 처리 진행 중: ${currentCount} / 1000명`,
        ...prev.slice(0, 5),
      ]);

      if (currentCount >= 1000) {
        clearInterval(interval);
        const elapsedTime = Date.now() - startTime;

        let totalEnrolled = 0;
        let totalWaiting = 0;
        let totalRejected = 0;

        const newEnrollments: Enrollment[] = [];
        const courseUpdates = [...courses];

        for (let i = 1; i <= 1000; i++) {
          const targetCourse = testMode === 'multi'
            ? courseUpdates[Math.floor(Math.random() * courseUpdates.length)]
            : (courseUpdates.find((c) => c.id === selectedSimCourseId) || courseUpdates[0]);

          const availableSeats = Math.max(0, targetCourse.maxStudents - targetCourse.currentStudents);
          const isEnrolled = availableSeats > 0;

          const waitingSeats = Math.max(0, targetCourse.maxWaiting - targetCourse.waitingStudents);
          const isWaiting = !isEnrolled && waitingSeats > 0;

          if (isEnrolled) {
            targetCourse.currentStudents++;
            totalEnrolled++;
          } else if (isWaiting) {
            targetCourse.waitingStudents++;
            totalWaiting++;
          } else {
            totalRejected++;
          }

          if (isEnrolled || isWaiting) {
            newEnrollments.push({
              id: `sim_bot_${Date.now()}_${i}`,
              courseId: targetCourse.id,
              studentId: `bot_s_${i}`,
              yearNo: i,
              grade: Math.floor(Math.random() * 6) + 1,
              classNum: Math.floor(Math.random() * 3) + 1,
              studentNum: (i % 30) + 1,
              name: `가상학생_${i}`,
              phone: '010-9999-0000',
              parentPhone: '010-9999-0000',
              tuition: targetCourse.tuition,
              textbookFee: targetCourse.textbookFee,
              materialFee: targetCourse.materialFee,
              registrationDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
              status: isEnrolled ? 'ENROLLED' : 'WAITING',
              timestampMs: startTime + i * 2,
            });
          }
        }

        setEnrollments((prev) => [...newEnrollments, ...prev]);
        setCourses(courseUpdates.map(c => ({
          ...c,
          status: c.currentStudents >= c.maxStudents ? 'CLOSED' : c.status
        })));

        setSimResults({
          totalBots: 1000,
          successEnrolled: totalEnrolled,
          assignedWaiting: totalWaiting,
          rejected: totalRejected,
          elapsedMs: elapsedTime,
        });
        setIsSimulating(false);
      }
    }, 100);
  };

  // 시뮬레이션용 가상 데이터 삭제 및 원상복구
  const handleCleanTestData = async () => {
    setIsCleaning(true);
    setSimLogs([`[0ms] 가상 테스트 데이터 초기화 시작...`]);
    const startTime = Date.now();

    try {
      const { collection, getDocs, deleteDoc, doc } = require('firebase/firestore');
      const { getDb } = require('@/lib/firebase');
      const snap = await getDocs(collection(getDb(), 'afterschool_enrollments'));
      
      const botEnrollments = snap.docs.filter((d: any) => d.id.startsWith('sim_bot_'));
      setSimLogs((prev) => [`[조회 완료] sim_bot 수강신청 문서 ${botEnrollments.length}건 감지`, ...prev]);

      if (botEnrollments.length === 0) {
        setSimLogs((prev) => [`[안내] 삭제할 가상 봇 데이터가 없습니다.`, ...prev]);
        alert('삭제할 가상 데이터가 없습니다.');
        return;
      }

      // 차감 계산 맵 구성
      const diffMap: { [courseId: string]: { enrolled: number; waiting: number } } = {};
      botEnrollments.forEach((d: any) => {
        const data = d.data();
        if (!diffMap[data.courseId]) {
          diffMap[data.courseId] = { enrolled: 0, waiting: 0 };
        }
        if (data.status === 'ENROLLED') {
          diffMap[data.courseId].enrolled++;
        } else {
          diffMap[data.courseId].waiting++;
        }
      });

      // 청크 단위 문서 삭제
      const CHUNK_SIZE = 50;
      for (let i = 0; i < botEnrollments.length; i += CHUNK_SIZE) {
        const chunk = botEnrollments.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map((d: any) => deleteDoc(doc(getDb(), 'afterschool_enrollments', d.id))));
        setSimLogs((prev) => [`[삭제 진행] ${Math.min(botEnrollments.length, i + CHUNK_SIZE)} / ${botEnrollments.length}건 완료`, ...prev]);
      }

      // 강좌 카운트 복원
      setSimLogs((prev) => [`[강좌 카운트 복원] 강좌별 수강인원 차감 복구 중...`, ...prev]);
      for (const courseId of Object.keys(diffMap)) {
        const diff = diffMap[courseId];
        const course = courses.find(c => c.id === courseId);
        if (course) {
          const newCurrent = Math.max(0, course.currentStudents - diff.enrolled);
          const newWaiting = Math.max(0, course.waitingStudents - diff.waiting);
          await updateAfterschoolCourse(courseId, {
            currentStudents: newCurrent,
            waitingStudents: newWaiting
          });
        }
      }

      // 로컬 상태 원복
      setEnrollments((prev) => prev.filter(e => !e.id.startsWith('sim_bot_')));
      setCourses((prev) => prev.map(c => {
        const diff = diffMap[c.id];
        if (diff) {
          return {
            ...c,
            currentStudents: Math.max(0, c.currentStudents - diff.enrolled),
            waitingStudents: Math.max(0, c.waitingStudents - diff.waiting),
            status: 'OPEN'
          };
        }
        return c;
      }));

      setSimLogs((prev) => [`[완료] 가상 테스트 데이터 삭제 및 강좌 인원 원상 복구 완료! (${Date.now() - startTime}ms)`, ...prev]);
      alert('가상 테스트 데이터가 깔끔하게 삭제 및 복구되었습니다!');
    } catch (err: any) {
      setSimLogs((prev) => [`[초기화 에러] ${err.message}`, ...prev]);
      alert(`초기화 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 하위 서브 탭리스트 */}
      <div className="flex border-b border-slate-200 bg-slate-50/50 rounded-t-xl shrink-0 p-1">
        <button
          type="button"
          onClick={() => setControlTab('enroll')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
            controlTab === 'enroll'
              ? 'border-indigo-600 bg-white text-indigo-700 shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Zap size={14} /> 수강신청 제어
        </button>
        <button
          type="button"
          onClick={() => setControlTab('teacher')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
            controlTab === 'teacher'
              ? 'border-indigo-600 bg-white text-indigo-700 shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings size={14} /> 강사 신청 제어
        </button>
        <button
          type="button"
          onClick={() => setControlTab('material')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
            controlTab === 'material'
              ? 'border-emerald-600 bg-white text-emerald-700 shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package size={14} /> 준비물 신청 제어
          {materialRequests.filter(r => r.status === 'PENDING').length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 leading-none">
              {materialRequests.filter(r => r.status === 'PENDING').length}
            </span>
          )}
        </button>
      </div>

      {controlTab === 'enroll' && (
        <div className="space-y-6">
          {/* 실시간 수강신청 진행 현황 및 타이머 100% 자동 동기화 모니터링 바 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${
                isApplyEnabled() 
                  ? 'bg-emerald-500/10 text-emerald-600' 
                  : timerConfig.masterStatus === 'FORCE_LOCK' || timerConfig.masterStatus === 'PAUSED'
                    ? 'bg-rose-500/10 text-rose-600'
                    : 'bg-amber-500/10 text-amber-600'
              }`}>
                <Activity className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">수강신청 진행 현황 (타이머 & 락 실시간 자동 연동)</span>
                  <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200 font-semibold">
                    시계 타이머 자동 개시/마감
                  </Badge>
                  {docConfig?.academicCalendar && (
                    <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold">
                      중앙 학사 일정 연동됨
                    </Badge>
                  )}
                </div>
                <h4 className="font-bold text-slate-800 text-[15px] mt-0.5">{getDetailedStatusText()}</h4>
              </div>
            </div>
            <div>
              {isApplyEnabled() ? (
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
                  <Play className="w-3.5 h-3.5 fill-current text-emerald-600" /> 학부모 수강 신청 활성화됨
                </span>
              ) : (
                <span className="bg-rose-50 text-rose-800 border border-rose-200 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
                  <Lock className="w-3.5 h-3.5 text-rose-600" /> 학부모 수강 신청 비활성화 (마감)
                </span>
              )}
            </div>
          </div>


      {/* Title Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-1 rounded-md font-bold flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              타이머 & 락 제어
            </span>
            <h2 className="text-xl font-bold text-slate-800">수강신청 타이머 및 제어 센터</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            수강신청 시작/마감 달력 시계 타이머를 설정하고, 긴급 락 조작을 수행합니다.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsStressTestModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            1,000명 스트레스 테스트 도구
          </button>
        </div>
      </div>

      {/* Main Grid: Clean & Spaced */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Master Lock Control */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center justify-between">
            <span>신청 버튼 마스터 제어</span>
            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              {timerConfig.masterStatus}
            </span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs font-bold">
            <button
              onClick={() => handleSetMasterStatus('AUTO')}
              className={`p-3 rounded-xl border transition flex items-center justify-center gap-2 ${
                timerConfig.masterStatus === 'AUTO'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-4 h-4 text-emerald-600" />
              자동 예약 (AUTO)
            </button>

            <button
              onClick={() => handleSetMasterStatus('FORCE_LOCK')}
              className={`p-3 rounded-xl border transition flex items-center justify-center gap-2 ${
                timerConfig.masterStatus === 'FORCE_LOCK'
                  ? 'border-rose-600 bg-rose-50 text-rose-800 shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Lock className="w-4 h-4 text-rose-600" />
              긴급 잠금 (LOCK)
            </button>

            <button
              onClick={() => handleSetMasterStatus('FORCE_OPEN')}
              className={`p-3 rounded-xl border transition flex items-center justify-center gap-2 ${
                timerConfig.masterStatus === 'FORCE_OPEN'
                  ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Unlock className="w-4 h-4 text-blue-600" />
              강제 오픈 (OPEN)
            </button>

            <button
              onClick={() => handleSetMasterStatus('PAUSED')}
              className={`p-3 rounded-xl border transition flex items-center justify-center gap-2 ${
                timerConfig.masterStatus === 'PAUSED'
                  ? 'border-amber-600 bg-amber-50 text-amber-800 shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Pause className="w-4 h-4 text-amber-600" />
              일시 정지 (PAUSE)
            </button>
          </div>
        </div>

        {/* Card 2: Timer Datetime Picker with Confirm Button */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Timer className="w-4 h-4 text-indigo-600" />
              수강 신청 개시 / 마감 타이머 설정
            </h3>
            {isSaveNoticeVisible && (
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full animate-fade-in flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> 적용 완료됨
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                시작 일시 선택 (클릭 시 달력/시계 피커)
              </label>
              <input
                type="datetime-local"
                value={formatForDatetimeInput(draftStartTime)}
                onChange={(e) => handleDatetimeDraftChange('startTime', e.target.value)}
                className="w-full border border-slate-300 p-2 rounded-xl font-mono text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 hover:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                마감 일시 선택 (클릭 시 달력/시계 피커)
              </label>
              <input
                type="datetime-local"
                value={formatForDatetimeInput(draftEndTime)}
                onChange={(e) => handleDatetimeDraftChange('endTime', e.target.value)}
                className="w-full border border-slate-300 p-2 rounded-xl font-mono text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 hover:bg-slate-100"
              />
            </div>

            {/* Confirm & Apply Button */}
            <div className="pt-2">
              <button
                onClick={handleConfirmAndApplyTimer}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition shadow flex items-center justify-center gap-1.5 text-xs"
              >
                <Check className="w-4 h-4" />
                선택한 일시 및 시각 확인 및 적용
              </button>
            </div>

            <div className="pt-1 flex items-center gap-2">
              <span className="text-slate-500 font-medium">빠른 원클릭 설정:</span>
              <button
                onClick={() => handleSetQuickTimer(10)}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-lg text-xs"
              >
                10초 후 시작
              </button>
              <button
                onClick={() => handleSetQuickTimer(0)}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-lg text-xs"
              >
                즉시 오픈
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Course Lock Switch Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 text-sm">강좌별 개별 수강신청 잠금 토글</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {courses.map((course) => (
            <div
              key={course.id}
              className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200"
            >
              <div>
                <span className="font-bold text-slate-800">{course.title}</span>
                <div className="text-[11px] text-slate-400 font-mono">
                  ({course.currentStudents}/{course.maxStudents}명)
                </div>
              </div>
              {(() => {
                const isCurrentlyLocked = course.isForceLocked || !isApplyEnabled();
                let statusLabel = '열림';
                let btnClass = 'bg-emerald-600 hover:bg-emerald-700 text-white';

                if (course.isForceLocked) {
                  statusLabel = '수동 잠김';
                  btnClass = 'bg-rose-600 hover:bg-rose-700 text-white';
                } else if (!isApplyEnabled()) {
                  statusLabel = '타이머 잠김';
                  btnClass = 'bg-slate-400 hover:bg-slate-500 text-white';
                }

                return (
                  <button
                    onClick={() => handleToggleCourseLock(course.id)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] shadow-sm transition ${btnClass}`}
                  >
                    {statusLabel}
                  </button>
                );
              })()}
            </div>
          ))}
        </div>
      </div>

      {/* 학부모 수강료 온라인 납부 계좌 및 QR 코드 등록 카드 */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600 shrink-0" />
              학부모 수강료 온라인 납부 계좌 및 QR 코드 등록
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              수강신청 완료 후 학부모 결과 안내 팝업 및 카드에 표출될 수강료 납부 계좌와 QR 코드를 설정합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSavePaymentInfo}
            disabled={isSavingAccount}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 shrink-0 whitespace-nowrap self-start sm:self-auto"
          >
            <Check className="w-4 h-4" />
            {isSavingAccount ? '저장 중...' : '납부 정보 저장'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <div className="space-y-2">
            <label className="font-bold text-slate-700 block">납부 은행 및 계좌번호 (예금주)</label>
            <input
              type="text"
              value={draftAccount}
              onChange={(e) => setDraftAccount(e.target.value)}
              placeholder="예: 신한은행 110-123-456789 (예금주: 한국초등학교)"
              className="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-xl font-medium text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <p className="text-[11px] text-slate-400">
              학부모 페이지 팝업 및 방과후 수강 현황 카드에 안내 문구로 자동 표출됩니다.
            </p>
          </div>

          <div className="space-y-2">
            <label className="font-bold text-slate-700 block">납부 QR 코드 이미지</label>
            <div className="p-3 border-2 border-dashed border-slate-300 rounded-xl text-center relative group bg-slate-50/50 hover:bg-slate-50 transition">
              <input
                id="afterschool-qr-controlroom-up"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setDraftQrImage(reader.result as string);
                    };
                    reader.readAsDataURL(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <label htmlFor="afterschool-qr-controlroom-up" className="cursor-pointer block">
                {draftQrImage ? (
                  <div className="relative h-24 w-full flex items-center justify-center">
                    <img src={draftQrImage} alt="QR 코드 미리보기" className="h-full object-contain mx-auto" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-white rounded-lg">
                      이미지 변경
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 py-2">
                    <ImageIcon className="text-slate-400" size={24} />
                    <span className="text-xs font-bold text-slate-600">납부 QR 이미지 업로드 (클릭)</span>
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Stress Test Modal */}
      {isStressTestModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden space-y-4 p-6">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                1,000명 동시접속 트래픽 스트레스 테스트
              </h3>
              <button
                onClick={() => setIsStressTestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              수강신청 시작 시 <b>1,000명의 수강생이 동시에 신청</b>할 때, 과부하 없이 선착순 수강 등록 및 대기 배정을 수월하게 처리하는지 시뮬레이션합니다.
            </p>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div className="flex gap-4 items-center">
                <span className="font-semibold text-slate-700">테스트 방식:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="simMode"
                    checked={testMode === 'single'}
                    onChange={() => setTestMode('single')}
                  />
                  단일 강좌 몰아주기
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="simMode"
                    checked={testMode === 'multi'}
                    onChange={() => setTestMode('multi')}
                  />
                  다중 강좌 무작위 분산
                </label>
              </div>

              {testMode === 'single' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">테스트할 강좌 선택</label>
                  <select
                    value={selectedSimCourseId}
                    onChange={(e) => setSelectedSimCourseId(e.target.value)}
                    className="w-full bg-white border border-slate-300 p-2 rounded-lg font-bold text-slate-800 focus:outline-none"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} (현재 {c.currentStudents}/{c.maxStudents}명)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-between items-center py-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-700">
                  <input
                    type="checkbox"
                    checked={useRealDb}
                    onChange={(e) => setUseRealDb(e.target.checked)}
                  />
                  🔥 실제 Firestore DB 부하 테스트 (실제 패킷 전송)
                </label>
                
                <button
                  onClick={handleCleanTestData}
                  disabled={isCleaning || isSimulating}
                  className="bg-rose-50 border border-rose-200 text-rose-700 font-bold px-2.5 py-1 rounded-lg text-[11px] hover:bg-rose-100 disabled:opacity-50 transition"
                >
                  {isCleaning ? '가상 데이터 삭제 중...' : '가상 데이터 원복 초기화'}
                </button>
              </div>

              <button
                onClick={handleRun1000BotsTrafficSimulation}
                disabled={isSimulating || isCleaning}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition shadow flex items-center justify-center gap-2 text-xs"
              >
                <Activity className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
                {isSimulating ? '1,000명 대기열 수강 처리 중...' : '1,000명 동시 신청 테스트 실행'}
              </button>
            </div>

            {/* Simulation Progress Bar */}
            {isSimulating && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-600">대기열 처리 완료율</span>
                  <span className="text-indigo-600 font-bold">{simProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-200"
                    style={{ width: `${simProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Simulation Results Box */}
            {simResults && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-2 text-xs text-emerald-900">
                <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  1,000명 동시 신청 대기열 시뮬레이션 완료
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div className="bg-white/80 p-2 rounded border border-emerald-200">
                    동시 접속: <b>{simResults.totalBots}명</b>
                  </div>
                  <div className="bg-white/80 p-2 rounded border border-emerald-200">
                    소요 시간: <b>{simResults.elapsedMs}ms</b>
                  </div>
                  <div className="bg-emerald-100 p-2 rounded text-emerald-900 font-bold">
                    수강 성공: <b>{simResults.successEnrolled}명</b>
                  </div>
                  <div className="bg-amber-100 p-2 rounded text-amber-900 font-bold">
                    대기 배정: <b>{simResults.assignedWaiting}명</b>
                  </div>
                </div>
              </div>
            )}

            {/* Realtime Logs Console */}
            <div className="bg-slate-900 p-3 rounded-xl font-mono text-[11px] text-slate-300 h-28 overflow-y-auto space-y-1">
              {simLogs.map((log, idx) => (
                <div key={idx} className="text-slate-300">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )}

  {controlTab === 'teacher' && (
        <div className="space-y-6 text-left animate-in fade-in duration-200">
          <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-5 space-y-3">
            <div className="text-sm font-bold text-indigo-900 flex items-center gap-1.5">
              <Settings className="w-5 h-5 text-indigo-600" />
              강사용 강좌 개설(신청) 권한 및 상세 일정 제어
            </div>
            <p className="text-xs text-indigo-700/80 leading-relaxed">
              방과후학교 외부 강사들이 본인 로그인 후 강좌 개설을 신청할 수 있는 기간과, 
              수강료/강사료 정산 기초 자료로 쓰일 디폴트 학년도, 학기, 운영 기간 등의 표준 요건을 정의합니다.
              이 설정값은 <b>전자결재 일괄 기안 작성 시 자동으로 연계</b>됩니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* 1. 신청 기간 설정 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-800 text-[13px] border-b pb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-500" />
                강사 강좌 개설 신청 접수 일정
              </h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-2 flex items-center gap-1">
                    <Settings className="w-3.5 h-3.5 text-indigo-500" />
                    신청 마스터 제어
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setDraftTeacherApply(prev => ({ ...prev, masterStatus: 'AUTO' }))}
                      className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
                        (draftTeacherApply.masterStatus || 'AUTO') === 'AUTO'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      자동 예약 (AUTO)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftTeacherApply(prev => ({ ...prev, masterStatus: 'FORCE_LOCK' }))}
                      className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
                        draftTeacherApply.masterStatus === 'FORCE_LOCK'
                          ? 'border-rose-600 bg-rose-50 text-rose-800 shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5 text-rose-600" />
                      긴급 잠금 (LOCK)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftTeacherApply(prev => ({ ...prev, masterStatus: 'FORCE_OPEN' }))}
                      className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
                        draftTeacherApply.masterStatus === 'FORCE_OPEN'
                          ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Unlock className="w-3.5 h-3.5 text-blue-600" />
                      강제 오픈 (OPEN)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftTeacherApply(prev => ({ ...prev, masterStatus: 'PAUSED' }))}
                      className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition ${
                        draftTeacherApply.masterStatus === 'PAUSED'
                          ? 'border-amber-600 bg-amber-50 text-amber-800 shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Pause className="w-3.5 h-3.5 text-amber-600" />
                      일시 정지 (PAUSE)
                    </button>
                  </div>
                  
                  {/* 현재 작동 모드 배지 */}
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex justify-between items-center text-[10px] mb-4">
                    <span className="text-slate-500 font-medium">현재 작동 모드:</span>
                    <span className={`font-black uppercase px-2 py-0.5 rounded text-[9px] ${
                      (draftTeacherApply.masterStatus || 'AUTO') === 'AUTO' ? 'bg-emerald-100 text-emerald-800' :
                      draftTeacherApply.masterStatus === 'FORCE_LOCK' ? 'bg-rose-100 text-rose-800' :
                      draftTeacherApply.masterStatus === 'FORCE_OPEN' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {(draftTeacherApply.masterStatus || 'AUTO')}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">신청 개시 일시</label>
                    <input
                      type="datetime-local"
                      value={formatForDatetimeInput(draftTeacherApply.applyStartDate)}
                      onChange={(e) => handleApplyDateChange('applyStartDate', e.target.value)}
                      className="w-full border border-slate-300 p-2.5 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">신청 마감 일시</label>
                    <input
                      type="datetime-local"
                      value={formatForDatetimeInput(draftTeacherApply.applyEndDate)}
                      onChange={(e) => handleApplyDateChange('applyEndDate', e.target.value)}
                      className="w-full border border-slate-300 p-2.5 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100">
                  <label className="block text-slate-600 font-semibold mb-1.5">강사 강좌 개설 허용 요일</label>
                  <div className="flex flex-wrap gap-2">
                    {['월', '화', '수', '목', '금', '토', '일'].map((day) => {
                      const currentDays = draftTeacherApply.allowedDays || ['월', '화', '수', '목', '금'];
                      const isChecked = currentDays.includes(day);
                      return (
                        <label key={day} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              let nextDays = [...currentDays];
                              if (isChecked) {
                                nextDays = nextDays.filter(d => d !== day);
                              } else {
                                nextDays.push(day);
                                const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
                                nextDays.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
                              }
                              setDraftTeacherApply(prev => ({ ...prev, allowedDays: nextDays }));
                            }}
                            className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer"
                          />
                          {day}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1 flex items-center justify-between">
                        <span>실제 수업 운영 주수</span>
                        <span className="text-[10px] text-indigo-600 font-normal">학사일정 자동계산</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          max="52"
                          value={draftTeacherApply.operatingWeeks || 10}
                          onChange={(e) => setDraftTeacherApply(prev => ({ ...prev, operatingWeeks: parseInt(e.target.value, 10) || 10 }))}
                          className="w-20 border border-slate-300 p-2 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-mono text-center font-bold text-indigo-700 bg-indigo-50/40"
                        />
                        <span className="text-xs text-slate-600 font-semibold">주 운영</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1 flex items-center justify-between">
                        <span>1회당 기본 차시 수</span>
                        <span className="text-[10px] text-slate-400 font-normal">시스템 기본값</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={draftTeacherApply.sessionsPerClass || 2}
                          onChange={(e) => setDraftTeacherApply(prev => ({ ...prev, sessionsPerClass: parseInt(e.target.value, 10) || 2 }))}
                          className="w-20 border border-slate-300 p-2 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-mono text-center font-bold text-indigo-700 bg-indigo-50/40"
                        />
                        <span className="text-xs text-slate-600 font-semibold">차시 / 회</span>
                      </div>
                    </div>
                  </div>

                  {/* 실시간 휴업일 제외 수업일수 및 요일별 현황 뱃지 */}
                  <div className="p-2.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-1 text-[11px] text-indigo-900">
                    <div className="font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        운영 기간 내 실제 수업일수 (휴업일 자동 제외)
                      </span>
                      <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        총 {realtimeOperatingStats.totalDays}일 수업 ({realtimeOperatingStats.operatingWeeks}주)
                      </span>
                    </div>
                    <div className="text-[10.5px] text-indigo-700 flex flex-wrap gap-x-2.5 gap-y-0.5 pt-0.5">
                      {draftTeacherApply.allowedDays?.map((d) => (
                        <span key={d} className="font-medium">
                          {d}요일: <b className="text-indigo-950 font-bold">{realtimeOperatingStats.daysByWeekday[d] || 0}회</b>
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-indigo-600/80 pt-0.5 border-t border-indigo-200/50">
                      💡 <b>차시 안내:</b> 주중 강좌는 보통 <b>2차시</b>, 토요일/방학 집중 특강은 <b>4차시</b>로 강좌 개설 시 교시 선택을 통해 강좌별로 자유롭게 자동 적용됩니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 수업 표준 요건 및 재원 구분 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b pb-2">
                <h4 className="font-bold text-slate-800 text-[13px] flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  수업 표준 학기 및 정산 요건
                </h4>
                <button
                  type="button"
                  onClick={handleSyncWithAcademicCalendar}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center gap-1 transition shadow-2xs cursor-pointer"
                  title="중앙 학사일정에서 현재 학기 시작일/종료일 및 휴업일을 실시간으로 가져옵니다"
                >
                  <RotateCw className="w-3 h-3 text-indigo-600" />
                  학사일정 자동 동기화
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">개설 학년도</label>
                  <input
                    type="text"
                    value={draftTeacherApply.year}
                    onChange={(e) => setDraftTeacherApply(prev => ({ ...prev, year: e.target.value }))}
                    placeholder="예: 2026"
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">표준 학기</label>
                  <select
                    value={draftTeacherApply.semester}
                    onChange={(e) => handleSemesterChange(e.target.value)}
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer bg-white font-bold text-slate-800"
                  >
                    <option value="1학기">1학기</option>
                    <option value="여름방학">여름방학</option>
                    <option value="2학기">2학기</option>
                    <option value="겨울방학">겨울방학</option>
                    <option value="특별강좌">특별강좌</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">운영 시작일</label>
                  <input
                    type="date"
                    value={draftTeacherApply.operatingStartDate}
                    onChange={(e) => handleOperatingDateChange('operatingStartDate', e.target.value)}
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">운영 종료일</label>
                  <input
                    type="date"
                    value={draftTeacherApply.operatingEndDate}
                    onChange={(e) => handleOperatingDateChange('operatingEndDate', e.target.value)}
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1.5 flex items-center justify-between text-xs">
                  <span>수업 가능 차시 선택 (1~9차시)</span>
                  <span className="text-[11px] text-indigo-600 font-normal">
                    선택된 차시: {(draftTeacherApply.allowedPeriods || [1, 2, 3, 4, 5, 6, 7, 8, 9]).length}개 차시
                  </span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((periodNum) => {
                    const currentPeriods = draftTeacherApply.allowedPeriods || [1, 2, 3, 4, 5, 6, 7, 8, 9];
                    const isChecked = currentPeriods.includes(periodNum);
                    const timeInfo = ELEMENTARY_PERIOD_TIMES[periodNum]?.display || '';

                    return (
                      <label
                        key={periodNum}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs cursor-pointer select-none transition ${
                          isChecked
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let updated: number[];
                            if (e.target.checked) {
                              updated = [...currentPeriods, periodNum].sort((a, b) => a - b);
                            } else {
                              updated = currentPeriods.filter((p) => p !== periodNum);
                            }
                            setDraftTeacherApply((prev) => ({
                              ...prev,
                              allowedPeriods: updated,
                            }));
                          }}
                          className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="flex flex-col leading-tight">
                          <span>{periodNum}차시</span>
                          <span className="text-[9px] font-mono text-slate-500">{timeInfo}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-2">
                  <label className="block text-slate-600 font-semibold mb-1">표준 강사료 (금액)</label>
                  <input
                    type="number"
                    value={draftTeacherApply.teacherFee}
                    onChange={(e) => setDraftTeacherApply(prev => ({ ...prev, teacherFee: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">화폐 단위</label>
                  <select
                    value={draftTeacherApply.teacherFeeCurrency || 'KRW'}
                    onChange={(e) => setDraftTeacherApply(prev => ({ ...prev, teacherFeeCurrency: e.target.value as any }))}
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
                  >
                    <option value="KRW">KRW (원)</option>
                    <option value="VND">VND (동)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">산정 구분</label>
                  <select
                    value={draftTeacherApply.teacherFeeType}
                    onChange={(e) => setDraftTeacherApply(prev => ({ ...prev, teacherFeeType: e.target.value as any }))}
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
                  >
                    <option value="시간당">시간당</option>
                    <option value="차시당">차시당</option>
                    <option value="정액제">정액제</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-2.5 border-t border-slate-100">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">표준 수강료 (차시당 단가)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      disabled={draftTeacherApply.tuitionType === '학교예산'}
                      value={draftTeacherApply.tuitionType === '학교예산' ? 0 : (draftTeacherApply.tuitionPerSession || 0)}
                      onChange={(e) => setDraftTeacherApply(prev => ({ ...prev, tuitionPerSession: parseInt(e.target.value, 10) || 0 }))}
                      className="w-full border border-slate-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 font-mono"
                    />
                    <select
                      disabled={draftTeacherApply.tuitionType === '학교예산'}
                      value={draftTeacherApply.tuitionCurrency || 'KRW'}
                      onChange={(e) => setDraftTeacherApply(prev => ({ ...prev, tuitionCurrency: e.target.value as any }))}
                      className="border border-slate-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer shrink-0 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="KRW">KRW (원)</option>
                      <option value="VND">VND (동)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                    <span className="font-bold text-slate-600 shrink-0">/ 차시당</span>
                  </div>
                  {draftTeacherApply.tuitionType === '학교예산' && (
                    <p className="text-[10px] text-emerald-600 mt-1 font-semibold">※ 학교 예산 지원(무료 수강)으로 설정되어 수강료가 0원으로 적용됩니다.</p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">수강료 재원 구분 (학부모 부담 여부)</label>
                  <div className="flex gap-4 mt-1 font-bold">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="tuitionType"
                        checked={draftTeacherApply.tuitionType === '수익자부담'}
                        onChange={() => setDraftTeacherApply(prev => ({ ...prev, tuitionType: '수익자부담' }))}
                        className="w-3.5 h-3.5 text-indigo-600"
                      />
                      수익자 부담
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="tuitionType"
                        checked={draftTeacherApply.tuitionType === '학교예산'}
                        onChange={() => setDraftTeacherApply(prev => ({ ...prev, tuitionType: '학교예산' }))}
                        className="w-3.5 h-3.5 text-indigo-600"
                      />
                      학교 예산 지원 (무료)
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">강사료 지급 재원 구분</label>
                  <div className="flex flex-wrap gap-4 mt-1 font-bold">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="fundingSource"
                        checked={draftTeacherApply.fundingSource === '수익자부담'}
                        onChange={() => setDraftTeacherApply(prev => ({ ...prev, fundingSource: '수익자부담' }))}
                        className="w-3.5 h-3.5 text-indigo-600"
                      />
                      수익자 부담
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="fundingSource"
                        checked={draftTeacherApply.fundingSource === '학교예산'}
                        onChange={() => setDraftTeacherApply(prev => ({ ...prev, fundingSource: '학교예산' }))}
                        className="w-3.5 h-3.5 text-indigo-600"
                      />
                      학교 예산 지원
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="fundingSource"
                        checked={draftTeacherApply.fundingSource === '혼용'}
                        onChange={() => setDraftTeacherApply(prev => ({ ...prev, fundingSource: '혼용' }))}
                        className="w-3.5 h-3.5 text-indigo-600"
                      />
                      혼용 (수익자 + 학교 예산)
                    </label>
                  </div>
                </div>

                {/* 실시간 총 산정 차시 및 수강료/강사료 정산 요약 안내 박스 */}
                {(() => {
                  const weeks = draftTeacherApply.operatingWeeks || 10;
                  const perSession = draftTeacherApply.sessionsPerClass || 2;
                  const totalSessions = weeks * perSession;
                  const totalTuition = (draftTeacherApply.tuitionPerSession || 0) * totalSessions;
                  const totalTeacherFee = (draftTeacherApply.teacherFee || 0) * totalSessions;

                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs text-slate-700 font-sans mt-3">
                      <div className="flex items-center justify-between font-bold text-slate-800 border-b border-slate-200/80 pb-1.5">
                        <span className="flex items-center gap-1 text-indigo-600">
                          <Settings className="w-3.5 h-3.5" />
                          설정값 기준 1강좌당 정산 요약 (주 1회 기준)
                        </span>
                        <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-[11px]">
                          총 <b>{totalSessions}</b> 차시 / 강좌
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 space-y-0.5">
                          <div className="text-slate-400 text-[10px]">학생 1인당 총 수강료</div>
                          <div className="font-mono font-bold text-slate-900 text-xs">
                            {draftTeacherApply.tuitionType === '학교예산' ? (
                              <span className="text-emerald-600">0 VND (무료)</span>
                            ) : (
                              `${totalTuition.toLocaleString()} ${draftTeacherApply.tuitionCurrency || 'KRW'}`
                            )}
                          </div>
                          <div className="text-[9px] text-slate-400">({(draftTeacherApply.tuitionPerSession || 0).toLocaleString()} × {totalSessions}차시)</div>
                        </div>

                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 space-y-0.5">
                          <div className="text-slate-400 text-[10px]">강사 1인당 총 강사료 (기초)</div>
                          <div className="font-mono font-bold text-slate-900 text-xs">
                            {totalTeacherFee.toLocaleString()} {draftTeacherApply.teacherFeeCurrency || 'KRW'}
                          </div>
                          <div className="text-[9px] text-slate-400">({(draftTeacherApply.teacherFee || 0).toLocaleString()} × {totalSessions}차시)</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* 수업 시간대 템플릿 관리 */}
          <div className="pt-3 border-t border-slate-100 space-y-3 font-xs">
            <div>
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                수업 시간대 템플릿 제어
              </h4>
              <p className="text-[10px] text-slate-500 mt-0.5">강사가 강좌 개설 신청 시 선택할 수 있는 표준 수업 교시 시간대를 구성합니다.</p>
            </div>

            {/* 시간대 목록 */}
            <div className="space-y-2">
              {(draftTeacherApply.timeSlots || []).map((slot: any) => (
                <div key={slot.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{slot.label}</span>
                    <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      slot.type === 'SEMESTER' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {slot.type === 'SEMESTER' ? '학기중' : '방학/토요일'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveClockSlot(slot.id)}
                    className="text-rose-500 hover:text-rose-700 font-bold px-1"
                  >
                    &times;
                  </button>
                </div>
              ))}
              {(draftTeacherApply.timeSlots || []).length === 0 && (
                <p className="text-center text-slate-400 py-4 text-xs">등록된 시간대 템플릿이 없습니다. 아래에서 추가해 주세요.</p>
              )}
            </div>

            {/* 추가 폼 */}
            <div className="bg-slate-50 p-3 rounded-xl border border-dashed border-slate-300 space-y-2.5">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5 font-bold">시간대 명칭</label>
                  <input
                    type="text"
                    placeholder="예: 학기 중 오후"
                    value={newSlotLabel}
                    onChange={(e) => setNewSlotLabel(e.target.value)}
                    className="w-full border p-2 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5 font-bold">운영 유형</label>
                  <select
                    value={newSlotType}
                    onChange={(e) => setNewSlotType(e.target.value as any)}
                    className="w-full border p-2 rounded-lg bg-white cursor-pointer"
                  >
                    <option value="SEMESTER">학기 중</option>
                    <option value="VACATION_OR_SAT">방학 및 토요일</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs items-end">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5 font-bold">시작 시각</label>
                  <input
                    type="time"
                    value={newSlotStart}
                    onChange={(e) => setNewSlotStart(e.target.value)}
                    className="w-full border p-2 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5 font-bold">종료 시각</label>
                  <input
                    type="time"
                    value={newSlotEnd}
                    onChange={(e) => setNewSlotEnd(e.target.value)}
                    className="w-full border p-2 rounded-lg bg-white font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddClockSlot}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition"
                >
                  시간대 추가
                </button>
              </div>
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="pt-2">
            <button
              onClick={handleSaveTeacherApplySettings}
              disabled={isSavingTeacherApply}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-2xl transition shadow flex items-center justify-center gap-2 text-xs"
            >
              <Save className="w-4 h-4 text-emerald-400" />
              {isSavingTeacherApply ? '설정 데이터 업로드 중...' : '강사 신청 권한 및 표준 학기 요건 저장 및 적용'}
            </button>
          </div>
        </div>
      )}

      {/* ─── 학습준비물 신청 제어 탭 ────────────────────────────────────────── */}
      {controlTab === 'material' && (
        <div className="space-y-5 animate-in fade-in duration-200">

          {/* 예산 설정 카드 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700"><DollarSign className="w-5 h-5" /></div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">예산 및 신청 한도 설정</h3>
                <p className="text-[11px] text-slate-500">전체 가용 예산과 강좌별 최대 신청 가능 금액을 설정합니다.</p>
              </div>
            </div>

            {/* 예산 현황 바 */}
            <div className="bg-slate-50 rounded-xl p-3 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600">승인 사용액</span>
                <span className="text-emerald-700">{formatMoney(approvedTotal, materialCurrency)}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, totalBudget > 0 ? (approvedTotal / totalBudget) * 100 : 0)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>대기 중: <b className="text-amber-600">{formatMoney(pendingTotal, materialCurrency)}</b></span>
                <span>총 예산: <b>{formatMoney(totalBudget, materialCurrency)}</b></span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">가용 총 예산</label>
                <input
                  type="number"
                  value={draftTotalBudget}
                  onChange={(e) => setDraftTotalBudget(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">강좌별 최대 신청액</label>
                <input
                  type="number"
                  value={draftMaxPerCourse}
                  onChange={(e) => setDraftMaxPerCourse(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">화폐 단위</label>
                <select
                  value={draftMaterialCurrency}
                  onChange={(e) => setDraftMaterialCurrency(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none cursor-pointer"
                >
                  <option value="KRW">KRW (원)</option>
                  <option value="VND">VND (동)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleSaveBudgetSettings}
              disabled={isSavingBudget}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              <Save className="w-4 h-4" />
              {isSavingBudget ? '저장 중...' : '예산 설정 저장'}
            </button>
          </div>

          {/* 신청 목록 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-600" />
                <h3 className="font-bold text-slate-900 text-sm">학습준비물 신청 목록</h3>
                <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded-full">{materialRequests.length}건</span>
              </div>
              <div className="flex gap-2 text-[11px] font-bold">
                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">대기 {materialRequests.filter(r => r.status === 'PENDING').length}</span>
                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">승인 {materialRequests.filter(r => r.status === 'APPROVED').length}</span>
                <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">반려 {materialRequests.filter(r => r.status === 'REJECTED').length}</span>
              </div>
            </div>

            {materialRequests.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
                <Package className="w-8 h-8" />
                <p className="text-sm font-bold">신청된 학습준비물이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {materialRequests.map((req) => {
                  const isExpanded = expandedRequestId === req.id;
                  const isOverLimit = req.totalAmount > maxPerCourse;
                  const statusColors = {
                    PENDING: 'bg-amber-100 text-amber-700',
                    APPROVED: 'bg-emerald-100 text-emerald-700',
                    REJECTED: 'bg-rose-100 text-rose-700',
                  };
                  const statusLabels = { PENDING: '검토 대기', APPROVED: '승인됨', REJECTED: '반려됨' };

                  return (
                    <div key={req.id} className={`${req.status === 'PENDING' ? 'bg-amber-50/30' : ''}` }>
                      <div
                        className="px-5 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition"
                        onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 text-sm truncate">{req.courseTitle}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[req.status]}`}>
                              {statusLabels[req.status]}
                            </span>
                            {isOverLimit && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">한도 초과</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            강사: {req.instructorName} · 신청일: {req.submittedAt.slice(0, 10)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-black text-sm ${isOverLimit ? 'text-rose-600' : 'text-slate-800'}`}>
                            {formatMoney(req.totalAmount, materialCurrency)}
                          </p>
                          <p className="text-[10px] text-slate-400">{req.items.length}개 품목</p>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                      </div>

                      {isExpanded && (
                        <div className="px-5 pb-4 space-y-3 border-t border-slate-100">
                          {/* 품목 상세 테이블 */}
                          <div className="mt-3 rounded-xl overflow-hidden border border-slate-200">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-100">
                                <tr>
                                  <th className="px-3 py-2 text-left font-bold text-slate-600">품목명</th>
                                  <th className="px-3 py-2 text-right font-bold text-slate-600">수량</th>
                                  <th className="px-3 py-2 text-right font-bold text-slate-600">단가</th>
                                  <th className="px-3 py-2 text-right font-bold text-slate-600">금액</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {req.items.map((item, idx) => (
                                  <tr key={idx} className="bg-white">
                                    <td className="px-3 py-2 text-slate-700">{item.name}</td>
                                    <td className="px-3 py-2 text-right text-slate-600">{item.quantity}</td>
                                    <td className="px-3 py-2 text-right text-slate-600">{formatMoney(item.unitPrice, materialCurrency)}</td>
                                    <td className="px-3 py-2 text-right font-bold text-slate-800">{formatMoney(item.amount, materialCurrency)}</td>
                                  </tr>
                                ))}
                                <tr className="bg-slate-50">
                                  <td colSpan={3} className="px-3 py-2 text-right font-bold text-slate-700">합계</td>
                                  <td className="px-3 py-2 text-right font-black text-slate-900">{formatMoney(req.totalAmount, materialCurrency)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {isOverLimit && (
                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-[11px] text-rose-700 font-bold">
                              ⚠️ 강좌별 최대 신청액({formatMoney(maxPerCourse, materialCurrency)})을 {formatMoney(req.totalAmount - maxPerCourse, materialCurrency)} 초과하였습니다.
                            </div>
                          )}

                          {req.status === 'REJECTED' && req.rejectReason && (
                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-[11px] text-rose-700">
                              <b>반려 사유:</b> {req.rejectReason}
                            </div>
                          )}

                          {/* 반려 사유 입력 박스 */}
                          {rejectingId === req.id && (
                            <div className="space-y-2">
                              <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="반려 사유를 입력하세요..."
                                className="w-full border border-rose-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-rose-400 outline-none resize-none"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleReject(req.id)}
                                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl text-xs transition"
                                >
                                  반려 확정
                                </button>
                                <button
                                  onClick={() => { setRejectingId(null); setRejectReason(''); }}
                                  className="px-4 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 액션 버튼 */}
                          {req.status === 'PENDING' && rejectingId !== req.id && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApprove(req.id)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" /> 승인
                              </button>
                              <button
                                onClick={() => { setRejectingId(req.id); setRejectReason(''); }}
                                className="flex-1 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" /> 반려
                              </button>
                              <button
                                onClick={() => handleDeleteRequest(req.id)}
                                className="px-3 border border-slate-200 rounded-xl text-xs text-slate-500 hover:bg-slate-100 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          {req.status !== 'PENDING' && (
                            <button
                              onClick={() => handleDeleteRequest(req.id)}
                              className="text-xs text-slate-400 hover:text-rose-500 transition flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> 삭제
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── 강사 제출 지출증빙서류 (영수증·검수조서) 관리 ─────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">강사 제출 지출증빙서류 (영수증·검수조서)</h3>
                <span className="bg-indigo-50 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-full">{expenseProofs.length}건</span>
              </div>
            </div>

            {expenseProofs.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2 text-slate-400">
                <FileText className="w-8 h-8 text-slate-300" />
                <p className="text-xs font-bold">제출된 지출증빙서류가 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {expenseProofs.map((proof) => (
                  <div key={proof.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm truncate">{proof.businessName || proof.courseTitle}</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">제출완료</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        강사: {proof.instructorName} · 카드: {proof.cardType === 'PERSONAL' ? '개인' : '학교'} ({proof.cardOwnerName}) · 검수일: {proof.inspectionDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black text-xs text-slate-800 mr-2">{formatMoney(proof.spentAmount, materialCurrency)}</span>
                      <button
                        onClick={() => setPreviewProofAdmin(proof)}
                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition shadow-2xs cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-400" />
                        양식 인쇄/열람
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm('해당 지출증빙서류를 삭제하시겠습니까?')) {
                            await deleteExpenseProof(proof.id);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600 transition p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 관리자 지출증빙 A4 인쇄 미리보기 모달 */}
          {previewProofAdmin && (
            <PrintExpenseProofModal
              proof={previewProofAdmin}
              onClose={() => setPreviewProofAdmin(null)}
              currency={materialCurrency}
            />
          )}
        </div>
      )}
    </div>
  );
};
