'use client';

import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { 
    addTeachersInBatch, clearTeachers, updateBus, deleteTeachersInBatch,
    addAfterSchoolTeachersInBatch, deleteAfterSchoolTeachersInBatch, clearAfterSchoolTeachers,
    updateTeacher, updateAfterSchoolTeacher, updateSaturdayTeacher,
    addSaturdayTeachersInBatch, clearSaturdayTeachers, deleteSaturdayTeachersInBatch,
    addTeacher, addAfterSchoolTeacher, addSaturdayTeacher
} from '@/lib/kisbus';
import { sanitizeDataForSystem } from '@/lib/kisbus/utils';
import { Input } from '@/components/ui/input';
import type { Teacher, NewTeacher, Bus, Route, DayOfWeek, Destination } from '@/lib/kisbus/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Upload, Trash2, UserCog, UserX, Pencil, Users, Undo2, X, Plus, Check } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/kisbus/utils';
import { doc, writeBatch, onSnapshot } from 'firebase/firestore';
import { getKisbusDb as db } from '@/lib/kisbus/firebase';
import { MorningGateDutyTab } from './morning-gate-duty-tab';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { setDocument } from '@/lib/kisbus';

const TeacherPinSettings = () => {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const unsub = onSnapshot(doc(db(), 'config', 'teachers'), (docSnap) => {
            if (docSnap.exists()) {
                setPin(docSnap.data().pin || '');
            }
        });
        return () => unsub();
    }, []);

    const handleSave = async () => {
        if (!pin || pin.length !== 4) {
            toast({ title: '오류', description: '핀 번호는 숫자 4자리여야 합니다.', variant: 'destructive' });
            return;
        }
        setLoading(true);
        try {
            await setDocument('config', 'teachers', { pin });
            toast({ title: '성공', description: '교사 핀 번호가 변경되었습니다.' });
        } catch (error) {
            console.error(error);
            toast({ title: '오류', description: '핀 번호 저장 중 오류가 발생했습니다.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="py-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    교사용 앱 접속 핀 번호 설정
                </CardTitle>
                <CardDescription className="text-xs">전체 교사가 모바일 앱 로그인 시 공통으로 사용하는 4자리 인증 번호입니다.</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
                <div className="flex items-center gap-3 max-w-[280px]">
                    <Input 
                        type="text"
                        inputMode="numeric"
                        placeholder="핀 번호 4자리" 
                        value={pin} 
                        onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                        className="text-center font-bold tracking-widest text-lg h-10"
                    />
                    <Button onClick={handleSave} disabled={loading} className="whitespace-nowrap">설정 저장</Button>
                </div>
            </CardContent>
        </Card>
    );
};

interface TeacherEditDialogProps {
    teacher: Teacher;
    type: 'commute' | 'afterSchool' | 'saturday' | 'morningGate';
}

const TeacherEditDialog = ({ teacher, type }: TeacherEditDialogProps) => {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [name, setName] = useState(teacher.name);
    const [days, setDays] = useState<DayOfWeek[]>(teacher.afterSchoolDays || []);
    const [isOpen, setIsOpen] = useState(false);

    const handleSave = async () => {
        try {
            const data: Partial<Teacher> = { 
                name: sanitizeDataForSystem(name),
                ...(type === 'afterSchool' ? { afterSchoolDays: days } : {})
            };
            if (type === 'commute') {
                await updateTeacher(teacher.id, data);
            } else if (type === 'afterSchool') {
                await updateAfterSchoolTeacher(teacher.id, data);
            } else {
                await updateSaturdayTeacher(teacher.id, data);
            }
            toast({ title: t('success'), description: t('admin.teacher_management.edit.success') });
            setIsOpen(false);
        } catch (error) {
            toast({ title: t('error'), description: t('admin.teacher_management.edit.error'), variant: 'destructive' });
        }
    };

    const toggleDay = (day: DayOfWeek) => {
        setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('admin.teacher_management.edit.title')}</DialogTitle>
                    <DialogDescription>
                        교사 정보를 수정합니다.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">{t('admin.teacher_management.teacher_name')}</Label>
                        <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    {type === 'afterSchool' && (
                        <div className="space-y-2">
                            <Label>담당 가능 요일 (미선택 시 전체 가능)</Label>
                            <div className="grid grid-cols-5 gap-2">
                                {(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as DayOfWeek[]).map(d => (
                                    <Button 
                                        key={d} 
                                        type="button"
                                        variant={days.includes(d) ? "default" : "outline"} 
                                        size="sm" 
                                        className="h-8 text-xs px-1"
                                        onClick={() => toggleDay(d)}
                                    >
                                        {t(`day_short.${d.toLowerCase()}`)}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>{t('cancel')}</Button>
                    <Button onClick={handleSave}>{t('save')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const TeacherAddDialog = ({ type, semesterMode = 'regular' }: { type: 'commute' | 'afterSchool' | 'saturday' | 'morningGate'; semesterMode?: 'regular' | 'vacation' }) => {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [days, setDays] = useState<DayOfWeek[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) {
            toast({ title: t('error'), description: '교사 이름을 입력해주세요.', variant: 'destructive' });
            return;
        }

        setIsSaving(true);
        try {
            const newTeacher: NewTeacher = { 
                name: sanitizeDataForSystem(name),
                ...(type === 'afterSchool' ? { afterSchoolDays: days } : {}),
                semesterMode
            };
            
            if (type === 'commute') {
                await addTeacher(newTeacher);
            } else if (type === 'afterSchool') {
                await addAfterSchoolTeacher(newTeacher);
            } else {
                await addSaturdayTeacher(newTeacher);
            }
            
            toast({ title: t('success'), description: t('admin.teacher_management.add_success') || '교사가 추가되었습니다.' });
            setIsOpen(false);
            setName('');
            setDays([]);
        } catch (error) {
            toast({ title: t('error'), description: '교사 추가 중 오류가 발생했습니다.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const toggleDay = (day: DayOfWeek) => {
        setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs px-2.5 whitespace-nowrap">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> 개별 추가
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>새 교사 추가</DialogTitle>
                    <DialogDescription>
                        새로운 교사 정보를 입력합니다.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="add-name">{t('admin.teacher_management.teacher_name')}</Label>
                        <Input 
                            id="add-name" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            placeholder="교사 이름 입력"
                        />
                    </div>
                    {type === 'afterSchool' && (
                        <div className="space-y-2">
                            <Label>담당 가능 요일 (미선택 시 전체 가능)</Label>
                            <div className="grid grid-cols-5 gap-2">
                                {(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as DayOfWeek[]).map(d => (
                                    <Button 
                                        key={d} 
                                        type="button"
                                        variant={days.includes(d) ? "default" : "outline"} 
                                        size="sm" 
                                        className="h-8 text-xs px-1"
                                        onClick={() => toggleDay(d)}
                                    >
                                        {t(`day_short.${d.toLowerCase()}`)}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>{t('cancel')}</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? '저장 중...' : t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const sortBuses = (buses: Bus[], isOperationalFn?: (id: string) => boolean): Bus[] => {
    return [...buses].sort((a, b) => {
        const activeA = a.isActive ?? true;
        const activeB = b.isActive ?? true;
        if (activeA !== activeB) return activeA ? -1 : 1;

        if (isOperationalFn) {
            const opA = isOperationalFn(a.id);
            const opB = isOperationalFn(b.id);
            if (opA !== opB) return opA ? -1 : 1;
        }

        const numA = parseInt(a.name.replace(/\D/g, ''), 10);
        const numB = parseInt(b.name.replace(/\D/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        return a.name.localeCompare(b.name, 'ko');
    });
};

const sortTeachers = (teachers: Teacher[]): Teacher[] => {
    return [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
};

interface TeacherAssignmentDialogProps {
    targetBus: Bus;
    allRoutes: Route[];
    teachers: Teacher[];
    assignmentType: 'commute' | 'afterSchool' | 'saturday' | 'morningGate';
    onOpenChange: (open: boolean) => void;
    semesterMode?: 'regular' | 'vacation';
}
  
const TeacherAssignmentDialog = ({ targetBus, allRoutes, teachers, assignmentType, onOpenChange, semesterMode = 'regular' }: TeacherAssignmentDialogProps) => {
    const [selectedTeachersPerDay, setSelectedTeachersPerDay] = useState<Record<DayOfWeek, string[]>>({} as any);
    const [activeDay, setActiveDay] = useState<DayOfWeek>('Monday');
    const { toast } = useToast();
    const { t } = useTranslation();
    const weekdays: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], []);
    const afterSchoolDays: DayOfWeek[] = useMemo(() => {
        return semesterMode === 'vacation'
            ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
            : ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    }, [semesterMode]);

    const relevantRoutes = useMemo(() => {
        if (assignmentType === 'commute') {
            if (semesterMode === 'vacation') {
                return allRoutes.filter(r => r.busId === targetBus.id && weekdays.includes(r.dayOfWeek) && (r.type === 'Morning' || r.type === 'Afternoon'));
            }
            return allRoutes.filter(r => r.busId === targetBus.id && weekdays.includes(r.dayOfWeek) && r.type === 'Afternoon');
        } else if (assignmentType === 'afterSchool') {
            const afterSchoolRouteType = semesterMode === 'vacation' ? 'Afternoon' : 'AfterSchool';
            return allRoutes.filter(r => r.busId === targetBus.id && r.type === afterSchoolRouteType);
        } else {
            return allRoutes.filter(r => r.busId === targetBus.id && r.dayOfWeek === 'Saturday');
        }
    }, [allRoutes, targetBus, assignmentType, weekdays, semesterMode]);

    useEffect(() => {
        const initial: any = {};
        relevantRoutes.forEach(r => {
            if (initial[r.dayOfWeek] && initial[r.dayOfWeek].length > 0) {
                return;
            }
            initial[r.dayOfWeek] = r.teacherIds || [];
        });
        setSelectedTeachersPerDay(initial);
    }, [relevantRoutes]);
    
    const handleSave = async () => {
        if (relevantRoutes.length === 0) return;
        
        try {
            const batch = writeBatch(db());
            const oldTeacherIds = Array.from(new Set(relevantRoutes.flatMap(r => r.teacherIds || [])));
            let newTeacherIds: string[] = [];

            const isVac = semesterMode === 'vacation';
            if (assignmentType === 'commute' || (assignmentType === 'afterSchool' && isVac)) {
                newTeacherIds = selectedTeachersPerDay['Monday'] || [];
                relevantRoutes.forEach(route => {
                    batch.update(doc(db(), 'routes', route.id), { teacherIds: newTeacherIds });
                });
            } else if (assignmentType === 'afterSchool') {
                relevantRoutes.forEach(route => {
                    if (selectedTeachersPerDay[route.dayOfWeek]) {
                        batch.update(doc(db(), 'routes', route.id), { teacherIds: selectedTeachersPerDay[route.dayOfWeek] });
                    }
                });
                newTeacherIds = Array.from(new Set(Object.values(selectedTeachersPerDay).flat())).filter(Boolean);
            } else {
                newTeacherIds = selectedTeachersPerDay['Saturday'] || [];
                relevantRoutes.forEach(route => {
                    batch.update(doc(db(), 'routes', route.id), { teacherIds: newTeacherIds });
                });
            }

            // Sync with teachers collection (Ensure only valid teacher IDs are used to avoid Firestore update errors)
            const eligibleTeacherIds = teachers.map(t => t.id);
            const addedTeachers = newTeacherIds.filter((id: string) => id && eligibleTeacherIds.includes(id) && !oldTeacherIds.includes(id));
            const removedTeachers = oldTeacherIds.filter((id: string) => id && eligibleTeacherIds.includes(id) && !newTeacherIds.includes(id));

            const collectionName = assignmentType === 'commute' 
                ? 'teachers' 
                : assignmentType === 'afterSchool' 
                ? 'afterSchoolTeachers' 
                : 'saturdayTeachers';

            if (assignmentType === 'commute' || assignmentType === 'saturday') {
                addedTeachers.forEach((teacherId: string) => {
                    batch.update(doc(db(), collectionName, teacherId), { assignedBusId: targetBus.id });
                });
                removedTeachers.forEach((teacherId: string) => {
                    const tDoc = teachers.find(t => t.id === teacherId);
                    if (tDoc && tDoc.assignedBusId === targetBus.id) {
                        batch.update(doc(db(), collectionName, teacherId), { assignedBusId: '' });
                    }
                });
            } else if (assignmentType === 'afterSchool') {
                addedTeachers.forEach((teacherId: string) => {
                    batch.update(doc(db(), collectionName, teacherId), { assignedAfterSchoolBusId: targetBus.id });
                });
                removedTeachers.forEach((teacherId: string) => {
                    const tDoc = teachers.find(t => t.id === teacherId);
                    if (tDoc && tDoc.assignedAfterSchoolBusId === targetBus.id) {
                        batch.update(doc(db(), collectionName, teacherId), { assignedAfterSchoolBusId: '' });
                    }
                });
            }

            await batch.commit();
            toast({ title: t('success'), description: t('admin.teacher_assignment.change.success') });
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to sync teacher assignments: ", error);
            toast({ title: t('error'), description: t('admin.teacher_assignment.change.error'), variant: "destructive" });
        }
    };

    const handleApplyToAllDays = (sourceDay: DayOfWeek) => {
        const sourceSettings = selectedTeachersPerDay[sourceDay] || [];
        setSelectedTeachersPerDay(prev => {
            const next = { ...prev };
            afterSchoolDays.forEach(day => {
                next[day] = [...sourceSettings];
            });
            return next;
        });
        toast({
            title: t('success'),
            description: "현재 요일의 설정을 모든 방과후 요일에 적용했습니다."
        });
    };

    const setTeacherForSlot = (day: DayOfWeek, slot: 0 | 1, teacherId: string) => {
        setSelectedTeachersPerDay(prev => {
            const current = [...(prev[day] || [])];
            if (teacherId === 'none') {
                 if (slot === 0) { current[0] = ''; }
                 else { current[1] = ''; }
            } else {
                 current[slot] = teacherId;
            }
            return { ...prev, [day]: current };
        });
    }

    const eligibleTeachers = useMemo(() => {
        if (assignmentType === 'commute') return teachers;
        if (semesterMode === 'vacation') return teachers; // 방학에는 요일 필터 없이 전체 교사 풀 노출
        return teachers.filter(t => !t.afterSchoolDays || t.afterSchoolDays.includes(activeDay));
    }, [teachers, activeDay, assignmentType, semesterMode]);

    const sortedTeachers = useMemo(() => [...eligibleTeachers].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [eligibleTeachers]);
    
    return (
        <DialogContent className="max-w-lg">
            <DialogHeader>
                <DialogTitle>{t('admin.teacher_assignment.change.title')} - {targetBus.name}</DialogTitle>
                <CardDescription>
                    {assignmentType === 'commute' ? "평일 하교 노선 담당교사 변경" : 
                     assignmentType === 'afterSchool' ? (semesterMode === 'vacation' ? "방학 중 방과후 담당교사 변경" : "요일별 방과후 담당교사(1-5주, 6-10주) 변경") : 
                     "토요일 등하교 담당교사 변경"}
                </CardDescription>
            </DialogHeader>

            {assignmentType === 'afterSchool' && semesterMode !== 'vacation' ? (
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto font-sans pr-1">
                    <Label className="text-sm font-bold text-slate-700">요일별 방과후 교사 배정</Label>
                    {afterSchoolDays.map(day => (
                        <div key={day} className="space-y-3 pt-3 border-t first:border-t-0">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-sans">
                                    {t(`day_short.${day.toLowerCase()}`)}요일
                                </span>
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 text-[10px] text-slate-500 hover:text-slate-700 font-sans border px-1.5"
                                    onClick={() => handleApplyToAllDays(day)}
                                >
                                    이 설정을 모든 요일에 복사
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1">
                                    <Label className="text-xs font-semibold text-slate-500">1 ~ 5주 담당 교사</Label>
                                    <Select 
                                        value={selectedTeachersPerDay[day]?.[0] || 'none'} 
                                        onValueChange={(v) => setTeacherForSlot(day, 0, v)}
                                    >
                                        <SelectTrigger className="h-9"><SelectValue placeholder="교사 선택" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">미지정</SelectItem>
                                            {teachers
                                                .filter(t => !t.afterSchoolDays || t.afterSchoolDays.includes(day))
                                                .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
                                                .map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                                            }
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-xs font-semibold text-slate-500">6 ~ 10주 담당 교사</Label>
                                    <Select 
                                        value={selectedTeachersPerDay[day]?.[1] || 'none'} 
                                        onValueChange={(v) => setTeacherForSlot(day, 1, v)}
                                    >
                                        <SelectTrigger className="h-9"><SelectValue placeholder="교사 선택" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">미지정</SelectItem>
                                            {teachers
                                                .filter(t => !t.afterSchoolDays || t.afterSchoolDays.includes(day))
                                                .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
                                                .map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                                            }
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    {sortedTeachers.map(teacher => (
                        <div key={teacher.id} className="flex items-center space-x-2">
                            <Checkbox
                                id={`teacher-${teacher.id}`}
                                checked={(selectedTeachersPerDay[assignmentType === 'commute' || (assignmentType === 'afterSchool' && semesterMode === 'vacation') ? 'Monday' : 'Saturday'] || []).includes(teacher.id)}
                                onCheckedChange={(checked) => {
                                    const dayKey = assignmentType === 'commute' || (assignmentType === 'afterSchool' && semesterMode === 'vacation') ? 'Monday' : 'Saturday';
                                    const current = [...(selectedTeachersPerDay[dayKey] || [])];
                                    const next = checked ? [...current, teacher.id] : current.filter(id => id !== teacher.id);
                                    setSelectedTeachersPerDay(prev => ({ ...prev, [dayKey]: next }));
                                }}
                            />
                            <Label htmlFor={`teacher-${teacher.id}`}>{teacher.name}</Label>
                        </div>
                    ))}
                </div>
            )}

            <DialogFooter className="justify-end gap-2">
                 <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
                 <Button onClick={handleSave}>{t('save')}</Button>
            </DialogFooter>
        </DialogContent>
    );
};

const TeacherBatchEditDaysDialog = ({ 
    isOpen, 
    onOpenChange, 
    selectedIds, 
    onSuccess 
}: { 
    isOpen: boolean; 
    onOpenChange: (open: boolean) => void; 
    selectedIds: Set<string>; 
    onSuccess: () => void; 
}) => {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [days, setDays] = useState<DayOfWeek[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const toggleDay = (day: DayOfWeek) => {
        setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const batch = writeBatch(db());
            selectedIds.forEach(id => {
                const docRef = doc(db(), 'afterSchoolTeachers', id);
                batch.update(docRef, { afterSchoolDays: days });
            });
            await batch.commit();
            toast({ title: t('success'), description: `${selectedIds.size}명 교사의 담당 요일이 일괄 변경되었습니다.` });
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({ title: t('error'), description: '일괄 변경 중 오류가 발생했습니다.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>담당 요일 일괄 변경</DialogTitle>
                    <DialogDescription>
                        선택한 {selectedIds.size}명 교사의 담당 요일을 일괄 설정합니다. (요일 미선택 시 전체 요일 담당)
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex justify-between items-center">
                        <Label>담당 요일 선택</Label>
                        <div className="flex gap-2">
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-[10px] px-2"
                                onClick={() => setDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}
                            >
                                전체 선택
                            </Button>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-[10px] px-2"
                                onClick={() => setDays([])}
                            >
                                전체 해제
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                        {(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as DayOfWeek[]).map(d => (
                            <Button 
                                key={d} 
                                type="button"
                                variant={days.includes(d) ? "default" : "outline"} 
                                size="sm" 
                                className="h-8 text-xs px-1"
                                onClick={() => toggleDay(d)}
                            >
                                {t(`day_short.${d.toLowerCase()}`)}
                            </Button>
                        ))}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>{t('cancel')}</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? '저장 중...' : t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

interface TeacherManagementTabProps {
    teachers: Teacher[];
    afterSchoolTeachers: Teacher[];
    saturdayTeachers: Teacher[];
    buses: Bus[];
    routes: Route[];
    destinations: Destination[];
    semesterMode?: 'regular' | 'vacation';
}

export const TeacherManagementTab = ({ teachers, afterSchoolTeachers, saturdayTeachers, buses, routes, destinations, semesterMode = 'regular' }: TeacherManagementTabProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const { t } = useTranslation();
    const [teacherAssignmentType, setTeacherAssignmentType] = useState<'commute' | 'afterSchool' | 'saturday' | 'morningGate'>('commute');
    const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false);
    const [selectedBusForTeacher, setSelectedBusForTeacher] = useState<Bus | null>(null);
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
    const [excludedFromAssignmentIds, setExcludedFromAssignmentIds] = useState<Set<string>>(new Set());
    const [previousRouteAssignments, setPreviousRouteAssignments] = useState<Record<string, string[]> | null>(null);
    const [afterSchoolPoolDayFilter, setAfterSchoolPoolDayFilter] = useState<DayOfWeek | 'All'>('All');
    const [isBatchEditDaysOpen, setIsBatchEditDaysOpen] = useState(false);

    const handleToggleExcludeFromAssignment = (teacherId: string) => {
        setExcludedFromAssignmentIds(prev => {
            const next = new Set(prev);
            if (next.has(teacherId)) next.delete(teacherId);
            else next.add(teacherId);
            return next;
        });
    };

    useEffect(() => {
        if (semesterMode === 'vacation') {
            setTeacherAssignmentType('afterSchool');
        } else {
            setTeacherAssignmentType('commute');
        }
    }, [semesterMode]);

    const isVacation = semesterMode === 'vacation';

    const afterSchoolDaysList = useMemo<DayOfWeek[]>(() => {
        return isVacation 
            ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] 
            : ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    }, [isVacation]);

    const afterSchoolRouteType = useMemo(() => {
        return isVacation ? 'Afternoon' : 'AfterSchool';
    }, [isVacation]);

    const afterSchoolFilterDays = useMemo(() => {
        return isVacation
            ? (['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const)
            : (['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] as const);
    }, [isVacation]);

    const filteredTeachers = useMemo(() => 
        teachers.filter(t => (t.semesterMode || 'regular') === semesterMode), [teachers, semesterMode]);
    const filteredAfterSchoolTeachers = useMemo(() => 
        afterSchoolTeachers.filter(t => (t.semesterMode || 'regular') === semesterMode), [afterSchoolTeachers, semesterMode]);
    const filteredSaturdayTeachers = useMemo(() => 
        saturdayTeachers.filter(t => (t.semesterMode || 'regular') === semesterMode), [saturdayTeachers, semesterMode]);

    const allTeachersPool = useMemo(() => {
        const pool = new Map<string, Teacher>();
        filteredTeachers.forEach(t => pool.set(t.id, t));
        filteredAfterSchoolTeachers.forEach(t => pool.set(t.id, t));
        filteredSaturdayTeachers.forEach(t => pool.set(t.id, t));
        return Array.from(pool.values());
    }, [filteredTeachers, filteredAfterSchoolTeachers, filteredSaturdayTeachers]);

    const currentTeacherPool = useMemo(() => {
        if (teacherAssignmentType === 'commute') return filteredTeachers;
        if (teacherAssignmentType === 'afterSchool') {
            if (afterSchoolPoolDayFilter !== 'All') {
                return filteredAfterSchoolTeachers.filter(t => !t.afterSchoolDays || t.afterSchoolDays.length === 0 || t.afterSchoolDays.includes(afterSchoolPoolDayFilter));
            }
            return filteredAfterSchoolTeachers;
        }
        return filteredSaturdayTeachers;
    }, [teacherAssignmentType, filteredTeachers, filteredAfterSchoolTeachers, filteredSaturdayTeachers, afterSchoolPoolDayFilter]);
    const sortedTeachersList = useMemo(() => [...currentTeacherPool].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [currentTeacherPool]);

    // Validation logic for teachers
    const teacherValidation = useMemo(() => {
        const unassigned: Teacher[] = [];
        const doubleAssigned: { teacher: Teacher; buses: string[] }[] = [];
        
        const assignmentMap: Record<string, string[]> = {}; // teacherId -> busNames

        // Helper to check if a teacher is assigned based on category
        const checkAssignments = () => {
            const relevantRoutes = routes.filter(r => {
                if (teacherAssignmentType === 'commute') {
                    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && r.type === 'Afternoon';
                } else if (teacherAssignmentType === 'afterSchool') {
                    return r.type === afterSchoolRouteType;
                } else {
                    return r.dayOfWeek === 'Saturday';
                }
            });

            relevantRoutes.forEach(route => {
                const bus = buses.find(b => b.id === route.busId);
                const busName = bus?.name || 'Unknown';
                // 방과후의 경우 요일 정보를 포함하여 체크 (예: "Bus 1 (Mon)")
                const assignmentKey = (teacherAssignmentType === 'afterSchool' && semesterMode !== 'vacation') 
                    ? `${busName} (${t(`day_short.${route.dayOfWeek.toLowerCase()}`)})`
                    : busName;

                (route.teacherIds || []).forEach(tid => {
                    if (!assignmentMap[tid]) assignmentMap[tid] = [];
                    if (!assignmentMap[tid].includes(assignmentKey)) {
                        assignmentMap[tid].push(assignmentKey);
                    }
                });
            });
        };

        checkAssignments();

        currentTeacherPool.forEach(teacher => {
            const assignedBuses = assignmentMap[teacher.id] || [];
            if (assignedBuses.length === 0) {
                unassigned.push(teacher);
            } else if (assignedBuses.length > 1) {
                doubleAssigned.push({ teacher, buses: assignedBuses });
            }
        });

        return { unassigned, doubleAssigned };
    }, [currentTeacherPool, routes, teacherAssignmentType, buses, afterSchoolRouteType]);

    const isBusOperational = useCallback((busId: string) => {
        let categoryRoutes: Route[] = [];
        if (teacherAssignmentType === 'commute') {
            categoryRoutes = routes.filter(r => r.busId === busId && ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && r.type === 'Afternoon');
        } else if (teacherAssignmentType === 'afterSchool') {
            categoryRoutes = routes.filter(r => r.busId === busId && r.type === afterSchoolRouteType);
        } else {
            categoryRoutes = routes.filter(r => r.busId === busId && r.dayOfWeek === 'Saturday');
        }
        
        // 방학 중 모드인 경우, 학생 배정 여부와 무관하게 정류장이 있으면 운행중인 것으로 판별 (방학에는 노선이 유동적이기 때문)
        if (semesterMode === 'vacation') {
            return categoryRoutes.some(r => (r.stops?.length ?? 0) > 0);
        }
        
        // A bus is only "operational" for teacher assignment if it has both stops AND students assigned.
        return categoryRoutes.some(r => (r.stops?.length ?? 0) > 0 && r.seating.some(s => s.studentId !== null));
    }, [routes, teacherAssignmentType, afterSchoolRouteType, semesterMode]);

    const getBusPassengerCount = useCallback((busId: string): number => {
        let busRoutes: Route[] = [];
        const isVac = semesterMode === 'vacation';
        if (teacherAssignmentType === 'commute') {
            busRoutes = routes.filter(r => r.busId === busId && ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && (isVac ? (r.type === 'Morning' || r.type === 'Afternoon') : r.type === 'Afternoon'));
        } else if (teacherAssignmentType === 'afterSchool') {
            busRoutes = routes.filter(r => r.busId === busId && r.type === afterSchoolRouteType);
        } else {
            busRoutes = routes.filter(r => r.busId === busId && r.dayOfWeek === 'Saturday');
        }

        const studentIds = new Set<string>();
        busRoutes.forEach(r => {
            (r.seating || []).forEach(s => {
                if (s.studentId) studentIds.add(s.studentId);
            });
        });
        return studentIds.size;
    }, [routes, teacherAssignmentType, afterSchoolRouteType, semesterMode]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const XLSX = await import('xlsx');
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const results: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                
                const newTeachersData: NewTeacher[] = results.map((row: any) => {
                    const nameRaw = (row['선생님 이름'] || row['name'] || row['이름'] || row['Teacher Name'] || row['Teacher'] || row['선생님'] || '').toString().trim();
                    const daysStr = (row['방과후요일'] || row['days'] || row['Days'] || row['요일'] || '').toString();
                    
                    const sanitizeName = (val: string) => {
                        return val.replace(/\(.*\)/g, '').trim(); 
                    };
                    
                    const name = sanitizeName(nameRaw);
                    let afterSchoolDays: DayOfWeek[] | undefined = undefined;
                    if (daysStr && teacherAssignmentType === 'afterSchool') {
                        const dayTokens = daysStr.split(/[,/|]/).map((s: string) => s.trim());
                        const mapping: Record<string, DayOfWeek> = { '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday', '목': 'Thursday', '금': 'Friday', '토': 'Saturday' };
                        const foundDays: DayOfWeek[] = [];
                        dayTokens.forEach((tk: string) => {
                            for (const [ko, en] of Object.entries(mapping)) {
                                if (tk.includes(ko) || tk.toLowerCase().includes(en.toLowerCase())) {
                                    foundDays.push(en);
                                }
                            }
                        });
                        if (foundDays.length > 0) afterSchoolDays = Array.from(new Set(foundDays));
                    }
                    const result: NewTeacher = { name, semesterMode };
                    if (afterSchoolDays !== undefined) result.afterSchoolDays = afterSchoolDays;
                    return result;
                }).filter(teacher => teacher.name);

                if (newTeachersData.length === 0) {
                    toast({ title: t('error'), description: t('admin.teacher_management.batch.validation_error'), variant: "destructive" });
                    return;
                }
                const { dismiss } = toast({ title: t('processing'), description: t('admin.teacher_management.batch.processing') });
                try {
                    if (teacherAssignmentType === 'commute') {
                        await addTeachersInBatch(newTeachersData);
                    } else if (teacherAssignmentType === 'afterSchool') {
                        await addAfterSchoolTeachersInBatch(newTeachersData);
                    } else {
                        await addSaturdayTeachersInBatch(newTeachersData);
                    }
                    dismiss();
                    toast({ title: t('success'), description: t('admin.teacher_management.batch.success', { count: newTeachersData.length }) });
                } catch (error) {
                    dismiss();
                    toast({ title: t('error'), description: t('admin.teacher_management.batch.error'), variant: "destructive" });
                }
            } catch (err: any) {
                toast({ title: t('admin.file_parse_error'), description: err.message, variant: "destructive" });
            }
        };
        reader.readAsArrayBuffer(file);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    
    const handleDownloadTemplate = () => {
        import('xlsx').then(XLSX => {
            const headers = teacherAssignmentType === 'afterSchool' ? ["선생님 이름", "방과후요일"] : ["선생님 이름"];
            const examples = teacherAssignmentType === 'afterSchool' ? [
                ["Hong-Gildong", "월/수/금"],
                ["Kim-Cheolsu", "화목"],
                ["Jeong-Jaehyung", "전체"]
            ] : [
                ["Hong-Gildong"]
            ];
            const wsData = [headers, ...examples];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "교사_등록_템플릿");
            XLSX.writeFile(wb, `teacher_template_${teacherAssignmentType}.xlsx`);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    };

    const handleDownloadTeacherList = () => {
        if (currentTeacherPool.length === 0) {
            toast({ title: t('notice'), description: "다운로드할 교사 데이터가 없습니다." });
            return;
        }
        import('xlsx').then(XLSX => {
            const headers = ["선생님 이름"];
            const wsData = [
                headers,
                ...currentTeacherPool.map(t => [t.name])
            ];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "교사_목록");
            XLSX.writeFile(wb, `KIS_Teacher_List_${teacherAssignmentType}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    };

    const handleClearAllTeachers = async () => {
        try {
            if (teacherAssignmentType === 'commute') {
                await clearTeachers();
            } else if (teacherAssignmentType === 'afterSchool') {
                await clearAfterSchoolTeachers();
            } else {
                await clearSaturdayTeachers();
            }
            setSelectedTeacherIds(new Set());
            toast({ title: t('success'), description: "모든 교사 정보가 삭제되었습니다." });
        } catch (error) {
            toast({ title: t('error'), description: "교사 정보 삭제 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleToggleTeacherSelection = (teacherId: string, checked: boolean) => {
        setSelectedTeacherIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(teacherId);
            else next.delete(teacherId);
            return next;
        });
    };

    const handleToggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedTeacherIds(new Set(currentTeacherPool.map(t => t.id)));
        } else {
            setSelectedTeacherIds(new Set());
        }
    };

    const handleDeleteSelectedTeachers = async () => {
        const ids = Array.from(selectedTeacherIds);
        if (ids.length === 0) return;

        const { dismiss } = toast({ title: t('processing'), description: t('admin.teacher_management.batch.processing') });
        try {
            if (teacherAssignmentType === 'commute') {
                await deleteTeachersInBatch(ids);
            } else if (teacherAssignmentType === 'afterSchool') {
                await deleteAfterSchoolTeachersInBatch(ids);
            } else {
                await deleteSaturdayTeachersInBatch(ids);
            }
            setSelectedTeacherIds(new Set());
            dismiss();
            toast({ title: t('success'), description: t('admin.teacher_management.delete_success_count', { count: ids.length }) });
        } catch (error) {
            dismiss();
            toast({ title: t('error'), description: t('admin.teacher_management.delete.error'), variant: 'destructive' });
        }
    };

    const getAssignedTeachers = (busId: string) => {
        let busRoutes: Route[] = [];
        if (teacherAssignmentType === 'commute') {
            busRoutes = routes.filter(r => r.busId === busId && ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && r.type === 'Afternoon');
        } else if (teacherAssignmentType === 'afterSchool') {
            // 방과후는 요일별로 다른 교사가 배정되므로, 별도의 getAfterSchoolTeachersPerDay를 사용합니다.
            // 이 함수는 commute/saturday 전용으로만 사용합니다.
            busRoutes = [];
        } else {
            busRoutes = routes.filter(r => r.busId === busId && r.dayOfWeek === 'Saturday');
        }

        const teacherIds = Array.from(new Set(busRoutes.flatMap(r => r.teacherIds || [])));
        return teacherIds.map(id => {
            const t = allTeachersPool.find(tp => tp.id === id);
            return { id, name: t?.name || 'Unknown' };
        }).filter(t => t.name !== 'Unknown')
          .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    };

    const isBusUnassigned = (busId: string, isOperational: boolean) => {
        if (!isOperational) return false;
        
        if (teacherAssignmentType === 'afterSchool') {
            const days = afterSchoolDaysList;
            // Check if there is any active route for this bus on any day that has NO teachers assigned
            const hasUnassignedRoute = routes.some(r => 
                r.busId === busId && 
                r.type === afterSchoolRouteType && 
                days.includes(r.dayOfWeek) &&
                (r.stops?.length ?? 0) > 0 && 
                (!r.teacherIds || r.teacherIds.filter(Boolean).length === 0)
            );
            return hasUnassignedRoute;
        } else {
            const assignedTeachers = getAssignedTeachers(busId);
            return assignedTeachers.length === 0;
        }
    };

    // 방과후 전용: 요일별 담당 교사 목록을 반환합니다.
    const getAfterSchoolTeachersPerDay = (busId: string): Record<string, { id: string; name: string }[]> => {
        const days = afterSchoolDaysList;
        const result: Record<string, { id: string; name: string }[]> = {};
        days.forEach(day => {
            const route = routes.find(r => r.busId === busId && r.dayOfWeek === day && r.type === afterSchoolRouteType);
            if (route && route.teacherIds && route.teacherIds.length > 0) {
                result[day] = route.teacherIds
                    .map(id => {
                        const t = allTeachersPool.find(tp => tp.id === id);
                        return t ? { id: t.id, name: t.name } : null;
                    })
                    .filter(Boolean) as { id: string; name: string }[];
            } else {
                result[day] = [];
            }
        });
        return result;
    };

    const handleUnassignTeacher = async (busId: string, teacherId: string) => {
        let routesToUpdate: Route[] = [];
        const isVac = semesterMode === 'vacation';
        if (teacherAssignmentType === 'commute') {
            if (isVac) {
                routesToUpdate = routes.filter(r => r.busId === busId && ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && (r.type === 'Morning' || r.type === 'Afternoon'));
            } else {
                routesToUpdate = routes.filter(r => r.busId === busId && ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && r.type === 'Afternoon');
            }
        } else if (teacherAssignmentType === 'afterSchool') {
            routesToUpdate = routes.filter(r => r.busId === busId && r.type === afterSchoolRouteType);
        } else {
            routesToUpdate = routes.filter(r => r.busId === busId && r.dayOfWeek === 'Saturday');
        }

        if (routesToUpdate.length === 0) return;

        try {
            const batch = writeBatch(db());
            routesToUpdate.forEach(route => {
                const newIds = (route.teacherIds || []).filter(id => id !== teacherId);
                if (newIds.length !== (route.teacherIds || []).length) {
                    batch.update(doc(db(), 'routes', route.id), { teacherIds: newIds });
                }
            });
            await batch.commit();
            toast({ title: t('success'), description: "교사 배정이 해제되었습니다." });
        } catch (error) {
            toast({ title: t('error'), description: "배정 해제 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    // 방과후 전용: 특정 요일의 노선에서만 교사를 해제합니다.
    const handleUnassignTeacherForDay = async (busId: string, teacherId: string, day: DayOfWeek) => {
        const route = routes.find(r => r.busId === busId && r.dayOfWeek === day && r.type === afterSchoolRouteType);
        if (!route) return;
        const newIds = (route.teacherIds || []).filter((id: string) => id !== teacherId);
        try {
            const batch = writeBatch(db());
            batch.update(doc(db(), 'routes', route.id), { teacherIds: newIds });
            await batch.commit();
            toast({ title: t('success'), description: `${t(`day_short.${day.toLowerCase()}`)} 요일 배정이 해제되었습니다.` });
        } catch (error) {
            toast({ title: t('error'), description: '배정 해제 중 오류가 발생했습니다.', variant: 'destructive' });
        }
    };

    const getTeachersForBus = (busId: string) => {
        if (teacherAssignmentType === 'afterSchool') {
            // 방학 중에는 모든 요일 교사가 같으므로 월요일 교사를 대표로 한 번만 출력
            if (semesterMode === 'vacation') {
                const route = routes.find(r => r.busId === busId && r.dayOfWeek === 'Monday' && r.type === 'Afternoon');
                if (route && route.teacherIds && route.teacherIds.length > 0) {
                    const names = route.teacherIds
                        .map(id => allTeachersPool.find(t => t.id === id)?.name)
                        .filter(Boolean);
                    return names.length > 0 ? names.join('/') : t('unassigned');
                }
                return t('unassigned');
            }

            const days = afterSchoolDaysList;
            const summaryParts: string[] = [];
            
            days.forEach(day => {
                const route = routes.find(r => r.busId === busId && r.dayOfWeek === day && r.type === afterSchoolRouteType);
                if (route && route.teacherIds && route.teacherIds.length > 0) {
                    const names = route.teacherIds
                        .map(id => allTeachersPool.find(t => t.id === id)?.name)
                        .filter(Boolean);
                    if (names.length > 0) {
                        summaryParts.push(`${t(`day_short.${day.toLowerCase()}`)}: ${names.join('/')}`);
                    }
                }
            });
            
            return summaryParts.length > 0 ? summaryParts.join(' | ') : t('unassigned');
        } else {
            const dayKey = teacherAssignmentType === 'commute' ? 'Monday' : 'Saturday';
            const relevantRouteType = teacherAssignmentType === 'commute' ? 'Afternoon' : 'Morning'; // Morning for Sat check is fine, or just filter by day
            const relevantRoute = routes.find(r => r.busId === busId && r.dayOfWeek === dayKey && (teacherAssignmentType === 'commute' ? r.type === 'Afternoon' : true));
            if (!relevantRoute || !relevantRoute.teacherIds) return t('unassigned');
            const names = relevantRoute.teacherIds.map(id => allTeachersPool.find(t => t.id === id)?.name).filter(Boolean);
            return names.length > 0 ? names.join(', ') : t('unassigned');
        }
    };

    const handleBatchAssignTeachers = async () => {
        if (currentTeacherPool.length === 0) {
            toast({ title: t('error'), description: t('admin.teacher_assignment.assign.no_teacher_error'), variant: 'destructive' });
            return;
        }

        const batch = writeBatch(db());
        const backup: Record<string, string[]> = {};
        const daysToAssign: DayOfWeek[] = teacherAssignmentType === 'commute' 
            ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] 
            : afterSchoolDaysList;

        const isVac = semesterMode === 'vacation';

        // Backup current assignments
        routes.filter(r => daysToAssign.includes(r.dayOfWeek) && (
            isVac 
                ? (r.type === 'Morning' || r.type === 'Afternoon')
                : (r.type === (teacherAssignmentType === 'commute' ? 'Afternoon' : afterSchoolRouteType))
        ))
            .forEach(r => { backup[r.id] = r.teacherIds || []; });
        setPreviousRouteAssignments(backup);

        if (teacherAssignmentType === 'commute' || teacherAssignmentType === 'saturday' || isVac) {
            const targetBuses = sortBuses(buses.filter(bus => !bus.excludeFromAssignment && (bus.isActive ?? true) && isBusOperational(bus.id)));
            if (targetBuses.length === 0) {
                toast({ title: t('notice'), description: t('admin.teacher_assignment.assign.no_operational_buses') });
                return;
            }

            // 버스별 실제 탑승 학생 수 계산
            const getBusStudentCount = (busId: string): number => {
                let busRoutes: Route[] = [];
                if (teacherAssignmentType === 'commute') {
                    busRoutes = routes.filter(r => r.busId === busId && ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && (isVac ? (r.type === 'Morning' || r.type === 'Afternoon') : r.type === 'Afternoon'));
                } else if (teacherAssignmentType === 'afterSchool') {
                    busRoutes = routes.filter(r => r.busId === busId && r.type === afterSchoolRouteType);
                } else {
                    busRoutes = routes.filter(r => r.busId === busId && r.dayOfWeek === 'Saturday');
                }

                const studentIds = new Set<string>();
                busRoutes.forEach(r => {
                    (r.seating || []).forEach(s => {
                        if (s.studentId) studentIds.add(s.studentId);
                    });
                });
                return studentIds.size;
            };

            const busStudentCounts = new Map<string, number>();
            targetBuses.forEach(b => busStudentCounts.set(b.id, getBusStudentCount(b.id)));

            // 탑승 학생 수가 많은 순(내림차순)으로 정렬 (동점 시 인승 큰 순 -> 버스 이름순)
            const busesSortedByStudents = [...targetBuses].sort((a, b) => {
                const countA = busStudentCounts.get(a.id) || 0;
                const countB = busStudentCounts.get(b.id) || 0;
                if (countB !== countA) return countB - countA; // 학생 수 많은 순 우선
                if ((b.capacity || 0) !== (a.capacity || 0)) return (b.capacity || 0) - (a.capacity || 0); // 인승 큰 순
                return a.name.localeCompare(b.name, undefined, { numeric: true });
            });

            const availableTeachers = [...currentTeacherPool].filter(t => !excludedFromAssignmentIds.has(t.id)).sort(() => Math.random() - 0.5);
            let teacherIndex = 0;

            const busAssignedMap = new Map<string, string[]>();
            targetBuses.forEach(b => busAssignedMap.set(b.id, []));

            // [1단계] 모든 운행 버스에 1명씩 기본 배정 (학생 수 많은 순)
            for (const bus of busesSortedByStudents) {
                if (teacherIndex < availableTeachers.length) {
                    busAssignedMap.get(bus.id)!.push(availableTeachers[teacherIndex++].id);
                }
            }

            // [2단계] 남은 여유 교사가 있을 경우, 탑승 학생 수가 많은 순서대로 2번째 교사 우선 배정
            let twoTeacherBusesCount = 0;
            for (const bus of busesSortedByStudents) {
                if (teacherIndex >= availableTeachers.length) break;
                if (busAssignedMap.get(bus.id)!.length === 1) {
                    busAssignedMap.get(bus.id)!.push(availableTeachers[teacherIndex++].id);
                    twoTeacherBusesCount++;
                }
            }

            // 각 버스 노선에 업데이트 적용
            for (const bus of targetBuses) {
                const assignedIds = busAssignedMap.get(bus.id) || [];
                routes.filter(r => r.busId === bus.id && (
                    isVac 
                        ? daysToAssign.includes(r.dayOfWeek) && (r.type === 'Morning' || r.type === 'Afternoon')
                        : (teacherAssignmentType === 'commute' ? daysToAssign.includes(r.dayOfWeek) && r.type === 'Afternoon' : r.dayOfWeek === 'Saturday')
                ))
                .forEach(r => batch.update(doc(db(), 'routes', r.id), { teacherIds: assignedIds }));
            }
        } else {
            // After-School logic: Day by Day
            for (const day of daysToAssign) {
                const dayRoutes = routes.filter(r => r.dayOfWeek === day && r.type === afterSchoolRouteType && (r.stops?.length ?? 0) > 0);
                const dayBuses = sortBuses(buses.filter(b => !b.excludeFromAssignment && (b.isActive ?? true) && dayRoutes.some(r => r.busId === b.id)));
                
                // Available teachers for this specific day (excluding manually excluded ones)
                const dayPool = filteredAfterSchoolTeachers.filter(t => !excludedFromAssignmentIds.has(t.id) && (!t.afterSchoolDays || t.afterSchoolDays.includes(day)));
                const shuffledTeachers = [...dayPool].sort(() => Math.random() - 0.5);
                
                let teacherIndex = 0;
                for (const bus of dayBuses) {
                    const assignedIds: string[] = [];
                    // Slot 1 (1-5 weeks)
                    if (teacherIndex < shuffledTeachers.length) assignedIds.push(shuffledTeachers[teacherIndex++].id);
                    // Slot 2 (6-10 weeks)
                    if (teacherIndex < shuffledTeachers.length) assignedIds.push(shuffledTeachers[teacherIndex++].id);
                    
                    const route = dayRoutes.find(r => r.busId === bus.id);
                    if (route) {
                        batch.update(doc(db(), 'routes', route.id), { teacherIds: assignedIds });
                    }
                }
            }
        }

        try {
            await batch.commit();
            toast({ title: t('success'), description: t('admin.teacher_assignment.assign.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.teacher_assignment.assign.error'), variant: 'destructive' });
        }
    };

    const handleRestoreAssignments = async () => {
        if (!previousRouteAssignments) return;
        const batch = writeBatch(db());
        Object.entries(previousRouteAssignments).forEach(([routeId, teacherIds]) => {
            batch.update(doc(db(), 'routes', routeId), { teacherIds });
        });
        try {
            await batch.commit();
            setPreviousRouteAssignments(null);
            toast({ title: t('success'), description: t('admin.teacher_assignment.undo_success') });
        } catch (error) {
            toast({ title: t('error'), description: "복구 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleUnassignAllTeachers = async () => {
        let routesToClear: Route[] = [];
        const isVac = semesterMode === 'vacation';
        if (teacherAssignmentType === 'commute') {
            if (isVac) {
                routesToClear = routes.filter(r => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && (r.type === 'Morning' || r.type === 'Afternoon'));
            } else {
                routesToClear = routes.filter(r => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && r.type === 'Afternoon');
            }
        } else if (teacherAssignmentType === 'afterSchool') {
            routesToClear = routes.filter(r => r.type === afterSchoolRouteType);
        } else {
            routesToClear = routes.filter(r => r.dayOfWeek === 'Saturday');
        }
        if (routesToClear.length === 0) return;
        const batch = writeBatch(db());
        routesToClear.forEach(route => batch.update(doc(db(), 'routes', route.id), { teacherIds: [] }));
        try {
            await batch.commit();
            toast({ title: t('success'), description: t('admin.teacher_assignment.reset.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.teacher_assignment.reset.error'), variant: 'destructive' });
        }
    };
    
    const handleManualAssignClick = (bus: Bus) => {
        setSelectedBusForTeacher(bus);
        setIsTeacherDialogOpen(true);
    };

    const handleToggleBusExcludeAssignment = async (bus: Bus) => {
        try {
            const newExclude = !(bus.excludeFromAssignment ?? false);
            await updateBus(bus.id, { excludeFromAssignment: newExclude });
            toast({ title: t('success'), description: `"${bus.name}" 버스 배정 제외 상태가 ${newExclude ? '설정' : '해제'}되었습니다.` });
        } catch (error) {
            toast({ title: t('error'), description: "상태 변경 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleDownloadAssignments = useCallback(() => {
        import('xlsx').then(XLSX => {
            const sorted = sortBuses(buses);
            const headers = ["버스 번호", "타입", "담당 교사", "운행 노선", "상태"];
            
            const rows = sorted.map(bus => {
                const isOperational = isBusOperational(bus.id);
                const teachersStr = getTeachersForBus(bus.id);
                
                const relevantRouteType = teacherAssignmentType === 'commute' ? 'Afternoon' : afterSchoolRouteType;
                const route = routes.find(r => r.busId === bus.id && r.dayOfWeek === 'Monday' && r.type === relevantRouteType);
                const routePath = (route?.stops || [])
                    .map(id => destinations.find(d => d.id === id)?.name)
                    .filter(Boolean)
                    .join(' -> ');

                const statusStr = !(bus.isActive ?? true) ? "비활성" : (bus.excludeFromAssignment ? "배정제외" : (isOperational ? "운행중" : "운행없음"));
                
                return [
                    bus.name,
                    t(`bus_type.${bus.type}`),
                    teachersStr,
                    routePath || "",
                    statusStr
                ];
            });

            const wsData = [headers, ...rows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            const categoryName = teacherAssignmentType === 'commute' ? "하교" : "방과후";
            XLSX.utils.book_append_sheet(wb, ws, "배정현황");
            XLSX.writeFile(wb, `KIS_Bus_Teacher_Assignments_${categoryName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    }, [buses, teacherAssignmentType, isBusOperational, t, routes, destinations, getTeachersForBus, afterSchoolRouteType]);

    useEffect(() => {
        setSelectedTeacherIds(new Set());
        setPreviousRouteAssignments(null);
    }, [teacherAssignmentType]);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Users className="h-6 w-6 text-primary" />
                    <CardTitle className="font-headline">{t('admin.teacher_management.title')}</CardTitle>
                </div>
                <CardDescription>{t('admin.teacher_management.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="flex flex-col gap-4">
                    {semesterMode !== 'vacation' && (
                        <Tabs value={teacherAssignmentType} onValueChange={(v) => {
                            setTeacherAssignmentType(v as any);
                            setSelectedTeacherIds(new Set());
                        }} className="w-full">
                            <TabsList className="grid grid-cols-4 max-w-xl">
                                <TabsTrigger value="commute">{t('route_type.commute')}</TabsTrigger>
                                <TabsTrigger value="afterSchool">{t('route_type.AfterSchool')}</TabsTrigger>
                                <TabsTrigger value="saturday">토요일</TabsTrigger>
                                <TabsTrigger value="morningGate">등교 지도</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    )}

                    <TeacherPinSettings />
                </div>

                {teacherAssignmentType === 'morningGate' ? (
                    <MorningGateDutyTab teachers={allTeachersPool} semesterMode={semesterMode} />
                ) : (
                    <>
                        <div className="space-y-4 border rounded-xl p-4 bg-muted/30">
                        {/* 1. 상단 제목 & 요일 필터 박스 (헤더 상단 한 줄 나란히 배치) */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 whitespace-nowrap">
                                    {semesterMode === 'vacation' 
                                        ? "방학 중 방과후 담당 교사 명단" 
                                        : (teacherAssignmentType === 'commute' ? "등하교 담당 교사 명단" : 
                                           teacherAssignmentType === 'afterSchool' ? "방과후 담당 교사 명단" : 
                                           "토요일 담당 교사 명단")}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    담당 교사 목록을 확인하고 요일별 배정 및 교사 정보를 관리합니다.
                                </p>
                            </div>

                            {/* 요일 필터 박스 (제목 우측 상단 나란히 배치) */}
                            {teacherAssignmentType === 'afterSchool' && (
                                <div className="flex items-center gap-2 bg-indigo-50/80 border border-indigo-200/80 p-1.5 rounded-xl shrink-0">
                                    <span className="text-xs font-bold text-indigo-950 px-1 whitespace-nowrap">요일 필터:</span>
                                    <div className="flex items-center gap-1">
                                        {afterSchoolFilterDays.map(d => (
                                            <Button 
                                                key={d} 
                                                variant={afterSchoolPoolDayFilter === d ? "default" : "ghost"} 
                                                size="sm" 
                                                className={cn(
                                                    "h-7 text-xs px-2.5 rounded-lg font-bold transition",
                                                    afterSchoolPoolDayFilter === d ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:bg-white"
                                                )}
                                                onClick={() => setAfterSchoolPoolDayFilter(d)}
                                            >
                                                {d === 'All' ? '전체' : t(`day_short.${d.toLowerCase()}`)}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2. 버튼 그룹 (7개 버튼 한 줄로 나란히 배치) */}
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center justify-end w-full">
                            <TeacherAddDialog type={teacherAssignmentType} semesterMode={semesterMode} />
                            <Button variant="outline" size="sm" onClick={handleDownloadTeacherList} className="h-8 text-xs px-2.5 whitespace-nowrap"><Download className="mr-1.5 h-3.5 w-3.5" /> 목록 다운로드</Button>
                            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="h-8 text-xs px-2.5 whitespace-nowrap"><Download className="mr-1.5 h-3.5 w-3.5" /> {t('admin.teacher_management.template')}</Button>
                            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 text-xs px-2.5 whitespace-nowrap"><Upload className="mr-1.5 h-3.5 w-3.5" /> {t('batch_upload')}</Button>
                            {teacherAssignmentType === 'afterSchool' && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setIsBatchEditDaysOpen(true)} 
                                    disabled={selectedTeacherIds.size === 0}
                                    className="h-8 text-xs px-2.5 whitespace-nowrap"
                                >
                                    요일 일괄 변경
                                </Button>
                            )}
                            
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 text-xs px-2.5 whitespace-nowrap text-destructive border-destructive hover:bg-destructive/10" disabled={selectedTeacherIds.size === 0}>
                                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> {t('delete_selected')}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>{t('confirm')}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {t('admin.teacher_management.delete_selected.confirm_description', { count: selectedTeacherIds.size })}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteSelectedTeachers}>{t('delete')}</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" className="h-8 text-xs px-2.5 whitespace-nowrap"><Trash2 className="mr-1.5 h-3.5 w-3.5" /> {t('delete_all')}</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>{t('admin.teacher_management.delete_all.confirm_title')}</AlertDialogTitle>
                                        <AlertDialogDescription>{t('admin.teacher_management.delete_all.confirm_description')}</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleClearAllTeachers}>{t('delete')}</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx" className="hidden" />
                        </div>

                        {/* Alerts for unassigned/double-assigned teachers (가로 100% 전체 영역 활용) */}
                        {(teacherValidation.unassigned.length > 0 || teacherValidation.doubleAssigned.length > 0) && (
                            <div className="flex flex-col gap-2.5 mb-4 w-full">
                                {teacherValidation.unassigned.length > 0 && (
                                    <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/90 w-full shadow-xs">
                                        <div className="flex items-center gap-2 text-amber-900 font-bold mb-1">
                                            <Badge variant="outline" className="bg-amber-200/90 text-amber-900 border-none font-bold px-2 py-0.5 whitespace-nowrap">미배정</Badge>
                                            <span className="text-xs sm:text-sm whitespace-nowrap">{teacherValidation.unassigned.length}명의 교사가 버스에 배정되지 않았습니다.</span>
                                        </div>
                                        <p className="text-xs text-amber-800 font-medium leading-relaxed">
                                            {teacherValidation.unassigned.map(t => t.name).join(', ')}
                                        </p>
                                    </div>
                                )}
                                {teacherValidation.doubleAssigned.length > 0 && (
                                    <div className="p-3.5 rounded-xl bg-rose-50/90 border border-rose-200/90 w-full shadow-xs">
                                        <div className="flex items-center gap-2 text-rose-900 font-bold mb-1">
                                            <Badge variant="outline" className="bg-rose-200/90 text-rose-900 border-none font-bold px-2 py-0.5 whitespace-nowrap">이중배정</Badge>
                                            <span className="text-xs sm:text-sm whitespace-nowrap">{teacherValidation.doubleAssigned.length}명의 교사가 여러 버스에 중복 배정되었습니다.</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-xs text-rose-800">
                                            {teacherValidation.doubleAssigned.map((item, idx) => (
                                                <span key={idx} className="bg-white/80 px-2 py-0.5 rounded border border-rose-200 font-medium whitespace-nowrap">
                                                    {item.teacher.name}: {item.buses.join(', ')}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="border rounded-xl max-h-[300px] overflow-y-auto bg-background shadow-xs">
                            <Table>
                                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-2xs">
                                    <TableRow>
                                        <TableHead className="w-[50px] whitespace-nowrap">
                                            <Checkbox 
                                                checked={selectedTeacherIds.size === currentTeacherPool.length && currentTeacherPool.length > 0}
                                                onCheckedChange={handleToggleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead className="whitespace-nowrap font-bold text-slate-700">{t('admin.teacher_management.teacher_name')}</TableHead>
                                        {teacherAssignmentType === 'afterSchool' && <TableHead className="whitespace-nowrap font-bold text-slate-700">담당 가능 요일</TableHead>}
                                        <TableHead className="text-center font-bold text-xs text-orange-600 whitespace-nowrap">재배정 제외</TableHead>
                                        <TableHead className="text-right whitespace-nowrap font-bold text-slate-700">{t('actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedTeachersList.length > 0 ? (
                                        sortedTeachersList.map(teacher => (
                                            <TableRow key={teacher.id} className={excludedFromAssignmentIds.has(teacher.id) ? 'opacity-50 bg-orange-50/30' : ''}>
                                                <TableCell className="whitespace-nowrap">
                                                    <Checkbox 
                                                        checked={selectedTeacherIds.has(teacher.id)}
                                                        onCheckedChange={(checked) => handleToggleTeacherSelection(teacher.id, checked as boolean)}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium whitespace-nowrap">{teacher.name}</TableCell>
                                                {teacherAssignmentType === 'afterSchool' && (
                                                    <TableCell className="whitespace-nowrap">
                                                        <div className="flex gap-1 flex-wrap">
                                                            {teacher.afterSchoolDays?.map(day => (
                                                                <Badge key={day} variant="outline" className="text-[10px] py-0 whitespace-nowrap">{t(`day_short.${day.toLowerCase()}`)}</Badge>
                                                            )) || <span className="text-xs text-muted-foreground italic whitespace-nowrap">전체</span>}
                                                        </div>
                                                    </TableCell>
                                                )}
                                                <TableCell className="text-center whitespace-nowrap">
                                                    <Checkbox
                                                        checked={excludedFromAssignmentIds.has(teacher.id)}
                                                        onCheckedChange={() => handleToggleExcludeFromAssignment(teacher.id)}
                                                        className="border-orange-400 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right whitespace-nowrap">
                                                    <TeacherEditDialog 
                                                        teacher={teacher} 
                                                        type={teacherAssignmentType}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={teacherAssignmentType === 'afterSchool' ? 4 : 3} className="text-center py-8 text-muted-foreground">
                                                등록된 교사가 없습니다.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <Separator />

                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h3 className="text-lg font-semibold">{t('admin.teacher_assignment.title')} (명단 기반)</h3>
                        <div className="flex gap-2 w-full md:w-auto flex-wrap">
                            <Button variant="outline" size="sm" onClick={handleDownloadAssignments} className="flex-1 sm:flex-none">
                                <Download className="mr-2 h-4 w-4"/> 배정 현황 다운로드
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleBatchAssignTeachers} className="flex-1 sm:flex-none">
                                <UserCog className="mr-2 h-4 w-4"/>{t('admin.teacher_assignment.reassign')}
                            </Button>
                            {previousRouteAssignments && (
                                <Button variant="outline" size="sm" onClick={handleRestoreAssignments} className="flex-1 sm:flex-none text-blue-600 border-blue-200 hover:bg-blue-50">
                                    <Undo2 className="mr-2 h-4 w-4"/>{t('admin.teacher_assignment.undo')}
                                </Button>
                            )}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive/10 flex-1 sm:flex-none">
                                        <UserX className="mr-2 h-4 w-4"/>{t('reset')}</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>{t('admin.teacher_assignment.reset.confirm_title')}</AlertDialogTitle>
                                        <AlertDialogDescription>{t('admin.teacher_assignment.reset.confirm_description')}</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleUnassignAllTeachers}>{t('confirm')}</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>배정 제외</TableHead>
                                    <TableHead>{t('admin.bus_registration.bus_number')}</TableHead>
                                    <TableHead>{t('type')}</TableHead>
                                    {teacherAssignmentType === 'afterSchool' && semesterMode !== 'vacation' ? (
                                        afterSchoolDaysList.map(day => (
                                            <TableHead key={day} className="text-center whitespace-nowrap">{t(`day_short.${day.toLowerCase()}`)}</TableHead>
                                        ))
                                    ) : (
                                        <TableHead>{t('admin.teacher_assignment.title')}</TableHead>
                                    )}
                                    <TableHead className="text-right">{t('actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortBuses(buses, isBusOperational).map(bus => {
                                    const isOperational = isBusOperational(bus.id);
                                    const isUnassigned = isBusUnassigned(bus.id, isOperational);
                                    const isActive = bus.isActive ?? true;

                                    return (
                                        <TableRow key={bus.id} className={cn(
                                            !isActive && "text-muted-foreground bg-muted/20 opacity-70",
                                            isActive && !isOperational && "bg-red-50/20",
                                            isActive && isOperational && isUnassigned && "bg-orange-50/20"
                                        )}>
                                            <TableCell>
                                                <Switch
                                                    checked={bus.excludeFromAssignment ?? false}
                                                    onCheckedChange={() => handleToggleBusExcludeAssignment(bus)}
                                                    aria-label="Toggle bus assignment exclude state"
                                                />
                                            </TableCell>
                                            <TableCell className={cn(
                                                "font-bold whitespace-nowrap",
                                                !isOperational && isActive && "text-red-500",
                                                isUnassigned && isActive && "text-red-600"
                                            )}>
                                                {bus.name}
                                                {isActive && !isOperational && (
                                                    <Badge variant="outline" className="ml-2 text-[10px] py-0 h-4 border-red-300 text-red-700 bg-red-50">운행없음</Badge>
                                                )}
                                                {isActive && isOperational && isUnassigned && (
                                                    <Badge variant="outline" className="ml-2 text-[10px] py-0 h-4 border-orange-300 text-orange-700 bg-orange-50">교사미배정</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span>{t(`bus_type.${bus.type}`)}</span>
                                                    {isOperational && (
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-semibold text-slate-600 bg-slate-50 border-slate-200 whitespace-nowrap">
                                                            탑승 {getBusPassengerCount(bus.id)}명
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            {teacherAssignmentType === 'afterSchool' && semesterMode !== 'vacation' ? (
                                                // 방과후: 요일별로 담당 교사 표시 (최대 2명)
                                                afterSchoolDaysList.map(day => {
                                                    const perDay = getAfterSchoolTeachersPerDay(bus.id);
                                                    const dayTeachers = perDay[day] || [];
                                                    return (
                                                        <TableCell key={day} className="text-center">
                                                            {dayTeachers.length === 0 ? (
                                                                <span className="text-muted-foreground italic text-xs">-</span>
                                                            ) : (
                                                                <div className="flex flex-col gap-0.5 items-center">
                                                                    {dayTeachers.map((teacher, i) => (
                                                                        <Badge key={i} variant="secondary" className="font-normal text-[10px] flex items-center gap-1 pr-1 group whitespace-nowrap">
                                                                            {teacher.name}
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleUnassignTeacherForDay(bus.id, teacher.id, day); }}
                                                                                className="h-3 w-3 hover:bg-muted-foreground/30 rounded-full flex items-center justify-center transition-colors focus:outline-none"
                                                                                title={t('unassign')}
                                                                            >
                                                                                <X className="h-2 w-2" />
                                                                            </button>
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    );
                                                })
                                            ) : (
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(() => {
                                                            const assignedTeachers = semesterMode === 'vacation' 
                                                                ? (() => {
                                                                    const route = routes.find(r => r.busId === bus.id && r.dayOfWeek === 'Monday' && r.type === 'Afternoon');
                                                                    return (route?.teacherIds || []).map(id => allTeachersPool.find(t => t.id === id)).filter(Boolean) as Teacher[];
                                                                })()
                                                                : getAssignedTeachers(bus.id);
                                                                
                                                            if (assignedTeachers.length === 0) {
                                                                return <span className="text-muted-foreground italic text-xs">{t('unassigned')}</span>;
                                                            }
                                                            return assignedTeachers.map((teacher, i) => (
                                                                <Badge key={i} variant="secondary" className="font-normal text-xs flex items-center gap-1 pr-1 group">
                                                                    {teacher.name}
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleUnassignTeacher(bus.id, teacher.id);
                                                                        }}
                                                                        className="h-3 w-3 hover:bg-muted-foreground/30 rounded-full flex items-center justify-center transition-colors focus:outline-none"
                                                                        title={t('unassign')}
                                                                    >
                                                                        <X className="h-2 w-2" />
                                                                    </button>
                                                                </Badge>
                                                            ));
                                                        })()}
                                                    </div>
                                                </TableCell>
                                            )}
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleManualAssignClick(bus)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </>
        )}
    </CardContent>

            {selectedBusForTeacher && (
              <Dialog open={isTeacherDialogOpen} onOpenChange={setIsTeacherDialogOpen}>
                <TeacherAssignmentDialog 
                    targetBus={selectedBusForTeacher} 
                    allRoutes={routes} 
                    teachers={semesterMode === 'vacation' ? allTeachersPool : currentTeacherPool} 
                    assignmentType={teacherAssignmentType}
                    onOpenChange={setIsTeacherDialogOpen} 
                    semesterMode={semesterMode}
                />
              </Dialog>
            )}

            <TeacherBatchEditDaysDialog 
                isOpen={isBatchEditDaysOpen}
                onOpenChange={setIsBatchEditDaysOpen}
                selectedIds={selectedTeacherIds}
                onSuccess={() => setSelectedTeacherIds(new Set())}
            />
        </Card>
    );
};

