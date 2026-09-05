'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    onBusesUpdate,
    onStudentsUpdate,
    onRoutesUpdate,
    onDestinationsUpdate,
    onTeachersUpdate,
    onAfterSchoolTeachersUpdate,
    onSaturdayTeachersUpdate,
    onAfterSchoolClassesUpdate,
    onLostItemsUpdate,
    getGroupLeaderRecords, 
    saveGroupLeaderRecords,
    updateAttendance,
    onAttendanceUpdate,
    updateBus,
    updateRouteSeating,
    updateStudent,
    getAfterSchoolClasses,
    onGlobalSettingsUpdate
} from '@/lib/kisbus';
import { getKisbusDb as db } from '@/lib/kisbus/firebase';
import { arrayUnion, arrayRemove, collection, doc, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, GroupLeaderRecord, Teacher, LostItem, AttendanceRecord, AfterSchoolClass } from '@/lib/kisbus/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Users, Printer, UserX, AlertCircle, Search, GraduationCap, Download, MapPin, CheckCircle2, FileDown, Upload, Pencil, Check, UserMinus, Phone, Bell, Clock, User, LogOut, Settings, Save, Copy, QrCode, Sun, CalendarX, ArrowUp } from 'lucide-react';
import jsQR from 'jsqr';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

import { GroupLeaderManager } from '@/components/bus/group-leader-manager';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MainLayout } from '@/components/layout/main-layout';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, differenceInDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { LostAndFound } from '@/components/bus/lost-and-found';
import { AfterSchoolInquiryDialog } from '@/components/bus/after-school-inquiry-dialog';
import { MorningGateDutyDialog } from '@/components/bus/morning-gate-duty-dialog';
import { onTeacherApplySettingsUpdate, onAttendanceRecordsUpdate, onAfterschoolCoursesUpdate, onAfterschoolEnrollmentsUpdate } from '@/lib/services/settingsService';
import { useTranslation } from '@/hooks/use-translation';
import { useAuth } from '@/hooks/use-auth';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { cn, normalizeString, getStudentName } from '@/lib/kisbus/utils';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const sortBuses = (buses: Bus[]): Bus[] => {
  return [...buses].sort((a, b) => {
    const numA = parseInt((a.name || '').replace(/\D/g, ''), 10);
    const numB = parseInt((b.name || '').replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return (a.name || '').localeCompare(b.name || '', 'ko');
  });
};

const getGradeValue = (grade: string): number => {
  const upperGrade = (grade || '').trim().toUpperCase();
  if (upperGrade === 'S') return -50; 
  if (upperGrade.startsWith('S')) {
      const num = parseInt(upperGrade.replace('S', ''), 10);
      return isNaN(num) ? -50 : -50 + (num / 100);
  }
  if (upperGrade.startsWith('K')) {
      const num = parseInt(upperGrade.replace('K', ''), 10);
      return isNaN(num) ? -100 : -100 + num;
  }
  const num = parseInt(upperGrade.replace(/\D/g, ''), 10);
  return isNaN(num) ? 999 : num;
};

const AllStudentsBoardingStatus = ({ relevantRoutes, students, buses, allAttendance, formatStudentName, t, afterschoolAbsentStudentIds }: { relevantRoutes: Route[]; students: Student[]; buses: Bus[]; allAttendance: Record<string, AttendanceRecord | null>; formatStudentName: (student: Student) => string; t: any; afterschoolAbsentStudentIds?: Set<string>; }) => {
    const { toast } = useToast();
    const { i18n } = useTranslation();

    const allStudentsOnDay = useMemo(() => {
        const studentsList: (Student & { busName: string; status: 'boarded' | 'notRiding' | 'disembarked' | 'not_boarded' })[] = [];
        relevantRoutes.forEach(route => {
            const bus = buses.find(b => b.id === route.busId);
            if (!bus) return;
            route.seating.forEach(seat => {
                if (!seat.studentId) return;
                const student = students.find(s => s.id === seat.studentId);
                if (student) {
                    const record = allAttendance[route.id];
                    const isAfterschoolAbsent = route.type === 'AfterSchool' && afterschoolAbsentStudentIds?.has(student.id);
                    let status: any = 'not_boarded';
                    if (record?.boarded?.includes(student.id)) status = 'boarded';
                    else if (record?.notBoarding?.includes(student.id) || isAfterschoolAbsent) status = 'notRiding';
                    else if (record?.disembarked?.includes(student.id)) status = 'disembarked';
                    if (!studentsList.some(s => s.id === student.id)) studentsList.push({ ...student, busName: bus.name, status });
                }
            });
        });
        return studentsList.sort((a,b) => {
            const priority = (s: string) => {
                if (s === 'not_boarded') return 1;
                if (s === 'notRiding') return 2;
                if (s === 'boarded') return 3;
                if (s === 'disembarked') return 4;
                return 5;
            };
            if (priority(a.status) !== priority(b.status)) return priority(a.status) - priority(b.status);
            const busCmp = a.busName.localeCompare(b.busName, undefined, { numeric: true });
            if (busCmp !== 0) return busCmp;
            if (getGradeValue(a.grade) !== getGradeValue(b.grade)) return getGradeValue(a.grade) - getGradeValue(b.grade);
            if (a.class !== b.class) return a.class.localeCompare(b.class, undefined, { numeric: true });
            return getStudentName(a, i18n.language).localeCompare(getStudentName(b, i18n.language), 'ko');
        });
    }, [relevantRoutes, students, buses, allAttendance, i18n.language, afterschoolAbsentStudentIds]);

    const handleCopyNotBoarded = () => {
        const notBoardedStudents = allStudentsOnDay.filter(s => s.status === 'not_boarded');
        
        if (notBoardedStudents.length === 0) {
            toast({
                title: t('success') || '알림',
                description: '미탑승자가 없습니다.'
            });
            return;
        }

        const busGroups: Record<string, string[]> = {};
        notBoardedStudents.forEach(s => {
            if (!busGroups[s.busName]) {
                busGroups[s.busName] = [];
            }
            busGroups[s.busName].push(formatStudentName(s));
        });

        const firstRoute = relevantRoutes[0];
        const dayName = firstRoute ? t(`days.${firstRoute.dayOfWeek}`) : '';
        const routeTypeName = firstRoute ? t(`route_type.${firstRoute.type.toLowerCase()}`) : '';

        let text = `[미탑승자 명단 (${dayName} ${routeTypeName})]\n`;
        
        const sortedBusNames = Object.keys(busGroups).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''), 10);
            const numB = parseInt(b.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b, 'ko');
        });

        sortedBusNames.forEach(busName => {
            text += `- ${busName}: ${busGroups[busName].join(', ')}\n`;
        });

        navigator.clipboard.writeText(text).then(() => {
            toast({
                title: t('success') || '성공',
                description: '미탑승자 명단이 복사되었습니다.'
            });
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            toast({
                title: t('error') || '오류',
                description: '클립보드 복사에 실패했습니다.',
                variant: 'destructive'
            });
        });
    };

    return (
        <Card className="border-none shadow-none lg:border lg:shadow-sm w-full h-full">
            <CardHeader className="px-2 py-3 sm:px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base sm:text-lg">{t('teacher_page.all_buses_view.title')}</CardTitle>
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs flex items-center gap-1.5 shrink-0"
                    onClick={handleCopyNotBoarded}
                >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t('teacher_page.all_buses_view.copy_button') || '미탑승자 복사'}</span>
                </Button>
            </CardHeader>
            <CardContent className="px-1 sm:px-2 max-h-[70vh] overflow-y-auto">
                <Table className="w-full">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="whitespace-nowrap w-px">{t('student.name')}</TableHead>
                            <TableHead className="whitespace-nowrap w-px">{t('bus')}</TableHead>
                            <TableHead className="whitespace-nowrap">{t('teacher_page.status')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allStudentsOnDay.map(s => (
                            <TableRow key={s.id}>
                                <TableCell className="whitespace-nowrap font-medium text-xs">{formatStudentName(s)}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{s.busName}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                    <Badge variant={s.status === 'boarded' ? 'default' : (s.status === 'notRiding' ? 'destructive' : (s.status === 'disembarked' ? 'outline' : 'secondary'))} className="text-[10px] sm:text-xs py-0 h-5 whitespace-nowrap">{t(`teacher_page.status_${s.status}`)}</Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {allStudentsOnDay.length === 0 && <div className="text-center text-xs text-muted-foreground py-8">{t('no_students')}</div>}
            </CardContent>
        </Card>
    );
};

const AllGroupLeadersStatus = ({ relevantRoutes, students, buses, formatStudentName, t }: { relevantRoutes: Route[]; students: Student[]; buses: Bus[]; formatStudentName: (student: Student) => string; t: any; }) => {
    const [leadersMap, setLeadersMap] = useState<Record<string, { names: string[]; days: number } | null>>({});
    const [selectedBusIds, setSelectedBusIds] = useState<Set<string>>(new Set());
    const [editingBusId, setEditingBusId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingBusRecords, setEditingBusRecords] = useState<GroupLeaderRecord[]>([]);
    
    const isAfterSchool = relevantRoutes.length > 0 && relevantRoutes[0].type === 'AfterSchool';

    const { toast } = useToast();

    const fetchAll = useCallback(async () => {
        const results: any = {};
        const activeBuses = buses.filter(b => b.isActive !== false);
        const busIds = activeBuses.map(b => b.id);
        
        await Promise.all(busIds.map(async (busId) => {
            const recs = await getGroupLeaderRecords("", busId, "Morning");
            const active = recs.filter(x => x.endDate === null);
            // Stale ended records cleanup
            if (recs.length !== active.length) {
                saveGroupLeaderRecords("", active, busId, "Morning").catch(console.error);
            }
            if (active.length > 0) {
                const minDate = Math.min(...active.map(l => new Date(l.startDate).getTime()));
                const days = differenceInDays(new Date(), new Date(minDate)) + 1;
                results[busId] = { names: active.map(l => {
                    const student = students.find(s => s.id === l.studentId);
                    return student ? formatStudentName(student) : (l.name || "알 수 없음");
                }), days };
            } else results[busId] = null;
        }));
        setLeadersMap(results);
    }, [buses, students, formatStudentName]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const handleDownloadTemplate = () => {
        const aoa = [
            ['버스번호', '학년', '반', '이름', '(주의: 버스번호는 숫자만 써도 됩니다. 예: 1, 2)'],
            ['1', '7', '1', '홍길동'],
            ['2', 'S1', 'A', '김철수']
        ];
        const worksheet = XLSX.utils.aoa_to_sheet(aoa);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "조장일괄입력_양식");
        XLSX.writeFile(workbook, "KIS_Leader_Batch_Template.xlsx");
    };

    const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const data = evt.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

            const dataRows = rows.slice(1);
            const busUpdates: Record<string, GroupLeaderRecord[]> = {};
            let matchCount = 0;

            for (const row of dataRows) {
                if (!row[0] || !row[3]) continue;
                const busInput = String(row[0]).trim().toUpperCase();
                const grade = String(row[1]).trim();
                const klass = String(row[2]).trim();
                const name = String(row[3]).trim();

                const targetBus = buses.find(b => {
                    const bName = b.name.trim().toUpperCase();
                    const bNameWithoutBus = bName.replace(/^BUS\s*/, '').trim();
                    const busInputWithoutBus = busInput.replace(/^BUS\s*/, '').trim();
                    
                    return (
                        bName === busInput || 
                        bNameWithoutBus === busInput || 
                        bNameWithoutBus === busInputWithoutBus
                    );
                });

                if (!targetBus) continue;

                const targetStudent = students.find(s => 
                    normalizeString(getStudentName(s, 'ko')) === normalizeString(name) &&
                    String(s.grade).toUpperCase() === grade.toUpperCase() &&
                    String(s.class).toUpperCase() === klass.toUpperCase()
                );

                if (!targetStudent) continue;

                if (!busUpdates[targetBus.id]) {
                    busUpdates[targetBus.id] = await getGroupLeaderRecords("", targetBus.id, "Morning");
                }

                if (!busUpdates[targetBus.id].some(r => r.studentId === targetStudent.id && r.endDate === null)) {
                    busUpdates[targetBus.id].push({
                        studentId: targetStudent.id,
                        name: `${targetStudent.grade.toUpperCase()}${targetStudent.class} ${getStudentName(targetStudent, 'ko')}`,
                        startDate: format(new Date(), 'yyyy-MM-dd'),
                        endDate: null,
                        days: 1
                    });
                    matchCount++;
                }
            }

            if (matchCount > 0) {
                await Promise.all(Object.entries(busUpdates).map(([bid, recs]) => saveGroupLeaderRecords("", recs, bid, "Morning")));
                toast({ title: "일괄 처리 완료", description: `${matchCount}명의 학생이 새 조장으로 임명되었습니다.` });
                fetchAll();
            } else {
                toast({ title: "처리 실패", description: "매칭된 학생이 없거나 이미 모두 조장입니다.", variant: "destructive" });
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const handleDemoteAll = async (busId: string, silent = false) => {
        if (!silent && !confirm(t('teacher_page.group_leader_management.delete_confirm.description'))) return;
        // Completely delete all group leader records for this bus
        await saveGroupLeaderRecords("", [], busId, "Morning");
        if (!silent) {
            toast({ title: t('teacher_page.demote_leader') });
            fetchAll();
        }
        return true;
    };

    const handleBulkDemote = async () => {
        if (selectedBusIds.size === 0) return;
        if (!confirm(`${selectedBusIds.size}개 버스의 모든 조장을 해제하시겠습니까?`)) return;
        
        await Promise.all(Array.from(selectedBusIds).map(bid => handleDemoteAll(bid, true)));
        toast({ title: "일괄 해제 완료" });
        setSelectedBusIds(new Set());
        fetchAll();
    };

    const startEditing = async (busId: string) => {
        const recs = await getGroupLeaderRecords("", busId, "Morning");
        const activeOnly = recs.filter(r => r.endDate === null);
        setEditingBusRecords(activeOnly);
        setEditingBusId(busId);
        setSearchQuery("");
    };

    const toggleLeaderInDialog = (student: Student) => {
        const isCurrentlyLeader = editingBusRecords.some(r => r.studentId === student.id && r.endDate === null);
        
        let next: GroupLeaderRecord[];
        if (isCurrentlyLeader) {
            // Completely remove student from group leader records
            next = editingBusRecords.filter(r => r.studentId !== student.id);
        } else {
            const active = editingBusRecords.filter(r => r.endDate === null);
            if (active.length >= 3) { toast({ title: "실패", description: "조장은 최대 3명입니다.", variant: "destructive" }); return; }
            next = [...editingBusRecords, {
                studentId: student.id,
                name: formatStudentName(student),
                startDate: format(new Date(), 'yyyy-MM-dd'),
                endDate: null,
                days: 1
            }];
        }
        setEditingBusRecords(next);
    };

    const saveEditing = async () => {
        if (!editingBusId) return;
        await saveGroupLeaderRecords("", editingBusRecords, editingBusId, "Morning");
        toast({ title: "수정 완료" });
        setEditingBusId(null);
        fetchAll();
    };

    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const norm = normalizeString(searchQuery);
        return students.filter(s => 
            normalizeString(getStudentName(s, 'ko')).includes(norm) || 
            normalizeString(getStudentName(s, 'en')).includes(norm)
        ).slice(0, 10);
    }, [students, searchQuery]);

    const sorted = useMemo(() => {
        const activeBuses = buses.filter(b => b.isActive !== false);
        return activeBuses.map(bus => {
            return {
                busId: bus.id,
                busName: bus.name,
                leaderNames: leadersMap[bus.id]?.names || [t('unassigned')],
                days: leadersMap[bus.id]?.days || 0
            };
        }).sort((a,b) => { 
            const numA = parseInt(a.busName.replace(/\D/g, ''), 10); 
            const numB = parseInt(b.busName.replace(/\D/g, ''), 10); 
            return (!isNaN(numA) && !isNaN(numB)) ? numA - numB : a.busName.localeCompare(b.busName); 
        });
    }, [buses, leadersMap, t]);

    const handleToggleAll = (checked: boolean) => {
        if (checked) setSelectedBusIds(new Set(sorted.map(s => s.busId)));
        else setSelectedBusIds(new Set());
    };

    const handleToggleOne = (busId: string, checked: boolean) => {
        const next = new Set(selectedBusIds);
        if (checked) next.add(busId);
        else next.delete(busId);
        setSelectedBusIds(next);
    };

    const handleExportExcel = async () => {
        const allLeaders = sorted.flatMap(item => 
            item.leaderNames
                .filter(name => name && name !== t('unassigned'))
                .map(name => ({ 
                    name, 
                    busName: item.busName 
                }))
        );

        if (allLeaders.length === 0) return;

        const COL_SIZE = 25;
        const displayRowCount = Math.max(COL_SIZE, Math.ceil(allLeaders.length / 2));
        const year = format(new Date(), 'yyyy');
        const month = parseInt(format(new Date(), 'M'), 10);
        const semester = (month >= 1 && month <= 7) ? '1' : '2';

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('조장명단');

        worksheet.columns = [
            { width: 6 },
            { width: 22 },
            { width: 15 },
            { width: 6 },
            { width: 22 },
            { width: 15 }
        ];

        const titleRow = worksheet.getRow(1);
        titleRow.height = 40;
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `${year}학년도 ${semester}학기 학생 차량 안전 도우미(차장) 명단`;
        titleCell.font = { name: '돋움', size: 20, bold: true };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.mergeCells('A1:F1');

        worksheet.getCell('E3').value = '호치민시한국국제학교';
        worksheet.getCell('E3').font = { name: '돋움', size: 11, bold: true };
        worksheet.getCell('E3').alignment = { horizontal: 'right' };
        worksheet.mergeCells('E3:F3');

        worksheet.getCell('E4').value = '자치생활부';
        worksheet.getCell('E4').font = { name: '돋움', size: 11, bold: true };
        worksheet.getCell('E4').alignment = { horizontal: 'right' };
        worksheet.mergeCells('E4:F4');

        const headerRow = worksheet.getRow(5);
        headerRow.height = 25;
        const headers = ['순', '차장', '비고', '순', '차장', '비고'];
        headers.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = h;
            cell.font = { name: '돋움', size: 10, bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE9ECEF' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        for (let i = 0; i < displayRowCount; i++) {
            const leftIdx = i;
            const rightIdx = i + displayRowCount;
            const left = allLeaders[leftIdx];
            const right = allLeaders[rightIdx];
            
            const rowIndex = 6 + i;
            const row = worksheet.getRow(rowIndex);
            row.height = 22;

            const values = [
                leftIdx + 1,
                left ? left.name : '',
                left ? left.busName : '',
                rightIdx + 1,
                right ? right.name : '',
                right ? right.busName : ''
            ];

            values.forEach((v, colIdx) => {
                const cell = row.getCell(colIdx + 1);
                cell.value = v;
                cell.font = { name: '돋움', size: 10 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        }

        const finalRowIndex = 6 + displayRowCount + 1;
        const footerRow = worksheet.getRow(finalRowIndex);
        footerRow.height = 25;
        const footerCell = worksheet.getCell(`A${finalRowIndex}`);
        footerCell.value = '*특이사항 없는 차장의 경우 8시간 봉사 시간(봉사 내용: 학생 차량 안전 도우미, 영역: 이웃돕기활동) 부여';
        footerCell.font = { name: '돋움', size: 10, italic: true };
        footerCell.alignment = { vertical: 'middle', horizontal: 'left' };
        worksheet.mergeCells(`A${finalRowIndex}:F${finalRowIndex}`);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        const fileName = `KIS_Group_Leaders_${year}_${semester}th_${format(new Date(), 'MMdd')}.xlsx`;
        anchor.download = fileName;
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <Card className="border-none shadow-none lg:border lg:shadow-sm w-full h-full">
            <CardHeader className="px-2 py-3 sm:px-4">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-base sm:text-lg">{t('teacher_page.all_group_leaders_view.title')}</CardTitle>
                    <div className="flex gap-1.5 sm:gap-2">
                        {selectedBusIds.size > 0 && (
                            <Button variant="destructive" size="sm" onClick={handleBulkDemote} className="h-8 px-2 animate-in fade-in slide-in-from-right-2">
                                <UserMinus className="sm:mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">선택 해제 ({selectedBusIds.size})</span>
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="h-8 px-2">
                            <FileDown className="sm:mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">템플릿</span>
                        </Button>
                        <Label htmlFor="batch-leader-upload" className="cursor-pointer">
                            <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-2">
                                <Upload className="sm:mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">일괄입력</span>
                            </div>
                            <Input id="batch-leader-upload" type="file" className="hidden" accept=".xlsx, .xls" onChange={handleBatchUpload} />
                        </Label>
                        <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-8 px-2">
                            <Download className="sm:mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">{t('export')}</span>
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-1 sm:px-2 max-h-[70vh] overflow-y-auto">
                <Table className="w-full">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-px">
                                <Checkbox 
                                    checked={selectedBusIds.size > 0 && selectedBusIds.size === sorted.length}
                                    onCheckedChange={(c) => handleToggleAll(!!c)}
                                />
                            </TableHead>
                            <TableHead className="whitespace-nowrap w-px">{t('bus')}</TableHead>
                            <TableHead className="whitespace-nowrap">{t('teacher_page.group_leader_management.name')}</TableHead>
                            <TableHead className="whitespace-nowrap w-px">{t('teacher_page.group_leader_management.days')}</TableHead>
                            <TableHead className="whitespace-nowrap w-px text-right">관리</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sorted.map((item, idx) => (
                            <TableRow key={idx}>
                                <TableCell>
                                    <Checkbox 
                                        checked={selectedBusIds.has(item.busId)}
                                        onCheckedChange={(c) => handleToggleOne(item.busId, !!c)}
                                    />
                                </TableCell>
                                <TableCell className="font-medium whitespace-nowrap text-xs">{item.busName}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs">
                                    <div className="flex flex-col gap-0.5">
                                        {item.leaderNames.map((n, i) => (
                                            <span key={i} className="flex items-center gap-1 truncate max-w-[100px] sm:max-w-none">
                                                {n !== t('unassigned') && <Crown className="w-3 h-3 text-yellow-500 shrink-0" />}
                                                {n}
                                            </span>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-xs text-center">{item.days > 0 ? `${item.days}${t('teacher_page.group_leader_days_suffix')}` : '-'}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditing(item.busId)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDemoteAll(item.busId)}>
                                            <UserMinus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>

            <Dialog open={!!editingBusId} onOpenChange={(o) => !o && setEditingBusId(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>조장 수정 - {buses.find(b => b.id === editingBusId)?.name}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>기존 활동 조장</Label>
                            <div className="flex flex-wrap gap-2">
                                {editingBusRecords.filter(r => r.endDate === null).map(r => (
                                    <Badge key={r.studentId} variant="secondary" className="pl-1 pr-2 py-1 gap-1">
                                        <Button variant="ghost" size="icon" className="h-4 w-4 p-0 rounded-full" onClick={() => toggleLeaderInDialog(students.find(s => s.id === r.studentId)!)}>
                                            <UserMinus className="h-3 w-3" />
                                        </Button>
                                        {r.name}
                                    </Badge>
                                ))}
                                {editingBusRecords.filter(r => r.endDate === null).length === 0 && (
                                    <span className="text-xs text-muted-foreground italic">임명된 조장 없음</span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>신규 조장 검색</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="학생 이름 검색..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            
                            {filteredStudents.length > 0 && (
                                <div className="border rounded-md divide-y overflow-hidden bg-background">
                                    {filteredStudents.map(s => {
                                        const isLeader = editingBusRecords.some(r => r.studentId === s.id && r.endDate === null);
                                        return (
                                            <Button key={s.id} variant="ghost" className="w-full justify-between font-normal h-10 px-3 rounded-none" onClick={() => toggleLeaderInDialog(s)}>
                                                <span className="text-sm">{formatStudentName(s)}</span>
                                                {isLeader ? <Check className="h-4 w-4 text-primary" /> : <Crown className="h-4 w-4 text-muted-foreground opacity-30" />}
                                            </Button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setEditingBusId(null)}>취소</Button>
                        <Button onClick={saveEditing}>변경내용 저장</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
};

const TeacherAssignmentViewDialog = ({ 
    buses, 
    teachers, 
    afterSchoolTeachers, 
    saturdayTeachers, 
    selectedDay: initialDay, 
    selectedRouteType: initialRouteType, 
    semesterMode = 'regular',
    t 
}: { 
    buses: Bus[]; 
    teachers: Teacher[]; 
    afterSchoolTeachers: Teacher[]; 
    saturdayTeachers: Teacher[]; 
    selectedDay: DayOfWeek; 
    selectedRouteType: RouteType; 
    semesterMode?: 'regular' | 'vacation';
    t: any; 
}) => {
    // Mode: 'commute' (통학버스 [등·하교 통합]), 'afterSchool' (방과후 요일별), 'saturday' (토요)
    const [viewCategory, setViewCategory] = useState<'commute' | 'afterSchool' | 'saturday'>(() => {
        if (initialDay === 'Saturday') return 'saturday';
        if (initialRouteType === 'AfterSchool') return 'afterSchool';
        return 'commute';
    });

    const [afterSchoolDay, setAfterSchoolDay] = useState<DayOfWeek>(() => {
        return initialDay === 'Saturday' ? 'Monday' : initialDay;
    });

    const [routesList, setRoutesList] = useState<Route[]>([]);
    const [loading, setLoading] = useState(true);

    // Sync initial state on open
    useEffect(() => {
        if (initialDay === 'Saturday') {
            setViewCategory('saturday');
        } else if (initialRouteType === 'AfterSchool') {
            setViewCategory('afterSchool');
            setAfterSchoolDay(initialDay);
        } else {
            setViewCategory('commute');
        }
    }, [initialDay, initialRouteType]);

    // Real-time listener for current selected category/day, strictly filtering by semesterMode
    useEffect(() => {
        setLoading(true);
        let q;
        if (viewCategory === 'commute') {
            // Commute uses Afternoon / Morning routes (which are strictly synchronized)
            q = query(
                collection(db(), 'routes'), 
                where('dayOfWeek', '==', 'Monday'), 
                where('type', '==', 'Afternoon')
            );
        } else if (viewCategory === 'afterSchool') {
            q = query(
                collection(db(), 'routes'), 
                where('dayOfWeek', '==', afterSchoolDay), 
                where('type', '==', semesterMode === 'vacation' ? 'Afternoon' : 'AfterSchool')
            );
        } else {
            q = query(
                collection(db(), 'routes'), 
                where('dayOfWeek', '==', 'Saturday')
            );
        }
        
        const unsub = onSnapshot(q, (snap) => {
            const fetched = snap.docs
                .map((d: any) => ({ id: d.id, ...d.data() } as Route))
                .filter(r => (r.semesterMode || 'regular') === semesterMode);
            setRoutesList(fetched);
            setLoading(false);
        }, (e: any) => {
            console.error("Assignment dialog real-time fetch error:", e);
            setLoading(false);
        });

        return () => unsub();
    }, [viewCategory, afterSchoolDay, semesterMode]);

    // Unified teacher lookup map across all teacher categories (filtered by current semesterMode)
    const allTeachersMap = useMemo(() => {
        const map = new Map<string, Teacher>();
        (teachers || []).filter(tc => (tc.semesterMode || 'regular') === semesterMode).forEach(tc => { if (tc?.id) map.set(tc.id, tc); });
        (afterSchoolTeachers || []).filter(tc => (tc.semesterMode || 'regular') === semesterMode).forEach(tc => { if (tc?.id && !map.has(tc.id)) map.set(tc.id, tc); });
        (saturdayTeachers || []).filter(tc => (tc.semesterMode || 'regular') === semesterMode).forEach(tc => { if (tc?.id && !map.has(tc.id)) map.set(tc.id, tc); });
        return map;
    }, [teachers, afterSchoolTeachers, saturdayTeachers, semesterMode]);

    // Filter to active, operational buses strictly belonging to the CURRENT semesterMode
    const operationalBuses = useMemo(() => {
        return sortBuses(
            (buses || []).filter(b => 
                (b.semesterMode || 'regular') === semesterMode &&
                (b.isActive ?? true) && 
                !b.excludeFromAssignment
            )
        );
    }, [buses, semesterMode]);

    const getAssignedNames = (busId: string): string[] => {
        const r = routesList.find(x => x.busId === busId);
        
        // 1. Authoritative Route assignment
        if (r) {
            if (r.teacherIds && r.teacherIds.filter(Boolean).length > 0) {
                const names = r.teacherIds
                    .map(id => allTeachersMap.get(id)?.name)
                    .filter((n): n is string => Boolean(n));
                if (names.length > 0) return Array.from(new Set(names));
            }
            // Route exists but has no assigned teachers -> correctly return empty (미배정)
            return [];
        }

        // 2. Fallback only if no route document exists at all in database
        if (viewCategory === 'commute') {
            const busTeachers = (teachers || []).filter(tc => 
                (tc.semesterMode || 'regular') === semesterMode && 
                tc.assignedBusId === busId
            );
            if (busTeachers.length > 0) {
                return Array.from(new Set(busTeachers.map(tc => tc.name).filter(Boolean)));
            }
        }
        return [];
    };
    
    return (
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-5">
            <DialogHeader className="space-y-1.5 pb-2 border-b">
                <div className="flex items-center justify-between gap-2">
                    <DialogTitle className="text-base sm:text-lg font-extrabold text-slate-900 whitespace-nowrap truncate">
                        {t('teacher_page.assignments_dialog.title')}
                    </DialogTitle>
                    <Badge 
                        variant={semesterMode === 'vacation' ? 'destructive' : 'secondary'} 
                        className="text-[10px] font-bold px-2 py-0.5 shrink-0"
                    >
                        {semesterMode === 'vacation' ? (t('vacation') || '방학 중') : (t('regular') || '학기 중')}
                    </Badge>
                </div>
                <DialogDescription className="text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
                    {t('teacher_page.assignments_dialog.description')}
                </DialogDescription>
            </DialogHeader>

            {/* Filter Selector Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b bg-slate-50/80 -mx-5 px-5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">구분:</span>
                    <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setViewCategory('commute')}
                            className={cn(
                                "px-2.5 py-1 text-xs font-bold rounded-md transition-all",
                                viewCategory === 'commute' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            통학 (등·하교)
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewCategory('afterSchool')}
                            className={cn(
                                "px-2.5 py-1 text-xs font-bold rounded-md transition-all",
                                viewCategory === 'afterSchool' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            방과후
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewCategory('saturday')}
                            className={cn(
                                "px-2.5 py-1 text-xs font-bold rounded-md transition-all",
                                viewCategory === 'saturday' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            토요 버스
                        </button>
                    </div>
                </div>

                {viewCategory === 'afterSchool' && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600">요일:</span>
                        <Select value={afterSchoolDay} onValueChange={(val) => setAfterSchoolDay(val as DayOfWeek)}>
                            <SelectTrigger className="h-8 text-xs font-semibold w-[100px] bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as DayOfWeek[]).map(d => (
                                    <SelectItem key={d} value={d} className="text-xs font-medium">
                                        {t(`day.${d.toLowerCase()}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            <div className="mt-2 border rounded-xl overflow-y-auto flex-1 min-h-[260px] shadow-xs">
                {loading ? (
                    <div className="flex justify-center items-center py-16 text-xs text-muted-foreground">
                        {t('loading')}...
                    </div>
                ) : operationalBuses.length === 0 ? (
                    <div className="flex justify-center items-center py-16 text-xs text-muted-foreground">
                        운행 중인 버스가 없습니다.
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-slate-100 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-[100px] font-bold text-slate-800">{t('admin.bus_registration.bus_number')}</TableHead>
                                <TableHead className="w-[80px] font-bold text-slate-800">{t('type')}</TableHead>
                                <TableHead className="font-bold text-slate-800">
                                    {viewCategory === 'commute' ? '통학버스 담당 교사 (등·하교 공통)' : (viewCategory === 'afterSchool' ? '방과후 담당 교사' : '토요 담당 교사')}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {operationalBuses.map((b: Bus) => {
                                const namesList = getAssignedNames(b.id);
                                const isUnassigned = namesList.length === 0;

                                return (
                                    <TableRow key={b.id} className="hover:bg-slate-50/80">
                                        <TableCell className="font-bold whitespace-nowrap text-slate-900">{b.name}</TableCell>
                                        <TableCell className="whitespace-nowrap text-xs text-slate-600">{t(`bus_type.${b.type}`)}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1.5 items-center">
                                                {isUnassigned ? (
                                                    <span className="text-slate-400 italic text-xs">{t('unassigned')}</span>
                                                ) : (
                                                    namesList.map((nameStr: string, i: number) => (
                                                        <Badge key={i} variant="secondary" className="font-bold text-xs bg-indigo-50 text-indigo-700 border-indigo-200 py-0.5 px-2 whitespace-nowrap">
                                                            {nameStr}
                                                        </Badge>
                                                    ))
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>
        </DialogContent>
    );
};

export default function TeacherPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [rawStudents, setRawStudents] = useState<Student[]>([]);
  const [afterschoolCourses, setAfterschoolCourses] = useState<any[]>([]);
  const [afterschoolEnrollments, setAfterschoolEnrollments] = useState<any[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [allStaticRoutes, setAllStaticRoutes] = useState<Route[]>([]);
  const activeListenersRef = useRef<Record<string, () => void>>({});
  const globalListenerRef = useRef<(() => void) | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [afterSchoolTeachers, setAfterSchoolTeachers] = useState<Teacher[]>([]);
  const [saturdayTeachers, setSaturdayTeachers] = useState<Teacher[]>([]);
  const [afterSchoolClasses, setAfterSchoolClasses] = useState<AfterSchoolClass[]>([]);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);

  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [allAttendance, setAllAttendance] = useState<Record<string, AttendanceRecord | null>>({});
  const [selectedStudent, setSelectedStudent] = useState<Student & { isGroupLeader?: boolean } | null>(null);
  const [groupLeaderRecords, setGroupLeaderRecords] = useState<GroupLeaderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [lastClickedStudentId, setLastClickedStudentId] = useState<string | null>(null);
  const [swapSourceSeat, setSwapSourceSeat] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [isManualMode, setIsManualMode] = useState(false);
  const [semesterMode, setSemesterMode] = useState<'regular' | 'vacation'>('regular');
  const [afterschoolStageStatus, setAfterschoolStageStatus] = useState<string>('CLOSED');

  const isAfterSchoolActive = useMemo(() => {
    return afterschoolStageStatus === 'CONFIRMED' || afterschoolStageStatus === 'OPERATING' || afterschoolCourses.length > 0 || afterSchoolClasses.length > 0;
  }, [afterschoolStageStatus, afterschoolCourses.length, afterSchoolClasses.length]);

  const activeAfterSchoolClasses = useMemo(() => {
    return afterSchoolClasses.filter(c => (c.semesterMode || 'regular') === semesterMode);
  }, [afterSchoolClasses, semesterMode]);
  
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrAlertStudent, setQrAlertStudent] = useState<Student | null>(null);
  const [qrAlertCorrectBusName, setQrAlertCorrectBusName] = useState<string | null>(null);
  const [qrAlertErrorReason, setQrAlertErrorReason] = useState<'wrong_bus' | 'no_route' | 'invalid_qr' | null>(null);
  const [qrScanLock, setQrScanLock] = useState(false);
  const [qrScanSuccessStudentName, setQrScanSuccessStudentName] = useState<string | null>(null);
  const [qrScanSuccessStatus, setQrScanSuccessStatus] = useState<'boarded' | 'disembarked' | null>(null);

  const { user, profile, logout } = useAuth();
  const { toast } = useToast();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPin, setAuthPin] = useState('');
  const [authError, setAuthError] = useState(false);
  const [validPin, setValidPin] = useState('1234');
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [currentTeacherName, setCurrentTeacherName] = useState('');
  const [teacherNameInput, setTeacherNameInput] = useState('');
  const [loginStep, setLoginStep] = useState<'name' | 'pin'>('name');
  const [isGuest, setIsGuest] = useState(false);

  // Unified logged in teacher document lookup (MUST BE AT TOP LEVEL HOOKS)
  const loggedInTeacherDoc = useMemo(() => {
    if (currentTeacherId) {
      const found = teachers.find(t => t.id === currentTeacherId) ||
                    afterSchoolTeachers.find(t => t.id === currentTeacherId) ||
                    saturdayTeachers.find(t => t.id === currentTeacherId);
      if (found) return found;
    }
    if (currentTeacherName) {
      const trimmed = currentTeacherName.trim();
      const found = teachers.find(t => t.name && t.name.trim() === trimmed) ||
                    afterSchoolTeachers.find(t => t.name && t.name.trim() === trimmed) ||
                    saturdayTeachers.find(t => t.name && t.name.trim() === trimmed);
      if (found) return found;
    }
    if (profile?.email) {
      const emailLower = profile.email.toLowerCase().trim();
      const found = teachers.find(t => t.email && t.email.toLowerCase().trim() === emailLower) ||
                    afterSchoolTeachers.find(t => t.email && t.email.toLowerCase().trim() === emailLower) ||
                    saturdayTeachers.find(t => t.email && t.email.toLowerCase().trim() === emailLower);
      if (found) return found;
    }
    return null;
  }, [teachers, afterSchoolTeachers, saturdayTeachers, currentTeacherId, currentTeacherName, profile]);

  // 실시간 노선(routes) 데이터 기반 담당 버스 자동 조회
  const teacherAssignedBuses = useMemo(() => {
    const tId = loggedInTeacherDoc?.id || currentTeacherId;
    const tName = (currentTeacherName || loggedInTeacherDoc?.name || profile?.name || '').trim();
    if (!tId && !tName) return { commuteBusId: '', afterSchoolBusId: '', saturdayBusId: '' };

    const targetRoutes = (allStaticRoutes && allStaticRoutes.length > 0 ? allStaticRoutes : allRoutes);

    const isMatchingTeacher = (r: Route) => {
      if (tId && (r.teacherIds?.includes(tId) || (r as any).teacherId === tId)) return true;
      if (tName) {
        if (r.teacherIds?.some(id => {
          const matchT = teachers.find(t => t.id === id) || afterSchoolTeachers.find(t => t.id === id) || saturdayTeachers.find(t => t.id === id);
          return matchT?.name && matchT.name.trim() === tName;
        })) return true;
      }
      return false;
    };

    const commuteRoute = targetRoutes.find(r => 
      (r.type === 'Morning' || r.type === 'Afternoon') && 
      (r.semesterMode || 'regular') === semesterMode && 
      isMatchingTeacher(r)
    );

    const afterSchoolRoute = targetRoutes.find(r => 
      r.type === 'AfterSchool' && 
      (r.semesterMode || 'regular') === semesterMode && 
      isMatchingTeacher(r)
    );

    const saturdayRoute = targetRoutes.find(r => 
      r.type === 'Saturday' && 
      isMatchingTeacher(r)
    );

    const commuteBusId = commuteRoute?.busId || loggedInTeacherDoc?.assignedBusId || '';
    const afterSchoolBusId = afterSchoolRoute?.busId || loggedInTeacherDoc?.assignedAfterSchoolBusId || '';
    const saturdayBusId = saturdayRoute?.busId || '';

    return { commuteBusId, afterSchoolBusId, saturdayBusId };
  }, [loggedInTeacherDoc, currentTeacherId, currentTeacherName, profile?.name, allStaticRoutes, allRoutes, semesterMode, teachers, afterSchoolTeachers, saturdayTeachers]);

  const shortTeacherBusText = useMemo(() => {
    if (!loggedInTeacherDoc && !currentTeacherName) return lang === 'ko' ? '미지정' : 'Unassigned';
    
    const commuteBusName = buses.find(b => b.id === teacherAssignedBuses.commuteBusId)?.name;
    const afterSchoolBusName = buses.find(b => b.id === teacherAssignedBuses.afterSchoolBusId)?.name;
    const saturdayBusName = buses.find(b => b.id === teacherAssignedBuses.saturdayBusId)?.name;

    const mainBusName = commuteBusName || afterSchoolBusName || saturdayBusName;
    if (!mainBusName) return lang === 'ko' ? '미지정' : 'Unassigned';

    // '담당 버스' 접두사를 빼고 '00호' 형태로 간결하게 포맷팅
    return mainBusName.endsWith('호차') ? mainBusName.replace('차', '') : mainBusName;
  }, [loggedInTeacherDoc, currentTeacherName, buses, teacherAssignedBuses, lang]);

  const teacherBusInfoText = useMemo(() => {
    if (!loggedInTeacherDoc && !currentTeacherName) return lang === 'ko' ? '담당 버스: 미지정' : 'Bus: Unassigned';
    
    const commuteBusName = buses.find(b => b.id === teacherAssignedBuses.commuteBusId)?.name;
    const afterSchoolBusName = buses.find(b => b.id === teacherAssignedBuses.afterSchoolBusId)?.name;
    const saturdayBusName = buses.find(b => b.id === teacherAssignedBuses.saturdayBusId)?.name;

    const parts: string[] = [];
    if (commuteBusName) parts.push(`${lang === 'ko' ? '등하교: ' : 'Bus: '}${commuteBusName}`);
    if (afterSchoolBusName) parts.push(`${lang === 'ko' ? '방과후: ' : 'AS: '}${afterSchoolBusName}`);
    if (saturdayBusName) parts.push(`${lang === 'ko' ? '토요: ' : 'Sat: '}${saturdayBusName}`);

    if (parts.length === 0) return lang === 'ko' ? '담당 버스: 미지정' : 'Bus: Unassigned';
    return parts.join(' | ');
  }, [loggedInTeacherDoc, currentTeacherName, buses, teacherAssignedBuses, lang]);

  useEffect(() => {
    const unsubTeachers = onSnapshot(collection(db(), 'teachers'), (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher));
      setTeachers(fetched);
    }, (err) => {
      console.warn("Silent fetch teachers error (unauthenticated):", err);
    });

    const unsubPin = onSnapshot(doc(db(), 'config', 'teachers'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().pin) {
        setValidPin(docSnap.data().pin);
      }
    }, (err) => {
      console.warn("Silent fetch config pin error (unauthenticated):", err);
    });

    const unsubSettings = onGlobalSettingsUpdate((data) => {
      if (data?.semesterMode) {
        setSemesterMode(data.semesterMode as any);
      }
    });

    const unsubAfterschoolSettings = onTeacherApplySettingsUpdate((settings) => {
      if (settings?.afterschoolStageStatus) {
        setAfterschoolStageStatus(settings.afterschoolStageStatus);
      }
    });

    // Initial allStaticRoutes snapshot listener so routes are always available
    const unsubRoutes = onSnapshot(collection(db(), 'routes'), (snap) => {
      setAllStaticRoutes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Route)));
    }, (err) => {
      console.warn("Routes snapshot listener error:", err);
    });

    return () => {
      unsubTeachers();
      unsubPin();
      unsubSettings();
      unsubAfterschoolSettings();
      unsubRoutes();
    };
  }, []);

  // Auto clean-up leftover classes from previous semesters if stage is CLOSED and courses are empty
  useEffect(() => {
    if (afterschoolStageStatus === 'CLOSED' && afterSchoolClasses.length > 0 && afterschoolCourses.length === 0) {
      import('@/lib/kisbus/after-school-classes').then(m => m.clearAllAfterSchoolClasses()).catch(console.error);
    }
  }, [afterschoolStageStatus, afterSchoolClasses.length, afterschoolCourses.length]);

  useEffect(() => {
    // 1. Google Workspace 로그인된 교직원 계정 자동 인식
    if (user && profile) {
      const emailLower = (profile.email || user.email || '').toLowerCase().trim();
      const pName = (profile.name || user.displayName || '').trim();

      const matched = teachers.find(t => 
        (emailLower && t.email && t.email.toLowerCase().trim() === emailLower) ||
        (pName && t.name && t.name.trim() === pName)
      ) || afterSchoolTeachers.find(t => 
        (emailLower && t.email && t.email.toLowerCase().trim() === emailLower) ||
        (pName && t.name && t.name.trim() === pName)
      ) || saturdayTeachers.find(t => 
        (emailLower && t.email && t.email.toLowerCase().trim() === emailLower) ||
        (pName && t.name && t.name.trim() === pName)
      );

      if (matched) {
        setCurrentTeacherId(matched.id);
        setCurrentTeacherName(matched.name);
        setIsAuthenticated(true);
        setIsGuest(false);
        setLoading(false);
        return;
      } else if (pName) {
        setCurrentTeacherId('user_' + user.uid);
        setCurrentTeacherName(pName);
        setIsAuthenticated(true);
        setIsGuest(false);
        setLoading(false);
        return;
      }
    }

    // 2. 비로그인 시 로컬스토리지 PIN 세션 확인
    try {
      const session = localStorage.getItem('teacherSession');
      if (session) {
        const { id, name, guest } = JSON.parse(session);
        setCurrentTeacherId(id);
        setCurrentTeacherName(name || '');
        setIsGuest(!!guest);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    } finally {
      setLoading(false);
    }
  }, [user, profile, teachers, afterSchoolTeachers, saturdayTeachers]);

  const subscribeToBusRoutes = useCallback((busId: string) => {
    if (!busId || busId === 'all') return;
    if (activeListenersRef.current[busId] || globalListenerRef.current) return;

    const q = query(collection(db(), 'routes'), where('busId', '==', busId));
    const unsub = onSnapshot(q, (snap) => {
      const newRoutes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route));
      setAllRoutes(prev => {
        const filtered = prev.filter(r => r.busId !== busId);
        return [...filtered, ...newRoutes];
      });
    }, (err) => {
      console.error(`Fetch routes for bus ${busId} error:`, err);
    });

    activeListenersRef.current[busId] = unsub;
  }, []);

  const subscribeToAllRoutes = useCallback(() => {
    if (globalListenerRef.current) return;

    Object.values(activeListenersRef.current).forEach(unsub => unsub());
    activeListenersRef.current = {};

    const unsub = onSnapshot(collection(db(), 'routes'), (snap) => {
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route));
      setAllRoutes(fetched);
      setAllStaticRoutes(fetched);
    }, (err) => {
      console.error("Fetch all routes error:", err);
    });

    globalListenerRef.current = unsub;
  }, []);

  const unsubscribeAllRoutes = useCallback(() => {
    Object.values(activeListenersRef.current).forEach(unsub => unsub());
    activeListenersRef.current = {};
    if (globalListenerRef.current) {
      globalListenerRef.current();
      globalListenerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    getDocs(collection(db(), 'routes')).then((snap: any) => {
      setAllStaticRoutes(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Route)));
    }).catch((e: any) => {
      console.error("Static routes fetch error:", e);
    });
  }, [isAuthenticated]);

  const calculateDate = useCallback(() => {
    const now = new Date();
    const vTime = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60000);
    const h = vTime.getHours(), d = vTime.getDay();
    let tDate = new Date(vTime);
    
    if (d >= 1 && d <= 5 && h >= 19) tDate.setDate(tDate.getDate() + 1);
    else if (d === 6 && h >= 14) tDate.setDate(tDate.getDate() + 2);
    else if (d === 0) tDate.setDate(tDate.getDate() + 1);
    
    const newDate = format(tDate, 'yyyy-MM-dd');
    setSelectedDate(prev => prev !== newDate ? newDate : prev);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const tick = () => {
        if (!isManualMode) calculateDate();
    };
    
    tick();
    const intervalId = setInterval(tick, 60000);
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible' && !isManualMode) calculateDate(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const unsubBuses = onBusesUpdate(data => setBuses(sortBuses(data))); 
    const unsubStudents = onStudentsUpdate(setRawStudents); 

    const unsubDestinations = onDestinationsUpdate(setDestinations); 
    const unsubAfterSchoolTeachers = onAfterSchoolTeachersUpdate(setAfterSchoolTeachers); 
    const unsubSaturdayTeachers = onSaturdayTeachersUpdate(setSaturdayTeachers);
    const unsubAfterSchoolClasses = onAfterSchoolClassesUpdate(setAfterSchoolClasses);
    const unsubLostItems = onLostItemsUpdate(setLostItems);
    const unsubAfterschoolCourses = onAfterschoolCoursesUpdate(setAfterschoolCourses);
    const unsubAfterschoolEnrollments = onAfterschoolEnrollmentsUpdate(setAfterschoolEnrollments);
    setLoading(false);

    return () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        unsubBuses();
        unsubStudents();
        unsubDestinations();
        unsubAfterSchoolTeachers();
        unsubSaturdayTeachers();
        unsubAfterSchoolClasses();
        unsubLostItems();
        unsubAfterschoolCourses();
        unsubAfterschoolEnrollments();
        unsubscribeAllRoutes();
    };
  }, [isAuthenticated, currentTeacherId, teachers, isManualMode, calculateDate]);

  // 방과후학교 관리 데이터(강좌 및 수강생)와 학생 스쿨버스 데이터 실시간 연동 및 병합
  useEffect(() => {
    if (rawStudents.length === 0) {
      setStudents([]);
      return;
    }

    // 1. 방과후 강좌 변환 연동
    const dayMap: Record<string, DayOfWeek> = {
      '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday',
      '목': 'Thursday', '금': 'Friday', '토': 'Saturday'
    };

    const extractCourseDays = (course: any): string[] => {
      if (Array.isArray(course.classDays) && course.classDays.length > 0) return course.classDays;
      if (Array.isArray(course.days) && course.days.length > 0) return course.days;
      const text = `${course.period || ''} ${course.title || ''} ${course.schedule || ''} ${course.day || ''} ${course.classTime || ''}`;
      if (text.includes('토')) return ['토'];
      const days: string[] = [];
      if (text.includes('월')) days.push('월');
      if (text.includes('화')) days.push('화');
      if (text.includes('수')) days.push('수');
      if (text.includes('목')) days.push('목');
      if (text.includes('금')) days.push('금');
      return days;
    };

    if (afterschoolCourses.length > 0) {
      const convertedClasses: AfterSchoolClass[] = [];
      afterschoolCourses.forEach(course => {
        const days = extractCourseDays(course);
        const targetDays = days.length > 0 ? (days.map(d => dayMap[d]).filter(Boolean) as DayOfWeek[]) : ['Monday' as DayOfWeek];
        targetDays.forEach(dayOfWeek => {
          convertedClasses.push({
            id: course.id,
            name: course.title,
            dayOfWeek,
            teacherId: null,
            teacherName: course.instructorName || '',
            semesterMode: 'regular'
          });
          convertedClasses.push({
            id: `${course.id}_vacation`,
            name: course.title,
            dayOfWeek,
            teacherId: null,
            teacherName: course.instructorName || '',
            semesterMode: 'vacation'
          });
        });
      });
      setAfterSchoolClasses(convertedClasses);
    }

    // 2. 학생 및 수강신청/버스 정보 병합
    const clean = (str: any) => String(str || '').replace(/\s+/g, '').toLowerCase();

    const merged = rawStudents.map(student => {
      const studentName = clean(student.nameKo || student.name || student.nameEn);
      const studentGrade = Number(student.grade);
      const studentClass = Number(student.class || student.classNum);

      const studentEnrollments = afterschoolEnrollments.filter(e => {
        const eName = clean(e.name || e.studentName);
        const matchName = eName === studentName;
        const matchGrade = !e.grade || Number(e.grade) === studentGrade;
        const matchClass = !e.classNum || Number(e.classNum) === studentClass;
        return matchName && matchGrade && matchClass;
      });

      if (studentEnrollments.length === 0) {
        return {
          ...student,
          afterSchoolCourseTitle: '',
          afterSchoolCourseTitles: [],
          enrolledCourseTitles: [],
          afterSchoolClassIds: student.afterSchoolClassIds || {},
          afterSchoolDestinations: student.afterSchoolDestinations || {},
          vacationAfterSchoolClassIds: student.vacationAfterSchoolClassIds || {},
          vacationAfterSchoolDestinations: student.vacationAfterSchoolDestinations || {}
        };
      }

      const afterSchoolClassIds: Partial<Record<DayOfWeek, string | null>> = { ...(student.afterSchoolClassIds || {}) };
      const afterSchoolDestinations: Partial<Record<DayOfWeek, string | null>> = { ...(student.afterSchoolDestinations || {}) };
      const vacationAfterSchoolClassIds: Partial<Record<DayOfWeek, string | null>> = { ...(student.vacationAfterSchoolClassIds || {}) };
      const vacationAfterSchoolDestinations: Partial<Record<DayOfWeek, string | null>> = { ...(student.vacationAfterSchoolDestinations || {}) };
      const enrolledCourseTitles: string[] = [];

      studentEnrollments.forEach(enrollment => {
        const course = afterschoolCourses.find(c => c.id === enrollment.courseId);
        const cTitle = course?.title || enrollment.courseTitle || '';
        if (cTitle && !enrolledCourseTitles.includes(cTitle)) {
          enrolledCourseTitles.push(cTitle);
        }
        if (!course) return;

        const classDays = extractCourseDays(course);
        if (classDays.length === 0) return;

        const isSat = classDays.includes('토') || Boolean(
          course.period?.includes('토') ||
          course.title?.includes('토요') ||
          course.title?.includes('토요일')
        );

        if (enrollment.kisbusNo === '-' || enrollment.kisbusNo === '미신청' || enrollment.needsBus === false) {
          return;
        }
        if (isSat && (!enrollment.kisbusNo || enrollment.kisbusNo === '-' || enrollment.kisbusNo === '미신청')) {
          return;
        }

        const targetDays = classDays.map((d: string) => dayMap[d]).filter(Boolean) as DayOfWeek[];

        let realDestId = (
          (isSat ? (student.satAfternoonDestinationId || student.satMorningDestinationId) : null) ||
          student.afternoonDestinationId ||
          student.suggestedAfternoonDestination ||
          student.morningDestinationId ||
          'UNSPECIFIED'
        );

        if (realDestId && (realDestId.includes('호차') || realDestId === '미배정' || realDestId === '방과후 미배정')) {
          realDestId = student.afternoonDestinationId || student.morningDestinationId || 'UNSPECIFIED';
        }

        targetDays.forEach(day => {
          if (!afterSchoolClassIds[day]) afterSchoolClassIds[day] = course.id;
          if (!vacationAfterSchoolClassIds[day]) vacationAfterSchoolClassIds[day] = course.id;
          if (!afterSchoolDestinations[day]) afterSchoolDestinations[day] = realDestId;
          if (!vacationAfterSchoolDestinations[day]) vacationAfterSchoolDestinations[day] = realDestId;
        });
      });

      return {
        ...student,
        afterSchoolCourseTitle: enrolledCourseTitles.join(', '),
        afterSchoolCourseTitles: enrolledCourseTitles,
        enrolledCourseTitles,
        afterSchoolClassIds,
        afterSchoolDestinations,
        vacationAfterSchoolClassIds,
        vacationAfterSchoolDestinations
      };
    });

    setStudents(merged);
  }, [rawStudents, afterschoolCourses, afterschoolEnrollments]);

  useEffect(() => {
    if (!isAuthenticated) {
      unsubscribeAllRoutes();
      return;
    }

    const loggedInTeacher = currentTeacherId ? teachers.find(t => t.id === currentTeacherId) : null;
    const assignedBusId = teacherAssignedBuses.commuteBusId || loggedInTeacher?.assignedBusId || '';
    const assignedAfterSchoolBusId = teacherAssignedBuses.afterSchoolBusId || loggedInTeacher?.assignedAfterSchoolBusId || '';
    const defaultBuses = [assignedBusId, assignedAfterSchoolBusId].filter(Boolean);

    if (selectedBusId === 'all') {
      subscribeToAllRoutes();
    } else {
      defaultBuses.forEach(bid => subscribeToBusRoutes(bid));
      if (selectedBusId && selectedBusId !== 'all') {
        subscribeToBusRoutes(selectedBusId);
      }
    }
  }, [isAuthenticated, currentTeacherId, teachers, teacherAssignedBuses, selectedBusId, subscribeToBusRoutes, subscribeToAllRoutes, unsubscribeAllRoutes]);

  useEffect(() => {
    if ((semesterMode === 'vacation' || !isAfterSchoolActive) && selectedRouteType === 'AfterSchool') {
      setSelectedRouteType('Afternoon');
    }
  }, [semesterMode, isAfterSchoolActive, selectedRouteType]);

  useEffect(() => {
    if (isManualMode || !selectedDate) return;
    const parts = selectedDate.split('-');
    const targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayIdx = targetDate.getDay();
    setSelectedDay(dayIdx === 0 ? 'Monday' : DAYS[dayIdx - 1]);
    
    const now = new Date();
    const vTime = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60000);
    const todayStr = format(vTime, 'yyyy-MM-dd');
    
    const isToday = format(targetDate, 'yyyy-MM-dd') === todayStr;
    if (isToday) {
        const vh = vTime.getHours();
        if (dayIdx === 6) {
            if (vh < 9) setSelectedRouteType('Morning');
            else if (vh < 14) setSelectedRouteType('Afternoon');
            else setSelectedRouteType('Morning');
        }
        else {
            if (vh < 9) setSelectedRouteType('Morning');
            else if (vh < 16) setSelectedRouteType('Afternoon');
            else setSelectedRouteType((semesterMode === 'vacation' || !isAfterSchoolActive) ? 'Afternoon' : 'AfterSchool');
        }
    } else {
        setSelectedRouteType('Morning');
    }
  }, [selectedDate, isManualMode, semesterMode, isAfterSchoolActive]);

  const lastRouteTypeRef = useRef<RouteType | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const loggedInTeacher = currentTeacherId ? teachers.find(t => t.id === currentTeacherId) : null;
    const defaultBusId = selectedRouteType === 'AfterSchool'
      ? (teacherAssignedBuses.afterSchoolBusId || loggedInTeacher?.assignedAfterSchoolBusId)
      : (teacherAssignedBuses.commuteBusId || loggedInTeacher?.assignedBusId);

    const isTypeChanged = lastRouteTypeRef.current !== null && 
      ((lastRouteTypeRef.current === 'AfterSchool' && selectedRouteType !== 'AfterSchool') ||
       (lastRouteTypeRef.current !== 'AfterSchool' && selectedRouteType === 'AfterSchool'));

    if (selectedBusId === '' || isTypeChanged) {
      if (defaultBusId) {
        setSelectedBusId(defaultBusId);
      } else if (selectedBusId === '') {
        setSelectedBusId('all');
      }
    }

    lastRouteTypeRef.current = selectedRouteType;
  }, [isAuthenticated, currentTeacherId, teachers, teacherAssignedBuses, selectedRouteType, selectedBusId]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = normalizeString(searchQuery);
    
    const scored = students.map(student => {
      const grade = (student.grade || '').toLowerCase();
      const cls = (student.class || '').toLowerCase();
      const gradeClass = normalizeString(grade + cls);
      const contact = student.contact?.replace(/\D/g, '') || '';
      
      let score = 0;
      if (gradeClass === q) score += 2000;
      else if (gradeClass.startsWith(q)) score += 1500;
      
      const displayName = normalizeString(getStudentName(student, i18n.language));
      if (displayName.startsWith(q)) score += 500;
      else if (displayName.includes(q)) score += 300;
      else if (student.nameKo && normalizeString(student.nameKo).includes(q)) score += 200;
      else if (student.nameEn && normalizeString(student.nameEn).toLowerCase().includes(q)) score += 200;
      
      if (contact.startsWith(q)) score += 100;
      else if (contact.includes(q)) score += 50;
      
      return { student, score };
    });

    const results = scored
      .filter(item => item.score > 0)
      .sort((a, b) => {
        const ga = getGradeValue(a.student.grade), gb = getGradeValue(b.student.grade);
        if (ga !== gb) return ga - gb;
        const ca = a.student.class.localeCompare(b.student.class, undefined, { numeric: true });
        if (ca !== 0) return ca;
        return getStudentName(a.student, i18n.language).localeCompare(getStudentName(b.student, i18n.language), 'ko');
      })
      .map(item => item.student);

    setSearchResults(results.slice(0, 15));
  }, [searchQuery, students, i18n.language]);

  const handleSelectStudentFromSearch = (s: Student) => {
    // 1. 현재 선택된 요일/경로에서 학생의 노선 찾기
    let targetBusId: string | null = null;
    let targetBusName: string = '';

    const directRoute = (allRoutes.length > 0 ? allRoutes : allStaticRoutes).find(r => 
      (r.semesterMode || 'regular') === semesterMode &&
      r.dayOfWeek === selectedDay && 
      r.type === selectedRouteType && 
      r.seating?.some(seat => seat.studentId === s.id)
    );

    if (directRoute) {
      targetBusId = directRoute.busId;
    } else {
      // 2. 다른 요일/경로라도 해당 학생이 배정된 노선이 있는지 찾기
      const anyRoute = (allRoutes.length > 0 ? allRoutes : allStaticRoutes).find(r => 
        (r.semesterMode || 'regular') === semesterMode &&
        r.seating?.some(seat => seat.studentId === s.id)
      );
      if (anyRoute) {
        targetBusId = anyRoute.busId;
        if (anyRoute.dayOfWeek) setSelectedDay(anyRoute.dayOfWeek);
        if (anyRoute.type) setSelectedRouteType(anyRoute.type);
      } else {
        // 3. 학생 데이터에 등록된 버스 번호로 매칭
        const studentBusName = s.afterSchoolBusNo || (selectedRouteType === 'Morning' ? s.morningBusNo : s.afternoonBusNo) || s.morningBusNo || s.afternoonBusNo || (s as any).kisbusNo || (s as any).busNo;
        if (studentBusName && studentBusName !== '-' && studentBusName !== '미신청') {
          const matchedBus = filteredBuses.find(b => 
            b.name === studentBusName || 
            b.name.includes(studentBusName) || 
            studentBusName.includes(b.name) ||
            b.id === studentBusName
          );
          if (matchedBus) {
            targetBusId = matchedBus.id;
          }
        }
      }
    }

    if (targetBusId) {
      const foundBus = filteredBuses.find(b => b.id === targetBusId);
      targetBusName = foundBus ? foundBus.name : '';
      setSelectedBusId(targetBusId);
      setLastClickedStudentId(s.id);
      setSelectedStudent(s);
      toast({
        title: `${getStudentName(s, i18n.language)} 학생 선택`,
        description: targetBusName ? `${targetBusName} 화면으로 이동했습니다.` : '해당 학생의 버스 화면으로 이동했습니다.'
      });
    } else {
      toast({
        title: t('notice') || '알림',
        description: `${getStudentName(s, i18n.language)} 학생의 배정된 버스 정보를 찾을 수 없습니다.`
      });
      setLastClickedStudentId(s.id);
      setSelectedStudent(s);
    }

    setSearchQuery('');
    setSearchResults([]);
    
    setTimeout(() => {
      const el = document.getElementById('student-info-card') || document.getElementById('boarding-students-list-card');
      if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  };

  const currentRoute = useMemo(() => {
    if (selectedBusId === 'all' || !selectedBusId) return null;
    let r = allRoutes.find(r => (r.semesterMode || 'regular') === semesterMode && r.busId === selectedBusId && r.dayOfWeek === selectedDay && r.type === selectedRouteType);
    if (r) return r;
    return allStaticRoutes.find(r => (r.semesterMode || 'regular') === semesterMode && r.busId === selectedBusId && r.dayOfWeek === selectedDay && r.type === selectedRouteType) || null;
  }, [allRoutes, allStaticRoutes, selectedBusId, selectedDay, selectedRouteType, semesterMode]);
  
  const selectedBus = useMemo(() => buses.find(b => (b.semesterMode || 'regular') === semesterMode && b.id === selectedBusId), [buses, selectedBusId, semesterMode]);
  
  const filteredBuses = useMemo(() => sortBuses(buses.filter(b => 
    (b.semesterMode || 'regular') === semesterMode &&
    (b.isActive !== false) && allStaticRoutes.some(r => (r.semesterMode || 'regular') === semesterMode && r.busId === b.id && r.dayOfWeek === selectedDay && r.type === selectedRouteType && r.stops?.length > 0 && r.seating.some(s => s.studentId !== null))
  )), [buses, allStaticRoutes, selectedDay, selectedRouteType, semesterMode]);
  
  const relevantRoutesForDay = useMemo(() => { 
    return filteredBuses.map(b => {
      let r = allRoutes.find(x => (x.semesterMode || 'regular') === semesterMode && x.busId === b.id && x.dayOfWeek === selectedDay && x.type === selectedRouteType);
      if (r) return r;
      return allStaticRoutes.find(x => (x.semesterMode || 'regular') === semesterMode && x.busId === b.id && x.dayOfWeek === selectedDay && x.type === selectedRouteType);
    }).filter((r): r is Route => !!r);
  }, [allRoutes, allStaticRoutes, selectedDay, selectedRouteType, filteredBuses, semesterMode]);

  useEffect(() => { 
    if (currentRoute) return onAttendanceUpdate(currentRoute.id, selectedDate, setAttendance); 
    else setAttendance(null); 
  }, [currentRoute, selectedDate]);

  useEffect(() => {
    if (selectedBusId !== 'all') { setAllAttendance({}); return; }
    const unsubs = relevantRoutesForDay.map(r => onAttendanceUpdate(r.id, selectedDate, (rec) => setAllAttendance(prev => ({ ...prev, [r.id]: rec }))));
    return () => unsubs.forEach(u => u());
  }, [selectedBusId, relevantRoutesForDay, selectedDate]);

  // 방과후 출석 레코드 실시간 구독 (방과후 결석/개별하교 실시간 연동)
  const [afterschoolAttendanceRecords, setAfterschoolAttendanceRecords] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onAttendanceRecordsUpdate((records) => {
      setAfterschoolAttendanceRecords(records || []);
    });
    return () => unsub();
  }, []);

  // 방과후 수업 결석 or 개별하교 학생 ID 추출 (해당 날짜 기준)
  const afterschoolAbsentStudentIds = useMemo(() => {
    if (selectedRouteType !== 'AfterSchool') return new Set<string>();
    const absentSet = new Set<string>();
    
    (afterschoolAttendanceRecords || []).forEach((r) => {
      const isDateMatch = r.date === selectedDate || (r.date && selectedDate.endsWith(r.date.split('(')[0].replace('/', '-')));
      if (isDateMatch) {
        if (r.status === 'ABSENT' || r.markSymbol === 'X' || r.isIndividualDismissal === true || r.markSymbol === 'V') {
          absentSet.add(r.studentId);
        }
      }
    });
    return absentSet;
  }, [selectedRouteType, selectedDate, afterschoolAttendanceRecords]);

  const boardedStudentIds = attendance?.boarded || [], 
        rawNotBoardingStudentIds = attendance?.notBoarding || [], 
        disembarkedStudentIds = attendance?.disembarked || [], 
        completedDestinations = attendance?.completedDestinations || [];

  // 최종 notBoarding: 버스 출석부 notBoarding + 방과후 결석/개별하교 학생 자동 포함
  const notBoardingStudentIds = useMemo(() => {
    if (selectedRouteType !== 'AfterSchool' || afterschoolAbsentStudentIds.size === 0) {
      return rawNotBoardingStudentIds;
    }
    const combined = new Set([...rawNotBoardingStudentIds, ...Array.from(afterschoolAbsentStudentIds)]);
    return Array.from(combined);
  }, [rawNotBoardingStudentIds, selectedRouteType, afterschoolAbsentStudentIds]);

  useEffect(() => {
    if (lastClickedStudentId) {
        const s = students.find(x => x.id === lastClickedStudentId);
        if (s) setSelectedStudent({ ...s, isGroupLeader: groupLeaderRecords.some(r => r.studentId === s.id && r.endDate === null) });
    } else setSelectedStudent(null);
  }, [lastClickedStudentId, students, groupLeaderRecords]);

  useEffect(() => {
    if (currentRoute) {
        getGroupLeaderRecords(currentRoute.id, currentRoute.busId, currentRoute.type)
            .then(recs => {
                const activeOnly = recs.filter(r => r.endDate === null);
                setGroupLeaderRecords(activeOnly);
                if (recs.length !== activeOnly.length) {
                    saveGroupLeaderRecords(currentRoute.id, activeOnly, currentRoute.busId, currentRoute.type).catch(console.error);
                }
            })
            .catch(() => setGroupLeaderRecords([]));
    } else { setGroupLeaderRecords([]); }
  }, [currentRoute]);

  const toggleGroupLeader = useCallback(() => {
    if (!selectedStudent || !currentRoute) return;
    const activeLeaders = groupLeaderRecords.filter(r => r.endDate === null);
    const isCurrentlyLeader = activeLeaders.some(r => r.studentId === selectedStudent.id);
    let newRecords = [...groupLeaderRecords];
    if (isCurrentlyLeader) {
        newRecords = newRecords.filter(r => r.studentId !== selectedStudent.id);
        toast({ title: t('teacher_page.demote_leader'), description: `${getStudentName(selectedStudent, i18n.language)} 학생이 조장에서 해제되었습니다.` });
    } else {
        if (activeLeaders.length >= 3) { toast({ title: t('error'), description: "동시에 활동 가능한 조장은 최대 3명입니다.", variant: 'destructive' }); return; }
        newRecords.push({ studentId: selectedStudent.id, name: `${selectedStudent.grade.toUpperCase()}${selectedStudent.class} ${getStudentName(selectedStudent, i18n.language)}`, startDate: format(new Date(), 'yyyy-MM-dd'), endDate: null, days: 1 });
        toast({ title: t('teacher_page.promote_leader'), description: `${getStudentName(selectedStudent, i18n.language)} 학생이 조장으로 임명되었습니다.` });
    }
    setGroupLeaderRecords(newRecords);
    if (currentRoute) {
        saveGroupLeaderRecords(currentRoute.id, newRecords, currentRoute.busId, currentRoute.type).catch(console.error);
    }
  }, [selectedStudent, currentRoute, groupLeaderRecords, t, toast, i18n.language]);

  const toggleStudentAttendance = useCallback(async (sid: string) => {
    if (!currentRoute) return;
    const isB = boardedStudentIds.includes(sid), isD = disembarkedStudentIds.includes(sid);
    
    const updates: any = {};
    
    if (isD) {
      updates.disembarked = arrayRemove(sid);
    } else if (isB) {
      updates.boarded = arrayRemove(sid);
      updates.disembarked = arrayUnion(sid);
    } else {
      updates.boarded = arrayUnion(sid);
      updates.notBoarding = arrayRemove(sid);
    }
    
    await updateAttendance(currentRoute.id, selectedDate, updates)
      .then(() => setLastClickedStudentId(sid))
      .catch(() => toast({ title: t("error"), variant: "destructive" }));
  }, [currentRoute, boardedStudentIds, disembarkedStudentIds, selectedDate, t, toast]);

  const handleMarkNotBoarding = useCallback(async () => {
    if (!selectedStudent || !currentRoute) return;
    const isAlreadyNotBoarding = notBoardingStudentIds.includes(selectedStudent.id);
    
    const updates: any = {
      notBoarding: isAlreadyNotBoarding ? arrayRemove(selectedStudent.id) : arrayUnion(selectedStudent.id),
      boarded: arrayRemove(selectedStudent.id),
      disembarked: arrayRemove(selectedStudent.id)
    };

    try {
      const otherRoutes = allRoutes.filter(r => 
          r.dayOfWeek === selectedDay && 
          r.seating.some(se => se.studentId === selectedStudent.id)
      );
      
      await Promise.all(otherRoutes.map(or => 
          updateAttendance(or.id, selectedDate, updates)
      ));
      
      toast({ title: isAlreadyNotBoarding ? "상태 복구 완료" : t('teacher_page.not_boarding_updated') });
    } catch (error) {
      toast({ title: t('error'), variant: "destructive" });
    }
  }, [selectedStudent, currentRoute, notBoardingStudentIds, selectedDate, allRoutes, selectedDay, t, toast]);

  const handleExcludeStudentFromDayRoute = useCallback(async () => {
    if (!selectedStudent || !currentRoute) return;
    try {
      const newSeating = currentRoute.seating.map(s => 
        s.studentId === selectedStudent.id ? { ...s, studentId: null } : s
      );
      await updateRouteSeating(currentRoute.id, newSeating);

      await updateAttendance(currentRoute.id, selectedDate, {
        boarded: arrayRemove(selectedStudent.id),
        notBoarding: arrayRemove(selectedStudent.id),
        disembarked: arrayRemove(selectedStudent.id),
      });

      if (selectedRouteType === 'AfterSchool') {
        const currentDestMap = selectedStudent.afterSchoolDestinations || {};
        const currentClassMap = selectedStudent.afterSchoolClassIds || {};
        await updateStudent(selectedStudent.id, {
          afterSchoolDestinations: {
            ...currentDestMap,
            [selectedDay]: null
          },
          afterSchoolClassIds: {
            ...currentClassMap,
            [selectedDay]: null
          }
        });
      }

      toast({
        title: "요일 제외 완료",
        description: `${getStudentName(selectedStudent, i18n.language)} 학생이 ${t(`day.${selectedDay.toLowerCase()}`)} ${t(`route_type.${selectedRouteType.toLowerCase()}`)} 명단에서 제외되었습니다.`
      });
      setSelectedStudent(null);
      setLastClickedStudentId(null);
    } catch (error) {
      console.error("Error excluding student from route:", error);
      toast({
        title: t('error'),
        description: "요일 제외 처리 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  }, [selectedStudent, currentRoute, selectedDate, selectedDay, selectedRouteType, t, toast, i18n.language]);

  const handleStudentRowClick = (studentId: string) => {
    setLastClickedStudentId(studentId);
    setTimeout(() => {
      const el = document.getElementById('student-info-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

    const handleMarkDestinationArrival = useCallback(async (destinationId: string) => {
        if (!currentRoute || !selectedDate) return;
        const isCompleted = completedDestinations.includes(destinationId);
        
        try {
            await updateAttendance(currentRoute.id, selectedDate, {
                completedDestinations: isCompleted ? arrayRemove(destinationId) : arrayUnion(destinationId)
            });
            toast({
                title: !isCompleted ? "도착 확인 완료" : "도착 확인 취소",
                description: "목적지 도착 정보가 업데이트되었습니다."
            });
        } catch (error) {
            toast({ title: t("error"), variant: "destructive" });
        }
    }, [currentRoute, selectedDate, completedDestinations, t, toast]);

  const studentsOnCurrentRoute = useMemo(() => {
      if (!currentRoute) return [];
      const sIds = new Set<string>(); 
      currentRoute.seating.forEach(s => { if(s.studentId) sIds.add(s.studentId); });
      return Array.from(sIds).map(id => students.find(x => x.id === id)).filter((x): x is Student => !!x).sort((a,b) => {
          const p = (id: string) => (boardedStudentIds.includes(id) || notBoardingStudentIds.includes(id) || disembarkedStudentIds.includes(id)) ? 2 : 1;
          if (p(a.id) !== p(b.id)) return p(a.id) - p(b.id);
          if (getGradeValue(a.grade) !== getGradeValue(b.grade)) return getGradeValue(a.grade) - getGradeValue(b.grade);
          if (a.class !== b.class) return a.class.localeCompare(b.class, undefined, { numeric: true });
          return getStudentName(a, i18n.language).localeCompare(getStudentName(b, i18n.language), 'ko');
      });
  }, [currentRoute, students, boardedStudentIds, notBoardingStudentIds, disembarkedStudentIds]);

  const handleSeatClick = (sn: number, sid: string | null) => {
    setSwapSourceSeat(null);
    if (!sid) { setLastClickedStudentId(null); setSelectedStudent(null); return; }
    toggleStudentAttendance(sid);
  };

  const handleSeatContextMenu = (e: React.MouseEvent, seatNumber: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentRoute) return;
    if (swapSourceSeat === null) {
      setSwapSourceSeat(seatNumber);
      toast({ title: t('teacher_page.seat_selected'), description: "다른 좌석을 우클릭하면 교체되고, 같은 좌석을 다시 우클릭하면 선택이 취소됩니다." });
    } else {
      if (swapSourceSeat === seatNumber) {
        setSwapSourceSeat(null);
        return;
      }
      const newSeating = [...currentRoute.seating];
      if (!newSeating.some(s => s.seatNumber === swapSourceSeat)) newSeating.push({ seatNumber: swapSourceSeat, studentId: null });
      if (!newSeating.some(s => s.seatNumber === seatNumber)) newSeating.push({ seatNumber, studentId: null });
      const sourceIdx = newSeating.findIndex(s => s.seatNumber === swapSourceSeat);
      const targetIdx = newSeating.findIndex(s => s.seatNumber === seatNumber);
      if (sourceIdx > -1 && targetIdx > -1) {
        const tempStudentId = newSeating[sourceIdx].studentId;
        newSeating[sourceIdx].studentId = newSeating[targetIdx].studentId;
        newSeating[targetIdx].studentId = tempStudentId;
        updateRouteSeating(currentRoute.id, newSeating).then(() => { toast({ title: t('teacher_page.swap_success') }); setSwapSourceSeat(null); }).catch(() => { toast({ title: t('teacher_page.swap_error'), variant: 'destructive' }); });
      }
    }
  };

  const handleUpdateBusStatus = async (status: 'ready' | 'departed' | 'completed') => { 
    if (!selectedBus) return;
    const updates: any = { status };
    if (status === 'departed') {
      updates.departureTime = new Date().toISOString();
    } else if (status === 'ready') {
      updates.departureTime = null;
    }
    await updateBus(selectedBus.id, updates);
  };

  const playBeep = (type: 'success' | 'error') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      if (type === 'success') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 1000;
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        const playSingleErrorBeep = (delay: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = 300;
          gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.2);
        };
        playSingleErrorBeep(0);
        playSingleErrorBeep(0.25);
      }
    } catch (e) {
      console.error('AudioContext play error:', e);
    }
  };

  const handleQrScan = useCallback(async (scannedId: string) => {
    if (qrScanLock) return;
    setQrScanLock(true);
    
    setTimeout(() => setQrScanLock(false), 2000);
    
    const trimmedId = (scannedId || '').trim();
    const student = students.find(s => s.id === trimmedId);
    
    if (!student) {
      playBeep('error');
      setQrAlertErrorReason('invalid_qr');
      setQrAlertStudent(null);
      setQrAlertCorrectBusName(null);
      return;
    }
    
    const isAssignedToCurrentRoute = currentRoute?.seating.some(seat => seat.studentId === student.id);
    
    if (isAssignedToCurrentRoute) {
      const record = allAttendance[currentRoute!.id];
      let nextStatus: 'boarded' | 'disembarked' | null = null;
      
      if (currentRoute!.type === 'Morning') {
        if (!record?.boarded?.includes(student.id)) {
          nextStatus = 'boarded';
        }
      } else {
        if (record?.boarded?.includes(student.id)) {
          nextStatus = 'disembarked';
        } else if (!record?.disembarked?.includes(student.id)) {
          nextStatus = 'boarded';
        }
      }
      
      if (nextStatus) {
        try {
          const updates: any = {};
          if (nextStatus === 'boarded') {
            updates.boarded = arrayUnion(student.id);
            updates.notBoarding = arrayRemove(student.id);
            updates.disembarked = arrayRemove(student.id);
          } else if (nextStatus === 'disembarked') {
            updates.boarded = arrayRemove(student.id);
updates.disembarked = arrayUnion(student.id);
            updates.notBoarding = arrayRemove(student.id);
          }
          await updateAttendance(currentRoute!.id, selectedDate, updates);
          playBeep('success');
          setQrScanSuccessStudentName(`${student.grade.toUpperCase()}${student.class} ${getStudentName(student, i18n.language)}`);
          setQrScanSuccessStatus(nextStatus);
          
          setTimeout(() => {
            setQrScanSuccessStudentName(null);
            setQrScanSuccessStatus(null);
          }, 3000);
        } catch (error) {
          console.error('QR attendance update failed:', error);
          playBeep('error');
        }
      } else {
        playBeep('success');
      }
    } else {
      playBeep('error');
      
      const correctRoute = relevantRoutesForDay.find(r => 
        r.seating.some(seat => seat.studentId === student.id)
      );
      
      if (correctRoute) {
        const correctBus = buses.find(b => b.id === correctRoute.busId);
        setQrAlertErrorReason('wrong_bus');
        setQrAlertStudent(student);
        setQrAlertCorrectBusName(correctBus ? correctBus.name : '알 수 없음');
      } else {
        setQrAlertErrorReason('no_route');
        setQrAlertStudent(student);
        setQrAlertCorrectBusName(null);
      }
    }
  }, [qrScanLock, students, currentRoute, allAttendance, relevantRoutesForDay, buses, t, i18n.language]);

  const formatStudentName = (s: Student) => `${s.grade.toUpperCase()}${s.class} ${getStudentName(s, i18n.language)}`;

  const headerContent = (
    <div className="grid grid-cols-2 sm:flex sm:flex-row sm:items-end gap-1.5 sm:gap-3 w-full min-w-0">
        {/* 1. 버스 선택 */}
        <div className="w-full sm:w-[150px] shrink-0 min-w-0">
            <Label className="text-[10px] sm:text-xs font-semibold text-slate-600 mb-0.5 block">{t('bus')}</Label>
            <Select value={selectedBusId} onValueChange={setSelectedBusId} disabled={loading}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm bg-white/90"><SelectValue placeholder={t('teacher_page.select_bus')} /></SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-[40vh] overflow-y-auto">
                    <SelectItem value="all">{t('teacher_page.all_buses')}</SelectItem>
                    {filteredBuses.map(b => <SelectItem key={b.id} value={b.id}>{b.name} ({t(`bus_type.${b.capacity}`)})</SelectItem>)}
                </SelectContent>
            </Select>
        </div>

        {/* 2. 요일 선택 */}
        <div className="w-full sm:w-[110px] shrink-0 min-w-0">
            <Label className="text-[10px] sm:text-xs font-semibold text-slate-600 mb-0.5 block">{t('day')}</Label>
            <Select value={selectedDay} onValueChange={(v: DayOfWeek) => { 
                const today = new Date(), currentDayIdx = (today.getDay() + 6) % 7, targetDayIdx = DAYS.indexOf(v), diff = targetDayIdx - currentDayIdx, target = new Date(today);
                target.setDate(today.getDate() + diff); 
                setSelectedDate(format(target, 'yyyy-MM-dd')); 
                setSelectedDay(v);
                setIsManualMode(true);
            }}>
                <SelectTrigger className={cn("h-8 sm:h-9 text-xs sm:text-sm bg-white/90", isManualMode && "border-blue-500")}><SelectValue/></SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={4}>{DAYS.map(d => <SelectItem key={d} value={d}>{t(`day.${d.toLowerCase()}`)}</SelectItem>)}</SelectContent>
            </Select>
        </div>

        {/* 3. 학생 이름 검색 */}
        <div className="w-full sm:flex-1 min-w-0 relative">
            <Label htmlFor="student-search" className="text-[10px] sm:text-xs font-semibold text-slate-600 mb-0.5 block">{t('student.name')}</Label>
            <div className="relative">
                <Search className="absolute left-2.5 top-2 sm:top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input id="student-search" type="search" placeholder={t('teacher_page.search_student_placeholder')} className="pl-8 h-8 sm:h-9 text-xs sm:text-sm w-full bg-white/90" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            {searchResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto shadow-2xl bg-white border border-slate-300 rounded-xl p-1 divide-y divide-slate-100 font-sans">
                    {searchResults.map(student => {
                        const studentBusName = student.afterSchoolBusNo || (selectedRouteType === 'Morning' ? student.morningBusNo : student.afternoonBusNo) || student.morningBusNo || student.afternoonBusNo || (student as any).kisbusNo || (student as any).busNo;
                        return (
                            <div 
                                key={student.id} 
                                className="p-2 text-xs sm:text-sm hover:bg-indigo-50/80 rounded-lg cursor-pointer flex justify-between items-center transition-colors gap-2" 
                                onClick={() => handleSelectStudentFromSearch(student)}
                            >
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-slate-900 truncate">{formatStudentName(student)}</span>
                                    {student.contact && (
                                        <a 
                                            href={`tel:${student.contact}`} 
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                                        >
                                            <Phone className="w-2.5 h-2.5" />
                                            {student.contact}
                                        </a>
                                    )}
                                </div>
                                <div className="shrink-0 flex items-center gap-1">
                                    {studentBusName && studentBusName !== '-' && studentBusName !== '미신청' ? (
                                        <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 border-indigo-200 text-[10px] font-bold px-1.5 py-0.5">
                                            🚌 {studentBusName}
                                        </Badge>
                                    ) : (
                                        <span className="text-[10px] text-slate-400">미배정</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* 4. 경로 (등교/하교/방과후) */}
        <div className="w-full sm:w-[220px] shrink-0 min-w-0">
            <Label className="text-[10px] sm:text-xs font-semibold text-slate-600 mb-0.5 block">{t('route')}</Label>
            <Tabs value={selectedRouteType} onValueChange={(v: any) => { setSelectedRouteType(v); setIsManualMode(true); }} className="w-full">
                <TabsList className={cn("grid w-full h-9 sm:h-10 p-0.5", (selectedDay === 'Saturday' || semesterMode === 'vacation') ? "grid-cols-2" : "grid-cols-3", isManualMode && "bg-blue-50")}>
                    <TabsTrigger value="Morning" className="text-xs px-1">{t('route_type.morning')}</TabsTrigger>
                    <TabsTrigger value="Afternoon" className="text-xs px-1">{t('route_type.afternoon')}</TabsTrigger>
                    {(selectedDay !== 'Saturday' && semesterMode !== 'vacation') && <TabsTrigger value="AfterSchool" className="text-xs px-1">{t('route_type.AfterSchool')}</TabsTrigger>}
                </TabsList>
            </Tabs>
        </div>
        {isManualMode && (
          <Button variant="outline" size="sm" className="h-9 sm:h-10 px-2.5 border-blue-500 text-blue-600 gap-1 text-xs shrink-0" onClick={() => { setIsManualMode(false); calculateDate(); }}>
            <Clock className="w-3.5 h-3.5" />
            <span>{t('teacher_page.back_to_auto') || '자동'}</span>
          </Button>
        )}
    </div>
  );

  const handlePinPress = (num: string) => {
    if (authPin.length >= validPin.length) return;
    const newPin = authPin + num;
    setAuthPin(newPin);
    setAuthError(false);
    
    if (newPin.length === validPin.length) {
      if (newPin === validPin) {
        const teacher = teacherNameInput 
          ? teachers.find(t => t.name.trim().toLowerCase() === teacherNameInput.trim().toLowerCase())
          : null;

        const session = {
          id: teacher?.id || null,
          name: teacher?.name || teacherNameInput || 'Guest',
          guest: !teacher
        };

        localStorage.setItem('teacherSession', JSON.stringify(session));
        setCurrentTeacherId(teacher?.id || null);
        setCurrentTeacherName(session.name);
        setIsGuest(!teacher);
        setIsAuthenticated(true);
      } else {
        setTimeout(() => {
          setAuthPin('');
          setAuthError(true);
        }, 300);
      }
    }
  };

  const handleBackspace = () => {
    setAuthPin(authPin.slice(0, -1));
    setAuthError(false);
  };

  const handleLogout = async () => {
    localStorage.removeItem('teacherSession');
    setIsAuthenticated(false);
    setAuthPin('');
    setLoginStep('name');
    setTeacherNameInput('');
    setCurrentTeacherId(null);
    setCurrentTeacherName('');
    setIsGuest(false);
    if (user) {
      try {
        await logout();
      } catch (e) {
        console.error('Logout error:', e);
      }
    }
  };

  if (loading) {
    return (
      <MainLayout 
        title={t('page.title.teacher') || '선생님 페이지'} 
        headerContent={headerContent}
        hideMobileBottomNav={!user}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-32 rounded" />
              </CardHeader>
              <CardContent className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                    <Skeleton className="h-4 w-28 rounded" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="h-3 w-40 rounded mt-1" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {[...Array(45)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="hidden lg:flex flex-col gap-6">
            <Card>
              <CardHeader><Skeleton className="h-5 w-24 rounded" /></CardHeader>
              <CardContent className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-4 w-12 rounded" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <TeacherLoginScreen 
        pin={authPin} 
        onPinPress={handlePinPress} 
        onBackspace={handleBackspace} 
        error={authError}
        lang={lang}
        validPin={validPin}
        loginStep={loginStep}
        setLoginStep={setLoginStep}
        nameInput={teacherNameInput}
        setNameInput={setTeacherNameInput}
        teachers={teachers}
      />
    );
  }

  const titleActions = (
    <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-2 flex-1 min-w-0 no-print">
      {currentTeacherName && (
        <div className="flex items-center gap-1 px-1.5 sm:px-2 py-1 bg-slate-100/90 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 font-sans shrink-0 whitespace-nowrap shadow-2xs">
          <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>{currentTeacherName}</span>
          <span className="text-[11px] sm:text-xs text-slate-500 font-normal border-l border-slate-300 pl-1 ml-0.5 shrink-0" title={teacherBusInfoText}>
            {shortTeacherBusText}
          </span>
        </div>
      )}
      
      <Badge 
        variant={semesterMode === 'vacation' ? 'destructive' : 'secondary'}
        className="text-[11px] sm:text-xs font-bold px-1.5 sm:px-2 py-1 shrink-0 whitespace-nowrap"
      >
        {semesterMode === 'vacation' ? (lang === 'ko' ? '방학' : 'Vac') : (lang === 'ko' ? '2학기' : '2nd Sem')}
      </Badge>

      {selectedBusId !== 'all' && currentRoute && (
        <div className="shrink-0">
          <WebCopySeatPlanDialog 
            sourceRoute={currentRoute}
            sourceDay={selectedDay}
            routes={allStaticRoutes}
            students={students}
            t={t}
            lang={lang}
          />
        </div>
      )}

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-8 sm:w-auto sm:h-8 p-0 sm:px-2.5 shrink-0 text-xs flex items-center justify-center" title={t('teacher_page.after_school_list')}>
            <GraduationCap className="h-4 w-4 shrink-0 text-slate-700" />
            <span className="hidden xl:inline ml-1">{t('teacher_page.after_school_list')}{!isAfterSchoolActive ? (lang === 'ko' ? ' (종료)' : ' (Closed)') : ''}</span>
          </Button>
        </DialogTrigger>
        <AfterSchoolInquiryDialog
          afterSchoolClasses={activeAfterSchoolClasses}
          afterSchoolTeachers={afterSchoolTeachers}
          students={students}
          buses={buses}
          routes={allRoutes.length > 0 ? allRoutes : allStaticRoutes}
          destinations={destinations}
          semesterMode={semesterMode}
          isAfterSchoolActive={isAfterSchoolActive}
          afterschoolStageStatus={afterschoolStageStatus}
        />
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-8 sm:w-auto sm:h-8 p-0 sm:px-2.5 shrink-0 text-xs text-amber-700 border-amber-200 hover:bg-amber-50 flex items-center justify-center" title={lang === 'ko' ? '등교지도 근무표' : 'Gate Duty'}>
            <Sun className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="hidden xl:inline ml-1">{lang === 'ko' ? '등교지도' : 'Duty'}</span>
          </Button>
        </DialogTrigger>
        <MorningGateDutyDialog
          currentTeacherName={currentTeacherName}
          semesterMode={semesterMode}
          lang={lang}
        />
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-8 sm:w-auto sm:h-8 p-0 sm:px-2.5 shrink-0 text-xs flex items-center justify-center" title={t('teacher_page.check_assignments_button')}>
            <Users className="h-4 w-4 shrink-0 text-slate-700" />
            <span className="hidden xl:inline ml-1">{t('teacher_page.check_assignments_button')}</span>
          </Button>
        </DialogTrigger>
        <TeacherAssignmentViewDialog 
          buses={buses} 
          teachers={teachers} 
          afterSchoolTeachers={afterSchoolTeachers} 
          saturdayTeachers={saturdayTeachers}
          selectedDay={selectedDay} 
          selectedRouteType={selectedRouteType} 
          semesterMode={semesterMode}
          t={t}
        />
      </Dialog>

      <Button variant="outline" size="sm" className="h-8 w-8 sm:w-auto sm:h-8 p-0 sm:px-2.5 text-rose-500 border-rose-200 hover:bg-rose-50 shrink-0 text-xs flex items-center justify-center" onClick={handleLogout} title={lang === 'ko' ? '로그아웃' : 'Log Out'}>
        <LogOut className="h-4 w-4 shrink-0" />
        <span className="hidden xl:inline ml-1">{lang === 'ko' ? '로그아웃' : 'Log Out'}</span>
      </Button>
    </div>
  );

  return (
    <MainLayout 
      title={t('page.title.teacher') || '선생님 페이지'}
      headerContent={headerContent} 
      titleActions={titleActions}
      hideTitle={false}
      hideMobileBottomNav={!user}
    >
        <div onContextMenu={(e) => { e.preventDefault(); setSwapSourceSeat(null); }} className="min-h-full">
        {selectedStudent && selectedBusId === 'all' && (
            <div className="mb-6 max-w-xl">
                <Card id="student-info-card" className="no-print border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2">
                    <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <CardTitle className="text-lg font-bold truncate">{formatStudentName(selectedStudent)}</CardTitle>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)} className="h-7 text-xs">닫기</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pb-3 space-y-2">
                        <p className="text-sm text-muted-foreground">학년/반: {selectedStudent.grade}학년 {selectedStudent.class}반</p>
                        {selectedStudent.contact && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span>연락처:</span>
                                <a href={`tel:${selectedStudent.contact}`} className="font-medium text-blue-600 hover:underline">{selectedStudent.contact}</a>
                            </p>
                        )}
                        <p className="text-sm text-muted-foreground">목적지: {destinations.find(d => d.id === (selectedDay === 'Saturday' ? (selectedRouteType === 'Morning' ? selectedStudent.satMorningDestinationId : selectedStudent.satAfternoonDestinationId) : (selectedRouteType === 'Morning' ? selectedStudent.morningDestinationId : selectedRouteType === 'Afternoon' ? selectedStudent.afternoonDestinationId : selectedStudent.afterSchoolDestinations?.[selectedDay])))?.name || t('unassigned')}</p>
                        {(() => {
                            const classId = selectedStudent.afterSchoolClassIds?.[selectedDay];
                            if (classId) {
                                const afterSchoolClass = activeAfterSchoolClasses.find(c => c.id === classId);
                                if (afterSchoolClass) {
                                    return (
                                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                            <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                                            <span>방과후 ({t(`day_short.${selectedDay.toLowerCase()}`)}):</span>
                                            <span className="font-medium text-foreground">{afterSchoolClass.name}</span>
                                            {afterSchoolClass.teacherName && (
                                                <span className="text-xs text-muted-foreground/70">({afterSchoolClass.teacherName})</span>
                                            )}
                                        </p>
                                    );
                                }
                            }
                            const destBasedClass = activeAfterSchoolClasses.find(
                                c => c.id === selectedStudent.afterSchoolDestinations?.[selectedDay] && c.dayOfWeek === selectedDay
                            );
                            if (destBasedClass) {
                                return (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                        <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                                        <span>방과후 ({t(`day_short.${selectedDay.toLowerCase()}`)}):</span>
                                        <span className="font-medium text-foreground">{destBasedClass.name}</span>
                                        {destBasedClass.teacherName && (
                                            <span className="text-xs text-muted-foreground/70">({destBasedClass.teacherName})</span>
                                        )}
                                    </p>
                                );
                            }
                            const fallbackTitle = (selectedStudent as any).afterSchoolCourseTitle || 
                                ((selectedStudent as any).enrolledCourseTitles && (selectedStudent as any).enrolledCourseTitles.join(', '));
                            if (fallbackTitle) {
                                return (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                        <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                                        <span>방과후 ({t(`day_short.${selectedDay.toLowerCase()}`)}):</span>
                                        <span className="font-medium text-foreground">{fallbackTitle}</span>
                                    </p>
                                );
                            }
                            return null;
                        })()}
                    </CardContent>
                </Card>
            </div>
        )}
        {selectedBusId === 'all' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
                <AllStudentsBoardingStatus relevantRoutes={relevantRoutesForDay} students={students} buses={filteredBuses} allAttendance={allAttendance} formatStudentName={formatStudentName} t={t} afterschoolAbsentStudentIds={afterschoolAbsentStudentIds}/>
                <AllGroupLeadersStatus relevantRoutes={relevantRoutesForDay} students={students} buses={filteredBuses} formatStudentName={formatStudentName} t={t}/>
            </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <Card id="boarding-students-list-card" className="no-print scroll-mt-36">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                            <CardTitle>{t('teacher_page.boarding_list_title')}</CardTitle>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs flex items-center gap-1.5 shrink-0 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                onClick={() => setIsQrScannerOpen(true)}
                            >
                                <QrCode className="h-4 w-4" />
                                <span>{t('teacher_page.all_buses_view.qr_scanner') || 'QR 스캔'}</span>
                            </Button>
                        </CardHeader>
                        
                        {selectedBus && (selectedBus.status === 'departed' || selectedBus.status === 'completed') && currentRoute && currentRoute.stops && currentRoute.stops.length > 0 && (
                            <div className="bg-slate-50 border-y p-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-2 mb-2">
                                    <MapPin className="w-3.5 h-3.5 text-primary" />
                                    <h3 className="text-xs font-bold text-slate-700">목적지 도착 확인</h3>
                                </div>
                                <div className="flex flex-wrap gap-1.5 font-sans">
                                    {currentRoute.stops.map((stopId) => {
                                        const dest = destinations.find(d => d.id === stopId);
                                        if (!dest) return null;
                                        const isCompleted = completedDestinations.includes(stopId);
                                        return (
                                            <Button
                                                key={stopId}
                                                variant={isCompleted ? "outline" : "default"}
                                                size="sm"
                                                onClick={(e) => { e.stopPropagation(); handleMarkDestinationArrival(stopId); }}
                                                className={cn(
                                                    "h-7 px-2 text-[10px] transition-all",
                                                    isCompleted 
                                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100" 
                                                        : "bg-primary hover:bg-primary/90"
                                                )}
                                            >
                                                {isCompleted && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                                {dest.name}
                                                {!isCompleted && <span className="ml-1 opacity-70">도착</span>}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <CardContent className={cn(
                            'overflow-y-auto transition-all duration-300',
                            (selectedBus && (selectedBus.status === 'departed' || selectedBus.status === 'completed') && currentRoute && currentRoute.stops && currentRoute.stops.length > 0)
                                ? 'max-h-[25vh]'
                                : 'max-h-[40vh]'
                        )}>
                            <Table>
                                <TableBody>
                                    {studentsOnCurrentRoute.map(s => {
                                        const classId = s.afterSchoolClassIds?.[selectedDay];
                                        let afterSchoolClass = activeAfterSchoolClasses.find(c => c.id === classId);
                                        if (!afterSchoolClass && semesterMode === 'vacation') {
                                            const destId = s.afterSchoolDestinations?.[selectedDay];
                                            afterSchoolClass = activeAfterSchoolClasses.find(c => c.id === destId);
                                        }
                                        const classNameShort = afterSchoolClass ? afterSchoolClass.name.slice(0, 3) : '';
                                        const teachers: string[] = [];
                                        if (afterSchoolClass) {
                                            if (afterSchoolClass.teacherName) teachers.push(afterSchoolClass.teacherName.slice(0, 3));
                                            if (afterSchoolClass.teacherName2) teachers.push(afterSchoolClass.teacherName2.slice(0, 3));
                                        }
                                        const teachersText = teachers.length > 0 ? `(${teachers.join(',')})` : '';
                                        const fallbackCourseName = (s as any).afterSchoolCourseTitle || 
                                            ((s as any).enrolledCourseTitles && (s as any).enrolledCourseTitles[0]);
                                        const asBadgeText = afterSchoolClass 
                                            ? `[${classNameShort}]${teachersText}` 
                                            : (fallbackCourseName ? `[${fallbackCourseName.slice(0, 4)}]` : '');

                                        return (
                                            <TableRow key={s.id} onClick={() => handleStudentRowClick(s.id)} className={cn("cursor-pointer hover:bg-accent/50 transition-colors", lastClickedStudentId === s.id && "bg-accent/70")}>
                                                <TableCell className="px-2 py-3 whitespace-nowrap font-medium text-sm">
                                                    <div className="flex flex-col">
                                                        <span className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-bold text-slate-900">{formatStudentName(s)}</span>
                                                            {groupLeaderRecords.some(r => r.studentId === s.id && r.endDate === null) && <Crown className="inline-block w-3.5 h-3.5 text-yellow-500" />}
                                                            {asBadgeText && (
                                                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-normal">
                                                                    {asBadgeText}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground sm:hidden">
                                                            {destinations.find(d => d.id === (selectedDay === 'Saturday' ? (selectedRouteType === 'Morning' ? s.satMorningDestinationId : s.satAfternoonDestinationId) : (selectedRouteType === 'Morning' ? s.morningDestinationId : selectedRouteType === 'Afternoon' ? s.afternoonDestinationId : s.afterSchoolDestinations?.[selectedDay])))?.name || t('unassigned')}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            <TableCell className="px-2 py-3 text-right">
                                                <Badge 
                                                    variant={boardedStudentIds.includes(s.id) ? 'default' : (notBoardingStudentIds.includes(s.id) ? 'destructive' : (disembarkedStudentIds.includes(s.id) ? 'outline' : 'secondary'))}
                                                    className={cn(
                                                        "cursor-pointer select-none text-xs font-bold transition-all active:scale-95 shadow-2xs",
                                                        "h-8 sm:h-8 px-3.5 sm:px-4 py-1 rounded-lg inline-flex items-center justify-center whitespace-nowrap min-w-[70px]"
                                                    )}
                                                    onClick={(e) => { e.stopPropagation(); toggleStudentAttendance(s.id); }}
                                                >
                                                    {t(`teacher_page.status_${boardedStudentIds.includes(s.id) ? 'boarded' : (notBoardingStudentIds.includes(s.id) ? 'not_riding_today' : (disembarkedStudentIds.includes(s.id) ? 'disembarked' : 'not_boarded'))}`)}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                        <CardFooter>
                            {selectedBus && (
                                <div className="grid grid-cols-3 gap-2 w-full font-sans">
                                    <Button 
                                        onClick={() => handleUpdateBusStatus('ready')} 
                                        variant={(selectedBus.status === 'ready' || !selectedBus.status) ? 'default' : 'outline'} 
                                        className={cn(
                                            "w-full transition-all duration-300 font-bold h-9 text-xs sm:text-sm",
                                            (selectedBus.status === 'ready' || !selectedBus.status) 
                                                ? "bg-slate-600 hover:bg-slate-700 text-white border-transparent" 
                                                : "hover:bg-slate-100 text-slate-600 border-slate-200"
                                        )}
                                    >
                                        {t('teacher_page.bus_status_ready')}
                                    </Button>
                                    <Button 
                                        onClick={() => handleUpdateBusStatus('departed')} 
                                        variant={selectedBus.status === 'departed' ? 'default' : 'outline'} 
                                        className={cn(
                                            "w-full transition-all duration-300 font-bold h-9 text-xs sm:text-sm",
                                            selectedBus.status === 'departed' 
                                                ? "bg-blue-600 hover:bg-blue-700 text-white border-transparent" 
                                                : "hover:bg-blue-100 text-blue-600 border-blue-200"
                                        )}
                                    >
                                        {t('teacher_page.bus_status_running')}
                                    </Button>
                                    <Button 
                                        onClick={() => handleUpdateBusStatus('completed')} 
                                        variant={selectedBus.status === 'completed' ? 'default' : 'outline'} 
                                        className={cn(
                                            "w-full transition-all duration-300 font-bold h-9 text-xs sm:text-sm",
                                            selectedBus.status === 'completed' 
                                                ? "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent" 
                                                : "hover:bg-emerald-100 text-emerald-600 border-emerald-200"
                                        )}
                                    >
                                        {t('teacher_page.bus_status_completed')}
                                    </Button>
                                </div>
                            )}
                        </CardFooter>
                    </Card>

                    <Card id="printable-seat-map">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div><CardTitle>{t('teacher_page.seat_map_title')}</CardTitle><CardDescription>{t('teacher_page.seat_map_description')}</CardDescription></div>
                                <Button variant="outline" size="sm" onClick={() => window.print()} className="no-print"><Printer className="mr-2 h-4 w-4"/>{t('print')}</Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {selectedBus && currentRoute ? (
                                <BusSeatMap bus={selectedBus} seating={currentRoute.seating} students={students} destinations={destinations} onSeatClick={handleSeatClick} onSeatContextMenu={handleSeatContextMenu} highlightedSeatNumber={swapSourceSeat || (lastClickedStudentId ? currentRoute.seating.find(s => s.studentId === lastClickedStudentId)?.seatNumber : null)} boardedStudentIds={boardedStudentIds} notBoardingStudentIds={notBoardingStudentIds} routeType={selectedRouteType} dayOfWeek={selectedDay} groupLeaderRecords={groupLeaderRecords}/>
                            ) : (
                                <div className="text-center py-10 text-muted-foreground">{t('teacher_page.no_route_info')}</div>
                            )}
                        </CardContent>
                    </Card>
                    
                    {selectedStudent && (
                        <Card id="student-info-card" className="no-print border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2 scroll-mt-36">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 rounded-full hover:bg-slate-200/80 -ml-1 text-slate-700 hover:text-slate-900 shrink-0 border border-slate-200/80 bg-white shadow-2xs transition-all active:scale-95" 
                                            onClick={() => {
                                                const el = document.getElementById('boarding-students-list-card');
                                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }}
                                            title="탑승 학생 명단으로 이동"
                                        >
                                            <ArrowUp className="w-4 h-4" />
                                            <span className="sr-only">명단으로 이동</span>
                                        </Button>
                                        <CardTitle className="text-lg font-bold truncate">{formatStudentName(selectedStudent)}</CardTitle>
                                    </div>
                                    <Badge variant={selectedStudent.isGroupLeader ? "default" : "secondary"} className="shrink-0">{selectedStudent.isGroupLeader ? "활동 조장" : "일반 학생"}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pb-3 space-y-2">
                                <p className="text-sm text-muted-foreground">학년/반: {selectedStudent.grade}학년 {selectedStudent.class}반</p>
                                {selectedStudent.contact && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                        <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                                        <span>연락처:</span>
                                        <a 
                                            href={`tel:${selectedStudent.contact}`} 
                                            className="font-medium text-blue-600 hover:underline"
                                        >
                                            {selectedStudent.contact}
                                        </a>
                                    </p>
                                )}
                                <p className="text-sm text-muted-foreground">목적지: {destinations.find(d => d.id === (selectedDay === 'Saturday' ? (selectedRouteType === 'Morning' ? selectedStudent.satMorningDestinationId : selectedStudent.satAfternoonDestinationId) : (selectedRouteType === 'Morning' ? selectedStudent.morningDestinationId : selectedRouteType === 'Afternoon' ? selectedStudent.afternoonDestinationId : selectedStudent.afterSchoolDestinations?.[selectedDay])))?.name || t('unassigned')}</p>
                                {(() => {
                                    const classId = selectedStudent.afterSchoolClassIds?.[selectedDay];
                                    if (classId) {
                                        const afterSchoolClass = activeAfterSchoolClasses.find(c => c.id === classId);
                                        if (afterSchoolClass) {
                                            return (
                                                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                                    <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                                                    <span>방과후 ({t(`day_short.${selectedDay.toLowerCase()}`)}):</span>
                                                    <span className="font-medium text-foreground">{afterSchoolClass.name}</span>
                                                    {afterSchoolClass.teacherName && (
                                                        <span className="text-xs text-muted-foreground/70">({afterSchoolClass.teacherName})</span>
                                                    )}
                                                </p>
                                            );
                                        }
                                    }
                                    const destBasedClass = activeAfterSchoolClasses.find(
                                        c => c.id === selectedStudent.afterSchoolDestinations?.[selectedDay] && c.dayOfWeek === selectedDay
                                    );
                                    if (destBasedClass) {
                                        return (
                                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                                <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                                                <span>방과후 ({t(`day_short.${selectedDay.toLowerCase()}`)}):</span>
                                                <span className="font-medium text-foreground">{destBasedClass.name}</span>
                                                {destBasedClass.teacherName && (
                                                    <span className="text-xs text-muted-foreground/70">({destBasedClass.teacherName})</span>
                                                )}
                                            </p>
                                        );
                                    }
                                    const fallbackTitle = (selectedStudent as any).afterSchoolCourseTitle || 
                                        ((selectedStudent as any).enrolledCourseTitles && (selectedStudent as any).enrolledCourseTitles.join(', '));
                                    if (fallbackTitle) {
                                        return (
                                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                                <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                                                <span>방과후 ({t(`day_short.${selectedDay.toLowerCase()}`)}):</span>
                                                <span className="font-medium text-foreground">{fallbackTitle}</span>
                                            </p>
                                        );
                                    }
                                    return null;
                                })()}
                            </CardContent>
                            <CardFooter className="flex flex-col gap-2">
                                {/* 1행: '오늘 안 탐 처리' 와 '요일 제외' 버튼 나란히 배치 */}
                                <div className="grid grid-cols-2 gap-2 w-full font-sans">
                                    {(() => {
                                        const isNotBoarding = notBoardingStudentIds.includes(selectedStudent.id);
                                        return (
                                            <Button 
                                                variant={isNotBoarding ? "destructive" : "outline"} 
                                                size="sm" 
                                                onClick={handleMarkNotBoarding} 
                                                className={cn("w-full h-9 text-xs font-bold", !isNotBoarding && "text-destructive border-destructive hover:bg-destructive/10")}
                                            >
                                                <AlertCircle className="mr-1.5 h-4 w-4 shrink-0" /> 
                                                <span className="truncate">{isNotBoarding ? "오늘 탑승 복구" : t('teacher_page.mark_not_riding_today')}</span>
                                            </Button>
                                        );
                                    })()}

                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={handleExcludeStudentFromDayRoute} 
                                        className="w-full h-9 text-xs font-bold text-amber-700 border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                                        title={`${t(`day.${selectedDay.toLowerCase()}`)} ${t(`route_type.${selectedRouteType.toLowerCase()}`)} 명단에서 제외`}
                                    >
                                        <CalendarX className="mr-1.5 h-4 w-4 shrink-0 text-amber-600" /> 
                                        <span className="truncate">요일 제외</span>
                                    </Button>
                                </div>

                                {/* 2행: 조장 임명/해제 */}
                                {selectedRouteType !== 'AfterSchool' && (
                                    <Button 
                                        variant={selectedStudent.isGroupLeader ? "destructive" : "default"} 
                                        size="sm" 
                                        onClick={toggleGroupLeader} 
                                        className="w-full h-9 text-xs font-bold"
                                    >
                                        {selectedStudent.isGroupLeader ? (
                                            <>
                                                <UserX className="mr-2 h-4 w-4" /> 
                                                {t('teacher_page.demote_leader')}
                                            </>
                                        ) : (
                                            <>
                                                <Crown className="mr-2 h-4 w-4" /> 
                                                {t('teacher_page.promote_leader')}
                                            </>
                                        )}
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    )}
                    <div className="lg:hidden"><LostAndFound lostItems={lostItems} setLostItems={setLostItems} buses={buses}/></div>
                </div>
                <div className="hidden lg:flex flex-col gap-6 no-print">
                    {selectedRouteType !== 'AfterSchool' && (
                        <GroupLeaderManager 
                            records={groupLeaderRecords} 
                            setRecords={(next) => { 
                                const updated = typeof next === 'function' ? next(groupLeaderRecords) : next; 
                                setGroupLeaderRecords(updated); 
                                if (currentRoute) saveGroupLeaderRecords(currentRoute.id, updated, currentRoute.busId, currentRoute.type).catch(console.error); 
                            }}
                        />
                    )}
                    <LostAndFound lostItems={lostItems} setLostItems={setLostItems} buses={buses}/>
                </div>
            </div>
        )}
        </div>

      <Dialog open={isQrScannerOpen} onOpenChange={(open) => {
          setIsQrScannerOpen(open);
          if (!open) {
              setQrScanSuccessStudentName(null);
              setQrScanSuccessStatus(null);
          }
      }}>
          <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                  <DialogTitle>{lang === 'ko' ? '학생 QR 코드 스캔' : 'Scan Student QR Code'}</DialogTitle>
                  <DialogDescription>
                      {lang === 'ko' 
                          ? '학생의 QR 코드를 카메라 화면에 비춰주세요.' 
                          : 'Place the student QR code in front of the camera.'}
                  </DialogDescription>
              </DialogHeader>
              
              <div className="relative aspect-video w-full overflow-hidden rounded-md bg-slate-900 border flex items-center justify-center">
                  {isQrScannerOpen && (
                      <QrCameraFeed onScan={handleQrScan} />
                  )}
                  
                  {qrScanSuccessStudentName && (
                      <div className="absolute inset-0 bg-emerald-950/90 text-white flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
                          <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2 animate-bounce" />
                          <span className="font-bold text-lg">{qrScanSuccessStudentName}</span>
                          <span className="text-sm opacity-90 mt-1">
                              {qrScanSuccessStatus === 'boarded' 
                                  ? (lang === 'ko' ? '탑승 처리 완료' : 'Boarded')
                                  : (lang === 'ko' ? '하차 처리 완료' : 'Disembarked')}
                          </span>
                      </div>
                  )}
              </div>
              
              <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setIsQrScannerOpen(false)}>
                      {lang === 'ko' ? '닫기' : 'Close'}
                  </Button>
              </div>
          </DialogContent>
      </Dialog>

      <Dialog open={qrAlertErrorReason !== null} onOpenChange={(open) => {
          if (!open) {
              setQrAlertErrorReason(null);
              setQrAlertStudent(null);
              setQrAlertCorrectBusName(null);
          }
      }}>
          <DialogContent className="sm:max-w-[400px] border-red-200">
              <DialogHeader>
                  <DialogTitle className="text-red-600 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      <span>{lang === 'ko' ? '잘못된 버스 탑승 경고' : 'Invalid Bus Entry Warning'}</span>
                  </DialogTitle>
                  <DialogDescription>
                      {lang === 'ko' ? '학생이 잘못된 차량에 탑승하려고 합니다.' : 'The student is attempting to board the wrong bus.'}
                  </DialogDescription>
              </DialogHeader>
              
              <div className="bg-red-50 border border-red-100 rounded-md p-4 mt-2 font-sans text-center">
                  {qrAlertErrorReason === 'wrong_bus' && (
                      <>
                          <p className="text-base font-bold text-red-700">
                              [{qrAlertStudent ? `${qrAlertStudent.grade.toUpperCase()}${qrAlertStudent.class} ${getStudentName(qrAlertStudent, lang)}` : ''}]
                          </p>
                          <p className="text-sm text-red-600 mt-2">
                              {lang === 'ko' 
                                  ? `이 학생은 오늘 [${qrAlertCorrectBusName}] 탑승 대상입니다.`
                                  : `This student belongs to [${qrAlertCorrectBusName}] today.`}
                          </p>
                      </>
                  )}
                  {qrAlertErrorReason === 'no_route' && (
                      <>
                          <p className="text-base font-bold text-red-700">
                              [{qrAlertStudent ? `${qrAlertStudent.grade.toUpperCase()}${qrAlertStudent.class} ${getStudentName(qrAlertStudent, lang)}` : ''}]
                          </p>
                          <p className="text-sm text-red-600 mt-2">
                              {lang === 'ko' 
                                  ? '오늘 하교(또는 방과후) 노선에 배정되어 있지 않은 학생입니다.'
                                  : 'This student is not assigned to any afternoon route today.'}
                          </p>
                      </>
                  )}
                  {qrAlertErrorReason === 'invalid_qr' && (
                      <p className="text-sm font-bold text-red-700">
                          {lang === 'ko' ? '유효하지 않거나 등록되지 않은 QR 코드입니다.' : 'Invalid or unregistered QR code.'}
                      </p>
                  )}
              </div>
              
              <div className="flex justify-center mt-4">
                  <Button variant="destructive" className="w-full bg-red-600 hover:bg-red-700" onClick={() => {
                      setQrAlertErrorReason(null);
                      setQrAlertStudent(null);
                      setQrAlertCorrectBusName(null);
                  }}>
                      {lang === 'ko' ? '확인' : 'Confirm'}
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function TeacherLoginScreen({ 
  pin, onPinPress, onBackspace, error, lang, validPin, 
  loginStep, setLoginStep, nameInput, setNameInput, teachers = []
}: any) {
  const sortedTeachers = useMemo(() => {
    return [...teachers].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'ko'));
  }, [teachers]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
      <Card className="w-full max-w-[400px] shadow-lg border-none bg-white">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-2">
            <GraduationCap className="text-white w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-800">KIS BUS</CardTitle>
          <CardDescription>
            {loginStep === 'name' ? '선생님 본인 확인' : '교사용 인증번호 입력'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loginStep === 'name' ? (
            <div className="space-y-3">
              <Label className="text-slate-600 font-semibold text-xs">{lang === 'ko' ? '선생님 성함을 선택하거나 입력해주세요' : 'Select or enter your name'}</Label>
              
              {sortedTeachers.length > 0 && (
                <Select 
                  value={nameInput} 
                  onValueChange={(val) => {
                    setNameInput(val);
                    setLoginStep('pin');
                  }}
                >
                  <SelectTrigger className="h-10 font-medium bg-slate-50">
                    <SelectValue placeholder={lang === 'ko' ? '교직원 명단에서 선택' : 'Select from faculty list'} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {sortedTeachers.map((t: any) => (
                      <SelectItem key={t.id || t.email || t.name} value={t.name}>
                        {t.name} {t.role ? `(${t.role})` : ''} {t.dept ? `- ${t.dept}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="relative flex py-0.5 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-2 text-[10px] text-slate-400 font-bold">또는 직접 입력</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <Input 
                placeholder={lang === 'ko' ? '이름 직접 입력' : 'Name'} 
                value={nameInput} 
                onChange={(e) => setNameInput(e.target.value)} 
                className="h-10"
                onKeyDown={(e) => e.key === 'Enter' && setLoginStep('pin')}
              />
              <Button className="w-full h-10 font-bold" onClick={() => setLoginStep('pin')}>
                {lang === 'ko' ? '다음 (인증번호 입력)' : 'Next'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-center gap-4">
                {Array.from({ length: validPin.length }).map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-4 h-4 rounded-full border-2 transition-all duration-200", 
                      pin.length >= i + 1 
                        ? (error ? "bg-red-500 border-red-500" : "bg-primary border-primary") 
                        : "border-slate-300 bg-transparent"
                    )}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <Button 
                    key={num} 
                    variant="outline" 
                    className="h-12 text-lg font-bold border-slate-200 hover:bg-slate-50"
                    onClick={() => onPinPress(num.toString())}
                  >
                    {num}
                  </Button>
                ))}
                <Button 
                  variant="ghost" 
                  className="h-12 text-sm text-slate-400"
                  onClick={() => setLoginStep('name')}
                >
                  {lang === 'ko' ? '이전' : 'Back'}
                </Button>
                <Button 
                  variant="outline" 
                  className="h-12 text-lg font-bold border-slate-200 hover:bg-slate-50"
                  onClick={() => onPinPress('0')}
                >
                  0
                </Button>
                <Button 
                  variant="ghost" 
                  className="h-12 flex items-center justify-center text-slate-500"
                  onClick={onBackspace}
                >
                  <UserX className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeacherSettingsDialog({ 
  teacher, buses, routes = [], t, lang, teacherBadge 
}: { 
  teacher: Teacher; buses: Bus[]; routes?: Route[]; t: any; lang: string; teacherBadge?: React.ReactNode 
}) {
  const [assignedBusId, setAssignedBusId] = useState(teacher?.assignedBusId || '');
  const [assignedAfterSchoolBusId, setAssignedAfterSchoolBusId] = useState(teacher?.assignedAfterSchoolBusId || '');
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && teacher) {
      setAssignedBusId(teacher.assignedBusId || '');
      setAssignedAfterSchoolBusId(teacher.assignedAfterSchoolBusId || '');
    }
  }, [open, teacher]);

  const commuteBuses = useMemo(() => {
    return buses.filter(bus => 
      routes.some(r => r.busId === bus.id && r.type !== 'AfterSchool')
    );
  }, [buses, routes]);

  const afterSchoolBuses = useMemo(() => {
    return buses.filter(bus => 
      routes.some(r => r.busId === bus.id && r.type === 'AfterSchool')
    );
  }, [buses, routes]);

  const handleSave = async () => {
    try {
      const { doc, updateDoc } = require('firebase/firestore');
      await updateDoc(doc(db(), 'teachers', teacher.id), {
        assignedBusId,
        assignedAfterSchoolBusId
      });
      toast({
        title: lang === 'ko' ? '설정 저장 완료' : 'Settings Saved',
        description: lang === 'ko' ? '담당 버스 설정이 업데이트되었습니다.' : 'Preferences updated successfully.',
      });
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {teacherBadge ? (
          <div className="flex items-center gap-2">
            {teacherBadge}
            <Button variant="outline" size="sm" className="h-8">
              <Settings className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">{lang === 'ko' ? '설정' : 'Settings'}</span>
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-8">
            <Settings className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">{lang === 'ko' ? '설정' : 'Settings'}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{lang === 'ko' ? '설정' : 'Settings'}</DialogTitle>
          <DialogDescription>
            {lang === 'ko' ? '담당 버스를 관리합니다.' : 'Manage your assigned buses.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 font-sans text-sm">
          <div className="grid gap-2">
            <label className="font-bold">{lang === 'ko' ? '담당 버스 (등하교)' : 'Assigned Bus (Morning/Afternoon)'}</label>
            <div className="flex flex-wrap gap-1.5">
              <Button 
                variant={assignedBusId === '' ? 'default' : 'outline'} 
                size="sm" 
                className="h-7 text-xs" 
                onClick={() => setAssignedBusId('')}
              >
                {lang === 'ko' ? '미지정' : 'Unassigned'}
              </Button>
              {commuteBuses.map((bus) => (
                <Button 
                   key={bus.id}
                  variant={assignedBusId === bus.id ? 'default' : 'outline'} 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => setAssignedBusId(bus.id)}
                >
                  {bus.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 mt-2">
            <label className="font-bold">{lang === 'ko' ? '담당 버스 (방과후)' : 'Assigned Bus (After School)'}</label>
            <div className="flex flex-wrap gap-1.5">
              <Button 
                variant={assignedAfterSchoolBusId === '' ? 'default' : 'outline'} 
                size="sm" 
                className="h-7 text-xs" 
                onClick={() => setAssignedAfterSchoolBusId('')}
              >
                {lang === 'ko' ? '미지정' : 'Unassigned'}
              </Button>
              {afterSchoolBuses.map((bus) => (
                <Button 
                  key={bus.id}
                  variant={assignedAfterSchoolBusId === bus.id ? 'default' : 'outline'} 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => setAssignedAfterSchoolBusId(bus.id)}
                >
                  {bus.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>{lang === 'ko' ? '취소' : 'Cancel'}</Button>
          <Button onClick={handleSave}>{lang === 'ko' ? '저장' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WebCopySeatPlanDialog({ sourceRoute, sourceDay, routes, students, t, lang, iconOnly = false }: any) {
  const [selectedTypes, setSelectedTypes] = useState<RouteType[]>([sourceRoute.type]);
  const [selectedDays, setSelectedDays] = useState<string[]>([sourceDay]);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const toggleType = (type: RouteType) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleCopy = async () => {
    if (selectedDays.length === 0 || selectedTypes.length === 0) {
      toast({ title: 'Error', description: 'Select targets', variant: 'destructive' });
      return;
    }

    const confirmMsg = lang === 'ko' 
      ? '선택한 노선과 요일로 복사하시겠습니까?' 
      : 'Copy this seat plan to selected targets?';
      
    if (!window.confirm(confirmMsg)) return;

    try {
      const { doc, writeBatch } = require('firebase/firestore');
      const batch = writeBatch(db());
      let count = 0;
      
      const DAYS_MAP_LOCAL: Record<string, string> = {
        '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday', 
        '목': 'Thursday', '금': 'Friday', '토': 'Saturday'
      };
      
      for (const day of selectedDays) {
        const dayKey = DAYS_MAP_LOCAL[day] || day;
        for (const type of selectedTypes) {
          if (day === sourceDay && type === sourceRoute.type) continue;

          const targetRoute = routes.find((r: any) => 
            r.busId === sourceRoute.busId && 
            r.dayOfWeek === dayKey && 
            r.type === type
          );

          if (targetRoute) {
            let finalSeating = sourceRoute.seating;
            
            if (type === 'Afternoon') {
              finalSeating = sourceRoute.seating.map((se: any) => {
                if (!se.studentId) return se;
                
                const student = students.find((s: any) => s.id === se.studentId);
                const hasAfterSchool = student?.afterSchoolClassIds?.[day];
                
                if (hasAfterSchool) {
                  return { ...se, studentId: '' };
                }
                return se;
              });
            }

            batch.update(doc(db(), 'routes', targetRoute.id), {
              seating: finalSeating
            });
            count++;
          }
        }
      }

      if (count > 0) {
        await batch.commit();
        toast({ 
          title: lang === 'ko' ? '복사 완료' : 'Copy Complete',
          description: lang === 'ko' ? '좌석표가 복사되었습니다.' : 'Seat plan copied successfully.'
        });
        setOpen(false);
      } else {
        toast({ title: 'Error', description: 'No matching routes found', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    }
  };

  const DAYS_LIST = ['월', '화', '수', '목', '금', '토'];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 sm:h-8 px-1.5 sm:px-2.5 border-blue-200 text-blue-600 hover:bg-blue-50 shrink-0 text-xs" title={lang === 'ko' ? '좌석 복사' : 'Copy Seating'}>
          <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span className="hidden 2xl:inline ml-1.5">{lang === 'ko' ? '좌석 복사' : 'Copy Seating'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{lang === 'ko' ? '좌석표 복사' : 'Copy Seat Plan'}</DialogTitle>
          <DialogDescription>
            {lang === 'ko' 
              ? '현재 좌석표를 다른 요일이나 하교 노선으로 복사합니다.' 
              : 'Copy current seating configuration to other days/routes.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 font-sans text-sm">
          <div className="grid gap-2">
            <label className="font-bold">{lang === 'ko' ? '대상 노선' : 'Target Routes'}</label>
            <div className="flex gap-4">
              {['Morning', 'Afternoon'].map((type) => {
                const isSelected = selectedTypes.includes(type as RouteType);
                const label = type === 'Morning' 
                  ? (lang === 'ko' ? '등교' : 'Morning') 
                  : (lang === 'ko' ? '하교' : 'Afternoon');
                return (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`type-${type}`} 
                      checked={isSelected} 
                      onCheckedChange={() => toggleType(type as RouteType)} 
                    />
                    <label htmlFor={`type-${type}`} className="font-medium cursor-pointer">
                      {label}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2 mt-2">
            <label className="font-bold">{lang === 'ko' ? '대상 요일' : 'Target Days'}</label>
            <div className="flex flex-wrap gap-3">
              {DAYS_LIST.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`day-${day}`} 
                      checked={isSelected} 
                      onCheckedChange={() => toggleDay(day)} 
                    />
                    <label htmlFor={`day-${day}`} className="font-medium cursor-pointer">
                      {day}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>{lang === 'ko' ? '취소' : 'Cancel'}</Button>
          <Button onClick={handleCopy}>{lang === 'ko' ? '복사 실행' : 'Copy'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QrCameraFeed({ onScan }: { onScan: (data: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
        }
      } catch (err: any) {
        console.error('Camera open failed:', err);
        setCameraError(err.message || 'Camera access error');
      }
    };

    startCamera();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const scanQr = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_CURRENT_DATA) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert'
            });

            if (code && code.data) {
              onScan(code.data);
            }
          }
        }
      }
      animationRef.current = requestAnimationFrame(scanQr);
    };

    animationRef.current = requestAnimationFrame(scanQr);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [onScan]);

  if (cameraError) {
    return (
      <div className="text-red-400 text-xs text-center p-4">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
        <p>카메라 접근 권한이 차단되었거나 지원되지 않습니다.</p>
        <p className="opacity-80 mt-1">(HTTPS 보안 프로토콜을 확인해주세요.)</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <video ref={videoRef} className="w-full h-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute inset-0 border-[3px] border-dashed border-white/20 m-8 rounded-md pointer-events-none flex items-center justify-center">
        <div className="w-48 h-48 border border-emerald-400/50 rounded flex items-center justify-center animate-pulse">
          <div className="w-full h-0.5 bg-emerald-400 animate-bounce" />
        </div>
      </div>
    </div>
  );
}
