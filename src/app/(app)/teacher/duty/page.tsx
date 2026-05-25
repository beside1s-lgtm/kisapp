'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Briefcase, Calendar, Clock, Loader2, Send, ArrowLeft, Info, UserCheck, PlusCircle, Trash2, Search, Users, CalendarDays } from 'lucide-react';
import { createDocument, getTeacherDutyStats } from '@/lib/services/documentService';
import { TeacherDutyData } from '@/lib/types';
import { getOrgStructure } from '@/lib/services/settingsService';
import { getUserProfileByEmail, getUsersDirectory } from '@/lib/services/userService';
import { getDelegationRules } from '@/lib/services/settingsService';
import type { DelegationRule } from '@/lib/types';

const studyAbroadScheduleSchema = z.object({
  date: z.string().optional(),
  departure: z.string().optional(),
  destination: z.string().optional(),
  institution: z.string().optional(),
  content: z.string().optional(),
  note: z.string().optional(),
});

const studyAbroadPlanSchema = z.object({
  affiliation: z.string().optional(),
  position: z.string().optional(),
  name: z.string().optional(),
  subject: z.string().optional(),
  purpose: z.string().optional(),
  category: z.string().optional(),
  categoryEtcDetail: z.string().optional(),
  schedules: z.array(studyAbroadScheduleSchema).optional(),
  effects: z.string().optional(),
});

const travelerSchema = z.object({
  name: z.string(),
  email: z.string(),
});

const travelItemSchema = z.object({
  date: z.string().min(1, '출장 일자를 선택해주세요'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  subType: z.string().min(1, '출장 구분을 선택해주세요'),
  destination: z.string().min(1, '목적지를 입력해주세요'),
  reason: z.string().min(1, '출장 사유를 입력해주세요'),
  noExpensesPaid: z.boolean(),
  useCompanyVehicle: z.boolean(),
  travelers: z.array(travelerSchema).min(1, '동행자를 최소 1명 이상 선택해주세요'),
});

const dutySchema = z.object({
  mainType: z.enum(['휴가', '41조 연수', '출장']),
  subType: z.string().optional(),
  detailType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  totalDays: z.coerce.number().optional(),
  reason: z.string().optional(),
  destination: z.string().optional(),
  studyAbroadPlan: studyAbroadPlanSchema.optional(),
  noExpensesPaid: z.boolean().optional(),
  useCompanyVehicle: z.boolean().optional(),
  travelItems: z.array(travelItemSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.mainType !== '출장') {
    if (!data.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startDate'], message: '시작일을 선택해주세요' });
    }
    if (!data.endDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: '종료일을 선택해주세요' });
    }
    if (data.totalDays === undefined || data.totalDays < 0.1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['totalDays'], message: '일수를 입력해주세요' });
    }
    if (!data.reason || data.reason.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: '사유를 입력해주세요' });
    }
  }
  if (data.mainType === '41조 연수' && data.subType === '국외자율연수') {
    if (!data.studyAbroadPlan) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studyAbroadPlan'],
        message: '국외자율연수 계획서를 작성해주세요'
      });
      return;
    }
    const plan = data.studyAbroadPlan;
    if (!plan.affiliation) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studyAbroadPlan', 'affiliation'], message: '소속을 입력해주세요' });
    if (!plan.position) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studyAbroadPlan', 'position'], message: '직위를 입력해주세요' });
    if (!plan.name) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studyAbroadPlan', 'name'], message: '성명을 입력해주세요' });
    if (!plan.subject) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studyAbroadPlan', 'subject'], message: '과목을 입력해주세요' });
    if (!plan.purpose) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studyAbroadPlan', 'purpose'], message: '목적(배경)을 입력해주세요' });
    if (!plan.category) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studyAbroadPlan', 'category'], message: '연수 구분을 선택해주세요' });
    if (!plan.schedules || plan.schedules.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studyAbroadPlan', 'schedules'], message: '세부 일정을 최소 1개 이상 입력해주세요' });
    } else {
      plan.schedules.forEach((sch: any, idx: number) => {
        if (!sch.date) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studyAbroadPlan', 'schedules', idx, 'date'], message: '날짜를 입력해주세요' });
        if (!sch.institution) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studyAbroadPlan', 'schedules', idx, 'institution'], message: '방문기관을 입력해주세요' });
        if (!sch.content) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studyAbroadPlan', 'schedules', idx, 'content'], message: '연수내용을 입력해주세요' });
      });
    }
    if (!plan.effects) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studyAbroadPlan', 'effects'], message: '연수 효과를 입력해주세요' });
  }

  if (data.mainType === '출장') {
    if (!data.travelItems || data.travelItems.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['travelItems'],
        message: '출장 일정을 최소 1개 이상 등록해주세요'
      });
    } else {
      data.travelItems.forEach((item, idx) => {
        if (!item.date) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['travelItems', idx, 'date'], message: '일자를 선택해주세요' });
        if (!item.destination) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['travelItems', idx, 'destination'], message: '목적지를 입력해주세요' });
        if (!item.reason) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['travelItems', idx, 'reason'], message: '사유를 입력해주세요' });
        if (!item.travelers || item.travelers.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['travelItems', idx, 'travelers'], message: '동행자를 지정해주세요' });
      });
    }
  }
});

type DutyFormValues = z.infer<typeof dutySchema>;

