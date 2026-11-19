'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  Save,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type {
  CustomDutyChecklistItem,
  CustomDutyModuleKey,
  CustomFeatureUpgradeRequest,
  FeatureUpgradeRequestStatus,
} from '@/lib/types/customDuty';
import {
  applyFeatureUpgradeDecision,
  getCustomDutyHref,
  getCustomDutyWorkspace,
} from '@/lib/services/customDutyService';
import { downloadAttachmentSafely, formatAttachmentSize } from './attachmentDownloadHelper';

interface CustomFeatureRequestManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requests: CustomFeatureUpgradeRequest[];
  adminEmail: string;
  adminName: string;
  isPopupAlertMode?: boolean;
}

const STATUS_META: Record<
  FeatureUpgradeRequestStatus,
  { label: string; className: string }
> = {
  pending: { label: '대기 중', className: 'bg-rose-600 text-white' },
  in_review: { label: '검토/개발 중', className: 'bg-amber-500 text-white' },
  upgraded: { label: '업그레이드 완료', className: 'bg-emerald-600 text-white' },
  rejected: { label: '보완 요청', className: 'bg-slate-500 text-white' },
};

const MODULE_CHECKS: Array<{ key: CustomDutyModuleKey; label: string }> = [
  { key: 'custom_table', label: '맞춤형 데이터 표 (입력/검색/엑셀)' },
  { key: 'checklist', label: '연간 추진 체크리스트' },
  { key: 'approval_history', label: '이 업무 전자결재 이력 자동 연동' },
];

