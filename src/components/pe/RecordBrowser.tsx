
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { exportToExcel, getQuizResultsBySchool, getQuizAssignments, deleteRecordsByDateAndItem } from '@/lib/services/peService';
import type { Student, MeasurementItem, MeasurementRecord, QuizResult, QuizAssignment, SportsClub } from '@/lib/pe/types';
import { getPapsGrade, calculatePapsScore, getCustomItemGrade } from '@/lib/pe/paps';
import { calculateRanks } from '@/lib/services/peService';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FileDown, Calendar as CalendarIcon, BookOpen, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


interface RecordBrowserProps {
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
  sportsClubs: SportsClub[];
}

type ViewType = 'grade' | 'score' | 'record';
type SortDescriptor = {
  column: string;
  direction: 'ascending' | 'descending';
};


const papsFactors: Record<string, string> = {
    '왕복오래달리기': '심폐지구력',
    '오래달리기': '심폐지구력',
    '윗몸 말아올리기': '근력/근지구력',
    '팔굽혀펴기': '근력/근지구력',
    '무릎 대고 팔굽혀펴기': '근력/근지구력',
    '악력': '근력/근지구력',
    '앉아윗몸앞으로굽히기': '유연성',
    '50m 달리기': '순발력',
    '제자리 멀리뛰기': '순발력',
    '체질량지수(BMI)': '체질량지수(BMI)',
};

const factorOrder = ['학년', '반', '번호', '이름', '성별', '심폐지구력', '유연성', '근력/근지구력', '순발력', '체질량지수(BMI)', '종합'];


