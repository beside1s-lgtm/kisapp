'use client';

import React, { useState, useMemo, useRef } from 'react';
import { getKisbusDb as db } from '@/lib/kisbus/firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { 
    addAfterSchoolClass, 
    updateAfterSchoolClass, 
    deleteAfterSchoolClass, 
    addAfterSchoolClassesInBatch,
    clearAllAfterSchoolClasses,
    addTeacher,
    updateStudent,
    updateGlobalSettings
} from '@/lib/kisbus';
import type { 
    AfterSchoolClass, 
    Student, 
    Bus, 
    Route, 
    Teacher, 
    DayOfWeek,
    NewAfterSchoolClass, 
    Destination
} from '@/lib/kisbus/types';
import { onAfterschoolEnrollmentsUpdate } from '@/lib/services/settingsService';
import type { Enrollment } from '@/lib/afterschool/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { 
    PlusCircle, 
    Download, 
    Upload, 
    Trash2, 
    Search, 
    Users, 
    FileText, 
    GraduationCap,
    Calendar,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Loader2,
    UserPlus,
    Bus as BusIcon
} from 'lucide-react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger, 
    DialogFooter, 
    DialogDescription 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { getStudentName, normalizeString, cn } from '@/lib/kisbus/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AfterSchoolManagementTabProps {
    afterSchoolClasses: AfterSchoolClass[];
    students: Student[];
    buses: Bus[];
    routes: Route[];
    teachers: Teacher[];
    afterSchoolTeachers: Teacher[];
    destinations: Destination[];
    semesterMode: 'regular' | 'vacation';
}

