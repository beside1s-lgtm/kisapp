import React, { useState, useEffect, useRef } from 'react';
import type { Course, Classroom, Role, SessionPeriod, MaterialItem, MaterialRequest, ExpenseProof, ExpenseProofItem, SubmissionReminder, SyllabusSession } from '@/lib/afterschool/types';
import type { UserProfile, DocConfig } from '@/lib/types';
import { Plus, Lock, Unlock, Calendar, BookOpen, Save, X, Building2, AlertTriangle, UserPlus, Search, AlertCircle, Clock, CheckCircle2, Package, Trash2, FileText, Printer, Image as ImageIcon, Upload, FileCheck, Bell, Square, Download, FileSpreadsheet, Copy, Users, UserCheck } from 'lucide-react';
import { defaultSyllabus10, cjwaveTeachers } from '@/lib/afterschool/mock/data';
import { defaultTeacherApplySettings, onTeacherApplySettingsUpdate, onAfterschoolTimerUpdate, onDocConfigUpdate, updateAfterschoolCourse, submitMaterialRequest, getMaterialBudgetSettings, onMaterialRequestsUpdate, submitExpenseProof, onExpenseProofsUpdate, onTeacherRemindersUpdate, markReminderAsRead } from '@/lib/services/settingsService';
import { exportSyllabusTemplateExcel, parseSyllabusExcelFile } from '@/lib/afterschool/excel';
import { calculateCourseSessionDates, inferSessionsPerLesson } from '@/lib/afterschool/scheduleUtils';
import { useTranslation } from '@/hooks/use-translation';
import { PrintExpenseProofModal } from './PrintExpenseProofModal';
import { safeParseDate } from '../student/StudentView';

interface CourseManagementProps {
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  onSelectCourseForStudent: (courseId: string) => void;
  classrooms?: Classroom[];
  role?: Role;
  tuitionPerSession?: number;
  currentUserName?: string;
  periods?: SessionPeriod[];
  schoolTeachers?: UserProfile[];
}

