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
import { BookOpen, Send, ArrowLeft, Loader2, UserCheck, Plus, Trash2, Info, Users, AlertCircle, CheckSquare, CalendarDays } from 'lucide-react';
import { createDocument, getDocumentById } from '@/lib/services/documentService';
import { AfterschoolCourseData, UserProfile } from '@/lib/types';
import { getOrgStructure, getDocConfig } from '@/lib/services/settingsService';
import { getUsersDirectory } from '@/lib/services/userService';
import UserSearch from '@/components/user-search';

const afterschoolSchema = z.object({
  courseName: z.string().min(1, '강좌명을 입력해주세요'),
  totalSessions: z.coerce.number().min(1, '1차시 이상이어야 합니다'),
  minCapacity: z.coerce.number().min(1, '폐강 기준 인원을 1명 이상 입력해주세요'),
  maxCapacity: z.coerce.number().min(1, '모집 정원을 1명 이상 입력해주세요'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof afterschoolSchema>;

const WEEKDAYS = ['월', '화', '수', '목', '금'] as const;

function AfterschoolForm() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloneId = searchParams.get('cloneId');
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [org, setOrg] = useState<any>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [feePerSession, setFeePerSession] = useState<number>(15000);

  // 요일 선택 상태 (최대 2개)
  const [selectedDays, setSelectedDays] = useState<string[]>(['월', '수']);

  // 예비 강사 목록
  const [assistantTeachers, setAssistantTeachers] = useState<{ name: string; email: string; role: string }[]>([]);

  // 결재선 선택 상태
  const [firstApprover, setFirstApprover] = useState<string>('NONE');
  const [finalApprover, setFinalApprover] = useState<'VP' | 'PRINCIPAL'>('PRINCIPAL');

  useEffect(() => {
    async function loadData() {
      const orgData = await getOrgStructure();
      setOrg(orgData);
      const allUsers = await getUsersDirectory();
      setUsers(allUsers);
      const config = await getDocConfig();
      if (config.afterschoolFeePerSession) {
        setFeePerSession(config.afterschoolFeePerSession);
      }
    }
    loadData();
  }, []);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(afterschoolSchema),
    defaultValues: {
      courseName: '',
      totalSessions: 10,
      minCapacity: 10,
      maxCapacity: 15,
      description: '',
    }
  });

  const watchTotalSessions = watch('totalSessions') || 0;
  const watchMaxCapacity = watch('maxCapacity') || 0;
  const watchMinCapacity = watch('minCapacity') || 0;

  // 정원 기반 추가 배정 가능한 예비 강사 수 계산
  // 20명 미만: 0명
  // 20명 이상: 1명 + Math.floor((maxCapacity - 20) / 5)
  const requiredAssistantsLimit = watchMaxCapacity >= 20 ? 1 + Math.floor((watchMaxCapacity - 20) / 5) : 0;

  // 복제 모드 로드
  useEffect(() => {
    async function loadCloneData() {
      if (!cloneId) return;
      try {
        const fetched = await getDocumentById(cloneId);
        if (fetched && fetched.afterschoolCourseData) {
          const data = fetched.afterschoolCourseData;
          setValue('courseName', data.courseName || '');
          setValue('totalSessions', data.totalSessions || 10);
          setValue('minCapacity', data.minCapacity || 10);
          setValue('maxCapacity', data.maxCapacity || 15);
          setValue('description', data.description || '');
          if (data.days && Array.isArray(data.days)) {
            setSelectedDays(data.days);
          }
          if (data.assistantTeachers && Array.isArray(data.assistantTeachers)) {
            setAssistantTeachers(data.assistantTeachers);
          }
          toast({ title: "문서 복사됨", description: "이전 강좌 등록 내용을 불러왔습니다." });
        }
      } catch (e) {
        console.error("Clone load error:", e);
      }
    }
    loadCloneData();
  }, [cloneId, setValue, toast]);

  // 요일 선택 클릭 핸들러 (최대 2개)
  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      if (selectedDays.length >= 2) {
        toast({
          variant: 'destructive',
          title: '선택 제한',
          description: '우리 학교 방과후 강좌는 주 2회까지만 운영할 수 있습니다.'
        });
        return;
      }
      setSelectedDays([...selectedDays, day]);
    }
  };

  // 예비 강사 추가
  const addAssistantTeacher = (selectedUser: UserProfile) => {
    if (assistantTeachers.length >= requiredAssistantsLimit) {
      toast({
        variant: 'destructive',
        title: '배정 한도 초과',
        description: `모집 정원 ${watchMaxCapacity}명 기준, 예비 강사는 최대 ${requiredAssistantsLimit}명까지 지정 가능합니다.`
      });
      return;
    }
    if (assistantTeachers.some(a => a.email === selectedUser.email)) {
      toast({ variant: 'destructive', title: '중복 선택', description: '이미 추가된 예비 강사입니다.' });
      return;
    }
    setAssistantTeachers([
      ...assistantTeachers,
      { name: selectedUser.name, email: selectedUser.email, role: selectedUser.role || '교사' }
    ]);
  };

  const removeAssistantTeacher = (index: number) => {
    setAssistantTeachers(assistantTeachers.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: FormValues) => {
    if (!user || !profile) return;

    if (selectedDays.length === 0) {
      toast({ variant: 'destructive', title: '입력 오류', description: '강좌 운영 요일을 1개 이상 선택해 주세요 (최대 2회).' });
      return;
    }

    if (data.minCapacity > data.maxCapacity) {
      toast({ variant: 'destructive', title: '입력 오류', description: '폐강 기준 인원은 모집 정원보다 클 수 없습니다.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const calculatedTotalFee = data.totalSessions * feePerSession;

      const afterschoolCourseData: AfterschoolCourseData = {
        courseName: data.courseName,
        days: selectedDays,
        totalSessions: data.totalSessions,
        feePerSession,
        totalFee: calculatedTotalFee,
        minCapacity: data.minCapacity,
        maxCapacity: data.maxCapacity,
        mainTeacherName: profile.name,
        mainTeacherEmail: profile.email,
        assistantTeachers,
        description: data.description,
      };

      // 결재선 구성
      const approvers: any[] = [];
      const myDept = org?.departments?.find((d: any) => 
        d.memberEmails?.some((m: string) => m.toLowerCase() === profile.email.toLowerCase()) ||
        d.headEmail?.toLowerCase() === profile.email.toLowerCase()
      );

      if (firstApprover !== 'NONE' && myDept?.headEmail) {
        const headUser = users.find(u => u.email === myDept.headEmail);
        approvers.push({
          name: headUser?.name || '부장',
          email: myDept.headEmail,
          role: `${myDept.name} 부장`,
          type: 'normal',
          status: 'pending'
        });
      }

      if (org?.vicePrincipal) {
        const vpUser = users.find(u => u.email === org.vicePrincipal);
        approvers.push({
          name: vpUser?.name || '교감',
          email: org.vicePrincipal,
          role: '교감',
          type: finalApprover === 'VP' ? 'final' : 'normal',
          status: 'pending'
        });
      }

      if (finalApprover === 'PRINCIPAL' && org?.principal) {
        const pUser = users.find(u => u.email === org.principal);
        approvers.push({
          name: pUser?.name || '교장',
          email: org.principal,
          role: '교장',
          type: 'final',
          status: 'pending'
        });
      }

      const title = `[방과후 강좌 등록] ${data.courseName} (${profile.name})`;
      const daysStr = selectedDays.join(', ');
      const content = `
        <strong>강좌명:</strong> ${data.courseName}<br/>
        <strong>운영 요일:</strong> 주 ${selectedDays.length}회 (${daysStr})<br/>
        <strong>총 차시:</strong> ${data.totalSessions}차시 (차시당 ${feePerSession.toLocaleString()}원, 총 ${calculatedTotalFee.toLocaleString()}원)<br/>
        <strong>폐강 기준:</strong> ${data.minCapacity}명 미만 미달 시 자동 폐강<br/>
        <strong>모집 정원:</strong> ${data.maxCapacity}명<br/>
        <strong>주강사:</strong> ${profile.name} (${profile.email})<br/>
        ${assistantTeachers.length > 0 ? `<strong>예비 강사:</strong> ${assistantTeachers.map(a => `${a.name}(${a.email})`).join(', ')}<br/>` : ''}
        ${data.description ? `<strong>강좌 개요:</strong> ${data.description}` : ''}
      `;

      const res = await createDocument({
        title,
        content,
        docType: 'teacher-afterschool',
        publishStatus: '공개',
        afterschoolCourseData,
        approvers,
        attachments: [],
      }, user.uid, profile);

      if (!res.success) {
        throw new Error(res.error || '상신 실패');
      }

      toast({ title: '방과후 강좌 등록 상신 완료', description: '결재선으로 문서가 전달되었습니다.' });
      router.push('/sent');
    } catch (err: any) {
      toast({ variant: 'destructive', title: '상신 실패', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in duration-300">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-2">
          <ArrowLeft size={16} /> 뒤로가기
        </Button>
      </div>

      <Card className="shadow-xl border-slate-200">
        <CardHeader className="bg-slate-50/70 border-b pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <BookOpen size={28} />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold font-headline">방과후 학교 강좌 등록 신청</CardTitle>
              <CardDescription className="text-base mt-1">
                신규 방과후 강좌 정보 및 수강료, 모집 정원, 강사 배정 내용을 작성하여 결재를 요청합니다.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-8 pt-6">
            
            {/* 1. 강좌 기본 정보 및 요일 선택 */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 border-b pb-2 text-slate-800">
                <CalendarDays className="h-5 w-5 text-primary" /> 강좌 기본 정보
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="courseName" className="font-bold">강좌명 <span className="text-red-500">*</span></Label>
                  <Input 
                    id="courseName" 
                    {...register('courseName')} 
                    placeholder="예: 창의 로봇 교실 (초급)" 
                    className={errors.courseName ? 'border-red-500' : ''}
                  />
                  {errors.courseName && <p className="text-xs text-red-500">{errors.courseName.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="font-bold">운영 요일 선택 (주 2회 이하) <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-2 pt-1">
                    {WEEKDAYS.map(day => {
                      const isSelected = selectedDays.includes(day);
                      return (
                        <Button
                          key={day}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleDay(day)}
                          className={`w-12 h-10 font-bold transition-all ${isSelected ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-slate-100'}`}
                        >
                          {day}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    선택된 요일: <span className="font-bold text-primary">{selectedDays.length > 0 ? selectedDays.join(', ') : '없음'}</span> (주 {selectedDays.length}회)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="font-bold">강좌 개요 및 운영 계획</Label>
                <Textarea 
                  id="description" 
                  {...register('description')} 
                  placeholder="강좌의 교육 목표, 준비물, 차시별 주요 활동 내용을 자유롭게 기술해주세요." 
                  rows={3} 
                />
              </div>
            </div>

            {/* 2. 수강료 및 차시 고정 관리 */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 border-b pb-2 text-slate-800">
                <CheckSquare className="h-5 w-5 text-primary" /> 수강료 및 차시 설정 (관리자 고정 기준)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-semibold">차시별 수강료 (관리자 지정)</Label>
                  <div className="text-xl font-black text-slate-700 bg-white px-3 py-2 rounded-lg border">
                    {feePerSession.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">원 / 차시</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="totalSessions" className="font-bold">총 운영 차시 <span className="text-red-500">*</span></Label>
                  <Input 
                    id="totalSessions" 
                    type="number" 
                    min={1} 
                    {...register('totalSessions')} 
                    className="bg-white font-bold"
                  />
                  {errors.totalSessions && <p className="text-xs text-red-500">{errors.totalSessions.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-semibold">예상 총 수강료 (자동 산출)</Label>
                  <div className="text-xl font-black text-primary bg-primary/10 px-3 py-2 rounded-lg border border-primary/20">
                    {(watchTotalSessions * feePerSession).toLocaleString()} <span className="text-sm font-normal">원</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. 폐강 기준 & 모집 정원 */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 border-b pb-2 text-slate-800">
                <Users className="h-5 w-5 text-primary" /> 수강생 인원 및 폐강 기준
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="minCapacity" className="font-bold">폐강 기준 인원 (미달 시 자동 폐강) <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      id="minCapacity" 
                      type="number" 
                      min={1} 
                      {...register('minCapacity')} 
                      className="font-bold"
                    />
                    <span className="text-sm font-bold shrink-0">명 미만</span>
                  </div>
                  {errors.minCapacity && <p className="text-xs text-red-500">{errors.minCapacity.message}</p>}
                  <p className="text-xs text-muted-foreground">수강생 모집 인원이 해당 기준보다 적을 경우 자동으로 폐강 처리됩니다.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxCapacity" className="font-bold">모집 정원 (최대 인원) <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      id="maxCapacity" 
                      type="number" 
                      min={1} 
                      {...register('maxCapacity')} 
                      className="font-bold text-primary"
                    />
                    <span className="text-sm font-bold shrink-0">명</span>
                  </div>
                  {errors.maxCapacity && <p className="text-xs text-red-500">{errors.maxCapacity.message}</p>}
                </div>
              </div>
            </div>

            {/* 4. 강사 배정 (주강사 & 정원 연동 예비강사) */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 border-b pb-2 text-slate-800">
                <UserCheck className="h-5 w-5 text-primary" /> 강사 배정 (주강사 및 정원 연동 예비 강사)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border">
                  <Label className="text-xs text-muted-foreground font-semibold">주강사 (기안자 자동 지정)</Label>
                  <div className="font-bold text-base text-slate-800">
                    {profile?.name} <span className="text-xs text-muted-foreground font-normal">({profile?.email})</span>
                  </div>
                  <p className="text-xs text-muted-foreground">시스템에 로그인하여 등록을 신청한 교사가 주강사로 지정됩니다.</p>
                </div>

                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border">
                  <Label className="text-xs text-muted-foreground font-semibold">정원 연동 예비 강사 허용 수</Label>
                  <div className="font-bold text-base">
                    {watchMaxCapacity < 20 ? (
                      <span className="text-slate-500">0명 (정원 20명 미만)</span>
                    ) : (
                      <span className="text-primary font-black text-lg">
                        최대 {requiredAssistantsLimit}명 <span className="text-xs font-normal text-slate-600">(정원 {watchMaxCapacity}명 기준)</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    정원 20명 이상 시 1명 배정 가능하며, 이후 5명 추가 시마다 예비 강사 1명이 추가 지정 가능합니다.
                  </p>
                </div>
              </div>

              {/* 예비 강사 검색 및 배정 구역 */}
              {watchMaxCapacity >= 20 ? (
                <div className="space-y-4 bg-amber-50/50 border border-amber-200/70 p-4 rounded-xl">
                  <div className="flex justify-between items-center">
                    <Label className="font-bold text-amber-900 flex items-center gap-1.5">
                      <Users size={16} /> 예비 강사 지정 (kisapp 교사 풀 검색)
                    </Label>
                    <span className="text-xs font-bold text-amber-800">
                      ({assistantTeachers.length} / {requiredAssistantsLimit} 명 지정됨)
                    </span>
                  </div>

                  {assistantTeachers.length < requiredAssistantsLimit && (
                    <div className="max-w-md">
                      <UserSearch 
                        users={users.filter(u => u.email !== profile?.email)} 
                        value="" 
                        onSelectUser={addAssistantTeacher} 
                        placeholder="kisapp 교사 풀에서 예비 강사 검색..." 
                      />
                    </div>
                  )}

                  {assistantTeachers.length > 0 ? (
                    <div className="space-y-2 mt-2">
                      {assistantTeachers.map((teacher, index) => (
                        <div key={teacher.email} className="flex justify-between items-center bg-white p-3 rounded-lg border shadow-sm">
                          <div>
                            <span className="font-bold text-slate-800 text-sm">{teacher.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">({teacher.role} - {teacher.email})</span>
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removeAssistantTeacher(index)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700">지정된 예비 강사가 없습니다. 상단 검색창에서 교사를 선택해주세요.</p>
                  )}
                </div>
              ) : (
                <div className="bg-slate-100 p-3 rounded-lg text-xs text-slate-500 flex items-center gap-2">
                  <Info size={16} />
                  <span>모집 정원이 20명 미만이므로 예비 강사 지정 단계는 생략됩니다.</span>
                </div>
              )}
            </div>

            {/* 5. 결재선 설정 */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-bold flex items-center gap-2 border-b pb-2 text-slate-800">
                <UserCheck className="h-5 w-5 text-primary" /> 결재선 설정
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>부장 결재 포함 여부</Label>
                  <Select value={firstApprover} onValueChange={setFirstApprover}>
                    <SelectTrigger>
                      <SelectValue placeholder="결재 단계 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">부장 결재 제외 (교감/교장 바로 진행)</SelectItem>
                      <SelectItem value="HEAD">부장 결재 포함</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>최종 결재권자</Label>
                  <Select value={finalApprover} onValueChange={(val: any) => setFinalApprover(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="최종 결재자 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VP">교감 전결</SelectItem>
                      <SelectItem value="PRINCIPAL">교장 결재</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

          </CardContent>

          <CardFooter className="bg-slate-50/70 border-t py-4 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting} className="font-bold shadow-md">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              강좌 등록 신청 상신
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function AfterschoolPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <AfterschoolForm />
    </Suspense>
  );
}
