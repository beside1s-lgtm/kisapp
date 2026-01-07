import { PenTool } from "lucide-react";
import DocumentForm from "@/components/document-form";

export default function NewDocumentPage() {
  return (
    <div className="max-w-4xl mx-auto">
       <div className="mb-8">
            <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
                <PenTool className="h-8 w-8 text-primary" />
                새 결재문서 작성
            </h1>
            <p className="text-muted-foreground mt-1">아래 양식을 작성하여 새 결재를 요청하세요.</p>
        </div>
      <DocumentForm />
    </div>
  );
}
