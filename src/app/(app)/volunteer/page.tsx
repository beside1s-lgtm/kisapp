'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addDays } from 'date-fns';
import { 
  createDocument, 
  getDocumentById, 
  getVolunteerDocuments, 
  submitVolunteerReport,
  getVolunteerSubmittedPlans,
  createVolunteerBatchDocument,
  rejectVolunteerSubmission
} from '@/lib/services/documentService';
import { getVolunteerApprovers, getUserProfileByEmail, getUsersDirectory } from '@/lib/services/userService';
import { getOrgStructure } from '@/lib/services/settingsService';
import { onMasterStudentsUpdate } from '@/lib/services/masterStudentService';
import { ApprovalDoc, VolunteerFormData, VolunteerStudentItem, OrgStructure } from '@/lib/types';
import type { MasterStudent } from '@/lib/types/masterStudent';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, FileCheck, History, Users, CheckSquare } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { ApplyTabContent } from '@/components/volunteer/ApplyTabContent';
import { BatchTabContent } from '@/components/volunteer/BatchTabContent';
import { ReportTabContent } from '@/components/volunteer/ReportTabContent';
import { HistoryTabContent } from '@/components/volunteer/HistoryTabContent';
import { RegistryTabContent } from '@/components/volunteer/RegistryTabContent';
import { StudentSearchDialog } from '@/components/volunteer/StudentSearchDialog';
import { PrintPreviewDialog } from '@/components/volunteer/PrintPreviewDialog';
import { BatchSubmitDialog } from '@/components/volunteer/BatchSubmitDialog';
import { RejectDialog } from '@/components/volunteer/RejectDialog';

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
  const [volunteerManagerName, setVolunteerManagerName] = useState<string>('');

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

  // 봉사활동 담당자 이름 확인 (이메일 -> 성명)
  useEffect(() => {
    const email = org?.volunteerManager?.trim();
    if (!email) {
      setVolunteerManagerName('');
      return;
    }

    if ((org as any)?.volunteerManagerName) {
      setVolunteerManagerName((org as any).volunteerManagerName);
      return;
    }

    if (email.toLowerCase() === 'yjng05@kshcm.net') {
      setVolunteerManagerName('양유정');
    }

    let isMounted = true;
    getUserProfileByEmail(email)
      .then((p) => {
        if (!isMounted) return;
        if (p?.name) {
          setVolunteerManagerName(p.name);
        } else {
          getUsersDirectory().then((users) => {
            if (!isMounted) return;
            const found = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
            if (found?.name) {
              setVolunteerManagerName(found.name);
            }
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [org?.volunteerManager]);

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

  // 봉사활동 계획서는 최소 7일 전 제출 (신청일부터 6일 이후까지는 신청 불가)
  const minSelectableDate = useMemo(() => {
    return format(addDays(new Date(), 7), 'yyyy-MM-dd');
  }, []);

  // 날짜 변경 시 요일 및 일수 자동 계산
  const handleDateChange = (start: string, end: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    let startDayOfWeek = '월';
    let endDayOfWeek = '월';
    let totalDays = 1;

    let adjustedEnd = end;
    // 시작일이 있고 종료일이 시작일보다 앞서면 시작일로 자동 보정
    if (start && end && end < start) {
      adjustedEnd = start;
    }

    if (start) {
      const sDate = new Date(start);
      startDayOfWeek = days[sDate.getDay()];
      if (start.length === 10 && start < minSelectableDate) {
        toast({
          title: '신청 불가 날짜 안내',
          description: `봉사활동 계획서는 무조건 실시 7일 전 제출해야 합니다. (${minSelectableDate}부터 신청 가능)`,
          variant: 'destructive',
        });
      }
    }
    if (adjustedEnd) {
      const eDate = new Date(adjustedEnd);
      endDayOfWeek = days[eDate.getDay()];
    }
    if (start && adjustedEnd) {
      const s = new Date(start).getTime();
      const e = new Date(adjustedEnd).getTime();
      if (e >= s) {
        totalDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
      }
    }
    setGroupPlanForm(prev => ({
      ...prev,
      startDate: start,
      endDate: adjustedEnd,
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
    if (groupPlanForm.startDate < minSelectableDate) {
      toast({
        title: '신청 기간 오류',
        description: `봉사활동 계획서는 무조건 7일 전 제출해야 합니다. (${minSelectableDate}부터 신청 가능하며 신청일로부터 6일 이내는 신청 불가)`,
        variant: 'destructive',
      });
      return;
    }
    if (groupPlanForm.endDate < groupPlanForm.startDate) {
      toast({
        title: '신청 기간 오류',
        description: '종료일은 시작일 이후여야 합니다.',
        variant: 'destructive',
      });
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
          {(volunteerManagerName || org?.volunteerManager) && (
            <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 text-xs py-1">
              업무 담당: <b>{volunteerManagerName || org?.volunteerManager}</b>
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
            {(volunteerManagerName || org?.volunteerManager) && (
              <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 text-[11px] py-0.5">
                담당: <b>{volunteerManagerName || org?.volunteerManager}</b>
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
        <ApplyTabContent
          groupPlanForm={groupPlanForm}
          setGroupPlanForm={setGroupPlanForm}
          minSelectableDate={minSelectableDate}
          handleStudentChange={handleStudentChange}
          handleDateChange={handleDateChange}
          setIsStudentSearchOpen={setIsStudentSearchOpen}
          isSubmitting={isSubmitting}
          handleSubmitGroupPlan={handleSubmitGroupPlan}
          volunteerManagerName={volunteerManagerName}
        />

        {/* ── 탭 2 (담당자 전용): 계획서 수합 및 일괄 기안 ── */}
        {isVolunteerManager && (
          <BatchTabContent
            submittedPlans={submittedPlans}
            selectedDocIds={selectedDocIds}
            loadingSubmitted={loadingSubmitted}
            handleSelectAllPlans={handleSelectAllPlans}
            handleTogglePlanSelect={handleTogglePlanSelect}
            handleOpenBatchModal={handleOpenBatchModal}
            loadSubmittedPlans={loadSubmittedPlans}
            setPreviewDoc={setPreviewDoc}
            setRejectModalDoc={setRejectModalDoc}
            setRejectReason={setRejectReason}
          />
        )}

        {/* ── 탭 3: 단체 확인서 제출 (서식 4) ── */}
        <ReportTabContent
          originalPlanDoc={originalPlanDoc}
          groupReportForm={groupReportForm}
          setGroupReportForm={setGroupReportForm}
          handlePhotoUpload={handlePhotoUpload}
          handleSubmitGroupReport={handleSubmitGroupReport}
          isSubmitting={isSubmitting}
          setActiveTab={setActiveTab}
        />

        {/* ── 탭 3: 나의 신청 내역 ── */}
        <HistoryTabContent
          loadingDocs={loadingDocs}
          allDocs={allDocs}
          user={user}
          router={router}
          setPreviewDoc={setPreviewDoc}
          setOriginalPlanDoc={setOriginalPlanDoc}
          setGroupReportForm={setGroupReportForm}
          setActiveTab={setActiveTab}
        />

        {/* ── 탭 4: 봉사활동 관리대장 (전체 조회, 필터, 엑셀) ── */}
        <RegistryTabContent
          allDocs={allDocs}
          filteredDocs={filteredDocs}
          loadingDocs={loadingDocs}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterSearch={filterSearch}
          setFilterSearch={setFilterSearch}
          handleExportCsv={handleExportCsv}
          router={router}
          setPreviewDoc={setPreviewDoc}
        />
      </Tabs>

      {/* 학생 검색 다이얼로그 (마스터 학생 연동) */}
      <StudentSearchDialog
        isStudentSearchOpen={isStudentSearchOpen}
        setIsStudentSearchOpen={setIsStudentSearchOpen}
        studentSearchQuery={studentSearchQuery}
        setStudentSearchQuery={setStudentSearchQuery}
        searchedMasterStudents={searchedMasterStudents}
        handleSelectMasterStudent={handleSelectMasterStudent}
      />

      {/* 인쇄 미리보기 다이얼로그 */}
      <PrintPreviewDialog previewDoc={previewDoc} setPreviewDoc={setPreviewDoc} />

      {/* 봉사활동 계획서 일괄 기안 상신 다이얼로그 */}
      <BatchSubmitDialog
        isBatchModalOpen={isBatchModalOpen}
        setIsBatchModalOpen={setIsBatchModalOpen}
        selectedDocIds={selectedDocIds}
        profile={profile}
        batchTitle={batchTitle}
        setBatchTitle={setBatchTitle}
        batchContent={batchContent}
        setBatchContent={setBatchContent}
        handleSubmitBatch={handleSubmitBatch}
        isSubmittingBatch={isSubmittingBatch}
      />

      {/* 계획서 접수 반려 다이얼로그 */}
      <RejectDialog
        rejectModalDoc={rejectModalDoc}
        setRejectModalDoc={setRejectModalDoc}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        handleRejectSubmission={handleRejectSubmission}
      />
      </div>
    </MainLayout>
  );
}
