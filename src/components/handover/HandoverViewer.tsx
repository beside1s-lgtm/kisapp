'use client';

import { formatServicePeriod } from '@/lib/handover/returningTeacher';
import React, { useEffect, useState } from 'react';
import { getTeacherStampSignature, isActualSignature } from '@/lib/safety/stampHelper';
import { HandoverDocument, HandoverStatus } from '@/lib/types/handover';
import { UserProfile } from '@/lib/types';
import {
  approveBySuccessor,
  isHandoverAwaitingSuccessorSignature,
  approveByVicePrincipal,
  compareHandoverItemsAsc,
  getHandoverStatusLabel,
  isHandoverInVpQueue,
  rejectHandoverDocument,
  requestHandoverRevision,
} from '@/lib/services/handoverService';
import { getHandoverItemTimingMeta } from '@/lib/handover/systemDutyBlueprints';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { HandoverPrintModal } from './HandoverPrintModal';
import { HandoverDirectEditDialog } from './HandoverDirectEditDialog';
import { HandoverFeedbackDialog, HandoverFeedbackMode, buildFeedbackTargetFromDoc } from './HandoverFeedbackDialog';
import { useToast } from '@/hooks/use-toast';
import {
  FolderOpen,
  Calendar,
  ExternalLink,
  CheckCircle,
  FileCheck2,
  Clock,
  ShieldCheck,
  UserCheck,
  Loader2,
  Pencil,
  MessageSquareWarning,
  RotateCcw
} from 'lucide-react';

interface HandoverViewerProps {
  document: HandoverDocument;
  currentUserProfile: UserProfile;
  mode?: 'view' | 'successor' | 'vice_principal';
  onUpdated?: () => void;
}

