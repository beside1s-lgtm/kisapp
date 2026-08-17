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
} from 'lucide-react';
import {
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
import { useTranslation } from '@/hooks/use-translation';
import {
  saveAfterschoolEnrollment,
  saveAfterschoolEnrollmentsBatch,
  deleteAfterschoolEnrollment,
  deleteAfterschoolEnrollmentsBatch,
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
  teacherApplySettings,
}) => {
  const { t } = useTranslation();
  const [busFareSettings, setBusFareSettings] = React.useState<Record<string, number>>({
    'Zone A (근거리)': 50000,
    'Zone B (중거리)': 80000,
    'Zone C (원거리)': 100000
  });
  const [busFareCurrency, setBusFareCurrency] = React.useState<string>('VND');

  React.useEffect(() => {
    getGlobalSettings().then(cfg => {
      if (cfg?.busFareSettings) {
        setBusFareSettings(cfg.busFareSettings);
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

  if (!courses || courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
        <div className="p-3 bg-slate-100 rounded-full text-slate-400 mb-3">
          <UserPlus className="h-8 w-8" />
        </div>
        <p className="text-sm font-bold text-slate-800">배정된 수강 학생이 없습니다.</p>
        <p className="text-xs text-slate-500 mt-1">담당하고 있는 나의 강좌에 등록된 수강생이 존재하지 않습니다.</p>
      </div>
    );
  }

  const currentCourse = selectedCourseId === 'all'
    ? { id: 'all', title: '전체 강좌 수강생', tuition: 0, textbookFee: 0, materialFee: 0, period: '전체 학기' } as any
    : (courses.find((c) => c.id === selectedCourseId) || courses[0]);

  const getStudentBusFareDetails = (enrollment: Enrollment) => {
    if (!enrollment.kisbusNo || enrollment.kisbusNo === '-') {
      return { zone: '미신청', fare: 0, destinationName: '-' };
    }
    const student = studentsList.find(s => 
      s.name === enrollment.name && 
      Number(s.grade) === Number(enrollment.grade) && 
      Number(s.class) === Number(enrollment.classNum)
    );
    if (!student) {
      return { zone: 'Zone C (원거리)', fare: busFareSettings['Zone C (원거리)'] || 100000, destinationName: '목적지 미지정' };
    }
    
    const course = courses.find(c => c.id === enrollment.courseId);
    const dayMap: Record<string, string> = {
      '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday',
      '목': 'Thursday', '금': 'Friday', '토': 'Saturday'
    };
    const firstDay = course?.classDays?.[0];
    const dayOfWeek = firstDay ? (dayMap[firstDay] || 'Saturday') : 'Saturday';
    
    const destId = student.afterSchoolDestinations?.[dayOfWeek as any] || student.afternoonDestinationId;
    if (!destId) {
      return { zone: 'Zone C (원거리)', fare: busFareSettings['Zone C (원거리)'] || 100000, destinationName: '목적지 미지정' };
    }
    
    const destObj = destinations.find(d => d.id === destId);
    const destinationName = destObj ? destObj.name : '목적지 미지정';
    const zone = (destObj && destObj.zone) ? destObj.zone : 'Zone C (원거리)';
    const fare = busFareSettings[zone] !== undefined ? busFareSettings[zone] : 100000;
    
    return { zone, fare, destinationName };
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

  // Filtering / Search
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [nameSearch, setNameSearch] = useState<string>('');

  // Selected Checkboxes for Bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isFeeEditMode, setIsFeeEditMode] = useState(false);
  const [isAddCancelModalOpen, setIsAddCancelModalOpen] = useState(false);
  const [isSchoolBankingModalOpen, setIsSchoolBankingModalOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
    if (nameSearch && !e.name.includes(nameSearch)) return false;
    return true;
  });

  const filteredWaitingEnrollments = sortedWaitingList.filter((e) => {
    if (gradeFilter !== 'all' && e.grade !== Number(gradeFilter)) return false;
    if (classFilter !== 'all' && e.classNum !== Number(classFilter)) return false;
    if (nameSearch && !e.name.includes(nameSearch)) return false;
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

  const handleCompleteRegisterStudent = async () => {
    if (!selectedStudentToRegister) return;
    const newEnrollment: Enrollment = {
      id: `e_${Date.now()}`,
      courseId: currentCourse.id,
      studentId: selectedStudentToRegister.id,
      yearNo: courseEnrollments.length + 1,
      grade: selectedStudentToRegister.grade,
      classNum: selectedStudentToRegister.classNum,
      studentNum: selectedStudentToRegister.studentNum,
      name: selectedStudentToRegister.name,
      phone: selectedStudentToRegister.phone,
      parentPhone: selectedStudentToRegister.parentPhone,
      tuition: currentCourse.tuition,
      textbookFee: currentCourse.textbookFee,
      materialFee: currentCourse.materialFee,
      registrationDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
      status: registerStatusTarget,
    };
    const nextEnrollments = [newEnrollment, ...enrollments];
    setEnrollments(nextEnrollments);
    await saveAfterschoolEnrollment(newEnrollment);
    await syncCourseStudentCounts(currentCourse.id, nextEnrollments);
    setIsRegisterModalOpen(false);
    setSelectedStudentToRegister(null);
    alert(`[${selectedStudentToRegister.name}] 학생이 ${registerStatusTarget === 'ENROLLED' ? '수강 확정생' : '신청 대기자'}로 성공적으로 등록되었습니다.`);
  };

  // Bulk Excel Upload Handler (다중 강좌 일괄 등록 파서)
  const handleBulkFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedStudents = await parseEnrollmentExcel(file);
      if (parsedStudents.length === 0) {
        alert('엑셀 파일에 유효한 수강생 데이터가 없습니다.');
        return;
      }

      let addedCount = 0;
      const newItems: Enrollment[] = [];
      const courseCountMap = new Map<string, number>();

      parsedStudents.forEach((st, idx) => {
        // 1. 엑셀에 강좌명이 명시되어 있으면 띄어쓰기/특수문자를 무시하는 스마트 유연 매칭 적용
        let targetCourse = findMatchingCourse(st.courseTitle, courses);

        // 2. 일치하는 강좌가 없는데 특정 강좌가 선택되어 있는 경우 해당 강좌 사용, 전체 조회인 경우 첫 번째 강좌 사용
        if (!targetCourse && selectedCourseId !== 'all') {
          targetCourse = currentCourse;
        }
        if (!targetCourse) {
          targetCourse = courses[0];
        }

        const courseTitleName = targetCourse?.title || '미지정';
        courseCountMap.set(courseTitleName, (courseCountMap.get(courseTitleName) || 0) + 1);

        const newEnrollment: Enrollment = {
          id: `e_bulk_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
          courseId: targetCourse?.id || currentCourse.id,
          studentId: `s_bulk_${Date.now()}_${idx}`,
          yearNo: courseEnrollments.length + addedCount + 1,
          grade: st.grade,
          classNum: st.classNum,
          studentNum: st.studentNum,
          name: st.name,
          phone: st.phone || '', // 전화번호 미입력 허용
          parentPhone: st.parentPhone || '', // 전화번호 미입력 허용
          kisbusNo: formatBusNo(st.kisbusNo || '-'), // 스쿨버스 신청 정보 (1호차~30호차 등)
          tuition: targetCourse?.tuition || 0,
          textbookFee: targetCourse?.textbookFee || 0,
          materialFee: targetCourse?.materialFee || 0,
          registrationDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
          status: 'ENROLLED',
        };
        newItems.push(newEnrollment);
        addedCount++;
      });

      const nextEnrollments = [...newItems, ...enrollments];
      setEnrollments(nextEnrollments);

      // Firestore DB에 영구 일괄 저장
      await saveAfterschoolEnrollmentsBatch(newItems);

      // 개별 강좌 수강인원 동기화
      const affectedCourseIds = Array.from(new Set(newItems.map((item) => item.courseId)));
      for (const cId of affectedCourseIds) {
        await syncCourseStudentCounts(cId, nextEnrollments);
      }
      
      const courseSummaryText = Array.from(courseCountMap.entries())
        .slice(0, 3)
        .map(([t, count]) => `'${t.split(' (')[0]}': ${count}명`)
        .join(', ');
      const moreText = courseCountMap.size > 3 ? ` 외 ${courseCountMap.size - 3}개 강좌` : '';

      alert(`🎉 다중 강좌 수강생 일괄등록 완료!\n\n- 등록된 총 강좌 수: ${courseCountMap.size}개 강좌\n- 등록된 총 수강생 수: ${addedCount}명\n- 강좌별 배정 현황: ${courseSummaryText}${moreText}`);
      setIsBulkImportModalOpen(false);
    } catch (err: any) {
      alert(`엑셀 파싱 중 오류가 발생했습니다: ${err.message}`);
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

  return (
    <div className="space-y-6">
      {/* Course Selector Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600 shrink-0" />
            <label className="text-sm font-bold text-slate-800 tracking-tight">
              {t('afterschool.teacher.course_select_label')}
            </label>
          </div>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full sm:max-w-md text-sm font-bold text-slate-800 border-2 border-blue-500 rounded-xl px-3.5 py-2 bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer transition"
          >
            <option value="all">{t('afterschool.teacher.all_courses_select')}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.period})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ===== 서브 탭 (수강 확정생 vs 신청 대기자) ===== */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-2 pt-2 gap-2">
        <button
          onClick={() => handleTabChange('enrolled')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            studentViewTab === 'enrolled'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>{t('afterschool.teacher.tab_enrolled')}</span>
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[11px] font-black">
            {courseEnrollments.length}{t('afterschool.teacher.person_count')}
          </span>
        </button>
        <button
          onClick={() => handleTabChange('waiting')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            studentViewTab === 'waiting'
              ? 'border-amber-600 text-amber-600 bg-amber-50/50 rounded-t-lg ring-2 ring-amber-300'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>{t('afterschool.teacher.tab_waiting')}</span>
          <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[11px] font-black">
            {sortedWaitingList.length}{t('afterschool.teacher.person_count')}
          </span>
        </button>
      </div>

      {/* Filters & Bulk Operations Toolbar */}
      <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-300">
            <span className="font-semibold text-slate-600">학년:</span>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="bg-transparent font-bold focus:outline-none"
            >
              <option value="all">전체</option>
              <option value="1">1학년</option>
              <option value="2">2학년</option>
              <option value="3">3학년</option>
              <option value="4">4학년</option>
              <option value="5">5학년</option>
              <option value="6">6학년</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-300">
            <span className="font-semibold text-slate-600">반:</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-transparent font-bold focus:outline-none"
            >
              <option value="all">전체</option>
              <option value="1">1반</option>
              <option value="2">2반</option>
              <option value="3">3반</option>
            </select>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="이름 검색"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              className="bg-white pl-7 pr-3 py-1 border border-slate-300 rounded-md focus:outline-none text-xs w-32"
            />
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Bulk delete / apply actions */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">
            선택된 항목: <b className="text-blue-600">{selectedIds.length}</b>명
          </span>
          <button
            onClick={handleBulkDelete}
            className="bg-rose-100 text-rose-700 hover:bg-rose-200 font-bold px-3 py-1 rounded-md transition flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            일괄삭제
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
                  <th className="py-2.5 px-2 text-center w-20">스쿨버스</th>
                  <th className="py-2.5 px-2 text-center w-24">강좌 이동</th>
                  <th className="py-2.5 px-2 text-center w-28">스쿨버스 목적지</th>
                  <th className="py-2.5 px-2 text-right w-24">스쿨버스비</th>
                  <th className="py-2.5 px-2 text-right w-24">강의료</th>
                  <th className="py-2.5 px-2 text-right w-20">교재비</th>
                  <th className="py-2.5 px-2 text-right w-20">재료비</th>
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
                        {selectedCourseId === 'all' && (
                          <td className="py-2 px-2 text-slate-800 font-semibold text-[11px] max-w-[120px] truncate" title={courses.find((c) => c.id === item.courseId)?.title}>
                            {courses.find((c) => c.id === item.courseId)?.title?.split(' (')[0] || '강좌 미확인'}
                          </td>
                        )}
                        <td className="py-2 px-2 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {item.parentPhone || '-'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <select
                            value={item.kisbusNo || '-'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEnrollments((prev) =>
                                prev.map((en) => (en.id === item.id ? { ...en, kisbusNo: val } : en))
                              );
                            }}
                            className="border p-0.5 rounded bg-white text-[11px] cursor-pointer font-bold text-slate-800 focus:outline-none"
                          >
                            <option value="-">미신청</option>
                            {BUS_OPTIONS.map((busNo) => (
                              <option key={busNo} value={busNo}>
                                {busNo}
                              </option>
                            ))}
                            {item.kisbusNo &&
                              item.kisbusNo !== '-' &&
                              item.kisbusNo !== '미신청' &&
                              !BUS_OPTIONS.includes(item.kisbusNo) && (
                                <option value={item.kisbusNo}>{item.kisbusNo}</option>
                              )}
                          </select>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <select
                            value={item.courseId}
                            onChange={(e) => {
                              const nextCourseId = e.target.value;
                              const nextCourse = courses.find((c) => c.id === nextCourseId);
                              if (!nextCourse) return;
                              if (
                                confirm(
                                  `'${item.name}' 학생을 '${nextCourse.title}' 강좌로 이동시키겠습니까?`
                                )
                              ) {
                                setEnrollments((prev) =>
                                  prev.map((en) =>
                                    en.id === item.id
                                      ? {
                                          ...en,
                                          courseId: nextCourseId,
                                          tuition: nextCourse.tuition,
                                          textbookFee: nextCourse.textbookFee,
                                          materialFee: nextCourse.materialFee,
                                        }
                                      : en
                                  )
                                );
                                alert('강좌 이동이 완료되었습니다.');
                              }
                            }}
                            className="border p-0.5 rounded bg-white text-[11px] cursor-pointer text-slate-600 max-w-[100px] focus:outline-none"
                          >
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {((c as any).title || (c as any).name || '').split(' (')[0]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-bold block whitespace-nowrap text-[10px]" title={fareDetails.destinationName}>
                            {destText}
                          </span>
                          <span className="text-[9px] text-slate-400 block mt-0.5 whitespace-nowrap">
                            ({(fareDetails.zone || '').split(' (')[0]})
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-indigo-700 font-mono text-[11px] whitespace-nowrap">
                          {getFareLabel(fareDetails.fare)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-800 text-[11px] whitespace-nowrap">
                          {getFareLabel(item.tuition)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600 text-[11px] whitespace-nowrap">
                          {getFareLabel(item.textbookFee)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600 text-[11px] whitespace-nowrap">
                          {getFareLabel(item.materialFee)}
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
                        {selectedCourseId === 'all' && (
                          <td className="py-3 px-3 text-slate-800 font-semibold max-w-[120px] truncate" title={courses.find((c) => c.id === item.courseId)?.title}>
                            {courses.find((c) => c.id === item.courseId)?.title?.split(' (')[0] || '강좌 미확인'}
                          </td>
                        )}
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

      {/* Modal 1: Single Student Register (매뉴얼 2.1) */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                신청자 개별 등록 (매뉴얼 2.1)
              </h3>
              <button onClick={() => setIsRegisterModalOpen(false)} className="text-white font-bold">
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 border border-blue-200">
                현재 선택된 강좌: <b>{currentCourse.title}</b>
              </div>

              {/* 등록 대상 구별 (수강 확정 vs 대기자) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  등록 명단 구분 선택
                </label>
                <div className="flex gap-4 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold">
                  <label className="flex items-center gap-1.5 cursor-pointer text-blue-700">
                    <input
                      type="radio"
                      name="regStatus"
                      checked={registerStatusTarget === 'ENROLLED'}
                      onChange={() => setRegisterStatusTarget('ENROLLED')}
                    />
                    <span>수강 확정생으로 등록</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-amber-700">
                    <input
                      type="radio"
                      name="regStatus"
                      checked={registerStatusTarget === 'WAITING'}
                      onChange={() => setRegisterStatusTarget('WAITING')}
                    />
                    <span>신청 대기자로 등록</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  학생 이름으로 검색
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="홍길동 등..."
                    value={searchStudentName}
                    onChange={(e) => setSearchStudentName(e.target.value)}
                    className="flex-1 border p-2 rounded-lg text-sm"
                  />
                  <button
                    onClick={handleSearchStudent}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold"
                  >
                    검색하기
                  </button>
                </div>
              </div>

              {foundStudents.length > 0 && (
                <div className="border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="p-2">학년/반/번호</th>
                        <th className="p-2">이름</th>
                        <th className="p-2 text-center">선택</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foundStudents.map((st) => (
                        <tr key={st.id} className="border-t hover:bg-slate-50">
                          <td className="p-2">
                            {st.grade}학년 {st.classNum}반 {st.studentNum}번
                          </td>
                          <td className="p-2 font-bold">{st.name}</td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => setSelectedStudentToRegister(st)}
                              className={`px-2 py-1 rounded text-xs ${
                                selectedStudentToRegister?.id === st.id
                                  ? 'bg-emerald-600 text-white font-bold'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {selectedStudentToRegister?.id === st.id ? '적용됨 ✓' : '적용'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-medium text-slate-700"
                >
                  취소
                </button>
                <button
                  disabled={!selectedStudentToRegister}
                  onClick={handleCompleteRegisterStudent}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow"
                >
                  작성완료 (등록)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Bulk Excel Import (매뉴얼 2.2) */}
      {isBulkImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="bg-amber-600 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                다중 강좌 수강생 일괄등록
              </h3>
              <button onClick={() => setIsBulkImportModalOpen(false)} className="text-white font-bold text-lg hover:opacity-80">
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50/90 p-3.5 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1">
                    통합 다중 강좌 일괄등록 양식
                  </span>
                  <button
                    onClick={downloadSampleExcel}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    양식 다운로드
                  </button>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  <b>다중 강좌 일괄등록 기능 안내</b>: 엑셀 파일의 <b>'강좌명(필수)'</b> 컬럼에 해당 수강생이 등록될 강좌 이름을 적어주시면, <b>단 하나의 엑셀 양식 파일</b>로 여러 강좌에 수강생을 한 번에 다중 일괄등록하실 수 있습니다. (스쿨버스 노선 및 전화번호 포함 지원)
                </p>
              </div>

              <div className="border-2 border-dashed border-slate-300 p-6 rounded-xl text-center hover:border-amber-500 transition">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-medium mb-1">
                  작성 완료한 엑셀 파일(.xlsx)을 업로드하세요
                </p>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleBulkFileUpload}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200"
                />
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
    </div>
  );
};
