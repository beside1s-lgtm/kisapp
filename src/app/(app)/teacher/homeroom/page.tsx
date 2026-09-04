'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { 
  Users2, 
  CalendarOff, 
  Backpack, 
  CheckCircle2, 
  Loader2, 
  Send, 
  AlertCircle, 
  Calendar as CalendarIcon, 
  User, 
  Phone, 
  FileText,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getDocConfig, onOrgStructureUpdate } from '@/lib/services/settingsService';
import { onMasterStudentsUpdate } from '@/lib/services/masterStudentService';
import { getStudentFieldTripDays, getStudentAbsenceDays, createDocument, approveDocument } from '@/lib/services/documentService';
import { getApproversByGradeClass } from '@/lib/services/userService';
import { getWorkingDaysCount } from '@/lib/utils';
import type { MasterStudent } from '@/lib/types/masterStudent';
import type { OrgStructure, DocConfig } from '@/lib/types';

export default function TeacherHomeroomApplyPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [orgStructure, setOrgStructure] = useState<Partial<OrgStructure> | null>(null);
  const [allStudents, setAllStudents] = useState<MasterStudent[]>([]);
  const [docConfig, setDocConfig] = useState<Partial<DocConfig> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 문서 유형 (체험학습 신청서 vs 결석계)
  const [docCategory, setDocCategory] = useState<'field-trip' | 'absence'>('field-trip');

  // 선택된 학급 키 (예: "4-4")
  const [selectedClassKey, setSelectedClassKey] = useState<string>('');
  // 선택된 학생 ID
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // 신청일자/접수일자 (기본 오늘, 과거 일자 소급 수정 가능)
  const [applyDate, setApplyDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // 공통 학생 정보
  const [studentName, setStudentName] = useState('');
  const [gradeClassNumber, setGradeClassNumber] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentName, setParentName] = useState('');

  // 1. 체험학습 신청서 폼 상태
  const [ftStartDate, setFtStartDate] = useState('');
  const [ftEndDate, setFtEndDate] = useState('');
  const [ftTotalDays, setFtTotalDays] = useState<number>(1);
  const [ftType, setFtType] = useState('가족동반여행');
  const [ftDestination, setFtDestination] = useState('');
  const [ftCompanionName, setFtCompanionName] = useState('');
  const [ftCompanionRelation, setFtCompanionRelation] = useState('부모');
  const [ftPurpose, setFtPurpose] = useState('');
  const [ftDetailedPlan, setFtDetailedPlan] = useState('');

  // 2. 결석계 폼 상태
  const [absStartDate, setAbsStartDate] = useState('');
  const [absEndDate, setAbsEndDate] = useState('');
  const [absTotalDays, setAbsTotalDays] = useState<number>(1);
  const [absType, setAbsType] = useState<'병결' | '미인정' | '기타' | '출석인정'>('병결');
  const [absReason, setAbsReason] = useState('');
  const [teacherConfirmMethod, setTeacherConfirmMethod] = useState<'전화/문자' | '학부모 내교' | '가정방문' | '기타'>('전화/문자');

  // 누적 통계
  const [accumulatedFtDays, setAccumulatedFtDays] = useState<number>(0);
  const [accumulatedAbsDays, setAccumulatedAbsDays] = useState<number>(0);

  // 학사일정 (공휴일 자동 제외)
  const academicCalConfig = docConfig?.academicCalendar;
  const semesterEvents = academicCalConfig?.events || [];

  // 연간 누계 자동 계산 기능 활성화 여부
  const enableCumulative = docConfig?.enableCumulativeStats !== false;

  // 데이터 로드
  useEffect(() => {
    getDocConfig().then(cfg => setDocConfig(cfg));
    const unsubOrg = onOrgStructureUpdate(org => setOrgStructure(org));
    const unsubStudents = onMasterStudentsUpdate(students => {
      setAllStudents(students || []);
      setLoading(false);
    });

    return () => {
      unsubOrg();
      unsubStudents();
    };
  }, []);

  // 현재 로그인한 교사가 담당하는 반 목록 계산
  const myHomeroomKeys = useMemo(() => {
    if (!user?.email || !orgStructure?.homerooms) return [];
    const normalizedEmail = user.email.trim().toLowerCase();
    const keys: string[] = [];

    Object.entries(orgStructure.homerooms).forEach(([classKey, teacherEmail]) => {
      if (teacherEmail && teacherEmail.trim().toLowerCase() === normalizedEmail) {
        keys.push(classKey);
      }
    });

    return keys;
  }, [user?.email, orgStructure]);

  // 관리자 여부 확인 (관리자라면 전체 반 선택 가능)
  const isAdmin = Boolean(profile?.isAdmin || profile?.role === '관리자' || profile?.role === 'admin');

  // 선택 가능한 반 목록
  const availableClassKeys = useMemo(() => {
    if (isAdmin) {
      const set = new Set<string>();
      if (orgStructure?.homerooms) {
        Object.keys(orgStructure.homerooms).forEach(k => set.add(k));
      }
      allStudents.forEach(s => {
        if (s.grade && s.classNum) set.add(`${s.grade}-${s.classNum}`);
      });
      return Array.from(set).sort((a, b) => {
        const [ga, ca] = a.split('-').map(Number);
        const [gb, cb] = b.split('-').map(Number);
        return ga !== gb ? ga - gb : ca - cb;
      });
    }
    return myHomeroomKeys;
  }, [isAdmin, myHomeroomKeys, orgStructure, allStudents]);

  // 기본 반 자동 지정
  useEffect(() => {
    if (!selectedClassKey && availableClassKeys.length > 0) {
      setSelectedClassKey(availableClassKeys[0]);
    }
  }, [availableClassKeys, selectedClassKey]);

  // 선택된 반에 속한 학생 목록
  const classStudents = useMemo(() => {
    if (!selectedClassKey) return [];
    const [gradeStr, classStr] = selectedClassKey.split('-');
    const g = parseInt(gradeStr, 10);
    const c = parseInt(classStr, 10);

    return allStudents.filter(s => {
      const sg = parseInt(String(s.grade), 10);
      const sc = parseInt(String(s.classNum), 10);
      return sg === g && sc === c && s.status !== 'graduated' && s.status !== 'transferred';
    }).sort((a, b) => (Number(a.studentNum) || 0) - (Number(b.studentNum) || 0));
  }, [selectedClassKey, allStudents]);

  // 학생 선택 시 자동 입력 처리
  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    const s = classStudents.find(item => item.id === studentId);
    if (s) {
      setStudentName(s.name || '');
      const gcn = `${s.grade}-${s.classNum}-${s.studentNum || 1}`;
      setGradeClassNumber(gcn);
      setParentPhone(s.emergencyContact || s.contact || '');
      setParentName(s.parentName || `${s.name} 학부모`);
      setFtCompanionName(s.parentName || `${s.name} 보호자`);

      // 누적 일수 로드
      const currentYearStr = new Date().getFullYear().toString();
      getStudentFieldTripDays(s.name, gcn, currentYearStr).then(days => setAccumulatedFtDays(days));
      getStudentAbsenceDays(s.name, gcn, currentYearStr).then(days => setAccumulatedAbsDays(days));
    }
  };

  // 체험학습 총 일수 자동 계산 (공휴일/휴업일 제외)
  useEffect(() => {
    if (ftStartDate && ftEndDate) {
      const days = getWorkingDaysCount(ftStartDate, ftEndDate, semesterEvents);
      setFtTotalDays(Math.max(days, 1));
    }
  }, [ftStartDate, ftEndDate, semesterEvents]);

  // 결석계 총 일수 자동 계산 (공휴일/휴업일 제외)
  useEffect(() => {
    if (absStartDate && absEndDate) {
      const days = getWorkingDaysCount(absStartDate, absEndDate, semesterEvents);
      setAbsTotalDays(Math.max(days, 1));
    }
  }, [absStartDate, absEndDate, semesterEvents]);

  // 제출 및 바로 결재 처리
  const handleSubmitAndApprove = async () => {
    if (!user || !profile) {
      toast({ variant: 'destructive', title: '로그인 필요', description: '교직원 로그인이 필요합니다.' });
      return;
    }

    if (!selectedStudentId || !studentName) {
      toast({ variant: 'destructive', title: '학생 선택 필요', description: '대리 작성할 학생을 선택해 주세요.' });
      return;
    }

    if (docCategory === 'field-trip') {
      if (!ftStartDate || !ftEndDate) {
        toast({ variant: 'destructive', title: '기간 입력 필요', description: '체험학습 시작일과 종료일을 입력해 주세요.' });
        return;
      }
      if (!ftDestination.trim()) {
        toast({ variant: 'destructive', title: '목적지 입력 필요', description: '방문 장소를 입력해 주세요.' });
        return;
      }
    } else {
      if (!absStartDate || !absEndDate) {
        toast({ variant: 'destructive', title: '기간 입력 필요', description: '결석 시작일과 종료일을 입력해 주세요.' });
        return;
      }
      if (!absReason.trim()) {
        toast({ variant: 'destructive', title: '사유 입력 필요', description: '결석 사유를 입력해 주세요.' });
        return;
      }
    }

    if (!profile.signature) {
      toast({ 
        variant: 'destructive', 
        title: '서명 필요', 
        description: '교사 서명이 등록되어 있지 않습니다. 프로필에서 서명을 먼저 등록해 주세요.' 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const [gStr, cStr] = selectedClassKey.split('-');
      // 학급별 결재선 획득 (담임, 부장, 교감, 교장)
      const approvers = await getApproversByGradeClass(gStr, cStr);
      
      const isFieldTrip = docCategory === 'field-trip';
      const docTitle = isFieldTrip 
        ? `[대리작성] 교외체험학습 신청서 (${studentName}, ${gradeClassNumber})`
        : `[대리작성] 결석계 (${studentName}, ${gradeClassNumber})`;

      const parentFormData: any = isFieldTrip ? {
        type: 'field-trip',
        studentName,
        gradeClassNumber,
        phone: parentPhone,
        tripPeriod: {
          startDate: ftStartDate,
          endDate: ftEndDate,
          totalDays: ftTotalDays
        },
        cumulativeDays: accumulatedFtDays,
        tripType: ftType,
        destination: ftDestination,
        companionName: ftCompanionName,
        companionRelation: ftCompanionRelation,
        purpose: ftPurpose || '가족 체험학습 및 문화 탐방',
        detailedPlan: ftDetailedPlan || '일자별 현지 문화 체험 및 학습 활동',
        applyDate: applyDate, // 소급/수정 지정된 신청일자
        isProxyByTeacher: true,
        proxyTeacherName: profile.name,
        proxyTeacherEmail: profile.email
      } : {
        type: 'absence',
        studentName,
        gradeClassNumber,
        absencePeriod: {
          startDate: absStartDate,
          endDate: absEndDate,
          totalDays: absTotalDays
        },
        absenceType: absType,
        absenceReason: absReason,
        teacherConfirmMethod,
        teacherConfirmDate: applyDate,
        applyDate: applyDate, // 소급/수정 지정된 신청일자
        isProxyByTeacher: true,
        proxyTeacherName: profile.name,
        proxyTeacherEmail: profile.email
      };

      // 1. 기안문서 생성 (담임 교사가 작성)
      const createRes = await createDocument({
        title: docTitle,
        content: `<p>담임 교사(${profile.name})가 학생(${studentName})을 대리하여 작성한 신청서입니다.</p>`,
        docType: 'parent',
        category: 'general',
        approvers: approvers,
        attachments: [],
        parentFormData,
        publishStatus: '비공개'
      }, user.uid, profile);

      if (!createRes.success || !createRes.docId) {
        throw new Error(createRes.error || '문서 생성에 실패했습니다.');
      }

      const docId = createRes.docId;

      // 2. 담임 본인 결재 즉시 완료 처리
      const updateData: any = {
        applyDate: applyDate
      };
      if (!isFieldTrip) {
        updateData.absenceType = absType;
        updateData.teacherConfirmMethod = teacherConfirmMethod;
        updateData.teacherConfirmDate = applyDate;
      }

      const approveRes = await approveDocument(docId, profile, updateData, applyDate);
      if (!approveRes.success) {
        throw new Error(approveRes.error || '담임 서명 처리에 실패했습니다.');
      }

      toast({
        title: '작성 및 결재 완료!',
        description: `${studentName} 학생의 신청서가 성공적으로 작성되었으며, 담임 서명이 완료되어 다음 결재자에게 상신되었습니다.`
      });

      // 문서 상세 보기로 이동
      router.push(`/documents/${docId}`);
    } catch (err: any) {
      console.error('대리 작성 오류:', err);
      toast({
        variant: 'destructive',
        title: '대리 작성 실패',
        description: err.message || '처리 중 오류가 발생했습니다.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 담임도 아니고 관리자도 아닌 경우 안내
  if (availableClassKeys.length === 0 && !isAdmin) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
        <h2 className="text-lg font-bold text-amber-900">담임 교사 권한이 없습니다</h2>
        <p className="text-xs text-amber-700 leading-relaxed">
          현재 로그인하신 계정({user?.email})으로 배정된 담임 학급이 조직도에 등록되어 있지 않습니다.
          조직도 설정을 확인하시거나 관리자에게 문의해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 font-body">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Users2 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">
              담임 업무 · 출결/체험학습 대리 작성
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            학부모 앱 사용이 어려운 가정을 위해 담임 교사가 반 학생의 결석계 및 교외체험학습 신청서를 대신 작성하고 결재를 진행합니다.
          </p>
        </div>
      </div>

      {/* 1. 학급 및 학생 선택 카드 */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <span>1. 대상 학생 선택</span>
          </CardTitle>
          <CardDescription className="text-xs">
            담당 학급을 선택하고 문서를 작성할 학생을 선택해 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 학급 선택 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">담당 학급</Label>
              <Select value={selectedClassKey} onValueChange={(val) => { setSelectedClassKey(val); setSelectedStudentId(''); }}>
                <SelectTrigger className="h-10 text-xs font-semibold bg-white">
                  <SelectValue placeholder="학급 선택" />
                </SelectTrigger>
                <SelectContent>
                  {availableClassKeys.map(key => {
                    const [g, c] = key.split('-');
                    return (
                      <SelectItem key={key} value={key} className="text-xs font-medium">
                        {g}학년 {c}반 {myHomeroomKeys.includes(key) ? '(내 학급)' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* 학생 선택 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">학생 선택</Label>
              <Select value={selectedStudentId} onValueChange={handleSelectStudent}>
                <SelectTrigger className="h-10 text-xs font-semibold bg-white">
                  <SelectValue placeholder={classStudents.length === 0 ? "학급 학생 없음" : "학생을 선택하세요"} />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {classStudents.map(st => (
                    <SelectItem key={st.id} value={st.id} className="text-xs">
                      {st.studentNum ? `${st.studentNum}번 ` : ''}{st.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 선택 학생 상세 요약 */}
          {selectedStudentId && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-600 text-white font-bold text-[11px] px-2 py-0.5">
                  선택됨
                </Badge>
                <span className="font-bold text-indigo-950 text-sm">{studentName}</span>
                <span className="text-indigo-800">({gradeClassNumber})</span>
                {parentPhone && <span className="text-slate-600 text-xs">· 연락처: {parentPhone}</span>}
              </div>

              {enableCumulative && (
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-700">
                  <span>체험학습 누적: <strong className="text-indigo-700 font-bold">{accumulatedFtDays}일</strong></span>
                  <span>결석 누적: <strong className="text-rose-600 font-bold">{accumulatedAbsDays}일</strong></span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. 결재일자/신청일자 지정 카드 */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            <span>2. 결재일자 및 신청일자 지정</span>
          </CardTitle>
          <CardDescription className="text-xs">
            종이 신청서 접수일이나 사전 전화 통보일 등 원하시는 일자로 소급하여 결재일자를 지정할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-1.5">
            <Label className="text-xs font-bold text-slate-800">결재일 (신청서 제출일자)</Label>
            <Input 
              type="date" 
              value={applyDate} 
              onChange={(e) => setApplyDate(e.target.value)}
              className="h-10 text-xs font-semibold bg-white"
            />
            <span className="text-[11px] text-muted-foreground block">
              * 지정된 날짜가 신청서 하단 제출일과 담임 승인일자로 기록됩니다.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. 문서 서식 작성 카드 (탭) */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-2">
          <Tabs value={docCategory} onValueChange={(val) => setDocCategory(val as any)} className="w-full">
            <TabsList className="grid grid-cols-2 w-full bg-slate-100 p-1 rounded-xl">
              <TabsTrigger value="field-trip" className="text-xs font-bold py-2 gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xs">
                <Backpack className="w-4 h-4" />
                <span>교외체험학습 신청서</span>
              </TabsTrigger>
              <TabsTrigger value="absence" className="text-xs font-bold py-2 gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xs">
                <CalendarOff className="w-4 h-4" />
                <span>결석계</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* 3-A. 체험학습 신청서 폼 */}
          {docCategory === 'field-trip' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">시작일 <span className="text-red-500">*</span></Label>
                  <Input type="date" value={ftStartDate} onChange={(e) => setFtStartDate(e.target.value)} className="text-xs bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">종료일 <span className="text-red-500">*</span></Label>
                  <Input type="date" value={ftEndDate} onChange={(e) => setFtEndDate(e.target.value)} className="text-xs bg-white" />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">신청 수업일수 (공휴일/주말 자동 제외)</span>
                <span className="font-bold text-indigo-700 text-sm">{ftTotalDays} 일간</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">학습 형태</Label>
                  <Select value={ftType} onValueChange={setFtType}>
                    <SelectTrigger className="text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="가족동반여행" className="text-xs">가족동반여행</SelectItem>
                      <SelectItem value="친인척 방문" className="text-xs">친인척 방문</SelectItem>
                      <SelectItem value="답사·견학 활동" className="text-xs">답사·견학 활동</SelectItem>
                      <SelectItem value="체험활동" className="text-xs">체험활동</SelectItem>
                      <SelectItem value="기타" className="text-xs">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">방문 장소 (국가/도시) <span className="text-red-500">*</span></Label>
                  <Input 
                    placeholder="예: 베트남 다낭, 한국 서울" 
                    value={ftDestination} 
                    onChange={(e) => setFtDestination(e.target.value)} 
                    className="text-xs bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">동행 보호자</Label>
                  <Input 
                    placeholder="보호자 성명" 
                    value={ftCompanionName} 
                    onChange={(e) => setFtCompanionName(e.target.value)} 
                    className="text-xs bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">학생과의 관계</Label>
                  <Input 
                    placeholder="예: 부, 모" 
                    value={ftCompanionRelation} 
                    onChange={(e) => setFtCompanionRelation(e.target.value)} 
                    className="text-xs bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">체험학습 목적</Label>
                <Input 
                  placeholder="예: 현지 문화 탐방 및 가족 유대 강화" 
                  value={ftPurpose} 
                  onChange={(e) => setFtPurpose(e.target.value)} 
                  className="text-xs bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">구체적 계획</Label>
                <Textarea 
                  placeholder="예: 1일차 유적지 탐방, 2일차 자연 생태 체험 등" 
                  value={ftDetailedPlan} 
                  onChange={(e) => setFtDetailedPlan(e.target.value)} 
                  rows={3}
                  className="text-xs bg-white resize-none"
                />
              </div>
            </div>
          )}

          {/* 3-B. 결석계 폼 */}
          {docCategory === 'absence' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">결석 시작일 <span className="text-red-500">*</span></Label>
                  <Input type="date" value={absStartDate} onChange={(e) => setAbsStartDate(e.target.value)} className="text-xs bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">결석 종료일 <span className="text-red-500">*</span></Label>
                  <Input type="date" value={absEndDate} onChange={(e) => setAbsEndDate(e.target.value)} className="text-xs bg-white" />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">결석 수업일수 (공휴일/주말 자동 제외)</span>
                <span className="font-bold text-rose-600 text-sm">{absTotalDays} 일간</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">결석 종류</Label>
                  <Select value={absType} onValueChange={(val) => setAbsType(val as any)}>
                    <SelectTrigger className="text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="병결" className="text-xs">병결</SelectItem>
                      <SelectItem value="미인정" className="text-xs">미인정</SelectItem>
                      <SelectItem value="기타" className="text-xs">기타</SelectItem>
                      <SelectItem value="출석인정" className="text-xs">출석인정</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">담임 확인 방법</Label>
                  <Select value={teacherConfirmMethod} onValueChange={(val) => setTeacherConfirmMethod(val as any)}>
                    <SelectTrigger className="text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="전화/문자" className="text-xs">전화/문자</SelectItem>
                      <SelectItem value="학부모 내교" className="text-xs">학부모 내교</SelectItem>
                      <SelectItem value="가정방문" className="text-xs">가정방문</SelectItem>
                      <SelectItem value="기타" className="text-xs">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">결석 사유 <span className="text-red-500">*</span></Label>
                <Textarea 
                  placeholder="예: 감기 몸살 및 발열로 인한 가료 요양" 
                  value={absReason} 
                  onChange={(e) => setAbsReason(e.target.value)} 
                  rows={3}
                  className="text-xs bg-white resize-none"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 제출 액션 버튼 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <p className="text-xs text-muted-foreground">
          * '작성 및 담임 결재 완료'를 누르면 문서가 생성되고 담임 서명이 즉시 완료되어 다음 결재자에게 상신됩니다.
        </p>
        <Button 
          size="lg" 
          onClick={handleSubmitAndApprove} 
          disabled={isSubmitting || !selectedStudentId}
          className="w-full sm:w-auto font-bold px-6 h-11 gap-2 bg-primary shadow-md hover:shadow-lg transition-all"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              처리 중...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              작성 및 담임 결재 완료
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
