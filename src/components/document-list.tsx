
'use client';

import { ApprovalDoc } from '@/lib/types';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ChevronRight, EyeOff, Pencil, Trash2, XCircle, Loader2, User, FilePenLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from './ui/button';
import { deleteDocument } from '@/app/actions';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type DocumentListProps = {
  documents: ApprovalDoc[];
  pageType?: 'inbox' | 'sent' | 'pending' | 'recalled' | 'registry';
};

export function DocumentList({ documents, pageType }: DocumentListProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isDeleting, startDeleteTransition] = useTransition();
  const [docToDelete, setDocToDelete] = useState<ApprovalDoc | null>(null);
  const [localDocs, setLocalDocs] = useState(documents);

  const getStatusBadge = (status: 'pending' | 'approved' | 'rejected' | 'recalled') => {
    switch(status) {
        case 'approved': return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">결재 완료</Badge>;
        case 'rejected': return <Badge variant="destructive">반려</Badge>;
        case 'pending': return <Badge variant="secondary">진행중</Badge>;
        case 'recalled': return <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">회수됨</Badge>;
    }
  }

  const handleCardClick = (e: React.MouseEvent, docId: string) => {
    // 버튼 클릭 시에는 카드 클릭(페이지 이동) 방지
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    router.push(`/documents/${docId}`);
  };

  const handleEditClick = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    router.push(`/edit/${docId}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, doc: ApprovalDoc) => {
    e.stopPropagation();
    setDocToDelete(doc);
  };
  
  const executeDelete = () => {
    if (!docToDelete || !user) return;
    
    startDeleteTransition(async () => {
        const result = await deleteDocument(docToDelete.id, user.uid);
        if (result.success) {
            toast({ title: '삭제 완료', description: '문서가 성공적으로 삭제되었습니다.'});
            setLocalDocs(prevDocs => prevDocs.filter(d => d.id !== docToDelete.id));
        } else {
            toast({ variant: 'destructive', title: '삭제 실패', description: result.error });
        }
        setDocToDelete(null);
    });
  }

  if (localDocs.length === 0) {
    return (
        <div className="py-20 text-center text-muted-foreground font-bold border-2 border-dashed rounded-lg">
            표시할 문서가 없습니다.
        </div>
    );
  }

  return (
    <div className="space-y-4">
      {localDocs.map((doc) => (
        <Card
          key={doc.id}
          onClick={(e) => handleCardClick(e, doc.id)}
          className="hover:border-primary hover:shadow-lg cursor-pointer transition-all group"
        >
            <div className="p-6 flex justify-between items-center">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        {getStatusBadge(doc.status)}
                        <span className="text-xs font-mono text-muted-foreground uppercase">{doc.docNo}</span>
                        {doc.publishStatus === '비공개' && (
                            <Badge variant="outline" className="text-xs">
                                <EyeOff size={12} className="inline mr-1" /> 비공개
                            </Badge>
                        )}
                    </div>
                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{doc.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium mt-2">
                        <span className="flex items-center gap-1.5"><User size={14} /> {doc.requesterName} ({doc.requesterRole})</span>
                        <span>•</span>
                        <span>{doc.createdAt ? format(new Date(doc.createdAt as string), 'yyyy년 MM월 dd일') : 'N/A'}</span>
                    </div>
                </div>
                 
                 <div className='flex items-center gap-2'>
                    {pageType === 'recalled' && (
                      <>
                        <Button variant="outline" size="sm" onClick={(e) => handleEditClick(e, doc.id)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          수정
                        </Button>
                        <Button variant="destructive" size="sm" onClick={(e) => handleDeleteClick(e, doc)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          삭제
                        </Button>
                      </>
                    )}

                    {pageType === 'registry' && (
                      <Button asChild variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/new?templateId=${doc.id}`}>
                           <FilePenLine className="mr-2 h-4 w-4" />
                           재기안
                        </Link>
                      </Button>
                    )}
                 
                    {pageType !== 'recalled' && pageType !== 'registry' && (
                      <ChevronRight size={20} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
                    )}
                 </div>
            </div>
        </Card>
      ))}

      <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                    문서 <span className="font-bold text-foreground">"{docToDelete?.title}"</span>을(를) 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={executeDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    삭제 확인
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
