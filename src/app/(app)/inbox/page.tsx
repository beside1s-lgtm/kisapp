'use client';

import { getInboxDocuments, getPendingDocuments } from "@/app/actions";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { FileClock, Inbox, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function InboxPage() {
    const { user, profile } = useAuth();
    const [inboxDocs, setInboxDocs] = useState<ApprovalDoc[]>([]);
    const [pendingDocs, setPendingDocs] = useState<ApprovalDoc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile?.email && user?.uid) {
            setLoading(true);
            Promise.all([
                getInboxDocuments(profile.email),
                getPendingDocuments(user.uid, profile.email)
            ]).then(([inboxData, pendingData]) => {
                setInboxDocs(inboxData);
                setPendingDocs(pendingData);
                setLoading(false);
            });
        } else if (!user) {
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
        <div className="space-y-12">
            <div>
                <div className="mb-8">
                    <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
                        <Inbox className="h-8 w-8 text-primary" />
                        미결재함
                    </h1>
                    <p className="text-muted-foreground mt-1">결재를 기다리는 문서들입니다.</p>
                </div>
                <DocumentList documents={inboxDocs} />
            </div>
            
            <div>
                <div className="mb-8">
                    <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
                        <FileClock className="h-8 w-8 text-secondary-foreground/80" />
                        내가 상신한 진행중 문서
                    </h1>
                    <p className="text-muted-foreground mt-1">내가 상신한 문서 중 결재 진행 중인 문서입니다.</p>
                </div>
                <DocumentList documents={pendingDocs} />
            </div>
        </div>
    );
}
