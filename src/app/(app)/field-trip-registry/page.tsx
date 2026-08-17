'use client';

import { getAttendanceDocuments } from "@/lib/services/documentService";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { FileText, Loader2, Search, X } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function FieldTripRegistryPage() {
    const { user, profile } = useAuth();
    const [docs, setDocs] = useState<ApprovalDoc[]>([]);
    const [loading, setLoading] = useState(true);

    // 필터 상태
    const [selectedYear, setSelectedYear] = useState<string>('전체');
    const [selectedGrade, setSelectedGrade] = useState<string>('전체');
    const [studentNameQuery, setStudentNameQuery] = useState('');

    useEffect(() => {
        if (user?.uid && profile?.email) {
            getAttendanceDocuments(profile.email, !!profile.isAdmin).then(data => {
                setDocs(data);
                setLoading(false);
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

    const handleResetFilters = () => {
        setSelectedYear('전체');
        setSelectedGrade('전체');
        setStudentNameQuery('');
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
            <div className="mb-6">
                <h1 className="font-headline text-3xl font-bold flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    체험학습 문서함
                </h1>
                <p className="text-muted-foreground mt-1">결재가 완료된 학부모 교외체험학습 신청서 및 결과보고서 결합 문서 기록입니다.</p>
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

            <DocumentList documents={filteredDocs} />
        </div>
    );
}