export default function RecordBrowser({
  allStudents,
  allItems,
  allRecords,
  sportsClubs,
}: RecordBrowserProps) {
  const { toast } = useToast();
  const { user } = useAuth(); const school = 'KISH';

  const [gradeFilter, setGradeFilter] = useState('all');
  const [classNumFilter, setClassNumFilter] = useState('all');
  const [selectedClubId, setSelectedClubId] = useState('all');
  const [dateFilter, setDateFilter] = useState<Date | 'latest' | undefined>('latest');
  const [viewType, setViewType] = useState<ViewType>('grade');
  
  const [papsSort, setPapsSort] = useState<SortDescriptor[]>([
    { column: '학년', direction: 'ascending'},
    { column: '반', direction: 'ascending'},
    { column: '번호', direction: 'ascending'}
  ]);


  const [selectedItem, setSelectedItem] = useState('');
  const [itemGradeFilter, setItemGradeFilter] = useState('all');
  const [itemClassNumFilter, setItemClassNumFilter] = useState('all');
  const [itemDateFilter, setItemDateFilter] = useState('latest');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [itemSort, setItemSort] = useState<SortDescriptor[]>([
    { column: 'grade', direction: 'ascending' },
    { column: 'classNum', direction: 'ascending' },
    { column: 'studentNum', direction: 'ascending' }
  ]);
  
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [quizAssignments, setQuizAssignments] = useState<QuizAssignment[]>([]);

  // Filter for items that actually have at least one record
  const itemsWithRecords = useMemo(() => {
    const recordedItemNames = new Set(allRecords.map(r => r.item));
    return allItems
      .filter(item => recordedItemNames.has(item.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allItems, allRecords]);

  useEffect(() => {
    if (school && selectedItem === 'theory-exam') {
        Promise.all([
            getQuizResultsBySchool(school),
            getQuizAssignments(school)
        ]).then(([results, assignments]) => {
            setQuizResults(results);
            setQuizAssignments(assignments);
        });
    }
  }, [school, selectedItem]);


  const { grades, classNumsByGrade, availableDates } = useMemo(() => {
    const grades = [...new Set(allStudents.map((s) => s.grade))].sort((a,b) => parseInt(a) - parseInt(b));
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach((grade) => {
      classNumsByGrade[grade] = [
        ...new Set(
          allStudents.filter((s) => s.grade === grade).map((s) => s.classNum)
        ),
      ].sort((a,b) => parseInt(a) - parseInt(b));
    });
    const dates = [...new Set(allRecords.map(r => r.date))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return { grades, classNumsByGrade, availableDates: dates };
  }, [allStudents, allRecords]);
  
  const selectedItemInfo = useMemo(() => allItems.find(i => i.name === selectedItem), [selectedItem, allItems]);

  const studentPapsTableData = useMemo(() => {
    let filteredStudents = allStudents;
    
    if (selectedClubId !== 'all') {
      const club = sportsClubs.find(c => c.id === selectedClubId);
      if (club) filteredStudents = filteredStudents.filter(s => club.memberIds.includes(s.id));
    } else if (gradeFilter !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.grade === gradeFilter);
      if (classNumFilter !== 'all') {
        filteredStudents = filteredStudents.filter(s => s.classNum === classNumFilter);
      }
    }
    
    return filteredStudents.map(student => {
      const studentData: Record<string, any> = {
        '학년': student.grade,
        '반': student.classNum,
        '번호': student.studentNum,
        '이름': student.name,
        '성별': student.gender,
      };

      const studentRecords = allRecords.filter(r => r.studentId === student.id);
      let totalPapsScore = 0;
      let scoredFactorCount = 0;
      
      const papsFactorKeys = ['심폐지구력', '유연성', '근력/근지구력', '순발력', '체질량지수(BMI)'];

      papsFactorKeys.forEach(factor => {
        const factorItems = Object.keys(papsFactors).filter(key => papsFactors[key] === factor);
        let latestRecord: MeasurementRecord | undefined;
        let latestItem: MeasurementItem | undefined;
        
        for(const itemName of factorItems) {
            const item = allItems.find(i => i.name === itemName);
            if (!item) continue;

            const recordsForItem = studentRecords.filter(r => {
                if (r.item !== itemName) return false;
                if (dateFilter === 'latest') return true;
                return dateFilter && r.date === format(dateFilter, 'yyyy-MM-dd');
            });

            if (recordsForItem.length > 0) {
              const currentLatest = recordsForItem.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
              if (!latestRecord || new Date(currentLatest.date) > new Date(latestRecord.date)) {
                  latestRecord = currentLatest;
                  latestItem = item;
              }
            }
        }
        
        if (latestRecord && latestItem) {
            const grade = getPapsGrade(latestRecord.item, student, latestRecord.value);
            const score = calculatePapsScore(latestRecord.item, student, latestRecord.value);
            
            if(viewType === 'grade') {
                studentData[factor] = grade ? `${grade}등급` : 'N/A';
            } else if (viewType === 'score') {
                studentData[factor] = score !== null ? score : 'N/A';
            } else { // 'record'
                studentData[factor] = `${latestRecord.value}${latestItem.unit}`;
            }

            if (score !== null && factor !== '체질량지수(BMI)') {
                totalPapsScore += score;
                scoredFactorCount++;
            }
        } else {
            studentData[factor] = '-';
        }
      });
      
      let finalGrade = '-';
      let finalScore = 0;

      if (scoredFactorCount > 0) {
        finalScore = (totalPapsScore / (scoredFactorCount * 20)) * 100;
        
        if (finalScore >= 80) finalGrade = '1등급';
        else if (finalScore >= 60) finalGrade = '2등급';
        else if (finalScore >= 40) finalGrade = '3등급';
        else if (finalScore >= 20) finalGrade = '4등급';
        else finalGrade = '5등급';
      }

      if(viewType === 'grade') {
        studentData['종합'] = finalGrade;
      } else if (viewType === 'score') {
        studentData['종합'] = scoredFactorCount > 0 ? Math.round(finalScore) : 'N/A';
      } else { // 'record'
        studentData['종합'] = finalGrade;
      }
      
      return studentData;
    });
  }, [allStudents, allRecords, allItems, gradeFilter, classNumFilter, selectedClubId, sportsClubs, dateFilter, viewType]);

  const sortedPapsData = useMemo(() => {
    if (!papsSort.length) return studentPapsTableData;
    
    return [...studentPapsTableData].sort((a, b) => {
        for (const sort of papsSort) {
            const { column, direction } = sort;
            const valA = a[column];
            const valB = b[column];
            const isAsc = direction === 'ascending';
            
            const numA = parseFloat(String(valA));
            const numB = parseFloat(String(valB));

            let comparison = 0;
            if (!isNaN(numA) && !isNaN(numB)) {
                comparison = numA - numB;
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }
            
            if (comparison !== 0) {
                return isAsc ? comparison : -comparison;
            }
        }
        return 0;
    });
  }, [studentPapsTableData, papsSort]);
  

  const handlePapsDownloadExcel = () => {
    if (sortedPapsData.length === 0) {
      toast({
        variant: 'destructive',
        title: '다운로드 실패',
        description: '다운로드할 데이터가 없습니다.',
      });
      return;
    }
    
    const fileName = `PAPS_종합_현황_${viewType}_${new Date().toISOString().split('T')[0]}.xlsx`;
    exportToExcel(fileName, sortedPapsData);
    toast({
      title: '다운로드 시작',
      description: 'PAPS 종합 체력 현황을 엑셀 파일로 다운로드합니다.',
    });
  };

  const finalFactorOrder = useMemo(() => {
    const newOrder = [...factorOrder];
    const 종합Index = newOrder.indexOf('종합');
    if (종합Index !== -1) {
        newOrder[종합Index] = viewType === 'score' ? '종합점수' : '종합등급';
    }
    return newOrder;
  }, [viewType]);


  const studentItemTableData = useMemo(() => {
    if (!selectedItem || !school) return [];

    if (selectedItem === 'theory-exam') {
        let filteredStudents = allStudents;
        if (selectedClubId !== 'all') {
            const club = sportsClubs.find(c => c.id === selectedClubId);
            if (club) filteredStudents = filteredStudents.filter(s => club.memberIds.includes(s.id));
        } else if (itemGradeFilter !== 'all') {
            filteredStudents = filteredStudents.filter(s => s.grade === itemGradeFilter);
            if (itemClassNumFilter !== 'all') {
                filteredStudents = filteredStudents.filter(s => s.classNum === itemClassNumFilter);
            }
        }

        return filteredStudents.flatMap(student => {
            const results = quizResults.filter(r => r.studentId === student.id);
            if (results.length === 0) {
                return [{
                    ...student,
                    quizTitle: '-',
                    score: '-',
                    recordGrade: null,
                    passed: false,
                    latestDate: '-',
                    rank: null,
                    value: null,
                    totalRanked: 0
                }];
            }
            return results.map(r => {
                const assignment = quizAssignments.find(a => a.id === r.assignmentId);
                return {
                    ...student,
                    quizTitle: assignment?.quizTitle || '알 수 없는 퀴즈',
                    score: `${r.score} / ${r.total}`,
                    recordGrade: null,
                    passed: r.passed,
                    latestDate: r.createdAt?.toDate ? format(r.createdAt.toDate(), 'yyyy-MM-dd') : '-',
                    rank: null,
                    value: null,
                    totalRanked: 0
                };
            });
        });
    }

    const itemInfo = allItems.find(i => i.name === selectedItem);
    if (!itemInfo) return [];

    let filteredStudents = allStudents;
    if (selectedClubId !== 'all') {
      const club = sportsClubs.find(c => c.id === selectedClubId);
      if (club) filteredStudents = filteredStudents.filter(s => club.memberIds.includes(s.id));
    } else if (itemGradeFilter !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.grade === itemGradeFilter);
      if (itemClassNumFilter !== 'all') {
        filteredStudents = filteredStudents.filter(s => s.classNum === itemClassNumFilter);
      }
    }

    if (filteredStudents.length === 0) {
        return [];
    }

    const allRanks = calculateRanks(school, allItems, allRecords, allStudents, itemGradeFilter === 'all' ? undefined : itemGradeFilter);
    const itemRanks = allRanks[selectedItem] || [];

    return filteredStudents.map(student => {
      let records = allRecords.filter(r => r.studentId === student.id && r.item === selectedItem);
      
      if (itemDateFilter !== 'latest' && itemDateFilter !== 'all') {
        records = records.filter(r => r.date === itemDateFilter);
      }

      const latestRecord = records.length > 0
        ? (itemDateFilter === 'latest' 
           ? records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
           : records[0])
        : null;
      
      const rankInfo = latestRecord ? itemRanks.find((r: any) => r.studentId === student.id && r.value === latestRecord.value) : null;
      
      let recordGrade: number | null = null;
      if (latestRecord) {
        if (itemInfo.isPaps) {
          recordGrade = getPapsGrade(itemInfo.name, student, latestRecord.value);
        } else {
          recordGrade = getCustomItemGrade(itemInfo, latestRecord.value);
        }
      }

      return {
        ...student,
        latestDate: latestRecord?.date || null,
        value: latestRecord?.value,
        height: latestRecord?.height,
        weight: latestRecord?.weight,
        recordGrade, 
        rank: rankInfo ? rankInfo.rank : null,
        totalRanked: itemRanks.length,
        quizTitle: null,
        score: null,
        passed: null
      };
    });

  }, [school, selectedItem, itemGradeFilter, itemClassNumFilter, itemDateFilter, allStudents, allRecords, allItems, quizResults, quizAssignments]);

  const sortedItemData = useMemo(() => {
      if (!itemSort.length) return studentItemTableData;
      
      return [...studentItemTableData].sort((a,b) => {
        for (const sort of itemSort) {
            const { column, direction } = sort;
            const isAsc = direction === 'ascending';

            let valA: any, valB: any;
            
            if(column === 'name') { valA = a.name; valB = b.name }
            else if(column === 'grade') { valA = a.grade; valB = b.grade }
            else if(column === 'classNum') { valA = a.classNum; valB = b.classNum }
            else if(column === 'studentNum') { valA = a.studentNum; valB = b.studentNum }
            else if(column === 'latestDate'){ valA = (a as any).latestDate; valB = (b as any).latestDate }
            else if(column === 'value'){ valA = (a as any).value || (a as any).score; valB = (b as any).value || (b as any).score }
            else if(column === 'recordGrade'){ valA = (a as any).recordGrade; valB = (b as any).recordGrade }
            else if(column === 'rank'){ valA = (a as any).rank; valB = (b as any).rank }
            else { valA = (a as any)[column]; valB = (b as any)[column]; }


            if (valA == null) return 1;
            if (valB == null) return -1;
            
            let comparison = 0;
            if (column === 'value' || column === 'recordGrade' || column === 'rank' || column === 'grade' || column === 'classNum' || column === 'studentNum') {
                const itemInfo = allItems.find(i => i.name === selectedItem);
                
                const numA = parseFloat(valA);
                const numB = parseFloat(valB);

                comparison = numA - numB;

                 if (itemInfo?.recordType === 'time') {
                    comparison = -comparison;
                }
            } else if (column === 'latestDate') {
                const dateA = new Date(valA).getTime();
                const dateB = new Date(valB).getTime();
                comparison = dateA - dateB;
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }
            
            if (comparison !== 0) {
                return isAsc ? comparison : -comparison;
            }
        }
        return 0;
      });
  }, [studentItemTableData, itemSort, selectedItem, allItems]);


  const handleItemDownloadExcel = () => {
    if (sortedItemData.length === 0) {
      toast({
        variant: 'destructive',
        title: '다운로드 실패',
        description: '다운로드할 데이터가 없습니다.',
      });
      return;
    }

    if (selectedItem === 'theory-exam') {
      const dataToExport = sortedItemData.map(s => ({
        '학년': s.grade,
        '반': s.classNum,
        '번호': s.studentNum,
        '이름': s.name,
        '평가 제목': (s as any).quizTitle || '-',
        '점수': (s as any).score || '-',
        '통합 여부': (s as any).passed ? '통과' : '미통과',
        '응시일': (s as any).latestDate || '-',
      }));
      const fileName = `이론평가_현황_${new Date().toISOString().split('T')[0]}.xlsx`;
      exportToExcel(fileName, dataToExport);
      toast({ title: '다운로드 시작', description: '이론 평가 현황을 엑셀 파일로 다운로드합니다.' });
      return;
    }

    const itemInfo = allItems.find(i => i.name === selectedItem);
    const dataToExport = sortedItemData.map(s => {
      const row: any = {
        '학년': s.grade,
        '반': s.classNum,
        '번호': s.studentNum,
        '이름': s.name,
        '최근 측정일': (s as any).latestDate || '-',
      };

      if (itemInfo?.isCompound) {
        row['키(cm)'] = (s as any).height || '-';
        row['몸무게(kg)'] = (s as any).weight || '-';
      }

      const recordLabel = itemInfo?.name === '체질량지수(BMI)' ? 'BMI' : '기록';
      row[recordLabel] = (s as any).value !== undefined ? `${(s as any).value}${itemInfo?.unit || ''}` : '-';
      row['등급'] = (s as any).recordGrade ? `${(s as any).recordGrade}등급` : '-';
      row['순위'] = (s as any).rank ? `${(s as any).rank}등` : '-';
      
      return row;
    });
    const fileName = `${selectedItem}_기록 현황_${new Date().toISOString().split('T')[0]}.xlsx`;
    exportToExcel(fileName, dataToExport);
    toast({
      title: '다운로드 시작',
      description: `${selectedItem} 기록을 엑셀 파일로 다운로드합니다.`,
    });
  };


  useEffect(() => {
    setClassNumFilter('all');
  }, [gradeFilter]);
  
  useEffect(() => {
    setItemClassNumFilter('all');
  }, [itemGradeFilter]);
  
  const createSortHandler = (column: string, sortState: SortDescriptor[], setSortState: (descriptor: SortDescriptor[]) => void) => () => {
    const existingSortIndex = sortState.findIndex(s => s.column === column);

    if (existingSortIndex > -1) {
        const newSortState = [...sortState];
        const currentSort = newSortState[existingSortIndex];
        if (currentSort.direction === 'ascending') {
            currentSort.direction = 'descending';
            setSortState(newSortState);
        } else {
            newSortState.splice(existingSortIndex, 1);
            setSortState(newSortState);
        }
    } else {
        const newSort = { column, direction: 'ascending' as const };
        setSortState([...sortState, newSort]);
    }
  };
  
  const getSortIndicator = (column: string, sortState: SortDescriptor[]) => {
    const sortIndex = sortState.findIndex(s => s.column === column);
    if (sortIndex === -1) return null;
    
    const sort = sortState[sortIndex];
    return (
        <span className="ml-1 text-xs font-normal">
            {sortState.length > 1 && <span className="text-muted-foreground mr-1">{sortIndex + 1}</span>}
            {sort.direction === 'ascending' ? '▲' : '▼'}
        </span>
    );
};


  return (
    <div className="w-full space-y-2">
      <Tabs defaultValue="paps" className="w-full">
        {/* 슬림 컨트롤 상단 바 */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 bg-white p-2 rounded-xl border border-slate-200/90 shadow-xs mb-2">
          <TabsList className="h-7 sm:h-8 p-0.5 bg-slate-100 border border-slate-200">
            <TabsTrigger value="paps" className="text-xs font-bold px-3 py-1">PAPS 종합</TabsTrigger>
            <TabsTrigger value="item" className="text-xs font-bold px-3 py-1">종목별 기록</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="paps" className="space-y-2">
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 bg-white p-2 rounded-xl border border-slate-200/80 shadow-xs">
            <Select value={selectedClubId} onValueChange={(v) => { setSelectedClubId(v); if(v !== 'all') { setGradeFilter('all'); setClassNumFilter('all'); } }}>
              <SelectTrigger className="w-[95px] sm:w-[130px] h-7 sm:h-8 text-[11px] sm:text-xs font-bold bg-slate-50">
                            <SelectValue placeholder="클럽 필터" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체 클럽</SelectItem>
                            {sportsClubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        <Select
                            value={gradeFilter}
                            onValueChange={(value) => {
                                setGradeFilter(value);
                                setClassNumFilter('all');
                                if(value !== 'all') setSelectedClubId('all');
                            }}
                        >
                            <SelectTrigger className="w-[68px] sm:w-[90px] h-7 sm:h-8 text-[11px] sm:text-xs">
                            <SelectValue placeholder="학년" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="all">전체 학년</SelectItem>
                            {grades.map((grade) => (
                                <SelectItem key={grade} value={grade}>
                                {grade}학년
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={classNumFilter}
                            onValueChange={setClassNumFilter}
                            disabled={gradeFilter === 'all'}
                        >
                            <SelectTrigger className="w-[58px] sm:w-[80px] h-7 sm:h-8 text-[11px] sm:text-xs">
                            <SelectValue placeholder="반" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="all">전체 반</SelectItem>
                            {classNumsByGrade[gradeFilter]?.map((classNum) => (
                                <SelectItem key={classNum} value={classNum}>
                                {classNum}반
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-[100px] sm:w-[150px] h-7 sm:h-8 px-2 text-[11px] sm:text-xs justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-1 h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="truncate">{dateFilter === 'latest' ? '최근' : dateFilter ? format(dateFilter, "MM/dd") : '날짜'}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="flex w-auto flex-col space-y-2 p-2">
                                <Select onValueChange={(value) => value === 'latest' ? setDateFilter('latest') : setDateFilter(new Date(value))}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="측정일 선택" />
                                    </SelectTrigger>
                                    <SelectContent position="popper">
                                        <SelectItem value="latest">최근 측정일 기준</SelectItem>
                                        {availableDates.map(date => (
                                            <SelectItem key={date} value={date}>{date}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="rounded-md border">
                                    <Calendar mode="single" selected={dateFilter === 'latest' ? undefined : dateFilter} onSelect={(d) => setDateFilter(d)} />
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Select value={viewType} onValueChange={(v) => setViewType(v as ViewType)}>
                            <SelectTrigger className="w-[75px] sm:w-[110px] h-7 sm:h-8 text-[11px] sm:text-xs">
                                <SelectValue placeholder="형식" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="grade">등급</SelectItem>
                                <SelectItem value="score">점수</SelectItem>
                                <SelectItem value="record">실제 기록</SelectItem>
                            </SelectContent>
                        </Select>
                        
                        <Button onClick={handlePapsDownloadExcel} variant="outline" size="sm" className="ml-auto h-7 sm:h-8 px-2 text-xs" title="엑셀 다운로드">
                            <FileDown className="h-3.5 w-3.5 sm:mr-1.5" />
                            <span className="hidden sm:inline">엑셀 다운로드</span>
                        </Button>
                    </div>
                     <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                            <TableRow className="h-8">
                                {finalFactorOrder.map(key => {
                                    const columnKey = key.replace(/점수|등급/g, '');
                                    const isNarrow = ['학년', '반', '번호', '성별'].includes(columnKey);
                                    return (
                                        <TableHead 
                                            key={key} 
                                            onClick={createSortHandler(columnKey, papsSort, setPapsSort)} 
                                            className={cn(
                                                "cursor-pointer hover:bg-muted whitespace-nowrap p-1 text-[11px] sm:text-xs font-bold",
                                                isNarrow ? "w-8 sm:w-10 text-center" : columnKey === '이름' ? "min-w-[50px] text-left" : "text-center min-w-[55px] sm:min-w-[70px]"
                                            )}
                                        >
                                            {key}
                                            {getSortIndicator(columnKey, papsSort)}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {sortedPapsData.length > 0 ? (
                                sortedPapsData.map((row, index) => (
                                <TableRow key={index} className="h-9 sm:h-10">
                                    {finalFactorOrder.map((key, cellIndex) => {
                                    const displayKey = key.replace(/점수|등급/g, '');
                                    const isNarrow = ['학년', '반', '번호', '성별'].includes(displayKey);
                                    const isName = displayKey === '이름';
                                    return (
                                        <TableCell 
                                            key={cellIndex} 
                                            className={cn(
                                                "whitespace-nowrap p-1 text-[11px] sm:text-xs",
                                                isNarrow ? "text-center" : isName ? "font-bold text-left" : "text-center font-medium"
                                            )}
                                        >
                                            {row[displayKey]}
                                        </TableCell>
                                    )
                                    })}
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                <TableCell colSpan={finalFactorOrder.length} className="h-20 text-center text-xs text-muted-foreground">
                                    선택된 조건에 해당하는 기록이 없습니다.
                                </TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
                <TabsContent value="item" className="space-y-2 sm:space-y-4">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pt-2">
                       <Select value={selectedItem} onValueChange={setSelectedItem}>
                          <SelectTrigger className="w-[120px] sm:w-[160px] h-7 sm:h-8 text-[11px] sm:text-xs font-semibold">
                            <SelectValue placeholder="종목 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="theory-exam" className="font-bold text-primary flex items-center">
                                <BookOpen className="h-3.5 w-3.5 mr-1.5" /> 이론 평가
                            </SelectItem>
                            {itemsWithRecords.map((item) => (
                              <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                            ))}
                          </SelectContent>
                       </Select>
                        <Select value={selectedClubId} onValueChange={(v) => { setSelectedClubId(v); if(v !== 'all') { setItemGradeFilter('all'); setItemClassNumFilter('all'); } }}>
                          <SelectTrigger className="w-[95px] sm:w-[130px] h-7 sm:h-8 text-[11px] sm:text-xs font-bold">
                            <SelectValue placeholder="클럽 필터" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체 클럽</SelectItem>
                            {sportsClubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        <Select value={itemGradeFilter} onValueChange={(value) => {setItemGradeFilter(value); setItemClassNumFilter('all'); if(value !== 'all') setSelectedClubId('all');}}>
                            <SelectTrigger className="w-[68px] sm:w-[90px] h-7 sm:h-8 text-[11px] sm:text-xs">
                                <SelectValue placeholder="학년" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">전체 학년</SelectItem>
                                {grades.map((grade) => (
                                <SelectItem key={grade} value={grade}>{grade}학년</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={itemClassNumFilter}
                            onValueChange={setItemClassNumFilter}
                            disabled={itemGradeFilter === 'all'}
                        >
                            <SelectTrigger className="w-[58px] sm:w-[80px] h-7 sm:h-8 text-[11px] sm:text-xs">
                            <SelectValue placeholder="반" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="all">전체 반</SelectItem>
                            {classNumsByGrade[itemGradeFilter]?.map((classNum) => (
                                <SelectItem key={classNum} value={classNum}>
                                {classNum}반
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleItemDownloadExcel} variant="outline" size="sm" className="ml-auto h-7 sm:h-8 px-2 text-xs" disabled={!selectedItem} title="엑셀 다운로드">
                            <FileDown className="h-3.5 w-3.5 sm:mr-1.5" />
                            <span className="hidden sm:inline">엑셀 다운로드</span>
                        </Button>
                    </div>
                    <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="h-8">
                                    {[
                                      { key: 'grade', label: '학년', isNarrow: true },
                                      { key: 'classNum', label: '반', isNarrow: true },
                                      { key: 'studentNum', label: '번호', isNarrow: true },
                                      { key: 'name', label: '이름', isName: true },
                                      ...(selectedItem === 'theory-exam' ? [
                                        { key: 'quizTitle', label: '평가 제목' },
                                        { key: 'score', label: '점수' },
                                        { key: 'latestDate', label: '응시일' },
                                        { key: 'passed', label: '통과' }
                                      ] : [
                                        { key: 'latestDate', label: '측정일' },
                                        ...(selectedItemInfo?.isCompound ? [
                                          { key: 'height', label: '키' },
                                          { key: 'weight', label: '몸무게' }
                                        ] : []),
                                        { key: 'value', label: '기록' },
                                        { key: 'recordGrade', label: '등급' },
                                        { key: 'rank', label: '순위' },
                                      ])
                                    ].map((header) => (
                                       <TableHead 
                                          key={header.key} 
                                          onClick={createSortHandler(header.key, itemSort, setItemSort)} 
                                          className={cn(
                                              "cursor-pointer hover:bg-muted whitespace-nowrap p-1 text-[11px] sm:text-xs font-bold",
                                              header.isNarrow ? "w-8 sm:w-10 text-center" : header.isName ? "min-w-[50px] text-left" : "text-center min-w-[50px] sm:min-w-[70px]"
                                          )}
                                       >
                                          {header.label}
                                          {getSortIndicator(header.key, itemSort)}
                                       </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedItemData.length > 0 ? (
                                    sortedItemData.map((s, idx) => (
                                        <TableRow key={`${s.id}-${idx}`} className="h-9 sm:h-10">
                                            <TableCell className="p-1 text-center text-[11px] sm:text-xs">{s.grade}</TableCell>
                                            <TableCell className="p-1 text-center text-[11px] sm:text-xs">{s.classNum}</TableCell>
                                            <TableCell className="p-1 text-center text-[11px] sm:text-xs">{s.studentNum}</TableCell>
                                            <TableCell className="p-1 text-left font-bold whitespace-nowrap text-[11px] sm:text-xs">{s.name}</TableCell>
                                            {selectedItem === 'theory-exam' ? (
                                                <>
                                                    <TableCell className="p-1 max-w-[150px] truncate text-[11px] sm:text-xs">{(s as any).quizTitle}</TableCell>
                                                    <TableCell className="p-1 text-center font-semibold text-[11px] sm:text-xs">{(s as any).score}</TableCell>
                                                    <TableCell className="p-1 text-center whitespace-nowrap text-[11px] sm:text-xs">{(s as any).latestDate || '-'}</TableCell>
                                                    <TableCell className="p-1 text-center">
                                                        {(s as any).passed !== undefined ? (
                                                            (s as any).passed ? 
                                                                <Badge className="bg-green-100 text-green-700 text-[10px] px-1 py-0">통과</Badge> : 
                                                                <Badge variant="destructive" className="text-[10px] px-1 py-0">미통과</Badge>
                                                        ) : '-'}
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <>
                                                    <TableCell className="p-1 text-center whitespace-nowrap text-[11px] sm:text-xs">{(s as any).latestDate || '-'}</TableCell>
                                                    {allItems.find(i => i.name === selectedItem)?.isCompound && (
                                                      <>
                                                        <TableCell className="p-1 text-center text-[11px] sm:text-xs">{(s as any).height || '-'}</TableCell>
                                                        <TableCell className="p-1 text-center text-[11px] sm:text-xs">{(s as any).weight || '-'}</TableCell>
                                                      </>
                                                    )}
                                                    <TableCell className="p-1 text-center font-bold whitespace-nowrap text-[11px] sm:text-xs">{(s as any).value !== undefined && (s as any).value !== null ? `${(s as any).value}${allItems.find(i => i.name === selectedItem)?.unit || ''}`: '-'}</TableCell>
                                                    <TableCell className="p-1 text-center whitespace-nowrap text-[11px] sm:text-xs">{(s as any).recordGrade ? `${(s as any).recordGrade}등급` : '-'}</TableCell>
                                                    <TableCell className="p-1 text-center whitespace-nowrap text-[11px] sm:text-xs">{(s as any).rank ? `${(s as any).rank}/${(s as any).totalRanked}` : '-'}</TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-20 text-center text-xs text-muted-foreground">
                                            조회할 종목을 선택해주세요.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>
    </div>
  );
}
