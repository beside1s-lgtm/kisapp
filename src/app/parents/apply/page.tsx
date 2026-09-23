'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createDocument, getStudentFieldTripDays, getStudentAbsenceDays, getDocumentById, submitFieldTripReport } from '@/lib/services/documentService';
import { syncParentApplicationDatesToAttendance } from '@/lib/services/homeroomAttendanceSync';
import { getDocConfig, onDocConfigUpdate } from '@/lib/services/settingsService';
import { getWorkingDaysCount, getExcludedDaysInRange } from '@/lib/utils';
import { useAcademicCalendar } from '@/lib/services/academicCalendarService';
import { getApproversByGradeClass } from '@/lib/services/userService';
import { ParentFormData, ApprovalDoc, DEFAULT_FIELD_TRIP_BLACKOUT_PERIODS, FieldTripBlackoutPeriod, DocConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, ArrowLeft, Home } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

import { MobileFormCard } from '@/components/parents-apply/MobileFormCard';
import { DesktopAbsenceForm } from '@/components/parents-apply/DesktopAbsenceForm';
import { DesktopFieldTripReportForm } from '@/components/parents-apply/DesktopFieldTripReportForm';
import { DesktopFieldTripForm } from '@/components/parents-apply/DesktopFieldTripForm';
import { PinModal } from '@/components/parents-apply/PinModal';
import { ConfirmSubmitModal } from '@/components/parents-apply/ConfirmSubmitModal';