export function HandoverViewer({
  document: propDocument,
  currentUserProfile,
  mode = 'view',
  onUpdated,
}: HandoverViewerProps) {
  const { toast } = useToast();

  const [document, setDocument] = useState<HandoverDocument>(propDocument);
  const [comment, setComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDirectEditOpen, setIsDirectEditOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState<HandoverFeedbackMode>('revision');

  useEffect(() => {
    setDocument(propDocument);
  }, [propDocument]);

  // 인수자 확인·서명 처리 (등록 서명이 없으면 성명 직인으로 대체)
  const handleSuccessorApprove = async () => {
    const registered = currentUserProfile.signature || '';
    const signature = isActualSignature(registered)
      ? registered
      : getTeacherStampSignature(currentUserProfile.name || document.targetSuccessorName || '교사');

    const confirmed = window.confirm('인계 내용을 확인하였으며, 인수자 서명 후 교무부장 확인 단계로 전달하시겠습니까?');
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      await approveBySuccessor(document.id, signature, comment, currentUserProfile);
      toast({
        title: '인수 확인·서명 완료',
        description: '인수자 서명이 완료되어 교무부장 확인 대기로 전달되었습니다.',
      });
      onUpdated?.();
    } catch (err: any) {
      console.error('successor approve error:', err);
      toast({
        variant: 'destructive',
        title: '처리 실패',
        description: err.message || '인수 결재 처리 중 오류가 발생했습니다.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 교감 최종 승인 처리
  const handleVicePrincipalApprove = async () => {
    const signature = currentUserProfile.signature || '';
    const nextTargetYear = (Number(document.year) || new Date().getFullYear()) + 1;
    const confirmed = window.confirm(
      `인수인계 내역을 최종 결재하고 ${nextTargetYear}학년도 인수인계 폴더에 자동 저장하시겠습니까?`
    );
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      const result = await approveByVicePrincipal(document.id, signature, comment, currentUserProfile);
      if (result.driveArchived) {
        toast({
          title: '최종 결재 및 Drive 저장 완료',
          description: `업무 인수인계서가 최종 승인되어 ${result.targetYear}학년도 인수인계 폴더에 자동 저장되었습니다.`,
        });
      } else if (result.archiveError) {
        toast({
          variant: 'destructive',
          title: '결재 완료 (Drive 저장 일부 실패)',
          description: `최종 결재는 완료되었으나 ${result.targetYear}학년도 인수인계 폴더 저장 중 오류가 발생했습니다: ${result.archiveError}`,
        });
      } else {
        toast({
          title: '최종 결재 완료',
          description: '업무 인수인계서가 최종 승인되어 아카이브 보관함에 보관되었습니다.',
        });
      }
      onUpdated?.();
    } catch (err: any) {
      console.error('vp approve error:', err);
      toast({
        variant: 'destructive',
        title: '처리 실패',
        description: err.message || '교감 결재 처리 중 오류가 발생했습니다.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: HandoverStatus) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="outline" className="bg-slate-100 text-slate-700">{getHandoverStatusLabel(status)}</Badge>;
      case 'SUBMITTED_WAITING_ACADEMIC_HEAD':
      case 'SUBMITTED_WAITING_SUCCESSOR':
        return <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-300 font-bold">{getHandoverStatusLabel(status)}</Badge>;
      case 'ASSIGNED_TO_SUCCESSOR':
        return <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-300">{getHandoverStatusLabel(status)}</Badge>;
      case 'READY_FOR_VP_APPROVAL':
      case 'SUCCESSOR_APPROVED':
        return <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-300 font-bold">{getHandoverStatusLabel(status)}</Badge>;
      case 'REVISION_REQUESTED':
        return <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-300 font-bold">{getHandoverStatusLabel(status)}</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive" className="font-bold">{getHandoverStatusLabel(status)}</Badge>;
      case 'VICE_PRINCIPAL_APPROVED':
      case 'ARCHIVED':
        return <Badge className="bg-emerald-600 text-white font-bold">최종 결재 완료 (아카이브)</Badge>;
      default:
        return null;
    }
  };

  const handleConfirmFeedback = async (reason: string) => {
    setIsProcessing(true);
    try {
      if (feedbackMode === 'revision') {
        await requestHandoverRevision(
          document.id,
          reason,
          currentUserProfile.name || '교감',
          mode === 'vice_principal' ? '교감' : '교무부장'
        );
        toast({
          title: '수정 요청 완료',
          description: `${document.authorName} 교사의 인계서에 수정 요청이 전달되었습니다.`,
        });
      } else {
        await rejectHandoverDocument(
          document.id,
          reason,
          currentUserProfile.name || '관리자'
        );
        toast({
          title: '반려 처리 완료',
          description: `${document.authorName} 교사의 인계서가 반려 처리되었습니다.`,
        });
      }
      setFeedbackOpen(false);
      onUpdated?.();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: feedbackMode === 'revision' ? '수정 요청 실패' : '반려 실패',
        description: err?.message || '처리 중 오류가 발생했습니다.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 바 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-slate-900 tracking-tight">
              {document.year}학년도 {document.primaryDuty} 인수인계서
            </span>
            {getStatusBadge(document.status)}
          </div>
          {document.subDuties && document.subDuties.length > 0 && (
            <p className="text-xs text-slate-500">
              부 업무: <b className="text-slate-700">{document.subDuties.join(', ')}</b>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>인계자: <b className="text-slate-800">{document.authorName}</b> ({document.authorEmail})</span>
            <span>인수자: <b className="text-slate-800">{document.targetSuccessorName || '미배정'}</b></span>
            {document.submittedAt && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="w-3 h-3" /> 제출: {document.submittedAt.slice(0, 10)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <HandoverPrintModal document={document} />
        </div>
      </div>

      {/* 결재선 현황 카드 */}
      <Card className="border border-slate-200 rounded-2xl shadow-2xs">
        <CardHeader className="p-4 pb-2 border-b border-slate-100">
          <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            인수인계 결재선 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. 인계자 */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-center">
              <span className="text-[11px] font-bold text-slate-500">인계자 (전임)</span>
              <div className="font-bold text-xs text-slate-900">{document.authorName}</div>
              <div className="text-[10px] text-slate-400">{document.authorEmail}</div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px] border-emerald-200 font-bold">
                인계 제출 완료
              </Badge>
            </div>

            {/* 2. 교무부장 */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-center">
              <span className="text-[11px] font-bold text-slate-500">교무부장 (총괄 확인)</span>
              <div className="font-bold text-xs text-slate-900">{document.academicHeadName || '교무부장'}</div>
              <div className="text-[10px] text-slate-400">
                {document.academicHeadReviewedAt ? document.academicHeadReviewedAt.slice(0, 10) : '-'}
              </div>
              {document.academicHeadReviewedAt ? (
                <Badge variant="outline" className="bg-sky-50 text-sky-700 text-[10px] border-sky-200 font-bold">
                  확인 및 교감 상신 완료
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-slate-100 text-slate-500 text-[10px]">
                  확인 대기
                </Badge>
              )}
            </div>

            {/* 3. 인수자 */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-center">
              <span className="text-[11px] font-bold text-slate-500">인수자 (후임)</span>
              <div className="font-bold text-xs text-slate-900">{document.targetSuccessorName || '미배정'}</div>
              <div className="text-[10px] text-slate-400">{document.targetSuccessorEmail || '-'}</div>
              {document.successorSignature ? (
                <div className="space-y-1">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[10px] border-blue-200 font-bold">
                    인수 확인 서명 완료
                  </Badge>
                  <img src={document.successorSignature} alt="인수자 서명" className="h-6 mx-auto object-contain" />
                </div>
              ) : document.successorChecked ? (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 text-[10px] border-amber-200 font-bold">
                  수신 확인 (서명 없음)
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-slate-100 text-slate-500 text-[10px]">
                  {document.targetSuccessorName ? '인수자 확인·서명 대기' : '인수자 미정'}
                </Badge>
              )}
            </div>

            {/* 4. 교감 */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-center">
              <span className="text-[11px] font-bold text-slate-500">교감 (최종 승인)</span>
              <div className="font-bold text-xs text-slate-900">{document.vicePrincipalName || '교감'}</div>
              <div className="text-[10px] text-slate-400">{document.vicePrincipalEmail || '-'}</div>
              {document.vicePrincipalReviewedAt ? (
                <div className="space-y-1">
                  <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                    최종 결재 완료
                  </Badge>
                  {document.vicePrincipalSignature && (
                    <img src={document.vicePrincipalSignature} alt="교감 서명" className="h-6 mx-auto object-contain" />
                  )}
                </div>
              ) : (
                <Badge variant="outline" className="bg-slate-100 text-slate-500 text-[10px]">
                  {isHandoverInVpQueue(document.status) ? '교감 결재 대기' : '미상신'}
                </Badge>
              )}
            </div>
          </div>

          {document.lastEditedByName && (
            <div className="mt-3 p-2.5 bg-blue-50/70 border border-[#2471B2]/30 rounded-xl text-[11px] text-slate-800 flex items-center justify-between gap-2 flex-wrap">
              <span>
                최근 검토자 직접 수정 이력: <b>{document.lastEditedByRole || '관리자'} {document.lastEditedByName}</b>
              </span>
              {document.lastEditedAt && (
                <span className="text-[#2471B2] font-medium">{document.lastEditedAt.slice(0, 16).replace('T', ' ')}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 전년도 업무 폴더 및 비상 연락처 */}
      <Card className="border border-slate-200 rounded-2xl shadow-2xs">
        <CardHeader className="p-4 pb-2 border-b border-slate-100">
          <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <FolderOpen className="w-4 h-4 text-[#2471B2]" />
            전년도 업무 폴더 및 연락처
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-blue-50/50 border border-[#2471B2]/20 rounded-xl">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-900">전년도 업무 드라이브/스토리지 폴더</span>
              <p className="text-[11px] text-[#2471B2] truncate max-w-md">
                {document.folderUrl || '등록된 폴더 링크가 없습니다.'}
              </p>
            </div>
            {document.folderUrl && (
              <Button
                type="button"
                size="sm"
                onClick={() => window.open(document.folderUrl, '_blank')}
                className="h-8 text-xs font-bold bg-[#2471B2] hover:bg-[#1f5e94] text-white gap-1 shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>업무 드라이브 열기</span>
              </Button>
            )}
          </div>

          {(document.archivedDriveFileUrl || document.archivedDriveFolderUrl) && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-bold text-emerald-950">
                  {document.archivedTargetYear || (Number(document.year) + 1)}학년도 결재완료 인수인계서 아카이브 (Google Drive)
                </span>
                <p className="text-[11px] text-emerald-700 truncate max-w-md">
                  최종 승인된 인수인계서 사본이 다음 학년도 인수인계 폴더에 저장되어 있습니다.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                {document.archivedDriveFileUrl && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => window.open(document.archivedDriveFileUrl, '_blank')}
                    className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>결재완료 파일 열기</span>
                  </Button>
                )}
                {document.archivedDriveFolderUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(document.archivedDriveFolderUrl, '_blank')}
                    className="h-8 text-xs font-bold border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-50 gap-1 shrink-0"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>{document.archivedTargetYear || (Number(document.year) + 1)}년 인수인계 폴더</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="text-xs text-slate-700">
            <span className="font-semibold text-slate-500 mr-2">전임자 비상 연락처:</span>
            <span className="font-bold text-slate-800">{document.contactInfo || document.authorEmail}</span>
          </div>

          {document.returningInfo && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-sky-800">귀임 교원 인적 사항 및 재직기간 현황</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
                <div><span className="font-semibold text-slate-500 mr-2">한국 원소속:</span>{document.returningInfo.koreaOriginalSchool || '-'}</div>
                <div><span className="font-semibold text-slate-500 mr-2">재직기간:</span>{formatServicePeriod(document.returningInfo) || '-'}</div>
                <div className="sm:col-span-2"><span className="font-semibold text-slate-500 mr-2">한국 주소:</span>{document.returningInfo.koreaAddress || '-'}</div>
              </div>
              {(document.returningInfo.serviceYears || []).length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700">
                        <th className="border border-slate-300 px-1 py-1">학년도</th>
                        <th className="border border-slate-300 px-1 py-1">학년</th>
                        <th className="border border-slate-300 px-1 py-1">담임학년-반(전담교과)</th>
                        <th className="border border-slate-300 px-1 py-1">소속부서</th>
                        <th className="border border-slate-300 px-1 py-1">담당 업무명</th>
                        <th className="border border-slate-300 px-1 py-1">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {document.returningInfo.serviceYears.map(r => (
                        <tr key={r.schoolYear} className="text-center">
                          <td className="border border-slate-300 px-1 py-1 font-bold">{r.schoolYear}</td>
                          <td className="border border-slate-300 px-1 py-1">{r.grade}</td>
                          <td className="border border-slate-300 px-1 py-1">{r.homeroom}</td>
                          <td className="border border-slate-300 px-1 py-1">{r.department}</td>
                          <td className="border border-slate-300 px-1 py-1">{r.duty}</td>
                          <td className="border border-slate-300 px-1 py-1">{r.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {document.generalGuide && (
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700">총괄 인계 사항 및 연간 운영 핵심 팁:</span>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {document.generalGuide}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 시기별 업무 타임라인 */}
      <Card className="border border-slate-200 rounded-2xl shadow-2xs">
        <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            연간 업무 진행 이력 및 인계 타임라인 ({(document.items || []).length}건)
          </CardTitle>
          <span className="text-[11px] text-slate-400">문서 링크 클릭 시 지정 폴더로 이동합니다.</span>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {(document.items || []).length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">등록된 인계 항목이 없습니다.</p>
          ) : (
            <div className="space-y-2.5">
              {[...(document.items || [])].sort(compareHandoverItemsAsc).map(item => {
                const timingMeta = getHandoverItemTimingMeta(item);
                return (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl hover:bg-white hover:border-indigo-300 transition-all space-y-1.5"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="bg-white text-slate-800 text-[10px] font-bold border-slate-300">
                        {item.period}
                      </Badge>
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 text-[10px] font-semibold border-indigo-200">
                        {item.category}
                      </Badge>
                      {timingMeta.isSystemAuto && (
                        <Badge variant="outline" className={`text-[10px] font-bold ${timingMeta.timingBadgeClass}`}>
                          {timingMeta.timingBadgeText}
                        </Badge>
                      )}
                      <span className="text-xs font-bold text-slate-900">{item.documentTitle}</span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {timingMeta.dateOrScheduleText}
                      </span>
                    </div>

                    {item.folderUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(item.folderUrl, '_blank')}
                        className="h-6 text-[10px] font-bold text-[#2471B2] border-[#2471B2]/30 bg-white hover:bg-blue-50 px-2 gap-1 shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>관련 폴더/문서</span>
                      </Button>
                    )}
                  </div>

                  {item.summary && (
                    <p className="text-[11px] text-slate-600 pl-1 leading-relaxed">
                      {item.summary}
                    </p>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 인수자 결재 모드 패널 */}
      {mode === 'successor' && isHandoverAwaitingSuccessorSignature(document) && (
        <Card className="border-2 border-blue-300 bg-blue-50/40 rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-blue-950">후임자 업무 인수 확인 및 서명</h4>
              <p className="text-[11px] text-blue-700">인계받은 업무와 전년도 업무 폴더를 확인하고 서명하면 교무부장 확인 단계로 전달됩니다.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">인수 확인 의견 (선택)</Label>
            <Textarea
              placeholder="인수 확인 내용 또는 특이사항을 입력하세요 (예: 전년도 업무 폴더 및 기안 문서 인계 완료 확인)."
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={2}
              className="text-xs bg-white border-blue-200"
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSuccessorApprove}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-4 gap-1.5 shadow-xs"
            >
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck2 className="w-3.5 h-3.5" />}
              <span>인수 확인 및 서명</span>
            </Button>
          </div>
        </Card>
      )}

      {/* 교감 최종 승인 / 직접수정 / 수정요청 / 반려 패널 */}
      {mode === 'vice_principal' && isHandoverInVpQueue(document.status) && (
        <Card className="border-2 border-[#2471B2]/40 bg-blue-50/30 rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#2471B2]" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-900">교감 최종 결재 및 검토 액션</h4>
                <p className="text-[11px] text-slate-600">
                  인수인계 내역을 검토하여 직접 수정, 수정 요청, 반려 또는 최종 결재를 진행합니다.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDirectEditOpen(true)}
                disabled={isProcessing}
                className="h-8 text-xs font-bold bg-white text-[#2471B2] border-[#2471B2]/30 hover:bg-blue-50 gap-1"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>직접 수정</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFeedbackMode('revision');
                  setFeedbackOpen(true);
                }}
                disabled={isProcessing}
                className="h-8 text-xs font-bold bg-white text-orange-700 border-orange-300 hover:bg-orange-50 gap-1"
              >
                <MessageSquareWarning className="w-3.5 h-3.5" />
                <span>수정 요청</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFeedbackMode('reject');
                  setFeedbackOpen(true);
                }}
                disabled={isProcessing}
                className="h-8 text-xs font-bold bg-white text-rose-600 border-rose-300 hover:bg-rose-50 gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>반려</span>
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">결재 의견 (선택)</Label>
            <Textarea
              placeholder="최종 결재 의견을 입력하세요."
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={2}
              className="text-xs bg-white border-indigo-200"
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleVicePrincipalApprove}
              disabled={isProcessing}
              className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs h-9 px-4 gap-1.5 shadow-xs"
            >
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              <span>최종 결재 및 아카이빙 승인</span>
            </Button>
          </div>
        </Card>
      )}

      <HandoverDirectEditDialog
        open={isDirectEditOpen}
        onOpenChange={setIsDirectEditOpen}
        document={document}
        currentUserProfile={currentUserProfile}
        reviewerRoleLabel={mode === 'vice_principal' ? '교감' : '관리자'}
        onSaved={(updatedDoc) => {
          setDocument(updatedDoc);
        }}
      />

      <HandoverFeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        mode={feedbackMode}
        targetDoc={buildFeedbackTargetFromDoc(document)}
        isSubmitting={isProcessing}
        onConfirm={handleConfirmFeedback}
      />
    </div>
  );
}
