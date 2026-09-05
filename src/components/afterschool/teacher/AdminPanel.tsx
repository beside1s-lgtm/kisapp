import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Course, Classroom, SubmittedApprovalDoc, SessionPeriod, Enrollment, Student, MaterialRequest, ExpenseProof, SubmissionReminder, AttendanceRecord, SubstituteRecord } from '@/lib/afterschool/types';
import {
  X, Plus, Trash2, CheckCircle2, XCircle, Building2,
  ClipboardList, BookOpen, Send, Shield, FileText, Download, Upload, Clock, Edit3, Calendar, Settings, Save, Lock, Unlock, Pause, UserPlus, Filter, Activity, Play, ChevronUp, ChevronDown, DollarSign, Bell, Square, AlertCircle, Loader2, Printer, Eye, ExternalLink, Image as ImageIcon
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { downloadClassroomTemplateExcel, parseClassroomExcel, downloadCourseTemplateExcel, parseCourseExcel } from '@/lib/afterschool/excel';
import { defaultTeacherApplySettings, getTeacherApplySettings, onTeacherApplySettingsUpdate, saveTeacherApplySettings, updateAfterschoolCourse, deleteAfterschoolCourse, saveAfterschoolCoursesBatch, addAfterschoolClassroom, deleteAfterschoolClassroom, saveAfterschoolClassroomsBatch, onMaterialRequestsUpdate, onExpenseProofsUpdate, sendSubmissionReminder, purgeAfterschoolOperationalData, onAttendanceRecordsUpdate, onSubstituteRecordsUpdate, saveSubstituteRecord, deleteSubstituteRecord, onDocConfigUpdate, deleteAfterschoolApprovalDoc } from '@/lib/services/settingsService';
import { countOperatingDays, getCourseSessionsPerClass, generateCalendarSchedule, generateCalendarScheduleByDateRange, ScheduleDay, extractHolidayDatesFromEvents } from '@/lib/afterschool/schedule';
import { DEFAULT_ACADEMIC_CALENDAR_CONFIG } from '@/lib/services/academicCalendarService';
import type { DocConfig, UserProfile } from '@/lib/types';
import { getUsersDirectory } from '@/lib/services/userService';
import { StudentManagement } from './StudentManagement';
import { OfficialSeal } from './AttendanceManagement';
import { SignatureRegisterModal } from './SignatureRegisterModal';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/hooks/use-translation';

interface AdminPanelProps {
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  classrooms: Classroom[];
  setClassrooms: React.Dispatch<React.SetStateAction<Classroom[]>>;
  approvalDocs: SubmittedApprovalDoc[];
  setApprovalDocs: React.Dispatch<React.SetStateAction<SubmittedApprovalDoc[]>>;
  tuitionPerSession: number;
  setTuitionPerSession: (val: number) => void;
  periods?: SessionPeriod[];
  setPeriods?: React.Dispatch<React.SetStateAction<SessionPeriod[]>>;
  enrollments: Enrollment[];
  setEnrollments: React.Dispatch<React.SetStateAction<Enrollment[]>>;
  studentsList: Student[];
  destinations?: any[];
  routes?: any[];
  buses?: any[];
  onClose: () => void;
  timerConfig?: any;
}

type AdminTab = 'courses' | 'batchCreate' | 'students' | 'classrooms' | 'approval';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  courses,
  setCourses,
  classrooms,
  setClassrooms,
  approvalDocs,
  setApprovalDocs,
  tuitionPerSession,
  setTuitionPerSession,
  periods = [],
  setPeriods = () => {},
  enrollments,
  setEnrollments,
  studentsList,
  destinations = [],
  routes = [],
  buses = [],
  onClose,
  timerConfig,
}) => {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<AdminTab>('courses');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');

  const [teacherApplySettings, setTeacherApplySettings] = useState<typeof defaultTeacherApplySettings>(defaultTeacherApplySettings);
  const [docConfig, setDocConfig] = useState<Partial<DocConfig>>({});
  const [isStageControlFolded, setIsStageControlFolded] = useState<boolean>(false);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [expenseProofs, setExpenseProofs] = useState<ExpenseProof[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [substituteRecords, setSubstituteRecords] = useState<SubstituteRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [sigModalTarget, setSigModalTarget] = useState<{ teacherName: string; teacherEmail?: string; courseId?: string } | null>(null);

  useEffect(() => {
    getUsersDirectory().then(users => setAllUsers(users)).catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = onDocConfigUpdate((cfg) => {
      if (cfg) setDocConfig(cfg);
    });
    return () => unsub();
  }, []);

  const holidayDates = React.useMemo(() => {
    return extractHolidayDatesFromEvents(docConfig?.academicCalendar?.events || DEFAULT_ACADEMIC_CALENDAR_CONFIG.events || []);
  }, [docConfig]);

  // 서류 검토 팝업 모달 상태
  const [viewingDocCourse, setViewingDocCourse] = useState<Course | null>(null);
  const [viewingDocType, setViewingDocType] = useState<'ATTENDANCE' | 'WORK_REGISTER' | 'EXPENSE_PROOF' | null>(null);

  // 관리자 보결 등록 모달 상태
  const [isSubModalOpen, setIsSubModalOpen] = useState<boolean>(false);
  const [subTargetDay, setSubTargetDay] = useState<ScheduleDay | null>(null);
  const [subTeacherName, setSubTeacherName] = useState<string>('');
  const [subReason, setSubReason] = useState<string>('');
  const [subRecordType, setSubRecordType] = useState<'SUBSTITUTE' | 'ABSENCE'>('SUBSTITUTE');
  const [subTargetInstructor, setSubTargetInstructor] = useState<string>('');

  const handleOpenSubstituteModal = (day: ScheduleDay, course: Course, targetInst?: string) => {
    setSubTargetDay(day);
    const instructors = [
      course.instructorName,
      course.instructor2,
      course.instructor3,
      course.instructor4,
      ...(course.assistantTeachers || [])
    ].filter(Boolean) as string[];

    const defaultInst = targetInst || instructors[0] || course.instructorName || '';
    setSubTargetInstructor(defaultInst);

    const existing = substituteRecords.find(
      (s) => s.courseId === course.id && s.dayIndex === day.dayIndex && (!s.targetInstructor || s.targetInstructor === defaultInst)
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
    if (!subTargetDay || !viewingDocCourse) return;
    if (subRecordType === 'SUBSTITUTE' && !subTeacherName.trim()) {
      alert('보결 강사 성명을 입력해 주세요.');
      return;
    }
    const isAbs = subRecordType === 'ABSENCE';
    const subRecord: SubstituteRecord = {
      id: `sub_${viewingDocCourse.id}_d${subTargetDay.dayIndex}_${(subTargetInstructor || 'lead').replace(/\s+/g, '')}`,
      courseId: viewingDocCourse.id,
      courseTitle: viewingDocCourse.title,
      dayIndex: subTargetDay.dayIndex,
      dateStr: subTargetDay.dateStr,
      sessionNos: subTargetDay.sessionNos,
      sessionCount: subTargetDay.sessionNos.length,
      originalInstructor: subTargetInstructor || viewingDocCourse.instructorName || '원강사',
      targetInstructor: subTargetInstructor || viewingDocCourse.instructorName || '원강사',
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

  useEffect(() => {
    getTeacherApplySettings().then(setTeacherApplySettings);
    const unsubSettings = onTeacherApplySettingsUpdate((settings) => {
      setTeacherApplySettings(settings);
    });
    const unsubReq = onMaterialRequestsUpdate((list) => setMaterialRequests(list));
    const unsubProof = onExpenseProofsUpdate((list) => setExpenseProofs(list));
    const unsubAtt = onAttendanceRecordsUpdate((list) => setAttendanceRecords(list));
    const unsubSubs = onSubstituteRecordsUpdate((list) => setSubstituteRecords(list));
    return () => {
      unsubSettings();
      unsubReq();
      unsubProof();
      unsubAtt();
      unsubSubs();
    };
  }, []);

  const handleUpdateStageStatus = async (status: 'RECRUITING' | 'APPLYING' | 'CONFIRMED' | 'OPERATING' | 'CLOSED') => {
    if (!teacherApplySettings) return;

    const isVacationSem = teacherApplySettings.semester === '여름방학' || teacherApplySettings.semester === '겨울방학';

    if (status === 'CONFIRMED') {
      const confirmResult = window.confirm(
        '수강신청 결과를 최종 확정하고 학부모 팝업 전송 및 스쿨버스 연동을 진행하시겠습니까?\n\n' +
        '• 수강 명단(ENROLLED) 및 대기 명단(WAITING)이 최종 확정됩니다.\n' +
        (isVacationSem
          ? '• [방학 중]: 버스 신청 학생이 [방학 중 등/하교 버스 미배정 명단]으로 자동 전송됩니다.\n'
          : '• [학기 중]: 버스 신청 학생이 [방과후 하교 버스] 명단에 2중 배정되어 스쿨버스 관리자가 사전 좌석 배정을 진행할 수 있습니다.\n  (※ 방과후 시작 전까지 기존 정규 하교 버스 좌석은 그대로 유지되며, 스쿨버스 관리자가 [방과후 노선으로 이동] 버튼을 누르면 정규 하교 좌석에서 자동 제외됩니다.)\n') +
        '• 학부모 서비스 접속 시 수강신청 확정 결과 팝업 알림이 전송됩니다.'
      );
      if (!confirmResult) return;
    }
    if (status === 'CLOSED') {
      const confirmClose = window.confirm(
        '방과후학교 학기 운영을 최종 마감(종료)하시겠습니까?\n\n' +
        '• 진행 상태가 [방과후학교 운영 종료]로 변경됩니다.\n' +
        '• 방과후 버스를 탑승하던 학생들이 원래의 정규 하교 버스로 100% 자동 복구됩니다.\n' +
        '• 출석부, 지출증빙서류 등 실시간 운영 데이터가 깔끔하게 정리 초기화됩니다.'
      );
      if (!confirmClose) return;
      await purgeAfterschoolOperationalData();
    }

    const isFinalized = status === 'CONFIRMED' || status === 'OPERATING' || status === 'CLOSED';
    const updated = { 
      ...teacherApplySettings, 
      afterschoolStageStatus: status,
      isAfterschoolFinalized: isFinalized,
      afterschoolFinalizedAt: status === 'CONFIRMED' ? new Date().toISOString() : teacherApplySettings?.afterschoolFinalizedAt
    };
    setTeacherApplySettings(updated as any);
    await saveTeacherApplySettings({ 
      afterschoolStageStatus: status,
      isAfterschoolFinalized: isFinalized,
      afterschoolFinalizedAt: status === 'CONFIRMED' ? new Date().toISOString() : teacherApplySettings?.afterschoolFinalizedAt
    });

    let busSyncMessage = '';
    if (status === 'CONFIRMED' || status === 'CLOSED') {
      try {
        const { syncAfterschoolBusAssignmentsOnStageChange } = await import('@/lib/kisbus/assignments');
        const busRes = await syncAfterschoolBusAssignmentsOnStageChange(status, teacherApplySettings.semester || '1학기');
        if (busRes.message) {
          busSyncMessage = `\n\n${busRes.message}`;
        }
      } catch (busErr) {
        console.error('Bus sync error:', busErr);
      }
    }

    const labelMap = {
      RECRUITING: '강사 모집 중',
      APPLYING: '수강 신청 중',
      CONFIRMED: '수강신청 완료 (결과 확정 & 버스 연동)',
      OPERATING: '방과후학교 운영 중 (출석부 활성화)',
      CLOSED: '운영 종료 (하교 버스 원상 복구)',
    };
    alert(`방과후학교 진행 상태가 [${labelMap[status]}]로 성공적으로 변경되었습니다.${busSyncMessage}`);
  };

  const getDetailedStatusText = () => {
    if (!teacherApplySettings) return '방과후학교 시스템 정보 확인 중';
    const y = teacherApplySettings.year || '2026';
    const sem = teacherApplySettings.semester || '1학기';
    const programName = sem.includes('학기') ? `${y}학년도 제${sem} 방과후학교` : `${y}학년도 ${sem} 방과후학교`;

    const stageStatus = (teacherApplySettings as any).afterschoolStageStatus;
    if (stageStatus === 'RECRUITING') return `${programName} 강사 모집 중`;
    if (stageStatus === 'APPLYING') return `${programName} 수강 신청 중`;
    if (stageStatus === 'CONFIRMED') return `${programName} 수강신청 완료 (학부모 결과 확정 통보)`;
    if (stageStatus === 'OPERATING') return `${programName} 운영 중 (출석부 활성화)`;
    if (stageStatus === 'CLOSED') return `${programName} 운영 종료`;

    return `${programName} 운영 중`;
  };

  // 일괄 개설을 위한 상태
  const [batchTemplate, setBatchTemplate] = useState<'hangul' | 'history' | 'custom' | 'excel'>('hangul');
  const [batchBaseTitle, setBatchBaseTitle] = useState('한글반');
  const [batchStartGrade, setBatchStartGrade] = useState<number>(0);
  const [batchEndGrade, setBatchEndGrade] = useState<number>(10);
  const [batchDefaultTuition, setBatchDefaultTuition] = useState<number>(150000);
  const [batchDefaultMaxStudents, setBatchDefaultMaxStudents] = useState<number>(20);
  const [batchDefaultClassroomId, setBatchDefaultClassroomId] = useState<string>(classrooms[0]?.id || '');
  const [batchDefaultClassDays, setBatchDefaultClassDays] = useState<string[]>(['토']);
  const [batchPreviewCourses, setBatchPreviewCourses] = useState<any[]>([]);
  const [isSavingBatch, setIsSavingBatch] = useState<boolean>(false);
  const [isExcelUploading, setIsExcelUploading] = useState<boolean>(false);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExcelUploading(true);
    try {
      const parsed = await parseCourseExcel(file);

      // 교실명 퍼지 매칭 헬퍼: 숫자/반/교실/공백/특수문자 제거 후 비교
      const normalizeRoom = (s: string) =>
        s.replace(/[\s반교실]/g, '').replace(/[^0-9가-힣a-zA-Z]/g, '').toLowerCase();

      const newClassrooms: typeof classrooms = [];

      const mapped = parsed.map(c => {
        const rawName = (c.classroom || '').trim();
        if (!rawName) return { ...c, classroom: '', classroomId: '' };

        const normRaw = normalizeRoom(rawName);

        // 1단계: 완전 일치 (공백 무시)
        let room = classrooms.find(r =>
          r.name.replace(/\s+/g, '').toLowerCase() === rawName.replace(/\s+/g, '').toLowerCase()
        );

        // 2단계: 퍼지 매칭 (숫자/반/교실 키워드 제거 후 비교)
        if (!room) {
          room = [...classrooms, ...newClassrooms].find(r => normalizeRoom(r.name) === normRaw);
        }

        // 3단계: 숫자만 추출 비교 (예: '2-3' ↔ '2-3반 교실' 모두 '23'으로 정규화)
        if (!room) {
          const numRaw = normRaw.replace(/[^0-9]/g, '');
          if (numRaw) {
            room = [...classrooms, ...newClassrooms].find(r => {
              const numR = normalizeRoom(r.name).replace(/[^0-9]/g, '');
              return numR === numRaw;
            });
          }
        }

        // 4단계: 없으면 새 교실로 자동 추가
        if (!room) {
          const existingNew = newClassrooms.find(r => r.name === rawName);
          if (!existingNew) {
            const newRoom = {
              id: `rm_auto_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              name: rawName,
              capacity: 30,
              maxSimultaneousCourses: 1,
            };
            newClassrooms.push(newRoom);
            room = newRoom;
          } else {
            room = existingNew;
          }
        }

        return {
          ...c,
          classroom: room.name,
          classroomId: room.id,
        };
      });

      // 신규 교실이 있으면 교실 목록에 추가 및 Firestore 영구 저장
      if (newClassrooms.length > 0) {
        setClassrooms(prev => [...prev, ...newClassrooms]);
        saveAfterschoolClassroomsBatch(newClassrooms).catch(err => {
          console.warn("[AdminPanel] Failed to persist new batch classrooms:", err);
        });
      }

      setBatchTemplate('excel');
      setBatchPreviewCourses(mapped);
      const newRoomMsg = newClassrooms.length > 0
        ? ` (교실 관리에 없는 교실 ${newClassrooms.length}개가 자동 등록되었습니다: ${newClassrooms.map(r => r.name).join(', ')})`
        : '';
      alert(`엑셀 파일에서 ${mapped.length}개의 강좌 데이터를 로드했습니다!${newRoomMsg} 우측의 편집 목록에서 최종 검토 후 아래의 '일괄 개설 실행' 버튼을 눌러 개설해 주세요.`);
    } catch (err: any) {
      alert(`엑셀 파일 파싱 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsExcelUploading(false);
      e.target.value = '';
    }
  };

  // 일괄 개설 전체 선택 / 해제
  const handleToggleAllPreviewCourses = (checked: boolean) => {
    setBatchPreviewCourses((prev) => prev.map((c) => ({ ...c, checked })));
  };

  // 개설 예정 강좌 개별 삭제
  const handleDeletePreviewCourse = (id: string) => {
    setBatchPreviewCourses((prev) => prev.filter((c) => c.id !== id));
  };

  // 선택 항목 목록에서 제거
  const handleDeleteSelectedPreviewCourses = () => {
    const selectedCount = batchPreviewCourses.filter((c) => c.checked).length;
    if (selectedCount === 0) {
      alert('삭제할 선택 항목이 없습니다.');
      return;
    }
    setBatchPreviewCourses((prev) => prev.filter((c) => !c.checked));
  };

  // 목록 전체 비우기
  const handleClearPreviewCourses = () => {
    if (batchPreviewCourses.length === 0) return;
    if (!window.confirm('개설 예정 목록을 모두 비우시겠습니까?')) return;
    setBatchPreviewCourses([]);
  };

  const handleBatchCreateSubmit = async () => {
    const selectedCourses = batchPreviewCourses.filter(c => c.checked);
    if (selectedCourses.length === 0) {
      alert('일괄 개설 대상으로 선택된 강좌가 없습니다.');
      return;
    }

    if (!window.confirm(`선택한 ${selectedCourses.length}개 강좌를 마스터 권한으로 즉시 일괄 개설하시겠습니까?`)) {
      return;
    }

    setIsSavingBatch(true);
    let applySettings: any = null;
    try {
      applySettings = await getTeacherApplySettings();
    } catch (err) {
      console.warn("Failed to fetch teacher apply settings, using fallbacks:", err);
    }

    const currentYear = applySettings?.year || '2026';
    const currentSemester = applySettings?.semester || '1학기';
    const startDate = applySettings?.operatingStartDate || '2026-03-30';
    const endDate = applySettings?.operatingEndDate || '2026-06-20';
    const operatingPeriod = `${startDate} ~ ${endDate}`;

    const tuitionPerSessionMaster = applySettings?.tuitionPerSession ?? 0;
    const teacherFeeMaster = applySettings?.teacherFee ?? 0;
    const tuitionCurrencyMaster = applySettings?.tuitionCurrency || 'KRW';
    const teacherFeeCurrencyMaster = applySettings?.teacherFeeCurrency || 'KRW';
    const teacherFeeTypeMaster = applySettings?.teacherFeeType || '차시당';
    const tuitionTypeMaster = applySettings?.tuitionType || '수익자부담';

    const coursesToSave = selectedCourses.map(({ checked, ...rest }) => {
      // ─── [이슈 3] 전체 운영 기간 반영 수강료 계산식 고도화 ───
      // 공식: (개별 강좌 1회 당 차시 수) × (운영 기간 내 총 수업 일수) × (차시 당 수강료)
      const fallbackSessions = applySettings?.sessionsPerClass ?? 2;
      const sessionsPerClass = getCourseSessionsPerClass(rest, fallbackSessions); // 강좌별 차시 수(1~4차시 등 자동 감지)
      const courseDays = (rest.classDays && rest.classDays.length > 0) ? rest.classDays : (applySettings?.allowedDays || ['월']);
      const totalOperatingDays = countOperatingDays(startDate, endDate, courseDays, holidayDates); // 운영 기간 내 총 수업 일수 (휴업일 제외)
      const totalSessions = sessionsPerClass * totalOperatingDays; // 총 차시 수
      const sessionCount = totalSessions || 1;

      // 마스터 설정 기반 수강료 자동 계산 (무료 강좌이거나 학교예산인 경우 0원)
      const calculatedTuition = (rest.isFree || tuitionTypeMaster === '학교예산')
        ? 0
        : tuitionPerSessionMaster * sessionCount;

      // 마스터 설정 기반 강사료 자동 계산 (차시당 or 정액제)
      const calculatedTeacherFee = teacherFeeTypeMaster === '정액제'
        ? teacherFeeMaster
        : teacherFeeMaster * sessionCount;

      return {
        ...rest,
        id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        year: rest.year || currentYear,
        semester: rest.semester || currentSemester,
        period: rest.period || operatingPeriod,
        // 수강료: 엑셀에 직접 입력값이 있으면 우선, 없으면 운영기간 기반 자동 계산
        tuition: (rest.tuition !== undefined && rest.tuition > 0) ? rest.tuition : calculatedTuition,
        tuitionCurrency: tuitionCurrencyMaster,
        tuitionPerSession: tuitionPerSessionMaster,
        sessionsPerClass,
        totalOperatingDays,
        sessionCount,
        // 강사료 마스터 설정 저장
        teacherFeePerSession: teacherFeeMaster,
        teacherFeeTotal: calculatedTeacherFee,
        teacherFeeCurrency: teacherFeeCurrencyMaster,
        teacherFeeType: teacherFeeTypeMaster,
      };
    });

    const res = await saveAfterschoolCoursesBatch(coursesToSave);
    setIsSavingBatch(false);

    if (res.success) {
      alert(`${coursesToSave.length}개 강좌가 일괄 개설되었습니다!`);
      setCourses(prev => {
        const map = new Map<string, Course>();
        prev.forEach(c => map.set(c.id, c));
        coursesToSave.forEach(c => map.set(c.id, c));
        return Array.from(map.values()).sort((a, b) => (a.id || '').localeCompare(b.id || ''));
      });
      setTab('courses');
    } else {
      alert(`강좌 일괄 개설 중 오류가 발생했습니다: ${res.error}`);
    }
  };

  const [newClassroomName, setNewClassroomName] = useState('');
  const [newClassroomCap, setNewClassroomCap] = useState('30');
  const [newClassroomSimul, setNewClassroomSimul] = useState('1');
  const [isKisappSubmitting, setIsKisappSubmitting] = useState(false);
  const [isKisappDone, setIsKisappDone] = useState(false);
  // 화폐 단위는 마스터 설정에서 실시간 연동
  const currency = (teacherApplySettings?.tuitionCurrency || 'KRW') as 'KRW' | 'VND' | 'USD';
  const setCurrency = (_: any) => {}; // no-op (마스터 설정에서 제어)
  const [isPlanDrafted, setIsPlanDrafted] = useState(false);
  const [isPlanSubmitting, setIsPlanSubmitting] = useState(false);
  const [isResultDrafted, setIsResultDrafted] = useState(false);
  const [isResultSubmitting, setIsResultSubmitting] = useState(false);
  const [isBatchApplyingTuition, setIsBatchApplyingTuition] = useState(false);

  // ─── 수강료 일괄 자동 적용 핸들러 ───────────────────────────────────
  const handleBatchApplyTuition = async () => {
    const opStart = teacherApplySettings?.operatingStartDate || '';
    const opEnd = teacherApplySettings?.operatingEndDate || '';
    const sessionsPerClass = teacherApplySettings?.sessionsPerClass ?? 2;
    const tuitionPerSession = teacherApplySettings?.tuitionPerSession ?? 0;
    const tuitionType = teacherApplySettings?.tuitionType || '수익자부담';
    const allowedDays = teacherApplySettings?.allowedDays || ['월'];

    if (!opStart || !opEnd) {
      alert('마스터 설정에 운영 시작일~종료일이 설정되어 있어야 합니다.\n[강사 신청 제어] 탭에서 운영 기간을 먼저 설정해주세요.');
      return;
    }

    const targetCourses = courses.filter(c => c.status !== 'CANCELLED');
    if (targetCourses.length === 0) {
      alert('수강료를 적용할 강좌가 없습니다.');
      return;
    }

    const fallbackSessions = teacherApplySettings?.sessionsPerClass ?? 2;
    // 미리보기: 강좌별 감산된 수강료 표시
    const previewLines = targetCourses.slice(0, 5).map(c => {
      const courseDays = (c.classDays && c.classDays.length > 0) ? c.classDays : allowedDays;
      const totalDays = countOperatingDays(opStart, opEnd, courseDays, holidayDates);
      const courseSessions = getCourseSessionsPerClass(c, fallbackSessions);
      const totalSessions = courseSessions * totalDays;
      const newTuition = (c.isFree || tuitionType === '학교예산') ? 0 : tuitionPerSession * totalSessions;
      return `• ${c.title}: ${c.isFree ? '0원 (무료)' : newTuition.toLocaleString() + ' ' + currency} (${courseSessions}차시 × ${totalDays}일)`;
    });
    const moreText = targetCourses.length > 5 ? `\n... 외 ${targetCourses.length - 5}개` : '';

    if (!window.confirm(`모든 강좌(${targetCourses.length}개)의 수강료를 운영기간 기반으로 일괄 적용합니까?\n\n공식: (강좌별 차시/회) × 운영일수(휴업일 제외) × 차시당 ${tuitionPerSession.toLocaleString()}\n\n[미리보기 - 상위 5개]\n${previewLines.join('\n')}${moreText}`)) {
      return;
    }

    setIsBatchApplyingTuition(true);
    try {
      const updatedCourses = targetCourses.map(c => {
        const courseDays = (c.classDays && c.classDays.length > 0) ? c.classDays : allowedDays;
        const totalDays = countOperatingDays(opStart, opEnd, courseDays, holidayDates);
        const courseSessions = getCourseSessionsPerClass(c, fallbackSessions); // 개별 강좌 차시 수 판별 (예: 1~4차시 -> 4)
        const totalSessions = courseSessions * totalDays;
        const newTuition = (c.isFree || tuitionType === '학교예산') ? 0 : tuitionPerSession * totalSessions;
        return { ...c, tuition: newTuition, sessionsPerClass: courseSessions, totalOperatingDays: totalDays, sessionCount: totalSessions };
      });

      // Firestore 일괄 저장
      await saveAfterschoolCoursesBatch(updatedCourses);

      // 로컈 상태 업데이트
      setCourses(prev => prev.map(c => {
        const updated = updatedCourses.find(u => u.id === c.id);
        return updated || c;
      }));

      alert(`✅ ${updatedCourses.length}개 강좌의 수강료가 운영기간 기반 공식으로 일괄 적용되었습니다!`);
    } catch (e: any) {
      alert(`수강료 일괄 적용 실패: ${e.message}`);
    } finally {
      setIsBatchApplyingTuition(false);
    }
  };

  // 교시 관리용 입력 상태
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodStart, setNewPeriodStart] = useState('13:00');
  const [newPeriodEnd, setNewPeriodEnd] = useState('13:40');
  const [newPeriodType, setNewPeriodType] = useState<'SEMESTER' | 'VACATION'>('SEMESTER');

  const handleAddPeriod = () => {
    if (!newPeriodName.trim()) return;
    const newPeriod: SessionPeriod = {
      id: `p_${Date.now()}`,
      name: newPeriodName.trim(),
      startTime: newPeriodStart,
      endTime: newPeriodEnd,
      type: newPeriodType,
    };
    setPeriods((prev) => {
      const updated = [...prev, newPeriod];
      return updated.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    setNewPeriodName('');
  };

  const handleDeletePeriod = (id: string) => {
    if (!window.confirm('이 교시 설정을 삭제하시겠습니까? 강좌 개설 시 이 교시를 선택할 수 없게 됩니다.')) return;
    setPeriods((prev) => prev.filter((p) => p.id !== id));
  };

  const handleDeleteCourse = (courseId: string) => {
    if (!window.confirm('이 폐강 강좌를 영구 삭제하시겠습니까? 관련 데이터가 복구 불가능하게 제거됩니다.')) return;
    setCourses((prev) => prev.filter((c) => c.id !== courseId));
    deleteAfterschoolCourse(courseId).catch(e => {
      console.error("[AdminPanel] Failed to delete course from Firestore:", e);
    });
  };

  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const handleSaveCourseEdit = () => {
    if (!editingCourse) return;
    setCourses((prev) =>
      prev.map((c) => (c.id === editingCourse.id ? editingCourse : c))
    );
    updateAfterschoolCourse(editingCourse.id, editingCourse).catch(e => {
      console.error("[AdminPanel] Failed to save course edit in Firestore:", e);
    });
    setEditingCourse(null);
  };

  const pendingDocs = approvalDocs.filter((d) => d.status === 'PENDING');

  // 강좌 승인 (PENDING → OPEN)
  const handleApproveCourse = (courseId: string) => {
    setCourses((prev) => prev.map((c) => c.id === courseId ? { ...c, status: 'OPEN' } : c));
    updateAfterschoolCourse(courseId, { status: 'OPEN' }).catch(e => {
      console.error("[AdminPanel] Failed to approve course:", e);
    });
  };

  // 강좌 폐강 (→ CANCELLED)
  const handleCancelCourse = (courseId: string) => {
    if (!window.confirm('이 강좌를 폐강하시겠습니까?')) return;
    setCourses((prev) => prev.map((c) => c.id === courseId ? { ...c, status: 'CANCELLED' } : c));
    updateAfterschoolCourse(courseId, { status: 'CANCELLED' }).catch(e => {
      console.error("[AdminPanel] Failed to cancel course:", e);
    });
  };

  // 강좌 승인 취소 (OPEN → PENDING)
  const handleRevertToPending = (courseId: string) => {
    if (!window.confirm('이 강좌의 승인을 취소하고 개설신청(대기) 상태로 되돌리시겠습니까?')) return;
    setCourses((prev) => prev.map((c) => c.id === courseId ? { ...c, status: 'PENDING' } : c));
    updateAfterschoolCourse(courseId, { status: 'PENDING' }).catch(e => {
      console.error("[AdminPanel] Failed to revert course to pending:", e);
    });
  };

  // 폐강 강좌 복구 (CANCELLED → OPEN)
  const handleRestoreCourse = (courseId: string) => {
    if (!window.confirm('이 강좌를 다시 운영(승인) 상태로 복원하시겠습니까?')) return;
    setCourses((prev) => prev.map((c) => c.id === courseId ? { ...c, status: 'OPEN' } : c));
    updateAfterschoolCourse(courseId, { status: 'OPEN' }).catch(e => {
      console.error("[AdminPanel] Failed to restore course:", e);
    });
  };

  // 강좌 일괄 선택 및 필터 상태
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'OPEN' | 'CANCELLED'>('ALL');

  // 일괄 독촉 메세지 전송 상태
  const [isBatchReminderOpen, setIsBatchReminderOpen] = useState<boolean>(false);
  const [isBatchSending, setIsBatchSending] = useState<boolean>(false);
  type BatchReminderItem = { courseId: string; courseTitle: string; instructorName: string; missingDocs: string[]; };
  const [batchReminderItems, setBatchReminderItems] = useState<BatchReminderItem[]>([]);
  const [checkedReminderIds, setCheckedReminderIds] = useState<Set<string>>(new Set());

  const uniqueCourses = Array.from(new Map(courses.map(c => [c.id, c])).values());

  const filteredCourses = uniqueCourses.filter((c) => {
    if (statusFilter === 'ALL') return true;
    return c.status === statusFilter;
  });

  const handleToggleSelectAllCourses = () => {
    const visibleIds = filteredCourses.map((c) => c.id);
    const allVisibleSelected = visibleIds.every((id) => selectedCourseIds.includes(id));

    if (allVisibleSelected) {
      setSelectedCourseIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedCourseIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleToggleSelectCourse = (id: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]
    );
  };

  // 강좌 일괄 승인 (OPEN)
  const handleBatchApproveCourses = async () => {
    if (selectedCourseIds.length === 0) {
      alert('승인할 강좌를 선택해 주세요.');
      return;
    }
    const targetCourses = courses.filter((c) => selectedCourseIds.includes(c.id));
    if (!window.confirm(`선택한 ${targetCourses.length}개 강좌를 일괄 개설 승인(운영중) 처리하시겠습니까?`)) {
      return;
    }

    setCourses((prev) =>
      prev.map((c) => (selectedCourseIds.includes(c.id) ? { ...c, status: 'OPEN' } : c))
    );

    try {
      await Promise.all(selectedCourseIds.map((id) => updateAfterschoolCourse(id, { status: 'OPEN' })));
      alert(`선택한 ${targetCourses.length}개 강좌가 성공적으로 일괄 승인되었습니다.`);
    } catch (e) {
      console.error('[AdminPanel] Batch approve failed:', e);
      alert('일괄 승인 처리 중 일부 강좌 업데이트에 실패했습니다.');
    }
  };

  // 강좌 일괄 승인 취소 (PENDING)
  const handleBatchRevertCourses = async () => {
    if (selectedCourseIds.length === 0) {
      alert('승인 취소할 강좌를 선택해 주세요.');
      return;
    }
    const targetCourses = courses.filter((c) => selectedCourseIds.includes(c.id));
    if (!window.confirm(`선택한 ${targetCourses.length}개 강좌의 승인을 취소하고 개설신청(대기) 상태로 되돌리시겠습니까?`)) {
      return;
    }

    setCourses((prev) =>
      prev.map((c) => (selectedCourseIds.includes(c.id) ? { ...c, status: 'PENDING' } : c))
    );

    try {
      await Promise.all(selectedCourseIds.map((id) => updateAfterschoolCourse(id, { status: 'PENDING' })));
      alert(`선택한 ${targetCourses.length}개 강좌의 승인이 취소(대기 전환)되었습니다.`);
    } catch (e) {
      console.error('[AdminPanel] Batch revert failed:', e);
      alert('일괄 승인 취소 처리 중 일부 강좌 업데이트에 실패했습니다.');
    }
  };

  // 강좌 일괄 폐강 (CANCELLED)
  const handleBatchCancelCourses = async () => {
    if (selectedCourseIds.length === 0) {
      alert('폐강 처리할 강좌를 선택해 주세요.');
      return;
    }
    const targetCourses = courses.filter((c) => selectedCourseIds.includes(c.id));
    if (!window.confirm(`정말 선택한 ${targetCourses.length}개 강좌를 일괄 폐강 처리하시겠습니까?`)) {
      return;
    }

    setCourses((prev) =>
      prev.map((c) => (selectedCourseIds.includes(c.id) ? { ...c, status: 'CANCELLED' } : c))
    );

    try {
      await Promise.all(selectedCourseIds.map((id) => updateAfterschoolCourse(id, { status: 'CANCELLED' })));
      alert(`선택한 ${targetCourses.length}개 강좌가 일괄 폐강 처리되었습니다.`);
    } catch (e) {
      console.error('[AdminPanel] Batch cancel failed:', e);
      alert('일괄 폐강 처리 중 일부 강좌 업데이트에 실패했습니다.');
    }
  };

  // 강좌 일괄 영구 삭제 (Permanent Delete)
  const handleBatchDeleteCourses = async () => {
    if (selectedCourseIds.length === 0) {
      alert('영구 삭제할 강좌를 선택해 주세요.');
      return;
    }
    const targetCourses = courses.filter((c) => selectedCourseIds.includes(c.id));
    if (!window.confirm(`정말 선택한 ${targetCourses.length}개 강좌를 일괄 영구 삭제하시겠습니까?\n이 작업은 복구 불가능하며 DB에서 완전히 제거됩니다.`)) {
      return;
    }

    setCourses((prev) => prev.filter((c) => !selectedCourseIds.includes(c.id)));

    try {
      await Promise.all(selectedCourseIds.map((id) => deleteAfterschoolCourse(id)));
      setSelectedCourseIds([]);
      alert(`선택한 ${targetCourses.length}개 강좌가 영구 삭제되었습니다.`);
    } catch (e) {
      console.error('[AdminPanel] Batch delete failed:', e);
      alert('일괄 영구 삭제 처리 중 일부 강좌 삭제에 실패했습니다.');
    }
  };

  // ─── 미제출 강좌 일괄 독촉 메세지 전송 ──────────────────────────────────────
  const handleOpenBatchReminder = () => {
    // 승인된(OPEN) 강좌만 대상으로 미제출 서류 계산
    const items: BatchReminderItem[] = courses
      .filter((c) => c.status === 'OPEN')
      .map((c) => {
        const cMaterialRequests = materialRequests.filter((r) => r.courseId === c.id);
        const hasProof = expenseProofs.some((p) => p.courseId === c.id && p.status !== 'REJECTED');
        const courseApprovalDoc = (approvalDocs || []).find((d) => d.courseId === c.id);
        const hasAttendance = Boolean(courseApprovalDoc) || (approvalDocs || []).some(
          (d) => d.courseId === c.id && ((d as any).title?.includes('출석부') || (d as any).type === 'ATTENDANCE' || (d as any).docType === 'ATTENDANCE' || (d as any).type === 'ATTENDANCE_AND_WORK')
        );
        const hasWorkRegister = Boolean(courseApprovalDoc) || (approvalDocs || []).some(
          (d) => d.courseId === c.id && ((d as any).title?.includes('출근부') || (d as any).type === 'TEACHER_ATTENDANCE' || (d as any).docType === 'TEACHER_ATTENDANCE' || (d as any).type === 'ATTENDANCE_AND_WORK')
        );

        const isMaterialNotRequested = cMaterialRequests.length === 0;
        const isMaterialProofMissing = !isMaterialNotRequested && !hasProof;

        const missingDocs: string[] = [];
        if (isMaterialProofMissing) missingDocs.push('준비물 지출증빙');
        if (!hasAttendance) missingDocs.push('출석부');
        if (!hasWorkRegister) missingDocs.push('출근부');

        return {
          courseId: c.id,
          courseTitle: c.title,
          instructorName: c.instructorName || '강사',
          missingDocs,
        };
      })
      .filter((item) => item.missingDocs.length > 0);

    setBatchReminderItems(items);
    // 기본: 전체 선택
    setCheckedReminderIds(new Set(items.map((i) => i.courseId)));
    setIsBatchReminderOpen(true);
  };

  const handleBatchSendReminders = async () => {
    const targetItems = batchReminderItems.filter((item) => checkedReminderIds.has(item.courseId));
    if (targetItems.length === 0) {
      alert('전송할 강좌를 1개 이상 선택해 주세요.');
      return;
    }
    setIsBatchSending(true);
    try {
      const results = await Promise.allSettled(
        targetItems.map((item) =>
          sendSubmissionReminder({
            id: `rem_${Date.now()}_${item.courseId}_${Math.random().toString(36).slice(2, 5)}`,
            courseId: item.courseId,
            courseTitle: item.courseTitle,
            instructorName: item.instructorName,
            missingDocs: item.missingDocs,
            message: `[${item.courseTitle}] 강좌의 미제출 서류(${item.missingDocs.join(', ')})가 있습니다. 가급적 기한 내에 제출해 주시기 바랍니다.`,
            createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
          })
        )
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled' && (r.value as any).success).length;
      const failed = results.length - succeeded;
      setIsBatchReminderOpen(false);
      alert(
        `총 ${targetItems.length}개 강좌 강사에게 독촉 메세지 일괄 전송 완료!` +
          (failed > 0 ? `\n(${failed}개 강좌 전송 실패 - 네트워크 상태 확인 필요)` : '')
      );
    } catch (e) {
      alert('독촉 메세지 일괄 전송 중 오류가 발생했습니다.');
    } finally {
      setIsBatchSending(false);
    }
  };

  // 교실 추가
  const handleAddClassroom = async () => {
    if (!newClassroomName.trim()) return;
    const newRoom: Classroom = {
      id: `rm_${Date.now()}`,
      name: newClassroomName.trim(),
      capacity: parseInt(newClassroomCap) || 30,
      maxSimultaneousCourses: parseInt(newClassroomSimul) || 1,
    };
    setClassrooms((prev) => [...prev, newRoom]);
    setNewClassroomName('');
    setNewClassroomCap('30');
    setNewClassroomSimul('1');
    // Firestore 영구 저장
    const res = await addAfterschoolClassroom(newRoom);
    if (!res.success) {
      alert(`교실 저장 중 오류가 발생했습니다: ${res.error}`);
    }
  };

  // 엑셀 일괄 파일 업로드 처리
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseClassroomExcel(file);
      if (parsed.length === 0) {
        alert('가져올 수 있는 교실 데이터가 엑셀에 존재하지 않습니다.');
        return;
      }

      const importedClassrooms: Classroom[] = parsed.map((item, idx) => ({
        id: `rm_xlsx_${Date.now()}_${idx}`,
        name: item.name || '',
        capacity: item.capacity || 30,
        maxSimultaneousCourses: item.maxSimultaneousCourses || 1,
      }));

      // 기존 장소 이름과 비교해서 중복 제거 후 병합
      let newOnes: Classroom[] = [];
      setClassrooms((prev) => {
        const existingNames = new Set(prev.map(r => r.name));
        newOnes = importedClassrooms.filter(r => !existingNames.has(r.name));
        return [...prev, ...newOnes];
      });

      // Firestore 일괄 저장
      if (newOnes.length > 0) {
        const res = await saveAfterschoolClassroomsBatch(newOnes);
        if (!res.success) {
          alert(`일부 교실 저장 중 오류가 발생했습니다: ${res.error}`);
        }
      }

      alert(`엑셀 파일로부터 ${importedClassrooms.length}개의 교실 데이터를 정상 일괄 등록하였습니다. (중복 ${importedClassrooms.length - newOnes.length}개 제외)`);
      e.target.value = '';
    } catch (err) {
      console.error(err);
      alert('엑셀 파일을 파싱하는 데 실패했습니다. 올바른 양식의 파일인지 확인해 주세요.');
    }
  };

  // 교실 삭제
  const handleDeleteClassroom = async (id: string) => {
    setClassrooms((prev) => prev.filter((r) => r.id !== id));
    // Firestore에서도 삭제
    const res = await deleteAfterschoolClassroom(id);
    if (!res.success) {
      alert(`교실 삭제 중 오류가 발생했습니다: ${res.error}`);
    }
  };

  // 방과후학교 운영 계획 일괄 기안 상신 (학기초 1회)
  const handlePlanDraftSubmit = () => {
    const openCourses = courses.filter(c => c.status === 'OPEN');
    if (openCourses.length === 0) {
      alert('승인된 강좌가 없습니다. 먼저 [강좌 현황 & 승인] 탭에서 강좌들을 검토하고 승인해 주세요.');
      return;
    }
    if (!window.confirm(`최종 승인된 ${openCourses.length}개 강좌의 목록을 취합하여 '방과후학교 운영 계획서' 기안문 작성 화면으로 이동하시겠습니까?`)) {
      return;
    }
    router.push('/new?afterschoolMode=plan');
  };

  // 방과후학교 운영 결과 일괄 기안 상신 (학기말 1회)
  const handleResultDraftSubmit = () => {
    const activeCourses = courses.filter(c => c.status === 'OPEN' || c.status === 'CLOSED');
    const totalStudents = activeCourses.reduce((sum, c) => sum + c.currentStudents, 0);
    if (!window.confirm(`운영된 ${activeCourses.length}개 강좌(총 수강 학생: ${totalStudents}명)의 강사 출근부 및 수당 내역을 취합하여 '방과후학교 결과 보고 및 수당 지급 청구서' 기안문 작성 화면으로 이동하시겠습니까?`)) {
      return;
    }
    router.push('/new?afterschoolMode=result');
  };

  const tabs: { key: AdminTab; icon: React.ReactNode; label: string; shortLabel: string; badge?: number }[] = [
    { key: 'courses', icon: <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />, label: t('afterschool.admin.tab_courses') || '강좌 현황 & 승인', shortLabel: t('afterschool.admin.tab_courses_short') || '강좌' },
    { key: 'batchCreate', icon: <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />, label: t('afterschool.admin.tab_batch') || '강좌 일괄 개설', shortLabel: t('afterschool.admin.tab_batch_short') || '일괄개설' },
    { key: 'students', icon: <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />, label: t('afterschool.admin.tab_students') || '수강생 관리', shortLabel: t('afterschool.admin.tab_students_short') || '수강생' },
    { key: 'classrooms', icon: <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />, label: t('afterschool.admin.tab_classrooms') || '교실 관리', shortLabel: t('afterschool.admin.tab_classrooms_short') || '교실' },
    { key: 'approval', icon: <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />, label: t('afterschool.admin.tab_approval') || '전자결재 일괄 기안', shortLabel: t('afterschool.admin.tab_approval_short') || '전자결재' },
  ];

  return (
    <div className="w-full max-w-full bg-white flex flex-col rounded-xl overflow-hidden border border-slate-200 min-w-0">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-white shrink-0 w-full min-w-0">
          {tabs.map((tItem) => (
            <button
              key={tItem.key}
              onClick={() => setTab(tItem.key)}
              className={`flex-1 min-w-0 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold border-b-2 transition flex items-center justify-center gap-1 relative px-1 sm:px-2 ${
                tab === tItem.key ? 'border-amber-500 text-amber-700 bg-amber-50/30' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tItem.icon}
              <span className="hidden sm:inline truncate">{tItem.label}</span>
              <span className="sm:hidden truncate text-[11px]">{tItem.shortLabel}</span>
              {tItem.badge ? (
                <span className="absolute top-0.5 right-0.5 sm:right-1 w-3.5 h-3.5 bg-rose-500 text-white rounded-full text-[8px] sm:text-[9px] font-black flex items-center justify-center">
                  {tItem.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-1.5 sm:p-2.5 space-y-1.5 sm:space-y-2 min-w-0 w-full">

          {/* ===== 방과후학교 운영 단계 마스터 설정 카드 (접기/펼치기 기능 지원) ===== */}
          <div className="bg-white p-2 sm:p-3 rounded-xl border border-blue-200 shadow-2xs space-y-1.5 sm:space-y-2 transition-all min-w-0">
            <div className="flex items-center justify-between gap-1.5 sm:gap-2 border-b border-slate-100 pb-1.5 sm:pb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="bg-blue-100 text-blue-800 text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md font-bold flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    {t('afterschool.admin.stage_control') || '단계 제어'}
                  </span>
                  <h3 className="text-xs sm:text-base font-bold text-slate-800 truncate">{t('afterschool.admin.stage_title') || '방과후 운영 단계'}</h3>
                </div>
                {!isStageControlFolded && (
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-1 hidden sm:block">
                    방과후학교 운영 단계(강사 모집 ➔ 수강 신청 ➔ 운영 중 ➔ 종료)를 직접 전환합니다.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <span className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold border shrink-0 ${
                  (teacherApplySettings as any)?.afterschoolStageStatus === 'OPERATING'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : (teacherApplySettings as any)?.afterschoolStageStatus === 'APPLYING'
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : (teacherApplySettings as any)?.afterschoolStageStatus === 'CLOSED'
                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-blue-50 text-blue-700 border-blue-300'
                }`}>
                  {
                    (teacherApplySettings as any)?.afterschoolStageStatus === 'OPERATING' ? (t('afterschool.admin.stage_operating') || '운영 중') :
                    (teacherApplySettings as any)?.afterschoolStageStatus === 'APPLYING' ? (t('afterschool.admin.stage_applying') || '수강 신청') :
                    (teacherApplySettings as any)?.afterschoolStageStatus === 'CLOSED' ? (t('afterschool.admin.stage_closed') || '종료') : (t('afterschool.admin.stage_recruiting') || '강사 모집')
                  }
                </span>

                {/* 접기 / 펼치기 버튼 */}
                <button
                  type="button"
                  onClick={() => setIsStageControlFolded((prev) => !prev)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] sm:text-xs font-bold px-1.5 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-300 flex items-center gap-1 transition shadow-2xs cursor-pointer shrink-0"
                  title={isStageControlFolded ? '설정 펼치기' : '설정 접기'}
                >
                  {isStageControlFolded ? (
                    <>
                      <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
                      <span className="hidden sm:inline">펼치기</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
                      <span className="hidden sm:inline">접기</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 5단계 상태 전환 버튼 그룹 (접힘 상태가 아닐 때 표출) */}
            {!isStageControlFolded && (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-1.5 sm:gap-2 animate-in fade-in duration-200">
                <button
                  type="button"
                  onClick={() => handleUpdateStageStatus('RECRUITING')}
                  className={`p-1.5 sm:p-3 rounded-xl border text-left transition flex flex-col justify-between min-w-0 ${
                    ((teacherApplySettings as any)?.afterschoolStageStatus || 'RECRUITING') === 'RECRUITING'
                      ? 'bg-blue-50 border-2 border-blue-600 ring-2 ring-blue-100 text-blue-900 font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-0 sm:mb-1 min-w-0">
                    <span className="truncate text-[11px] sm:text-xs">{t('afterschool.admin.stage_recruiting') || '강사 모집 중'}</span>
                    {((teacherApplySettings as any)?.afterschoolStageStatus || 'RECRUITING') === 'RECRUITING' && <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 shrink-0 ml-0.5" />}
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 truncate hidden sm:block">프로그램 개설 및 접수</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStageStatus('APPLYING')}
                  className={`p-1.5 sm:p-3 rounded-xl border text-left transition flex flex-col justify-between min-w-0 ${
                    (teacherApplySettings as any)?.afterschoolStageStatus === 'APPLYING'
                      ? 'bg-amber-50 border-2 border-amber-600 ring-2 ring-amber-100 text-amber-900 font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-0 sm:mb-1 min-w-0">
                    <span className="truncate text-[11px] sm:text-xs">{t('afterschool.admin.stage_applying') || '수강 신청 중'}</span>
                    {(teacherApplySettings as any)?.afterschoolStageStatus === 'APPLYING' && <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600 shrink-0 ml-0.5" />}
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 truncate hidden sm:block">선착순 수강신청</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStageStatus('CONFIRMED')}
                  className={`p-1.5 sm:p-3 rounded-xl border text-left transition flex flex-col justify-between min-w-0 ${
                    (teacherApplySettings as any)?.afterschoolStageStatus === 'CONFIRMED'
                      ? 'bg-violet-50 border-2 border-violet-600 ring-2 ring-violet-100 text-violet-900 font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-0 sm:mb-1 min-w-0">
                    <span className="text-violet-800 font-extrabold truncate text-[11px] sm:text-xs">{t('afterschool.admin.stage_confirmed') || '수강신청 완료'}</span>
                    {(teacherApplySettings as any)?.afterschoolStageStatus === 'CONFIRMED' && <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-violet-600 shrink-0 ml-0.5" />}
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-violet-600 font-medium truncate hidden sm:block">결과 확정 통보</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStageStatus('OPERATING')}
                  className={`p-1.5 sm:p-3 rounded-xl border text-left transition flex flex-col justify-between min-w-0 ${
                    (teacherApplySettings as any)?.afterschoolStageStatus === 'OPERATING'
                      ? 'bg-emerald-50 border-2 border-emerald-600 ring-2 ring-emerald-100 text-emerald-900 shadow-sm font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-0 sm:mb-1 min-w-0">
                    <span className="text-emerald-700 font-extrabold truncate text-[11px] sm:text-xs">{t('afterschool.admin.stage_operating') || '방과후 운영 중'}</span>
                    {(teacherApplySettings as any)?.afterschoolStageStatus === 'OPERATING' && <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600 shrink-0 ml-0.5" />}
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-emerald-600 font-medium truncate hidden sm:block">출석부 및 수업</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStageStatus('CLOSED')}
                  className={`p-1.5 sm:p-3 rounded-xl border text-left transition flex flex-col justify-between min-w-0 col-span-2 sm:col-span-1 xl:col-span-1 ${
                    (teacherApplySettings as any)?.afterschoolStageStatus === 'CLOSED'
                      ? 'bg-slate-200 border-2 border-slate-600 ring-2 ring-slate-200 text-slate-900 font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-0 sm:mb-1 min-w-0">
                    <span className="truncate text-[11px] sm:text-xs">{t('afterschool.admin.stage_closed') || '운영 종료'}</span>
                    {(teacherApplySettings as any)?.afterschoolStageStatus === 'CLOSED' && <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-slate-600 shrink-0 ml-0.5" />}
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 truncate hidden sm:block">학기 운영 마감</p>
                </button>
              </div>
            )}
          </div>

          {/* Tab: 강좌 현황 & 승인 */}
          {tab === 'courses' && (
            <div className="space-y-3 text-left">
              <p className="text-xs text-slate-500">모든 강사의 강좌 개설 신청 및 운영 현황입니다. 개설 신청(PENDING) 강좌를 승인하거나 폐강하세요.</p>

              {/* 수강료 일괄 자동 적용 배너 */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-2.5 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 min-w-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-indigo-800 flex items-center gap-1.5 truncate">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    수강료 일괄 자동 계산 적용
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-indigo-600 mt-0.5 break-all">
                    공식: <b>{teacherApplySettings?.sessionsPerClass ?? 2}차시/회</b> × <b>운영기간 수업일수</b> × <b>{(teacherApplySettings?.tuitionPerSession ?? 0).toLocaleString()} {currency}</b>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleBatchApplyTuition}
                  disabled={isBatchApplyingTuition}
                  className="w-full sm:w-auto shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <DollarSign className="w-3.5 h-3.5 shrink-0" />
                  <span>{isBatchApplyingTuition ? '적용 중...' : '수강료 일괄 적용'}</span>
                </button>
              </div>

              {/* 필터 및 일괄 선택 툴바 */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-100/90 p-2 sm:p-3 rounded-xl border border-slate-200/80 min-w-0">
                {/* 상태 필터 버튼 그룹 */}
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 sm:gap-1.5 w-full sm:w-auto text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-2 py-1 rounded-lg text-xs transition-colors truncate text-center ${
                      statusFilter === 'ALL' ? 'bg-slate-800 text-white font-bold shadow-xs' : 'bg-white text-slate-600 border hover:bg-slate-50'
                    }`}
                  >
                    {t('afterschool.admin.filter_all') || '전체'} ({courses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('PENDING')}
                    className={`px-2 py-1 rounded-lg text-xs transition-colors truncate text-center ${
                      statusFilter === 'PENDING' ? 'bg-amber-600 text-white font-bold shadow-xs' : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    {t('afterschool.admin.filter_pending') || '대기'} ({courses.filter(c => c.status === 'PENDING').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('OPEN')}
                    className={`px-2 py-1 rounded-lg text-xs transition-colors truncate text-center ${
                      statusFilter === 'OPEN' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    {t('afterschool.admin.filter_open') || '승인/운영'} ({courses.filter(c => c.status === 'OPEN').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('CANCELLED')}
                    className={`px-2 py-1 rounded-lg text-xs transition-colors truncate text-center ${
                      statusFilter === 'CANCELLED' ? 'bg-slate-600 text-white font-bold shadow-xs' : 'bg-white text-slate-600 border hover:bg-slate-50'
                    }`}
                  >
                    {t('afterschool.admin.filter_cancelled') || '폐강'} ({courses.filter(c => c.status === 'CANCELLED').length})
                  </button>
                </div>

                {/* 전체 선택 체크박스 + 강좌 목록 다운로드 */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                  <label htmlFor="select-all-courses-cb" className="flex items-center gap-1.5 sm:gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition shadow-2xs select-none w-full sm:w-auto justify-center sm:justify-start">
                    <Checkbox
                      id="select-all-courses-cb"
                      checked={filteredCourses.length > 0 && filteredCourses.every(c => selectedCourseIds.includes(c.id))}
                      onCheckedChange={handleToggleSelectAllCourses}
                      className="h-3.5 w-3.5 sm:h-4 sm:w-4 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                    />
                    <span className="text-xs">{t('afterschool.admin.select_all') || '전체 선택'} ({selectedCourseIds.length})</span>
                  </label>

                  {/* 강좌 목록 다운로드 버튼 */}
                  <button
                    type="button"
                    onClick={() => {
                      const targetCourses = filteredCourses.length > 0 ? filteredCourses : courses;
                      if (targetCourses.length === 0) return;
                      import('xlsx').then(XLSX => {
                        const headers = ['강좌명', '지도교사', '장소', '수업요일', '수업시간', '정원', '현재수강생', '수강료', '상태'];
                        const rows = targetCourses.map(c => {
                          const teacherNames = [c.instructorName, c.instructor2, c.instructor3, c.instructor4]
                            .filter(Boolean).join(', ');
                          const classDays = (c.classDays || []).join(', ');
                          const statusLabel =
                            c.status === 'OPEN' ? '승인/운영' :
                            c.status === 'PENDING' ? '개설대기' :
                            c.status === 'CLOSED' ? '마감' :
                            c.status === 'CANCELLED' ? '폐강' : c.status;
                          return [
                            c.title || '',
                            teacherNames,
                            c.classroom || '',
                            classDays,
                            c.classTime || '',
                            c.maxStudents ?? '',
                            c.currentStudents ?? '',
                            (c.tuition || 0).toLocaleString(),
                            statusLabel,
                          ];
                        });
                        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, '방과후강좌목록');
                        XLSX.writeFile(wb, `방과후강좌목록_${new Date().toISOString().split('T')[0]}.xlsx`);
                      });
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition shadow-2xs shrink-0 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">강좌 목록 다운로드</span>
                    <span className="sm:hidden">목록</span>
                  </button>
                </div>
              </div>

              {/* ─── 미제출 서류 일괄 독촉 배너 + 패널 ─── */}
              {(() => {
                const missingCount = courses
                  .filter((c) => c.status === 'OPEN')
                  .filter((c) => {
                    const cMaterialRequests = materialRequests.filter((r) => r.courseId === c.id);
                    const hasProof = expenseProofs.some((p) => p.courseId === c.id && p.status !== 'REJECTED');
                    const courseApprovalDoc = (approvalDocs || []).find((d) => d.courseId === c.id);
                    const hasAttendance = Boolean(courseApprovalDoc) || (approvalDocs || []).some((d) => d.courseId === c.id && ((d as any).title?.includes('출석부') || (d as any).type === 'ATTENDANCE' || (d as any).docType === 'ATTENDANCE' || (d as any).type === 'ATTENDANCE_AND_WORK'));
                    const hasWorkRegister = Boolean(courseApprovalDoc) || (approvalDocs || []).some((d) => d.courseId === c.id && ((d as any).title?.includes('출근부') || (d as any).type === 'TEACHER_ATTENDANCE' || (d as any).docType === 'TEACHER_ATTENDANCE' || (d as any).type === 'ATTENDANCE_AND_WORK'));
                    const isMaterialProofMissing = cMaterialRequests.length > 0 && !hasProof;
                    return isMaterialProofMissing || !hasAttendance || !hasWorkRegister;
                  }).length;

                if (missingCount === 0 && !isBatchReminderOpen) return null;

                return (
                  <div className="space-y-2">
                    {/* 배너 */}
                    {!isBatchReminderOpen && missingCount > 0 && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-rose-50 border border-rose-200 rounded-xl p-3 gap-2.5">
                        <div className="flex items-center gap-2 text-xs flex-wrap min-w-0">
                          <Bell className="w-4 h-4 text-rose-600 shrink-0" />
                          <span className="font-bold text-rose-800 shrink-0">
                            서류 미제출 강좌 {missingCount}개 감지
                          </span>
                          <span className="text-rose-600 text-xs">
                            — 출석부·출근부·지출증빙 미제출 강좌의 강사에게 한 번에 독촉 메세지를 보낼 수 있습니다.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenBatchReminder}
                          className="shrink-0 w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer whitespace-nowrap"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>미제출 조회 & 일괄 독촉</span>
                        </button>
                      </div>
                    )}

                    {/* 일괄 독촉 패널 */}
                    {isBatchReminderOpen && (
                      <div className="bg-slate-950 text-white rounded-xl border border-rose-400/40 shadow-lg overflow-hidden">
                        {/* 패널 헤더 */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Bell className="w-4 h-4 text-rose-400" />
                            <span className="font-bold text-sm text-white">서류 미제출 강좌 일괄 독촉 메세지 전송</span>
                            <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                              {batchReminderItems.length}개 강좌 감지
                            </span>
                            <span className="bg-amber-500 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                              {checkedReminderIds.size}개 선택됨 (전송 대상)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsBatchReminderOpen(false)}
                            className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* 안내 배너 */}
                        <div className="px-4 py-2.5 bg-amber-900/40 border-b border-amber-700/40 text-[11px] text-amber-200">
                          서류를 이미 <strong className="text-amber-100">종이(오프라인)로 제출한 강좌</strong>는 체크를 해제하여 독촉 대상에서 제외하세요.
                          기본적으로 <strong className="text-amber-100">전체 선택</strong> 상태입니다.
                        </div>

                        {/* 전체 선택/해제 */}
                        {batchReminderItems.length > 0 && (
                          <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer select-none hover:text-white transition">
                              <input
                                type="checkbox"
                                checked={checkedReminderIds.size === batchReminderItems.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setCheckedReminderIds(new Set(batchReminderItems.map((i) => i.courseId)));
                                  } else {
                                    setCheckedReminderIds(new Set());
                                  }
                                }}
                                className="w-4 h-4 accent-rose-500 cursor-pointer"
                              />
                              전체 선택 / 전체 해제 (현재 {checkedReminderIds.size}/{batchReminderItems.length}개 선택)
                            </label>
                          </div>
                        )}

                        {/* 미제출 강좌 목록 (체크박스 포함) */}
                        {batchReminderItems.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 text-xs">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <p className="font-bold text-emerald-400">미제출 서류가 있는 강좌가 없습니다!</p>
                            <p className="mt-1 text-slate-500">모든 강좌의 서류 제출이 완료되었습니다.</p>
                          </div>
                        ) : (
                          <>
                            <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
                              {batchReminderItems.map((item, idx) => {
                                const isChecked = checkedReminderIds.has(item.courseId);
                                return (
                                  <label
                                    key={item.courseId}
                                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer select-none transition ${
                                      isChecked ? 'hover:bg-slate-900' : 'opacity-50 bg-slate-900/40 hover:opacity-70'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setCheckedReminderIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(item.courseId)) next.delete(item.courseId);
                                            else next.add(item.courseId);
                                            return next;
                                          });
                                        }}
                                        className="w-4 h-4 accent-rose-500 cursor-pointer shrink-0"
                                      />
                                      <span className="text-slate-400 text-[11px] font-mono shrink-0">{idx + 1}.</span>
                                      <div className="min-w-0">
                                        <p className="font-bold text-white text-xs truncate">{item.courseTitle}</p>
                                        <p className="text-slate-400 text-[11px]">강사: {item.instructorName}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-wrap justify-end shrink-0 ml-3">
                                      {item.missingDocs.map((doc) => (
                                        <span key={doc} className="bg-rose-900/60 border border-rose-600/60 text-rose-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                          {doc} 미제출
                                        </span>
                                      ))}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>

                            {/* 전송 안내 및 버튼 */}
                            <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                              <p className="text-[11px] text-slate-400">
                                선택된 <strong className="text-white">{checkedReminderIds.size}개 강좌</strong>의 강사에게
                                미제출 서류 독촉 알림을 동시에 전송합니다.
                                강사 앱의 <strong className="text-amber-400">[알림함]</strong>에 수신됩니다.
                              </p>
                              <button
                                type="button"
                                onClick={handleBatchSendReminders}
                                disabled={isBatchSending || checkedReminderIds.size === 0}
                                className="shrink-0 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition shadow-md cursor-pointer"
                              >
                                {isBatchSending ? (
                                  <>
                                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                                    전송 중...
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3.5 h-3.5" />
                                    {checkedReminderIds.size}명 강사에게 일괄 전송
                                  </>
                                )}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 선택 강좌 일괄 액션바 */}
              {selectedCourseIds.length > 0 && (
                <div className="bg-slate-900 text-white p-3 rounded-xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 shadow-lg border border-amber-500/30 animate-in fade-in duration-200 w-full overflow-hidden">
                  <div className="text-xs font-bold flex items-center gap-2 flex-wrap min-w-0">
                    <span className="bg-amber-400 text-slate-950 font-black px-2.5 py-0.5 rounded-full text-[11px] shrink-0">
                      {selectedCourseIds.length}개 선택됨
                    </span>
                    <span className="text-slate-200 text-xs">선택한 강좌를 일괄 승인, 대기, 폐강 또는 영구 삭제합니다.</span>
                  </div>
                  <div className="flex items-center gap-1.5 w-full xl:w-auto flex-wrap justify-start xl:justify-end shrink-0">
                    <button
                      type="button"
                      onClick={handleBatchApproveCourses}
                      className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 sm:px-3.5 py-1.5 rounded-lg flex items-center justify-center gap-1 transition shadow-sm whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>일괄 승인</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleBatchRevertCourses}
                      className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-2.5 sm:px-3.5 py-1.5 rounded-lg flex items-center justify-center gap-1 transition shadow-sm whitespace-nowrap"
                      title="일괄 승인 취소 (대기)"
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden 2xl:inline">일괄 승인 취소 (대기)</span>
                      <span className="2xl:hidden">일괄 대기</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleBatchCancelCourses}
                      className="flex-1 sm:flex-initial bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-2.5 sm:px-3.5 py-1.5 rounded-lg flex items-center justify-center gap-1 transition shadow-sm whitespace-nowrap"
                    >
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>일괄 폐강</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleBatchDeleteCourses}
                      className="flex-1 sm:flex-initial bg-red-700 hover:bg-red-800 text-white font-bold text-xs px-2.5 sm:px-3.5 py-1.5 rounded-lg flex items-center justify-center gap-1 transition shadow-sm border border-red-500/40 whitespace-nowrap"
                      title="일괄 영구 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden 2xl:inline">일괄 영구 삭제</span>
                      <span className="2xl:hidden">영구 삭제</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 강좌 카드 목록 (1줄에 2개씩 2열 그리드 배치) */}
              {filteredCourses.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 border border-dashed rounded-xl text-slate-400 text-xs">
                  해당 조건의 강좌가 존재하지 않습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3">
                  {filteredCourses.map((c, index) => {
                    const isSelected = selectedCourseIds.includes(c.id);
                    return (
                      <div
                        key={`${c.id}_${index}`}
                        className={`rounded-xl border p-2.5 sm:p-3 space-y-2 transition-all flex flex-col justify-between ${
                          isSelected ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-300 shadow-xs' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                      <div className="flex items-start gap-3">
                        {/* 강좌 선택 체크박스 */}
                        <div className="pt-0.5 shrink-0">
                          <Checkbox
                            id={`cb-course-${c.id}`}
                            checked={isSelected}
                            onCheckedChange={() => handleToggleSelectCourse(c.id)}
                            className="h-4 w-4 border-slate-400 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              c.status === 'CANCELLED' ? 'bg-slate-200 text-slate-600 line-through' :
                              c.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                              (teacherApplySettings as any)?.afterschoolStageStatus === 'CLOSED' ? 'bg-slate-200 text-slate-700 font-bold' :
                              (teacherApplySettings as any)?.afterschoolStageStatus === 'OPERATING' ? 'bg-emerald-100 text-emerald-800 font-bold' :
                              (teacherApplySettings as any)?.afterschoolStageStatus === 'CONFIRMED' ? 'bg-violet-100 text-violet-800 font-bold' :
                              (teacherApplySettings as any)?.afterschoolStageStatus === 'APPLYING' ? 'bg-amber-100 text-amber-800 font-bold' :
                              'bg-blue-100 text-blue-800 font-bold'
                            }`}>
                              {c.status === 'CANCELLED' ? '폐강' :
                               c.status === 'PENDING' ? '개설신청' :
                               (teacherApplySettings as any)?.afterschoolStageStatus === 'CLOSED' ? '운영종료' :
                               (teacherApplySettings as any)?.afterschoolStageStatus === 'OPERATING' ? '운영중' :
                               (teacherApplySettings as any)?.afterschoolStageStatus === 'CONFIRMED' ? '개설확정' :
                               (teacherApplySettings as any)?.afterschoolStageStatus === 'APPLYING' ? '신청접수중' :
                               '개설승인'}
                            </span>
                            {(c.isFree || c.tuition === 0) && (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                                무료강좌
                              </span>
                            )}
                            <label htmlFor={`cb-course-${c.id}`} className="font-bold text-slate-900 text-sm truncate cursor-pointer hover:underline">
                              {c.title}
                            </label>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 space-x-2">
                            <span>강사: {[c.instructorName, c.instructor2, c.instructor3, c.instructor4].filter(Boolean).join(' · ') || '-'}</span>
                            <span>·</span>
                            <span>장소: {c.classroom || '-'}</span>
                            <span>·</span>
                            <span>시간: {c.classTime}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex justify-between items-center mt-1">
                            <span>수강: {c.currentStudents}/{c.maxStudents}명 (최소 {c.minStudentsToOpen || 5}명 필요)</span>
                            {(() => {
                              const now = new Date().getTime();
                              const startTime = timerConfig?.startTime ? new Date(timerConfig.startTime).getTime() : 0;
                              const isBeforeEnrollment = !startTime || now < startTime;
                              const minLimit = c.minStudentsToOpen || 5;

                              if (c.status === 'CANCELLED') return null;

                              if (isBeforeEnrollment) {
                                return (
                                  <span className="text-slate-600 font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                    수강신청 전
                                  </span>
                                );
                              }
                              if (c.currentStudents >= minLimit) {
                                return (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                                    정원 충족
                                  </span>
                                );
                              }
                              return (
                                <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded text-[10px]">
                                  ⚠️ 정원 미달 (자동폐강 대상)
                                </span>
                              );
                            })()}
                          </div>

                          {/* ─── 강좌별 서류 제출 현황 (준비물 지출증빙, 출석부, 출근부) ─── */}
                          {(() => {
                            const cMaterialRequests = materialRequests.filter(r => r.courseId === c.id);
                            const hasProof = expenseProofs.some(p => p.courseId === c.id && p.status !== 'REJECTED');
                            const courseApprovalDoc = (approvalDocs || []).find(d => d.courseId === c.id);
                            const hasAttendance = Boolean(courseApprovalDoc) || (approvalDocs || []).some(d => d.courseId === c.id && ((d as any).title?.includes('출석부') || (d as any).type === 'ATTENDANCE' || (d as any).docType === 'ATTENDANCE' || (d as any).type === 'ATTENDANCE_AND_WORK'));
                            const hasWorkRegister = Boolean(courseApprovalDoc) || (approvalDocs || []).some(d => d.courseId === c.id && ((d as any).title?.includes('출근부') || (d as any).type === 'TEACHER_ATTENDANCE' || (d as any).docType === 'TEACHER_ATTENDANCE' || (d as any).type === 'ATTENDANCE_AND_WORK'));

                            const missingDocsList: string[] = [];

                            // 준비물 지출증빙 상태 판단:
                            // 1) 준비물 미신청 (cMaterialRequests.length === 0): 회색 처리, 상태표시 없음
                            // 2) 준비물 신청했으나 증빙 미제출: 빨간색 빈상자 미제출
                            // 3) 증빙 제출 완료: 초록색 체크표시
                            const isMaterialNotRequested = cMaterialRequests.length === 0;
                            const isMaterialProofSubmitted = hasProof;
                            const isMaterialProofMissing = !isMaterialNotRequested && !hasProof;

                            if (isMaterialProofMissing) missingDocsList.push('준비물 지출증빙');
                            if (!hasAttendance) missingDocsList.push('출석부');
                            if (!hasWorkRegister) missingDocsList.push('출근부');

                            return (
                              <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-700 text-[11px]">서류 제출 현황</span>
                                  {missingDocsList.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const res = await sendSubmissionReminder({
                                          id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                                          courseId: c.id,
                                          courseTitle: c.title,
                                          instructorName: c.instructorName || '강사',
                                          missingDocs: missingDocsList,
                                          message: `[${c.title}] 강좌의 미제출 서류(${missingDocsList.join(', ')})가 있습니다. 가급적 기한 내에 제출해 주시기 바랍니다.`,
                                          createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
                                        });
                                        if (res.success) {
                                          alert(`강사 [${c.instructorName || '강사'}] 님에게 [${missingDocsList.join(', ')}] 독촉 메세지를 성공적으로 전송했습니다!`);
                                        } else {
                                          alert(`독촉 메시지 전송 실패: ${res.error}`);
                                        }
                                      }}
                                      className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 transition shadow-2xs cursor-pointer"
                                    >
                                      <Bell className="w-3 h-3" /> 독촉 메세지 전송
                                    </button>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* 1. 준비물 지출증빙 */}
                                  {isMaterialNotRequested ? (
                                    <span className="bg-slate-200 text-slate-500 text-[10px] font-medium px-2 py-0.5 rounded-md">
                                      준비물 미신청
                                    </span>
                                  ) : isMaterialProofSubmitted ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewingDocCourse(c);
                                        setViewingDocType('EXPENSE_PROOF');
                                      }}
                                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition shadow-2xs cursor-pointer hover:shadow-xs"
                                      title="클릭하여 지출증빙서류(영수증/검수조서) 검토"
                                    >
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 준비물 지출증빙 제출 (검토)
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewingDocCourse(c);
                                        setViewingDocType('EXPENSE_PROOF');
                                      }}
                                      className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition shadow-2xs cursor-pointer hover:shadow-xs"
                                      title="클릭하여 지출증빙 내역 확인"
                                    >
                                      <Square className="w-3 h-3 text-rose-600" /> 준비물 지출증빙 미제출
                                    </button>
                                  )}

                                  {/* 2. 출석부 */}
                                  {hasAttendance ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewingDocCourse(c);
                                        setViewingDocType('ATTENDANCE');
                                      }}
                                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition shadow-2xs cursor-pointer hover:shadow-xs"
                                      title="클릭하여 공식 출석부 검토"
                                    >
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 출석부 제출 (검토)
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewingDocCourse(c);
                                        setViewingDocType('ATTENDANCE');
                                      }}
                                      className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition shadow-2xs cursor-pointer hover:shadow-xs"
                                      title="클릭하여 현재까지의 출석부 현황 확인"
                                    >
                                      <Square className="w-3 h-3 text-rose-600" /> 출석부 미제출 (조회)
                                    </button>
                                  )}

                                  {/* 3. 출근부 */}
                                  {hasWorkRegister ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewingDocCourse(c);
                                        setViewingDocType('WORK_REGISTER');
                                      }}
                                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition shadow-2xs cursor-pointer hover:shadow-xs"
                                      title="클릭하여 강사출근부 검토 및 보결 관리"
                                    >
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 출근부 제출 (검토)
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewingDocCourse(c);
                                        setViewingDocType('WORK_REGISTER');
                                      }}
                                      className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition shadow-2xs cursor-pointer hover:shadow-xs"
                                      title="클릭하여 출근부 확인 및 보결(대강) 강사 등록"
                                    >
                                      <Square className="w-3 h-3 text-rose-600" /> 출근부 미제출 (보결/조회)
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* 정보 수정 단추 */}
                        <button
                          type="button"
                          onClick={() => setEditingCourse(c)}
                          className="text-slate-400 hover:text-amber-600 p-1.5 bg-slate-100 hover:bg-amber-50 rounded-lg transition-colors shrink-0"
                          title="강좌 정보 수정"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* 개별 액션 버튼들 */}
                      <div className="flex gap-1.5 sm:gap-2 pt-1 border-t border-slate-100">
                        {c.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApproveCourse(c.id)}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">개설 </span>승인
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelCourse(c.id)}
                              className="flex-1 bg-slate-100 hover:bg-rose-50 text-rose-700 text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 border border-slate-200 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">폐강 처리</span><span className="sm:hidden">폐강</span>
                            </button>
                          </>
                        )}
                        {c.status === 'OPEN' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRevertToPending(c.id)}
                              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">승인 취소 (대기)</span><span className="sm:hidden">대기</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelCourse(c.id)}
                              className="flex-1 bg-slate-100 hover:bg-rose-50 text-rose-700 text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 border border-slate-200 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">폐강 처리</span><span className="sm:hidden">폐강</span>
                            </button>
                          </>
                        )}
                        {c.status === 'CANCELLED' && (
                          <div className="flex w-full gap-1.5 sm:gap-2">
                            <button
                              type="button"
                              onClick={() => handleRestoreCourse(c.id)}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">폐강 복구</span><span className="sm:hidden">복구</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCourse(c.id)}
                              className="flex-1 bg-slate-100 hover:bg-rose-50 text-rose-700 text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 border border-slate-200 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">영구 삭제</span><span className="sm:hidden">삭제</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

          {tab === 'batchCreate' && (
            <div className="space-y-6 text-left animate-in fade-in duration-200">
              {/* 상단 엑셀 등록 바 */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-slate-800 text-[14px] flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      엑셀 파일 기반 강좌 일괄 개설
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      표준 엑셀 양식을 다운로드하여 강좌 정보(강좌명, 담당 강사, 배정 교실, 정원, 수강료 등)를 입력한 뒤 업로드하시면 아래 목록에 일괄 등록됩니다.
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={downloadCourseTemplateExcel}
                      className="flex-1 sm:flex-none bg-white hover:bg-slate-100 text-slate-700 font-bold py-2.5 px-4 rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 transition text-xs shadow-sm"
                    >
                      <Download className="w-4 h-4 text-slate-600" />
                      양식 다운로드
                    </button>
                    <label className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition text-xs shadow-sm">
                      <Upload className="w-4 h-4 text-white" />
                      {isExcelUploading ? '로드 중...' : '엑셀 업로드'}
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleExcelUpload}
                        disabled={isExcelUploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* 개설 예정 강좌 미리보기 및 목록 편집 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-4 flex flex-col shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
                    <h4 className="font-bold text-slate-800 text-[13px] flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-indigo-500" />
                      개설 대상 강좌 세부 설정 ({batchPreviewCourses.length}개 반)
                    </h4>
                    <div className="flex items-center gap-2">
                      {batchPreviewCourses.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={handleDeleteSelectedPreviewCourses}
                            className="bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 font-bold px-2.5 py-1 rounded-lg border border-slate-200 transition text-[11px] flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            선택 목록에서 제거 ({batchPreviewCourses.filter(c => c.checked).length})
                          </button>
                          <button
                            type="button"
                            onClick={handleClearPreviewCourses}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-2.5 py-1 rounded-lg transition text-[11px]"
                          >
                            전체 비우기
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {batchPreviewCourses.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50/60 border-2 border-dashed border-slate-200 rounded-xl space-y-3 my-2">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                      <div className="text-slate-600 font-bold text-xs">
                        등록된 개설 예정 강좌가 없습니다.
                      </div>
                      <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                        상단의 <b>[양식 다운로드]</b> 버튼을 눌러 서식을 작성하신 뒤, <b>[엑셀 업로드]</b> 버튼을 통해 강좌 목록을 로드해 주세요.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto flex-1 max-h-[480px]">
                      <table className="w-full text-xs text-slate-700">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                            <th className="p-2.5 text-center font-bold w-12">
                              <input
                                type="checkbox"
                                checked={batchPreviewCourses.length > 0 && batchPreviewCourses.every(c => c.checked)}
                                onChange={(e) => handleToggleAllPreviewCourses(e.target.checked)}
                                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                title="전체 선택/해제"
                              />
                            </th>
                            <th className="p-2.5 text-left font-bold">강좌명</th>
                            <th className="p-2.5 text-left font-bold w-24">담당 강사</th>
                            <th className="p-2.5 text-left font-bold w-44">수업 요일/시간</th>
                            <th className="p-2.5 text-left font-bold w-36">배정 교실</th>
                            <th className="p-2.5 text-center font-bold w-20">정원(명)</th>
                            <th className="p-2.5 text-center font-bold w-12">삭제</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {batchPreviewCourses.map((c, index) => (
                            <tr key={c.id} className={`hover:bg-slate-50/50 ${!c.checked ? 'opacity-40 bg-slate-50/20' : ''}`}>
                              <td className="p-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={c.checked}
                                  onChange={(e) => {
                                    const updated = [...batchPreviewCourses];
                                    updated[index].checked = e.target.checked;
                                    setBatchPreviewCourses(updated);
                                  }}
                                  className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>
                              <td className="p-2.5 font-bold text-slate-900">{c.title}</td>
                              <td className="p-2">
                                <div className="text-xs text-center font-medium leading-tight">
                                  {[c.instructorName, c.instructor2, c.instructor3, c.instructor4].filter(Boolean).join(' · ') || '-'}
                                </div>
                              </td>
                              <td className="p-2 text-slate-700">
                                <div className="flex flex-col">
                                  <span className="font-bold text-indigo-600 text-[11px]">
                                    {c.classDays?.join(', ') || '토'}요일
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {c.classTime || '08:30 ~ 10:00'}
                                  </span>
                                </div>
                              </td>
                              <td className="p-2">
                                <select
                                  disabled={!c.checked}
                                  value={c.classroomId || (c.classroom ? `custom_${c.classroom}` : '')}
                                  onChange={(e) => {
                                    const updated = [...batchPreviewCourses];
                                    const rId = e.target.value;
                                    const room = classrooms.find(r => r.id === rId);
                                    const selectedText = e.target.selectedOptions[0]?.text || '';
                                    updated[index].classroomId = rId;
                                    updated[index].classroom = room?.name || (selectedText !== '교실 미배정' ? selectedText : '');
                                    setBatchPreviewCourses(updated);
                                  }}
                                  className="w-full border p-1 rounded bg-white disabled:bg-slate-50 text-xs cursor-pointer font-semibold"
                                >
                                  <option value="">교실 미배정</option>
                                  {classrooms.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                  ))}
                                  {c.classroom && !classrooms.some(r => r.id === c.classroomId || r.name.replace(/\s+/g, '').toLowerCase() === c.classroom.replace(/\s+/g, '').toLowerCase()) && (
                                    <option value={c.classroomId || `custom_${c.classroom}`}>{c.classroom}</option>
                                  )}
                                </select>
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  disabled={!c.checked}
                                  value={c.maxStudents}
                                  onChange={(e) => {
                                    const updated = [...batchPreviewCourses];
                                    updated[index].maxStudents = parseInt(e.target.value, 10) || 0;
                                    setBatchPreviewCourses(updated);
                                  }}
                                  className="w-full border p-1 rounded bg-white disabled:bg-slate-50 text-xs font-mono text-center"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeletePreviewCourse(c.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                  title="강좌 목록에서 제거"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="pt-4 border-t flex justify-end">
                    <button
                      onClick={handleBatchCreateSubmit}
                      disabled={isSavingBatch}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg transition flex items-center gap-1.5 disabled:bg-indigo-400 font-headline"
                    >
                      {isSavingBatch ? (
                        <>일괄 개설 처리 중...</>
                      ) : (
                        <><Save className="w-4 h-4" />{batchPreviewCourses.filter(c => c.checked).length}개 강좌 일괄 개설 실행</>
                      )}
                    </button>
                  </div>
                </div>
            </div>
          )}

          {tab === 'students' && (
            <div className="space-y-4 text-left animate-in fade-in duration-200">
              <StudentManagement
                courses={courses}
                selectedCourseId={selectedCourseId}
                setSelectedCourseId={setSelectedCourseId}
                enrollments={enrollments}
                setEnrollments={setEnrollments}
                studentsList={studentsList}
                destinations={destinations}
                routes={routes}
                buses={buses}
                teacherApplySettings={teacherApplySettings}
              />
            </div>
          )}

          {/* Tab: 교실 관리 */}
          {tab === 'classrooms' && (
            <div className="space-y-4">
              {/* Excel Import & Template Download */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center gap-2">
                <span className="text-xs font-bold text-slate-700">엑셀 일괄 등록</span>
                <div className="flex gap-2">
                  <button
                    onClick={downloadClassroomTemplateExcel}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 border border-slate-300 transition"
                  >
                    <Download className="w-3 h-3" />양식 다운로드
                  </button>
                  <label className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition shadow">
                    <Upload className="w-3 h-3" />엑셀 가져오기
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleExcelImport}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Add classroom form */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
                <div className="text-xs font-bold text-indigo-900">교실 개별 추가</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={newClassroomName}
                      onChange={(e) => setNewClassroomName(e.target.value)}
                      placeholder="교실명 (예: 체육관)"
                      className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">정원(명)</label>
                    <input
                      type="number"
                      value={newClassroomCap}
                      onChange={(e) => setNewClassroomCap(e.target.value)}
                      placeholder="정원"
                      className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">동시수업 수</label>
                    <input
                      type="number"
                      value={newClassroomSimul}
                      onChange={(e) => setNewClassroomSimul(e.target.value)}
                      placeholder="동시수업"
                      className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleAddClassroom}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1 shadow"
                    >
                      <Plus className="w-3.5 h-3.5" />추가
                    </button>
                  </div>
                </div>
              </div>

              {/* Classroom list */}
              <div className="space-y-2">
                {classrooms.map((room) => {
                  // 이 교실을 사용 중인 강좌 찾기
                  const usedBy = courses.filter((c) => c.classroom === room.name && c.status !== 'CANCELLED');
                  const limit = room.maxSimultaneousCourses || 1;
                  return (
                    <div key={room.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm">{room.name}</div>
                        <div className="text-[11px] text-slate-500">
                          정원: {room.capacity}명 · 동시수업 허용 수: <span className="font-bold text-indigo-600">{limit}개</span>
                        </div>
                        {usedBy.length > 0 && (
                          <div className="mt-1">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              usedBy.length > limit ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              현재 진행: {usedBy.length}개 강좌
                            </span>
                            <div className="text-[10px] text-slate-500 mt-1 truncate">
                              └ {usedBy.map(c => c.title).join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteClassroom(room.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab: 전자결재 일괄 기안 */}
          {/* Tab: 전자결재 일괄 기안 */}
          {tab === 'approval' && (() => {
            const currentYear = teacherApplySettings?.year || '2026';
            const currentSemester = teacherApplySettings?.semester || '2학기';
            const formattedSemester = currentSemester.endsWith('학기') && !currentSemester.startsWith('제') 
              ? `제${currentSemester}` 
              : currentSemester;
            const planDocTitle = `[계획] ${currentYear}학년도 ${formattedSemester} 방과후학교 운영 계획 승인의 건`;
            const resultDocTitle = `[결과] ${currentYear}학년도 ${formattedSemester} 방과후학교 운영 결과 보고 및 수당 지급 청구의 건`;

            return (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-900 text-sm">
                  <Shield className="w-4 h-4 text-amber-600" /> 방과후학교 일괄 기안 센터 (관리부장 권한)
                </div>
                <p>
                  개별 교사의 건별 기안 대신, 학기초 계획 수립 시 <b>1회</b>, 학기말 결과 보고 및 정산 시 <b>1회</b> 총 2회의 전자결재 일괄 기안으로 방과후 행정 업무를 처리합니다.
                </p>
              </div>

              {/* 1. 운영 계획 기안 카드 */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      1. 방과후학교 운영 계획서 기안 (학기초 1회)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      현재 승인(OPEN)된 모든 강좌와 배정 교실, 수강료 기준을 하나로 묶어 결재선을 생성합니다.
                    </p>
                  </div>
                  {isPlanDrafted ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                      상신 완료
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                      대기 중
                    </span>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1 font-mono text-slate-600">
                  <div>• 취합 대상 강좌: <b>{courses.filter(c => c.status === 'OPEN').length}개</b></div>
                  <div>• 기안 문서명: {planDocTitle}</div>
                  <div>• 결재 단계: 담당부장 기안 ➡️ 교감 검토 ➡️ 교장 전결</div>
                </div>

                {isPlanDrafted ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-center text-xs text-emerald-800 font-bold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    kisapp 전자결재 문서 번호 [AFTER-PLAN-{currentYear}] 결재 대기 중
                  </div>
                ) : (
                  <button
                    onClick={handlePlanDraftSubmit}
                    disabled={isPlanSubmitting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow"
                  >
                    {isPlanSubmitting ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin text-white mr-1" /> 상신 중...</>
                    ) : (
                      <><Send className="w-3.5 h-3.5" />방과후학교 운영 계획 결재 상신 (일괄 기안)</>
                    )}
                  </button>
                )}
              </div>

              {/* 2. 운영 결과 및 정산 기안 카드 */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      2. 방과후학교 운영 결과 & 수당 청구 기안 (학기말 1회)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      학기말까지 누적된 강좌 운영 일지, 학생별 최종 출결 수 및 강사료 정산 내역을 일괄 상신합니다.
                    </p>
                  </div>
                  {isResultDrafted ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                      상신 완료
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                      대기 중
                    </span>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1 font-mono text-slate-600">
                  <div>• 취합 대상 학생: <b>{courses.filter(c => c.status === 'OPEN' || c.status === 'CLOSED').reduce((sum, c) => sum + c.currentStudents, 0)}명</b></div>
                  <div>• 기안 문서명: {resultDocTitle}</div>
                  <div>• 결재 단계: 담당부장 기안 ➡️ 행정실 확인 ➡️ 교감 검토 ➡️ 교장 결재</div>
                </div>

                {isResultDrafted ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-center text-xs text-emerald-800 font-bold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    kisapp 전자결재 문서 번호 [AFTER-RES-{currentYear}] 결재 대기 중
                  </div>
                ) : (
                  <button
                    onClick={handleResultDraftSubmit}
                    disabled={isResultSubmitting}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow"
                  >
                    {isResultSubmitting ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin text-white mr-1" /> 상신 중...</>
                    ) : (
                      <><Send className="w-3.5 h-3.5" />방과후학교 운영 결과 결재 상신 (일괄 기안)</>
                    )}
                  </button>
                )}
              </div>
            </div>
            );
          })()}



          {/* 강좌 수정 모달 */}
          {editingCourse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden border border-slate-200 flex flex-col scale-in">
            {/* Modal Header */}
            <div className="bg-slate-800 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">강좌 정보 마스터 수정</h3>
              </div>
              <button 
                onClick={() => setEditingCourse(null)}
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 font-sans text-left">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">강좌명</label>
                <input
                  type="text"
                  value={editingCourse.title || ''}
                  onChange={(e) => setEditingCourse({ ...editingCourse, title: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">강사 1 (주강사)</label>
                  <input
                    type="text"
                    value={editingCourse.instructorName || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, instructorName: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="주강사 이름"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">강사 2 (보조강사)</label>
                  <input
                    type="text"
                    value={editingCourse.instructor2 || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, instructor2: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="보조강사 이름"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">강사 3 (선택)</label>
                  <input
                    type="text"
                    value={editingCourse.instructor3 || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, instructor3: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="강사 3 이름 (선택)"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">강사 4 (선택)</label>
                  <input
                    type="text"
                    value={editingCourse.instructor4 || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, instructor4: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="강사 4 이름 (선택)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">장소 / 교실</label>
                  <select
                    value={editingCourse.classroom || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, classroom: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="">교실 선택</option>
                    {classrooms.map((room) => (
                      <option key={room.id} value={room.name}>{room.name} (정원: {room.capacity}명)</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">수업 시간</label>
                  <input
                    type="text"
                    value={editingCourse.classTime || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, classTime: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    placeholder="예: 목 14:00-15:20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">수강 정원(명)</label>
                  <input
                    type="number"
                    value={editingCourse.maxStudents ?? 0}
                    onChange={(e) => setEditingCourse({ ...editingCourse, maxStudents: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">최소 개설인원(명)</label>
                  <input
                    type="number"
                    value={editingCourse.minStudentsToOpen ?? 5}
                    onChange={(e) => setEditingCourse({ ...editingCourse, minStudentsToOpen: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">현재 수강인원(명)</label>
                  <input
                    type="number"
                    value={editingCourse.currentStudents ?? 0}
                    onChange={(e) => setEditingCourse({ ...editingCourse, currentStudents: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              {/* 무료 강좌 지정 체크박스 */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                <label className="flex items-center gap-2 font-bold text-slate-800 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!editingCourse.isFree}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setEditingCourse({
                        ...editingCourse,
                        isFree: isChecked,
                        tuition: isChecked ? 0 : editingCourse.tuition
                      });
                    }}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>무료 강좌 지정 (학생 수강료 0원 적용)</span>
                </label>
                {editingCourse.isFree && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    수강료 0원 (무료)
                  </span>
                )}
              </div>

              {/* 마스터 설정 기반 수강료 자동 계산 안내 */}
              {(() => {
                const fallbackSessions = teacherApplySettings?.sessionsPerClass ?? 2;
                const sessionsPerClass = getCourseSessionsPerClass(editingCourse, fallbackSessions);
                const courseDays = (editingCourse.classDays && editingCourse.classDays.length > 0)
                  ? editingCourse.classDays
                  : (teacherApplySettings?.allowedDays || ['월']);
                const opStart = teacherApplySettings?.operatingStartDate || '';
                const opEnd = teacherApplySettings?.operatingEndDate || '';
                const totalOpDays = opStart && opEnd ? countOperatingDays(opStart, opEnd, courseDays, holidayDates) : 0;
                const sessionCount = totalOpDays > 0
                  ? sessionsPerClass * totalOpDays
                  : (editingCourse.sessionCount || sessionsPerClass);
                const perSession = teacherApplySettings?.tuitionPerSession || 0;
                const autoTuition = (editingCourse.isFree || teacherApplySettings?.tuitionType === '학교예산') ? 0 : perSession * sessionCount;
                const teacherFeePerSess = teacherApplySettings?.teacherFee || 0;
                const autoTeacherFee = (teacherApplySettings?.teacherFeeType === '정액제') ? teacherFeePerSess : teacherFeePerSess * sessionCount;
                const cur = currency;
                const tcur = teacherApplySettings?.teacherFeeCurrency || 'KRW';
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 text-xs text-amber-800 space-y-1">
                    <div className="font-bold text-amber-700 mb-1">📐 마스터 설정 기반 자동 계산 (참고)</div>
                    <div className="text-[11px] text-amber-600 space-y-0.5">
                      <div>공식: <b>{sessionsPerClass}차시/회</b> × <b>{totalOpDays}일</b>(운영 일수) = <b>{sessionCount}차시</b> (학사일정 휴업일 제외됨)</div>
                      <div className="flex gap-4 flex-wrap">
                        <span>수강료: <b>{editingCourse.isFree ? '0원 (무료 강좌)' : `${perSession.toLocaleString()} ${cur} × ${sessionCount}차시 = ${autoTuition.toLocaleString()} ${cur}`}</b></span>
                        <span>강사료: <b>{teacherFeePerSess.toLocaleString()} {tcur} × {sessionCount}차시 = {autoTeacherFee.toLocaleString()} {tcur}</b></span>
                      </div>
                    </div>
                    <div className="text-amber-600 text-[10px]">※ 아래 입력값을 직접 수정하거나, 자동 계산값을 적용하려면 <button type="button" className="underline font-bold" onClick={() => setEditingCourse({ ...editingCourse, tuition: autoTuition, teacherFeeTotal: autoTeacherFee })}>자동 적용</button> 버튼을 누르세요.</div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">수강료 ({currency})</label>
                  <input
                    type="number"
                    value={editingCourse.tuition ?? 0}
                    onChange={(e) => setEditingCourse({ ...editingCourse, tuition: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">교재비 ({currency})</label>
                  <input
                    type="number"
                    value={editingCourse.textbookFee ?? 0}
                    onChange={(e) => setEditingCourse({ ...editingCourse, textbookFee: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">재료비 ({currency})</label>
                  <input
                    type="number"
                    value={editingCourse.materialFee ?? 0}
                    onChange={(e) => setEditingCourse({ ...editingCourse, materialFee: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 px-6 py-4 flex justify-end gap-2 bg-slate-50 shrink-0">
              <button
                onClick={() => setEditingCourse(null)}
                className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl border transition"
              >
                취소
              </button>
              <button
                onClick={handleSaveCourseEdit}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow"
              >
                저장 및 적용
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 제출 서류(출석부 / 강사출근부 / 지출증빙) 검토 팝업 모달 ─── */}
      {viewingDocCourse && viewingDocType && (() => {
        const c = viewingDocCourse;
        const targetDoc = (approvalDocs || []).find((d) => d.courseId === c.id);
        const isManagerApproved = targetDoc?.status === 'APPROVED' || (targetDoc as any)?.managerApproved;
        const isVicePrincipalApproved = targetDoc?.status === 'APPROVED' && (targetDoc as any)?.vicePrincipalApproved;
        const managerSignature = (targetDoc as any)?.managerSignature || '';
        const vicePrincipalSignature = (targetDoc as any)?.vicePrincipalSignature || '';

        // 주강사 및 보조강사 목록 추출
        const mainInstructor = c.instructorName || '강사';
        const assistantInstructors = [
          c.instructor2,
          c.instructor3,
          c.instructor4,
          ...(c.assistantTeachers || [])
        ].filter((name): name is string => Boolean(name && name.trim() !== mainInstructor.trim()));
        const allInstructors = [mainInstructor, ...assistantInstructors];

        // 강사별 서명(도장) 조회: 관리자 도장 fallback 절대 금지!
        const getInstructorSeal = (instName: string): string => {
          if (!instName) return '';
          const cleanName = instName.trim();
          const docSigs = (targetDoc as any)?.instructorSignatures;
          if (docSigs && docSigs[cleanName]) return docSigs[cleanName];
          if (c.instructorName === cleanName && (targetDoc as any)?.instructorSignature) {
            return (targetDoc as any).instructorSignature;
          }
          if (profile?.name === cleanName && profile?.signature) {
            return profile.signature;
          }
          const u = allUsers.find(user => user.name === cleanName);
          if (u?.signature) return u.signature;
          return '';
        };

        // 출석부용 달력 산출
        const sessionsPerClass = c.sessionsPerClass || 2;
        const operatingWeeks = c.operatingWeeks || 20;
        const classDays = c.classDays || ['월'];
        const opStart = teacherApplySettings?.operatingStartDate || '';
        const opEnd = teacherApplySettings?.operatingEndDate || '';
        const effectiveDays = (classDays && classDays.length > 0) ? classDays : (teacherApplySettings?.allowedDays || ['월']);
        const effectiveSessions = getCourseSessionsPerClass(c, teacherApplySettings?.sessionsPerClass || 2);

        const scheduleDays: ScheduleDay[] = (opStart && opEnd)
          ? generateCalendarScheduleByDateRange(opStart, opEnd, effectiveDays, effectiveSessions, holidayDates)
          : generateCalendarSchedule(c.startDate || '2026-03-30', operatingWeeks, effectiveDays, effectiveSessions);

        const courseStudents = enrollments.filter((e) => e.courseId === c.id && e.status === 'ENROLLED');
        const proof = expenseProofs.find((p) => p.courseId === c.id);

        const handlePrint = () => {
          if (!getInstructorSeal(mainInstructor)) {
            if (confirm(`주강사 [${mainInstructor}] 선생님의 도장(서명)이 등록되지 않았습니다. 서명을 먼저 등록하시겠습니까?\n(취소 시 기본 원형 직인으로 인쇄됩니다)`)) {
              setSigModalTarget({ teacherName: mainInstructor, courseId: c.id });
              return;
            }
          }
          window.print();
        };

        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-2 md:p-4 overflow-y-auto backdrop-blur-xs animate-in fade-in duration-200">
            {/* 인쇄 전용 스타일 태그 (A4 가로 방향 및 서식 외 요소 완전 숨김) */}
            <style>{`
              @media print {
                @page {
                  size: A4 landscape;
                  margin: 7mm 5mm 7mm 5mm;
                }
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                body * {
                  visibility: hidden !important;
                }
                .print-container-only,
                .print-container-only * {
                  visibility: visible !important;
                }
                .print-container-only {
                  position: fixed !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                  background: white !important;
                  z-index: 99999 !important;
                }
                .no-print {
                  display: none !important;
                }
                table {
                  width: 100% !important;
                  border-collapse: collapse !important;
                  page-break-inside: auto;
                }
                tr {
                  page-break-inside: avoid;
                  page-break-after: auto;
                }
                thead {
                  display: table-header-group;
                }
              }
            `}</style>

            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden border border-slate-200 flex flex-col my-auto">
              {/* Modal Header (인쇄 시 숨김) */}
              <div className="no-print bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
                <div className="flex items-center gap-2.5">
                  {viewingDocType === 'ATTENDANCE' && <ClipboardList className="w-5 h-5 text-emerald-400" />}
                  {viewingDocType === 'WORK_REGISTER' && <FileText className="w-5 h-5 text-amber-400" />}
                  {viewingDocType === 'EXPENSE_PROOF' && <DollarSign className="w-5 h-5 text-blue-400" />}
                  <div>
                    <h3 className="font-bold text-sm text-white">
                      [{c.title}] {viewingDocType === 'ATTENDANCE' ? '공식 출석부 검토' : viewingDocType === 'WORK_REGISTER' ? '강사출근부 검토' : '학습준비물 지출증빙서 검토'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      강사: {mainInstructor}{assistantInstructors.length > 0 ? ` (보조: ${assistantInstructors.join(', ')})` : ''} · 장소: {c.classroom || '-'} · 시간: {c.classTime}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1 transition shadow-xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> 인쇄
                  </button>
                  <button
                    type="button"
                    onClick={() => { setViewingDocCourse(null); setViewingDocType(null); }}
                    className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 md:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
                {/* 1. 출석부 서식 */}
                {viewingDocType === 'ATTENDANCE' && (
                  <div id="print-official-attendance-sheet" className="print-container-only bg-white p-5 md:p-6 border border-slate-300 rounded-2xl font-serif space-y-3 text-slate-900 shadow-sm">
                    <div className="text-xs text-slate-600 font-bold font-sans">
                      {teacherApplySettings?.year || '2026'}-{teacherApplySettings?.semester || '1학기'} KIS방과후학교
                    </div>
                    <div className="flex justify-between items-start flex-wrap gap-2 font-sans">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">{c.title} 출석부</h2>
                        <div className="text-xs text-slate-600 mt-1 space-y-1">
                          <div>기간: {c.startDate || '2026-03-30'} ~ {c.endDate || '2026-06-20'}</div>
                          
                          {/* 주강사 및 보조강사 도장 표기 (증빙 필수) */}
                          <div className="flex items-center gap-3 flex-wrap pt-0.5">
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-slate-700">강사:</span>
                              <span className="font-extrabold text-slate-900">{mainInstructor}</span>
                              <OfficialSeal
                                name={mainInstructor}
                                signatureUrl={getInstructorSeal(mainInstructor)}
                                size="sm"
                              />
                              {!getInstructorSeal(mainInstructor) && (
                                <button
                                  type="button"
                                  onClick={() => setSigModalTarget({ teacherName: mainInstructor, courseId: c.id })}
                                  className="no-print ml-1 text-[10px] text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded font-bold cursor-pointer transition"
                                  title="도장/서명 등록"
                                >
                                  서명 등록
                                </button>
                              )}
                            </div>

                            {assistantInstructors.length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-slate-500 font-semibold">· 보조강사:</span>
                                {assistantInstructors.map((asst) => (
                                  <div key={asst} className="flex items-center gap-1">
                                    <span className="font-bold text-slate-800">{asst}</span>
                                    <OfficialSeal
                                      name={asst}
                                      signatureUrl={getInstructorSeal(asst)}
                                      size="sm"
                                    />
                                    {!getInstructorSeal(asst) && (
                                      <button
                                        type="button"
                                        onClick={() => setSigModalTarget({ teacherName: asst, courseId: c.id })}
                                        className="no-print ml-0.5 text-[10px] text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded font-bold cursor-pointer transition"
                                        title="도장/서명 등록"
                                      >
                                        서명 등록
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 결재란 */}
                      <table className="border-collapse border border-slate-800 text-xs text-center shrink-0">
                        <tbody>
                          <tr>
                            <td rowSpan={2} className="border border-slate-800 bg-slate-100 px-1.5 py-2 font-bold w-6 leading-tight text-[10px]">결<br/>재</td>
                            <td className="border border-slate-800 px-3 py-0.5 font-bold w-14 bg-slate-50 text-[11px]">부장</td>
                            <td className="border border-slate-800 px-3 py-0.5 font-bold w-14 bg-slate-50 text-[11px]">교감</td>
                          </tr>
                          <tr className="h-10">
                            <td className="border border-slate-800 p-0.5">
                              {isManagerApproved ? (
                                <OfficialSeal name="부장" signatureUrl={managerSignature} size="md" />
                              ) : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="border border-slate-800 p-0.5">
                              {isVicePrincipalApproved ? (
                                <OfficialSeal name="교감" signatureUrl={vicePrincipalSignature} size="md" />
                              ) : <span className="text-slate-300">-</span>}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 출석부 명단 테이블 (A4 가로 폭 최적화) */}
                    <div className="overflow-x-auto print:overflow-visible">
                      <table className="w-full border-collapse border border-slate-800 text-xs text-center font-sans print:text-[9.5px]">
                        <thead className="bg-slate-100 font-bold">
                          <tr>
                            <th className="border border-slate-800 p-0.5 w-6 print:w-5">순</th>
                            <th className="border border-slate-800 p-0.5 w-6 print:w-5">학</th>
                            <th className="border border-slate-800 p-0.5 w-6 print:w-5">반</th>
                            <th className="border border-slate-800 p-0.5 w-6 print:w-5">번</th>
                            <th className="border border-slate-800 p-1 w-16 print:w-14">이름</th>
                            {scheduleDays.map((d) => (
                              <th key={d.dayIndex} className="border border-slate-800 p-0.5 text-[8.5px] print:text-[8px] min-w-[20px]">
                                <div>{d.dateStr}</div>
                                <div className="text-[7.5px] font-normal text-slate-500">{d.dayIndex}회</div>
                              </th>
                            ))}
                            <th className="border border-slate-800 p-0.5 w-12 print:w-11 text-[10px]">버스</th>
                            <th className="border border-slate-800 p-0.5 w-20 print:w-18 text-[10px]">학부모</th>
                          </tr>
                        </thead>
                        <tbody>
                          {courseStudents.length === 0 ? (
                            <tr>
                              <td colSpan={scheduleDays.length + 7} className="border border-slate-800 py-6 text-slate-400">
                                등록된 수강 학생이 없습니다.
                              </td>
                            </tr>
                          ) : (
                            courseStudents.map((enr, idx) => {
                              const matchedStudent = studentsList.find((s) => s.id === enr.studentId) ||
                                studentsList.find((s) => 
                                  s.name === enr.name && 
                                  String(s.grade) === String(enr.grade) && 
                                  String(s.class) === String(enr.classNum) &&
                                  (!enr.studentNum || String(s.number) === String(enr.studentNum))
                                ) ||
                                studentsList.find((s) => 
                                  s.name === enr.name && 
                                  String(s.grade) === String(enr.grade) && 
                                  String(s.class) === String(enr.classNum)
                                );
                              return (
                                <tr key={enr.id} className="h-6 print:h-5 hover:bg-slate-50">
                                  <td className="border border-slate-800 py-0.5 text-[10px]">{idx + 1}</td>
                                  <td className="border border-slate-800 py-0.5 text-[10px]">{enr.grade}</td>
                                  <td className="border border-slate-800 py-0.5 text-[10px]">{enr.classNum}</td>
                                  <td className="border border-slate-800 py-0.5 text-[10px]">{enr.studentNum}</td>
                                  <td className="border border-slate-800 py-0.5 font-bold text-[10.5px]">{enr.name}</td>
                                  {scheduleDays.map((d) => {
                                    const rec = attendanceRecords.find(
                                      (r) => r.courseId === c.id && r.studentId === enr.studentId && d.sessionNos.includes(r.sessionNo || 0)
                                    );
                                    const mark = rec?.status === 'ATTEND' ? 'O' : (rec?.status === 'LATE' || (rec as any)?.mark === 'V') ? 'V' : rec?.status === 'ABSENT' ? 'X' : '';
                                    return (
                                      <td key={d.dayIndex} className="border border-slate-800 font-bold py-0.5">
                                        {mark || '·'}
                                      </td>
                                    );
                                  })}
                                  <td className="border border-slate-800 py-0.5 text-[9px] text-slate-600">{matchedStudent?.kisbusNo || enr.kisbusNo || '-'}</td>
                                  <td className="border border-slate-800 py-0.5 text-[9px] font-mono">{enr.parentPhone || matchedStudent?.parentPhone || '-'}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {/* 2. 강사출근부 서식 */}
                {viewingDocType === 'WORK_REGISTER' && (
                  <div id="print-official-work-register" className="print-container-only bg-white p-5 md:p-6 border border-slate-300 rounded-2xl font-serif space-y-4 text-slate-900 shadow-sm max-w-3xl mx-auto">
                    <div className="text-xs text-slate-600 font-bold font-sans">
                      {teacherApplySettings?.year || '2026'}-{teacherApplySettings?.semester || '1학기'} KIS방과후학교
                    </div>
                    <div className="flex justify-between items-start flex-wrap gap-2 font-sans">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">강사출근부 ({c.title})</h2>
                        <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                          <div>
                            강사: <strong className="text-slate-900">{mainInstructor}</strong>
                            {assistantInstructors.length > 0 && (
                              <span className="text-slate-600 ml-1">
                                (보조강사: {assistantInstructors.join(', ')})
                              </span>
                            )}
                          </div>
                          <div>수업시간: {c.classTime}</div>
                        </div>
                      </div>
                      <table className="border-collapse border border-slate-800 text-xs text-center shrink-0">
                        <tbody>
                          <tr>
                            <td rowSpan={2} className="border border-slate-800 bg-slate-100 px-1.5 py-2 font-bold w-6 leading-tight text-[10px]">결<br/>재</td>
                            <td className="border border-slate-800 px-3 py-0.5 font-bold w-14 bg-slate-50 text-[11px]">부장</td>
                            <td className="border border-slate-800 px-3 py-0.5 font-bold w-14 bg-slate-50 text-[11px]">교감</td>
                          </tr>
                          <tr className="h-10">
                            <td className="border border-slate-800 p-0.5">
                              {isManagerApproved ? (
                                <OfficialSeal name="부장" signatureUrl={managerSignature} size="md" />
                              ) : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="border border-slate-800 p-0.5">
                              {isVicePrincipalApproved ? (
                                <OfficialSeal name="교감" signatureUrl={vicePrincipalSignature} size="md" />
                              ) : <span className="text-slate-300">-</span>}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <table className="w-full border-collapse border border-slate-800 text-xs text-center font-sans">
                      <thead className="bg-indigo-50 font-bold">
                        <tr>
                          <th className="border border-slate-800 p-2 w-28">회차 (차시)</th>
                          <th className="border border-slate-800 p-2 w-36">수업 날짜</th>
                          <th className="border border-slate-800 p-2">강사 서명 (출근 날인)</th>
                          <th className="border border-slate-800 p-2 w-32 no-print">보결 / 결근 관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleDays.map((day) => {
                          const records = attendanceRecords.filter(
                            (r) => r.courseId === c.id && day.sessionNos.includes(r.sessionNo || 0) && Boolean(r.status || (r as any).markSymbol)
                          );
                          const hasChecked = records.length > 0;

                          const allCourseInstructors = [
                            c.instructorName,
                            c.instructor2,
                            c.instructor3,
                            c.instructor4,
                            ...(c.assistantTeachers || [])
                          ].filter(Boolean) as string[];
                          const instructors = allCourseInstructors.length > 0 ? allCourseInstructors : [c.instructorName || '강사'];

                          const daySubs = substituteRecords.filter(
                            (s) => s.courseId === c.id && s.dayIndex === day.dayIndex
                          );

                          return (
                            <tr key={day.dayIndex} className={`h-10 hover:bg-slate-50 ${daySubs.length > 0 ? 'bg-amber-50/50' : ''}`}>
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
                                  /* 강사 서명: 1줄에 2명이 적히도록 2열 그리드 배치 */
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 items-center justify-items-center">
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
                                            <OfficialSeal name={sub.substituteInstructor} signatureUrl={getInstructorSeal(sub.substituteInstructor)} size="sm" />
                                            <span className="text-[9px] text-slate-400 font-sans">(원: {inst})</span>
                                          </div>
                                        );
                                      }
                                      return (
                                        <div key={inst} className="flex items-center gap-1.5">
                                          <span className="font-bold text-[11px] text-slate-900">{inst}</span>
                                          <OfficialSeal name={inst} signatureUrl={getInstructorSeal(inst)} size="sm" />
                                          {!getInstructorSeal(inst) && (
                                            <button
                                              type="button"
                                              onClick={() => setSigModalTarget({ teacherName: inst, courseId: c.id })}
                                              className="no-print text-[9px] text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1 py-0.2 rounded font-bold cursor-pointer transition"
                                              title="도장/서명 등록"
                                            >
                                              등록
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5 items-center justify-center text-slate-400 text-[11px]">
                                    {daySubs.map(s => (
                                      <span key={s.id} className="text-amber-700 font-bold">
                                        [{s.targetInstructor || '강사'} {s.isAbsence ? '결근' : `보결: ${s.substituteInstructor}`}]
                                      </span>
                                    ))}
                                    <span>미출근 (체크 전)</span>
                                  </div>
                                )}
                              </td>
                              <td className="border border-slate-800 px-1 py-1 no-print">
                                <div className="flex flex-col gap-1 items-center justify-center">
                                  {instructors.map((inst) => {
                                    const sub = daySubs.find(s => !s.targetInstructor || s.targetInstructor === inst);
                                    return (
                                      <button
                                        key={inst}
                                        type="button"
                                        onClick={() => handleOpenSubstituteModal(day, c, inst)}
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
                )}

                {/* 3. 학습준비물 지출증빙 서식 */}
                {viewingDocType === 'EXPENSE_PROOF' && (
                  <div className="space-y-6">
                    {proof ? (
                      <>
                        {/* 서식 1: 영수증 증빙서 */}
                        <div className="bg-white p-6 border border-slate-300 rounded-2xl font-serif space-y-4 text-slate-900 shadow-sm">
                          <h4 className="font-bold text-base text-slate-900 font-sans border-b pb-2">1. 영수증 증빙서</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                            <div className="space-y-2">
                              <div><span className="text-slate-500">결제 구분:</span> <b>{proof.cardType === 'SCHOOL' ? '학교카드' : '개인카드/현금'}</b></div>
                              <div><span className="text-slate-500">명의자:</span> <b>{proof.cardOwnerName}</b></div>
                              <div><span className="text-slate-500">계좌/은행:</span> <b>{proof.bankInfo || '-'}</b></div>
                              <div><span className="text-slate-500">총 사용금액:</span> <b className="text-emerald-700 text-sm">{(proof.spentAmount || 0).toLocaleString()} VND</b></div>
                            </div>
                            <div>
                              <span className="text-slate-500 text-xs block mb-1">영수증 첨부:</span>
                              {proof.receiptImageUrl ? (
                                <img src={proof.receiptImageUrl} alt="영수증" className="max-h-48 rounded-xl border object-contain bg-slate-50 p-1" />
                              ) : (
                                <div className="h-32 bg-slate-100 rounded-xl border border-dashed flex items-center justify-center text-slate-400 text-xs">
                                  영수증 이미지 없음
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 서식 2: 물품 검수 조서 */}
                        <div className="bg-white p-6 border border-slate-300 rounded-2xl font-serif space-y-4 text-slate-900 shadow-sm">
                          <h4 className="font-bold text-base text-slate-900 font-sans border-b pb-2">2. 물품 검수 조서</h4>
                          <div className="text-xs text-slate-600 space-y-1 font-sans">
                            <div>사업명: <b>{proof.businessName || '2026 방과후학교'}</b> · 납품처: <b>{proof.supplierName || '-'}</b></div>
                            <div>납품일: <b>{proof.deliveryDate || '-'}</b> · 검수일: <b>{proof.inspectionDate || '-'}</b></div>
                          </div>
                          <table className="w-full border-collapse border border-slate-800 text-xs text-center font-sans">
                            <thead className="bg-slate-100 font-bold">
                              <tr>
                                <th className="border border-slate-800 p-1.5">품명</th>
                                <th className="border border-slate-800 p-1.5">규격/모델</th>
                                <th className="border border-slate-800 p-1.5">단위</th>
                                <th className="border border-slate-800 p-1.5">계약수량</th>
                                <th className="border border-slate-800 p-1.5">검수수량</th>
                                <th className="border border-slate-800 p-1.5">금액(VND)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(proof.items || []).map((it, i) => (
                                <tr key={i} className="h-7">
                                  <td className="border border-slate-800 font-bold">{it.name}</td>
                                  <td className="border border-slate-800">{it.modelName || '-'}</td>
                                  <td className="border border-slate-800">{it.unit || 'EA'}</td>
                                  <td className="border border-slate-800">{it.contractQty}</td>
                                  <td className="border border-slate-800 font-bold text-emerald-700">{it.inspectedQty}</td>
                                  <td className="border border-slate-800 font-mono">{(it.amount || 0).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex justify-between text-xs pt-2 text-slate-600 font-sans">
                            <div>검수자: <b>{proof.inspectorName || '-'}</b></div>
                            <div>입회자: <b>{proof.witnessName || '-'}</b></div>
                          </div>
                        </div>

                        {/* 서식 3: 검수 사진 */}
                        {proof.inspectionPhotos && proof.inspectionPhotos.length > 0 && (
                          <div className="bg-white p-6 border border-slate-300 rounded-2xl font-serif space-y-4 text-slate-900 shadow-sm">
                            <h4 className="font-bold text-base text-slate-900 font-sans border-b pb-2">3. 검수 사진</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-sans">
                              {proof.inspectionPhotos.map((url, i) => (
                                <img key={i} src={url} alt={`검수사진 ${i+1}`} className="w-full h-32 object-cover rounded-xl border" />
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 text-xs">
                        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        제출된 지출증빙 데이터가 없습니다.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-slate-200 px-6 py-4 flex justify-between items-center bg-white shrink-0">
                <div>
                  {targetDoc && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`[${c.title}] 제출된 결재 서류를 반려(삭제)하시겠습니까?\n삭제 시 강사 서류 제출함 및 관리자 검토 대기 목록에서 즉시 제거됩니다.`)) {
                          return;
                        }
                        const res = await deleteAfterschoolApprovalDoc(targetDoc.id);
                        if (res.success) {
                          setApprovalDocs((prev) => prev.filter((d) => d.id !== targetDoc.id));
                          setViewingDocCourse(null);
                          setViewingDocType(null);
                          alert('제출된 서류가 성공적으로 반려(삭제)되었습니다.');
                        } else {
                          alert(`서류 삭제 실패: ${res.error}`);
                        }
                      }}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>제출 서류 반려 및 삭제</span>
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setViewingDocCourse(null); setViewingDocType(null); }}
                    className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow cursor-pointer"
                  >
                    확인 (닫기)
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── 관리자 보결 등록/수정 모달 ─── */}
      {isSubModalOpen && subTargetDay && viewingDocCourse && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-[130] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-amber-600 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                <h3 className="font-bold text-base">강사 출결 및 보결/결근 관리</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSubModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-sm">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-1">
                <div className="font-bold text-amber-950">{viewingDocCourse.title}</div>
                <div className="text-xs text-amber-800">
                  대상 회차: <strong>{subTargetDay.dayIndex}회차 ({subTargetDay.startSessionNo}~{subTargetDay.endSessionNo}차시)</strong> · 일자: {subTargetDay.dateStr} ({subTargetDay.fullDate})
                </div>
              </div>

              {/* 대상 강사 선택 (복수 강사인 경우) */}
              {(() => {
                const allInsts = [
                  viewingDocCourse.instructorName,
                  viewingDocCourse.instructor2,
                  viewingDocCourse.instructor3,
                  viewingDocCourse.instructor4,
                  ...(viewingDocCourse.assistantTeachers || [])
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
                    ※ 보결 강사로 등록 시 출근부 해당 회차에 보결자 도장이 날인되며, 학기말 강사료 정산 시 수당이 보결 강사에게 분리 책정됩니다.
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
                {substituteRecords.some(s => s.courseId === viewingDocCourse.id && s.dayIndex === subTargetDay.dayIndex && (!s.targetInstructor || s.targetInstructor === subTargetInstructor)) && (
                  <button
                    type="button"
                    onClick={() => {
                      const existing = substituteRecords.find(s => s.courseId === viewingDocCourse.id && s.dayIndex === subTargetDay.dayIndex && (!s.targetInstructor || s.targetInstructor === subTargetInstructor));
                      if (existing) handleDeleteSubstitute(existing.id);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    삭제
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSubModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleSaveSubstitute}
                  className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer ${
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

      {/* 강사 서명/도장 등록 모달 */}
      {sigModalTarget && (
        <SignatureRegisterModal
          open={!!sigModalTarget}
          onOpenChange={(open) => !open && setSigModalTarget(null)}
          teacherName={sigModalTarget.teacherName}
          teacherEmail={sigModalTarget.teacherEmail}
          courseId={sigModalTarget.courseId}
          onSuccess={(savedSig) => {
            setAllUsers((prev) =>
              prev.map((u) =>
                u.name === sigModalTarget.teacherName ? { ...u, signature: savedSig } : u
              )
            );
          }}
        />
      )}

      </div>
    </div>
  );
};
