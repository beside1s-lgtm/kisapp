'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Download, Upload, Trash2, UserX, Users, UserPlus, X, Pencil, Check, CheckCircle2, QrCode, Printer, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTranslation } from '@/hooks/use-translation';
import type { Student, Destination, Bus, Route, DayOfWeek, RouteType, AfterSchoolClass } from '@/lib/kisbus/types';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn, normalizeString, getStudentName } from '@/lib/kisbus/utils';
import { updateStudent, addDestination, deleteStudentsInBatch } from '@/lib/kisbus';
import { useToast } from '@/hooks/use-toast';

interface StudentGlobalSearchPanelProps {
    students: Student[];
    destinations: Destination[];
    buses: Bus[];
    routes: Route[];
    selectedRouteType: RouteType;
    dayOrder: DayOfWeek[];
    selectedGlobalStudent: Student | null;
    setSelectedGlobalStudent: React.Dispatch<React.SetStateAction<Student | null>>;
    globalSearchQuery: string;
    setGlobalSearchQuery: (query: string) => void;
    globalSearchResults: Student[];
    handleGlobalStudentClick: (student: Student) => void;
    handleDownloadAllStudents: () => void;
    handleDownloadRouteAssignments: () => void;
    handleDownloadStudentTemplate: () => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    handleStudentFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleDeleteAllStudents: () => void;
    handleUnassignAllFromStudent: () => void;
    handleAssignStudentFromSearch: () => void;
    handleStudentInfoChange: (id: string, field: 'name'|'gender'|'contact'|'grade'|'class'|'number', val: string) => void;
    handleDestinationChange: (id: string, val: string|null, type: 'morning'|'afternoon'|'afterSchool'|'satMorning'|'satAfternoon', day?: DayOfWeek) => void;
    handleUnassignStudentFromRoute: (routeId: string, studentId: string) => void;
    assignedRoutesForSelectedStudent: Route[];
    afterSchoolClasses?: AfterSchoolClass[];
    semesterMode?: 'regular' | 'vacation';
    onAddStudentToClass?: (studentId: string, classId: string) => Promise<void>;
    onRemoveStudentFromClass?: (studentId: string, className: string) => Promise<void>;
    onRevertToAfternoonRoute?: (studentId: string, day?: DayOfWeek) => Promise<void>;
}

