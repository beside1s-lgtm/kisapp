
'use server';

import { getDocumentById } from "@/app/actions";
import DocumentForm from "@/components/document-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, PenTool } from "lucide-react";
import Link from "next/link";

type EditDocumentPageProps = {
    params: { id: string };
};

export default async function EditDocumentPage({ params }: EditDocumentPageProps) {
    const { id } = params;
    const doc = await getDocumentById(id);

    if (!doc) {
        return (
           <div className="flex h-full w-full items-center justify-center">
                <Alert variant="destructive" className="max-w-lg">
                   <AlertCircle className="h-4 w-4" />
                   <AlertTitle>Error</AlertTitle>
                   <AlertDescription>
                       문서를 찾을 수 없거나 수정할 권한이 없습니다.
                       <Button asChild variant="link" className="p-0 h-auto ml-2">
                          <Link href="/recalled">Return to Recalled Box</Link>
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
                    문서 수정 및 재기안
                </h1>
                <p className="text-muted-foreground mt-1">문서 내용을 수정하고 다시 결재를 요청하세요.</p>
            </div>
            <DocumentForm docToEdit={doc} />
        </div>
    );
}
