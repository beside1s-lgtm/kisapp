'use client';

import { getRegistryDocuments } from "@/lib/services/documentService";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { ListFilter, Loader2, Search, X, ChevronDown } from "lucide-react";
import { useEffect, useState, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function RegistryPage() {
    const { user, profile } = useAuth();
    const [docs, setDocs] = useState<ApprovalDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastDocRef = useRef<any>(null);

    // 필터 상태
    const [keyword, setKeyword] = useState('');
    const [publishFilter, setPublishFilter] = useState<string>('전체');
    const [docTypeFilter, setDocTypeFilter] = useState<string>('전체');
    const [requesterFilter, setRequesterFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedYear, setSelectedYear] = useState<string>('전체');

    // 문서에 존재하는 연도 추출
    const availableYears = useMemo(() => {
        const years = new Set<string>();
        docs.forEach(doc => {
            const dateStr = doc.createdAt || doc.completedAt;
            if (dateStr) {
                const y = dateStr.substring(0, 4);
                if (/^\d{4}$/.test(y)) {
                    years.add(y);
                }
            }
        });
        if (years.size === 0) {
            years.add(new Date().getFullYear().toString());
        }
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [docs]);

    // 최초 로드
    useEffect(() => {
        if (user?.uid && profile?.email) {
            setLoading(true);
            lastDocRef.current = null;
            getRegistryDocuments().then(result => {
                setDocs(result.docs);
                setHasMore(result.hasMore);
                lastDocRef.current = result.lastVisible;
                setLoading(false);
            });
        } else if (!user || !profile) {
            setLoading(false);
        }
    }, [user, profile]);

    // 더 보기
    const handleLoadMore = async () => {
        if (!lastDocRef.current || loadingMore) return;
        setLoadingMore(true);
        const result = await getRegistryDocuments(lastDocRef.current);
        setDocs(prev => [...prev, ...result.docs]);
        setHasMore(result.hasMore);
        lastDocRef.current = result.lastVisible;
        setLoadingMore(false);
    };

    // 클라이언트 사이드 필터링
    const filteredDocs = useMemo(() => {
        return docs.filter(doc => {
            if (keyword && !doc.title.toLowerCase().includes(keyword.toLowerCase())) return false;
            if (publishFilter !== '전체' && doc.publishStatus !== publishFilter) return false;
            if (docTypeFilter !== '전체') {
                if (docTypeFilter === 'family' && doc.category !== 'family') return false;
                if (docTypeFilter === 'internal' && (doc.docType !== 'internal' || doc.category === 'family')) return false;
                if (docTypeFilter === 'external' && doc.docType !== 'external') return false;
                if (docTypeFilter === 'teacher-duty' && doc.docType !== 'teacher-duty') return false;
                if (docTypeFilter === 'teacher-overtime' && doc.docType !== 'teacher-overtime') return false;
            }
            if (requesterFilter && !doc.requesterName?.includes(requesterFilter)) return false;
            if (selectedYear !== '전체') {
                const dateStr = doc.createdAt || doc.completedAt;
                if (!dateStr || !dateStr.startsWith(selectedYear)) return false;
            }
            if (dateFrom || dateTo) {
                const createdDate = doc.createdAt ? new Date(doc.createdAt) : null;
                if (!createdDate) return false;
                if (dateFrom && createdDate < new Date(dateFrom)) return false;
                if (dateTo && createdDate > new Date(dateTo + 'T23:59:59')) return false;
            }
            return true;
        });
    }, [docs, keyword, publishFilter, docTypeFilter, requesterFilter, dateFrom, dateTo, selectedYear]);

    const hasActiveFilter = keyword || publishFilter !== '전체' || docTypeFilter !== '전체' || requesterFilter || dateFrom || dateTo || selectedYear !== '전체';

    const resetFilters = () => {
        setKeyword('');
        setPublishFilter('전체');
        setDocTypeFilter('전체');
        setRequesterFilter('');
        setDateFrom('');
        setDateTo('');
        setSelectedYear('전체');
    };

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* 헤더 */}
            <div>
                <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
                    <ListFilter className="h-8 w-8 text-primary" />
                    문서대장
                </h1>
                <p className="text-muted-foreground mt-1">결재 완료된 모든 문서의 기록입니다.</p>
            </div>

            {/* 검색/필터 영역 */}
            <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">검색 및 필터</span>
                    {hasActiveFilter && (
                        <Button variant="ghost" size="sm" onClick={resetFilters} className="ml-auto text-xs text-muted-foreground h-7 px-2">
                            <X className="h-3 w-3 mr-1" />
                            초기화
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {/* 제목 키워드 */}
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">제목 검색</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="제목 키워드..."
                                value={keyword}
                                onChange={e => setKeyword(e.target.value)}
                                className="pl-8 h-9 text-sm"
                            />
                        </div>
                    </div>

                    {/* 기안자 */}
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">기안자</Label>
                        <Input
                            placeholder="기안자 이름..."
                            value={requesterFilter}
                            onChange={e => setRequesterFilter(e.target.value)}
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* 게시 상태 */}
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">게시 상태</Label>
                        <Select value={publishFilter} onValueChange={setPublishFilter}>
                            <SelectTrigger className="h-9 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="전체">전체</SelectItem>
                                <SelectItem value="공개">공개</SelectItem>
                                <SelectItem value="부분공개">부분공개</SelectItem>
                                <SelectItem value="비공개">비공개</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 문서 종류 */}
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">문서 종류</Label>
                        <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
                            <SelectTrigger className="h-9 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="전체">전체</SelectItem>
                                <SelectItem value="internal">내부결재</SelectItem>
                                <SelectItem value="external">대외공문</SelectItem>
                                <SelectItem value="family">가정통신문</SelectItem>
                                <SelectItem value="teacher-duty">복무신청</SelectItem>
                                <SelectItem value="teacher-overtime">초과근무</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 조회 연도 */}
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">조회 연도</Label>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="h-9 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="전체">전체</SelectItem>
                                {availableYears.map(year => (
                                    <SelectItem key={year} value={year}>{year}년</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 날짜 범위 */}
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">기안일 시작</Label>
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="h-9 text-sm"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">기안일 종료</Label>
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="h-9 text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* 결과 수 */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {hasActiveFilter
                        ? <span>검색 결과 <strong className="text-foreground">{filteredDocs.length}</strong>건 (로드된 {docs.length}건 중)</span>
                        : <span>로드된 문서 <strong className="text-foreground">{docs.length}</strong>건{hasMore && <span className="text-muted-foreground"> · 추가 문서 있음</span>}</span>
                    }
                </p>
            </div>

            {/* 문서 목록 */}
            <DocumentList documents={filteredDocs} />

            {/* 더 보기 버튼 (필터 미사용 시 & 추가 데이터 있을 때) */}
            {!hasActiveFilter && hasMore && (
                <div className="flex justify-center pt-2">
                    <Button
                        variant="outline"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="gap-2 px-8"
                    >
                        {loadingMore
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중...</>
                            : <><ChevronDown className="h-4 w-4" /> 더 보기 (30건씩)</>
                        }
                    </Button>
                </div>
            )}

            {/* 모두 로드된 경우 안내 */}
            {!hasMore && docs.length > 0 && !hasActiveFilter && (
                <p className="text-center text-xs text-muted-foreground py-2">
                    모든 문서를 불러왔습니다. (총 {docs.length}건)
                </p>
            )}
        </div>
    );
}
