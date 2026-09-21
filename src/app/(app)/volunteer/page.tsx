'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { 
  createDocument, 
  getDocumentById, 
  getVolunteerDocuments, 
  submitVolunteerReport,
  getVolunteerSubmittedPlans,
  createVolunteerBatchDocument,
  rejectVolunteerSubmission
} from '@/lib/services/documentService';
import { getVolunteerApprovers } from '@/lib/services/userService';
import { getOrgStructure } from '@/lib/services/settingsService';
import { onMasterStudentsUpdate } from '@/lib/services/masterStudentService';
import { ApprovalDoc, VolunteerFormData, VolunteerStudentItem, OrgStructure } from '@/lib/types';
import type { MasterStudent } from '@/lib/types/masterStudent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  Send, 
  CheckCircle2, 
  HeartHandshake, 
  FileText, 
  FileCheck, 
  Calendar, 
  Clock, 
  MapPin, 
  Building, 
  History, 
  Printer, 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  Download, 
  Filter,
  CheckSquare
} from 'lucide-react';
import { VolunteerDocumentPrint } from '@/components/volunteer-document-print';
import { MainLayout } from '@/components/layout/main-layout';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export default function TeacherVolunteerPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const applyId = searchParams.get('applyId');
  const initialTabParam = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<string>(
    initialTabParam || (applyId ? 'report' : 'apply')
  );

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [org, setOrg] = useState<OrgStructure | null>(null);

  // 마스터 학생 목록 (학생 검색용)
  const [masterStudents, setMasterStudents] = useState<MasterStudent[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [isStudentSearchOpen, setIsStudentSearchOpen] = useState(false);

  // 문서 목록 상태
  const [allDocs, setAllDocs] = useState<ApprovalDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // 확인서 작성용 연동 계획서
  const [originalPlanDoc, setOriginalPlanDoc] = useState<ApprovalDoc | null>(null);

  // 인쇄 미리보기 다이얼로그
  const [previewDoc, setPreviewDoc] = useState<ApprovalDoc | null>(null);

  // 단체 계획서 폼 상태 (서식 3)
  const [groupPlanForm, setGroupPlanForm] = useState({
    startDate: '',
    endDate: '',
    startDayOfWeek: '월',
    endDayOfWeek: '월',
    totalDays: 1,
    totalHours: 2,
    institution: '',
    location: '',
    content: '',
    students: Array.from({ length: 20 }, () => ({
      grade: '',
      classNum: '',
      studentNum: '',
      name: '',
    })) as VolunteerStudentItem[],
  });

  // 단체 확인서 폼 상태 (서식 4)
  const [groupReportForm, setGroupReportForm] = useState({
    startTime: '09:00',
    endTime: '13:00',
    totalHours: 4,
    activityPhotos: [] as string[],
    institutionName: '',
    phone: '',
    personInCharge: '',
    signImageUrl: '',
  });

  // 관리대장 필터 상태
  const [filterYear, setFilterYear] = useState<string>('전체');
  const [filterCategory, setFilterCategory] = useState<string>('전체'); // 전체 | 개인 | 단체
  const [filterStatus, setFilterStatus] = useState<string>('전체'); // 전체 | pending | approved | rejected
  const [filterSearch, setFilterSearch] = useState<string>('');

  // 봉사활동 수합 기안 상태
  const [submittedPlans, setSubmittedPlans] = useState<ApprovalDoc[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [loadingSubmitted, setLoadingSubmitted] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchTitle, setBatchTitle] = useState('');
  const [batchContent, setBatchContent] = useState('');
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [rejectModalDoc, setRejectModalDoc] = useState<ApprovalDoc | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // 조직도 로드
  useEffect(() => {
    getOrgStructure().then(data => {
      setOrg(data as OrgStructure);
    });
    const unsubStudents = onMasterStudentsUpdate((students) => {
      setMasterStudents(students || []);
    });
    return () => unsubStudents();
  }, []);

  // 업무 담당자 또는 관리자 여부 판별
  const isVolunteerManager = useMemo(() => {
    if (profile?.isAdmin) return true;
    const userEmail = user?.email?.trim().toLowerCase();
    const managerEmail = org?.volunteerManager?.trim().toLowerCase();
    return Boolean(userEmail && managerEmail && userEmail === managerEmail);
  }, [profile, user, org]);

  // 수합 대기 목록 로드
  const loadSubmittedPlans = async () => {
    if (!isVolunteerManager) return;
    setLoadingSubmitted(true);
    try {
      const plans = await getVolunteerSubmittedPlans();
      setSubmittedPlans(plans);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSubmitted(false);
    }
  };

  // 문서 목록 로드
  const loadDocuments = async () => {
    if (!user) return;
    setLoadingDocs(true);
    try {
      const docs = await getVolunteerDocuments(user.email || '', !!profile?.isAdmin, isVolunteerManager);
      setAllDocs(docs);
      if (isVolunteerManager) {
        await loadSubmittedPlans();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [user, profile, isVolunteerManager]);

  // applyId로 진입 시 원본 계획서 자동 로드
  useEffect(() => {
    if (applyId) {
      getDocumentById(applyId).then(doc => {
        if (doc) {
          setOriginalPlanDoc(doc as ApprovalDoc);
          const vData = (doc.volunteerFormData || doc.parentFormData || {}) as any;
          setGroupReportForm(prev => ({
            ...prev,
            institutionName: vData.institution || '',
            totalHours: vData.period?.totalHours || 4,
          }));
          setActiveTab('report');
        }
      });
    }
  }, [applyId]);

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
    setGroupPlanForm(prev => ({
      ...prev,
      startDate: start,
      endDate: end,
      startDayOfWeek,
      endDayOfWeek,
      totalDays,
    }));
  };

  // 학생 명단 특정 슬롯 편집
  const handleStudentChange = (index: number, field: keyof VolunteerStudentItem, val: string) => {
    setGroupPlanForm(prev => {
      const next = [...prev.students];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, students: next };
    });
  };

  // 마스터 학생 검색 및 자동 추가
  const handleSelectMasterStudent = (s: MasterStudent) => {
    setGroupPlanForm(prev => {
      const next = [...prev.students];
      // 비어 있는 첫 번째 슬롯 탐색
      const emptyIdx = next.findIndex(item => !item.name);
      const targetIdx = emptyIdx !== -1 ? emptyIdx : next.length;
      next[targetIdx] = {
        grade: String(s.grade || ''),
        classNum: String(s.classNum || ''),
        studentNum: String(s.studentNum || ''),
        name: s.name,
        nameEn: s.nameEn || '',
      };
      return { ...prev, students: next };
    });
    setIsStudentSearchOpen(false);
    setStudentSearchQuery('');
  };

  // 사진 업로드 핸들러
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).slice(0, 2).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setGroupReportForm(prev => ({
          ...prev,
          activityPhotos: [...prev.activityPhotos, result].slice(0, 2),
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  // 단체 계획서 제출 (서식 3)
  const handleSubmitGroupPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) {
      toast({ title: '오류', description: '로그인이 필요합니다.', variant: 'destructive' });
      return;
    }

    const validStudents = groupPlanForm.students.filter(s => s.name?.trim());
    if (validStudents.length === 0) {
      toast({ title: '오류', description: '봉사활동에 참여하는 학생을 최소 1명 이상 입력해 주세요.', variant: 'destructive' });
      return;
    }
    if (!groupPlanForm.startDate || !groupPlanForm.endDate) {
      toast({ title: '오류', description: '활동 기간을 입력해 주세요.', variant: 'destructive' });
      return;
    }
    if (!groupPlanForm.institution || !groupPlanForm.location || !groupPlanForm.content) {
      toast({ title: '오류', description: '대상 기관, 장소, 활동 내용을 모두 입력해 주세요.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const approvers = await getVolunteerApprovers();

      const volunteerData: VolunteerFormData = {
        type: 'volunteer-group-plan',
        category: 'group',
        groupStudents: validStudents,
        leaderTeacherName: profile.name || user.displayName || '담당교사',
        leaderTeacherEmail: user.email || '',
        period: {
          startDate: groupPlanForm.startDate,
          endDate: groupPlanForm.endDate,
          startDayOfWeek: groupPlanForm.startDayOfWeek,
          endDayOfWeek: groupPlanForm.endDayOfWeek,
          totalDays: groupPlanForm.totalDays,
          totalHours: Number(groupPlanForm.totalHours) || 1,
        },
        institution: groupPlanForm.institution,
        location: groupPlanForm.location,
        content: groupPlanForm.content,
        teacherSignature: profile.signature || '',
        submittedDate: format(new Date(), 'yyyy-MM-dd'),
      };

      const title = `[봉사활동 단체 계획서] ${validStudents[0].name} 외 ${validStudents.length - 1}명 (${groupPlanForm.startDate} ~ ${groupPlanForm.endDate})`;

      await createDocument({
        title,
        content: groupPlanForm.content,
        docType: 'volunteer',
        publishStatus: '비공개',
        volunteerFormData: volunteerData,
        approvers,
        status: 'pending',
      }, user.uid, profile as any);

      toast({
        title: '상신 완료',
        description: '봉사활동 단체 계획서가 결재선([담당: 양유정] → [부장: 최선미] → [교감: 신선영 전결])에 상신되었습니다.',
      });

      await loadDocuments();
      setActiveTab('history');
    } catch (error: any) {
      console.error(error);
      toast({
        title: '신청 실패',
        description: error.message || '단체 계획서 제출 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 봉사활동 수합 및 일괄 기안 핸들러 ──
  const handleSelectAllPlans = (checked: boolean) => {
    if (checked) {
      setSelectedDocIds(submittedPlans.map(p => p.id));
    } else {
      setSelectedDocIds([]);
    }
  };

  const handleTogglePlanSelect = (docId: string) => {
    setSelectedDocIds(prev => 
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleOpenBatchModal = () => {
    const selected = submittedPlans.filter(p => selectedDocIds.includes(p.id));
    if (selected.length === 0) {
      toast({ title: '선택 필요', description: '수합할 계획서를 1건 이상 선택해 주세요.', variant: 'destructive' });
      return;
    }

    const totalStudents = selected.reduce((sum, p) => {
      const v = (p.volunteerFormData || p.parentFormData || {}) as any;
      const count = (v.category === 'group' || v.type === 'volunteer-group-plan')
        ? (v.groupStudents?.filter((s: any) => s.name?.trim())?.length || 1)
        : 1;
      return sum + count;
    }, 0);

    const totalHours = selected.reduce((sum, p) => {
      const v = (p.volunteerFormData || p.parentFormData || {}) as any;
      return sum + (Number(v.period?.totalHours) || 0);
    }, 0);

    const currentYear = new Date().getFullYear();
    setBatchTitle(`[학생 봉사활동 계획서 일괄 기안] ${currentYear}학년도 ${selected.length}건 (총 ${totalStudents}명)`);

    // 수합 표 HTML 구성
    const tableRows = selected.map((p, idx) => {
      const v = (p.volunteerFormData || p.parentFormData || {}) as any;
      const isGroup = v.category === 'group' || v.type === 'volunteer-group-plan';
      const studentName = isGroup
        ? (v.groupStudents?.[0]?.name ? `${v.groupStudents[0].name} 외 ${(v.groupStudents.length || 1) - 1}명` : '단체')
        : (v.studentName || p.requesterName || '');
      const studentCount = isGroup ? (v.groupStudents?.length || 1) : 1;
      const period = `${v.period?.startDate || ''} ~ ${v.period?.endDate || ''}`;
      const hours = `${v.period?.totalHours || 0}시간`;

      return `<tr>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${isGroup ? '단체' : '개인'}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${studentName} (${studentCount}명)</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">${v.institution || ''} (${v.location || ''})</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${period}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${hours}</td>
      </tr>`;
    }).join('');

    const defaultContent = `<p>1. 관련: 학생 봉사활동 운영 계획</p>
<p>2. 위와 관련하여 학생 및 교사가 신청한 봉사활동 계획서를 다음과 같이 일괄 수합하여 결재를 상신하오니 재가하여 주시기 바랍니다.</p>
<br/>
<p><b>가. 수합 총괄: 총 ${selected.length}건 (학생 총 ${totalStudents}명, 총 ${totalHours}시간)</b></p>
<p><b>나. 세부 신청 명단:</b></p>
<table style="border-collapse: collapse; width: 100%; font-size: 11px; margin-top: 6px;">
  <thead>
    <tr style="background-color: #f1f5f9;">
      <th style="padding: 6px; border: 1px solid #cbd5e1; width: 40px;">연번</th>
      <th style="padding: 6px; border: 1px solid #cbd5e1; width: 55px;">구분</th>
      <th style="padding: 6px; border: 1px solid #cbd5e1; width: 140px;">신청자/학생</th>
      <th style="padding: 6px; border: 1px solid #cbd5e1;">대상 기관 및 장소</th>
      <th style="padding: 6px; border: 1px solid #cbd5e1; width: 150px;">활동 기간</th>
      <th style="padding: 6px; border: 1px solid #cbd5e1; width: 50px;">시간</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>
<br/>
<p>붙임&nbsp; 봉사활동 계획서(개별 서식) 각 1부.  끝.</p>`;

    setBatchContent(defaultContent);
    setIsBatchModalOpen(true);
  };

  const handleSubmitBatch = async () => {
    if (!user || !profile) return;
    const selected = submittedPlans.filter(p => selectedDocIds.includes(p.id));
    if (selected.length === 0) return;

    setIsSubmittingBatch(true);
    try {
      const result = await createVolunteerBatchDocument(
        batchTitle,
        batchContent,
        selected,
        profile as any
      );

      if (!result.success) {
        throw new Error(result.error || '수합 기안 실패');
      }

      toast({
        title: '일괄 기안 상신 완료',
        description: `총 ${result.totalAggregated}건 (${result.totalStudents}명)의 계획서가 수합 기안문(${result.docNo})으로 결재선([담당] → [부장] → [교감 전결])에 상신되었습니다.`,
      });

      setIsBatchModalOpen(false);
      setSelectedDocIds([]);
      await loadDocuments();
      setActiveTab('registry');
    } catch (err: any) {
      console.error(err);
      toast({
        title: '기안 실패',
        description: err.message || '일괄 기안 상신 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const handleRejectSubmission = async () => {
    if (!rejectModalDoc || !user || !profile) return;
    if (!rejectReason.trim()) {
      toast({ title: '사유 입력 필요', description: '반려 사유를 입력해 주세요.', variant: 'destructive' });
      return;
    }

    try {
      const result = await rejectVolunteerSubmission(rejectModalDoc.id, rejectReason.trim(), profile as any);
      if (!result.success) throw new Error(result.error);

      toast({ title: '반려 완료', description: '해당 계획서가 반려 처리되었습니다.' });
      setRejectModalDoc(null);
      setRejectReason('');
      await loadDocuments();
    } catch (err: any) {
      toast({ title: '반려 실패', description: err.message || '반려 처리 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // 단체 확인서 제출 (서식 4)
  const handleSubmitGroupReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !originalPlanDoc) {
      toast({ title: '오류', description: '연동된 계획서가 없습니다.', variant: 'destructive' });
      return;
    }
    if (!groupReportForm.institutionName || !groupReportForm.personInCharge) {
      toast({ title: '오류', description: '확인 기관 정보(기관명, 담당자 성명)를 입력해 주세요.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const prevVData = (originalPlanDoc.volunteerFormData || originalPlanDoc.parentFormData || {}) as any;

      const reportPayload: Partial<VolunteerFormData> = {
        period: {
          ...prevVData.period,
          startTime: groupReportForm.startTime,
          endTime: groupReportForm.endTime,
          totalHours: Number(groupReportForm.totalHours) || 1,
        },
        activityPhotos: groupReportForm.activityPhotos,
        confirmationInstitution: {
          name: groupReportForm.institutionName,
          phone: groupReportForm.phone,
          personInCharge: groupReportForm.personInCharge,
          signImageUrl: groupReportForm.signImageUrl,
        },
      };

      const res = await submitVolunteerReport(originalPlanDoc.id, reportPayload, {
        uid: user.uid,
        name: profile?.name || '교사',
        email: user.email || '',
        role: profile?.role || '교사',
        signature: profile?.signature,
      });

      if (!res.success) {
        throw new Error(res.error || '확인서 제출 실패');
      }

      toast({
        title: '제출 완료',
        description: '봉사활동 단체 확인서가 성공적으로 등록되었습니다.',
      });

      await loadDocuments();
      setOriginalPlanDoc(null);
      setActiveTab('history');
    } catch (error: any) {
      console.error(error);
      toast({
        title: '제출 실패',
        description: error.message || '단체 확인서 제출 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 관리대장 필터링 결과
  const filteredDocs = useMemo(() => {
    return allDocs.filter(d => {
      const v = (d.volunteerFormData || d.parentFormData || {}) as any;
      const isGroup = v.category === 'group' || v.type === 'volunteer-group-plan' || v.type === 'volunteer-group-report';

      // 카테고리 필터
      if (filterCategory === '개인' && isGroup) return false;
      if (filterCategory === '단체' && !isGroup) return false;

      // 상태 필터
      if (filterStatus !== '전체' && d.status !== filterStatus) return false;

      // 검색어 필터 (학생 이름, 기관명, 기안자)
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase();
        const studentMatch = isGroup 
          ? (v.groupStudents || []).some((s: any) => s.name?.toLowerCase().includes(q))
          : v.studentName?.toLowerCase().includes(q);
        const instMatch = v.institution?.toLowerCase().includes(q);
        const reqMatch = d.requesterName?.toLowerCase().includes(q);
        if (!studentMatch && !instMatch && !reqMatch) return false;
      }

      return true;
    });
  }, [allDocs, filterCategory, filterStatus, filterSearch]);

  // 학생 검색 필터링 목록
  const searchedMasterStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return masterStudents.slice(0, 10);
    const q = studentSearchQuery.toLowerCase();
    return masterStudents.filter(s => 
      s.name?.toLowerCase().includes(q) ||
      `${s.grade}-${s.classNum}`.includes(q)
    ).slice(0, 15);
  }, [masterStudents, studentSearchQuery]);

  // 엑셀 다운로드 핸들러 (CSV 생성)
  const handleExportCsv = () => {
    if (filteredDocs.length === 0) {
      toast({ title: '안내', description: '다운로드할 데이터가 없습니다.' });
      return;
    }

    const headers = ['구분', '학생명/인원', '학년-반', '기관명', '활동기간', '인정시간', '신청일자', '결재상태', '확인서여부'];
    const rows = filteredDocs.map(d => {
      const v = (d.volunteerFormData || d.parentFormData || {}) as any;
      const isGroup = v.category === 'group' || v.type === 'volunteer-group-plan';
      const studentName = isGroup 
        ? `${v.groupStudents?.[0]?.name || ''} 외 ${(v.groupStudents?.length || 1) - 1}명` 
        : (v.studentName || '');
      const gradeClass = isGroup ? '단체' : (v.gradeClassNumber || `${v.grade}-${v.classNum}`);
      const period = `${v.period?.startDate || ''} ~ ${v.period?.endDate || ''}`;
      const hours = `${v.period?.totalHours || 0}시간`;
      const date = d.createdAt ? format(new Date(d.createdAt), 'yyyy-MM-dd') : '';
      const status = d.status === 'approved' ? '승인' : d.status === 'rejected' ? '반려' : '대기';
      const report = (v.reportSubmitted || d.reportSubmitted) ? '제출완료' : '미제출';

      return [
        isGroup ? '단체' : '개인',
        `"${studentName}"`,
        `"${gradeClass}"`,
        `"${v.institution || ''}"`,
        `"${period}"`,
        hours,
        date,
        status,
        report
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `봉사활동_관리대장_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout
      title="학생 봉사활동 관리"
      rightActions={
        <div className="flex items-center gap-2">
          {org?.volunteerManager && (
            <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 text-xs py-1">
              업무 담당: <b>{org.volunteerManager}</b>
            </Badge>
          )}
          {isVolunteerManager && (
            <Badge className="bg-primary text-primary-foreground text-xs py-1">
              관리자 권한
            </Badge>
          )}
        </div>
      }
      contentClassName="p-2 sm:p-4 md:p-6"
    >
      <div className="max-w-6xl mx-auto w-full space-y-4">
        {/* 헤더 안내문 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b">
          <p className="text-xs text-muted-foreground">
            학생 봉사활동 계획서 및 확인서 신청·결재, 단체 신청 및 관리대장 업무를 처리합니다.
          </p>
          <div className="flex sm:hidden items-center gap-2">
            {org?.volunteerManager && (
              <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 text-[11px] py-0.5">
                담당: {org.volunteerManager}
              </Badge>
            )}
            {isVolunteerManager && (
              <Badge className="bg-primary text-primary-foreground text-[11px] py-0.5">
                관리자
              </Badge>
            )}
          </div>
        </div>

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid ${isVolunteerManager ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'} h-11 bg-muted/60 p-1`}>
          <TabsTrigger value="apply" className="text-xs font-bold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            단체 계획서 신청 (서식3)
          </TabsTrigger>
          {isVolunteerManager && (
            <TabsTrigger value="batch" className="text-xs font-bold flex items-center gap-1.5 relative">
              <CheckSquare className="w-3.5 h-3.5 text-primary" />
              계획서 수합·기안
              {submittedPlans.length > 0 && (
                <Badge className="ml-1 px-1.5 py-0 h-4 text-[10px] bg-primary text-primary-foreground font-bold">
                  {submittedPlans.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="report" className="text-xs font-bold flex items-center gap-1.5" disabled={!originalPlanDoc}>
            <FileCheck className="w-3.5 h-3.5" />
            단체 확인서 제출 (서식4) {originalPlanDoc && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>}
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs font-bold flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            나의 신청 내역
          </TabsTrigger>
          <TabsTrigger value="registry" className="text-xs font-bold flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            봉사활동 관리대장
          </TabsTrigger>
        </TabsList>

        {/* ── 탭 1: 단체 계획서 신청 (서식 3) ── */}
        <TabsContent value="apply">
          <Card className="border shadow-xs">
            <CardHeader className="p-4 sm:p-5 bg-muted/20 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    봉사활동 계획서 작성 (초등단체)
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    담당 교사가 학생 단체를 대표하여 계획서를 상신합니다. (결재선: [업무 담당: 양유정] → [담당 부장: 최선미] → [교감: 신선영 전결])
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs text-blue-700 bg-blue-50 border-blue-200">
                  서식 3
                </Badge>
              </div>
            </CardHeader>

            <form onSubmit={handleSubmitGroupPlan}>
              <CardContent className="p-4 sm:p-6 space-y-5">
                {/* 1. 학생 명단 20명 슬롯 테이블 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-bold flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-primary" />
                        참여 학생 명단 (최대 20명)
                      </Label>
                      <Badge variant="secondary" className="text-[11px]">
                        입력됨: <b>{groupPlanForm.students.filter(s => s.name?.trim()).length}</b>명
                      </Badge>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs font-bold"
                      onClick={() => setIsStudentSearchOpen(true)}
                    >
                      <Search className="w-3.5 h-3.5 mr-1" />
                      학생 검색 추가
                    </Button>
                  </div>

                  {/* 2열 20명 슬롯 그리드 */}
                  <div className="border rounded-xl overflow-hidden shadow-2xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                      {/* 좌측 1~10번 */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-center border-collapse">
                          <thead className="bg-muted/50 text-[11px] font-bold border-b">
                            <tr>
                              <th className="p-1.5 w-10">순번</th>
                              <th className="p-1.5 w-14">학년</th>
                              <th className="p-1.5 w-12">반</th>
                              <th className="p-1.5 w-14">번호</th>
                              <th className="p-1.5">이름</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-[11px]">
                            {groupPlanForm.students.slice(0, 10).map((s, idx) => (
                              <tr key={idx} className="hover:bg-muted/30">
                                <td className="p-1 font-bold text-muted-foreground">{idx + 1}</td>
                                <td className="p-1">
                                  <Input
                                    value={s.grade}
                                    onChange={e => handleStudentChange(idx, 'grade', e.target.value)}
                                    placeholder="학년"
                                    className="h-7 text-xs text-center p-1"
                                  />
                                </td>
                                <td className="p-1">
                                  <Input
                                    value={s.classNum}
                                    onChange={e => handleStudentChange(idx, 'classNum', e.target.value)}
                                    placeholder="반"
                                    className="h-7 text-xs text-center p-1"
                                  />
                                </td>
                                <td className="p-1">
                                  <Input
                                    value={s.studentNum}
                                    onChange={e => handleStudentChange(idx, 'studentNum', e.target.value)}
                                    placeholder="번호"
                                    className="h-7 text-xs text-center p-1"
                                  />
                                </td>
                                <td className="p-1">
                                  <Input
                                    value={s.name}
                                    onChange={e => handleStudentChange(idx, 'name', e.target.value)}
                                    placeholder="학생 이름"
                                    className="h-7 text-xs font-bold p-1"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* 우측 11~20번 */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-center border-collapse">
                          <thead className="bg-muted/50 text-[11px] font-bold border-b">
                            <tr>
                              <th className="p-1.5 w-10">순번</th>
                              <th className="p-1.5 w-14">학년</th>
                              <th className="p-1.5 w-12">반</th>
                              <th className="p-1.5 w-14">번호</th>
                              <th className="p-1.5">이름</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-[11px]">
                            {groupPlanForm.students.slice(10, 20).map((s, idx) => {
                              const realIdx = idx + 10;
                              return (
                                <tr key={realIdx} className="hover:bg-muted/30">
                                  <td className="p-1 font-bold text-muted-foreground">{realIdx + 1}</td>
                                  <td className="p-1">
                                    <Input
                                      value={s.grade}
                                      onChange={e => handleStudentChange(realIdx, 'grade', e.target.value)}
                                      placeholder="학년"
                                      className="h-7 text-xs text-center p-1"
                                    />
                                  </td>
                                  <td className="p-1">
                                    <Input
                                      value={s.classNum}
                                      onChange={e => handleStudentChange(realIdx, 'classNum', e.target.value)}
                                      placeholder="반"
                                      className="h-7 text-xs text-center p-1"
                                    />
                                  </td>
                                  <td className="p-1">
                                    <Input
                                      value={s.studentNum}
                                      onChange={e => handleStudentChange(realIdx, 'studentNum', e.target.value)}
                                      placeholder="번호"
                                      className="h-7 text-xs text-center p-1"
                                    />
                                  </td>
                                  <td className="p-1">
                                    <Input
                                      value={s.name}
                                      onChange={e => handleStudentChange(realIdx, 'name', e.target.value)}
                                      placeholder="학생 이름"
                                      className="h-7 text-xs font-bold p-1"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. 활동 기간 및 총 계획 시간 */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      활동 기간 및 계획 시간
                    </Label>
                    <span className="text-[11px] text-red-600 font-bold">
                      ※ 2026년 12월 24일 봉사활동 계획서 제출 마감
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">시작일</Label>
                      <Input
                        type="date"
                        value={groupPlanForm.startDate}
                        onChange={e => handleDateChange(e.target.value, groupPlanForm.endDate)}
                        required
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">종료일</Label>
                      <Input
                        type="date"
                        value={groupPlanForm.endDate}
                        onChange={e => handleDateChange(groupPlanForm.startDate, e.target.value)}
                        required
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">봉사활동 계획 시간 (총 시간)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={groupPlanForm.totalHours}
                        onChange={e => setGroupPlanForm({ ...groupPlanForm, totalHours: Number(e.target.value) })}
                        required
                        className="h-8 text-xs mt-1 font-bold"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px] text-amber-800 leading-relaxed">
                    선택 기간: <b>{groupPlanForm.startDate || 'YYYY-MM-DD'} ({groupPlanForm.startDayOfWeek}요일) ~ {groupPlanForm.endDate || 'YYYY-MM-DD'} ({groupPlanForm.endDayOfWeek}요일)</b> / 총 <b>{groupPlanForm.totalDays}</b>일간 (계획: <b>{groupPlanForm.totalHours}</b>시간)
                    <br />
                    <span className="text-red-600 font-semibold">※ 휴일, 공휴일 8시간 이내 인정 (학기 중 등교 시간은 미인정)</span>
                  </div>
                </div>

                {/* 3. 대상 기관 및 장소 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-primary" />
                      대상 기관명
                    </Label>
                    <Input
                      value={groupPlanForm.institution}
                      onChange={e => setGroupPlanForm({ ...groupPlanForm, institution: e.target.value })}
                      placeholder="예: 호치민 적십자사, 교내 도서관 등"
                      required
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      활동 장소
                    </Label>
                    <Input
                      value={groupPlanForm.location}
                      onChange={e => setGroupPlanForm({ ...groupPlanForm, location: e.target.value })}
                      placeholder="예: 7군 센터 회관, 학교 도서관 등"
                      required
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>

                {/* 4. 활동 내용 */}
                <div>
                  <Label className="text-xs font-bold">활동 내용</Label>
                  <Textarea
                    value={groupPlanForm.content}
                    onChange={e => setGroupPlanForm({ ...groupPlanForm, content: e.target.value })}
                    placeholder="단체 봉사활동의 구체적인 계획 및 활동 내용을 상세히 기재해 주세요."
                    rows={4}
                    required
                    className="text-xs mt-1 leading-relaxed"
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
                  단체 계획서 결재 상신
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* ── 탭 2 (담당자 전용): 계획서 수합 및 일괄 기안 ── */}
        {isVolunteerManager && (
          <TabsContent value="batch" className="space-y-4">
            <Card className="border shadow-xs">
              <CardHeader className="p-4 sm:p-5 bg-muted/20 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-primary" />
                    봉사활동 계획서 수합 및 일괄 기안
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    교사 및 학부모(학생)가 제출한 계획서를 다중 선택하여 공문서로 일괄 수합 기안을 상신합니다.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-bold"
                    onClick={loadSubmittedPlans}
                    disabled={loadingSubmitted}
                  >
                    {loadingSubmitted ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    새로고침
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                    onClick={handleOpenBatchModal}
                    disabled={selectedDocIds.length === 0}
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    선택 계획서 일괄 기안 상신 ({selectedDocIds.length}건)
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 space-y-4">
                {/* 선택 상태 요약 바 */}
                <div className="flex items-center justify-between bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all-plans"
                        checked={submittedPlans.length > 0 && selectedDocIds.length === submittedPlans.length}
                        onCheckedChange={(checked) => handleSelectAllPlans(!!checked)}
                      />
                      <label htmlFor="select-all-plans" className="font-bold text-sky-900 cursor-pointer text-xs">
                        전체 선택 ({selectedDocIds.length}/{submittedPlans.length}건)
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sky-950 font-medium">
                    <span>
                      총 선택 학생: <b>
                        {submittedPlans
                          .filter(p => selectedDocIds.includes(p.id))
                          .reduce((sum, p) => {
                            const v = (p.volunteerFormData || p.parentFormData || {}) as any;
                            const count = (v.category === 'group' || v.type === 'volunteer-group-plan')
                              ? (v.groupStudents?.filter((s: any) => s.name?.trim())?.length || 1)
                              : 1;
                            return sum + count;
                          }, 0)}
                      </b>명
                    </span>
                    <span className="text-sky-300">|</span>
                    <span>
                      총 인정 시간: <b>
                        {submittedPlans
                          .filter(p => selectedDocIds.includes(p.id))
                          .reduce((sum, p) => {
                            const v = (p.volunteerFormData || p.parentFormData || {}) as any;
                            return sum + (Number(v.period?.totalHours) || 0);
                          }, 0)}
                      </b>시간
                    </span>
                  </div>
                </div>

                {/* 수합 대기 목록 테이블 */}
                <div className="border rounded-xl bg-card overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-muted/50 text-[11px] font-bold border-b text-slate-700">
                        <tr>
                          <th className="p-2.5 text-center w-10">선택</th>
                          <th className="p-2.5 text-center w-14">구분</th>
                          <th className="p-2.5 w-36">신청자/학생</th>
                          <th className="p-2.5 w-24 text-center">학년/반</th>
                          <th className="p-2.5">대상 기관 및 활동 장소</th>
                          <th className="p-2.5 w-36 text-center">활동 기간</th>
                          <th className="p-2.5 text-center w-16">시간</th>
                          <th className="p-2.5 text-center w-24">제출일</th>
                          <th className="p-2.5 text-center w-28">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-xs">
                        {loadingSubmitted ? (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-muted-foreground">
                              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                              수합 대기 계획서를 조회하고 있습니다...
                            </td>
                          </tr>
                        ) : submittedPlans.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-12 text-center text-muted-foreground">
                              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                              <p className="font-bold text-sm">현재 수합 대기 중인 봉사활동 계획서가 없습니다.</p>
                              <p className="text-xs text-muted-foreground mt-1">교사나 학부모가 새 계획서를 제출하면 이곳에 자동으로 표시됩니다.</p>
                            </td>
                          </tr>
                        ) : (
                          submittedPlans.map((p) => {
                            const v = (p.volunteerFormData || p.parentFormData || {}) as any;
                            const isGroup = v.category === 'group' || v.type === 'volunteer-group-plan';
                            const isSelected = selectedDocIds.includes(p.id);
                            const studentName = isGroup
                              ? `${v.groupStudents?.[0]?.name || ''} 외 ${(v.groupStudents?.length || 1) - 1}명`
                              : (v.studentName || p.title);
                            const gradeClass = isGroup ? '단체' : (v.gradeClassNumber || `${v.grade || ''}-${v.classNum || ''}`);

                            return (
                              <tr key={p.id} className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                                <td className="p-2.5 text-center">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => handleTogglePlanSelect(p.id)}
                                  />
                                </td>
                                <td className="p-2.5 text-center">
                                  <Badge variant="outline" className={`text-[10px] ${isGroup ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                    {isGroup ? '단체' : '개인'}
                                  </Badge>
                                </td>
                                <td className="p-2.5 font-bold">
                                  <div className="flex flex-col">
                                    <span>{studentName}</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">신청: {p.requesterName}</span>
                                  </div>
                                </td>
                                <td className="p-2.5 text-center text-muted-foreground font-medium">
                                  {gradeClass}
                                </td>
                                <td className="p-2.5">
                                  <div className="font-semibold truncate max-w-[200px]">{v.institution || '미입력'}</div>
                                  <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{v.location || ''}</div>
                                </td>
                                <td className="p-2.5 text-center text-[11px] text-muted-foreground whitespace-nowrap">
                                  {v.period?.startDate} ~ {v.period?.endDate}
                                </td>
                                <td className="p-2.5 text-center font-bold">
                                  {v.period?.totalHours || 0}h
                                </td>
                                <td className="p-2.5 text-center text-muted-foreground text-[11px]">
                                  {p.createdAt ? format(new Date(p.createdAt), 'yyyy-MM-dd') : '-'}
                                </td>
                                <td className="p-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => setPreviewDoc(p)}
                                      title="계획서 미리보기"
                                    >
                                      미리보기
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => {
                                        setRejectModalDoc(p);
                                        setRejectReason('');
                                      }}
                                      title="접수 반려"
                                    >
                                      반려
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── 탭 3: 단체 확인서 제출 (서식 4) ── */}
        <TabsContent value="report">
          {originalPlanDoc ? (
            <Card className="border shadow-xs">
              <CardHeader className="p-4 sm:p-5 bg-muted/20 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-teal-600" />
                      봉사활동 확인서 작성 (초등단체)
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      승인된 단체 계획서를 바탕으로 실제 활동 시간, 사진 및 확인 기관 정보를 등록합니다.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs text-teal-700 bg-teal-50 border-teal-200">
                    서식 4
                  </Badge>
                </div>
              </CardHeader>

              <form onSubmit={handleSubmitGroupReport}>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  {/* 연동된 원본 계획서 요약 정보 */}
                  <div className="bg-teal-50/60 border border-teal-200 p-3.5 rounded-xl space-y-1.5 text-xs">
                    <div className="font-bold text-teal-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-teal-600" />
                      연동된 승인 단체 계획서: {originalPlanDoc.title}
                    </div>
                    <div className="text-slate-600 text-[11px]">
                      인원: <b>{originalPlanDoc.volunteerFormData?.groupStudents?.length || 1}명</b> &nbsp;|&nbsp;
                      기관: <b>{originalPlanDoc.volunteerFormData?.institution}</b> &nbsp;|&nbsp;
                      기간: <b>{originalPlanDoc.volunteerFormData?.period?.startDate} ~ {originalPlanDoc.volunteerFormData?.period?.endDate}</b>
                    </div>
                  </div>

                  {/* 실제 활동 시간대 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">시작 시각 (Start Time)</Label>
                      <Input
                        type="time"
                        value={groupReportForm.startTime}
                        onChange={e => setGroupReportForm({ ...groupReportForm, startTime: e.target.value })}
                        required
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">종료 시각 (End Time)</Label>
                      <Input
                        type="time"
                        value={groupReportForm.endTime}
                        onChange={e => setGroupReportForm({ ...groupReportForm, endTime: e.target.value })}
                        required
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">인정 실적 시간 (총 시간)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={groupReportForm.totalHours}
                        onChange={e => setGroupReportForm({ ...groupReportForm, totalHours: Number(e.target.value) })}
                        required
                        className="h-8 text-xs mt-1 font-bold"
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
                    {groupReportForm.activityPhotos.length > 0 && (
                      <div className="flex gap-2.5 mt-2">
                        {groupReportForm.activityPhotos.map((src, i) => (
                          <div key={i} className="relative group border rounded-lg overflow-hidden">
                            <img src={src} alt="사진" className="h-20 w-32 object-cover" />
                            <button
                              type="button"
                              onClick={() => setGroupReportForm(prev => ({ ...prev, activityPhotos: prev.activityPhotos.filter((_, idx) => idx !== i) }))}
                              className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center shadow-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 확인 기관 정보 */}
                  <div className="bg-muted/40 p-3.5 rounded-xl border space-y-3">
                    <div className="text-xs font-bold text-slate-700">확인 기관 정보 (Confirmation of Institution)</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">기관명</Label>
                        <Input
                          value={groupReportForm.institutionName}
                          onChange={e => setGroupReportForm({ ...groupReportForm, institutionName: e.target.value })}
                          required
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">연락처</Label>
                        <Input
                          value={groupReportForm.phone}
                          onChange={e => setGroupReportForm({ ...groupReportForm, phone: e.target.value })}
                          placeholder="예: 028-1234-5678"
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">확인자 성명</Label>
                        <Input
                          value={groupReportForm.personInCharge}
                          onChange={e => setGroupReportForm({ ...groupReportForm, personInCharge: e.target.value })}
                          placeholder="예: 김담당"
                          required
                          className="h-8 text-xs mt-1"
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
                    단체 확인서 최종 제출
                  </Button>
                </CardFooter>
              </form>
            </Card>
          ) : (
            <Card className="p-8 text-center border shadow-xs">
              <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm mb-1">연동된 승인 단체 계획서가 없습니다.</p>
              <p className="text-xs text-muted-foreground mb-4">
                '나의 신청 내역' 탭에서 승인 완료된 단체 계획서의 [확인서 제출] 버튼을 눌러주세요.
              </p>
              <Button size="sm" onClick={() => setActiveTab('history')}>
                나의 신청 내역으로 이동
              </Button>
            </Card>
          )}
        </TabsContent>

        {/* ── 탭 3: 나의 신청 내역 ── */}
        <TabsContent value="history">
          {loadingDocs ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : allDocs.filter(d => d.requesterEmail?.toLowerCase() === user?.email?.toLowerCase()).length === 0 ? (
            <Card className="p-8 text-center border shadow-xs">
              <History className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm mb-1">교사 계정으로 제출한 신청 내역이 없습니다.</p>
              <p className="text-xs text-muted-foreground mb-4">
                학생 단체를 대표하여 새 단체 봉사활동 계획서를 작성해 보세요.
              </p>
              <Button size="sm" onClick={() => setActiveTab('apply')}>
                단체 계획서 작성하기
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {allDocs
                .filter(d => d.requesterEmail?.toLowerCase() === user?.email?.toLowerCase())
                .map(doc => {
                  const v = (doc.volunteerFormData || doc.parentFormData || {}) as any;
                  const isGroup = v.category === 'group' || v.type === 'volunteer-group-plan';
                  const isApproved = doc.status === 'approved';
                  const hasReport = Boolean(v.reportSubmitted || doc.reportSubmitted);
                  const needsReport = isApproved && !hasReport;

                  return (
                    <div
                      key={doc.id}
                      className="bg-card border rounded-xl p-4 shadow-xs hover:border-primary/40 transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={isGroup ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                            {isGroup ? '단체 봉사' : '개인 봉사'}
                          </Badge>
                          <span className="text-xs font-bold text-foreground">
                            {doc.title}
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
                          <span>기관: <b>{v.institution || '미입력'}</b> ({v.location || ''})</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            기간: {v.period?.startDate} ~ {v.period?.endDate} (총 {v.period?.totalDays || 1}일간, {v.period?.totalHours || 0}시간)
                          </span>
                        </div>
                        {isGroup && (
                          <div className="text-[11px] text-slate-500">
                            참여 학생: {(v.groupStudents || []).map((s: any) => s.name).filter(Boolean).join(', ')} (총 {v.groupStudents?.length || 0}명)
                          </div>
                        )}
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-2 pt-1 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-bold"
                          onClick={() => router.push(`/documents/${doc.id}`)}
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
                              setGroupReportForm(prev => ({
                                ...prev,
                                institutionName: prevV.institution || '',
                                totalHours: prevV.period?.totalHours || 4,
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

        {/* ── 탭 4: 봉사활동 관리대장 (전체 조회, 필터, 엑셀) ── */}
        <TabsContent value="registry" className="space-y-3">
          {/* 통계 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Card className="p-3 shadow-2xs">
              <div className="text-[11px] text-muted-foreground font-bold">전체 제출</div>
              <div className="text-xl font-bold text-foreground mt-0.5">{allDocs.length}건</div>
            </Card>
            <Card className="p-3 shadow-2xs">
              <div className="text-[11px] text-muted-foreground font-bold">승인 완료</div>
              <div className="text-xl font-bold text-green-700 mt-0.5">
                {allDocs.filter(d => d.status === 'approved').length}건
              </div>
            </Card>
            <Card className="p-3 shadow-2xs">
              <div className="text-[11px] text-muted-foreground font-bold">확인서 완료</div>
              <div className="text-xl font-bold text-teal-700 mt-0.5">
                {allDocs.filter(d => d.volunteerFormData?.reportSubmitted || d.reportSubmitted).length}건
              </div>
            </Card>
            <Card className="p-3 shadow-2xs">
              <div className="text-[11px] text-muted-foreground font-bold">결재 대기</div>
              <div className="text-xl font-bold text-amber-700 mt-0.5">
                {allDocs.filter(d => d.status === 'pending').length}건
              </div>
            </Card>
          </div>

          {/* 필터 및 검색 바 */}
          <Card className="p-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-8 text-xs w-24">
                    <SelectValue placeholder="구분" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="전체">전체 구분</SelectItem>
                    <SelectItem value="개인">개인 봉사</SelectItem>
                    <SelectItem value="단체">단체 봉사</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-8 text-xs w-28">
                    <SelectValue placeholder="결재상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="전체">전체 상태</SelectItem>
                    <SelectItem value="submitted">접수 (수합대기)</SelectItem>
                    <SelectItem value="pending">결재 진행 중</SelectItem>
                    <SelectItem value="approved">승인 완료</SelectItem>
                    <SelectItem value="rejected">반려됨</SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    placeholder="학생명, 기관명 검색"
                    className="h-8 text-xs pl-8"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold"
                  onClick={handleExportCsv}
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  엑셀(CSV) 다운로드
                </Button>
              </div>
            </div>
          </Card>

          {/* 관리대장 목록 테이블 */}
          <div className="border rounded-xl bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/50 text-[11px] font-bold border-b text-slate-700">
                  <tr>
                    <th className="p-2.5 text-center w-12">구분</th>
                    <th className="p-2.5 w-32">학생명/인원</th>
                    <th className="p-2.5 w-20 text-center">학년/반</th>
                    <th className="p-2.5">기관명 및 장소</th>
                    <th className="p-2.5 w-36">활동 기간</th>
                    <th className="p-2.5 text-center w-16">시간</th>
                    <th className="p-2.5 text-center w-20">결재상태</th>
                    <th className="p-2.5 text-center w-20">확인서</th>
                    <th className="p-2.5 text-center w-24">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {loadingDocs ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        데이터를 불러오는 중입니다...
                      </td>
                    </tr>
                  ) : filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        조건에 일치하는 봉사활동 신청 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredDocs.map(d => {
                      const v = (d.volunteerFormData || d.parentFormData || {}) as any;
                      const isGroup = v.category === 'group' || v.type === 'volunteer-group-plan';
                      const hasReport = Boolean(v.reportSubmitted || d.reportSubmitted);

                      return (
                        <tr key={d.id} className="hover:bg-muted/30">
                          <td className="p-2.5 text-center">
                            <Badge variant="outline" className={`text-[10px] ${isGroup ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                              {isGroup ? '단체' : '개인'}
                            </Badge>
                          </td>
                          <td className="p-2.5 font-bold">
                            {isGroup 
                              ? `${v.groupStudents?.[0]?.name || ''} 외 ${(v.groupStudents?.length || 1) - 1}명` 
                              : (v.studentName || d.title)}
                          </td>
                          <td className="p-2.5 text-center text-muted-foreground">
                            {isGroup ? '단체' : (v.gradeClassNumber || `${v.grade || ''}-${v.classNum || ''}`)}
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold truncate max-w-[200px]">{v.institution || '미입력'}</div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{v.location || ''}</div>
                          </td>
                          <td className="p-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                            {v.period?.startDate} ~ {v.period?.endDate}
                          </td>
                          <td className="p-2.5 text-center font-bold">
                            {v.period?.totalHours || 0}h
                          </td>
                          <td className="p-2.5 text-center">
                            {d.status === 'submitted' && <Badge variant="outline" className="bg-sky-50 text-sky-700 text-[10px]">접수</Badge>}
                            {d.status === 'pending' && <Badge variant="outline" className="bg-amber-50 text-amber-700 text-[10px]">대기</Badge>}
                            {d.status === 'approved' && <Badge variant="outline" className="bg-green-50 text-green-700 text-[10px]">승인</Badge>}
                            {d.status === 'rejected' && <Badge variant="outline" className="bg-red-50 text-red-700 text-[10px]">반려</Badge>}
                          </td>
                          <td className="p-2.5 text-center">
                            {hasReport ? (
                              <Badge className="bg-teal-600 text-white text-[10px]">완료</Badge>
                            ) : (
                              <span className="text-muted-foreground text-[10px]">-</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs font-bold"
                                onClick={() => router.push(`/documents/${d.id}`)}
                                title="문서 보기"
                              >
                                보기
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={() => setPreviewDoc(d)}
                                title="A4 인쇄"
                              >
                                인쇄
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 학생 검색 다이얼로그 (마스터 학생 연동) */}
      <Dialog open={isStudentSearchOpen} onOpenChange={setIsStudentSearchOpen}>
        <DialogContent className="max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              참여 학생 검색 및 추가
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              이름 또는 학년-반으로 검색하여 단체 봉사활동 참여 학생을 추가하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={studentSearchQuery}
              onChange={e => setStudentSearchQuery(e.target.value)}
              placeholder="학생 이름 또는 학년-반 (예: 김철수, 3-2)"
              className="h-9 text-xs"
              autoFocus
            />

            <div className="border rounded-lg max-h-60 overflow-y-auto divide-y text-xs">
              {searchedMasterStudents.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-xs">
                  검색 결과가 없습니다.
                </div>
              ) : (
                searchedMasterStudents.map((s, idx) => (
                  <div
                    key={s.id ? `${s.id}-${idx}` : `search-std-${idx}`}
                    className="p-2.5 hover:bg-muted flex items-center justify-between cursor-pointer transition-colors"
                    onClick={() => handleSelectMasterStudent(s)}
                  >
                    <div>
                      <span className="font-bold text-foreground mr-2">{s.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        ({s.grade}학년 {s.classNum}반 {s.studentNum ? `${s.studentNum}번` : ''})
                      </span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-primary font-bold">
                      추가
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* 봉사활동 계획서 일괄 기안 상신 다이얼로그 */}
      <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              봉사활동 계획서 일괄 기안 상신
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              선택된 {selectedDocIds.length}건의 봉사활동 계획서를 수합하여 결재선으로 기안합니다.
            </DialogDescription>
          </DialogHeader>

          {/* 결재선 안내 */}
          <div className="bg-muted/40 p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="font-bold text-slate-700">결재선 (전결 규정 자동 지정):</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 text-xs">
                기안: {profile?.name || '봉사활동 담당'}
              </Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-800 border-indigo-200 text-xs">
                검토: 담당 부장
              </Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-xs">
                결재: 교감 (전결)
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold">기안문 제목</Label>
              <Input
                value={batchTitle}
                onChange={e => setBatchTitle(e.target.value)}
                placeholder="기안문 제목을 입력하세요"
                className="h-9 text-xs mt-1 font-bold"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">본문 내용 (공문서 표준 수합 양식)</Label>
              <Textarea
                value={batchContent}
                onChange={e => setBatchContent(e.target.value)}
                rows={10}
                className="text-xs mt-1 font-mono leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                ※ 위 본문은 HTML 양식으로 전자결재 본문에 등록됩니다. 필요에 따라 세부 문구를 수정하실 수 있습니다.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsBatchModalOpen(false)}
              disabled={isSubmittingBatch}
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleSubmitBatch}
              disabled={isSubmittingBatch}
            >
              {isSubmittingBatch ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              일괄 기안 상신하기 ({selectedDocIds.length}건)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 계획서 접수 반려 다이얼로그 */}
      <Dialog open={!!rejectModalDoc} onOpenChange={open => !open && setRejectModalDoc(null)}>
        <DialogContent className="max-w-md p-4 sm:p-6 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              봉사활동 계획서 접수 반려
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              선택한 봉사활동 계획서를 수합하지 않고 기안자에게 반려합니다.
            </DialogDescription>
          </DialogHeader>

          {rejectModalDoc && (
            <div className="bg-muted/30 p-3 rounded-lg border text-xs space-y-1">
              <div><b>제목:</b> {rejectModalDoc.title}</div>
              <div><b>신청자:</b> {rejectModalDoc.requesterName} ({rejectModalDoc.requesterEmail})</div>
              <div><b>신청일:</b> {rejectModalDoc.createdAt ? format(new Date(rejectModalDoc.createdAt), 'yyyy-MM-dd') : '-'}</div>
            </div>
          )}

          <div>
            <Label className="text-xs font-bold">반려 사유</Label>
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="반려 사유를 구체적으로 입력하세요 (신청자에게 전달됩니다)"
              rows={3}
              className="text-xs mt-1"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectModalDoc(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="font-bold"
              onClick={handleRejectSubmission}
            >
              반려 확정
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </MainLayout>
  );
}
