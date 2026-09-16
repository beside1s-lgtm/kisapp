'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    Pencil, Check, Users, QrCode, Printer, Percent, Plus, X,
    Bus as BusIcon, UserX, Trash2, Save, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
    DialogFooter, DialogTrigger
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { useToast } from '@/hooks/use-toast';
import type { Student, Destination, Bus, Route, DayOfWeek, RouteType, AfterSchoolClass } from '@/lib/kisbus/types';
import { cn, getStudentName } from '@/lib/kisbus/utils';
import { updateStudent, deleteStudentsInBatch } from '@/lib/kisbus';

interface StudentDetailDialogProps {
    student: Student;
    onClose: () => void;
    destinations: Destination[];
    buses: Bus[];
    routes: Route[];
    allStudents: Student[];
    dayOrder: DayOfWeek[];
    afterSchoolClasses?: AfterSchoolClass[];
    semesterMode?: 'regular' | 'vacation';
    assignedRoutes: Route[];
    onSaveSuccess?: (updates: Partial<Student>) => void;
    handleUnassignStudentFromRoute: (routeId: string, studentId: string) => void;
    handleUnassignAllFromStudent: () => void;
    handleDestinationChange: (id: string, val: string | null, type: 'morning' | 'afternoon' | 'afterSchool' | 'satMorning' | 'satAfternoon', day?: DayOfWeek) => void;
    handleStudentInfoChange: (id: string, field: 'name' | 'gender' | 'contact' | 'grade' | 'class' | 'number', val: string) => void;
    onOpenAssignSeat: (day: DayOfWeek, routeType: RouteType) => void;
    selectedDay?: DayOfWeek;
    selectedRouteType?: RouteType;
}

