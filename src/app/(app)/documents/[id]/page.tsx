import { getDocConfig, getDocumentById } from "@/app/actions";
import DocumentView from "@/components/document-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

type DocumentPageProps = {
    params: { id: string }
};

export default async function DocumentPage({ params }: DocumentPageProps) {
    const documentData = await getDocumentById(params.id);
    const configData = await getDocConfig();

    if (!documentData) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                 <Alert variant="destructive" className="max-w-lg">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        Document not found or you do not have permission to view it.
                        <Button asChild variant="link" className="p-0 h-auto ml-2">
                           <Link href="/inbox">Return to Inbox</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    return <DocumentView initialDoc={documentData} initialConfig={configData} />;
}
