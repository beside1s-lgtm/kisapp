'use client';

import DocumentForm from "@/components/document-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, PenTool, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth"; 
import { useEffect, useState, use } from "react";
import { ApprovalDoc } from "@/lib/types";
import { db } from "@/lib/firebase"; 
import { doc, getDoc, Timestamp } from "firebase/firestore";

type EditDocumentPageProps = {
  params: Promise<{ id: string }>;
};

export default function EditDocumentPage({ params }: EditDocumentPageProps) {
  const { id } = use(params);
  
  const { user, profile, loading: authLoading } = useAuth();
  const [documentData, setDocumentData] = useState<ApprovalDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // 1. 문서 데이터 가져오기 (클라이언트 사이드 실행)
  useEffect(() => {
    const fetchDoc = async () => {
        if (!user || !id) return;
        
        setLoading(true);
        try {
            // [중요] 한글 ID 디코딩 (이게 없으면 문서를 못 찾음)
            const decodedId = decodeURIComponent(id);
            console.log("Fetching doc for edit:", decodedId);

            const docRef = doc(db, "approvals", decodedId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                const safeToISOString = (timestamp: any) => {
                    if (!timestamp) return null;
                    if (timestamp instanceof Timestamp) return timestamp.toDate().toISOString();
                    if (typeof timestamp === 'string') return timestamp;
                    if (timestamp?.seconds) return new Date(timestamp.seconds * 1000).toISOString();
                    return null;
                };

                const serializedData = {
                    ...data,
                    id: docSnap.id,
                    createdAt: safeToISOString(data.createdAt),
                    completedAt: safeToISOString(data.completedAt),
                    approvers: data.approvers?.map((ap: any) => ({
                        ...ap,
                        approvedAt: safeToISOString(ap.approvedAt)
                    })) || []
                } as ApprovalDoc;
                
                setDocumentData(serializedData);
            } else {
                setPermissionError("문서를 찾을 수 없습니다.");
            }
        } catch (e: any) {
            console.error("Failed to fetch doc:", e);
            if (e.code === 'permission-denied') {
                setPermissionError("문서에 접근할 권한이 없습니다.");
            } else {
                setPermissionError("문서를 불러오는 중 오류가 발생했습니다.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (!authLoading) {
        if (user) fetchDoc();
        else setLoading(false); 
    }
  }, [id, user, authLoading]);

  // 2. 권한 체크 로직
  useEffect(() => {
    if (loading || !documentData || !user || !profile) return;

    const userEmail = profile.email?.trim().toLowerCase();
    
    const isRequesterAndRecalled = 
        documentData.requesterId === user.uid && 
        documentData.status === 'recalled';
    
    const currentApprover = documentData.approvers && documentData.approvers[documentData.currentStep];
    const isCurrentApproverAndPending = 
        documentData.status === 'pending' && 
        currentApprover &&
        currentApprover.email?.trim().toLowerCase() === userEmail;

    if (!isRequesterAndRecalled && !isCurrentApproverAndPending) {
        setPermissionError('문서 수정 권한이 없습니다 (본인 차례가 아니거나 회수된 문서가 아님).');
    } else {
        setPermissionError(null); // 권한 있음
    }
  }, [documentData, user, profile, loading]);

  if (authLoading || loading) {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!documentData || permissionError || !user) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>접근 불가</AlertTitle>
          <AlertDescription>
            {permissionError || "로그인이 필요하거나 문서를 찾을 수 없습니다."}
            <div className="mt-4">
                <Button asChild variant="outline" className="w-full">
                <Link href="/inbox">문서함으로 돌아가기</Link>
                </Button>
            </div>
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
            {documentData.status === 'recalled' ? '회수한 문서를 수정하여 재상신합니다.' : '결재 중인 문서의 내용을 수정합니다.'}
        </p>
      </div>
      <DocumentForm docToEdit={documentData} category={documentData.category} />
    </div>
  );
}