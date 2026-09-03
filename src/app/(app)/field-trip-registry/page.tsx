'use client';

import { useRouter } from "next/navigation";
import { getAttendanceDocuments } from "@/lib/services/documentService";
import { getOrgStructure } from "@/lib/services/settingsService";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc, OrgStructure, DutyRolePermission } from "@/lib/types";
import { FileText, Loader2, Search, X, ArrowLeft, Printer, CheckCircle2, Clock } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { BatchDocumentPrintModal } from "@/components/batch-document-print-modal";

export default function FieldTripRegistryPage() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const [docs, setDocs] = useState<ApprovalDoc[]>([]);
    const [loading, setLoading] = useState(true);

    // 다중 선택 및 일괄 인쇄 상태
    const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    // 필터 상태
    const [selectedYear, setSelectedYear] = useState<string>('전체');
    const [selectedGrade, setSelectedGrade] = useState<string>('전체');
    const [studentNameQuery, setStudentNameQuery] = useState('');

    useEffect(() => {
        if (user?.uid && profile?.email) {
            getOrgStructure().then(orgData => {
                const org = (orgData || null) as OrgStructure | null;
                const normalizedEmail = profile.email.toLowerCase();
                const userPerms: DutyRolePermission[] = [];

                if (org) {
                    if (org.afterschoolManagers?.some(e => e.toLowerCase() === normalizedEmail)) {
                        if (org.dutyRolePermissions?.['afterschool']) userPerms.push(org.dutyRolePermissions['afterschool']);
                    }
                    if (org.busManagers?.some(e => e.toLowerCase() === normalizedEmail)) {
                        if (org.dutyRolePermissions?.['bus']) userPerms.push(org.dutyRolePermissions['bus']);
                    }
                    if (org.systemManagers?.some(e => e.toLowerCase() === normalizedEmail)) {
                        if (org.dutyRolePermissions?.['system']) userPerms.push(org.dutyRolePermissions['system']);
                    }
                    if (org.healthTeachers?.some(e => e.toLowerCase() === normalizedEmail)) {
                        if (org.dutyRolePermissions?.['health']) userPerms.push(org.dutyRolePermissions['health']);
                    }
                    if (org.specialTeachers?.some(e => e.toLowerCase() === normalizedEmail)) {
                        if (org.dutyRolePermissions?.['special']) userPerms.push(org.dutyRolePermissions['special']);
                    }
                    (org.customDutyRoles || []).forEach(role => {
                        if (role.teacherEmails?.some(e => e.toLowerCase() === normalizedEmail)) {
                            if (role.permissions) userPerms.push(role.permissions);
                            else if (org.dutyRolePermissions?.[role.id]) userPerms.push(org.dutyRolePermissions[role.id]);
                        }
                    });
                }

                getAttendanceDocuments(profile.email, !!profile.isAdmin, {
                    orgStructure: org,
                    permissions: userPerms,
                }).then(data => {
                    setDocs(data);
                    setLoading(false);
                });
            }).catch(() => {
                getAttendanceDocuments(profile.email, !!profile.isAdmin).then(data => {
                    setDocs(data);
                    setLoading(false);
                });
            });
        } else if (!user || !profile) {
            setLoading(false);
        }
    }, [user, profile]);

    // 사용 가능한 연도 목록 추출
    const availableYears = useMemo(() => {
        const years = new Set<string>();
        docs.forEach(doc => {
            if (doc.parentFormData?.type === 'field-trip') {
                const dateStr = doc.createdAt || doc.completedAt;
                if (dateStr) {
                    const y = dateStr.substring(0, 4);
                    if (/^\d{4}$/.test(y)) {
                        years.add(y);
                    }
                }
            }
        });
        if (years.size === 0) {
            years.add(new Date().getFullYear().toString());
        }
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [docs]);

    // 필터링 적용 로직
    const filteredDocs = useMemo(() => {
        return docs.filter(doc => {
            // 1. 체험학습 신청서(field-trip) 문서만 표출
            const isFieldTrip = doc.parentFormData?.type === 'field-trip';
            if (!isFieldTrip) return false;

            // 2. 연도 필터링
            if (selectedYear !== '전체') {
                const dateStr = doc.createdAt || doc.completedAt;
                if (!dateStr || !dateStr.startsWith(selectedYear)) return false;
            }

            // 3. 학년 필터링 (parentFormData.gradeClassNumber 또는 studentGrade 사용)
            if (selectedGrade !== '전체') {
                const gradeClass = doc.parentFormData?.gradeClassNumber || '';
                // '4-4-2' 에서 첫 번째 숫자가 학년
                const firstChar = gradeClass.trim().charAt(0);
                if (firstChar !== selectedGrade) return false;
            }

            // 4. 학생명 필터링
            if (studentNameQuery) {
                const name = doc.parentFormData?.studentName || doc.requesterName || '';
                if (!name.toLowerCase().includes(studentNameQuery.toLowerCase())) return false;
            }

            return true;
        });
    }, [docs, selectedYear, selectedGrade, studentNameQuery]);

    // 체험학습 결과보고서 제출 여부 판별
    const checkReportSubmitted = (doc: ApprovalDoc) => {
        const pfd = doc.parentFormData as any;
        return Boolean(
            pfd?.reportSubmitted ||
            (doc as any).reportSubmitted ||
            pfd?.reportContent ||
            (doc as any).reportContent ||
            (doc.content && doc.content.includes('결과보고서'))
        );
    };

    const handleResetFilters = () => {
        setSelectedYear('전체');
        setSelectedGrade('전체');
        setStudentNameQuery('');
        setSelectedDocIds([]);
    };

    // 출력 가능한 (결과보고서까지 완비된) 문서 목록
    const printableDocs = useMemo(() => {
        return filteredDocs.filter(checkReportSubmitted);
    }, [filteredDocs]);

    // 선택된 문서 목록
    const selectedDocs = useMemo(() => {
        return filteredDocs.filter(d => selectedDocIds.includes(d.id));
    }, [filteredDocs, selectedDocIds]);

    // 전체 선택 / 해제 핸들러 (보고서 완비 문서만 선택)
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedDocIds(printableDocs.map(d => d.id));
        } else {
            setSelectedDocIds([]);
        }
    };

    // 개별 선택 토글 핸들러
    const handleSelectDoc = (docId: string, checked: boolean) => {
        setSelectedDocIds(prev => checked ? [...prev, docId] : prev.filter(id => id !== docId));
    };

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <div className="mb-6 flex items-center gap-3 border-b pb-4">
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
                        <FileText className="h-6 w-6 text-primary" />
                        체험학습 문서함
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">결재가 완료된 학부모 출결 문서(체험학습 신청/보고서) 기록입니다.</p>
                </div>
            </div>

            {/* 필터 바 */}
            <div className="bg-card border rounded-lg p-4 mb-6 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* 연도 필터 */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">학년도</label>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="bg-background">
                                <SelectValue placeholder="연도 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="전체">전체 학년도</SelectItem>
                                {availableYears.map(year => (
                                    <SelectItem key={year} value={year}>{year}학년도</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 학년 필터 */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">학년</label>
                        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                            <SelectTrigger className="bg-background">
                                <SelectValue placeholder="학년 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="전체">전체 학년</SelectItem>
                                {[1, 2, 3, 4, 5, 6].map(g => (
                                    <SelectItem key={g} value={g.toString()}>{g}학년</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 학생명 검색 */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">학생명 검색</label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="학생 이름 입력"
                                className="pl-9 bg-background"
                                value={studentNameQuery}
                                onChange={(e) => setStudentNameQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* 필터 초기화 버튼 */}
                <div className="shrink-0 w-full md:w-auto">
                    <Button 
                        variant="outline" 
                        className="w-full md:w-auto gap-2" 
                        onClick={handleResetFilters}
                        disabled={selectedYear === '전체' && selectedGrade === '전체' && !studentNameQuery}
                    >
                        <X className="h-4 w-4" />
                        필터 초기화
                    </Button>
                </div>
            </div>

            {/* 일괄 선택 및 인쇄 툴바 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="select-all-field-trip"
                            checked={printableDocs.length > 0 && selectedDocIds.length === printableDocs.length}
                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                            disabled={printableDocs.length === 0}
                            className="w-4 h-4"
                        />
                        <label
                            htmlFor="select-all-field-trip"
                            className="text-xs font-bold text-slate-700 cursor-pointer select-none"
                        >
                            전체 선택
                        </label>
                    </div>
                    <span className="text-xs text-slate-400">|</span>
                    <span className="text-xs text-slate-600">
                        출력 완비 <b className="text-emerald-700">{printableDocs.length}</b>건 중 <b className="text-primary">{selectedDocIds.length}</b>건 선택됨
                        {filteredDocs.length > printableDocs.length && (
                            <span className="text-amber-700 font-medium ml-1.5">
                                (보고서 대기 {filteredDocs.length - printableDocs.length}건 제외)
                            </span>
                        )}
                    </span>
                    {selectedDocIds.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setSelectedDocIds([])}
                            className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-1 cursor-pointer"
                        >
                            선택 해제
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        onClick={() => setIsPrintModalOpen(true)}
                        disabled={selectedDocIds.length === 0}
                        className="h-8 px-3.5 text-xs font-bold bg-primary hover:bg-primary/90 text-white flex items-center gap-1.5 shadow-2xs shrink-0"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        <span>선택 문서 일괄 인쇄 ({selectedDocIds.length}건 - 신청서+보고서 쌍)</span>
                    </Button>
                </div>
            </div>

            <DocumentList 
                documents={filteredDocs} 
                selectable={true}
                selectedDocIds={selectedDocIds}
                onSelectDoc={handleSelectDoc}
                isDocSelectable={checkReportSubmitted}
                nonSelectableReason={() => '결과보고서가 아직 제출되지 않아 출력이 불가합니다 (신청서+보고서 완비 시 출력 가능)'}
                customBadges={(doc) => checkReportSubmitted(doc) ? (
                    <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 gap-1 text-[11px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        신청서+보고서 완비 (출력 가능)
                    </Badge>
                ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 gap-1 text-[11px]">
                        <Clock className="w-3 h-3 text-amber-600" />
                        결과보고서 대기 (출력 불가)
                    </Badge>
                )}
                onPrintSingleDoc={(doc) => {
                    setSelectedDocIds([doc.id]);
                    setIsPrintModalOpen(true);
                }}
            />

            {/* 일괄 인쇄 모달 */}
            <BatchDocumentPrintModal
                isOpen={isPrintModalOpen}
                onClose={() => setIsPrintModalOpen(false)}
                documents={selectedDocs}
                title="체험학습 신청서 및 결과보고서 일괄 인쇄"
            />
        </div>
    );
}
