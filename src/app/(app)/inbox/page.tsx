'use client';

import { getInboxDocuments } from "@/app/actions";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { Inbox, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function InboxPage() {
    const { user, profile } = useAuth();
    const [docs, setDocs] = useState<ApprovalDoc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile?.email) {
            setLoading(true);
            getInboxDocuments(profile.email).then((inboxData) => {
                setDocs(inboxData);
                setLoading(false);
            });
        } else if (!user || !profile) {
            // This case handles when user is logged out or profile is not yet loaded.
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
        <div className="space-y-12 p-4 md:p-8">
            <div>
                <div className="mb-8">
                    <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
                        <Inbox className="h-8 w-8 text-primary" />
                        미결재함
                    </h1>
                    <p className="text-muted-foreground mt-1">결재를 기다리는 문서들입니다.</p>
                </div>
                <DocumentList documents={docs} />
            </div>
        </div>
    );
}
