'use client';

import { Suspense, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createDocument, getStudentFieldTripDays, getStudentAbsenceDays, getDocumentById } from '@/lib/services/documentService';
import { getApproversByGradeClass } from '@/lib/services/userService';
import { ParentFormData } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, ArrowLeft, AlertTriangle } from 'lucide-react';
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

const formSchema = z.discriminatedUnion('type', [absenceSchema, fieldTripSchema]);
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
  
  const typeParam = searchParams.get('type') === 'field-trip' ? 'field-trip' : 'absence';
  const cloneId = searchParams.get('cloneId');
  
  const { register, handleSubmit, watch, setValue, formState: { errors }, clearErrors } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: typeParam,
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
    } as any
  });

  const currentType = watch('type');
  const watchStudentName = watch('studentName');
  const watchGradeClassNumber = watch('gradeClassNumber');
  const watchAbsenceStartDate = watch('absencePeriod.startDate');
  const watchAbsenceTotalDays = watch('absencePeriod.totalDays') || 0;
  const watchFieldTripStartDate = watch('tripPeriod.startDate');
  const watchFieldTripTotalDays = watch('tripPeriod.totalDays') || 0;
  const watchAbsenceType = watch('absenceType');

  const [accumulatedFieldTripDays, setAccumulatedFieldTripDays] = useState<number>(0);
  const [accumulatedAbsenceDays, setAccumulatedAbsenceDays] = useState<number>(0);
  const [isLoadingLimits, setIsLoadingLimits] = useState<boolean>(false);

  useEffect(() => {
    async function loadCloneData() {
      if (!cloneId) return;
      try {
        const fetched = await getDocumentById(cloneId);
        if (fetched && fetched.parentFormData) {
          const data = fetched.parentFormData;
          
          if (data.type !== typeParam) {
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
  }, [cloneId, typeParam, router, setValue, toast]);

  useEffect(() => {
    if (typeParam !== currentType) {
      setValue('type', typeParam as 'absence' | 'field-trip');
      clearErrors();
    }
  }, [typeParam, currentType, setValue, clearErrors]);

  useEffect(() => {
    const studentName = watchStudentName || profile?.studentName || '';
    const gradeClassNumber = watchGradeClassNumber || 
      ((profile?.studentGrade && profile?.studentClass && profile?.studentNumber) 
        ? `${profile.studentGrade}-${profile.studentClass}-${profile.studentNumber}` 
        : '') || '';
    
    const dateStr = currentType === 'absence' ? watchAbsenceStartDate : watchFieldTripStartDate;
    if (!studentName || !gradeClassNumber || !dateStr) return;
    
    const year = dateStr.substring(0, 4); // "YYYY"
    
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

  const isOverFieldTripLimit = currentType === 'field-trip' && 
    (accumulatedFieldTripDays + Number(watchFieldTripTotalDays) > 20);
    
  const isOverAbsenceLimit = currentType === 'absence' && 
    watchAbsenceType !== '출석인정' && 
    (accumulatedAbsenceDays + Number(watchAbsenceTotalDays) > 63);
    
  const isOverLimit = isOverFieldTripLimit || isOverAbsenceLimit;

  const handleTabChange = (val: string) => {
    router.push(`/parents/apply?type=${val}`);
  };

  const onSubmit = (data: FormValues) => {
    if (isOverLimit) {
      toast({
        variant: 'destructive',
        title: '신청 불가',
        description: '연간 허용 한도를 초과하여 신청서를 제출할 수 없습니다.'
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
        const startDate = data.tripPeriod.startDate;
        const year = startDate.substring(0, 4);
        const latestFtDays = await getStudentFieldTripDays(studentName, gradeClassNumber, year);
        const proposedTotal = latestFtDays + Number(data.tripPeriod.totalDays);
        if (proposedTotal > 20) {
          toast({
            variant: 'destructive',
            title: '제출 불가',
            description: `연간 교외체험학습 허용 일수(20일)를 초과하여 신청할 수 없습니다. (현재 누적: ${latestFtDays}일, 신청: ${data.tripPeriod.totalDays}일)`
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
        if (proposedTotal > 63) {
          toast({
            variant: 'destructive',
            title: '제출 불가',
            description: `연간 유급 기준 결석 일수(63일)를 초과하여 신청할 수 없습니다. (현재 누적: ${latestAbsDays}일, 신청: ${data.absencePeriod.totalDays}일)`
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
      const title = `[${isAbsence ? '결석계' : '체험학습'}] ${data.gradeClassNumber} ${data.studentName}`;
      
      let content = '';
      if (isAbsence) {
        content = `결석 종류: ${data.absenceType}<br/>결석 기간: ${data.absencePeriod.startDate} ~ ${data.absencePeriod.endDate} (총 ${data.absencePeriod.totalDays}일)<br/>결석 사유: ${data.absenceReason}`;
      } else {
        content = `목적: ${data.purpose}<br/>방문 장소: ${data.destination}<br/>기간: ${data.tripPeriod.startDate} ~ ${data.tripPeriod.endDate} (총 ${data.tripPeriod.totalDays}일)<br/>구체적인 계획:<br/>${data.detailedPlan.replace(/\n/g, '<br/>')}`;
      }

      const parentFormData: ParentFormData = data;

      // 학년/반 파싱 후 결재선 자동 생성
      const gradeClassParts = data.gradeClassNumber.replace(/[^0-9-]/g, '-').split('-').filter(Boolean);
      const grade = gradeClassParts[0] || '1';
      const studentClass = gradeClassParts[1] || '1';
      const approvers = await getApproversByGradeClass(grade, studentClass, !isAbsence);

      await createDocument({
        title,
        content,
        docType: 'parent',
        publishStatus: '비공개',
        parentFormData,
        approvers,
        attachments: [],
      }, user.email!, profile);

      toast({
        title: '제출 완료',
        description: '신청서가 성공적으로 제출되었습니다.',
      });
      setShowPinModal(false);
      setPinInput('');
      router.push('/parents/history');
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: '제출 실패',
        description: error instanceof Error ? error.message : '신청서 제출 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Button variant="ghost" className="mb-4 text-muted-foreground hover:text-foreground" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        돌아가기
      </Button>
      
      <Card className="shadow-xl border-t-4 border-t-primary overflow-hidden">
        <CardHeader className="bg-muted/30 pb-8 border-b">
          <CardTitle className="text-2xl font-bold font-headline text-foreground">신청서 제출</CardTitle>
          <CardDescription className="text-base mt-2">
            학교에 제출할 신청서를 선택하고 내용을 작성해주세요.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-8 pt-8">
            <Tabs value={currentType} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-12 mb-6">
                <TabsTrigger value="absence" className="text-base font-bold h-10">결석계</TabsTrigger>
                <TabsTrigger value="field-trip" className="text-base font-bold h-10">체험학습 신청서</TabsTrigger>
              </TabsList>
            </Tabs>

            {currentType === 'field-trip' && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-md mb-6">
                <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} /> 체험학습 신청 불가 기간
                </h4>
                <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                  <li>개학/입학식 실시 후 7일</li>
                  <li>재량휴업일 실시 전/후 7일</li>
                  <li>여름/겨울방학 실시 전 7일</li>
                  <li>졸업식/종업식 전 7일</li>
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/10 p-6 rounded-xl border border-border/50">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-bold">학생 이름 <span className="text-destructive">*</span></Label>
                  {!!profile?.studentName && <span className="text-xs text-muted-foreground">우측 상단 ⚙️ 설정에서 수정 가능</span>}
                </div>
                <Input {...register('studentName')} placeholder="예: 홍길동" className={profile?.studentName ? 'bg-muted/50 text-muted-foreground focus-visible:ring-0 cursor-not-allowed' : 'bg-background'} readOnly={!!profile?.studentName} />
                {errors.studentName && <p className="text-sm text-destructive">{errors.studentName.message}</p>}
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-bold">학년-반-번 <span className="text-destructive">*</span></Label>
                  {!!profile?.studentGrade && <span className="text-xs text-muted-foreground">우측 상단 ⚙️ 설정에서 수정 가능</span>}
                </div>
                <Input {...register('gradeClassNumber')} placeholder="예: 1-2-3" className={(profile?.studentGrade && profile?.studentClass && profile?.studentNumber) ? 'bg-muted/50 text-muted-foreground focus-visible:ring-0 cursor-not-allowed' : 'bg-background'} readOnly={!!(profile?.studentGrade && profile?.studentClass && profile?.studentNumber)} />
                {errors.gradeClassNumber && <p className="text-sm text-destructive">{errors.gradeClassNumber.message}</p>}
              </div>
            </div>

            {currentType === 'absence' ? (
              <div className="space-y-6 px-2">
                <div className="bg-slate-50 border p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm">연간 누적 결석 현황 (올해)</h5>
                    <p className="text-xs text-muted-foreground mt-0.5">병결, 미인정, 기타 결석의 합계 (출석인정 결석 제외)</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground block">누적 / 한도 (유급)</span>
                      <span className={`text-lg font-black ${isOverAbsenceLimit ? 'text-destructive' : 'text-slate-700'}`}>
                        {isLoadingLimits ? '...' : `${accumulatedAbsenceDays}일`}
                        {watchAbsenceType !== '출석인정' && ` + 신청 ${watchAbsenceTotalDays}일 = 총 ${accumulatedAbsenceDays + Number(watchAbsenceTotalDays)}일`}
                        {` / 63일`}
                      </span>
                    </div>
                  </div>
                </div>

                {isOverAbsenceLimit && (
                  <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm font-semibold flex items-start gap-2 border border-destructive/20 mb-4 animate-in fade-in">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">연간 유급 기준 결석 일수(63일)를 초과하여 신청할 수 없습니다.</p>
                      <p className="text-xs mt-1">질병 및 미인정 결석 등을 합한 총 결석 일수가 63일을 넘으면 학년 진급이 불가능(유급)해지므로 시스템에서 자동 제한됩니다.</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">시작일 <span className="text-destructive">*</span></Label>
                    <Input type="date" {...register('absencePeriod.startDate')} />
                    {(errors as any).absencePeriod?.startDate && <p className="text-sm text-destructive">{(errors as any).absencePeriod.startDate.message}</p>}
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">종료일 <span className="text-destructive">*</span></Label>
                    <Input type="date" {...register('absencePeriod.endDate')} />
                    {(errors as any).absencePeriod?.endDate && <p className="text-sm text-destructive">{(errors as any).absencePeriod.endDate.message}</p>}
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">총 일수 <span className="text-destructive">*</span></Label>
                    <Input type="number" min="1" {...register('absencePeriod.totalDays')} />
                    {(errors as any).absencePeriod?.totalDays && <p className="text-sm text-destructive">{(errors as any).absencePeriod.totalDays.message}</p>}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold">결석 종류 <span className="text-destructive">*</span></Label>
                  <Select onValueChange={(val) => setValue('absenceType', val as any)} value={watch('absenceType')}>
                    <SelectTrigger><SelectValue placeholder="결석 종류 선택" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="병결">병결</SelectItem>
                      <SelectItem value="미인정">미인정</SelectItem>
                      <SelectItem value="출석인정">출석인정</SelectItem>
                      <SelectItem value="기타">기타</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Zod Error for absenceType isn't usually thrown if default is set, but just in case */}
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold">결석 사유 <span className="text-destructive">*</span></Label>
                  <Textarea {...register('absenceReason')} placeholder="결석 사유를 자세히 입력해주세요." className="min-h-[100px]" />
                  {(errors as any).absenceReason && <p className="text-sm text-destructive">{(errors as any).absenceReason.message}</p>}
                </div>
              </div>
            ) : (
              <div className="space-y-6 px-2">
                <div className="bg-slate-50 border p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm">연간 누적 체험학습 현황 (올해)</h5>
                    <p className="text-xs text-muted-foreground mt-0.5">출석인정 개인 교외체험학습 사용 현황</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground block">누적 / 한도 (연간)</span>
                      <span className={`text-lg font-black ${isOverFieldTripLimit ? 'text-destructive' : 'text-slate-700'}`}>
                        {isLoadingLimits ? '...' : `${accumulatedFieldTripDays}일`}
                        {` + 신청 ${watchFieldTripTotalDays}일 = 총 ${accumulatedFieldTripDays + Number(watchFieldTripTotalDays)}일`}
                        {` / 20일`}
                      </span>
                    </div>
                  </div>
                </div>

                {isOverFieldTripLimit && (
                  <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm font-semibold flex items-start gap-2 border border-destructive/20 mb-4 animate-in fade-in">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">연간 교외체험학습 허용 한도(20일)를 초과하여 신청할 수 없습니다.</p>
                      <p className="text-xs mt-1">학칙 및 교육부 지침에 따른 연간 개인 교외체험학습 승인 한도(20일)를 초과하였습니다.</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">보호자 연락처 <span className="text-destructive">*</span></Label>
                    <Input {...register('phone')} placeholder="010-1234-5678" />
                    {(errors as any).phone && <p className="text-sm text-destructive">{(errors as any).phone.message}</p>}
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">기존 사용 일수 <span className="text-destructive">*</span></Label>
                    <Input type="number" min="0" {...register('cumulativeDays')} readOnly className="bg-muted/50 text-muted-foreground focus-visible:ring-0 cursor-not-allowed" />
                    {(errors as any).cumulativeDays && <p className="text-sm text-destructive">{(errors as any).cumulativeDays.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">시작일 <span className="text-destructive">*</span></Label>
                    <Input type="date" {...register('tripPeriod.startDate')} />
                    {(errors as any).tripPeriod?.startDate && <p className="text-sm text-destructive">{(errors as any).tripPeriod.startDate.message}</p>}
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">종료일 <span className="text-destructive">*</span></Label>
                    <Input type="date" {...register('tripPeriod.endDate')} />
                    {(errors as any).tripPeriod?.endDate && <p className="text-sm text-destructive">{(errors as any).tripPeriod.endDate.message}</p>}
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">총 일수 <span className="text-destructive">*</span></Label>
                    <Input type="number" min="1" {...register('tripPeriod.totalDays')} />
                    {(errors as any).tripPeriod?.totalDays && <p className="text-sm text-destructive">{(errors as any).tripPeriod.totalDays.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">체험학습 형태 <span className="text-destructive">*</span></Label>
                    <Select onValueChange={(val) => setValue('tripType', val as any)} value={watch('tripType')}>
                      <SelectTrigger><SelectValue placeholder="형태 선택" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="가족동반여행">가족동반여행</SelectItem>
                        <SelectItem value="친인척 방문">친인척 방문</SelectItem>
                        <SelectItem value="답사·견학 활동">답사·견학 활동</SelectItem>
                        <SelectItem value="체험활동">체험활동</SelectItem>
                        <SelectItem value="기타">기타</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">방문 장소 <span className="text-destructive">*</span></Label>
                    <Input {...register('destination')} placeholder="방문 장소 입력" />
                    {(errors as any).destination && <p className="text-sm text-destructive">{(errors as any).destination.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">동행 보호자명 <span className="text-destructive">*</span></Label>
                    <Input {...register('companionName')} placeholder="보호자명" />
                    {(errors as any).companionName && <p className="text-sm text-destructive">{(errors as any).companionName.message}</p>}
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">학생과의 관계 <span className="text-destructive">*</span></Label>
                    <Input {...register('companionRelation')} placeholder="예: 부, 모" />
                    {(errors as any).companionRelation && <p className="text-sm text-destructive">{(errors as any).companionRelation.message}</p>}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold">목적 <span className="text-destructive">*</span></Label>
                  <Input {...register('purpose')} placeholder="목적을 입력해주세요" />
                  {(errors as any).purpose && <p className="text-sm text-destructive">{(errors as any).purpose.message}</p>}
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold">구체적인 계획 <span className="text-destructive">*</span></Label>
                  <Textarea {...register('detailedPlan')} placeholder="일자별 계획 등을 자세히 입력해주세요." className="min-h-[150px]" />
                  {(errors as any).detailedPlan && <p className="text-sm text-destructive">{(errors as any).detailedPlan.message}</p>}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between items-center bg-muted/30 p-6 border-t mt-4">
            <p className="text-xs text-muted-foreground hidden md:block">
              <span className="text-destructive">*</span> 표시된 항목은 필수 입력 사항입니다.
            </p>
            <div className="flex gap-4 w-full md:w-auto">
              <Button variant="outline" type="button" onClick={() => router.back()} className="flex-1 md:flex-none">
                취소
              </Button>
              <Button type="button" onClick={() => handleSubmit(onSubmit)()} disabled={isSubmitting || isOverLimit} className="flex-1 md:flex-none min-w-[140px] font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50">
                <>
                  <Send className="mr-2 h-5 w-5" />
                  제출하기
                </>
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={showPinModal} onOpenChange={(open) => {
        if (!open) {
          setShowPinModal(false);
          setPinInput('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>서명 인증 (PIN 입력)</DialogTitle>
            <DialogDescription>
              본인 확인을 위해 처음 등록했던 4자리 PIN 번호를 입력해주세요. 제출 후에는 수정이 어렵습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="pin-input" className="mb-2 block">PIN 번호</Label>
            <Input
              id="pin-input"
              type="password"
              maxLength={4}
              placeholder="****"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmSubmit();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPinModal(false)}>취소</Button>
            <Button onClick={confirmSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              서명 및 제출
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
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <ApplyForm />
    </Suspense>
  );
}
