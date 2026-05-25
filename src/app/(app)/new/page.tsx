'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DocumentForm from "@/components/document-form";
import { PenTool, Loader2 } from "lucide-react";
import { getDocumentById } from '@/lib/services/documentService';
import { ApprovalDoc } from '@/lib/types';

// [핵심] useSearchParams를 사용하는 로직을 별도 컴포넌트로 분리
function NewDocumentContent() {
    const searchParams = useSearchParams();
    const templateId = searchParams.get('templateId');
    const [templateDoc, setTemplateDoc] = useState<ApprovalDoc | null>(null);
    const [loading, setLoading] = useState(!!templateId);

    // 템플릿 ID가 있으면 해당 문서를 불러와서 폼의 초기값(docToEdit)으로 전달
    useEffect(() => {
        const fetchTemplate = async () => {
            if (templateId) {
                try {
                    // getDocumentById는 클라이언트 SDK를 사용하므로 직접 호출 가능
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
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
       <div className="mb-8">
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