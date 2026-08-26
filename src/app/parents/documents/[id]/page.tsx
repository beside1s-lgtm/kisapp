'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getDocumentById } from '@/lib/services/documentService';
import { ApprovalDoc, DocConfig } from '@/lib/types';
import DocumentView from '@/components/document-view';
import { Loader2, AlertTriangle, ArrowLeft, Download, FileText, CalendarDays, MapPin, BookOpen, Clock, CheckCircle2, XCircle, Timer } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { getDoc, doc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

function MobileDocSummary({ documentData }: { documentData: ApprovalDoc }) {
  const pfd = documentData.parentFormData;
  const isAbsence = pfd?.type === 'absence';
  const isFieldTrip = pfd?.type === 'field-trip';
  const isReport = pfd?.type === 'field-trip-report';

  const statusBadge = () => {
    switch (documentData.status) {
      case 'pending': return <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-bold text-[11px]">결재 대기</Badge>;
      case 'approved': return <Badge className="bg-green-100 text-green-700 border-green-200 font-bold text-[11px]">승인 완료</Badge>;
      case 'rejected': return <Badge className="bg-red-100 text-red-700 border-red-200 font-bold text-[11px]">반려됨</Badge>;
      case 'recalled': return <Badge className="bg-gray-100 text-gray-700 border-gray-200 font-bold text-[11px]">회수됨</Badge>;
      default: return <Badge variant="outline" className="text-[11px]">{documentData.status}</Badge>;
    }
  };

  return (
    <div className="space-y-3 sm:hidden">
      {/* 상단 헤더 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-bold text-slate-800">
              {isAbsence ? '결석계' : isFieldTrip ? '체험학습 신청서' : isReport ? '체험결과 보고서' : '신청서'}
            </span>
          </div>
          {statusBadge()}
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          <span>제출일: {documentData.createdAt ? format(new Date(documentData.createdAt), 'yyyy.MM.dd') : '-'}</span>
        </div>
        {documentData.docNo && <div className="text-xs text-slate-400 mt-0.5">문서번호: {documentData.docNo}</div>}
      </div>

      {/* 핵심 내용 카드 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-500 border-b pb-2">입력 내용</h3>

        {isAbsence && pfd && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500">결석 기간</div>
                <div className="text-sm font-bold text-slate-800">{pfd.absencePeriod?.startDate} ~ {pfd.absencePeriod?.endDate} <span className="text-xs font-normal text-slate-500">({pfd.absencePeriod?.totalDays}일)</span></div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500">결석 종류</div>
                <div className="text-sm font-bold text-slate-800">{pfd.absenceType || '-'}</div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500">결석 사유</div>
                <div className="text-sm text-slate-800 leading-relaxed">{pfd.absenceReason || '-'}</div>
              </div>
            </div>
          </div>
        )}

        {isFieldTrip && pfd && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500">신청 기간</div>
                <div className="text-sm font-bold text-slate-800">{pfd.tripPeriod?.startDate} ~ {pfd.tripPeriod?.endDate} <span className="text-xs font-normal text-slate-500">({pfd.tripPeriod?.totalDays}일)</span></div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500">학습 형태</div>
                <div className="text-sm font-bold text-slate-800">{pfd.tripType || '-'}</div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500">방문 장소</div>
                <div className="text-sm font-bold text-slate-800">{pfd.destination || '-'}</div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500">목적</div>
                <div className="text-sm text-slate-800 leading-relaxed">{pfd.purpose || '-'}</div>
              </div>
            </div>
          </div>
        )}

        {isReport && pfd && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500">체험 기간</div>
                <div className="text-sm font-bold text-slate-800">{pfd.tripPeriod?.startDate} ~ {pfd.tripPeriod?.endDate}</div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500">방문 장소</div>
                <div className="text-sm font-bold text-slate-800">{pfd.destination || '-'}</div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500">보고 내용 요약</div>
                <div className="text-sm text-slate-800 leading-relaxed line-clamp-4">{pfd.reportContent || '-'}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 결재 현황 */}
      {documentData.approvers && (documentData.approvers as any[]).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
          <h3 className="text-xs font-bold text-slate-500 border-b pb-2 mb-3">결재 현황</h3>
          <div className="flex gap-2 flex-wrap">
            {(documentData.approvers as any[]).map((approver: any, idx: number) => (
              <div key={idx} className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-200">
                {approver.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  : approver.status === 'rejected' ? <XCircle className="w-3.5 h-3.5 text-red-500" />
                  : <Timer className="w-3.5 h-3.5 text-amber-400" />}
                <span className="text-xs font-bold text-slate-700">{approver.name || `결재자 ${idx + 1}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF 출력 버튼 */}
      <Button onClick={() => window.print()} className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
        <Download className="mr-2 h-4 w-4" />
        신청서 출력 / PDF 저장
      </Button>

      {/* 인쇄 시에는 전체 서식 출력 */}
      <div className="hidden print:block">
        <DocumentView initialDoc={documentData} initialConfig={{}} />
      </div>
    </div>
  );
}

export default function ParentDocumentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const [documentData, setDocumentData] = useState<ApprovalDoc | null>(null);
  const [configData, setConfigData] = useState<DocConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id || !user) return;

    async function loadData() {
      try {
        const [docRes, configSnap] = await Promise.all([
          getDocumentById(id),
          getDoc(doc(getDb(), 'settings', 'docConfig'))
        ]);

        if (!docRes) {
          setError('문서를 찾을 수 없습니다.');
          return;
        }

        const isOwner = 
          (docRes.requesterEmail && user?.email && docRes.requesterEmail.toLowerCase() === user.email.toLowerCase()) ||
          (docRes.requesterId && user?.uid && docRes.requesterId === user.uid);
        if (!isOwner) {
          setError('열람 권한이 없습니다.');
          return;
        }

        setDocumentData(docRes as ApprovalDoc);
        if (configSnap.exists()) {
          setConfigData(configSnap.data() as DocConfig);
        } else {
          setConfigData({});
        }
      } catch (err: any) {
        setError(err.message || '문서 로딩 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [id, user]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !documentData || !configData) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/parents/history"><ArrowLeft className="w-4 h-4 mr-2" /> 목록으로 돌아가기</Link>
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error || '문서를 불러올 수 없습니다.'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4 px-3 sm:py-8 sm:px-4">
      <div className="mb-3 sm:mb-4 print:hidden flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm">
          <Link href="/parents/history"><ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> 목록으로 돌아가기</Link>
        </Button>
      </div>

      {/* 모바일: 요약 카드 (sm 미만) */}
      <MobileDocSummary documentData={documentData} />

      {/* 데스크탑: 전체 서식 (sm 이상) */}
      <div className="hidden sm:block">
        <DocumentView initialDoc={documentData} initialConfig={configData} />
      </div>
    </div>
  );
}

