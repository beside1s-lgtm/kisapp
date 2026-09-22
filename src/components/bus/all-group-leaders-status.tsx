'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { Crown, UserMinus, FileDown, Upload, Download, Pencil, Check, Search, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getGroupLeaderRecords, saveGroupLeaderRecords } from '@/lib/kisbus';
import { normalizeString, getStudentName } from '@/lib/kisbus/utils';
import type { Bus, Student, Route, GroupLeaderRecord } from '@/lib/kisbus/types';

/**
 * "전체 조장 현황" 카드 (teacher/bus/page.tsx에서 순수 이동).
 *
 * 원래부터 TeacherPage 내부 클로저를 참조하지 않는, props만으로 동작하는
 * 독립 컴포넌트였기 때문에 그대로 파일만 옮긴 것이다 (동작 변경 없음).
 */
export const AllGroupLeadersStatus = ({ relevantRoutes, students, buses, formatStudentName, t }: { relevantRoutes: Route[]; students: Student[]; buses: Bus[]; formatStudentName: (student: Student) => string; t: any; }) => {
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
        <Card id="all-group-leaders-section" className="border-none shadow-none lg:border lg:shadow-sm w-full h-full scroll-mt-20">
            <CardHeader className="px-2 py-3 sm:px-4">
                <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-1.5 shrink-0">
                        <CardTitle className="text-base sm:text-lg">
                            <span className="sm:hidden">조장 현황</span>
                            <span className="hidden sm:inline">{t('teacher_page.all_group_leaders_view.title')}</span>
                        </CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            className="lg:hidden h-8 w-8 p-0 border-slate-200 hover:bg-slate-100 flex items-center justify-center shrink-0"
                            onClick={() => {
                                document.getElementById('all-students-boarding-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            title={t('teacher_page.all_group_leaders_view.goto_boarding_list') || '명단 상단 ↑'}
                        >
                            <ArrowUp className="h-4 w-4 text-slate-700" />
                        </Button>
                    </div>
                    <div className="flex gap-1.5 sm:gap-2">
                        {selectedBusIds.size > 0 && (
                            <Button variant="destructive" size="sm" onClick={handleBulkDemote} className="h-8 px-2 animate-in fade-in slide-in-from-right-2">
                                <UserMinus className="sm:mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">{t('deselect') || '선택 해제'} ({selectedBusIds.size})</span>
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="h-8 px-2">
                            <FileDown className="sm:mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">{t('admin.bus_registration.template') || '템플릿'}</span>
                        </Button>
                        <Label htmlFor="batch-leader-upload" className="cursor-pointer">
                            <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-2">
                                <Upload className="sm:mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">{t('batch_upload') || '일괄입력'}</span>
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
                            <TableHead className="whitespace-nowrap w-px text-right">{t('actions') || '관리'}</TableHead>
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
