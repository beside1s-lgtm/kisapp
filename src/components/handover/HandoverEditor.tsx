'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  HandoverDocument,
  HandoverItem,
  HandoverPoolItem,
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
  getHandoverStatusLabel,
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
  HANDOVER_PERIOD_OPTIONS,
  HANDOVER_MANUAL_PERIOD_OPTIONS,
  syncSystemDutyTasksIntoTimeline,
  dedupeSystemTasksAgainstApprovals,
  applyEditedTimelineItem,
  inferHandoverTimingMetaFromPeriod,
  normalizeHandoverPeriodLabel,
} from '@/lib/handover/systemDutyBlueprints';
import { onAllCustomDutyWorkspacesUpdate } from '@/lib/services/customDutyService';
import type { CustomDutyWorkspace } from '@/lib/types/customDuty';
import { HandoverDutyTemplateBar } from './HandoverDutyTemplateBar';
import { HandoverTimelineItemCard } from './HandoverTimelineItemCard';
import { useHandoverDutyTemplateSync } from './useHandoverDutyTemplateSync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Save,
  Send,
  Plus,
  Trash2,
  FolderOpen,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  Loader2,
  CheckCircle2,
  FileText,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { PrimaryDutyCombobox } from './PrimaryDutyCombobox';

const PERIOD_OPTIONS: string[] = [...HANDOVER_PERIOD_OPTIONS];
const MANUAL_PERIOD_OPTIONS: string[] = [...HANDOVER_MANUAL_PERIOD_OPTIONS];

const CATEGORY_OPTIONS = [
  '교무기획',
  '학생안전',
  '봉사활동',
  '연구기획',
  '출결관리',
  '학교체육',
  '보건/건강',
  '방과후학교',
  '스쿨버스',
  '학년/학급운영',
  '행정/비품',
  '일반업무'
];

interface HandoverEditorProps {
  initialDocument?: HandoverDocument | null;
  defaultDuty?: string | null;
  currentUserProfile: UserProfile;
  year?: number;
  orgStructure?: Partial<OrgStructure> | null;
  onSaved?: (docId: string, status: HandoverStatus) => void;
}

