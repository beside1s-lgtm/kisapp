import React, { useState } from 'react';
import type { Course, Enrollment, Student } from '@/lib/afterschool/types';
import {
  UserPlus,
  FileSpreadsheet,
  Trash2,
  DollarSign,
  Download,
  Search,
  CheckSquare,
  Square,
  Save,
  Upload,
  Send,
  BookOpen,
  Bus,
  RotateCcw,
  RefreshCw,
  X,
  Receipt,
} from 'lucide-react';
import { AfterschoolBillingModal } from './AfterschoolBillingModal';

import {
  exportEnrollmentsToExcel,
  downloadSampleExcel,
  downloadSchoolBankingExcel,
  downloadAddCancelExcel,
  exportEnrollmentEditTemplateExcel,
  parseEnrollmentEditExcel,
  parseEnrollmentExcel,
  exportAfterSchoolBusRostersToExcel,
  formatBusNo,
  findMatchingCourse,
} from '@/lib/afterschool/excel';
import { getGlobalSettings } from '@/lib/kisbus/settings';
import { hideAfternoonBusForStudent, restoreAfternoonBusForStudent } from '@/lib/kisbus/students';
import { useTranslation } from '@/hooks/use-translation';
import {
  saveAfterschoolEnrollment,
  saveAfterschoolEnrollmentsBatch,
  deleteAfterschoolEnrollment,
  deleteAfterschoolEnrollmentsBatch,
  purgeAllAfterschoolEnrollments,
  syncCourseStudentCounts,
} from '@/lib/services/settingsService';

const BUS_OPTIONS = Array.from({ length: 50 }, (_, i) => `${i + 1}호차`);

interface StudentManagementProps {
  courses: Course[];
  selectedCourseId: string;
  setSelectedCourseId: (id: string) => void;
  enrollments: Enrollment[];
  setEnrollments: React.Dispatch<React.SetStateAction<Enrollment[]>>;
  studentsList: Student[];
  destinations?: any[];
  routes?: any[];
  buses?: any[];
  teacherApplySettings?: any;
}

