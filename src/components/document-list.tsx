'use client';

import Link from 'next/link';
import { ApprovalDoc } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { FileText, User } from 'lucide-react';

interface DocumentListProps {
  documents: ApprovalDoc[];
}

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
      case 'approved': return <Badge className="bg-blue-600 hover:bg-blue-700">결재 완료</Badge>;
      case 'rejected': return <Badge variant="destructive">반려</Badge>;
      case 'recalled': return <Badge variant="outline" className="border-orange-500 text-orange-500">회수됨</Badge>;
      default: return <Badge variant="secondary">진행중</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {documents.map((doc) => (
        // [핵심 수정] 리스트 클릭 시 '수정'(/edit)이 아닌 '조회'(/documents) 페이지로 이동
        <Link key={doc.id} href={`/documents/${doc.id}`} className="block group">
          <Card className="transition-all duration-200 hover:shadow-md border hover:border-primary/50">
            <CardContent className="p-4 sm:p-6 flex items-start justify-between gap-4">
              <div className="space-y-1 overflow-hidden">
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge(doc.status)}
                  <span className="text-xs text-muted-foreground font-mono">
                    {doc.docNo || '문서번호 없음'}
                  </span>
                  {doc.docType === 'external' && <Badge variant="outline" className="text-xs">대외</Badge>}
                  {doc.category === 'family' && <Badge variant="outline" className="text-xs border-green-500 text-green-600">가정통신문</Badge>}
                </div>
                
                <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                  {doc.title}
                </h3>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}