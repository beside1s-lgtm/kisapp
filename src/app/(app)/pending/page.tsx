
'use client';

import { getPendingDocuments } from "@/app/actions";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { FileClock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function PendingPage() {
    const { user, profile } = useAuth();
    const [docs, setDocs] = useState<ApprovalDoc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.uid && profile?.email) {
            getPendingDocuments(user.uid, profile.email).then(data => {
                setDocs(data);
                setLoading(false);
            });
        } else if (!user || !profile) {
            setLoading(false);
        }
    }, [user, profile]);

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="p-4 md:p-8">
            <div className="mb-8">
                <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
                    <FileClock className="h-8 w-8 text-primary" />
                    내가 상신한 진행중 문서
                </h1>
                <p className="text-muted-foreground mt-1">내가 상신한 문서 중 결재 진행 중인 문서입니다.</p>
            </div>
            <DocumentList documents={docs} />
        </div>
    );
}
