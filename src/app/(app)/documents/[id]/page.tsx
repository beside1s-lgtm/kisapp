import { getDocConfig, getDocumentById } from "@/app/actions";
import DocumentView from "@/components/document-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { ApprovalDoc } from "@/lib/types";

type DocumentPageProps = {
    params: { id: string };
};

export default async function DocumentPage({ params }: DocumentPageProps) {
    const { id } = params;

    if (!id) {
         return (
            <div className="flex h-full w-full items-center justify-center">
                 <Alert variant="destructive" className="max-w-lg">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        잘못된 문서 ID입니다.
                        <Button asChild variant="link" className="p-0 h-auto ml-2">
                           <Link href="/inbox">Return to Inbox</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    const [docResult, configResult] = await Promise.all([
        getDocumentById(id),
        getDocConfig()
    ]);
    
    if (!docResult) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                 <Alert variant="destructive" className="max-w-lg">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        문서를 찾을 수 없거나 접근 권한이 없습니다.
                        <Button asChild variant="link" className="p-0 h-auto ml-2">
                           <Link href="/inbox">Return to Inbox</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    return <DocumentView initialDoc={docResult} initialConfig={configResult} />;
}
