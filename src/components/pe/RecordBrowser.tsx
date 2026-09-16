
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
import { FileDown, Calendar as CalendarIcon, BookOpen, Trash2, Loader2, CloudUpload, ExternalLink, HardDrive, CheckCircle2, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { exportPeToGoogleDrive, type PeArchiveExportResult } from '@/lib/services/peDriveArchiveService';
import PapsReportPrintDialog from '@/components/pe/PapsReportPrintDialog';


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

const factorOrder = ['번호', '이름', '성별', '심폐지구력', '유연성', '근력/근지구력', '순발력', '체질량지수(BMI)', '종합'];


export default function RecordBrowser({
  allStudents,
  allItems,
  allRecords,
  sportsClubs,
}: RecordBrowserProps) {
  const { toast } = useToast();
  const { user } = useAuth(); const school = 'KISH';

  const [activeTab, setActiveTab] = useState<'paps' | 'item'>('paps');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [classNumFilter, setClassNumFilter] = useState('all');
  const [selectedClubId, setSelectedClubId] = useState('all');
  const [dateFilter, setDateFilter] = useState<Date | 'latest' | undefined>('latest');
  const [viewType, setViewType] = useState<ViewType>('grade');
  
  const [papsSort, setPapsSort] = useState<SortDescriptor[]>([
    { column: '번호', direction: 'ascending'}
  ]);


  const [selectedItem, setSelectedItem] = useState('');
  const [itemGradeFilter, setItemGradeFilter] = useState('all');
  const [itemClassNumFilter, setItemClassNumFilter] = useState('all');
  const [itemDateFilter, setItemDateFilter] = useState('latest');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [itemSort, setItemSort] = useState<SortDescriptor[]>([
    { column: 'studentNum', direction: 'ascending' }
  ]);
  
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [quizAssignments, setQuizAssignments] = useState<QuizAssignment[]>([]);

  // Google Drive 체육 결과 아카이빙 상태
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [archiveMode, setArchiveMode] = useState<'grade6-graduation' | 'all-paps'>('grade6-graduation');
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<PeArchiveExportResult | null>(null);

  // PAPS 결과 통지표 인쇄 다이얼로그 상태
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);

  const handleExportToDrive = async () => {
    setIsArchiving(true);
    setArchiveResult(null);
    try {
      const res = await exportPeToGoogleDrive({
        mode: archiveMode,
        allStudents,
        allItems,
        allRecords,
        updaterEmail: user?.email || undefined
      });
      if (res.success) {
        setArchiveResult(res);
        toast({
          title: 'Google Drive 아카이빙 완료',
          description: `'06_체육 측정 결과' 폴더에 ${res.fileName}이(가) 성공적으로 저장되었습니다.`
        });
      } else {
        toast({
          variant: 'destructive',
          title: '아카이빙 실패',
          description: res.error || 'Google Drive 저장 중 오류가 발생했습니다.'
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: err.message
      });
    } finally {
      setIsArchiving(false);
    }
  };

  // Filter for items that actually have at least one record — 이름 기준 중복 제거
  const itemsWithRecords = useMemo(() => {
    const recordedItemNames = new Set(allRecords.map(r => r.item));
    const seen = new Set<string>();
    return allItems
      .filter(item => recordedItemNames.has(item.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(item => {
        if (seen.has(item.name)) return false;
        seen.add(item.name);
        return true;
      });
  }, [allItems, allRecords]);

  // 선택된 종목의 측정 날짜 목록 (최신순)
  const itemDatesForSelected = useMemo(() => {
    if (!selectedItem || selectedItem === 'theory-exam') return [];
    const dates = new Set(allRecords.filter(r => r.item === selectedItem).map(r => r.date));
    return [...dates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [selectedItem, allRecords]);

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
        <span className="hidden sm:inline-block ml-0.5 text-[10px] font-normal">
            {sortState.length > 1 && <span className="text-muted-foreground mr-0.5">{sortIndex + 1}</span>}
            {sort.direction === 'ascending' ? '▲' : '▼'}
        </span>
    );
  };


  const getDisplayHeader = (key: string) => {
    const cleanKey = key.replace(/점수|등급/g, '');
    if (cleanKey === '심폐지구력') return '심폐';
    if (cleanKey === '근력/근지구력') return '근력';
    if (cleanKey === '체질량지수(BMI)') return 'BMI';
    if (cleanKey === '종합') return viewType === 'score' ? '종합' : '등급';
    return cleanKey;
  };

  const getDisplayCellValue = (val: any, isName = false) => {
    if (val === null || val === undefined || val === '') return '-';
    const str = String(val);
    if (isName) return str;
    return str.length > 5 ? str.slice(0, 5) : str;
  };

  return (
    <div className="w-full h-full flex-1 min-h-0 flex flex-col space-y-1.5 overflow-hidden">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'paps' | 'item')} className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* 슬림 컨트롤 상단 바: 탭 버튼 + 우측 액션 버튼 3종(인쇄, 내려받기, 클라우드 저장) */}
        <div className="flex items-center justify-between gap-1.5 bg-white p-1.5 sm:p-2 rounded-xl border border-slate-200/90 shadow-xs mb-1.5 shrink-0">
          <TabsList className="h-7 sm:h-8 p-0.5 bg-slate-100 border border-slate-200 shrink-0">
            <TabsTrigger value="paps" className="text-xs font-bold px-2.5 sm:px-3 py-1">PAPS 종합</TabsTrigger>
            <TabsTrigger value="item" className="text-xs font-bold px-2.5 sm:px-3 py-1">종목별 기록</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <Button
              onClick={() => setIsPrintDialogOpen(true)}
              variant="outline"
              size="sm"
              className="h-7 sm:h-8 px-2 sm:px-2.5 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 shadow-2xs gap-1 cursor-pointer"
              title="PAPS 맞춤형 체력평가 보고서 인쇄"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">보고서 인쇄</span>
            </Button>
            <Button 
              onClick={activeTab === 'paps' ? handlePapsDownloadExcel : handleItemDownloadExcel} 
              variant="outline" 
              size="sm" 
              className="h-7 sm:h-8 px-2 text-xs" 
              disabled={activeTab === 'item' && !selectedItem}
              title="PC로 엑셀 다운로드"
            >
              <FileDown className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">엑셀 다운로드</span>
            </Button>
            <Button
              onClick={() => {
                setArchiveResult(null);
                setIsArchiveDialogOpen(true);
              }}
              size="sm"
              className="h-7 sm:h-8 px-2 sm:px-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs gap-1 cursor-pointer"
              title="Google Drive 06_체육 측정 결과 폴더로 자동 아카이빙"
            >
              <CloudUpload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Drive 아카이브</span>
            </Button>
          </div>
        </div>

        <TabsContent value="paps" className="flex-1 min-h-0 flex flex-col space-y-1.5 overflow-hidden mt-0 data-[state=inactive]:hidden">
          {/* PAPS 종합 필터: 1줄 컴팩트 배치 */}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-white p-1.5 sm:p-2 rounded-xl border border-slate-200/80 shadow-xs w-full overflow-hidden shrink-0">
            {/* 1. 클럽 */}
            <Select value={selectedClubId} onValueChange={(v) => { setSelectedClubId(v); if(v !== 'all') { setGradeFilter('all'); setClassNumFilter('all'); } }}>
              <SelectTrigger className="w-[54px] sm:w-[120px] h-7 sm:h-8 text-[11px] sm:text-xs font-bold px-1 sm:px-2 bg-slate-50 shrink-0 [&>svg]:hidden sm:[&>svg]:block">
                <span className="truncate">
                  {selectedClubId === 'all' ? '클럽' : (sportsClubs.find(c => c.id === selectedClubId)?.name.slice(0, 4) || '클럽')}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 클럽</SelectItem>
                {sportsClubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* 2. 학년 */}
            <Select
              value={gradeFilter}
              onValueChange={(value) => {
                setGradeFilter(value);
                setClassNumFilter('all');
                if(value !== 'all') setSelectedClubId('all');
              }}
            >
              <SelectTrigger className="w-[46px] sm:w-[85px] h-7 sm:h-8 text-[11px] sm:text-xs font-bold px-1 sm:px-2 shrink-0 [&>svg]:hidden sm:[&>svg]:block">
                <span className="truncate">
                  {gradeFilter === 'all' ? '학년' : `${gradeFilter}학년`}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 학년</SelectItem>
                {grades.map((grade) => (
                  <SelectItem key={grade} value={grade}>{grade}학년</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 3. 반 */}
            <Select
              value={classNumFilter}
              onValueChange={setClassNumFilter}
              disabled={gradeFilter === 'all'}
            >
              <SelectTrigger className="w-[38px] sm:w-[75px] h-7 sm:h-8 text-[11px] sm:text-xs font-bold px-1 sm:px-2 shrink-0 [&>svg]:hidden sm:[&>svg]:block">
                <span className="truncate">
                  {classNumFilter === 'all' ? '반' : `${classNumFilter}반`}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 반</SelectItem>
                {classNumsByGrade[gradeFilter]?.map((classNum) => (
                  <SelectItem key={classNum} value={classNum}>{classNum}반</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* 4. 최근 (날짜): 모바일은 아이콘만 */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-7 sm:w-auto h-7 sm:h-8 p-0 sm:px-2 text-[11px] sm:text-xs justify-center sm:justify-start font-normal shrink-0" title="측정일 필터">
                  <CalendarIcon className="h-3.5 w-3.5 shrink-0 sm:mr-1" />
                  <span className="hidden sm:inline truncate">{dateFilter === 'latest' ? '최근' : dateFilter ? format(dateFilter, "MM/dd") : '날짜'}</span>
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

            {/* 5. 등급 (형식) */}
            <Select value={viewType} onValueChange={(v) => setViewType(v as ViewType)}>
              <SelectTrigger className="w-[50px] sm:w-[90px] h-7 sm:h-8 text-[11px] sm:text-xs font-bold px-1 sm:px-2 shrink-0 [&>svg]:hidden sm:[&>svg]:block">
                <span className="truncate">
                  {viewType === 'grade' ? '등급' : viewType === 'score' ? '점수' : '기록'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grade">등급</SelectItem>
                <SelectItem value="score">점수</SelectItem>
                <SelectItem value="record">실제 기록</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* PAPS 종합 테이블: 내부 스크롤 (flex-1 min-h-0 overflow-y-auto) 및 상단 헤더 고정 */}
          <div className="flex-1 min-h-0 border rounded-xl bg-white overflow-y-auto overscroll-contain scrollbar-thin shadow-2xs">
            <Table className="w-full table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-slate-100 shadow-2xs">
                <TableRow className="h-8 bg-slate-100/90">
                  {finalFactorOrder.map(key => {
                    const columnKey = key.replace(/점수|등급/g, '');
                    const isNum = columnKey === '번호';
                    const isGender = columnKey === '성별';
                    const isName = columnKey === '이름';
                    return (
                      <TableHead 
                        key={key} 
                        onClick={createSortHandler(columnKey, papsSort, setPapsSort)} 
                        className={cn(
                          "cursor-pointer hover:bg-muted p-0.5 sm:px-1 text-[10px] sm:text-xs font-bold select-none text-center whitespace-nowrap",
                          isNum ? "w-[30px] sm:w-[50px] md:w-[60px]" : isGender ? "w-[26px] sm:w-[44px] md:w-[52px]" : isName ? "w-[52px] sm:w-[90px] md:w-[105px]" : ""
                        )}
                        title={key}
                      >
                        <span className="inline-block whitespace-nowrap">{getDisplayHeader(key)}</span>
                        {getSortIndicator(columnKey, papsSort)}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPapsData.length > 0 ? (
                  sortedPapsData.map((row, index) => (
                    <TableRow key={index} className="h-8 sm:h-9 hover:bg-slate-50/50">
                      {finalFactorOrder.map((key, cellIndex) => {
                        const displayKey = key.replace(/점수|등급/g, '');
                        const isNum = displayKey === '번호';
                        const isGender = displayKey === '성별';
                        const isName = displayKey === '이름';
                        return (
                          <TableCell 
                            key={cellIndex} 
                            className={cn(
                              "p-0.5 sm:px-1 text-[10px] sm:text-xs text-center whitespace-nowrap",
                              isName ? "font-bold truncate" : "font-medium truncate"
                            )}
                            title={String(row[displayKey] || '')}
                          >
                            {getDisplayCellValue(row[displayKey], isName)}
                          </TableCell>
                        );
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

        <TabsContent value="item" className="flex-1 min-h-0 flex flex-col space-y-1.5 overflow-hidden mt-0 data-[state=inactive]:hidden">
          {/* 종목별 기록 필터: 1줄 컴팩트 배치 */}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-white p-1.5 sm:p-2 rounded-xl border border-slate-200/80 shadow-xs w-full overflow-hidden shrink-0">
            {/* 1. 종목 선택 */}
            <Select value={selectedItem} onValueChange={(v) => { setSelectedItem(v); setItemDateFilter('latest'); }}>
              <SelectTrigger className="w-[78px] sm:w-[140px] h-7 sm:h-8 text-[11px] sm:text-xs font-semibold px-1 sm:px-2 shrink-0 [&>svg]:hidden sm:[&>svg]:block">
                <span className="truncate">
                  {selectedItem === 'theory-exam' ? '이론평가' : (selectedItem ? selectedItem.slice(0, 4) : '종목')}
                </span>
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

            {/* 2. 클럽 */}
            <Select value={selectedClubId} onValueChange={(v) => { setSelectedClubId(v); if(v !== 'all') { setItemGradeFilter('all'); setItemClassNumFilter('all'); } }}>
              <SelectTrigger className="w-[50px] sm:w-[110px] h-7 sm:h-8 text-[11px] sm:text-xs font-bold px-1 sm:px-2 shrink-0 [&>svg]:hidden sm:[&>svg]:block">
                <span className="truncate">
                  {selectedClubId === 'all' ? '클럽' : (sportsClubs.find(c => c.id === selectedClubId)?.name.slice(0, 4) || '클럽')}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 클럽</SelectItem>
                {sportsClubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* 3. 학년 */}
            <Select value={itemGradeFilter} onValueChange={(value) => {setItemGradeFilter(value); setItemClassNumFilter('all'); if(value !== 'all') setSelectedClubId('all');}}>
              <SelectTrigger className="w-[44px] sm:w-[80px] h-7 sm:h-8 text-[11px] sm:text-xs font-bold px-1 sm:px-2 shrink-0 [&>svg]:hidden sm:[&>svg]:block">
                <span className="truncate">
                  {itemGradeFilter === 'all' ? '학년' : `${itemGradeFilter}학년`}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 학년</SelectItem>
                {grades.map((grade) => (
                  <SelectItem key={grade} value={grade}>{grade}학년</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 4. 반 */}
            <Select
              value={itemClassNumFilter}
              onValueChange={setItemClassNumFilter}
              disabled={itemGradeFilter === 'all'}
            >
              <SelectTrigger className="w-[36px] sm:w-[70px] h-7 sm:h-8 text-[11px] sm:text-xs font-bold px-1 sm:px-2 shrink-0 [&>svg]:hidden sm:[&>svg]:block">
                <span className="truncate">
                  {itemClassNumFilter === 'all' ? '반' : `${itemClassNumFilter}반`}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 반</SelectItem>
                {classNumsByGrade[itemGradeFilter]?.map((classNum) => (
                  <SelectItem key={classNum} value={classNum}>{classNum}반</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 5. 날짜: 모바일은 아이콘만 */}
            {selectedItem && selectedItem !== 'theory-exam' && itemDatesForSelected.length > 0 && (
              <Select value={itemDateFilter} onValueChange={setItemDateFilter}>
                <SelectTrigger className="w-7 sm:w-auto h-7 sm:h-8 p-0 sm:px-2 text-[11px] sm:text-xs font-semibold shrink-0 justify-center sm:justify-start [&>svg]:hidden sm:[&>svg]:block" title="기록일 필터">
                  <CalendarIcon className="h-3.5 w-3.5 shrink-0 sm:mr-1" />
                  <span className="hidden sm:inline truncate">
                    {itemDateFilter === 'latest' ? '최신' : itemDateFilter}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">최신 기록</SelectItem>
                  {itemDatesForSelected.map(date => (
                    <SelectItem key={date} value={date}>{date}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 종목별 기록 테이블: 내부 스크롤 (flex-1 min-h-0 overflow-y-auto) 및 상단 헤더 고정 */}
          <div className="flex-1 min-h-0 border rounded-xl bg-white overflow-y-auto overscroll-contain scrollbar-thin shadow-2xs">
            <Table className="w-full table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-slate-100 shadow-2xs">
                <TableRow className="h-8 bg-slate-100/90">
                  {[
                    { key: 'studentNum', label: '번호', isNarrow: true },
                    { key: 'name', label: '이름', isName: true },
                    { key: 'gender', label: '성별', isGender: true },
                    ...(selectedItem === 'theory-exam' ? [
                      { key: 'quizTitle', label: '평가제목' },
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
                        "cursor-pointer hover:bg-muted p-0.5 sm:px-1 text-[11px] sm:text-xs font-bold select-none whitespace-nowrap text-center",
                        header.isNarrow ? "w-[30px] sm:w-[50px] md:w-[60px]" : 
                        header.isName ? "w-[52px] sm:w-[90px] md:w-[105px]" : 
                        header.isGender ? "w-[26px] sm:w-[44px] md:w-[52px]" : 
                        ""
                      )}
                      title={header.label}
                    >
                      <span className="truncate inline-block whitespace-nowrap">{getDisplayHeader(header.label)}</span>
                      {getSortIndicator(header.key, itemSort)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItemData.length > 0 ? (
                  sortedItemData.map((s, idx) => (
                    <TableRow key={`${s.id}-${idx}`} className="h-8 sm:h-9 hover:bg-slate-50/50">
                      <TableCell className="p-0.5 sm:px-1 text-center text-[11px] sm:text-xs whitespace-nowrap">{s.studentNum}</TableCell>
                      <TableCell className="p-0.5 sm:px-1 text-center font-bold text-[11px] sm:text-xs whitespace-nowrap truncate">{s.name}</TableCell>
                      <TableCell className="p-0.5 sm:px-1 text-center text-[11px] sm:text-xs whitespace-nowrap">{s.gender || '-'}</TableCell>
                      {selectedItem === 'theory-exam' ? (
                        <>
                          <TableCell className="p-0.5 text-center text-[11px] sm:text-xs truncate">{getDisplayCellValue((s as any).quizTitle)}</TableCell>
                          <TableCell className="p-0.5 text-center font-semibold text-[11px] sm:text-xs truncate">{getDisplayCellValue((s as any).score)}</TableCell>
                          <TableCell className="p-0.5 text-center text-[11px] sm:text-xs truncate">{getDisplayCellValue((s as any).latestDate)}</TableCell>
                          <TableCell className="p-0.5 text-center">
                            {(s as any).passed !== undefined ? (
                              (s as any).passed ? 
                                <Badge className="bg-green-100 text-green-700 text-[10px] px-1 py-0">통과</Badge> : 
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">미통과</Badge>
                            ) : '-'}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="p-0.5 text-center text-[11px] sm:text-xs truncate">{getDisplayCellValue((s as any).latestDate)}</TableCell>
                          {allItems.find(i => i.name === selectedItem)?.isCompound && (
                            <>
                              <TableCell className="p-0.5 text-center text-[11px] sm:text-xs truncate">{getDisplayCellValue((s as any).height)}</TableCell>
                              <TableCell className="p-0.5 text-center text-[11px] sm:text-xs truncate">{getDisplayCellValue((s as any).weight)}</TableCell>
                            </>
                          )}
                          <TableCell className="p-0.5 text-center font-bold text-[11px] sm:text-xs truncate">
                            {(s as any).value !== undefined && (s as any).value !== null ? getDisplayCellValue(`${(s as any).value}${allItems.find(i => i.name === selectedItem)?.unit || ''}`) : '-'}
                          </TableCell>
                          <TableCell className="p-0.5 text-center text-[11px] sm:text-xs truncate">
                            {(s as any).recordGrade ? `${(s as any).recordGrade}등급` : '-'}
                          </TableCell>
                          <TableCell className="p-0.5 text-center text-[11px] sm:text-xs truncate">
                            {(s as any).rank ? `${(s as any).rank}/${(s as any).totalRanked}` : '-'}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-20 text-center text-xs text-muted-foreground">
                      조회할 종목을 선택해주세요.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
            </Tabs>

      {/* ─── 체육 측정 결과 Google Drive 아카이빙 다이얼로그 ─── */}
      <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <DialogContent className="sm:max-w-[480px] w-[95vw] rounded-2xl p-5">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <CloudUpload className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  체육 측정 결과 Google Drive 아카이빙
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  학교 Google Drive 중앙 저장소('06_체육 측정 결과' 폴더)로 자동 전송합니다.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* 옵션 1: 6학년 졸업 사정회용 */}
            <div
              onClick={() => setArchiveMode('grade6-graduation')}
              className={cn(
                "p-3.5 rounded-xl border transition-all cursor-pointer space-y-1",
                archiveMode === 'grade6-graduation'
                  ? "bg-indigo-50/70 border-indigo-400 ring-1 ring-indigo-400"
                  : "bg-slate-50/80 border-slate-200 hover:bg-slate-100/70"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                  6학년 졸업 사정회용 체력 평가 결과표 (권장)
                </span>
                <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0">졸업 사정회</Badge>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed pl-3.5">
                6학년 학생들의 5대 체력요인(심폐, 유연성, 근력, 순발력, BMI) 측정값과 각각의 PAPS 등급, 종합 점수 및 최종 체력등급을 정리하여 졸업 사정회 제출 규격으로 자동 구성합니다.
              </p>
            </div>

            {/* 옵션 2: 전교생 PAPS 종합 결과 */}
            <div
              onClick={() => setArchiveMode('all-paps')}
              className={cn(
                "p-3.5 rounded-xl border transition-all cursor-pointer space-y-1",
                archiveMode === 'all-paps'
                  ? "bg-indigo-50/70 border-indigo-400 ring-1 ring-indigo-400"
                  : "bg-slate-50/80 border-slate-200 hover:bg-slate-100/70"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                  전교생 PAPS 종합 체육 측정 결과표
                </span>
                <Badge variant="outline" className="text-[10px] text-slate-600 px-1.5 py-0">전체 학년</Badge>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed pl-3.5">
                4~6학년 대상 전교생의 종목별 등급 및 종합 체력등급 전체 데이터를 하나의 엑셀 시트로 아카이빙합니다.
              </p>
            </div>

            {/* 성공 결과 카드 */}
            {archiveResult && archiveResult.success && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Google Drive 업로드 완료!</span>
                </div>
                <p className="text-[11px] text-emerald-700 font-mono">
                  파일명: {archiveResult.fileName}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  {archiveResult.webViewLink && (
                    <Button
                      size="sm"
                      onClick={() => window.open(archiveResult.webViewLink, '_blank')}
                      className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                    >
                      <span>Drive에서 파일 열기</span>
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  )}
                  {archiveResult.folderUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(archiveResult.folderUrl, '_blank')}
                      className="h-7 text-xs font-bold border-emerald-300 text-emerald-800 hover:bg-emerald-100 gap-1"
                    >
                      <HardDrive className="w-3 h-3" />
                      <span>06_체육 폴더 열기</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100 flex flex-row items-center justify-between sm:justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsArchiveDialogOpen(false)}
              disabled={isArchiving}
              className="text-xs font-bold text-slate-600"
            >
              닫기
            </Button>
            <Button
              size="sm"
              onClick={handleExportToDrive}
              disabled={isArchiving}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs cursor-pointer"
            >
              {isArchiving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Google Drive 업로드 중...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>지금 바로 아카이브 내보내기</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PAPS 개인별/학급별 결과 통지표 인쇄 다이얼로그 */}
      <PapsReportPrintDialog
        open={isPrintDialogOpen}
        onOpenChange={setIsPrintDialogOpen}
        allStudents={allStudents}
        allItems={allItems}
        allRecords={allRecords}
        initialGrade={gradeFilter}
        initialClassNum={classNumFilter}
      />
    </div>
  );
}
