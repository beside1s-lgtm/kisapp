'use client';

import { getRegistryDocuments, getFaceToFaceRegistryDocuments } from "@/lib/services/documentService";
import { getGoogleDriveConfig, getOrgStructure } from "@/lib/services/settingsService";
import { DocumentList } from "@/components/document-list";
import { RegistryFolderBrowser } from "@/components/registry/RegistryFolderBrowser";
import { RegistryFilingEditDialog } from "@/components/registry/RegistryFilingEditDialog";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc, GoogleDriveConfig, OrgStructure } from "@/lib/types";
import {
    REGISTRY_DEPT_ALL,
    REGISTRY_FOLDER_ALL,
    RegistryDocNoSortOrder,
    buildRegistryFolderDirectory,
    collectRegistryFilingFolderOptions,
    compareApprovalDocsByDocNo,
    doesDocMatchRegistryFolderFilter,
    resolveApprovalDocFilingFolderMeta,
} from "@/lib/drive/registryFolderUtils";
import { ListFilter, Loader2, Search, X, ChevronDown, Folder, ExternalLink, Pencil, ArrowUpDown } from "lucide-react";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MainLayout } from "@/components/layout/main-layout";


export default function RegistryPage() {
    const { user, profile } = useAuth();
    const [docs, setDocs] = useState<ApprovalDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastDocRef = useRef<any>(null);

    // 필터 및 정렬 상태
    const [keyword, setKeyword] = useState('');
    const [publishFilter, setPublishFilter] = useState<string>('전체');
    const [docTypeFilter, setDocTypeFilter] = useState<string>('전체');
    const [requesterFilter, setRequesterFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedYear, setSelectedYear] = useState<string>('전체');
    const [selectedDeptName, setSelectedDeptName] = useState<string>(REGISTRY_DEPT_ALL);
    const [selectedFolderKey, setSelectedFolderKey] = useState<string>(REGISTRY_FOLDER_ALL);
    const [docNoSortOrder, setDocNoSortOrder] = useState<RegistryDocNoSortOrder>('desc');

    // 편철 폴더 메타데이터 (Google Drive 설정 + 조직도) & 수정 모달 상태
    const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig | null>(null);
    const [orgStructure, setOrgStructure] = useState<Partial<OrgStructure> | null>(null);
    const [isLoadingAllDocs, setIsLoadingAllDocs] = useState(false);
    const [editingFilingDoc, setEditingFilingDoc] = useState<ApprovalDoc | null>(null);

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

    // 최초 로드 (일반 결재완료 문서 + 대면결재 완료 문서 통합 조회)
    useEffect(() => {
        if (user?.uid && profile?.email) {
            setLoading(true);
            lastDocRef.current = null;
            Promise.all([
                getRegistryDocuments(undefined, 10, { includeFaceToFace: true }),
                getFaceToFaceRegistryDocuments().catch(() => ({ docs: [] as ApprovalDoc[], hasMore: false, lastVisible: null })),
                getGoogleDriveConfig().catch(() => null),
                getOrgStructure().catch(() => null),
            ]).then(([result, f2fResult, drvCfg, orgCfg]) => {
                const mergedMap = new Map<string, ApprovalDoc>();
                [...result.docs, ...f2fResult.docs].forEach(item => {
                    mergedMap.set(item.id, item);
                });
                setDocs(Array.from(mergedMap.values()));
                setHasMore(result.hasMore);
                lastDocRef.current = result.lastVisible;
                if (drvCfg) setDriveConfig(drvCfg);
                if (orgCfg) setOrgStructure(orgCfg);
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
        setDocs(prev => {
            const seen = new Set(prev.map(d => d.id));
            return [...prev, ...result.docs.filter(d => !seen.has(d.id))];
        });
        setHasMore(result.hasMore);
        lastDocRef.current = result.lastVisible;
        setLoadingMore(false);
    };

    // 미로드 문서 전체 불러오기 (폴더/검색 필터 시 누락 방지)
    const handleLoadAllDocs = useCallback(async () => {
        if (!hasMore || isLoadingAllDocs) return;
        setIsLoadingAllDocs(true);
        try {
            let cursor = lastDocRef.current;
            let more = Boolean(cursor) && hasMore;
            let guard = 0;
            const fetchedBatches: ApprovalDoc[] = [];

            while (more && cursor && guard < 15) {
                guard++;
                const res = await getRegistryDocuments(cursor, 10);
                fetchedBatches.push(...res.docs);
                cursor = res.lastVisible;
                more = res.hasMore && Boolean(res.lastVisible);
            }

            if (fetchedBatches.length > 0) {
                setDocs(prev => {
                    const seen = new Set(prev.map(d => d.id));
                    return [...prev, ...fetchedBatches.filter(d => !seen.has(d.id))];
                });
            }
            lastDocRef.current = cursor;
            setHasMore(more);
        } finally {
            setIsLoadingAllDocs(false);
        }
    }, [hasMore, isLoadingAllDocs]);

    // 편철 폴더 필터를 선택했는데 아직 로드되지 않은 문서가 남아있다면 자동으로 추가 로드
    useEffect(() => {
        const isFolderFiltering =
            selectedDeptName !== REGISTRY_DEPT_ALL || selectedFolderKey !== REGISTRY_FOLDER_ALL;
        if (isFolderFiltering && hasMore && !isLoadingAllDocs && lastDocRef.current) {
            void handleLoadAllDocs();
        }
    }, [selectedDeptName, selectedFolderKey, hasMore, isLoadingAllDocs, handleLoadAllDocs]);

    const knownFilingOptions = useMemo(
        () => collectRegistryFilingFolderOptions(driveConfig, orgStructure, selectedYear),
        [driveConfig, orgStructure, selectedYear]
    );

    const docsWithinYearScope = useMemo(() => {
        return docs.filter(doc => {
            if (doc.docType?.startsWith('volunteer') || Boolean(doc.volunteerFormData) || (doc as any).isVolunteer || (doc as any).isVolunteerBatch) return false;
            if (selectedYear !== '전체') {
                const dateStr = doc.createdAt || doc.completedAt;
                if (!dateStr || !dateStr.startsWith(selectedYear)) return false;
            }
            return true;
        });
    }, [docs, selectedYear]);

    const folderDirectory = useMemo(
        () => buildRegistryFolderDirectory(docsWithinYearScope, knownFilingOptions),
        [docsWithinYearScope, knownFilingOptions]
    );

    // 클라이언트 사이드 필터링 + 문서번호순 정렬
    const filteredDocs = useMemo(() => {
        return docsWithinYearScope
            .filter(doc => {
                if (keyword && !doc.title.toLowerCase().includes(keyword.toLowerCase())) return false;
                if (publishFilter !== '전체' && doc.publishStatus !== publishFilter) return false;
                if (docTypeFilter !== '전체') {
                    if (docTypeFilter === 'faceToFace' && !doc.isFaceToFace) return false;
                    if (docTypeFilter === 'family' && doc.category !== 'family') return false;
                    if (docTypeFilter === 'internal' && (doc.docType !== 'internal' || doc.category === 'family' || doc.isFaceToFace)) return false;
                    if (docTypeFilter === 'external' && doc.docType !== 'external') return false;
                    if (docTypeFilter === 'teacher-duty' && doc.docType !== 'teacher-duty') return false;
                    if (docTypeFilter === 'teacher-overtime' && doc.docType !== 'teacher-overtime') return false;
                }
                if (requesterFilter && !doc.requesterName?.includes(requesterFilter)) return false;
                if (dateFrom || dateTo) {
                    const createdDate = doc.createdAt ? new Date(doc.createdAt) : null;
                    if (!createdDate) return false;
                    if (dateFrom && createdDate < new Date(dateFrom)) return false;
                    if (dateTo && createdDate > new Date(dateTo + 'T23:59:59')) return false;
                }
                if (!doesDocMatchRegistryFolderFilter(doc, selectedFolderKey, selectedDeptName, knownFilingOptions)) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => compareApprovalDocsByDocNo(a, b, docNoSortOrder));
    }, [
        docsWithinYearScope,
        keyword,
        publishFilter,
        docTypeFilter,
        requesterFilter,
        dateFrom,
        dateTo,
        selectedFolderKey,
        selectedDeptName,
        knownFilingOptions,
        docNoSortOrder,
    ]);

    const handleFilingFolderSaved = useCallback(
        (docId: string, updatedFields: Partial<ApprovalDoc>) => {
            setDocs(prev =>
                prev.map(item => (item.id === docId ? { ...item, ...updatedFields } : item))
            );
        },
        []
    );

    const hasActiveFilter =
        Boolean(keyword) ||
        publishFilter !== '전체' ||
        docTypeFilter !== '전체' ||
        Boolean(requesterFilter) ||
        Boolean(dateFrom) ||
        Boolean(dateTo) ||
        selectedYear !== '전체' ||
        selectedDeptName !== REGISTRY_DEPT_ALL ||
        selectedFolderKey !== REGISTRY_FOLDER_ALL;

    const resetFilters = () => {
        setKeyword('');
        setPublishFilter('전체');
        setDocTypeFilter('전체');
        setRequesterFilter('');
        setDateFrom('');
        setDateTo('');
        setSelectedYear('전체');
        setSelectedDeptName(REGISTRY_DEPT_ALL);
        setSelectedFolderKey(REGISTRY_FOLDER_ALL);
    };

    const renderFilingBadges = useCallback(
        (docItem: ApprovalDoc) => {
            const meta = resolveApprovalDocFilingFolderMeta(docItem, knownFilingOptions);
            const userEmailLower = (profile?.email || '').trim().toLowerCase();
            const canEditAssigned =
                Boolean(profile?.isAdmin) ||
                Boolean(userEmailLower && docItem.requesterEmail?.trim().toLowerCase() === userEmailLower);

            return (
                <>
                    {docItem.isFaceToFace && (
                        <Badge
                            variant="outline"
                            className="text-[11px] py-0 px-1.5 border-amber-300 text-amber-800 bg-amber-50 font-semibold shrink-0"
                        >
                            대면결재
                        </Badge>
                    )}
                    <Badge
                        variant="outline"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedDeptName(meta.deptName);
                            setSelectedFolderKey(meta.folderKey);
                        }}
                        className={`text-[11px] py-0 px-1.5 gap-1 cursor-pointer transition-colors shrink-0 ${
                            meta.isUnassigned
                                ? 'border-slate-200 text-slate-500 bg-slate-50 hover:bg-slate-100'
                                : 'border-indigo-200 text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100'
                        }`}
                        title="클릭하여 이 편철 폴더 문서만 조회"
                    >
                        <Folder className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate max-w-[200px]">{meta.label}</span>
                    </Badge>
                    {(meta.isUnassigned || canEditAssigned) && (
                        <Badge
                            variant="outline"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingFilingDoc(docItem);
                            }}
                            className={`text-[11px] py-0 px-1.5 gap-1 cursor-pointer transition-colors shrink-0 ${
                                meta.isUnassigned
                                    ? 'border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50 font-bold'
                                    : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-100'
                            }`}
                            title={meta.isUnassigned ? '미지정 문서 편철 폴더 지정하기' : '편철 폴더 수정하기'}
                        >
                            <Pencil className="h-2.5 w-2.5 shrink-0" />
                            <span>{meta.isUnassigned ? '폴더 지정' : '폴더 수정'}</span>
                        </Badge>
                    )}
                    {docItem.driveFileUrl && (
                        <Badge
                            variant="outline"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.open(docItem.driveFileUrl, '_blank');
                            }}
                            className="text-[11px] py-0 px-1.5 gap-1 cursor-pointer border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 shrink-0"
                            title="Google Drive에 편철된 결재완료 PDF 열기"
                        >
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            <span>Drive PDF</span>
                        </Badge>
                    )}
                </>
            );
        },
        [knownFilingOptions, profile?.isAdmin, profile?.email]
    );

    if (loading) {
        return (
            <MainLayout title="문서등록대장" contentClassName="p-0 flex items-center justify-center">
                <div className="flex h-full w-full items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="문서등록대장" contentClassName="p-0 overflow-y-auto overscroll-contain">
        <div className="p-4 md:p-8 space-y-6 w-full overflow-x-hidden">
            {/* 상단 안내 */}
            <div className="flex items-center gap-3 border-b pb-4">
                <div>
                    <h1 className="font-headline text-2xl sm:text-3xl font-bold flex items-center gap-2.5 text-slate-900">
                        <ListFilter className="h-6 w-6 text-primary" />
                        문서등록대장
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">결재 완료된 모든 문서의 기록입니다.</p>
                </div>
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
                                <SelectItem value="faceToFace">대면결재</SelectItem>
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

                    {/* 편철 폴더(저장 문서함) */}
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">편철 폴더 (저장 문서함)</Label>
                        <Select
                            value={selectedFolderKey}
                            onValueChange={(val) => {
                                setSelectedFolderKey(val);
                                if (val === REGISTRY_FOLDER_ALL) {
                                    setSelectedDeptName(REGISTRY_DEPT_ALL);
                                } else {
                                    const matched = folderDirectory.folderItems.find(f => f.folderKey === val);
                                    if (matched) setSelectedDeptName(matched.deptName);
                                }
                            }}
                        >
                            <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="전체 폴더" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={REGISTRY_FOLDER_ALL}>전체 편철 폴더</SelectItem>
                                {folderDirectory.folderItems.map(folder => (
                                    <SelectItem key={folder.folderKey} value={folder.folderKey}>
                                        {folder.label} ({folder.count}건)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* 편철 폴더별 문서함 탐색/필터 바 */}
            <RegistryFolderBrowser
                totalDocsCount={docsWithinYearScope.length}
                deptGroups={folderDirectory.deptGroups}
                folderItems={folderDirectory.folderItems}
                selectedDeptName={selectedDeptName}
                selectedFolderKey={selectedFolderKey}
                onSelectDept={(dept) => setSelectedDeptName(dept)}
                onSelectFolder={(folderKey, dept) => {
                    setSelectedFolderKey(folderKey);
                    if (dept) setSelectedDeptName(dept);
                }}
                isLoadingAllDocs={isLoadingAllDocs}
                hasMoreDocs={hasMore}
                onLoadAllDocs={handleLoadAllDocs}
            />

            {/* 결과 수 및 문서번호순 정렬 */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                    {hasActiveFilter
                        ? <span>검색 결과 <strong className="text-foreground">{filteredDocs.length}</strong>건 (로드된 {docs.length}건 중)</span>
                        : <span>총 문서 <strong className="text-foreground">{filteredDocs.length}</strong>건{hasMore && <span className="text-muted-foreground"> · 추가 문서 있음</span>}</span>
                    }
                </p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDocNoSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
                    className="h-8 px-2.5 text-xs font-semibold text-slate-700 border-slate-300 bg-white hover:bg-slate-50 gap-1.5"
                    title="문서번호순 정렬 방향 전환"
                >
                    <ArrowUpDown className="h-3.5 w-3.5 text-indigo-600" />
                    <span>
                        {docNoSortOrder === 'desc'
                            ? '문서번호 최신순 (큰 번호 먼저)'
                            : '문서번호 순차순 (작은 번호 먼저)'}
                    </span>
                </Button>
            </div>

            {/* 문서 목록 */}
            <DocumentList documents={filteredDocs} customBadges={renderFilingBadges} />

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
                    모든 문서를 불러왔습니다. (총 {filteredDocs.length}건)
                </p>
            )}
        </div>

        <RegistryFilingEditDialog
            open={Boolean(editingFilingDoc)}
            onOpenChange={(open) => {
                if (!open) setEditingFilingDoc(null);
            }}
            docItem={editingFilingDoc}
            filingOptions={knownFilingOptions}
            driveEnabled={Boolean(driveConfig?.enabled)}
            onSaved={handleFilingFolderSaved}
        />
        </MainLayout>
    );
}