export function HandoverEditor({
  initialDocument,
  defaultDuty,
  currentUserProfile,
  year = CURRENT_SCHOOL_YEAR,
  orgStructure,
  onSaved,
}: HandoverEditorProps) {
  const { toast } = useToast();
  const [loadedOrg, setLoadedOrg] = useState<Partial<OrgStructure> | null>(orgStructure || null);
  const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig | null>(null);
  const userEditedDutyRef = useRef<boolean>(false);
  const userEditedFolderRef = useRef<boolean>(Boolean(initialDocument?.folderUrl?.trim()));
  const lastAutoFolderUrlRef = useRef<string>('');

  const [docId, setDocId] = useState<string>(initialDocument?.id || '');
  const [selectedDuties, setSelectedDuties] = useState<string[]>(() => {
    const merged: string[] = [];
    if (initialDocument?.primaryDuty && initialDocument.primaryDuty.trim() !== '일반 교무 업무') {
      merged.push(initialDocument.primaryDuty.trim());
    }
    (initialDocument?.subDuties || []).forEach(d => {
      const t = d.trim();
      if (t && t !== '일반 교무 업무' && !merged.includes(t)) merged.push(t);
    });
    if (merged.length > 0) return merged;
    if (defaultDuty && defaultDuty.trim()) {
      return [defaultDuty.trim()];
    }
    if (orgStructure && currentUserProfile?.email) {
      const resolved = resolveTeacherAssignedDutiesList(
        currentUserProfile.email,
        orgStructure,
        currentUserProfile.dept
      );
      if (resolved.length > 0) return [resolved[0]];
    }
    return currentUserProfile.dept ? [`${currentUserProfile.dept} 총괄 업무`] : [];
  });
  const [folderUrl, setFolderUrl] = useState<string>(initialDocument?.folderUrl || '');
  const [contactInfo, setContactInfo] = useState<string>(
    initialDocument?.contactInfo || currentUserProfile.phoneNumber || currentUserProfile.email || ''
  );
  const [generalGuide, setGeneralGuide] = useState<string>(
    initialDocument?.generalGuide || ''
  );
  const [items, setItems] = useState<HandoverItem[]>(initialDocument?.items || []);
  // 귀임 교원 기재 사항 (조직도에서 귀임 체크된 교원만)
  const [returningInfo, setReturningInfo] = useState<HandoverReturningInfo | null>(
    initialDocument?.returningInfo || null
  );
  const [dismissedSystemTaskKeys, setDismissedSystemTaskKeys] = useState<string[]>(
    initialDocument?.dismissedSystemTaskKeys || []
  );
  const [status, setStatus] = useState<HandoverStatus>(initialDocument?.status || 'DRAFT');
  const [upgradedCustomWorkspaces, setUpgradedCustomWorkspaces] = useState<CustomDutyWorkspace[]>([]);
  const {
    dutyTimelineTemplates,
    persistAddedItem,
    persistEditedItem,
    persistRemovedItem,
    restoreDismissedForDuties,
    syncTimelineTemplates,
    resetTemplatesForDuties,
  } = useHandoverDutyTemplateSync(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (orgStructure) {
      setLoadedOrg(orgStructure);
    } else {
      getOrgStructure().then(org => {
        if (org) setLoadedOrg(org);
      });
    }
  }, [orgStructure]);

  useEffect(() => {
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
  }, []);

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
    () => isReturningTeacher(loadedOrg, currentUserProfile?.email) || Boolean(initialDocument?.returningInfo),
    [loadedOrg, currentUserProfile?.email, initialDocument?.returningInfo]
  );

  // 귀임 교원: 입력값이 없으면 같은 학년도 다른 업무 인계서에 적어 둔 내용을 가져오고, 없으면 빈 양식으로 시작
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

  // 선택된 주 업무명에 해당하는 Google Drive 부서 하위 업무 폴더 URL 자동 연동
  useEffect(() => {
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
  }, [matchedDriveFolders, knownDriveUrls]);

  // 접속한 교사의 조직도 배정 업무 중 대표 업무 1개를 기본 선택 (복수 업무 시 업무별 개별 작성 지원)
  useEffect(() => {
    if (!loadedOrg || !currentUserProfile?.email) return;
    if (userEditedDutyRef.current) return;

    const savedPrimary = initialDocument?.primaryDuty?.trim();
    const hasExplicitSaved =
      (Boolean(savedPrimary) &&
        savedPrimary !== '일반 교무 업무' &&
        savedPrimary !== (currentUserProfile.dept || '').trim()) ||
      Boolean(initialDocument?.subDuties && initialDocument.subDuties.length > 0);

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
  }, [loadedOrg, currentUserProfile?.email, currentUserProfile?.dept, initialDocument?.primaryDuty, initialDocument?.subDuties, defaultDuty]);

  // 시스템 고정 업무(스쿨버스, 안전지도, 봉사활동, 방과후, 체육 등) 타임라인 자동 동기화 (기안문 중복 차단 + 시기순 정렬)
  useEffect(() => {
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
  }, [selectedDuties, dismissedSystemTaskKeys, driveConfig, loadedOrg, year, teacherDeptName, status, upgradedCustomWorkspaces, dutyTimelineTemplates]);

  const [isLoadingPool, setIsLoadingPool] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);

  // 새 항목 추가용 폼 상태
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemPeriod, setNewItemPeriod] = useState(PERIOD_OPTIONS[0]);
  const [newItemCategory, setNewItemCategory] = useState(CATEGORY_OPTIONS[0]);
  const [newItemDate, setNewItemDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newItemSummary, setNewItemSummary] = useState('');
  const [newItemFolderUrl, setNewItemFolderUrl] = useState('');
  const [includeAddedInDutyTemplate, setIncludeAddedInDutyTemplate] = useState(true);

  // 1년간 누적 기안 불러오기
  const handleLoadAccumulatedPool = async () => {
    if (!currentUserProfile?.email) return;
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

      // 기존 항목과 병합 (중복 방지)
      const existingDocIds = new Set(items.map(it => it.documentId).filter(Boolean));
      const existingTitles = new Set(items.map(it => it.documentTitle.trim()));

      const newConverted: HandoverItem[] = [];
      poolItems.forEach(p => {
        if ((p.documentId && existingDocIds.has(p.documentId)) || existingTitles.has(p.documentTitle.trim())) {
          return;
        }

        const inferredPeriod = inferHandoverPeriodFromDate(p.date);

        newConverted.push({
          id: `pool_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          documentId: p.documentId,
          sourceType: p.sourceType,
          documentTitle: p.documentTitle,
          docNo: p.docNo,
          category: p.category || '일반업무',
          period: inferredPeriod,
          date: p.date,
          ...(p.displayDateTime ? { displayDateTime: p.displayDateTime } : {}),
          summary: p.summary || '',
          folderUrl: p.folderUrl || '',
          attachments: p.attachments || [],
          createdAt: typeof p.createdAt === 'string' && p.createdAt ? p.createdAt : new Date().toISOString(),
        });
      });

      if (newConverted.length === 0) {
        toast({
          title: '불러오기 완료',
          description: '이미 목록에 포함되어 있거나 새로운 누적 기안이 없습니다.',
        });
      } else {
        setItems(prev => dedupeSystemTasksAgainstApprovals([...prev, ...newConverted]).sort(compareHandoverItemsAsc));
        toast({
          title: '누적 기안 연동 완료',
          description: `총 ${newConverted.length}건의 기안 업무가 시기별 인수인계 목록에 추가되었습니다.`,
        });
      }
    } catch (err) {
      console.error('load pool error:', err);
      toast({
        variant: 'destructive',
        title: '불러오기 실패',
        description: '누적 인수인계 데이터를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setIsLoadingPool(false);
    }
  };

  // 개별 수동 항목 추가
  const handleAddItem = () => {
    if (!newItemTitle.trim()) {
      toast({ variant: 'destructive', description: '업무명 또는 문서 제목을 입력하세요.' });
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
      category: newItemCategory,
      period: newItemPeriod,
      timingKind: timingMeta.timingKind,
      sortOrder: timingMeta.sortOrder,
      ...(isPeriodic ? { scheduleLabel: newItemPeriod } : {}),
      date: isPeriodic ? '' : (newItemDate || format(new Date(), 'yyyy-MM-dd')),
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
      description:
        includeAddedInDutyTemplate && targetDuty
          ? `'${targetDuty}' 자동 타임라인 표준에도 반영되었습니다.`
          : '인계 항목이 추가되었습니다.',
    });
  };

  // 항목 수정 저장
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
        description: learnedDuty
          ? `타임라인 항목이 수정되었으며 '${learnedDuty}' 자동 작성 표준에도 반영되었습니다.`
          : '타임라인 항목이 수정되었습니다.',
      });
    });
  };

  // 항목 삭제
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

  // 임시저장
  const handleSaveDraft = async () => {
    if (selectedDuties.length === 0) {
      toast({ variant: 'destructive', description: '최소 1개 이상의 인계 대상 업무명을 선택하거나 입력하세요.' });
      return;
    }

    setIsSaving(true);
    try {
      const [primaryDuty, ...subDuties] = selectedDuties;

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
          status: 'DRAFT',
        },
        currentUserProfile,
        year
      );

      setDocId(savedId);
      setStatus('DRAFT');
      toast({
        title: '임시저장 완료',
        description: '인수인계서가 안전하게 임시저장되었습니다.',
      });
      onSaved?.(savedId, 'DRAFT');
    } catch (err) {
      console.error('save draft error:', err);
      toast({
        variant: 'destructive',
        title: '저장 실패',
        description: '임시저장 처리 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 최종 제출 (대기 상태로 전송)
  const handleSubmit = async () => {
    if (selectedDuties.length === 0) {
      toast({ variant: 'destructive', description: '최소 1개 이상의 주 업무명을 선택하거나 입력하세요.' });
      return;
    }
    if (items.length === 0) {
      toast({ variant: 'destructive', description: '최소 1건 이상의 인계 업무 항목이 등록되어야 합니다.' });
      return;
    }

    if (isReturning) {
      const returningError = validateReturningInfo(returningInfo);
      if (returningError) {
        toast({ variant: 'destructive', description: returningError });
        return;
      }
    }

    const confirmed = window.confirm(
      '인수인계서를 최종 제출하시겠습니까?\n제출된 인수인계서는 [교무부장 총괄 관리]로 모여 교무부장 확인 완료 후 일괄 교감 최종 결재로 상신됩니다.'
    );
    if (!confirmed) return;

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

      // 먼저 최신 데이터 저장
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

      // 최종 제출 트리거
      const res = await submitHandoverDocument(savedId, currentUserProfile, year);
      setDocId(savedId);
      setStatus(res.status);

      toast({
        title: '제출 완료',
        description:
          '교무부장 총괄 관리로 안전하게 제출되었습니다. 교무부장 확인 완료 후 일괄 교감 최종 결재로 상신됩니다.',
      });

      onSaved?.(savedId, res.status);
    } catch (err: any) {
      console.error('submit error:', err);
      toast({
        variant: 'destructive',
        title: '제출 실패',
        description: err.message || '인수인계서 제출 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 시기별로 항목 그룹화 (먼저 만든 문서가 위로 오도록 생성일자·시각 오름차순 정렬)
  const groupedItems = PERIOD_OPTIONS.map(period => ({
    period,
    items: items
      .filter(it => normalizeHandoverPeriodLabel(it.period) === period)
      .sort(compareHandoverItemsAsc),
  }));

  const otherItems = items
    .filter(it => !PERIOD_OPTIONS.includes(normalizeHandoverPeriodLabel(it.period)))
    .sort(compareHandoverItemsAsc);

  return (
    <div className="space-y-6">
      {/* 상단 안내 바 및 기안 누적 불러오기 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-600 text-white font-bold text-xs">
              {year}학년도 학년 말
            </Badge>
            <h2 className="font-black text-sm sm:text-base text-slate-900 tracking-tight">
              교원 업무 인수인계서 작성기
            </h2>
            <Badge variant="outline" className="border-indigo-300 text-indigo-800 text-[11px] font-bold">
              {getHandoverStatusLabel(status)}
            </Badge>
          </div>
          <p className="text-xs text-indigo-900">
            일년간 기안기로 작성했던 공문서를 원클릭으로 불러와 시기별로 정리하고, 전년도 업무 드라이브 폴더를 연동하세요.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleLoadAccumulatedPool}
          disabled={isLoadingPool}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-9 px-3.5 shrink-0 shadow-xs gap-1.5"
        >
          {isLoadingPool ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 text-amber-300" />
          )}
          <span>지난 1년 누적 기안 불러오기</span>
        </Button>
      </div>

      {/* 반려 / 수정 요청 사유 배너 */}
      {status === 'REJECTED' && initialDocument?.rejectionReason && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>반려 안내 {initialDocument.rejectedBy ? `(${initialDocument.rejectedBy})` : ''}</span>
          </div>
          <p className="text-xs text-rose-700 pl-5 whitespace-pre-wrap">{initialDocument.rejectionReason}</p>
        </div>
      )}
      {status === 'REVISION_REQUESTED' && initialDocument?.revisionRequestReason && (
        <div className="p-3.5 bg-orange-50 border border-orange-300 rounded-2xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-orange-900">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <span>
              {initialDocument.revisionRequestedByRole || '교감'} 수정 요청 안내
              {initialDocument.revisionRequestedBy ? ` (${initialDocument.revisionRequestedBy})` : ''}
            </span>
          </div>
          <p className="text-xs text-orange-800 pl-5 whitespace-pre-wrap">{initialDocument.revisionRequestReason}</p>
        </div>
      )}

      {/* 기본 정보 설정 카드 */}
      <Card className="border border-slate-200 rounded-2xl shadow-2xs">
        <CardHeader className="p-4 pb-2 border-b border-slate-100">
          <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600" />
            1. 인계 업무 기본 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-slate-700 min-h-5 flex items-center gap-1">
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
                placeholder="담당 업무 선택 또는 직접 추가 (복수 선택)"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-slate-700 min-h-5 flex items-center justify-between">
                <span>선택된 담당 업무 ({selectedDuties.length}건)</span>
                {selectedDuties.length > 0 && (
                  <span className="text-[10px] font-medium text-slate-400">× 클릭으로 제거 가능</span>
                )}
              </Label>
              <div className="min-h-9 px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50/70 flex flex-wrap items-center gap-1.5">
                {selectedDuties.length === 0 ? (
                  <span className="text-[11px] text-slate-400">좌측에서 담당 업무를 1개 이상 선택하거나 추가하세요.</span>
                ) : (
                  selectedDuties.map((duty, idx) => (
                    <Badge
                      key={duty}
                      variant={idx === 0 ? 'default' : 'outline'}
                      className={
                        idx === 0
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-2 py-0.5 gap-1 shadow-2xs'
                          : 'bg-white hover:bg-slate-100 text-indigo-800 border-indigo-200 text-[11px] font-semibold px-2 py-0.5 gap-1 shadow-2xs'
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-slate-700 min-h-5 flex items-center gap-1">
                <FolderOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>전년도 업무 드라이브/스토리지 폴더 링크</span>
              </Label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Google Drive 폴더 URL 또는 내부 스토리지 경로"
                  value={folderUrl}
                  onChange={e => {
                    const nextVal = e.target.value;
                    userEditedFolderRef.current = Boolean(nextVal.trim());
                    setFolderUrl(nextVal);
                  }}
                  className="h-9 text-xs bg-white border-slate-300 flex-1"
                />
                {folderUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(folderUrl, '_blank')}
                    className="h-9 px-2 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 shrink-0"
                    title="해당 폴더로 바로 이동"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    열기
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
                            ? 'text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-300'
                            : 'text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 transition-colors'
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

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-slate-700 min-h-5 flex items-center">
                전임자 비상 연락처
              </Label>
              <Input
                placeholder="후임자가 업무 확인 시 연락할 수 있는 전화번호 또는 이메일"
                value={contactInfo}
                onChange={e => setContactInfo(e.target.value)}
                className="h-9 text-xs bg-white border-slate-300"
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

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              총괄 인계 사항 및 연간 운영 팁 (주의사항 / 노하우)
            </Label>
            <Textarea
              placeholder="후임자를 위한 연간 추진 핵심 팁, 감사 지적사항, 업체 계약 주의점, 학기 초 우선 확인사항 등을 자유롭게 작성하세요."
              rows={3}
              value={generalGuide}
              onChange={e => setGeneralGuide(e.target.value)}
              className="text-xs bg-white border-slate-300 leading-relaxed"
            />
          </div>
        </CardContent>
      </Card>

      {/* 새 인계 항목 직접 추가 바 (기본 접힘 - 필요 시 펼쳐서 입력) */}
      <Card className="border border-indigo-100 bg-indigo-50/30 rounded-2xl shadow-2xs overflow-hidden">
        <CardHeader className={isManualAddOpen ? 'p-4 pb-2.5 border-b border-indigo-100' : 'p-3 px-4'}>
          <button
            type="button"
            onClick={() => setIsManualAddOpen(prev => !prev)}
            aria-expanded={isManualAddOpen}
            className="w-full flex items-center justify-between gap-2 text-left group cursor-pointer"
          >
            <CardTitle className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>2. 인계 항목 수동 추가 (기안문서 외 행사, 정기 과업 등)</span>
            </CardTitle>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-white border border-indigo-200 group-hover:bg-indigo-50 px-2.5 py-1 rounded-lg shadow-2xs shrink-0 transition-colors">
              <span>{isManualAddOpen ? '접기' : '펼쳐서 작성'}</span>
              {isManualAddOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </button>
        </CardHeader>
        {isManualAddOpen && (
          <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-[11px] font-bold text-slate-700">업무명 / 과업 제목</Label>
              <Input
                placeholder="예: 1학기 재난대피 훈련 실시 계획 수립"
                value={newItemTitle}
                onChange={e => setNewItemTitle(e.target.value)}
                className="h-8 text-xs bg-white border-slate-300"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-700">추진 시기</Label>
              <Select value={newItemPeriod} onValueChange={setNewItemPeriod}>
                <SelectTrigger className="h-8 text-xs bg-white border-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_PERIOD_OPTIONS.map(p => (
                    <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-700">업무 분류</Label>
              <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                <SelectTrigger className="h-8 text-xs bg-white border-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(c => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-700">추진 일자</Label>
              <Input
                type="date"
                value={newItemDate}
                onChange={e => setNewItemDate(e.target.value)}
                className="h-8 text-xs bg-white border-slate-300"
              />
            </div>

            <div className="sm:col-span-3 space-y-1">
              <Label className="text-[11px] font-bold text-slate-700">관련 문서 / 폴더 링크 (선택)</Label>
              <Input
                placeholder="Google Drive 파일 URL 등"
                value={newItemFolderUrl}
                onChange={e => setNewItemFolderUrl(e.target.value)}
                className="h-8 text-xs bg-white border-slate-300"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-slate-700">주요 인계 사항 및 팁</Label>
            <Input
              placeholder="예: 소방서 합동 훈련 시 최소 2주 전 공문 발송 필수, 강당 마이크 배터리 사전 점검"
              value={newItemSummary}
              onChange={e => setNewItemSummary(e.target.value)}
              className="h-8 text-xs bg-white border-slate-300"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
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
              className="h-8 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              항목 추가
            </Button>
          </div>
          </CardContent>
        )}
      </Card>

      {/* 시기별 인수인계 타임라인 목록 */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-xs sm:text-sm text-slate-800">
              3. 시기별 업무 인계 타임라인 ({items.length}건)
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {dismissedSystemTaskKeys.length > 0 && (status === 'DRAFT' || status === 'REJECTED') && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRestoreDismissed}
                className="h-7 text-[11px] font-bold text-indigo-700 border-indigo-200 hover:bg-indigo-50 px-2 gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>제외된 고정 업무 복원 ({dismissedSystemTaskKeys.length})</span>
              </Button>
            )}
            <span className="text-[11px] text-slate-500 font-medium">
              시스템 고정 업무 및 기안 문서가 시기 순서대로 자동 정리됩니다.
            </span>
          </div>
        </div>

        <HandoverDutyTemplateBar
          selectedDuties={selectedDuties}
          dutyTimelineTemplates={dutyTimelineTemplates}
          items={items}
          isEditable={status === 'DRAFT' || status === 'REJECTED'}
          onSyncNow={handleSyncCurrentTimelineToTemplate}
          onResetToDefault={handleResetDutyTemplates}
        />

        {items.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-600">등록된 인계 항목이 없습니다.</p>
            <p className="text-[11px] text-slate-400">
              상단의 [지난 1년 누적 기안 불러오기] 버튼을 누르거나 위 폼에서 직접 항목을 추가하세요.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedItems.map(group => {
              if (group.items.length === 0) return null;
              return (
                <div key={group.period} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-slate-100 text-slate-800 font-bold text-[11px] border-slate-300">
                      {group.period}
                    </Badge>
                    <span className="text-[11px] text-slate-400 font-medium">({group.items.length}건)</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {group.items.map(item => (
                      <HandoverTimelineItemCard
                        key={item.id}
                        item={item}
                        isEditing={editingItemId === item.id}
                        onStartEdit={(it) => setEditingItemId(it.id)}
                        onCancelEdit={() => setEditingItemId(null)}
                        onSaveEdit={handleSaveEditItem}
                        onRemove={handleRemoveItem}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {otherItems.length > 0 && (
              <div className="space-y-2">
                <Badge variant="outline" className="bg-slate-100 text-slate-800 font-bold text-[11px]">기타 시기</Badge>
                <div className="grid grid-cols-1 gap-2">
                  {otherItems.map(item => (
                    <HandoverTimelineItemCard
                      key={item.id}
                      item={item}
                      isEditing={editingItemId === item.id}
                      showPeriodBadgeInMeta={true}
                      onStartEdit={(it) => setEditingItemId(it.id)}
                      onCancelEdit={() => setEditingItemId(null)}
                      onSaveEdit={handleSaveEditItem}
                      onRemove={handleRemoveItem}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 저장 및 제출 액션 바 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
        <div className="text-xs text-slate-500">
          {status === 'SUBMITTED_WAITING_ACADEMIC_HEAD' && (
            <span className="text-sky-700 font-bold flex items-center gap-1">
              현재 [교무부장 확인 대기] 상태입니다. 수정 후 다시 저장하거나 제출할 수 있습니다.
            </span>
          )}
          {status === 'READY_FOR_VP_APPROVAL' && (
            <span className="text-purple-700 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 교무부장 확인 완료 · 교감 최종 결재 대기 중입니다.
            </span>
          )}
          {status === 'REVISION_REQUESTED' && (
            <span className="text-orange-700 font-bold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> 수정 요청된 상태입니다. 내용 보완 후 다시 제출해 주세요.
            </span>
          )}
          {status === 'REJECTED' && (
            <span className="text-rose-700 font-bold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> 반려된 상태입니다. 보완 후 다시 제출해 주세요.
            </span>
          )}
          {status === 'SUBMITTED_WAITING_SUCCESSOR' && (
            <span className="text-amber-700 font-bold flex items-center gap-1">
              현재 [교무부장 확인 대기 (인수자 미정)] 상태입니다. 수정 후 다시 저장하거나 제출할 수 있습니다.
            </span>
          )}
          {status === 'ASSIGNED_TO_SUCCESSOR' && (
            <span className="text-blue-700 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 후임자에게 배정되었습니다.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSaving || isSubmitting}
            className="h-10 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100 flex-1 sm:flex-none gap-1.5"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>임시저장</span>
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || isSubmitting}
            className="h-10 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex-1 sm:flex-none gap-1.5 shadow-xs"
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>인수인계서 최종 제출</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
