'use client';

import { getRecalledDocuments, deleteDocument } from "@/lib/services/documentService";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { 
    Undo2, Loader2, Trash2, Edit3, CheckSquare, Square, 
    AlertTriangle, FileText, User, ChevronRight, RefreshCw 
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

export default function RecalledPage() {
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
            const data = await getRecalledDocuments(user.uid, profile.email);
            setDocs(data || []);
            setSelectedDocIds(new Set());
        } catch (err) {
            console.error("Failed to fetch recalled docs:", err);
            toast({ title: "오류", description: "회수 문서 목록을 불러오지 못했습니다.", variant: "destructive" });
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

        const targetIds = singleDeleteTargetId ? [singleDeleteTargetId] : Array.from(selectedDocIds);
        if (targetIds.length === 0) return;

        setIsDeleting(true);
        try {
            let successCount = 0;
            let failCount = 0;

            for (const docId of targetIds) {
                const res = await deleteDocument(docId, user.uid);
                if (res.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            }

            if (successCount > 0) {
                toast({
                    title: "삭제 완료",
                    description: `${successCount}건의 회수 문서가 성공적으로 삭제되었습니다.`
                });
            }
            if (failCount > 0) {
                toast({
                    title: "일부 삭제 실패",
                    description: `${failCount}건의 문서는 삭제 권한이 없거나 처리 중 오류가 발생했습니다.`,
                    variant: "destructive"
                });
            }

            await loadDocuments();
        } catch (err) {
            console.error("Delete error:", err);
            toast({ title: "오류", description: "문서 삭제 중 오류가 발생했습니다.", variant: "destructive" });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setSingleDeleteTargetId(null);
        }
    };

    // 상단 일괄 재기안 버튼 핸들러
    const handleBatchRedraft = () => {
        const selectedArr = Array.from(selectedDocIds);
        if (selectedArr.length === 0) {
            toast({ title: "알림", description: "재기안할 문서를 선택해 주세요." });
            return;
        }
        if (selectedArr.length === 1) {
            router.push(`/edit/${selectedArr[0]}`);
        } else {
            // 여러 개 선택 시 첫 번째 문서로 이동하며 안내
            toast({ title: "재기안 안내", description: `선택하신 ${selectedArr.length}건 중 첫 번째 문서의 재기안(수정) 화면으로 이동합니다.` });
            router.push(`/edit/${selectedArr[0]}`);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
            {/* 1. 상단 타이틀 & 설명 (한 줄 표기 및 넓은 영역 확보) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
                <div>
                    <h1 className="font-headline text-2xl sm:text-3xl font-extrabold flex items-center gap-3 text-slate-900">
                        <Undo2 className="h-7 w-7 text-primary" />
                        회수 문서함
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        내가 상신 후 회수한 문서 목록입니다. 문서를 수정하여 재상신하거나 불필요한 문서를 삭제할 수 있습니다.
                    </p>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadDocuments} 
                    className="self-start sm:self-auto h-9 gap-1.5 text-xs font-semibold"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    새로고침
                </Button>
            </div>

            {/* 2. 컨트롤 & 일괄 작업 바 (체크박스, 전체선택, 일괄 재기안, 일괄 삭제) */}
            {docs.length > 0 && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <Checkbox 
                                checked={isAllSelected}
                                onCheckedChange={handleToggleAll}
                                className="h-4 w-4"
                            />
                            <span className="text-xs font-bold text-slate-700">전체 선택</span>
                        </label>
                        <Badge variant="secondary" className="text-xs font-semibold bg-white border">
                            {selectedDocIds.size} / {docs.length}개 선택됨
                        </Badge>
                    </div>

                    {/* 일괄 액션 버튼들 */}
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={handleBatchRedraft}
                            disabled={selectedDocIds.size === 0}
                            className="h-8 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>재기안</span>
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                                setSingleDeleteTargetId(null);
                                setIsDeleteDialogOpen(true);
                            }}
                            disabled={selectedDocIds.size === 0 || isDeleting}
                            className="h-8 text-xs font-bold gap-1.5 shadow-xs"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>선택 삭제 ({selectedDocIds.size})</span>
                        </Button>
                    </div>
                </div>
            )}

            {/* 3. 회수 문서 목록 */}
            {docs.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-2xl bg-slate-50/50">
                    <Undo2 className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    <p className="font-bold text-slate-600">회수된 문서가 없습니다.</p>
                    <p className="text-xs text-slate-400 mt-1">상신 후 회수한 문서는 이곳에 보관됩니다.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {docs.map((doc) => {
                        const isSelected = selectedDocIds.has(doc.id);

                        return (
                            <Card 
                                key={doc.id} 
                                className={`transition-all duration-150 border rounded-xl overflow-hidden hover:shadow-md ${
                                    isSelected ? 'border-primary/60 bg-indigo-50/20 shadow-xs' : 'hover:border-slate-300 bg-white'
                                }`}
                            >
                                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    {/* 좌측: 체크박스 + 문서 기본 정보 */}
                                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                        <div className="pt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox 
                                                checked={isSelected}
                                                onCheckedChange={() => handleToggleSelect(doc.id)}
                                                className="h-4 w-4"
                                            />
                                        </div>

                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            {/* 태그 및 문서 번호 */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className="border-orange-400 text-orange-600 bg-orange-50/50 text-[11px] font-bold py-0">
                                                    회수됨
                                                </Badge>
                                                <span className="text-xs text-muted-foreground font-mono">
                                                    {doc.docNo || '문서번호 없음'}
                                                </span>
                                                {doc.category === 'family' && (
                                                    <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-600 py-0">
                                                        가정통신문
                                                    </Badge>
                                                )}
                                                {doc.docType === 'teacher-afterschool' && (
                                                    <Badge variant="outline" className="text-[10px] border-purple-500 text-purple-600 py-0">
                                                        방과후
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* 제목 (클릭 시 상세 보기) */}
                                            <Link 
                                                href={`/documents/${doc.id}`}
                                                className="block font-bold text-base text-slate-900 hover:text-primary transition-colors truncate"
                                            >
                                                {doc.title}
                                            </Link>

                                            {/* 메타 정보 */}
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                                <div className="flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    <span>{doc.requesterName}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <FileText className="h-3 w-3" />
                                                    <span>
                                                        {doc.createdAt ? format(new Date(doc.createdAt), 'yyyy-MM-dd HH:mm') : '-'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 우측 하단: 개별 작업 버튼 (재기안 / 삭제) */}
                                    <div className="flex items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleRedraft(doc.id)}
                                            className="h-8 text-xs font-bold gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                        >
                                            <Edit3 className="h-3.5 w-3.5" />
                                            <span>재기안</span>
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setSingleDeleteTargetId(doc.id);
                                                setIsDeleteDialogOpen(true);
                                            }}
                                            className="h-8 text-xs font-bold gap-1 text-red-500 hover:bg-red-50 hover:text-red-600"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            <span>삭제</span>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* 삭제 확인 AlertDialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="max-w-md rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600 font-extrabold text-lg">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <span>회수 문서 삭제</span>
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
                            <p>
                                {singleDeleteTargetId
                                    ? "선택한 회수 문서를 영구적으로 삭제하시겠습니까?"
                                    : `선택하신 ${selectedDocIds.size}건의 회수 문서를 영구적으로 일괄 삭제하시겠습니까?`}
                            </p>
                            <p className="text-red-500 font-medium">
                                ※ 삭제된 문서는 복구할 수 없습니다.
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel disabled={isDeleting} className="text-xs">
                            취소
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                executeDelete();
                            }}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    삭제 중...
                                </>
                            ) : (
                                "삭제하기"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
