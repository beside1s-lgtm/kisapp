'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { MainLayout } from '@/components/layout/main-layout';
import { HandoverEditor } from '@/components/handover/HandoverEditor';
import { HandoverViewer } from '@/components/handover/HandoverViewer';
import { HandoverAdminView } from '@/components/handover/HandoverAdminView';
import { VicePrincipalHandoverTab } from '@/components/handover/VicePrincipalHandoverTab';
import { FixtureHandoverMainTab } from '@/components/handover/fixture/FixtureHandoverMainTab';
import { HandoverDocument, HandoverStatus } from '@/lib/types/handover';
import {
  getHandoversByAuthor,
  getHandoversForSuccessor,
  getHandoversForVicePrincipal,
  resolveTeacherAssignedDutiesList,
  isSameHandoverDuty,
  isHandoverEditableByAuthor,
  isHandoverInAcademicHeadQueue,
  isHandoverAwaitingSuccessorSignature,
  isHandoverInVpQueue,
  getHandoverStatusLabel,
  deleteHandoverDraft,
  markHandoverSuccessorChecked,
  CURRENT_SCHOOL_YEAR
} from '@/lib/services/handoverService';
import { getOrgStructure } from '@/lib/services/settingsService';
import { checkHandoverAdminPermission } from '@/lib/services/permissionService';
import { OrgStructure } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileEdit,
  Inbox,
  ShieldCheck,
  Archive,
  Layers,
  PlusCircle,
  ExternalLink,
  ChevronLeft,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  FilePlus2,
  Package,
  FileText,
  Lock,
  LockOpen
} from 'lucide-react';
import {
  getHandoverLockStatus,
  setHandoverLockStatus,
  subscribeHandoverLockStatus,
  HandoverLockStatus
} from '@/lib/services/handoverLockService';
import { useToast } from '@/hooks/use-toast';

function HandoverPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainTabFromUrl = (searchParams.get('mainTab') as 'duty' | 'fixture') || 'duty';
  const tabFromUrl = searchParams.get('tab') || 'my';

  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [mainTab, setMainTab] = useState<'duty' | 'fixture'>(mainTabFromUrl);
  const [activeTab, setActiveTab] = useState<string>(tabFromUrl);
  const [org, setOrg] = useState<OrgStructure | null>(null);

  // 데이터 상태
  const [myDocs, setMyDocs] = useState<HandoverDocument[]>([]);
  const [receivedDocs, setReceivedDocs] = useState<HandoverDocument[]>([]);
  const [vpDocs, setVpDocs] = useState<HandoverDocument[]>([]);
  const [waitingAcademicHeadCount, setWaitingAcademicHeadCount] = useState<number>(0);
  const [archivedDocs, setArchivedDocs] = useState<HandoverDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 인수인계 잠금(마감) 상태 관리
  const [lockStatus, setLockStatus] = useState<HandoverLockStatus | null>(null);
  const [isLockUpdating, setIsLockUpdating] = useState<boolean>(false);
  const isLocked = Boolean(lockStatus?.isLocked);

  useEffect(() => {
    const unsub = subscribeHandoverLockStatus((status) => {
      setLockStatus(status);
    }, CURRENT_SCHOOL_YEAR);
    return () => unsub();
  }, []);
  const [selectedDocForView, setSelectedDocForView] = useState<HandoverDocument | null>(null);
  const [viewerMode, setViewerMode] = useState<'view' | 'successor' | 'vice_principal'>('view');
  const [selectedDocForEdit, setSelectedDocForEdit] = useState<HandoverDocument | null>(null);
  const [isEditingNew, setIsEditingNew] = useState(false);
  const [preselectedDutyForNew, setPreselectedDutyForNew] = useState<string | null>(null);

  const handleDeleteDraftDoc = async (docItem: HandoverDocument) => {
    if (!window.confirm(`"${docItem.primaryDuty}" 인수인계서 초안을 삭제하시겠습니까?`)) return;
    try {
      await deleteHandoverDraft(docItem.id);
      toast({ title: '삭제 완료', description: '인수인계서 초안이 삭제되었습니다.' });
      await loadAllData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: '삭제 실패', description: err?.message || '삭제 중 오류가 발생했습니다.' });
    }
  };

  const handleConfirmSuccessorCheck = async (docItem: HandoverDocument) => {
    if (!docItem.id || !user?.email) return;
    try {
      await markHandoverSuccessorChecked(docItem.id, user.email, profile?.name);
      toast({
        title: '인수 확인·서명 완료',
        description: `[${docItem.primaryDuty}] 인수자 서명이 완료되어 교무부장 확인 대기로 전달되었습니다.`,
      });
      await loadAllData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '수신 확인 실패',
        description: err?.message || '수신 확인 처리 중 오류가 발생했습니다.',
      });
    }
  };

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    setMainTab(mainTabFromUrl);
  }, [mainTabFromUrl]);

  const loadAllData = async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      const orgData = await getOrgStructure();
      setOrg(orgData as OrgStructure);

      const [myList, recList, allDocs] = await Promise.all([
        getHandoversByAuthor(user.email, CURRENT_SCHOOL_YEAR),
        getHandoversForSuccessor(user.email, CURRENT_SCHOOL_YEAR),
        getHandoversForVicePrincipal(CURRENT_SCHOOL_YEAR),
      ]);

      setMyDocs(myList);
      setReceivedDocs(recList);

      // 교감 결재 대기 문서 필터 (교무부장 확인 완료 후 상신된 건만 포함)
      setVpDocs(allDocs.filter(d => isHandoverInVpQueue(d.status)));
      setWaitingAcademicHeadCount(allDocs.filter(d => isHandoverInAcademicHeadQueue(d.status)).length);

      // 최종 아카이브 완료 문서
      setArchivedDocs(allDocs.filter(d => d.status === 'VICE_PRINCIPAL_APPROVED' || d.status === 'ARCHIVED'));
    } catch (err) {
      console.error('[HandoverPage] load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.email && !authLoading) {
      loadAllData();
    }
  }, [user?.email, authLoading]);

  // 권한 판별
  const userEmailLower = user?.email?.trim().toLowerCase() || '';
  const handoverPerm = checkHandoverAdminPermission(profile, org);
  const isAcademicHead =
    profile?.isAdmin ||
    (org?.academicHead && org.academicHead.trim().toLowerCase() === userEmailLower) ||
    handoverPerm.canAccess;

  const isVicePrincipal =
    profile?.isAdmin ||
    (org?.vicePrincipal && org.vicePrincipal.trim().toLowerCase() === userEmailLower);

  // 교무부장(또는 관리자) 인수인계 잠금 토글 액션
  const handleToggleLock = async () => {
    if (!isAcademicHead) return;
    const targetLock = !isLocked;
    const confirmMsg = targetLock
      ? '2026학년도 학년 말 인수인계 기능을 마감(잠금)하시겠습니까?\n\n잠금 시 교원들의 신규 작성 및 수정이 차단되며, 읽기 전용 및 인쇄만 가능해집니다.'
      : '2026학년도 학년 말 인수인계 기능을 다시 오픈(잠금 해제)하시겠습니까?\n\n잠금 해제 시 교원들이 인계서 작성, 수정, 제출을 다시 진행할 수 있습니다.';

    if (!window.confirm(confirmMsg)) return;

    setIsLockUpdating(true);
    try {
      await setHandoverLockStatus({
        isLocked: targetLock,
        userProfile: profile,
        year: CURRENT_SCHOOL_YEAR
      });
      toast({
        title: targetLock ? '인수인계 기능 잠금 완료' : '인수인계 기능 잠금 해제',
        description: targetLock
          ? '2026학년도 인수인계가 마감되어 교원들의 작성이 잠겼습니다.'
          : '2026학년도 인수인계가 다시 오픈되어 작성이 가능해졌습니다.'
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '잠금 상태 변경 실패',
        description: err?.message || '처리 중 오류가 발생했습니다.'
      });
    } finally {
      setIsLockUpdating(false);
    }
  };

  if (authLoading || !profile) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // 뷰어 열람 중인 경우
  if (selectedDocForView) {
    return (
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSelectedDocForView(null)}
          className="h-8 text-xs font-bold gap-1 text-slate-700 hover:bg-slate-100"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>목록으로 돌아가기</span>
        </Button>

        <HandoverViewer
          document={selectedDocForView}
          currentUserProfile={profile}
          mode={viewerMode}
          onUpdated={() => {
            loadAllData();
            setSelectedDocForView(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 최상위 2대 메인 모드 탭: 업무 인수인계 vs 비품 인수인계 (학교 공식 색상: KIS Blue #2471B2) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-blue-50/20 p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#2471B2] text-white rounded-xl shadow-xs">
            {mainTab === 'duty' ? <FileText className="w-4 h-4" /> : <Package className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                {mainTab === 'duty' ? '교원 업무 인수인계' : '학급・특별실 비품 인수인계'}
              </h2>
              <Badge variant="outline" className="text-[10px] font-bold bg-white text-[#2471B2] border-[#2471B2]/30">
                2026학년도
              </Badge>
              {isLocked ? (
                <Badge className="text-[10px] font-bold bg-[#B01E23] text-white gap-1 px-1.5 shadow-2xs">
                  <Lock className="w-3 h-3" />
                  <span>마감(잠김)</span>
                </Badge>
              ) : (
                <Badge className="text-[10px] font-bold bg-emerald-600 text-white gap-1 px-1.5 shadow-2xs">
                  <LockOpen className="w-3 h-3" />
                  <span>진행중(열림)</span>
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {mainTab === 'duty'
                ? '개인별 기안문서, 연간 추진과업, 시기별 인계 타임라인을 관리합니다.'
                : '학급 및 특별실 비품 인계서 작성, 품목 학습 템플릿 및 교감 입회 확인을 관리합니다.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-end">
          {/* 교무부장(또는 관리자) 전용 학년 말 인수인계 잠금/열림 제어 토글 버튼 */}
          {isAcademicHead && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border bg-white shadow-2xs">
              <span className="text-[11px] font-bold text-slate-600 hidden md:inline">
                인수인계 제어:
              </span>
              <button
                type="button"
                disabled={isLockUpdating}
                onClick={handleToggleLock}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  isLocked
                    ? 'bg-rose-50 text-[#B01E23] border border-rose-200 hover:bg-rose-100'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                }`}
                title={isLocked ? '클릭 시 인수인계 잠금 해제 (재오픈)' : '클릭 시 인수인계 잠금 (마감)'}
              >
                {isLockUpdating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isLocked ? (
                  <Lock className="w-3.5 h-3.5 text-[#B01E23]" />
                ) : (
                  <LockOpen className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>{isLocked ? '인수인계 잠김 (열기)' : '인수인계 열림 (잠그기)'}</span>
              </button>
            </div>
          )}

          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => {
                setMainTab('duty');
                router.replace(`/teacher/handover?mainTab=duty&tab=${activeTab}`);
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                mainTab === 'duty'
                  ? 'bg-white text-[#2471B2] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>업무 인수인계</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMainTab('fixture');
                router.replace(`/teacher/handover?mainTab=fixture`);
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                mainTab === 'fixture'
                  ? 'bg-white text-[#2471B2] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>비품 인수인계</span>
            </button>
          </div>
        </div>
      </div>

      {/* 잠금 안내 배너 (isLocked === true일 때 최상단 노출) */}
      {isLocked && (
        <div className="p-3.5 bg-rose-50/80 border border-rose-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-2 bg-[#B01E23] text-white rounded-xl shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-[#B01E23]">
                  2026학년도 학년 말 인수인계가 최종 마감(잠금)되었습니다.
                </span>
                {lockStatus?.lockedByName && (
                  <span className="text-[11px] text-slate-500">
                    ({lockStatus.lockedByName} 처리 | {lockStatus.lockedAt ? lockStatus.lockedAt.split('T')[0] : ''})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                교무부장(관리자)이 인수인계를 마감하여 신규 작성, 수정, 제출이 제한됩니다. 기제출된 문서는 언제든 열람 및 A4 인쇄/PDF 저장이 가능합니다.
              </p>
            </div>
          </div>
          {isAcademicHead && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLockUpdating}
              onClick={handleToggleLock}
              className="h-7 text-xs font-bold gap-1 text-[#2471B2] border-[#2471B2]/30 bg-white hover:bg-blue-50 shrink-0"
            >
              <LockOpen className="w-3.5 h-3.5" />
              <span>잠금 해제 (재오픈)</span>
            </Button>
          )}
        </div>
      )}

      {mainTab === 'fixture' ? (
        <FixtureHandoverMainTab currentUserProfile={profile} org={org} isLocked={isLocked} />
      ) : (
        /* 기존 업무 인수인계 전체 탭 */
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val);
            router.replace(`/teacher/handover?mainTab=duty&tab=${val}`);
            setIsEditingNew(false);
            setSelectedDocForEdit(null);
          }}
          className="w-full"
        >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-2">
          <TabsList className="bg-slate-100 p-1 rounded-xl h-auto flex flex-wrap gap-1">
            <TabsTrigger
              value="my"
              className="text-xs font-bold px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-[#2471B2] data-[state=active]:shadow-2xs rounded-lg gap-1.5"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>내 인수인계서 작성/제출</span>
              {myDocs.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-blue-50 text-[#2471B2] font-bold">
                  {myDocs.length}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="received"
              className="text-xs font-bold px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-[#2471B2] data-[state=active]:shadow-2xs rounded-lg gap-1.5"
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>수신 인수인계 목록</span>
              {receivedDocs.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-blue-50 text-[#2471B2] font-bold">
                  {receivedDocs.length}
                </Badge>
              )}
            </TabsTrigger>

            {isVicePrincipal && (
              <TabsTrigger
                value="vice_principal"
                className="text-xs font-bold px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-[#2471B2] data-[state=active]:shadow-2xs rounded-lg gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>교감 최종 결재</span>
                {vpDocs.length > 0 && (
                  <Badge className="text-[10px] h-4 px-1 bg-[#B01E23] text-white font-bold animate-pulse">
                    {vpDocs.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}

            <TabsTrigger
              value="archive"
              className="text-xs font-bold px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-2xs rounded-lg gap-1.5"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>전년도 업무 보관함</span>
            </TabsTrigger>

            {isAcademicHead && (
              <TabsTrigger
                value="admin"
                className="text-xs font-bold px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-[#2471B2] data-[state=active]:shadow-2xs rounded-lg gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-[#2471B2]" />
                <span>교무부장 총괄 관리</span>
                {waitingAcademicHeadCount > 0 && (
                  <Badge className="text-[10px] h-4 px-1 bg-[#2471B2] text-white font-bold">
                    {waitingAcademicHeadCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* ─── 탭 1: 내 인수인계서 작성/제출 ──────────────────────── */}
        <TabsContent value="my" className="mt-4 space-y-6">
          {(() => {
            const assignedDuties = user?.email
              ? resolveTeacherAssignedDutiesList(user.email, org, profile?.dept)
              : [];
            const unwrittenDuties = assignedDuties.filter(
              (duty) => !myDocs.some((d) => isSameHandoverDuty(d.primaryDuty, duty))
            );
            const hasMultiDuty = assignedDuties.length >= 2;
            const hasSingleCoveredDraft =
              myDocs.length === 1 && myDocs[0].status === 'DRAFT' && unwrittenDuties.length === 0;
            const showSummaryCards =
              !isEditingNew &&
              !selectedDocForEdit &&
              (myDocs.length > 0 || hasMultiDuty) &&
              !hasSingleCoveredDraft;
            const editorInitialDoc =
              selectedDocForEdit || (hasSingleCoveredDraft && !isEditingNew ? myDocs[0] : null);
            const effectiveDefaultDuty =
              preselectedDutyForNew || (!editorInitialDoc ? unwrittenDuties[0] || assignedDuties[0] || null : null);
            const showEditor =
              isEditingNew ||
              Boolean(selectedDocForEdit) ||
              hasSingleCoveredDraft ||
              (myDocs.length === 0 && !hasMultiDuty);

            return (
              <>
                {showSummaryCards && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <h3 className="font-bold text-sm text-slate-800">
                          내 업무별 인수인계서 ({myDocs.length}건
                          {assignedDuties.length > 0 ? ` / 담당 업무 ${assignedDuties.length}개` : ''})
                        </h3>
                        {hasMultiDuty && (
                          <p className="text-[11px] text-slate-500">
                            담당 업무가 여러 개인 경우 각 업무별로 별도의 인수인계서를 작성해 제출할 수 있습니다.
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isLocked}
                        onClick={() => {
                          if (isLocked) {
                            alert('2026학년도 학년 말 인수인계가 최종 마감(잠금)되어 신규 작성이 불가합니다.');
                            return;
                          }
                          setPreselectedDutyForNew(unwrittenDuties[0] || null);
                          setSelectedDocForEdit(null);
                          setIsEditingNew(true);
                        }}
                        className={`h-8 text-xs font-bold gap-1 shrink-0 ${
                          isLocked
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-[#2471B2] hover:bg-[#1f5e94] text-white'
                        }`}
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>새 인수인계서 작성</span>
                      </Button>
                    </div>

                    {unwrittenDuties.length > 0 && (
                      <div className="p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/50 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                            <FilePlus2 className="w-4 h-4 text-indigo-600" />
                            <span>미작성 담당 업무 ({unwrittenDuties.length}건) — 업무별 인수인계서 작성</span>
                          </span>
                          <span className="text-[11px] text-indigo-700 font-medium">
                            아래 업무를 선택하면 해당 업무 전용 타임라인과 폴더가 자동 구성된 작성기가 열립니다.
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {unwrittenDuties.map((duty) => (
                            <Button
                              key={duty}
                              type="button"
                              variant="outline"
                              disabled={isLocked}
                              onClick={() => {
                                if (isLocked) {
                                  alert('2026학년도 학년 말 인수인계가 최종 마감(잠금)되어 신규 작성이 불가합니다.');
                                  return;
                                }
                                setPreselectedDutyForNew(duty);
                                setSelectedDocForEdit(null);
                                setIsEditingNew(true);
                              }}
                              className={`h-auto py-2 px-3 justify-between border-indigo-200 text-left gap-2 ${
                                isLocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-indigo-50'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-extrabold text-slate-900 truncate">{duty}</div>
                                <div className="text-[10px] text-indigo-600 font-semibold">인수인계서 작성하기</div>
                              </div>
                              <PlusCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {myDocs.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {myDocs.map(doc => (
                          <Card
                            key={doc.id}
                            className="p-4 border border-slate-200 rounded-xl hover:border-indigo-300 transition-all space-y-3 shadow-2xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-black text-xs sm:text-sm text-slate-900">
                                    {doc.primaryDuty}
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-medium">({doc.year}학년도)</span>
                                </div>
                                {doc.subDuties && doc.subDuties.length > 0 && (
                                  <p className="text-[11px] text-slate-500">병행 표기 업무: {doc.subDuties.join(', ')}</p>
                                )}
                              </div>

                              <div>
                                {doc.status === 'DRAFT' && <Badge variant="outline" className="text-[10px]">작성 중</Badge>}
                                {(doc.status === 'SUBMITTED_WAITING_ACADEMIC_HEAD' || doc.status === 'SUBMITTED_WAITING_SUCCESSOR') && (
                                  <Badge variant="outline" className="bg-sky-50 text-sky-800 text-[10px] border-sky-300 font-bold">
                                    {getHandoverStatusLabel(doc.status)}
                                  </Badge>
                                )}
                                {doc.status === 'ASSIGNED_TO_SUCCESSOR' && (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-800 text-[10px] border-blue-300 font-bold">
                                    인수자 배정 완료
                                  </Badge>
                                )}
                                {(doc.status === 'READY_FOR_VP_APPROVAL' || doc.status === 'SUCCESSOR_APPROVED') && (
                                  <Badge variant="outline" className="bg-purple-50 text-purple-800 text-[10px] border-purple-300 font-bold">
                                    {getHandoverStatusLabel(doc.status)}
                                  </Badge>
                                )}
                                {(doc.status === 'VICE_PRINCIPAL_APPROVED' || doc.status === 'ARCHIVED') && (
                                  <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                                    최종 승인 완료
                                  </Badge>
                                )}
                                {doc.status === 'REVISION_REQUESTED' && (
                                  <Badge variant="outline" className="bg-orange-50 text-orange-800 text-[10px] border-orange-300 font-bold">
                                    수정 요청 (보완 필요)
                                  </Badge>
                                )}
                                {doc.status === 'REJECTED' && (
                                  <Badge variant="destructive" className="text-[10px] font-bold">
                                    반려 (보완 필요)
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {doc.status === 'REVISION_REQUESTED' && doc.revisionRequestReason && (
                              <div className="p-2 rounded-lg bg-orange-50 border border-orange-200 text-[11px] text-orange-900">
                                <b>수정 요청 ({doc.revisionRequestedByRole || '교감'}):</b> {doc.revisionRequestReason}
                              </div>
                            )}
                            {doc.status === 'REJECTED' && doc.rejectionReason && (
                              <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-900">
                                <b>반려 사유:</b> {doc.rejectionReason}
                              </div>
                            )}

                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs text-slate-600 space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span>배정 인수자:</span>
                                <span className="font-bold text-slate-800">
                                  {doc.targetSuccessorName || '미배정 (대기 중)'}
                                </span>
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span>인계 항목 수:</span>
                                <span className="font-bold text-indigo-600">{(doc.items || []).length}건</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                              {isHandoverEditableByAuthor(doc.status) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteDraftDoc(doc)}
                                  className="h-7 px-2 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 mr-auto gap-1"
                                  title="초안 삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>삭제</span>
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedDocForView(doc);
                                  setViewerMode('view');
                                }}
                                className="h-7 text-xs font-semibold px-2.5"
                              >
                                열람 / 인쇄
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => setSelectedDocForEdit(doc)}
                                className="h-7 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5"
                              >
                                수정하기
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {showEditor && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {(isEditingNew || selectedDocForEdit) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditingNew(false);
                            setSelectedDocForEdit(null);
                            setPreselectedDutyForNew(null);
                          }}
                          className="h-8 text-xs font-bold gap-1 text-slate-700"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>내 인계서 목록으로</span>
                        </Button>
                      ) : hasSingleCoveredDraft ? (
                        <span className="text-xs font-bold text-slate-600">
                          작성 중인 인수인계서 ({myDocs[0].primaryDuty})
                        </span>
                      ) : <span />}

                      {!isEditingNew && hasSingleCoveredDraft && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPreselectedDutyForNew(null);
                            setSelectedDocForEdit(null);
                            setIsEditingNew(true);
                          }}
                          className="h-8 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>다른 업무 인수인계서 추가 작성</span>
                        </Button>
                      )}
                    </div>

                    <HandoverEditor
                      key={editorInitialDoc?.id || `new_${effectiveDefaultDuty || 'default'}`}
                      initialDocument={editorInitialDoc}
                      defaultDuty={effectiveDefaultDuty}
                      currentUserProfile={profile}
                      year={CURRENT_SCHOOL_YEAR}
                      orgStructure={org}
                      onSaved={(_, savedStatus) => {
                        loadAllData();
                        if (savedStatus !== 'DRAFT') {
                          setIsEditingNew(false);
                          setSelectedDocForEdit(null);
                          setPreselectedDutyForNew(null);
                        }
                      }}
                    />
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>

        {/* ─── 탭 2: 수신 인수인계 목록 (인수자 모드) ────────────── */}
        <TabsContent value="received" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">
              내가 인수해야 할 업무 목록 ({receivedDocs.length}건)
            </h3>
            <span className="text-xs text-slate-400">
              배정된 인수인계서를 검토한 후 인수 확인 서명을 진행하세요.
            </span>
          </div>

          {receivedDocs.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
              <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">수신된 인수인계서가 없습니다.</p>
              <p className="text-[11px] text-slate-400">
                새 학년도 업무 분장이 확정되어 관리자에 의해 인수자로 지정되면 이곳에 자동 배정됩니다.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {receivedDocs.map(doc => (
                <Card
                  key={doc.id}
                  className="p-4 border border-blue-200 bg-white rounded-xl hover:border-blue-300 transition-all space-y-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="font-black text-xs sm:text-sm text-blue-950">
                        {doc.primaryDuty}
                      </span>
                      <p className="text-[11px] text-slate-500">인계자: {doc.authorName} ({doc.authorEmail})</p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {doc.successorChecked ? (
                        <Badge className="bg-[#2471B2] text-white text-[10px] font-bold shadow-2xs">
                          {doc.successorSignature ? '인수 서명 완료' : '수신 확인 완료'}
                        </Badge>
                      ) : isHandoverAwaitingSuccessorSignature(doc) ? (
                        <Badge className="bg-[#B01E23] text-white text-[10px] font-bold animate-pulse shadow-2xs">
                          확인·서명 필요
                        </Badge>
                      ) : null}

                      {doc.successorChecked && isHandoverInAcademicHeadQueue(doc.status) && (
                        <Badge variant="outline" className="bg-sky-50 text-sky-800 text-[10px] border-sky-300 font-bold">
                          교무부장 확인 대기
                        </Badge>
                      )}
                      {doc.status === 'READY_FOR_VP_APPROVAL' && (
                        <Badge variant="outline" className="bg-[#C49832]/10 text-[#8d6917] text-[10px] border-[#C49832]/40 font-bold">
                          교감 결재 대기
                        </Badge>
                      )}
                      {doc.status === 'SUCCESSOR_APPROVED' && (
                        <Badge variant="outline" className="bg-[#C49832]/10 text-[#8d6917] text-[10px] border-[#C49832]/40 font-bold">
                          인수 완료 (교감 결재 대기)
                        </Badge>
                      )}
                      {doc.status === 'VICE_PRINCIPAL_APPROVED' && (
                        <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                          최종 승인 완료
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="bg-blue-50/50 p-2.5 rounded-lg border border-[#2471B2]/20 text-xs text-blue-900 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span>인계 항목 수:</span>
                      <span className="font-bold text-[#2471B2]">{(doc.items || []).length}건</span>
                    </div>
                    {doc.folderUrl && (
                      <div className="text-[11px] truncate">
                        <span>폴더: </span>
                        <a href={doc.folderUrl} target="_blank" className="underline font-bold text-[#2471B2]">
                          {doc.folderUrl}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100 flex-wrap">
                    {isHandoverAwaitingSuccessorSignature(doc) && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleConfirmSuccessorCheck(doc)}
                        className="h-8 text-xs font-bold bg-[#2471B2] hover:bg-[#1f5e94] text-white px-3 gap-1 shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>확인 및 서명</span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedDocForView(doc);
                        setViewerMode(isHandoverAwaitingSuccessorSignature(doc) ? 'successor' : 'view');
                      }}
                      className="h-8 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-50 px-3 gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{isHandoverAwaitingSuccessorSignature(doc) ? '열람 후 서명' : '상세 열람'}</span>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── 탭 3: 교감 최종 결재 ──────────────────────────────── */}
        {isVicePrincipal && (
          <TabsContent value="vice_principal" className="mt-4">
            <VicePrincipalHandoverTab
              vpDocs={vpDocs}
              waitingAcademicHeadCount={waitingAcademicHeadCount}
              currentUserProfile={profile}
              onOpenViewer={(doc) => {
                setSelectedDocForView(doc);
                setViewerMode('vice_principal');
              }}
              onUpdated={loadAllData}
            />
          </TabsContent>
        )}

        {/* ─── 탭 4: 전년도 업무 보관함 (아카이브) ─────────────────── */}
        <TabsContent value="archive" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">
              최종 결재 완료 및 아카이브 보관함 ({archivedDocs.length}건)
            </h3>
            <span className="text-xs text-slate-400">
              결재가 완료된 인수인계서와 전년도 업무 드라이브 폴더 링크를 언제든 열람할 수 있습니다.
            </span>
          </div>

          {archivedDocs.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-1">
              <Archive className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">보관된 아카이브 문서가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {archivedDocs.map(doc => (
                <Card
                  key={doc.id}
                  className="p-4 border border-emerald-200 bg-white rounded-xl hover:border-emerald-300 transition-all space-y-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="font-black text-xs sm:text-sm text-emerald-950">
                        {doc.primaryDuty}
                      </span>
                      <p className="text-[11px] text-slate-500">
                        인계자: {doc.authorName} | 인수자: {doc.targetSuccessorName}
                      </p>
                    </div>
                    <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                      아카이브 완료
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {doc.folderUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(doc.folderUrl, '_blank')}
                          className="h-7 text-[11px] font-bold text-slate-700 border-slate-300 hover:bg-slate-50 px-2 gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>업무 폴더</span>
                        </Button>
                      )}
                      {doc.archivedDriveFolderUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(doc.archivedDriveFolderUrl, '_blank')}
                          className="h-7 text-[11px] font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 px-2 gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>{doc.archivedTargetYear || (Number(doc.year) + 1)}년 인수인계 폴더</span>
                        </Button>
                      )}
                      {doc.archivedDriveFileUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(doc.archivedDriveFileUrl, '_blank')}
                          className="h-7 text-[11px] font-bold text-indigo-700 border-indigo-200 hover:bg-indigo-50 px-2 gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>결재완료 파일</span>
                        </Button>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedDocForView(doc);
                        setViewerMode('view');
                      }}
                      className="h-7 text-xs font-semibold px-2.5"
                    >
                      상세 / 인쇄
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── 탭 5: 교무부장 총괄 관리 ─────────────────────────── */}
        {isAcademicHead && (
          <TabsContent value="admin" className="mt-4">
            <HandoverAdminView
              currentUserProfile={profile}
              year={CURRENT_SCHOOL_YEAR}
              org={org}
              isLocked={isLocked}
              onOpenViewer={(d) => {
                setSelectedDocForView(d);
                setViewerMode('view');
              }}
              onDocumentsChanged={() => {
                loadAllData();
              }}
            />
          </TabsContent>
        )}
      </Tabs>
      )}
    </div>
  );
}

export default function TeacherHandoverPage() {
  return (
    <MainLayout title="학년 말 인수인계">
      <Suspense fallback={
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      }>
        <HandoverPageContent />
      </Suspense>
    </MainLayout>
  );
}
