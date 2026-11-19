'use client';

import React, { useState } from 'react';
import { UserProfile, OrgStructure } from '@/lib/types';
import { FixtureHandoverDocument } from '@/lib/types/fixtureHandover';
import {
  approveFixtureDocument,
  markFixtureSuccessorChecked,
  forwardFixtureHandoversToVicePrincipal,
  rejectFixtureDocument,
  recallFixtureDocument,
  openFixturePrintWindow,
  getFixtureStatusLabel,
  getDisplayVicePrincipalName
} from '@/lib/services/fixtureHandoverService';
import { getTeacherStampSignature } from '@/lib/safety/stampHelper';
import { FixtureItemTable } from './FixtureItemTable';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Printer,
  Edit,
  CheckCircle2,
  ChevronLeft,
  School,
  Building2,
  Calendar,
  User,
  ShieldCheck,
  Loader2,
  Send,
  RotateCcw,
  Clock
} from 'lucide-react';

interface FixtureHandoverViewerProps {
  document: FixtureHandoverDocument;
  currentUserProfile: UserProfile;
  org?: OrgStructure | null;
  isLocked?: boolean;
  isVicePrincipalOrAdmin?: boolean;
  isAcademicHead?: boolean;
  onEdit?: () => void;
  onRecall?: (doc: FixtureHandoverDocument) => void;
  onBack: () => void;
  hideBackButton?: boolean;
  onStatusUpdated?: () => void;
}

