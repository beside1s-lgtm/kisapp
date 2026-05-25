
'use client';

import { getRecalledDocuments } from "@/lib/services/documentService";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { Undo2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function RecalledPage() {
    const { user, profile } = useAuth();
    const [docs, setDocs] = useState<ApprovalDoc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.uid && profile?.email) {
            getRecalledDocuments(user.uid, profile.email).then(data => {
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
                    <Undo2 className="h-8 w-8 text-primary" />
                    회수 문서함
                </h1>
                <p className="text-muted-foreground mt-1">내가 상신 후 회수한 문서 목록입니다. 문서를 수정하고 재상신할 수 있습니다.</p>
            </div>
            <DocumentList documents={docs} />
        </div>
    );
}
