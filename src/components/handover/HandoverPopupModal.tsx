'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  HandoverDocument,
  HandoverItem,
  HandoverNotice,
  HandoverStatus,
  HandoverReturningInfo
} from '@/lib/types/handover';
import { UserProfile, OrgStructure, GoogleDriveConfig } from '@/lib/types';
import {
  saveHandoverDraft,
  submitHandoverDocument,
  getHandoverPoolForTeacher,
  resolveTeacherAssignedDutiesList,
  filterPoolItemsForDuties,
  compareHandoverItemsAsc,
  inferHandoverPeriodFromDate,
  getHandoversByAuthor,
  CURRENT_SCHOOL_YEAR
} from '@/lib/services/handoverService';
import { isReturningTeacher, createEmptyReturningInfo, validateReturningInfo } from '@/lib/handover/returningTeacher';
import { ReturningTeacherInfoSection } from './ReturningTeacherInfoSection';
import { getOrgStructure, getGoogleDriveConfig } from '@/lib/services/settingsService';
import {
  resolveDriveFoldersForDuties,
  collectKnownDriveTaskUrls,
} from '@/lib/drive/deptFolderMapping';
import {
  HANDOVER_MANUAL_PERIOD_OPTIONS,
  syncSystemDutyTasksIntoTimeline,
  dedupeSystemTasksAgainstApprovals,
  applyEditedTimelineItem,
  inferHandoverTimingMetaFromPeriod,
} from '@/lib/handover/systemDutyBlueprints';
import { onAllCustomDutyWorkspacesUpdate } from '@/lib/services/customDutyService';
import type { CustomDutyWorkspace } from '@/lib/types/customDuty';
import { HandoverDutyTemplateBar } from './HandoverDutyTemplateBar';
import { HandoverTimelineItemCard } from './HandoverTimelineItemCard';
import { useHandoverDutyTemplateSync } from './useHandoverDutyTemplateSync';
import { PrimaryDutyCombobox } from './PrimaryDutyCombobox';
import {
  FileSpreadsheet,
  Send,
  Save,
  Plus,
  Trash2,
  FolderOpen,
  Sparkles,
  ExternalLink,
  Loader2,
  AlertTriangle,
  BellRing,
  Calendar,
  Layers,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';

const PERIOD_OPTIONS: string[] = [...HANDOVER_MANUAL_PERIOD_OPTIONS];

interface HandoverPopupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notice: HandoverNotice;
  currentUserProfile: UserProfile;
  initialDoc?: HandoverDocument | null;
  defaultDuty?: string | null;
  remainingDuties?: string[];
  onSubmittedSuccess?: () => void;
}

