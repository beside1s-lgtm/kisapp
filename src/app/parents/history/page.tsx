'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getMyParentDocuments, deleteDocument } from '@/lib/services/documentService';
import { ApprovalDoc } from '@/lib/types';
import { format } from 'date-fns';
import { History, FileText, ChevronRight, Loader2, Edit3, ArrowLeft, Home, FileCheck, Trash2, Calendar, MapPin, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ParentNotificationModal } from '@/components/parent-notification-modal';
import { useTranslation } from '@/hooks/use-translation';

export default function ParentHistoryPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const router = useRouter();
  const [documents, setDocuments] = useState<ApprovalDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [selectedDocForNotification, setSelectedDocForNotification] = useState<ApprovalDoc | null>(null);

  const handleDeleteDoc = async (docId: string) => {
    if (!window.confirm("이 문서를 완전히 삭제하시겠습니까? 삭제된 문서는 복구할 수 없습니다.")) return;
    setDeletingDocId(docId);
    try {
      const identifier = profile?.email || user?.email || user?.uid || '';
      const res = await deleteDocument(docId, identifier, !!profile?.isAdmin);
      if (res.success) {
        toast({ title: '문서가 삭제되었습니다.' });
        setDocuments(prev => prev.filter(d => d.id !== docId));
      } else {
        toast({ variant: 'destructive', title: '삭제 실패', description: res.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '삭제 오류', description: err.message });
    } finally {
      setDeletingDocId(null);
    }
  };

  useEffect(() => {
    if (user?.email) {
      getMyParentDocuments(user.email).then((docs) => {
        // 기존 승인된 신청서에 병합되므로 이제 독립된 'field-trip-report' 문서는 표출 리스트에서 배제시킵니다.
        const filteredDocs = docs.filter(
          (d) => !(d.docType === 'parent' && d.parentFormData?.type === 'field-trip-report')
        );
        setDocuments(filteredDocs);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-2 px-1 sm:py-6 sm:px-4">
      {/* 상단 네비게이션 & 통계 한 줄 영역 */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b print:hidden">
        <div className="flex items-center gap-1.5 min-w-0">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2.5 text-xs bg-card hover:bg-muted text-muted-foreground shadow-2xs shrink-0" 
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            {t('back') || '뒤로가기'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2.5 text-xs bg-card hover:bg-muted text-muted-foreground shadow-2xs shrink-0" 
            onClick={() => router.push('/parents')}
          >
            <Home className="mr-1 h-3.5 w-3.5" />
            {t('nav.home') || '홈'}
          </Button>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs text-muted-foreground font-medium">
            총 <b className="text-primary font-bold">{documents.length}</b>건
          </span>
        </div>
      </div>

      {/* 페이지 제목 & 설명 */}
      <div className="mb-3.5">
        <h1 className="text-lg sm:text-xl font-bold font-headline flex items-center text-foreground">
          <History className="mr-1.5 h-5 w-5 text-primary shrink-0" /> {t('nav.history') || '나의 제출 내역'}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('parents.history_desc') || '제출하신 신청서의 결재 진행 상황을 확인할 수 있습니다.'}
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="bg-card border rounded-xl p-8 sm:p-12 flex flex-col items-center justify-center text-center shadow-xs">
          <FileText className="w-12 h-12 text-muted-foreground mb-3 opacity-40" />
          <p className="text-base font-bold mb-1">제출된 신청서가 없습니다.</p>
          <p className="text-xs text-muted-foreground mb-5">결석계 또는 체험학습 신청서를 작성해 보세요.</p>
          <Button asChild size="sm" className="font-bold">
            <Link href="/parents/apply">신청서 작성하기</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const pfd = doc.parentFormData;
            const isAbsence = pfd?.type === 'absence';
            const isFieldTrip = pfd?.type === 'field-trip';
            const isReport = pfd?.type === 'field-trip-report';
            
            let docTypeName = '신청서';
            let badgeBg = 'bg-indigo-50 text-indigo-700 border-indigo-200';
            if (isAbsence) {
              docTypeName = t('parents.apply.tab_absence') || '결석계';
              badgeBg = 'bg-blue-50 text-blue-700 border-blue-200';
            } else if (isFieldTrip) {
              docTypeName = t('parents.apply.tab_fieldtrip') || '체험학습 신청서';
              badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            } else if (isReport) {
              docTypeName = t('parents.apply.report_title') || '결과보고서';
              badgeBg = 'bg-purple-50 text-purple-700 border-purple-200';
            }

            const needsReport = isFieldTrip && doc.status === 'approved' && !pfd?.reportSubmitted;
            const hasReport = isFieldTrip && doc.status === 'approved' && pfd?.reportSubmitted;
            
            const studentInfo = pfd?.studentName 
              ? `${pfd.studentName} (${pfd.gradeClassNumber || ''})` 
              : doc.title;

            const periodText = isAbsence && pfd?.absencePeriod
              ? `${pfd.absencePeriod.startDate} ~ ${pfd.absencePeriod.endDate} (${pfd.absencePeriod.totalDays}일)`
              : isFieldTrip && pfd?.tripPeriod
              ? `${pfd.tripPeriod.startDate} ~ ${pfd.tripPeriod.endDate} (${pfd.tripPeriod.totalDays}일)`
              : null;

            return (
              <div 
                key={doc.id}
                className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs hover:border-primary/40 transition-all space-y-2.5 w-full min-w-0 overflow-hidden"
              >
                {/* 1. 상단 줄: 종류 + 작성일자 (좌) / 결재상태 + 보고서상태 (우) */}
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${badgeBg} whitespace-nowrap`}>
                      {docTypeName}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {doc.createdAt ? format(new Date(doc.createdAt), 'yyyy.MM.dd') : ''}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0 flex-wrap">
                    {doc.status === 'pending' && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] sm:text-[11px] font-bold py-0.5 px-1.5 sm:px-2">
                        {t('parents.history.badge_pending') || '결재 대기 중'}
                      </Badge>
                    )}
                    {doc.status === 'approved' && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] sm:text-[11px] font-bold py-0.5 px-1.5 sm:px-2">
                        {t('parents.history.badge_approved') || '승인 완료'}
                      </Badge>
                    )}
                    {doc.status === 'recalled' && (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-[10px] sm:text-[11px] font-bold py-0.5 px-1.5 sm:px-2">
                        {t('parents.history.badge_recalled') || '회수됨'}
                      </Badge>
                    )}
                    {doc.status === 'rejected' && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] sm:text-[11px] font-bold py-0.5 px-1.5 sm:px-2">
                        {t('parents.history.badge_rejected') || '반려됨'}
                      </Badge>
                    )}

                    {needsReport && (
                      <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none text-[10px] font-bold py-0.5 px-1.5">
                        {t('parents.history.badge_need_report') || '보고서 미제출'}
                      </Badge>
                    )}
                    {hasReport && (
                      <Badge className="bg-teal-600 text-white border-none text-[10px] font-bold py-0.5 px-1.5">
                        {t('parents.history.badge_has_report') || '보고서 완료'}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* 2. 중간 줄: 학생 정보 및 신청 요약 */}
                <div className="bg-muted/30 rounded-lg p-2.5 space-y-1 w-full min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-sm sm:text-base text-foreground">
                    <User className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{studentInfo}</span>
                  </div>
                  {periodText && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>{periodText}</span>
                    </div>
                  )}
                  {isFieldTrip && pfd?.destination && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{t('parents.history.label_dest') || '장소:'} {pfd.destination}</span>
                    </div>
                  )}
                  {isAbsence && pfd?.absenceReason && (
                    <div className="text-xs text-muted-foreground truncate">
                      {t('parents.history.label_reason') || '사유:'} {pfd.absenceReason}
                    </div>
                  )}
                </div>

                {/* 반려 사유 표시 */}
                {doc.status === 'rejected' && doc.comment && (
                  <div className="p-2.5 bg-red-50/70 border border-red-200 rounded-lg text-xs text-red-800">
                    <strong className="font-bold">{t('parents.history.reject_reason') || '반려 사유:'}</strong> {doc.comment}
                  </div>
                )}

                {/* 3. 하단 줄: 액션 버튼들 나란히 배치 (모바일 화면 완벽 맞춤) */}
                <div className="flex items-center gap-1.5 pt-1.5 border-t w-full min-w-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 min-w-0 h-8 px-1 sm:px-2 text-[10px] sm:text-xs font-bold bg-background hover:bg-muted text-foreground flex items-center justify-center gap-1 shadow-2xs"
                    onClick={() => router.push(`/parents/documents/${doc.id}`)}
                  >
                    <FileText className="hidden sm:inline-block w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{t('parents.history.btn_view_doc') || '신청서 보기'}</span>
                  </Button>

                  {/* 체험학습 승인 완료시 통보서 받기 버튼 */}
                  {isFieldTrip && doc.status === 'approved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 min-w-0 h-8 px-1 sm:px-2 text-[10px] sm:text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 flex items-center justify-center gap-1 shadow-2xs"
                      onClick={() => setSelectedDocForNotification(doc)}
                    >
                      <FileCheck className="hidden sm:inline-block w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="truncate">{t('parents.history.btn_get_notification') || '통보서 받기'}</span>
                    </Button>
                  )}

                  {/* 결과보고서 작성 버튼 */}
                  {needsReport && (
                    <Button
                      size="sm"
                      className="flex-1 min-w-0 h-8 px-1 sm:px-2 text-[10px] sm:text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-1 shadow-2xs"
                      onClick={() => router.push(`/parents/apply?type=field-trip-report&applyId=${doc.id}`)}
                    >
                      <Edit3 className="hidden sm:inline-block w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{t('parents.history.btn_write_report') || '보고서 작성'}</span>
                    </Button>
                  )}

                  {/* 회수/반려 삭제 버튼 */}
                  {(doc.status === 'recalled' || doc.status === 'rejected') && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 sm:px-2.5 text-[10px] sm:text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 font-bold flex items-center justify-center gap-1 shadow-2xs shrink-0"
                      onClick={() => handleDeleteDoc(doc.id)}
                      disabled={deletingDocId === doc.id}
                      title={t('parents.history.btn_delete') || '문서 삭제'}
                    >
                      {deletingDocId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{t('parents.history.btn_delete') || '삭제'}</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 통보서 미리보기 및 PDF 다운로드 모달 */}
      <ParentNotificationModal
        doc={selectedDocForNotification}
        open={!!selectedDocForNotification}
        onOpenChange={(open) => {
          if (!open) setSelectedDocForNotification(null);
        }}
      />
    </div>
  );
}
