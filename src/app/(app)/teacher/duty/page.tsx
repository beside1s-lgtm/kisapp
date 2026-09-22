'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Briefcase, Calendar, Clock, Loader2, Send, ArrowLeft, Info, UserCheck } from 'lucide-react';
import { createDocument, getTeacherDutyStats, getDocumentById } from '@/lib/services/documentService';
import { TeacherDutyData } from '@/lib/types';
import { getOrgStructure } from '@/lib/services/settingsService';
import { getUserProfileByEmail, getUsersDirectory } from '@/lib/services/userService';
import { getDelegationRules } from '@/lib/services/settingsService';
import type { DelegationRule } from '@/lib/types';
import { TravelItemsSection } from '@/components/teacher-duty/TravelItemsSection';
import { StudyAbroadPlanSection } from '@/components/teacher-duty/StudyAbroadPlanSection';
import { RepeatTravelDialog } from '@/components/teacher-duty/RepeatTravelDialog';

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

export type DutyFormValues = z.infer<typeof dutySchema>;

export default function TeacherDutyPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloneId = searchParams.get('cloneId');
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

  useEffect(() => {
    async function loadCloneData() {
      if (!cloneId) return;
      try {
        const fetched = await getDocumentById(cloneId);
        if (fetched && fetched.teacherDutyData) {
          const data = fetched.teacherDutyData;
          setValue('mainType', data.mainType || '휴가');
          setValue('subType', data.subType || '');
          setValue('detailType', data.detailType || '');
          setValue('startDate', data.startDate || '');
          setValue('endDate', data.endDate || '');
          setValue('startTime', data.startTime || '');
          setValue('endTime', data.endTime || '');
          setValue('totalDays', data.totalDays || 1);
          setValue('reason', data.reason || '');
          setValue('destination', data.destination || '');
          setValue('noExpensesPaid', !!data.noExpensesPaid);
          setValue('useCompanyVehicle', !!data.useCompanyVehicle);
          if (data.travelItems) setValue('travelItems', data.travelItems);
          if (data.studyAbroadPlan) setValue('studyAbroadPlan', data.studyAbroadPlan);
          toast({ title: "문서 복사됨", description: "이전 복무 신청 내용을 불러왔습니다." });
        }
      } catch (e) {
        console.error("Clone load error:", e);
      }
    }
    loadCloneData();
  }, [cloneId, setValue, toast]);

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
      setFinalApprover(rule.finalApprover === 'VP' ? 'VP' : 'PRINCIPAL');
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
      if (org.vicePrincipal || org.vicePrincipalName) {
        const vp = org.vicePrincipal ? await getUserProfileByEmail(org.vicePrincipal) : null;
        approvers.push({ 
          name: org.vicePrincipalName?.trim() || vp?.name || '교감', 
          email: vp?.email || '', 
          role: '교감', 
          type: finalApprover === 'VP' ? 'final' as const : 'normal' as const, 
          status: 'pending' as const 
        });
      }
      
      // 3. 교장 (finalApprover === 'PRINCIPAL' 일 때만)
      if (finalApprover === 'PRINCIPAL' && (org.principal || org.principalName)) {
        const principal = org.principal ? await getUserProfileByEmail(org.principal) : null;
        approvers.push({ 
          name: org.principalName?.trim() || principal?.name || '교장', 
          email: principal?.email || '', 
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
              <TravelItemsSection
                profile={profile}
                openRepeatModal={openRepeatModal}
                appendTravel={appendTravel}
                errors={errors}
                travelFields={travelFields}
                register={register}
                watch={watch}
                setValue={setValue}
                getValues={getValues}
                users={users}
                removeTravel={removeTravel}
              />
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
              <StudyAbroadPlanSection
                register={register}
                errors={errors}
                watch={watch}
                setValue={setValue}
                fields={fields}
                append={append}
                remove={remove}
              />
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
                      <SelectItem value="VP">교감 전결 ({org?.vicePrincipalName || (org?.vicePrincipal ? getUserByEmail(org.vicePrincipal)?.name : '') || '미지정'})</SelectItem>
                      <SelectItem value="PRINCIPAL">교장 결재 ({org?.principalName || (org?.principal ? getUserByEmail(org.principal)?.name : '') || '미지정'})</SelectItem>
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

      <RepeatTravelDialog
        isRepeatModalOpen={isRepeatModalOpen}
        setIsRepeatModalOpen={setIsRepeatModalOpen}
        repeatStartDate={repeatStartDate}
        setRepeatStartDate={setRepeatStartDate}
        repeatEndDate={repeatEndDate}
        setRepeatEndDate={setRepeatEndDate}
        selectedDays={selectedDays}
        setSelectedDays={setSelectedDays}
        repeatSubType={repeatSubType}
        setRepeatSubType={setRepeatSubType}
        repeatDestination={repeatDestination}
        setRepeatDestination={setRepeatDestination}
        repeatNoExpensesPaid={repeatNoExpensesPaid}
        setRepeatNoExpensesPaid={setRepeatNoExpensesPaid}
        repeatUseCompanyVehicle={repeatUseCompanyVehicle}
        setRepeatUseCompanyVehicle={setRepeatUseCompanyVehicle}
        repeatReason={repeatReason}
        setRepeatReason={setRepeatReason}
        selectedTravelers={selectedTravelers}
        setSelectedTravelers={setSelectedTravelers}
        searchKeyword={searchKeyword}
        setSearchKeyword={setSearchKeyword}
        users={users}
        profile={profile}
        toggleTraveler={toggleTraveler}
        handleGenerateRepeatTravels={handleGenerateRepeatTravels}
      />
    </div>
  );
}