async function hashPIN(pin: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const commonSchema = z.object({
  studentName: z.string().min(1, '학생 이름을 입력해주세요'),
  gradeClassNumber: z.string().min(1, '학년-반-번을 입력해주세요 (예: 1-2-3)'),
});

const absenceSchema = commonSchema.extend({
  type: z.literal('absence'),
  absencePeriod: z.object({
    startDate: z.string().min(1, '시작일을 입력해주세요'),
    endDate: z.string().min(1, '종료일을 입력해주세요'),
    totalDays: z.coerce.number().min(1, '1일 이상이어야 합니다.'),
  }),
  absenceType: z.enum(['병결', '미인정', '기타', '출석인정']),
  absenceReason: z.string().min(1, '결석 사유를 입력해주세요'),
});

const fieldTripSchema = commonSchema.extend({
  type: z.literal('field-trip'),
  phone: z.string().min(1, '휴대폰 번호를 입력해주세요'),
  tripPeriod: z.object({
    startDate: z.string().min(1, '시작일을 입력해주세요'),
    endDate: z.string().min(1, '종료일을 입력해주세요'),
    totalDays: z.coerce.number().min(1, '1일 이상이어야 합니다.'),
  }),
  cumulativeDays: z.coerce.number().min(0, '기존 사용 일수를 입력해주세요 (없으면 0)'),
  tripType: z.enum(['가족동반여행', '친인척 방문', '답사·견학 활동', '체험활동', '기타']),
  destination: z.string().min(1, '방문 장소를 입력해주세요'),
  companionName: z.string().min(1, '동행 보호자명을 입력해주세요'),
  companionRelation: z.string().min(1, '학생과의 관계를 입력해주세요'),
  purpose: z.string().min(1, '목적을 입력해주세요'),
  detailedPlan: z.string().min(1, '구체적인 계획을 입력해주세요'),
});

const fieldTripReportSchema = commonSchema.extend({
  type: z.literal('field-trip-report'),
  relatedApplyDocId: z.string().min(1, '관련 신청서 ID가 필요합니다'),
  tripPeriod: z.object({
    startDate: z.string().min(1, '시작일을 입력해주세요'),
    endDate: z.string().min(1, '종료일을 입력해주세요'),
    totalDays: z.coerce.number().min(1, '1일 이상이어야 합니다.'),
  }),
  tripType: z.enum(['가족동반여행', '친인척 방문', '답사·견학 활동', '체험활동', '기타']),
  destination: z.string().min(1, '방문 장소를 입력해주세요'),
  reportTitle: z.string().min(1, '제목을 입력해주세요'),
  reportContent: z.string().min(1, '결과 보고 내용을 입력해주세요'),
});

const formSchema = z.discriminatedUnion('type', [absenceSchema, fieldTripSchema, fieldTripReportSchema]);
export type FormValues = z.infer<typeof formSchema>;

function ApplyForm() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pendingData, setPendingData] = useState<FormValues | null>(null);
  const [docConfig, setDocConfig] = useState<DocConfig | null>(null);

  useEffect(() => {
    const unsub = onDocConfigUpdate((cfg) => {
      setDocConfig(cfg as DocConfig);
    });
    return () => unsub();
  }, []);

  const requirePin = docConfig ? docConfig.requireParentPin !== false : true;
  
  let defaultType: 'absence' | 'field-trip' | 'field-trip-report' = 'absence';
  const paramType = searchParams.get('type');
  if (paramType === 'field-trip') defaultType = 'field-trip';
  if (paramType === 'field-trip-report') defaultType = 'field-trip-report';

  const cloneId = searchParams.get('cloneId');
  const applyId = searchParams.get('applyId');

  const [originalApplyDoc, setOriginalApplyDoc] = useState<ApprovalDoc | null>(null);
  const [loadingOriginal, setLoadingOriginal] = useState(false);

  const { handleSubmit, watch, setValue, formState: { errors }, clearErrors } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: defaultType,
      studentName: profile?.studentName || '',
      gradeClassNumber: (profile?.studentGrade && profile?.studentClass && profile?.studentNumber) 
        ? `${profile.studentGrade}-${profile.studentClass}-${profile.studentNumber}` 
        : '',
      absencePeriod: { startDate: '', endDate: '', totalDays: 1 },
      absenceType: '병결',
      absenceReason: '',
      phone: profile?.parentPhone || '',
      tripPeriod: { startDate: '', endDate: '', totalDays: 1 },
      cumulativeDays: 0,
      tripType: '가족동반여행',
      destination: '',
      companionName: profile?.parentName || '',
      companionRelation: (profile as any)?.parentRelation || '',
      purpose: '',
      detailedPlan: '',
      relatedApplyDocId: applyId || '',
      reportTitle: '',
      reportContent: '',
    } as any
  });

  const [tabType, setTabType] = useState<'absence' | 'field-trip' | 'field-trip-report'>(defaultType);
  const currentType = tabType;
  const { t } = useTranslation();


  useEffect(() => {
    if (defaultType && defaultType !== tabType) {
      setTabType(defaultType);
      setValue('type', defaultType as any);
    }
  }, [defaultType, setValue, tabType]);
  const watchStudentName = watch('studentName');
  const watchGradeClassNumber = watch('gradeClassNumber');
  const watchAbsenceStartDate = watch('absencePeriod.startDate');
  const watchAbsenceEndDate = watch('absencePeriod.endDate');
  const watchAbsenceTotalDays = watch('absencePeriod.totalDays') || 0;
  const watchFieldTripStartDate = watch('tripPeriod.startDate');
  const watchFieldTripEndDate = watch('tripPeriod.endDate');
  const watchFieldTripTotalDays = watch('tripPeriod.totalDays') || 0;
  const watchAbsenceType = watch('absenceType');

  const [accumulatedFieldTripDays, setAccumulatedFieldTripDays] = useState<number>(0);
  const [accumulatedAbsenceDays, setAccumulatedAbsenceDays] = useState<number>(0);
  const [isLoadingLimits, setIsLoadingLimits] = useState<boolean>(false);


  const annualSchoolDays = docConfig?.annualSchoolDays || 190;
  const maxFieldTripDays = Math.floor(annualSchoolDays * 0.1); // 연간 10%
  const maxAbsenceDays = annualSchoolDays - Math.ceil(annualSchoolDays * 2 / 3); // 유급 기준 1/3 결석 한도
  const enableCumulative = docConfig?.enableCumulativeStats !== false; // 관리자 연간 누계 자동 계산 기능 토글

  // 1. 결과보고서인 경우 원본 신청서 데이터 로딩
  useEffect(() => {
    async function loadOriginal() {
      if (defaultType === 'field-trip-report' && applyId) {
        setLoadingOriginal(true);
        try {
          const docData = await getDocumentById(applyId);
          if (docData && docData.parentFormData) {
            setOriginalApplyDoc(docData);
            setValue('type', 'field-trip-report');
            setValue('studentName', docData.parentFormData.studentName || '');
            setValue('gradeClassNumber', docData.parentFormData.gradeClassNumber || '');
            setValue('tripPeriod', docData.parentFormData.tripPeriod || { startDate: '', endDate: '', totalDays: 1 });
            setValue('tripType', docData.parentFormData.tripType || '가족동반여행');
            setValue('destination', docData.parentFormData.destination || '');
            setValue('relatedApplyDocId', docData.id);
            setValue('reportTitle', `교외체험학습 결과보고서 (${docData.parentFormData.studentName})`);
          } else {
            toast({ variant: 'destructive', title: '오류', description: '신청서 정보를 불러오지 못했습니다.' });
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingOriginal(false);
        }
      }
    }
    loadOriginal();
  }, [applyId, defaultType, setValue, toast]);

  // 2. 문서 복사(clone) 기능
  useEffect(() => {
    async function loadCloneData() {
      if (!cloneId) return;
      try {
        const fetched = await getDocumentById(cloneId);
        if (fetched && fetched.parentFormData) {
          const data = fetched.parentFormData;
          if (data.type !== defaultType) {
            router.replace(`/parents/apply?type=${data.type}&cloneId=${cloneId}`);
            return;
          }
          setValue('type', data.type);
          setValue('studentName', data.studentName || '');
          setValue('gradeClassNumber', data.gradeClassNumber || '');

          if (data.type === 'absence') {
            setValue('absencePeriod.startDate', data.absencePeriod?.startDate || '');
            setValue('absencePeriod.endDate', data.absencePeriod?.endDate || '');
            setValue('absencePeriod.totalDays', data.absencePeriod?.totalDays || 1);
            setValue('absenceType', data.absenceType || '병결');
            setValue('absenceReason', data.absenceReason || '');
          } else if (data.type === 'field-trip') {
            setValue('phone', data.phone || '');
            setValue('tripPeriod.startDate', data.tripPeriod?.startDate || '');
            setValue('tripPeriod.endDate', data.tripPeriod?.endDate || '');
            setValue('tripPeriod.totalDays', data.tripPeriod?.totalDays || 1);
            setValue('cumulativeDays', data.cumulativeDays || 0);
            setValue('tripType', data.tripType || '가족동반여행');
            setValue('destination', data.destination || '');
            setValue('companionName', data.companionName || '');
            setValue('companionRelation', data.companionRelation || '');
            setValue('purpose', data.purpose || '');
            setValue('detailedPlan', data.detailedPlan || '');
          }
          toast({ title: "문서 복사됨", description: "이전 신청서 내용을 불러왔습니다." });
        }
      } catch (e) {
        console.error("Clone load error:", e);
      }
    }
    loadCloneData();
  }, [cloneId, defaultType, router, setValue, toast]);

  // 3. 타입 동기화
  useEffect(() => {
    if (defaultType !== currentType) {
      setValue('type', defaultType as any);
      clearErrors();
    }
  }, [defaultType, currentType, setValue, clearErrors]);

  // 학사일정 실시간 연동
  const { calendarConfig } = useAcademicCalendar();

  // 체험학습 제외 일자 상세 정보
  const fieldTripExcludedDays = useMemo(() => {
    if (!watchFieldTripStartDate || !watchFieldTripEndDate) return [];
    return getExcludedDaysInRange(watchFieldTripStartDate, watchFieldTripEndDate, calendarConfig);
  }, [watchFieldTripStartDate, watchFieldTripEndDate, calendarConfig]);

  // 결석계 제외 일자 상세 정보
  const absenceExcludedDays = useMemo(() => {
    if (!watchAbsenceStartDate || !watchAbsenceEndDate) return [];
    return getExcludedDaysInRange(watchAbsenceStartDate, watchAbsenceEndDate, calendarConfig);
  }, [watchAbsenceStartDate, watchAbsenceEndDate, calendarConfig]);

  // 휴업일 제외 요약 텍스트 (체험학습)
  const fieldTripExcludedSummary = useMemo(() => {
    if (fieldTripExcludedDays.length === 0) return null;
    const holidays = fieldTripExcludedDays.filter(d => d.type === 'holiday');
    const vacations = fieldTripExcludedDays.filter(d => d.type === 'vacation');
    const weekends = fieldTripExcludedDays.filter(d => d.type === 'weekend');

    const parts: string[] = [];
    if (holidays.length > 0) {
      const reasonMap: Record<string, number> = {};
      holidays.forEach(h => {
        reasonMap[h.reason] = (reasonMap[h.reason] || 0) + 1;
      });
      const reasonStr = Object.entries(reasonMap).map(([r, count]) => `${r} ${count}일`).join(', ');
      parts.push(`학교 휴업일 ${holidays.length}일(${reasonStr})`);
    }
    if (vacations.length > 0) {
      parts.push(`방학 ${vacations.length}일`);
    }
    if (weekends.length > 0) {
      parts.push(`주말 ${weekends.length}일`);
    }

    return `※ 신청 기간 중 ${parts.join(', ')} 제외 (실제 출석인정 수업일수: ${watchFieldTripTotalDays}일)`;
  }, [fieldTripExcludedDays, watchFieldTripTotalDays]);

  // 휴업일 제외 요약 텍스트 (결석계)
  const absenceExcludedSummary = useMemo(() => {
    if (absenceExcludedDays.length === 0) return null;
    const holidays = absenceExcludedDays.filter(d => d.type === 'holiday');
    const vacations = absenceExcludedDays.filter(d => d.type === 'vacation');
    const weekends = absenceExcludedDays.filter(d => d.type === 'weekend');

    const parts: string[] = [];
    if (holidays.length > 0) {
      const reasonMap: Record<string, number> = {};
      holidays.forEach(h => {
        reasonMap[h.reason] = (reasonMap[h.reason] || 0) + 1;
      });
      const reasonStr = Object.entries(reasonMap).map(([r, count]) => `${r} ${count}일`).join(', ');
      parts.push(`학교 휴업일 ${holidays.length}일(${reasonStr})`);
    }
    if (vacations.length > 0) {
      parts.push(`방학 ${vacations.length}일`);
    }
    if (weekends.length > 0) {
      parts.push(`주말 ${weekends.length}일`);
    }

    return `※ 결석 기간 중 ${parts.join(', ')} 제외 (실제 수업일수: ${watchAbsenceTotalDays}일)`;
  }, [absenceExcludedDays, watchAbsenceTotalDays]);

  // 3.1. 날짜 변경 시 주말(토, 일) 및 학사일정 휴업일(공휴일, 재량휴업일, 방학)을 제외한 실제 수업일수 자동 계산
  useEffect(() => {
    if (watchAbsenceStartDate && watchAbsenceEndDate) {
      const workingDays = getWorkingDaysCount(watchAbsenceStartDate, watchAbsenceEndDate, calendarConfig);
      setValue('absencePeriod.totalDays', workingDays);
    }
  }, [watchAbsenceStartDate, watchAbsenceEndDate, calendarConfig, setValue]);

  // 체험학습 불인정(신청 불가) 기간 목록
  const blackoutPeriods = useMemo<FieldTripBlackoutPeriod[]>(() => {
    return docConfig?.fieldTripBlackoutPeriods || DEFAULT_FIELD_TRIP_BLACKOUT_PERIODS;
  }, [docConfig]);

  // 신청 기간 중 불인정 기간과 겹치는지 검사
  const overlappedBlackoutPeriod = useMemo(() => {
    if (currentType !== 'field-trip' || !watchFieldTripStartDate || !watchFieldTripEndDate) return null;
    return blackoutPeriods.find(bp => 
      watchFieldTripStartDate <= bp.endDate && watchFieldTripEndDate >= bp.startDate
    ) || null;
  }, [currentType, watchFieldTripStartDate, watchFieldTripEndDate, blackoutPeriods]);

  // 날짜 변경 시 불인정 기간 토스트 알림
  useEffect(() => {
    if (overlappedBlackoutPeriod) {
      toast({
        variant: 'destructive',
        title: t('parents.apply.disallowed_period_toast_title') || '신청 기간이 아닙니다.',
        description: t('parents.apply.disallowed_period_toast_desc', {
          reason: overlappedBlackoutPeriod.reason,
          start: overlappedBlackoutPeriod.startDate.replace(/-/g, '.'),
          end: overlappedBlackoutPeriod.endDate.replace(/-/g, '.')
        }) || `체험학습 신청 불가 기간(${overlappedBlackoutPeriod.reason}: ${overlappedBlackoutPeriod.startDate.replace(/-/g, '.')} ~ ${overlappedBlackoutPeriod.endDate.replace(/-/g, '.')})이 포함되어 있어 신청할 수 없습니다.`
      });
    }
  }, [overlappedBlackoutPeriod, toast, t]);

  useEffect(() => {
    if (watchFieldTripStartDate && watchFieldTripEndDate) {
      const workingDays = getWorkingDaysCount(watchFieldTripStartDate, watchFieldTripEndDate, calendarConfig);
      setValue('tripPeriod.totalDays', workingDays);
    }
  }, [watchFieldTripStartDate, watchFieldTripEndDate, calendarConfig, setValue]);

  // 4. 출석일수 한도 계산
  useEffect(() => {
    const studentName = watchStudentName || profile?.studentName || '';
    const gradeClassNumber = watchGradeClassNumber || 
      ((profile?.studentGrade && profile?.studentClass && profile?.studentNumber) 
        ? `${profile.studentGrade}-${profile.studentClass}-${profile.studentNumber}` 
        : '') || '';
    
    const dateStr = currentType === 'absence' ? watchAbsenceStartDate : watchFieldTripStartDate;
    if (!studentName || !gradeClassNumber || !dateStr) return;
    
    const year = dateStr.substring(0, 4);
    
    async function fetchDays() {
      setIsLoadingLimits(true);
      try {
        const [ftDays, absDays] = await Promise.all([
          getStudentFieldTripDays(studentName, gradeClassNumber, year),
          getStudentAbsenceDays(studentName, gradeClassNumber, year)
        ]);
        setAccumulatedFieldTripDays(ftDays);
        setAccumulatedAbsenceDays(absDays);
      } catch (err) {
        console.error("Error fetching student limit days:", err);
      } finally {
        setIsLoadingLimits(false);
      }
    }
    fetchDays();
  }, [watchStudentName, watchGradeClassNumber, watchAbsenceStartDate, watchFieldTripStartDate, currentType, profile]);

  useEffect(() => {
    setValue('cumulativeDays', accumulatedFieldTripDays);
  }, [accumulatedFieldTripDays, setValue]);

  // 한도 체크 로직
  const isOverFieldTripLimit = currentType === 'field-trip' && 
    (accumulatedFieldTripDays + Number(watchFieldTripTotalDays) > maxFieldTripDays);
    
  const isOverAbsenceLimit = currentType === 'absence' && 
    watchAbsenceType !== '출석인정' && 
    (accumulatedAbsenceDays + Number(watchAbsenceTotalDays) > maxAbsenceDays);

  const isSingleFieldTripOverLimit = currentType === 'field-trip' && 
    Number(watchFieldTripTotalDays) > 10;
    
  const isOverLimit = isOverFieldTripLimit || isOverAbsenceLimit || isSingleFieldTripOverLimit || !!overlappedBlackoutPeriod;

  const handleTabChange = (val: string) => {
    setTabType(val as any);
    setValue('type', val as any);
    router.push(`/parents/apply?type=${val}`);
  };

  const onInvalid = (fieldErrors: any) => {
    console.error('[Apply] Form validation errors:', fieldErrors);
    const getFirstMsg = (obj: any): string | null => {
      for (const key in obj) {
        if (obj[key]?.message) return obj[key].message;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          const nested = getFirstMsg(obj[key]);
          if (nested) return nested;
        }
      }
      return null;
    };
    const msg = getFirstMsg(fieldErrors) || '필수 입력 항목을 모두 확인해주세요.';
    toast({
      variant: 'destructive',
      title: '입력 항목 확인',
      description: msg,
    });
  };

  const onSubmit = (data: FormValues) => {
    if (currentType === 'field-trip' && overlappedBlackoutPeriod) {
      toast({
        variant: 'destructive',
        title: t('parents.apply.disallowed_period_toast_title') || '신청 기간이 아닙니다.',
        description: t('parents.apply.disallowed_period_toast_desc', {
          reason: overlappedBlackoutPeriod.reason,
          start: overlappedBlackoutPeriod.startDate.replace(/-/g, '.'),
          end: overlappedBlackoutPeriod.endDate.replace(/-/g, '.')
        }) || `체험학습 신청 불가 기간(${overlappedBlackoutPeriod.reason}: ${overlappedBlackoutPeriod.startDate.replace(/-/g, '.')} ~ ${overlappedBlackoutPeriod.endDate.replace(/-/g, '.')})이 포함되어 있어 신청할 수 없습니다.`
      });
      return;
    }
    if (isSingleFieldTripOverLimit) {
      toast({
        variant: 'destructive',
        title: '신청 불가',
        description: '교외체험학습은 1회 신청 시 최대 10일(주말 제외)까지만 신청 가능합니다.'
      });
      return;
    }
    if (isOverFieldTripLimit) {
      toast({
        variant: 'destructive',
        title: '신청 불가',
        description: `연간 교외체험학습 허용 일수(${maxFieldTripDays}일)를 초과하여 신청할 수 없습니다.`
      });
      return;
    }
    if (isOverAbsenceLimit) {
      toast({
        variant: 'destructive',
        title: '신청 불가',
        description: `진급 수료 기준 한도 결석일수(${maxAbsenceDays}일)를 초과하여 신청할 수 없습니다.`
      });
      return;
    }
    setPendingData(data);
    if (requirePin) {
      setShowPinModal(true);
    } else {
      setShowConfirmModal(true);
    }
  };

  const confirmSubmit = async (skipPinCheck = false) => {
    if (!user || !profile || !pendingData) return;
    
    if (!profile.parentName) {
      toast({ variant: 'destructive', title: '설정 오류', description: '설정에서 학부모 이름을 등록해 주세요.' });
      setShowPinModal(false);
      setShowConfirmModal(false);
      return;
    }
    
    const shouldVerifyPin = requirePin && !skipPinCheck;
    if (shouldVerifyPin && pinInput.length !== 4) {
      toast({ variant: 'destructive', title: '입력 오류', description: 'PIN 4자리를 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const data = pendingData;
      const studentName = data.studentName;
      const gradeClassNumber = data.gradeClassNumber;
      
      // 최종 한도 검증
      if (data.type === 'field-trip') {
        const proposedSingle = Number(data.tripPeriod.totalDays);
        if (proposedSingle > 10) {
          toast({
            variant: 'destructive',
            title: '제출 불가',
            description: '교외체험학습은 1회 신청 시 최대 10일(주말 제외)까지만 신청 가능합니다.'
          });
          setIsSubmitting(false);
          setShowPinModal(false);
          setShowConfirmModal(false);
          return;
        }

        const startDate = data.tripPeriod.startDate;
        const year = startDate.substring(0, 4);
        const latestFtDays = await getStudentFieldTripDays(studentName, gradeClassNumber, year);
        const proposedTotal = latestFtDays + Number(data.tripPeriod.totalDays);
        if (proposedTotal > maxFieldTripDays) {
          toast({
            variant: 'destructive',
            title: '제출 불가',
            description: `연간 교외체험학습 허용 일수(${maxFieldTripDays}일)를 초과하여 신청할 수 없습니다. (현재 누적: ${latestFtDays}일, 신청: ${data.tripPeriod.totalDays}일)`
          });
          setIsSubmitting(false);
          setShowPinModal(false);
          setShowConfirmModal(false);
          return;
        }
      } else if (data.type === 'absence' && data.absenceType !== '출석인정') {
        const startDate = data.absencePeriod.startDate;
        const year = startDate.substring(0, 4);
        const latestAbsDays = await getStudentAbsenceDays(studentName, gradeClassNumber, year);
        const proposedTotal = latestAbsDays + Number(data.absencePeriod.totalDays);
        if (proposedTotal > maxAbsenceDays) {
          toast({
            variant: 'destructive',
            title: '제출 불가',
            description: `진급 수료 기준 한도 결석일수(${maxAbsenceDays}일)를 초과하여 신청할 수 없습니다. (현재 누적: ${latestAbsDays}일, 신청: ${data.absencePeriod.totalDays}일)`
          });
          setIsSubmitting(false);
          setShowPinModal(false);
          setShowConfirmModal(false);
          return;
        }
      }

      if (shouldVerifyPin) {
        const hashedInput = await hashPIN(pinInput);
        if (profile.hashedPin !== hashedInput) {
          toast({ variant: 'destructive', title: '인증 실패', description: 'PIN 번호가 일치하지 않습니다.' });
          setIsSubmitting(false);
          return;
        }
      }

      const isAbsence = data.type === 'absence';
      const isReport = data.type === 'field-trip-report';
      
      let title = '';
      if (isAbsence) {
        title = `[결석계] ${data.gradeClassNumber} ${data.studentName}`;
      } else if (isReport) {
        title = `[체험보고서] ${data.gradeClassNumber} ${data.studentName}`;
      } else {
        title = `[체험학습] ${data.gradeClassNumber} ${data.studentName}`;
      }
      
      let content = '';
      if (isAbsence) {
        content = `결석 종류: ${data.absenceType}<br/>결석 기간: ${data.absencePeriod.startDate} ~ ${data.absencePeriod.endDate} (총 ${data.absencePeriod.totalDays}일)<br/>결석 사유: ${data.absenceReason}`;
      } else if (isReport) {
        content = `보고서 제목: ${data.reportTitle}<br/>체험학습 기간: ${data.tripPeriod.startDate} ~ ${data.tripPeriod.endDate} (총 ${data.tripPeriod.totalDays}일)<br/>방문 장소: ${data.destination}<br/>체험학습 결과:<br/>${data.reportContent.replace(/\n/g, '<br/>')}`;
      } else {
        content = `목적: ${data.purpose}<br/>방문 장소: ${data.destination}<br/>기간: ${data.tripPeriod.startDate} ~ ${data.tripPeriod.endDate} (총 ${data.tripPeriod.totalDays}일)<br/>구체적인 계획:<br/>${data.detailedPlan.replace(/\n/g, '<br/>')}`;
      }

      const parentFormData: ParentFormData = data as any;

      // 학년/반 파싱 후 결재선 자동 생성
      const gradeClassParts = data.gradeClassNumber.replace(/[^0-9-]/g, '-').split('-').filter(Boolean);
      const grade = gradeClassParts[0] || '1';
      const studentClass = gradeClassParts[1] || '1';
      const docTypeTarget = (data.type === 'field-trip' || data.type === 'field-trip-report') ? '체험학습신청서' : '결석계';
      const approvers = await getApproversByGradeClass(grade, studentClass, docTypeTarget);

      let res;
      if (isReport) {
        res = await submitFieldTripReport(
          data.relatedApplyDocId || '',
          {
            reportTitle: data.reportTitle,
            reportContent: data.reportContent,
            submittedAt: new Date().toISOString()
          },
          profile
        );
      } else {
        res = await createDocument({
          title,
          content,
          docType: 'parent',
          publishStatus: '비공개',
          parentFormData,
          approvers,
          attachments: [],
        }, user.email!, profile);
      }

      if (res && !res.success) {
        throw new Error(res.error || '제출 중 오류가 발생했습니다.');
      }

      // 신청서(결석계 / 교외체험학습) 접수 즉시 출석부 결석 체크 및 방과후/스쿨버스 자동 연동
      if (!isReport) {
        try {
          await syncParentApplicationDatesToAttendance(
            parentFormData,
            user.email || '',
            (profile as any)?.studentId
          );
        } catch (syncErr) {
          console.warn('[ParentApply] Attendance and bus/afterschool sync failed (non-blocking):', syncErr);
        }
      }

      toast({
        title: '제출 완료',
        description: '성공적으로 제출되었습니다.',
      });
      setShowPinModal(false);
      setShowConfirmModal(false);
      setPinInput('');
      router.push('/parents/history');
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: '제출 실패',
        description: error instanceof Error ? error.message : '제출 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDate = new Date();

  if (loadingOriginal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">체험학습 신청서 데이터를 조회하고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-3 px-2 sm:py-8 sm:px-4 print:p-0 print:bg-white animate-in fade-in duration-500">
      <div className="max-w-[210mm] mx-auto mb-3 sm:mb-6 print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm bg-white hover:bg-slate-50 text-muted-foreground hover:text-foreground shadow-xs" onClick={() => router.back()}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {t('back') || '뒤로가기'}
          </Button>
          <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm bg-white hover:bg-slate-50 text-muted-foreground hover:text-foreground shadow-xs" onClick={() => router.push('/parents')}>
            <Home className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {t('page.title.home') || '홈'}
          </Button>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          {defaultType !== 'field-trip-report' ? (
            <div className="grid grid-cols-2 p-1 bg-slate-200/80 rounded-xl w-full sm:w-[280px] gap-1">
              <button
                type="button"
                onClick={() => handleTabChange('absence')}
                className={`py-1.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                  currentType === 'absence'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('parents.absence') || '결석계'}
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('field-trip')}
                className={`py-1.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                  currentType === 'field-trip'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('parents.field_trip') || '체험학습 신청서'}
              </button>
            </div>
          ) : (
            <div className="bg-amber-100 border border-amber-200 text-amber-800 text-xs sm:text-sm font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg w-full sm:w-auto text-center">
              {t('parents.field_trip_report_mode') || '체험학습 결과보고서 작성 모드'}
            </div>
          )}
        </div>

      </div>

      <div className="w-full max-w-[210mm] min-h-0 sm:min-h-[297mm] mx-auto bg-white shadow-md sm:shadow-2xl border border-slate-200/80 rounded-xl sm:rounded-sm print:shadow-none print:border-none print:w-[170mm] print:mx-auto print:min-h-0">
        <form onSubmit={handleSubmit(onSubmit, onInvalid)}>

          {/* ========== 모바일 전용 간소화 카드 UI (sm 미만에서만 표시) ========== */}
          <MobileFormCard
            currentType={currentType}
            t={t}
            watch={watch}
            setValue={setValue}
            errors={errors}
            watchAbsenceStartDate={watchAbsenceStartDate}
            watchAbsenceEndDate={watchAbsenceEndDate}
            watchAbsenceTotalDays={watchAbsenceTotalDays}
            absenceExcludedSummary={absenceExcludedSummary}
            enableCumulative={enableCumulative}
            isLoadingLimits={isLoadingLimits}
            isOverAbsenceLimit={isOverAbsenceLimit}
            accumulatedAbsenceDays={accumulatedAbsenceDays}
            originalApplyDoc={originalApplyDoc}
            loadingOriginal={loadingOriginal}
            watchFieldTripStartDate={watchFieldTripStartDate}
            watchFieldTripEndDate={watchFieldTripEndDate}
            watchFieldTripTotalDays={watchFieldTripTotalDays}
            overlappedBlackoutPeriod={overlappedBlackoutPeriod}
            blackoutPeriods={blackoutPeriods}
            isOverFieldTripLimit={isOverFieldTripLimit}
            profile={profile}
            isSubmitting={isSubmitting}
            isOverLimit={isOverLimit}
          />
          {/* ========== 모바일 전용 카드 UI 끝 ========== */}

          {/* ========== 데스크탑 A4 서식 (sm 이상에서만 표시) ========== */}
          <div className="hidden sm:block p-3.5 sm:p-6 md:p-[20mm] overflow-x-auto">
            {currentType === 'absence' ? (
              <DesktopAbsenceForm
                watchGradeClassNumber={watchGradeClassNumber}
                setValue={setValue}
                errors={errors}
                profile={profile}
                watchStudentName={watchStudentName}
                watchAbsenceStartDate={watchAbsenceStartDate}
                watchAbsenceEndDate={watchAbsenceEndDate}
                watchAbsenceTotalDays={watchAbsenceTotalDays}
                absenceExcludedSummary={absenceExcludedSummary}
                watch={watch}
                submitDate={submitDate}
                enableCumulative={enableCumulative}
                isLoadingLimits={isLoadingLimits}
                isOverAbsenceLimit={isOverAbsenceLimit}
                accumulatedAbsenceDays={accumulatedAbsenceDays}
              />
            ) : currentType === 'field-trip-report' ? (
              <DesktopFieldTripReportForm
                originalApplyDoc={originalApplyDoc}
                watch={watch}
                errors={errors}
                setValue={setValue}
                watchFieldTripStartDate={watchFieldTripStartDate}
                watchFieldTripEndDate={watchFieldTripEndDate}
                watchFieldTripTotalDays={watchFieldTripTotalDays}
                profile={profile}
                submitDate={submitDate}
              />
            ) : (
              <DesktopFieldTripForm
                enableCumulative={enableCumulative}
                isLoadingLimits={isLoadingLimits}
                isOverFieldTripLimit={isOverFieldTripLimit}
                accumulatedFieldTripDays={accumulatedFieldTripDays}
                watchFieldTripTotalDays={watchFieldTripTotalDays}
                watchStudentName={watchStudentName}
                watchGradeClassNumber={watchGradeClassNumber}
                setValue={setValue}
                errors={errors}
                watch={watch}
                fieldTripExcludedSummary={fieldTripExcludedSummary}
                overlappedBlackoutPeriod={overlappedBlackoutPeriod}
                t={t}
                blackoutPeriods={blackoutPeriods}
                watchFieldTripStartDate={watchFieldTripStartDate}
                watchFieldTripEndDate={watchFieldTripEndDate}
                profile={profile}
                submitDate={submitDate}
              />
            )}

          <div className="mt-8 flex justify-end print:hidden">
            <Button type="submit" disabled={isSubmitting} size="lg" className="w-full sm:w-[200px] font-bold shadow-md hover:shadow-lg transition-all h-12 bg-primary text-primary-foreground">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {currentType === 'field-trip-report' ? '결과보고서 제출' : '신청서 제출'}
            </Button>
          </div>
          </div>
          {/* ========== 데스크탑 A4 서식 끝 ========== */}

        </form>
      </div>

      <PinModal
        showPinModal={showPinModal}
        setShowPinModal={setShowPinModal}
        pinInput={pinInput}
        setPinInput={setPinInput}
        isSubmitting={isSubmitting}
        confirmSubmit={confirmSubmit}
      />

      {/* PIN 인증 비활성화 시 확인 대화상자 */}
      <ConfirmSubmitModal
        showConfirmModal={showConfirmModal}
        setShowConfirmModal={setShowConfirmModal}
        pendingData={pendingData}
        isSubmitting={isSubmitting}
        confirmSubmit={confirmSubmit}
      />
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    }>
      <ApplyForm />
    </Suspense>
  );
}
