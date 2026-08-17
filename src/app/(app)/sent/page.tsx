'use client';

import { getSentDocuments } from "@/lib/services/documentService";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { Loader2, Send, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function SentPage() {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const [docs, setDocs] = useState<ApprovalDoc[]>([]);
    const [loading, setLoading] = useState(true);

    const loadDocuments = useCallback(async () => {
        if (!user?.uid || !profile?.email) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const data = await getSentDocuments(user.uid, profile.email);
            setDocs(data || []);
        } catch (err) {
            console.error('[SentPage] Failed to load docs:', err);
            toast({
                variant: 'destructive',
                title: '문서 로딩 실패',
                description: '상신함 문서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
            });
        } finally {
            setLoading(false);
        }
    }, [user, profile, toast]);

    useEffect(() => {
        loadDocuments();
    }, [loadDocuments]);

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="p-4 md:p-8">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-headline text-2xl sm:text-3xl font-bold flex items-center gap-3">
                        <Send className="h-7 w-7 text-primary" />
                        상신함
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">내가 제출한 문서들입니다.</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadDocuments} className="self-start sm:self-auto h-9 gap-1.5 text-xs font-semibold">
                    <RefreshCw className="h-3.5 w-3.5" />
                    새로고침
                </Button>
            </div>
            <DocumentList documents={docs} />
        </div>
    );
}