export function CustomFeatureRequestManagerModal({
  open,
  onOpenChange,
  requests,
  adminEmail,
  adminName,
  isPopupAlertMode = false,
}: CustomFeatureRequestManagerModalProps) {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<'all' | FeatureUpgradeRequestStatus>('pending');
  const [selectedId, setSelectedId] = useState<string>('');

  // 업그레이드 편집 상태
  const [editStatus, setEditStatus] = useState<FeatureUpgradeRequestStatus>('upgraded');
  const [enabledModules, setEnabledModules] = useState<CustomDutyModuleKey[]>([]);
  const [columnsInput, setColumnsInput] = useState('');
  const [checklistInput, setChecklistInput] = useState('');
  const [upgradedRoute, setUpgradedRoute] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredRequests = useMemo(() => {
    if (filterStatus === 'all') return requests;
    return requests.filter((r) => r.status === filterStatus);
  }, [requests, filterStatus]);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'pending').length,
    [requests]
  );

  useEffect(() => {
    if (!open) return;
    if (pendingCount > 0 && filterStatus === 'pending') {
      // stay on pending
    } else if (filteredRequests.length === 0 && requests.length > 0 && filterStatus === 'pending') {
      setFilterStatus('all');
    }
  }, [open, pendingCount, requests.length, filteredRequests.length, filterStatus]);

  const selectedRequest = useMemo(() => {
    return (
      filteredRequests.find((r) => r.id === selectedId) ||
      filteredRequests[0] ||
      requests[0] ||
      null
    );
  }, [filteredRequests, requests, selectedId]);

  useEffect(() => {
    if (!open || !selectedRequest) return;
    let active = true;

    const loadCurrentWs = async () => {
      try {
        const ws = await getCustomDutyWorkspace(selectedRequest.dutyName);
        if (!active) return;
        const baseModules =
          ws.enabledModules && ws.enabledModules.length > 0
            ? ws.enabledModules
            : selectedRequest.desiredModules && selectedRequest.desiredModules.length > 0
              ? selectedRequest.desiredModules
              : (['custom_table', 'checklist', 'approval_history'] as CustomDutyModuleKey[]);
        setEnabledModules(baseModules);
        setColumnsInput(
          ws.customTableColumns && ws.customTableColumns.length > 0
            ? ws.customTableColumns.join(', ')
            : selectedRequest.desiredColumnsText || '구분, 대상자명, 연락처, 상태, 비고'
        );
        setChecklistInput(
          ws.customChecklist && ws.customChecklist.length > 0
            ? ws.customChecklist.map((c) => (c.timing ? `[${c.timing}] ${c.title}` : c.title)).join('\n')
            : `[계획] ${selectedRequest.dutyName} 기본 계획 기안\n[실행] 세부 추진 일정 및 대상자 관리\n[마감] 결과 보고 및 차년도 인수인계 정리`
        );
        setUpgradedRoute(selectedRequest.upgradedRoute || ws.upgradedRoute || '');
        setAdminNotes(
          selectedRequest.adminNotes ||
            `${selectedRequest.dutyName} 업무 요청을 반영하여 관리 대장, 체크리스트 및 표준 서식 연동을 활성화했습니다.`
        );
        setEditStatus(
          selectedRequest.status === 'pending' ? 'upgraded' : selectedRequest.status
        );
      } catch (err) {
        console.warn('[CustomFeatureRequestManagerModal] workspace load failed:', err);
      }
    };

    loadCurrentWs();
    return () => {
      active = false;
    };
  }, [open, selectedRequest]);

  const toggleModule = (modKey: CustomDutyModuleKey) => {
    setEnabledModules((prev) =>
      prev.includes(modKey) ? prev.filter((k) => k !== modKey) : [...prev, modKey]
    );
  };

  const handleSaveUpgrade = async () => {
    if (!selectedRequest) return;
    setSaving(true);
    try {
      const parsedCols = columnsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const parsedChecklist: CustomDutyChecklistItem[] = checklistInput
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, idx) => {
          const match = line.match(/^\[([^\]]+)\]\s*(.+)$/);
          return {
            id: `chk_${Date.now()}_${idx}`,
            timing: match ? match[1].trim() : '상시',
            title: match ? match[2].trim() : line,
            done: false,
          };
        });

      await applyFeatureUpgradeDecision({
        request: selectedRequest,
        status: editStatus,
        adminNotes,
        handledBy: adminEmail,
        handledByName: adminName,
        enabledModules,
        customTableColumns: parsedCols,
        customChecklist: parsedChecklist,
        upgradedRoute,
      });

      toast({
        title: '업무기능 업그레이드 반영 완료',
        description: `[${selectedRequest.dutyName}] 업무 페이지에 요청 처리 상태와 기능 모듈이 즉시 적용되었습니다.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '반영 실패',
        description: err?.message || '처리 중 오류가 발생했습니다.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[980px] max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-5 py-4 border-b bg-slate-900 text-white shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
            <Wrench className="w-4 h-4 text-amber-400" />
            <span>
              {isPopupAlertMode
                ? '신규 업무기능 추가 요청 알림 (시스템 담당자 전용)'
                : '교직원 커스텀 업무기능 요청 & 업그레이드 관리'}
            </span>
            {pendingCount > 0 && (
              <Badge className="bg-rose-600 text-white text-[10px] font-bold">
                미처리 {pendingCount}건
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-300">
            담당 교사가 빈 업무기능 페이지에 업로드한 표준 기안문서·붙임문서를 검토하고 맞춤 업무기능을 활성화·업그레이드하세요.
          </DialogDescription>
        </DialogHeader>

        {/* 필터 바 */}
        <div className="px-5 py-2.5 border-b bg-slate-50 flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'pending', label: `대기 중 (${requests.filter((r) => r.status === 'pending').length})` },
                { id: 'in_review', label: `검토 중 (${requests.filter((r) => r.status === 'in_review').length})` },
                { id: 'upgraded', label: `업그레이드 완료 (${requests.filter((r) => r.status === 'upgraded').length})` },
                { id: 'all', label: `전체 (${requests.length})` },
              ] as const
            ).map((tab) => (
              <Button
                key={tab.id}
                type="button"
                size="sm"
                variant={filterStatus === tab.id ? 'default' : 'outline'}
                onClick={() => setFilterStatus(tab.id)}
                className="h-7 text-xs font-bold"
              >
                {tab.label}
              </Button>
            ))}
          </div>
          {selectedRequest && (
            <Link
              href={getCustomDutyHref(selectedRequest.dutyName, upgradedRoute)}
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline"
            >
              <span>{selectedRequest.dutyName} 페이지 바로가기</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {/* 본문 2단 레이아웃 */}
        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* 좌측: 요청 목록 */}
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r bg-slate-50/40 overflow-y-auto overscroll-contain p-3 space-y-2 max-h-[220px] md:max-h-none">
            {filteredRequests.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">
                해당 상태의 업무기능 요청이 없습니다.
              </div>
            ) : (
              filteredRequests.map((req) => {
                const isSelected = selectedRequest?.id === req.id;
                const badgeMeta = STATUS_META[req.status] || STATUS_META.pending;
                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => setSelectedId(req.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all space-y-1.5 ${
                      isSelected
                        ? 'bg-white border-indigo-400 shadow-sm ring-1 ring-indigo-200'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <Badge variant="outline" className="text-[10px] font-bold bg-indigo-50 text-indigo-800 border-indigo-200 truncate">
                        {req.dutyName}
                      </Badge>
                      <Badge className={`text-[9px] px-1.5 py-0 font-bold shrink-0 ${badgeMeta.className}`}>
                        {badgeMeta.label}
                      </Badge>
                    </div>
                    <div className="text-xs font-bold text-slate-900 line-clamp-1">
                      {req.requestTitle}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{req.requesterName} {req.deptName ? `(${req.deptName})` : ''}</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString('ko-KR') : ''}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* 우측: 상세 검수 및 업그레이드 콘솔 */}
          <div className="md:col-span-8 overflow-y-auto overscroll-contain p-5 space-y-5 bg-white">
            {!selectedRequest ? (
              <div className="py-16 text-center text-xs text-slate-400">
                좌측 목록에서 검토할 요청을 선택하세요.
              </div>
            ) : (
              <>
                <div className="space-y-2 pb-3 border-b">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        {selectedRequest.requestTitle}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        요청자: <strong>{selectedRequest.requesterName}</strong> ({selectedRequest.requesterEmail})
                        {selectedRequest.deptName ? ` · ${selectedRequest.deptName}` : ''}
                      </p>
                    </div>
                    <Badge className={STATUS_META[selectedRequest.status]?.className}>
                      {STATUS_META[selectedRequest.status]?.label}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {selectedRequest.requestDescription}
                  </div>
                </div>

                {/* 업로드된 표준 기안문서 & 붙임문서 확인 */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>첨부된 표준 기안문서({selectedRequest.uploadedDocs?.length || 0}건) 및 붙임파일({selectedRequest.attachments?.length || 0}건)</span>
                  </Label>

                  {(!selectedRequest.uploadedDocs || selectedRequest.uploadedDocs.length === 0) &&
                  (!selectedRequest.attachments || selectedRequest.attachments.length === 0) ? (
                    <p className="text-xs text-slate-400 p-3 rounded-xl border border-dashed">
                      업로드된 참고 서류가 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(selectedRequest.uploadedDocs || []).map((docItem) => (
                        <div
                          key={docItem.id}
                          className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-indigo-950">
                              [표준 기안] {docItem.title}
                            </span>
                            {docItem.isDefault && (
                              <Badge className="bg-indigo-600 text-white text-[9px]">기본 서식</Badge>
                            )}
                          </div>
                          {docItem.content && (
                            <div
                              className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] max-h-32 overflow-y-auto prose prose-xs max-w-none"
                              dangerouslySetInnerHTML={{ __html: docItem.content }}
                            />
                          )}
                          {(docItem.attachments || []).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {docItem.attachments.map((att, i) => (
                                <Button
                                  key={`${att.name}_${i}`}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadAttachmentSafely(att)}
                                  className="h-6 text-[11px] px-2 bg-white gap-1 text-indigo-700 border-indigo-200"
                                >
                                  <Download className="w-3 h-3" />
                                  <span className="truncate max-w-[180px]">{att.name}</span>
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {(selectedRequest.attachments || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedRequest.attachments.map((att, idx) => (
                            <Button
                              key={`req_att_${idx}`}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => downloadAttachmentSafely(att)}
                              className="h-7 text-xs bg-white gap-1.5 text-slate-700"
                            >
                              <Paperclip className="w-3 h-3 text-indigo-600" />
                              <span className="truncate max-w-[200px]">{att.name}</span>
                              {att.size ? (
                                <span className="text-[10px] text-slate-400">
                                  ({formatAttachmentSize(att.size)})
                                </span>
                              ) : null}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 시스템 담당자 기능 업그레이드 적용 */}
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>맞춤 업무기능 업그레이드 & 처리 상태 반영</span>
                    </Label>
                    <Select
                      value={editStatus}
                      onValueChange={(v) => setEditStatus(v as FeatureUpgradeRequestStatus)}
                    >
                      <SelectTrigger className="h-8 w-44 text-xs font-bold bg-white border-indigo-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">대기 중</SelectItem>
                        <SelectItem value="in_review">검토 / 구축 진행 중</SelectItem>
                        <SelectItem value="upgraded">업그레이드 완료 (활성화)</SelectItem>
                        <SelectItem value="rejected">보완 요청 / 반려</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-800">
                      [{selectedRequest.dutyName}] 페이지에 탑재할 기능 모듈 선택
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {MODULE_CHECKS.map((mod) => (
                        <label
                          key={mod.key}
                          className="flex items-center gap-2 p-2 rounded-lg border border-indigo-100 bg-white text-xs font-semibold cursor-pointer"
                        >
                          <Checkbox
                            checked={enabledModules.includes(mod.key)}
                            onCheckedChange={() => toggleModule(mod.key)}
                          />
                          <span className="leading-tight">{mod.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {enabledModules.includes('custom_table') && (
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-700">
                        관리 대장 표 컬럼 (쉼표 구분)
                      </Label>
                      <Input
                        value={columnsInput}
                        onChange={(e) => setColumnsInput(e.target.value)}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  )}

                  {enabledModules.includes('checklist') && (
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-700">
                        연간 추진 체크리스트 기본 항목 ([시기] 과업명, 줄바꿈 구분)
                      </Label>
                      <Textarea
                        value={checklistInput}
                        onChange={(e) => setChecklistInput(e.target.value)}
                        rows={3}
                        className="text-xs bg-white"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">
                      전용 개발 페이지 링크 연결 (선택 — 비워두면 맞춤형 워크스페이스 사용)
                    </Label>
                    <Input
                      value={upgradedRoute}
                      onChange={(e) => setUpgradedRoute(e.target.value)}
                      placeholder="예: /teacher/custom-duty?duty=신입생%20모집 (또는 별도 구현 경로)"
                      className="h-8 text-xs bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">
                      시스템 담당자 안내 / 패치 노트 (교사 화면에 표시)
                    </Label>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={2}
                      className="text-xs bg-white"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      disabled={saving}
                      onClick={handleSaveUpgrade}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5"
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : editStatus === 'upgraded' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>업그레이드 적용 및 저장</span>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-slate-50 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
