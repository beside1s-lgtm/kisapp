'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { addOrUpdateRecord, addOrUpdateRecords } from '@/lib/services/peService';
import { Student, MeasurementItem, MeasurementRecord, TeamGroup, SportsClub } from '@/lib/pe/types';
import { exportToExcel } from '@/lib/services/peService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Youtube,
  Eye,
  EyeOff,
  ClipboardList,
  Loader2,
  Calculator,
  Save,
  Search,
  Calendar as CalendarIcon,
  X,
  Download,
  CheckCircle2,
  Play,
  Maximize2,
  Sparkles,
  Award,
  Layers,
  LayoutGrid,
  TrendingUp,
  Users,
  Check,
  Clock,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { papsGradeStandards } from '@/lib/pe/paps';

interface RecordInputProps {
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
  onRecordUpdate: (records: MeasurementRecord[] | string, action: 'update' | 'delete') => void;
  allTeamGroups: TeamGroup[];
  sportsClubs: SportsClub[];
}

const calculateBmi = (height?: string, weight?: string) => {
  const h = parseFloat(height || '');
  const w = parseFloat(weight || '');
  if (!isNaN(h) && !isNaN(w) && h > 0 && w > 0) {
    const hMeter = h / 100;
    return (w / (hMeter * hMeter)).toFixed(2);
  }
  return '';
};

// PAPS 표준 공식 측정 영상 Fallback 링크 맵
const PAPS_VIDEO_MAP: Record<string, string> = {
  '왕복오래달리기': 'https://www.youtube.com/watch?v=kY1w6m3Q_L0',
  '50m 달리기': 'https://www.youtube.com/watch?v=Gk3_Z8v1WqA',
  '윗몸 말아올리기': 'https://www.youtube.com/watch?v=n5LwW0Q3B_c',
  '앉아윗몸앞으로굽히기': 'https://www.youtube.com/watch?v=w9_t2H8b_aU',
  '제자리 멀리뛰기': 'https://www.youtube.com/watch?v=A3_k9L1yI00',
  '체질량지수(BMI)': 'https://www.youtube.com/watch?v=n_Q3_Z8v1W0',
  '팔굽혀펴기': 'https://www.youtube.com/watch?v=n5LwW0Q3B_c',
  '무릎 대고 팔굽혀펴기': 'https://www.youtube.com/watch?v=n5LwW0Q3B_c',
  '오래달리기-걷기': 'https://www.youtube.com/watch?v=kY1w6m3Q_L0',
  '스텝검사': 'https://www.youtube.com/watch?v=kY1w6m3Q_L0',
  '악력': 'https://www.youtube.com/watch?v=n5LwW0Q3B_c',
};

