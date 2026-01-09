
'use server';

import { PenTool } from "lucide-react";
import DocumentForm from "@/components/document-form";
import { getDocConfig, getDocumentById } from "@/app/actions";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

type NewDocumentPageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

async function NewDocumentPageContent({ searchParams }: NewDocumentPageProps) {
  const templateId = searchParams?.templateId as string | undefined;
  let templateDoc = null;

  if (templateId) {
    templateDoc = await getDocumentById(templateId);
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
          <PenTool className="h-8 w-8 text-primary" />
          {templateId ? '문서 재기안' : '새 결재문서 작성'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {templateId ? '기존 문서 내용을 바탕으로 새 결재를 요청하세요.' : '아래 양식을 작성하여 새 결재를 요청하세요.'}
        </p>
      </div>
      <DocumentForm docToEdit={templateId ? templateDoc : null} />
    </div>
  );
}

export default function NewDocumentPage(props: NewDocumentPageProps) {
    return (
        <Suspense fallback={
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2">문서 양식 로딩 중...</p>
            </div>
        }>
            <NewDocumentPageContent {...props} />
        </Suspense>
    )
}

    