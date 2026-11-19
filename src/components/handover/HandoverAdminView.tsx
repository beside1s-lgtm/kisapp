'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  HandoverDocument,
  TeacherAssignment,
  HandoverStatus
} from '@/lib/types/handover';
import { UserProfile, OrgStructure } from '@/lib/types';
import {
  getHandoversForVicePrincipal,
  getTeacherAssignments,
  saveTeacherAssignmentsBulk,
  routePendingHandoversToSuccessors,
  triggerHandoverNotice,
  buildFacultyHandoverStatusList,
  filterValidHandoverFaculty,
  resolveFacultyDepartment,
  resolveTeacherAssignedDutiesList,
  rejectHandoverDocument,
  requestHandoverRevision,
  isHandoverEditableByAuthor,
  isHandoverInAcademicHeadQueue,
  isHandoverInVpQueue,
  getHandoverStatusLabel,
  FacultyHandoverStatusRow,
  CURRENT_SCHOOL_YEAR
} from '@/lib/services/handoverService';
import { AcademicHeadStagingCard } from './AcademicHeadStagingCard';
import {
  HandoverFeedbackDialog,
  HandoverFeedbackMode,
  buildFeedbackTargetFromDoc,
} from './HandoverFeedbackDialog';
import { getUsersDirectory } from '@/lib/services/userService';
import { getOrgStructure } from '@/lib/services/settingsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  BellRing,
  GitPullRequest,
  Users,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  Loader2,
  Save,
  Send,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  UserCheck,
  UserX,
  FileText
} from 'lucide-react';

interface HandoverAdminViewProps {
  currentUserProfile: UserProfile;
  year?: number;
  org?: Partial<OrgStructure> | null;
  isLocked?: boolean;
  onOpenViewer?: (doc: HandoverDocument) => void;
  /** 상신·반려·수정요청 등으로 문서 상태가 바뀐 뒤 상위 화면(교감 결재 탭 등)을 갱신하기 위한 콜백 */
  onDocumentsChanged?: () => void;
}

