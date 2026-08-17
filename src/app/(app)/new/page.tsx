'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DocumentForm from "@/components/document-form";
import { PenTool, Loader2, ChevronLeft } from "lucide-react";
import { getDocumentById } from '@/lib/services/documentService';
import { ApprovalDoc } from '@/lib/types';
import { Button } from '@/components/ui/button';

// [핵심] useSearchParams를 사용하는 로직을 별도 컴포넌트로 분리
function NewDocumentContent() {
    const searchParams = useSearchParams();
    const templateId = searchParams.get('templateId');
    const [templateDoc, setTemplateDoc] = useState<ApprovalDoc | null>(null);
    const [loading, setLoading] = useState(!!templateId);

    // 템플릿 ID가 있으면 해당 문서를 불러와서 폼의 초기값(docToEdit)으로 전달
    useEffect(() => {
        const fetchTemplate = async () => {
            const pendingDraft = sessionStorage.getItem('pending_doc_draft');
            if (pendingDraft) {
                try {
                    const { title, content, attachments } = JSON.parse(pendingDraft);
                    sessionStorage.removeItem('pending_doc_draft');
                    setTemplateDoc({
                        id: '',
                        docNumber: '',
                        title,
                        content,
                        attachments: attachments || [],
                        writer: '',
                        department: '스쿨버스 관리팀',
                        status: 'DRAFT',
                        createdAt: new Date().toISOString(),
                        approvalLine: [],
                    } as any);
                    setLoading(false);
                    return;
                } catch (e) {
                    console.error('Failed to parse pending draft', e);
                }
            }

            if (templateId) {
                try {
                    const doc = await getDocumentById(templateId);
                    setTemplateDoc(doc);
                } catch (error) {
                    console.error("Failed to load template", error);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchTemplate();
    }, [templateId]);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // templateDoc이 있으면 그것을 docToEdit로 전달 (템플릿 모드)
    // cloneId는 DocumentForm 내부에서 직접 처리하므로 여기선 상관없음
    return <DocumentForm docToEdit={templateDoc} />;
}

export default function NewDocumentPage() {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
       <div className="mb-8">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="mb-4 -ml-2 text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
                <ChevronLeft className="h-4 w-4" />
                뒤로가기
            </Button>
            <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
                <PenTool className="h-8 w-8 text-primary" />
                새 결재문서 작성
            </h1>
            <p className="text-muted-foreground mt-1">아래 양식을 작성하여 새 결재를 요청하세요.</p>
        </div>
        
      {/* [중요] useSearchParams를 사용하는 컴포넌트는 반드시 Suspense로 감싸야 함 */}
      <Suspense fallback={
          <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      }>
          <NewDocumentContent />
      </Suspense>
    </div>
  );
}