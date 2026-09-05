'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { createDocument, getStudentFieldTripDays, getStudentAbsenceDays, getDocumentById, submitFieldTripReport } from '@/lib/services/documentService';
import { getDocConfig, onDocConfigUpdate } from '@/lib/services/settingsService';
import { getWorkingDaysCount, getExcludedDaysInRange } from '@/lib/utils';
import { useAcademicCalendar } from '@/lib/services/academicCalendarService';
import { getApproversByGradeClass } from '@/lib/services/userService';
import { ParentFormData, ApprovalDoc, DEFAULT_FIELD_TRIP_BLACKOUT_PERIODS, FieldTripBlackoutPeriod, DocConfig } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, ArrowLeft, AlertTriangle, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

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
type FormValues = z.infer<typeof formSchema>;

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
          <div className="sm:hidden p-4 space-y-4">
            {currentType === 'absence' ? (
              <>
                {/* 결석계 - 모바일 카드 */}
                <div className="text-center pb-2 border-b border-slate-100">
                  <h2 className="text-base font-bold text-slate-800">{t('parents.apply.absence_title') || '결 석 계'}</h2>
                  <p className="text-[11px] text-red-500 font-semibold mt-0.5">{t('parents.apply.absence_notice') || '결석한 날부터 5일 이내 제출'}</p>
                </div>

                {/* 결석 기간 */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">{t('parents.apply.absence_period') || '결석 기간'} <span className="text-red-500">*</span></label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      value={watchAbsenceStartDate || ''} 
                      onChange={(e) => setValue('absencePeriod.startDate', e.target.value, { shouldValidate: true })}
                      className="flex-1 border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-indigo-400" 
                    />
                    <span className="text-slate-400 text-xs">~</span>
                    <input 
                      type="date" 
                      value={watchAbsenceEndDate || ''} 
                      onChange={(e) => setValue('absencePeriod.endDate', e.target.value, { shouldValidate: true })}
                      className="flex-1 border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-indigo-400" 
                    />
                  </div>
                  {watchAbsenceTotalDays > 0 && (
                    <p className="text-[11px] text-indigo-600 font-semibold">
                      {t('parents.apply.total_days', { days: watchAbsenceTotalDays }) || `총 ${watchAbsenceTotalDays}일`}
                      {absenceExcludedSummary && <span className="text-slate-500 font-normal ml-1">({absenceExcludedSummary.replace('※ 결석 기간 중 ', '').replace(` (실제 수업일수: ${watchAbsenceTotalDays}일)`, '')} 제외)</span>}
                    </p>
                  )}
                  {(errors as any).absencePeriod?.startDate && <p className="text-[11px] text-red-500">{(errors as any).absencePeriod.startDate.message}</p>}
                </div>

                {/* 결석 종류 */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">{t('parents.apply.absence_type') || '결석 종류'} <span className="text-red-500">*</span></label>
                  <select
                    value={watch('absenceType')}
                    onChange={(e) => setValue('absenceType', e.target.value as any, { shouldValidate: true })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400 bg-white"
                  >
                    <option value="병결">{t('parents.apply.absence_type_illness') || '병결'}</option>
                    <option value="출석인정">{t('parents.apply.absence_type_authorized') || '출석인정'}</option>
                    <option value="기타">{t('parents.apply.absence_type_other') || '기타'}</option>
                  </select>
                </div>

                {/* 결석 사유 */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">{t('parents.apply.absence_reason') || '결석 사유'} <span className="text-red-500">*</span></label>
                  <textarea
                    value={watch('absenceReason') || ''}
                    onChange={(e) => setValue('absenceReason', e.target.value, { shouldValidate: true })}
                    placeholder={t('parents.apply.absence_reason_ph') || '결석 사유를 자세히 입력해주세요.'}
                    rows={4}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400 resize-none placeholder:text-slate-400"
                  />
                  {(errors as any).absenceReason && <p className="text-[11px] text-red-500">{(errors as any).absenceReason.message}</p>}
                </div>

                {/* 누적 결석 현황 (연간 누계 기능 활성화 시에만 노출) */}
                {enableCumulative && (
                  <>
                    {isLoadingLimits ? (
                      <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-500 text-center">누적 현황 조회 중...</div>
                    ) : (
                      <div className={`rounded-lg px-3 py-2 text-xs flex justify-between items-center ${isOverAbsenceLimit ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'}`}>
                        <span className="font-medium">{t('parents.apply.accumulated_absence_label') || '올해 누적 결석'}</span>
                        <span className="font-bold">{accumulatedAbsenceDays}일 + {t('parents.apply.applied_label') || '신청'} {watchAbsenceTotalDays}일 = {accumulatedAbsenceDays + Number(watchAbsenceTotalDays)}일 / 63일</span>
                      </div>
                    )}
                    {isOverAbsenceLimit && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        한해 총 결석 63일 초과 시 진급이 불가할 수 있습니다.
                      </div>
                    )}
                  </>
                )}
              </>
            ) : currentType === 'field-trip-report' ? (
              <>
                {/* 결과보고서 - 모바일 */}
                <div className="text-center pb-2 border-b border-slate-100">
                  <h2 className="text-base font-bold text-slate-800">{t('parents.apply.report_title') || '교외체험학습 결과보고서'}</h2>
                  <p className="text-[11px] text-red-500 font-semibold mt-0.5">{t('parents.apply.report_notice') || '체험학습 종료 후 7일 이내 제출'}</p>
                </div>
                {originalApplyDoc && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                    <span className="font-bold text-slate-700">{t('parents.apply.linked_apply_doc') || '연동된 신청서:'}</span>
                    <span className="ml-1 text-slate-600">{originalApplyDoc.docNo} ({originalApplyDoc.parentFormData?.tripPeriod?.startDate} ~ {originalApplyDoc.parentFormData?.tripPeriod?.endDate})</span>
                  </div>
                )}
                {loadingOriginal && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-center text-slate-500">
                    신청서 정보를 불러오는 중입니다...
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">{t('parents.apply.report_title_label') || '보고서 제목'} <span className="text-red-500">*</span></label>
                  <input 
                    value={watch('reportTitle') || ''} 
                    onChange={(e) => setValue('reportTitle', e.target.value, { shouldValidate: true })}
                    placeholder={t('parents.apply.report_title_ph') || '보고서 제목 입력'} 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400" 
                  />
                  {(errors as any).reportTitle && <p className="text-[11px] text-red-500">{(errors as any).reportTitle.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">{t('parents.apply.report_content_label') || '결과 보고 내용'} <span className="text-red-500">*</span></label>
                  <textarea 
                    value={watch('reportContent') || ''} 
                    onChange={(e) => setValue('reportContent', e.target.value, { shouldValidate: true })}
                    placeholder={t('parents.apply.report_content_ph') || '체험학습의 결과 및 느낀 점을 작성해주세요.'} 
                    rows={6} 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400 resize-none" 
                  />
                  {(errors as any).reportContent && <p className="text-[11px] text-red-500">{(errors as any).reportContent.message}</p>}
                </div>
              </>
            ) : (
              <>
                {/* 체험학습 신청서 - 모바일 카드 */}
                <div className="text-center pb-2 border-b border-slate-100">
                  <h2 className="text-base font-bold text-slate-800">{t('parents.apply.fieldtrip_title') || '교외체험학습 신청서'}</h2>
                  <p className="text-[11px] text-red-500 font-semibold mt-0.5">{t('parents.apply.fieldtrip_notice') || '체험학습 실시 7일 전 제출'}</p>
                </div>

                {/* 신청 기간 */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">{t('parents.apply.period') || '신청 기간'} <span className="text-red-500">*</span></label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      value={watchFieldTripStartDate || ''} 
                      onChange={(e) => setValue('tripPeriod.startDate', e.target.value, { shouldValidate: true })}
                      className="flex-1 border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-indigo-400" 
                    />
                    <span className="text-slate-400 text-xs">~</span>
                    <input 
                      type="date" 
                      value={watchFieldTripEndDate || ''} 
                      onChange={(e) => setValue('tripPeriod.endDate', e.target.value, { shouldValidate: true })}
                      className="flex-1 border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-indigo-400" 
                    />
                  </div>
                  {watchFieldTripTotalDays > 0 && (
                    <p className="text-[11px] text-indigo-600 font-semibold">{t('parents.apply.total_days', { days: watchFieldTripTotalDays }) || `총 ${watchFieldTripTotalDays}일`} (주말·공휴일 제외 수업일수)</p>
                  )}
                  {overlappedBlackoutPeriod && (
                    <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-start gap-1.5 mt-1 animate-in fade-in">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                      <div>
                        <p className="font-bold">{t('parents.apply.disallowed_period_toast_title') || '신청 기간이 아닙니다.'}</p>
                        <p className="text-[11px] text-red-600 font-normal mt-0.5">
                          {overlappedBlackoutPeriod.reason} ({overlappedBlackoutPeriod.startDate.replace(/-/g, '.')} ~ {overlappedBlackoutPeriod.endDate.replace(/-/g, '.')})
                        </p>
                      </div>
                    </div>
                  )}
                  {(errors as any).tripPeriod?.startDate && <p className="text-[11px] text-red-500">{(errors as any).tripPeriod.startDate.message}</p>}
                </div>

                {/* 불인정 기간 안내 접이식 배너 */}
                <details className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
                  <summary className="font-bold text-slate-700 cursor-pointer flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="text-red-500 font-bold">※</span>
                      {t('parents.apply.blackout_notice_title') || '체험학습 신청 불가(불인정) 기간 안내'}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">
                      {blackoutPeriods.length}개 기간
                    </Badge>
                  </summary>
                  <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                    <p className="text-[10px] text-red-600 font-medium">※ 허용 일수 초과 시, 초과 일수는 [미인정결석] 처리됩니다.</p>
                    <div className="grid grid-cols-1 gap-1 pt-1">
                      {blackoutPeriods.map((bp, i) => (
                        <div key={bp.id || i} className="flex justify-between items-center text-[10.5px] bg-white px-2 py-1 rounded border border-slate-100">
                          <span className="font-mono text-slate-700 font-medium">{bp.startDate.replace(/-/g, '.')} ~ {bp.endDate.replace(/-/g, '.')}</span>
                          <span className="text-slate-500">{bp.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>

                {/* 학습 형태 */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">{t('parents.apply.trip_type') || '학습 형태'} <span className="text-red-500">*</span></label>
                  <select
                    value={watch('tripType')}
                    onChange={(e) => setValue('tripType', e.target.value as any, { shouldValidate: true })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400 bg-white"
                  >
                    <option value="가족동반여행">{t('parents.apply.trip_type_family') || '가족동반여행'}</option>
                    <option value="친인척 방문">{t('parents.apply.trip_type_relatives') || '친인척 방문'}</option>
                    <option value="답사·견학 활동">{t('parents.apply.trip_type_cultural') || '답사·견학 활동'}</option>
                    <option value="기타">{t('parents.apply.trip_type_other') || '기타'}</option>
                  </select>
                </div>

                {/* 방문 장소 */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">{t('parents.apply.destination') || '방문 장소'} <span className="text-red-500">*</span></label>
                  <input
                    value={watch('destination') || ''}
                    onChange={(e) => setValue('destination', e.target.value, { shouldValidate: true })}
                    placeholder={t('parents.apply.destination_ph') || '방문할 국가 및 도시명'}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                  />
                  {(errors as any).destination && <p className="text-[11px] text-red-500">{(errors as any).destination.message}</p>}
                </div>

                {/* 목적 */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">{t('parents.apply.purpose') || '목적'} <span className="text-red-500">*</span></label>
                  <input
                    value={watch('purpose') || ''}
                    onChange={(e) => setValue('purpose', e.target.value, { shouldValidate: true })}
                    placeholder={t('parents.apply.purpose_ph') || '체험학습을 통해 달성하고자 하는 목적'}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                  />
                  {(errors as any).purpose && <p className="text-[11px] text-red-500">{(errors as any).purpose.message}</p>}
                </div>

                {/* 학습 계획 */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">{t('parents.apply.plan') || '학습 계획'} <span className="text-red-500">*</span></label>
                  <textarea
                    value={watch('detailedPlan') || ''}
                    onChange={(e) => setValue('detailedPlan', e.target.value, { shouldValidate: true })}
                    placeholder={t('parents.apply.plan_ph') || '일자별 이동 경로, 방문 장소 및 예상 활동'}
                    rows={4}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400 resize-none placeholder:text-slate-400"
                  />
                  {(errors as any).detailedPlan && <p className="text-[11px] text-red-500">{(errors as any).detailedPlan.message}</p>}
                </div>

                {/* 보호자 정보 (자동 고정 표시) */}
                <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200 space-y-1">
                  <p className="text-[11px] text-slate-500 font-medium">보호자 정보 (학부모 설정에서 자동 적용)</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">성명:</span>
                    <span className="font-bold text-slate-800">{profile?.parentName || '미설정'}</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-500">관계:</span>
                    <span className="font-bold text-slate-800">{(profile as any)?.parentRelation || '미설정'}</span>
                  </div>
                  {(!(profile as any)?.parentRelation) && (
                    <p className="text-[11px] text-amber-600">⚠ 설정 페이지에서 보호자 관계를 먼저 입력해 주세요.</p>
                  )}
                </div>

                {/* 누적 체험학습 현황 */}
                {isOverFieldTripLimit && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    연간 교외체험학습 허용 한도(20일)를 초과하여 신청할 수 없습니다.
                  </div>
                )}
              </>
            )}

            {/* 모바일 제출 버튼 */}
            <div className="pt-2">
              <Button 
                type="submit" 
                disabled={isSubmitting || isOverLimit || (currentType === 'field-trip-report' && loadingOriginal)} 
                className="w-full h-10 font-bold bg-primary text-primary-foreground text-xs sm:text-sm"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {currentType === 'field-trip-report' ? (t('parents.apply.submit_report_btn') || '결과보고서 제출') : (t('parents.apply.submit_btn') || '신청서 제출')}
              </Button>
            </div>
          </div>
          {/* ========== 모바일 전용 카드 UI 끝 ========== */}

          {/* ========== 데스크탑 A4 서식 (sm 이상에서만 표시) ========== */}
          <div className="hidden sm:block p-3.5 sm:p-6 md:p-[20mm] overflow-x-auto">
            {currentType === 'absence' ? (
              <div className="font-serif text-[10pt] sm:text-[11pt] text-black min-w-[280px]">
              {/* 누적 결석 경고 알림 (연간 누계 기능 활성화 시에만 노출) */}
              {enableCumulative && (
                <>
                  <div className="bg-slate-50 border border-slate-200 p-2.5 sm:p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-4 sm:mb-6 print:hidden">
                    <div>
                      <h5 className="font-bold text-slate-800 text-xs sm:text-sm">연간 누적 결석 현황 (올해)</h5>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">병결, 미인정, 기타 결석의 합계 (출석인정 제외)</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] sm:text-xs text-muted-foreground block">누적 / 한도 (유급)</span>
                      <span className={`text-xs sm:text-base md:text-sm font-black whitespace-nowrap ${isOverAbsenceLimit ? 'text-destructive' : 'text-slate-700'}`}>
                        {isLoadingLimits ? '...' : `${accumulatedAbsenceDays}일`}
                        {` + 신청 ${watchAbsenceTotalDays}일 = 총 ${accumulatedAbsenceDays + Number(watchAbsenceTotalDays)}일`}
                        {` / 63일`}
                      </span>
                    </div>
                  </div>

                  {isOverAbsenceLimit && (
                    <div className="bg-destructive/10 text-destructive p-3 sm:p-4 rounded-lg text-xs sm:text-sm font-semibold flex items-start gap-2 border border-destructive/20 mb-4 sm:mb-6 print:hidden">
                      <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">한해 총 결석 일수가 63일을 초과할 경우 교육과정 수료(진급)가 불가할 수 있습니다.</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="mb-1 text-[8.5pt] sm:text-[9.5pt]">{'<서식 3>'}</div>
              <div className="text-center mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold tracking-[0.3em] sm:tracking-[0.5em] pl-[0.3em] sm:pl-[0.5em]">결 석 계</h1>
                <p className="text-red-600 font-bold text-[11px] sm:text-xs mt-1">(결석한 날부터 5일 이내 제출)</p>
              </div>

              <div className="overflow-x-auto -mx-1 sm:mx-0">
                <table className="w-full border-collapse border border-black leading-tight mb-4 text-xs md:text-sm [word-break:keep-all] [overflow-wrap:break-word]">
                  <tbody>
                    <tr>
                      <th className="border border-black bg-slate-50/50 py-2 sm:py-2.5 w-[85px] sm:w-[110px] font-bold text-center text-[11px] sm:text-xs">결석 학생</th>
                      <td className="border border-black px-2 sm:px-3 py-2 sm:py-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] sm:text-xs whitespace-nowrap">학년-반-번:</span>
                            <input 
                              value={watchGradeClassNumber || ''} 
                              onChange={(e) => setValue('gradeClassNumber', e.target.value, { shouldValidate: true })}
                              className={`flex-1 max-w-[120px] sm:max-w-[150px] bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center text-xs sm:text-sm ${errors.gradeClassNumber ? 'border-destructive' : ''}`}
                              placeholder="예: 4-4-2"
                              readOnly={!!(profile?.studentGrade && profile?.studentClass && profile?.studentNumber)}
                            />
                          </div>
                          <div className="flex items-center gap-1 sm:ml-4">
                            <span className="text-[11px] sm:text-xs whitespace-nowrap">성 명:</span>
                            <input 
                              value={watchStudentName || ''} 
                              onChange={(e) => setValue('studentName', e.target.value, { shouldValidate: true })}
                              className={`flex-1 max-w-[120px] sm:max-w-[150px] bg-transparent border-b border-gray-300 focus:border-black focus:outline-none font-bold text-center text-xs sm:text-sm ${errors.studentName ? 'border-destructive' : ''}`}
                              placeholder="학생 이름"
                              readOnly={!!profile?.studentName}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <th className="border border-black bg-slate-50/50 py-2 sm:py-2.5 font-bold text-center text-[11px] sm:text-xs">결석 기간</th>
                      <td className="border border-black px-2 sm:px-3 py-2 sm:py-2.5">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
                          <input 
                            type="date" 
                            value={watchAbsenceStartDate || ''} 
                            onChange={(e) => setValue('absencePeriod.startDate', e.target.value, { shouldValidate: true })}
                            className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none font-sans text-xs" 
                          />
                          <span>~</span>
                          <input 
                            type="date" 
                            value={watchAbsenceEndDate || ''} 
                            onChange={(e) => setValue('absencePeriod.endDate', e.target.value, { shouldValidate: true })}
                            className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none font-sans text-xs" 
                          />
                          <span className="ml-1 sm:ml-2">대략 (</span>
                          <input 
                            type="number" 
                            min="1" 
                            value={watchAbsenceTotalDays || 1} 
                            onChange={(e) => setValue('absencePeriod.totalDays', Number(e.target.value), { shouldValidate: true })}
                            className="w-8 sm:w-10 text-center border-b border-gray-300 focus:border-black focus:outline-none font-bold font-sans text-xs sm:text-sm" 
                          />
                          <span>) 일간</span>
                        </div>
                        {absenceExcludedSummary && (
                          <div className="mt-1.5 text-[8pt] text-indigo-700 font-sans bg-indigo-50/80 px-2 py-1 rounded border border-indigo-200/80 leading-relaxed font-medium">
                            {absenceExcludedSummary}
                          </div>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <th className="border border-black bg-slate-50/50 py-2 sm:py-2.5 font-bold text-center text-[11px] sm:text-xs">결석종류</th>
                      <td className="border border-black px-2 sm:px-3 py-2 sm:py-2.5">
                        <select 
                          value={watch('absenceType')} 
                          onChange={(e) => setValue('absenceType', e.target.value as any)} 
                          className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none bg-transparent text-xs sm:text-sm"
                        >
                          <option value="병결">병결</option>
                          <option value="미인정">미인정</option>
                          <option value="출석인정">출석인정</option>
                          <option value="기타">기타</option>
                        </select>
                      </td>
                    </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center">결석사유</th>
                    <td className="border border-black px-3 py-2.5">
                      <textarea 
                        value={watch('absenceReason') || ''} 
                        onChange={(e) => setValue('absenceReason', e.target.value, { shouldValidate: true })}
                        placeholder="결석 사유를 자세히 입력해주세요." 
                        className={`w-full h-24 bg-transparent focus:outline-none resize-none placeholder:text-gray-400 leading-relaxed ${(errors as any).absenceReason ? 'border-b border-destructive' : ''}`}
                      />
                      {(errors as any).absenceReason && <p className="text-xs text-destructive mt-1 font-sans font-normal">{(errors as any).absenceReason.message}</p>}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="border border-black px-4 py-6 relative">
                      <div className="text-center mb-4 text-sm font-medium">
                        {format(submitDate, 'yyyy 년 MM 월 dd 일')}
                      </div>
                      <div className="flex flex-col items-end pr-12 space-y-2 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">학 생 :</span>
                          <span className="min-w-[80px] text-center font-bold mr-2">{watchStudentName || '이름 입력'}</span>
                          <span className="inline-block text-center w-8 text-transparent select-none">(인)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium">학부모 :</span>
                          <span className="min-w-[80px] text-center font-bold mr-2 text-blue-800">{profile?.parentName || '학부모'}</span>
                          <span className="relative inline-block text-center w-8 ml-1">
                            <span className="font-medium">(인)</span>
                            {profile?.parentSignature && (
                              <img 
                                src={profile.parentSignature} 
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 max-w-none object-contain mix-blend-multiply pointer-events-none z-10" 
                                alt="sig" 
                              />
                            )}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>

              {/* 확인서 영역 */}
              <div className="text-center mb-2 print:hidden">
                <h2 className="text-lg font-bold tracking-[0.5em] text-gray-400">확 인 서 (작성 불필요)</h2>
              </div>
              <table className="w-full border-collapse border border-slate-300 leading-relaxed opacity-40 select-none pointer-events-none print:hidden mb-4">
                <tbody>
                  <tr>
                    <th className="border border-slate-300 bg-slate-50/50 py-2.5 w-[110px] font-bold text-center">구 분</th>
                    <td className="border border-slate-300 px-3 py-2.5 text-center text-xs">
                      병결 [ &nbsp; ] &nbsp;&nbsp;&nbsp;
                      미인정 결석 [ &nbsp; ] &nbsp;&nbsp;&nbsp;
                      기타결 [ &nbsp; ]<br/>
                      출석인정(경조사, 법정전염병, 생리결석, 비자) [ &nbsp; ]
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="border border-slate-300 px-3 py-6 align-top">
                      <div className="text-center mb-3 font-medium text-xs">위 제출 내용이 사실과 다름없음을 확인함.</div>
                      <div className="space-y-1.5 text-xs">
                        <p>1. 확인방법: 전화/문자( &nbsp; ), 학부모 내교( &nbsp; ), 가정방문( &nbsp; ), 기타( &nbsp; )</p>
                        <p>2. 확인내용: 결석 사유와 동일함을 확인합니다.</p>
                        <div className="h-[10px]"></div>
                        <p>3. 확인일시: 20 &nbsp; 년 &nbsp; 월 &nbsp; 일</p>
                      </div>
                      <div className="text-center mt-6 mb-1 text-xs">
                        20 &nbsp; 년 &nbsp; 월 &nbsp; 일
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : currentType === 'field-trip-report' ? (
            <div className="font-serif text-[10pt] text-black">
              {originalApplyDoc && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center gap-4 mb-6 print:hidden">
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm">연동된 체험학습 신청서 정보</h5>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {originalApplyDoc.docNo} ({originalApplyDoc.parentFormData?.tripPeriod?.startDate} ~ {originalApplyDoc.parentFormData?.tripPeriod?.endDate})
                    </p>
                  </div>
                  <Badge className="bg-green-600 text-white border-none font-bold">연동 완료</Badge>
                </div>
              )}

              <div className="mb-1 text-[9.5pt]">{'<서식 2>'}</div>
              <div className="text-center mb-5 space-y-1">
                <h1 className="text-xl md:text-2xl font-bold whitespace-nowrap leading-snug">「학교장허가 교외체험학습」 결과보고서</h1>
                <p className="text-red-600 font-bold text-xs">(체험학습 실시 후 7일 이내 제출)</p>
              </div>

              <div className="overflow-x-auto -mx-1 sm:mx-0">
              <table className="w-full border-collapse border border-black leading-tight mb-4 text-center text-xs md:text-sm min-w-[500px]">
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '26%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center whitespace-nowrap">성 명</th>
                    <td className="border border-black py-2.5 px-1 font-bold text-center whitespace-nowrap">
                      <input 
                        value={watch('studentName') || ''} 
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none font-bold text-center ${errors.studentName ? 'border-destructive' : ''}`}
                        placeholder="학생명"
                        readOnly
                      />
                    </td>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center whitespace-nowrap">학 년 &nbsp; 반 &nbsp; 번</th>
                    <td className="border border-black py-2.5 px-1 text-center whitespace-nowrap">
                      <input 
                        value={watch('gradeClassNumber') || ''} 
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${errors.gradeClassNumber ? 'border-destructive' : ''}`}
                        placeholder="예: 4-4-2"
                        readOnly
                      />
                    </td>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center whitespace-nowrap">휴대폰</th>
                    <td className="border border-black py-2.5 px-1 text-center whitespace-nowrap">
                      <input 
                        value={watch('phone') || ''} 
                        onChange={(e) => setValue('phone', e.target.value, { shouldValidate: true })}
                        className="w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center"
                        placeholder="보호자 연락처"
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold leading-tight whitespace-nowrap">교외체험학습<br/>기간</th>
                    <td colSpan={3} className="border border-black py-2.5 text-left px-3 text-xs">
                      <input type="date" value={watchFieldTripStartDate || ''} className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none mr-1 opacity-60 font-sans" readOnly /> ~ &nbsp;
                      <input type="date" value={watchFieldTripEndDate || ''} className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none mr-1 opacity-60 font-sans" readOnly /> &nbsp;
                      총 ( <input type="number" min="1" value={watchFieldTripTotalDays || 1} className="w-10 text-center border-b border-gray-300 focus:border-black focus:outline-none mr-1 opacity-60 font-bold font-sans" readOnly /> ) 일간
                    </td>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">학습형태</th>
                    <td className="border border-black py-2.5 px-1">
                      <select 
                        value={watch('tripType')} 
                        disabled
                        className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none bg-transparent opacity-60 cursor-not-allowed text-xs"
                      >
                        <option value="가족동반여행">가족동반여행</option>
                        <option value="친인척 방문">친인척 방문</option>
                        <option value="답사·견학 활동">답사·견학 활동</option>
                        <option value="체험활동">체험활동</option>
                        <option value="기타">기타</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">교외체험학습<br/>장소</th>
                    <td colSpan={5} className="border border-black py-2.5 text-left px-3">
                      <input 
                        value={watch('destination') || ''} 
                        className="w-full bg-transparent border-none focus:outline-none opacity-60"
                        readOnly
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">제 목</th>
                    <td colSpan={5} className="border border-black py-2.5 text-left px-3">
                      <input 
                        value={watch('reportTitle') || ''} 
                        onChange={(e) => setValue('reportTitle', e.target.value, { shouldValidate: true })}
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none font-bold ${(errors as any).reportTitle ? 'border-destructive' : ''}`}
                        placeholder="보고서 제목을 입력해주세요."
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 h-[280px] leading-tight text-[9.5pt] font-bold">교외<br/>체험학습<br/>결과</th>
                    <td colSpan={5} className="border border-black py-2.5 text-left px-3 align-top">
                      <div className="text-gray-400 text-xs mb-2 select-none font-sans font-normal">* 각 일정별로 느낀 점, 배운 점 등을 글, 그림 등으로 학생이 직접 기록합니다.</div>
                      <textarea 
                        value={watch('reportContent') || ''} 
                        onChange={(e) => setValue('reportContent', e.target.value, { shouldValidate: true })}
                        placeholder="체험학습의 결과 및 느낀 점을 자세하고 구체적으로 작성해 주세요. (가급적 학생이 작성하도록 지도 바랍니다)" 
                        className={`w-full h-[240px] bg-transparent focus:outline-none resize-none placeholder:text-gray-400 leading-relaxed ${(errors as any).reportContent ? 'border-b border-destructive' : ''}`}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="border border-black py-5 relative">
                      <div className="text-center font-bold text-[10.5pt] mb-2">
                        위와 같이 「학교장허가 교외체험학습」 결과보고서를 제출합니다.
                      </div>
                      <div className="text-center font-bold mb-2.5 text-[9.5pt]">
                        {format(submitDate, 'yyyy 년 MM 월 dd 일')}
                      </div>
                      <div className="flex justify-end pr-12 items-center mb-2.5 text-[9.5pt]">
                        <span className="font-bold mr-2">보호자 : </span>
                        <span className="min-w-[80px] text-center font-bold mr-2 text-blue-800">{profile?.parentName || '학부모'}</span>
                        <span className="relative inline-block text-center w-8 ml-1">
                          <span className="font-medium">(인)</span>
                          {profile?.parentSignature && (
                            <img 
                              src={profile.parentSignature} 
                              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 max-w-none object-contain mix-blend-multiply pointer-events-none z-10" 
                              alt="sig" 
                            />
                          )}
                        </span>
                      </div>
                      <div className="text-center font-black text-[14pt] tracking-widest mt-1.5">
                        호치민시한국국제학교장 귀하
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>

              <div className="text-xs text-gray-500 space-y-1 mt-4 font-sans font-normal leading-relaxed print:text-black">
                <p>※ 보고서 제출 기한: 체험학습 종료 후 7일 이내</p>
                <p>※ 보고서의 내용은 자세하고 구체적으로 작성 / 1일 1장, 2일 이상은 2일에 1장 정도 추가(권고)</p>
                <p>※ 체험학습을 증빙할 수 있는 자료(항공권, 입장권, 팜플렛, 사진, 영수증 등) 첨부</p>
              </div>
            </div>
          ) : (
            <div className="font-serif text-[10pt] text-black min-w-[280px]">
              {/* 누적 일수 경고 (연간 누계 기능 활성화 시에만 노출) */}
              {enableCumulative && (
                <>
                  <div className="bg-slate-50 border border-slate-200 p-2.5 sm:p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-4 sm:mb-6 print:hidden">
                    <div>
                      <h5 className="font-bold text-slate-800 text-xs sm:text-sm">연간 누적 체험학습 현황 (올해)</h5>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">출석인정 개인 교외체험학습 사용 현황</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] sm:text-xs text-muted-foreground block">누적 / 한도 (연간)</span>
                      <span className={`text-xs sm:text-base md:text-sm font-black whitespace-nowrap ${isOverFieldTripLimit ? 'text-destructive' : 'text-slate-700'}`}>
                        {isLoadingLimits ? '...' : `${accumulatedFieldTripDays}일`}
                        {` + 신청 ${watchFieldTripTotalDays}일 = 총 ${accumulatedFieldTripDays + Number(watchFieldTripTotalDays)}일`}
                        {` / 20일`}
                      </span>
                    </div>
                  </div>

                  {isOverFieldTripLimit && (
                    <div className="bg-destructive/10 text-destructive p-3 sm:p-4 rounded-lg text-xs sm:text-sm font-semibold flex items-start gap-2 border border-destructive/20 mb-4 sm:mb-6 print:hidden">
                      <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">연간 교외체험학습 허용 한도(20일)를 초과하여 신청할 수 없습니다.</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="mb-1 text-[8.5pt] sm:text-[9.5pt]">{'<서식 1>'}</div>
              <div className="text-center mb-4 sm:mb-5 space-y-1">
                <h1 className="text-xl md:text-2xl font-bold whitespace-nowrap leading-snug">「학교장허가 교외체험학습」 신청서</h1>
                <p className="text-red-600 font-bold text-[11px] sm:text-xs">(체험학습 실시 7일전 제출)</p>
              </div>

              <div className="overflow-x-auto -mx-1 sm:mx-0">
              <table className="w-full border-collapse border border-black leading-tight mb-4 text-center text-xs md:text-sm min-w-[500px]">
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '26%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center whitespace-nowrap">성 명</th>
                    <td className="border border-black py-2.5 px-1 font-bold text-center whitespace-nowrap">
                      <input 
                        value={watchStudentName || ''} 
                        onChange={(e) => setValue('studentName', e.target.value, { shouldValidate: true })}
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none font-bold text-center ${errors.studentName ? 'border-destructive' : ''}`}
                        placeholder="학생명 입력"
                        readOnly={!!profile?.studentName}
                      />
                    </td>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center whitespace-nowrap">학 년 &nbsp; 반 &nbsp; 번</th>
                    <td className="border border-black py-2.5 px-1 text-center whitespace-nowrap">
                      <input 
                        value={watchGradeClassNumber || ''} 
                        onChange={(e) => setValue('gradeClassNumber', e.target.value, { shouldValidate: true })}
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${errors.gradeClassNumber ? 'border-destructive' : ''}`}
                        placeholder="예: 4-4-2"
                        readOnly={!!(profile?.studentGrade && profile?.studentClass && profile?.studentNumber)}
                      />
                    </td>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center whitespace-nowrap">휴대폰</th>
                    <td className="border border-black py-2.5 px-1 text-center whitespace-nowrap">
                      <input 
                        value={watch('phone') || ''} 
                        onChange={(e) => setValue('phone', e.target.value, { shouldValidate: true })}
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${(errors as any).phone ? 'border-destructive' : ''}`}
                        placeholder="보호자 연락처"
                      />
                    </td>
                  </tr>
                  {/* 2. 본교 출석인정기간 (rowSpan 3 또는 2) / 신청 기간 / 연간 누적 일수 / 불인정 기간 안내 및 표 */}
                  <tr>
                    <th rowSpan={enableCumulative ? 3 : 2} className="border border-black bg-slate-50/50 py-2.5 text-red-600 font-bold text-[8pt] leading-snug break-keep" style={{ wordBreak: 'keep-all' }}>
                      본교 출석인정기간<br/>(휴일 제외, 학기당 7일,<br/>연간 14일)
                    </th>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-[9pt] break-keep whitespace-nowrap" style={{ wordBreak: 'keep-all' }}>신청 기간</th>
                    <td colSpan={4} className="border border-black py-2.5 text-left px-3 text-xs">
                      <div className="flex flex-wrap items-center gap-1">
                        <input 
                          type="date" 
                          value={watchFieldTripStartDate || ''} 
                          onChange={(e) => setValue('tripPeriod.startDate', e.target.value, { shouldValidate: true })}
                          className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none mr-1 font-sans" 
                        /> ~ &nbsp;
                        <input 
                          type="date" 
                          value={watchFieldTripEndDate || ''} 
                          onChange={(e) => setValue('tripPeriod.endDate', e.target.value, { shouldValidate: true })}
                          className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none mr-1 font-sans" 
                        /> &nbsp;
                        총 ( 
                        <input 
                          type="number" 
                          min="1" 
                          value={watchFieldTripTotalDays || 1} 
                          onChange={(e) => setValue('tripPeriod.totalDays', Number(e.target.value), { shouldValidate: true })}
                          className="w-10 text-center border-b border-gray-300 focus:border-black focus:outline-none mr-1 font-bold font-sans" 
                        /> ) 일간
                      </div>
                      {fieldTripExcludedSummary && (
                        <div className="mt-1.5 text-[8pt] text-indigo-700 font-sans bg-indigo-50/80 px-2 py-1 rounded border border-indigo-200/80 leading-relaxed font-medium">
                          {fieldTripExcludedSummary}
                        </div>
                      )}
                      {overlappedBlackoutPeriod && (
                        <div className="mt-1.5 text-[8pt] text-red-700 font-sans bg-red-50 px-2 py-1 rounded border border-red-200 leading-relaxed font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                          {t('parents.apply.disallowed_period_toast_title') || '신청 기간이 아닙니다'}: {overlappedBlackoutPeriod.reason} ({overlappedBlackoutPeriod.startDate.replace(/-/g, '.')} ~ {overlappedBlackoutPeriod.endDate.replace(/-/g, '.')})
                        </div>
                      )}
                    </td>
                  </tr>
                  {enableCumulative && (
                    <tr>
                      <th className="border border-black bg-slate-50/50 py-2.5 font-bold leading-tight text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>연간 체험학습<br/>누적 일수</th>
                      <td colSpan={4} className="border border-black py-2.5 text-left px-3 text-xs break-keep" style={{ wordBreak: 'keep-all' }}>
                        기존 사용 일수 및 금번 신청 일수 포함 총 ( {accumulatedFieldTripDays} + {watchFieldTripTotalDays} = {accumulatedFieldTripDays + Number(watchFieldTripTotalDays)} ) 일
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={5} className="border border-black p-2 bg-white text-left align-middle font-sans">
                      <div className="text-[7.5pt] font-bold text-gray-800 mb-1 flex items-center justify-between">
                        <span>※ 허용 일수 초과 시, 초과 일수는 [미인정결석] 처리됨.</span>
                        <span className="text-red-600 font-bold">※ 체험학습 신청 불가 기간</span>
                      </div>
                      <table className="w-full border-collapse border border-black text-center text-[7.5pt] leading-tight">
                        <thead>
                          <tr className="bg-slate-50 font-bold">
                            <th className="border border-black py-0.5 w-[46%]">체험학습 불인정 기간</th>
                            <th className="border border-black py-0.5 w-[54%]">사 유</th>
                          </tr>
                        </thead>
                        <tbody>
                          {blackoutPeriods.map((bp, i) => (
                            <tr key={bp.id || i} className="h-[14px]">
                              <td className="border border-black py-0.5 px-1 font-mono text-[7pt]">{bp.startDate.replace(/-/g, '.')} ~ {bp.endDate.replace(/-/g, '.')}</td>
                              <td className="border border-black py-0.5 px-1 text-left text-[7pt] pl-2">{bp.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">학습형태</th>
                    <td colSpan={5} className="border border-black py-2.5 text-left px-3">
                      <select 
                        value={watch('tripType')} 
                        onChange={(e) => setValue('tripType', e.target.value as any)} 
                        className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none bg-transparent text-xs"
                      >
                        <option value="가족동반여행">가족동반여행</option>
                        <option value="친인척 방문">친인척 방문</option>
                        <option value="답사·견학 활동">답사·견학 활동</option>
                        <option value="체험활동">체험활동</option>
                        <option value="기타">기타</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">방문 장소</th>
                    <td colSpan={5} className="border border-black py-2.5 text-left px-3">
                      <input 
                        value={watch('destination') || ''} 
                        onChange={(e) => setValue('destination', e.target.value, { shouldValidate: true })}
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none ${(errors as any).destination ? 'border-destructive' : ''}`}
                        placeholder="방문할 국가 및 도시명을 입력해주세요."
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold leading-tight whitespace-nowrap">보호자<br/>(인솔자)명</th>
                    <td className="border border-black py-2.5 px-1 font-bold text-center whitespace-nowrap">
                      <input 
                        value={watch('companionName') || ''} 
                        onChange={(e) => setValue('companionName', e.target.value, { shouldValidate: true })}
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${(errors as any).companionName ? 'border-destructive' : ''}`}
                        placeholder="동행자 성명"
                      />
                    </td>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">관계</th>
                    <td className="border border-black py-2.5 px-1 text-center whitespace-nowrap">
                      <input 
                        value={watch('companionRelation') || ''} 
                        onChange={(e) => setValue('companionRelation', e.target.value, { shouldValidate: true })}
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${(errors as any).companionRelation ? 'border-destructive' : ''}`}
                        placeholder="예: 부, 모, 조부"
                      />
                    </td>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">휴대폰</th>
                    <td className="border border-black py-2.5 px-1 text-center whitespace-nowrap">
                      <input 
                        value={watch('phone') || ''} 
                        onChange={(e) => setValue('phone', e.target.value, { shouldValidate: true })}
                        className="w-full bg-transparent border-none text-center text-gray-500 cursor-not-allowed"
                        readOnly
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">목 적</th>
                    <td colSpan={5} className="border border-black py-2.5 text-left px-3">
                      <input 
                        value={watch('purpose') || ''} 
                        onChange={(e) => setValue('purpose', e.target.value, { shouldValidate: true })}
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none ${(errors as any).purpose ? 'border-destructive' : ''}`}
                        placeholder="체험학습을 통해 달성하고자 하는 구체적인 목적"
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 h-[120px] leading-tight text-[9.5pt] font-bold">교외체험학습<br/>계획<br/>(일정, 기대<br/>효과 등)</th>
                    <td colSpan={5} className="border border-black py-2.5 text-left px-3 align-top">
                      <textarea 
                        value={watch('detailedPlan') || ''} 
                        onChange={(e) => setValue('detailedPlan', e.target.value, { shouldValidate: true })}
                        placeholder="일자별 상세 이동 경로, 방문 장소 및 예상 활동을 꼼꼼하게 입력해 주세요." 
                        className={`w-full h-28 bg-transparent focus:outline-none resize-none placeholder:text-gray-400 leading-relaxed ${(errors as any).detailedPlan ? 'border-b border-destructive' : ''}`}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="border border-black py-5 relative">
                      <div className="text-center font-bold text-[10.5pt] mb-2">
                        위와 같이 「학교장허가 교외체험학습」을 신청합니다.
                      </div>
                      <div className="text-center font-bold mb-2.5 text-[9.5pt]">
                        {format(submitDate, 'yyyy 년 MM 월 dd 일')}
                      </div>
                      <div className="flex justify-end pr-12 items-center mb-2.5 text-[9.5pt]">
                        <span className="font-bold mr-2">보호자 : </span>
                        <span className="min-w-[80px] text-center font-bold mr-2 text-blue-800">{profile?.parentName || '학부모'}</span>
                        <span className="relative inline-block text-center w-8 ml-1">
                          <span className="font-medium">(인)</span>
                          {profile?.parentSignature && (
                            <img 
                              src={profile.parentSignature} 
                              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 max-w-none object-contain mix-blend-multiply pointer-events-none z-10" 
                              alt="sig" 
                            />
                          )}
                        </span>
                      </div>
                      <div className="text-center font-black text-[14pt] tracking-widest mt-1.5">
                        호치민시한국국제학교장 귀하
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>

              {/* 통보서 영역 */}
              <div className="text-center mb-2 print:hidden">
                <h2 className="text-lg font-bold tracking-[0.5em] text-gray-400">통 보 서 (작성 불필요)</h2>
              </div>
              <table className="w-full border-collapse border border-slate-300 leading-relaxed opacity-40 select-none pointer-events-none print:hidden mb-4">
                <tbody>
                  <tr>
                    <td className="border border-slate-300 py-6 px-4 text-center">
                      <p className="font-bold text-sm mb-4">「학교장허가 교외체험학습」 통보서</p>
                      <div className="text-left text-xs space-y-2 max-w-md mx-auto">
                        <p>학생: __________________ ( ____학년 ____반 ____번 )</p>
                        <p>기간: 20___년 ___월 ___일 ~ ___월 ___일 ( ___일간 )</p>
                        <p>위와 같이 교외체험학습을 승인 및 통보합니다.</p>
                      </div>
                      <p className="mt-6 text-xs">20___ 년 ___ 월 ___ 일</p>
                      <p className="mt-2 font-bold text-xs">호치민시한국국제학교장 (직인생략)</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
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

      <Dialog open={showPinModal} onOpenChange={setShowPinModal}>
        <DialogContent className="w-[92%] sm:max-w-md rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold">전자서명 비밀번호 확인</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-500">
              기기 등록 시 설정한 4자리 PIN 번호를 입력해 주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4 space-y-4">
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pinInput.length === 4 && !isSubmitting) {
                  e.preventDefault();
                  confirmSubmit();
                }
              }}
              placeholder="••••"
              className="text-center text-3xl tracking-[1em] w-[150px] font-mono h-14 border-slate-300 focus:border-indigo-500"
              autoFocus
            />
          </div>
          <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { setShowPinModal(false); setPinInput(''); }} disabled={isSubmitting} className="h-10 px-4">
              취소
            </Button>
            <Button size="sm" onClick={() => confirmSubmit(false)} disabled={isSubmitting || pinInput.length !== 4} className="h-10 px-4 bg-primary text-primary-foreground font-bold">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '서명 후 제출'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN 인증 비활성화 시 확인 대화상자 */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="w-[92%] sm:max-w-md rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold">신청서 제출 확인</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-600 pt-1">
              신청서를 전송하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
            {pendingData?.type === 'absence' && (
              <div>
                <span className="font-bold text-slate-800">[결석계]</span> {pendingData.studentName} ({pendingData.absencePeriod?.startDate} ~ {pendingData.absencePeriod?.endDate})
              </div>
            )}
            {pendingData?.type === 'field-trip' && (
              <div>
                <span className="font-bold text-slate-800">[교외체험학습 신청서]</span> {pendingData.studentName} ({pendingData.tripPeriod?.startDate} ~ {pendingData.tripPeriod?.endDate})
              </div>
            )}
            {pendingData?.type === 'field-trip-report' && (
              <div>
                <span className="font-bold text-slate-800">[교외체험학습 보고서]</span> {pendingData.studentName} ({pendingData.reportTitle})
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmModal(false)}
              disabled={isSubmitting}
              className="h-10 px-4"
            >
              취소
            </Button>
            <Button
              size="sm"
              onClick={() => confirmSubmit(true)}
              disabled={isSubmitting}
              className="h-10 px-4 bg-primary text-primary-foreground font-bold"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '전송'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
