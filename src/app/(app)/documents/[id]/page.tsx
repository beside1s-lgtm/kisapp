'use client';

import DocumentView from "@/components/document-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, use } from "react";
import { ApprovalDoc, DocConfig } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth"; 
import { db } from "@/lib/firebase"; 
import { doc, getDoc, Timestamp } from "firebase/firestore";

type DocumentPageProps = {
    params: Promise<{ id: string }>;
};

export default function DocumentPage({ params }: DocumentPageProps) {
    const { id } = use(params);
    const { user, loading: authLoading } = useAuth();

    const [docData, setDocData] = useState<ApprovalDoc | null>(null);
    const [configData, setConfigData] = useState<DocConfig>({});
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (authLoading) return;
            if (!user) {
                setDataLoading(false);
                setError("로그인이 필요한 서비스입니다.");
                return;
            }

            setDataLoading(true);
            try {
                const decodedId = decodeURIComponent(id);
                console.log("Fetching View Doc ID:", decodedId);

                const docRef = doc(db, "approvals", decodedId);
                const docSnap = await getDoc(docRef);

                const configRef = doc(db, "settings", "docConfig");
                const configSnap = await getDoc(configRef);
                const config = configSnap.exists() ? (configSnap.data() as DocConfig) : {};

                if (!docSnap.exists()) {
                    setError("문서를 찾을 수 없습니다.");
                } else {
                    const data = docSnap.data();

                    const safeToISOString = (timestamp: any) => {
                        if (!timestamp) return null;
                        if (timestamp instanceof Timestamp) return timestamp.toDate().toISOString();
                        if (typeof timestamp === 'string') return timestamp;
                        if (timestamp?.seconds) return new Date(timestamp.seconds * 1000).toISOString();
                        return null;
                    };

                    const serializedDoc: ApprovalDoc = {
                        ...data,
                        id: docSnap.id,
                        createdAt: safeToISOString(data.createdAt),
                        completedAt: safeToISOString(data.completedAt),
                        approvers: data.approvers?.map((approver: any) => ({
                            ...approver,
                            approvedAt: safeToISOString(approver.approvedAt),
                        })) || [],
                    } as ApprovalDoc;

                    setDocData(serializedDoc);
                    setConfigData(config);
                }
            } catch (err: any) {
                console.error("View Fetch Error:", err);
                setError("문서를 불러오는 중 오류가 발생했습니다.");
            } finally {
                setDataLoading(false);
            }
        };

        fetchData();
    }, [id, user, authLoading]);

    if (authLoading || dataLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !docData) {
        return (
            <div className="flex h-full w-full items-center justify-center p-8">
                 <Alert variant="destructive" className="max-w-lg">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>접근 불가</AlertTitle>
                    <AlertDescription>
                        {error || "문서를 찾을 수 없거나 접근 권한이 없습니다."}
                        <div className="mt-4">
                            <Button asChild variant="outline">
                               <Link href="/inbox">문서함으로 돌아가기</Link>
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    // [중요] 여기서는 DocumentView(조회)를 보여줘야 합니다. Form(수정)이 아닙니다.
    return <DocumentView initialDoc={docData} initialConfig={configData} />;
}