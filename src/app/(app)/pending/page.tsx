'use client';

import { getPendingDocuments } from "@/lib/services/documentService";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { useRouter } from "next/navigation";
import { FileClock, Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function PendingPage() {
    const router = useRouter();
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
            const data = await getPendingDocuments(user.uid, profile.email, profile?.name);
            setDocs(data || []);
        } catch (err) {
            console.error('[PendingPage] Failed to load docs:', err);
            toast({
                variant: 'destructive',
                title: '문서 로딩 실패',
                description: '진행중 문서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
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
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => router.back()} 
                        className="h-9 w-9 rounded-xl hover:bg-slate-100 shrink-0"
                        title="뒤로 가기"
                    >
                        <ArrowLeft className="h-5 w-5 text-slate-600" />
                    </Button>
                    <div>
                        <h1 className="font-headline text-2xl sm:text-3xl font-bold flex items-center gap-2.5 text-slate-900">
                            <FileClock className="h-6 w-6 text-primary" />
                            진행 문서함
                        </h1>
                        <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">내가 기안했거나 결재하여 현재 상위 결재선에서 진행 중인 문서들입니다.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button variant="outline" size="sm" onClick={loadDocuments} className="h-8 gap-1.5 text-xs font-semibold rounded-xl">
                        <RefreshCw className="h-3.5 w-3.5" />
                        새로고침
                    </Button>
                </div>
            </div>
            <DocumentList documents={docs} />
        </div>
    );
}
