'use client';

import { getRegistryDocuments } from "@/app/actions";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { ListFilter, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function RegistryPage() {
    const { user, profile } = useAuth();
    const [docs, setDocs] = useState<ApprovalDoc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.uid && profile?.email) {
            getRegistryDocuments(user.uid, profile.email).then(data => {
                setDocs(data);
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
        <div>
            <div className="mb-8">
                <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
                    <ListFilter className="h-8 w-8 text-primary" />
                    문서대장
                </h1>
                <p className="text-muted-foreground mt-1">모든 결재 완료된 문서의 기록입니다.</p>
            </div>
            <DocumentList documents={docs} />
        </div>
    );
}