export const StudentManagement: React.FC<StudentManagementProps> = ({
  courses,
  selectedCourseId,
  setSelectedCourseId,
  enrollments,
  setEnrollments,
  studentsList,
  destinations = [],
  routes = [],
  buses = [],
  teacherApplySettings,
}) => {
  const { t } = useTranslation();
  const [busFareSettings, setBusFareSettings] = React.useState<Record<string, number>>({
    'Zone A (근거리)': 50000,
    'Zone B (중거리)': 80000,
    'Zone C (원거리)': 100000
  });
  const [saturdayBusFareSettings, setSaturdayBusFareSettings] = React.useState<Record<string, number>>({
    'Zone A (근거리)': 30000,
    'Zone B (중거리)': 50000,
    'Zone C (원거리)': 70000
  });
  const [busFareCurrency, setBusFareCurrency] = React.useState<string>('VND');

  React.useEffect(() => {
    getGlobalSettings().then(cfg => {
      if (cfg?.busFareSettings) {
        setBusFareSettings(cfg.busFareSettings);
      }
      if (cfg?.saturdayBusFareSettings) {
        setSaturdayBusFareSettings(cfg.saturdayBusFareSettings);
      }
      if (cfg?.busFareCurrency) {
        setBusFareCurrency(cfg.busFareCurrency);
      }
    });
  }, []);

  const getFareLabel = (amount: number) => {
    const symbol = busFareCurrency === 'KRW' ? '원' : busFareCurrency === 'USD' ? '$' : 'VND';
    if (symbol === '$') {
      return `$${amount.toLocaleString()}`;
    }
    return `${amount.toLocaleString()} ${symbol}`;
  };

  // 강좌 목록 가나다-ABC 순 정렬 (한글 localeCompare)
  const sortedCourses = React.useMemo(() => {
    return [...(courses || [])].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ko'));
  }, [courses]);

  const currentCourse = selectedCourseId === 'all'
    ? { id: 'all', title: '전체 강좌 수강생', tuition: 0, textbookFee: 0, materialFee: 0, period: '전체 학기' } as any
    : (sortedCourses.find((c) => c.id === selectedCourseId) || sortedCourses[0]);

  // 수강생 데이터와 강좌 목록을 유연하게 매칭하는 헬퍼 함수
  const getMatchedCourse = (courseIdOrEnrollment: string | Enrollment | undefined): Course | undefined => {
    if (!courseIdOrEnrollment) return undefined;
    const cId = typeof courseIdOrEnrollment === 'string' ? courseIdOrEnrollment : courseIdOrEnrollment.courseId;
    const extraTitle = typeof courseIdOrEnrollment === 'object' ? ((courseIdOrEnrollment as any).courseTitle || (courseIdOrEnrollment as any).courseName || '') : '';

    if (!cId && !extraTitle) return undefined;

    // 1단계: 정확한 ID 일치
    let matched = courses.find((c) => c.id === cId || String(c.id) === String(cId));
    if (matched) return matched;

    // 2단계: cId가 강좌명 문자열로 저장된 경우
    if (cId) {
      matched = courses.find((c) => c.title === cId || (c as any).name === cId);
      if (matched) return matched;
      matched = findMatchingCourse(cId, courses);
      if (matched) return matched;
    }

    // 3단계: 별도 강좌명 필드가 있는 경우
    if (extraTitle) {
      matched = findMatchingCourse(extraTitle, courses);
      if (matched) return matched;
    }

    return undefined;
  };

  const getStudentBusFareDetails = (enrollment: Enrollment) => {
    const course = getMatchedCourse(enrollment);
    const isSaturdayCourse = Boolean(course && (
      course.classDays?.includes('토') || 
      course.period?.includes('토') || 
      course.title?.includes('토요') || 
      course.title?.includes('토요일') || 
      course.title?.includes('오케스트라') || 
      course.title?.includes('basketball')
    ));

    const busInfo = resolveStudentBusInfo(enrollment.name, enrollment.grade, enrollment.classNum, enrollment.studentNum);

    // 1. 명시적으로 미신청('-' 또는 '미신청' 또는 needsBus === false)된 경우
    const isExplicitlyNoBus = enrollment.kisbusNo === '-' || enrollment.kisbusNo === '미신청' || enrollment.needsBus === false;
    if (isExplicitlyNoBus) {
      return { isBusApplied: false, zone: '미신청', fare: 0, destinationName: '미신청', isSaturday: isSaturdayCourse };
    }

    // 2. 토요일 방과후 강좌: needsBus === true 이거나 유효한 신청 표시가 있어야 함
    const isSatApplied = Boolean(
      enrollment.needsBus === true || 
      (enrollment.kisbusNo && enrollment.kisbusNo !== '-' && enrollment.kisbusNo !== '미신청' && enrollment.kisbusNo !== 'X')
    );

    if (isSaturdayCourse && !isSatApplied) {
      return { isBusApplied: false, zone: '미신청', fare: 0, destinationName: '미신청', isSaturday: true };
    }

    // 3. 평일 방과후 강좌: 기존 등하교 버스 대상자이거나 needsBus === true 또는 kisbusNo가 있는 경우 신청으로 간주
    const isRegularRider = Boolean(busInfo?.busNo && busInfo.busNo !== '-' && busInfo.busNo !== '미신청');
    const isWeekdayApplied = isRegularRider || enrollment.needsBus === true || (enrollment.kisbusNo && enrollment.kisbusNo !== '-' && enrollment.kisbusNo !== '미신청');

    if (!isSaturdayCourse && !isWeekdayApplied) {
      return { isBusApplied: false, zone: '미신청', fare: 0, destinationName: '미신청', isSaturday: false };
    }

    const student = busInfo?.student || studentsList.find(s => 
      s.name === enrollment.name && 
      Number(s.grade) === Number(enrollment.grade) && 
      Number(s.class) === Number(enrollment.classNum)
    );

    // 목적지 및 Zone 판별
    let destinationName = '목적지 미지정';
    let zone = '7군';

    if (student) {
      const dayMap: Record<string, string> = {
        '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday',
        '목': 'Thursday', '금': 'Friday', '토': 'Saturday'
      };
      const firstDay = course?.classDays?.[0];
      const dayOfWeek = isSaturdayCourse ? 'Saturday' : (firstDay ? (dayMap[firstDay] || 'Monday') : 'Monday');
      
      let destId = isSaturdayCourse
        ? (student.satAfternoonDestinationId || student.satMorningDestinationId || student.afternoonDestinationId || student.morningDestinationId)
        : (student.afternoonDestinationId || student.morningDestinationId || student.afterSchoolDestinations?.[dayOfWeek as any]);

      // 만약 destId에 호차 문자열('1호차' 등)이 들어가 있다면 학생의 실제 정규 목적지로 복구
      if (destId && (destId.includes('호차') || destId === '미배정' || destId === '방과후 미배정')) {
        destId = student.afternoonDestinationId || student.morningDestinationId;
      }

      if (destId) {
        const destObj = destinations.find(d => d.id === destId || d.name === destId);
        destinationName = destObj ? destObj.name : destId;
        zone = (destObj && destObj.zone) ? destObj.zone : '';
      }
    }

    // 버스비 산정:
    // - 평일 방과후: 기존 등/하교 버스 대상자이므로 정규 분기 요금에 포함되어 방과후 청구 버스비는 0원 (미징수)
    if (!isSaturdayCourse) {
      return { isBusApplied: true, zone: zone || '평일 연동', fare: 0, destinationName, isSaturday: false };
    }

    // - 토요 방과후: 토요일 전용 거리별 요금제 적용
    let saturdayFare = 900000;
    const keys = Object.keys(saturdayBusFareSettings || {});

    if (keys.length > 0) {
      if (zone && saturdayBusFareSettings[zone] !== undefined) {
        saturdayFare = saturdayBusFareSettings[zone];
      } else if (destinationName && saturdayBusFareSettings[destinationName] !== undefined) {
        saturdayFare = saturdayBusFareSettings[destinationName];
      } else {
        const isDistrict7 = (
          (destinationName && destinationName.includes('7군') && !destinationName.includes('7군 외')) ||
          (zone && zone.includes('7군') && !zone.includes('7군 외')) ||
          (zone && zone.includes('Zone A')) ||
          (destinationName && (destinationName.includes('Midtown') || destinationName.includes('Scenic') || destinationName.includes('Happy') || destinationName.includes('Sky') || destinationName.includes('Parkview') || destinationName.includes('Green') || destinationName.includes('Riverpark') || destinationName.includes('Grand View') || destinationName.includes('Panorama') || destinationName.includes('Star Hill') || destinationName.includes('Hung Vang') || destinationName.includes('My Khanh') || destinationName.includes('My Phuc') || destinationName.includes('Garden Court') || destinationName.includes('Garden Plaza') || destinationName.includes('Oakwood') || destinationName.includes('Sunrise') || destinationName.includes('Eco Green') || destinationName.includes('Richlane')))
        );

        const d7Key = keys.find(k => k.includes('7군') && !k.includes('7군 외') && !k.includes('기타'));
        const nonD7Key = keys.find(k => k.includes('7군 외') || k.includes('기타') || k.includes('원거리') || k.includes('Zone B') || k.includes('Zone C'));

        if (isDistrict7 && d7Key && saturdayBusFareSettings[d7Key]) {
          saturdayFare = saturdayBusFareSettings[d7Key];
          zone = d7Key;
        } else if (!isDistrict7 && nonD7Key && saturdayBusFareSettings[nonD7Key]) {
          saturdayFare = saturdayBusFareSettings[nonD7Key];
          zone = nonD7Key;
        } else if (isDistrict7) {
          saturdayFare = saturdayBusFareSettings[keys[0]] || 900000;
          zone = keys[0] || '7군';
        } else {
          saturdayFare = saturdayBusFareSettings[keys[1]] || saturdayBusFareSettings[keys[0]] || 1600000;
          zone = keys[1] || '7군 외, 기타 지역';
        }
      }
    }

    return {
      isBusApplied: true,
      zone: zone || '7군',
      fare: saturdayFare,
      destinationName,
      isSaturday: true,
    };
  };

  // 학생 1인당 실제 총 납부 강의료(수강료) 산정 헬퍼 함수
  const getStudentTuitionFee = (enrollment: Enrollment, course?: Course): number => {
    const c = course || getMatchedCourse(enrollment);
    if (c?.isFree || (teacherApplySettings as any)?.tuitionType === '학교예산') return 0;

    // 관리자 마스터 설정 기준 공식: (차시당 단가 80,000) × (강좌별 총 차시: 20차시/40차시)
    const unitPrice = (teacherApplySettings as any)?.tuitionPerSession || 80000;
    const weeks = (teacherApplySettings as any)?.operatingWeeks || 10;
    const perSession = c?.sessionsPerClass || 2;
    const totalSessions = c?.totalSessions || (c?.operatingWeeks ? c.operatingWeeks * perSession : weeks * perSession);
    const standardTotalTuition = unitPrice * totalSessions; // 80,000 × 20 = 1,600,000 VND (4차시는 3,200,000 VND)

    let baseTuition = standardTotalTuition;
    // 강좌 또는 학생 데이터에 500,000 VND 이상의 정상 총액이 지정되어 있다면 해당 금액 사용
    if (c?.tuition && c.tuition >= 500000) {
      baseTuition = c.tuition;
    } else if (enrollment.tuition && enrollment.tuition >= 500000) {
      baseTuition = enrollment.tuition;
    }

    // 주 2회 이상 강좌에서 주 1회만 선택 수강하는 경우 50% 감액 (절반 적용)
    const classDays = c?.classDays || [];
    if (classDays.length >= 2 && enrollment.selectedDays && enrollment.selectedDays.length === 1) {
      return Math.round(baseTuition / 2);
    }

    return baseTuition;
  };

  const handleSendBusDataToBusAdmin = async () => {
    const busStudents = enrollments.filter((e) => e.kisbusNo && e.kisbusNo !== '-');
    if (busStudents.length === 0) {
      alert('현재 스쿨버스가 신청된 방과후학교 수강생이 없습니다.');
      return;
    }

    try {
      const isVacation = (teacherApplySettings as any)?.semester?.includes('방학') || false;
      const modeLabel = isVacation ? '방학 중' : '학기 중';

      await saveAfterschoolEnrollmentsBatch(enrollments);

      alert(
        `🎉 [스쿨버스 실시간 연동 완료]\n\n- 학기 구분: [${modeLabel} 방과후학교]\n- 전송 대상: 총 ${busStudents.length}명 (스쿨버스 신청 완료)\n\n스쿨버스 관리 모듈의 '${modeLabel} 방과후 버스 명단'에 실시간 동기화되었습니다!`
      );
    } catch (err: any) {
      alert(`스쿨버스 연동 전송 중 오류가 발생했습니다: ${err.message}`);
    }
  };

  // Filtering / Search (키 입력 시 딜레이 방지를 위해 입력값과 확정 검색어 분리)
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [nameSearchInput, setNameSearchInput] = useState<string>('');
  const [activeSearchKeyword, setActiveSearchKeyword] = useState<string>('');

  // Selected Checkboxes for Bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isFeeEditMode, setIsFeeEditMode] = useState(false);
  const [isAddCancelModalOpen, setIsAddCancelModalOpen] = useState(false);
  const [isSchoolBankingModalOpen, setIsSchoolBankingModalOpen] = useState(false);
  const [isAfterschoolBillingModalOpen, setIsAfterschoolBillingModalOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);


  // 방과후 버스 배정 모달 state
  const [busTransferModalEnrollmentId, setBusTransferModalEnrollmentId] = useState<string | null>(null);
  const [afterSchoolBusInputNo, setAfterSchoolBusInputNo] = useState<string>('-');
  const [isBusTransferLoading, setIsBusTransferLoading] = useState(false);

  // 엑셀 일괄 등록 모드 (replace: 전체 교체/덮어쓰기, append: 기존 명단에 추가)
  const [bulkUploadMode, setBulkUploadMode] = useState<'replace' | 'append'>('replace');
  const [isPurging, setIsPurging] = useState(false);
  const [isBatchTransferring, setIsBatchTransferring] = useState(false);

  // ─── 스쿨버스 방과후 노선 일괄 이동 핸들러 ───
  const handleBatchTransferToAfterschoolBus = async () => {
    const busStudents = enrollments.filter(
      (e) => e.status === 'ENROLLED' && e.kisbusNo && e.kisbusNo !== '-' && e.kisbusNo !== '미신청'
    );

    if (busStudents.length === 0) {
      alert('스쿨버스를 신청한 방과후 수강 확정생이 없습니다.\n(스쿨버스 호차가 지정되어 있는지 확인하세요)');
      return;
    }

    const isVacation = (teacherApplySettings as any)?.semester?.includes('방학') || false;
    const confirmMsg = `🚌 [스쿨버스 방과후 노선 일괄 이동]\n\n총 ${busStudents.length}명의 버스 탑승 학생을 방과후 버스 노선(미배정 목록)으로 일괄 이동하시겠습니까?\n\n• 정규 하교 버스에서 안전하게 제외(숨김)됩니다.\n• 스쿨버스 관리자의 [방과후 버스 배차표]에 미배정 학생으로 등록되어 노선표에 맞게 배정하실 수 있습니다.\n• 방과후 운영 종료 시 원래 하교 버스 좌석으로 자동 복귀됩니다.`;

    if (!confirm(confirmMsg)) return;

    setIsBatchTransferring(true);
    try {
      const { transferAllAfterschoolStudentsToBus } = await import('@/lib/kisbus/assignments');
      const res = await transferAllAfterschoolStudentsToBus(enrollments, courses, isVacation);
      
      // 로컬 state 업데이트 (하교 숨김 상태 반영)
      setEnrollments((prev) =>
        prev.map((e) => {
          if (e.status === 'ENROLLED' && e.kisbusNo && e.kisbusNo !== '-' && e.kisbusNo !== '미신청') {
            return { ...e, afternoonBusHidden: true };
          }
          return e;
        })
      );

      alert(res.message);
    } catch (err: any) {
      alert(`방과후 노선 일괄 이동 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsBatchTransferring(false);
    }
  };

  const handleEnrollmentEditUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsedData = await parseEnrollmentEditExcel(file);
      if (parsedData.length === 0) {
        alert('수정할 데이터가 존재하지 않거나 양식이 올바르지 않습니다.');
        return;
      }
      
      setEnrollments(prev => {
        let updatedCount = 0;
        const next = prev.map(item => {
          const matched = parsedData.find(p => p.id === item.id);
          if (matched) {
            updatedCount++;
            return {
              ...item,
              grade: matched.grade,
              classNum: matched.classNum,
              studentNum: matched.studentNum,
              kisbusNo: matched.kisbusNo,
              tuition: matched.tuition,
              textbookFee: matched.textbookFee,
              materialFee: matched.materialFee,
            };
          }
          return item;
        });
        alert(`🎉 총 ${updatedCount}명의 수강생 정보(학적/요금/스쿨버스)가 엑셀 데이터를 통해 성공적으로 일괄 수정되었습니다.`);
        return next;
      });
    } catch (err) {
      console.error(err);
      alert('엑셀 파일을 가져오고 처리하는 동안 오류가 발생했습니다.');
    } finally {
      e.target.value = '';
    }
  };

  // Single Student Registration State
  const [searchStudentName, setSearchStudentName] = useState('');
  const [foundStudents, setFoundStudents] = useState<Student[]>([]);
  const [selectedStudentToRegister, setSelectedStudentToRegister] = useState<Student | null>(null);

  // Bulk Fee Inputs
  const [bulkTuition, setBulkTuition] = useState<number | ''>('');
  const [bulkTextbook, setBulkTextbook] = useState<number | ''>('');
  const [bulkMaterial, setBulkMaterial] = useState<number | ''>('');

  // Local Editable Fees state
  const [editableEnrollments, setEditableEnrollments] = useState<Enrollment[]>([]);

  // School Banking options
  const [bankingOptions, setBankingOptions] = useState({
    tuition: true,
    textbook: true,
    material: true,
  });

  // 서브 탭 상태 (확정 수강생 / 신청 대기자)
  const [studentViewTab, setStudentViewTab] = useState<'enrolled' | 'waiting'>('enrolled');
  const [registerStatusTarget, setRegisterStatusTarget] = useState<'ENROLLED' | 'WAITING'>('ENROLLED');

  const courseEnrollments = selectedCourseId === 'all'
    ? enrollments.filter((e) => e.status === 'ENROLLED')
    : enrollments.filter((e) => e.courseId === currentCourse?.id && e.status === 'ENROLLED');

  // 대기자 목록 (신청 접수 일시 순서대로 선착순 정렬)
  const courseWaitingList = selectedCourseId === 'all'
    ? enrollments.filter((e) => e.status === 'WAITING')
    : enrollments.filter((e) => e.courseId === currentCourse?.id && e.status === 'WAITING');

  const sortedWaitingList = [...courseWaitingList].sort((a, b) => {
    const timeA = new Date(a.registrationDate || '').getTime();
    const timeB = new Date(b.registrationDate || '').getTime();
    return timeA - timeB;
  });

  // 대기자 확정 승격 처리
  const handlePromoteWaitingStudent = async (enrollmentId: string) => {
    const target = enrollments.find((e) => e.id === enrollmentId);
    if (!target) return;
    if (confirm(`대기 순위 학생 [${target.name}] 님을 수강 확정(ENROLLED) 상태로 승격하시겠습니까?`)) {
      const updatedTarget: Enrollment = { ...target, status: 'ENROLLED' };
      const nextEnrollments = enrollments.map((e) => (e.id === enrollmentId ? updatedTarget : e));
      setEnrollments(nextEnrollments);
      await saveAfterschoolEnrollment(updatedTarget);
      await syncCourseStudentCounts(target.courseId, nextEnrollments);
      alert(`🎉 [${target.name}] 학생이 수강 확정 상태로 성공적으로 승격되었습니다!`);
    }
  };

  // 주 2회 이상 강좌 중 특정 요일만 수강(주 1회 선택) 또는 전체 수강 변경 핸들러
  const handleSelectedDaysChange = async (enrollmentId: string, dayValue: string) => {
    const target = enrollments.find((e) => e.id === enrollmentId);
    if (!target) return;

    const newSelectedDays = dayValue ? [dayValue] : undefined;
    const updated: Enrollment = { ...target, selectedDays: newSelectedDays };

    const nextEnrollments = enrollments.map((e) => (e.id === enrollmentId ? updated : e));
    setEnrollments(nextEnrollments);

    try {
      await saveAfterschoolEnrollment(updated);
    } catch (err) {
      console.error('수강 요일 업데이트 실패:', err);
    }
  };

  // 수강 취소 및 대기자 승격 연동 처리
  const handleCancelEnrollmentWithPromotion = async (enrollmentId: string) => {
    const target = enrollments.find((e) => e.id === enrollmentId);
    if (!target) return;

    const firstWaiting = sortedWaitingList[0];

    if (confirm(`[${target.name}] 학생의 수강을 취소하시겠습니까?`)) {
      const updatedTarget: Enrollment = { ...target, status: 'CANCELLED' };
      let nextEnrollments = enrollments.map((e) => (e.id === enrollmentId ? updatedTarget : e));
      setEnrollments(nextEnrollments);
      await saveAfterschoolEnrollment(updatedTarget);
      await syncCourseStudentCounts(target.courseId, nextEnrollments);

      if (firstWaiting) {
        setTimeout(async () => {
          if (confirm(`수강 취소 처리 완료!\n현재 1순위 대기자인 [${firstWaiting.name}] 학생을 자동으로 수강 확정 승격하시겠습니까?`)) {
            const updatedFirstWaiting: Enrollment = { ...firstWaiting, status: 'ENROLLED' };
            nextEnrollments = nextEnrollments.map((e) => (e.id === firstWaiting.id ? updatedFirstWaiting : e));
            setEnrollments(nextEnrollments);
            await saveAfterschoolEnrollment(updatedFirstWaiting);
            await syncCourseStudentCounts(target.courseId, nextEnrollments);
            alert(`🎉 1순위 대기자 [${firstWaiting.name}] 학생이 수강 확정되었습니다!`);
          }
        }, 100);
      } else {
        alert(`[${target.name}] 학생이 수강 취소 처리되었습니다.`);
      }
    }
  };

  const filteredEnrollments = courseEnrollments.filter((e) => {
    if (gradeFilter !== 'all' && e.grade !== Number(gradeFilter)) return false;
    if (classFilter !== 'all' && e.classNum !== Number(classFilter)) return false;
    if (activeSearchKeyword && !e.name.toLowerCase().includes(activeSearchKeyword.toLowerCase().trim())) return false;
    return true;
  });

  const filteredWaitingEnrollments = sortedWaitingList.filter((e) => {
    if (gradeFilter !== 'all' && e.grade !== Number(gradeFilter)) return false;
    if (classFilter !== 'all' && e.classNum !== Number(classFilter)) return false;
    if (activeSearchKeyword && !e.name.toLowerCase().includes(activeSearchKeyword.toLowerCase().trim())) return false;
    return true;
  });

  const currentTargetList = studentViewTab === 'enrolled' ? filteredEnrollments : filteredWaitingEnrollments;

  const handleTabChange = (tab: 'enrolled' | 'waiting') => {
    setStudentViewTab(tab);
    setSelectedIds([]);
  };

  // Checkbox handlers
  const handleSelectAll = () => {
    if (selectedIds.length === currentTargetList.length && currentTargetList.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentTargetList.map((e) => e.id));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Delete handlers
  const handleDeleteSingle = async (id: string) => {
    const target = enrollments.find((e) => e.id === id);
    const nextEnrollments = enrollments.filter((e) => e.id !== id);
    setEnrollments(nextEnrollments);
    await deleteAfterschoolEnrollment(id);
    if (target) {
      await syncCourseStudentCounts(target.courseId, nextEnrollments);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert('삭제할 학생을 먼저 선택해주세요.');
      return;
    }
    const label = studentViewTab === 'enrolled' ? '수강 확정생' : '신청 대기자';
    if (confirm(`선택한 ${selectedIds.length}명의 ${label}를 일괄 삭제하시겠습니까?`)) {
      const affectedCourseIds = Array.from(new Set(enrollments.filter((e) => selectedIds.includes(e.id)).map((e) => e.courseId)));
      const nextEnrollments = enrollments.filter((e) => !selectedIds.includes(e.id));
      setEnrollments(nextEnrollments);
      await deleteAfterschoolEnrollmentsBatch(selectedIds);
      
      for (const cId of affectedCourseIds) {
        await syncCourseStudentCounts(cId, nextEnrollments);
      }
      setSelectedIds([]);
      alert(`선택한 ${selectedIds.length}명의 수강생 정보가 영구 삭제되었습니다.`);
    }
  };

  // Search student for registration modal
  const handleSearchStudent = () => {
    const res = studentsList.filter((s) => s.name.includes(searchStudentName));
    setFoundStudents(res);
  };

  // ─── 방과후 버스 배정 핸들러 ───
  // 하교 버스를 숨기고 방과후 버스 번호를 enrollment에 저장합니다.
  // 단, 토요일 강좌(토요방과후) 학생은 토요일 노선을 그대로 사용하므로 하교 버스 숨김 안 함.
  const handleAssignAfterSchoolBus = async (enrollmentId: string, afterSchoolBusNo: string) => {
    if (!afterSchoolBusNo || afterSchoolBusNo === '-') {
      alert('방과후 버스 번호를 선택해주세요.');
      return;
    }
    const target = enrollments.find((e) => e.id === enrollmentId);
    if (!target) return;

    // 토요일 강좌 여부 판별: classDays에 '토'가 포함되어 있거나, 토요만 운영되는 강좌
    const targetCourse = courses.find((c) => c.id === target.courseId);
    const isSaturdayCourse = targetCourse?.classDays?.includes('토') ?? false;

    setIsBusTransferLoading(true);
    try {
      // 1. enrollment 업데이트: 방과후 버스 번호 저장
      //    토요일 강좌는 하교 버스 숨김 플래그를 설정하지 않음
      const updatedEnrollment: Enrollment = {
        ...target,
        afterSchoolBusNo,
        afternoonBusHidden: isSaturdayCourse ? false : true,
      };
      setEnrollments((prev) =>
        prev.map((en) => (en.id === enrollmentId ? updatedEnrollment : en))
      );
      await saveAfterschoolEnrollment(updatedEnrollment);

      // 2. kisbus students DB 업데이트
      //    토요일 강좌는 하교 목적지를 숨길 필요 없음 (토요일 노선 유지)
      const kisbusStudentId = target.studentId;
      if (!isSaturdayCourse && kisbusStudentId && kisbusStudentId.startsWith('e_') === false) {
        await hideAfternoonBusForStudent(kisbusStudentId).catch((err) => {
          console.warn('kisbus 하교 숨김 처리 실패 (수강생 데이터는 저장됨):', err);
        });
      }

      setBusTransferModalEnrollmentId(null);
      setAfterSchoolBusInputNo('-');
      if (isSaturdayCourse) {
        alert(`[${target.name}] 학생의 토요 방과후 버스(${afterSchoolBusNo})를 저장했습니다.\n토요일 노선은 유지됩니다.`);
      } else {
        alert(`[${target.name}] 학생이 방과후 버스(${afterSchoolBusNo})로 배정되었습니다.\n하교 버스는 숨김 처리되었습니다.`);
      }
    } catch (err: any) {
      alert(`방과후 버스 배정 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsBusTransferLoading(false);
    }
  };

  // 하교 버스 복원 핸들러: 방과후 버스 배정을 해제하고 하교 버스를 복원합니다.
  const handleRestoreAfternoonBus = async (enrollmentId: string) => {
    const target = enrollments.find((e) => e.id === enrollmentId);
    if (!target) return;
    if (!confirm(`[${target.name}] 학생의 방과후 버스 배정을 해제하고 하교 버스를 복원하시겠습니까?`)) return;

    setIsBusTransferLoading(true);
    try {
      // 1. enrollment 업데이트: 방과후 버스 정보 제거 + 하교 숨김 해제
      const updatedEnrollment: Enrollment = {
        ...target,
        afterSchoolBusNo: '',
        afternoonBusHidden: false,
      };
      setEnrollments((prev) =>
        prev.map((en) => (en.id === enrollmentId ? updatedEnrollment : en))
      );
      await saveAfterschoolEnrollment(updatedEnrollment);

      // 2. kisbus students DB에서 하교 목적지 복원
      const kisbusStudentId = target.studentId;
      if (kisbusStudentId && kisbusStudentId.startsWith('e_') === false) {
        await restoreAfternoonBusForStudent(kisbusStudentId).catch((err) => {
          console.warn('kisbus 하교 복원 처리 실패 (수강생 데이터는 저장됨):', err);
        });
      }

      alert(`✅ [${target.name}] 학생의 하교 버스가 복원되었습니다.`);
    } catch (err: any) {
      alert(`하교 버스 복원 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsBusTransferLoading(false);
    }
  };

  // 개별 등록 폼 state
  const [regModalCourseId, setRegModalCourseId] = useState<string>('');
  const [regGrade, setRegGrade] = useState<string>('1');
  const [regClassNum, setRegClassNum] = useState<string>('1');
  const [regStudentNum, setRegStudentNum] = useState<string>('');
  const [regName, setRegName] = useState<string>('');
  const [regParentPhone, setRegParentPhone] = useState<string>('');
  const [regNeedsBus, setRegNeedsBus] = useState<boolean>(false);

  const handleCompleteRegisterStudent = async () => {
    const targetCourse = courses.find((c) => c.id === regModalCourseId) || courses[0];
    if (!targetCourse) {
      alert('강좌를 선택해주세요.');
      return;
    }
    if (!regName.trim()) {
      alert('학생 이름을 입력해주세요.');
      return;
    }

    const courseEnrollmentsList = enrollments.filter(e => e.courseId === targetCourse.id);
    const newEnrollment: Enrollment = {
      id: `e_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      courseId: targetCourse.id,
      studentId: selectedStudentToRegister?.id || `st_${Date.now()}`,
      yearNo: courseEnrollmentsList.length + 1,
      grade: Number(regGrade) || 1,
      classNum: Number(regClassNum) || 1,
      studentNum: Number(regStudentNum) || 0,
      name: regName.trim(),
      phone: '',
      parentPhone: regParentPhone.trim(),
      needsBus: regNeedsBus,
      kisbusNo: regNeedsBus ? '신청' : '-',
      tuition: targetCourse.tuition,
      textbookFee: targetCourse.textbookFee,
      materialFee: targetCourse.materialFee,
      registrationDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
      status: registerStatusTarget,
    };

    const nextEnrollments = [newEnrollment, ...enrollments];
    setEnrollments(nextEnrollments);
    await saveAfterschoolEnrollment(newEnrollment);
    await syncCourseStudentCounts(targetCourse.id, nextEnrollments);
    setIsRegisterModalOpen(false);
    setSelectedStudentToRegister(null);
    alert(`[${newEnrollment.name}] 학생이 '${targetCourse.title}' 강좌에 ${registerStatusTarget === 'ENROLLED' ? '수강 확정생' : '신청 대기자'}로 성공적으로 등록되었습니다.`);
  };

  // 기존 스쿨버스 명단과 대조하여 스쿨버스 번호 및 연락처를 자동 참조하는 헬퍼 함수
  const resolveStudentBusInfo = (name: string, grade: number, classNum: number, studentNum?: number) => {
    if (!name || !studentsList || studentsList.length === 0) return null;
    const clean = (str: any) => String(str || '').replace(/\s+/g, '').toLowerCase();
    const targetName = clean(name);

    // 1단계: 이름 + 학년 + 반 + 번호 정확 매칭
    let matched = studentsList.find((s) => {
      const matchName = clean(s.name) === targetName || clean(s.nameKo) === targetName || clean(s.nameEn) === targetName;
      const matchGrade = Number(s.grade) === Number(grade);
      const matchClass = Number(s.class) === Number(classNum);
      const sNum = Number((s as any).studentNum || s.number || 0);
      const matchNum = studentNum ? sNum === Number(studentNum) : true;
      return matchName && matchGrade && matchClass && matchNum;
    });

    // 2단계: 이름 + 학년 + 반 매칭 (번호 불일치 허용)
    if (!matched) {
      matched = studentsList.find((s) => {
        const matchName = clean(s.name) === targetName || clean(s.nameKo) === targetName || clean(s.nameEn) === targetName;
        const matchGrade = Number(s.grade) === Number(grade);
        const matchClass = Number(s.class) === Number(classNum);
        return matchName && matchGrade && matchClass;
      });
    }

    // 3단계: 이름만으로 fallback 매칭 (동명이인이 1명뿐인 경우에만 허용)
    if (!matched) {
      const sameNameStudents = studentsList.filter((s) => {
        return clean(s.name) === targetName || clean(s.nameKo) === targetName || clean(s.nameEn) === targetName;
      });
      if (sameNameStudents.length === 1) {
        matched = sameNameStudents[0];
      }
      // 동명이인 2명 이상이면 매칭하지 않음 (null 반환하여 오배정 방지)
    }

    if (!matched) return null;

    // 1. routes에서 실제 정규 등/하교 버스(Morning / Afternoon) 배정 호차 조회
    let regularBusNo = (matched as any).kisbusNo || (matched as any).morningBusNo || (matched as any).afternoonBusNo || (matched as any).busNo || '';
    if (!regularBusNo && routes && routes.length > 0) {
      const assignedRoute = routes.find((r) => 
        (r.type === 'Morning' || r.type === 'Afternoon') &&
        (r.seating || []).some((seat: any) => seat.studentId === matched.id)
      );
      if (assignedRoute) {
        const foundBus = (buses || []).find((b: any) => b.id === assignedRoute.busId);
        regularBusNo = foundBus?.name || formatBusNo(assignedRoute.busId);
      }
    }

    if (regularBusNo && regularBusNo !== '-' && regularBusNo !== '미신청') {
      regularBusNo = formatBusNo(regularBusNo);
    } else {
      regularBusNo = '';
    }

    // 2. routes에서 실제 방과후 버스(AfterSchool) 배정 호차 조회
    let afterSchoolAssignedBusNo = (matched as any).afterSchoolBusNo || '';
    if (!afterSchoolAssignedBusNo && routes && routes.length > 0) {
      const assignedAfterSchoolRoute = routes.find((r) => 
        r.type === 'AfterSchool' &&
        (r.seating || []).some((seat: any) => seat.studentId === matched.id)
      );
      if (assignedAfterSchoolRoute) {
        const foundBus = (buses || []).find((b: any) => b.id === assignedAfterSchoolRoute.busId);
        afterSchoolAssignedBusNo = foundBus?.name || formatBusNo(assignedAfterSchoolRoute.busId);
      }
    }

    const phone = (matched as any).phone || (matched as any).contact || '';
    const parentPhone = (matched as any).parentPhone || (matched as any).contact || (matched as any).emergencyContact || (matched as any).phone || '';

    return {
      student: matched,
      busNo: regularBusNo,
      afterSchoolBusNo: afterSchoolAssignedBusNo,
      phone,
      parentPhone,
    };
  };

  // ─── 스쿨버스 명단과 상호 대조하여 빈 정보(버스번호/연락처) 일괄 동기화 ───
  const [isSyncingBusInfo, setIsSyncingBusInfo] = useState(false);

  const handleSyncBusAndPhoneInfo = async () => {
    if (enrollments.length === 0) {
      alert('동기화할 수강생 데이터가 없습니다.');
      return;
    }
    if (!studentsList || studentsList.length === 0) {
      alert('스쿨버스 학생 명단을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setIsSyncingBusInfo(true);
    try {
      let updatedCount = 0;
      const updatedEnrollments = enrollments.map((item) => {
        const busInfo = resolveStudentBusInfo(item.name, item.grade, item.classNum, item.studentNum);
        if (!busInfo) return item;

        let hasChange = false;
        let newBusNo = item.kisbusNo;
        let newParentPhone = item.parentPhone;
        let newStudentId = item.studentId;

        const matchedCourse = getMatchedCourse(item);
        const isSat = Boolean(matchedCourse && (
          matchedCourse.classDays?.includes('토') || 
          matchedCourse.period?.includes('토') || 
          matchedCourse.title?.includes('토요') || 
          matchedCourse.title?.includes('토요일') || 
          matchedCourse.title?.includes('오케스트라') || 
          matchedCourse.title?.includes('basketball')
        ));

        // 스쿨버스 번호 채우기 (평일 강좌일 때만 평일 등하교 버스 자동 채움, 토요일은 사용자 선택값 100% 보존)
        if (!isSat && (!newBusNo || newBusNo === '-' || newBusNo === '미신청') && busInfo.busNo) {
          newBusNo = busInfo.busNo;
          hasChange = true;
        }
        // 학부모 연락처 채우기
        if ((!newParentPhone || newParentPhone === '-') && busInfo.parentPhone) {
          newParentPhone = busInfo.parentPhone;
          hasChange = true;
        }
        // 학생 ID 매칭
        if ((!newStudentId || newStudentId.startsWith('s_bulk') || newStudentId.startsWith('excel')) && busInfo.student.id) {
          newStudentId = busInfo.student.id;
          hasChange = true;
        }

        if (hasChange) {
          updatedCount++;
          return {
            ...item,
            kisbusNo: newBusNo,
            parentPhone: newParentPhone,
            studentId: newStudentId,
          };
        }
        return item;
      });

      if (updatedCount > 0) {
        setEnrollments(updatedEnrollments);
        await saveAfterschoolEnrollmentsBatch(updatedEnrollments);
        alert(`🎉 총 ${updatedCount}명의 수강생 정보(스쿨버스 번호/학부모 연락처)가 스쿨버스 명단과 100% 일치하도록 성공적으로 자동 동기화되었습니다!`);
      } else {
        alert('모든 수강생의 스쿨버스 정보 및 연락처가 이미 최신 상태로 일치합니다.');
      }
    } catch (err: any) {
      alert(`스쿨버스 정보 동기화 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsSyncingBusInfo(false);
    }
  };

  // ─── 수강생 전체 비우기 (초기화) 핸들러 ───
  const handlePurgeAllEnrollments = async () => {
    if (enrollments.length === 0) {
      alert('비울 수강생 데이터가 없습니다.');
      return;
    }
    const confirmMsg = `⚠️ [수강생 전체 비우기 경고]\n\n현재 등록된 총 ${enrollments.length}명의 수강생 데이터를 데이터베이스에서 완전히 삭제하시겠습니까?\n\n※ 모든 강좌의 수강생 수가 0명으로 초기화되며, 삭제 후 복구할 수 없습니다.`;
    if (!confirm(confirmMsg)) return;

    setIsPurging(true);
    try {
      const res = await purgeAllAfterschoolEnrollments();
      setEnrollments([]);
      setSelectedIds([]);
      alert(`🎉 총 ${res.count}명의 수강생 데이터가 성공적으로 전체 삭제되었습니다. 모든 강좌 인원수가 초기화되었습니다.`);
    } catch (err: any) {
      alert(`수강생 전체 비우기 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsPurging(false);
    }
  };

  // Bulk Excel Upload Handler (다중 강좌 일괄 등록 & 스쿨버스 명단 자동 대조)
  const handleBulkFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedStudents = await parseEnrollmentExcel(file);
      if (parsedStudents.length === 0) {
        alert('엑셀 파일에 유효한 수강생 데이터가 없습니다.\n(필수 컬럼: 학년, 반, 번호, 이름, 강좌명)');
        return;
      }

      // 전체 덮어쓰기 모드인 경우 기존 DB 및 상태 먼저 비우기
      if (bulkUploadMode === 'replace') {
        await purgeAllAfterschoolEnrollments();
      }

      let addedCount = 0;
      let busMatchedCount = 0;
      let courseMatchedCount = 0;
      let courseUnmatchedCount = 0;
      const newItems: Enrollment[] = [];
      const courseCountMap = new Map<string, number>();

      parsedStudents.forEach((st, idx) => {
        // 1. 엑셀에 강좌명이 명시되어 있으면 스마트 유연 매칭 적용
        let targetCourse = findMatchingCourse(st.courseTitle, courses);

        // 2. 일치하는 강좌가 없는데 특정 강좌가 선택되어 있는 경우 해당 강좌 사용
        if (!targetCourse && selectedCourseId !== 'all') {
          targetCourse = currentCourse;
        }

        if (targetCourse) {
          courseMatchedCount++;
          const courseTitleName = targetCourse.title || '미지정';
          courseCountMap.set(courseTitleName, (courseCountMap.get(courseTitleName) || 0) + 1);
        } else {
          courseUnmatchedCount++;
          const rawTitle = st.courseTitle || '강좌 미확인';
          courseCountMap.set(`[미매칭] ${rawTitle}`, (courseCountMap.get(`[미매칭] ${rawTitle}`) || 0) + 1);
        }

        // 3. 기존 스쿨버스 명단과 대조하여 스쿨버스 번호 및 연락처 자동 참조
        const busInfo = resolveStudentBusInfo(st.name, st.grade, st.classNum, st.studentNum);
        let finalBusNo = st.kisbusNo;
        if (!finalBusNo || finalBusNo === '-' || finalBusNo === '미신청') {
          if (busInfo?.busNo) {
            finalBusNo = busInfo.busNo;
            busMatchedCount++;
          }
        }

        const newEnrollment: Enrollment = {
          id: `e_bulk_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
          courseId: targetCourse?.id || '',
          courseTitle: targetCourse?.title || st.courseTitle || '',
          studentId: busInfo?.student?.id || `s_bulk_${Date.now()}_${idx}`,
          yearNo: bulkUploadMode === 'replace' ? idx + 1 : (courseEnrollments.length + addedCount + 1),
          grade: st.grade,
          classNum: st.classNum,
          studentNum: st.studentNum,
          name: st.name,
          phone: st.phone || busInfo?.phone || '',
          parentPhone: st.parentPhone || busInfo?.parentPhone || '',
          kisbusNo: finalBusNo ? formatBusNo(finalBusNo) : '-',
          tuition: targetCourse?.tuition || 0,
          textbookFee: targetCourse?.textbookFee || 0,
          materialFee: targetCourse?.materialFee || 0,
          registrationDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
          status: 'ENROLLED',
        };
        newItems.push(newEnrollment);
        addedCount++;
      });

      const nextEnrollments = bulkUploadMode === 'replace' ? newItems : [...newItems, ...enrollments];
      setEnrollments(nextEnrollments);

      // Firestore DB에 영구 일괄 저장
      await saveAfterschoolEnrollmentsBatch(newItems);

      // 개별 강좌 수강인원 동기화
      const affectedCourseIds = Array.from(new Set(newItems.map((item) => item.courseId).filter(Boolean)));
      for (const cId of affectedCourseIds) {
        await syncCourseStudentCounts(cId, nextEnrollments);
      }
      
      const courseSummaryText = Array.from(courseCountMap.entries())
        .slice(0, 4)
        .map(([t, count]) => `'${t.split(' (')[0]}': ${count}명`)
        .join(', ');
      const moreText = courseCountMap.size > 4 ? ` 외 ${courseCountMap.size - 4}개 강좌` : '';

      const modeText = bulkUploadMode === 'replace' ? '전체 새로 덮어쓰기' : '기존 명단에 추가';

      alert(
        `🎉 [강좌별 수강생 엑셀 일괄 등록 완료]\n\n` +
        `• 등록 방식: ${modeText}\n` +
        `• 총 등록 수강 건수: ${addedCount}건\n` +
        `• 강좌 정상 매칭: ${courseMatchedCount}건 / 미확인: ${courseUnmatchedCount}건\n` +
        `• 스쿨버스 명단 자동 매칭: ${busMatchedCount}명 배정\n` +
        `• 강좌별 배정 현황: ${courseSummaryText}${moreText}`
      );
      setIsBulkImportModalOpen(false);
    } catch (err: any) {
      alert(`엑셀 파싱 및 일괄 등록 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  // Enable Fee Edit mode
  const handleStartFeeEdit = () => {
    setEditableEnrollments(JSON.parse(JSON.stringify(courseEnrollments)));
    setIsFeeEditMode(true);
  };

  const handleApplyFeeBulkToAll = (type: 'tuition' | 'textbook' | 'material') => {
    const val =
      type === 'tuition'
        ? Number(bulkTuition)
        : type === 'textbook'
        ? Number(bulkTextbook)
        : Number(bulkMaterial);

    setEditableEnrollments((prev) =>
      prev.map((item) => {
        if (selectedIds.length > 0 && !selectedIds.includes(item.id)) return item;
        return {
          ...item,
          tuition: type === 'tuition' && val !== 0 ? val : item.tuition,
          textbookFee: type === 'textbook' && val !== 0 ? val : item.textbookFee,
          materialFee: type === 'material' && val !== 0 ? val : item.materialFee,
        };
      })
    );
  };

  const handleSaveFeeEdits = async () => {
    const nextEnrollments = enrollments.map((e) => {
      const found = editableEnrollments.find((item) => item.id === e.id);
      return found ? found : e;
    });
    setEnrollments(nextEnrollments);
    await saveAfterschoolEnrollmentsBatch(editableEnrollments);
    setIsFeeEditMode(false);
    alert('강의료/교재비/재료비 저장이 완료되었습니다.');
  };

  // 수강생 명단 엑셀 다운로드
  const handleDownloadStudentRoster = () => {
    const listToExport = selectedCourseId === 'all'
      ? enrollments
      : enrollments.filter((e) => e.courseId === selectedCourseId);

    if (listToExport.length === 0) {
      alert('다운로드할 수강생 데이터가 없습니다.');
      return;
    }

    const courseObj = courses.find((c) => c.id === selectedCourseId);
    const title = courseObj ? `${courseObj.title}` : '2026학년도_전체방과후';

    const enrichedList = listToExport.map((item) => {
      const fareDetails = getStudentBusFareDetails(item);
      const matched = getMatchedCourse(item);
      const effTuition = getStudentTuitionFee(item, matched);
      return {
        ...item,
        busFee: fareDetails.fare,
        tuition: effTuition,
        destinationName: fareDetails.destinationName,
      };
    });

    exportEnrollmentsToExcel(enrichedList, title, courses);
  };

  return (
    <div className="space-y-1.5 sm:space-y-2 min-w-0 w-full overflow-hidden">
      {/* Course Selector Header & Action Buttons Toolbar */}
      <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5 min-w-0 w-full overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 min-w-0 w-full">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
            <label className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight shrink-0 whitespace-nowrap">
              강좌 선택
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="flex-1 min-w-0 text-xs sm:text-sm font-bold text-slate-800 border-2 border-blue-500 rounded-lg sm:rounded-xl px-2 py-1.5 sm:px-2.5 sm:py-1.5 bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer transition truncate"
            >
              <option value="all">{t('afterschool.teacher.all_courses_select')}</option>
              {sortedCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.period})
                </option>
              ))}
            </select>
          </div>

          {/* 주요 수강생 일괄 등록 & 명단/양식 다운로드 액션 버튼 바 */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 shrink-0">
            {/* 수강료 알림 관리 버튼 (아이콘 제거, 간결한 라벨) */}
            <button
              type="button"
              onClick={() => setIsAfterschoolBillingModalOpen(true)}
              disabled={enrollments.length === 0}
              className="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-center shadow-sm whitespace-nowrap disabled:opacity-50 cursor-pointer"
              title="수강 확정생들의 수강료/버스비를 확인하고 학부모 서비스로 수강 확정 알림을 발송합니다."
            >
              <span>수강료 알림</span>
            </button>

            <button
              type="button"
              onClick={handleSyncBusAndPhoneInfo}
              disabled={isSyncingBusInfo || enrollments.length === 0}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 px-2 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs whitespace-nowrap disabled:opacity-50"
              title="스쿨버스 명단과 대조하여 비어있는 스쿨버스 번호와 학부모 연락처를 일괄 자동 동기화합니다."
            >
              <RefreshCw className={`w-3 h-3 text-blue-600 shrink-0 ${isSyncingBusInfo ? 'animate-spin' : ''}`} />
              <span className="whitespace-nowrap">{isSyncingBusInfo ? '동기화 중...' : '스쿨버스 연동'}</span>
            </button>

            {/* 수강생 명단 엑셀 다운로드 버튼 */}
            <button
              type="button"
              onClick={handleDownloadStudentRoster}
              disabled={enrollments.length === 0}
              className="bg-teal-600 hover:bg-teal-700 text-white px-2 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs whitespace-nowrap disabled:opacity-50"
              title="현재 선택된 강좌(또는 전체)의 수강생 명단을 엑셀 파일로 다운로드합니다."
            >
              <Download className="w-3 h-3 shrink-0" />
              <span className="whitespace-nowrap">명단 다운</span>
            </button>

            <button
              type="button"
              onClick={downloadSampleExcel}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs whitespace-nowrap"
              title="일괄등록 양식 다운로드 (필수 항목: 학년, 반, 번호, 이름, 강좌명)"
            >
              <Download className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="whitespace-nowrap">양식 다운</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkImportModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3 h-3 shrink-0" />
              <span className="whitespace-nowrap">일괄 등록</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchStudentName('');
                setFoundStudents([]);
                setSelectedStudentToRegister(null);
                setRegModalCourseId(selectedCourseId !== 'all' ? selectedCourseId : (sortedCourses[0]?.id || ''));
                setRegGrade('1');
                setRegClassNum('1');
                setRegStudentNum('');
                setRegName('');
                setRegParentPhone('');
                setRegNeedsBus(false);
                setIsRegisterModalOpen(true);
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 whitespace-nowrap"
              title="개별 등록"
            >
              <UserPlus className="w-3 h-3 text-slate-600 shrink-0" />
              <span className="whitespace-nowrap">개별 등록</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== 서브 탭 (수강 확정생 vs 신청 대기자) ===== */}
      <div className="grid grid-cols-2 border-b border-slate-200 bg-white rounded-t-xl p-1 gap-1 min-w-0 w-full">
        <button
          onClick={() => handleTabChange('enrolled')}
          className={`py-2 px-1.5 sm:px-4 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1 sm:gap-2 rounded-t-lg min-w-0 ${
            studentViewTab === 'enrolled'
              ? 'border-blue-600 text-blue-600 bg-blue-50/70'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="truncate">{t('afterschool.teacher.tab_enrolled')}</span>
          <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black shrink-0">
            {courseEnrollments.length}{t('afterschool.teacher.person_count')}
          </span>
        </button>
        <button
          onClick={() => handleTabChange('waiting')}
          className={`py-2 px-1.5 sm:px-4 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1 sm:gap-2 rounded-t-lg min-w-0 ${
            studentViewTab === 'waiting'
              ? 'border-amber-600 text-amber-700 bg-amber-50/70 ring-1 sm:ring-2 ring-amber-300'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="truncate">{t('afterschool.teacher.tab_waiting')}</span>
          <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black shrink-0">
            {sortedWaitingList.length}{t('afterschool.teacher.person_count')}
          </span>
        </button>
      </div>

      {/* Filters & Bulk Operations Toolbar */}
      <div className="bg-slate-100 p-2 sm:p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs min-w-0 w-full overflow-hidden">
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 sm:gap-2 min-w-0 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-white px-1.5 sm:px-2 py-1 rounded-lg border border-slate-300 min-w-0">
            <span className="font-semibold text-slate-600 text-[10px] sm:text-xs shrink-0">학년:</span>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="bg-transparent font-bold focus:outline-none text-[10px] sm:text-xs w-full cursor-pointer"
            >
              <option value="all">전체</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-white px-1.5 sm:px-2 py-1 rounded-lg border border-slate-300 min-w-0">
            <span className="font-semibold text-slate-600 text-[10px] sm:text-xs shrink-0">반:</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-transparent font-bold focus:outline-none text-[10px] sm:text-xs w-full cursor-pointer"
            >
              <option value="all">전체</option>
              <option value="1">1반</option>
              <option value="2">2반</option>
              <option value="3">3반</option>
            </select>
          </div>

          <div className="relative min-w-0 flex items-center">
            <input
              type="text"
              placeholder="이름 검색 (엔터)"
              value={nameSearchInput}
              onChange={(e) => {
                setNameSearchInput(e.target.value);
                if (!e.target.value) setActiveSearchKeyword('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setActiveSearchKeyword(nameSearchInput);
                }
              }}
              className="bg-white pl-5 sm:pl-6 pr-12 py-1 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 text-[10px] sm:text-xs w-full"
            />
            <Search className="w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {nameSearchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setNameSearchInput('');
                    setActiveSearchKeyword('');
                  }}
                  className="p-0.5 text-slate-400 hover:text-slate-600 rounded focus:outline-none"
                  title="검색어 지우기"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveSearchKeyword(nameSearchInput)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded transition shadow-2xs"
                title="엔터 또는 검색 버튼 클릭"
              >
                검색
              </button>
            </div>
          </div>
        </div>

        {/* Bulk delete / purge actions */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200">
          <span className="text-slate-500 font-medium text-[11px]">
            선택: <b className="text-blue-600">{selectedIds.length}</b>명
          </span>
          <button
            type="button"
            onClick={handleBulkDelete}
            className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1 text-[11px]"
          >
            <Trash2 className="w-3 h-3" />
            선택삭제
          </button>
          <button
            type="button"
            onClick={handlePurgeAllEnrollments}
            disabled={isPurging || enrollments.length === 0}
            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold px-2 py-1 rounded-lg transition flex items-center gap-1 text-[11px] disabled:opacity-40"
            title="기존 등록된 모든 수강생 데이터 전체 삭제"
          >
            <RotateCcw className="w-3 h-3 text-red-500" />
            {isPurging ? '비우는 중...' : '전체 비우기'}
          </button>
        </div>
      </div>

      {/* ===== TAB 1: 수강 확정생 목록 ===== */}
      {studentViewTab === 'enrolled' && (!isFeeEditMode ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-600 border-collapse">
              <thead className="text-slate-700 uppercase bg-slate-100 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-2 text-center w-8">
                    <button onClick={handleSelectAll} className="focus:outline-none">
                      {selectedIds.length === filteredEnrollments.length &&
                      filteredEnrollments.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-2 text-center w-10">연번</th>
                  <th className="py-2.5 px-2 text-center w-10">학년</th>
                  <th className="py-2.5 px-2 text-center w-10">반</th>
                  <th className="py-2.5 px-2 text-center w-10">번호</th>
                  <th className="py-2.5 px-2 font-bold text-slate-900 w-24">이름</th>
                  {selectedCourseId === 'all' && <th className="py-2.5 px-2 w-32">강좌명</th>}
                  <th className="py-2.5 px-2 w-28">학부모연락처</th>
                  <th className="py-2.5 px-2 text-center w-24">스쿨버스 신청</th>
                  <th className="py-2.5 px-2 text-center w-24">강좌 이동</th>
                  <th className="py-2.5 px-2 text-center w-28">스쿨버스 목적지</th>
                  <th className="py-2.5 px-2 text-center w-28 bg-emerald-50 text-emerald-800">방과후버스 배정</th>
                  <th className="py-2.5 px-2 text-right w-24">스쿨버스비</th>
                  <th className="py-2.5 px-2 text-right w-24">강의료</th>
                  <th className="py-2.5 px-2 text-center w-36">수강 요일</th>
                  <th className="py-2.5 px-2 text-center w-24">등록일자</th>
                  <th className="py-2.5 px-2 text-center w-20">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEnrollments.length === 0 ? (
                  <tr>
                    <td colSpan={selectedCourseId === 'all' ? 17 : 16} className="py-12 text-center text-slate-400">
                      수강 확정된 학생이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredEnrollments.map((item, idx) => {
                    const matchedCourse = getMatchedCourse(item);
                    const fareDetails = getStudentBusFareDetails(item);
                    const destText = fareDetails.destinationName === '목적지 미지정' ? '미지정' : fareDetails.destinationName;
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-blue-50/50 transition ${
                          selectedIds.includes(item.id) ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => handleSelectOne(item.id)}
                            className="focus:outline-none"
                          >
                            {selectedIds.includes(item.id) ? (
                              <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        </td>
                        <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px]">
                          {item.yearNo || idx + 1}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-slate-700 text-[11px]">{item.grade}</td>
                        <td className="py-2 px-2 text-center text-[11px]">{item.classNum}</td>
                        <td className="py-2 px-2 text-center text-[11px]">{item.studentNum}</td>
                        <td className="py-2 px-2 font-bold text-slate-900 text-xs whitespace-nowrap">{item.name}</td>
                        {(() => {
                          const matchedCourse = getMatchedCourse(item);
                          const courseTitle = matchedCourse
                            ? ((matchedCourse.title || (matchedCourse as any).name || '').split(' (')[0])
                            : '강좌 미확인';

                          const busInfo = resolveStudentBusInfo(item.name, item.grade, item.classNum, item.studentNum);
                          const displayParentPhone = item.parentPhone || busInfo?.parentPhone || '-';

                          return (
                            <>
                              {selectedCourseId === 'all' && (
                                <td className="py-2 px-2 text-slate-800 font-semibold text-[11px] max-w-[120px] truncate" title={matchedCourse?.title || '강좌 미확인'}>
                                  {matchedCourse ? (
                                    <span className="text-slate-800">{courseTitle}</span>
                                  ) : (
                                    <span className="text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded text-[10px]">강좌 미확인</span>
                                  )}
                                </td>
                              )}
                              <td className="py-2 px-2 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                {displayParentPhone}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <select
                                  value={fareDetails.isBusApplied ? '신청' : '미신청'}
                                  onChange={(e) => {
                                    const isApply = e.target.value === '신청';
                                    const updatedItem = {
                                      ...item,
                                      needsBus: isApply,
                                      kisbusNo: isApply ? '신청' : '-',
                                    };
                                    setEnrollments((prev) =>
                                      prev.map((en) => (en.id === item.id ? updatedItem : en))
                                    );
                                    saveAfterschoolEnrollment(updatedItem).catch(console.error);
                                  }}
                                  className={`border px-2 py-0.5 rounded text-[11px] cursor-pointer font-bold focus:outline-none transition ${
                                    fareDetails.isBusApplied
                                      ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  <option value="신청">신청</option>
                                  <option value="미신청">미신청</option>
                                </select>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <select
                                  value={matchedCourse ? matchedCourse.id : ''}
                                  onChange={(e) => {
                                    const nextCourseId = e.target.value;
                                    if (!nextCourseId) return;
                                    const nextCourse = courses.find((c) => c.id === nextCourseId);
                                    if (!nextCourse) return;
                                    if (
                                      confirm(
                                        `'${item.name}' 학생을 '${nextCourse.title}' 강좌로 이동시키겠습니까?`
                                      )
                                    ) {
                                      const updated = {
                                        ...item,
                                        courseId: nextCourseId,
                                        tuition: nextCourse.tuition,
                                        textbookFee: nextCourse.textbookFee,
                                        materialFee: nextCourse.materialFee,
                                      };
                                      setEnrollments((prev) =>
                                        prev.map((en) => (en.id === item.id ? updated : en))
                                      );
                                      saveAfterschoolEnrollment(updated).catch(console.error);
                                      alert('강좌 이동이 완료되었습니다.');
                                    }
                                  }}
                                  className={`border p-0.5 rounded text-[11px] cursor-pointer max-w-[110px] focus:outline-none ${
                                    matchedCourse
                                      ? 'bg-white text-slate-700 font-medium border-slate-200'
                                      : 'bg-amber-50 text-amber-800 font-bold border-amber-300'
                                  }`}
                                >
                                  {!matchedCourse && (
                                    <option value="">— 강좌 선택 —</option>
                                  )}
                                  {courses.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {((c as any).title || (c as any).name || '').split(' (')[0]}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </>
                          );
                        })()}
                        <td className="py-2 px-2 text-center">
                          {fareDetails.isBusApplied ? (
                            <>
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-bold block whitespace-nowrap text-[10px]" title={fareDetails.destinationName}>
                                {destText}
                              </span>
                              {fareDetails.isSaturday && (
                                <span className="text-[9px] text-slate-400 block mt-0.5 whitespace-nowrap">
                                  ({(fareDetails.zone || '').split(' (')[0]})
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400 font-medium text-[10px]">-</span>
                          )}
                        </td>

                        {/* ─── 방과후버스 배정 셀 ─── */}
                        <td className="py-2 px-2 text-center bg-emerald-50/40">
                          {(() => {
                            if (!fareDetails.isBusApplied) {
                              return <span className="text-slate-400 text-[11px] font-medium">미신청</span>;
                            }

                            const busInfo = resolveStudentBusInfo(item.name, item.grade, item.classNum, item.studentNum);
                            const afterSchoolBus = item.afterSchoolBusNo || busInfo?.afterSchoolBusNo;

                            if (afterSchoolBus && afterSchoolBus !== '-' && afterSchoolBus !== '미신청' && afterSchoolBus !== '미배정') {
                              return (
                                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap inline-flex items-center gap-1 border border-emerald-300 shadow-2xs">
                                  <Bus className="w-3 h-3 text-emerald-600 shrink-0" />
                                  {afterSchoolBus}
                                </span>
                              );
                            }

                            return (
                              <span className="bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap inline-flex items-center border border-amber-200" title="스쿨버스 관리자가 아직 방과후 좌석을 배정하지 않았습니다.">
                                미배정
                              </span>
                            );
                          })()}
                        </td>

                        <td className="py-2 px-2 text-right font-bold text-indigo-700 font-mono text-[11px] whitespace-nowrap">
                          {getFareLabel(fareDetails.fare)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-800 text-[11px] whitespace-nowrap">
                          {getFareLabel(getStudentTuitionFee(item, matchedCourse))}
                        </td>
                        <td className="py-1.5 px-2 text-center whitespace-nowrap">
                          {(() => {
                            let days = matchedCourse?.classDays || [];
                            if (days.length === 0 && matchedCourse?.title) {
                              const match = matchedCourse.title.match(/\(([월화수목금토일, ]+)\)/);
                              if (match) {
                                days = match[1].split(',').map(d => d.trim()).filter(Boolean);
                              }
                            }

                            if (days.length >= 2) {
                              const currentVal = item.selectedDays && item.selectedDays.length === 1 ? item.selectedDays[0] : 'all';
                              return (
                                <select
                                  value={currentVal}
                                  onChange={(e) => {
                                    const val = e.target.value === 'all' ? '' : e.target.value;
                                    handleSelectedDaysChange(item.id, val);
                                  }}
                                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${
                                    currentVal !== 'all'
                                      ? 'bg-amber-50 text-amber-800 border-amber-300 font-black'
                                      : 'bg-white text-slate-700 border-slate-300'
                                  } focus:outline-none cursor-pointer`}
                                  title="주 2회 강좌 중 특정 요일만 수강(주 1회) 선택 시 강의료가 50%로 자동 감액됩니다."
                                >
                                  <option value="all">전체 (주{days.length}회)</option>
                                  {days.map((d) => (
                                    <option key={d} value={d}>
                                      {d}요일만 (주1회, 50%)
                                    </option>
                                  ))}
                                </select>
                              );
                            }

                            const singleDay = days[0] || (matchedCourse?.period ? matchedCourse.period.slice(0, 1) : '');
                            return (
                              <span className="text-[11px] text-slate-400 font-medium">
                                {singleDay ? `주1회 (${singleDay})` : '주1회'}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-[10px] text-slate-400 whitespace-nowrap" title={item.registrationDate}>
                          {item.registrationDate ? item.registrationDate.split(' ')[0] : '-'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => handleCancelEnrollmentWithPromotion(item.id)}
                            className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold px-2 py-0.5 rounded text-[11px] transition shrink-0"
                            title="수강 취소 처리 및 1순위 대기자 자동 승격"
                          >
                            취소
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Fee Batch Edit Screen (매뉴얼 2.4 페이지 5~6) */
        <div className="bg-white rounded-xl border-2 border-emerald-500 shadow-lg p-6 space-y-4">
          <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-lg border border-emerald-200">
            <div>
              <h3 className="font-bold text-emerald-900 text-base">
                강의료 / 교재비 / 재료비 일괄 수정 모드
              </h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                체크박스로 학생을 선택 후 하단 입력란에 금액을 작성하여 [적용 ▲]을 누르면 편리하게 일괄
                입력됩니다.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsFeeEditMode(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-xs font-bold"
              >
                취소
              </button>
              <button
                onClick={handleSaveFeeEdits}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold shadow flex items-center gap-1"
              >
                <Save className="w-4 h-4" />
                전체수정 저장
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-600">
              <thead className="text-slate-700 uppercase bg-slate-100 font-bold border-b">
                <tr>
                  <th className="py-3 px-3 text-center">선택</th>
                  <th className="py-3 px-3 text-center">학년</th>
                  <th className="py-3 px-3 text-center">반</th>
                  <th className="py-3 px-3 text-center">번호</th>
                  <th className="py-3 px-3">이름</th>
                  <th className="py-3 px-3 text-center">강의료 (VND)</th>
                  <th className="py-3 px-3 text-center">교재비 (VND)</th>
                  <th className="py-3 px-3 text-center">재료비 (VND)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {editableEnrollments.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-center">
                      <button onClick={() => handleSelectOne(item.id)}>
                        {selectedIds.includes(item.id) ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </td>
                    <td className="py-2 px-3 text-center">{item.grade}</td>
                    <td className="py-2 px-3 text-center">{item.classNum}</td>
                    <td className="py-2 px-3 text-center">{item.studentNum}</td>
                    <td className="py-2 px-3 font-bold text-slate-800">{item.name}</td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        value={item.tuition}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditableEnrollments((prev) =>
                            prev.map((p) => (p.id === item.id ? { ...p, tuition: val } : p))
                          );
                        }}
                        className="w-24 text-right p-1 border border-slate-300 rounded font-mono font-bold"
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        value={item.textbookFee}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditableEnrollments((prev) =>
                            prev.map((p) => (p.id === item.id ? { ...p, textbookFee: val } : p))
                          );
                        }}
                        className="w-24 text-right p-1 border border-slate-300 rounded font-mono"
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        value={item.materialFee}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditableEnrollments((prev) =>
                            prev.map((p) => (p.id === item.id ? { ...p, materialFee: val } : p))
                          );
                        }}
                        className="w-24 text-right p-1 border border-slate-300 rounded font-mono"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Convenient Bulk Inputs Toolbar (매뉴얼 6페이지 핵심) */}
          <div className="bg-slate-100 p-4 rounded-xl border border-slate-300 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded text-xs font-bold text-slate-700"
              >
                {selectedIds.length === editableEnrollments.length ? '전체 해제' : '전체 선택/취소'}
              </button>
              <span className="text-slate-500 font-medium">
                (체크된 학생에게 일괄 적용됩니다)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-700">강의료:</span>
                <input
                  type="number"
                  placeholder="예: 28000"
                  value={bulkTuition}
                  onChange={(e) => setBulkTuition(e.target.value ? Number(e.target.value) : '')}
                  className="w-24 p-1 text-right border rounded font-mono text-xs"
                />
                <button
                  onClick={() => handleApplyFeeBulkToAll('tuition')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2 py-1 rounded"
                >
                  [ 적용 ▲ ]
                </button>
              </div>

              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-700">교재비:</span>
                <input
                  type="number"
                  placeholder="예: 10000"
                  value={bulkTextbook}
                  onChange={(e) => setBulkTextbook(e.target.value ? Number(e.target.value) : '')}
                  className="w-24 p-1 text-right border rounded font-mono text-xs"
                />
                <button
                  onClick={() => handleApplyFeeBulkToAll('textbook')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2 py-1 rounded"
                >
                  [ 적용 ▲ ]
                </button>
              </div>

              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-700">재료비:</span>
                <input
                  type="number"
                  placeholder="예: 0"
                  value={bulkMaterial}
                  onChange={(e) => setBulkMaterial(e.target.value ? Number(e.target.value) : '')}
                  className="w-24 p-1 text-right border rounded font-mono text-xs"
                />
                <button
                  onClick={() => handleApplyFeeBulkToAll('material')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2 py-1 rounded"
                >
                  [ 적용 ▲ ]
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* ===== TAB 2: 신청 대기자 목록 ===== */}
      {studentViewTab === 'waiting' && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
            <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <span>신청 대기자 명단 (접수 순서대로 선착순 정렬됨)</span>
            </div>
            {sortedWaitingList.length > 0 && (
              <button
                onClick={() => handlePromoteWaitingStudent(sortedWaitingList[0].id)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                1순위 대기자 [{sortedWaitingList[0].name}] 확정 승격
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-600">
              <thead className="text-slate-700 uppercase bg-amber-100/60 font-bold border-b border-amber-200">
                <tr>
                  <th className="py-3 px-2 text-center w-8">
                    <button onClick={handleSelectAll} className="focus:outline-none">
                      {selectedIds.length === filteredWaitingEnrollments.length &&
                      filteredWaitingEnrollments.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-amber-700" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-3 text-center w-16">대기 순위</th>
                  <th className="py-3 px-3">신청 일시</th>
                  <th className="py-3 px-3">학적(학년-반-번호)</th>
                  {selectedCourseId === 'all' && <th className="py-3 px-3">신청 강좌명</th>}
                  <th className="py-3 px-3 font-bold text-slate-900">대기 학생 이름</th>
                  <th className="py-3 px-3">학부모 연락처</th>
                  <th className="py-3 px-3">신청 상태</th>
                  <th className="py-3 px-3 text-center">관리 (확정 승격 / 대기 취소)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWaitingEnrollments.length === 0 ? (
                  <tr>
                    <td colSpan={selectedCourseId === 'all' ? 9 : 8} className="py-12 text-center text-slate-400">
                      현재 대기 중인 신청자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredWaitingEnrollments.map((item, idx) => {
                    const isFirstRank = idx === 0;
                    return (
                      <tr key={item.id} className={`hover:bg-amber-50/50 transition ${isFirstRank ? 'bg-amber-50/80 font-semibold' : ''} ${selectedIds.includes(item.id) ? 'bg-amber-100/60' : ''}`}>
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => handleSelectOne(item.id)}
                            className="focus:outline-none"
                          >
                            {selectedIds.includes(item.id) ? (
                              <CheckSquare className="w-3.5 h-3.5 text-amber-700" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                            isFirstRank ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {idx + 1}순위
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500">
                          {item.registrationDate || '-'}
                        </td>
                        <td className="py-3 px-3 font-medium">
                          {item.grade}학년 {item.classNum}반 {item.studentNum}번
                        </td>
                        {selectedCourseId === 'all' && (() => {
                          const matchedCourse = getMatchedCourse(item);
                          const courseTitle = matchedCourse
                            ? ((matchedCourse.title || (matchedCourse as any).name || '').split(' (')[0])
                            : '강좌 미확인';
                          return (
                            <td className="py-3 px-3 text-slate-800 font-semibold max-w-[120px] truncate" title={matchedCourse?.title || '강좌 미확인'}>
                              {matchedCourse ? (
                                <span className="text-slate-800">{courseTitle}</span>
                              ) : (
                                <span className="text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded text-[10px]">강좌 미확인</span>
                              )}
                            </td>
                          );
                        })()}
                        <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {item.name}
                        </td>
                        <td className="py-3 px-3 font-mono">{item.parentPhone}</td>
                        <td className="py-3 px-3">
                          <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[11px]">
                            대기 신청
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center flex items-center justify-center gap-2">
                          <button
                            onClick={() => handlePromoteWaitingStudent(item.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[11px] shadow-sm transition"
                          >
                            확정 승격
                          </button>
                          <button
                            onClick={() => handleDeleteSingle(item.id)}
                            className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold px-2.5 py-1 rounded text-[11px] transition"
                          >
                            대기 취소
                          </button>
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

      {/* Modal 1: Single Student Register */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-blue-600 text-white px-5 py-3.5 flex justify-between items-center">
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                수강생 개별 직접 등록
              </h3>
              <button onClick={() => setIsRegisterModalOpen(false)} className="text-white hover:text-slate-200 font-bold text-lg">
                &times;
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              {/* 등록 대상 강좌 선택 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  배정 강좌 선택 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={regModalCourseId}
                  onChange={(e) => setRegModalCourseId(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 border-2 border-blue-400 rounded-lg p-2 bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.period}) - {c.instructorName || '강사'}
                    </option>
                  ))}
                </select>
              </div>

              {/* 등록 구분 (수강 확정 vs 대기자) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  등록 상태 구분 <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold">
                  <label className="flex items-center gap-2 cursor-pointer text-blue-700 p-1 rounded hover:bg-blue-50">
                    <input
                      type="radio"
                      name="regStatus"
                      checked={registerStatusTarget === 'ENROLLED'}
                      onChange={() => setRegisterStatusTarget('ENROLLED')}
                    />
                    <span>수강 확정생</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-amber-700 p-1 rounded hover:bg-amber-50">
                    <input
                      type="radio"
                      name="regStatus"
                      checked={registerStatusTarget === 'WAITING'}
                      onChange={() => setRegisterStatusTarget('WAITING')}
                    />
                    <span>신청 대기자</span>
                  </label>
                </div>
              </div>

              {/* 학생 마스터 검색으로 자동 채우기 */}
              <div className="border-t pt-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  기존 학생 검색으로 정보 불러오기 (선택)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="이름 검색..."
                    value={searchStudentName}
                    onChange={(e) => setSearchStudentName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearchStudent(); }}
                    className="flex-1 border p-1.5 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleSearchStudent}
                    className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
                  >
                    검색
                  </button>
                </div>

                {foundStudents.length > 0 && (
                  <div className="border rounded-lg overflow-hidden max-h-32 overflow-y-auto mt-2 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-[11px]">
                        <tr>
                          <th className="p-1.5">학년/반/번호</th>
                          <th className="p-1.5">이름</th>
                          <th className="p-1.5 text-center">선택</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {foundStudents.map((st) => (
                          <tr key={st.id} className="hover:bg-blue-50/50">
                            <td className="p-1.5">{st.grade}학년 {st.classNum}반 {st.studentNum}번</td>
                            <td className="p-1.5 font-bold">{st.name}</td>
                            <td className="p-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudentToRegister(st);
                                  setRegGrade(String(st.grade));
                                  setRegClassNum(String(st.classNum));
                                  setRegStudentNum(String(st.studentNum || ''));
                                  setRegName(st.name);
                                  setRegParentPhone(st.parentPhone || '');
                                }}
                                className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded font-bold text-[11px]"
                              >
                                채우기
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 학생 정보 직접 입력 폼 */}
              <div className="border-t pt-3 space-y-2.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <span>학생 인적사항 입력</span>
                  <span className="text-slate-400 font-normal">(직접 수정 가능)</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">학년 <span className="text-rose-500">*</span></label>
                    <select
                      value={regGrade}
                      onChange={(e) => setRegGrade(e.target.value)}
                      className="w-full border p-1.5 rounded-lg text-xs font-bold"
                    >
                      {[1, 2, 3, 4, 5, 6].map(g => (
                        <option key={g} value={g}>{g}학년</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">반 <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={regClassNum}
                      onChange={(e) => setRegClassNum(e.target.value)}
                      className="w-full border p-1.5 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">번호</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      placeholder="번호"
                      value={regStudentNum}
                      onChange={(e) => setRegStudentNum(e.target.value)}
                      className="w-full border p-1.5 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">이름 <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      placeholder="학생 이름"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full border p-1.5 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">학부모 연락처</label>
                    <input
                      type="text"
                      placeholder="010-0000-0000"
                      value={regParentPhone}
                      onChange={(e) => setRegParentPhone(e.target.value)}
                      className="w-full border p-1.5 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">스쿨버스 신청 여부</span>
                  <select
                    value={regNeedsBus ? '신청' : '미신청'}
                    onChange={(e) => setRegNeedsBus(e.target.value === '신청')}
                    className="border px-2 py-1 rounded text-xs font-bold bg-white"
                  >
                    <option value="신청">신청</option>
                    <option value="미신청">미신청</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={!regName.trim()}
                  onClick={handleCompleteRegisterStudent}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow transition"
                >
                  등록 완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Bulk Excel Import */}
      {isBulkImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-5 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-200" />
                <span>강좌별 수강생 일괄 등록 (엑셀)</span>
              </h3>
              <button 
                onClick={() => setIsBulkImportModalOpen(false)} 
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 w-7 h-7 rounded-lg flex items-center justify-center font-bold transition"
              >
                &times;
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-indigo-50/80 p-4 rounded-xl border border-indigo-200 text-xs text-indigo-950 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-indigo-600" />
                    <span>표준 엑셀 양식 다운로드</span>
                  </span>
                  <button
                    onClick={downloadSampleExcel}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    양식 다운로드 (.xlsx)
                  </button>
                </div>
                
                <div className="space-y-1.5 pt-1 text-[11px] text-slate-700 border-t border-indigo-200/60">
                  <p className="font-bold text-indigo-900 flex items-center gap-1">
                    <span>📌 필수 입력 컬럼:</span>
                    <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-mono text-[11px]">
                      학년, 반, 번호, 이름, 강좌명
                    </span>
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    • <b>다중 강좌 수강 지원</b>: 1명의 학생이 여러 강좌를 수강할 경우 행을 추가하여 여러 번 입력(중복 입력) 가능합니다.
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    • <b>스쿨버스 번호 자동 참조</b>: 기존 스쿨버스 명단에 등록된 학생은 스쿨버스 번호가 자동으로 대조·배정됩니다.
                  </p>
                </div>
              </div>

              {/* ─── 업로드 등록 모드 선택 ─── */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>⚙️ 등록 방식 선택</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition ${
                    bulkUploadMode === 'replace' 
                      ? 'bg-indigo-50/80 border-indigo-300 text-indigo-900 font-bold shadow-2xs' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="bulkUploadMode"
                      value="replace"
                      checked={bulkUploadMode === 'replace'}
                      onChange={() => setBulkUploadMode('replace')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-indigo-700">전체 새로 덮어쓰기 (권장)</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                        기존의 구 수강생 명단을 비우고 이 파일 데이터로 완전히 교체합니다.
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition ${
                    bulkUploadMode === 'append' 
                      ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-bold shadow-2xs' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="bulkUploadMode"
                      value="append"
                      checked={bulkUploadMode === 'append'}
                      onChange={() => setBulkUploadMode('append')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-blue-700">기존 명단에 추가</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                        기존 등록된 수강생들을 유지하고 새 학생들을 뒤에 누적합니다.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/30 p-6 rounded-2xl text-center transition cursor-pointer">
                <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <p className="text-xs text-slate-700 font-bold mb-1">
                  작성 완료한 엑셀 파일(.xlsx, .xls)을 선택하세요
                </p>
                <p className="text-[11px] text-slate-400 mb-3">
                  {bulkUploadMode === 'replace' ? '기존 명단 비운 후 새로 등록됩니다.' : '기존 명단에 누적 등록됩니다.'}
                </p>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleBulkFileUpload}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer cursor-pointer"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsBulkImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Additional/Cancelled View (매뉴얼 2.5) */}
      {isAddCancelModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden">
            <div className="bg-indigo-600 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-base">추가 / 취소자 조회 (매뉴얼 2.5)</h3>
              <button onClick={() => setIsAddCancelModalOpen(false)} className="text-white font-bold">
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                현재 강좌(<b>{currentCourse.title}</b>)의 신규 추가 수강생과 수강 취소 내역을 별도로
                조회 및 엑셀로 다운로드받습니다.
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const enrollmentsWithBusFare = courseEnrollments.map(item => {
                      const fareDetails = getStudentBusFareDetails(item);
                      return {
                        ...item,
                        busFee: fareDetails.fare,
                        destinationName: fareDetails.destinationName,
                        zone: fareDetails.zone,
                        currency: busFareCurrency
                      };
                    });
                    downloadAddCancelExcel(enrollmentsWithBusFare, [], currentCourse.title);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Download className="w-4 h-4" />
                  조회결과출력 (엑셀 다운로드)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: School Banking Export Options (매뉴얼 2.6) */}
      {isSchoolBankingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-purple-600 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-base">행정실용 에듀파일 스쿨뱅킹 엑셀 출력</h3>
              <button
                onClick={() => setIsSchoolBankingModalOpen(false)}
                className="text-white font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                스쿨뱅킹 처리를 위해 징수 대상 항목을 체크하세요:
              </p>
              <div className="space-y-2 border p-3 rounded-lg">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={bankingOptions.tuition}
                    onChange={(e) =>
                      setBankingOptions({ ...bankingOptions, tuition: e.target.checked })
                    }
                  />
                  강의료 포함
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={bankingOptions.textbook}
                    onChange={(e) =>
                      setBankingOptions({ ...bankingOptions, textbook: e.target.checked })
                    }
                  />
                  교재비 포함
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={bankingOptions.material}
                    onChange={(e) =>
                      setBankingOptions({ ...bankingOptions, material: e.target.checked })
                    }
                  />
                  재료비 포함
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsSchoolBankingModalOpen(false)}
                  className="px-4 py-2 border rounded text-xs"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    const enrollmentsWithBusFare = courseEnrollments.map(item => {
                      const fareDetails = getStudentBusFareDetails(item);
                      return {
                        ...item,
                        busFee: fareDetails.fare,
                        destinationName: fareDetails.destinationName,
                        zone: fareDetails.zone,
                        currency: busFareCurrency
                      };
                    });
                    downloadSchoolBankingExcel(
                      enrollmentsWithBusFare,
                      currentCourse.title,
                      bankingOptions
                    );
                    setIsSchoolBankingModalOpen(false);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white font-bold rounded text-xs shadow"
                >
                  확인 (엑셀 출력 다운로드)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 방과후 버스 배정 모달 ─── */}
      {busTransferModalEnrollmentId && (() => {
        const targetEnrollment = enrollments.find((e) => e.id === busTransferModalEnrollmentId);
        if (!targetEnrollment) return null;
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
              {/* 헤더 */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Bus className="w-5 h-5 text-emerald-600" />
                    방과후 버스 배정
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    하교 버스가 숨김 처리되고 방과후 버스로 이동합니다.
                  </p>
                </div>
                <button
                  onClick={() => setBusTransferModalEnrollmentId(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* 학생 정보 */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="text-xs text-slate-500">대상 학생</div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {targetEnrollment.grade}학년 {targetEnrollment.classNum}반 {targetEnrollment.studentNum}번 {targetEnrollment.name}
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-xs">
                  <span className="text-slate-500">기존 등/하교 버스:</span>
                  <span className="font-bold text-slate-700">{targetEnrollment.kisbusNo || '미신청'}</span>
                  <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">→ 하교 숨김</span>
                </div>
              </div>

              {/* 방과후 버스 번호 선택 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">
                  방과후 버스 번호 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={afterSchoolBusInputNo}
                  onChange={(e) => setAfterSchoolBusInputNo(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="-">— 버스 번호 선택 —</option>
                  {BUS_OPTIONS.map((busNo) => (
                    <option key={busNo} value={busNo}>{busNo}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  ※ 방과후 버스는 등/하교 버스와 별개로 운행됩니다.
                </p>
              </div>

              {/* 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setBusTransferModalEnrollmentId(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition"
                >
                  취소
                </button>
                <button
                  onClick={() => handleAssignAfterSchoolBus(busTransferModalEnrollmentId, afterSchoolBusInputNo)}
                  disabled={isBusTransferLoading || afterSchoolBusInputNo === '-'}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Bus className="w-4 h-4" />
                  {isBusTransferLoading ? '처리 중...' : '방과후 노선으로 이동'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 📋 방과후 수강료 & 버스비 청구서 모달 */}
      <AfterschoolBillingModal
        isOpen={isAfterschoolBillingModalOpen}
        onClose={() => setIsAfterschoolBillingModalOpen(false)}
        enrollments={enrollments}
        courses={courses}
        studentsList={studentsList}
        destinations={destinations}
        saturdayBusFareSettings={saturdayBusFareSettings}
        busFareSettings={busFareSettings}
        busFareCurrency={busFareCurrency}
        teacherApplySettings={teacherApplySettings}
      />
    </div>
  );
};

