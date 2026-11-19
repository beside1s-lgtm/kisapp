'use client';

import React, { useEffect, useState } from 'react';
import { HandoverDocument } from '@/lib/types/handover';
import { UserProfile } from '@/lib/types';
import {
  confirmAndForwardHandoversToVicePrincipal,
  isHandoverAwaitingSuccessorSignature,
} from '@/lib/services/handoverService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  CheckSquare,
  ExternalLink,
  Loader2,
  MessageSquareWarning,
  RotateCcw,
  Send,
  Square,
  ClipboardCheck,
} from 'lucide-react';

interface AcademicHeadStagingCardProps {
  queueDocs: HandoverDocument[];
  forwardedToVpCount: number;
  currentUserProfile: UserProfile;
  onOpenViewer?: (doc: HandoverDocument) => void;
  onOpenReject: (doc: HandoverDocument) => void;
  onOpenRevision: (doc: HandoverDocument) => void;
  onForwarded: () => Promise<void> | void;
}

export function AcademicHeadStagingCard({
  queueDocs,
  forwardedToVpCount,
  currentUserProfile,
  onOpenViewer,
  onOpenReject,
  onOpenRevision,
  onForwarded,
}: AcademicHeadStagingCardProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isForwarding, setIsForwarding] = useState(false);

  // 인수자 서명 전 문서는 상신 대상에서 제외 (인수자 서명 → 교무부장 → 교감 순서)
  const forwardableDocs = queueDocs.filter((d) => !isHandoverAwaitingSuccessorSignature(d));
  const awaitingSuccessorCount = queueDocs.length - forwardableDocs.length;

  useEffect(() => {
    const valid = new Set(
      queueDocs.filter((d) => !isHandoverAwaitingSuccessorSignature(d)).map((d) => d.id)
    );
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)));
  }, [queueDocs]);

  const allSelected =
    forwardableDocs.length > 0 && forwardableDocs.every((d) => selectedIds.includes(d.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(forwardableDocs.map((d) => d.id));
    }
  };

  const handleForward = async (docIds: string[]) => {
    if (docIds.length === 0) {
      toast({ variant: 'destructive', description: '교감 결재로 상신할 인수인계서를 선택하세요.' });
      return;
    }

    const isAll = docIds.length === forwardableDocs.length;
    const confirmed = window.confirm(
      isAll
        ? `대기 중인 전체 ${docIds.length}건의 인수인계서를 교무부장 확인 완료 처리하여 교감 최종 결재로 일괄 상신하시겠습니까?`
        : `선택한 ${docIds.length}건의 인수인계서를 교무부장 확인 완료 처리하여 교감 최종 결재로 상신하시겠습니까?`
    );
    if (!confirmed) return;

    setIsForwarding(true);
    try {
      const res = await confirmAndForwardHandoversToVicePrincipal(docIds, currentUserProfile);
      toast({
        title: '교감 최종 결재 상신 완료',
        description:
          `${res.forwardedCount}건의 인수인계서가 교감 최종 결재 대기 목록으로 일괄 이동되었습니다.` +
          (res.skippedIds.length > 0
            ? ` (인수자 서명 전이거나 상태가 바뀐 ${res.skippedIds.length}건은 제외)`
            : ''),
      });
      setSelectedIds([]);
      await onForwarded();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '상신 실패',
        description: err?.message || '교감 최종 결재 상신 중 오류가 발생했습니다.',
      });
    } finally {
      setIsForwarding(false);
    }
  };

  const targetForwardIds = selectedIds.length > 0 ? selectedIds : forwardableDocs.map((d) => d.id);
  const targetCount = targetForwardIds.length;

  return (
    <Card className="border-2 border-sky-200 rounded-2xl shadow-2xs overflow-hidden bg-white">
      <CardHeader className="p-3 sm:p-4 pb-2.5 sm:pb-3 border-b border-sky-100 bg-sky-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="space-y-0.5 min-w-0 flex-1">
          <CardTitle className="text-xs sm:text-sm font-black text-sky-950 flex flex-wrap items-center gap-1.5 sm:gap-2">
            <ClipboardCheck className="w-4 h-4 text-sky-700 shrink-0" />
            <span>교무부장 확인 대기 및 일괄 교감 결재 상신 ({queueDocs.length}건)</span>
            {forwardedToVpCount > 0 && (
              <Badge
                variant="outline"
                className="bg-[#C49832]/10 text-[#8d6917] border-[#C49832]/40 text-[10px] font-bold"
              >
                교감 결재 대기 {forwardedToVpCount}건
              </Badge>
            )}
          </CardTitle>
          <p className="text-[11px] text-sky-800 leading-relaxed">
            인수자 서명이 끝난 인수인계서(인수자 미정 포함)를 확인 후 한 번에 교감 최종 결재로 상신하세요.
            {awaitingSuccessorCount > 0 && ` 인수자 서명 대기 ${awaitingSuccessorCount}건은 서명 후 상신할 수 있습니다.`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap w-full sm:w-auto justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
            disabled={forwardableDocs.length === 0 || isForwarding}
            className="h-8 px-2 sm:px-2.5 text-[11px] sm:text-xs font-bold bg-white border-sky-200 text-sky-800 hover:bg-sky-50 gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 flex items-center"
          >
            {allSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-sky-700 shrink-0" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span>{allSelected ? '선택 해제' : `전체 선택 (${forwardableDocs.length})`}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleForward(targetForwardIds)}
            disabled={targetForwardIds.length === 0 || isForwarding}
            title={
              selectedIds.length > 0
                ? `선택한 ${selectedIds.length}건 확인 완료 및 교감 결재 상신`
                : `전체 ${forwardableDocs.length}건 확인 완료 및 일괄 교감 결재 상신`
            }
            className="h-8 px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold bg-[#2471B2] hover:bg-[#1f5e94] text-white gap-1 sm:gap-1.5 shadow-xs whitespace-nowrap shrink-0 flex items-center"
          >
            {isForwarding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <Send className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>확인 완료/상신{forwardableDocs.length > 0 ? ` (${targetCount}건)` : ''}</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {queueDocs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            현재 교무부장 확인 대기 중인 신규 제출 인수인계서가 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[280px] overflow-y-auto">
            {queueDocs.map((doc) => {
              const checked = selectedIds.includes(doc.id);
              const awaitingSuccessor = isHandoverAwaitingSuccessorSignature(doc);
              return (
                <div
                  key={doc.id}
                  className={`px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                    checked ? 'bg-sky-50/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleSelect(doc.id)}
                      disabled={awaitingSuccessor}
                      title={awaitingSuccessor ? '인수자 서명 후 상신할 수 있습니다.' : undefined}
                      className="mt-0.5 sm:mt-0 text-sky-700 hover:text-sky-900 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label={`${doc.primaryDuty} 선택`}
                    >
                      {checked ? (
                        <CheckSquare className="w-4 h-4 text-sky-700" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 truncate">{doc.primaryDuty}</span>
                        {awaitingSuccessor ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-bold">
                            인수자 서명 대기
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-300 text-[10px] font-bold">
                            {doc.targetSuccessorEmail ? '인수자 서명 완료 · 교무부장 확인 대기' : '교무부장 확인 대기 (인수자 미정)'}
                          </Badge>
                        )}
                        <span className="text-[11px] text-slate-500">
                          항목 {(doc.items || []).length}건
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                        <span>
                          제출자: <b className="text-slate-700">{doc.authorName}</b> ({doc.authorDepartment || '부서 미지정'})
                        </span>
                        {doc.submittedAt && <span>제출일: {doc.submittedAt.slice(0, 10)}</span>}
                        {doc.targetSuccessorName && <span>인수 예정: {doc.targetSuccessorName}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-6 sm:ml-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenViewer?.(doc)}
                      className="h-7 text-[11px] font-bold text-[#2471B2] hover:bg-blue-50 px-2 gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>열람</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenRevision(doc)}
                      disabled={isForwarding}
                      className="h-7 text-[11px] font-bold text-orange-700 border-orange-200 hover:bg-orange-50 px-2 gap-1"
                    >
                      <MessageSquareWarning className="w-3 h-3" />
                      <span>수정 요청</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenReject(doc)}
                      disabled={isForwarding}
                      className="h-7 text-[11px] font-bold text-rose-600 border-rose-200 hover:bg-rose-50 px-2 gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>반려</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
