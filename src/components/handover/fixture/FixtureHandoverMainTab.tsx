'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, OrgStructure } from '@/lib/types';
import { FixtureHandoverDocument } from '@/lib/types/fixtureHandover';
import {
  getFixtureDocuments,
  markFixtureSuccessorChecked,
  forwardFixtureHandoversToVicePrincipal,
  bulkApproveFixtureDocuments,
  recallFixtureDocument,
  openFixturePrintWindow,
  getFixtureStatusLabel,
  getDisplayVicePrincipalName
} from '@/lib/services/fixtureHandoverService';
import { CURRENT_SCHOOL_YEAR } from '@/lib/services/handoverService';
import { checkHandoverAdminPermission } from '@/lib/services/permissionService';
import { FixtureHandoverEditor } from './FixtureHandoverEditor';
import { FixtureHandoverViewer } from './FixtureHandoverViewer';
import { FixtureHandoverList } from './FixtureHandoverList';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Package,
  School,
  Building2,
  FileEdit,
  ListFilter,
  ShieldCheck,
  CheckCircle2,
  Clock,
  PlusCircle,
  Loader2,
  Inbox,
  Send,
  Eye,
  RotateCcw,
  User,
  Key,
  Printer,
  ChevronLeft
} from 'lucide-react';

interface FixtureHandoverMainTabProps {
  currentUserProfile: UserProfile;
  org: OrgStructure | null;
  isLocked?: boolean;
}