export const StudentDetailDialog: React.FC<StudentDetailDialogProps> = React.memo(({
    student,
    onClose,
    destinations,
    buses,
    routes,
    allStudents,
    afterSchoolClasses = [],
    semesterMode = 'regular',
    onSaveSuccess,
    handleUnassignStudentFromRoute,
    handleUnassignAllFromStudent,
    handleDestinationChange,
    handleStudentInfoChange,
    onOpenAssignSeat,
    selectedDay = 'Monday',
    selectedRouteType = 'Morning',
}) => {
    const { t, i18n } = useTranslation();
    const { toast } = useToast();

    // ─── 로컬 폼 상태 (부모 리렌더링 없이 즉각 반응) ───
    const [formData, setFormData] = useState({
        gender: student.gender || 'Male',
        contact: student.contact || '',
        grade: student.grade || '',
        class: student.class || '',
        number: (student as any).number || '',
        morningDestinationId: student.morningDestinationId || 'none',
        afternoonDestinationId: student.afternoonDestinationId || 'none',
    });
    const [isFormDirty, setIsFormDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // 이름 수정 상태
    const [isEditingName, setIsEditingName] = useState(false);
    const [editingNameInput, setEditingNameInput] = useState('');

    // 개인 QR 모달 상태
    const [isIndividualQrOpen, setIsIndividualQrOpen] = useState(false);

    // 요일별 예비 목적지 추가 상태
    const [isAddingCustomDest, setIsAddingCustomDest] = useState(false);
    const [newCustomDestDay, setNewCustomDestDay] = useState<DayOfWeek>('Wednesday');
    const [newCustomDestId, setNewCustomDestId] = useState<string>('');

    // 학생 변경 시 폼 동기화
    useEffect(() => {
        setFormData({
            gender: student.gender || 'Male',
            contact: student.contact || '',
            grade: student.grade || '',
            class: student.class || '',
            number: (student as any).number || (student as any).studentNum || '',
            morningDestinationId: student.morningDestinationId || 'none',
            afternoonDestinationId: student.afternoonDestinationId || 'none',
        });
        setIsFormDirty(false);
        setIsEditingName(false);
    }, [student.id, (student as any).number, (student as any).studentNum, student.grade, student.class, student.contact]);

    const handleFieldChange = (field: string, val: string) => {
        setFormData(prev => ({ ...prev, [field]: val }));
        setIsFormDirty(true);
    };

    // ─── [저장] 실행 핸들러 ───
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updates: Partial<Student> = {
                gender: (formData.gender as 'Male' | 'Female') || 'Male',
                contact: formData.contact.trim(),
                grade: formData.grade.trim(),
                class: formData.class.trim(),
                morningDestinationId: formData.morningDestinationId === 'none' ? null : formData.morningDestinationId,
                afternoonDestinationId: formData.afternoonDestinationId === 'none' ? null : formData.afternoonDestinationId,
            };
            (updates as any).number = formData.number.trim();
            (updates as any).studentNum = formData.number.trim();

            await updateStudent(student.id, updates);
            if (onSaveSuccess) {
                onSaveSuccess(updates);
            }
            setIsFormDirty(false);
            toast({
                title: t('success', '저장 완료'),
                description: t('student.info_saved', '학생 정보가 성공적으로 저장되었습니다.'),
            });
        } catch (err: any) {
            console.error('Failed to save student info:', err);
            toast({
                variant: 'destructive',
                title: t('error', '저장 실패'),
                description: err?.message || '학생 정보 저장 중 오류가 발생했습니다.',
            });
        } finally {
            setIsSaving(false);
        }
    };

    // 형제자매 그룹 계산
    const siblingFamilyGroup = useMemo(() => {
        if (!student.siblingGroupId) return [];
        const gradeToNum = (g: string) => {
            const n = parseInt((g || '').replace(/\D/g, ''), 10);
            return isNaN(n) ? 0 : n;
        };
        const allMembers = allStudents.filter(s => s.siblingGroupId === student.siblingGroupId);
        const sorted = [...allMembers].sort((a, b) => gradeToNum(b.grade) - gradeToNum(a.grade));
        return sorted.map((s, idx) => ({
            student: s,
            rank: idx + 1,
            isFullPrice: idx === 0,
            isCurrent: s.id === student.id,
        }));
    }, [student.siblingGroupId, student.id, allStudents]);

    // 학생에게 등록된 특정 요일 예비 목적지 추출
    const registeredCustomDestinations = useMemo(() => {
        const items: { day: DayOfWeek; destId: string; destName: string; type: 'afterSchool' | 'satAfternoon' }[] = [];
        const destMap = semesterMode === 'vacation'
            ? (student.vacationAfterSchoolDestinations || {})
            : (student.afterSchoolDestinations || {});

        const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        weekdays.forEach(day => {
            const dId = (destMap as Record<string, string>)[day];
            if (dId && dId !== '-' && dId !== '미신청' && dId !== 'UNSPECIFIED' && dId !== student.afternoonDestinationId) {
                const destObj = destinations.find(d => d.id === dId);
                items.push({
                    day,
                    destId: dId,
                    destName: destObj?.name || dId,
                    type: 'afterSchool'
                });
            }
        });

        if (student.satAfternoonDestinationId && student.satAfternoonDestinationId !== student.afternoonDestinationId) {
            const destObj = destinations.find(d => d.id === student.satAfternoonDestinationId);
            items.push({
                day: 'Saturday',
                destId: student.satAfternoonDestinationId,
                destName: destObj?.name || student.satAfternoonDestinationId,
                type: 'satAfternoon'
            });
        }

        return items;
    }, [student, destinations, semesterMode]);

    const WEEKDAYS: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);

    // 주간 배정 노선 현황
    const weeklyAssignedRoutes = useMemo(() => {
        return WEEKDAYS.map(day => {
            const morningRoute = routes.find(r => r.dayOfWeek === day && r.type === 'Morning' && r.seating.some(s => s.studentId === student.id));
            const afternoonRoute = routes.find(r => r.dayOfWeek === day && r.type === 'Afternoon' && r.seating.some(s => s.studentId === student.id));
            const afterSchoolRoute = routes.find(r => r.dayOfWeek === day && r.type === 'AfterSchool' && r.seating.some(s => s.studentId === student.id));

            // 해당 요일 방과후 강좌 정보 추출
            const dayCourseObj = student.afterSchoolCoursesByDay?.[day];
            let dayCourseTitle = dayCourseObj?.title || '';
            let dayInstructors = (dayCourseObj as any)?.teachersText || (dayCourseObj as any)?.instructorName || (dayCourseObj as any)?.instructors || '';

            if (!dayCourseTitle && student.afterSchoolClassIds?.[day]) {
                const cId = student.afterSchoolClassIds[day];
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
                if (type === 'morning') destId = student.morningDestinationId || null;
                else if (type === 'afternoon') destId = student.afternoonDestinationId || null;
                else if (type === 'afterSchool') {
                    const destMap = semesterMode === 'vacation' 
                        ? (student.vacationAfterSchoolDestinations || {})
                        : (student.afterSchoolDestinations || {});
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
    }, [student, routes, buses, destinations, afterSchoolClasses, semesterMode, WEEKDAYS]);

    const handlePrintIndividualQr = () => {
        const printContent = document.getElementById('individual-qr-print-area');
        if (!printContent) return;
        const win = window.open('', '', 'width=450,height=500');
        if (!win) return;
        win.document.write(`
            <html>
                <head>
                    <title>QR Code - ${getStudentName(student, i18n.language)}</title>
                    <style>
                        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
                        .qr-card { border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; }
                        .name { font-size: 20px; font-weight: bold; margin-top: 8px; }
                        .info { font-size: 14px; color: #64748b; }
                    </style>
                </head>
                <body>
                    <div class="qr-card">
                        ${printContent.innerHTML}
                    </div>
                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
            </html>
        `);
        win.document.close();
    };

    return (
        <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain p-0">
                <DialogHeader className="px-6 pt-6 pb-3 border-b">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                {isEditingName ? (
                                    <div className="flex items-center gap-1.5">
                                        <Input
                                            value={editingNameInput}
                                            onChange={(e) => setEditingNameInput(e.target.value)}
                                            className="h-8 text-base font-bold w-40"
                                            autoFocus
                                        />
                                        <Button
                                            size="sm"
                                            className="h-8 px-2 text-xs"
                                            onClick={() => {
                                                if (editingNameInput.trim()) {
                                                    handleStudentInfoChange(student.id, 'name', editingNameInput.trim());
                                                }
                                                setIsEditingName(false);
                                            }}
                                        >
                                            <Check className="w-3.5 h-3.5 mr-1" /> {t('save', '저장')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 px-2 text-xs"
                                            onClick={() => setIsEditingName(false)}
                                        >
                                            {t('cancel', '취소')}
                                        </Button>
                                    </div>
                                ) : (
                                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                        {getStudentName(student, i18n.language)}
                                        {student.siblingGroupId && siblingFamilyGroup.length > 0 && (
                                            <Popover>
                                                <PopoverTrigger
                                                    className="inline-flex items-center rounded-full border bg-secondary text-secondary-foreground text-[10px] py-0 h-4 px-2 font-normal cursor-pointer hover:bg-indigo-100 hover:text-indigo-800 transition-colors focus:outline-none"
                                                >
                                                    <Users className="w-2.5 h-2.5 mr-1" />
                                                    {t('family', '가족')} ({siblingFamilyGroup.length})
                                                </PopoverTrigger>
                                                <PopoverContent
                                                    side="bottom"
                                                    align="start"
                                                    className="w-64 p-0 z-[9999] shadow-xl"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="px-3 pt-3 pb-2 border-b bg-indigo-50">
                                                        <p className="text-xs font-bold text-indigo-800 flex items-center gap-1">
                                                            <Users className="w-3.5 h-3.5" />
                                                            {t('family_group', '가족 그룹')} · {t('discount_rule', '가족 할인')}
                                                        </p>
                                                        <p className="text-[10px] text-indigo-600 mt-0.5">
                                                            최고학년(첫째) 원금, 이후 형제자매 할인 적용
                                                        </p>
                                                    </div>
                                                    <ul className="divide-y">
                                                        {siblingFamilyGroup.map(({ student: sib, isFullPrice, isCurrent }) => (
                                                            <li
                                                                key={sib.id}
                                                                className={cn(
                                                                    'flex items-center justify-between px-3 py-2 text-xs',
                                                                    isCurrent && 'bg-blue-50'
                                                                )}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium text-slate-900">{getStudentName(sib, i18n.language)}</span>
                                                                    <span className="text-[11px] text-muted-foreground">{sib.grade}학년 {sib.class}반</span>
                                                                </div>
                                                                <Badge
                                                                    variant="outline"
                                                                    className={cn(
                                                                        'text-[10px] h-5 shrink-0 ml-2',
                                                                        isFullPrice
                                                                            ? 'border-amber-400 text-amber-700 bg-amber-50'
                                                                            : 'border-emerald-400 text-emerald-700 bg-emerald-50'
                                                                    )}
                                                                >
                                                                    {isFullPrice ? (
                                                                        <span>원금</span>
                                                                    ) : (
                                                                        <span className="flex items-center gap-0.5">
                                                                            <Percent className="w-2.5 h-2.5" />할인
                                                                        </span>
                                                                    )}
                                                                </Badge>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                    </DialogTitle>
                                )}
                            </div>
                            <DialogDescription className="text-xs text-muted-foreground">
                                {formData.grade || student.grade} {t('student.grade', '학년')} {formData.class || student.class} {t('student.class', '반')}{(formData.number || (student as any).number) ? ` ${formData.number || (student as any).number}번` : ''} · {formData.contact || student.contact || t('none', '연락처 없음')}
                            </DialogDescription>
                        </div>

                        {/* 이름 옆 빈 공간으로 이동된 버튼들 */}
                        <div className="flex items-center gap-2 shrink-0">
                            {/* [저장] 버튼: 타이핑 완료 후 일괄 저장 실행 */}
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isSaving}
                                className={cn(
                                    "h-8 text-xs px-3 gap-1.5 font-bold transition-all shadow-xs cursor-pointer",
                                    isFormDirty
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300 ring-offset-1"
                                        : "bg-slate-800 hover:bg-slate-900 text-white"
                                )}
                            >
                                {isSaving ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Save className="w-3.5 h-3.5" />
                                )}
                                {t('save', '저장')}
                            </Button>

                            {!isEditingName && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setEditingNameInput(getStudentName(student, i18n.language));
                                        setIsEditingName(true);
                                    }}
                                    className="h-8 text-xs px-2.5 gap-1.5"
                                >
                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                    {t('edit_name', '이름 변경')}
                                </Button>
                            )}

                            <Dialog open={isIndividualQrOpen} onOpenChange={setIsIndividualQrOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="h-8 text-xs px-2.5 gap-1.5">
                                        <QrCode className="w-3.5 h-3.5 text-primary" />
                                        {t('print_individual_qr', '개인 QR 인쇄')}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[400px]">
                                    <DialogHeader>
                                        <DialogTitle>{t('print_individual_qr', '개인 QR 코드 인쇄')}</DialogTitle>
                                        <DialogDescription>
                                            {getStudentName(student, i18n.language)} {t('student.qr_description', '학생의 QR 코드 라벨을 인쇄합니다.')}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex flex-col items-center gap-4 py-4">
                                        <div id="individual-qr-print-area" className="flex flex-col items-center gap-2 p-4 border rounded-lg bg-white">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(student.id || '')}`} alt="QR" width={120} height={120} />
                                            <div className="text-center">
                                                <div className="font-bold text-sm text-slate-900">{getStudentName(student, i18n.language)}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {student.grade}학년 {student.class}반
                                                    {(student as any)?.number ? ` ${(student as any).number}번` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsIndividualQrOpen(false)}>{t('cancel', '닫기')}</Button>
                                        <Button onClick={handlePrintIndividualQr} className="gap-2">
                                            <Printer className="w-4 h-4" /> {t('print', '인쇄하기')}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    {/* 1. 성별 및 전화번호: 2분할 한 줄 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">{t('gender', '성별')}</Label>
                            <Select value={formData.gender || 'Male'} onValueChange={(val) => handleFieldChange('gender', val)}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Male">{t('male', '남')}</SelectItem>
                                    <SelectItem value="Female">{t('female', '여')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">{t('contact', '전화번호')}</Label>
                            <Input
                                value={formData.contact}
                                onChange={(e) => handleFieldChange('contact', e.target.value)}
                                className="h-9 text-sm"
                                placeholder="090..."
                            />
                        </div>
                    </div>

                    {/* 2. 학년/반/번호: 3등분 한 줄 배치 */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">{t('student.grade', '학년')}</Label>
                            <Input
                                value={formData.grade}
                                onChange={(e) => handleFieldChange('grade', e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">{t('student.class', '반')}</Label>
                            <Input
                                value={formData.class}
                                onChange={(e) => handleFieldChange('class', e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">{t('student.number', '번호')}</Label>
                            <Input
                                value={formData.number}
                                onChange={(e) => handleFieldChange('number', e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>

                    {/* 3. 등하교 목적지: 절반으로 줄여서 한 줄에 나란히 배치 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">{t('student.morning_destination', '등교 목적지')}</Label>
                            <Select
                                value={formData.morningDestinationId || 'none'}
                                onValueChange={(val) => handleFieldChange('morningDestinationId', val)}
                            >
                                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t('none', '없음')} /></SelectTrigger>
                                <SelectContent className="max-h-52 overflow-y-auto">
                                    <SelectItem value="none">{t('none', '없음')}</SelectItem>
                                    {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">{t('student.afternoon_destination', '하교 목적지')}</Label>
                            <Select
                                value={formData.afternoonDestinationId || 'none'}
                                onValueChange={(val) => handleFieldChange('afternoonDestinationId', val)}
                            >
                                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t('none', '없음')} /></SelectTrigger>
                                <SelectContent className="max-h-52 overflow-y-auto">
                                    <SelectItem value="none">{t('none', '없음')}</SelectItem>
                                    {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* 3-1. 특정 요일 예비 하차 목적지 관리 */}
                    <div className="space-y-1.5 pt-0.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">
                                {t('student.custom_dest_note', '※ 방과후/토요 목적지는 평일 하교 목적지로 자동 통일됩니다.')}
                            </span>
                            {!isAddingCustomDest && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsAddingCustomDest(true)}
                                    className="h-6 text-[11px] px-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 shrink-0"
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    {t('student.add_custom_destination', '예비 목적지 추가')}
                                </Button>
                            )}
                        </div>

                        {/* 등록된 예비 목적지 목록 */}
                        {registeredCustomDestinations.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-md">
                                {registeredCustomDestinations.map(cDest => (
                                    <Badge
                                        key={`${cDest.type}_${cDest.day}`}
                                        variant="secondary"
                                        className="text-[11px] font-normal flex items-center gap-1.5 py-1 px-2 bg-white border border-slate-300 shadow-sm"
                                    >
                                        <span className="font-semibold text-indigo-700">
                                            {t(`day_short.${cDest.day.toLowerCase()}`, cDest.day.slice(0, 3))}
                                        </span>
                                        <span className="text-slate-800">{cDest.destName}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-3.5 w-3.5 p-0 text-slate-400 hover:text-destructive shrink-0"
                                            onClick={async () => {
                                                if (cDest.type === 'afterSchool') {
                                                    await handleDestinationChange(student.id, null, 'afterSchool', cDest.day);
                                                } else {
                                                    await handleDestinationChange(student.id, null, 'satAfternoon');
                                                }
                                                toast({ title: t('success', '성공'), description: t('student.custom_dest_removed', '예비 목적지가 해제되었습니다.') });
                                            }}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </Badge>
                                ))}
                            </div>
                        )}

                        {/* 예비 목적지 추가 폼 */}
                        {isAddingCustomDest && (
                            <div className="flex items-center gap-2 p-2 bg-indigo-50/70 border border-indigo-200 rounded-md">
                                <Select value={newCustomDestDay} onValueChange={(val) => setNewCustomDestDay(val as DayOfWeek)}>
                                    <SelectTrigger className="h-8 w-24 text-xs bg-white">
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

                                <Select value={newCustomDestId || 'none'} onValueChange={setNewCustomDestId}>
                                    <SelectTrigger className="h-8 flex-1 text-xs bg-white">
                                        <SelectValue placeholder={t('student.select_destination', '목적지 선택')} />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-52 overflow-y-auto">
                                        <SelectItem value="none">{t('none', '없음')}</SelectItem>
                                        {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>

                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                                    onClick={async () => {
                                        if (!newCustomDestId || newCustomDestId === 'none') {
                                            toast({ title: t('warning', '경고'), description: t('student.select_destination_warn', '목적지를 선택하세요.'), variant: 'destructive' });
                                            return;
                                        }
                                        if (newCustomDestDay === 'Saturday') {
                                            await handleDestinationChange(student.id, newCustomDestId, 'satAfternoon');
                                        } else {
                                            await handleDestinationChange(student.id, newCustomDestId, 'afterSchool', newCustomDestDay);
                                        }
                                        toast({ title: t('success', '성공'), description: t('student.custom_dest_saved', '예비 목적지가 설정되었습니다.') });
                                        setIsAddingCustomDest(false);
                                        setNewCustomDestId('');
                                    }}
                                >
                                    {t('save', '저장')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs shrink-0"
                                    onClick={() => { setIsAddingCustomDest(false); setNewCustomDestId(''); }}
                                >
                                    {t('cancel', '취소')}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* 4. 배정된 노선 목록 (단일 요일별 단일 행 그리드) */}
                    <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold">{t('admin.student_management.search.assigned_routes', '배정된 노선')}</Label>
                            {weeklyAssignedRoutes.some(w => w.hasAny) && (
                                <span className="text-[10px] text-muted-foreground">
                                    {t('admin.student_management.search.unassign_hint', '※ 해제 버튼을 누르면 해당 노선에서 즉시 제외됩니다.')}
                                </span>
                            )}
                        </div>

                        {weeklyAssignedRoutes.some(w => w.hasAny) ? (
                            <div className="border rounded-md overflow-hidden bg-white shadow-2xs text-xs">
                                <div className="grid grid-cols-12 bg-slate-50 border-b font-semibold text-slate-700 py-1 px-2 text-center text-[11px]">
                                    <div className="col-span-2 text-left">{t('day', '요일')}</div>
                                    <div className="col-span-3">{t('morning_route', '등교')}</div>
                                    <div className="col-span-3">{t('afternoon_route', '하교')}</div>
                                    <div className="col-span-4">{t('afterschool_route', '방과후')}</div>
                                </div>
                                <div className="divide-y">
                                    {weeklyAssignedRoutes.map(item => {
                                        if (!item.hasAny) return null;
                                        const dayLabel = t(`day_short.${item.day.toLowerCase()}`, item.day.slice(0, 3));
                                        return (
                                            <div key={item.day} className="grid grid-cols-12 items-center py-1.5 px-2 text-xs hover:bg-slate-50/50">
                                                <div className="col-span-2 font-semibold text-slate-800 flex items-center gap-1">
                                                    <span>{dayLabel}</span>
                                                    {item.hasAfterSchoolCourse && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" title="방과후 수강 요일" />
                                                    )}
                                                </div>

                                                {/* 등교 */}
                                                <div className="col-span-3 px-1">
                                                    {item.morning ? (
                                                        <div className="inline-flex items-center justify-between w-full bg-sky-50 text-sky-800 border border-sky-200 rounded px-1.5 py-0.5 font-medium">
                                                            <span className="truncate text-[10px]" title={`${item.morning.busName} (${item.morning.destName || t('none', '없음')})`}>
                                                                {item.morning.busName}
                                                            </span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-4 w-4 ml-0.5 text-destructive/70 hover:text-destructive shrink-0"
                                                                onClick={() => handleUnassignStudentFromRoute(item.morning!.routeId, student.id)}
                                                                title={t('unassign', '배정 해제')}
                                                            >
                                                                <UserX className="h-2.5 w-2.5" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 text-[10px]">{t('none', '없음')}</span>
                                                    )}
                                                </div>

                                                {/* 하교 */}
                                                <div className="col-span-3 px-1">
                                                    {item.afternoon ? (
                                                        <div className="flex flex-col gap-0.5 items-center">
                                                            <div className="inline-flex items-center justify-between w-full bg-amber-50 text-amber-800 border border-amber-200 rounded px-1.5 py-0.5 font-medium">
                                                                <span className="truncate text-[10px]" title={`${item.afternoon.busName} (${item.afternoon.destName || t('none', '없음')})`}>
                                                                    {item.afternoon.busName}
                                                                </span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-4 w-4 ml-0.5 text-destructive/70 hover:text-destructive shrink-0"
                                                                    onClick={() => handleUnassignStudentFromRoute(item.afternoon!.routeId, student.id)}
                                                                    title={t('unassign', '배정 해제')}
                                                                >
                                                                    <UserX className="h-2.5 w-2.5" />
                                                                </Button>
                                                            </div>
                                                            {item.hasAfterSchoolCourse && (
                                                                <span className="text-[9px] text-amber-700 bg-amber-100/80 px-1 rounded leading-tight font-medium" title="방과후 수강 요일에 정규 하교 버스에 배정되어 있습니다.">
                                                                    방과후수강중
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 text-[10px]">{t('none', '없음')}</span>
                                                    )}
                                                </div>

                                                {/* 방과후 */}
                                                <div className="col-span-4 px-1">
                                                    <div className="flex flex-col gap-1 items-center">
                                                        {item.afterSchool ? (
                                                            <div className="inline-flex items-center justify-between w-full bg-emerald-50 text-emerald-800 border border-emerald-200 rounded px-1.5 py-0.5 font-medium">
                                                                <span className="truncate text-[10px] font-bold" title={`${item.afterSchool.busName} (${item.afterSchool.destName || t('none', '없음')})`}>
                                                                    {item.afterSchool.busName}
                                                                </span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-4 w-4 ml-0.5 text-destructive/70 hover:text-destructive shrink-0"
                                                                    onClick={() => handleUnassignStudentFromRoute(item.afterSchool!.routeId, student.id)}
                                                                    title={t('unassign', '배정 해제')}
                                                                >
                                                                    <UserX className="h-2.5 w-2.5" />
                                                                </Button>
                                                            </div>
                                                        ) : item.hasAfterSchoolCourse ? (
                                                            <div className="inline-flex items-center justify-center w-full bg-rose-50 text-rose-700 border border-rose-200 rounded px-1 py-0.5 text-[10px] font-semibold">
                                                                버스 미배정
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 text-[10px]">{t('none', '없음')}</span>
                                                        )}

                                                        {/* 해당 요일 방과후 강좌명 뱃지 */}
                                                        {item.dayCourseTitle && (
                                                            <div
                                                                className="w-full truncate text-[9.5px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium text-left"
                                                                title={`${item.dayCourseTitle}${item.dayInstructors ? ` (${item.dayInstructors})` : ''}`}
                                                            >
                                                                <span className="font-semibold">수업:</span> {item.dayCourseTitle}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="border border-dashed rounded-lg p-4 text-center text-muted-foreground text-xs bg-slate-50/50">
                                {t('admin.student_management.search.no_assigned_routes', '배정된 노선이 없습니다.')}
                            </div>
                        )}
                    </div>

                    {/* 5. 액션 버튼 */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="default"
                                onClick={() => onOpenAssignSeat(selectedDay, selectedRouteType)}
                                className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                            >
                                <BusIcon className="h-3.5 w-3.5 mr-1.5" />
                                {t('admin.student_management.search.assign', '좌석 배정')}
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleUnassignAllFromStudent} className="text-xs h-8 text-slate-700">
                                {t('admin.student_management.search.unassign_all', '전체 배정 해제')}
                            </Button>
                        </div>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" className="text-xs h-8">
                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                    {t('delete_student', '학생 삭제')}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>
                                        {getStudentName(student, i18n.language)} {t('student.delete_confirm_title', '학생을 삭제하시겠습니까?')}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {t('student.delete_confirm_description', '삭제 후 복구할 수 없습니다. 학생 정보와 모든 버스 배정이 영구 삭제됩니다.')}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{t('cancel', '취소')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={async () => {
                                        try {
                                            await deleteStudentsInBatch([student.id]);
                                            onClose();
                                            toast({ title: t('success', '성공'), description: t('student.delete_success', '학생 신청 정보가 삭제되었습니다.') });
                                        } catch (error) {
                                            toast({ title: t('error', '오류'), description: t('student.delete_error', '삭제 중 오류가 발생했습니다.'), variant: 'destructive' });
                                        }
                                    }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        {t('delete', '삭제')}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
});

StudentDetailDialog.displayName = 'StudentDetailDialog';
