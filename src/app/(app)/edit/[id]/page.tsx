'use client';

import { getDocumentById } from "@/app/actions";
import DocumentForm from "@/components/document-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, PenTool, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth"; // 클라이언트용 Auth 훅 사용
import { useEffect, useState, use } from "react";
import { ApprovalDoc } from "@/lib/types";

type EditDocumentPageProps = {
  params: Promise<{ id: string }>;
};

export default function EditDocumentPage({ params }: EditDocumentPageProps) {
  // Next.js 15: params 언랩
  const { id } = use(params);
  
  const { user, profile, loading: authLoading } = useAuth();
  const [doc, setDoc] = useState<ApprovalDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const fetchDoc = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const fetchedDoc = await getDocumentById(id);
            setDoc(fetchedDoc);
        } catch (e) {
            console.error("Failed to fetch doc:", e);
        } finally {
            setLoading(false);
        }
    };
    fetchDoc();
  }, [id]);

  useEffect(() => {
    if (!doc || !user || !profile) {
        setHasPermission(false);
        return;
    }

    const userEmail = profile.email?.trim().toLowerCase();
    
    // 1. 기안자가 회수한 문서 (재상신)
    const isRequesterAndRecalled = 
        doc.requesterId === user.uid && 
        doc.status === 'recalled';
    
    // 2. 현재 결재 차례인 사용자 (수정 권한)
    const currentApprover = doc.approvers && doc.approvers[doc.currentStep];
    const isCurrentApproverAndPending = 
        doc.status === 'pending' && 
        currentApprover &&
        currentApprover.email?.trim().toLowerCase() === userEmail;

    if (isRequesterAndRecalled || isCurrentApproverAndPending) {
        setHasPermission(true);
        setReason('');
    } else {
        setHasPermission(false);
        if (doc.status !== 'pending' && doc.status !== 'recalled') setReason('문서가 수정 가능한 상태가 아닙니다.');
        else setReason('문서 수정 권한이 없습니다 (본인 결재 차례가 아님).');
    }
  }, [doc, user, profile]);

  if (authLoading || loading) {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!doc || !hasPermission) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>접근 불가</AlertTitle>
          <AlertDescription>
            문서를 찾을 수 없거나 수정할 권한이 없습니다.
            {reason && <div className="mt-1 text-xs opacity-70">({reason})</div>}
            <Button asChild variant="link" className="p-0 h-auto ml-2">
              <Link href="/inbox">문서함으로 돌아가기</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
          <PenTool className="h-8 w-8 text-primary" />
          문서 수정
        </h1>
        <p className="text-muted-foreground mt-1">
            {doc.status === 'recalled' ? '회수한 문서를 수정하여 재상신합니다.' : '결재 중인 문서의 내용을 수정합니다.'}
        </p>
      </div>
      <DocumentForm docToEdit={doc} />
    </div>
  );
}