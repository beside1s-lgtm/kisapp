'use client';

import { Suspense, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { createDocument, getStudentFieldTripDays, getStudentAbsenceDays, getDocumentById, submitFieldTripReport } from '@/lib/services/documentService';
import { getDocConfig } from '@/lib/services/settingsService';
import { getWorkingDaysCount } from '@/lib/utils';
import { getApproversByGradeClass } from '@/lib/services/userService';
import { ParentFormData, ApprovalDoc } from '@/lib/types';
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
  const [pinInput, setPinInput] = useState('');
  const [pendingData, setPendingData] = useState<FormValues | null>(null);
  
  let defaultType: 'absence' | 'field-trip' | 'field-trip-report' = 'absence';
  const paramType = searchParams.get('type');
  if (paramType === 'field-trip') defaultType = 'field-trip';
  if (paramType === 'field-trip-report') defaultType = 'field-trip-report';

  const cloneId = searchParams.get('cloneId');
  const applyId = searchParams.get('applyId');

  const [originalApplyDoc, setOriginalApplyDoc] = useState<ApprovalDoc | null>(null);
  const [loadingOriginal, setLoadingOriginal] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors }, clearErrors } = useForm<FormValues>({
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
      companionRelation: '',
      purpose: '',
      detailedPlan: '',
      relatedApplyDocId: applyId || '',
      reportTitle: '',
      reportContent: '',
    } as any
  });

  const currentType = watch('type');
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
  const [docConfig, setDocConfig] = useState<any>(null);

  // 설정 로드
  useEffect(() => {
    getDocConfig().then(cfg => setDocConfig(cfg));
  }, []);

  const annualSchoolDays = docConfig?.annualSchoolDays || 190;
  const maxFieldTripDays = Math.floor(annualSchoolDays * 0.1); // 연간 10%
  const maxAbsenceDays = annualSchoolDays - Math.ceil(annualSchoolDays * 2 / 3); // 유급 기준 1/3 결석 한도

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

  // 3.1. 날짜 변경 시 주말(토, 일)을 제외한 평일 수 자동 계산 이펙트
  useEffect(() => {
    if (watchAbsenceStartDate && watchAbsenceEndDate) {
      const workingDays = getWorkingDaysCount(watchAbsenceStartDate, watchAbsenceEndDate);
      setValue('absencePeriod.totalDays', workingDays);
    }
  }, [watchAbsenceStartDate, watchAbsenceEndDate, setValue]);

  useEffect(() => {
    if (watchFieldTripStartDate && watchFieldTripEndDate) {
      const workingDays = getWorkingDaysCount(watchFieldTripStartDate, watchFieldTripEndDate);
      setValue('tripPeriod.totalDays', workingDays);
    }
  }, [watchFieldTripStartDate, watchFieldTripEndDate, setValue]);

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
    
  const isOverLimit = isOverFieldTripLimit || isOverAbsenceLimit || isSingleFieldTripOverLimit;

  const handleTabChange = (val: string) => {
    router.push(`/parents/apply?type=${val}`);
  };

  const onSubmit = (data: FormValues) => {
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
    setShowPinModal(true);
  };

  const confirmSubmit = async () => {
    if (!user || !profile || !pendingData) return;
    
    if (!profile.parentName) {
      toast({ variant: 'destructive', title: '설정 오류', description: '설정에서 학부모 이름을 등록해 주세요.' });
      setShowPinModal(false);
      return;
    }
    
    if (pinInput.length !== 4) {
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
          return;
        }
      }

      const hashedInput = await hashPIN(pinInput);
      if (profile.hashedPin !== hashedInput) {
        toast({ variant: 'destructive', title: '인증 실패', description: 'PIN 번호가 일치하지 않습니다.' });
        setIsSubmitting(false);
        return;
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
      const isFieldTripDoc = data.type === 'field-trip' || data.type === 'field-trip-report';
      const approvers = await getApproversByGradeClass(grade, studentClass, isFieldTripDoc);

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
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:p-0 print:bg-white animate-in fade-in duration-500">
      <div className="max-w-[210mm] mx-auto mb-6 print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" className="bg-white hover:bg-slate-50 text-muted-foreground hover:text-foreground shadow-sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            뒤로가기
          </Button>
          <Button variant="outline" className="bg-white hover:bg-slate-50 text-muted-foreground hover:text-foreground shadow-sm" onClick={() => router.push('/parents')}>
            <Home className="mr-2 h-4 w-4" />
            홈
          </Button>
        </div>
        <div className="flex items-center gap-4">
          {defaultType !== 'field-trip-report' ? (
            <Tabs value={currentType} onValueChange={handleTabChange} className="w-[280px]">
              <TabsList className="grid w-full grid-cols-2 h-10 shadow-sm">
                <TabsTrigger value="absence" className="text-sm font-bold">결석계</TabsTrigger>
                <TabsTrigger value="field-trip" className="text-sm font-bold">체험학습 신청서</TabsTrigger>
              </TabsList>
            </Tabs>
          ) : (
            <div className="bg-amber-100 border border-amber-200 text-amber-800 text-sm font-bold px-4 py-2 rounded-lg">
              체험학습 결과보고서 작성 모드
            </div>
          )}
        </div>
      </div>

      <div className="w-[210mm] min-h-[297mm] mx-auto bg-white p-[20mm] shadow-2xl border border-slate-200/80 rounded-sm print:shadow-none print:border-none print:p-0 print:w-[170mm] print:mx-auto print:min-h-0">
        <form onSubmit={handleSubmit(onSubmit)}>
          {currentType === 'absence' ? (
            <div className="font-serif text-[11pt] text-black">
              {/* 누적 결석 경고 알림 */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center gap-4 mb-6 print:hidden">
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">연간 누적 결석 현황 (올해)</h5>
                  <p className="text-xs text-muted-foreground mt-0.5">병결, 미인정, 기타 결석의 합계<br />(출석인정 제외)</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">누적 / 한도 (유급)</span>
                  <span className={`text-sm sm:text-base md:text-sm font-black whitespace-nowrap ${isOverAbsenceLimit ? 'text-destructive' : 'text-slate-700'}`}>
                    {isLoadingLimits ? '...' : `${accumulatedAbsenceDays}일`}
                    {` + 신청 ${watchAbsenceTotalDays}일 = 총 ${accumulatedAbsenceDays + Number(watchAbsenceTotalDays)}일`}
                    {` / 63일`}
                  </span>
                </div>
              </div>

              {isOverAbsenceLimit && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm font-semibold flex items-start gap-2 border border-destructive/20 mb-6 print:hidden">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">한해 총 결석 일수가 63일을 초과할 경우 교육과정 수료(진급)가 불가할 수 있습니다.</p>
                  </div>
                </div>
              )}

              <div className="mb-1 text-[9.5pt]">{'<서식 3>'}</div>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold tracking-[0.5em] pl-[0.5em]">결 석 계</h1>
              </div>

              <table className="w-full border-collapse border border-black leading-tight mb-4 text-xs md:text-sm [word-break:keep-all] [overflow-wrap:break-word]">
                <tbody>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 w-[110px] font-bold text-center">결석 학생</th>
                    <td className="border border-black px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span>학년 반 번 :</span>
                        <input 
                          {...register('gradeClassNumber')} 
                          className={`flex-1 max-w-[150px] bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${errors.gradeClassNumber ? 'border-destructive' : ''}`}
                          placeholder="예: 4-4-2"
                          readOnly={!!(profile?.studentGrade && profile?.studentClass && profile?.studentNumber)}
                        />
                        <span className="ml-4">성 명 :</span>
                        <input 
                          {...register('studentName')} 
                          className={`flex-1 max-w-[150px] bg-transparent border-b border-gray-300 focus:border-black focus:outline-none font-bold text-center ${errors.studentName ? 'border-destructive' : ''}`}
                          placeholder="학생 이름"
                          readOnly={!!profile?.studentName}
                        />
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center">결석 기간</th>
                    <td className="border border-black px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <input type="date" {...register('absencePeriod.startDate')} className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none" />
                        <span>~</span>
                        <input type="date" {...register('absencePeriod.endDate')} className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none" />
                        <span className="ml-4">대략 (</span>
                        <input type="number" min="1" {...register('absencePeriod.totalDays')} className="w-10 text-center border-b border-gray-300 focus:border-black focus:outline-none" />
                        <span>) 일간</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center">결석종류</th>
                    <td className="border border-black px-3 py-2.5">
                      <select 
                        value={watch('absenceType')} 
                        onChange={(e) => setValue('absenceType', e.target.value as any)} 
                        className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none bg-transparent"
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
                        {...register('absenceReason')} 
                        placeholder="결석 사유를 자세히 입력해주세요." 
                        className={`w-full h-24 bg-transparent focus:outline-none resize-none placeholder:text-gray-400 leading-relaxed ${(errors as any).absenceReason ? 'border-b border-destructive' : ''}`}
                      />
                      {(errors as any).absenceReason && <p className="text-xs text-destructive mt-1 font-sans font-normal">{(errors as any).absenceReason.message}</p>}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="border border-black px-3 py-4 relative">
                      <div className="text-center mb-6 text-sm">
                        {format(submitDate, 'yyyy 년 MM 월 dd 일')}
                      </div>
                      <div className="flex flex-col items-end pr-10 space-y-2 text-sm">
                        <div className="flex items-center gap-4">
                          <span>학 생 :</span>
                          <span className="w-[100px] text-center font-bold">{watchStudentName || '이름 입력'}</span>
                        </div>
                        <div className="flex items-center gap-4 relative">
                          <span>학부모 :</span>
                          <span className="w-[100px] text-center font-bold text-sm text-blue-800">{profile?.parentName || '학부모'}</span>
                          <span className="ml-2">(인)</span>
                          {profile?.parentSignature && (
                            <img src={profile.parentSignature} className="absolute -right-8 -top-4 w-14 h-14 object-contain mix-blend-multiply" alt="sig" />
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

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
              <div className="text-center mb-6 space-y-1">
                <h1 className="text-2xl font-bold">「학교장허가 교외체험학습」 결과보고서</h1>
                <p className="text-red-600 font-bold text-xs">(체험학습 실시 후 7일 이내 제출)</p>
              </div>

              <table className="w-full border-collapse border border-black leading-tight mb-4 text-center text-xs md:text-sm [word-break:keep-all] [overflow-wrap:break-word]">
                <tbody>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 w-[120px] font-bold">성 명</th>
                    <td className="border border-black py-2.5 px-2">
                      <input 
                        {...register('studentName')} 
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none font-bold text-center ${errors.studentName ? 'border-destructive' : ''}`}
                        placeholder="학생명"
                        readOnly
                      />
                    </td>
                    <th className="border border-black bg-slate-50/50 py-2.5 w-[120px] font-bold">학년 반 번</th>
                    <td colSpan={3} className="border border-black py-2.5 px-2">
                      <input 
                        {...register('gradeClassNumber')} 
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${errors.gradeClassNumber ? 'border-destructive' : ''}`}
                        placeholder="예: 4-4-2"
                        readOnly
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold leading-tight">교외체험학습<br/>기간</th>
                    <td colSpan={3} className="border border-black py-2.5 text-left px-4">
                      <input type="date" {...register('tripPeriod.startDate')} className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none mr-1 opacity-60" readOnly /> ~ &nbsp;
                      <input type="date" {...register('tripPeriod.endDate')} className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none mr-1 opacity-60" readOnly /> &nbsp;
                      총 ( <input type="number" min="1" {...register('tripPeriod.totalDays')} className="w-10 text-center border-b border-gray-300 focus:border-black focus:outline-none mr-1 opacity-60" readOnly /> ) 일간
                    </td>
                    <th className="border border-black bg-slate-50/50 py-2.5 w-[100px] font-bold">학습형태</th>
                    <td className="border border-black py-2.5 px-2">
                      <select 
                        value={watch('tripType')} 
                        disabled
                        className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none bg-transparent opacity-60 cursor-not-allowed"
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
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold">교외체험학습<br/>장소</th>
                    <td colSpan={5} className="border border-black py-2.5 text-left px-4">
                      <input 
                        {...register('destination')} 
                        className="w-full bg-transparent border-none focus:outline-none opacity-60"
                        readOnly
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold">제 목</th>
                    <td colSpan={5} className="border border-black py-2.5 text-left px-4">
                      <input 
                        {...register('reportTitle')} 
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none font-bold ${(errors as any).reportTitle ? 'border-destructive' : ''}`}
                        placeholder="보고서 제목을 입력해주세요."
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 h-[300px] leading-tight text-[9.5pt] font-bold">교외<br/>체험학습<br/>결과</th>
                    <td colSpan={5} className="border border-black py-2.5 text-left px-4 align-top">
                      <div className="text-gray-400 text-xs mb-2 select-none font-sans font-normal">* 각 일정별로 느낀 점, 배운 점 등을 글, 그림 등으로 학생이 직접 기록합니다.</div>
                      <textarea 
                        {...register('reportContent')} 
                        placeholder="체험학습의 결과 및 느낀 점을 자세하고 구체적으로 작성해 주세요. (가급적 학생이 작성하도록 지도 바랍니다)" 
                        className={`w-full h-[260px] bg-transparent focus:outline-none resize-none placeholder:text-gray-400 leading-relaxed ${(errors as any).reportContent ? 'border-b border-destructive' : ''}`}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="border border-black py-5 relative">
                      <div className="text-center font-bold text-[11.5pt] mb-2">
                        위와 같이 「학교장허가 교외체험학습」 결과보고서를 제출합니다.
                      </div>
                      <div className="text-center mb-6 text-sm">
                        {format(submitDate, 'yyyy 년 MM 월 dd 일')}
                      </div>
                      <div className="flex flex-col items-end pr-10 space-y-2 text-sm">
                        <div className="flex items-center gap-4">
                          <span>보호자 :</span>
                          <span className="w-[100px] text-center font-bold text-blue-800">{profile?.parentName || '학부모'}</span>
                          <span className="ml-2">(인)</span>
                          {profile?.parentSignature && (
                            <img src={profile.parentSignature} className="absolute -right-8 -top-4 w-14 h-14 object-contain mix-blend-multiply" alt="sig" />
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="text-xs text-gray-500 space-y-1 mt-4 font-sans font-normal leading-relaxed print:text-black">
                <p>※ 보고서 제출 기한: 체험학습 종료 후 7일 이내</p>
                <p>※ 보고서의 내용은 자세하고 구체적으로 작성 / 1일 1장, 2일 이상은 2일에 1장 정도 추가(권고)</p>
                <p>※ 체험학습을 증빙할 수 있는 자료(항공권, 입장권, 팜플렛, 사진, 영수증 등) 첨부</p>
              </div>
            </div>
          ) : (
            <div className="font-serif text-[10pt] text-black">
              {/* 누적 일수 경고 */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center gap-4 mb-6 print:hidden">
                <div>
                  <h5 className="font-bold text-slate-800 text-sm">연간 누적 체험학습 현황 (올해)</h5>
                  <p className="text-xs text-muted-foreground mt-0.5">출석인정 개인 교외체험학습 사용 현황</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">누적 / 한도 (연간)</span>
                  <span className={`text-sm sm:text-base md:text-sm font-black whitespace-nowrap ${isOverFieldTripLimit ? 'text-destructive' : 'text-slate-700'}`}>
                    {isLoadingLimits ? '...' : `${accumulatedFieldTripDays}일`}
                    {` + 신청 ${watchFieldTripTotalDays}일 = 총 ${accumulatedFieldTripDays + Number(watchFieldTripTotalDays)}일`}
                    {` / 20일`}
                  </span>
                </div>
              </div>

              {isOverFieldTripLimit && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm font-semibold flex items-start gap-2 border border-destructive/20 mb-6 print:hidden">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">연간 교외체험학습 허용 한도(20일)를 초과하여 신청할 수 없습니다.</p>
                  </div>
                </div>
              )}

              <div className="mb-1 text-[9.5pt]">{'<서식 1>'}</div>
              <div className="text-center mb-6 space-y-1">
                <h1 className="text-2xl font-bold">「학교장허가 교외체험학습」 신청서</h1>
                <p className="text-red-600 font-bold text-xs">(체험학습 실시 7일전 제출)</p>
              </div>

              <table className="w-full border-collapse border border-black leading-tight mb-4 text-center text-xs md:text-sm [word-break:keep-all] [overflow-wrap:break-word]">
                <tbody>
                  <tr>
                    <th colSpan={2} className="border border-black bg-slate-50/50 py-2.5 w-[150px] font-bold">성 명</th>
                    <td className="border border-black py-2.5 px-2">
                      <input 
                        {...register('studentName')} 
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none font-bold text-center ${errors.studentName ? 'border-destructive' : ''}`}
                        placeholder="학생명 입력"
                        readOnly={!!profile?.studentName}
                      />
                    </td>
                    <th className="border border-black bg-slate-50/50 py-2.5 w-[100px] font-bold">학년 반 번</th>
                    <td className="border border-black py-2.5 px-2">
                      <input 
                        {...register('gradeClassNumber')} 
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${errors.gradeClassNumber ? 'border-destructive' : ''}`}
                        placeholder="예: 4-4-2"
                        readOnly={!!(profile?.studentGrade && profile?.studentClass && profile?.studentNumber)}
                      />
                    </td>
                    <th className="border border-black bg-slate-50/50 py-2.5 w-[80px] font-bold">휴대폰</th>
                    <td className="border border-black py-2.5 px-2">
                      <input 
                        {...register('phone')} 
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${(errors as any).phone ? 'border-destructive' : ''}`}
                        placeholder="보호자 연락처"
                      />
                    </td>
                  </tr>
                  <tr>
                    <th rowSpan={2} className="border border-black bg-slate-50/50 py-2.5 text-red-600 font-bold text-[8pt] leading-snug w-[100px] break-keep" style={{ wordBreak: 'keep-all' }}>
                      본교 출석인정기간<br/>(휴일 제외, 학기당 7일,<br/>연간 14일)
                    </th>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>신청 기간</th>
                    <td colSpan={5} className="border border-black py-2.5 text-left px-4 text-[9pt]">
                      <input type="date" {...register('tripPeriod.startDate')} className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none mr-1" /> ~ &nbsp;
                      <input type="date" {...register('tripPeriod.endDate')} className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none mr-1" /> &nbsp;
                      총 ( <input type="number" min="1" {...register('tripPeriod.totalDays')} className="w-10 text-center border-b border-gray-300 focus:border-black focus:outline-none mr-1" /> ) 일간
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold leading-tight text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>연간 체험학습<br/>누적 일수</th>
                    <td colSpan={5} className="border border-black py-2.5 text-left px-4 text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>
                      기존 사용 일수 및 금번 신청 일수 포함 총 ( {accumulatedFieldTripDays} + {watchFieldTripTotalDays} = {accumulatedFieldTripDays + Number(watchFieldTripTotalDays)} ) 일
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold">학습형태</th>
                    <td colSpan={6} className="border border-black py-2.5 text-left px-4">
                      <select 
                        value={watch('tripType')} 
                        onChange={(e) => setValue('tripType', e.target.value as any)} 
                        className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none bg-transparent"
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
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold">방문 장소</th>
                    <td colSpan={6} className="border border-black py-2.5 text-left px-4">
                      <input 
                        {...register('destination')} 
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none ${(errors as any).destination ? 'border-destructive' : ''}`}
                        placeholder="방문할 국가 및 도시명을 입력해주세요."
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold leading-tight">보호자<br/>(인솔자)명</th>
                    <td colSpan={2} className="border border-black py-2.5 px-2">
                      <input 
                        {...register('companionName')} 
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${(errors as any).companionName ? 'border-destructive' : ''}`}
                        placeholder="동행자 성명"
                      />
                    </td>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold">관계</th>
                    <td className="border border-black py-2.5 px-2">
                      <input 
                        {...register('companionRelation')} 
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${(errors as any).companionRelation ? 'border-destructive' : ''}`}
                        placeholder="예: 부, 모, 조부"
                      />
                    </td>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold">휴대폰</th>
                    <td className="border border-black py-2.5 px-2">
                      <input 
                        {...register('phone')} 
                        className="w-full bg-transparent border-none text-center text-gray-500 cursor-not-allowed"
                        readOnly
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 font-bold">목 적</th>
                    <td colSpan={6} className="border border-black py-2.5 text-left px-4">
                      <input 
                        {...register('purpose')} 
                        className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none ${(errors as any).purpose ? 'border-destructive' : ''}`}
                        placeholder="체험학습을 통해 달성하고자 하는 구체적인 목적"
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-slate-50/50 py-2.5 h-[120px] leading-tight text-[9.5pt] font-bold">교외체험학습<br/>계획<br/>(일정, 기대<br/>효과 등)</th>
                    <td colSpan={6} className="border border-black py-2.5 text-left px-4 align-top">
                      <textarea 
                        {...register('detailedPlan')} 
                        placeholder="일자별 상세 이동 경로, 방문 장소 및 예상 활동을 꼼꼼하게 입력해 주세요." 
                        className={`w-full h-28 bg-transparent focus:outline-none resize-none placeholder:text-gray-400 leading-relaxed ${(errors as any).detailedPlan ? 'border-b border-destructive' : ''}`}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={7} className="border border-black py-4 relative">
                      <div className="text-center font-bold text-[11.5pt] mb-2">
                        위와 같이 「학교장허가 교외체험학습」을 신청합니다.
                      </div>
                      <div className="text-center mb-6 text-sm">
                        {format(submitDate, 'yyyy 년 MM 월 dd 일')}
                      </div>
                      <div className="flex flex-col items-end pr-10 space-y-2 text-sm">
                        <div className="flex items-center gap-4">
                          <span>신 청 인 학 생 :</span>
                          <span className="w-[100px] text-center font-bold">{watchStudentName || '이름 입력'}</span>
                        </div>
                        <div className="flex items-center gap-4 relative">
                          <span>보 호 자 (인) :</span>
                          <span className="w-[100px] text-center font-bold text-sm text-blue-800">{profile?.parentName || '학부모'}</span>
                          <span className="ml-2">(인)</span>
                          {profile?.parentSignature && (
                            <img src={profile.parentSignature} className="absolute -right-8 -top-4 w-14 h-14 object-contain mix-blend-multiply" alt="sig" />
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

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
        </form>
      </div>

      <Dialog open={showPinModal} onOpenChange={setShowPinModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>전자서명 비밀번호 확인</DialogTitle>
            <DialogDescription>
              기기 등록 시 설정한 4자리 PIN 번호를 입력해 주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4 space-y-4">
            <Input
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="••••"
              className="text-center text-3xl tracking-[1em] w-[150px] font-mono h-14"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPinModal(false); setPinInput(''); }} disabled={isSubmitting}>
              취소
            </Button>
            <Button onClick={confirmSubmit} disabled={isSubmitting || pinInput.length !== 4}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '서명 후 제출'}
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
