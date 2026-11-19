'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { getGoogleDriveConfig, onOrgStructureUpdate } from '@/lib/services/settingsService';
import type { Attachment, GoogleDriveConfig, OrgStructure } from '@/lib/types';
import type {
  CustomDutyStandardDoc,
  CustomDutyWorkspace,
  CustomFeatureUpgradeRequest,
} from '@/lib/types/customDuty';
import {
  deleteCustomDutyStandardDoc,
  normalizeDutyTitle,
  onCustomDutyWorkspaceUpdate,
  onCustomFeatureRequestsUpdate,
  resolveAllOrgCustomDuties,
  resolveAssignedCustomDuties,
  saveCustomDutyWorkspace,
  uploadCustomDutyAttachmentFile,
} from '@/lib/services/customDutyService';
import { resetStandardDocTemplateOverride } from '@/lib/services/standardDocTemplateService';
import { resolveDriveFoldersForDuties } from '@/lib/drive/deptFolderMapping';
import { CURRENT_SCHOOL_YEAR } from '@/lib/services/handoverService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  FilePlus2,
  FileText,
  FolderOpen,
  Layers,
  Loader2,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { StandardDocEditorDialog } from '@/components/custom-duty/StandardDocEditorDialog';
import { FeatureUpgradeRequestDialog } from '@/components/custom-duty/FeatureUpgradeRequestDialog';
import { UpgradedModulesPanel } from '@/components/custom-duty/UpgradedModulesPanel';
import {
  downloadAttachmentSafely,
  formatAttachmentSize,
} from '@/components/custom-duty/attachmentDownloadHelper';

function CustomDutyWorkspaceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [orgData, setOrgData] = useState<Partial<OrgStructure> | null>(null);
  const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig | null>(null);
  const [workspace, setWorkspace] = useState<CustomDutyWorkspace | null>(null);
  const [allRequests, setAllRequests] = useState<CustomFeatureUpgradeRequest[]>([]);
  const [uploadingRef, setUploadingRef] = useState(false);

  const [isDocEditorOpen, setIsDocEditorOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<CustomDutyStandardDoc | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  useEffect(() => {
    const unsubOrg = onOrgStructureUpdate((org) => setOrgData(org));
    getGoogleDriveConfig().then((cfg) => setDriveConfig(cfg)).catch(() => {});
    const unsubReqs = onCustomFeatureRequestsUpdate((list) => setAllRequests(list));
    return () => {
      unsubOrg();
      unsubReqs();
    };
  }, []);

  const isSystemManager = useMemo(() => {
    if (!user?.email) return false;
    if (profile?.isAdmin) return true;
    const emailLower = user.email.toLowerCase();
    return Boolean(orgData?.systemManagers?.some((m) => m?.toLowerCase() === emailLower));
  }, [user?.email, profile?.isAdmin, orgData?.systemManagers]);

  const selectableDuties = useMemo(() => {
    const mine = resolveAssignedCustomDuties(user?.email, orgData, profile);
    if (!isSystemManager) return mine;
    const orgAll = resolveAllOrgCustomDuties(orgData);
    const map = new Map(mine.map((d) => [d.dutyName, d]));
    orgAll.forEach((d) => {
      if (!map.has(d.dutyName)) map.set(d.dutyName, d);
    });
    return Array.from(map.values());
  }, [user?.email, orgData, profile, isSystemManager]);

  const rawDutyParam = searchParams.get('duty') || '';
  const activeDutyName = useMemo(() => {
    if (rawDutyParam.trim()) return normalizeDutyTitle(rawDutyParam);
    return selectableDuties[0]?.dutyName || '';
  }, [rawDutyParam, selectableDuties]);

  useEffect(() => {
    if (!activeDutyName) {
      setWorkspace(null);
      return;
    }
    const unsub = onCustomDutyWorkspaceUpdate(activeDutyName, orgData, (ws) => {
      setWorkspace(ws);
    });
    return () => unsub();
  }, [activeDutyName, orgData]);

  const matchedDriveFolder = useMemo(() => {
    if (!activeDutyName || !driveConfig) return null;
    const list = resolveDriveFoldersForDuties(
      [activeDutyName],
      driveConfig,
      CURRENT_SCHOOL_YEAR,
      workspace?.deptName,
      orgData
    );
    return list[0] || null;
  }, [activeDutyName, driveConfig, workspace?.deptName, orgData]);

  const dutyRequests = useMemo(() => {
    if (!activeDutyName) return [];
    return allRequests.filter(
      (r) => normalizeDutyTitle(r.dutyName) === normalizeDutyTitle(activeDutyName)
    );
  }, [allRequests, activeDutyName]);

  const latestRequest = dutyRequests[0] || null;

  const handleUploadReferenceFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !workspace || !user?.email) return;

    setUploadingRef(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files)) {
        const res = await uploadCustomDutyAttachmentFile(file, workspace.id);
        uploaded.push(res.attachment);
      }
      await saveCustomDutyWorkspace({
        ...workspace,
        referenceFiles: [...(workspace.referenceFiles || []), ...uploaded],
        updatedBy: user.email,
      });
      toast({
        title: '자료 업로드 완료',
        description: `${uploaded.length}개의 붙임문서/참고 파일이 저장되었습니다.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '업로드 실패',
        description: err?.message || '파일 업로드 중 오류가 발생했습니다.',
      });
    } finally {
      setUploadingRef(false);
      e.target.value = '';
    }
  };

  const handleRemoveRefFile = async (index: number) => {
    if (!workspace || !user?.email) return;
    const next = (workspace.referenceFiles || []).filter((_, i) => i !== index);
    await saveCustomDutyWorkspace({
      ...workspace,
      referenceFiles: next,
      updatedBy: user.email,
    });
  };

  const handleDraftWithStandardDoc = (docItem: CustomDutyStandardDoc) => {
    if (!workspace) return;
    sessionStorage.setItem(
      'pending_doc_draft',
      JSON.stringify({
        templateKey: docItem.templateKey,
        templateName: `${workspace.dutyName} - ${docItem.title}`,
        dutyName: workspace.dutyName,
        title: docItem.title,
        content: docItem.content,
        attachments: docItem.attachments || [],
        handoverCategory: workspace.dutyName,
        driveTargetFolderId: matchedDriveFolder?.folderId || '',
        driveTargetFolderUrl: matchedDriveFolder?.folderUrl || '',
        driveTargetDeptName: matchedDriveFolder?.deptName || workspace.deptName || '',
        driveTargetTaskName: matchedDriveFolder?.folderName || workspace.dutyName,
      })
    );
    router.push(`/new?customTemplate=true&templateKey=${encodeURIComponent(docItem.templateKey)}`);
  };

  const handleDeleteStandardDoc = async (docItem: CustomDutyStandardDoc) => {
    if (!workspace) return;
    if (!window.confirm(`"${docItem.title}" 표준 기안문서를 삭제하시겠습니까?`)) return;
    try {
      await deleteCustomDutyStandardDoc(workspace.dutyName, docItem.id, orgData);
      await resetStandardDocTemplateOverride(docItem.templateKey).catch(() => {});
      toast({ title: '삭제 완료', description: '표준 기안문서가 삭제되었습니다.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '삭제 실패', description: err?.message });
    }
  };

  if (!activeDutyName) {
    return (
      <div className="flex-1 w-full h-full min-h-0 overflow-y-auto overscroll-contain">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24 sm:pb-10 space-y-4">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => router.push('/inbox')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              홈으로
            </Button>
            <h1 className="text-lg font-extrabold text-slate-900">맞춤형 커스텀 업무</h1>
          </div>
          <Card>
            <CardContent className="py-14 text-center space-y-2">
              <Layers className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">배정된 커스텀 업무가 없습니다.</p>
              <p className="text-xs text-slate-500">
                시스템 설정 → 조직도에서 신규 담당 업무가 배정되면 전용 업무기능 페이지가 자동으로 열립니다.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const wsStatus = workspace?.status || 'empty';
  const statusBadge =
    wsStatus === 'upgraded'
      ? { label: '업무기능 업그레이드 완료', className: 'bg-emerald-600 text-white' }
      : wsStatus === 'in_progress'
        ? { label: '시스템 구축 진행 중', className: 'bg-amber-500 text-white' }
        : wsStatus === 'requested'
          ? { label: '업무기능 추가 요청됨', className: 'bg-indigo-600 text-white' }
          : { label: '빈 업무기능 (표준서식 등록 및 요청 대기)', className: 'bg-slate-600 text-white' };

  return (
    <div className="flex-1 w-full h-full min-h-0 overflow-y-auto overscroll-contain">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 pb-24 sm:pb-12 space-y-5">
      {/* 상단 네비 & 업무 전환 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push('/inbox')}
            className="h-8 px-2.5 text-xs font-bold shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            대시보드
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight truncate">
                {activeDutyName}
              </h1>
              <Badge className={`text-[10px] font-bold ${statusBadge.className}`}>
                {statusBadge.label}
              </Badge>
              {workspace?.deptName && (
                <Badge variant="outline" className="text-[10px] font-bold bg-white text-indigo-700 border-indigo-200">
                  {workspace.deptName}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              표준 기안문서와 붙임문서를 관리하고, 필요한 업무기능을 시스템 담당자에게 요청할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {selectableDuties.length > 1 && (
            <Select
              value={activeDutyName}
              onValueChange={(val) =>
                router.push(`/teacher/custom-duty?duty=${encodeURIComponent(val)}`)
              }
            >
              <SelectTrigger className="h-8 w-44 text-xs font-bold bg-white">
                <SelectValue placeholder="업무 전환" />
              </SelectTrigger>
              <SelectContent>
                {selectableDuties.map((d) => (
                  <SelectItem key={d.workspaceId} value={d.dutyName} className="text-xs font-medium">
                    {d.dutyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {matchedDriveFolder?.folderUrl && (
            <a
              href={matchedDriveFolder.folderUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Drive 폴더</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <Button
            type="button"
            size="sm"
            onClick={() => setIsRequestModalOpen(true)}
            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-2xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>업무기능 추가 요청</span>
          </Button>
        </div>
      </div>

      {/* 초기 빈 페이지 안내 또는 시스템 담당자 업그레이드 안내 배너 */}
      {wsStatus === 'upgraded' && workspace?.upgradedSummary ? (
        <Card className="border-emerald-200 bg-emerald-50/60 shadow-2xs">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-950">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>시스템 담당자가 &apos;{activeDutyName}&apos; 맞춤 업무기능을 업그레이드했습니다</span>
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed">
                {workspace.upgradedSummary}
              </p>
              {workspace.upgradedAt && (
                <p className="text-[10px] text-emerald-700">
                  처리자: {workspace.upgradedBy || '시스템 담당자'} ·{' '}
                  {new Date(workspace.upgradedAt).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
            {workspace.upgradedRoute && !workspace.upgradedRoute.startsWith('/teacher/custom-duty') && (
              <Link href={workspace.upgradedRoute}>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shrink-0">
                  <span>전용 페이지 열기</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-indigo-200 bg-linear-to-r from-indigo-50/70 via-white to-sky-50/60 shadow-2xs">
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-950">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>
                  {wsStatus === 'requested'
                    ? '시스템 담당자에게 업무기능 추가 요청이 접수되었습니다'
                    : `'${activeDutyName}' 맞춤형 업무기능 초기 페이지입니다`}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                현재 전용 기능 모듈이 구축되기 전 단계입니다. 아래에 <strong>표준 기안문서</strong>와 <strong>붙임문서</strong>를 등록해 두시면 바로 기안·기본값 저장에 활용할 수 있으며, <strong>[업무기능 추가 요청]</strong>을 보내시면 시스템 담당자가 알림 팝업을 받아 맞춤 기능을 구축해 드립니다.
              </p>
              {latestRequest?.adminNotes && (
                <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1">
                  시스템 담당자 회신: {latestRequest.adminNotes}
                </p>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsRequestModalOpen(true)}
              className="h-8 text-xs font-bold border-indigo-300 text-indigo-800 bg-white hover:bg-indigo-50 shrink-0 gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{latestRequest ? '요청 추가/재요청하기' : '지금 기능 요청 보내기'}</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 시스템 담당자가 활성화한 업그레이드 기능 모듈 (맞춤 표 / 체크리스트 / 결재 이력) */}
      {workspace && user?.email && (
        <UpgradedModulesPanel workspace={workspace} userEmail={user.email} />
      )}

      {/* 섹션 1: 표준 기안문서 목록 (수정 -> 기본값 저장 -> 즉시 기안 작성) */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-extrabold flex items-center gap-2 text-slate-900">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>{activeDutyName} 표준 기안문서 및 서식 관리</span>
              <Badge variant="outline" className="text-[10px] font-bold">
                {(workspace?.standardDocs || []).length}건
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              표준 기안문서 틀과 붙임문서를 등록·수정하고 기본값으로 설정해 두면, 다음 기안 시 수정된 서식이 자동으로 적용됩니다.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditingDoc(null);
              setIsDocEditorOpen(true);
            }}
            className="h-8 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>표준 기안문서 추가</span>
          </Button>
        </CardHeader>
        <CardContent>
          {!workspace || (workspace.standardDocs || []).length === 0 ? (
            <div className="py-10 px-4 text-center border border-dashed rounded-xl bg-slate-50/60 space-y-2.5">
              <FilePlus2 className="w-9 h-9 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                아직 등록된 표준 기안문서가 없습니다.
              </p>
              <p className="text-[11px] text-slate-500">
                자주 쓰는 공문서 제목, 본문 틀, 붙임문서 양식을 등록해 두세요.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingDoc(null);
                  setIsDocEditorOpen(true);
                }}
                className="h-8 text-xs font-bold border-indigo-200 text-indigo-700 bg-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                첫 표준 기안문서 등록하기
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {workspace.standardDocs.map((docItem) => (
                <div
                  key={docItem.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-slate-900 truncate">
                        {docItem.title}
                      </span>
                      {docItem.isDefault && (
                        <Badge className="bg-indigo-600 text-white text-[9px] font-bold shrink-0">
                          기본 서식
                        </Badge>
                      )}
                    </div>
                    {docItem.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {docItem.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span>붙임 {docItem.attachments?.length || 0}건</span>
                      <span>·</span>
                      <span>
                        수정: {docItem.updatedByName || docItem.updatedBy} (
                        {docItem.updatedAt
                          ? new Date(docItem.updatedAt).toLocaleDateString('ko-KR')
                          : ''}
                        )
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleDraftWithStandardDoc(docItem)}
                      className="h-7 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex-1 gap-1"
                    >
                      <FilePlus2 className="w-3.5 h-3.5" />
                      <span>이 서식으로 기안 작성</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingDoc(docItem);
                        setIsDocEditorOpen(true);
                      }}
                      className="h-7 px-2.5 text-xs font-bold gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>수정/기본값</span>
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteStandardDoc(docItem)}
                      className="h-7 w-7 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 섹션 2: 붙임문서 / 업무 매뉴얼 / 참고 자료 보관함 */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-extrabold flex items-center gap-2 text-slate-900">
              <Paperclip className="w-4 h-4 text-emerald-600" />
              <span>업무 붙임문서 및 참고 서식 보관함</span>
              <Badge variant="outline" className="text-[10px] font-bold">
                {(workspace?.referenceFiles || []).length}건
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              업무기능 개발 요청 시 시스템 담당자에게 함께 전달할 참고 서식·엑셀·한글 파일 등을 올려두세요.
            </CardDescription>
          </div>
          <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shrink-0 transition-colors">
            {uploadingRef ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{uploadingRef ? '업로드 중...' : '붙임문서/서식 파일 업로드'}</span>
            <input
              type="file"
              multiple
              className="hidden"
              disabled={uploadingRef}
              onChange={handleUploadReferenceFiles}
            />
          </label>
        </CardHeader>
        <CardContent>
          {!workspace || (workspace.referenceFiles || []).length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6 border border-dashed rounded-xl">
              업로드된 붙임문서/참고 자료가 없습니다.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {workspace.referenceFiles.map((file, idx) => (
                <div
                  key={`${file.name}_${idx}`}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-white text-xs"
                >
                  <button
                    type="button"
                    onClick={() => downloadAttachmentSafely(file)}
                    className="flex items-center gap-2 min-w-0 text-left font-bold text-indigo-700 hover:underline"
                  >
                    <Paperclip className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span className="truncate">{file.name}</span>
                    {file.size ? (
                      <span className="text-[10px] text-slate-400 shrink-0 font-normal">
                        ({formatAttachmentSize(file.size)})
                      </span>
                    ) : null}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-rose-600 shrink-0"
                    onClick={() => handleRemoveRefFile(idx)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 모달들 */}
      {user?.email && (
        <StandardDocEditorDialog
          open={isDocEditorOpen}
          onOpenChange={setIsDocEditorOpen}
          dutyName={activeDutyName}
          userEmail={user.email}
          userName={profile?.name || user.email}
          org={orgData}
          initialDoc={editingDoc}
        />
      )}

      {workspace && user?.email && (
        <FeatureUpgradeRequestDialog
          open={isRequestModalOpen}
          onOpenChange={setIsRequestModalOpen}
          workspace={workspace}
          userEmail={user.email}
          userName={profile?.name || user.email}
          org={orgData}
        />
      )}
      </div>
    </div>
  );
}

export default function CustomDutyWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>맞춤형 업무 페이지를 불러오는 중...</span>
        </div>
      }
    >
      <CustomDutyWorkspaceInner />
    </Suspense>
  );
}
