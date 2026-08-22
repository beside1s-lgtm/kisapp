'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getMyParentDocuments, deleteDocument } from '@/lib/services/documentService';
import { ApprovalDoc } from '@/lib/types';
import { format } from 'date-fns';
import { History, FileText, ChevronRight, Loader2, Edit3, ArrowLeft, Home, FileCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ParentNotificationModal } from '@/components/parent-notification-modal';

export default function ParentHistoryPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
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
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* 통일된 상단 네비게이션 헤더 */}
      <div className="mb-6 flex items-center gap-2 print:hidden">
        <Button variant="outline" className="bg-white hover:bg-slate-50 text-muted-foreground hover:text-foreground shadow-sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          뒤로가기
        </Button>
        <Button variant="outline" className="bg-white hover:bg-slate-50 text-muted-foreground hover:text-foreground shadow-sm" onClick={() => router.push('/parents')}>
          <Home className="mr-2 h-4 w-4" />
          홈
        </Button>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold font-headline flex items-center mb-2">
          <History className="mr-2 h-6 w-6 text-primary" /> 나의 제출 내역
        </h1>
        <p className="text-muted-foreground">제출하신 신청서의 결재 진행 상황을 확인할 수 있습니다.</p>
      </div>

      {documents.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
          <FileText className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">아직 제출된 신청서가 없습니다.</p>
          <p className="text-sm text-muted-foreground mb-6">결석계 또는 체험학습 신청서를 작성해 보세요.</p>
          <Button asChild>
            <Link href="/parents/apply">신청서 작성하기</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => {
            const isAbsence = doc.parentFormData?.type === 'absence';
            const isFieldTrip = doc.parentFormData?.type === 'field-trip';
            const isReport = doc.parentFormData?.type === 'field-trip-report';
            
            let docTypeName = '문서';
            if (isAbsence) docTypeName = '결석계';
            if (isFieldTrip) docTypeName = '체험학습 신청';
            if (isReport) docTypeName = '체험결과 보고';

            const needsReport = isFieldTrip && doc.status === 'approved' && !doc.parentFormData?.reportSubmitted;
            const hasReport = isFieldTrip && doc.status === 'approved' && doc.parentFormData?.reportSubmitted;
            
            return (
              <Link key={doc.id} href={`/parents/documents/${doc.id}`} className="block">
                <div className="bg-card hover:bg-muted/30 transition-colors border rounded-xl p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                        {docTypeName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {doc.createdAt ? format(new Date(doc.createdAt), 'yyyy.MM.dd') : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {doc.status === 'pending' && <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">결재 대기 중</Badge>}
                      {doc.status === 'approved' && <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 font-bold">승인 완료</Badge>}
                      
                      {/* 체험학습 승인 완료시 통보서 받기 버튼 노출 */}
                      {isFieldTrip && doc.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 font-bold flex items-center gap-1 shadow-sm h-6 px-2.5 text-xs cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedDocForNotification(doc);
                          }}
                        >
                          <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                          통보서 받기
                        </Button>
                      )}

                      {doc.status === 'recalled' && <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">회수됨</Badge>}
                      {doc.status === 'rejected' && <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">반려됨</Badge>}

                      {/* 회수/반려된 문서는 학부모가 직접 삭제 가능 */}
                      {(doc.status === 'recalled' || doc.status === 'rejected') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-bold flex items-center gap-1 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteDoc(doc.id);
                          }}
                          disabled={deletingDocId === doc.id}
                        >
                          {deletingDocId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          삭제
                        </Button>
                      )}
                      
                      {needsReport && (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none font-bold text-[10px]">
                          보고서 미제출
                        </Badge>
                      )}
                      {hasReport && (
                        <Badge className="bg-teal-600 text-white border-none font-bold text-[10px]">
                          보고서 완료
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{doc.title}</h3>
                    <div className="flex items-center gap-2">
                      {needsReport && (
                        <Button 
                          size="sm" 
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1 shadow-sm h-8"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/parents/apply?type=field-trip-report&applyId=${doc.id}`);
                          }}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          보고서 작성
                        </Button>
                      )}
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>

                  {doc.status === 'rejected' && doc.comment && (
                    <div className="mt-4 p-3 bg-red-50/50 border border-red-100 rounded-lg text-sm text-red-800">
                      <strong>반려 사유:</strong> {doc.comment}
                    </div>
                  )}
                </div>
              </Link>
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
