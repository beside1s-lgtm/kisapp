'use client';

import { getDocConfig, getDocumentById } from "@/app/actions";
import DocumentView from "@/components/document-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, use } from "react";
import { ApprovalDoc } from "@/lib/types";

// params 타입을 Promise로 정의합니다.
type DocumentPageProps = {
    params: Promise<{ id: string }>;
};

export default function DocumentPage({ params }: DocumentPageProps) {
    // React.use()를 사용하여 params Promise를 언랩합니다.
    const { id } = use(params);

    const [docData, setDocData] = useState<ApprovalDoc | null>(null);
    const [configData, setConfigData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // params.id 대신 언랩된 id 변수를 사용합니다.
                const [docResult, configResult] = await Promise.all([
                    getDocumentById(id),
                    getDocConfig()
                ]);
                
                if (!docResult) {
                    setError("문서를 찾을 수 없거나 권한이 없습니다.");
                } else {
                    setDocData(docResult);
                    setConfigData(configResult);
                }
            } catch (err) {
                setError("데이터를 불러오는 중 오류가 발생했습니다.");
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchData();
        }
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !docData) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                 <Alert variant="destructive" className="max-w-lg">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        {error || "문서를 볼 수 있는 권한이 없습니다."}
                        <Button asChild variant="link" className="p-0 h-auto ml-2">
                           <Link href="/inbox">Return to Inbox</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    return <DocumentView initialDoc={docData} initialConfig={configData} />;
}