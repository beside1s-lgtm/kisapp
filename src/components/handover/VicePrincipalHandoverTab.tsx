'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { HandoverDocument } from '@/lib/types/handover';
import { UserProfile } from '@/lib/types';
import {
  batchApproveByVicePrincipal,
  rejectHandoverDocument,
  requestHandoverRevision,
  resolveNextHandoverArchiveYear,
  CURRENT_SCHOOL_YEAR,
} from '@/lib/services/handoverService';
import { HandoverDirectEditDialog } from './HandoverDirectEditDialog';
import {
  HandoverFeedbackDialog,
  HandoverFeedbackMode,
  buildFeedbackTargetFromDoc,
} from './HandoverFeedbackDialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  Eye,
  Loader2,
  MessageSquareWarning,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
  Square,
} from 'lucide-react';

interface VicePrincipalHandoverTabProps {
  vpDocs: HandoverDocument[];
  waitingAcademicHeadCount?: number;
  currentUserProfile: UserProfile;
  onOpenViewer: (doc: HandoverDocument) => void;
  onUpdated: () => Promise<void> | void;
}

export function VicePrincipalHandoverTab({
  vpDocs,
  waitingAcademicHeadCount = 0,
  currentUserProfile,
  onOpenViewer,
  onUpdated,
}: VicePrincipalHandoverTabProps) {
  const { toast } = useToast();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [batchComment, setBatchComment] = useState('');
  const [isBatchApproving, setIsBatchApproving] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  // 직접 수정 & 수정요청/반려 모달 상태
  const [editingDoc, setEditingDoc] = useState<HandoverDocument | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState<HandoverFeedbackMode>('revision');
  const [feedbackDoc, setFeedbackDoc] = useState<HandoverDocument | null>(null);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  // 대기 목록 변경 시 유효하지 않은 선택 ID 정리
  useEffect(() => {
    const validSet = new Set(vpDocs.map((d) => d.id));
    setSelectedIds((prev) => prev.filter((id) => validSet.has(id)));
  }, [vpDocs]);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return vpDocs;
    return vpDocs.filter(
      (d) =>
        (d.primaryDuty || '').toLowerCase().includes(q) ||
        (d.authorName || '').toLowerCase().includes(q) ||
        (d.authorDepartment || '').toLowerCase().includes(q)
    );
  }, [vpDocs, searchQuery]);

  const allFilteredSelected =
    filteredDocs.length > 0 && filteredDocs.every((d) => selectedIds.includes(d.id));

  const toggleSelectDoc = (docId: string) => {
    setSelectedIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredDocs.map((d) => d.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...filteredDocs.map((d) => d.id)]);
      setSelectedIds(Array.from(merged));
    }
  };

  const runBatchApprove = async (targetDocIds: string[]) => {
    if (targetDocIds.length === 0) {
      toast({ variant: 'destructive', description: '최종 결재할 인수인계서를 선택하세요.' });
      return;
    }

    const nextYear = resolveNextHandoverArchiveYear(vpDocs[0]?.year || CURRENT_SCHOOL_YEAR);
    const confirmed = window.confirm(
      `총 ${targetDocIds.length}건의 인수인계서를 한 번에 최종 결재하고 ${nextYear}학년도 인수인계 폴더에 자동 저장하시겠습니까?`
    );
    if (!confirmed) return;

    setIsBatchApproving(true);
    setBatchProgress({ done: 0, total: targetDocIds.length });

    try {
      const signature = currentUserProfile.signature || '';
      const result = await batchApproveByVicePrincipal(
        targetDocIds,
        signature,
        batchComment.trim() || '일괄 최종 확인 및 결재 완료',
        currentUserProfile,
        (done, total) => setBatchProgress({ done, total })
      );

      if (result.failedIds.length === 0 && result.driveErrors.length === 0) {
        toast({
          title: '일괄 최종 결재 및 Drive 저장 완료',
          description: `${result.approvedCount}건이 최종 승인되어 ${result.targetYear}학년도 인수인계 폴더에 자동 보관되었습니다.`,
        });
      } else {
        toast({
          variant: result.failedIds.length > 0 ? 'destructive' : 'default',
          title: '일괄 최종 결재 처리 결과',
          description: `승인 ${result.approvedCount}/${result.totalRequested}건 완료 · Drive 저장 ${result.driveArchivedCount}건 완료${
            result.driveErrors.length > 0 ? ` (일부 경고 ${result.driveErrors.length}건)` : ''
          }`,
        });
      }
      setBatchComment('');
      setSelectedIds([]);
      await onUpdated();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '일괄 결재 오류',
        description: err?.message || '일괄 결재 처리 중 오류가 발생했습니다.',
      });
    } finally {
      setIsBatchApproving(false);
      setBatchProgress(null);
    }
  };

  const openFeedback = (doc: HandoverDocument, mode: HandoverFeedbackMode) => {
    setFeedbackDoc(doc);
    setFeedbackMode(mode);
    setFeedbackOpen(true);
  };

  const handleConfirmFeedback = async (reason: string) => {
    if (!feedbackDoc) return;
    setIsSendingFeedback(true);
    try {
      if (feedbackMode === 'revision') {
        await requestHandoverRevision(
          feedbackDoc.id,
          reason,
          currentUserProfile.name || '교감',
          '교감'
        );
        toast({
          title: '수정 요청 완료',
          description: `${feedbackDoc.authorName} 교사의 "${feedbackDoc.primaryDuty}" 인수인계서에 수정 요청이 전달되었습니다.`,
        });
      } else {
        await rejectHandoverDocument(
          feedbackDoc.id,
          reason,
          currentUserProfile.name || '교감'
        );
        toast({
          title: '반려 처리 완료',
          description: `${feedbackDoc.authorName} 교사의 "${feedbackDoc.primaryDuty}" 인수인계서가 반려되었습니다.`,
        });
      }
      setFeedbackOpen(false);
      await onUpdated();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: feedbackMode === 'revision' ? '수정 요청 실패' : '반려 처리 실패',
        description: err?.message || '처리 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSendingFeedback(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 상단 일괄 결재 컨트롤 바 (학교 공식 Blue 테마) */}
      <Card className="p-4 border border-[#2471B2]/20 bg-blue-50/25 rounded-2xl shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2471B2]" />
              <h3 className="font-bold text-sm text-slate-900">
                교감 최종 결재 대기 목록 ({vpDocs.length}건)
              </h3>
              {waitingAcademicHeadCount > 0 && (
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-bold"
                >
                  교무부장 확인 대기 중 {waitingAcademicHeadCount}건
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-600">
              교무부장 확인을 거쳐 일괄 상신된 인수인계서를 열람하여 직접 수정·수정 요청·반려하거나, 한 번에 일괄 최종 결재할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleSelectAllFiltered}
              disabled={filteredDocs.length === 0 || isBatchApproving}
              className="h-8 text-xs font-bold bg-white border-[#2471B2]/30 text-[#2471B2] hover:bg-blue-50 gap-1"
            >
              {allFilteredSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-[#2471B2]" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{allFilteredSelected ? '선택 해제' : `전체 선택 (${filteredDocs.length})`}</span>
            </Button>

            {selectedIds.length > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={() => runBatchApprove(selectedIds)}
                disabled={isBatchApproving}
                className="h-8 text-xs font-bold bg-[#1f5e94] hover:bg-[#184974] text-white gap-1.5 shadow-xs"
              >
                {isBatchApproving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>선택 일괄 최종 결재 ({selectedIds.length}건)</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={() => runBatchApprove(vpDocs.map((d) => d.id))}
              disabled={vpDocs.length === 0 || isBatchApproving}
              className="h-8 text-xs font-bold bg-[#2471B2] hover:bg-[#1f5e94] text-white gap-1.5 shadow-xs"
            >
              {isBatchApproving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>
                {batchProgress
                  ? `결재 진행 중 (${batchProgress.done}/${batchProgress.total})`
                  : `전체 일괄 최종 결재 (${vpDocs.length}건)`}
              </span>
            </Button>
          </div>
        </div>

        {/* 일괄 결재 의견 및 검색 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="업무명 / 작성자 / 부서 검색..."
              className="h-8 text-xs pl-8 bg-white border-slate-300"
            />
          </div>
          <Input
            value={batchComment}
            onChange={(e) => setBatchComment(e.target.value)}
            placeholder="일괄 결재 시 공통으로 남길 결재 의견 (선택)"
            className="h-8 text-xs bg-white border-slate-300"
          />
        </div>
      </Card>

      {/* 대기 문서 카드 목록 */}
      {filteredDocs.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-1">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="text-xs font-semibold text-slate-600">
            {vpDocs.length === 0
              ? '교무부장이 확인 후 상신한 결재 대기 인수인계서가 없습니다.'
              : '검색 조건과 일치하는 인수인계서가 없습니다.'}
          </p>
          {waitingAcademicHeadCount > 0 && vpDocs.length === 0 && (
            <p className="text-[11px] text-amber-700 font-medium">
              현재 교무부장 총괄 관리에서 {waitingAcademicHeadCount}건의 인수인계서를 취합·확인 중입니다.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredDocs.map((doc) => {
            const isChecked = selectedIds.includes(doc.id);
            return (
              <Card
                key={doc.id}
                className={`p-4 rounded-xl transition-all space-y-3 shadow-2xs border ${
                  isChecked
                    ? 'border-[#2471B2] bg-blue-50/20 ring-1 ring-[#2471B2]/30'
                    : 'border-slate-200 bg-white hover:border-[#2471B2]/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleSelectDoc(doc.id)}
                      className="mt-0.5 text-[#2471B2] hover:text-[#1f5e94] shrink-0"
                      aria-label={`${doc.primaryDuty} 선택`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-[#2471B2]" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-black text-xs sm:text-sm text-slate-900 truncate">
                          {doc.primaryDuty}
                        </span>
                        {doc.lastEditedByName && (
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-[#2471B2] border-[#2471B2]/30 text-[9px] font-bold px-1.5 py-0"
                          >
                            {doc.lastEditedByRole || '관리자'} 수정됨
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600">
                        작성: <b className="text-slate-800">{doc.authorName}</b>
                        {doc.authorDepartment ? ` (${doc.authorDepartment})` : ''}
                        {doc.targetSuccessorName ? ` → 인수: ${doc.targetSuccessorName}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        교무부장 확인: {doc.academicHeadName || '확인 완료'}
                        {doc.academicHeadReviewedAt ? ` (${doc.academicHeadReviewedAt.slice(0, 10)})` : ''}
                        {' · '}항목 {(doc.items || []).length}건
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className="bg-[#C49832]/10 text-[#8d6917] text-[10px] border-[#C49832]/40 font-bold shrink-0"
                  >
                    교감 결재 대기
                  </Badge>
                </div>

                {doc.generalGuide && (
                  <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2 line-clamp-2">
                    {doc.generalGuide}
                  </p>
                )}

                <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1.5 border-t border-slate-100">
                  <div className="flex items-center gap-1 flex-wrap">
                    {doc.folderUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(doc.folderUrl, '_blank')}
                        className="h-7 text-[11px] text-slate-600 hover:bg-slate-100 px-2 gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>폴더</span>
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-wrap ml-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingDoc(doc)}
                      disabled={isBatchApproving}
                      className="h-7 text-[11px] font-bold text-[#2471B2] border-[#2471B2]/30 hover:bg-blue-50 px-2 gap-1"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>직접 수정</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openFeedback(doc, 'revision')}
                      disabled={isBatchApproving}
                      className="h-7 text-[11px] font-bold text-orange-700 border-orange-200 hover:bg-orange-50 px-2 gap-1"
                    >
                      <MessageSquareWarning className="w-3 h-3" />
                      <span>수정 요청</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openFeedback(doc, 'reject')}
                      disabled={isBatchApproving}
                      className="h-7 text-[11px] font-bold text-[#B01E23] border-[#B01E23]/30 hover:bg-rose-50 px-2 gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>반려</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onOpenViewer(doc)}
                      disabled={isBatchApproving}
                      className="h-7 text-[11px] font-bold bg-[#2471B2] hover:bg-[#1f5e94] text-white px-2.5 gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>열람 / 결재</span>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 직접 수정 모달 */}
      <HandoverDirectEditDialog
        open={Boolean(editingDoc)}
        onOpenChange={(open) => {
          if (!open) setEditingDoc(null);
        }}
        document={editingDoc}
        currentUserProfile={currentUserProfile}
        reviewerRoleLabel="교감"
        onSaved={async () => {
          await onUpdated();
        }}
      />

      {/* 수정 요청 / 반려 사유 모달 */}
      <HandoverFeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        mode={feedbackMode}
        targetDoc={feedbackDoc ? buildFeedbackTargetFromDoc(feedbackDoc) : null}
        isSubmitting={isSendingFeedback}
        onConfirm={handleConfirmFeedback}
      />
    </div>
  );
}