export function HandoverPopupModal({
  open,
  onOpenChange,
  notice,
  currentUserProfile,
  initialDoc,
  defaultDuty,
  remainingDuties = [],
  onSubmittedSuccess,
}: HandoverPopupModalProps) {
  const { toast } = useToast();
  const year = notice.year || CURRENT_SCHOOL_YEAR;

  const [loadedOrg, setLoadedOrg] = useState<Partial<OrgStructure> | null>(null);
  const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig | null>(null);
  const userEditedDutyRef = useRef<boolean>(false);
  const userEditedFolderRef = useRef<boolean>(Boolean(initialDoc?.folderUrl?.trim()));
  const lastAutoFolderUrlRef = useRef<string>('');

  const [docId, setDocId] = useState<string>(initialDoc?.id || '');
  const [selectedDuties, setSelectedDuties] = useState<string[]>(() => {
    const merged: string[] = [];
    if (initialDoc?.primaryDuty && initialDoc.primaryDuty.trim() !== '일반 교무 업무') {
      merged.push(initialDoc.primaryDuty.trim());
    }
    (initialDoc?.subDuties || []).forEach(d => {
      const t = d.trim();
      if (t && t !== '일반 교무 업무' && !merged.includes(t)) merged.push(t);
    });
    if (merged.length > 0) return merged;
    if (defaultDuty && defaultDuty.trim()) {
      return [defaultDuty.trim()];
    }
    return currentUserProfile.dept ? [`${currentUserProfile.dept} 총괄 업무`] : [];
  });
  const [folderUrl, setFolderUrl] = useState<string>(initialDoc?.folderUrl || '');
  const [contactInfo, setContactInfo] = useState<string>(
    initialDoc?.contactInfo || currentUserProfile.phoneNumber || currentUserProfile.email || ''
  );
  const [generalGuide, setGeneralGuide] = useState<string>(
    initialDoc?.generalGuide || ''
  );
  const [items, setItems] = useState<HandoverItem[]>(initialDoc?.items || []);
  // 귀임 교원 기재 사항 (조직도에서 귀임 체크된 교원만)
  const [returningInfo, setReturningInfo] = useState<HandoverReturningInfo | null>(initialDoc?.returningInfo || null);
  const [dismissedSystemTaskKeys, setDismissedSystemTaskKeys] = useState<string[]>(
    initialDoc?.dismissedSystemTaskKeys || []
  );
  const [status, setStatus] = useState<HandoverStatus>(initialDoc?.status || 'DRAFT');
  const [rejectionReason, setRejectionReason] = useState<string>(initialDoc?.rejectionReason || '');
  const [revisionRequestReason, setRevisionRequestReason] = useState<string>(
    initialDoc?.revisionRequestReason || ''
  );
  const [upgradedCustomWorkspaces, setUpgradedCustomWorkspaces] = useState<CustomDutyWorkspace[]>([]);
  const {
    dutyTimelineTemplates,
    persistAddedItem,
    persistEditedItem,
    persistRemovedItem,
    restoreDismissedForDuties,
    syncTimelineTemplates,
    resetTemplatesForDuties,
  } = useHandoverDutyTemplateSync(open);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [isLoadingPool, setIsLoadingPool] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);

  // 새 항목 추가 폼
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemPeriod, setNewItemPeriod] = useState(PERIOD_OPTIONS[0]);
  const [newItemDate, setNewItemDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newItemSummary, setNewItemSummary] = useState('');
  const [newItemFolderUrl, setNewItemFolderUrl] = useState('');
  const [includeAddedInDutyTemplate, setIncludeAddedInDutyTemplate] = useState(true);

  useEffect(() => {
    if (!open) return;
    getOrgStructure().then(org => {
      if (org) setLoadedOrg(org);
    });
    getGoogleDriveConfig().then(cfg => {
      if (cfg) setDriveConfig(cfg);
    });
    const unsubWs = onAllCustomDutyWorkspacesUpdate((wsMap) => {
      const upgraded = Object.values(wsMap).filter(
        (ws) =>
          ws.status === 'upgraded' ||
          (Array.isArray(ws.enabledModules) && ws.enabledModules.length > 0)
      );
      setUpgradedCustomWorkspaces(upgraded);
    });
    return () => unsubWs();
  }, [open]);

  const teacherDeptName = useMemo(() => {
    const emailLower = (currentUserProfile?.email || '').trim().toLowerCase();
    const matchedDept = (loadedOrg?.departments || []).find(
      d =>
        d.headEmail?.trim().toLowerCase() === emailLower ||
        d.memberEmails?.some(m => m.trim().toLowerCase() === emailLower)
    );
    return matchedDept?.name || currentUserProfile?.dept || '';
  }, [loadedOrg?.departments, currentUserProfile?.email, currentUserProfile?.dept]);

  const isReturning = useMemo(
    () => isReturningTeacher(loadedOrg, currentUserProfile?.email) || Boolean(initialDoc?.returningInfo),
    [loadedOrg, currentUserProfile?.email, initialDoc?.returningInfo]
  );

  // 귀임 교원: 입력값이 없으면 같은 학년도 다른 업무 인계서 내용을 가져오고, 없으면 빈 양식으로 시작
  useEffect(() => {
    if (!isReturning || returningInfo || !currentUserProfile?.email) return;
    let cancelled = false;
    getHandoversByAuthor(currentUserProfile.email, year)
      .then(docs => {
        if (cancelled) return;
        const sibling = docs.find(d => d.id !== docId && d.returningInfo);
        setReturningInfo(prev => prev || sibling?.returningInfo || createEmptyReturningInfo(year));
      })
      .catch(() => {
        if (!cancelled) setReturningInfo(prev => prev || createEmptyReturningInfo(year));
      });
    return () => {
      cancelled = true;
    };
  }, [isReturning, returningInfo, currentUserProfile?.email, year, docId]);

  const matchedDriveFolders = useMemo(
    () =>
      resolveDriveFoldersForDuties(
        selectedDuties,
        driveConfig,
        year,
        teacherDeptName,
        loadedOrg
      ),
    [selectedDuties, driveConfig, year, teacherDeptName, loadedOrg]
  );

  const knownDriveUrls = useMemo(
    () => collectKnownDriveTaskUrls(driveConfig, year),
    [driveConfig, year]
  );

  const folderUrlRef = useRef(folderUrl);
  useEffect(() => {
    folderUrlRef.current = folderUrl;
  }, [folderUrl]);

  useEffect(() => {
    if (!open) return;
    const primaryMatch = matchedDriveFolders[0];
    if (!primaryMatch?.folderUrl) return;
    if (userEditedFolderRef.current) return;

    const currentTrimmed = folderUrlRef.current.trim();
    const isUsingAutoOrEmpty =
      !currentTrimmed ||
      currentTrimmed === lastAutoFolderUrlRef.current ||
      knownDriveUrls.has(currentTrimmed);

    if (isUsingAutoOrEmpty) {
      if (currentTrimmed !== primaryMatch.folderUrl) {
        setFolderUrl(primaryMatch.folderUrl);
      }
      lastAutoFolderUrlRef.current = primaryMatch.folderUrl;
    }
  }, [open, matchedDriveFolders, knownDriveUrls]);

  useEffect(() => {
    if (initialDoc) {
      setDocId(initialDoc.id || '');
      const merged: string[] = [];
      if (initialDoc.primaryDuty && initialDoc.primaryDuty.trim() !== '일반 교무 업무') {
        merged.push(initialDoc.primaryDuty.trim());
      }
      (initialDoc.subDuties || []).forEach(d => {
        const t = d.trim();
        if (t && t !== '일반 교무 업무' && !merged.includes(t)) merged.push(t);
      });
      if (merged.length > 0) {
        setSelectedDuties(merged);
      }
      const savedUrl = initialDoc.folderUrl || '';
      setFolderUrl(savedUrl);
      userEditedFolderRef.current = Boolean(savedUrl.trim());
      setContactInfo(initialDoc.contactInfo || '');
      setGeneralGuide(initialDoc.generalGuide || '');
      if (initialDoc.returningInfo) setReturningInfo(initialDoc.returningInfo);
      setItems(initialDoc.items || []);
      setDismissedSystemTaskKeys(initialDoc.dismissedSystemTaskKeys || []);
      setStatus(initialDoc.status || 'DRAFT');
      setRejectionReason(initialDoc.rejectionReason || '');
    }
  }, [initialDoc]);

  // 접속한 교사의 조직도 배정 업무 목록을 자동으로 복수 선택
  useEffect(() => {
    if (!loadedOrg || !currentUserProfile?.email) return;
    if (userEditedDutyRef.current) return;

    const savedPrimary = initialDoc?.primaryDuty?.trim();
    const hasExplicitSaved =
      (Boolean(savedPrimary) &&
        savedPrimary !== '일반 교무 업무' &&
        savedPrimary !== (currentUserProfile.dept || '').trim()) ||
      Boolean(initialDoc?.subDuties && initialDoc.subDuties.length > 0);

    if (!hasExplicitSaved) {
      if (defaultDuty && defaultDuty.trim()) {
        setSelectedDuties([defaultDuty.trim()]);
        return;
      }
      const resolvedList = resolveTeacherAssignedDutiesList(
        currentUserProfile.email,
        loadedOrg,
        currentUserProfile.dept
      );
      if (resolvedList.length > 0) {
        setSelectedDuties([resolvedList[0]]);
      }
    }
  }, [loadedOrg, currentUserProfile?.email, currentUserProfile?.dept, initialDoc?.primaryDuty, initialDoc?.subDuties, defaultDuty]);

  // 시스템 고정 업무(스쿨버스, 안전지도, 봉사활동, 방과후, 체육 등) 타임라인 자동 동기화 (기안문 중복 차단 + 시기순 정렬)
  useEffect(() => {
    if (!open) return;
    const isEditableDoc = status === 'DRAFT' || status === 'REJECTED';
    if (!isEditableDoc) return;
    if (!loadedOrg && selectedDuties.length === 0) return;

    setItems(prev => {
      const res = syncSystemDutyTasksIntoTimeline({
        currentItems: prev,
        selectedDuties,
        dismissedSystemTaskKeys,
        driveConfig,
        org: loadedOrg,
        year,
        teacherDeptName,
        pruneRemovedDuties: true,
        upgradedCustomWorkspaces,
        dutyTimelineTemplates,
      });
      return res.changed ? res.items : prev;
    });
  }, [open, selectedDuties, dismissedSystemTaskKeys, driveConfig, loadedOrg, year, teacherDeptName, status, upgradedCustomWorkspaces, dutyTimelineTemplates]);

  // 지난 1년간 기안기로 작성된 업무 불러오기
  const handleLoadPool = async () => {
    if (!currentUserProfile.email) return;
    setIsLoadingPool(true);
    try {
      const allPoolItems = await getHandoverPoolForTeacher(currentUserProfile.email, year);
      const allAssignedDuties = resolveTeacherAssignedDutiesList(
        currentUserProfile.email,
        loadedOrg,
        teacherDeptName
      );
      const poolItems = filterPoolItemsForDuties(allPoolItems, selectedDuties, allAssignedDuties);
      if (poolItems.length === 0) {
        toast({
          title: '누적 기안 없음',
          description: '지난 1년간 인수인계로 태깅된 기안 문서가 없습니다. 직접 항목을 추가할 수 있습니다.',
        });
        return;
      }

      const existingDocIds = new Set(items.map(it => it.documentId).filter(Boolean));
      const newItems: HandoverItem[] = [];

      poolItems.forEach(p => {
        if (p.documentId && existingDocIds.has(p.documentId)) return;

        const period = inferHandoverPeriodFromDate(p.date);

        newItems.push({
          id: `pool_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          documentId: p.documentId,
          sourceType: p.sourceType,
          documentTitle: p.documentTitle,
          docNo: p.docNo,
          category: p.category || '일반업무',
          period,
          date: p.date,
          ...(p.displayDateTime ? { displayDateTime: p.displayDateTime } : {}),
          summary: p.summary || '',
          folderUrl: p.folderUrl || '',
          attachments: p.attachments || [],
          createdAt: typeof p.createdAt === 'string' && p.createdAt ? p.createdAt : new Date().toISOString(),
        });
      });

      if (newItems.length === 0) {
        toast({
          title: '불러오기 완료',
          description: '이미 모든 누적 기안이 목록에 추가되어 있습니다.',
        });
      } else {
        setItems(prev => dedupeSystemTasksAgainstApprovals([...prev, ...newItems]).sort(compareHandoverItemsAsc));
        toast({
          title: '기안 연동 완료',
          description: `${newItems.length}건의 기안 업무가 시기별 인수인계 항목에 추가되었습니다.`,
        });
      }
    } catch (err) {
      console.error('load pool error:', err);
      toast({ variant: 'destructive', description: '누적 기안을 불러오는 중 오류가 발생했습니다.' });
    } finally {
      setIsLoadingPool(false);
    }
  };

  // 개별 항목 추가
  const handleAddItem = () => {
    if (!newItemTitle.trim()) {
      toast({ variant: 'destructive', description: '업무명을 입력해 주세요.' });
      return;
    }

    const isPeriodic =
      newItemPeriod === '정기 업무' ||
      newItemPeriod === '수시 / 미정기' ||
      newItemPeriod === '연간 상시';
    const targetDuty = selectedDuties[0] || '';
    const customTemplateItemId =
      includeAddedInDutyTemplate && targetDuty
        ? `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        : undefined;
    const timingMeta = inferHandoverTimingMetaFromPeriod(newItemPeriod);

    const newItem: HandoverItem = {
      id: `item_${Date.now()}`,
      sourceType: 'manual',
      ...(targetDuty ? { dutyName: targetDuty } : {}),
      documentTitle: newItemTitle.trim(),
      category: targetDuty || '일반업무',
      period: newItemPeriod,
      timingKind: timingMeta.timingKind,
      sortOrder: timingMeta.sortOrder,
      ...(isPeriodic ? { scheduleLabel: newItemPeriod } : {}),
      date: isPeriodic ? '' : newItemDate,
      summary: newItemSummary.trim(),
      folderUrl: newItemFolderUrl.trim(),
      includeInDutyTemplate: includeAddedInDutyTemplate,
      ...(customTemplateItemId ? { customTemplateItemId } : {}),
      createdAt: new Date().toISOString(),
    };

    setItems(prev => [...prev, newItem].sort(compareHandoverItemsAsc));
    if (includeAddedInDutyTemplate && targetDuty) {
      void persistAddedItem(targetDuty, newItem, currentUserProfile);
    }
    setNewItemTitle('');
    setNewItemSummary('');
    setNewItemFolderUrl('');
    toast({
      title: '항목 추가됨',
      description:
        includeAddedInDutyTemplate && targetDuty
          ? `새 항목이 추가되었으며 '${targetDuty}' 자동 작성 표준에도 반영되었습니다.`
          : '새 인계 업무 항목이 추가되었습니다.',
    });
  };

  const handleSaveEditItem = (
    itemId: string,
    patch: { period: string; documentTitle: string; summary: string }
  ) => {
    if (!patch.documentTitle.trim()) {
      toast({ variant: 'destructive', description: '제목을 입력하세요.' });
      return;
    }
    const nextItems = applyEditedTimelineItem(items, itemId, patch);
    setItems(nextItems);
    setEditingItemId(null);

    const updatedItem = nextItems.find(it => it.id === itemId);
    void persistEditedItem(updatedItem, selectedDuties, currentUserProfile).then(learnedDuty => {
      toast({
        title: '항목 수정 완료',
        description: learnedDuty
          ? `타임라인 항목이 수정되었으며 '${learnedDuty}' 자동 작성 표준에도 반영되었습니다.`
          : '타임라인 항목이 수정되었습니다.',
      });
    });
  };

  const handleRemoveItem = (id: string) => {
    const target = items.find(it => it.id === id);
    if (
      target?.sourceType === 'system_auto' &&
      target.systemTaskKey &&
      !target.systemTaskKey.startsWith('tpl_added__')
    ) {
      setDismissedSystemTaskKeys(prev =>
        prev.includes(target.systemTaskKey!) ? prev : [...prev, target.systemTaskKey!]
      );
    }
    if (target) {
      void persistRemovedItem(target, selectedDuties, currentUserProfile);
    }
    if (editingItemId === id) {
      setEditingItemId(null);
    }
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const handleRestoreDismissed = async () => {
    setDismissedSystemTaskKeys([]);
    await restoreDismissedForDuties(selectedDuties);
    toast({ description: '제외된 시스템 고정 업무를 타임라인에 복원했습니다.' });
  };

  const handleSyncCurrentTimelineToTemplate = async () => {
    await syncTimelineTemplates({
      selectedDuties,
      items,
      dismissedSystemTaskKeys,
      includeAllManualItems: true,
      user: currentUserProfile,
    });
    toast({ description: '수정·추가된 타임라인 내용이 업무 자동 작성 표준으로 저장되었습니다.' });
  };

  const handleResetDutyTemplates = async () => {
    setDismissedSystemTaskKeys([]);
    setItems(prev =>
      prev
        .filter(it => !it.systemTaskKey?.startsWith('tpl_added__'))
        .map(it =>
          it.sourceType === 'system_auto'
            ? { ...it, userEdited: false, isLearnedTemplateItem: false }
            : it
        )
    );
    await resetTemplatesForDuties(selectedDuties);
    toast({ description: '선택한 업무의 타임라인을 시스템 기본 표준으로 복원했습니다.' });
  };

  // 임시저장 (제출 아님, 다음 접속 시 여전히 팝업 뜸)
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const [primaryDuty, ...subDuties] =
        selectedDuties.length > 0 ? selectedDuties : ['일반 교무 업무'];

      await syncTimelineTemplates({
        selectedDuties,
        items,
        dismissedSystemTaskKeys,
        includeAllManualItems: false,
        user: currentUserProfile,
      });

      const savedId = await saveHandoverDraft(
        {
          id: docId || undefined,
          year,
          primaryDuty,
          subDuties,
          folderUrl: folderUrl.trim(),
          contactInfo: contactInfo.trim(),
          generalGuide: generalGuide.trim(),
          items,
          dismissedSystemTaskKeys,
          ...(isReturning && returningInfo ? { returningInfo } : {}),
        },
        currentUserProfile,
        year
      );

      setDocId(savedId);
      toast({
        title: '임시 저장 완료',
        description: '작성 중인 인수인계서가 저장되었습니다. 제출 전까지 앱 접속 시 팝업이 다시 노출됩니다.',
      });
      onOpenChange(false);
    } catch (err) {
      console.error('save draft error:', err);
      toast({ variant: 'destructive', description: '임시 저장 중 오류가 발생했습니다.' });
    } finally {
      setIsSaving(false);
    }
  };

  // 최종 제출 (제출 완료 시 더 이상 팝업 안 뜸)
  const handleSubmit = async () => {
    if (selectedDuties.length === 0) {
      toast({ variant: 'destructive', description: '최소 1개 이상의 주 업무명을 선택하거나 추가해 주세요.' });
      return;
    }
    if (isReturning) {
      const returningError = validateReturningInfo(returningInfo);
      if (returningError) {
        toast({ variant: 'destructive', description: returningError });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const [primaryDuty, ...subDuties] = selectedDuties;

      await syncTimelineTemplates({
        selectedDuties,
        items,
        dismissedSystemTaskKeys,
        includeAllManualItems: false,
        user: currentUserProfile,
      });

      // 먼저 저장
      const savedId = await saveHandoverDraft(
        {
          id: docId || undefined,
          year,
          primaryDuty,
          subDuties,
          folderUrl: folderUrl.trim(),
          contactInfo: contactInfo.trim(),
          generalGuide: generalGuide.trim(),
          items,
          dismissedSystemTaskKeys,
          ...(isReturning && returningInfo ? { returningInfo } : {}),
        },
        currentUserProfile,
        year
      );

      // 제출
      const res = await submitHandoverDocument(savedId, currentUserProfile, year);
      setStatus(res.status);

      toast({
        title: '인수인계서 제출 완료',
        description:
          '교무부장 총괄 관리로 안전하게 제출되었습니다. 교무부장 확인 완료 후 일괄 교감 최종 결재로 상신됩니다.',
      });

      if (onSubmittedSuccess) {
        onSubmittedSuccess();
      } else {
        onOpenChange(false);
      }
    } catch (err: any) {
      console.error('submit error:', err);
      toast({ variant: 'destructive', description: err.message || '인수인계서 제출 중 오류가 발생했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[88vh] overflow-y-auto p-5 bg-white border border-indigo-200 rounded-2xl shadow-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        hideCloseButton={true}
      >
        <DialogHeader className="space-y-1.5 pb-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <Badge className="bg-indigo-600 text-white font-bold text-xs gap-1 px-2.5 py-0.5">
              <BellRing className="w-3.5 h-3.5 animate-pulse" />
              {year}학년도 학년 말 인수인계
            </Badge>

            {status === 'REJECTED' ? (
              <Badge variant="destructive" className="font-bold text-xs">반려됨 (재제출 필요)</Badge>
            ) : status === 'REVISION_REQUESTED' ? (
              <Badge variant="outline" className="border-orange-400 text-orange-800 bg-orange-50 font-bold text-xs">
                수정 요청됨 (보완 후 재제출)
              </Badge>
            ) : status === 'DRAFT' ? (
              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 font-bold text-xs">
                미제출 (작성 중)
              </Badge>
            ) : (
              <Badge variant="outline" className="border-indigo-300 text-indigo-700 font-bold text-xs">
                작성 요청
              </Badge>
            )}
          </div>

          <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>교원 업무 인수인계서 작성 및 제출</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            차년도 후임자에게 인계할 주요 업무와 전년도 드라이브 폴더를 기재한 후 반드시 <b>[제출하기]</b>를 완료해 주세요. (제출 완료 시 팝업이 더 이상 뜨지 않습니다.)
          </DialogDescription>
          {remainingDuties.length > 1 && (
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-bold">
              미제출 담당 업무 {remainingDuties.length}건 (업무별 개별 작성): {remainingDuties.join(' · ')}
            </div>
          )}
        </DialogHeader>

        {/* 반려 / 수정 요청 사유 경고 배너 */}
        {status === 'REJECTED' && rejectionReason && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>반려 안내 {initialDoc?.rejectedBy ? `(${initialDoc.rejectedBy})` : ''}</span>
            </div>
            <p className="text-xs text-rose-700 pl-5 whitespace-pre-wrap">{rejectionReason}</p>
          </div>
        )}
        {status === 'REVISION_REQUESTED' && revisionRequestReason && (
          <div className="p-3 bg-orange-50 border border-orange-300 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-900">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span>
                {initialDoc?.revisionRequestedByRole || '교감'} 수정 요청 안내
                {initialDoc?.revisionRequestedBy ? ` (${initialDoc.revisionRequestedBy})` : ''}
              </span>
            </div>
            <p className="text-xs text-orange-800 pl-5 whitespace-pre-wrap">{revisionRequestReason}</p>
          </div>
        )}

        <div className="space-y-4 py-2 text-xs">
          {/* 1. 기본 인계 정보 */}
          <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>1. 인계 업무 기본 정보</span>
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadPool}
                disabled={isLoadingPool}
                className="h-7 text-[11px] font-bold border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 gap-1"
              >
                {isLoadingPool ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-indigo-600" />}
                <span>지난 1년 누적 기안 불러오기</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-start">
              <div className="flex flex-col gap-1">
                <Label className="text-[11px] font-bold text-slate-700 min-h-5 flex items-center gap-1">
                  <span>주 업무명 (복수 선택 가능) <span className="text-rose-500">*</span></span>
                </Label>
                <PrimaryDutyCombobox
                  values={selectedDuties}
                  onChange={(vals) => {
                    userEditedDutyRef.current = true;
                    setSelectedDuties(vals);
                  }}
                  orgStructure={loadedOrg}
                  userEmail={currentUserProfile?.email}
                  placeholder="담당 업무 선택 또는 직접 추가 (복수)"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-[11px] font-bold text-slate-700 min-h-5 flex items-center justify-between">
                  <span>선택된 담당 업무 ({selectedDuties.length}건)</span>
                  {selectedDuties.length > 0 && (
                    <span className="text-[10px] font-normal text-slate-400">× 클릭으로 제거</span>
                  )}
                </Label>
                <div className="min-h-9 px-2 py-1.5 rounded-md border border-slate-200 bg-white flex flex-wrap items-center gap-1">
                  {selectedDuties.length === 0 ? (
                    <span className="text-[11px] text-slate-400">좌측에서 담당 업무를 선택하세요.</span>
                  ) : (
                    selectedDuties.map((duty, idx) => (
                      <Badge
                        key={duty}
                        variant={idx === 0 ? 'default' : 'outline'}
                        className={
                          idx === 0
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-1.5 py-0.5 gap-1'
                            : 'bg-slate-50 hover:bg-slate-100 text-indigo-800 border-indigo-200 text-[10px] font-semibold px-1.5 py-0.5 gap-1'
                        }
                      >
                        {idx === 0 && <span className="text-[9px] bg-white/20 px-1 rounded">대표</span>}
                        <span>{duty}</span>
                        <button
                          type="button"
                          onClick={() => {
                            userEditedDutyRef.current = true;
                            setSelectedDuties(prev => prev.filter(d => d !== duty));
                          }}
                          className={idx === 0 ? 'text-white/80 hover:text-white ml-0.5' : 'text-indigo-400 hover:text-rose-600 ml-0.5'}
                          title={`${duty} 제거`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-start">
              <div className="flex flex-col gap-1">
                <Label className="text-[11px] font-bold text-slate-700 min-h-5 flex items-center gap-1">
                  <FolderOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>전년도 업무 드라이브/폴더 링크</span>
                </Label>
                <div className="flex gap-1">
                  <Input
                    value={folderUrl}
                    onChange={e => {
                      const nextVal = e.target.value;
                      userEditedFolderRef.current = Boolean(nextVal.trim());
                      setFolderUrl(nextVal);
                    }}
                    placeholder="Google Drive 폴더 URL"
                    className="h-8 text-xs bg-white flex-1"
                  />
                  {folderUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(folderUrl, '_blank')}
                      className="h-8 px-2 text-xs border-indigo-200 text-indigo-700"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                {matchedDriveFolders.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    {matchedDriveFolders.map((mf) => {
                      const isActive = folderUrl.trim() === mf.folderUrl;
                      return (
                        <button
                          key={mf.folderUrl}
                          type="button"
                          onClick={() => {
                            userEditedFolderRef.current = true;
                            lastAutoFolderUrlRef.current = mf.folderUrl;
                            setFolderUrl(mf.folderUrl);
                          }}
                          className={
                            isActive
                              ? 'text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-300'
                              : 'text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 transition-colors'
                          }
                          title={`${mf.label} 폴더 링크 선택`}
                        >
                          {isActive ? `연동됨: ${mf.label}` : mf.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-[11px] font-bold text-slate-700 min-h-5 flex items-center">
                  전임자 비상 연락처
                </Label>
                <Input
                  value={contactInfo}
                  onChange={e => setContactInfo(e.target.value)}
                  placeholder="이메일 또는 전화번호"
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>

            {isReturning && returningInfo && (
              <ReturningTeacherInfoSection
                value={returningInfo}
                onChange={setReturningInfo}
                authorName={currentUserProfile.name || ''}
                authorEmail={currentUserProfile.email || ''}
                currentSchoolYear={year}
                currentDepartment={teacherDeptName}
                currentDuty={selectedDuties.join(', ')}
              />
            )}

            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-700">
                총괄 인계 사항 및 연간 운영 팁 (주의사항 / 노하우)
              </Label>
              <Textarea
                value={generalGuide}
                onChange={e => setGeneralGuide(e.target.value)}
                placeholder="후임자를 위한 연간 추진 핵심 팁, 감사 지적사항, 업체 계약 유의점, 학기 초 우선 확인사항 등을 자유롭게 작성하세요."
                rows={3}
                className="text-xs bg-white resize-none"
              />
            </div>
          </div>

          {/* 2. 시기별 인계 항목 목록 */}
          <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>2. 세부 인계 업무 목록 ({items.length}건)</span>
              </h4>
              <div className="flex items-center gap-1.5">
                {dismissedSystemTaskKeys.length > 0 && (status === 'DRAFT' || status === 'REJECTED') && (
                  <button
                    type="button"
                    onClick={handleRestoreDismissed}
                    className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2 py-0.5 rounded-md shadow-2xs shrink-0 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>고정 업무 복원 ({dismissedSystemTaskKeys.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsManualAddOpen(prev => !prev)}
                  aria-expanded={isManualAddOpen}
                  className="inline-flex items-center gap-1 text-[10.5px] font-bold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 px-2 py-0.5 rounded-md shadow-2xs shrink-0 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isManualAddOpen ? '수동 추가 접기' : '인계 항목 수동 추가'}</span>
                  {isManualAddOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <HandoverDutyTemplateBar
              selectedDuties={selectedDuties}
              dutyTimelineTemplates={dutyTimelineTemplates}
              items={items}
              isEditable={status === 'DRAFT' || status === 'REJECTED'}
              compact={true}
              onSyncNow={handleSyncCurrentTimelineToTemplate}
              onResetToDefault={handleResetDutyTemplates}
            />

            {/* 항목 추가 폼 (기본 접힘) */}
            {isManualAddOpen && (
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    value={newItemTitle}
                    onChange={e => setNewItemTitle(e.target.value)}
                    placeholder="업무명/공문 제목 *"
                    className="h-7 text-xs sm:col-span-2"
                  />
                  <Select value={newItemPeriod} onValueChange={setNewItemPeriod}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_OPTIONS.map(p => (
                        <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Input
                  value={newItemSummary}
                  onChange={e => setNewItemSummary(e.target.value)}
                  placeholder="주요 인계 내용 및 핵심 팁 요약"
                  className="h-7 text-xs"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeAddedInDutyTemplate}
                      onChange={e => setIncludeAddedInDutyTemplate(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      향후 &apos;{selectedDuties[0] || '선택 업무'}&apos; 자동 타임라인 표준에도 기본 반영
                    </span>
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddItem}
                    className="h-7 text-xs px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shrink-0 gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>항목 추가</span>
                  </Button>
                </div>
              </div>
            )}

            {/* 목록 리스트 */}
            {items.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs bg-white rounded-lg border border-dashed">
                등록된 세부 업무 항목이 없습니다. 상단 &apos;누적 기안 불러오기&apos; 또는 직접 항목을 추가해 주세요.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {[...items].sort(compareHandoverItemsAsc).map((it, idx) => (
                  <HandoverTimelineItemCard
                    key={it.id || idx}
                    item={it}
                    isEditing={editingItemId === it.id}
                    compact={true}
                    showPeriodBadgeInMeta={true}
                    onStartEdit={(target) => setEditingItemId(target.id)}
                    onCancelEdit={() => setEditingItemId(null)}
                    onSaveEdit={handleSaveEditItem}
                    onRemove={handleRemoveItem}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-[11px] text-amber-700 font-medium">
            ※ 제출 버튼을 누르시면 작성이 완료되며 팝업이 더 이상 노출되지 않습니다.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={isSaving || isSubmitting}
              className="h-8 text-xs font-semibold"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              <span>임시저장 후 닫기</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || isSaving}
              className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-1"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>인수인계서 제출하기</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
