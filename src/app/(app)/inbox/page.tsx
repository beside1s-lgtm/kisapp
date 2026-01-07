'use client';

import { getInboxDocuments } from "@/app/actions";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { Inbox, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function InboxPage() {
    const { user } = useAuth();
    const [docs, setDocs] = useState<ApprovalDoc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.email) {
            getInboxDocuments(user.email).then(data => {
                setDocs(data);
                setLoading(false);
            });
        }
    }, [user]);

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
                    <Inbox className="h-8 w-8 text-primary" />
                    결재함
                </h1>
                <p className="text-muted-foreground mt-1">결재를 기다리는 문서들입니다.</p>
            </div>
            <DocumentList documents={docs} />
        </div>
    );
}