export const StudentGlobalSearchPanel = ({
    students, destinations, buses, routes, selectedRouteType, dayOrder, selectedGlobalStudent, setSelectedGlobalStudent,
    globalSearchQuery, setGlobalSearchQuery, globalSearchResults, handleGlobalStudentClick,
    handleDownloadAllStudents, handleDownloadRouteAssignments, handleDownloadStudentTemplate, fileInputRef, handleStudentFileUpload,
    handleDeleteAllStudents, handleUnassignAllFromStudent, handleAssignStudentFromSearch,
    handleStudentInfoChange, handleDestinationChange, handleUnassignStudentFromRoute,
    assignedRoutesForSelectedStudent,
    afterSchoolClasses = [],
    semesterMode = 'regular',
    onAddStudentToClass,
    onRemoveStudentFromClass,
    onRevertToAfternoonRoute
}: StudentGlobalSearchPanelProps) => {
    const { t, i18n } = useTranslation();
    const { toast } = useToast();
    const [siblingSearchQuery, setSiblingSearchQuery] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [isAddToClassDialogOpen, setIsAddToClassDialogOpen] = useState(false);
    const [selectedClassIdToAdd, setSelectedClassIdToAdd] = useState<string>('');

    const [batchGrade, setBatchGrade] = useState('all');
    const [batchClass, setBatchClass] = useState('all');
    const [isBatchQrOpen, setIsBatchQrOpen] = useState(false);
    const [isIndividualQrOpen, setIsIndividualQrOpen] = useState(false);

    const uniqueGrades = useMemo(() => {
        const set = new Set<string>();
        students.forEach(s => { if (s.grade) set.add(s.grade); });
        return Array.from(set).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''), 10);
            const numB = parseInt(b.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });
    }, [students]);

    const uniqueClasses = useMemo(() => {
        const set = new Set<string>();
        students.forEach(s => { if (s.class) set.add(s.class); });
        return Array.from(set).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''), 10);
            const numB = parseInt(b.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });
    }, [students]);

    const filteredBatchStudents = useMemo(() => {
        return students.filter(s => {
            const matchesGrade = batchGrade === 'all' || s.grade === batchGrade;
            const matchesClass = batchClass === 'all' || s.class === batchClass;
            return matchesGrade && matchesClass;
        }).sort((a, b) => {
            const ga = parseInt(a.grade.replace(/\D/g, ''), 10) || 0;
            const gb = parseInt(b.grade.replace(/\D/g, ''), 10) || 0;
            if (ga !== gb) return ga - gb;
            const ca = a.class.localeCompare(b.class, undefined, { numeric: true });
            if (ca !== 0) return ca;
            return getStudentName(a, i18n.language).localeCompare(getStudentName(b, i18n.language), 'ko');
        });
    }, [students, batchGrade, batchClass, i18n.language]);

    const handleBatchPrintQr = () => {
        if (filteredBatchStudents.length === 0) {
            toast({ title: t('error'), description: "인쇄할 학생이 없습니다.", variant: 'destructive' });
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast({ title: t('error'), description: "팝업 차단이 활성화되어 있어 인쇄 창을 열 수 없습니다.", variant: 'destructive' });
            return;
        }

        // 30명 단위로 청크 분할
        const chunks: Student[][] = [];
        for (let i = 0; i < filteredBatchStudents.length; i += 30) {
            chunks.push(filteredBatchStudents.slice(i, i + 30));
        }

        let htmlContent = `
        <html>
        <head>
            <title>QR Code Labels - Print (AnyLabel V6530)</title>
            <style>
                /* =====================================================
                   AnyLabel V6530 증명사진 포토 라벨 30칸 규격
                   라벨 크기: 30mm x 40mm | 배열: 5열 x 6행
                   상단 여백: 15mm | 좌측 여백: 15mm
                   열/행 간격: 0mm
                   ===================================================== */
                @page {
                    size: A4;
                    margin: 0;
                }
                * { box-sizing: border-box; }
                body {
                    font-family: 'Malgun Gothic', 'Dotum', sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: white;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .page-container {
                    width: 210mm;
                    height: 297mm;
                    padding-top: 15mm;
                    padding-left: 15mm;
                    padding-right: 15mm;
                    page-break-after: always;
                    overflow: hidden;
                }
                .label-grid {
                    display: grid;
                    grid-template-columns: repeat(5, 30mm);
                    grid-template-rows: repeat(6, 40mm);
                    gap: 0;
                }
                .label-cell {
                    width: 30mm;
                    height: 40mm;
                    padding: 2mm 1.5mm 1.5mm 1.5mm;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }
                .qr-img {
                    width: 24mm;
                    height: 24mm;
                    display: block;
                    margin-bottom: 1.5mm;
                }
                .student-class {
                    font-size: 8px;
                    color: #555;
                    font-weight: bold;
                    margin-bottom: 1px;
                    text-align: center;
                    width: 100%;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .student-info {
                    font-size: 8.5px;
                    font-weight: bold;
                    color: #111;
                    text-align: center;
                    width: 100%;
                    line-height: 1.2;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            </style>
        </head>
        <body>
        `;

        chunks.forEach((chunk) => {
            htmlContent += `<div class="page-container"><div class="label-grid">`;
            chunk.forEach(s => {
                const displayNameKo = s.nameKo || '';
                const displayNameEn = s.nameEn || '';
                const displayNames = [displayNameKo, displayNameEn].filter(Boolean).join('/') || s.name;
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${s.id}`;
                
                htmlContent += `
                    <div class="label-cell">
                        <img class="qr-img" src="${qrUrl}" alt="QR" />
                        <div class="student-class">[${s.grade}-${s.class}]</div>
                        <div class="student-info">${displayNames}</div>
                    </div>
                `;
            });
            htmlContent += `</div></div>`;
        });

        htmlContent += `
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        window.close();
                    }, 500);
                };
            </script>
        </body>
        </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handleDownloadQr = async (student: Student) => {
        try {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${student.id}`;
            const response = await fetch(qrUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const name = student.nameKo || student.nameEn || student.name || 'Student';
            link.download = `QR_${student.grade || 'N'}_${student.class || 'N'}_${name}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            toast({ title: t('error'), description: "이미지 다운로드에 실패했습니다.", variant: 'destructive' });
        }
    };

    const handlePrintQr = (student: Student) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast({ title: t('error'), description: "팝업 차단이 활성화되어 있어 인쇄 창을 열 수 없습니다.", variant: 'destructive' });
            return;
        }

        const displayNameKo = student.nameKo || '';
        const displayNameEn = student.nameEn || '';
        const displayNames = [displayNameKo, displayNameEn].filter(Boolean).join(' / ') || student.name;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${student.id}`;

        // 단일 학생도 V6530 첫 번째 칸에 맞게 출력
        let htmlContent = `
        <html>
        <head>
            <title>QR Code Label - Print (AnyLabel V6530)</title>
            <style>
                /* AnyLabel V6530: 라벨 30x40mm, 상단 15mm, 좌측 15mm */
                @page {
                    size: A4;
                    margin: 0;
                }
                * { box-sizing: border-box; }
                body {
                    font-family: 'Malgun Gothic', 'Dotum', sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: white;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .page-container {
                    width: 210mm;
                    height: 297mm;
                    padding-top: 15mm;
                    padding-left: 15mm;
                    overflow: hidden;
                }
                .label-cell {
                    width: 30mm;
                    height: 40mm;
                    padding: 2mm 1.5mm 1.5mm 1.5mm;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }
                .qr-img {
                    width: 24mm;
                    height: 24mm;
                    display: block;
                    margin-bottom: 1.5mm;
                }
                .student-class {
                    font-size: 8px;
                    color: #555;
                    font-weight: bold;
                    margin-bottom: 1px;
                    text-align: center;
                    width: 100%;
                    white-space: nowrap;
                }
                .student-info {
                    font-size: 8.5px;
                    font-weight: bold;
                    color: #111;
                    text-align: center;
                    width: 100%;
                    line-height: 1.2;
                    white-space: nowrap;
                }
            </style>
        </head>
        <body>
            <div class="page-container">
                <div class="label-cell">
                    <img class="qr-img" src="${qrUrl}" alt="QR" />
                    <div class="student-class">[${student.grade}-${student.class}]</div>
                    <div class="student-info">${displayNames}</div>
                </div>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        window.close();
                    }, 800);
                };
            </script>
        </body>
        </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // Reset editing state when student changes
    useEffect(() => {
        setIsEditingName(false);
    }, [selectedGlobalStudent?.id]);

    const siblingSearchResults = useMemo(() => {
        if (!siblingSearchQuery || !selectedGlobalStudent) return [];
        const lowerQuery = normalizeString(siblingSearchQuery);
        return students.filter(s => 
            s.id !== selectedGlobalStudent.id && 
            (normalizeString(s.nameKo || '').includes(lowerQuery) || 
             normalizeString(s.nameEn || '').includes(lowerQuery) || 
             normalizeString(s.name || '').includes(lowerQuery))
        ).slice(0, 5);
    }, [siblingSearchQuery, students, selectedGlobalStudent]);

    const currentSiblings = useMemo(() => {
        if (!selectedGlobalStudent || !selectedGlobalStudent.siblingGroupId) return [];
        return students.filter(s => 
            s.siblingGroupId === selectedGlobalStudent.siblingGroupId && 
            s.id !== selectedGlobalStudent.id
        );
    }, [selectedGlobalStudent, students]);

    const handleAddSibling = async (sibling: Student) => {
        if (!selectedGlobalStudent) return;
        
        const newGroupId = selectedGlobalStudent.siblingGroupId || `group_${Date.now()}`;
        
        await updateStudent(selectedGlobalStudent.id, { siblingGroupId: newGroupId });
        await updateStudent(sibling.id, { siblingGroupId: newGroupId });
        
        setSelectedGlobalStudent(prev => prev ? { ...prev, siblingGroupId: newGroupId } : null);
        setSiblingSearchQuery('');
    };

    const handleRemoveSibling = async (siblingId: string) => {
        await updateStudent(siblingId, { siblingGroupId: null });
        if (currentSiblings.length === 1) {
             await updateStudent(selectedGlobalStudent!.id, { siblingGroupId: null });
             setSelectedGlobalStudent(prev => prev ? { ...prev, siblingGroupId: null } : null);
        }
    };

    const toggleNameEdit = () => {
        if (isEditingName && selectedGlobalStudent) {
            handleStudentInfoChange(selectedGlobalStudent.id, 'name', selectedGlobalStudent.nameEn || selectedGlobalStudent.nameKo || selectedGlobalStudent.name);
            updateStudent(selectedGlobalStudent.id, { 
                nameKo: selectedGlobalStudent.nameKo || '', 
                nameEn: selectedGlobalStudent.nameEn || '' 
            });
        }
        setIsEditingName(!isEditingName);
    };

    const handleApproveStudentDestination = async (studentId: string, suggestion: string, type: 'morning' | 'afternoon' | 'satMorning' | 'satAfternoon') => {
        try {
            const newDest = await addDestination({ name: suggestion });
            const updates: any = {};
            if (type === 'morning') {
                updates.morningDestinationId = newDest.id;
                updates.suggestedMorningDestination = null;
            } else if (type === 'afternoon') {
                updates.afternoonDestinationId = newDest.id;
                updates.suggestedAfternoonDestination = null;
            } else if (type === 'satMorning') {
                updates.satMorningDestinationId = newDest.id;
                updates.suggestedSatMorningDestination = null;
            } else if (type === 'satAfternoon') {
                updates.satAfternoonDestinationId = newDest.id;
                updates.suggestedSatAfternoonDestination = null;
            }
            
            await updateStudent(studentId, updates);
            toast({ 
                title: t('success'), 
                description: `'${suggestion}'이(가) 정식 목적지로 등록되고 학생에게 배정되었습니다.` 
            });

            if (selectedGlobalStudent?.id === studentId) {
                setSelectedGlobalStudent(prev => prev ? { ...prev, ...updates } : null);
            }
        } catch (error) {
            toast({ title: t('error'), description: "승인 처리 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleRejectStudentDestination = async (studentId: string, type: 'morning' | 'afternoon' | 'satMorning' | 'satAfternoon') => {
        try {
            const updates: any = {};
            if (type === 'morning') updates.suggestedMorningDestination = null;
            else if (type === 'afternoon') updates.suggestedAfternoonDestination = null;
            else if (type === 'satMorning') updates.suggestedSatMorningDestination = null;
            else if (type === 'satAfternoon') updates.suggestedSatAfternoonDestination = null;
            
            await updateStudent(studentId, updates);
            toast({ title: t('success'), description: "신청된 목적지를 거절 처리했습니다." });

            if (selectedGlobalStudent?.id === studentId) {
                setSelectedGlobalStudent(prev => prev ? { ...prev, ...updates } : null);
            }
        } catch (error) {
            toast({ title: t('error'), description: "처리 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleDeleteSelectedStudent = async () => {
        if (!selectedGlobalStudent) return;
        try {
            await deleteStudentsInBatch([selectedGlobalStudent.id]);
            setSelectedGlobalStudent(null);
            toast({ title: t('success'), description: "학생 신청 정보가 삭제되었습니다." });
        } catch (error) {
            toast({ title: t('error'), description: "삭제 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">{t('admin.student_management.search.title')}</CardTitle>
                <CardDescription>{t('admin.student_management.search.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative mb-4">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder={t('admin.student_management.search.placeholder')}
                        className="pl-8 w-full"
                        value={globalSearchQuery}
                        onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    />
                    {globalSearchResults.length > 0 && (
                        <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto shadow-lg">
                            <CardContent className="p-2">
                                {globalSearchResults.map(student => (
                                    <div key={student.id} 
                                        className="p-2 text-sm hover:bg-accent rounded-md cursor-pointer flex justify-between items-center"
                                        onClick={() => { handleGlobalStudentClick(student); setGlobalSearchQuery(''); }}>
                                        <span>{getStudentName(student, i18n.language)} ({student.grade} {student.class})</span>
                                        {student.siblingGroupId && <Users className="w-3 h-3 text-primary" />}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
                <div className="flex justify-end mb-4 gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={handleDownloadAllStudents}><Download className="mr-2 h-4 w-4" /> 전체 학생 명단</Button>
                    <Button size="sm" variant="outline" onClick={handleDownloadRouteAssignments}><Download className="mr-2 h-4 w-4" /> 버스 배차 명단</Button>
                    <Button size="sm" variant="outline" onClick={handleDownloadStudentTemplate}><Download className="mr-2 h-4 w-4" /> {t('admin.student_management.student_template')}</Button>
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2" /> {t('batch_upload')}</Button>
                    
                    <Dialog open={isBatchQrOpen} onOpenChange={setIsBatchQrOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/10">
                                <Printer className="mr-2 h-4 w-4" /> QR 라벨 일괄 인쇄
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>QR 코드 라벨 일괄 인쇄</DialogTitle>
                                <DialogDescription>
                                    학년과 학급을 필터링하여 스티커 라벨 용지에 인쇄할 대상을 선택하세요.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4 py-4">
                                <div className="space-y-1">
                                    <Label>학년 필터</Label>
                                    <Select value={batchGrade} onValueChange={setBatchGrade}>
                                        <SelectTrigger><SelectValue placeholder="학년 선택" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">전체 학년</SelectItem>
                                            {uniqueGrades.map(g => <SelectItem key={g} value={g}>{g}학년</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label>학급 필터</Label>
                                    <Select value={batchClass} onValueChange={setBatchClass}>
                                        <SelectTrigger><SelectValue placeholder="학반 선택" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">전체 반</SelectItem>
                                            {uniqueClasses.map(c => <SelectItem key={c} value={c}>{c}반</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="bg-slate-50 border rounded-md p-4 text-center text-sm font-sans mb-4">
                                <span>선택된 학생 수: </span>
                                <span className="font-bold text-primary">{filteredBatchStudents.length}명</span>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsBatchQrOpen(false)}>닫기</Button>
                                <Button 
                                    onClick={handleBatchPrintQr}
                                    disabled={filteredBatchStudents.length === 0}
                                    className="gap-2 font-bold"
                                >
                                    <Printer className="w-4 h-4" /> 라벨 인쇄하기
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <input type="file" ref={fileInputRef as React.RefObject<HTMLInputElement>} onChange={handleStudentFileUpload} accept=".xlsx" className="hidden" />
                </div>
                <div className="mb-4">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="w-full">
                                <Trash2 className="mr-2 h-4 w-4" /> 전체 학생 명단 초기화
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>정말 모든 학생 명단을 초기화하시겠습니까?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    이 작업은 되돌릴 수 없습니다. 모든 학생 정보 및 버스 배정 내역이 영구적으로 삭제됩니다. 새 학년이 시작될 때 사용해주세요.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteAllStudents}>초기화</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
                {selectedGlobalStudent && (
                    <div className="space-y-4 p-4 border rounded-md bg-card/50">
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold">{getStudentName(selectedGlobalStudent, i18n.language)}</h4>
                                    {selectedGlobalStudent.siblingGroupId && <Badge variant="secondary" className="text-[10px] py-0 h-4"><Users className="w-2 h-2 mr-1"/>가족</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground">{selectedGlobalStudent.grade} {selectedGlobalStudent.class}</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    <Dialog open={isIndividualQrOpen} onOpenChange={setIsIndividualQrOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="link" size="sm" className="p-0 h-auto text-primary justify-start gap-1 font-semibold">
                                                <QrCode className="w-3 h-3"/>QR 코드
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[400px]">
                                            <DialogHeader>
                                                <DialogTitle>학생 QR 코드 조회</DialogTitle>
                                                <DialogDescription>
                                                    {getStudentName(selectedGlobalStudent, i18n.language)} 학생의 고유 QR 코드입니다.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border rounded-md font-sans">
                                                <img 
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${selectedGlobalStudent.id}`} 
                                                    alt="Student QR Code" 
                                                    className="w-48 h-48 border p-2 bg-white rounded-md shadow-sm mb-4"
                                                />
                                                <div className="text-sm font-bold text-slate-800">[ {selectedGlobalStudent.grade}학년 {selectedGlobalStudent.class}반 ]</div>
                                                <div className="text-base font-bold text-slate-900 mt-1">
                                                    {[selectedGlobalStudent.nameKo || '', selectedGlobalStudent.nameEn || ''].filter(Boolean).join(' / ') || selectedGlobalStudent.name}
                                                </div>
                                            </div>
                                            <DialogFooter className="grid grid-cols-3 gap-2 sm:space-x-0 w-full">
                                                <Button variant="outline" className="w-full" onClick={() => setIsIndividualQrOpen(false)}>닫기</Button>
                                                <Button variant="outline" className="w-full gap-1" onClick={() => handlePrintQr(selectedGlobalStudent)}>
                                                    <Printer className="w-3.5 h-3.5" /> 인쇄
                                                </Button>
                                                <Button className="w-full gap-1" onClick={() => handleDownloadQr(selectedGlobalStudent)}>
                                                    <Download className="w-3.5 h-3.5" /> 다운로드
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="link" size="sm" className="p-0 h-auto text-destructive justify-start">
                                                <UserX className="mr-1 w-3 h-3"/>{t('admin.student_management.search.unassign_all_button')}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>{t('admin.student_management.search.unassign_all_confirm_title')}</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    {t('admin.student_management.search.unassign_all_confirm_description', { studentName: selectedGlobalStudent.name })}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleUnassignAllFromStudent}>{t('unassign')}</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="link" size="sm" className="p-0 h-auto text-destructive justify-start">
                                                <Trash2 className="mr-1 w-3 h-3"/>신청 삭제
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>학생 신청 정보를 삭제하시겠습니까?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    {selectedGlobalStudent.name} 학생의 모든 정보와 배정 내역이 영구적으로 삭제됩니다.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDeleteSelectedStudent}>{t('delete')}</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedGlobalStudent(null)}><X className="w-4 h-4"/></Button>
                        </div>
                        
                        <Button size="sm" className="w-full" onClick={handleAssignStudentFromSearch}>이 버스에 배정</Button>
                        
                        <div className="flex justify-between items-center">
                            <Label className="text-xs">{t('student.name')}</Label>
                            <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 text-[10px]"
                                onClick={toggleNameEdit}
                            >
                                {isEditingName ? <><Check className="h-3 w-3 mr-1" /> 저장</> : <><Pencil className="h-3 w-3 mr-1" /> 수정</>}
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">한글</Label>
                                <Input
                                    value={selectedGlobalStudent.nameKo || ''}
                                    onChange={(e) => setSelectedGlobalStudent(s => s ? {...s, nameKo: e.target.value} : null)}
                                    placeholder="한글 이름"
                                    disabled={!isEditingName}
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">English</Label>
                                <Input
                                    value={selectedGlobalStudent.nameEn || ''}
                                    onChange={(e) => setSelectedGlobalStudent(s => s ? {...s, nameEn: e.target.value} : null)}
                                    placeholder="English Name"
                                    disabled={!isEditingName}
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-2">
                                <Label className="text-xs">{t('student.grade')}</Label>
                                <Input
                                    value={selectedGlobalStudent.grade || ''}
                                    onChange={(e) => setSelectedGlobalStudent(s => s ? {...s, grade: e.target.value} : null)}
                                    onBlur={(e) => handleStudentInfoChange(selectedGlobalStudent.id, 'grade', e.target.value)}
                                    placeholder="예: 1"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">{t('student.class')}</Label>
                                <Input
                                    value={selectedGlobalStudent.class || ''}
                                    onChange={(e) => setSelectedGlobalStudent(s => s ? {...s, class: e.target.value} : null)}
                                    onBlur={(e) => handleStudentInfoChange(selectedGlobalStudent.id, 'class', e.target.value)}
                                    placeholder="예: 1"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">출석번호</Label>
                                <Input
                                    value={selectedGlobalStudent.number || ''}
                                    onChange={(e) => setSelectedGlobalStudent(s => s ? {...s, number: e.target.value} : null)}
                                    onBlur={(e) => handleStudentInfoChange(selectedGlobalStudent.id, 'number', e.target.value)}
                                    placeholder="예: 15"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">{t('student.contact')}</Label>
                            <Input
                                value={selectedGlobalStudent.contact || ''}
                                onChange={(e) => setSelectedGlobalStudent(s => s ? {...s, contact: e.target.value} : null)}
                                onBlur={(e) => handleStudentInfoChange(selectedGlobalStudent.id, 'contact', e.target.value)}
                                placeholder="베트남 전화번호 입력"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">{t('student.gender')}</Label>
                            <Select 
                                value={selectedGlobalStudent.gender} 
                                onValueChange={(v) => handleStudentInfoChange(selectedGlobalStudent.id, 'gender', v)}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='Male'>{t('student.male')}</SelectItem>
                                    <SelectItem value='Female'>{t('student.female')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Separator className="my-2" />
                        
                        <div className="space-y-2">
                            <Label className="text-xs flex items-center gap-1"><Users className="w-3 h-3"/>형제/자매 관리</Label>
                            <div className="space-y-1">
                                {currentSiblings.map(sib => (
                                    <div key={sib.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-xs">
                                        <span>{getStudentName(sib, i18n.language)} ({sib.grade} {sib.class})</span>
                                        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleRemoveSibling(sib.id)}>
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))}
                                <div className="relative mt-2">
                                    <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                                    <Input
                                        placeholder="연결할 형제 검색..."
                                        className="pl-7 h-8 text-xs"
                                        value={siblingSearchQuery}
                                        onChange={(e) => setSiblingSearchQuery(e.target.value)}
                                    />
                                    {siblingSearchResults.length > 0 && (
                                        <Card className="absolute z-20 w-full mt-1 shadow-lg">
                                            <CardContent className="p-1">
                                                {siblingSearchResults.map(s => (
                                                    <div key={s.id} 
                                                        className="p-2 text-xs hover:bg-accent rounded-md cursor-pointer flex justify-between items-center"
                                                        onClick={() => handleAddSibling(s)}>
                                                        <span>{getStudentName(s, i18n.language)} ({s.grade} {s.class})</span>
                                                        <UserPlus className="w-3 h-3 text-primary" />
                                                    </div>
                                                ))}
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Separator className="my-2" />

                        <div className="space-y-2">
                            <Label className="text-xs">{t('student.morning_destination')}</Label>
                            {selectedGlobalStudent.suggestedMorningDestination && (
                                <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-md mb-1 animate-in fade-in slide-in-from-left-1">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-amber-600 font-bold uppercase">{t('admin.student_management.search.suggested_label')}</span>
                                        <span className="text-xs font-semibold text-amber-900">{selectedGlobalStudent.suggestedMorningDestination}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-7 text-[10px] bg-white hover:bg-amber-100 border-amber-300 text-amber-700"
                                            onClick={() => handleApproveStudentDestination(selectedGlobalStudent.id, selectedGlobalStudent.suggestedMorningDestination!, 'morning')}
                                        >
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> {t('admin.student_management.search.approve_suggestion')}
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-7 w-7 p-0 text-amber-600 hover:text-destructive hover:bg-amber-100"
                                            onClick={() => handleRejectStudentDestination(selectedGlobalStudent.id, 'morning')}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                            <Select 
                                value={selectedGlobalStudent.morningDestinationId || '_NONE_'} 
                                onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'morning')}
                            >
                                <SelectTrigger><SelectValue placeholder={t('no_destination')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='_NONE_'>{t('no_selection')}</SelectItem>
                                    {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">{t('student.afternoon_destination')}</Label>
                            {selectedGlobalStudent.suggestedAfternoonDestination && (
                                <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-md mb-1 animate-in fade-in slide-in-from-left-1">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-amber-600 font-bold uppercase">{t('admin.student_management.search.suggested_label')}</span>
                                        <span className="text-xs font-semibold text-amber-900">{selectedGlobalStudent.suggestedAfternoonDestination}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-7 text-[10px] bg-white hover:bg-amber-100 border-amber-300 text-amber-700"
                                            onClick={() => handleApproveStudentDestination(selectedGlobalStudent.id, selectedGlobalStudent.suggestedAfternoonDestination!, 'afternoon')}
                                        >
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> {t('admin.student_management.search.approve_suggestion')}
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-7 w-7 p-0 text-amber-600 hover:text-destructive hover:bg-amber-100"
                                            onClick={() => handleRejectStudentDestination(selectedGlobalStudent.id, 'afternoon')}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                            <Select 
                                value={selectedGlobalStudent.afternoonDestinationId || '_NONE_'} 
                                onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'afternoon')}
                            >
                                <SelectTrigger><SelectValue placeholder={t('no_destination')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='_NONE_'>{t('no_selection')}</SelectItem>
                                    {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <Separator className="my-2" />

                        <div className="space-y-2">
                            <Label className="text-xs">{t('student.sat_morning_destination')}</Label>
                            {selectedGlobalStudent.suggestedSatMorningDestination && (
                                <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-md mb-1 animate-in fade-in slide-in-from-left-1">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-amber-600 font-bold uppercase">{t('admin.student_management.search.suggested_label')}</span>
                                        <span className="text-xs font-semibold text-amber-900">{selectedGlobalStudent.suggestedSatMorningDestination}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-7 text-[10px] bg-white hover:bg-amber-100 border-amber-300 text-amber-700"
                                            onClick={() => handleApproveStudentDestination(selectedGlobalStudent.id, selectedGlobalStudent.suggestedSatMorningDestination!, 'satMorning')}
                                        >
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> {t('admin.student_management.search.approve_suggestion')}
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-7 w-7 p-0 text-amber-600 hover:text-destructive hover:bg-amber-100"
                                            onClick={() => handleRejectStudentDestination(selectedGlobalStudent.id, 'satMorning')}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                            <Select 
                                value={selectedGlobalStudent.satMorningDestinationId || '_NONE_'} 
                                onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'satMorning')}
                            >
                                <SelectTrigger><SelectValue placeholder={t('no_destination')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='_NONE_'>{t('no_selection')}</SelectItem>
                                    {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">{t('student.sat_afternoon_destination')}</Label>
                            {selectedGlobalStudent.suggestedSatAfternoonDestination && (
                                <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-md mb-1 animate-in fade-in slide-in-from-left-1">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-amber-600 font-bold uppercase">{t('admin.student_management.search.suggested_label')}</span>
                                        <span className="text-xs font-semibold text-amber-900">{selectedGlobalStudent.suggestedSatAfternoonDestination}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-7 text-[10px] bg-white hover:bg-amber-100 border-amber-300 text-amber-700"
                                            onClick={() => handleApproveStudentDestination(selectedGlobalStudent.id, selectedGlobalStudent.suggestedSatAfternoonDestination!, 'satAfternoon')}
                                        >
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> {t('admin.student_management.search.approve_suggestion')}
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-7 w-7 p-0 text-amber-600 hover:text-destructive hover:bg-amber-100"
                                            onClick={() => handleRejectStudentDestination(selectedGlobalStudent.id, 'satAfternoon')}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                            <Select 
                                value={selectedGlobalStudent.satAfternoonDestinationId || '_NONE_'} 
                                onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'satAfternoon')}
                            >
                                <SelectTrigger><SelectValue placeholder={t('no_destination')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='_NONE_'>{t('no_selection')}</SelectItem>
                                    {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <Separator className="my-2" />

                        {/* 방과후 정보 섹션 */}
                        {(() => {
                            const enrolledClasses = afterSchoolClasses.filter(c => {
                                const isTargetSemester = (c.semesterMode || 'regular') === semesterMode;
                                if (!isTargetSemester) return false;
                                
                                // 방학 모드일 때는 양쪽 필드 모두 검색하여 매핑되어 있는지 확인 (호환성)
                                if (semesterMode === 'vacation') {
                                    const vacIds = Object.values(selectedGlobalStudent.vacationAfterSchoolClassIds || {});
                                    const regIds = Object.values(selectedGlobalStudent.afterSchoolClassIds || {});
                                    return vacIds.includes(c.id) || regIds.includes(c.id);
                                }
                                
                                const regIds = Object.values(selectedGlobalStudent.afterSchoolClassIds || {});
                                return regIds.includes(c.id);
                            });
                            // Deduplicate by name for vacation mode, plus fallback from student profile
                            const directTitles = (selectedGlobalStudent as any).enrolledCourseTitles || (selectedGlobalStudent as any).afterSchoolCourseTitles || [];
                            const singleTitle = (selectedGlobalStudent as any).afterSchoolCourseTitle ? [(selectedGlobalStudent as any).afterSchoolCourseTitle] : [];
                            const uniqueClassNames = Array.from(new Set([...enrolledClasses.map(c => c.name), ...directTitles, ...singleTitle].filter(Boolean)));

                            return (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between flex-wrap gap-1">
                                        <Label className="text-xs flex items-center gap-1 font-bold">
                                            <GraduationCap className="w-3.5 h-3.5 text-indigo-600"/>
                                            방과후 등록 수업
                                        </Label>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {onRevertToAfternoonRoute && (
                                                <Button 
                                                    type="button"
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-6 text-[10px] px-2 gap-1 border-sky-300 text-sky-700 hover:bg-sky-50 font-bold cursor-pointer"
                                                    title="방과후를 취소한 학생을 방과후 노선에서 제외하고 정규 하교 노선으로 복귀시킵니다."
                                                    onClick={async () => {
                                                        if (confirm(`${getStudentName(selectedGlobalStudent, i18n.language)} 학생의 방과후 노선 배정을 취소하고 정규 하교 노선으로 복귀시키겠습니까?`)) {
                                                            await onRevertToAfternoonRoute(selectedGlobalStudent.id);
                                                        }
                                                    }}
                                                >
                                                    하교 노선으로 복귀
                                                </Button>
                                            )}
                                            {onAddStudentToClass && (
                                                <Dialog open={isAddToClassDialogOpen} onOpenChange={setIsAddToClassDialogOpen}>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1">
                                                        <UserPlus className="w-3 h-3" />
                                                        명단에 넣기
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-[400px]">
                                                    <DialogHeader>
                                                        <DialogTitle>방과후 수업 명단에 추가</DialogTitle>
                                                        <DialogDescription>
                                                            {getStudentName(selectedGlobalStudent, i18n.language)} 학생을 추가할 방과후 수업을 선택하세요.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="py-4">
                                                        <Select value={selectedClassIdToAdd} onValueChange={setSelectedClassIdToAdd}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="수업 선택..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="max-h-60">
                                                                {(() => {
                                                                    const vacIds = Object.values(selectedGlobalStudent.vacationAfterSchoolClassIds || {});
                                                                    const regIds = Object.values(selectedGlobalStudent.afterSchoolClassIds || {});
                                                                    const enrolledIds = [...vacIds, ...regIds];
                                                                    
                                                                    const availableClasses = afterSchoolClasses.filter(c => 
                                                                        (c.semesterMode || 'regular') === semesterMode &&
                                                                        !enrolledIds.includes(c.id)
                                                                    );
                                                                    // Vacation mode: deduplicate by name
                                                                    if (semesterMode === 'vacation') {
                                                                        const seen = new Set<string>();
                                                                        return availableClasses
                                                                            .filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; })
                                                                            .map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>);
                                                                    }
                                                                    return availableClasses.map(c => (
                                                                        <SelectItem key={c.id} value={c.id}>
                                                                            {t(`day_short.${c.dayOfWeek.toLowerCase()}`)} - {c.name}
                                                                        </SelectItem>
                                                                    ));
                                                                })()}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <DialogFooter>
                                                        <Button variant="outline" onClick={() => setIsAddToClassDialogOpen(false)}>취소</Button>
                                                        <Button 
                                                            disabled={!selectedClassIdToAdd}
                                                            onClick={async () => {
                                                                if (!selectedClassIdToAdd || !onAddStudentToClass) return;
                                                                await onAddStudentToClass(selectedGlobalStudent.id, selectedClassIdToAdd);
                                                                setIsAddToClassDialogOpen(false);
                                                                setSelectedClassIdToAdd('');
                                                            }}
                                                        >
                                                            추가
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                        </div>
                                    </div>
                                    {uniqueClassNames.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {uniqueClassNames.map(name => (
                                                <Badge key={name} variant="secondary" className="text-[10px] py-0.5 px-2 gap-1 flex items-center">
                                                    <GraduationCap className="w-2.5 h-2.5" />
                                                    <span>{name}</span>
                                                    {onRemoveStudentFromClass && (
                                                        <button
                                                            type="button"
                                                            className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors focus:outline-none cursor-pointer"
                                                            title="수업 명단에서 제외"
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (confirm(`'${name}' 수업 명단에서 제외하시겠습니까?`)) {
                                                                    await onRemoveStudentFromClass(selectedGlobalStudent.id, name);
                                                                }
                                                            }}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-muted-foreground">등록된 방과후 수업 없음</p>
                                    )}
                                </div>
                            );
                        })()}

                        <Separator className="my-2" />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold">{t('student.after_school_destination')}</Label>
                                {onRevertToAfternoonRoute && (
                                    <Button 
                                        type="button"
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-5 text-[10px] px-1.5 text-sky-700 hover:bg-sky-50 font-semibold cursor-pointer"
                                        onClick={async () => {
                                            if (confirm(`모든 요일의 방과후 목적지를 초기화하고 정규 하교 노선으로 복귀시키겠습니까?`)) {
                                                await onRevertToAfternoonRoute(selectedGlobalStudent.id);
                                            }
                                        }}
                                    >
                                        방과후 목적지 초기화 및 하교 복귀
                                    </Button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {dayOrder.filter(d => d !== 'Saturday').map(day => (
                                    <div key={day} className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">{t(`day_short.${day.toLowerCase()}`)}</Label>
                                        <Select 
                                            value={(semesterMode === 'vacation' 
                                                ? (selectedGlobalStudent.vacationAfterSchoolDestinations?.[day] || selectedGlobalStudent.afterSchoolDestinations?.[day])
                                                : selectedGlobalStudent.afterSchoolDestinations?.[day]
                                            ) || '_NONE_'} 
                                            onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'afterSchool', day)}
                                        >
                                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="-" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='_NONE_'>-</SelectItem>
                                                {destinations.map(d => <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                        </div>

                         <div>
                            <Label className="text-xs">{t('admin.student_management.search.assigned_routes')}</Label>
                            <div className="space-y-2 mt-1 border rounded-md p-2 max-h-40 overflow-y-auto">
                                {assignedRoutesForSelectedStudent.length > 0 ? (
                                    assignedRoutesForSelectedStudent.map(route => {
                                        const busName = buses.find(b => b.id === route.busId)?.name || t('unknown_bus');
                                        const routeTypeName = route.type === 'AfterSchool' ? t('route_type.after_school') : t(`route_type.${route.type.toLowerCase()}`);
                                        
                                        let destId: string | null = null;
                                        if (route.dayOfWeek === 'Saturday') {
                                            destId = route.type === 'Morning' ? selectedGlobalStudent.satMorningDestinationId : selectedGlobalStudent.satAfternoonDestinationId;
                                        } else {
                                            if (route.type === 'Morning') destId = selectedGlobalStudent.morningDestinationId;
                                            else if (route.type === 'Afternoon') destId = selectedGlobalStudent.afternoonDestinationId;
                                            else {
                                                destId = (semesterMode === 'vacation'
                                                    ? (selectedGlobalStudent.vacationAfterSchoolDestinations?.[route.dayOfWeek] || selectedGlobalStudent.afterSchoolDestinations?.[route.dayOfWeek])
                                                    : selectedGlobalStudent.afterSchoolDestinations?.[route.dayOfWeek]
                                                ) || null;
                                            }
                                        }
                                        const destName = destinations.find(d => d.id === destId)?.name || t('unassigned');

                                        return (
                                            <div key={route.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                                <div className="flex flex-col gap-0.5">
                                                    <p className="text-[10px] font-bold">{busName} - {t(`day_short.${route.dayOfWeek.toLowerCase()}`)} {routeTypeName}</p>
                                                    <p className="text-[9px] text-muted-foreground">{t('destination')}: {destName}</p>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleUnassignStudentFromRoute(route.id, selectedGlobalStudent.id)}>
                                                    <UserX className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <p className="text-[10px] text-muted-foreground p-2">{t('admin.student_management.search.no_assigned_routes')}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