export function FixtureHandoverMainTab({
  currentUserProfile,
  org,
  isLocked = false
}: FixtureHandoverMainTabProps) {
  const { toast } = useToast();
  const userEmailLower = currentUserProfile.email?.trim().toLowerCase() || '';
  const handoverPerm = checkHandoverAdminPermission(currentUserProfile, org);

  const isAcademicHead =
    currentUserProfile.isAdmin ||
    (org?.academicHead && org.academicHead.trim().toLowerCase() === userEmailLower) ||
    handoverPerm.canAccess;

  const isVicePrincipal =
    currentUserProfile.isAdmin ||
    (org?.vicePrincipal && org.vicePrincipal.trim().toLowerCase() === userEmailLower);

  const isVpOrAdmin = isVicePrincipal || isAcademicHead;

  // 상태 관리
  const [activeSubTab, setActiveSubTab] = useState<'write' | 'received' | 'academic' | 'vp' | 'list'>('write');
  const [allDocs, setAllDocs] = useState<FixtureHandoverDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 작성/수정 모드 여부 (이미 제출된 문서가 있는 경우 기본값 false -> 제출 완료 페이지 표시)
  const [isWritingOrEditing, setIsWritingOrEditing] = useState(false);
  const [selectedSubmittedDocId, setSelectedSubmittedDocId] = useState<string | null>(null);

  // 교무부장 일괄 상신 선택 상태
  const [selectedAcademicIds, setSelectedAcademicIds] = useState<string[]>([]);
  const [isForwardingToVp, setIsForwardingToVp] = useState(false);

  // 교감 일괄 결재 선택 상태
  const [selectedVpIds, setSelectedVpIds] = useState<string[]>([]);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // 현재 열람 / 수정 중인 문서
  const [selectedDocForView, setSelectedDocForView] = useState<FixtureHandoverDocument | null>(null);
  const [selectedDocForEdit, setSelectedDocForEdit] = useState<FixtureHandoverDocument | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      console.log('[FixtureMainTab.loadData] fetching fixture docs...');
      const docs = await getFixtureDocuments(CURRENT_SCHOOL_YEAR);
      console.log('[FixtureMainTab.loadData] fetched docs count:', docs.length, docs);
      setAllDocs(docs);

      const myDocs = docs.filter(
        (d) => d.authorEmail?.trim().toLowerCase() === userEmailLower
      );
      const mySubmitted = myDocs.filter((d) => d.status && d.status !== 'DRAFT');
      const myDraft = myDocs.find((d) => !d.status || d.status === 'DRAFT');

      // 제출된 문서가 있으면 기본 선택 설정
      if (mySubmitted.length > 0) {
        if (!selectedSubmittedDocId || !mySubmitted.some((d) => d.id === selectedSubmittedDocId)) {
          setSelectedSubmittedDocId(mySubmitted[0].id);
        }
      } else {
        // 제출된 문서가 없으면 바로 작성 폼 열기
        setIsWritingOrEditing(true);
      }

      // 작성 초안이 있으면 에디터 초기값 바인딩
      if (myDraft && !selectedDocForEdit) {
        setSelectedDocForEdit(myDraft);
      }
    } catch (err) {
      console.error('[FixtureHandoverMainTab] load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userEmailLower]);

  // 통계 계산
  const totalCount = allDocs.length;
  const classroomCount = allDocs.filter((d) => d.type === 'CLASSROOM').length;
  const specialCount = allDocs.filter((d) => d.type === 'SPECIAL_ROOM').length;

  // 1단계: 후임 인수자 확인 대기
  const waitingSuccessorCount = allDocs.filter(
    (d) => d.status === 'SUBMITTED_WAITING_SUCCESSOR'
  ).length;

  // 2단계: 교무부장 확인 대기 (인수자 확인 완료 또는 미지정 건)
  const waitingAcademicDocs = allDocs.filter(
    (d) => d.status === 'SUBMITTED_WAITING_ACADEMIC_HEAD' || d.status === 'SUBMITTED'
  );
  const waitingAcademicCount = waitingAcademicDocs.length;

  // 3단계: 교감 결재 대기
  const readyVpDocs = allDocs.filter((d) => d.status === 'READY_FOR_VP_APPROVAL');
  const readyVpCount = readyVpDocs.length;

  // 4단계: 교감 확인 완료
  const approvedCount = allDocs.filter((d) => d.status === 'APPROVED').length;

  // 내게 전달된 수신 비품 인계서
  const myReceivedDocs = allDocs.filter(
    (d) => d.successorEmail?.trim().toLowerCase() === userEmailLower
  );
  const myPendingReceivedCount = myReceivedDocs.filter(
    (d) => d.status === 'SUBMITTED_WAITING_SUCCESSOR' || !d.successorChecked
  ).length;

  // 내 작성 문서 목록 및 제출 완료 문서 판별
  const myDocs = allDocs.filter(
    (d) => d.authorEmail?.trim().toLowerCase() === userEmailLower
  );
  const mySubmittedDocs = myDocs.filter((d) => d.status && d.status !== 'DRAFT');
  const myDraftDocs = myDocs.filter((d) => !d.status || d.status === 'DRAFT');

  // 현재 활성화된 제출 완료 문서
  const currentSubmittedDoc =
    mySubmittedDocs.find((d) => d.id === selectedSubmittedDocId) ||
    mySubmittedDocs[0] ||
    null;

  // 인계자 문서 회수 액션 (제출 후 수정이 필요할 때)
  const handleRecallDoc = async (docToRecall: FixtureHandoverDocument) => {
    if (isLocked) {
      alert('2026학년도 학년 말 인수인계가 최종 마감(잠금)되어 인계서를 회수할 수 없습니다.\n\n수정이 필요한 경우 교무부장에게 잠금 해제를 요청하세요.');
      return;
    }
    if (
      !window.confirm(
        '제출한 비품 인계서를 회수하시겠습니까?\n\n회수 시 후임자 확인 및 교무부장 대기 상태가 초기화되어 작성 중(임시저장) 상태로 변경되며, 내용을 수정한 후 다시 제출하실 수 있습니다.'
      )
    ) {
      return;
    }
    try {
      await recallFixtureDocument(docToRecall.id);
      toast({
        title: '비품 인계서 회수 완료',
        description: '비품 인계서가 회수되었습니다. 수정 후 다시 제출해주세요.'
      });
      await loadData();
      const updated = await getFixtureDocuments(CURRENT_SCHOOL_YEAR);
      const found = updated.find((d) => d.id === docToRecall.id);
      setSelectedDocForEdit(found || { ...docToRecall, status: 'DRAFT' });
      setIsWritingOrEditing(true);
      setActiveSubTab('write');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '회수 처리 실패',
        description: err?.message || '처리 중 오류가 발생했습니다.'
      });
    }
  };

  // 1. 단일 문서 열람 뷰어
  if (selectedDocForView) {
    return (
      <FixtureHandoverViewer
        document={selectedDocForView}
        currentUserProfile={currentUserProfile}
        org={org}
        isLocked={isLocked}
        isVicePrincipalOrAdmin={isVpOrAdmin}
        isAcademicHead={isAcademicHead}
        onBack={() => setSelectedDocForView(null)}
        onRecall={async (docToRecall) => {
          setSelectedDocForView(null);
          await handleRecallDoc(docToRecall);
        }}
        onEdit={() => {
          setSelectedDocForEdit(selectedDocForView);
          setSelectedDocForView(null);
          setIsWritingOrEditing(true);
          setActiveSubTab('write');
        }}
        onStatusUpdated={async () => {
          await loadData();
          setSelectedDocForView(null);
        }}
      />
    );
  }

  // 후임자 단건 수신 확인 액션
  const handleCheckReceivedDoc = async (docItem: FixtureHandoverDocument) => {
    const isClass = docItem.type === 'CLASSROOM';
    const name = isClass ? `${docItem.grade}학년 ${docItem.classNum}반` : docItem.roomName;
    if (!window.confirm(`"${name}" 비품 목록 및 윈도우 비밀번호를 확인하였으며, 수신 확인을 완료하시겠습니까?`)) {
      return;
    }
    try {
      await markFixtureSuccessorChecked(
        docItem.id,
        currentUserProfile.name || '',
        currentUserProfile.email || ''
      );
      toast({
        title: '비품 수신 확인 완료',
        description: `"${name}" 비품 인계서가 확인 완료되어 교무부장 확인 대기로 전달되었습니다.`
      });
      await loadData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '확인 처리 실패',
        description: err?.message || '처리 중 오류가 발생했습니다.'
      });
    }
  };

  // 교무부장 일괄 상신 액션
  const handleBulkForwardToVp = async () => {
    if (selectedAcademicIds.length === 0) return;
    if (!window.confirm(`선택한 ${selectedAcademicIds.length}건의 비품 인계서를 교무부장 확인 완료 처리하여 교감 최종 결재로 일괄 상신하시겠습니까?`)) {
      return;
    }
    setIsForwardingToVp(true);
    try {
      await forwardFixtureHandoversToVicePrincipal(
        selectedAcademicIds,
        currentUserProfile.name || '교무부장',
        currentUserProfile.email || ''
      );
      toast({
        title: '일괄 교감 상신 완료',
        description: `${selectedAcademicIds.length}건의 비품 인계서가 교감 최종 결재 대기열로 상신되었습니다.`
      });
      setSelectedAcademicIds([]);
      await loadData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '상신 처리 실패',
        description: err?.message || '상신 처리 중 오류가 발생했습니다.'
      });
    } finally {
      setIsForwardingToVp(false);
    }
  };

  // 교감 일괄 최종 결재 액션
  const handleBulkVpApprove = async () => {
    if (selectedVpIds.length === 0) return;
    if (!window.confirm(`선택한 ${selectedVpIds.length}건의 비품 인계서에 대해 교감 최종 입회(결재)를 일괄 승인하시겠습니까?`)) {
      return;
    }
    setIsBulkApproving(true);
    try {
      await bulkApproveFixtureDocuments(
        selectedVpIds,
        currentUserProfile.name || getDisplayVicePrincipalName(null, org),
        currentUserProfile.email || ''
      );
      toast({
        title: '일괄 최종 결재 완료',
        description: `${selectedVpIds.length}건의 비품 인계서가 최종 승인되었습니다.`
      });
      setSelectedVpIds([]);
      await loadData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '결재 처리 실패',
        description: err?.message || '결재 처리 중 오류가 발생했습니다.'
      });
    } finally {
      setIsBulkApproving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 요약 통계 카드 바 (KIS 학교 브랜드 테마) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-3.5 flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-[#2471B2] rounded-lg">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500">전체 등록</span>
              <p className="text-base font-bold text-slate-900">{totalCount}건</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-3.5 flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-[#2471B2] rounded-lg">
              <School className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500">학급 비품</span>
              <p className="text-base font-bold text-[#2471B2]">{classroomCount}건</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-3.5 flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500">특별실 비품</span>
              <p className="text-base font-bold text-amber-700">{specialCount}건</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-3.5 flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500">인수/부장 대기</span>
              <p className="text-base font-bold text-amber-700">
                {waitingSuccessorCount + waitingAcademicCount}건
                <span className="text-[10px] text-slate-400 font-normal ml-1">
                  (인수 {waitingSuccessorCount} / 부장 {waitingAcademicCount})
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
          <CardContent className="p-3.5 flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500">교감 결재 / 완료</span>
              <p className="text-base font-bold text-emerald-700">
                대기 {readyVpCount} / 완료 {approvedCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 내부 서브 탭 네비게이션 */}
      <Tabs
        value={activeSubTab}
        onValueChange={(val) => setActiveSubTab(val as any)}
        className="w-full"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-2">
          <TabsList className="bg-slate-100 p-1 rounded-xl h-auto flex flex-wrap gap-1">
            <TabsTrigger
              value="write"
              className="text-xs font-bold px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-[#2471B2] data-[state=active]:shadow-2xs rounded-lg gap-1.5"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>
                {mySubmittedDocs.length > 0 && !isWritingOrEditing
                  ? '내 비품 인계서 (제출 완료)'
                  : '내 비품 인계서 작성/수정'}
              </span>
              {mySubmittedDocs.length > 0 && !isWritingOrEditing && (
                <Badge className="text-[10px] h-4 px-1.5 bg-emerald-600 text-white font-bold ml-1">
                  제출 완료
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="received"
              className="text-xs font-bold px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-[#2471B2] data-[state=active]:shadow-2xs rounded-lg gap-1.5"
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>수신 비품 인계서 목록</span>
              {myPendingReceivedCount > 0 ? (
                <Badge className="text-[10px] h-4 px-1.5 bg-[#B01E23] text-white font-bold">
                  {myPendingReceivedCount}
                </Badge>
              ) : myReceivedDocs.length > 0 ? (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-slate-200 text-slate-700 font-bold">
                  {myReceivedDocs.length}
                </Badge>
              ) : null}
            </TabsTrigger>

            {isVpOrAdmin && (
              <TabsTrigger
                value="academic"
                className="text-xs font-bold px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-[#2471B2] data-[state=active]:shadow-2xs rounded-lg gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>교무부장 총괄 확인 및 교감 상신</span>
                {waitingAcademicCount > 0 && (
                  <Badge className="text-[10px] h-4 px-1.5 bg-[#2471B2] text-white font-bold">
                    {waitingAcademicCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}

            {isVpOrAdmin && (
              <TabsTrigger
                value="vp"
                className="text-xs font-bold px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-2xs rounded-lg gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>교감 최종 결재</span>
                {readyVpCount > 0 && (
                  <Badge className="text-[10px] h-4 px-1.5 bg-emerald-600 text-white font-bold">
                    {readyVpCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}

            <TabsTrigger
              value="list"
              className="text-xs font-bold px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-800 data-[state=active]:shadow-2xs rounded-lg gap-1.5"
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>전체 비품 인계서 목록</span>
              {totalCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-slate-200 text-slate-700 font-bold">
                  {totalCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {activeSubTab === 'write' && (
            <div className="flex items-center gap-2">
              {currentSubmittedDoc && !isWritingOrEditing ? (
                !isLocked && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDocForEdit(null);
                      setIsWritingOrEditing(true);
                    }}
                    className="h-7 text-xs font-bold gap-1 text-[#2471B2] border-[#2471B2]/30 bg-blue-50/50 hover:bg-blue-50"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>새 비품 인계서 추가 작성</span>
                  </Button>
                )
              ) : mySubmittedDocs.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsWritingOrEditing(false)}
                  className="h-7 text-xs font-bold gap-1 text-slate-700 border-slate-300 hover:bg-slate-50"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>제출 완료 문서로 돌아가기</span>
                </Button>
              ) : null}
            </div>
          )}
        </div>

        {/* 1. 내 비품 인계서 (제출 완료 뷰 또는 작성/수정 에디터) */}
        <TabsContent value="write" className="mt-4">
          {currentSubmittedDoc && !isWritingOrEditing ? (
            <div className="space-y-5">
              {/* 복수 제출 건이 있을 때 문서 선택 탭 바 */}
              {mySubmittedDocs.length > 1 && (
                <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
                  <span className="text-xs font-bold text-slate-600 shrink-0 ml-1">
                    제출된 비품 인계서 ({mySubmittedDocs.length}건):
                  </span>
                  <div className="flex items-center gap-1.5">
                    {mySubmittedDocs.map((docItem) => {
                      const isSel = docItem.id === currentSubmittedDoc.id;
                      const title =
                        docItem.type === 'CLASSROOM'
                          ? `${docItem.grade}학년 ${docItem.classNum}반`
                          : docItem.roomName || '특별실';
                      return (
                        <button
                          key={docItem.id}
                          type="button"
                          onClick={() => setSelectedSubmittedDocId(docItem.id)}
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                            isSel
                              ? 'bg-white text-[#2471B2] shadow-2xs border border-[#2471B2]/20'
                              : 'text-slate-600 hover:bg-slate-200/60'
                          }`}
                        >
                          {title} ({getFixtureStatusLabel(docItem.status)})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 제출 완료 안내 배너 카드 */}
              <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-blue-50/70 border border-emerald-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900">
                          {currentSubmittedDoc.type === 'CLASSROOM'
                            ? `${currentSubmittedDoc.grade}학년 ${currentSubmittedDoc.classNum}반 학급 비품 인계서`
                            : `${currentSubmittedDoc.roomName} 특별실 비품 인계서`}
                        </h3>
                        <Badge className="bg-emerald-600 text-white font-bold text-xs">
                          제출 완료
                        </Badge>
                        <Badge variant="outline" className="text-slate-600 border-slate-300 font-bold text-xs">
                          진행상태: {getFixtureStatusLabel(currentSubmittedDoc.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        비품 인계서가 정상 제출되었습니다. 후임 인수자의 확인 및 교무부장/교감 결재 현황을 확인하실 수 있습니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openFixturePrintWindow(currentSubmittedDoc)}
                      className="h-8 text-xs font-bold gap-1.5 text-[#2471B2] border-[#2471B2]/30 bg-white/80 hover:bg-white shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>A4 원클릭 인쇄</span>
                    </Button>

                    {isLocked ? (
                      <Badge className="bg-rose-50 text-[#B01E23] border border-rose-200 text-xs px-2.5 py-1">
                        인수인계 마감 (수정/회수 잠김)
                      </Badge>
                    ) : currentSubmittedDoc.status !== 'APPROVED' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRecallDoc(currentSubmittedDoc)}
                        className="h-8 text-xs font-bold gap-1.5 text-[#B01E23] border-[#B01E23]/30 bg-white/80 hover:bg-rose-50 shadow-2xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>회수하여 수정하기</span>
                      </Button>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-xs px-2.5 py-1">
                        교감 승인 완료 (수정 불가)
                      </Badge>
                    )}

                    {!isLocked && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDocForEdit(null);
                          setIsWritingOrEditing(true);
                        }}
                        className="h-8 text-xs font-bold gap-1 text-slate-700 bg-white/80 hover:bg-white border-slate-200 shadow-2xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>추가 작성</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* 4단계 인계-결재 프로세스 상태 바 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-emerald-100/80">
                  <div className="p-2.5 bg-white/90 rounded-xl border border-emerald-100 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">1. 인계서 제출</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                      {currentSubmittedDoc.authorName || '인계자'} (완료)
                    </p>
                    <span className="text-[10px] text-slate-400">인계자 전자 서명 날인</span>
                  </div>

                  <div className="p-2.5 bg-white/90 rounded-xl border border-emerald-100 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">2. 후임 인수자 확인</span>
                      {currentSubmittedDoc.successorChecked ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                      {currentSubmittedDoc.successorName || '후임자 미지정'}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {currentSubmittedDoc.successorChecked
                        ? '확인 완료 (서명 날인)'
                        : currentSubmittedDoc.successorName
                        ? '수신 확인 대기 중'
                        : '미지정 (자동 패스)'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white/90 rounded-xl border border-emerald-100 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">3. 교무부장 총괄 확인</span>
                      {currentSubmittedDoc.academicHeadChecked ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                      {currentSubmittedDoc.academicHeadName || '교무부장'}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {currentSubmittedDoc.academicHeadChecked ? '확인 완료 (교감 상신)' : '상신 대기 중'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white/90 rounded-xl border border-emerald-100 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">4. 교감 최종 결재</span>
                      {currentSubmittedDoc.status === 'APPROVED' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                      {getDisplayVicePrincipalName(currentSubmittedDoc, org)}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {currentSubmittedDoc.status === 'APPROVED' ? '입회 결재 완료 (도장 날인)' : '결재 대기 중'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 제출된 인계서 상세 내용 뷰어 */}
              <FixtureHandoverViewer
                document={currentSubmittedDoc}
                currentUserProfile={currentUserProfile}
                org={org}
                isLocked={isLocked}
                isVicePrincipalOrAdmin={isVpOrAdmin}
                isAcademicHead={isAcademicHead}
                hideBackButton={true}
                onBack={() => {}}
                onRecall={() => handleRecallDoc(currentSubmittedDoc)}
                onEdit={() => {
                  setSelectedDocForEdit(currentSubmittedDoc);
                  setIsWritingOrEditing(true);
                }}
                onStatusUpdated={async () => {
                  await loadData();
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {mySubmittedDocs.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200/70 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#2471B2]" />
                    <span className="text-xs font-bold text-[#2471B2]">
                      현재 {mySubmittedDocs.length}건의 비품 인계서가 이미 제출되어 있습니다.
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsWritingOrEditing(false)}
                    className="h-7 text-xs font-bold gap-1 text-slate-700 bg-white hover:bg-slate-50 border-slate-300"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>제출 완료 문서 보기</span>
                  </Button>
                </div>
              )}
              <FixtureHandoverEditor
                initialDoc={selectedDocForEdit}
                currentUserProfile={currentUserProfile}
                org={org}
                isLocked={isLocked}
                onSaved={async (docId) => {
                  await loadData();
                  const updated = await getFixtureDocuments(CURRENT_SCHOOL_YEAR);
                  const found = updated.find((d) => d.id === docId);
                  if (found && found.status && found.status !== 'DRAFT') {
                    setSelectedSubmittedDocId(found.id);
                    setIsWritingOrEditing(false);
                  } else if (found) {
                    setSelectedDocForEdit(found);
                  }
                }}
              />
            </div>
          )}
        </TabsContent>

        {/* 2. 수신 비품 인계서 목록 탭 */}
        <TabsContent value="received" className="mt-4 space-y-4">
          <Card className="border border-slate-200 rounded-2xl shadow-2xs bg-white">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <CardTitle className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Inbox className="w-4 h-4 text-[#2471B2]" />
                  <span>내게 전달된 수신 비품 인계서 ({myReceivedDocs.length}건)</span>
                </CardTitle>
                <p className="text-[11px] text-slate-500">
                  전임자가 나를 차년도 후임 인수자로 지정하여 제출한 비품 인계서입니다. 비품 품목과 윈도우 비밀번호를 확인 후 수신 확인을 완료하세요.
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {myReceivedDocs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  현재 나에게 전달된 수신 비품 인계서가 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myReceivedDocs.map((docItem) => {
                    const isClass = docItem.type === 'CLASSROOM';
                    const name = isClass ? `${docItem.grade}학년 ${docItem.classNum}반` : docItem.roomName;
                    const isChecked = docItem.successorChecked || docItem.status !== 'SUBMITTED_WAITING_SUCCESSOR';

                    return (
                      <Card key={docItem.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/40">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-50 text-[#2471B2] rounded-lg">
                              {isClass ? <School className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                                <span>{name}</span>
                                <Badge variant="outline" className="text-[10px] font-semibold bg-white">
                                  {isClass ? '학급 비품' : '특별실'}
                                </Badge>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                인계자: {docItem.authorName} 교사 | 인계일: {docItem.handoverDate}
                              </div>
                            </div>
                          </div>
                          {isChecked ? (
                            <Badge className="bg-emerald-600 text-white font-bold text-[10px] gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>수신 확인 완료</span>
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500 text-white font-bold text-[10px] gap-1 animate-pulse">
                              <Clock className="w-3 h-3" />
                              <span>수신 확인 필요</span>
                            </Badge>
                          )}
                        </div>

                        <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                            <Key className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>윈도우 비밀번호:</span>
                            <span className="font-extrabold underline">{docItem.windowsPassword || '없음'}</span>
                          </div>
                          <span className="text-[11px] text-slate-600">
                            비품 품목: <strong>{docItem.items?.length || 0}개</strong>
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDocForView(docItem)}
                            className="h-7 text-xs font-bold gap-1 text-slate-700 hover:bg-slate-100"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>상세 열람</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openFixturePrintWindow(docItem)}
                            className="h-7 text-xs font-bold gap-1 text-[#2471B2] border-[#2471B2]/30 hover:bg-blue-50"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>A4 인쇄</span>
                          </Button>
                          {!isChecked && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleCheckReceivedDoc(docItem)}
                              className="h-7 text-xs font-bold gap-1 bg-[#2471B2] hover:bg-[#1f5e94] text-white shadow-2xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>수신 확인 완료</span>
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. 교무부장 총괄 확인 및 교감 상신 탭 */}
        {isVpOrAdmin && (
          <TabsContent value="academic" className="mt-4 space-y-4">
            <Card className="border border-slate-200 rounded-2xl shadow-2xs bg-white">
              <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <CardTitle className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#2471B2]" />
                    <span>교무부장 확인 대기 및 일괄 교감 결재 상신 ({waitingAcademicDocs.length}건)</span>
                  </CardTitle>
                  <p className="text-[11px] text-slate-500">
                    교원이 제출하거나 인수자가 수신 확인한 비품 인계서가 이곳에 모입니다. 내용을 검토한 후 일괄로 교감 최종 결재로 상신하세요.
                  </p>
                </div>

                {waitingAcademicDocs.length > 0 && (
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedAcademicIds.length === waitingAcademicDocs.length) {
                          setSelectedAcademicIds([]);
                        } else {
                          setSelectedAcademicIds(waitingAcademicDocs.map((d) => d.id));
                        }
                      }}
                      className="h-8 text-xs font-bold text-slate-700 border-slate-300"
                    >
                      <span>
                        {selectedAcademicIds.length === waitingAcademicDocs.length ? '전체 해제' : `전체 선택 (${waitingAcademicDocs.length})`}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isForwardingToVp || selectedAcademicIds.length === 0}
                      onClick={handleBulkForwardToVp}
                      className="h-8 text-xs font-bold gap-1 bg-[#2471B2] hover:bg-[#1f5e94] text-white shadow-2xs"
                    >
                      {isForwardingToVp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>확인 완료 / 상신 ({selectedAcademicIds.length}건)</span>
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-4">
                {waitingAcademicDocs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    교무부장 확인 대기 중인 비품 인계서가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {waitingAcademicDocs.map((docItem) => {
                      const isClass = docItem.type === 'CLASSROOM';
                      const name = isClass ? `${docItem.grade}학년 ${docItem.classNum}반` : docItem.roomName;
                      const isSelected = selectedAcademicIds.includes(docItem.id);

                      return (
                        <div
                          key={docItem.id}
                          className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                            isSelected ? 'bg-blue-50/40 border-[#2471B2]' : 'bg-slate-50/30 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                setSelectedAcademicIds((prev) =>
                                  checked ? [...prev, docItem.id] : prev.filter((id) => id !== docItem.id)
                                );
                              }}
                            />
                            <div>
                              <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-2">
                                <span>{name}</span>
                                <Badge variant="outline" className="text-[10px] bg-white text-slate-700">
                                  {isClass ? '학급 비품' : '특별실'}
                                </Badge>
                                <Badge className="text-[10px] bg-[#2471B2] text-white font-bold">
                                  {getFixtureStatusLabel(docItem.status)}
                                </Badge>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>인계자: {docItem.authorName}</span>
                                <span>→</span>
                                <span>인수자: {docItem.successorName || '미정'}</span>
                                {docItem.successorChecked ? (
                                  <span className="text-emerald-700 font-bold">(인수자 수신확인 완료)</span>
                                ) : docItem.successorEmail ? (
                                  <span className="text-amber-600 font-medium">(인수자 확인 대기)</span>
                                ) : (
                                  <span className="text-slate-400">(인수자 미정)</span>
                                )}
                                <span>|</span>
                                <span>품목: {docItem.items?.length || 0}개</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedDocForView(docItem)}
                              className="h-7 text-xs font-bold gap-1 text-[#2471B2] hover:bg-blue-50"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>열람</span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openFixturePrintWindow(docItem)}
                              className="h-7 text-xs font-bold gap-1 text-slate-700 border-slate-300 hover:bg-slate-50"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>인쇄</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* 4. 교감 최종 결재 탭 */}
        {isVpOrAdmin && (
          <TabsContent value="vp" className="mt-4 space-y-4">
            <Card className="border border-slate-200 rounded-2xl shadow-2xs bg-white">
              <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <CardTitle className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>교감 일괄 최종 결재 ({readyVpDocs.length}건)</span>
                  </CardTitle>
                  <p className="text-[11px] text-slate-500">
                    교무부장이 확인을 마치고 상신한 비품 인계서입니다. 검토 후 한 번에 일괄 결재하여 입회 확인을 완료하세요.
                  </p>
                </div>

                {readyVpDocs.length > 0 && (
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedVpIds.length === readyVpDocs.length) {
                          setSelectedVpIds([]);
                        } else {
                          setSelectedVpIds(readyVpDocs.map((d) => d.id));
                        }
                      }}
                      className="h-8 text-xs font-bold text-slate-700 border-slate-300"
                    >
                      <span>
                        {selectedVpIds.length === readyVpDocs.length ? '전체 해제' : `전체 선택 (${readyVpDocs.length})`}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isBulkApproving || selectedVpIds.length === 0}
                      onClick={handleBulkVpApprove}
                      className="h-8 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                    >
                      {isBulkApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      <span>일괄 최종 결재 ({selectedVpIds.length}건)</span>
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-4">
                {readyVpDocs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    교감 결재 대기 중인 비품 인계서가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {readyVpDocs.map((docItem) => {
                      const isClass = docItem.type === 'CLASSROOM';
                      const name = isClass ? `${docItem.grade}학년 ${docItem.classNum}반` : docItem.roomName;
                      const isSelected = selectedVpIds.includes(docItem.id);

                      return (
                        <div
                          key={docItem.id}
                          className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                            isSelected ? 'bg-emerald-50/40 border-emerald-600' : 'bg-slate-50/30 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                setSelectedVpIds((prev) =>
                                  checked ? [...prev, docItem.id] : prev.filter((id) => id !== docItem.id)
                                );
                              }}
                            />
                            <div>
                              <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-2">
                                <span>{name}</span>
                                <Badge variant="outline" className="text-[10px] bg-white text-slate-700">
                                  {isClass ? '학급 비품' : '특별실'}
                                </Badge>
                                <Badge className="text-[10px] bg-[#C49832] text-white font-bold">
                                  교감 결재 대기
                                </Badge>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>인계자: {docItem.authorName}</span>
                                <span>→</span>
                                <span>인수자: {docItem.successorName || '미정'}</span>
                                <span>|</span>
                                <span>부장 확인: {docItem.academicHeadName || '교무부장'}</span>
                                <span>|</span>
                                <span>품목: {docItem.items?.length || 0}개</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedDocForView(docItem)}
                              className="h-7 text-xs font-bold gap-1 text-[#2471B2] hover:bg-blue-50"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>열람</span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openFixturePrintWindow(docItem)}
                              className="h-7 text-xs font-bold gap-1 text-slate-700 border-slate-300 hover:bg-slate-50"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>인쇄</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* 5. 전체 목록 탭 */}
        <TabsContent value="list" className="mt-4">
          <FixtureHandoverList
            documents={allDocs}
            currentUserProfile={currentUserProfile}
            isVicePrincipalOrAdmin={isVpOrAdmin}
            onViewDoc={(doc) => setSelectedDocForView(doc)}
            onEditDoc={(doc) => {
              setSelectedDocForEdit(doc);
              setActiveSubTab('write');
            }}
            onRefresh={loadData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