export function HandoverAdminView({
  currentUserProfile,
  year = CURRENT_SCHOOL_YEAR,
  org,
  isLocked = false,
  onOpenViewer,
  onDocumentsChanged,
}: HandoverAdminViewProps) {
  const { toast } = useToast();

  const [documents, setDocuments] = useState<HandoverDocument[]>([]);
  const [facultyStatusList, setFacultyStatusList] = useState<FacultyHandoverStatusRow[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [allFaculty, setAllFaculty] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // 상단 탭: 제출 현황 명렬표 vs 업무 분장/인수자 배정표
  const [adminSubTab, setAdminSubTab] = useState<'status' | 'assignments'>('status');

  // 팝업 발송 모달 상태
  const [isNoticeDialogOpen, setIsNoticeDialogOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState(
    `[학년 말 인수인계] ${year}학년도 업무 인수인계서 작성 요청`
  );
  const [noticeMessage, setNoticeMessage] = useState(
    `${year}학년도 학년 말 교원 업무 인수인계를 진행합니다. 일년간 기안기로 작성된 업무 기록을 불러와 시기별로 정리하고 전년도 업무 폴더를 연결하여 기한 내 제출해 주시기 바랍니다.`
  );
  const [isSendingNotice, setIsSendingNotice] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);

  // 명렬표 필터 및 검색
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'UNSUBMITTED' | 'CHECKED' | 'UNCHECKED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 반려 / 수정 요청 모달 상태
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [targetRejectRow, setTargetRejectRow] = useState<FacultyHandoverStatusRow | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const [stagingFeedbackOpen, setStagingFeedbackOpen] = useState(false);
  const [stagingFeedbackMode, setStagingFeedbackMode] = useState<HandoverFeedbackMode>('revision');
  const [stagingFeedbackDoc, setStagingFeedbackDoc] = useState<HandoverDocument | null>(null);
  const [isSendingStagingFeedback, setIsSendingStagingFeedback] = useState(false);

  // 중복 네트워크 요청 차단 및 로딩 최적화
  // 문서 상태 변경 후: 이 화면 + 상위 페이지(교감 결재 대기 목록·건수) 함께 갱신
  const reloadAndNotify = async () => {
    await loadData();
    onDocumentsChanged?.();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1회 단일 Promise.all 호출: 중복 호출 완전 배제
      const [docs, assignList, users, fetchedOrg] = await Promise.all([
        getHandoversForVicePrincipal(year),
        getTeacherAssignments(year),
        getUsersDirectory(),
        org ? Promise.resolve(org) : getOrgStructure(),
      ]);

      const effectiveOrg = (org || fetchedOrg) as Partial<OrgStructure>;
      setDocuments(docs);

      // 교원 정밀 필터링: 학생, 학부모, 교장, 교감 완전 배제 및 소속 부서가 있는 교사/강사만 선별
      const facultyOnly = filterValidHandoverFaculty(users || [], effectiveOrg);
      setAllFaculty(facultyOnly);

      // 0ms 인메모리 매핑으로 상태 명렬표 즉시 구성
      const statusRows = buildFacultyHandoverStatusList(facultyOnly, docs, effectiveOrg);
      setFacultyStatusList(statusRows);

      // 교원 목록 기반으로 assignment 동기화 (기존 데이터 유지 + 신규 교원 추가)
      const existingMap = new Map((assignList || []).map((a: TeacherAssignment) => [a.teacherEmail.toLowerCase(), a]));
      const mergedList: TeacherAssignment[] = facultyOnly.map((f: UserProfile) => {
        const cleanEmail = f.email.trim().toLowerCase();
        const existing = existingMap.get(cleanEmail);
        const resolvedDept = f.dept || resolveFacultyDepartment(f, effectiveOrg) || '';
        const defaultList = resolveTeacherAssignedDutiesList(cleanEmail, effectiveOrg, resolvedDept);
        const defaultDuty = defaultList[0] || '일반 교무 업무';
        const defaultSubDuties = defaultList.slice(1);
        if (existing) {
          return {
            ...existing,
            department: existing.department || resolvedDept,
            primaryDuty:
              existing.primaryDuty && existing.primaryDuty !== '일반 교무 업무'
                ? existing.primaryDuty
                : defaultDuty,
            subDuties:
              existing.subDuties && existing.subDuties.length > 0
                ? existing.subDuties
                : defaultSubDuties,
          };
        }
        return {
          id: `${year}_${cleanEmail}`,
          year,
          teacherEmail: cleanEmail,
          teacherName: f.name || cleanEmail,
          department: resolvedDept,
          primaryDuty: defaultDuty,
          subDuties: defaultSubDuties,
        };
      });

      setAssignments(mergedList);
    } catch (err) {
      console.error('[HandoverAdminView] loadData error:', err);
      toast({ variant: 'destructive', description: '데이터를 불러오는 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [year, org]);

  // 공지 팝업 일괄 발송
  const handleSendNotice = async () => {
    if (isLocked) {
      toast({
        variant: 'destructive',
        title: '팝업 발송 불가',
        description: '현재 인수인계가 마감(잠김)되어 있어 팝업을 발송할 수 없습니다. 상단의 [인수인계 잠김 (열기)] 버튼으로 먼저 잠금을 해제해 주세요.',
      });
      return;
    }
    setIsSendingNotice(true);
    try {
      await triggerHandoverNotice(
        { title: noticeTitle, message: noticeMessage, year },
        currentUserProfile
      );
      toast({
        title: '팝업 발송 완료',
        description: '전 교원을 대상으로 학년 말 인수인계 작성 요청 팝업이 활성화되었습니다. 미제출 교원은 접속 시 팝업이 표출됩니다.',
      });
      setIsNoticeDialogOpen(false);
    } catch (err) {
      console.error('send notice error:', err);
      toast({ variant: 'destructive', description: '팝업 발송 중 오류가 발생했습니다.' });
    } finally {
      setIsSendingNotice(false);
    }
  };

  // 대기 인계서 자동 라우팅 실행
  const handleAutoRoute = async () => {
    setIsRouting(true);
    try {
      const result = await routePendingHandoversToSuccessors(year);
      toast({
        title: '자동 라우팅 완료',
        description: `총 ${result.routedCount}건의 대기 인계서가 새 인수자에게 성공적으로 배정되었습니다.`,
      });
      await reloadAndNotify();
    } catch (err) {
      console.error('route error:', err);
      toast({ variant: 'destructive', description: '자동 라우팅 처리 중 오류가 발생했습니다.' });
    } finally {
      setIsRouting(false);
    }
  };

  // 교원 업무 매핑 일괄 저장
  const handleSaveAssignments = async () => {
    setIsSavingAssignments(true);
    try {
      await saveTeacherAssignmentsBulk(assignments);
      toast({
        title: '업무 배정표 저장 완료',
        description: '전체 교원 담당 업무 및 인수자 매핑이 안전하게 저장되었습니다.',
      });
    } catch (err) {
      console.error('save assignments error:', err);
      toast({ variant: 'destructive', description: '업무 배정표 저장 중 오류가 발생했습니다.' });
    } finally {
      setIsSavingAssignments(false);
    }
  };

  // 특정 교원 assignment 수정
  const updateAssignment = (email: string, patch: Partial<TeacherAssignment>) => {
    setAssignments(prev =>
      prev.map(a => (a.teacherEmail.toLowerCase() === email.toLowerCase() ? { ...a, ...patch } : a))
    );
  };

  // 반려 모달 열기
  const openRejectModal = (row: FacultyHandoverStatusRow) => {
    setTargetRejectRow(row);
    setRejectionReasonInput('');
    setRejectModalOpen(true);
  };

  // 반려 처리 실행
  const handleConfirmReject = async () => {
    if (!targetRejectRow?.documentId) {
      toast({ variant: 'destructive', description: '반려할 인수인계 문서 ID가 없습니다.' });
      return;
    }

    setIsRejecting(true);
    try {
      const reason = rejectionReasonInput.trim() || '인수인계서 내용 보완이 필요하여 반려되었습니다. 수정 후 다시 제출해 주세요.';
      await rejectHandoverDocument(targetRejectRow.documentId, reason, currentUserProfile.name);

      toast({
        title: '인계서 반려 완료',
        description: `${targetRejectRow.name} 교사의 인계서가 반려되었습니다. 해당 교사 접속 시 다시 팝업이 노출됩니다.`,
      });
      setRejectModalOpen(false);
      await reloadAndNotify();
    } catch (err) {
      console.error('reject error:', err);
      toast({ variant: 'destructive', description: '인계서 반려 처리 중 오류가 발생했습니다.' });
    } finally {
      setIsRejecting(false);
    }
  };

  // KPI 통계 계산
  const statusStats = useMemo(() => {
    const total = facultyStatusList.length;
    const submitted = facultyStatusList.filter(f => f.status === 'SUBMITTED').length;
    const unsubmitted = facultyStatusList.filter(f => f.status === 'UNSUBMITTED').length;
    const rejected = facultyStatusList.filter(f => f.status === 'REJECTED').length;
    const rate = total > 0 ? Math.round((submitted / total) * 100) : 0;

    // 제출된 인수인계 문서 중 인수자가 수신 확인 완료한 건수 및 비율 산출
    const submittedDocs = documents.filter(d => !isHandoverEditableByAuthor(d.status));
    const checkedDocs = submittedDocs.filter(d => Boolean(d.successorChecked));
    const checkedCount = checkedDocs.length;
    const submittedDocsCount = submittedDocs.length;
    const checkedRate = submittedDocsCount > 0 ? Math.round((checkedCount / submittedDocsCount) * 100) : 0;

    return { total, submitted, unsubmitted, rejected, rate, checkedCount, checkedRate, submittedDocsCount };
  }, [facultyStatusList, documents]);

  const academicHeadQueueDocs = useMemo(() => {
    // 이전에 제출되어 소속 부서가 비어 있는 문서는 명렬표(조직도 기준) 부서로 표시 보강
    const deptByEmail = new Map(
      facultyStatusList.map(f => [(f.email || '').trim().toLowerCase(), f.dept] as const)
    );
    return documents
      .filter(d => isHandoverInAcademicHeadQueue(d.status))
      .map(d =>
        d.authorDepartment
          ? d
          : { ...d, authorDepartment: deptByEmail.get((d.authorEmail || '').trim().toLowerCase()) || '' }
      );
  }, [documents, facultyStatusList]);

  const forwardedToVpCount = useMemo(
    () => documents.filter(d => isHandoverInVpQueue(d.status)).length,
    [documents]
  );

  const handleConfirmStagingFeedback = async (reason: string) => {
    if (!stagingFeedbackDoc) return;
    setIsSendingStagingFeedback(true);
    try {
      if (stagingFeedbackMode === 'revision') {
        await requestHandoverRevision(
          stagingFeedbackDoc.id,
          reason,
          currentUserProfile.name || '교무부장',
          '교무부장'
        );
        toast({
          title: '수정 요청 완료',
          description: `${stagingFeedbackDoc.authorName} 교사에게 수정 요청 사유가 전달되었습니다.`,
        });
      } else {
        await rejectHandoverDocument(
          stagingFeedbackDoc.id,
          reason,
          currentUserProfile.name || '교무부장'
        );
        toast({
          title: '인계서 반려 완료',
          description: `${stagingFeedbackDoc.authorName} 교사의 인계서가 반려되었습니다.`,
        });
      }
      setStagingFeedbackOpen(false);
      await reloadAndNotify();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        description: err?.message || '피드백 처리 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSendingStagingFeedback(false);
    }
  };

  // 명렬표 필터링
  const filteredStatusList = useMemo(() => {
    return facultyStatusList.filter(row => {
      if (statusFilter === 'SUBMITTED' && row.status !== 'SUBMITTED') return false;
      if (statusFilter === 'UNSUBMITTED' && row.status !== 'UNSUBMITTED') return false;
      if (statusFilter === 'REJECTED' && row.status !== 'REJECTED') return false;
      if (statusFilter === 'CHECKED' && (!row.successorChecked || row.status !== 'SUBMITTED')) return false;
      if (statusFilter === 'UNCHECKED' && (row.successorChecked || row.status !== 'SUBMITTED')) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.dept.toLowerCase().includes(q) ||
        row.primaryDuty.toLowerCase().includes(q) ||
        (row.targetSuccessorName && row.targetSuccessorName.toLowerCase().includes(q))
      );
    });
  }, [facultyStatusList, statusFilter, searchQuery]);

  // 배정표 필터링
  const filteredAssignments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter(a => (
      a.teacherName.toLowerCase().includes(q) ||
      a.teacherEmail.toLowerCase().includes(q) ||
      (a.primaryDuty || '').toLowerCase().includes(q) ||
      (a.department || '').toLowerCase().includes(q)
    ));
  }, [assignments, searchQuery]);

  return (
    <div className="space-y-6">
      {/* 초경량 네이티브 datalist: 수만 개의 Option DOM 생성을 방지하여 브라우저 프리징 100% 방어 */}
      <datalist id="faculty-successor-datalist">
        {allFaculty.map(f => (
          <option key={f.email} value={`${f.name} (${f.email})`} />
        ))}
      </datalist>

      {/* 상단 KPI 현황 카드 (학교 공식 색상: KIS Blue #2471B2, Red #B01E23, Gold #C49832) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
        <Card className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs text-center">
          <span className="text-[10px] font-bold text-slate-500">전체 대상 교원</span>
          <div className="text-xl font-black text-slate-900 mt-0.5">{statusStats.total}명</div>
        </Card>

        <Card className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl shadow-2xs text-center">
          <span className="text-[10px] font-bold text-emerald-800 flex items-center justify-center gap-1">
            <UserCheck className="w-3 h-3" />
            제출 완료
          </span>
          <div className="text-xl font-black text-emerald-700 mt-0.5">
            {statusStats.submitted}명 <span className="text-xs font-semibold">({statusStats.rate}%)</span>
          </div>
        </Card>

        <Card className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl shadow-2xs text-center">
          <span className="text-[10px] font-bold text-amber-800 flex items-center justify-center gap-1">
            <UserX className="w-3 h-3" />
            미제출 (작성 대기)
          </span>
          <div className="text-xl font-black text-amber-700 mt-0.5">{statusStats.unsubmitted}명</div>
        </Card>

        {/* 4번째 카드: 반려 건수 -> 인수자 수신 확인 건수 (제출 N건 중 N건 확인 / N%) */}
        <Card className="p-3 bg-blue-50/70 border border-[#2471B2]/30 rounded-xl shadow-2xs text-center">
          <span className="text-[10px] font-bold text-[#2471B2] flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            인수자 수신 확인
          </span>
          <div className="text-xl font-black text-[#2471B2] mt-0.5">
            {statusStats.checkedCount}건 <span className="text-xs font-semibold">({statusStats.checkedRate}%)</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            제출 {statusStats.submittedDocsCount}건 중 확인 완료
          </div>
        </Card>

        <Card className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl shadow-2xs text-center col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-slate-600">확인 대기 / 교감 상신 / 완료</span>
          <div className="text-sm font-black text-[#2471B2] mt-1">
            대기 {academicHeadQueueDocs.length} · 상신 {forwardedToVpCount} · 완료 {documents.filter(d => d.status === 'VICE_PRINCIPAL_APPROVED' || d.status === 'ARCHIVED').length}
          </div>
        </Card>
      </div>

      {/* 핵심 액션 바 (학교 공식 Blue 테마) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 p-3 sm:p-4 bg-[#2471B2]/5 border border-[#2471B2]/20 rounded-2xl shadow-2xs">
        <div className="space-y-0.5 min-w-0 flex-1">
          <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#2471B2] shrink-0" />
            <span>교무부장 인수인계 총괄 컨트롤</span>
          </h3>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            전 교원에게 작성 요청 팝업을 활성화하고, 제출 여부 명렬표에서 완료/미제출 현황을 확인 및 필요시 반려할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap w-full sm:w-auto justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            title="새로고침"
            aria-label="새로고침"
            className="h-8 w-8 p-0 shrink-0 border-[#2471B2]/30 text-[#2471B2] bg-white hover:bg-blue-50 flex items-center justify-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setIsNoticeDialogOpen(true)}
            title="전 교원 작성 요청 팝업 발송"
            className="h-8 px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold bg-[#2471B2] hover:bg-[#1f5e94] text-white gap-1 sm:gap-1.5 shadow-xs whitespace-nowrap shrink-0 flex items-center"
          >
            <BellRing className="w-3.5 h-3.5 shrink-0" />
            <span>팝업 발송</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleAutoRoute}
            disabled={isRouting}
            title="새 인수자 일괄 자동 라우팅 실행"
            className="h-8 px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold bg-[#1f5e94] hover:bg-[#184974] text-white gap-1 sm:gap-1.5 shadow-xs whitespace-nowrap shrink-0 flex items-center"
          >
            {isRouting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <GitPullRequest className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>인수자 연결</span>
          </Button>
        </div>
      </div>

      {/* 서브 탭 전환: 1. 제출 여부 명렬표 vs 2. 업무 분장 및 차년도 인수자 매핑 (학교 공식 Blue 테마) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setAdminSubTab('status')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
            adminSubTab === 'status'
              ? 'bg-[#2471B2] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>인계서 제출 여부 명렬표 ({facultyStatusList.length}명)</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminSubTab('assignments')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
            adminSubTab === 'assignments'
              ? 'bg-[#2471B2] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>교원 업무 분장 및 차년도 인수자(후임) 배정 ({assignments.length}명)</span>
        </button>
      </div>

      {/* 1. 교무부장 확인 대기 (일괄 상신) + 전체 교원 인계서 제출 여부 명렬표 */}
      {adminSubTab === 'status' && (
        <div className="space-y-4">
          <AcademicHeadStagingCard
            queueDocs={academicHeadQueueDocs}
            forwardedToVpCount={forwardedToVpCount}
            currentUserProfile={currentUserProfile}
            onOpenViewer={onOpenViewer}
            onOpenRevision={(doc) => {
              setStagingFeedbackDoc(doc);
              setStagingFeedbackMode('revision');
              setStagingFeedbackOpen(true);
            }}
            onOpenReject={(doc) => {
              setStagingFeedbackDoc(doc);
              setStagingFeedbackMode('reject');
              setStagingFeedbackOpen(true);
            }}
            onForwarded={reloadAndNotify}
          />

          <Card className="border border-slate-200 rounded-2xl shadow-2xs overflow-hidden bg-white">
          <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="space-y-0.5">
              <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#2471B2]" />
                <span>전체 교원 인수인계서 제출 여부 명렬표</span>
                <Badge variant="outline" className="text-[10px] ml-1 bg-blue-50 text-[#2471B2] border-[#2471B2]/30 font-bold">
                  총 {facultyStatusList.length}명
                </Badge>
              </CardTitle>
              <p className="text-[11px] text-slate-500">
                제출 완료 교원의 문서를 열람하거나, 보완이 필요한 경우 반려하여 다시 작성 팝업이 뜨도록 처리할 수 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* 상태 필터 탭 */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex-wrap">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${
                    statusFilter === 'ALL' ? 'bg-white text-[#2471B2] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  전체 ({statusStats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('SUBMITTED')}
                  className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${
                    statusFilter === 'SUBMITTED' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  완료 ({statusStats.submitted})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('CHECKED')}
                  className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${
                    statusFilter === 'CHECKED' ? 'bg-white text-[#2471B2] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  수신확인 ({statusStats.checkedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('UNCHECKED')}
                  className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${
                    statusFilter === 'UNCHECKED' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  미확인대기 ({Math.max(0, statusStats.submitted - statusStats.checkedCount)})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('UNSUBMITTED')}
                  className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${
                    statusFilter === 'UNSUBMITTED' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  미제출 ({statusStats.unsubmitted})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('REJECTED')}
                  className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${
                    statusFilter === 'REJECTED' ? 'bg-white text-[#B01E23] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  반려 ({statusStats.rejected})
                </button>
              </div>

              {/* 검색창 */}
              <div className="relative flex-1 sm:w-44">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <Input
                  placeholder="교사명 / 부서 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-8 text-xs pl-8 bg-white border-slate-300"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200">
                  <tr className="text-[11px] text-slate-600">
                    <th className="p-2.5 font-bold w-16 text-center">제출 상태</th>
                    <th className="p-2.5 font-bold w-28">교원 성명</th>
                    <th className="p-2.5 font-bold w-24">소속 부서</th>
                    <th className="p-2.5 font-bold w-36">주 업무명</th>
                    <th className="p-2.5 font-bold w-24">제출 일시</th>
                    <th className="p-2.5 font-bold w-32">인수자 수신 확인</th>
                    <th className="p-2.5 font-bold w-28 whitespace-nowrap">비고 / 반려 사유</th>
                    <th className="p-2.5 font-bold w-28 text-center">관리 액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStatusList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-xs text-slate-400">
                        {loading ? '데이터를 불러오는 중입니다...' : '일치하는 교원 데이터가 없습니다.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStatusList.map(row => (
                      <tr key={row.email} className="hover:bg-blue-50/30 transition-colors">
                        {/* 제출 상태 배지 */}
                        <td className="p-2.5 text-center">
                          {row.status === 'SUBMITTED' && (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 shadow-2xs">
                              완료
                            </Badge>
                          )}
                          {row.status === 'UNSUBMITTED' && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-bold text-[10px] px-2 py-0.5">
                              미제출
                            </Badge>
                          )}
                          {row.status === 'REJECTED' && (
                            <Badge
                              variant="outline"
                              className={`font-bold text-[10px] px-2 py-0.5 ${
                                row.rawStatus === 'REVISION_REQUESTED'
                                  ? 'bg-orange-50 text-orange-800 border-orange-300'
                                  : 'bg-[#B01E23]/10 text-[#B01E23] border-[#B01E23]/30'
                              }`}
                            >
                              {row.rawStatus === 'REVISION_REQUESTED' ? '수정요청' : '반려됨'}
                            </Badge>
                          )}
                        </td>

                        {/* 성명 */}
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{row.name}</span>
                            <span className="text-[10px] font-normal text-slate-400">({row.role})</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{row.email}</div>
                        </td>

                        {/* 소속 부서 */}
                        <td className="p-2.5 text-slate-700 font-medium">
                          {row.dept || <span className="text-slate-400">(미지정)</span>}
                        </td>

                        {/* 주 업무명 */}
                        <td className="p-2.5 font-bold text-slate-800">
                          {row.documents && row.documents.length > 1 ? (
                            <div className="space-y-1">
                              {row.documents.map((d) => (
                                <div key={d.id} className="flex items-center gap-1.5 flex-wrap">
                                  <span>{d.primaryDuty}</span>
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-slate-50">
                                    {getHandoverStatusLabel(d.status)}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            row.primaryDuty
                          )}
                        </td>

                        {/* 제출 일시 */}
                        <td className="p-2.5 text-slate-500 text-[11px]">
                          {row.submittedAt ? row.submittedAt.slice(0, 10) : <span className="text-slate-400">-</span>}
                        </td>

                        {/* 인수자 수신 확인 */}
                        <td className="p-2.5">
                          {row.status === 'SUBMITTED' ? (
                            <div className="space-y-0.5">
                              <div className="font-semibold text-slate-800 text-[11px] truncate max-w-[120px]">
                                {row.targetSuccessorName || '인수자 미배정'}
                              </div>
                              {row.successorChecked ? (
                                <Badge className="bg-[#2471B2] hover:bg-[#2471B2] text-white font-bold text-[9px] px-1.5 py-0 shadow-2xs">
                                  확인 완료 {row.successorCheckedAt ? `(${row.successorCheckedAt.slice(5, 10)})` : ''}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-300 font-medium text-[9px] px-1.5 py-0">
                                  미확인 (대기)
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>

                        {/* 반려 사유 / 비고 */}
                        <td className="p-2.5 whitespace-nowrap">
                          {row.status === 'REJECTED' ? (
                            <div
                              className={`text-[11px] font-medium truncate max-w-[140px] ${
                                row.rawStatus === 'REVISION_REQUESTED' ? 'text-orange-700' : 'text-[#B01E23]'
                              }`}
                              title={row.revisionRequestReason || row.rejectionReason || (row.rawStatus === 'REVISION_REQUESTED' ? '수정 요청' : '반려')}
                            >
                              {row.revisionRequestReason || row.rejectionReason || (row.rawStatus === 'REVISION_REQUESTED' ? '수정 요청' : '반려')}
                            </div>
                          ) : row.status === 'SUBMITTED' ? (
                            <span className="text-[11px] font-semibold text-[#2471B2]">
                              {row.documents && row.documents.length > 1
                                ? `정상 제출 (${row.submittedDocCount || 1}/${row.documents.length})`
                                : row.rawStatus === 'SUBMITTED_WAITING_ACADEMIC_HEAD' || row.rawStatus === 'SUBMITTED_WAITING_SUCCESSOR'
                                ? '확인 대기'
                                : row.rawStatus === 'READY_FOR_VP_APPROVAL' || row.rawStatus === 'SUCCESSOR_APPROVED'
                                ? '교감 결재 대기'
                                : row.rawStatus === 'VICE_PRINCIPAL_APPROVED' || row.rawStatus === 'ARCHIVED'
                                ? '결재 완료'
                                : '제출 완료'}
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-600 font-medium">팝업 미확인</span>
                          )}
                        </td>

                        {/* 관리 액션 */}
                        <td className="p-2.5 text-center">
                          {row.documents && row.documents.length > 1 ? (
                            <div className="flex flex-col items-center gap-1">
                              {row.documents.map((d) => (
                                <div key={d.id} className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onOpenViewer?.(d)}
                                    className="h-6 text-[10px] font-bold text-[#2471B2] hover:bg-blue-50 px-1.5"
                                    title={`${d.primaryDuty} 열람`}
                                  >
                                    <ExternalLink className="w-3 h-3 mr-0.5" /> {d.primaryDuty.slice(0, 6)}
                                  </Button>
                                  {!isHandoverEditableByAuthor(d.status) && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openRejectModal({ ...row, documentId: d.id, document: d, primaryDuty: d.primaryDuty })}
                                      className="h-6 text-[10px] font-bold text-[#B01E23] border-[#B01E23]/30 hover:bg-rose-50 px-1.5"
                                    >
                                      <RotateCcw className="w-2.5 h-2.5" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              {/* 열람 버튼 */}
                              {row.document && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onOpenViewer?.(row.document!)}
                                  className="h-6 text-[10px] font-bold text-[#2471B2] hover:bg-blue-50 px-2"
                                >
                                  <ExternalLink className="w-3 h-3 mr-0.5" /> 열람
                                </Button>
                              )}

                              {/* 반려 버튼 (제출 완료된 건에 대해 반려 가능) */}
                              {row.status === 'SUBMITTED' && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openRejectModal(row)}
                                  className="h-6 text-[10px] font-bold text-[#B01E23] border-[#B01E23]/30 hover:bg-rose-50 px-2"
                                  title="인수인계서 반려하여 다시 작성 팝업이 뜨도록 함"
                                >
                                  <RotateCcw className="w-3 h-3 mr-0.5" /> 반려
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      {/* 2. 전체 교원 업무 배정 및 차년도 인수자 매핑 테이블 (서브탭 분리 및 datalist 초경량화) */}
      {adminSubTab === 'assignments' && (
        <Card className="border border-slate-200 rounded-2xl shadow-2xs bg-white">
          <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#2471B2]" />
                교원 업무 분장 및 차년도 인수자(후임) 매핑 ({assignments.length}명)
              </CardTitle>
              <p className="text-[11px] text-slate-500">
                각 교원의 주 업무 및 차년도 인수자를 지정하면, 대기 중인 인계서가 해당 인수자에게 자동 라우팅됩니다.
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleSaveAssignments}
              disabled={isSavingAssignments}
              className="h-8 text-xs font-bold bg-[#2471B2] hover:bg-[#1f5e94] text-white gap-1 shrink-0"
            >
              {isSavingAssignments ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              <span>배정표 저장</span>
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200">
                  <tr className="text-[11px] text-slate-600">
                    <th className="p-2.5 font-bold w-28">교원 성명</th>
                    <th className="p-2.5 font-bold w-36">이메일</th>
                    <th className="p-2.5 font-bold w-48">주 업무 (Primary Duty)</th>
                    <th className="p-2.5 font-bold">부 업무 (Sub Duties, 쉼표 구분)</th>
                    <th className="p-2.5 font-bold w-48">차년도 인수자 (후임자)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssignments.map(a => (
                    <tr key={a.teacherEmail} className="hover:bg-slate-50">
                      <td className="p-2 font-bold text-slate-900">{a.teacherName}</td>
                      <td className="p-2 text-slate-400 text-[11px] truncate max-w-[140px]">{a.teacherEmail}</td>
                      <td className="p-2">
                        <Input
                          value={a.primaryDuty || ''}
                          onChange={e => updateAssignment(a.teacherEmail, { primaryDuty: e.target.value })}
                          placeholder="예: 학생 안전지도 총괄"
                          className="h-7 text-xs bg-white border-slate-300 font-semibold"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={(a.subDuties || []).join(', ')}
                          onChange={e =>
                            updateAssignment(a.teacherEmail, {
                              subDuties: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                            })
                          }
                          placeholder="예: 안전점검, 순찰"
                          className="h-7 text-xs bg-white border-slate-300"
                        />
                      </td>
                      <td className="p-2">
                        {/* 초경량 Datalist 연동 자동완성 Input (수만 개의 DOM Option 제거로 렌더링 0ms 완료) */}
                        <Input
                          list="faculty-successor-datalist"
                          value={a.successorEmail ? `${a.successorName || a.successorEmail} (${a.successorEmail})` : ''}
                          onChange={e => {
                            const val = e.target.value;
                            const match = val.match(/\(([^)]+)\)/);
                            const email = match ? match[1].trim().toLowerCase() : val.trim().toLowerCase();
                            const selected = allFaculty.find(f => f.email.toLowerCase() === email);
                            updateAssignment(a.teacherEmail, {
                              successorEmail: email,
                              successorName: selected?.name || val.replace(/\s*\([^)]+\)/, '').trim(),
                            });
                          }}
                          placeholder="인수자 검색/입력..."
                          className="h-7 text-xs bg-white border-slate-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. 공지 팝업 발송 모달 */}
      <Dialog open={isNoticeDialogOpen} onOpenChange={setIsNoticeDialogOpen}>
        <DialogContent className="max-w-md p-5 bg-white border border-[#2471B2]/30 rounded-2xl shadow-xl">
          <DialogHeader className="space-y-1.5 pb-2 border-b">
            <div className="flex items-center gap-1.5">
              <BellRing className="w-4 h-4 text-[#2471B2] animate-pulse" />
              <Badge className="bg-[#2471B2] text-white font-bold text-xs">{year}학년도</Badge>
            </div>
            <DialogTitle className="text-sm sm:text-base font-bold text-slate-900">
              전 교원 인수인계서 작성 요청 팝업 발송
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              발송 시 모든 교직원이 앱에 접속할 때 인수인계서 작성 팝업이 뜨며, 제출할 때까지 계속 표출됩니다.
            </DialogDescription>
          </DialogHeader>

          {isLocked && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[#B01E23] flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>현재 인수인계가 <strong>마감(잠김)</strong> 상태입니다. 잠금을 해제해야 팝업을 발송할 수 있습니다.</span>
            </div>
          )}

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-700">공지 제목</Label>
              <Input
                value={noticeTitle}
                onChange={e => setNoticeTitle(e.target.value)}
                className="h-8 text-xs bg-white border-slate-300 font-semibold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-700">공지 및 안내 메시지</Label>
              <Textarea
                value={noticeMessage}
                onChange={e => setNoticeMessage(e.target.value)}
                rows={4}
                className="text-xs bg-white resize-none border-slate-300"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsNoticeDialogOpen(false)}
              className="h-8 text-xs"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSendNotice}
              disabled={isSendingNotice || isLocked}
              className="h-8 text-xs font-bold bg-[#2471B2] hover:bg-[#1f5e94] text-white gap-1 disabled:opacity-50"
            >
              {isSendingNotice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>작성 요청 팝업 발송하기</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. 인계서 반려 모달 */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="max-w-md p-5 bg-white border border-[#B01E23]/30 rounded-2xl shadow-xl">
          <DialogHeader className="space-y-1.5 pb-2 border-b">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-[#B01E23]" />
              <Badge className="bg-[#B01E23] text-white font-bold text-xs">인수인계서 반려</Badge>
            </div>
            <DialogTitle className="text-sm sm:text-base font-bold text-slate-900">
              {targetRejectRow?.name} 교사의 인계서를 반려하시겠습니까?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              반려 처리 시 해당 교사의 인계서 상태가 &apos;반려&apos;로 전환되며, 교사가 앱 접속 시 반려 사유와 함께 작성 팝업이 다시 노출됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 text-xs">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 space-y-1">
              <div><b>인계 대상 업무:</b> {targetRejectRow?.primaryDuty}</div>
              <div><b>소속 부서:</b> {targetRejectRow?.dept || '미지정'} ({targetRejectRow?.email})</div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-700">반려 사유 (교사에게 표시됨)</Label>
              <Textarea
                value={rejectionReasonInput}
                onChange={e => setRejectionReasonInput(e.target.value)}
                placeholder="예: 2학기 업무 추진 내역 보완 및 전년도 드라이브 폴더 링크 확인 후 재제출 요망"
                rows={3}
                className="text-xs bg-white border-slate-300 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectModalOpen(false)}
              className="h-8 text-xs"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmReject}
              disabled={isRejecting}
              className="h-8 text-xs font-bold bg-[#B01E23] hover:bg-[#96181c] text-white gap-1"
            >
              {isRejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              <span>반려 처리 확정</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. 확인 대기 인계서 수정 요청 / 반려 사유 모달 */}
      <HandoverFeedbackDialog
        open={stagingFeedbackOpen}
        onOpenChange={setStagingFeedbackOpen}
        mode={stagingFeedbackMode}
        targetDoc={stagingFeedbackDoc ? buildFeedbackTargetFromDoc(stagingFeedbackDoc) : null}
        isSubmitting={isSendingStagingFeedback}
        onConfirm={handleConfirmStagingFeedback}
      />
    </div>
  );
}