export default function RecordInput({
  allStudents,
  allItems,
  allRecords,
  onRecordUpdate,
  allTeamGroups,
  sportsClubs
}: RecordInputProps) {
  const { user } = useAuth();
  const school = 'KISH';
  const { toast } = useToast();

  const activeItems = useMemo(() => {
    const valid = allItems.filter(item => !item.isArchived && !item.isDeactivated);
    const weekItems = valid.filter(item => item.isMeasurementWeek);
    return weekItems.length > 0 ? weekItems : valid;
  }, [allItems]);

  const { grades, classNumsByGrade } = useMemo(() => {
    const gradesList = [...new Set(allStudents.map(s => String(s.grade || '')).filter(Boolean))].sort((a, b) => parseInt(a) - parseInt(b));
    const classMap: Record<string, string[]> = {};
    gradesList.forEach(grade => {
      classMap[grade] = [...new Set(allStudents.filter(s => String(s.grade) === String(grade)).map(s => String(s.classNum || '')).filter(Boolean))].sort((a, b) => parseInt(a) - parseInt(b));
    });
    return { grades: gradesList, classNumsByGrade: classMap };
  }, [allStudents]);

  const [activeTab, setActiveTab] = useState<'batch' | 'individual'>('batch');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedItemName, setSelectedItemName] = useState('');
  const [recordValue, setRecordValue] = useState('');
  const [recordDate, setRecordDate] = useState<Date | undefined>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClassNum, setSelectedClassNum] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [batchRecordItem, setBatchRecordItem] = useState('');
  const [batchRecordDate, setBatchRecordDate] = useState<Date | undefined>(new Date());
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);

  // 우측 패널 뷰 모드 ('all' | 'standards' | 'video')
  const [rightPanelViewMode, setRightPanelViewMode] = useState<'all' | 'standards' | 'video'>('all');

  const [batchRecords, setBatchRecords] = useState<{ [studentId: string]: { value?: string; height?: string; weight?: string } }>({});
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // 검색 다이얼로그 상태
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false);
  const [foundStudents, setFoundStudents] = useState<Student[]>([]);

  // 초기값 자동 설정
  useEffect(() => {
    if (grades.length > 0 && !selectedGrade && !selectedGroupId) {
      setSelectedGrade(grades[0]);
    }
  }, [grades, selectedGrade, selectedGroupId]);

  useEffect(() => {
    if (activeItems.length > 0 && !batchRecordItem) {
      setBatchRecordItem(activeItems[0].name);
    }
  }, [activeItems, batchRecordItem]);

  const selectedItemForBatch = useMemo(() => {
    return allItems.find(i => i.name === batchRecordItem);
  }, [allItems, batchRecordItem]);

  const selectedItemForSingle = useMemo(() => {
    return allItems.find(i => i.name === selectedItemName);
  }, [allItems, selectedItemName]);

  // 해당 종목의 영상 URL (Firestore 등록값 우선, 없을 시 표준 PAPS 영상 Fallback)
  const currentVideoUrl = useMemo(() => {
    if (selectedItemForBatch?.videoUrl) return selectedItemForBatch.videoUrl;
    return PAPS_VIDEO_MAP[batchRecordItem] || null;
  }, [selectedItemForBatch, batchRecordItem]);

  // 대상 학생 필터링
  const studentsForBatch = useMemo(() => {
    if (selectedGroupId) {
      const group = allTeamGroups.find(g => g.id === selectedGroupId);
      if (group) {
        const memberIds = new Set(group.teams?.flatMap(t => t.memberIds || []) || []);
        return allStudents.filter(s => memberIds.has(s.id));
      }
      const club = sportsClubs.find(c => c.id === selectedGroupId);
      if (club) {
        const memberIds = new Set(club.memberIds || []);
        return allStudents.filter(s => memberIds.has(s.id));
      }
      return [];
    }

    if (!selectedGrade) return [];

    let filtered = allStudents.filter(s => String(s.grade) === String(selectedGrade));
    if (selectedClassNum !== 'all') {
      filtered = filtered.filter(s => String(s.classNum) === String(selectedClassNum));
    }

    return filtered.sort((a, b) => {
      const classDiff = (parseInt(a.classNum || '0') || 0) - (parseInt(b.classNum || '0') || 0);
      if (classDiff !== 0) return classDiff;
      return (parseInt(a.studentNum || '0') || 0) - (parseInt(b.studentNum || '0') || 0);
    });
  }, [allStudents, selectedGrade, selectedClassNum, selectedGroupId, allTeamGroups, sportsClubs]);

  // 이전 기록 가져오기 헬퍼 (단순 조회용)
  const getPreviousRecord = (studentId: string, itemName: string) => {
    const studentRecords = allRecords.filter(r => r.studentId === studentId && (r.item === itemName || (r as any).itemId === selectedItemForBatch?.id));
    if (studentRecords.length === 0) return null;
    return studentRecords.sort((a, b) => b.date.localeCompare(a.date))[0];
  };

  // 선택한 측정 일자 문자열
  const selectedDateStr = useMemo(() => {
    return batchRecordDate ? format(batchRecordDate, 'yyyy-MM-dd') : '';
  }, [batchRecordDate]);

  // 금일(선택일) 측정 진행률 실시간 집계 로직 (이전 기록은 제외하고, 선택한 날짜에 입력/저장된 건만 집계)
  const { totalStudentsCount, measuredCount, unmeasuredCount, progressPercent } = useMemo(() => {
    const total = studentsForBatch.length;
    if (total === 0) return { totalStudentsCount: 0, measuredCount: 0, unmeasuredCount: 0, progressPercent: 0 };

    let measured = 0;
    studentsForBatch.forEach(s => {
      const currentInput = batchRecords[s.id];
      const isSavedNow = savedIds.has(s.id);
      const hasCurrentInput = Boolean(
        selectedItemForBatch?.isCompound
          ? currentInput?.height && currentInput?.weight
          : currentInput?.value && currentInput.value.trim() !== ''
      );

      // 선택한 특정 일자에 이미 DB에 등록된 기록이 있는지 확인
      const hasRecordOnSelectedDate = allRecords.some(r =>
        r.studentId === s.id &&
        (r.item === batchRecordItem || (r as any).itemId === selectedItemForBatch?.id) &&
        r.date === selectedDateStr
      );

      if (isSavedNow || hasCurrentInput || hasRecordOnSelectedDate) {
        measured++;
      }
    });

    const percent = Math.round((measured / total) * 100);
    return {
      totalStudentsCount: total,
      measuredCount: measured,
      unmeasuredCount: total - measured,
      progressPercent: percent
    };
  }, [studentsForBatch, batchRecords, savedIds, batchRecordItem, selectedItemForBatch, allRecords, selectedDateStr]);

  // 개별 저장
  const handleIndividualSave = async (studentId: string) => {
    if (!batchRecordItem || !batchRecordDate) return;
    const current = batchRecords[studentId];
    if (!current && !selectedItemForBatch?.isCompound) return;

    setSavingId(studentId);
    try {
      let val = 0;
      let heightVal: number | undefined;
      let weightVal: number | undefined;

      if (selectedItemForBatch?.isCompound) {
        heightVal = parseFloat(current?.height || '');
        weightVal = parseFloat(current?.weight || '');
        const bmi = calculateBmi(current?.height, current?.weight);
        val = parseFloat(bmi);
      } else {
        val = parseFloat(current?.value || '');
      }

      if (isNaN(val)) {
        toast({ variant: 'destructive', title: '입력 오류', description: '올바른 숫자 값을 입력해주세요.' });
        return;
      }

      const rec = await addOrUpdateRecord({
        studentId,
        school,
        item: batchRecordItem,
        date: format(batchRecordDate, 'yyyy-MM-dd'),
        value: val,
        height: heightVal,
        weight: weightVal,
      });

      onRecordUpdate([rec], 'update');
      setSavedIds(prev => new Set(prev).add(studentId));
      toast({ title: '저장 완료' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '저장 실패', description: e.message });
    } finally {
      setSavingId(null);
    }
  };

  // 일괄 전체 저장
  const handleSaveBatchRecords = async () => {
    if (!batchRecordItem || !batchRecordDate) return;
    const dateStr = format(batchRecordDate, 'yyyy-MM-dd');

    const toSave: any[] = [];
    studentsForBatch.forEach(s => {
      const current = batchRecords[s.id];
      if (!current) return;

      if (selectedItemForBatch?.isCompound) {
        if (current.height && current.weight) {
          const h = parseFloat(current.height);
          const w = parseFloat(current.weight);
          const bmi = parseFloat(calculateBmi(current.height, current.weight));
          if (!isNaN(bmi)) {
            toSave.push({
              studentId: s.id,
              school,
              item: batchRecordItem,
              date: dateStr,
              value: bmi,
              height: h,
              weight: w,
            });
          }
        }
      } else if (current.value) {
        const v = parseFloat(current.value);
        if (!isNaN(v)) {
          toSave.push({
            studentId: s.id,
            school,
            item: batchRecordItem,
            date: dateStr,
            value: v,
          });
        }
      }
    });

    if (toSave.length === 0) {
      toast({ variant: 'destructive', title: '저장할 데이터가 없습니다.' });
      return;
    }

    setIsBatchSubmitting(true);
    try {
      const updated = await addOrUpdateRecords(toSave);
      onRecordUpdate(updated, 'update');
      setSavedIds(new Set(toSave.map(r => r.studentId)));
      toast({ title: `총 ${toSave.length}명의 기록 일괄 저장 완료` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '일괄 저장 실패', description: e.message });
    } finally {
      setIsBatchSubmitting(false);
    }
  };

  // 템플릿 다운로드
  const handleDownloadTemplate = () => {
    if (studentsForBatch.length === 0) {
      toast({ variant: 'destructive', title: '다운로드 실패', description: '먼저 학년/반 또는 그룹을 선택해주세요.' });
      return;
    }
    if (!batchRecordItem) {
      toast({ variant: 'destructive', title: '다운로드 실패', description: '측정 종목을 선택해주세요.' });
      return;
    }

    const templateData = studentsForBatch.map(s => ({
      '학년': s.grade,
      '반': s.classNum,
      '번호': s.studentNum,
      '이름': s.name,
      [batchRecordItem]: '',
      '비고': ''
    }));

    const filename = `${selectedGrade ? `${selectedGrade}학년_${selectedClassNum}반` : '그룹'}_${batchRecordItem}_입력템플릿`;
    exportToExcel(filename, templateData);
    toast({ title: '템플릿 다운로드 완료' });
  };

  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  // 등급 기준 범위 렌더링
  const renderGradeRanges = (gender: 'male' | 'female') => {
    const gradeToUse = selectedGrade || (studentsForBatch[0]?.grade || '5');
    const itemKey = batchRecordItem === '무릎 대고 팔굽혀펴기' ? '팔굽혀펴기' : batchRecordItem;
    const itemStandards = papsGradeStandards[gradeToUse]?.[itemKey];
    if (!itemStandards) {
      return (
        <td colSpan={5} className="text-center text-slate-400 py-3 text-xs">
          등급 기준 데이터가 없습니다.
        </td>
      );
    }
    const ranges = itemStandards[gender];
    const unit = selectedItemForBatch?.unit || '';
    return [1, 2, 3, 4, 5].map(g => {
      const r = ranges.find(range => range.grade === g);
      if (!r) return <td key={g} className="text-center py-2 text-xs font-bold text-slate-400">-</td>;
      const text = r.max === Infinity
        ? `${r.min}${unit} ↑`
        : (r.min === -Infinity || r.min === 0)
        ? `${r.max}${unit} ↓`
        : `${r.min} ~ ${r.max}${unit}`;
      return (
        <td key={g} className="text-center py-2.5 px-1.5 text-xs sm:text-sm font-bold text-slate-800 break-keep">
          {text}
        </td>
      );
    });
  };

  return (
    <div className="space-y-3">
      {/* 1. 상단 컨트롤 바 (필터, 날짜, 종목, 전체 저장, 진행률 요약 - 직선 접기 지원) */}
      {isToolbarCollapsed ? (
        /* 접힘 상태: 얇은 직선 구분선 + 우측 아래 살짝 돌출된 수직 4mm 역세모(▼) 탭 */
        <div className="relative w-full pt-1 pb-2 group">
          <div className="h-[1.5px] w-full bg-slate-200 group-hover:bg-indigo-300 transition-colors rounded-full" />
          <button
            type="button"
            onClick={() => setIsToolbarCollapsed(false)}
            title="필터 툴바 펼치기 (클릭)"
            className="absolute top-[3px] right-16 w-7 h-4 bg-white border border-slate-300 border-t-0 rounded-b-md shadow-2xs flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer z-10"
          >
            <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      ) : (
        /* 펼침 상태: 전체 컨트롤 바 */
        <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs transition-all flex flex-wrap items-center justify-between gap-2">
            {/* 좌측 모드 스위치 & 진행률 요약 */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('batch')}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-md transition-all",
                    activeTab === 'batch' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  학급/팀별 기록
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('individual')}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-md transition-all",
                    activeTab === 'individual' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  개별 기록
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-xs">
                <span className="text-slate-500 font-medium">진행:</span>
                <span className="text-indigo-600 font-extrabold">{measuredCount} / {totalStudentsCount}명</span>
                <span className="font-bold text-slate-700">({progressPercent}%)</span>
              </div>
            </div>

            {/* 우측 필터 컨트롤 */}
            {activeTab === 'batch' ? (
              <div className="flex flex-wrap items-center gap-1.5 justify-end">
                <Select value={selectedGrade} onValueChange={v => { setSelectedGrade(v); setSelectedClassNum('all'); setSelectedGroupId(''); }}>
                  <SelectTrigger className="w-[85px] sm:w-[95px] h-8 text-xs bg-slate-50 font-bold border-slate-300">
                    <SelectValue placeholder="학년" />
                  </SelectTrigger>
                  <SelectContent>{grades.map(g => <SelectItem key={g} value={g} className="text-xs font-bold">{g}학년</SelectItem>)}</SelectContent>
                </Select>

                <Select value={selectedClassNum} onValueChange={setSelectedClassNum} disabled={!selectedGrade}>
                  <SelectTrigger className="w-[75px] sm:w-[85px] h-8 text-xs bg-slate-50 font-bold border-slate-300">
                    <SelectValue placeholder="반" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs font-bold">전체</SelectItem>
                    {classNumsByGrade[selectedGrade]?.map(c => <SelectItem key={c} value={c} className="text-xs font-bold">{c}반</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={selectedGroupId} onValueChange={v => { setSelectedGroupId(v); setSelectedGrade(''); }}>
                  <SelectTrigger className="w-[110px] sm:w-[125px] h-8 text-xs bg-slate-50 font-medium border-slate-300">
                    <SelectValue placeholder="그룹 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTeamGroups.concat(sportsClubs as any).map((g: any) => (
                      <SelectItem key={g.id} value={g.id} className="text-xs">{g.description || g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 px-2 text-xs justify-start w-[88px] sm:w-[95px] bg-slate-50 font-medium border-slate-300">
                      <CalendarIcon className="mr-1 h-3.5 w-3.5 text-slate-400" />
                      {batchRecordDate ? format(batchRecordDate, "MM/dd") : "날짜"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={batchRecordDate} onSelect={setBatchRecordDate} initialFocus />
                  </PopoverContent>
                </Popover>

                <Select value={batchRecordItem} onValueChange={setBatchRecordItem}>
                  <SelectTrigger className="w-[140px] sm:w-[170px] h-8 text-xs font-bold text-indigo-950 bg-indigo-50/60 border-indigo-200">
                    <SelectValue placeholder="종목 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeItems.map(i => <SelectItem key={i.id} value={i.name} className="text-xs font-bold">{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} disabled={studentsForBatch.length === 0} title="엑셀 템플릿 다운로드" className="h-8 px-2 border-slate-300">
                  <Download className="h-3.5 w-3.5 text-slate-600" />
                </Button>

                <Button
                  size="sm"
                  onClick={handleSaveBatchRecords}
                  disabled={isBatchSubmitting || studentsForBatch.length === 0}
                  className="font-bold h-8 text-xs px-3 bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs"
                >
                  {isBatchSubmitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  전체 저장
                </Button>

                {/* 툴바 숨기기 (접기) 버튼 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsToolbarCollapsed(true)}
                  className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 shrink-0"
                  title="필터 툴바 접기 (화면 세로 공간 확보)"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
              </div>
            ) : null}
          </div>
        )}

      {/* 2. 대화면 그리드 레이아웃: 좌측 컴팩트 테이블 (약 42%) vs 우측 대형 패널 (약 58%) */}
      {activeTab === 'batch' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* =========================================================================
              좌측 패널: 학생 정보 옆 빈 공간 절반 축소 + 상단 헤더 고정 (lg:col-span-5)
             ========================================================================= */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className={cn(
              "overflow-y-auto transition-all",
              isToolbarCollapsed ? "max-h-[calc(100vh-200px)]" : "max-h-[calc(100vh-245px)]"
            )}>
              <table className="w-full text-xs text-left border-collapse">
                {/* 상단 테이블 헤더 고정 (sticky top-0) */}
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-700 font-bold border-b border-slate-200">
                  <tr className="h-9">
                    <th className="w-12 text-center p-1">사진</th>
                    <th className="p-1 pl-2 w-[115px] sm:w-[130px] whitespace-nowrap">학생 정보</th>
                    <th className="w-16 text-center p-1 text-blue-700 whitespace-nowrap font-extrabold">이전 기록</th>
                    {selectedItemForBatch?.isCompound ? (
                      <>
                        <th className="w-14 text-center p-1">키(cm)</th>
                        <th className="w-14 text-center p-1">몸무게</th>
                        <th className="w-12 text-center p-1">BMI</th>
                      </>
                    ) : (
                      <th className="w-20 text-center p-1 whitespace-nowrap">
                        현재 기록{selectedItemForBatch?.unit ? `(${selectedItemForBatch.unit})` : ''}
                      </th>
                    )}
                    <th className="w-12 text-center p-1">저장</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentsForBatch.map(s => {
                    const prev = getPreviousRecord(s.id, batchRecordItem);
                    const current = batchRecords[s.id] || {};
                    const isSaved = savedIds.has(s.id);
                    const isMale = s.gender === '남';

                    return (
                      <tr key={s.id} className={cn("hover:bg-slate-50/80 transition-colors h-14", isSaved && "bg-emerald-50/50")}>
                        {/* 1. 사진 */}
                        <td className="p-1 text-center">
                          <Avatar className="w-10 h-10 sm:w-11 sm:h-11 mx-auto rounded-lg shadow-2xs border border-slate-200">
                            <AvatarImage src={s.photoUrl} className="object-cover" />
                            <AvatarFallback className="text-xs font-black bg-slate-100 text-slate-700">
                              {s.name ? s.name[0] : '학'}
                            </AvatarFallback>
                          </Avatar>
                        </td>

                        {/* 2. 학생 정보: 가로 폭을 컴팩트하게 정렬 (이름 + 성별 뱃지 + 학년-반-번호) */}
                        <td className="p-1 pl-2 w-[115px] sm:w-[130px]">
                          <div className="flex items-center gap-1">
                            <span className="font-black text-xs sm:text-sm text-slate-900 leading-tight truncate">
                              {s.name}
                            </span>
                            <span className={cn(
                              "text-[9px] font-bold px-1 py-0.2 rounded-full shrink-0",
                              isMale ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"
                            )}>
                              {s.gender || '남'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5 truncate">
                            {s.grade}-{s.classNum} {s.studentNum}번
                          </p>
                        </td>

                        {/* 3. 이전 기록 */}
                        <td className="p-1 text-center">
                          {prev ? (
                            <div>
                              <span className="font-black text-xs sm:text-sm text-blue-600">
                                {prev.value}{selectedItemForBatch?.unit || ''}
                              </span>
                              <p className="text-[9px] text-slate-400 font-mono">
                                {prev.date ? prev.date.substring(5) : ''}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-bold text-xs">-</span>
                          )}
                        </td>

                        {/* 4. 현재 기록 입력 */}
                        {selectedItemForBatch?.isCompound ? (
                          <>
                            <td className="p-1">
                              <Input
                                type="number"
                                placeholder="키"
                                value={current.height || ''}
                                onChange={e => setBatchRecords({ ...batchRecords, [s.id]: { ...current, height: e.target.value } })}
                                className="text-center h-7 text-xs px-1"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                placeholder="체중"
                                value={current.weight || ''}
                                onChange={e => setBatchRecords({ ...batchRecords, [s.id]: { ...current, weight: e.target.value } })}
                                className="text-center h-7 text-xs px-1"
                              />
                            </td>
                            <td className="p-1 text-center font-black text-indigo-600 text-xs">
                              {calculateBmi(current.height, current.weight)}
                            </td>
                          </>
                        ) : (
                          <td className="p-1 text-center">
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={current.value || ''}
                              onChange={e => setBatchRecords({ ...batchRecords, [s.id]: { ...current, value: e.target.value } })}
                              className="text-center w-full max-w-[70px] sm:max-w-[80px] mx-auto h-7 text-xs px-1 font-bold bg-white"
                            />
                          </td>
                        )}

                        {/* 5. 저장 액션 */}
                        <td className="p-1 text-center">
                          <Button
                            variant={isSaved ? "ghost" : "outline"}
                            size="sm"
                            onClick={() => handleIndividualSave(s.id)}
                            disabled={savingId === s.id}
                            className={cn(
                              "h-7 px-1.5 text-[11px] font-bold rounded-lg border-slate-200 shadow-2xs",
                              isSaved && "text-emerald-600 bg-emerald-50 border-emerald-200"
                            )}
                          >
                            {savingId === s.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isSaved ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            <span className="ml-0.5 hidden sm:inline">{isSaved ? '완료' : '저장'}</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {!studentsForBatch.length && (
                    <tr>
                      <td colSpan={6} className="h-28 text-center text-xs text-slate-400">
                        상단 필터에서 학년/반 또는 그룹을 선택해주세요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* =========================================================================
              우측 패널: 화면 상단 고정 (sticky top-4) + 기준표 + 영상 (lg:col-span-7)
             ========================================================================= */}
          <div className="lg:col-span-7 space-y-2 sticky top-4 self-start">
            {/* 상단 뷰 스위처 바 */}
            <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black text-slate-900">
                  {batchRecordItem || '종목'} 측정 가이드 & 기준표 ({selectedGrade || studentsForBatch[0]?.grade || '5'}학년)
                </span>
              </div>

              {/* 뷰 스위처 토글 버튼들 */}
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setRightPanelViewMode('all')}
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-bold rounded-md transition-all",
                    rightPanelViewMode === 'all' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  나란히 보기
                </button>
                <button
                  type="button"
                  onClick={() => setRightPanelViewMode('standards')}
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-bold rounded-md transition-all",
                    rightPanelViewMode === 'standards' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  기준표만
                </button>
                {currentVideoUrl && (
                  <button
                    type="button"
                    onClick={() => setRightPanelViewMode('video')}
                    className={cn(
                      "px-2 py-0.5 text-[11px] font-bold rounded-md transition-all",
                      rightPanelViewMode === 'video' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    영상만
                  </button>
                )}
              </div>
            </div>

            {/* PAPS 등급 기준표 + 측정 예시 영상 2열 그리드 */}
            <div className={cn(
              "grid gap-2.5",
              rightPanelViewMode === 'all' ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
            )}>
              {/* PAPS 등급 기준표 (글씨 대폭 확대 & 가로 스크롤 제거) */}
              {(rightPanelViewMode === 'all' || rightPanelViewMode === 'standards') && selectedItemForBatch?.isPaps && (
                <Card className="border border-slate-200 shadow-2xs bg-white rounded-2xl overflow-hidden flex flex-col justify-between">
                  <CardHeader className="px-3 py-2 border-b border-slate-100 bg-slate-50/60">
                    <CardTitle className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                      {batchRecordItem} 기준표 ({selectedGrade || studentsForBatch[0]?.grade || '5'}학년)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2.5">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                          <th className="p-1.5 text-center w-12 text-xs font-bold">성별</th>
                          <th className="p-1.5 text-center text-xs font-bold text-blue-700">1등급</th>
                          <th className="p-1.5 text-center text-xs font-bold text-cyan-700">2등급</th>
                          <th className="p-1.5 text-center text-xs font-bold text-emerald-700">3등급</th>
                          <th className="p-1.5 text-center text-xs font-bold text-amber-700">4등급</th>
                          <th className="p-1.5 text-center text-xs font-bold text-rose-700">5등급</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr className="hover:bg-slate-50">
                          <td className="text-center font-black text-xs text-blue-700 py-2 bg-blue-50/50">남</td>
                          {renderGradeRanges('male')}
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="text-center font-black text-xs text-rose-700 py-2 bg-rose-50/50">여</td>
                          {renderGradeRanges('female')}
                        </tr>
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* 측정 예시 영상 (16:9 대화면 - 공식 Fallback 및 외부 시청 지원) */}
              {(rightPanelViewMode === 'all' || rightPanelViewMode === 'video') && (
                <Card className="border border-slate-200 shadow-2xs bg-white rounded-2xl overflow-hidden flex flex-col">
                  <CardHeader className="px-3 py-2 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between flex-row">
                    <CardTitle className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Youtube className="w-3.5 h-3.5 text-red-600" />
                      {batchRecordItem} 측정 예시 영상
                    </CardTitle>

                    {currentVideoUrl && (
                      <a
                        href={currentVideoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 px-1.5 py-0.5 rounded-md border border-red-200 transition-colors"
                      >
                        <span>유튜브 새 탭 열기</span>
                        <Maximize2 className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </CardHeader>
                  <CardContent className="p-1.5 flex-1 flex items-center justify-center bg-black rounded-b-xl overflow-hidden">
                    {currentVideoUrl ? (
                      <div className="aspect-video w-full">
                        <iframe
                          width="100%"
                          height="100%"
                          src={getYouTubeEmbedUrl(currentVideoUrl)!}
                          title={`${batchRecordItem} 측정 참고 영상`}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          className="rounded-lg w-full h-full"
                        />
                      </div>
                    ) : (
                      <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
                        <Youtube className="w-8 h-8 text-slate-600" />
                        <p>등록된 측정 영상이 없습니다.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* 개별 학생 상세 측정 모드 */
        <div className="w-full">
          <Card className="border border-slate-200 shadow-2xs bg-white rounded-2xl">
            <CardHeader className="p-4 border-b border-slate-100">
              <div className="flex gap-2 max-w-md">
                <Input
                  placeholder="학생 이름 검색..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const found = allStudents.filter(s => s.name.includes(searchTerm.trim()));
                      setFoundStudents(found);
                      setIsSelectionDialogOpen(true);
                    }
                  }}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const found = allStudents.filter(s => s.name.includes(searchTerm.trim()));
                    setFoundStudents(found);
                    setIsSelectionDialogOpen(true);
                  }}
                  className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Search className="mr-1 h-3.5 w-3.5" /> 검색
                </Button>
              </div>
            </CardHeader>

            {selectedStudent ? (
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <Avatar className="w-12 h-12 border border-slate-200">
                    <AvatarImage src={selectedStudent.photoUrl} />
                    <AvatarFallback className="font-bold">{selectedStudent.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-black text-base text-slate-900">{selectedStudent.name}</p>
                    <p className="text-xs text-slate-500 font-medium">{selectedStudent.grade}학년 {selectedStudent.classNum}반 ({selectedStudent.gender})</p>
                  </div>
                  <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setSelectedStudent(null)}>
                    <X className="h-3.5 w-3.5" /> 변경
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start h-8 text-xs font-medium border-slate-300">
                        <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
                        {recordDate ? format(recordDate, "yyyy-MM-dd") : "날짜"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={recordDate} onSelect={setRecordDate} initialFocus />
                    </PopoverContent>
                  </Popover>

                  <Select value={selectedItemName} onValueChange={setSelectedItemName}>
                    <SelectTrigger className="h-8 text-xs font-bold border-slate-300">
                      <SelectValue placeholder="종목 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeItems.map(i => <SelectItem key={i.id} value={i.name} className="text-xs">{i.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {selectedItemForSingle?.isCompound ? (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">키 (cm)</Label>
                      <Input
                        type="number"
                        value={batchRecords[selectedStudent.id]?.height || ''}
                        onChange={e => setBatchRecords({ ...batchRecords, [selectedStudent.id]: { ...batchRecords[selectedStudent.id], height: e.target.value } })}
                        className="text-base h-9 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">몸무게 (kg)</Label>
                      <Input
                        type="number"
                        value={batchRecords[selectedStudent.id]?.weight || ''}
                        onChange={e => setBatchRecords({ ...batchRecords, [selectedStudent.id]: { ...batchRecords[selectedStudent.id], weight: e.target.value } })}
                        className="text-base h-9 bg-white"
                      />
                    </div>
                    <div className="col-span-2 text-center pt-1">
                      <span className="text-xs font-bold text-slate-500">자동 계산된 BMI: </span>
                      <span className="text-lg font-black text-indigo-600">{calculateBmi(batchRecords[selectedStudent.id]?.height, batchRecords[selectedStudent.id]?.weight)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">기록 입력 ({selectedItemForSingle?.unit || ''})</Label>
                    <Input
                      type="number"
                      value={recordValue}
                      onChange={e => setRecordValue(e.target.value)}
                      className="text-xl py-3 font-black text-center h-12 bg-white"
                      placeholder="0.0"
                    />
                  </div>
                )}

                <Button
                  className="w-full py-4 text-base font-bold shadow-md bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={async () => {
                    if (!school || !selectedStudent || !selectedItemName || !recordDate) return;
                    setIsSubmitting(true);
                    try {
                      let val = selectedItemForSingle?.isCompound
                        ? parseFloat(calculateBmi(batchRecords[selectedStudent.id]?.height, batchRecords[selectedStudent.id]?.weight))
                        : parseFloat(recordValue);
                      if (isNaN(val)) throw new Error("Invalid value");

                      const rec = await addOrUpdateRecord({
                        studentId: selectedStudent.id,
                        school,
                        item: selectedItemName,
                        date: format(recordDate, 'yyyy-MM-dd'),
                        value: val,
                        height: selectedItemForSingle?.isCompound ? parseFloat(batchRecords[selectedStudent.id]?.height || '') : undefined,
                        weight: selectedItemForSingle?.isCompound ? parseFloat(batchRecords[selectedStudent.id]?.weight || '') : undefined
                      });
                      onRecordUpdate([rec], 'update');
                      toast({ title: "기록 저장 완료" });
                      setRecordValue('');
                    } catch (e) {
                      toast({ variant: 'destructive', title: '저장 실패' });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting || (!recordValue && !selectedItemForSingle?.isCompound)}
                >
                  {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                  기록 저장하기
                </Button>
              </CardContent>
            ) : (
              <CardContent className="text-center py-12 text-xs text-slate-400 border border-dashed rounded-xl m-4">
                학생 이름을 검색하여 선택해주세요.
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* 학생 검색 모달 */}
      <Dialog open={isSelectionDialogOpen} onOpenChange={setIsSelectionDialogOpen}>
        <DialogContent className="max-w-md p-5 rounded-2xl">
          <DialogHeader><DialogTitle className="text-base font-black">학생 선택</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
            {foundStudents.map((s) => (
              <div key={s.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={s.photoUrl} />
                    <AvatarFallback className="font-bold text-xs">{s.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-xs text-slate-900">{s.name}</p>
                    <p className="text-[10px] text-slate-500">{s.grade}학년 {s.classNum}반 {s.studentNum}번</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedStudent(s);
                    setIsSelectionDialogOpen(false);
                    setSearchTerm('');
                  }}
                  className="h-7 text-xs px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  선택
                </Button>
              </div>
            ))}
            {foundStudents.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">일치하는 학생이 없습니다.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