export const CourseManagement: React.FC<CourseManagementProps> = ({
  courses,
  setCourses,
  onSelectCourseForStudent,
  classrooms = [],
  role = 'teacher',
  tuitionPerSession = 6800,
  currentUserName,
  periods = [],
  schoolTeachers = [],
}) => {
  const { t } = useTranslation();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSyllabusCourse, setEditingSyllabusCourse] = useState<Course | null>(null);

  // 강사 신청 기간 통제 상태
  const [teacherApplySettings, setTeacherApplySettings] = useState(defaultTeacherApplySettings);
  const [nowTime, setNowTime] = useState<Date>(new Date());

  useEffect(() => {
    const unsub = onTeacherApplySettingsUpdate((cfg) => {
      setTeacherApplySettings(cfg);
    });
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 1000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const isTeacherApplyEnabled = (() => {
    const stage = (teacherApplySettings as any).afterschoolStageStatus;
    // 마스터 운영 단계가 명시적으로 설정된 경우 우선 적용
    if (stage === 'CLOSED' || stage === 'OPERATING' || stage === 'CONFIRMED' || stage === 'APPLYING') {
      return false; // 운영 종료, 운영 중, 수강 완료, 수강신청 중에는 강사 개설신청 차단
    }
    if (stage === 'RECRUITING') {
      return true; // 강사 모집 단계일 때 허용
    }

    const status = (teacherApplySettings as any).masterStatus || 'AUTO';
    if (status === 'FORCE_LOCK' || status === 'PAUSED') return false;
    if (status === 'FORCE_OPEN') return true;

    const applyStart = safeParseDate(teacherApplySettings.applyStartDate).getTime();
    const applyEnd = safeParseDate(teacherApplySettings.applyEndDate).getTime();
    const nowMs = nowTime.getTime();
    return !isNaN(applyStart) && !isNaN(applyEnd) && nowMs >= applyStart && nowMs <= applyEnd;
  })();

  // 타이머 및 강사신청 세팅 구독
  const [timerConfig, setTimerConfig] = useState<any>({ startTime: '', endTime: '', masterStatus: 'AUTO' });
  const [docConfig, setDocConfig] = useState<Partial<DocConfig>>({});
  
  useEffect(() => {
    const unsubTimer = onAfterschoolTimerUpdate((cfg) => setTimerConfig(cfg));
    const unsubDoc = onDocConfigUpdate((cfg) => setDocConfig(cfg));
    return () => {
      unsubTimer();
      unsubDoc();
    };
  }, []);

  // 강좌 목록 가나다-ABC 순 정렬 (한글 localeCompare)
  const sortedCourses = React.useMemo(() => {
    return [...courses].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ko'));
  }, [courses]);

  const getDetailedStatusText = () => {
    if (!teacherApplySettings) return '수강신청 대기 중';

    const y = teacherApplySettings.year || '2026';
    const sem = teacherApplySettings.semester || '1학기';
    const programName = sem.includes('학기') ? `${y}학년도 제${sem} 방과후학교` : `${y}학년도 ${sem} 방과후학교`;

    const stage = (teacherApplySettings as any).afterschoolStageStatus;
    if (stage === 'CLOSED') return `${programName} 운영 종료`;
    if (stage === 'OPERATING') return `${programName} 운영 중`;
    if (stage === 'CONFIRMED') return `${programName} 수강신청 완료`;
    if (stage === 'APPLYING') return `${programName} 수강신청 진행 중`;
    if (stage === 'RECRUITING') return `${programName} 강사 모집 중`;

    const nowMs = nowTime.getTime();

    // 1. 강사 강좌 개설 신청 접수 일정 체크
    const applyStart = safeParseDate(teacherApplySettings.applyStartDate).getTime();
    const applyEnd = safeParseDate(teacherApplySettings.applyEndDate).getTime();
    if (!isNaN(applyStart) && !isNaN(applyEnd) && nowMs >= applyStart && nowMs <= applyEnd) {
      return `${programName} 강사 모집 중`;
    }

    // 2. 수강 신청 중 체크
    const startTime = safeParseDate(timerConfig.startTime).getTime();
    const endTime = safeParseDate(timerConfig.endTime).getTime();
    const isBeforeStart = nowMs < startTime;
    const isAfterEnd = nowMs > endTime;

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

  // 시간대 템플릿 선택용 상태
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState('');

  useEffect(() => {
    if (teacherApplySettings?.timeSlots?.length > 0) {
      const first = teacherApplySettings.timeSlots[0];
      setSelectedTimeSlotId(first.id);
      setNewTimeStart(first.startTime);
      setNewTimeEnd(first.endTime);
    }
  }, [teacherApplySettings]);

  const handleTimeSlotChange = (slotId: string) => {
    setSelectedTimeSlotId(slotId);
    const matched = teacherApplySettings?.timeSlots?.find((s: any) => s.id === slotId);
    if (matched) {
      setNewTimeStart(matched.startTime);
      setNewTimeEnd(matched.endTime);
    }
    if (selectedDays.length > 0) {
      const existingTopics = newSyllabusSessions.map((s) => s.topic);
      const autoSessions = getAutoCalculatedSessions(selectedDays, slotId, existingTopics);
      setNewSyllabusSessions(autoSessions);
    }
  };

  const getCalculatedTeacherFee = () => {
    const fee = teacherApplySettings?.teacherFee || 40000;
    const type = teacherApplySettings?.teacherFeeType || '시간당';
    const weeks = teacherApplySettings?.operatingWeeks || 10;
    const daysCount = Math.max(1, selectedDays.length);
    const totalSessions = weeks * 2 * daysCount;

    if (type === '차시당') {
      return fee * totalSessions;
    }
    if (type === '정액제') {
      return fee;
    }
    try {
      const [sh, sm] = newTimeStart.split(':').map(Number);
      const [eh, em] = newTimeEnd.split(':').map(Number);
      const diffMins = (eh * 60 + em) - (sh * 60 + sm);
      const diffHours = diffMins > 0 ? diffMins / 60 : 1.5;
      return Math.round(fee * diffHours * weeks * daysCount);
    } catch {
      return fee * 1.5 * weeks * daysCount;
    }
  };

  // New course form
  const [newTitle, setNewTitle] = useState('');
  const [newTimeStart, setNewTimeStart] = useState('14:00');
  const [newTimeEnd, setNewTimeEnd] = useState('15:20');
  const [newClassroom, setNewClassroom] = useState('');
  const [newMax, setNewMax] = useState('20');
  const [isFreeCourse, setIsFreeCourse] = useState(false);

  // 교시 기반 수업시간 선택용 상태
  const [periodType, setPeriodType] = useState<'SEMESTER' | 'VACATION'>('SEMESTER');
  const [startPeriodId, setStartPeriodId] = useState<string>('');
  const [endPeriodId, setEndPeriodId] = useState<string>('');

  const filteredPeriods = periods.filter((p) => p.type === periodType);

  React.useEffect(() => {
    if (filteredPeriods.length > 0) {
      setStartPeriodId(filteredPeriods[0].id);
      setEndPeriodId(filteredPeriods[0].id);
    }
  }, [periodType]);

  React.useEffect(() => {
    const startP = filteredPeriods.find((p) => p.id === startPeriodId);
    const endP = filteredPeriods.find((p) => p.id === endPeriodId);
    if (startP && endP) {
      setNewTimeStart(startP.startTime);
      setNewTimeEnd(endP.endTime);
    }
  }, [startPeriodId, endPeriodId, filteredPeriods]);
  
  // 신규 수강료 정책 관련 상태
  const [newMinStudents, setNewMinStudents] = useState('5'); // 폐강 기준 인원 (기본 5명)
  const [selectedDays, setSelectedDays] = useState<string[]>([]); // 주 복수 요일 선택 (최대 2일)
  
  // 강사풀 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [assistantTeachersList, setAssistantTeachersList] = useState<string[]>([]);

  // Syllabus Session draft list for editing
  const [draftSessions, setDraftSessions] = useState<
    { sessionNo: number; dateStr: string; topic: string }[]
  >([]);

  // 신규 강좌 개설 시 차시별 수업 계획 상태 및 엑셀 파일 인풋 Ref
  const [newSyllabusSessions, setNewSyllabusSessions] = useState<SyllabusSession[]>([]);
  const [selectedCourseToImport, setSelectedCourseToImport] = useState<string>('');
  const addSyllabusFileInputRef = useRef<HTMLInputElement>(null);
  const editSyllabusFileInputRef = useRef<HTMLInputElement>(null);

  // ─── 보조 강사 배정 & 관리 모달 상태 ───────────────────────────────────────────
  const [assistantModalCourse, setAssistantModalCourse] = useState<Course | null>(null);
  const [assistantDraftList, setAssistantDraftList] = useState<string[]>([]);
  const [assistantSearchQuery, setAssistantSearchQuery] = useState('');
  const [assistantCustomName, setAssistantCustomName] = useState('');

  // ─── 학습준비물 신청 & 지출증빙서류 상태 ───────────────────────────────────────────
  const [materialModalCourse, setMaterialModalCourse] = useState<Course | null>(null);
  const [materialModalTab, setMaterialModalTab] = useState<'request' | 'expense_proof'>('request');

  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([{ name: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  const [isSubmittingMaterial, setIsSubmittingMaterial] = useState(false);
  const [maxPerCourse, setMaxPerCourse] = useState(50000);
  const [materialCurrency, setMaterialCurrency] = useState<'KRW' | 'VND' | 'USD'>('KRW');
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [expenseProofs, setExpenseProofs] = useState<ExpenseProof[]>([]);

  // 지출증빙서류 폼 입력 상태
  const [selectedRequestIdForProof, setSelectedRequestIdForProof] = useState<string>('');
  const [proofCardType, setProofCardType] = useState<'PERSONAL' | 'SCHOOL'>('PERSONAL');
  const [proofCardOwnerName, setProofCardOwnerName] = useState<string>('');
  const [proofBankInfo, setProofBankInfo] = useState<string>('신한 000-0000-0000');
  const [proofAccountHolderEng, setProofAccountHolderEng] = useState<string>('HONG GIL DONG');
  const [proofSpentAmount, setProofSpentAmount] = useState<number>(0);
  const [proofReceiptImageUrl, setProofReceiptImageUrl] = useState<string>('');
  const [proofBusinessName, setProofBusinessName] = useState<string>('');
  const [proofSupplierName, setProofSupplierName] = useState<string>('(주) 한국과학');
  const [proofDeliveryDate, setProofDeliveryDate] = useState<string>('2026-03-30');
  const [proofInspectionDate, setProofInspectionDate] = useState<string>('2026-03-30');
  const [proofItems, setProofItems] = useState<ExpenseProofItem[]>([
    { name: '', modelName: '표준형', unit: 'SET', contractQty: 1, inspectedQty: 1, amount: 0 }
  ]);
  const [proofInspectorName, setProofInspectorName] = useState<string>('');
  const [proofWitnessName, setProofWitnessName] = useState<string>('배경희 (교감)');
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [previewProofModalData, setPreviewProofModalData] = useState<ExpenseProof | null>(null);

  // 제출 독촉 알림 상태
  const [reminders, setReminders] = useState<SubmissionReminder[]>([]);
  const [activeReminderModal, setActiveReminderModal] = useState<SubmissionReminder | null>(null);

  useEffect(() => {
    getMaterialBudgetSettings().then(s => {
      setMaxPerCourse(s.maxPerCourse);
      if (s.currency) setMaterialCurrency(s.currency);
    });
    const unsubReq = onMaterialRequestsUpdate((list) => setMaterialRequests(list));
    const unsubProof = onExpenseProofsUpdate((list) => setExpenseProofs(list));
    const unsubRemind = onTeacherRemindersUpdate(currentUserName || '', (list) => {
      setReminders(list);
      const unread = list.find(r => !r.isRead);
      if (unread) {
        setActiveReminderModal(unread);
      }
    });
    return () => {
      unsubReq();
      unsubProof();
      unsubRemind();
    };
  }, [currentUserName]);

  const formatMaterialMoney = (amount: number) => {
    const formatted = amount.toLocaleString();
    if (materialCurrency === 'VND') return `${formatted} VND`;
    if (materialCurrency === 'USD') return `$${formatted}`;
    return `${formatted}원`;
  };

  const materialTotal = materialItems.reduce((s, i) => s + i.amount, 0);

  const handleMaterialItemChange = (idx: number, field: keyof MaterialItem, value: string | number) => {
    setMaterialItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: typeof value === 'string' ? (parseFloat(value) || 0) : value };
      if (field === 'name') return { ...item, name: value as string };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? (parseFloat(value as string) || 0) : item.quantity;
        const price = field === 'unitPrice' ? (parseFloat(value as string) || 0) : item.unitPrice;
        return { ...item, [field]: parseFloat(value as string) || 0, amount: qty * price };
      }
      return updated;
    }));
  };

  const handleAddMaterialItem = () => {
    setMaterialItems(prev => [...prev, { name: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  };

  const handleRemoveMaterialItem = (idx: number) => {
    setMaterialItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitMaterial = async () => {
    if (!materialModalCourse) return;
    if (materialItems.some(i => !i.name.trim())) {
      alert('진비물 품목명을 모두 입력해주세요.');
      return;
    }
    if (materialItems.some(i => i.unitPrice <= 0 || i.quantity <= 0)) {
      alert('수량과 단가를 올바르게 입력해주세요.');
      return;
    }
    setIsSubmittingMaterial(true);
    const req: MaterialRequest = {
      id: `mr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      courseId: materialModalCourse.id,
      courseTitle: materialModalCourse.title,
      instructorName: materialModalCourse.instructorName || currentUserName || '강사',
      items: materialItems,
      totalAmount: materialTotal,
      status: 'PENDING',
      submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    const res = await submitMaterialRequest(req);
    setIsSubmittingMaterial(false);
    if (res.success) {
      alert('학습준비물 신청이 완료되었습니다. 관리자의 검토 후 승인됩니다.');
      setMaterialModalCourse(null);
      setMaterialItems([{ name: '', quantity: 1, unitPrice: 0, amount: 0 }]);
    } else {
      alert(`신청 실패: ${res.error}`);
    }
  };

  // 준비물 승인 건 선택 시 폼 자동 채우기
  const handleSelectApprovedRequestForProof = (reqId: string) => {
    setSelectedRequestIdForProof(reqId);
    const matched = materialRequests.find(r => r.id === reqId);
    if (matched && materialModalCourse) {
      setProofBusinessName(`방과후학교 준비물 구매 (${matched.courseTitle})`);
      setProofSpentAmount(matched.totalAmount);
      setProofItems(matched.items.map(i => ({
        name: i.name,
        modelName: '표준형',
        unit: 'SET',
        contractQty: i.quantity,
        inspectedQty: i.quantity,
        amount: i.amount,
      })));
    }
  };

  // 지출증빙서류 제출 처리
  const handleSubmitProof = async () => {
    if (!materialModalCourse) return;

    // 1. 영수증 사진 필수 검증
    if (!proofReceiptImageUrl.trim()) {
      alert('⚠️ 영수증 사진(증빙)은 필수 입력사항입니다. 영수증 이미지/파일을 꼭 첨부해주세요.');
      return;
    }

    if (proofItems.some(i => !i.name.trim())) {
      alert('검수내역의 품명을 모두 입력해주세요.');
      return;
    }
    setIsSubmittingProof(true);
    const proofData: ExpenseProof = {
      id: `proof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      requestId: selectedRequestIdForProof || undefined,
      courseId: materialModalCourse.id,
      courseTitle: materialModalCourse.title,
      instructorName: materialModalCourse.instructorName || currentUserName || '강사',
      cardType: proofCardType,
      cardOwnerName: proofCardOwnerName || materialModalCourse.instructorName || currentUserName || '홍길동',
      bankInfo: proofBankInfo,
      accountHolderEng: proofAccountHolderEng,
      spentAmount: proofSpentAmount,
      receiptImageUrl: proofReceiptImageUrl,
      businessName: proofBusinessName || `방과후학교 준비물 구매 (${materialModalCourse.title})`,
      supplierName: proofSupplierName || '(주) 한국과학',
      deliveryDate: proofDeliveryDate || '2026-03-30',
      inspectionDate: proofInspectionDate || '2026-03-30',
      items: proofItems,
      inspectorName: proofInspectorName || materialModalCourse.instructorName || currentUserName || '홍길동',
      witnessName: proofWitnessName || '배경희',
      inspectionPhotos: proofPhotos,
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };

    const res = await submitExpenseProof(proofData);
    setIsSubmittingProof(false);
    if (res.success) {
      alert('지출증빙서류(영수증·검수조서·검수사진)가 성공적으로 제출되었습니다!');
      setPreviewProofModalData(proofData); // 제출 후 즉시 인쇄 미리보기 화면 열기
    } else {
      alert(`제출 실패: ${res.error}`);
    }
  };

  const currentProofDraftObject = (): ExpenseProof => ({
    id: `draft_${Date.now()}`,
    requestId: selectedRequestIdForProof || undefined,
    courseId: materialModalCourse?.id || '',
    courseTitle: materialModalCourse?.title || '',
    instructorName: materialModalCourse?.instructorName || currentUserName || '강사',
    cardType: proofCardType,
    cardOwnerName: proofCardOwnerName || materialModalCourse?.instructorName || currentUserName || '홍길동',
    bankInfo: proofBankInfo,
    accountHolderEng: proofAccountHolderEng,
    spentAmount: proofSpentAmount,
    receiptImageUrl: proofReceiptImageUrl,
    businessName: proofBusinessName || `방과후학교 준비물 구매 (${materialModalCourse?.title || ''})`,
    supplierName: proofSupplierName || '(주) 한국과학',
    deliveryDate: proofDeliveryDate || '2026-03-30',
    inspectionDate: proofInspectionDate || '2026-03-30',
    items: proofItems,
    inspectorName: proofInspectorName || materialModalCourse?.instructorName || currentUserName || '홍길동',
    witnessName: proofWitnessName || '배경희',
    inspectionPhotos: proofPhotos,
    status: 'SUBMITTED',
    submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
  });

  // Open syllabus editor for course
  const handleOpenSyllabusEditor = (course: Course) => {
    setEditingSyllabusCourse(course);
    const existing = course.syllabusSessions || defaultSyllabus10;
    setDraftSessions(
      existing.map((s) => ({
        sessionNo: s.sessionNo,
        dateStr: s.dateStr || '03/30',
        topic: s.topic || `${s.sessionNo}차시 수업계획`,
      }))
    );
  };

  // 엑셀 업로드 핸들러 (기존 강좌 수업계획 수정용)
  const handleUploadSyllabusForEdit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseSyllabusExcelFile(file);
      if (parsed.length === 0) {
        alert('엑셀 파일에서 차시별 수업계획 데이터를 찾을 수 없습니다.');
        return;
      }
      setDraftSessions(parsed.map(s => ({
        sessionNo: s.sessionNo,
        dateStr: s.dateStr || '',
        topic: s.topic || `${s.sessionNo}차시 수업계획`,
      })));
      alert(`성공: 총 ${parsed.length}개 차시의 수업계획 및 날짜가 엑셀에서 불러와졌습니다.`);
    } catch (err: any) {
      console.error('Failed to parse syllabus excel:', err);
      alert(`엑셀 파일 읽기 실패: ${err.message || err}`);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // 엑셀 업로드 핸들러 (신규 강좌 개설용)
  const handleUploadSyllabusForNewCourse = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseSyllabusExcelFile(file);
      if (parsed.length === 0) {
        alert('엑셀 파일에서 차시별 수업계획 데이터를 찾을 수 없습니다.');
        return;
      }
      setNewSyllabusSessions(parsed.map(s => ({
        sessionNo: s.sessionNo,
        dateStr: s.dateStr || '',
        topic: s.topic || `${s.sessionNo}차시 수업계획`,
      })));
      alert(`성공: 총 ${parsed.length}개 차시의 수업계획 및 날짜가 엑셀에서 불러와졌습니다.`);
    } catch (err: any) {
      console.error('Failed to parse syllabus excel for new course:', err);
      alert(`엑셀 파일 읽기 실패: ${err.message || err}`);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Save syllabus sessions
  const handleSaveSyllabus = () => {
    if (!editingSyllabusCourse) return;
    setCourses((prev) =>
      prev.map((c) =>
        c.id === editingSyllabusCourse.id ? { ...c, syllabusSessions: draftSessions } : c
      )
    );
    updateAfterschoolCourse(editingSyllabusCourse.id, { syllabusSessions: draftSessions }).catch((e: any) => {
      console.error("[CourseManagement] Failed to save syllabus:", e);
    });
    setEditingSyllabusCourse(null);
    alert('수업계획 및 차시별 날짜가 정상 수정되었습니다.');
  };

  // ─── 보조 강사 배정 및 관리 핸들러 ───────────────────────────────────────────
  const handleOpenAssistantModal = (course: Course) => {
    setAssistantModalCourse(course);
    const existing = [
      course.instructor2,
      course.instructor3,
      course.instructor4,
      ...(course.assistantTeachers || [])
    ].filter(Boolean).map(s => String(s).trim());
    setAssistantDraftList(Array.from(new Set(existing)));
    setAssistantSearchQuery('');
    setAssistantCustomName('');
  };

  const handleAddAssistantToDraft = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed === assistantModalCourse?.instructorName) {
      alert('주강사 본인은 보조강사로 추가할 수 없습니다.');
      return;
    }
    if (assistantDraftList.includes(trimmed)) {
      alert('이미 배정된 강사입니다.');
      return;
    }
    if (assistantDraftList.length >= 3) {
      alert('보조강사는 최대 3명(총 강사 4명)까지 배정 가능합니다.');
      return;
    }
    setAssistantDraftList(prev => [...prev, trimmed]);
    setAssistantSearchQuery('');
    setAssistantCustomName('');
  };

  const handleRemoveAssistantFromDraft = (name: string) => {
    setAssistantDraftList(prev => prev.filter(n => n !== name));
  };

  const handleSaveAssistants = async () => {
    if (!assistantModalCourse) return;
    const updatedData = {
      instructor2: assistantDraftList[0] || '',
      instructor3: assistantDraftList[1] || '',
      instructor4: assistantDraftList[2] || '',
      assistantTeachers: assistantDraftList,
    };

    setCourses(prev =>
      prev.map(c => (c.id === assistantModalCourse.id ? { ...c, ...updatedData } : c))
    );

    try {
      await updateAfterschoolCourse(assistantModalCourse.id, updatedData);
      alert(`[${assistantModalCourse.title}] 강좌의 보조 강사 배정이 정상 저장되었습니다.`);
    } catch (e: any) {
      console.error('[CourseManagement] Failed to update assistants:', e);
      alert(`보조강사 저장 실패: ${e.message}`);
    }

    setAssistantModalCourse(null);
  };

  // 요일 선택 토글 (최대 2일 제한)
  const getCurrencyLabel = (currencyCode: 'KRW' | 'VND' | 'USD') => {
    if (currencyCode === 'VND') return '동';
    if (currencyCode === 'USD') return '달러';
    return '원';
  };

  const formatTuition = (amount: number) => {
    const cur = teacherApplySettings?.tuitionCurrency || 'KRW';
    const formatted = amount.toLocaleString();
    if (cur === 'USD') return `${formatted}`;
    return `${formatted}${getCurrencyLabel(cur)}`;
  };

  const formatTeacherFee = (amount: number) => {
    const cur = teacherApplySettings?.teacherFeeCurrency || 'KRW';
    const formatted = amount.toLocaleString();
    if (cur === 'USD') return `${formatted}`;
    return `${formatted}${getCurrencyLabel(cur)}`;
  };

  // 자동 수업일자 및 차시 계산 함수 (선택 요일, 시간대, 학사일정 휴일 연동)
  const getAutoCalculatedSessions = (
    days: string[],
    slotId?: string,
    existingTopics?: (string | undefined)[]
  ): SyllabusSession[] => {
    if (!days || days.length === 0) return [];

    const matchedSlot = teacherApplySettings?.timeSlots?.find((s: any) => s.id === (slotId || selectedTimeSlotId));
    const sessionsPerLesson = inferSessionsPerLesson(
      matchedSlot?.label,
      matchedSlot?.startTime || newTimeStart,
      matchedSlot?.endTime || newTimeEnd,
      teacherApplySettings?.sessionsPerClass || 2
    );

    const calculated = calculateCourseSessionDates({
      operatingStartDate: teacherApplySettings?.operatingStartDate || '2026-03-30',
      operatingEndDate: teacherApplySettings?.operatingEndDate || '2026-06-20',
      selectedDays: days,
      sessionsPerLesson,
      events: docConfig?.academicCalendar?.events || [],
      targetWeeks: teacherApplySettings?.operatingWeeks || 10,
      existingTopics,
    });

    return calculated;
  };

  // 기존 강좌 불러오기 핸들러
  const handleImportCourse = (courseId: string) => {
    setSelectedCourseToImport(courseId);
    if (!courseId) return;

    const targetCourse = courses.find((c) => c.id === courseId);
    if (!targetCourse) return;

    // 강좌 기본 정보 복사
    setNewTitle(targetCourse.title);
    setNewMax(String(targetCourse.maxStudents || 20));
    setNewMinStudents(String(targetCourse.minStudentsToOpen || 5));
    if (targetCourse.classroom) setNewClassroom(targetCourse.classroom);
    if (targetCourse.assistantTeachers) setAssistantTeachersList(targetCourse.assistantTeachers);
    setIsFreeCourse(!!targetCourse.isFree);

    // 요일 복사
    const targetDays = targetCourse.classDays || (targetCourse.classTime?.split(' ')[0]?.split('/') || []);
    setSelectedDays(targetDays);

    // 기존 수업 주제 목록 추출
    const existingTopics = targetCourse.syllabusSessions?.map((s) => s.topic) || [];

    // 이번 학기 학사일정에 맞춰 새로운 날짜로 자동 차시 계산!
    const autoSessions = getAutoCalculatedSessions(targetDays, selectedTimeSlotId, existingTopics);
    setNewSyllabusSessions(autoSessions);

    alert(`[${targetCourse.title}] 강좌 정보를 성공적으로 불러왔습니다.\n차시별 수업계획 주제는 그대로 유지되며, 수업일자는 이번 학기 학사일정에 맞춰 자동 계산되었습니다.`);
  };

  const handleToggleDay = (day: string) => {
    let nextDays: string[] = [];
    if (selectedDays.includes(day)) {
      nextDays = selectedDays.filter((d) => d !== day);
      setSelectedDays(nextDays);
    } else {
      if (selectedDays.length >= 2) {
        alert('방과후 강좌는 주 최대 2회까지만 요일을 지정할 수 있습니다.');
        return;
      }
      nextDays = [...selectedDays, day];
      setSelectedDays(nextDays);
    }

    if (nextDays.length > 0) {
      const existingTopics = newSyllabusSessions.map((s) => s.topic);
      const autoSessions = getAutoCalculatedSessions(nextDays, selectedTimeSlotId, existingTopics);
      setNewSyllabusSessions(autoSessions);
    } else {
      setNewSyllabusSessions([]);
    }
  };

  // 보조 강사 추가
  const handleAddAssistantTeacher = (name: string) => {
    if (assistantTeachersList.includes(name)) return;
    setAssistantTeachersList((prev) => [...prev, name]);
    setSearchQuery('');
  };

  // 보조 강사 삭제
  const handleRemoveAssistantTeacher = (name: string) => {
    setAssistantTeachersList((prev) => prev.filter((t) => t !== name));
  };

  // Add course submit
  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedDays.length === 0) {
      alert('최소 1개 이상의 요일을 선택해 주세요.');
      return;
    }

    const classTimeFormatted = `${selectedDays.join('/')} ${newTimeStart}~${newTimeEnd}`;

    // 교실 충돌 감지: 교실의 동시수업가능 수량 대비 진행 중인 강좌 수가 넘었는지 확인
    if (newClassroom) {
      const targetRoom = classrooms.find(r => r.name === newClassroom);
      const limit = targetRoom?.maxSimultaneousCourses || 1;
      const runningCount = courses.filter(
        (c) => c.classroom === newClassroom && c.status !== 'CANCELLED' && c.classTime === classTimeFormatted
      ).length;

      if (runningCount >= limit) {
        if (!window.confirm(`[${newClassroom}]에서 같은 시간에 이미 ${runningCount}개의 강좌가 진행 중입니다(최대 허용: ${limit}개).\n그래도 개설 신청하시겠습니까?`)) return;
      }
    }

    // 실제 운영 주수(operatingWeeks) 및 선택 요일 수에 연동한 총 차시 계산
    const weeks = teacherApplySettings?.operatingWeeks || 10;
    const totalSessions = weeks * 2 * selectedDays.length;

    // 차시별 수강료 고정 정책 적용 (동적 총 차시 기준 자동 계산)
    const unitFee = (isFreeCourse || teacherApplySettings?.tuitionType === '학교예산') ? 0 : (teacherApplySettings?.tuitionPerSession ?? 15000);
    const calculatedTuition = unitFee * totalSessions;

    // 로그인한 강사명 지정 (부장 역할일 경우 '부장교사', 강사일 경우 전달받은 로그인명/임의 지정)
    const currentInstructorName = currentUserName || (role === 'admin' ? '예체능부장(교사)' : '김강사');

    // 총 차시 수에 맞춘 기본 동적 수업계획서 세션 생성
    const defaultSessionsCount = newSyllabusSessions.length > 0 ? newSyllabusSessions.length : totalSessions;
    const generatedSyllabus = Array.from({ length: defaultSessionsCount }, (_, i) => ({
      sessionNo: i + 1,
      dateStr: '',
      topic: `${i + 1}차시 수업 계획`,
    }));

    const finalSyllabusSessions = newSyllabusSessions.length > 0 ? newSyllabusSessions : generatedSyllabus;

    const created: Course = {
      id: `c_${Date.now()}`,
      title: newTitle,
      category: '',
      instructorName: currentInstructorName,
      classTime: classTimeFormatted,
      classroom: newClassroom || undefined,
      maxStudents: parseInt(newMax) || 20,
      currentStudents: 0,
      maxWaiting: 10,
      waitingStudents: 0,
      tuition: calculatedTuition, // 동적 계산 적용
      textbookFee: 0,
      materialFee: 0,
      targetGrades: [1, 2, 3],
      description: '새로 개설된 방과후학교 강좌입니다.',
      status: role === 'admin' ? 'OPEN' : 'PENDING', // 강사는 PENDING, 관리자(부장)는 즉시 OPEN
      syllabusSessions: finalSyllabusSessions,
      classDays: selectedDays,
      minStudentsToOpen: parseInt(newMinStudents) || 5,
      assistantTeachers: assistantTeachersList,
      isFree: isFreeCourse,
    };

    setCourses((prev) => [...prev, created]);
    updateAfterschoolCourse(created.id, created).catch((e: any) => {
      console.error("[CourseManagement] Failed to save course to Firestore:", e);
      alert(`강좌 저장 실패: ${e.message}`);
    });
    setIsAddModalOpen(false);
    setNewTitle('');
    setNewClassroom('');
    setSelectedDays([]);
    setAssistantTeachersList([]);
    setIsFreeCourse(false);
    setNewSyllabusSessions([]);
    if (role !== 'admin') {
      alert('강좌 개설 신청이 완료되었습니다. 예체능방과후부장의 승인 후 개설됩니다.');
    }
  };

  const handleToggleLock = (courseId: string) => {
    const matched = courses.find((c) => c.id === courseId);
    if (!matched) return;
    const nextLocked = !matched.isForceLocked;
    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, isForceLocked: nextLocked } : c))
    );
    updateAfterschoolCourse(courseId, { isForceLocked: nextLocked }).catch((e: any) => {
      console.error("[CourseManagement] Failed to toggle course lock:", e);
    });
  };

  // 동적 강사 배정 규칙 계산 (20명 이상 시 1명 보조강사 추가 및 이후 5명당 1명 추가)
  const getRequiredTeachersCount = (currentStudents: number) => {
    if (currentStudents < 20) return 1; // 20명 미만은 주강사 1명
    // 20명 이상: 1명(주강사) + 1명(보조강사) + 5명 증가당 1명 보조 추가
    const extraStudents = currentStudents - 20;
    const additionalAssistants = 1 + Math.floor(extraStudents / 5);
    return 1 + additionalAssistants;
  };

  // 실제 학교 교사 목록 필터링
  const filteredSchoolTeachers = searchQuery.trim()
    ? schoolTeachers.filter(t => t.name && t.name.includes(searchQuery.trim()))
    : [];

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {/* Header Banner (슬림 한 줄 표기) */}
      <div className="bg-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight whitespace-nowrap">
              {t('afterschool.teacher.course_management_title')}
            </h2>
            <span className="bg-indigo-50 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-indigo-200 shadow-2xs">
              {getDetailedStatusText()}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 truncate hidden md:inline">
            {t('afterschool.teacher.course_management_desc')}
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          disabled={!isTeacherApplyEnabled && (role !== 'admin' || (teacherApplySettings as any)?.afterschoolStageStatus === 'CLOSED')}
          className={`font-bold text-xs px-3 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1 shrink-0 ${
            isTeacherApplyEnabled || (role === 'admin' && (teacherApplySettings as any)?.afterschoolStageStatus !== 'CLOSED')
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('afterschool.teacher.new_course_btn')}</span>
        </button>
      </div>

      {/* Course Grid Cards (2개씩 나란히 쌓이는 2열 그리드 & 세로 높이 절반 슬림화) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3">
        {sortedCourses.map((course) => {
          // 수강신청 시작일 기준으로 수강신청 전 여부 파악
          const now = new Date().getTime();
          const startTime = timerConfig?.startTime ? new Date(timerConfig.startTime).getTime() : 0;
          const isBeforeEnrollment = !startTime || now < startTime;

          const minStudents = course.minStudentsToOpen || 5;
          const isSatisfied = course.currentStudents >= minStudents;

          const isPendingCancellation = course.status !== 'CANCELLED' && !isBeforeEnrollment && !isSatisfied;
          
          // 모든 배정 강사 목록 종합 (주강사 + 보조강사들)
          const allInstructors = [
            course.instructorName,
            course.instructor2,
            course.instructor3,
            course.instructor4,
            ...(course.assistantTeachers || [])
          ].filter(Boolean).map(s => String(s).trim());
          const uniqueInstructors = Array.from(new Set(allInstructors));
          const leadInstructor = uniqueInstructors[0] || course.instructorName || '미배정';
          const assistantList = uniqueInstructors.slice(1);

          // 동적 필요 강사 수 계산
          const requiredTeachers = getRequiredTeachersCount(course.currentStudents || 0);
          const isAssistantNeeded = uniqueInstructors.length < requiredTeachers;

          return (
            <div
              key={course.id}
              className={`bg-white rounded-xl border shadow-2xs hover:border-indigo-300 transition p-3 sm:p-3.5 flex flex-col justify-between gap-2 ${
                course.status === 'PENDING' ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'
              }`}
            >
              {/* 상단 2열 정보 영역 */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-start">
                {/* 좌측 (7칸): 강좌명, 설명, 시간, 장소 */}
                <div className="sm:col-span-7 space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
                      {course.title}
                    </h3>
                    {course.status === 'CANCELLED' ? (
                      <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded line-through">
                        폐강
                      </span>
                    ) : course.status === 'PENDING' ? (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        개설대기
                      </span>
                    ) : (teacherApplySettings as any)?.afterschoolStageStatus === 'CLOSED' ? (
                      <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        운영종료
                      </span>
                    ) : (
                      <button
                        onClick={() => handleToggleLock(course.id)}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 transition ${
                          course.isForceLocked
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {course.isForceLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                        <span>{course.isForceLocked ? '신청잠김' : '신청가능'}</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[10.5px] text-slate-500 line-clamp-1">
                    {course.description || '강좌 설명이 없습니다.'}
                  </p>

                  <div className="text-[10.5px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100 space-y-0.5 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">강의시간:</span>
                      <b className="text-slate-800">{course.classTime}</b>
                    </div>
                    {course.classroom && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">장소:</span>
                        <span className="font-bold text-slate-800">{course.classroom}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 우측 (5칸): 인원, 강사, 수강료 */}
                <div className="sm:col-span-5 text-[10.5px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">수강인원:</span>
                    <span><b className="text-indigo-700 font-bold">{course.currentStudents}</b> / {course.maxStudents}명</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">배정강사:</span>
                    <div className="flex items-center gap-1 truncate max-w-[120px]">
                      <span className="bg-indigo-100 text-indigo-800 font-bold px-1 py-0.2 rounded text-[10px]">
                        {leadInstructor}
                      </span>
                      {assistantList.length > 0 && (
                        <span className="bg-emerald-100 text-emerald-800 font-medium px-1 rounded text-[10px]">
                          +{assistantList.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t pt-1 border-slate-200/60 font-sans">
                    <span className="text-slate-500">수강료:</span>
                    <b className={course.isFree || course.tuition === 0 ? "text-emerald-600 font-bold" : "text-indigo-600 font-bold"}>
                      {course.isFree || course.tuition === 0 ? '0원 (무료)' : formatTuition(course.tuition)}
                    </b>
                  </div>
                </div>
              </div>

              {/* 폐강 경고 표시 */}
              {isPendingCancellation && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  모집인원 미달로 자동폐강 대기 중 (최소 {minStudents}명 필요)
                </div>
              )}

              {/* 하단 4개 액션 버튼 (가로로 슬림하게 나란히 배치) */}
              <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleOpenSyllabusEditor(course)}
                  className="bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-200 rounded-lg py-1 px-1 transition flex items-center justify-center gap-1 text-center cursor-pointer shadow-2xs group"
                  title="수업 계획 / 날짜 수정"
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap">수업 계획</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenAssistantModal(course)}
                  className="bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200 rounded-lg py-1 px-1 transition flex items-center justify-center gap-1 text-center cursor-pointer shadow-2xs group"
                  title="보조 강사 배정 및 관리"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-bold text-emerald-900 whitespace-nowrap">보조 강사</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectCourseForStudent(course.id)}
                  className="bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200 rounded-lg py-1 px-1 transition flex items-center justify-center gap-1 text-center cursor-pointer shadow-2xs group"
                  title="수강생 명단 관리"
                >
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="text-[11px] font-bold text-indigo-900 whitespace-nowrap">수강생 명단</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMaterialModalCourse(course);
                    setMaterialItems([{ name: '', quantity: 1, unitPrice: 0, amount: 0 }]);
                  }}
                  className="bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200 rounded-lg py-1 px-1 transition flex items-center justify-center gap-1 text-center cursor-pointer shadow-2xs group"
                  title="학습 준비물 품의"
                >
                  <Package className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-[11px] font-bold text-amber-900 whitespace-nowrap">준비물</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Syllabus & Session Date Editing Modal */}
      {editingSyllabusCourse && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0 bg-white">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                차시별 수업계획 및 수업 날짜(월일) 수정
              </h3>
              <button
                onClick={() => setEditingSyllabusCourse(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                <div>
                  <div className="text-xs text-indigo-900">
                    강좌명: <b className="text-indigo-950 font-bold">{editingSyllabusCourse.title}</b>
                  </div>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    수업 날짜 변경 시 출석부에 자동 연동되며, 학부모 수강신청 화면에 공개됩니다.
                  </p>
                </div>

                {/* 엑셀 양식 다운로드 및 업로드 버튼 */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const courseDays =
                        editingSyllabusCourse.classDays ||
                        (editingSyllabusCourse.classTime?.split(' ')[0]?.split('/') || ['월']);
                      const existingTopics = draftSessions.map((s) => s.topic);
                      const autoDates = getAutoCalculatedSessions(courseDays, undefined, existingTopics);
                      const effectiveSessions =
                        draftSessions.length > 0 && draftSessions.some((s) => s.dateStr)
                          ? draftSessions
                          : autoDates.length > 0
                          ? autoDates
                          : draftSessions;

                      exportSyllabusTemplateExcel(
                        editingSyllabusCourse.title,
                        effectiveSessions,
                        effectiveSessions.length
                      );
                    }}
                    className="bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    양식 다운로드 (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => editSyllabusFileInputRef.current?.click()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    엑셀 일괄 등록
                  </button>
                  <input
                    type="file"
                    ref={editSyllabusFileInputRef}
                    onChange={handleUploadSyllabusForEdit}
                    accept=".xlsx, .xls"
                    className="hidden"
                  />
                </div>
              </div>

              {/* 차시 목록 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">전체 차시별 수업 계획 ({draftSessions.length}차시)</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftSessions(prev => [
                        ...prev,
                        { sessionNo: prev.length + 1, dateStr: '', topic: `${prev.length + 1}차시 수업계획` }
                      ]);
                    }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    차시 추가
                  </button>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {draftSessions.map((s, idx) => (
                    <div key={s.sessionNo} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                      <span className="font-bold text-indigo-700 font-mono w-14 shrink-0">{s.sessionNo}차시</span>
                      <div className="flex items-center gap-1 w-28 shrink-0">
                        <span className="text-slate-400">월일:</span>
                        <input
                          type="text"
                          value={s.dateStr}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftSessions((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, dateStr: val } : item))
                            );
                          }}
                          className="w-16 border border-slate-300 p-1 rounded-md font-mono text-xs bg-white text-center"
                          placeholder="03/30"
                        />
                      </div>

                      <input
                        type="text"
                        value={s.topic}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraftSessions((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, topic: val } : item))
                          );
                        }}
                        className="flex-1 border border-slate-300 p-1.5 rounded-md text-xs bg-white"
                        placeholder="수업 주제 및 주요 학습 활동 내용..."
                      />

                      <button
                        type="button"
                        onClick={() => {
                          if (draftSessions.length <= 1) {
                            alert('최소 1개 이상의 차시가 필요합니다.');
                            return;
                          }
                          setDraftSessions(prev =>
                            prev
                              .filter((_, i) => i !== idx)
                              .map((item, newIdx) => ({ ...item, sessionNo: newIdx + 1 }))
                          );
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="해당 차시 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => setEditingSyllabusCourse(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveSyllabus}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center gap-1.5 transition"
              >
                <Save className="w-3.5 h-3.5" />
                수업계획 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Course Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddCourse}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0 bg-white">
              <h3 className="font-bold text-slate-900 text-base">신규 강좌 개설</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* 기존 강좌 불러오기 (복사) */}
              {courses.length > 0 && (
                <div className="bg-indigo-50/70 border border-indigo-100 p-3 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <Copy className="w-3.5 h-3.5 text-indigo-600" />
                      기존 강좌에서 불러오기 (복사)
                    </span>
                    <span className="text-[10px] text-indigo-600 font-medium">이전 개설 강좌 복사</span>
                  </div>
                  <select
                    value={selectedCourseToImport}
                    onChange={(e) => handleImportCourse(e.target.value)}
                    className="w-full border border-indigo-200 p-2 rounded-lg bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="">[선택 안 함 - 신규 직접 작성]</option>
                    {sortedCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.classTime || '시간미정'}) {c.instructorName ? `- ${c.instructorName}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-indigo-700 leading-tight">
                    선택 시 강좌 설정 및 차시별 수업 계획 주제가 복사되며, 수업일자는 이번 학사일정에 맞춰 자동 계산됩니다.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">강좌명</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="예: [3월] 로봇과학 코딩교실"
                  className="w-full border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* 강사명 (본인 고정) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">강사명 (개설자)</label>
                <input
                  type="text"
                  disabled
                  value={`${currentUserName || (role === 'admin' ? '예체능부장(교사)' : '김강사')} - 본인`}
                  className="w-full border border-slate-200 p-2.5 rounded-xl bg-slate-100 text-slate-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">모집 정원(명)</label>
                <input
                  type="number"
                  value={newMax}
                  onChange={(e) => setNewMax(e.target.value)}
                  className="w-full border border-slate-200 p-2.5 rounded-xl font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* 요일 복수 선택 (주 2회 제한) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">수업 요일 선택 (주 최대 2회)</label>
                <div className="flex gap-2 flex-wrap">
                  {(teacherApplySettings?.allowedDays || ['월', '화', '수', '목', '금']).map((day) => {
                    const isSelected = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleToggleDay(day)}
                        className={`flex-1 min-w-[40px] py-2 rounded-xl border font-bold text-xs transition ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 수업 시간대 선택 (관리자 템플릿) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-left">
                <span className="font-bold text-slate-700 block text-xs flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  수업 시간대 선택
                </span>
                
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1 font-bold">시간대 템플릿 선택</label>
                  <select
                    value={selectedTimeSlotId}
                    onChange={(e) => handleTimeSlotChange(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-xl bg-white cursor-pointer font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {(teacherApplySettings?.timeSlots || []).map((slot: any) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.label}
                      </option>
                    ))}
                    {(teacherApplySettings?.timeSlots || []).length === 0 && (
                      <option value="">설정된 시간대 템플릿이 없습니다.</option>
                    )}
                  </select>
                </div>

                <div className="text-[11px] text-indigo-700 bg-indigo-50 p-2 rounded-lg font-mono font-medium">
                  지정된 수업시간: <b>{newTimeStart} ~ {newTimeEnd}</b>
                </div>
              </div>

              {/* 무료 강좌 여부 체크박스 */}
              <label className="flex items-center gap-2 font-bold text-slate-800 text-xs cursor-pointer bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 hover:bg-emerald-100/60 transition select-none">
                <input
                  type="checkbox"
                  checked={isFreeCourse}
                  onChange={(e) => setIsFreeCourse(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <span>무료 강좌 (수강료 0원 적용)</span>
              </label>

              {/* 수강료 (고정 단가 자동 계산) */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 font-mono text-[11px] text-indigo-900">
                <span className="font-bold">수강료 정책 자동 계산</span>
                <div className="flex justify-between mt-1">
                  <span>차시별 고정 수강료:</span>
                  <span>{isFreeCourse ? '0원 (무료)' : formatTuition(teacherApplySettings?.tuitionPerSession || 15000)}</span>
                </div>
                <div className="flex justify-between">
                  <span>총 {(teacherApplySettings?.operatingWeeks || 10) * 2 * Math.max(1, selectedDays.length)}차시 수강료:</span>
                  <span className="font-bold text-indigo-700">
                    {isFreeCourse
                      ? '0원 (무료)'
                      : formatTuition(
                          (teacherApplySettings?.tuitionType === '학교예산' ? 0 : (teacherApplySettings?.tuitionPerSession || 15000)) *
                          (teacherApplySettings?.operatingWeeks || 10) * 2 * Math.max(1, selectedDays.length)
                        )}
                  </span>
                </div>
              </div>

              {/* 강사비 (고정 단가 자동 계산) */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 font-mono text-[11px] text-emerald-900">
                <span className="font-bold">강사료 정책 자동 계산</span>
                <div className="flex justify-between mt-1">
                  <span>기준 단가 및 구분:</span>
                  <span>
                    {formatTeacherFee(teacherApplySettings?.teacherFee || 40000)} / {teacherApplySettings?.teacherFeeType || '시간당'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>예상 총 강사료:</span>
                  <span className="font-bold text-emerald-700">
                    {formatTeacherFee(getCalculatedTeacherFee())}
                  </span>
                </div>
              </div>

              {/* 최소 개설 인원 (자동 폐강 기준) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">자동 폐강 기준 인원 (미달 시 자동 폐강)</label>
                <input
                  type="number"
                  min="1"
                  max="19"
                  value={newMinStudents}
                  onChange={(e) => setNewMinStudents(e.target.value)}
                  className="w-full border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  placeholder="미달 시 자동 폐강처리될 기준 최소 모집 인원"
                />
              </div>

              {/* 수업 장소 선택 */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500" />수업 장소
                </label>
                <select
                  value={newClassroom}
                  onChange={(e) => setNewClassroom(e.target.value)}
                  className="w-full border border-slate-200 p-2.5 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">장소 선택 (미선택 가능)</option>
                  {classrooms.map((room) => {
                    const limit = room.maxSimultaneousCourses || 1;
                    const formatted = `${selectedDays.join('/')} ${newTimeStart}~${newTimeEnd}`;
                    const runningCount = courses.filter(
                      (c) => c.classroom === room.name && c.status !== 'CANCELLED' && c.classTime === formatted
                    ).length;
                    const isOver = runningCount >= limit;
                    return (
                      <option key={room.id} value={room.name}>
                        {room.name} (정원 {room.capacity}명, 동시허용 {limit}개){isOver ? ' [초과충돌]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 예비/보조 강사 지정 */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5 text-indigo-500" />보조 강사 지정 (20명 이상 대비 예비 강사풀 검색)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="교직원 이름 검색 (예: 이영희)"
                    className="w-full border border-slate-200 p-2.5 rounded-xl pl-9 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  
                  {/* 검색 결과 드롭다운 */}
                  {searchQuery && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                      {filteredSchoolTeachers.length === 0 ? (
                        <div className="p-3 text-slate-400 text-center text-xs">검색 결과가 없습니다.</div>
                      ) : (
                        filteredSchoolTeachers.map(teacher => (
                          <button
                            key={teacher.email}
                            type="button"
                            onClick={() => handleAddAssistantTeacher(teacher.name)}
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 transition border-b last:border-b-0 text-xs font-medium"
                          >
                            {teacher.name} ({teacher.dept || '교사'} / {teacher.email})
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* 현재 등록된 보조 강사 칩 */}
                {assistantTeachersList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {assistantTeachersList.map((teacher, i) => (
                      <span key={i} className="bg-slate-100 border text-slate-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-bold shadow-xs">
                        {teacher}
                        <button type="button" onClick={() => handleRemoveAssistantTeacher(teacher)} className="text-rose-500 font-extrabold hover:text-rose-700 ml-0.5">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 차시별 수업계획 및 수업 날짜 등록 섹션 */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      차시별 수업계획 및 수업 날짜 등록
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      엑셀 파일(.xlsx)로 손쉽게 작성하여 일괄 등록하거나 직접 입력할 수 있습니다.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const effectiveSessions =
                          newSyllabusSessions.length > 0
                            ? newSyllabusSessions
                            : getAutoCalculatedSessions(selectedDays.length > 0 ? selectedDays : ['월']);
                        const weeks = teacherApplySettings?.operatingWeeks || 10;
                        const totalSessions = weeks * 2 * Math.max(1, selectedDays.length);
                        exportSyllabusTemplateExcel(
                          newTitle || '신규강좌',
                          effectiveSessions,
                          totalSessions
                        );
                      }}
                      className="bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-2xs transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      양식 다운 (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={() => addSyllabusFileInputRef.current?.click()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-2xs transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      엑셀 일괄 등록
                    </button>
                    <input
                      type="file"
                      ref={addSyllabusFileInputRef}
                      onChange={handleUploadSyllabusForNewCourse}
                      accept=".xlsx, .xls"
                      className="hidden"
                    />
                  </div>
                </div>

                {/* 등록된 차시 목록 미리보기 및 직접 입력 */}
                {newSyllabusSessions.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 bg-white p-2 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 px-1">
                      <span>등록된 차시: {newSyllabusSessions.length}차시</span>
                      <button
                        type="button"
                        onClick={() => setNewSyllabusSessions([])}
                        className="text-rose-500 hover:text-rose-700 text-[10px] cursor-pointer"
                      >
                        초기화
                      </button>
                    </div>
                    {newSyllabusSessions.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs bg-slate-50 p-1.5 rounded border border-slate-100">
                        <span className="font-bold text-indigo-700 font-mono w-12 shrink-0">{s.sessionNo}차시</span>
                        <input
                          type="text"
                          value={s.dateStr}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewSyllabusSessions(prev =>
                              prev.map((item, i) => i === idx ? { ...item, dateStr: val } : item)
                            );
                          }}
                          placeholder="월일(03/30)"
                          className="w-20 border border-slate-300 p-1 rounded font-mono text-center text-[11px] bg-white shrink-0"
                        />
                        <input
                          type="text"
                          value={s.topic}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewSyllabusSessions(prev =>
                              prev.map((item, i) => i === idx ? { ...item, topic: val } : item)
                            );
                          }}
                          placeholder="수업 주제 및 학습 활동 내용"
                          className="flex-1 border border-slate-300 p-1 rounded text-[11px] bg-white"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-2.5 bg-white rounded-lg border border-dashed border-slate-300 text-[11px] text-slate-500">
                    미리 등록하지 않아도 기본 {((teacherApplySettings?.operatingWeeks || 10) * 2 * Math.max(1, selectedDays.length))}차시가 자동 생성되며, 개설 후 언제든지 수정할 수 있습니다.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition"
              >
                개설 신청하기
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── 학습준비물 신청 및 지출증빙서류 제출 모달 ────────────────────────── */}
      {materialModalCourse && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            
            {/* 모달 헤더 및 탭 선택 */}
            <div className="border-b pb-3 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" />
                  준비물 관리 & 지출증빙서류
                </h3>
                <button onClick={() => setMaterialModalCourse(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 2가지 서브탭 (신청 / 지출증빙 제출) */}
              <div className="flex border-b border-slate-200 gap-2 pb-0 font-bold text-xs">
                <button
                  type="button"
                  onClick={() => setMaterialModalTab('request')}
                  className={`pb-2.5 px-3 flex items-center gap-1.5 transition border-b-2 ${
                    materialModalTab === 'request'
                      ? 'border-emerald-600 text-emerald-700 font-extrabold'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  학습준비물 신청 탭
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMaterialModalTab('expense_proof');
                    // 강사 이름 기본 세팅
                    if (!proofCardOwnerName) setProofCardOwnerName(materialModalCourse.instructorName || currentUserName || '홍길동');
                    if (!proofInspectorName) setProofInspectorName(materialModalCourse.instructorName || currentUserName || '홍길동');
                    if (!proofBusinessName) setProofBusinessName(`방과후학교 준비물 구매 (${materialModalCourse.title})`);
                  }}
                  className={`pb-2.5 px-3 flex items-center gap-1.5 transition border-b-2 ${
                    materialModalTab === 'expense_proof'
                      ? 'border-indigo-600 text-indigo-700 font-extrabold'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  지출증빙서류 제출 탭 (영수증·검수조서)
                </button>
              </div>
            </div>

            {/* 강좌 정보 요약 */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800">
              <b>강좌:</b> {materialModalCourse.title} &nbsp;|&nbsp;
              <b>강사:</b> {materialModalCourse.instructorName || currentUserName || '강사'}
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                강좌별 최대 신청 가능액: <b>{formatMaterialMoney(maxPerCourse)}</b>
              </span>
            </div>

            {/* ─── 탭 1: 학습준비물 신청 ────────────────────────────────────────── */}
            {materialModalTab === 'request' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-1 text-[11px] font-bold text-slate-500 px-1">
                    <span className="col-span-5">품목명</span>
                    <span className="col-span-2 text-right">수량</span>
                    <span className="col-span-3 text-right">단가({materialCurrency === 'VND' ? 'VND' : materialCurrency === 'USD' ? '$' : '원'})</span>
                    <span className="col-span-2 text-right">금액</span>
                  </div>
                  {materialItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1 items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleMaterialItemChange(idx, 'name', e.target.value)}
                        placeholder="예: 로봇 부품 세트"
                        className="col-span-5 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-emerald-400 outline-none"
                      />
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleMaterialItemChange(idx, 'quantity', e.target.value)}
                        className="col-span-2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-emerald-400 outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => handleMaterialItemChange(idx, 'unitPrice', e.target.value)}
                        className="col-span-3 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-emerald-400 outline-none"
                      />
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <span className="text-[11px] font-bold text-slate-700 text-right">{item.amount.toLocaleString()}</span>
                        {materialItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMaterialItem(idx)}
                            className="text-rose-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddMaterialItem}
                  className="w-full border border-dashed border-emerald-300 text-emerald-600 font-bold text-xs py-2 rounded-xl hover:bg-emerald-50 transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> 품목 추가
                </button>

                {/* 합계 */}
                <div className={`flex justify-between items-center rounded-xl px-4 py-3 font-bold text-sm ${materialTotal > maxPerCourse ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  <span>총 신청 금액</span>
                  <span className="text-base font-black">{formatMaterialMoney(materialTotal)}</span>
                </div>
                {materialTotal > maxPerCourse && (
                  <div className="text-[11px] text-rose-600 font-bold bg-rose-50 rounded-xl px-3 py-2 border border-rose-100">
                    ⚠️ 강좌별 최대 신청 한도({formatMaterialMoney(maxPerCourse)})를 {formatMaterialMoney(materialTotal - maxPerCourse)} 초과합니다. 관리자가 반려할 수 있습니다.
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setMaterialModalCourse(null)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitMaterial}
                    disabled={isSubmittingMaterial || materialTotal === 0}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Package className="w-3.5 h-3.5" />
                    {isSubmittingMaterial ? '신청 중...' : '신청 제출'}
                  </button>
                </div>
              </div>
            )}

            {/* ─── 탭 2: 지출증빙서류 제출 ──────────────────────────────────────── */}
            {materialModalTab === 'expense_proof' && (
              <div className="space-y-5 text-xs text-slate-800">
                {/* 승인된 준비물 신청 연동 셀렉트 */}
                {(() => {
                  const approvedList = materialRequests.filter(r => r.courseId === materialModalCourse.id && r.status === 'APPROVED');
                  return (
                    <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 space-y-1.5">
                      <label className="font-bold text-indigo-900 block text-xs flex items-center gap-1">
                        <FileCheck className="w-4 h-4 text-indigo-600" />
                        승인된 준비물 신청 건 연동 (선택 시 폼 자동 채움)
                      </label>
                      <select
                        value={selectedRequestIdForProof}
                        onChange={(e) => handleSelectApprovedRequestForProof(e.target.value)}
                        className="w-full border border-indigo-200 rounded-lg p-2 text-xs bg-white font-medium cursor-pointer"
                      >
                        <option value="">-- 승인된 신청 건 선택 (직접 입력 가능) --</option>
                        {approvedList.map((r) => (
                          <option key={r.id} value={r.id}>
                            [{r.submittedAt.slice(0, 10)}] {r.items.map(i => i.name).join(', ')} ({formatMaterialMoney(r.totalAmount)})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}

                {/* 서식 1 섹션: 영수증 증빙 정보 */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                  <h4 className="font-extrabold text-slate-900 text-xs flex items-center justify-between border-b pb-2">
                    <span>📑 서식 1: 영수증 등 지출 증빙서</span>
                    <span className="text-[10px] text-slate-400 font-normal">카드 및 계좌 정보</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">카드 종류</label>
                      <select
                        value={proofCardType}
                        onChange={(e) => setProofCardType(e.target.value as any)}
                        className="w-full border border-slate-200 rounded-lg p-2 bg-white text-xs font-semibold"
                      >
                        <option value="PERSONAL">개인카드 (현금 등)</option>
                        <option value="SCHOOL">학교카드</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">카드 명의자(입금자)</label>
                      <input
                        type="text"
                        value={proofCardOwnerName}
                        onChange={(e) => setProofCardOwnerName(e.target.value)}
                        placeholder="예: 홍길동"
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">은행명 및 계좌번호</label>
                      <input
                        type="text"
                        value={proofBankInfo}
                        onChange={(e) => setProofBankInfo(e.target.value)}
                        placeholder="예: 신한 000-0000-0000"
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">예금주명 (반드시 영문)</label>
                      <input
                        type="text"
                        value={proofAccountHolderEng}
                        onChange={(e) => setProofAccountHolderEng(e.target.value)}
                        placeholder="예: HONG GIL DONG"
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">총 지출 사용액</label>
                      <input
                        type="number"
                        value={proofSpentAmount}
                        onChange={(e) => setProofSpentAmount(parseFloat(e.target.value) || 0)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white font-bold text-right"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>영수증 첨부 <span className="text-rose-600 font-extrabold text-[11px]">*필수</span></span>
                        {proofReceiptImageUrl && <span className="text-emerald-600 font-bold text-[10px]">✓ 첨부완료</span>}
                      </label>
                      
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  if (ev.target?.result) setProofReceiptImageUrl(ev.target.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                            id="receipt-file-input"
                          />
                          <label
                            htmlFor="receipt-file-input"
                            className="cursor-pointer px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 shrink-0 transition"
                          >
                            <Upload className="w-3.5 h-3.5" /> 영수증 파일 선택
                          </label>

                          <button
                            type="button"
                            onClick={() => setProofReceiptImageUrl('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60')}
                            className="shrink-0 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold px-2 py-1.5 rounded-lg"
                          >
                            샘플영수증
                          </button>
                        </div>

                        {proofReceiptImageUrl ? (
                          <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-slate-200">
                            <img src={proofReceiptImageUrl} alt="영수증 미리보기" className="w-10 h-10 object-cover rounded border" />
                            <span className="text-[10px] text-slate-500 truncate flex-1">영수증 이미지 첨부됨</span>
                            <button
                              type="button"
                              onClick={() => setProofReceiptImageUrl('')}
                              className="text-rose-500 hover:text-rose-700 font-bold text-xs px-1.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-[10px] text-rose-500 font-medium">
                            ⚠️ 영수증 사진을 선택해서 꼭 업로드해주세요.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 서식 2 섹션: 물품 검수 조서 */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                  <h4 className="font-extrabold text-slate-900 text-xs border-b pb-2">
                    📋 서식 2: 물품 검수 조서
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">1. 사업명</label>
                      <input
                        type="text"
                        value={proofBusinessName}
                        onChange={(e) => setProofBusinessName(e.target.value)}
                        placeholder="예: 과학실 물리 실험 세트 구매"
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">2. 납품처</label>
                      <input
                        type="text"
                        value={proofSupplierName}
                        onChange={(e) => setProofSupplierName(e.target.value)}
                        placeholder="예: (주) 한국과학"
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">3. 납품일자</label>
                      <input
                        type="date"
                        value={proofDeliveryDate}
                        onChange={(e) => setProofDeliveryDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">4. 검수일자</label>
                      <input
                        type="date"
                        value={proofInspectionDate}
                        onChange={(e) => setProofInspectionDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
                      />
                    </div>
                  </div>

                  {/* 검수 내역 테이블 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-slate-700">검수 내역 목록 ({proofItems.length}건)</label>
                      <span className="text-[11px] font-bold text-indigo-700">
                        검수 내역 합계: {(proofItems.reduce((s, i) => s + (i.amount || 0), 0)).toLocaleString()}원
                      </span>
                    </div>

                    <div className="grid grid-cols-12 gap-1 text-[10px] font-bold text-slate-500 px-1">
                      <span className="col-span-3">품명</span>
                      <span className="col-span-3">모델명</span>
                      <span className="col-span-1 text-center">단위</span>
                      <span className="col-span-2 text-right">검수수량</span>
                      <span className="col-span-2 text-right">금액</span>
                      <span className="col-span-1 text-center">삭제</span>
                    </div>

                    <div className="space-y-1.5">
                      {proofItems.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-1 items-center bg-white p-2 rounded-lg border border-slate-200 text-xs">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => {
                              const v = e.target.value;
                              setProofItems(prev => {
                                const next = prev.map((pi, i) => i === idx ? { ...pi, name: v } : pi);
                                setProofSpentAmount(next.reduce((s, pi) => s + (pi.amount || 0), 0));
                                return next;
                              });
                            }}
                            placeholder="품명 (예: 실험 세트)"
                            className="col-span-3 border border-slate-200 p-1.5 rounded text-xs focus:ring-1 focus:ring-indigo-400 outline-none"
                          />
                          <input
                            type="text"
                            value={item.modelName}
                            onChange={(e) => {
                              const v = e.target.value;
                              setProofItems(prev => prev.map((pi, i) => i === idx ? { ...pi, modelName: v } : pi));
                            }}
                            placeholder="모델명"
                            className="col-span-3 border border-slate-200 p-1.5 rounded text-xs focus:ring-1 focus:ring-indigo-400 outline-none"
                          />
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => {
                              const v = e.target.value;
                              setProofItems(prev => prev.map((pi, i) => i === idx ? { ...pi, unit: v } : pi));
                            }}
                            placeholder="단위"
                            className="col-span-1 border border-slate-200 p-1.5 rounded text-center text-xs focus:ring-1 focus:ring-indigo-400 outline-none"
                          />
                          <input
                            type="number"
                            value={item.inspectedQty}
                            onChange={(e) => {
                              const v = parseInt(e.target.value) || 0;
                              setProofItems(prev => prev.map((pi, i) => i === idx ? { ...pi, contractQty: v, inspectedQty: v } : pi));
                            }}
                            placeholder="수량"
                            className="col-span-2 border border-slate-200 p-1.5 rounded text-right text-xs focus:ring-1 focus:ring-indigo-400 outline-none"
                          />
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              setProofItems(prev => {
                                const next = prev.map((pi, i) => i === idx ? { ...pi, amount: v } : pi);
                                setProofSpentAmount(next.reduce((s, pi) => s + (pi.amount || 0), 0));
                                return next;
                              });
                            }}
                            placeholder="금액"
                            className="col-span-2 border border-slate-200 p-1.5 rounded text-right font-bold text-xs focus:ring-1 focus:ring-indigo-400 outline-none"
                          />
                          <div className="col-span-1 flex items-center justify-center">
                            {proofItems.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setProofItems(prev => {
                                    const next = prev.filter((_, i) => i !== idx);
                                    setProofSpentAmount(next.reduce((s, pi) => s + (pi.amount || 0), 0));
                                    return next;
                                  });
                                }}
                                className="text-rose-400 hover:text-rose-600 transition p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setProofItems(prev => [
                          ...prev,
                          { name: '', modelName: '표준형', unit: 'SET', contractQty: 1, inspectedQty: 1, amount: 0 }
                        ]);
                      }}
                      className="w-full border border-dashed border-indigo-300 text-indigo-600 font-bold text-xs py-2 rounded-lg hover:bg-indigo-50 transition flex items-center justify-center gap-1.5 mt-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> 검수 품목 추가
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">검수자 (교사)</label>
                      <input
                        type="text"
                        value={proofInspectorName}
                        onChange={(e) => setProofInspectorName(e.target.value)}
                        placeholder="예: 홍길동 교사"
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">입회자 (교감/부장)</label>
                      <input
                        type="text"
                        value={proofWitnessName}
                        onChange={(e) => setProofWitnessName(e.target.value)}
                        placeholder="예: 배경희 교감"
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 서식 3 섹션: 검수 사진 */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                      <span>📷 서식 3: 검수 사진 (#검수사진)</span>
                      <span className="text-slate-400 font-normal text-[10px]">(선택 입력사항)</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setProofPhotos([
                        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60',
                        'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=60',
                        'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=500&auto=format&fit=crop&q=60',
                        'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=500&auto=format&fit=crop&q=60'
                      ])}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold"
                    >
                      + 샘플 검수사진 4장 채우기
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1, 2, 3].map((pIdx) => (
                      <div key={pIdx} className="bg-white p-2 rounded-lg border border-slate-200 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-bold text-slate-600">검수 사진 {pIdx + 1}</label>
                          {proofPhotos[pIdx] && (
                            <button
                              type="button"
                              onClick={() => setProofPhotos(prev => prev.map((img, i) => i === pIdx ? '' : img))}
                              className="text-rose-500 text-[10px] font-bold"
                            >
                              삭제
                            </button>
                          )}
                        </div>

                        {proofPhotos[pIdx] ? (
                          <div className="aspect-4/3 w-full rounded border overflow-hidden relative group">
                            <img src={proofPhotos[pIdx]} alt={`사진 ${pIdx + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="aspect-4/3 w-full border-2 border-dashed border-slate-200 rounded flex flex-col items-center justify-center bg-slate-50 gap-1 p-2">
                            <ImageIcon className="w-5 h-5 text-slate-300" />
                            <span className="text-[10px] text-slate-400 font-medium">사진 없음 (선택)</span>
                          </div>
                        )}

                        <div className="flex gap-1 pt-0.5">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  if (ev.target?.result) {
                                    setProofPhotos(prev => {
                                      const next = [...prev];
                                      next[pIdx] = ev.target!.result as string;
                                      return next;
                                    });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                            id={`photo-file-input-${pIdx}`}
                          />
                          <label
                            htmlFor={`photo-file-input-${pIdx}`}
                            className="w-full text-center cursor-pointer py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded transition flex items-center justify-center gap-1"
                          >
                            <Upload className="w-3 h-3" /> 파일 선택
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 하단 버튼 그룹 */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setPreviewProofModalData(currentProofDraftObject())}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4 text-emerald-400" />
                    양식 인쇄 미리보기 (Print)
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMaterialModalCourse(null)}
                      className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitProof}
                      disabled={isSubmittingProof}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      {isSubmittingProof ? '제출 중...' : '지출증빙 제출하기'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* A4 인쇄 미리보기 모달 */}
      {previewProofModalData && (
        <PrintExpenseProofModal
          proof={previewProofModalData}
          onClose={() => setPreviewProofModalData(null)}
          currency={materialCurrency}
        />
      )}

      {/* ─── 제출 독촉 알림 팝업 모달 ─────────────────────────────────────────────── */}
      {activeReminderModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-rose-200 p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-rose-100 pb-3">
              <div className="p-3 bg-rose-100 rounded-2xl text-rose-600">
                <Bell className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="font-extrabold text-rose-900 text-base">🚨 서류 제출 독촉 알림</h3>
                <p className="text-[11px] text-slate-500">{activeReminderModal.createdAt}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-900 space-y-1">
                <div><b>강좌명:</b> {activeReminderModal.courseTitle}</div>
                <div className="font-medium text-rose-800">
                  {activeReminderModal.message}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">미제출 서류 목록:</label>
                <div className="flex flex-wrap gap-1.5">
                  {activeReminderModal.missingDocs.map((docName, idx) => (
                    <span key={idx} className="bg-rose-100 text-rose-800 font-extrabold text-xs px-2.5 py-1 rounded-lg border border-rose-300 flex items-center gap-1">
                      <Square className="w-3.5 h-3.5 text-rose-600" />
                      {docName}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={async () => {
                  await markReminderAsRead(activeReminderModal.id);
                  setActiveReminderModal(null);
                }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                확인했습니다 (닫기)
              </button>
              <button
                type="button"
                onClick={async () => {
                  await markReminderAsRead(activeReminderModal.id);
                  const matchedCourse = courses.find(c => c.id === activeReminderModal.courseId);
                  if (matchedCourse) {
                    setMaterialModalCourse(matchedCourse);
                    if (activeReminderModal.missingDocs.includes('준비물 지출증빙')) {
                      setMaterialModalTab('expense_proof');
                    } else {
                      setMaterialModalTab('request');
                    }
                  }
                  setActiveReminderModal(null);
                }}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                바로 제출하러 가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 보조 강사 배정 및 관리 모달 (선생님 페이지 전용) ─── */}
      {assistantModalCourse && (() => {
        const c = assistantModalCourse;
        const requiredCount = getRequiredTeachersCount(c.currentStudents || 0);
        const enrolledStudents = c.currentStudents || 0;
        const leadTeacher = c.instructorName || currentUserName || '주강사';
        
        // 검색 필터링된 교원 목록
        const matchedTeachers = assistantSearchQuery.trim()
          ? schoolTeachers.filter(t => 
              (t.name && t.name.includes(assistantSearchQuery.trim())) ||
              (t.dept && t.dept.includes(assistantSearchQuery.trim()))
            )
          : schoolTeachers.slice(0, 15);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-center justify-center p-3 md:p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col my-auto max-h-[90vh]">
              {/* Header */}
              <div className="bg-slate-900 px-6 py-4.5 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      [{c.title}] 보조 강사 배정
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      수강인원에 따라 보조강사를 지정하고 수업을 공동 관리합니다.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAssistantModalCourse(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 md:p-6 space-y-5 overflow-y-auto flex-1">
                {/* 동적 필요 강사 안내 카드 */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-100 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-indigo-600" />
                      실시간 필요 강사 기준
                    </span>
                    <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                      총 {requiredCount}명 필요 (주강사 1명 + 보조 {Math.max(0, requiredCount - 1)}명)
                    </span>
                  </div>
                  <div className="text-[11px] text-indigo-800 leading-relaxed font-sans">
                    현재 수강 학생: <b>{enrolledStudents}명</b> (정원 {c.maxStudents}명)
                    <br />
                    <span className="text-indigo-600 font-medium">※ 학생 20명 이상 시 1명, 이후 5명 증가 시 1명씩 보조강사가 추가 필요합니다.</span>
                  </div>
                </div>

                {/* 현재 배정 강사 현황 */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    현재 배정된 강사 구성 (주강사 1명 + 보조 {assistantDraftList.length}명)
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl min-h-[50px] items-center">
                    {/* 주강사 배지 */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-xs">
                      <span>👑 주강사: {leadTeacher}</span>
                    </div>

                    {/* 보조강사 배지들 */}
                    {assistantDraftList.map((name, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs animate-in zoom-in-90 duration-150 shadow-2xs"
                      >
                        <span>보조 {idx + 1}: {name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAssistantFromDraft(name)}
                          className="text-emerald-700 hover:text-rose-600 hover:bg-emerald-100 p-0.5 rounded-full transition cursor-pointer"
                          title="배정 해제"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {assistantDraftList.length === 0 && (
                      <span className="text-xs text-slate-400 font-medium">
                        (아직 배정된 보조 강사가 없습니다. 아래에서 교원을 선택하거나 이름을 입력해 추가하세요.)
                      </span>
                    )}
                  </div>
                </div>

                {/* 보조 강사 추가 섹션 */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-800 block">
                    보조 강사 추가하기
                  </label>

                  {/* 1. 직접 이름 입력 추가 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={assistantCustomName}
                      onChange={(e) => setAssistantCustomName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (assistantCustomName.trim()) {
                            handleAddAssistantToDraft(assistantCustomName.trim());
                          }
                        }
                      }}
                      placeholder="강사명 직접 입력 (예: 홍길동)"
                      className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (assistantCustomName.trim()) {
                          handleAddAssistantToDraft(assistantCustomName.trim());
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shrink-0 flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      추가
                    </button>
                  </div>

                  {/* 2. 원내 교원 빠른 선택 */}
                  {schoolTeachers && schoolTeachers.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600">
                          원내 교원 목록에서 빠른 배정
                        </span>
                        <div className="relative w-40">
                          <input
                            type="text"
                            value={assistantSearchQuery}
                            onChange={(e) => setAssistantSearchQuery(e.target.value)}
                            placeholder="교원 검색..."
                            className="w-full pl-7 pr-2 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                          />
                          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                        {matchedTeachers.map((t, i) => {
                          const tName = t.name || '';
                          const isLead = tName === leadTeacher;
                          const isAlreadyAdded = assistantDraftList.includes(tName);
                          return (
                            <button
                              key={i}
                              type="button"
                              disabled={isLead || isAlreadyAdded}
                              onClick={() => handleAddAssistantToDraft(tName)}
                              className={`p-2 rounded-lg text-left text-xs transition border flex items-center justify-between ${
                                isLead
                                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                  : isAlreadyAdded
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-not-allowed font-bold'
                                  : 'bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 border-slate-200 cursor-pointer'
                              }`}
                            >
                              <div className="truncate">
                                <div className="font-bold truncate">{tName}</div>
                                <div className="text-[10px] text-slate-400 truncate">{t.dept || '교사'}</div>
                              </div>
                              {isAlreadyAdded ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : !isLead && (
                                <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setAssistantModalCourse(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssistants}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  저장 및 배정 적용
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