export const AfterSchoolManagementTab = ({
    afterSchoolClasses,
    students,
    buses,
    routes,
    teachers,
    afterSchoolTeachers,
    destinations,
    semesterMode
}: AfterSchoolManagementTabProps) => {
    const { toast } = useToast();
    const { t, i18n } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isAddClassDialogOpen, setIsAddClassDialogOpen] = useState(false);
    const [newClass, setNewClass] = useState<Partial<NewAfterSchoolClass>>({
        name: '',
        dayOfWeek: 'Monday',
        teacherId: '',
        teacherName: '',
        teacherId2: '',
        teacherName2: ''
    });

    const [currentViewMode, setCurrentViewMode] = useState<'regular' | 'vacation'>('regular');
    const [editingClass, setEditingClass] = useState<AfterSchoolClass | null>(null);
    const [isEditClassDialogOpen, setIsEditClassDialogOpen] = useState(false);
    const [isClassListExpanded, setIsClassListExpanded] = useState(false);

    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    React.useEffect(() => {
        const unsub = onAfterschoolEnrollmentsUpdate(setEnrollments);
        return () => unsub();
    }, []);

    const getFourTeachers = (c: AfterSchoolClass) => {
        const rawNames: string[] = [];
        [c.teacherName, c.teacherName2, c.teacherName3, c.teacherName4].forEach(tn => {
            if (tn) {
                tn.split(',').forEach(sub => {
                    const trimmed = sub.trim();
                    if (trimmed && !rawNames.includes(trimmed)) {
                        rawNames.push(trimmed);
                    }
                });
            }
        });

        return [
            rawNames[0] || '-',
            rawNames[1] || '-',
            rawNames[2] || '-',
            rawNames[3] || '-',
        ];
    };

    React.useEffect(() => {
        setCurrentViewMode(semesterMode);
        if (semesterMode === 'vacation') {
            setSelectedDay('all');
        }
    }, [semesterMode]);

    const allTeachers = useMemo(() => {
        const map = new Map<string, Teacher>();
        teachers.forEach(t => map.set(t.id, t));
        afterSchoolTeachers.forEach(t => map.set(t.id, t));
        return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    }, [teachers, afterSchoolTeachers]);

    // Filtering for inquiry
    const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>('all');
    const [selectedTeacherId, setSelectedTeacherId] = useState<string | 'all'>('all');
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [classSearchQuery, setClassSearchQuery] = useState('');
    const [studentNameQuery, setStudentNameQuery] = useState('');
    const [searchBusRidersOnly, setSearchBusRidersOnly] = useState(false);
    const [showBusRidersOnly, setShowBusRidersOnly] = useState(false);

    const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
    const [addStudentSearchQuery, setAddStudentSearchQuery] = useState('');
    const [selectedStudentToAddId, setSelectedStudentToAddId] = useState<string | null>(null);

    // 학생 이름 검색 시 해당 학생이 등록된 수업 ID 목록 계산 (버스 탑승자만 필터 지원)
    const classIdsForStudentSearch = useMemo(() => {
        if (!studentNameQuery.trim() && !searchBusRidersOnly) return null;
        const q = normalizeString(studentNameQuery.trim());
        const matchedStudents = students.filter(s => {
            if (q && !normalizeString(getStudentName(s, 'ko')).includes(q) && !normalizeString(getStudentName(s, 'en')).includes(q)) {
                return false;
            }
            if (searchBusRidersOnly) {
                const hasBusNo = s.kisbusNo && s.kisbusNo !== '-' && s.kisbusNo !== t('unassigned');
                const hasAfterDest = s.afterSchoolDestinations && Object.values(s.afterSchoolDestinations).some(Boolean);
                const hasVacDest = s.vacationAfterSchoolDestinations && Object.values(s.vacationAfterSchoolDestinations).some(Boolean);
                if (!hasBusNo && !hasAfterDest && !hasVacDest) return false;
            }
            return true;
        });
        if (matchedStudents.length === 0) return new Set<string>();
        const classIds = new Set<string>();
        matchedStudents.forEach(s => {
            // 학기 중 수업 ID
            if (s.afterSchoolClassIds) {
                Object.values(s.afterSchoolClassIds).forEach(id => { if (id) classIds.add(id); });
            }
            // 방학 중 수업 ID
            if (s.vacationAfterSchoolClassIds) {
                Object.values(s.vacationAfterSchoolClassIds).forEach(id => { if (id) classIds.add(id); });
            }
        });
        return classIds;
    }, [studentNameQuery, searchBusRidersOnly, students, t]);

    const filteredClasses = useMemo(() => {
        return afterSchoolClasses.filter(c => {
            if ((c.semesterMode || 'regular') !== currentViewMode) return false;
            if (selectedDay !== 'all' && c.dayOfWeek !== selectedDay) return false;
            if (selectedTeacherId !== 'all' && (c.teacherId !== selectedTeacherId && c.teacherId2 !== selectedTeacherId)) return false;
            if (classSearchQuery.trim()) {
                const q = normalizeString(classSearchQuery.trim());
                const nameMatch = normalizeString(c.name).includes(q);
                const teacherMatch = c.teacherName && normalizeString(c.teacherName).includes(q);
                const teacher2Match = c.teacherName2 && normalizeString(c.teacherName2).includes(q);
                if (!nameMatch && !teacherMatch && !teacher2Match) return false;
            }
            // 학생 이름 검색 필터: 해당 학생이 등록된 수업만 표시
            if (classIdsForStudentSearch !== null) {
                if (!classIdsForStudentSearch.has(c.id)) return false;
            }
            return true;
        }).sort((a, b) => {
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            if (a.dayOfWeek !== b.dayOfWeek) return days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
            return (a.name || '').localeCompare(b.name || '', 'ko');
        });
    }, [afterSchoolClasses, selectedDay, selectedTeacherId, classSearchQuery, classIdsForStudentSearch, currentViewMode]);

    const classStudents = useMemo(() => {
        if (!selectedClassId) return [];
        const targetClass = afterSchoolClasses.find(c => c.id === selectedClassId);
        if (!targetClass) return [];

        const isVac = targetClass.semesterMode === 'vacation';

        // 1. 학생(students) 컬렉션 매핑
        const filteredFromStudents = students.filter(s => {
            const classIds = isVac ? (s.vacationAfterSchoolClassIds || {}) : (s.afterSchoolClassIds || {});
            
            const matchedById = classIds[targetClass.dayOfWeek] === targetClass.id || 
                                s.afterSchoolClassIds?.[targetClass.dayOfWeek] === targetClass.id ||
                                s.vacationAfterSchoolClassIds?.[targetClass.dayOfWeek] === targetClass.id;
            if (matchedById) return true;

            const targetTitleNorm = (targetClass.name || '').replace(/[\s()]/g, '');
            if ((s as any).enrolledCourseTitles && Array.isArray((s as any).enrolledCourseTitles)) {
                return (s as any).enrolledCourseTitles.some((t: string) => (t || '').replace(/[\s()]/g, '').includes(targetTitleNorm));
            }
            return false;
        });

        // 2. 방과후 수강생(enrollments) 컬렉션 명단 매핑 (강좌 ID 또는 강좌명 유연 매칭)
        const targetTitleNorm = (targetClass.name || '').replace(/[\s()]/g, '');
        const matchedEnrollments = enrollments.filter(e => {
            if (e.status === 'CANCELLED') return false;
            if (e.courseId === targetClass.id) return true;
            const enrollmentTitleNorm = (e.courseTitle || '').replace(/[\s()]/g, '');
            if (targetTitleNorm && enrollmentTitleNorm && (targetTitleNorm.includes(enrollmentTitleNorm) || enrollmentTitleNorm.includes(targetTitleNorm))) {
                return true;
            }
            return false;
        });

        // 3. enrollments 수강생 ➔ Student 객체 변환
        const enrollmentAsStudents = matchedEnrollments.map(e => {
            const existingStudent = students.find(s => s.name === e.name && String(s.grade) === String(e.grade) && String(s.class) === String(e.classNum));
            return {
                id: existingStudent?.id || `e_std_${e.id}`,
                name: e.name,
                grade: String(e.grade),
                class: String(e.classNum),
                number: String(e.studentNum),
                kisbusNo: e.kisbusNo || existingStudent?.kisbusNo || '-',
                contact: e.phone || e.parentPhone || existingStudent?.contact || '-',
                afterSchoolClassIds: existingStudent?.afterSchoolClassIds || {},
                vacationAfterSchoolClassIds: existingStudent?.vacationAfterSchoolClassIds || {},
            } as unknown as Student;
        });

        // 4. 두 소스의 학생 목록 통합 및 중복 제거
        const studentMap = new Map<string, Student>();
        filteredFromStudents.forEach(s => studentMap.set(s.id || `${s.name}_${s.grade}_${s.class}`, s));
        enrollmentAsStudents.forEach(s => {
            const key = s.id || `${s.name}_${s.grade}_${s.class}`;
            if (!studentMap.has(key)) {
                studentMap.set(key, s);
            }
        });

        const combinedList = Array.from(studentMap.values());

        return combinedList
            .map(s => {
                const isSaturday = targetClass.dayOfWeek === 'Saturday';
                const targetRouteType = isVac ? 'Afternoon' : (isSaturday ? 'Afternoon' : 'AfterSchool');
                const studentRoute = routes.find(r => 
                    r.dayOfWeek === targetClass.dayOfWeek && 
                    (isSaturday ? (r.type === 'Morning' || r.type === 'Afternoon') : (r.type === targetRouteType)) && 
                    r.seating.some(seat => seat.studentId === s.id)
                );
                const bus = buses.find(b => b.id === studentRoute?.busId);
                return {
                    ...s,
                    busName: bus?.name || (s.kisbusNo && s.kisbusNo !== '-' ? s.kisbusNo : t('unassigned'))
                };
            }).sort((a, b) => {
                const gA = parseInt(a.grade) || 0;
                const gB = parseInt(b.grade) || 0;
                if (gA !== gB) return gA - gB;
                const cA = parseInt(a.class) || 0;
                const cB = parseInt(b.class) || 0;
                if (cA !== cB) return cA - cB;
                return getStudentName(a, i18n.language).localeCompare(getStudentName(b, i18n.language), 'ko');
            });
    }, [selectedClassId, students, enrollments, afterSchoolClasses, routes, buses, t, i18n.language]);

    const displayClasses = useMemo(() => {
        const seenIds = new Set<string>();
        const seenNames = currentViewMode === 'vacation' ? new Set<string>() : null;

        return filteredClasses.filter(c => {
            if (!c.id || seenIds.has(c.id)) return false;
            seenIds.add(c.id);

            if (seenNames) {
                if (seenNames.has(c.name)) return false;
                seenNames.add(c.name);
            }
            return true;
        });
    }, [filteredClasses, currentViewMode]);

    const displayedClassStudents = useMemo(() => {
        if (!showBusRidersOnly) return classStudents;
        return classStudents.filter(s => s.busName && s.busName !== t('unassigned') && s.busName !== '-');
    }, [classStudents, showBusRidersOnly, t]);

    const handleUpdateClass = async () => {
        if (!editingClass || !editingClass.name) return;
        try {
            const allTeacherPool = [...teachers, ...afterSchoolTeachers];
            const teacher = allTeacherPool.find(t => t.id === editingClass.teacherId);
            const teacher2 = allTeacherPool.find(t => t.id === editingClass.teacherId2);
            const teacher3 = allTeacherPool.find(t => t.id === editingClass.teacherId3);
            const teacher4 = allTeacherPool.find(t => t.id === editingClass.teacherId4);

            if (currentViewMode === 'vacation') {
                const originalClass = afterSchoolClasses.find(c => c.id === editingClass.id);
                if (originalClass) {
                    const matchedClasses = afterSchoolClasses.filter(c => 
                        c.semesterMode === 'vacation' && 
                        c.name === originalClass.name
                    );
                    
                    await Promise.all(matchedClasses.map(c => 
                        updateAfterSchoolClass(c.id, {
                            name: editingClass.name!,
                            teacherId: editingClass.teacherId || null,
                            teacherName: teacher?.name || null,
                            teacherId2: editingClass.teacherId2 || null,
                            teacherName2: teacher2?.name || null,
                            teacherId3: editingClass.teacherId3 || null,
                            teacherName3: teacher3?.name || null,
                            teacherId4: editingClass.teacherId4 || null,
                            teacherName4: teacher4?.name || null
                        })
                    ));
                }
            } else {
                await updateAfterSchoolClass(editingClass.id, {
                    name: editingClass.name,
                    dayOfWeek: editingClass.dayOfWeek,
                    teacherId: editingClass.teacherId || null,
                    teacherName: teacher?.name || null,
                    teacherId2: editingClass.teacherId2 || null,
                    teacherName2: teacher2?.name || null,
                    teacherId3: editingClass.teacherId3 || null,
                    teacherName3: teacher3?.name || null,
                    teacherId4: editingClass.teacherId4 || null,
                    teacherName4: teacher4?.name || null
                });
            }
            setIsEditClassDialogOpen(false);
            setEditingClass(null);
            toast({ title: t('success'), description: "방과후 수업 정보가 수정되었습니다." });
        } catch (error) {
            toast({ title: t('error'), description: "수정 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleDeleteClass = async (classId: string) => {
        try {
            const targetClass = afterSchoolClasses.find(c => c.id === classId);
            if (!targetClass) return;

            if (currentViewMode === 'vacation') {
                const matchedClasses = afterSchoolClasses.filter(c => 
                    c.semesterMode === 'vacation' && 
                    c.name === targetClass.name
                );
                await Promise.all(matchedClasses.map(c => deleteAfterSchoolClass(c.id)));
            } else {
                await deleteAfterSchoolClass(classId);
            }
            
            toast({ title: t('success'), description: "방과후 수업이 삭제되었습니다." });
            if (selectedClassId === classId) {
                setSelectedClassId(null);
            }
        } catch (error) {
            toast({ title: t('error'), description: "삭제 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleAddClass = async () => {
        if (!newClass.name || (currentViewMode !== 'vacation' && !newClass.dayOfWeek)) {
            toast({ title: t('error'), description: "수업명과 요일을 입력해주세요.", variant: 'destructive' });
            return;
        }

        try {
            const allTeacherPool = [...teachers, ...afterSchoolTeachers];
            const teacher = allTeacherPool.find(t => t.id === newClass.teacherId);
            const teacher2 = allTeacherPool.find(t => t.id === newClass.teacherId2);

            if (currentViewMode === 'vacation') {
                const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                const classesToAdd = weekdays.map(day => ({
                    name: newClass.name!,
                    dayOfWeek: day,
                    teacherId: newClass.teacherId || null,
                    teacherName: teacher?.name || null,
                    teacherId2: newClass.teacherId2 || null,
                    teacherName2: teacher2?.name || null,
                    semesterMode: 'vacation' as const
                }));
                await addAfterSchoolClassesInBatch(classesToAdd);
            } else {
                await addAfterSchoolClass({
                    name: newClass.name,
                    dayOfWeek: newClass.dayOfWeek || 'Monday',
                    teacherId: newClass.teacherId || null,
                    teacherName: teacher?.name || null,
                    teacherId2: newClass.teacherId2 || null,
                    teacherName2: teacher2?.name || null,
                    semesterMode: 'regular'
                });
            }
            setIsAddClassDialogOpen(false);
            setNewClass({ name: '', dayOfWeek: 'Monday', teacherId: '', teacherName: '', teacherId2: '', teacherName2: '' });
            toast({ title: t('success'), description: "방과후 수업이 등록되었습니다." });
        } catch (error) {
            toast({ title: t('error'), description: "등록 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleAddStudentToClass = async () => {
        if (!selectedClassId || !selectedStudentToAddId) return;

        const targetClass = afterSchoolClasses.find(c => c.id === selectedClassId);
        const targetStudent = students.find(s => s.id === selectedStudentToAddId);

        if (!targetClass || !targetStudent) return;

        try {
            const isVac = targetClass.semesterMode === 'vacation';
            if (isVac) {
                const updatedClassIds = { ...(targetStudent.vacationAfterSchoolClassIds || {}) };
                const updatedDestinations = { ...(targetStudent.vacationAfterSchoolDestinations || {}) };
                
                // 방학 중: 동명의 모든 요일 수업에 일괄 수강 등록
                const siblingClasses = afterSchoolClasses.filter(c => c.semesterMode === 'vacation' && c.name === targetClass.name);
                siblingClasses.forEach(sc => {
                    updatedClassIds[sc.dayOfWeek] = sc.id;
                    if (!updatedDestinations[sc.dayOfWeek]) {
                        updatedDestinations[sc.dayOfWeek] = targetStudent.afternoonDestinationId || '';
                    }
                });
                
                await updateStudent(targetStudent.id, {
                    vacationAfterSchoolClassIds: updatedClassIds,
                    vacationAfterSchoolDestinations: updatedDestinations
                });
            } else {
                const updatedClassIds = { ...(targetStudent.afterSchoolClassIds || {}) };
                const updatedDestinations = { ...(targetStudent.afterSchoolDestinations || {}) };
                
                updatedClassIds[targetClass.dayOfWeek] = targetClass.id;
                
                if (!updatedDestinations[targetClass.dayOfWeek]) {
                    updatedDestinations[targetClass.dayOfWeek] = targetStudent.afternoonDestinationId || '';
                }
                
                await updateStudent(targetStudent.id, {
                    afterSchoolClassIds: updatedClassIds,
                    afterSchoolDestinations: updatedDestinations
                });
            }

            toast({ title: t('success'), description: "학생이 수업에 배정되었습니다." });
            setIsAddStudentDialogOpen(false);
            setAddStudentSearchQuery('');
            setSelectedStudentToAddId(null);
        } catch (error) {
            console.error(error);
            toast({ title: t('error'), description: "학생 배정 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleRemoveStudentFromClass = async (studentId: string) => {
        if (!selectedClassId) return;
        const targetClass = afterSchoolClasses.find(c => c.id === selectedClassId);
        if (!targetClass) return;
        
        if (!confirm("이 학생을 이 수업에서 제외하시겠습니까?")) return;
        
        try {
            const student = students.find(s => s.id === studentId);
            if (!student) return;
            
            const isVac = targetClass.semesterMode === 'vacation';
            if (isVac) {
                // 방학 중 수업은 같은 이름의 수업이 여러 요일에 걸쳐 존재하므로
                // 동일한 수업명을 가진 모든 vacation 수업의 요일에서 일괄 제거
                const allVacClassesSameName = afterSchoolClasses.filter(
                    c => c.semesterMode === 'vacation' && c.name === targetClass.name
                );

                const updatedVacClassIds = { ...(student.vacationAfterSchoolClassIds || {}) };
                const updatedVacDestinations = { ...(student.vacationAfterSchoolDestinations || {}) };
                const updatedRegClassIds = { ...(student.afterSchoolClassIds || {}) };
                const updatedRegDestinations = { ...(student.afterSchoolDestinations || {}) };

                for (const cls of allVacClassesSameName) {
                    delete updatedVacClassIds[cls.dayOfWeek];
                    delete updatedVacDestinations[cls.dayOfWeek];
                    // Fallback 호환성 제거: 일반 필드에도 이 수업 ID가 있다면 삭제
                    if (updatedRegClassIds[cls.dayOfWeek] === cls.id) {
                        delete updatedRegClassIds[cls.dayOfWeek];
                        delete updatedRegDestinations[cls.dayOfWeek];
                    }
                }

                await updateStudent(studentId, {
                    vacationAfterSchoolClassIds: updatedVacClassIds,
                    vacationAfterSchoolDestinations: updatedVacDestinations,
                    afterSchoolClassIds: updatedRegClassIds,
                    afterSchoolDestinations: updatedRegDestinations
                });

                // 모든 요일의 Morning 및 Afternoon 노선 버스 좌석에서도 제거
                const { updateRouteSeating } = await import('@/lib/kisbus');
                await Promise.all(
                    allVacClassesSameName.map(async cls => {
                        const routesToClear = routes.filter(r =>
                            r.dayOfWeek === cls.dayOfWeek &&
                            (r.type === 'Afternoon' || r.type === 'Morning') &&
                            r.seating.some(seat => seat.studentId === studentId)
                        );
                        for (const routeToClear of routesToClear) {
                            const updatedSeating = routeToClear.seating.map(seat =>
                                seat.studentId === studentId ? { ...seat, studentId: '' } : seat
                            );
                            await updateRouteSeating(routeToClear.id, updatedSeating);
                        }
                    })
                );
            } else {
                const updatedClassIds = { ...(student.afterSchoolClassIds || {}) };
                const updatedDestinations = { ...(student.afterSchoolDestinations || {}) };
                
                delete updatedClassIds[targetClass.dayOfWeek];
                delete updatedDestinations[targetClass.dayOfWeek];
                
                await updateStudent(studentId, {
                    afterSchoolClassIds: updatedClassIds,
                    afterSchoolDestinations: updatedDestinations
                });

                // 해당 요일의 AfterSchool 노선 버스 좌석에서 제거
                const routeToClear = routes.find(r => r.dayOfWeek === targetClass.dayOfWeek && r.type === 'AfterSchool' && r.seating.some(seat => seat.studentId === studentId));
                if (routeToClear) {
                    const updatedSeating = routeToClear.seating.map(seat => {
                        if (seat.studentId === studentId) {
                            return { ...seat, studentId: '' };
                        }
                        return seat;
                    });
                    const { updateRouteSeating } = await import('@/lib/kisbus');
                    await updateRouteSeating(routeToClear.id, updatedSeating);
                }
            }
            
            toast({ title: t('success'), description: "학생이 수업 및 버스 배정에서 제외되었습니다." });
        } catch (error) {
            console.error(error);
            toast({ title: t('error'), description: "학생 제외 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };


    const availableStudentsToAdd = useMemo(() => {
        if (!addStudentSearchQuery.trim()) return [];
        const q = normalizeString(addStudentSearchQuery.trim());
        
        return students.filter(s => {
            const matchName = normalizeString(getStudentName(s, i18n.language)).includes(q);
            if (!matchName) return false;
            
            if (selectedClassId) {
                const targetClass = afterSchoolClasses.find(c => c.id === selectedClassId);
                if (targetClass) {
                    const isVac = targetClass.semesterMode === 'vacation';
                    const classIds = isVac ? (s.vacationAfterSchoolClassIds || {}) : (s.afterSchoolClassIds || {});
                    if (classIds[targetClass.dayOfWeek] === targetClass.id || s.afterSchoolClassIds?.[targetClass.dayOfWeek] === targetClass.id) {
                        return false;
                    }
                }
            }
            return true;
        }).slice(0, 10);
    }, [students, addStudentSearchQuery, i18n.language, selectedClassId, afterSchoolClasses, semesterMode]);

    const handleDownloadTemplate = () => {
        import('xlsx').then(XLSX => {
            const isVacation = currentViewMode === 'vacation';
            const headers = isVacation ? ["수업명", "교사명1", "교사명2"] : ["요일", "수업명", "교사명1", "교사명2"];
            const examples = isVacation ? [
                ["영어회화", "Mr. Smith", "김철수"],
                ["컴퓨터교실", "김철수", ""],
                ["창의미술", "홍길동", "이영희"]
            ] : [
                ["월", "축구부", "홍길동", "김철수"],
                ["화요일", "바이올린", "김철수", ""],
                ["Wednesday", "합창단", "", ""]
            ];
            const wsData = [headers, ...examples];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            const sheetName = isVacation ? "방학_방과후_수업_템플릿" : "방과후_수업_템플릿";
            const fileName = isVacation ? "vacation_after_school_template.xlsx" : "after_school_class_template.xlsx";
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            XLSX.writeFile(wb, fileName);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    };

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

                const semesterTeachers = afterSchoolTeachers.filter(t => (t.semesterMode || 'regular') === currentViewMode);
                
                const newTeachersToCreate: string[] = [];
                results.forEach((row: any) => {
                    const name = (row['수업명'] || row['ClassName'] || '').toString().trim();
                    if (!name) return;
                    const rawT1 = (row['교사명1'] || row['교사명'] || row['TeacherName1'] || row['TeacherName'] || row['지도교사1'] || '').toString().trim();
                    const rawT2 = (row['교사명2'] || row['TeacherName2'] || row['지도교사2'] || '').toString().trim();
                    const rawT3 = (row['교사명3'] || row['TeacherName3'] || row['지도교사3'] || '').toString().trim();
                    const rawT4 = (row['교사명4'] || row['TeacherName4'] || row['지도교사4'] || '').toString().trim();
                    
                    [rawT1, rawT2, rawT3, rawT4].forEach(str => {
                        if (str) {
                            str.split(',').forEach((sub: string) => {
                                const t = sub.trim();
                                if (t && !semesterTeachers.some(st => st.name === t) && !newTeachersToCreate.includes(t)) {
                                    newTeachersToCreate.push(t);
                                }
                            });
                        }
                    });
                });

                const createdTeachers: Teacher[] = [];
                if (newTeachersToCreate.length > 0) {
                    for (const name of newTeachersToCreate) {
                        const newDocRef = doc(collection(db(), 'afterSchoolTeachers'));
                        await setDoc(newDocRef, {
                            name,
                            semesterMode: currentViewMode,
                            afterSchoolDays: []
                        });
                        createdTeachers.push({
                            id: newDocRef.id,
                            name,
                            afterSchoolDays: []
                        });
                    }
                }

                const updatedAllTeachers = [...semesterTeachers, ...createdTeachers];

                const dayMap: Record<string, DayOfWeek> = {
                    '월': 'Monday', '월요일': 'Monday', 'Mon': 'Monday', 'Monday': 'Monday',
                    '화': 'Tuesday', '화요일': 'Tuesday', 'Tue': 'Tuesday', 'Tuesday': 'Tuesday',
                    '수': 'Wednesday', '수요일': 'Wednesday', 'Wed': 'Wednesday', 'Wednesday': 'Wednesday',
                    '목': 'Thursday', '목요일': 'Thursday', 'Thu': 'Thursday', 'Thursday': 'Thursday',
                    '금': 'Friday', '금요일': 'Friday', 'Fri': 'Friday', 'Friday': 'Friday',
                    '토': 'Saturday', '토요일': 'Saturday', 'Sat': 'Saturday', 'Saturday': 'Saturday'
                };

                const classesToAdd: NewAfterSchoolClass[] = [];
                
                results.forEach((row: any) => {
                    const name = (row['수업명'] || row['ClassName'] || '').toString().trim();
                    if (!name) return;

                    const rawT1 = (row['교사명1'] || row['교사명'] || row['TeacherName1'] || row['TeacherName'] || row['지도교사1'] || '').toString().trim();
                    const rawT2 = (row['교사명2'] || row['TeacherName2'] || row['지도교사2'] || '').toString().trim();
                    const rawT3 = (row['교사명3'] || row['TeacherName3'] || row['지도교사3'] || '').toString().trim();
                    const rawT4 = (row['교사명4'] || row['TeacherName4'] || row['지도교사4'] || '').toString().trim();

                    const parsedNames: string[] = [];
                    [rawT1, rawT2, rawT3, rawT4].forEach(str => {
                        if (str) {
                            str.split(',').forEach((sub: string) => {
                                const t = sub.trim();
                                if (t && !parsedNames.includes(t)) parsedNames.push(t);
                            });
                        }
                    });

                    const teacherName = parsedNames[0] || '';
                    const teacherName2 = parsedNames[1] || '';
                    const teacherName3 = parsedNames[2] || '';
                    const teacherName4 = parsedNames[3] || '';

                    const teacher = updatedAllTeachers.find(t => t.name === teacherName);
                    const teacher2 = updatedAllTeachers.find(t => t.name === teacherName2);
                    const teacher3 = updatedAllTeachers.find(t => t.name === teacherName3);
                    const teacher4 = updatedAllTeachers.find(t => t.name === teacherName4);
                    
                    if (currentViewMode === 'vacation') {
                        // For vacation mode, create the class for Monday to Friday (5 days)
                        const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                        weekdays.forEach(day => {
                            classesToAdd.push({
                                name,
                                dayOfWeek: day,
                                teacherId: teacher?.id || null,
                                teacherName: teacherName || null,
                                teacherId2: teacher2?.id || null,
                                teacherName2: teacherName2 || null,
                                teacherId3: teacher3?.id || null,
                                teacherName3: teacherName3 || null,
                                teacherId4: teacher4?.id || null,
                                teacherName4: teacherName4 || null,
                                semesterMode: 'vacation'
                            });
                        });
                    } else {
                        // Regular mode: read day from excel row
                        const dayInput = (row['요일'] || row['Day'] || '').toString().trim();
                        const day = dayMap[dayInput] || 'Monday';
                        classesToAdd.push({
                            name,
                            dayOfWeek: day,
                            teacherId: teacher?.id || null,
                            teacherName: teacherName || null,
                            teacherId2: teacher2?.id || null,
                            teacherName2: teacherName2 || null,
                            teacherId3: teacher3?.id || null,
                            teacherName3: teacherName3 || null,
                            teacherId4: teacher4?.id || null,
                            teacherName4: teacherName4 || null,
                            semesterMode: 'regular'
                        });
                    }
                });

                if (classesToAdd.length > 0) {
                    await addAfterSchoolClassesInBatch(classesToAdd);
                    toast({ title: t('success'), description: `${classesToAdd.length}개의 수업이 등록되었습니다.` });
                } else {
                    toast({ title: t('error'), description: "등록할 수업 데이터가 없습니다.", variant: 'destructive' });
                }
            } catch (error) {
                toast({ title: t('error'), description: "파일 처리 중 오류가 발생했습니다.", variant: 'destructive' });
            }
        };
        reader.readAsArrayBuffer(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleDownloadAllClasses = () => {
        if (filteredClasses.length === 0) return;
        import('xlsx').then(XLSX => {
            const headers = ["요일", "수업명", "지도교사 1", "지도교사 2", "지도교사 3", "지도교사 4"];
            const wsData = [
                headers,
                ...filteredClasses.map(c => {
                    const t4 = getFourTeachers(c);
                    return [
                        t(`day.${c.dayOfWeek.toLowerCase()}`),
                        c.name,
                        t4[0],
                        t4[1],
                        t4[2],
                        t4[3]
                    ];
                })
            ];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "수업목록");
            XLSX.writeFile(wb, "after_school_classes.xlsx");
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    };

    const handleClearAll = async () => {
        const classesToClear = afterSchoolClasses.filter(c => (c.semesterMode || 'regular') === currentViewMode);
        if (classesToClear.length === 0) {
            toast({ title: t('notice'), description: "삭제할 수업이 없습니다." });
            return;
        }

        const modeText = currentViewMode === 'vacation' ? '방학 중' : '학기 중';
        const confirmed = window.confirm(`정말 모든 ${modeText} 방과후 수업을 삭제하시겠습니까? 학생들의 수업 배정도 해제됩니다.`);
        if (!confirmed) return;

        try {
            const batch = writeBatch(db());
            classesToClear.forEach(c => {
                batch.delete(doc(db(), 'afterSchoolClasses', c.id));
            });
            await batch.commit();
            toast({ title: t('success'), description: `모든 ${modeText} 방과후 수업이 성공적으로 삭제되었습니다.` });
        } catch (error) {
            toast({ title: t('error'), description: "수업 삭제 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleDownloadBusByDayRosters = () => {
        if (students.length === 0 || routes.length === 0) return;
        
        import('xlsx').then(XLSX => {
            const wb = XLSX.utils.book_new();
            const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            const dayLabels: Record<string, string> = {
                'Monday': '월요일', 'Tuesday': '화요일', 'Wednesday': '수요일',
                'Thursday': '목요일', 'Friday': '금요일'
            };
            
            for (const bus of buses) {
                const busRoutes = routes.filter(r => r.busId === bus.id && r.type === 'AfterSchool');
                if (busRoutes.length === 0) continue;
                
                let wsData: any[][] = [];
                
                for (const day of days) {
                    const route = busRoutes.find(r => r.dayOfWeek === day);
                    if (!route) continue;
                    
                    const seatedStudents = route.seating
                        .filter(seat => seat.studentId)
                        .map(seat => {
                            const student = students.find(s => s.id === seat.studentId);
                            return { seatNumber: seat.seatNumber, student };
                        })
                        .filter(item => item.student);
                    
                    if (seatedStudents.length > 0) {
                        wsData.push([`[ ${dayLabels[day]} ]`]);
                        wsData.push(["좌석 번호", "학년", "반", "이름", "목적지"]);
                        
                        seatedStudents.forEach(item => {
                            const student = item.student!;
                            const destId = student.afterSchoolDestinations?.[day as DayOfWeek];
                            const destName = destinations.find(d => d.id === destId)?.name || '지정되지 않음';
                            wsData.push([
                                item.seatNumber,
                                student.grade,
                                student.class,
                                getStudentName(student, i18n.language),
                                destName
                            ]);
                        });
                        wsData.push([]); 
                    }
                }
                
                if (wsData.length > 0) {
                    const ws = XLSX.utils.aoa_to_sheet(wsData);
                    XLSX.utils.book_append_sheet(wb, ws, bus.name.substring(0, 31)); 
                }
            }
            
            if (wb.SheetNames.length === 0) {
                toast({ title: t('notice'), description: "출력할 방과후 버스 명단 데이터가 없습니다." });
                return;
            }
            
            XLSX.writeFile(wb, `방과후_버스별_탑승명단_${new Date().toISOString().split('T')[0]}.xlsx`);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    };

    const handleDownloadClassStudents = () => {
        if (!selectedClassId || displayedClassStudents.length === 0) return;
        const targetClass = afterSchoolClasses.find(c => c.id === selectedClassId);
        if (!targetClass) return;

        import('xlsx').then(XLSX => {
            const headers = ["학년", "반", "이름", "방과후 버스번호"];
            const wsData = [
                headers,
                ...displayedClassStudents.map(s => [
                    s.grade,
                    s.class,
                    getStudentName(s, i18n.language),
                    s.busName
                ])
            ];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "학생명단");
            const filterSuffix = showBusRidersOnly ? '_버스탑승자만' : '';
            XLSX.writeFile(wb, `${targetClass.name}_명단${filterSuffix}.xlsx`);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    };

    return (
        <div className="space-y-6">
            {/* 0. 방과후 시스템 자동 연동 안내 배너 */}
            <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-blue-50 border border-indigo-200/80 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
                        <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 whitespace-nowrap">
                            방과후 시스템(admin/afterschool) 실시간 수신 연동 중
                            <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-300 text-[10px] whitespace-nowrap font-bold">자동 동기화</Badge>
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                            방과후 강좌 및 수강 신청 명단은 방과후 관리자/교사가 등록한 최신 정보가 자동으로 반영됩니다. 버스 관리자는 방과후 수강생의 하교 버스 노선 지정 및 하교 탑승 명단을 관리합니다.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handleDownloadAllClasses} className="h-8 text-xs px-2.5 font-bold whitespace-nowrap bg-white hover:bg-slate-50">
                        <FileText className="mr-1.5 h-3.5 w-3.5" /> 강좌 목록 (엑셀)
                    </Button>
                    <Button variant="default" size="sm" onClick={handleDownloadBusByDayRosters} className="h-8 text-xs px-2.5 font-bold whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs">
                        <Download className="mr-1.5 h-3.5 w-3.5" /> 버스별 하교 명단 (엑셀)
                    </Button>
                </div>
            </div>

            {/* 1. 수업 목록 필터 (학기 중 / 방학 중 수업 구분 관리) */}
            <div className="flex justify-center border-b pb-1">
                <div className="flex gap-4">
                    <button 
                        className={cn("px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap", currentViewMode === 'regular' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800")}
                        onClick={() => {
                            setCurrentViewMode('regular');
                            setSelectedDay('all');
                            setSelectedClassId(null);
                        }}
                    >
                        학기 중 방과후 수업
                    </button>
                    <button 
                        className={cn("px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap", currentViewMode === 'vacation' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800")}
                        onClick={() => {
                            setCurrentViewMode('vacation');
                            setSelectedDay('all');
                            setSelectedClassId(null);
                        }}
                    >
                        방학 중 방과후 수업
                    </button>
                </div>
            </div>

                <Card className="rounded-2xl shadow-xs">
                    <CardHeader className="pb-3 border-b border-slate-100">
                        <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800 whitespace-nowrap">
                            <Search className="h-5 w-5 text-indigo-600" /> 방과후 하교 버스 명단 조회
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                            방과후 강좌별 수강생 목록과 하교 버스 탑승 지정을 조회합니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                    {currentViewMode !== 'vacation' && (
                        <div className="space-y-1">
                            <Label className="text-xs">요일 선택</Label>
                            <Select value={selectedDay} onValueChange={(v: any) => { setSelectedDay(v); setSelectedClassId(null); }}>
                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">전체</SelectItem>
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                                        <SelectItem key={d} value={d}>{t(`day.${d.toLowerCase()}`)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="space-y-1">
                        <Label className="text-xs">수업명 또는 교사명 검색</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                className="h-8 pl-8 text-sm"
                                placeholder="수업명 또는 교사명으로 검색..."
                                value={classSearchQuery}
                                onChange={e => { setClassSearchQuery(e.target.value); setStudentNameQuery(''); setSelectedClassId(null); }}
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">학생 이름으로 수업 검색</Label>
                            <label className="flex items-center gap-1 cursor-pointer text-xs text-muted-foreground select-none hover:text-slate-900">
                                <input
                                    type="checkbox"
                                    checked={searchBusRidersOnly}
                                    onChange={e => { setSearchBusRidersOnly(e.target.checked); setSelectedClassId(null); }}
                                    className="rounded border-slate-300 text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                                />
                                <span className="font-medium text-[11px] text-slate-700">버스 탑승자만</span>
                            </label>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                className="h-8 pl-8 text-sm"
                                placeholder="학생 이름으로 수강 수업 검색..."
                                value={studentNameQuery}
                                onChange={e => { setStudentNameQuery(e.target.value); setClassSearchQuery(''); setSelectedClassId(null); }}
                            />
                        </div>
                        {(studentNameQuery.trim() || searchBusRidersOnly) && classIdsForStudentSearch !== null && (
                            <p className="text-xs text-muted-foreground">
                                {classIdsForStudentSearch.size === 0
                                    ? '해당 조건의 수강 이력이 없습니다.'
                                    : `${classIdsForStudentSearch.size}개 수업에 등록됨${searchBusRidersOnly ? ' (버스 탑승자 대상)' : ''}`}
                            </p>
                        )}
                    </div>
                        <div className="space-y-1">
                            <Label className="text-xs">수업 선택</Label>
                            <Select value={selectedClassId || 'none'} onValueChange={(v) => setSelectedClassId(v === 'none' ? null : v)}>
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="수업을 선택하세요" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">수업 선택 안 함</SelectItem>
                                    {displayClasses.map(c => {
                                        const teachersList = [c.teacherName, c.teacherName2].filter(Boolean);
                                        const teachersLabel = teachersList.length > 0 ? teachersList.join(', ') : '교사 미정';
                                        return (
                                            <SelectItem key={c.id} value={c.id}>
                                                {currentViewMode === 'vacation' ? '' : `[${t(`day_short.${c.dayOfWeek.toLowerCase()}`)}] `}
                                                {c.name} ({teachersLabel})
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

            <Card className="rounded-2xl shadow-xs">
                <CardHeader className="cursor-pointer select-none pb-3 border-b border-slate-100" onClick={() => setIsClassListExpanded(!isClassListExpanded)}>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold text-slate-800 whitespace-nowrap">방과후 강좌 연동 목록 ({displayClasses.length}개)</CardTitle>
                            <CardDescription className="text-xs text-slate-500">방과후 시스템에서 동기화된 강좌 명단입니다. 클릭하여 펼치거나 접을 수 있습니다.</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); setIsClassListExpanded(!isClassListExpanded); }}>
                            {isClassListExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                </CardHeader>
                {isClassListExpanded && (
                    <CardContent className="pt-4">
                        <div className="rounded-xl border overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        {currentViewMode !== 'vacation' && <TableHead className="w-[120px] whitespace-nowrap font-bold text-slate-700">요일</TableHead>}
                                        <TableHead className="whitespace-nowrap font-bold text-slate-700">수업명</TableHead>
                                        <TableHead className="whitespace-nowrap font-bold text-slate-700">지도교사 1</TableHead>
                                        <TableHead className="whitespace-nowrap font-bold text-slate-700">지도교사 2</TableHead>
                                        <TableHead className="text-right w-[150px]">작업</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayClasses.length > 0 ? (
                                        displayClasses.map(c => {
                                            return (
                                                <TableRow key={c.id}>
                                                    {currentViewMode !== 'vacation' && <TableCell>{t(`day.${c.dayOfWeek.toLowerCase()}`)}</TableCell>}
                                                    <TableCell className="font-semibold">{c.name}</TableCell>
                                                    <TableCell>{c.teacherName || '-'}</TableCell>
                                                    <TableCell>{c.teacherName2 || '-'}</TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline" 
                                                            className="h-8 px-2 py-1 text-xs"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingClass(c);
                                                                setIsEditClassDialogOpen(true);
                                                            }}
                                                        >
                                                            수정
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="destructive" 
                                                            className="h-8 px-2 py-1 text-xs"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm("이 수업을 삭제하시겠습니까?")) {
                                                                    handleDeleteClass(c.id);
                                                                }
                                                            }}
                                                        >
                                                            삭제
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={currentViewMode === 'vacation' ? 4 : 5} className="h-24 text-center text-muted-foreground">
                                                등록된 수업이 없습니다.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                )}
            </Card>

            {selectedClassId && (
                <Card className="animate-in fade-in slide-in-from-bottom-2">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
                        <div>
                            <CardTitle className="text-lg font-bold">
                                {afterSchoolClasses.find(c => c.id === selectedClassId)?.name} 학생 명단
                            </CardTitle>
                            <CardDescription className="text-xs">
                                총 {classStudents.length}명
                                {classStudents.length > 0 && (
                                    <> (버스 탑승자: <strong className="text-primary font-bold">{classStudents.filter(s => s.busName && s.busName !== t('unassigned') && s.busName !== '-').length}</strong>명)</>
                                )}
                                {showBusRidersOnly && (
                                    <span className="ml-1 text-primary font-semibold">
                                        [버스 탑승자만 필터링: {displayedClassStudents.length}명]
                                    </span>
                                )}
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button 
                                variant={showBusRidersOnly ? "default" : "outline"} 
                                size="sm" 
                                className="h-8 text-xs font-semibold gap-1.5"
                                onClick={() => setShowBusRidersOnly(prev => !prev)}
                            >
                                <BusIcon className="h-3.5 w-3.5" />
                                {showBusRidersOnly ? '전체 학생 보기' : '버스 탑승자만 보기'}
                            </Button>
                            <Dialog open={isAddStudentDialogOpen} onOpenChange={(open) => {
                                setIsAddStudentDialogOpen(open);
                                if (!open) {
                                    setAddStudentSearchQuery('');
                                    setSelectedStudentToAddId(null);
                                }
                            }}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 text-xs">
                                        <UserPlus className="mr-1.5 h-3.5 w-3.5" /> 개별 학생 등록
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>방과후 수업 학생 등록</DialogTitle>
                                        <DialogDescription>
                                            {afterSchoolClasses.find(c => c.id === selectedClassId)?.name} 수업에 학생을 개별적으로 추가합니다.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>학생 검색</Label>
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    className="pl-8"
                                                    placeholder="학생 이름 입력..."
                                                    value={addStudentSearchQuery}
                                                    onChange={e => setAddStudentSearchQuery(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        {addStudentSearchQuery.trim() !== '' && (
                                            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                                                {availableStudentsToAdd.length > 0 ? (
                                                    availableStudentsToAdd.map(s => (
                                                        <div 
                                                            key={s.id}
                                                            className={`p-2 rounded cursor-pointer text-sm ${selectedStudentToAddId === s.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                                                            onClick={() => setSelectedStudentToAddId(s.id)}
                                                        >
                                                            {s.grade}학년 {s.class}반 {getStudentName(s, i18n.language)}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-sm text-muted-foreground text-center p-2">검색 결과가 없습니다.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button 
                                            onClick={handleAddStudentToClass} 
                                            disabled={!selectedStudentToAddId}
                                        >
                                            등록
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleDownloadClassStudents} disabled={displayedClassStudents.length === 0}>
                                <Download className="mr-1.5 h-3.5 w-3.5" /> 명단 다운로드
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="rounded-xl border overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="w-[80px] whitespace-nowrap font-bold text-slate-700">학년</TableHead>
                                        <TableHead className="w-[80px] whitespace-nowrap font-bold text-slate-700">반</TableHead>
                                        <TableHead className="whitespace-nowrap font-bold text-slate-700">이름</TableHead>
                                        <TableHead className="text-right whitespace-nowrap font-bold text-slate-700">방과후 버스번호</TableHead>
                                        <TableHead className="text-right w-[100px] whitespace-nowrap font-bold text-slate-700">작업</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayedClassStudents.length > 0 ? (
                                        displayedClassStudents.map((s) => (
                                            <TableRow key={s.id}>
                                                <TableCell className="whitespace-nowrap">{s.grade}</TableCell>
                                                <TableCell className="whitespace-nowrap">{s.class}</TableCell>
                                                <TableCell className="font-medium whitespace-nowrap">{getStudentName(s, i18n.language)}</TableCell>
                                                <TableCell className="text-right whitespace-nowrap">
                                                    <Badge variant={s.busName === t('unassigned') ? "outline" : "secondary"} className="whitespace-nowrap">
                                                        {s.busName}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right whitespace-nowrap">
                                                    <Button 
                                                        size="sm" 
                                                        variant="destructive" 
                                                        className="h-7 px-2 text-xs whitespace-nowrap"
                                                        onClick={() => handleRemoveStudentFromClass(s.id)}
                                                    >
                                                        제외
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground whitespace-nowrap">
                                                {showBusRidersOnly ? '버스 탑승 학생이 없습니다.' : '배정된 학생이 없습니다.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 수업 수정 다이얼로그 */}
            <Dialog open={isEditClassDialogOpen} onOpenChange={(open) => {
                setIsEditClassDialogOpen(open);
                if (!open) setEditingClass(null);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>방과후 수업 수정</DialogTitle>
                    </DialogHeader>
                    {editingClass && (
                        <div className="space-y-4 py-4">
                            {currentViewMode !== 'vacation' && (
                                <div className="space-y-2">
                                    <Label>요일</Label>
                                    <Select 
                                        value={editingClass.dayOfWeek} 
                                        onValueChange={(v: any) => setEditingClass({...editingClass, dayOfWeek: v})}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                                                <SelectItem key={d} value={d}>{t(`day.${d.toLowerCase()}`)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>수업명</Label>
                                <Input 
                                    value={editingClass.name} 
                                    onChange={e => setEditingClass({...editingClass, name: e.target.value})} 
                                    placeholder="예: 축구부" 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>지도교사 1 (선택)</Label>
                                <Select 
                                    value={editingClass.teacherId || 'none'} 
                                    onValueChange={(v) => setEditingClass({...editingClass, teacherId: v === 'none' ? '' : v})}
                                >
                                    <SelectTrigger><SelectValue placeholder="선생님 선택" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">선택 불필요</SelectItem>
                                        {allTeachers.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>지도교사 2 (선택)</Label>
                                <Select 
                                    value={editingClass.teacherId2 || 'none'} 
                                    onValueChange={(v) => setEditingClass({...editingClass, teacherId2: v === 'none' ? '' : v})}
                                >
                                    <SelectTrigger><SelectValue placeholder="선생님 선택" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">선택 불필요</SelectItem>
                                        {allTeachers.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>지도교사 3 (선택)</Label>
                                <Select 
                                    value={editingClass.teacherId3 || 'none'} 
                                    onValueChange={(v) => setEditingClass({...editingClass, teacherId3: v === 'none' ? '' : v})}
                                >
                                    <SelectTrigger><SelectValue placeholder="선생님 선택" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">선택 불필요</SelectItem>
                                        {allTeachers.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>지도교사 4 (선택)</Label>
                                <Select 
                                    value={editingClass.teacherId4 || 'none'} 
                                    onValueChange={(v) => setEditingClass({...editingClass, teacherId4: v === 'none' ? '' : v})}
                                >
                                    <SelectTrigger><SelectValue placeholder="선생님 선택" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">선택 불필요</SelectItem>
                                        {allTeachers.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={handleUpdateClass} className="w-full">수정 완료</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
