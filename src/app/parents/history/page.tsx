'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getMyParentDocuments } from '@/lib/services/documentService';
import { ApprovalDoc } from '@/lib/types';
import { format } from 'date-fns';
import { History, FileText, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ParentHistoryPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ApprovalDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      getMyParentDocuments(user.email).then((docs) => {
        setDocuments(docs);
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
            const docTypeName = isAbsence ? '결석계' : '체험학습';
            
            return (
              <Link key={doc.id} href={`/parents/documents/${doc.id}`} className="block">
                <div className="bg-card hover:bg-muted/30 transition-colors border rounded-xl p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                        [{docTypeName}]
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {doc.createdAt ? format(new Date(doc.createdAt), 'yyyy.MM.dd') : ''}
                      </span>
                    </div>
                    <div>
                      {doc.status === 'pending' && <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">결재 대기 중</Badge>}
                      {doc.status === 'approved' && <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">승인 완료</Badge>}
                      {doc.status === 'recalled' && <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">회수됨</Badge>}
                      {doc.status === 'rejected' && <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">반려됨</Badge>}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{doc.title}</h3>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
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
    </div>
  );
}
