'use client';

import { Suspense, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Clock, Send, ArrowLeft, UserCheck, Loader2, AlertCircle } from 'lucide-react';
import { createDocument, getTeacherOvertimeHoursByMonth, getDocumentById } from '@/lib/services/documentService';
import { TeacherOvertimeData } from '@/lib/types';
import { getOrgStructure } from '@/lib/services/settingsService';
import { getUserProfileByEmail, getUsersDirectory } from '@/lib/services/userService';

const overtimeSchema = z.object({
  date: z.string().min(1, '일자를 선택해주세요'),
  startTime: z.string().min(1, '시작 시간을 선택해주세요'),
  endTime: z.string().min(1, '종료 시간을 선택해주세요'),
  reason: z.string().min(1, '사유를 입력해주세요'),
});

type OvertimeFormValues = z.infer<typeof overtimeSchema>;

function OvertimeForm() {
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
  const [accumulatedHours, setAccumulatedHours] = useState<number>(0);
  const [isLoadingAccumulated, setIsLoadingAccumulated] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      const orgData = await getOrgStructure();
      setOrg(orgData);
      const allUsers = await getUsersDirectory();
      setUsers(allUsers);
    }
    loadData();
  }, []);

  const getUserByEmail = (email: string) => users.find(u => u.email === email);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<OvertimeFormValues>({
    resolver: zodResolver(overtimeSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      startTime: '16:30',
      endTime: '18:30',
      reason: '',
    }
  });

  const watchDate = watch('date');
  const watchStartTime = watch('startTime');
  const watchEndTime = watch('endTime');

  useEffect(() => {
    async function loadCloneData() {
      if (!cloneId) return;
      try {
        const fetched = await getDocumentById(cloneId);
        if (fetched && fetched.teacherOvertimeData) {
          const data = fetched.teacherOvertimeData;
          setValue('date', data.date || new Date().toISOString().split('T')[0]);
          setValue('startTime', data.startTime || '16:30');
          setValue('endTime', data.endTime || '18:30');
          setValue('reason', data.reason || '');
          toast({ title: "문서 복사됨", description: "이전 초과근무 신청 내용을 불러왔습니다." });
        }
      } catch (e) {
        console.error("Clone load error:", e);
      }
    }
    loadCloneData();
  }, [cloneId, setValue, toast]);

  useEffect(() => {
    if (!user || !user.email || !watchDate) return;
    const email = user.email;
    const yearMonth = watchDate.substring(0, 7); // "YYYY-MM"
    
    async function fetchAccumulated() {
      setIsLoadingAccumulated(true);
      try {
        const hours = await getTeacherOvertimeHoursByMonth(email, yearMonth);
        setAccumulatedHours(hours);
      } catch (err) {
        console.error("Error fetching accumulated overtime hours:", err);
      } finally {
        setIsLoadingAccumulated(false);
      }
    }
    
    fetchAccumulated();
  }, [user?.email, watchDate]);

  const calculateHours = (dateStr: string, start: string, end: string) => {
    if (!dateStr || !start || !end) return 0;
    
    if (start === '00:00' && end === '00:00') return 0;
    
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    let S = startH * 60 + startM;
    let E = endH * 60 + endM;
    if (E < S) E += 24 * 60;
    
    let deductionMinutes = 0;
    
    // 평일인지 체크 (0: 일요일, 6: 토요일)
    const day = new Date(dateStr).getDay();
    const isWeekday = day >= 1 && day <= 5;
    
    if (isWeekday) {
      // 16:30 ~ 17:30 공제 (990 ~ 1050 분)
      const overlapStart = Math.max(S, 990);
      const overlapEnd = Math.min(E, 1050);
      if (overlapStart < overlapEnd) {
        deductionMinutes = overlapEnd - overlapStart;
      }
    }
    
    let netMinutes = (E - S) - deductionMinutes;
    netMinutes = Math.max(0, netMinutes);
    
    // 하루 최대 4시간 (240분) 제한
    netMinutes = Math.min(240, netMinutes);
    
    return parseFloat((netMinutes / 60).toFixed(1));
  };

  const totalHours = calculateHours(watchDate, watchStartTime, watchEndTime);

  const onSubmit = async (data: OvertimeFormValues) => {
    if (!user || !profile) return;
    
    // User requested 00:00 to 00:00 is 0 hours
    const calcHours = calculateHours(data.date, data.startTime, data.endTime);

    // 57시간 제한 체크
    const yearMonth = data.date.substring(0, 7);
    setIsSubmitting(true);
    try {
      const latestAccumulated = await getTeacherOvertimeHoursByMonth(user.email!, yearMonth);
      if (latestAccumulated + calcHours > 57) {
        toast({
          variant: 'destructive',
          title: '상신 실패',
          description: `월간 신청 가능 초과근무 시간(57시간)을 초과하였습니다. (현재 누적 ${latestAccumulated}시간 + 신청 ${calcHours}시간 = ${latestAccumulated + calcHours}시간)`
        });
        setIsSubmitting(false);
        return;
      }

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
          const approverProfile = await getUserProfileByEmail(email);
          if (approverProfile) {
            approvers.push({ name: approverProfile.name, email: approverProfile.email, role: roleName, type: 'normal' as const, status: 'pending' as const });
          }
        }
      }

      // 2. 교감
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
      
      // 3. 교장
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

      const title = `[초과근무] ${profile.name} (${data.date})`;
      
      const content = `항목: 초과근무<br/>일자: ${data.date}<br/>시간: ${data.startTime} ~ ${data.endTime} (총 ${calcHours}시간)<br/>사유: ${data.reason}`;

      const result = await createDocument({
        title,
        content,
        docType: 'teacher-overtime',
        publishStatus: '비공개',
        teacherOvertimeData: {
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          totalHours: calcHours,
          reason: data.reason
        },
        approvers,
        attachments: [],
      }, user.email!, profile);

      if (result.success) {
        toast({ title: '상신 완료', description: '초과근무 신청서가 성공적으로 상신되었습니다.' });
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
        <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
          <Clock size={18} />
          <span className="font-bold">초과근무 신청</span>
        </div>
      </div>

      <Card className="shadow-2xl border-t-4 border-t-indigo-500 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-8">
          <CardTitle className="text-2xl font-bold font-headline">초과근무 기안</CardTitle>
          <CardDescription className="text-base mt-2">초과근무 시간 및 사유를 입력해주세요.</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-8 pt-8">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-3 col-span-1">
                <Label className="font-bold text-sm">근무 일자</Label>
                <Input type="date" {...register('date')} className="h-12" />
                {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
              </div>
              <div className="space-y-3 col-span-1">
                <Label className="font-bold text-sm">시작 시간</Label>
                <Input type="time" {...register('startTime')} className="h-12" />
                {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
              </div>
              <div className="space-y-3 col-span-1">
                <Label className="font-bold text-sm">종료 시간</Label>
                <Input type="time" {...register('endTime')} className="h-12" />
                {errors.endTime && <p className="text-xs text-destructive">{errors.endTime.message}</p>}
              </div>
              <div className="space-y-3 col-span-1 bg-indigo-50 p-4 rounded-lg flex flex-col justify-center items-center border border-indigo-100">
                <Label className="font-bold text-sm text-indigo-600 text-center">총 근무시간</Label>
                <span className="text-xl font-black text-indigo-700">{totalHours} 시간</span>
              </div>
              <div className="space-y-3 col-span-1 bg-amber-50 p-4 rounded-lg flex flex-col justify-center items-center border border-amber-100">
                <Label className="font-bold text-sm text-amber-600 text-center">월 누적/신청가능</Label>
                <span className="text-xl font-black text-amber-700">
                  {isLoadingAccumulated ? '...' : `${accumulatedHours} / 57 시간`}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                ※ 평일(월~금) 16:30 ~ 17:30(1시간)은 공제 시간(휴게시간 등)으로 근무 시간에서 제외되며, 하루 최대 4시간까지 인정됩니다.
              </p>
            </div>

            {accumulatedHours + totalHours > 57 && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm font-semibold flex items-start gap-2 border border-destructive/20">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">월간 초과근무 신청 한도(57시간)를 초과하였습니다.</p>
                  <p className="text-xs mt-1">이번 달 기존 누적 신청: {accumulatedHours}시간 + 이번 신청: {totalHours}시간 = 총 {accumulatedHours + totalHours}시간 (신청가능 한도 57시간)</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label className="font-bold text-sm">사유</Label>
              <Textarea 
                {...register('reason')} 
                placeholder="초과근무 사유 및 내용을 상세히 작성해 주세요." 
                className="min-h-[120px] text-base"
              />
              {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
            </div>

            {/* 결재선 지정 UI */}
            <div className="space-y-4 pt-6 border-t mt-6">
              <Label className="font-bold text-sm flex items-center gap-2">
                <UserCheck size={16} className="text-indigo-600" /> 결재선 지정
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
            </div>
          </CardContent>

          <CardFooter className="bg-muted/30 border-t p-8 flex justify-between items-center mt-6">
            <p className="text-sm text-muted-foreground hidden md:block">
              결재선은 설정된 조직도를 기반으로 구성됩니다.
            </p>
            <div className="flex gap-4 w-full md:w-auto">
              <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1 md:flex-none h-12 px-8">
                취소
              </Button>
              <Button type="submit" disabled={isSubmitting || (accumulatedHours + totalHours > 57)} className="flex-1 md:flex-none h-12 px-10 font-bold text-lg shadow-lg hover:shadow-xl transition-all bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                결재 상신
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function OvertimePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <OvertimeForm />
    </Suspense>
  );
}
