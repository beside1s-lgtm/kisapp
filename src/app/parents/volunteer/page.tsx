'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { createDocument, getDocumentById, getSentDocuments, submitVolunteerReport } from '@/lib/services/documentService';
import { getVolunteerApprovers } from '@/lib/services/userService';
import { ApprovalDoc, VolunteerFormData } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Send, CheckCircle2, HeartHandshake, FileText, FileCheck, Calendar, Clock, MapPin, Building, History, Printer } from 'lucide-react';
import Link from 'next/link';
import { VolunteerDocumentPrint } from '@/components/volunteer-document-print';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

function VolunteerPortalContent() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const applyId = searchParams.get('applyId');
  const typeParam = searchParams.get('type'); // 'report' | 'plan'

  const [activeTab, setActiveTab] = useState<string>(applyId || typeParam === 'report' ? 'report' : 'apply');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myDocs, setMyDocs] = useState<ApprovalDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // 확인서 작성용 원본 계획서 문서
  const [originalPlanDoc, setOriginalPlanDoc] = useState<ApprovalDoc | null>(null);
  const [loadingOriginal, setLoadingOriginal] = useState(false);

  // 미리보기/인쇄 모달
  const [previewDoc, setPreviewDoc] = useState<ApprovalDoc | null>(null);

  // 폼 상태 - 계획서용
  const [planForm, setPlanForm] = useState({
    studentName: profile?.studentName || '',
    grade: profile?.studentGrade || '',
    classNum: profile?.studentClass || '',
    studentNum: profile?.studentNumber || '',
    startDate: '',
    endDate: '',
    startDayOfWeek: '월',
    endDayOfWeek: '월',
    totalDays: 1,
    totalHours: 2,
    institution: '',
    location: '',
    content: '',
    studentSignature: profile?.signature || '',
    parentSignature: profile?.parentSignature || '',
  });

  // 폼 상태 - 확인서용
  const [reportForm, setReportForm] = useState({
    startTime: '09:00',
    endTime: '13:00',
    totalHours: 4,
    activityPhotos: [] as string[],
    impression: '',
    institutionName: '',
    phone: '',
    personInCharge: '',
    signImageUrl: '',
    nameEn: '',
  });

  // 프로필 정보 동기화
  useEffect(() => {
    if (profile) {
      setPlanForm(prev => ({
        ...prev,
        studentName: prev.studentName || profile.studentName || '',
        grade: prev.grade || profile.studentGrade || '',
        classNum: prev.classNum || profile.studentClass || '',
        studentNum: prev.studentNum || profile.studentNumber || '',
        parentSignature: prev.parentSignature || profile.parentSignature || '',
      }));
    }
  }, [profile]);

  // 원본 계획서 로드 (확인서 작성 모드)
  useEffect(() => {
    if (applyId) {
      setLoadingOriginal(true);
      getDocumentById(applyId).then(doc => {
        if (doc) {
          setOriginalPlanDoc(doc as ApprovalDoc);
          const vData = (doc.volunteerFormData || doc.parentFormData || {}) as any;
          setReportForm(prev => ({
            ...prev,
            institutionName: vData.institution || '',
            totalHours: vData.period?.totalHours || 4,
            nameEn: vData.nameEn || '',
          }));
          setActiveTab('report');
        }
        setLoadingOriginal(false);
      }).catch(err => {
        console.error(err);
        setLoadingOriginal(false);
      });
    }
  }, [applyId]);

  // 나의 신청 내역 조회
  const loadMyDocs = async () => {
    if (!user) return;
    setLoadingDocs(true);
    try {
      const docs = await getSentDocuments(user.uid, user.email || '');
      const volunteerDocs = docs.filter(d => 
        d.docType === 'volunteer' || 
        d.parentFormData?.type?.includes('volunteer') || 
        !!d.volunteerFormData
      );
      setMyDocs(volunteerDocs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadMyDocs();
  }, [user]);

  // 날짜 변경 시 요일 및 일수 자동 계산
  const handleDateChange = (start: string, end: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    let startDayOfWeek = '월';
    let endDayOfWeek = '월';
    let totalDays = 1;

    if (start) {
      const sDate = new Date(start);
      startDayOfWeek = days[sDate.getDay()];
    }
    if (end) {
      const eDate = new Date(end);
      endDayOfWeek = days[eDate.getDay()];
    }
    if (start && end) {
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      if (e >= s) {
        totalDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
      }
    }
    setPlanForm(prev => ({
      ...prev,
      startDate: start,
      endDate: end,
      startDayOfWeek,
      endDayOfWeek,
      totalDays,
    }));
  };

  // 사진 업로드 핸들러 (최대 2장, Base64)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).slice(0, 2).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setReportForm(prev => ({
          ...prev,
          activityPhotos: [...prev.activityPhotos, result].slice(0, 2),
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  // 계획서 제출
  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) {
      toast({ title: '오류', description: '로그인이 필요합니다.', variant: 'destructive' });
      return;
    }
    if (!planForm.startDate || !planForm.endDate) {
      toast({ title: '오류', description: '활동 기간을 입력해 주세요.', variant: 'destructive' });
      return;
    }
    if (!planForm.institution || !planForm.location || !planForm.content) {
      toast({ title: '오류', description: '대상 기관, 장소, 활동 내용을 모두 입력해 주세요.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      // 결재선 자동 생성: [업무 담당] -> [담당 부장] -> [교감(전결)]
      const approvers = await getVolunteerApprovers();

      const volunteerData: VolunteerFormData = {
        type: 'volunteer-plan',
        category: 'individual',
        studentName: planForm.studentName,
        grade: planForm.grade,
        classNum: planForm.classNum,
        studentNum: planForm.studentNum,
        gradeClassNumber: `${planForm.grade}-${planForm.classNum}-${planForm.studentNum}`,
        period: {
          startDate: planForm.startDate,
          endDate: planForm.endDate,
          startDayOfWeek: planForm.startDayOfWeek,
          endDayOfWeek: planForm.endDayOfWeek,
          totalDays: planForm.totalDays,
          totalHours: Number(planForm.totalHours) || 1,
        },
        institution: planForm.institution,
        location: planForm.location,
        content: planForm.content,
        studentSignature: planForm.studentSignature,
        parentSignature: planForm.parentSignature,
        submittedDate: format(new Date(), 'yyyy-MM-dd'),
      };

      const title = `[봉사활동 계획서] ${planForm.grade}학년 ${planForm.classNum}반 ${planForm.studentName} (${planForm.startDate} ~ ${planForm.endDate})`;

      await createDocument({
        title,
        content: planForm.content,
        docType: 'volunteer',
        publishStatus: '비공개',
        volunteerFormData: volunteerData,
        approvers,
        status: 'pending',
      }, user.uid, profile as any);

      toast({
        title: '신청 완료',
        description: '봉사활동 계획서가 학교 결재선에 상신되었습니다.',
      });

      await loadMyDocs();
      setActiveTab('history');
    } catch (error: any) {
      console.error(error);
      toast({
        title: '신청 실패',
        description: error.message || '계획서 제출 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 확인서 제출
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !originalPlanDoc) {
      toast({ title: '오류', description: '원본 계획서 정보가 없습니다.', variant: 'destructive' });
      return;
    }
    if (!reportForm.impression) {
      toast({ title: '오류', description: '활동 소감을 입력해 주세요.', variant: 'destructive' });
      return;
    }
    if (!reportForm.institutionName || !reportForm.personInCharge) {
      toast({ title: '오류', description: '확인 기관 정보(기관명, 담당자 성명)를 입력해 주세요.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const prevVData = (originalPlanDoc.volunteerFormData || originalPlanDoc.parentFormData || {}) as any;

      const reportPayload: Partial<VolunteerFormData> = {
        nameEn: reportForm.nameEn,
        period: {
          ...prevVData.period,
          startTime: reportForm.startTime,
          endTime: reportForm.endTime,
          totalHours: Number(reportForm.totalHours) || 1,
        },
        impression: reportForm.impression,
        activityPhotos: reportForm.activityPhotos,
        confirmationInstitution: {
          name: reportForm.institutionName,
          phone: reportForm.phone,
          personInCharge: reportForm.personInCharge,
          signImageUrl: reportForm.signImageUrl,
        },
      };

      const res = await submitVolunteerReport(originalPlanDoc.id, reportPayload, {
        uid: user.uid,
        name: profile?.name || prevVData.studentName,
        parentName: profile?.parentName,
        email: user.email || '',
        role: profile?.role || '학부모',
      });

      if (!res.success) {
        throw new Error(res.error || '확인서 제출 실패');
      }

      toast({
        title: '제출 완료',
        description: '봉사활동 확인서가 성공적으로 등록되었습니다.',
      });

      await loadMyDocs();
      setOriginalPlanDoc(null);
      router.push('/parents/volunteer?tab=history');
      setActiveTab('history');
    } catch (error: any) {
      console.error(error);
      toast({
        title: '제출 실패',
        description: error.message || '확인서 제출 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1440px] mx-auto py-0 sm:py-1 px-1 sm:px-3 lg:px-6 transition-all">
      {/* 상단 네비게이션 */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={() => router.push('/parents')}
            title="학부모 홈으로 이동"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1.5 font-bold text-base sm:text-lg text-foreground">
            <HeartHandshake className="w-5 h-5 text-primary shrink-0" />
            <span>학생 봉사활동</span>
          </div>
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground">
          제출 내역 <b className="text-primary">{myDocs.length}</b>건
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 h-10 mb-3 bg-muted/60 p-1">
          <TabsTrigger value="apply" className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            계획서 신청
          </TabsTrigger>
          <TabsTrigger value="report" className="text-xs sm:text-sm font-bold flex items-center gap-1.5" disabled={!originalPlanDoc}>
            <FileCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            확인서 제출 {originalPlanDoc && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>}
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs font-bold flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            나의 제출 내역
          </TabsTrigger>
        </TabsList>

        {/* ── 탭 1: 계획서 신청 (서식 1) ── */}
        <TabsContent value="apply">
          <Card className="border shadow-xs">
            <CardHeader className="p-3.5 sm:p-5 bg-muted/20 border-b">
              <div>
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-1.5 flex-wrap">
                  <HeartHandshake className="w-4 h-4 text-primary shrink-0" />
                  <span>봉사활동 계획서 작성 (개인)</span>
                  <Badge variant="outline" className="text-[10px] text-blue-700 bg-blue-50 border-blue-200 px-1.5 py-0 h-4 shrink-0 whitespace-nowrap">
                    서식 1
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  봉사활동 실시 7일 전까지 계획서를 제출해 주세요.
                </CardDescription>
              </div>
            </CardHeader>

            <form onSubmit={handleSubmitPlan}>
              <CardContent className="p-3 sm:p-5 space-y-3.5">
                {/* 1. 학생 인적사항 (라벨 인라인 1줄 배치) */}
                <div className="bg-muted/40 p-2.5 sm:p-3 rounded-xl border space-y-2">
                  <div className="text-xs font-bold text-slate-700">학생 인적사항 (호치민시한국국제학교)</div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="flex items-center gap-1 flex-[1.4] min-w-0">
                      <Label className="text-[11px] font-medium text-muted-foreground shrink-0 whitespace-nowrap">성명</Label>
                      <Input
                        value={planForm.studentName}
                        onChange={e => setPlanForm({ ...planForm, studentName: e.target.value })}
                        required
                        className="h-8 text-xs font-bold text-center px-1"
                        placeholder="성명"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <Label className="text-[11px] font-medium text-muted-foreground shrink-0 whitespace-nowrap">학년</Label>
                      <Input
                        value={planForm.grade}
                        onChange={e => setPlanForm({ ...planForm, grade: e.target.value })}
                        required
                        className="h-8 text-xs text-center px-1"
                        placeholder="학년"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <Label className="text-[11px] font-medium text-muted-foreground shrink-0 whitespace-nowrap">반</Label>
                      <Input
                        value={planForm.classNum}
                        onChange={e => setPlanForm({ ...planForm, classNum: e.target.value })}
                        required
                        className="h-8 text-xs text-center px-1"
                        placeholder="반"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <Label className="text-[11px] font-medium text-muted-foreground shrink-0 whitespace-nowrap">번호</Label>
                      <Input
                        value={planForm.studentNum}
                        onChange={e => setPlanForm({ ...planForm, studentNum: e.target.value })}
                        className="h-8 text-xs text-center px-1"
                        placeholder="번호"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. 활동 기간 및 총 계획 시간 (1줄 배치) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold flex items-center gap-1.5 whitespace-nowrap">
                      <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                      활동 기간 및 시간
                    </Label>
                    <span className="text-[10px] sm:text-[11px] text-red-600 font-medium whitespace-nowrap">
                      ※ 12월 24일 제출 마감
                    </span>
                  </div>

                  <div className="grid grid-cols-[1fr_1fr_68px] sm:grid-cols-3 gap-1.5 sm:gap-2.5">
                    <div>
                      <Label className="text-[10px] sm:text-[11px] text-muted-foreground whitespace-nowrap block">시작일</Label>
                      <Input
                        type="date"
                        value={planForm.startDate}
                        onChange={e => handleDateChange(e.target.value, planForm.endDate)}
                        required
                        className="h-8 text-[11px] sm:text-xs px-1 sm:px-2 mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] sm:text-[11px] text-muted-foreground whitespace-nowrap block">종료일</Label>
                      <Input
                        type="date"
                        value={planForm.endDate}
                        onChange={e => handleDateChange(planForm.startDate, e.target.value)}
                        required
                        className="h-8 text-[11px] sm:text-xs px-1 sm:px-2 mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] sm:text-[11px] text-muted-foreground whitespace-nowrap block text-center">총 시간(h)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={planForm.totalHours}
                        onChange={e => setPlanForm({ ...planForm, totalHours: Number(e.target.value) })}
                        required
                        className="h-8 text-xs font-bold text-center px-1 mt-0.5"
                      />
                    </div>
                  </div>

                  <div className="p-2 sm:p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-[10px] sm:text-[11px] text-amber-800 leading-snug">
                    선택 기간: <b>{planForm.startDate || 'YYYY-MM-DD'} ({planForm.startDayOfWeek}요일) ~ {planForm.endDate || 'YYYY-MM-DD'} ({planForm.endDayOfWeek}요일)</b> / 총 <b>{planForm.totalDays}</b>일간 (계획: <b>{planForm.totalHours}</b>시간)
                    <br />
                    <span className="text-red-600 font-semibold">※ 휴일, 공휴일 8시간 이내 인정 (학기 중 등교 시간은 미인정)</span>
                  </div>
                </div>

                {/* 3. 대상 기관 및 장소 (1줄 배치) */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <Label className="text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                      <Building className="w-3.5 h-3.5 text-primary shrink-0" />
                      대상 기관명
                    </Label>
                    <Input
                      value={planForm.institution}
                      onChange={e => setPlanForm({ ...planForm, institution: e.target.value })}
                      placeholder="예: 호치민 적십자사"
                      required
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      활동 장소
                    </Label>
                    <Input
                      value={planForm.location}
                      onChange={e => setPlanForm({ ...planForm, location: e.target.value })}
                      placeholder="예: 7군 센터 회관"
                      required
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>

                {/* 4. 활동 내용 */}
                <div>
                  <Label className="text-xs font-bold">활동 내용</Label>
                  <Textarea
                    value={planForm.content}
                    onChange={e => setPlanForm({ ...planForm, content: e.target.value })}
                    placeholder="봉사활동의 구체적인 계획 및 활동 내용을 자세히 기재해 주세요."
                    rows={3}
                    required
                    className="text-xs mt-1 leading-relaxed resize-none"
                  />
                </div>

                {/* 안내 문구 */}
                <div className="text-[11px] text-red-600 bg-red-50/50 p-2.5 rounded-lg border border-red-100 leading-normal">
                  ※ 봉사활동 실시 7일 전까지 계획서 제출, 봉사활동 실시 이후 7일 내 확인서 제출 시 학교생활기록부에 등재됩니다.
                </div>
              </CardContent>

              <CardFooter className="p-4 bg-muted/20 border-t flex justify-end gap-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-4 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
                  계획서 제출 및 결재 상신
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* ── 탭 2: 확인서 제출 (서식 2) ── */}
        <TabsContent value="report">
          {originalPlanDoc ? (
            <Card className="border shadow-xs">
              <CardHeader className="p-3.5 sm:p-5 bg-muted/20 border-b">
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-1.5 flex-wrap">
                    <FileCheck className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>봉사활동 확인서 작성 (Certificate of Volunteer Work)</span>
                    <Badge variant="outline" className="text-[10px] text-teal-700 bg-teal-50 border-teal-200 px-1.5 py-0 h-4 shrink-0 whitespace-nowrap">
                      서식 2
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    승인된 계획서를 바탕으로 실제 실시한 봉사활동 실적, 사진 및 확인 기관 정보를 등록합니다.
                  </CardDescription>
                </div>
              </CardHeader>

              <form onSubmit={handleSubmitReport}>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  {/* 연동된 원본 계획서 요약 정보 */}
                  <div className="bg-teal-50/60 border border-teal-200 p-3.5 rounded-xl space-y-1.5 text-xs">
                    <div className="font-bold text-teal-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-teal-600" />
                      연동된 승인 계획서: {originalPlanDoc.title}
                    </div>
                    <div className="text-slate-600 text-[11px]">
                      학생: <b>{originalPlanDoc.volunteerFormData?.studentName || originalPlanDoc.parentFormData?.studentName}</b> &nbsp;|&nbsp;
                      기관: <b>{originalPlanDoc.volunteerFormData?.institution || originalPlanDoc.parentFormData?.destination}</b> &nbsp;|&nbsp;
                      기간: <b>{originalPlanDoc.volunteerFormData?.period?.startDate} ~ {originalPlanDoc.volunteerFormData?.period?.endDate}</b>
                    </div>
                  </div>

                  {/* 영문 성명 */}
                  <div>
                    <Label className="text-xs font-bold">학생 영문 성명 (Name in English)</Label>
                    <Input
                      value={reportForm.nameEn}
                      onChange={e => setReportForm({ ...reportForm, nameEn: e.target.value })}
                      placeholder="예: HONG GILDONG"
                      className="h-8 text-xs mt-1"
                    />
                  </div>

                  {/* 실제 활동 시간대 (1줄 배치) */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                    <div>
                      <Label className="text-[10px] sm:text-[11px] text-muted-foreground whitespace-nowrap block">시작 시각</Label>
                      <Input
                        type="time"
                        value={reportForm.startTime}
                        onChange={e => setReportForm({ ...reportForm, startTime: e.target.value })}
                        required
                        className="h-8 text-[11px] sm:text-xs px-1 sm:px-2 mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] sm:text-[11px] text-muted-foreground whitespace-nowrap block">종료 시각</Label>
                      <Input
                        type="time"
                        value={reportForm.endTime}
                        onChange={e => setReportForm({ ...reportForm, endTime: e.target.value })}
                        required
                        className="h-8 text-[11px] sm:text-xs px-1 sm:px-2 mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] sm:text-[11px] text-muted-foreground whitespace-nowrap block text-center">인정 시간(h)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={reportForm.totalHours}
                        onChange={e => setReportForm({ ...reportForm, totalHours: Number(e.target.value) })}
                        required
                        className="h-8 text-xs font-bold text-center px-1 mt-0.5"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-red-600 font-medium">
                    ※ 봉사활동 실적은 시간 단위로 기록 권장 &nbsp;|&nbsp; ※ 2026년 12월 31일 봉사활동 확인서 제출 마감
                  </div>

                  {/* 활동 사진 업로드 (최대 2장) */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">활동 사진 첨부 (최대 2장)</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="text-xs h-9"
                    />
                    {reportForm.activityPhotos.length > 0 && (
                      <div className="flex gap-2.5 mt-2">
                        {reportForm.activityPhotos.map((src, i) => (
                          <div key={i} className="relative group border rounded-lg overflow-hidden">
                            <img src={src} alt="사진" className="h-20 w-32 object-cover" />
                            <button
                              type="button"
                              onClick={() => setReportForm(prev => ({ ...prev, activityPhotos: prev.activityPhotos.filter((_, idx) => idx !== i) }))}
                              className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center shadow-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 활동 소감 */}
                  <div>
                    <Label className="text-xs font-bold">활동소감 (Impression of activities)</Label>
                    <Textarea
                      value={reportForm.impression}
                      onChange={e => setReportForm({ ...reportForm, impression: e.target.value })}
                      placeholder="봉사활동을 통해 느끼고 배운 점을 솔직하게 작성해 주세요."
                      rows={4}
                      required
                      className="text-xs mt-1 leading-relaxed"
                    />
                  </div>

                  {/* 확인 기관 정보 (1줄 배치) */}
                  <div className="bg-muted/40 p-2.5 sm:p-3.5 rounded-xl border space-y-2">
                    <div className="text-xs font-bold text-slate-700">확인 기관 정보 (Confirmation of Institution)</div>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                      <div>
                        <Label className="text-[10px] sm:text-[11px] text-muted-foreground whitespace-nowrap block">기관명</Label>
                        <Input
                          value={reportForm.institutionName}
                          onChange={e => setReportForm({ ...reportForm, institutionName: e.target.value })}
                          placeholder="기관명"
                          required
                          className="h-8 text-[11px] sm:text-xs px-1 sm:px-2 mt-0.5"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] sm:text-[11px] text-muted-foreground whitespace-nowrap block">연락처</Label>
                        <Input
                          value={reportForm.phone}
                          onChange={e => setReportForm({ ...reportForm, phone: e.target.value })}
                          placeholder="전화번호"
                          className="h-8 text-[11px] sm:text-xs px-1 sm:px-2 mt-0.5"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] sm:text-[11px] text-muted-foreground whitespace-nowrap block">확인자 성명</Label>
                        <Input
                          value={reportForm.personInCharge}
                          onChange={e => setReportForm({ ...reportForm, personInCharge: e.target.value })}
                          placeholder="담당자"
                          required
                          className="h-8 text-[11px] sm:text-xs px-1 sm:px-2 mt-0.5"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-4 bg-muted/20 border-t flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => setActiveTab('history')}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-9 px-4 font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                    확인서 최종 제출
                  </Button>
                </CardFooter>
              </form>
            </Card>
          ) : (
            <Card className="p-8 text-center border shadow-xs">
              <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm mb-1">연동된 승인 계획서가 없습니다.</p>
              <p className="text-xs text-muted-foreground mb-4">
                '나의 제출 내역' 탭에서 승인 완료된 계획서의 [확인서 제출] 버튼을 눌러주세요.
              </p>
              <Button size="sm" onClick={() => setActiveTab('history')}>
                나의 제출 내역으로 이동
              </Button>
            </Card>
          )}
        </TabsContent>

        {/* ── 탭 3: 나의 제출 내역 ── */}
        <TabsContent value="history">
          {loadingDocs ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : myDocs.length === 0 ? (
            <Card className="p-8 text-center border shadow-xs">
              <History className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm mb-1">제출된 봉사활동 계획서가 없습니다.</p>
              <p className="text-xs text-muted-foreground mb-4">
                새 봉사활동 계획서를 작성해 보세요.
              </p>
              <Button size="sm" onClick={() => setActiveTab('apply')}>
                계획서 작성하기
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {myDocs.map(doc => {
                const vData = (doc.volunteerFormData || doc.parentFormData || {}) as any;
                const isApproved = doc.status === 'approved';
                const hasReport = Boolean(vData.reportSubmitted || (doc as any).reportSubmitted);
                const needsReport = isApproved && !hasReport;

                return (
                  <div
                    key={doc.id}
                    className="bg-card border rounded-xl p-4 shadow-xs hover:border-primary/40 transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-bold">
                          {vData.category === 'group' ? '단체 봉사' : '개인 봉사'}
                        </Badge>
                        <span className="text-xs font-bold text-foreground">
                          {vData.studentName ? `${vData.studentName} (${vData.gradeClassNumber || ''})` : doc.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {doc.status === 'submitted' && (
                          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-xs font-bold">
                            접수 완료 (수합 대기)
                          </Badge>
                        )}
                        {doc.status === 'pending' && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-bold">
                            결재 진행 중
                          </Badge>
                        )}
                        {doc.status === 'approved' && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs font-bold">
                            승인 완료
                          </Badge>
                        )}
                        {doc.status === 'rejected' && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs font-bold">
                            반려됨
                          </Badge>
                        )}

                        {needsReport && (
                          <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                            확인서 미제출
                          </Badge>
                        )}
                        {hasReport && (
                          <Badge className="bg-teal-600 text-white text-[10px] font-bold">
                            확인서 완료
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* 요약 정보 */}
                    <div className="bg-muted/30 p-2.5 rounded-lg text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Building className="w-3.5 h-3.5 shrink-0" />
                        <span>기관: <b>{vData.institution || '미입력'}</b> ({vData.location || ''})</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          기간: {vData.period?.startDate} ~ {vData.period?.endDate} (총 {vData.period?.totalDays || 1}일간, {vData.period?.totalHours || 0}시간)
                        </span>
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-2 pt-1 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-bold"
                        onClick={() => router.push(`/parents/documents/${doc.id}`)}
                      >
                        <FileText className="w-3.5 h-3.5 mr-1" />
                        문서 보기
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-bold"
                        onClick={() => setPreviewDoc(doc)}
                      >
                        <Printer className="w-3.5 h-3.5 mr-1" />
                        A4 인쇄
                      </Button>

                      {needsReport && (
                        <Button
                          size="sm"
                          className="h-8 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white ml-auto"
                          onClick={() => {
                            setOriginalPlanDoc(doc);
                            const prevV = (doc.volunteerFormData || doc.parentFormData || {}) as any;
                            setReportForm(prev => ({
                              ...prev,
                              institutionName: prevV.institution || '',
                              totalHours: prevV.period?.totalHours || 4,
                              nameEn: prevV.nameEn || '',
                            }));
                            setActiveTab('report');
                          }}
                        >
                          <FileCheck className="w-3.5 h-3.5 mr-1" />
                          확인서 제출하기
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 인쇄 미리보기 다이얼로그 */}
      <Dialog open={!!previewDoc} onOpenChange={open => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>봉사활동 서식 인쇄 미리보기</span>
              <Button size="sm" onClick={() => window.print()} className="h-8 text-xs font-bold">
                <Printer className="w-3.5 h-3.5 mr-1" />
                인쇄하기
              </Button>
            </DialogTitle>
            <DialogDescription className="sr-only">
              봉사활동 서식 인쇄 미리보기 화면입니다.
            </DialogDescription>
          </DialogHeader>
          {previewDoc && (
            <div className="border rounded bg-white p-2">
              <VolunteerDocumentPrint doc={previewDoc} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function VolunteerPortalPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <VolunteerPortalContent />
    </Suspense>
  );
}
