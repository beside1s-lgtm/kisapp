'use client';

import Link from 'next/link';
import { ApprovalDoc } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { FileText, User, EyeOff, Paperclip, CheckCircle2, Circle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentListProps {
  documents: ApprovalDoc[];
}

// ─── 결재선 프로그레스 바 ─────────────────────────────────────────────
function ApprovalStepBar({ doc }: { doc: ApprovalDoc }) {
  if (!doc.approvers || doc.approvers.length === 0) return null;
  // 반려·회수·완료 상태에서도 선택적으로 표시
  const total = doc.approvers.length;

  return (
    <div className="mt-2.5 flex items-center gap-0 w-full overflow-x-auto">
      {doc.approvers.map((approver, idx) => {
        const isCurrent = doc.status === 'pending' && idx === doc.currentStep;
        const isDone = approver.status === 'approved';
        const isRejected = approver.status === 'rejected';
        const isLast = idx === total - 1;

        return (
          <div key={idx} className="flex items-center shrink-0">
            {/* 스텝 노드 */}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center ring-2 transition-all',
                  isDone
                    ? 'bg-blue-500 ring-blue-300 text-white'
                    : isRejected
                    ? 'bg-red-500 ring-red-300 text-white'
                    : isCurrent
                    ? 'bg-amber-400 ring-amber-200 text-white animate-pulse'
                    : 'bg-muted ring-muted-foreground/20 text-muted-foreground'
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : isRejected ? (
                  <XCircle className="w-3.5 h-3.5" />
                ) : (
                  <Circle className="w-3.5 h-3.5" />
                )}
              </div>
              {/* 결재자 직책 레이블 */}
              <span
                className={cn(
                  'text-[10px] font-medium whitespace-nowrap',
                  isDone
                    ? 'text-blue-500'
                    : isRejected
                    ? 'text-red-500'
                    : isCurrent
                    ? 'text-amber-500 font-bold'
                    : 'text-muted-foreground'
                )}
              >
                {approver.role}
              </span>
            </div>

            {/* 연결선 (마지막 제외) */}
            {!isLast && (
              <div
                className={cn(
                  'h-0.5 w-8 mx-0.5 mb-3.5 rounded-full',
                  isDone ? 'bg-blue-400' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────

export function DocumentList({ documents }: DocumentListProps) {
  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
        표시할 문서가 없습니다.
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-blue-600 hover:bg-blue-700 shrink-0">결재 완료</Badge>;
      case 'rejected': return <Badge variant="destructive" className="shrink-0">반려</Badge>;
      case 'recalled': return <Badge variant="outline" className="border-orange-500 text-orange-500 shrink-0">회수됨</Badge>;
      default: return <Badge variant="secondary" className="shrink-0">진행중</Badge>;
    }
  };

  const getPublishBadge = (publishStatus: string | undefined) => {
    switch (publishStatus) {
      case '비공개':
        return (
          <Badge variant="outline" className="shrink-0 border-red-400 text-red-500 gap-1 text-[11px] py-0">
            <EyeOff className="h-2.5 w-2.5" />비공개
          </Badge>
        );
      case '부분공개':
        return (
          <Badge variant="outline" className="shrink-0 border-amber-400 text-amber-600 gap-1 text-[11px] py-0">
            <Paperclip className="h-2.5 w-2.5" />부분공개
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStepBadge = (doc: ApprovalDoc) => {
    if (doc.status !== 'pending') return null;
    const currentApprover = doc.approvers?.[doc.currentStep];
    if (!currentApprover) return null;
    return (
      <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
        {currentApprover.role} 결재 대기 중
      </span>
    );
  };

  // 결재선 프로그레스 바를 표시할지 여부 판단
  // pending(진행중), rejected(반려)일 때만 표시 (approved/recalled는 생략)
  const showStepBar = (doc: ApprovalDoc) =>
    (doc.status === 'pending' || doc.status === 'rejected') &&
    doc.approvers &&
    doc.approvers.length > 0;

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <Link key={doc.id} href={`/documents/${doc.id}`} className="block group">
          <Card className="transition-all duration-200 hover:shadow-md border hover:border-primary/50">
            <CardContent className="p-4 sm:p-5">
              <div className="space-y-1.5 overflow-hidden">
                {/* 배지 영역 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {getStatusBadge(doc.status)}
                  <span className="text-xs text-muted-foreground font-mono">
                    {doc.docNo || '문서번호 없음'}
                  </span>
                  {doc.docType === 'external' && <Badge variant="outline" className="text-xs shrink-0">대외</Badge>}
                  {doc.category === 'family' && <Badge variant="outline" className="text-xs border-green-500 text-green-600 shrink-0">가정통신문</Badge>}
                  {getPublishBadge(doc.publishStatus)}
                </div>

                {/* 제목 */}
                <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors">
                  {doc.title}
                </h3>

                {/* 하단 메타 정보 */}
                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{doc.requesterName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    <span>
                      {doc.createdAt ? format(new Date(doc.createdAt), 'yyyy-MM-dd') : '-'}
                    </span>
                  </div>
                  {getStepBadge(doc)}
                </div>

                {/* 결재선 프로그레스 바 (진행중·반려 문서에만 표시) */}
                {showStepBar(doc) && <ApprovalStepBar doc={doc} />}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}