export default function TeacherDutyPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [org, setOrg] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [firstApprover, setFirstApprover] = useState<string>('NONE');
  const [finalApprover, setFinalApprover] = useState<'VP' | 'PRINCIPAL'>('PRINCIPAL');
  const [delegationRules, setDelegationRules] = useState<DelegationRule[]>([]);
  const [dutyStats, setDutyStats] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      const orgData = await getOrgStructure();
      setOrg(orgData);
      const allUsers = await getUsersDirectory();
      setUsers(allUsers);
      const rules = await getDelegationRules();
      setDelegationRules(rules);
      
      if (profile?.email) {
        const stats = await getTeacherDutyStats(profile.email, new Date().getFullYear().toString());
        setDutyStats(stats);
      }
    }
    loadData();
  }, [profile]);

  const getUserByEmail = (email: string) => users.find(u => u.email === email);

  const { register, handleSubmit, watch, setValue, getValues, control, formState: { errors } } = useForm<DutyFormValues>({
    resolver: zodResolver(dutySchema),
    defaultValues: {
      mainType: '휴가',
      subType: '연가',
      detailType: '연가',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      totalDays: 1,
      reason: '',
      noExpensesPaid: false,
      useCompanyVehicle: false,
      travelItems: [],
      studyAbroadPlan: {
        affiliation: '서울송정초등학교',
        position: '교사',
        name: '',
        subject: '공통',
        purpose: '',
        category: '개인의 학습자료 수집',
        schedules: [
          { date: '', departure: '', destination: '', institution: '', content: '', note: '' }
        ],
        effects: ''
      }
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "studyAbroadPlan.schedules"
  });

  const { fields: travelFields, append: appendTravel, remove: removeTravel, replace: replaceTravel } = useFieldArray({
    control,
    name: "travelItems"
  });

  const [isRepeatModalOpen, setIsRepeatModalOpen] = useState(false);
  const [repeatStartDate, setRepeatStartDate] = useState('');
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // 0: 일, 1: 월, 2: 화, 3: 수, 4: 목, 5: 금, 6: 토
  const [selectedTravelers, setSelectedTravelers] = useState<any[]>([]); // { name, email }[]
  const [searchKeyword, setSearchKeyword] = useState('');
  const [repeatSubType, setRepeatSubType] = useState('관내');
  const [repeatDestination, setRepeatDestination] = useState('');
  const [repeatReason, setRepeatReason] = useState('');
  const [repeatNoExpensesPaid, setRepeatNoExpensesPaid] = useState(false);
  const [repeatUseCompanyVehicle, setRepeatUseCompanyVehicle] = useState(false);

  const openRepeatModal = () => {
    setRepeatStartDate(watch('startDate') || new Date().toISOString().split('T')[0]);
    setRepeatEndDate(watch('endDate') || new Date().toISOString().split('T')[0]);
    setSelectedDays([]);
    setRepeatSubType(watch('subType') || '관내');
    setRepeatDestination(watch('destination') || '');
    setRepeatReason(watch('reason') || '');
    setRepeatNoExpensesPaid(watch('noExpensesPaid') || false);
    setRepeatUseCompanyVehicle(watch('useCompanyVehicle') || false);
    
    if (profile) {
      setSelectedTravelers([{ name: profile.name, email: profile.email }]);
    } else {
      setSelectedTravelers([]);
    }
    setSearchKeyword('');
    setIsRepeatModalOpen(true);
  };

  const toggleTraveler = (targetUser: any) => {
    const isExist = selectedTravelers.some(t => t.email === targetUser.email);
    if (isExist) {
      setSelectedTravelers(selectedTravelers.filter(t => t.email !== targetUser.email));
    } else {
      setSelectedTravelers([...selectedTravelers, { name: targetUser.name, email: targetUser.email }]);
    }
  };

  const handleGenerateRepeatTravels = () => {
    if (!repeatStartDate || !repeatEndDate) {
      toast({ variant: 'destructive', title: '생성 실패', description: '시작일과 종료일을 입력해주세요.' });
      return;
    }
    if (selectedDays.length === 0) {
      toast({ variant: 'destructive', title: '생성 실패', description: '반복할 요일을 최소 하나 선택해주세요.' });
      return;
    }
    if (selectedTravelers.length === 0) {
      toast({ variant: 'destructive', title: '생성 실패', description: '동행자(또는 본인)를 선택해주세요.' });
      return;
    }

    const [sy, sm, sd] = repeatStartDate.split('-').map(Number);
    const [ey, em, ed] = repeatEndDate.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    const generatedItems: any[] = [];

    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay(); // 0: 일 ~ 6: 토
      if (selectedDays.includes(dayOfWeek)) {
        const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        generatedItems.push({
          date: dateStr,
          subType: repeatSubType,
          destination: repeatDestination,
          reason: repeatReason,
          noExpensesPaid: repeatNoExpensesPaid,
          useCompanyVehicle: repeatUseCompanyVehicle,
          travelers: [...selectedTravelers]
        });
      }
      current.setDate(current.getDate() + 1);
    }

    if (generatedItems.length === 0) {
      toast({ variant: 'destructive', title: '생성 실패', description: '선택한 기간 내에 해당하는 요일이 없습니다.' });
      return;
    }

    replaceTravel(generatedItems);
    setIsRepeatModalOpen(false);
    toast({ title: '일정 생성 완료', description: `${generatedItems.length}건의 출장 일정이 생성되었습니다.` });
  };

  const mainType = watch('mainType');
  const subType = watch('subType');
  


  // 로그인 교사 프로필 로드 시 계획서 이름 세팅 및 출장 시 기본 행 설정
  useEffect(() => {
    if (profile) {
      setValue('studyAbroadPlan.name', profile.name || '');
      if (mainType === '출장') {
        const currentItems = getValues('travelItems');
        if (!currentItems || currentItems.length === 0) {
          replaceTravel([{
            date: new Date().toISOString().split('T')[0],
            subType: '관내',
            destination: '',
            reason: '',
            noExpensesPaid: false,
            useCompanyVehicle: false,
            travelers: [{ name: profile.name, email: profile.email }]
          }]);
        }
      }
    }
  }, [profile, setValue, mainType, getValues, replaceTravel]);

  // mainType 변경 시 subType 초기화 및 출장 시 기본 행 생성
  useEffect(() => {
    if (mainType === '휴가') {
      setValue('subType', '연가');
      setValue('detailType', '연가');
    } else if (mainType === '출장') {
      setValue('subType', '관내');
      setValue('detailType', undefined);
      const currentItems = getValues('travelItems');
      if (!currentItems || currentItems.length === 0) {
        replaceTravel([{
          date: new Date().toISOString().split('T')[0],
          subType: '관내',
          destination: '',
          reason: '',
          noExpensesPaid: false,
          useCompanyVehicle: false,
          travelers: profile ? [{ name: profile.name, email: profile.email }] : []
        }]);
      }
    } else if (mainType === '41조 연수') {
      setValue('subType', '자율연수');
      setValue('detailType', undefined);
    } else {
      setValue('subType', undefined);
      setValue('detailType', undefined);
    }
  }, [mainType, setValue, getValues, replaceTravel, profile]);

  // subType 변경 시 detailType 초기화
  useEffect(() => {
    if (mainType === '휴가') {
      if (subType === '연가') setValue('detailType', '연가');
      else if (subType === '특별휴가') setValue('detailType', '특별휴가');
      else setValue('detailType', undefined);
    }
  }, [mainType, subType, setValue]);

  // 세부 항목에 따른 결재선 자동 추천
  const currentMainType = watch('mainType');
  const currentSubType = watch('subType');
  const currentDetailType = watch('detailType');

  useEffect(() => {
    // 1. 위임전결규정이 있으면 적용
    const rule = delegationRules.find(r => 
      r.mainType === currentMainType && 
      (!r.subType || r.subType === currentSubType) &&
      (!r.detailType || r.detailType === currentDetailType)
    );

    if (rule) {
      setFinalApprover(rule.finalApprover);
      return;
    }

    // 2. 없으면 기본 하드코딩 로직 적용
    const isMinorDuty = 
      currentDetailType === '조퇴' || 
      currentDetailType === '지참' || 
      currentDetailType === '육아시간' || 
      currentSubType === '관내';
      
    if (isMinorDuty) {
      setFinalApprover('VP');
    } else {
      setFinalApprover('PRINCIPAL');
    }
  }, [currentMainType, currentSubType, currentDetailType, delegationRules]);

  const onSubmit = async (data: DutyFormValues) => {
    if (!user || !profile) return;

    setIsSubmitting(true);
    try {
      const org = await getOrgStructure();
      const approvers = [];

      // 1. 1차 결재자 (부장급)
      if (firstApprover !== 'NONE') {
        let email = null;
        let roleName = '';
        if (firstApprover.startsWith('GRADE_')) {
          const grade = firstApprover.replace('GRADE_', '');
          email = org.gradeHeads?.[grade];
          roleName = `${grade}학년 부장`;
        } else if (firstApprover.startsWith('DEPT_')) {
          const deptId = firstApprover.replace('DEPT_', '');
          const dept = org.departments?.find((d: any) => d.id === deptId);
          if (dept) {
            email = dept.headEmail;
            roleName = `${dept.name} 부장`;
          }
        }
        
        if (email) {
          const profile = await getUserProfileByEmail(email);
          if (profile) {
            approvers.push({ name: profile.name, email: profile.email, role: roleName, type: 'normal' as const, status: 'pending' as const });
          }
        }
      }

      // 2. 교감 (무조건 포함하되, VP 전결이면 final)
      if (org.vicePrincipal) {
        const vp = await getUserProfileByEmail(org.vicePrincipal);
        if (vp) approvers.push({ 
          name: vp.name, 
          email: vp.email, 
          role: '교감', 
          type: finalApprover === 'VP' ? 'final' as const : 'normal' as const, 
          status: 'pending' as const 
        });
      }
      
      // 3. 교장 (finalApprover === 'PRINCIPAL' 일 때만)
      if (finalApprover === 'PRINCIPAL' && org.principal) {
        const principal = await getUserProfileByEmail(org.principal);
        if (principal) approvers.push({ 
          name: principal.name, 
          email: principal.email, 
          role: '교장', 
          type: 'final' as const, 
          status: 'pending' as const 
        });
      }

      if (approvers.length === 0) {
          throw new Error("결재선이 구성되지 않았습니다. 조직도 설정을 확인해주세요.");
      }

      // 출장일 경우 복수 일정 가공
      if (data.mainType === '출장' && data.travelItems && data.travelItems.length > 0) {
        const items = data.travelItems;
        const dates = items.map(it => new Date(it.date).getTime()).sort((a, b) => a - b);
        data.startDate = new Date(dates[0]).toISOString().split('T')[0];
        data.endDate = new Date(dates[dates.length - 1]).toISOString().split('T')[0];
        data.totalDays = items.length;
      }

      const title = `[${data.mainType}${data.subType ? `-${data.subType}` : ''}] ${profile.name} (${data.startDate}${data.startDate !== data.endDate ? ` ~ ${data.endDate}` : ''})`;
      
      let content = `항목: ${data.mainType}`;
      if (data.subType) content += ` > ${data.subType}`;
      if (data.detailType) content += ` > ${data.detailType}`;
      
      if (data.mainType === '출장' && data.travelItems && data.travelItems.length > 0) {
        content += `<br/>기간: ${data.startDate} ~ ${data.endDate} (총 ${data.totalDays}건)`;
        content += `<br/><br/><strong>[복수 출장 일정 목록]</strong><br/>`;
        data.travelItems.forEach((it, idx) => {
          const travelersStr = it.travelers.map(t => t.name).join(', ');
          const options = [];
          if (it.noExpensesPaid) options.push('여비 부지급');
          if (it.useCompanyVehicle) options.push('관용차량 이용');
          const optsStr = options.length > 0 ? ` (${options.join(', ')})` : '';
          content += `${idx + 1}. [${it.date}] [${it.subType}] ${it.destination} / 동행자: ${travelersStr} / 사유: ${it.reason}${optsStr}<br/>`;
        });
      } else {
        content += `<br/>기간: ${data.startDate} ~ ${data.endDate} (총 ${data.totalDays}일)`;
        if (data.startTime && data.endTime) content += `<br/>시간: ${data.startTime} ~ ${data.endTime}`;
        if (data.destination) content += `<br/>장소: ${data.destination}`;
        if (data.mainType === '출장') {
          const options = [];
          if (data.noExpensesPaid) options.push('여비 부지급');
          if (data.useCompanyVehicle) options.push('관용차량 이용');
          if (options.length > 0) content += `<br/>옵션: ${options.join(', ')}`;
        }
        content += `<br/>사유: ${data.reason}`;
      }

      if (data.mainType === '41조 연수' && data.subType === '국외자율연수') {
        content += `<br/><br/><strong>* 공무외국외여행 계획서가 첨부되었습니다.</strong>`;
      }

      const dutyPayload: TeacherDutyData = {
        mainType: data.mainType,
        startDate: data.startDate!,
        endDate: data.endDate!,
        totalDays: data.totalDays!,
        reason: data.reason || '',
      };
      
      if (data.subType) dutyPayload.subType = data.subType;
      if (data.detailType) dutyPayload.detailType = data.detailType;
      if (data.startTime) dutyPayload.startTime = data.startTime;
      if (data.endTime) dutyPayload.endTime = data.endTime;
      if (data.destination) dutyPayload.destination = data.destination;
      
      if (data.mainType === '출장') {
        // 단일 값 호환용으로 첫 번째 일정 매핑
        const firstItem = data.travelItems?.[0];
        dutyPayload.noExpensesPaid = firstItem ? firstItem.noExpensesPaid : (data.noExpensesPaid || false);
        dutyPayload.useCompanyVehicle = firstItem ? firstItem.useCompanyVehicle : (data.useCompanyVehicle || false);
        dutyPayload.destination = firstItem ? firstItem.destination : (data.destination || '');
        dutyPayload.reason = firstItem ? firstItem.reason : (data.reason || '');
        dutyPayload.travelItems = data.travelItems;
      }

      if (data.mainType === '41조 연수' && data.subType === '국외자율연수') {
        dutyPayload.studyAbroadPlan = data.studyAbroadPlan as any;
      }

      const result = await createDocument({
        title,
        content,
        docType: 'teacher-duty',
        publishStatus: '비공개',
        teacherDutyData: dutyPayload,
        approvers,
        attachments: [],
      }, user.email!, profile);

      if (result.success) {
        toast({ title: '상신 완료', description: '복무 신청서가 성공적으로 상신되었습니다.' });
        router.push('/sent');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: '상신 실패', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> 돌아가기
        </Button>
        <div className="flex items-center gap-2 text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
          <Briefcase size={18} />
          <span className="font-bold">교원 복무 신청</span>
        </div>
      </div>

      <Card className="shadow-2xl border-t-4 border-t-primary overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-8">
          <CardTitle className="text-2xl font-bold font-headline">복무 신청서 작성</CardTitle>
          <CardDescription className="text-base mt-2">복무 항목을 선택하고 기간과 사유를 입력해주세요.</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-8 pt-8">
            {/* 잔여 연가 요약 카드 */}
            {dutyStats && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in fade-in duration-300">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
                    <Info size={16} /> 실시간 내 연가 잔여 현황
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    올해 총 {dutyStats.annualLimit}일 중 <strong>{dutyStats.totalAnnualUsed}일</strong> 사용 (잔여 {dutyStats.annualRemaining}일)
                  </p>
                  <p className="text-[10px] text-muted-foreground/80">
                    * 조퇴/지참 누계: {dutyStats.earlyUsedHours}시간 (8시간 당 1일 연가 차감 적용, 잔여 {dutyStats.remainingEarlyHours}시간)
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="text-center bg-white px-4 py-2 rounded-lg border shadow-sm">
                    <div className="text-[10px] text-muted-foreground font-medium">잔여 연가</div>
                    <div className="text-lg font-black text-emerald-600">{dutyStats.annualRemaining}일</div>
                  </div>
                  <div className="text-center bg-white px-4 py-2 rounded-lg border shadow-sm">
                    <div className="text-[10px] text-muted-foreground font-medium">누적 병가</div>
                    <div className="text-lg font-black text-destructive">{dutyStats.sickUsed}일</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* 1단계: 메인 항목 선택 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <Label className="font-bold flex items-center gap-2 text-sm">
                  <Info size={14} className="text-primary" /> 복무 구분
                </Label>
                <Select value={mainType} onValueChange={(val) => setValue('mainType', val as any)}>
                  <SelectTrigger className="h-12 text-base font-medium">
                    <SelectValue placeholder="항목 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="휴가">휴가</SelectItem>
                    <SelectItem value="41조 연수">41조 연수</SelectItem>
                    <SelectItem value="출장">출장</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 2단계: 하위 항목 선택 (휴가/출장 시) */}
              {mainType === '휴가' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                  <Label className="font-bold text-sm">휴가 종류</Label>
                  <Select value={subType} onValueChange={(val) => setValue('subType', val)}>
                    <SelectTrigger className="h-12 text-base font-medium">
                      <SelectValue placeholder="종류 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="연가">연가</SelectItem>
                      <SelectItem value="공가">공가</SelectItem>
                      <SelectItem value="특별휴가">특별휴가</SelectItem>
                      <SelectItem value="병가">병가</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {mainType === '출장' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                  <Label className="font-bold text-sm">출장 구분</Label>
                  <Select value={subType} onValueChange={(val) => setValue('subType', val)}>
                    <SelectTrigger className="h-12 text-base font-medium">
                      <SelectValue placeholder="구분 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="관내">관내</SelectItem>
                      <SelectItem value="관외">관외</SelectItem>
                      <SelectItem value="국외">국외</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {mainType === '41조 연수' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                  <Label className="font-bold text-sm">연수 종류</Label>
                  <Select value={subType} onValueChange={(val) => setValue('subType', val)}>
                    <SelectTrigger className="h-12 text-base font-medium">
                      <SelectValue placeholder="종류 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="자율연수">자율연수</SelectItem>
                      <SelectItem value="국외자율연수">국외자율연수</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 3단계: 세부 항목 선택 (연가/특별휴가 시) */}
              {mainType === '휴가' && subType === '연가' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                  <Label className="font-bold text-sm">세부 구분</Label>
                  <Select value={watch('detailType')} onValueChange={(val) => setValue('detailType', val)}>
                    <SelectTrigger className="h-12 text-base font-medium">
                      <SelectValue placeholder="세부 구분 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="연가">연가</SelectItem>
                      <SelectItem value="조퇴">조퇴</SelectItem>
                      <SelectItem value="지참">지참</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {mainType === '휴가' && subType === '특별휴가' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                  <Label className="font-bold text-sm">세부 구분</Label>
                  <Select value={watch('detailType')} onValueChange={(val) => setValue('detailType', val)}>
                    <SelectTrigger className="h-12 text-base font-medium">
                      <SelectValue placeholder="세부 구분 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="특별휴가">특별휴가</SelectItem>
                      <SelectItem value="학습휴가">학습휴가</SelectItem>
                      <SelectItem value="육아시간">육아시간</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="h-px bg-border my-2"></div>

            {/* 기간 및 상세 정보 (출장이 아닐 때만 노출) */}
            {mainType !== '출장' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label className="font-bold text-sm flex items-center gap-2">
                    <Calendar size={14} className="text-primary" /> 시작일
                  </Label>
                  <Input type="date" {...register('startDate')} className="h-12" />
                  {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
                </div>
                <div className="space-y-3">
                  <Label className="font-bold text-sm flex items-center gap-2">
                    <Calendar size={14} className="text-primary" /> 종료일
                  </Label>
                  <Input type="date" {...register('endDate')} className="h-12" />
                  {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
                </div>
                <div className="space-y-3">
                  <Label className="font-bold text-sm flex items-center gap-2">
                    <Clock size={14} className="text-primary" /> 총 일수
                  </Label>
                  <Input type="number" step="0.1" {...register('totalDays')} className="h-12 font-bold" />
                  {errors.totalDays && <p className="text-xs text-destructive">{errors.totalDays.message}</p>}
                </div>
              </div>
            )}

            {/* 시간 선택 (조퇴/지참/육아시간 등 필요한 경우 활성화 가능) */}
            {(watch('detailType') === '조퇴' || watch('detailType') === '지참' || watch('detailType') === '육아시간') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
                <div className="space-y-3">
                  <Label className="font-bold text-sm">시작 시간</Label>
                  <Input type="time" {...register('startTime')} className="h-12" />
                </div>
                <div className="space-y-3">
                  <Label className="font-bold text-sm">종료 시간</Label>
                  <Input type="time" {...register('endTime')} className="h-12" />
                </div>
              </div>
            )}

            {/* 복수 출장 테이블 및 생성 도구 (출장일 때만 노출) */}
            {mainType === '출장' && (
              <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/20 p-4 rounded-xl border border-muted-foreground/10">
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      💼 복수 출장 및 동행자 신청 목록
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      여러 날짜의 출장을 각각 한 행씩 입력하여 하나의 기안문으로 묶어 상신할 수 있습니다.
                    </p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openRepeatModal()}
                      className="text-primary border-primary/20 hover:bg-primary/10 w-full sm:w-auto text-xs"
                    >
                      <CalendarDays className="mr-1.5 h-4 w-4" /> 요일 반복 / 동행자 일괄 생성
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => appendTravel({
                        date: new Date().toISOString().split('T')[0],
                        subType: '관내',
                        destination: '',
                        reason: '',
                        noExpensesPaid: false,
                        useCompanyVehicle: false,
                        travelers: profile ? [{ name: profile.name, email: profile.email }] : []
                      })}
                      className="text-primary border-primary/20 hover:bg-primary/10 w-full sm:w-auto text-xs"
                    >
                      <PlusCircle className="mr-1.5 h-4 w-4" /> 일정 추가
                    </Button>
                  </div>
                </div>

                {errors.travelItems && (
                  <p className="text-sm font-semibold text-destructive">{errors.travelItems.message || '출장 일정을 올바르게 입력해주세요.'}</p>
                )}

                <div className="border rounded-xl overflow-x-auto bg-white shadow-sm">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b text-muted-foreground font-semibold text-xs text-left">
                        <th className="p-3 min-w-[130px]">날짜*</th>
                        <th className="p-3 min-w-[90px]">구분*</th>
                        <th className="p-3 min-w-[150px]">목적지*</th>
                        <th className="p-3 min-w-[180px]">동행자*</th>
                        <th className="p-3 min-w-[180px]">옵션</th>
                        <th className="p-3 min-w-[200px]">사유*</th>
                        <th className="p-3 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {travelFields.map((field, index) => (
                        <tr key={field.id} className="border-b last:border-0 hover:bg-muted/5 transition-colors">
                          <td className="p-2">
                            <Input 
                              type="date" 
                              {...register(`travelItems.${index}.date` as const)} 
                              className="h-9 text-xs" 
                            />
                          </td>
                          <td className="p-2">
                            <Select 
                              value={watch(`travelItems.${index}.subType` as const)} 
                              onValueChange={(val) => setValue(`travelItems.${index}.subType` as const, val)}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="선택" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="관내">관내</SelectItem>
                                <SelectItem value="관외">관외</SelectItem>
                                <SelectItem value="국외">국외</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            <Input 
                              {...register(`travelItems.${index}.destination` as const)} 
                              placeholder="목적지 입력" 
                              className="h-9 text-xs" 
                            />
                          </td>
                          <td className="p-2">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex flex-wrap gap-1">
                                {watch(`travelItems.${index}.travelers` as const)?.map((tr: any, tIdx: number) => (
                                  <span key={tr.email} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/20">
                                    {tr.name}
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        const currentTravelers = getValues(`travelItems.${index}.travelers` as const) || [];
                                        setValue(`travelItems.${index}.travelers` as const, currentTravelers.filter((_: any, i: number) => i !== tIdx));
                                      }}
                                      className="text-primary hover:text-destructive hover:scale-110 ml-0.5 text-xs font-bold transition-all"
                                    >
                                      &times;
                                    </button>
                                  </span>
                                ))}
                              </div>
                              
                              <Select 
                                onValueChange={(val) => {
                                  if (val === 'ADD_SELF' && profile) {
                                    const curr = getValues(`travelItems.${index}.travelers` as const) || [];
                                    if (!curr.some(t => t.email === profile.email)) {
                                      setValue(`travelItems.${index}.travelers` as const, [...curr, { name: profile.name, email: profile.email }]);
                                    }
                                  } else if (val.startsWith('ADD_USER_')) {
                                    const email = val.replace('ADD_USER_', '');
                                    const u = users.find(x => x.email === email);
                                    if (u) {
                                      const curr = getValues(`travelItems.${index}.travelers` as const) || [];
                                      if (!curr.some(t => t.email === u.email)) {
                                        setValue(`travelItems.${index}.travelers` as const, [...curr, { name: u.name, email: u.email }]);
                                      }
                                    }
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-[11px] text-muted-foreground bg-muted/30">
                                  <span className="flex items-center gap-1"><Users size={12} /> 인원 추가</span>
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                  <SelectItem value="ADD_SELF">본인 추가</SelectItem>
                                  {users.map(u => (
                                    <SelectItem key={`add-${index}-${u.email}`} value={`ADD_USER_${u.email}`}>{u.name} ({u.role})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                                <input 
                                  type="checkbox"
                                  checked={watch(`travelItems.${index}.noExpensesPaid` as const) || false}
                                  onChange={(e) => setValue(`travelItems.${index}.noExpensesPaid` as const, e.target.checked)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                여비 부지급
                              </label>
                              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                                <input 
                                  type="checkbox"
                                  checked={watch(`travelItems.${index}.useCompanyVehicle` as const) || false}
                                  onChange={(e) => setValue(`travelItems.${index}.useCompanyVehicle` as const, e.target.checked)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                관용차량 이용
                              </label>
                            </div>
                          </td>
                          <td className="p-2">
                            <Input 
                              {...register(`travelItems.${index}.reason` as const)} 
                              placeholder="출장 사유 입력" 
                              className="h-9 text-xs" 
                            />
                          </td>
                          <td className="p-2 text-center">
                            {travelFields.length > 1 && (
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => removeTravel(index)}
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 일반 사유 입력 (출장이 아닐 때만 노출) */}
            {mainType !== '출장' && (
              <div className="space-y-3">
                <Label className="font-bold text-sm">사유</Label>
                <Textarea 
                  {...register('reason')} 
                  placeholder="복무 신청 사유를 구체적으로 작성해 주세요." 
                  className="min-h-[120px] text-base"
                />
                {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
              </div>
            )}

            {mainType === '41조 연수' && subType === '국외자율연수' && (
              <div className="space-y-6 pt-6 border-t-2 border-primary/20 animate-in slide-in-from-top-4 duration-500">
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
                  <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                    📄 국외자율연수를 위한 공무외국외여행 계획서 작성
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    국외자율연수 시에는 학교장 승인을 받기 위한 공무외국외여행 계획서 제출이 필수적입니다. 아래 양식의 모든 정보를 상세히 입력해 주세요.
                  </p>
                </div>

                {/* 기본 인적 사항 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-bold text-sm">소속</Label>
                    <Input {...register('studyAbroadPlan.affiliation')} className="h-12" placeholder="예: 서울송정초등학교" />
                    {errors.studyAbroadPlan?.affiliation && (
                      <p className="text-xs text-destructive">{errors.studyAbroadPlan.affiliation.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-sm">직위(급)</Label>
                    <Input {...register('studyAbroadPlan.position')} className="h-12" placeholder="예: 교사" />
                    {errors.studyAbroadPlan?.position && (
                      <p className="text-xs text-destructive">{errors.studyAbroadPlan.position.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-sm">성명</Label>
                    <Input {...register('studyAbroadPlan.name')} className="h-12" placeholder="예: 홍길동" />
                    {errors.studyAbroadPlan?.name && (
                      <p className="text-xs text-destructive">{errors.studyAbroadPlan.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-sm">과목</Label>
                    <Input {...register('studyAbroadPlan.subject')} className="h-12" placeholder="예: 공통" />
                    {errors.studyAbroadPlan?.subject && (
                      <p className="text-xs text-destructive">{errors.studyAbroadPlan.subject.message}</p>
                    )}
                  </div>
                </div>

                {/* 기간 정보 (자동 연동 & 노출) */}
                <div className="space-y-2">
                  <Label className="font-bold text-sm">연수 기간 (복무 신청 기간과 자동 연동)</Label>
                  <div className="p-4 bg-muted/30 border rounded-lg h-12 flex items-center text-sm font-semibold text-gray-700">
                    {(() => {
                      const sDate = watch('startDate');
                      const eDate = watch('endDate');
                      const tDays = watch('totalDays');
                      return sDate && eDate
                        ? `${sDate.replace(/-/g, '.')} - ${eDate.replace(/-/g, '.')} (${tDays || 0})일간`
                        : '시작일과 종료일을 먼저 입력해 주세요.';
                    })()}
                  </div>
                </div>

                {/* 연수 구분 */}
                <div className="space-y-3">
                  <Label className="font-bold text-sm">연수 구분</Label>
                  <RadioGroup 
                    value={watch('studyAbroadPlan.category')} 
                    onValueChange={(val) => setValue('studyAbroadPlan.category', val)}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {[
                      '교직단체가 주관하는 연수',
                      '해외 교육기관의 초청',
                      '개인의 학습자료 수집',
                      '기타'
                    ].map((cat) => (
                      <div key={cat} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-muted/30 transition-colors">
                        <RadioGroupItem value={cat} id={`cat-${cat}`} />
                        <Label htmlFor={`cat-${cat}`} className="cursor-pointer text-sm font-medium w-full">{cat}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {watch('studyAbroadPlan.category') === '기타' && (
                    <div className="pt-2 animate-in slide-in-from-top-2 duration-300">
                      <Label className="font-bold text-xs text-muted-foreground">기타 상세 내용</Label>
                      <Input {...register('studyAbroadPlan.categoryEtcDetail')} placeholder="기타 연수 구분을 구체적으로 적어주세요." className="h-10 mt-1" />
                    </div>
                  )}
                  {errors.studyAbroadPlan?.category && (
                    <p className="text-xs text-destructive">{errors.studyAbroadPlan.category.message}</p>
                  )}
                </div>

                {/* 목적(배경) */}
                <div className="space-y-2">
                  <Label className="font-bold text-sm">목적 (배경)</Label>
                  <Textarea 
                    {...register('studyAbroadPlan.purpose')} 
                    placeholder="연수를 통해 넓히고자 하는 견문이나 목적, 수집하려는 자료의 활용 계획 등을 작성해 주세요."
                    className="min-h-[100px] text-sm"
                  />
                  {errors.studyAbroadPlan?.purpose && (
                    <p className="text-xs text-destructive">{errors.studyAbroadPlan.purpose.message}</p>
                  )}
                </div>

                {/* 연수 세부 일정 */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="font-bold text-sm">연수 세부 일정</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => append({ date: '', departure: '', destination: '', institution: '', content: '', note: '' })}
                      className="text-primary hover:text-primary-foreground hover:bg-primary"
                    >
                      <PlusCircle className="mr-1.5 h-4 w-4" /> 일정 추가
                    </Button>
                  </div>
                  {errors.studyAbroadPlan?.schedules && (
                    <p className="text-xs text-destructive">세부 일정의 모든 행의 필수 항목(날짜, 방문기관, 연수내용)을 올바르게 채워 주세요.</p>
                  )}

                  <div className="border rounded-lg overflow-x-auto bg-white shadow-sm">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted/50 border-b text-muted-foreground font-semibold text-xs">
                          <th className="p-3 text-left min-w-[90px]">월 일*</th>
                          <th className="p-3 text-left min-w-[100px]">출발지</th>
                          <th className="p-3 text-left min-w-[100px]">도착지</th>
                          <th className="p-3 text-left min-w-[150px]">방문기관*</th>
                          <th className="p-3 text-left min-w-[200px]">연수 내용*</th>
                          <th className="p-3 text-left min-w-[100px]">비고</th>
                          <th className="p-3 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field, index) => (
                          <tr key={field.id} className="border-b last:border-0 hover:bg-muted/10">
                            <td className="p-2">
                              <Input {...register(`studyAbroadPlan.schedules.${index}.date` as const)} placeholder="예: 8.4" className="h-9 text-xs" />
                            </td>
                            <td className="p-2">
                              <Input {...register(`studyAbroadPlan.schedules.${index}.departure` as const)} placeholder="예: 인천" className="h-9 text-xs" />
                            </td>
                            <td className="p-2">
                              <Input {...register(`studyAbroadPlan.schedules.${index}.destination` as const)} placeholder="예: 괌" className="h-9 text-xs" />
                            </td>
                            <td className="p-2">
                              <Input {...register(`studyAbroadPlan.schedules.${index}.institution` as const)} placeholder="예: 사랑의 절벽" className="h-9 text-xs" />
                            </td>
                            <td className="p-2">
                              <Input {...register(`studyAbroadPlan.schedules.${index}.content` as const)} placeholder="예: 유적지 답사 및 자료 수집" className="h-9 text-xs" />
                            </td>
                            <td className="p-2">
                              <Input {...register(`studyAbroadPlan.schedules.${index}.note` as const)} className="h-9 text-xs" />
                            </td>
                            <td className="p-2 text-center">
                              {fields.length > 1 && (
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => remove(index)}
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 연수 효과 */}
                <div className="space-y-2">
                  <Label className="font-bold text-sm">연수 효과</Label>
                  <Textarea 
                    {...register('studyAbroadPlan.effects')} 
                    placeholder="연수를 통해 기대하는 교육적 효과, 교과 지도 및 학생 생활 지도에의 기여 방안 등을 작성해 주세요."
                    className="min-h-[100px] text-sm"
                  />
                  {errors.studyAbroadPlan?.effects && (
                    <p className="text-xs text-destructive">{errors.studyAbroadPlan.effects.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* 결재선 지정 UI */}
            <div className="space-y-4 pt-6 border-t mt-6">
              <Label className="font-bold text-sm flex items-center gap-2">
                <UserCheck size={16} className="text-primary" /> 결재선 지정 (자동 추천됨)
              </Label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 border rounded-xl bg-muted/10">
                <div className="space-y-3">
                  <Label className="font-bold text-sm text-muted-foreground">1차 결재 (부장급)</Label>
                  <Select value={firstApprover} onValueChange={setFirstApprover}>
                    <SelectTrigger className="h-12 bg-background">
                      <SelectValue placeholder="선택 안함" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">선택 안함</SelectItem>
                      {org?.gradeHeads && Object.entries(org.gradeHeads).map(([grade, email]) => {
                        if (!email || email === 'unassigned') return null;
                        const name = getUserByEmail(email as string)?.name || '미지정';
                        return <SelectItem key={`GRADE_${grade}`} value={`GRADE_${grade}`}>{grade}학년 부장 ({name})</SelectItem>
                      })}
                      {org?.departments && org.departments.map((dept: any) => {
                        if (!dept.headEmail || dept.headEmail === 'unassigned') return null;
                        const name = getUserByEmail(dept.headEmail)?.name || '미지정';
                        return <SelectItem key={`DEPT_${dept.id}`} value={`DEPT_${dept.id}`}>{dept.name} 부장 ({name})</SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="font-bold text-sm text-muted-foreground">최종 결재 (관리자)</Label>
                  <Select value={finalApprover} onValueChange={(val: 'VP' | 'PRINCIPAL') => setFinalApprover(val)}>
                    <SelectTrigger className="h-12 bg-background">
                      <SelectValue placeholder="최종 결재자 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VP">교감 전결 ({org?.vicePrincipal ? getUserByEmail(org.vicePrincipal)?.name || '미지정' : '미지정'})</SelectItem>
                      <SelectItem value="PRINCIPAL">교장 결재 ({org?.principal ? getUserByEmail(org.principal)?.name || '미지정' : '미지정'})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* 현재 구성된 결재선 프리뷰 */}
              <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm font-bold mb-2 text-primary">현재 지정된 결재선</p>
                <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
                  <span className="px-3 py-1 bg-white rounded-md border shadow-sm">기안자</span>
                  {firstApprover !== 'NONE' && (
                    <>
                      <span className="text-muted-foreground">➔</span>
                      <span className="px-3 py-1 bg-white rounded-md border shadow-sm">
                        {firstApprover.startsWith('GRADE_') ? `${firstApprover.replace('GRADE_', '')}학년 부장` : 
                         firstApprover.startsWith('DEPT_') ? `${org?.departments?.find((d:any)=>d.id === firstApprover.replace('DEPT_',''))?.name} 부장` : ''}
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground">➔</span>
                  <span className="px-3 py-1 bg-white rounded-md border shadow-sm text-primary">
                    교감 {finalApprover === 'VP' ? '(전결)' : ''}
                  </span>
                  {finalApprover === 'PRINCIPAL' && (
                    <>
                      <span className="text-muted-foreground">➔</span>
                      <span className="px-3 py-1 bg-white rounded-md border shadow-sm text-primary">교장 (결재)</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="bg-muted/30 border-t p-8 flex justify-between items-center mt-6">
            <p className="text-sm text-muted-foreground hidden md:block">
              결재선은 설정된 조직도와 선택 항목을 기반으로 자동 추천됩니다.
            </p>
            <div className="flex gap-4 w-full md:w-auto">
              <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1 md:flex-none h-12 px-8">
                취소
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1 md:flex-none h-12 px-10 font-bold text-lg shadow-lg hover:shadow-xl transition-all">
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                결재 상신
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={isRepeatModalOpen} onOpenChange={setIsRepeatModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CalendarDays className="text-primary h-5 w-5" /> 요일 반복 및 동행자 일괄 설정
            </DialogTitle>
            <DialogDescription>
              지정된 기간 동안 선택하신 요일에 맞춰 일자별 출장 일정을 일괄 생성하고, 동행자를 함께 지정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 my-4">
            {/* 1. 기간 설정 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold text-xs">시작일</Label>
                <Input type="date" value={repeatStartDate} onChange={(e) => setRepeatStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-xs">종료일</Label>
                <Input type="date" value={repeatEndDate} onChange={(e) => setRepeatEndDate(e.target.value)} />
              </div>
            </div>

            {/* 2. 반복 요일 선택 */}
            <div className="space-y-2">
              <Label className="font-semibold text-xs">반복 요일</Label>
              <div className="flex gap-2">
                {[
                  { label: '일', value: 0 },
                  { label: '월', value: 1 },
                  { label: '화', value: 2 },
                  { label: '수', value: 3 },
                  { label: '목', value: 4 },
                  { label: '금', value: 5 },
                  { label: '토', value: 6 },
                ].map((d) => {
                  const isSelected = selectedDays.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedDays(selectedDays.filter(v => v !== d.value));
                        } else {
                          setSelectedDays([...selectedDays, d.value]);
                        }
                      }}
                      className={`flex-1 py-2 text-center rounded-lg border font-semibold text-sm transition-all ${
                        isSelected 
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
                          : 'bg-background hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. 출장 세부 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold text-xs">출장 구분</Label>
                <Select value={repeatSubType} onValueChange={setRepeatSubType}>
                  <SelectTrigger>
                    <SelectValue placeholder="구분 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="관내">관내</SelectItem>
                    <SelectItem value="관외">관외</SelectItem>
                    <SelectItem value="국외">국외</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-xs">목적지</Label>
                <Input placeholder="목적지 입력" value={repeatDestination} onChange={(e) => setRepeatDestination(e.target.value)} />
              </div>
            </div>

            {/* 4. 옵션 선택 */}
            <div className="flex gap-6 border-y py-3">
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none">
                <Checkbox 
                  checked={repeatNoExpensesPaid} 
                  onCheckedChange={(checked) => setRepeatNoExpensesPaid(!!checked)}
                />
                여비 부지급
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none">
                <Checkbox 
                  checked={repeatUseCompanyVehicle} 
                  onCheckedChange={(checked) => setRepeatUseCompanyVehicle(!!checked)}
                />
                관용차량 이용
              </label>
            </div>

            {/* 5. 사유 */}
            <div className="space-y-2">
              <Label className="font-semibold text-xs">출장 사유</Label>
              <Input placeholder="사유 입력" value={repeatReason} onChange={(e) => setRepeatReason(e.target.value)} />
            </div>

            {/* 6. 동행자 선택 */}
            <div className="space-y-3 pt-2">
              <Label className="font-semibold text-sm flex items-center gap-1.5">
                <Users size={16} className="text-primary" /> 동행자 지정
              </Label>
              
              {/* 선택된 동행자 표시 */}
              <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 border rounded-lg bg-muted/20">
                {selectedTravelers.length === 0 ? (
                  <span className="text-xs text-muted-foreground self-center px-1">선택된 인원이 없습니다 (본인을 포함시켜 주세요).</span>
                ) : (
                  selectedTravelers.map((tr) => (
                    <span key={tr.email} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full border border-primary/20">
                      {tr.name}
                      {profile?.email !== tr.email && (
                        <button 
                          type="button" 
                          onClick={() => setSelectedTravelers(selectedTravelers.filter(t => t.email !== tr.email))}
                          className="text-primary hover:text-destructive hover:scale-110 ml-1 text-sm font-bold transition-all"
                        >
                          &times;
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>

              {/* 검색 및 검색 결과 */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="교사 이름 또는 이메일 검색..." 
                    value={searchKeyword} 
                    onChange={(e) => setSearchKeyword(e.target.value)} 
                    className="pl-9"
                  />
                </div>

                <div className="border rounded-lg max-h-[160px] overflow-y-auto bg-white divide-y">
                  {users.filter(u => 
                    u.name.toLowerCase().includes(searchKeyword.toLowerCase()) || 
                    u.email.toLowerCase().includes(searchKeyword.toLowerCase())
                  ).map((u) => {
                    const isSelected = selectedTravelers.some(t => t.email === u.email);
                    return (
                      <div 
                        key={u.uid} 
                        onClick={() => toggleTraveler(u)}
                        className={`flex items-center justify-between p-2.5 text-xs cursor-pointer hover:bg-muted/50 transition-colors ${
                          isSelected ? 'bg-primary/5 font-semibold text-primary' : ''
                        }`}
                      >
                        <div>
                          <span className="font-bold text-sm">{u.name}</span>
                          <span className="text-muted-foreground ml-1.5">({u.role || '교사'})</span>
                          <span className="text-muted-foreground/60 ml-2 block sm:inline">{u.email}</span>
                        </div>
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleTraveler(u)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsRepeatModalOpen(false)}>
              취소
            </Button>
            <Button type="button" onClick={handleGenerateRepeatTravels}>
              일정 일괄 생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
