'use client';

import { getRejectedDocuments, deleteDocument } from "@/lib/services/documentService";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { 
    XCircle, Loader2, Trash2, Edit3, CheckSquare, Square, 
    AlertTriangle, FileText, User, ChevronRight, RefreshCw, MessageSquare, ArrowLeft
} from "lucide-react";
import { useCallback, useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function RejectedPage() {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [docs, setDocs] = useState<ApprovalDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

    // 단일 삭제용 / 일괄 삭제용 다이얼로그 상태
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [singleDeleteTargetId, setSingleDeleteTargetId] = useState<string | null>(null);

    const loadDocuments = useCallback(async () => {
        if (!user?.uid || !profile?.email) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const data = await getRejectedDocuments(user.uid, profile.email);
            setDocs(data || []);
            setSelectedDocIds(new Set());
        } catch (err) {
            console.error("Failed to fetch rejected docs:", err);
            toast({ title: "오류", description: "반려 문서 목록을 불러오지 못했습니다.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [user, profile, toast]);

    useEffect(() => {
        loadDocuments();
    }, [loadDocuments]);

    // 전체 선택 토글
    const isAllSelected = useMemo(() => {
        return docs.length > 0 && selectedDocIds.size === docs.length;
    }, [docs, selectedDocIds]);

    const handleToggleAll = () => {
        if (isAllSelected) {
            setSelectedDocIds(new Set());
        } else {
            setSelectedDocIds(new Set(docs.map(d => d.id)));
        }
    };

    // 단일 선택 토글
    const handleToggleSelect = (docId: string) => {
        setSelectedDocIds(prev => {
            const next = new Set(prev);
            if (next.has(docId)) {
                next.delete(docId);
            } else {
                next.add(docId);
            }
            return next;
        });
    };

    // 재기안 페이지로 이동
    const handleRedraft = (docId: string) => {
        router.push(`/edit/${docId}`);
    };

    // 삭제 실행 (단일 또는 다중)
    const executeDelete = async () => {
        if (!user?.uid) return;

        const targets = singleDeleteTargetId 
            ? [singleDeleteTargetId] 
            : Array.from(selectedDocIds);

        if (targets.length === 0) return;

        setIsDeleting(true);
        try {
            let successCount = 0;
            let failCount = 0;

            for (const docId of targets) {
                const identifier = profile?.email || user.email || user.uid;
                const res = await deleteDocument(docId, identifier, !!profile?.isAdmin);

                if (res.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            }

            if (successCount > 0) {
                toast({
                    title: "삭제 완료",
                    description: `${successCount}건의 반려 문서가 삭제되었습니다.`
                });
                setDocs(prev => prev.filter(d => !targets.includes(d.id)));
                setSelectedDocIds(new Set());
            }

            if (failCount > 0) {
                toast({
                    title: "일부 삭제 실패",
                    description: `${failCount}건의 문서를 삭제하지 못했습니다. (권한 확인 필요)`,
                    variant: "destructive"
                });
            }
        } catch (err: any) {
            console.error("Batch delete error:", err);
            toast({
                title: "삭제 오류",
                description: err.message || "문서 삭제 중 오류가 발생했습니다.",
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setSingleDeleteTargetId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 font-body space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
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
                        <h1 className="font-headline text-2xl sm:text-3xl font-bold flex items-center gap-2.5 text-rose-600">
                            <XCircle className="h-6 w-6 text-rose-500 shrink-0" />
                            반려 문서함
                        </h1>
                        <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">
                            결재선에서 반려된 문서 목록입니다. 반려 사유를 확인하고 수정 후 즉시 재기안할 수 있습니다.
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={loadDocuments} 
                        className="h-8 gap-1.5 text-xs font-semibold rounded-xl"
                        disabled={loading}
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        새로고침
                    </Button>
                </div>
            </div>

            {/* Action Bar (문서가 있을 때만 표시) */}
            {docs.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border">
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleToggleAll} 
                            className="h-8 text-xs font-medium gap-1.5"
                        >
                            {isAllSelected ? (
                                <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                                <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                            전체 선택 ({selectedDocIds.size}/{docs.length})
                        </Button>
                        {selectedDocIds.size > 0 && (
                            <span className="text-xs text-muted-foreground font-semibold">
                                {selectedDocIds.size}개 선택됨
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* 일괄 삭제 버튼 */}
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                                setSingleDeleteTargetId(null);
                                setIsDeleteDialogOpen(true);
                            }}
                            disabled={selectedDocIds.size === 0 || isDeleting}
                            className="h-8 text-xs font-bold gap-1.5 shadow-sm"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            선택 삭제 ({selectedDocIds.size})
                        </Button>
                    </div>
                </div>
            )}

            {/* Document Cards List */}
            {docs.length === 0 ? (
                <Card className="border-2 border-dashed">
                    <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                        <XCircle className="h-12 w-12 text-muted-foreground/40" />
                        <div className="text-base font-semibold">반려된 문서가 없습니다.</div>
                        <p className="text-xs text-muted-foreground/80 max-w-sm">
                            상신한 문서 중 결재자로부터 반려된 문서가 이곳에 보관됩니다.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {docs.map((d) => {
                        const isSelected = selectedDocIds.has(d.id);
                        const rejectComment = d.comment || d.approvers?.find(a => a.status === 'rejected')?.comment;
                        const rejectApprover = d.approvers?.find(a => a.status === 'rejected');

                        return (
                            <Card 
                                key={d.id} 
                                className={`transition-all duration-150 border overflow-hidden ${
                                    isSelected 
                                        ? 'ring-2 ring-red-500/50 bg-red-50/20 border-red-200' 
                                        : 'hover:border-red-200 hover:shadow-sm bg-card'
                                }`}
                            >
                                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    {/* Left: Checkbox + Doc Info */}
                                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                        <div className="pt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => handleToggleSelect(d.id)}
                                                aria-label={`선택 ${d.title}`}
                                            />
                                        </div>
                                        
                                        <div className="space-y-2 flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="destructive" className="font-bold text-[11px] px-2 py-0.5">
                                                    반려됨
                                                </Badge>
                                                {d.docNo && d.docNo !== '미채번' && !d.docNo.includes('진행 중') && (
                                                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                                        {d.docNo}
                                                    </span>
                                                )}
                                                <span className="text-xs text-muted-foreground">
                                                    {d.completedAt ? format(new Date(d.completedAt), 'yyyy-MM-dd HH:mm') : (d.createdAt ? format(new Date(d.createdAt), 'yyyy-MM-dd HH:mm') : '')}
                                                </span>
                                            </div>

                                            <Link 
                                                href={`/documents/${d.id}`}
                                                className="block font-bold text-base sm:text-lg text-foreground hover:text-red-600 transition-colors truncate"
                                            >
                                                {d.title}
                                            </Link>

                                            {/* 반려 사유 하이라이트 박스 */}
                                            {rejectComment && (
                                                <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-900">
                                                    <MessageSquare className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                                    <div className="space-y-0.5 min-w-0">
                                                        <span className="font-bold text-red-700">
                                                            {rejectApprover ? `[${rejectApprover.role} ${rejectApprover.approverName || rejectApprover.name}] 반려 사유:` : '반려 사유:'}
                                                        </span>
                                                        <p className="whitespace-pre-wrap font-medium text-red-950 break-words">{rejectComment}</p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <User className="h-3.5 w-3.5" />
                                                    기안자: {d.requesterName} ({d.requesterRole})
                                                </span>
                                                {d.attachments && d.attachments.length > 0 && (
                                                    <span className="flex items-center gap-1 text-slate-500">
                                                        <FileText className="h-3.5 w-3.5" />
                                                        첨부 {d.attachments.length}건
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Actions */}
                                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 w-full sm:w-auto justify-end">
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => handleRedraft(d.id)}
                                            className="h-8 text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                                        >
                                            <Edit3 className="h-3.5 w-3.5" />
                                            수정 및 재기안
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSingleDeleteTargetId(d.id);
                                                setIsDeleteDialogOpen(true);
                                            }}
                                            className="h-8 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            삭제
                                        </Button>

                                        <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                                            <Link href={`/documents/${d.id}`}>
                                                <ChevronRight className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* 삭제 확인 Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            반려 문서 삭제 확인
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2 pt-2 text-xs text-muted-foreground">
                                <div>
                                    {singleDeleteTargetId 
                                        ? "이 반려 문서를 정말로 영구 삭제하시겠습니까?" 
                                        : `선택하신 ${selectedDocIds.size}건의 반려 문서를 정말로 영구 삭제하시겠습니까?`}
                                </div>
                                <div className="bg-muted p-2 rounded">
                                    ※ 삭제된 문서는 복구할 수 없으며, 감사 로그에 삭제 기록이 남습니다.
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                executeDelete();
                            }}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            영구 삭제
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