export function FixtureHandoverViewer({
  document: docItem,
  currentUserProfile,
  org,
  isLocked = false,
  isVicePrincipalOrAdmin = false,
  isAcademicHead = false,
  onEdit,
  onRecall,
  onBack,
  hideBackButton = false,
  onStatusUpdated
}: FixtureHandoverViewerProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const isClass = docItem.type === 'CLASSROOM';
  const currentEmailLower = currentUserProfile.email?.trim().toLowerCase() || '';
  const isAuthor =
    docItem.authorEmail && currentEmailLower === docItem.authorEmail.toLowerCase();
  const isSuccessor =
    docItem.successorEmail && currentEmailLower === docItem.successorEmail.toLowerCase();
  const displayVpName = getDisplayVicePrincipalName(docItem, org);

  // 1. 후임 인수자 비품 수신 확인 핸들러
  const handleSuccessorCheck = async () => {
    if (!window.confirm(`"${isClass ? `${docItem.grade}학년 ${docItem.classNum}반` : docItem.roomName}"의 비품 목록 및 윈도우 비밀번호를 확인하였으며, 수신 확인을 완료하시겠습니까?`)) {
      return;
    }
    setIsProcessing(true);
    try {
      await markFixtureSuccessorChecked(
        docItem.id,
        currentUserProfile.name || '',
        currentUserProfile.email || ''
      );
      toast({
        title: '수신 확인 완료',
        description: '비품 수신 확인이 완료되어 교무부장 확인 대기열로 이동했습니다.'
      });
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '확인 처리 실패',
        description: err?.message || '처리 중 오류가 발생했습니다.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. 교무부장 확인 완료 및 교감 결재 상신 핸들러
  const handleForwardToVp = async () => {
    if (!window.confirm(`"${isClass ? `${docItem.grade}학년 ${docItem.classNum}반` : docItem.roomName}" 비품 인계서의 교무부장 확인을 완료하고 교감 최종 결재로 상신하시겠습니까?`)) {
      return;
    }
    setIsProcessing(true);
    try {
      await forwardFixtureHandoversToVicePrincipal(
        [docItem.id],
        currentUserProfile.name || '교무부장',
        currentUserProfile.email || ''
      );
      toast({
        title: '교감 결재 상신 완료',
        description: '교무부장 확인이 완료되어 교감 최종 결재 대기열로 상신되었습니다.'
      });
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '상신 처리 실패',
        description: err?.message || '처리 중 오류가 발생했습니다.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. 교감 최종 입회/결재 완료 핸들러
  const handleVpApprove = async () => {
    if (!window.confirm(`"${isClass ? `${docItem.grade}학년 ${docItem.classNum}반` : docItem.roomName}" 비품 인계서의 교감 최종 입회(결재)를 승인하시겠습니까?`)) {
      return;
    }
    setIsProcessing(true);
    try {
      await approveFixtureDocument(
        docItem.id,
        currentUserProfile.name || displayVpName,
        currentUserProfile.email || ''
      );
      toast({
        title: '입회 확인 완료',
        description: '비품 인계서의 교감 입회 확인이 최종 승인되었습니다.'
      });
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '확인 처리 실패',
        description: err?.message || '처리 중 오류가 발생했습니다.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. 반려 처리 핸들러
  const handleReject = async () => {
    const reason = window.prompt('반려 사유를 입력하세요 (작성 교사에게 표시됩니다):');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('반려 사유를 입력해주세요.');
      return;
    }
    setIsProcessing(true);
    try {
      await rejectFixtureDocument(docItem.id, reason.trim(), currentUserProfile.name || '');
      toast({
        title: '반려 처리 완료',
        description: '비품 인계서가 반려되어 작성 교사가 수정할 수 있도록 처리되었습니다.'
      });
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '반려 실패',
        description: err?.message || '반려 중 오류가 발생했습니다.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. 인계자 문서 회수 핸들러 (제출 후 수정이 필요할 때 DRAFT로 복귀)
  const handleRecall = async () => {
    if (isLocked) {
      alert('2026학년도 학년 말 인수인계가 최종 마감(잠금)되어 회수할 수 없습니다.');
      return;
    }
    if (
      !window.confirm(
        '제출한 비품 인계서를 회수하시겠습니까?\n\n회수 시 후임자 확인 및 교무부장 대기 상태가 초기화되어 작성 중(임시저장) 상태로 변경되며, 내용을 수정한 후 다시 제출하실 수 있습니다.'
      )
    ) {
      return;
    }
    setIsProcessing(true);
    try {
      await recallFixtureDocument(docItem.id);
      toast({
        title: '비품 인계서 회수 완료',
        description: '비품 인계서가 회수되었습니다. 수정 후 다시 제출해주세요.'
      });
      if (onRecall) {
        onRecall(docItem);
      } else if (onStatusUpdated) {
        onStatusUpdated();
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '회수 처리 실패',
        description: err?.message || '처리 중 오류가 발생했습니다.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = () => {
    switch (docItem.status) {
      case 'APPROVED':
        return (
          <Badge className="bg-emerald-600 text-white font-bold gap-1 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>교감 확인 완료</span>
          </Badge>
        );
      case 'READY_FOR_VP_APPROVAL':
        return (
          <Badge className="bg-[#C49832] text-white font-bold gap-1 text-xs">
            <Clock className="w-3.5 h-3.5" />
            <span>교감 결재 대기</span>
          </Badge>
        );
      case 'SUBMITTED_WAITING_ACADEMIC_HEAD':
      case 'SUBMITTED':
        return (
          <Badge className="bg-[#2471B2] text-white font-bold gap-1 text-xs">
            <Clock className="w-3.5 h-3.5" />
            <span>교무부장 확인 대기</span>
          </Badge>
        );
      case 'SUBMITTED_WAITING_SUCCESSOR':
        return (
          <Badge className="bg-amber-500 text-white font-bold gap-1 text-xs">
            <Clock className="w-3.5 h-3.5" />
            <span>후임 인수자 확인 대기</span>
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge className="bg-[#B01E23] text-white font-bold gap-1 text-xs">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>반려됨</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-slate-600 border-slate-300 font-bold text-xs">
            <span>임시 저장 (작성 중)</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 상단 툴바 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          {!hideBackButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBack}
              className="h-8 text-xs font-bold gap-1 text-slate-700 hover:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>목록으로</span>
            </Button>
          )}
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>{isClass ? `${docItem.grade}학년 ${docItem.classNum}반 학급 비품 인계, 인수서` : `${docItem.roomName} 특별실 비품 인계서`}</span>
              {getStatusBadge()}
            </h2>
            <p className="text-xs text-slate-500">
              인계 학년도: {docItem.year}학년도 → 인수 학년도: {docItem.targetNextYear}학년도 | 인계일: {docItem.handoverDate}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openFixturePrintWindow(docItem)}
            className="h-8 text-xs font-bold gap-1.5 text-[#2471B2] border-[#2471B2]/30 bg-blue-50/50 hover:bg-blue-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>A4 원클릭 인쇄</span>
          </Button>

          {/* 회수하여 수정하기 버튼: 인계자 본인이며 교감 최종 승인 전이고 DRAFT가 아닐 때 (마감 잠금 아닐 때만) */}
          {isAuthor && !isLocked && docItem.status !== 'APPROVED' && docItem.status !== 'DRAFT' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={handleRecall}
              className="h-8 text-xs font-bold gap-1.5 text-[#B01E23] border-[#B01E23]/30 bg-rose-50/30 hover:bg-rose-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>회수하여 수정하기</span>
            </Button>
          )}

          {/* 수정하기 버튼: DRAFT나 REJECTED 상태이거나 관리자일 때 (마감 잠금 아닐 때만) */}
          {!isLocked &&
            ((isAuthor && (docItem.status === 'DRAFT' || docItem.status === 'REJECTED')) ||
              (isVicePrincipalOrAdmin && docItem.status !== 'APPROVED')) &&
            onEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="h-8 text-xs font-bold gap-1.5 text-slate-700 border-slate-300 hover:bg-slate-50"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>수정하기</span>
              </Button>
            )}

          {/* 1단계 액션: 후임 인수자 비품 수신 확인 (마감 잠금 아닐 때만) */}
          {!isLocked && docItem.status === 'SUBMITTED_WAITING_SUCCESSOR' && (isSuccessor || isVicePrincipalOrAdmin) && (
            <Button
              type="button"
              size="sm"
              disabled={isProcessing}
              onClick={handleSuccessorCheck}
              className="h-8 text-xs font-bold gap-1.5 bg-[#2471B2] hover:bg-[#1f5e94] text-white shadow-2xs"
            >
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>비품 수신 확인 완료</span>
            </Button>
          )}

          {/* 2단계 액션: 교무부장 확인 완료 및 교감 상신 (마감 잠금 아닐 때만) */}
          {!isLocked && (docItem.status === 'SUBMITTED_WAITING_ACADEMIC_HEAD' || docItem.status === 'SUBMITTED') && (isAcademicHead || isVicePrincipalOrAdmin) && (
            <Button
              type="button"
              size="sm"
              disabled={isProcessing}
              onClick={handleForwardToVp}
              className="h-8 text-xs font-bold gap-1.5 bg-[#2471B2] hover:bg-[#1f5e94] text-white shadow-2xs"
            >
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>교무부장 확인 완료 및 교감 상신</span>
            </Button>
          )}

          {/* 3단계 액션: 교감 최종 입회/결재 */}
          {(docItem.status === 'READY_FOR_VP_APPROVAL' || docItem.status === 'SUBMITTED') && isVicePrincipalOrAdmin && (
            <Button
              type="button"
              size="sm"
              disabled={isProcessing}
              onClick={handleVpApprove}
              className="h-8 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
            >
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>교감 입회 확인(최종 결재)</span>
            </Button>
          )}

          {/* 반려 액션 */}
          {docItem.status !== 'APPROVED' && docItem.status !== 'DRAFT' && (isAcademicHead || isVicePrincipalOrAdmin) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={handleReject}
              className="h-8 text-xs font-bold gap-1 text-[#B01E23] border-[#B01E23]/30 hover:bg-rose-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>반려</span>
            </Button>
          )}
        </div>
      </div>

      {/* 정보 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              {isClass ? <School className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500">대상 구분 / 명칭</span>
              <p className="text-sm font-bold text-slate-900">
                {isClass ? `${docItem.grade}학년 ${docItem.classNum}반 (학급)` : `${docItem.roomName} (특별실)`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500">인계자 및 인수자</span>
              <p className="text-sm font-bold text-slate-900">
                인계: {docItem.authorName} | 인수: {docItem.successorName || '미정'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500">입회자 (교감) 확인</span>
              <p className="text-sm font-bold text-slate-900">
                {displayVpName} {docItem.approvedAt ? '(확인완료)' : '(대기중)'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 비품 목록 표 */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="py-3.5 px-5 bg-slate-50/70 border-b border-slate-200">
          <CardTitle className="text-xs font-bold text-slate-800">
            인계・인수 비품 품목 ({docItem.items?.length || 0}개)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <FixtureItemTable
            items={docItem.items || []}
            onChange={() => {}}
            windowsPassword={docItem.windowsPassword || '없음'}
            onWindowsPasswordChange={() => {}}
            readOnly={true}
          />
        </CardContent>
      </Card>

      {/* 3단계 인계・인수 결재 서명 날인 현황 카드 */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="py-3.5 px-5 bg-slate-50/70 border-b border-slate-200">
          <CardTitle className="text-xs font-bold text-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>인계・인수 결재 서명 날인 현황</span>
            </span>
            <span className="text-[11px] font-normal text-slate-500">
              ※ 제출 시 인계자 서명 날인 ➔ 수신 확인 시 인수자 서명 날인 ➔ 입회 시 교감 서명 날인
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. 인계자 서명 */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">인계자 ({docItem.authorRole || '교사'})</span>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                  서명 날인 완료
                </Badge>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-bold text-slate-900">{docItem.authorName}</span>
                <img
                  src={docItem.authorSignature || getTeacherStampSignature(docItem.authorName)}
                  alt="인계자 서명"
                  className="h-9 max-w-[80px] object-contain border border-slate-200/50 rounded bg-white p-0.5 shadow-2xs"
                />
              </div>
              <p className="text-[10px] text-slate-400">제출일: {docItem.submittedAt ? docItem.submittedAt.split('T')[0] : docItem.handoverDate}</p>
            </div>

            {/* 2. 인수자 서명 */}
            <div className={`border rounded-xl p-4 space-y-2 ${docItem.successorChecked ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/40'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">인수자 ({docItem.successorRole || '교사'})</span>
                {docItem.successorChecked ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                    수신 서명 완료
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px] font-bold">
                    확인 대기중
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-bold text-slate-900">{docItem.successorName || '미정'}</span>
                {docItem.successorChecked ? (
                  <img
                    src={docItem.successorSignature || getTeacherStampSignature(docItem.successorName || '교사')}
                    alt="인수자 서명"
                    className="h-9 max-w-[80px] object-contain border border-emerald-200/50 rounded bg-white p-0.5 shadow-2xs"
                  />
                ) : (
                  <span className="text-xs text-slate-400 font-bold px-3 py-1 bg-white rounded border border-dashed border-slate-300">
                    (서명 대기)
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                {docItem.successorCheckedAt ? `확인일시: ${docItem.successorCheckedAt.split('T')[0]}` : '수신 확인 전'}
              </p>
            </div>

            {/* 3. 입회자 (교감) 서명 */}
            <div className={`border rounded-xl p-4 space-y-2 ${docItem.status === 'APPROVED' ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-slate-50/40'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">입회자 ({docItem.vicePrincipalRole || '교감'})</span>
                {docItem.status === 'APPROVED' ? (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-bold">
                    입회 승인 완료
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-600 border-slate-300 bg-slate-100 text-[10px] font-bold">
                    입회 대기중
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-bold text-slate-900">{displayVpName}</span>
                {docItem.status === 'APPROVED' ? (
                  <img
                    src={docItem.vicePrincipalSignature || getTeacherStampSignature(displayVpName)}
                    alt="교감 서명"
                    className="h-9 max-w-[80px] object-contain border border-blue-200/50 rounded bg-white p-0.5 shadow-2xs"
                  />
                ) : (
                  <span className="text-xs text-slate-400 font-bold px-3 py-1 bg-white rounded border border-dashed border-slate-300">
                    (입회 대기)
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                {docItem.approvedAt ? `승인일시: ${docItem.approvedAt.split('T')[0]}` : '최종 결재 대기'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
