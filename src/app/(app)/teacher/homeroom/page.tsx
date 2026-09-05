'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ArrowRight,
  Edit3,
  Camera,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getDocConfig, onOrgStructureUpdate } from '@/lib/services/settingsService';
import { onMasterStudentsUpdate, updateMasterStudent } from '@/lib/services/masterStudentService';
import { getStudentFieldTripDays, getStudentAbsenceDays, createDocument, approveDocument } from '@/lib/services/documentService';
import { getApproversByGradeClass } from '@/lib/services/userService';
import { getWorkingDaysCount } from '@/lib/utils';
import { resizeStudentPhoto } from '@/lib/imageResize';
import { BatchPhotoModal } from '@/app/(app)/admin/students/batch-photo-modal';
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

  // 상단 메인 탭: 'proxy' (출결/체험학습 대리 작성) | 'student-info' (학생 정보 확인)
  const [activeMainTab, setActiveMainTab] = useState<'proxy' | 'student-info'>('proxy');
  const [isBatchPhotoOpen, setIsBatchPhotoOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editStudentForm, setEditStudentForm] = useState<Partial<MasterStudent>>({});
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  const handleStartEditStudent = (student: MasterStudent) => {
    setEditStudentForm({
      ...student,
      studentId: student.studentId || student.id,
      name: student.nameKo || student.name || '',
      studentEmail: student.studentEmail || '',
      grade: String(student.grade || '1'),
      classNum: String(student.classNum || '1'),
      studentNum: String(student.studentNum || ''),
      gender: student.gender || 'Male',
      contact: student.contact || '',
      address: student.address || '',
      photoUrl: student.photoUrl || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleEditPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resizedBase64 = await resizeStudentPhoto(file);
      setEditStudentForm(prev => ({ ...prev, photoUrl: resizedBase64 }));
      toast({ title: '사진 규격 최적화 완료', description: '가로세로 2cm 규격으로 자동 압축되었습니다.' });
    } catch (err) {
      console.error(err);
      toast({ title: '사진 변환 오류', description: '사진 변환 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  const handleSaveEditStudent = async () => {
    if (!editStudentForm.studentId) return;
    try {
      await updateMasterStudent(editStudentForm.studentId, {
        name: editStudentForm.name,
        grade: String(editStudentForm.grade || '1'),
        classNum: String(editStudentForm.classNum || '1'),
        studentNum: String(editStudentForm.studentNum || ''),
        gender: editStudentForm.gender,
        contact: editStudentForm.contact,
        address: editStudentForm.address,
        photoUrl: editStudentForm.photoUrl
      });
      setIsEditDialogOpen(false);
      toast({ title: '학생 정보 수정 완료', description: '학생 정보가 성공적으로 반영되었습니다.' });
    } catch (err) {
      console.error(err);
      toast({ title: '수정 실패', description: '학생 정보 수정 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

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
    <div className="w-full p-4 md:p-6 space-y-6 font-body">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Users2 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">
              담임 교사 업무 관리소
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            담당 학급 학생들의 계정 정보를 확인하고 사진을 관리하며, 출결 및 체험학습 신청을 대리 작성합니다.
          </p>
        </div>
      </div>

      {/* 상단 탭 네비게이션 */}
      <Tabs value={activeMainTab} onValueChange={(val: any) => setActiveMainTab(val)} className="w-full space-y-6">
        <TabsList className="grid grid-cols-2 w-full max-w-md bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="proxy" className="text-xs font-bold py-2">
            출결/체험학습 대리 작성
          </TabsTrigger>
          <TabsTrigger value="student-info" className="text-xs font-bold py-2">
            학생 정보 확인 ({classStudents.length}명)
          </TabsTrigger>
        </TabsList>

        {/* 탭 1: 출결/체험학습 대리 작성 */}
        <TabsContent value="proxy" className="space-y-6">
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
                  {classStudents.map(st => {
                    const valKey = st.studentId || st.id || st.studentEmail;
                    return (
                      <SelectItem key={valKey} value={valKey} className="text-xs">
                        {st.studentNum ? `${st.studentNum}번 ` : ''}{st.name}
                      </SelectItem>
                    );
                  })}
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
        </TabsContent>

        {/* 탭 2: 학생 정보 확인 (학급 학생 전용 뷰) */}
        <TabsContent value="student-info" className="space-y-6">
          <Card className="rounded-2xl border-slate-200/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span>{selectedClassKey ? `${selectedClassKey.replace('-', '학년 ')}반` : ''} 학생 계정 명단 ({classStudents.length}명)</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    담임 학급 학생들의 계정, 방과후 강좌, 스쿨버스 노선 정보를 확인하고 사진을 등록합니다.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {availableClassKeys.length > 1 && (
                    <div className="flex items-center gap-1.5 mr-2">
                      <span className="text-xs font-bold text-slate-600">학급 선택:</span>
                      <Select value={selectedClassKey} onValueChange={setSelectedClassKey}>
                        <SelectTrigger className="h-8 text-xs w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableClassKeys.map(k => (
                            <SelectItem key={k} value={k} className="text-xs">
                              {k.replace('-', '학년 ')}반
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button 
                    type="button"
                    size="sm" 
                    onClick={() => setIsBatchPhotoOpen(true)}
                    className="h-8 text-xs px-2.5 font-bold whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1" /> 사진 일괄 등록
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[80px] whitespace-nowrap font-bold text-slate-700">번호</TableHead>
                      <TableHead className="whitespace-nowrap font-bold text-slate-700">학생 이름</TableHead>
                      <TableHead className="whitespace-nowrap font-bold text-slate-700">학생 계정 이메일</TableHead>
                      <TableHead className="whitespace-nowrap font-bold text-slate-700">보호자 연락처</TableHead>
                      <TableHead className="whitespace-nowrap font-bold text-slate-700">방과후 수강 현황</TableHead>
                      <TableHead className="whitespace-nowrap font-bold text-slate-700">스쿨버스 노선</TableHead>
                      <TableHead className="text-right whitespace-nowrap font-bold text-slate-700">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classStudents.length > 0 ? (
                      classStudents.map(student => (
                        <TableRow key={student.studentId || student.id} className="hover:bg-slate-50/80 transition-colors">
                          <TableCell className="whitespace-nowrap font-medium text-slate-700">
                            {student.studentNum ? `${student.studentNum}번` : '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="w-9 h-9 rounded-xl border border-slate-200 shrink-0 shadow-2xs bg-white">
                                {student.photoUrl ? (
                                  <AvatarImage src={student.photoUrl} alt={student.name} className="object-cover rounded-xl" />
                                ) : (
                                  <AvatarFallback className="bg-indigo-50 text-indigo-700 font-extrabold text-xs rounded-xl">
                                    {(student.name || '학생').slice(0, 2)}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="flex flex-col items-start leading-tight">
                                <span className="font-extrabold text-slate-900">{student.name}</span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {student.gender === 'Female' ? '여' : '남'}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs text-slate-600">
                            {student.studentEmail}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-slate-600">
                            {student.contact || '-'}
                          </TableCell>
                          <TableCell className="whitespace-normal min-w-[140px] max-w-[220px]">
                            {student.afterschoolSummary?.enrolledCourses && student.afterschoolSummary.enrolledCourses.length > 0 ? (
                              <div className="flex flex-col gap-1 py-1">
                                {student.afterschoolSummary.enrolledCourses.map((c, idx) => (
                                  <Badge key={idx} variant="secondary" className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold py-0.5 px-2 w-fit">
                                    <span className="font-bold text-emerald-950 mr-1">[{c.days.join(',')}]</span>
                                    <span>{(c.title || '').slice(0, 5)}{(c.title || '').length > 5 ? '..' : ''}</span>
                                  </Badge>
                                ))}
                              </div>
                            ) : student.afterschoolSummary?.enrolledCourseTitles && student.afterschoolSummary.enrolledCourseTitles.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {student.afterschoolSummary.enrolledCourseTitles.map((t, idx) => (
                                  <Badge key={idx} variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] w-fit">
                                    {(t || '').slice(0, 5)}{(t || '').length > 5 ? '..' : ''}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic whitespace-nowrap">미수강</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-normal min-w-[130px] max-w-[200px]">
                            {(() => {
                              const bSum = student.busSummary;
                              const afterschoolBuses = bSum?.afterSchoolBuses || [];
                              const hasRegularBus = !!bSum?.regularBusName;
                              const hasAfterschoolBuses = afterschoolBuses.length > 0;
                              const hasEnrolledCourses = (student.afterschoolSummary?.enrolledCourses?.length ?? 0) > 0;

                              if (!hasRegularBus && !hasAfterschoolBuses && !bSum?.assignedBusName) {
                                return <span className="text-xs text-slate-400 italic whitespace-nowrap">자가 귀가</span>;
                              }

                              return (
                                <div className="flex flex-col gap-1 py-1">
                                  {hasRegularBus && (
                                    <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 text-[11px] font-semibold py-0.5 px-2 w-fit">
                                      <span className="font-bold text-sky-950 mr-1">
                                        {hasEnrolledCourses && bSum?.regularBusDays && bSum.regularBusDays.length > 0
                                          ? `[${bSum.regularBusDays.join(',')}]`
                                          : `[정규]`}
                                      </span>
                                      <span>{bSum.regularBusName}</span>
                                    </Badge>
                                  )}
                                  {afterschoolBuses.map((asb, idx) => (
                                    <Badge key={idx} variant="outline" className="bg-amber-50 text-amber-900 border-amber-200 text-[11px] font-semibold py-0.5 px-2 w-fit">
                                      <span className="font-bold text-amber-950 mr-1">[{asb.day}]</span>
                                      <span>{asb.busName}</span>
                                    </Badge>
                                  ))}
                                  {!hasRegularBus && !hasAfterschoolBuses && bSum?.assignedBusName && (
                                    <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[11px] font-bold w-fit">
                                      {bSum.assignedBusName}
                                    </Badge>
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button 
                              type="button"
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-xs px-2.5 text-indigo-700 hover:bg-indigo-50 border-indigo-200 cursor-pointer font-medium"
                              onClick={() => handleStartEditStudent(student)}
                            >
                              <Edit3 className="h-3.5 w-3.5 mr-1" /> 정보 수정
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-28 text-center text-slate-500 whitespace-nowrap">
                          담당 학급에 등록된 학생이 없습니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 사진 일괄 등록 모달 */}
      <BatchPhotoModal 
        isOpen={isBatchPhotoOpen}
        onClose={() => setIsBatchPhotoOpen(false)}
        students={allStudents}
      />

      {/* 개별 학생 정보 및 사진 수정 모달 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[560px] w-[95vw] max-h-[88vh] overflow-y-auto p-6 rounded-2xl">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-indigo-600 shrink-0" /> 학급 학생 정보 및 사진 수정
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {editStudentForm.studentEmail} 학생의 프로필 사진 및 기본 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* 사진 등록 섹션 (가로세로 2cm 규격) */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-slate-800 text-xs">학생 프로필 사진 (가로세로 2cm 규격)</span>
                <Badge variant="outline" className="text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700 font-medium px-2 py-0.5">
                  PC 최적 160x160 자동 압축
                </Badge>
              </div>
              <div className="flex items-center gap-4">
                <Avatar className="rounded-2xl border-2 border-indigo-200 shadow-2xs shrink-0 bg-white" style={{ width: '2cm', height: '2cm' }}>
                  {editStudentForm.photoUrl ? (
                    <AvatarImage src={editStudentForm.photoUrl} alt={editStudentForm.name || '학생'} className="object-cover rounded-2xl" />
                  ) : (
                    <AvatarFallback className="bg-indigo-50 text-indigo-700 font-bold text-xs rounded-2xl">
                      사진 없음
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="file"
                      ref={editPhotoInputRef}
                      onChange={handleEditPhotoChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => editPhotoInputRef.current?.click()}
                      className="h-8 text-xs px-3 bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold cursor-pointer shadow-2xs"
                    >
                      <Camera className="w-3.5 h-3.5 mr-1" />
                      사진 업로드
                    </Button>
                    {editStudentForm.photoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditStudentForm(prev => ({ ...prev, photoUrl: '' }))}
                        className="h-8 text-xs px-2.5 text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        사진 삭제
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    사진을 선택하면 증명사진용 2cm 정사각형으로 자동 압축되어 즉시 적용됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 인적사항 입력 필드 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">학생 이름</Label>
                <Input
                  value={editStudentForm.name || ''}
                  onChange={(e) => setEditStudentForm(prev => ({ ...prev, name: e.target.value }))}
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">출석 번호</Label>
                <Input
                  value={editStudentForm.studentNum || ''}
                  onChange={(e) => setEditStudentForm(prev => ({ ...prev, studentNum: e.target.value }))}
                  placeholder="예: 5"
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">보호자 연락처</Label>
                <Input
                  value={editStudentForm.contact || ''}
                  onChange={(e) => setEditStudentForm(prev => ({ ...prev, contact: e.target.value }))}
                  placeholder="010-0000-0000"
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">성별</Label>
                <Select
                  value={editStudentForm.gender || 'Male'}
                  onValueChange={(val: any) => setEditStudentForm(prev => ({ ...prev, gender: val }))}
                >
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">남학생</SelectItem>
                    <SelectItem value="Female">여학생</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">거주지 주소 / 스쿨버스 정류장</Label>
              <Input
                value={editStudentForm.address || ''}
                onChange={(e) => setEditStudentForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="예: 현대아파트 앞"
                className="h-8 text-xs bg-white"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditDialogOpen(false)}
              className="h-8 text-xs font-medium"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveEditStudent}
              className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              저장 완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
