'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Download, Upload, Trash2, UserX, Users, UserPlus, X, Pencil, Check, CheckCircle2, QrCode, Printer, GraduationCap, Bus as BusIcon, Plus, Percent, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslation } from '@/hooks/use-translation';
import type { Student, Destination, Bus, Route, DayOfWeek, RouteType, AfterSchoolClass } from '@/lib/kisbus/types';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn, normalizeString, getStudentName } from '@/lib/kisbus/utils';
import { updateStudent, addDestination, deleteStudentsInBatch, updateRouteSeating } from '@/lib/kisbus';
import { useToast } from '@/hooks/use-toast';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { StudentDetailDialog } from './student-detail-dialog';


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
    selectedBusId?: string | null;
    onSelectBusId?: (busId: string | null) => void;
    selectedDay?: DayOfWeek;
    onSeatClick?: (seatNumber: number, studentId: string | null) => void;
    isStudentRosterOpen?: boolean;
    setIsStudentRosterOpen?: (open: boolean) => void;
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
    onRevertToAfternoonRoute,
    selectedBusId,
    onSelectBusId,
    selectedDay = 'Monday',
    onSeatClick,
    isStudentRosterOpen = false,
    setIsStudentRosterOpen,
}: StudentGlobalSearchPanelProps) => {
    const { t, i18n } = useTranslation();
    const { toast } = useToast();
    const [siblingSearchQuery, setSiblingSearchQuery] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [editingNameInput, setEditingNameInput] = useState('');
    const [isAddToClassDialogOpen, setIsAddToClassDialogOpen] = useState(false);
    const [selectedClassIdToAdd, setSelectedClassIdToAdd] = useState<string>('');

    const [batchGrade, setBatchGrade] = useState('all');
    const [batchClass, setBatchClass] = useState('all');
    const [isBatchQrOpen, setIsBatchQrOpen] = useState(false);
    const [isIndividualQrOpen, setIsIndividualQrOpen] = useState(false);

    // 요일별 예비 목적지 추가 폼 상태
    const [isAddingCustomDest, setIsAddingCustomDest] = useState(false);
    const [newCustomDestDay, setNewCustomDestDay] = useState<DayOfWeek>('Wednesday');
    const [newCustomDestId, setNewCustomDestId] = useState<string>('');

    // 좌석 배정 팝업 모달 상태
    const [isAssignSeatModalOpen, setIsAssignSeatModalOpen] = useState(false);
    const [assignTargetDay, setAssignTargetDay] = useState<DayOfWeek>(selectedDay);
    const [assignTargetRouteType, setAssignTargetRouteType] = useState<RouteType>(selectedRouteType);
    const [assignTargetBusId, setAssignTargetBusId] = useState<string>('');
    const [assignSelectedSeatNumber, setAssignSelectedSeatNumber] = useState<number | null>(null);
    const [isAssigningSeat, setIsAssigningSeat] = useState(false);

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

    // 현재 요일/경로에서 학생이 배정된 노선 및 좌석 찾기
    const currentAssignedRoute = useMemo(() => {
        if (!selectedGlobalStudent) return null;
        return routes.find(r => 
            r.dayOfWeek === selectedDay && 
            r.type === selectedRouteType && 
            r.seating.some(s => s.studentId === selectedGlobalStudent.id)
        ) || null;
    }, [selectedGlobalStudent, routes, selectedDay, selectedRouteType]);

    const currentAssignedBus = useMemo(() => {
        if (!currentAssignedRoute) return null;
        return buses.find(b => b.id === currentAssignedRoute.busId) || null;
    }, [currentAssignedRoute, buses]);

    const studentSeatNumber = useMemo(() => {
        if (!currentAssignedRoute || !selectedGlobalStudent) return null;
        const seat = currentAssignedRoute.seating.find(s => s.studentId === selectedGlobalStudent.id);
        return seat?.seatNumber ?? null;
    }, [currentAssignedRoute, selectedGlobalStudent]);

    // 학생 선택 시, 해당 학생이 배정된 버스가 있고 메인 화면의 선택 버스와 다르면 자동으로 해당 버스로 전환
    useEffect(() => {
        if (currentAssignedBus && onSelectBusId && selectedBusId !== currentAssignedBus.id) {
            onSelectBusId(currentAssignedBus.id);
        }
    }, [currentAssignedBus, onSelectBusId, selectedBusId]);

    const WEEKDAYS: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);

    const weeklyAssignedRoutes = useMemo(() => {
        if (!selectedGlobalStudent) return [];

        return WEEKDAYS.map(day => {
            const morningRoute = routes.find(r => r.dayOfWeek === day && r.type === 'Morning' && r.seating.some(s => s.studentId === selectedGlobalStudent.id));
            const afternoonRoute = routes.find(r => r.dayOfWeek === day && r.type === 'Afternoon' && r.seating.some(s => s.studentId === selectedGlobalStudent.id));
            const afterSchoolRoute = routes.find(r => r.dayOfWeek === day && r.type === 'AfterSchool' && r.seating.some(s => s.studentId === selectedGlobalStudent.id));

            // 해당 요일 방과후 강좌 정보 추출
            const dayCourseObj = selectedGlobalStudent.afterSchoolCoursesByDay?.[day];
            let dayCourseTitle = dayCourseObj?.title || '';
            let dayInstructors = (dayCourseObj as any)?.teachersText || (dayCourseObj as any)?.instructorName || (dayCourseObj as any)?.instructors || '';

            if (!dayCourseTitle && selectedGlobalStudent.afterSchoolClassIds?.[day]) {
                const cId = selectedGlobalStudent.afterSchoolClassIds[day];
                const matchedClass = afterSchoolClasses.find(c => c.id === cId);
                if (matchedClass) {
                    dayCourseTitle = matchedClass.name || '';
                    dayInstructors = matchedClass.teacherName || '';
                }
            }

            const getSlotInfo = (r?: Route, type?: 'morning' | 'afternoon' | 'afterSchool') => {
                if (!r) return null;
                const bus = buses.find(b => b.id === r.busId);
                const busName = bus?.name || r.busId;
                let destId: string | null = null;
                if (type === 'morning') destId = selectedGlobalStudent.morningDestinationId || null;
                else if (type === 'afternoon') destId = selectedGlobalStudent.afternoonDestinationId || null;
                else if (type === 'afterSchool') {
                    const destMap = semesterMode === 'vacation' 
                        ? (selectedGlobalStudent.vacationAfterSchoolDestinations || {})
                        : (selectedGlobalStudent.afterSchoolDestinations || {});
                    destId = (destMap as Record<string, string>)[day] || null;
                }
                const dest = destinations.find(d => d.id === destId);
                return {
                    routeId: r.id,
                    busName,
                    destName: dest?.name || ''
                };
            };

            const morning = getSlotInfo(morningRoute, 'morning');
            const afternoon = getSlotInfo(afternoonRoute, 'afternoon');
            const afterSchool = getSlotInfo(afterSchoolRoute, 'afterSchool');

            return {
                day,
                hasAny: !!(morning || afternoon || afterSchool || dayCourseTitle),
                hasAfterSchoolCourse: !!dayCourseTitle,
                dayCourseTitle,
                dayInstructors,
                morning,
                afternoon,
                afterSchool
            };
        }).filter(item => item.day !== 'Saturday' || item.hasAny);
    }, [selectedGlobalStudent, routes, buses, destinations, afterSchoolClasses, semesterMode, WEEKDAYS]);

    // 학생에게 등록된 특정 요일 예비 목적지 추출 (평일 하교 기본 목적지와 다른 예외 목적지만)
    const registeredCustomDestinations = useMemo(() => {
        if (!selectedGlobalStudent) return [];
        const items: { day: DayOfWeek; destId: string; destName: string; type: 'afterSchool' | 'satAfternoon' }[] = [];
        const destMap = semesterMode === 'vacation'
            ? (selectedGlobalStudent.vacationAfterSchoolDestinations || {})
            : (selectedGlobalStudent.afterSchoolDestinations || {});

        const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        weekdays.forEach(day => {
            const dId = destMap[day];
            if (dId && dId !== '-' && dId !== '미신청' && dId !== 'UNSPECIFIED' && dId !== selectedGlobalStudent.afternoonDestinationId) {
                const destObj = destinations.find(d => d.id === dId);
                items.push({
                    day,
                    destId: dId,
                    destName: destObj?.name || dId,
                    type: 'afterSchool'
                });
            }
        });

        if (selectedGlobalStudent.satAfternoonDestinationId && selectedGlobalStudent.satAfternoonDestinationId !== selectedGlobalStudent.afternoonDestinationId) {
            const destObj = destinations.find(d => d.id === selectedGlobalStudent.satAfternoonDestinationId);
            items.push({
                day: 'Saturday',
                destId: selectedGlobalStudent.satAfternoonDestinationId,
                destName: destObj?.name || selectedGlobalStudent.satAfternoonDestinationId,
                type: 'satAfternoon'
            });
        }

        return items;
    }, [selectedGlobalStudent, destinations, semesterMode]);

    // 좌석 배정 모달: 선택된 요일/경로의 운행 노선 및 버스 목록
    const operationalRoutesForModal = useMemo(() => {
        return routes.filter(r => r.dayOfWeek === assignTargetDay && r.type === assignTargetRouteType);
    }, [routes, assignTargetDay, assignTargetRouteType]);

    const availableBusesForModal = useMemo(() => {
        const busIds = new Set(operationalRoutesForModal.map(r => r.busId));
        return buses.filter(b => busIds.has(b.id)).sort((a, b) => {
            const numA = parseInt(a.name.replace(/\D/g, ''), 10) || 0;
            const numB = parseInt(b.name.replace(/\D/g, ''), 10) || 0;
            return numA - numB;
        });
    }, [operationalRoutesForModal, buses]);

    useEffect(() => {
        if (availableBusesForModal.length > 0) {
            if (!assignTargetBusId || !availableBusesForModal.some(b => b.id === assignTargetBusId)) {
                setAssignTargetBusId(availableBusesForModal[0].id);
            }
        } else {
            setAssignTargetBusId('');
        }
        setAssignSelectedSeatNumber(null);
    }, [availableBusesForModal]);

    const modalSelectedBus = useMemo(() => {
        return buses.find(b => b.id === assignTargetBusId) || null;
    }, [buses, assignTargetBusId]);

    const modalCurrentRoute = useMemo(() => {
        if (!assignTargetBusId) return null;
        return operationalRoutesForModal.find(r => r.busId === assignTargetBusId) || null;
    }, [operationalRoutesForModal, assignTargetBusId]);

    const handleModalSeatClick = (seatNumber: number, currentStudentId: string | null) => {
        if (currentStudentId && currentStudentId !== selectedGlobalStudent?.id) {
            const seatedStudent = students.find(s => s.id === currentStudentId);
            toast({
                title: "이미 배정된 좌석",
                description: `${seatedStudent ? getStudentName(seatedStudent, i18n.language) : '다른 학생'}이(가) 배정되어 있습니다. 빈자리를 선택하세요.`,
                variant: "destructive"
            });
            return;
        }
        setAssignSelectedSeatNumber(seatNumber);
    };

    const handleExecuteAssignSeatFromModal = async () => {
        if (!selectedGlobalStudent || !modalCurrentRoute || !assignSelectedSeatNumber) return;
        setIsAssigningSeat(true);
        try {
            const currentSeating = [...modalCurrentRoute.seating];
            const nextSeating = currentSeating.map(seat => {
                if (seat.studentId === selectedGlobalStudent.id) {
                    return { ...seat, studentId: null };
                }
                if (seat.seatNumber === assignSelectedSeatNumber) {
                    return { ...seat, studentId: selectedGlobalStudent.id };
                }
                return seat;
            });

            if (!nextSeating.some(s => s.seatNumber === assignSelectedSeatNumber)) {
                nextSeating.push({ seatNumber: assignSelectedSeatNumber, studentId: selectedGlobalStudent.id });
            }

            await updateRouteSeating(modalCurrentRoute.id, nextSeating);
            toast({
                title: "좌석 배정 완료",
                description: `${getStudentName(selectedGlobalStudent, i18n.language)} 학생이 ${modalSelectedBus?.name || ''} ${assignSelectedSeatNumber}번 좌석에 배정되었습니다.`
            });
            setIsAssignSeatModalOpen(false);
            setAssignSelectedSeatNumber(null);
        } catch (err) {
            toast({ title: "좌석 배정 오류", description: "배정 처리 중 문제가 발생했습니다.", variant: "destructive" });
        } finally {
            setIsAssigningSeat(false);
        }
    };

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

    // 형제자매 그룹 전체(현재 학생 포함) 및 할인 순위 계산
    // 규칙: 최고학년(첫째) = 원금, 이후 학생은 2번째, 3번째... 할인 적용
    const siblingFamilyGroup = useMemo(() => {
        if (!selectedGlobalStudent || !selectedGlobalStudent.siblingGroupId) return [];
        const gradeToNum = (g: string) => {
            const n = parseInt((g || '').replace(/\D/g, ''), 10);
            return isNaN(n) ? 0 : n;
        };
        const allMembers = students.filter(s => s.siblingGroupId === selectedGlobalStudent.siblingGroupId);
        // 학년 내림차순(최고학년 → 낮은학년) 정렬
        const sorted = [...allMembers].sort((a, b) => gradeToNum(b.grade) - gradeToNum(a.grade));
        return sorted.map((s, idx) => ({
            student: s,
            rank: idx + 1, // 1 = 첫째 (원금), 2+ = 할인
            isFullPrice: idx === 0,
            isCurrent: s.id === selectedGlobalStudent.id,
        }));
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

    const handleIndividualPrintQr = () => {
        if (!selectedGlobalStudent) return;
        const printArea = document.getElementById('individual-qr-print-area');
        if (!printArea) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast({ title: t('error'), description: "팝업 차단이 활성화되어 있어 인쇄 창을 열 수 없습니다.", variant: 'destructive' });
            return;
        }
        printWindow.document.write(`<html><head><title>QR 인쇄</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;height:100vh;}</style></head><body>${printArea.innerHTML}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
    };

    return (
        <>
            {/* ─── 학생명단 관리 Dialog ─── */}
            <Dialog open={isStudentRosterOpen} onOpenChange={(open) => setIsStudentRosterOpen?.(open)}>
                <DialogContent className="sm:max-w-[540px] max-h-[80vh] overflow-y-auto overscroll-contain">
                    <DialogHeader>
                        <DialogTitle className="font-headline">{t('admin.student_management.search.title')}</DialogTitle>
                        <DialogDescription>{t('admin.student_management.search.description')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="flex flex-col gap-2">
                            <Button size="sm" variant="outline" onClick={handleDownloadAllStudents}><Download className="mr-2 h-4 w-4" /> 전체 학생 명단 다운로드</Button>
                            <Button size="sm" variant="outline" onClick={handleDownloadRouteAssignments}><Download className="mr-2 h-4 w-4" /> 버스 배차 명단 다운로드</Button>
                            <Button size="sm" variant="outline" onClick={handleDownloadStudentTemplate}><Download className="mr-2 h-4 w-4" /> {t('admin.student_management.student_template')}</Button>
                            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> {t('batch_upload')}</Button>
                            <input type="file" ref={fileInputRef as React.RefObject<HTMLInputElement>} onChange={handleStudentFileUpload} accept=".xlsx" className="hidden" />

                            {/* QR 라벨 일괄 인쇄 */}
                            <Dialog open={isBatchQrOpen} onOpenChange={setIsBatchQrOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/10">
                                        <Printer className="mr-2 h-4 w-4" /> QR 라벨 일괄 인쇄
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[500px]">
                                    <DialogHeader>
                                        <DialogTitle>QR 코드 라벨 일괄 인쇄</DialogTitle>
                                        <DialogDescription>학년과 학급을 필터링하여 스티커 라벨 용지에 인쇄할 대상을 선택하세요.</DialogDescription>
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
                                        <Button onClick={handleBatchPrintQr} disabled={filteredBatchStudents.length === 0} className="gap-2 font-bold">
                                            <Printer className="w-4 h-4" /> 라벨 인쇄하기
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                        {/* 전체 학생 명단 초기화 */}
                        <div className="pt-2 border-t">
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
                    </div>
                </DialogContent>
            </Dialog>

            {/* ─── 학생 상세 카드 Dialog (완전 격리 컴포넌트: 타이핑 시 부모 리렌더링 원천 차단) ─── */}
            {selectedGlobalStudent && (
                <StudentDetailDialog
                    student={selectedGlobalStudent}
                    onClose={() => setSelectedGlobalStudent(null)}
                    destinations={destinations}
                    buses={buses}
                    routes={routes}
                    allStudents={students}
                    dayOrder={dayOrder}
                    afterSchoolClasses={afterSchoolClasses}
                    semesterMode={semesterMode}
                    assignedRoutes={assignedRoutesForSelectedStudent}
                    onSaveSuccess={(updates) => {
                        setSelectedGlobalStudent(prev => prev && prev.id === selectedGlobalStudent.id ? { ...prev, ...updates } : prev);
                    }}
                    handleUnassignStudentFromRoute={handleUnassignStudentFromRoute}
                    handleUnassignAllFromStudent={handleUnassignAllFromStudent}
                    handleDestinationChange={handleDestinationChange}
                    handleStudentInfoChange={handleStudentInfoChange}
                    onOpenAssignSeat={(day, routeType) => {
                        setAssignTargetDay(day);
                        setAssignTargetRouteType(routeType);
                        setAssignSelectedSeatNumber(null);
                        setIsAssignSeatModalOpen(true);
                    }}
                    selectedDay={selectedDay}
                    selectedRouteType={selectedRouteType}
                />
            )}

            {/* ─── 좌석 배정 직관 팝업 모달 (AssignSeatDialog) ─── */}
            <Dialog open={isAssignSeatModalOpen} onOpenChange={setIsAssignSeatModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overscroll-contain">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                            <BusIcon className="h-5 w-5 text-blue-600" />
                            <span>{t('admin.bus_assignment.modal_title', '버스 좌석 배정')}</span>
                            {selectedGlobalStudent && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-800 border-blue-200">
                                    {getStudentName(selectedGlobalStudent, i18n.language)} [{selectedGlobalStudent.grade}-{selectedGlobalStudent.class}]
                                </Badge>
                            )}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            {t('admin.bus_assignment.modal_desc', '요일, 경로 및 버스를 선택한 후 좌석표에서 빈자리를 클릭하여 학생을 배정하세요.')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* 상단 컨트롤: 요일, 경로, 버스 선택 */}
                        <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            {/* 1. 요일 선택 */}
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-slate-700">{t('day', '요일')}</Label>
                                <Select value={assignTargetDay} onValueChange={(val) => setAssignTargetDay(val as DayOfWeek)}>
                                    <SelectTrigger className="h-9 text-xs bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Monday">{t('day.monday', '월요일')}</SelectItem>
                                        <SelectItem value="Tuesday">{t('day.tuesday', '화요일')}</SelectItem>
                                        <SelectItem value="Wednesday">{t('day.wednesday', '수요일')}</SelectItem>
                                        <SelectItem value="Thursday">{t('day.thursday', '목요일')}</SelectItem>
                                        <SelectItem value="Friday">{t('day.friday', '금요일')}</SelectItem>
                                        <SelectItem value="Saturday">{t('day.saturday', '토요일')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* 2. 경로 선택 */}
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-slate-700">{t('route_type', '경로')}</Label>
                                <Select value={assignTargetRouteType} onValueChange={(val) => setAssignTargetRouteType(val as RouteType)}>
                                    <SelectTrigger className="h-9 text-xs bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Morning">{t('route_type.morning', '등교')}</SelectItem>
                                        <SelectItem value="Afternoon">{t('route_type.afternoon', '하교')}</SelectItem>
                                        <SelectItem value="AfterSchool">{t('route_type.after_school', '방과후')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* 3. 버스 선택 */}
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-slate-700">{t('bus', '버스')}</Label>
                                <Select value={assignTargetBusId} onValueChange={setAssignTargetBusId} disabled={availableBusesForModal.length === 0}>
                                    <SelectTrigger className="h-9 text-xs bg-white">
                                        <SelectValue placeholder={availableBusesForModal.length === 0 ? t('no_operational_bus', '운행 버스 없음') : t('select_bus', '버스 선택')} />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-52 overflow-y-auto">
                                        {availableBusesForModal.map(b => (
                                            <SelectItem key={b.id} value={b.id}>
                                                {b.name} ({b.capacity}인승)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* 좌석표 렌더링 영역 */}
                        {modalSelectedBus && modalCurrentRoute ? (
                            <div className="border rounded-lg p-3 bg-white space-y-3">
                                <div className="flex items-center justify-between text-xs text-slate-600 border-b pb-2">
                                    <div className="font-semibold text-slate-800">
                                        {modalSelectedBus.name} {t('seat_map', '좌석표')}
                                        <span className="ml-2 font-normal text-slate-500">
                                            ({modalCurrentRoute.seating.filter(s => s.studentId).length} / {modalSelectedBus.capacity}석 배정됨)
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px]">
                                        <span className="flex items-center gap-1">
                                            <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300 inline-block"></span>
                                            {t('vacant_seat', '빈자리')}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="w-3 h-3 rounded bg-blue-600 border border-blue-700 inline-block"></span>
                                            {t('selected_seat', '선택한 자리')}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="w-3 h-3 rounded bg-slate-400 border border-slate-500 inline-block"></span>
                                            {t('assigned_seat', '배정 완료')}
                                        </span>
                                    </div>
                                </div>

                                <div className="w-full overflow-x-auto py-2">
                                    <div className="min-w-[400px]">
                                        <BusSeatMap
                                            bus={modalSelectedBus}
                                            seating={modalCurrentRoute.seating}
                                            students={students}
                                            destinations={destinations}
                                            onSeatClick={handleModalSeatClick}
                                            highlightedSeatNumber={assignSelectedSeatNumber}
                                            routeType={assignTargetRouteType}
                                            dayOfWeek={assignTargetDay}
                                        />
                                    </div>
                                </div>

                                {/* 선택된 좌석 상태 바 */}
                                <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-md text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-blue-900">{t('selected_seat_status', '선택 좌석:')}</span>
                                        {assignSelectedSeatNumber ? (
                                            <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-bold text-xs">
                                                {assignSelectedSeatNumber}번 좌석
                                            </Badge>
                                        ) : (
                                            <span className="text-blue-700 text-xs">{t('click_vacant_seat_prompt', '좌석표에서 빈자리를 클릭하세요.')}</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={!assignSelectedSeatNumber || isAssigningSeat}
                                            onClick={handleExecuteAssignSeatFromModal}
                                            className="h-8 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            {isAssigningSeat ? t('assigning', '배정 중...') : t('admin.student_management.search.assign', '배정하기')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-slate-50">
                                {availableBusesForModal.length === 0 
                                    ? t('no_bus_on_selected_slot', '해당 요일 및 경로에 운행 중인 버스가 없습니다.') 
                                    : t('select_bus_to_view_seats', '상단에서 버스를 선택하면 좌석표가 나타납니다.')}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="border-t pt-3">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsAssignSeatModalOpen(false)}
                            className="h-8 text-xs"
                        >
                            {t('close', '닫기')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};