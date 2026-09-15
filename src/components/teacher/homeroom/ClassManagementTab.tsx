'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import {
  Calendar,
  CheckCircle2,
  Clock,
  BookOpen,
  FileText,
  MessageSquare,
  BarChart3,
  Search,
  Plus,
  Trash2,
  Edit2,
  Maximize2,
  Monitor,
  Copy,
  Sparkles,
  Download,
  AlertCircle,
  Save,
  X,
  User,
  FolderOpen,
  History,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  onDailyMemoUpdate,
  saveDailyMemo,
  getDailyMemos,
  onHomeworksUpdate,
  addHomework,
  updateHomework,
  deleteHomework,
  onHomeworkChecksUpdate,
  setHomeworkCheck,
  batchSetHomeworkCheck,
  onBehaviorsUpdate,
  addBehaviorRecord,
  deleteBehaviorRecord,
  onConsultationsUpdate,
  saveConsultation,
} from '@/lib/services/homeroomClassService';
import type {
  HomeroomDailyMemo,
  HomeroomHomework,
  HomeroomHomeworkCheck,
  HomeroomBehaviorRecord,
  HomeroomConsultation,
} from '@/lib/types/homeroomClass';
import type { MasterStudent } from '@/lib/types/masterStudent';
import { HomeworkPresentationModal } from './HomeworkPresentationModal';
import { DailyMemoFullscreenModal } from './DailyMemoFullscreenModal';
import { GradeMaterialsTab } from './GradeMaterialsTab';

interface ClassManagementTabProps {
  classKey: string;
  classLabel: string;
  students: MasterStudent[];
  userEmail?: string;
}

export const ClassManagementTab: React.FC<ClassManagementTabProps> = ({
  classKey,
  classLabel,
  students,
  userEmail,
}) => {
  const { toast } = useToast();

  // 내부 탭 상태: 'memo' (일일 알림) | 'homework' (과제 확인) | 'behavior' (행동 기록) | 'review' (기록 조회/상담) | 'matrix' (월별 현황) | 'materials' (학년 자료 공유)
  const [subTab, setSubTab] = useState<'memo' | 'homework' | 'behavior' | 'review' | 'matrix' | 'materials'>('memo');

  // 1. 일일 메모 상태
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const todayDisplay = useMemo(() => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const d = new Date();
    return `${format(d, 'yyyy년 M월 d일')} (${days[d.getDay()]}요일)`;
  }, []);
  const [memoContent, setMemoContent] = useState('');
  const [isMemoFullscreenOpen, setIsMemoFullscreenOpen] = useState(false);

  // 2. 숙제 상태
  const [homeworks, setHomeworks] = useState<HomeroomHomework[]>([]);
  const [homeworkChecks, setHomeworkChecks] = useState<HomeroomHomeworkCheck[]>([]);
  const [newHwTitle, setNewHwTitle] = useState('');
  const [editingHw, setEditingHw] = useState<HomeroomHomework | null>(null);
  const [editHwTitle, setEditHwTitle] = useState('');
  const [isPresModalOpen, setIsPresModalOpen] = useState(false);
  const [presMode, setPresMode] = useState<'single' | 'all'>('single');
  const [presTargetHw, setPresTargetHw] = useState<HomeroomHomework | null>(null);

  // 3. 행동 기록 상태
  const [behaviors, setBehaviors] = useState<HomeroomBehaviorRecord[]>([]);
  const [behaviorSearch, setBehaviorSearch] = useState('');
  const [isBehaviorModalOpen, setIsBehaviorModalOpen] = useState(false);
  const [selectedStudentForBehavior, setSelectedStudentForBehavior] = useState<MasterStudent | null>(null);
  const [behaviorInput, setBehaviorInput] = useState('');

  // 4. 기록 조회 및 상담 메모 상태
  const [reviewSearch, setReviewSearch] = useState('');
  const [selectedStudentForReview, setSelectedStudentForReview] = useState<MasterStudent | null>(null);
  const [consultations, setConsultations] = useState<Record<string, HomeroomConsultation>>({});
  const [consultInput, setConsultInput] = useState('');

  // 5. 월별 숙제 매트릭스 필터
  const [matrixMonth, setMatrixMonth] = useState<string>('all');

  // ─── 실시간 데이터 구독 ──────────────────────────────────────────
  useEffect(() => {
    if (!classKey) return;

    // 1. 일일 메모 구독
    const unsubMemo = onDailyMemoUpdate(classKey, todayStr, (memo) => {
      setMemoContent(memo?.content || '');
    });

    // 2. 숙제 목록 및 체크 구독
    const unsubHw = onHomeworksUpdate(classKey, (hws) => setHomeworks(hws));
    const unsubHwChecks = onHomeworkChecksUpdate(classKey, (checks) => setHomeworkChecks(checks));

    // 3. 행동 관찰 기록 구독
    const unsubBehaviors = onBehaviorsUpdate(classKey, (recs) => setBehaviors(recs));

    // 4. 상담 메모 구독
    const unsubConsults = onConsultationsUpdate(classKey, (map) => setConsultations(map));

    return () => {
      unsubMemo();
      unsubHw();
      unsubHwChecks();
      unsubBehaviors();
      unsubConsults();
    };
  }, [classKey, todayStr]);

  // 학생별 행동기록 카운트 맵
  const behaviorCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    behaviors.forEach((b) => {
      map[b.studentId] = (map[b.studentId] || 0) + 1;
    });
    return map;
  }, [behaviors]);

  // ─── 일일 알림 메모 핸들러 ──────────────────────────────────────────
  const [isMemoHistoryOpen, setIsMemoHistoryOpen] = useState(false);
  const [memoHistoryList, setMemoHistoryList] = useState<HomeroomDailyMemo[]>([]);
  const [isLoadingMemos, setIsLoadingMemos] = useState(false);
  const [selectedHistoryMemo, setSelectedHistoryMemo] = useState<HomeroomDailyMemo | null>(null);

  const handleOpenMemoHistory = async () => {
    setIsMemoHistoryOpen(true);
    setIsLoadingMemos(true);
    try {
      const list = await getDailyMemos(classKey);
      setMemoHistoryList(list);
      if (list.length > 0) {
        setSelectedHistoryMemo(list[0]);
      } else {
        setSelectedHistoryMemo(null);
      }
    } catch (err) {
      console.error(err);
      toast({ title: '불러오기 실패', description: '알림장 내역을 가져오는 중 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setIsLoadingMemos(false);
    }
  };

  const handleApplyHistoryMemo = (memo: HomeroomDailyMemo) => {
    setMemoContent(memo.content);
    setIsMemoHistoryOpen(false);
    toast({
      title: '칠판 알림장 불러오기 완료',
      description: `${memo.date} 일자의 알림장 내용이 적용되었습니다. 필요 시 수정 후 [저장]을 누르세요.`,
    });
  };

  const handleSaveMemo = async (contentToSave?: string) => {
    const content = contentToSave !== undefined ? contentToSave : memoContent;
    try {
      await saveDailyMemo(classKey, todayStr, content, userEmail);
      toast({ title: '메모 저장 완료', description: '오늘의 학급 알림장이 안전하게 저장되었습니다.' });
    } catch (err) {
      console.error(err);
      toast({ title: '저장 실패', description: '메모 저장 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // ─── 숙제 핸들러 ──────────────────────────────────────────
  const handleAddHomework = async () => {
    if (!newHwTitle.trim()) return;
    try {
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const d = new Date();
      const dateWithDay = `${todayStr} (${days[d.getDay()]})`;
      await addHomework(classKey, newHwTitle.trim(), todayStr, dateWithDay, userEmail);
      setNewHwTitle('');
      toast({ title: '숙제 등록 완료', description: `'${newHwTitle}' 숙제가 추가되었습니다.` });
    } catch (err) {
      console.error(err);
      toast({ title: '등록 실패', description: '숙제 등록 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  const handleToggleHwCheck = async (hwId: string, studentId: string, studentName: string) => {
    const existing = homeworkChecks.find((c) => c.hwId === hwId && c.studentId === studentId);
    const newChecked = existing ? !existing.checked : true;
    try {
      await setHomeworkCheck(classKey, hwId, studentId, studentName, newChecked, todayStr);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBatchToggleHw = async (hwId: string) => {
    const hwChecks = homeworkChecks.filter((c) => c.hwId === hwId && c.checked);
    const isAllDone = students.length > 0 && students.every((s) => hwChecks.some((c) => c.studentId === (s.studentId || s.id)));
    const targetChecked = !isAllDone;

    const studentList = students.map((s) => ({
      id: s.studentId || s.id || '',
      name: s.name,
    }));

    try {
      await batchSetHomeworkCheck(classKey, hwId, studentList, targetChecked, todayStr);
      toast({
        title: targetChecked ? '전체 완료 처리' : '전체 해제 완료',
        description: `모든 학생의 숙제 상태가 ${targetChecked ? '완료' : '미완료'}로 변경되었습니다.`,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteHomework = async (hwId: string) => {
    if (!confirm('정말 이 숙제를 삭제하시겠습니까? 관련된 체크 내역도 함께 삭제됩니다.')) return;
    try {
      await deleteHomework(classKey, hwId);
      toast({ title: '숙제 삭제 완료' });
    } catch (err) {
      console.error(err);
      toast({ title: '삭제 실패', variant: 'destructive' });
    }
  };

  const handleSaveEditHw = async () => {
    if (!editingHw || !editHwTitle.trim()) return;
    try {
      await updateHomework(classKey, editingHw.id, editHwTitle.trim());
      setEditingHw(null);
      toast({ title: '숙제 수정 완료' });
    } catch (err) {
      console.error(err);
      toast({ title: '수정 실패', variant: 'destructive' });
    }
  };

  // ─── 행동 기록 핸들러 ──────────────────────────────────────────
  const handleOpenBehaviorModal = (student: MasterStudent) => {
    setSelectedStudentForBehavior(student);
    setBehaviorInput('');
    setIsBehaviorModalOpen(true);
  };

  const handleSaveBehavior = async () => {
    if (!selectedStudentForBehavior || !behaviorInput.trim()) return;
    const sid = selectedStudentForBehavior.studentId || selectedStudentForBehavior.id || '';
    try {
      await addBehaviorRecord(
        classKey,
        sid,
        selectedStudentForBehavior.name,
        selectedStudentForBehavior.studentNum || undefined,
        behaviorInput.trim(),
        todayStr,
        userEmail
      );
      setIsBehaviorModalOpen(false);
      setBehaviorInput('');
      toast({ title: '행동 관찰 기록 저장 완료', description: `${selectedStudentForBehavior.name} 학생의 관찰 기록이 저장되었습니다.` });
    } catch (err) {
      console.error(err);
      toast({ title: '기록 저장 실패', variant: 'destructive' });
    }
  };

  const handleDeleteBehavior = async (recordId: string) => {
    if (!confirm('해당 관찰 기록을 삭제하시겠습니까?')) return;
    try {
      await deleteBehaviorRecord(classKey, recordId);
      toast({ title: '기록 삭제 완료' });
    } catch (err) {
      console.error(err);
      toast({ title: '삭제 실패', variant: 'destructive' });
    }
  };

  // ─── 보호자 상담 메모 핸들러 ──────────────────────────────────────────
  const handleSelectStudentForReview = (student: MasterStudent) => {
    setSelectedStudentForReview(student);
    const sid = student.studentId || student.id || '';
    setConsultInput(consultations[sid]?.content || '');
  };

  const handleSaveConsultMemo = async () => {
    if (!selectedStudentForReview) return;
    const sid = selectedStudentForReview.studentId || selectedStudentForReview.id || '';
    try {
      await saveConsultation(classKey, sid, selectedStudentForReview.name, consultInput, userEmail);
      toast({ title: '상담 메모 저장 완료' });
    } catch (err) {
      console.error(err);
      toast({ title: '저장 실패', variant: 'destructive' });
    }
  };

  const handleCopyBehaviorRecords = (student: MasterStudent) => {
    const sid = student.studentId || student.id || '';
    const studentRecs = behaviors.filter((b) => b.studentId === sid).sort((a, b) => a.date.localeCompare(b.date));
    if (studentRecs.length === 0) {
      toast({ title: '복사할 기록 없음', description: '등록된 관찰 기록이 없습니다.' });
      return;
    }

    const lines = studentRecs.map((r) => `${r.date}: ${r.content}`).join('\n');
    const fullText = `[${student.name} 행동 관찰 기록]\n${lines}`;

    navigator.clipboard.writeText(fullText).then(() => {
      toast({ title: '클립보드 복사 완료', description: '생활기록부/상담일지에 붙여넣을 수 있습니다.' });
    });
  };

  const handleCopyAIPrompt = (student: MasterStudent) => {
    const sid = student.studentId || student.id || '';
    const studentRecs = behaviors.filter((b) => b.studentId === sid).sort((a, b) => a.date.localeCompare(b.date));
    if (studentRecs.length === 0) {
      toast({ title: '분석할 기록 없음', description: '관찰 기록이 최소 1건 이상 있어야 합니다.' });
      return;
    }

    const recordText = studentRecs.map((r) => `[${r.date}] ${r.content}`).join('\n');
    const prompt = `초등학교 학생 "${student.name}"의 행동 관찰 기록입니다:\n\n${recordText}\n\n다음을 따뜻하고 전문적인 교사의 시각으로 간결하고 명확하게 작성해주세요:\n1. 주요 행동 특성 및 태도\n2. 긍정적인 강점과 잠재력\n3. 지도 및 배려가 필요한 부분\n4. 생활기록부 '행동특성 및 종합의견' 추천 문안 (300자 내외)`;

    navigator.clipboard.writeText(prompt).then(() => {
      toast({
        title: '🤖 AI 분석용 프롬프트 복사 완료',
        description: 'Claude, ChatGPT, Gemini에 붙여넣어 생활기록부 종합의견 초안을 바로 확인하세요!',
      });
    });
  };

  // ─── 엑셀 내보내기 ──────────────────────────────────────────
  const handleExportBehaviorExcel = () => {
    const rows: (string | number)[][] = [['번호', '이름', '관찰일자', '내용']];
    behaviors
      .sort((a, b) => (Number(a.studentNum) || 0) - (Number(b.studentNum) || 0) || a.date.localeCompare(b.date))
      .forEach((r) => {
        rows.push([r.studentNum || '', r.studentName, r.date, r.content]);
      });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, '행동기록');
    XLSX.writeFile(wb, `${classLabel}_행동관찰기록_${todayStr}.xlsx`);
    toast({ title: '엑셀 다운로드 완료' });
  };

  const handleExportHomeworkExcel = () => {
    let targetHws = homeworks;
    if (matrixMonth !== 'all') {
      targetHws = targetHws.filter((h) => h.date && h.date.startsWith(matrixMonth));
    }

    if (targetHws.length === 0) {
      toast({ title: '내보낼 데이터 없음', description: '선택된 기간의 숙제가 없습니다.' });
      return;
    }

    const header = ['번호', '이름', ...targetHws.map((h) => `${h.title}(${h.date})`), '완료율(%)'];
    const rows: (string | number)[][] = [header];

    students.forEach((s) => {
      const sid = s.studentId || s.id || '';
      let doneCount = 0;
      const checkCells = targetHws.map((hw) => {
        const isDone = homeworkChecks.some((c) => c.hwId === hw.id && c.studentId === sid && c.checked);
        if (isDone) doneCount++;
        return isDone ? 'O' : 'X';
      });
      const pct = targetHws.length > 0 ? Math.round((doneCount / targetHws.length) * 100) : 0;
      rows.push([s.studentNum || '', s.name, ...checkCells, `${pct}%`]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, '숙제현황');
    XLSX.writeFile(wb, `${classLabel}_숙제제출현황_${todayStr}.xlsx`);
    toast({ title: '엑셀 다운로드 완료' });
  };

  // 숙제 개별 제출자 카운트 계산 헬퍼
  const getHwStats = (hwId: string) => {
    const doneCount = students.filter((s) => {
      const sid = s.studentId || s.id || '';
      return homeworkChecks.some((c) => c.hwId === hwId && c.studentId === sid && c.checked);
    }).length;
    const totalCount = students.length;
    const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    return { doneCount, totalCount, pct, isAllDone: totalCount > 0 && doneCount === totalCount };
  };

  return (
    <div className="space-y-6">
      {/* 상단 학급 정보 및 탭 네비게이션 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-slate-800 tracking-tight">{classLabel} 학급 교실 관리</span>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-xs">
              재적 {students.length}명
            </Badge>
          </div>
          <p className="hidden sm:block text-xs text-slate-500 mt-0.5">
            칠판 알림 메모, 과제 원터치 체크 및 전자칠판 프레젠테이션, 관찰 기록과 상담 메모를 총괄합니다.
          </p>
        </div>

        {/* 세부 5대 탭 전환 버튼 */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto">
          <Button
            variant={subTab === 'memo' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSubTab('memo')}
            className={`h-7 sm:h-8 text-xs font-bold gap-1 rounded-lg px-2 sm:px-3 ${subTab === 'memo' ? 'bg-white text-emerald-700 shadow-xs hover:bg-white' : 'text-slate-600'}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>칠판 알림</span>
          </Button>

          <Button
            variant={subTab === 'homework' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSubTab('homework')}
            className={`h-7 sm:h-8 text-xs font-bold gap-1 rounded-lg px-2 sm:px-3 ${subTab === 'homework' ? 'bg-white text-emerald-700 shadow-xs hover:bg-white' : 'text-slate-600'}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>숙제 확인</span>
            {homeworks.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded-full">
                {homeworks.length}
              </span>
            )}
          </Button>

          <Button
            variant={subTab === 'behavior' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSubTab('behavior')}
            className={`h-7 sm:h-8 text-xs font-bold gap-1 rounded-lg px-2 sm:px-3 ${subTab === 'behavior' ? 'bg-white text-emerald-700 shadow-xs hover:bg-white' : 'text-slate-600'}`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>행동 관찰</span>
            {behaviors.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-indigo-100 text-indigo-800 text-[10px] rounded-full">
                {behaviors.length}
              </span>
            )}
          </Button>

          <Button
            variant={subTab === 'review' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSubTab('review')}
            className={`h-7 sm:h-8 text-xs font-bold gap-1 rounded-lg px-2 sm:px-3 ${subTab === 'review' ? 'bg-white text-emerald-700 shadow-xs hover:bg-white' : 'text-slate-600'}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>기록·상담</span>
          </Button>

          <Button
            variant={subTab === 'matrix' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSubTab('matrix')}
            className={`h-7 sm:h-8 text-xs font-bold gap-1 rounded-lg px-2 sm:px-3 ${subTab === 'matrix' ? 'bg-white text-emerald-700 shadow-xs hover:bg-white' : 'text-slate-600'}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>월별 현황</span>
          </Button>

          <Button
            variant={subTab === 'materials' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSubTab('materials')}
            className={`h-7 sm:h-8 text-xs font-bold gap-1 rounded-lg px-2 sm:px-3 ${subTab === 'materials' ? 'bg-white text-indigo-700 shadow-xs hover:bg-white' : 'text-slate-600'}`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
            <span>자료 공유</span>
          </Button>
        </div>
      </div>

      {/* ────────────────── 1. 칠판 알림 메모 탭 ────────────────── */}
      {subTab === 'memo' && (
        <Card className="rounded-xl border-slate-200/80 shadow-xs">
          <CardHeader className="p-3 sm:p-5 pb-2.5 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                  <span>{todayDisplay} 오늘의 알림장</span>
                </CardTitle>
                <CardDescription className="hidden sm:block text-xs text-slate-500">
                  교실 빔프로젝터나 전자칠판에 띄워두는 일일 학급 공지사항입니다.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSaveMemo()}
                  className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>저장</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenMemoHistory}
                  className="h-8 text-xs font-bold border-emerald-300 text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100/80 gap-1.5 cursor-pointer shadow-xs"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
                  <span>불러오기</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsMemoFullscreenOpen(true)}
                  className="h-8 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1.5 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>전자칠판 전체화면</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <Textarea
              value={memoContent}
              onChange={(e) => setMemoContent(e.target.value)}
              placeholder="여기를 클릭하여 오늘의 알림장, 숙제, 준비물 및 전달사항을 작성하세요..."
              rows={12}
              className="text-base sm:text-lg font-bold leading-relaxed border-slate-200 focus-visible:ring-emerald-500 resize-y p-4 bg-slate-50/50"
            />
            <p className="text-xs text-slate-400 text-center">
              💡 [전자칠판 전체화면]을 누르면 TV/칠판 전용 대형 폰트 모드로 전환되어 교실 뒤에서도 선명하게 보입니다.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ────────────────── 2. 숙제 확인 탭 ────────────────── */}
      {subTab === 'homework' && (
        <div className="space-y-4">
          {/* 상단 숙제 추가 바 & 전체 미제출 보기 */}
          <Card className="rounded-2xl border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                <Input
                  value={newHwTitle}
                  onChange={(e) => setNewHwTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddHomework();
                  }}
                  placeholder="새 숙제 입력 (예: 수학익힘책 p.24~25, 일기 쓰기)"
                  className="h-10 text-xs sm:text-sm bg-white"
                />
                <Button
                  onClick={handleAddHomework}
                  className="h-10 text-xs font-bold px-4 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Plus className="w-4 h-4 mr-1" /> 추가
                </Button>
              </div>

              {homeworks.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setPresMode('all');
                    setIsPresModalOpen(true);
                  }}
                  className="h-10 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 shrink-0 gap-1.5 w-full sm:w-auto cursor-pointer"
                >
                  <Monitor className="w-4 h-4" />
                  <span>전체 미제출 칠판 띄우기</span>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 등록된 숙제 카드 목록 */}
          {homeworks.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-slate-200 p-12 text-center">
              <div className="inline-flex p-3 bg-slate-100 text-slate-400 rounded-full mb-3">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">등록된 숙제가 없습니다</h3>
              <p className="text-xs text-slate-400 mt-1">상단 입력창에 오늘의 숙제를 입력하고 [추가]를 눌러주세요.</p>
            </Card>
          ) : (
            homeworks.map((hw) => {
              const { doneCount, totalCount, pct, isAllDone } = getHwStats(hw.id);
              const doneIdSet = new Set(
                homeworkChecks
                  .filter((c) => c.hwId === hw.id && c.checked)
                  .map((c) => c.studentId)
              );
              const incompleteStudents = students.filter(
                (s) => !doneIdSet.has(s.studentId || s.id || '')
              );

              return (
                <Card key={hw.id} className="rounded-2xl border-slate-200/80 shadow-xs overflow-hidden">
                  <CardHeader className="p-4 pb-3 bg-slate-50/70 border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-slate-800">{hw.title}</span>
                          {isAllDone && (
                            <Badge className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5">
                              ✓ 전원 완료
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-medium">
                          <span>{hw.dateWithDay || hw.date}</span>
                          <span>·</span>
                          <span className="font-bold text-emerald-700">
                            제출 {doneCount}/{totalCount}명 ({pct}%)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPresMode('single');
                            setPresTargetHw(hw);
                            setIsPresModalOpen(true);
                          }}
                          className="h-7 text-xs px-2 font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1 cursor-pointer"
                          title="미제출자 전자칠판 띄우기"
                        >
                          <Monitor className="w-3.5 h-3.5" />
                          <span>칠판 뷰</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleBatchToggleHw(hw.id)}
                          className="h-7 text-xs px-2 font-bold text-slate-600 hover:bg-slate-200/70 gap-1 cursor-pointer"
                          title="전체 완료 / 전체 해제"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isAllDone ? '전체 해제' : '전체 완료'}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingHw(hw);
                            setEditHwTitle(hw.title);
                          }}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteHomework(hw.id)}
                          className="h-7 w-7 p-0 text-rose-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* 프로그레스 바 */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full transition-all duration-300 ${isAllDone ? 'bg-emerald-500' : 'bg-emerald-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* 미제출자 명단 띠 배너 */}
                    {incompleteStudents.length > 0 && (
                      <div className="text-[11px] font-semibold text-rose-700 bg-rose-50/80 border border-rose-100 rounded-lg px-2.5 py-1.5 mt-2.5 flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-rose-800">⚠ 미제출 ({incompleteStudents.length}명):</span>
                        <span>
                          {incompleteStudents
                            .map((s) => `${s.studentNum ? `${s.studentNum}.` : ''}${s.name}`)
                            .join(' · ')}
                        </span>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="p-3">
                    {/* 학생별 원터치 체크 그리드 */}
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                      {students.map((s) => {
                        const sid = s.studentId || s.id || '';
                        const isDone = doneIdSet.has(sid);

                        return (
                          <button
                            key={sid}
                            onClick={() => handleToggleHwCheck(hw.id, sid, s.name)}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                              isDone
                                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-[10px] text-slate-400 font-medium">
                              {s.studentNum ? `${s.studentNum}번` : ''}
                            </span>
                            <span className="text-xs font-bold tracking-tight">{s.name}</span>
                            <div
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black mt-0.5 ${
                                isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'
                              }`}
                            >
                              {isDone ? '✓' : ''}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ────────────────── 3. 행동 관찰 기록 탭 ────────────────── */}
      {subTab === 'behavior' && (
        <Card className="rounded-2xl border-slate-200/80 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-indigo-600" />
                  <span>학생 행동 관찰 기록</span>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  학생 타일을 클릭하면 오늘 관찰한 행동이나 특이사항을 빠르게 기록할 수 있습니다.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  누적 {behaviors.length}건 기록됨
                </span>
              </div>
            </div>

            {/* 검색창 */}
            <div className="relative pt-2">
              <Search className="absolute left-3 top-4.5 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={behaviorSearch}
                onChange={(e) => setBehaviorSearch(e.target.value)}
                placeholder="학생 이름 또는 번호 검색..."
                className="pl-8 h-9 text-xs bg-white"
              />
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
              {students
                .filter((s) => {
                  if (!behaviorSearch) return true;
                  return (
                    s.name.includes(behaviorSearch) ||
                    String(s.studentNum || '').includes(behaviorSearch)
                  );
                })
                .map((s) => {
                  const sid = s.studentId || s.id || '';
                  const count = behaviorCountMap[sid] || 0;

                  return (
                    <button
                      key={sid}
                      onClick={() => handleOpenBehaviorModal(s)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center relative transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                        count > 0
                          ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950 hover:bg-indigo-100/50'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {count > 0 && (
                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-indigo-600 text-white">
                          {count}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-medium">
                        {s.studentNum ? `${s.studentNum}번` : ''}
                      </span>
                      <span className="text-sm font-extrabold mt-0.5">{s.name}</span>
                      <span className="text-[10px] text-slate-400 mt-1 font-medium">클릭 시 기록</span>
                    </button>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ────────────────── 4. 기록 조회 및 상담 메모 탭 ────────────────── */}
      {subTab === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">학생별 누적 관찰 일지 및 상담 이력</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportBehaviorExcel}
              className="h-8 text-xs font-bold border-slate-200 text-slate-700 gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>행동 기록 엑셀 다운로드</span>
            </Button>
          </div>

          {!selectedStudentForReview ? (
            /* 학생 선택 그리드 */
            <Card className="rounded-2xl border-slate-200/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    value={reviewSearch}
                    onChange={(e) => setReviewSearch(e.target.value)}
                    placeholder="학생 이름 또는 번호 검색..."
                    className="pl-8 h-8 text-xs bg-white"
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                  {students
                    .filter((s) => {
                      if (!reviewSearch) return true;
                      return (
                        s.name.includes(reviewSearch) ||
                        String(s.studentNum || '').includes(reviewSearch)
                      );
                    })
                    .map((s) => {
                      const sid = s.studentId || s.id || '';
                      const count = behaviorCountMap[sid] || 0;

                      return (
                        <button
                          key={sid}
                          onClick={() => handleSelectStudentForReview(s)}
                          className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex flex-col items-center justify-center transition-all cursor-pointer hover:border-indigo-400"
                        >
                          <span className="text-[10px] text-slate-400">{s.studentNum ? `${s.studentNum}번` : ''}</span>
                          <span className="text-sm font-bold text-slate-800">{s.name}</span>
                          <span className="text-[10px] text-indigo-600 font-semibold mt-1">
                            {count > 0 ? `${count}건 기록` : '기록 없음'}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* 선택된 학생 상세 타임라인 & 보호자 상담 메모 분할 뷰 */
            <div className="space-y-4 animate-in fade-in duration-150">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedStudentForReview(null)}
                className="h-8 text-xs font-bold text-slate-600 hover:bg-slate-100 gap-1 cursor-pointer"
              >
                ← 학생 목록으로 돌아가기
              </Button>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 좌측: 행동 관찰 타임라인 (2열) */}
                <Card className="lg:col-span-2 rounded-2xl border-slate-200/80 shadow-xs">
                  <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                        <User className="w-4 h-4 text-indigo-600" />
                        <span>
                          {selectedStudentForReview.studentNum ? `${selectedStudentForReview.studentNum}번 ` : ''}
                          {selectedStudentForReview.name} 행동 관찰 일지
                        </span>
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        총{' '}
                        {
                          behaviors.filter(
                            (b) => b.studentId === (selectedStudentForReview.studentId || selectedStudentForReview.id)
                          ).length
                        }
                        건의 관찰 기록이 있습니다.
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyBehaviorRecords(selectedStudentForReview)}
                        className="h-7 text-xs font-bold border-slate-200 text-slate-700 gap-1 cursor-pointer"
                        title="기록 전체 텍스트 복사"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>복사</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyAIPrompt(selectedStudentForReview)}
                        className="h-7 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1 cursor-pointer"
                        title="생기부 종합의견 AI 분석용 프롬프트 복사"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI 생기부 프롬프트</span>
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3">
                    {(() => {
                      const sid = selectedStudentForReview.studentId || selectedStudentForReview.id || '';
                      const studentBehaviors = behaviors
                        .filter((b) => b.studentId === sid)
                        .sort((a, b) => b.date.localeCompare(a.date));

                      if (studentBehaviors.length === 0) {
                        return (
                          <div className="py-12 text-center text-slate-400 text-xs">
                            등록된 행동 관찰 기록이 없습니다.
                          </div>
                        );
                      }

                      return studentBehaviors.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-100"
                        >
                          <div className="space-y-1 flex-1">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 inline-block">
                              {b.date}
                            </span>
                            <p className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap mt-1">
                              {b.content}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteBehavior(b.id)}
                            className="h-7 w-7 p-0 text-slate-300 hover:text-rose-600 hover:bg-rose-50 shrink-0 cursor-pointer"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ));
                    })()}
                  </CardContent>
                </Card>

                {/* 우측: 보호자 상담 메모 (1열) */}
                <Card className="rounded-2xl border-slate-200/80 shadow-xs h-fit">
                  <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <span>보호자 상담 메모</span>
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={handleSaveConsultMemo}
                      className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    >
                      저장
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2">
                    <Textarea
                      value={consultInput}
                      onChange={(e) => setConsultInput(e.target.value)}
                      placeholder="학부모 전화 상담, 방문 상담 메모를 자유롭게 입력하세요..."
                      rows={10}
                      className="text-xs leading-relaxed resize-none bg-slate-50/60"
                    />
                    <p className="text-[11px] text-slate-400">
                      * 학생별로 안전하게 분리 저장되며, 상시 열람 가능합니다.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────────────── 5. 월별 현황 매트릭스 탭 ────────────────── */}
      {subTab === 'matrix' && (
        <Card className="rounded-2xl border-slate-200/80 shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <span>월별 숙제 제출 현황표</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                학생별 과제 제출 현황(O/X)과 전체 완료율을 한눈에 조회하고 엑셀로 내보냅니다.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Select value={matrixMonth} onValueChange={setMatrixMonth}>
                <SelectTrigger className="h-8 text-xs w-[120px] bg-white font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">전체 기간</SelectItem>
                  {(() => {
                    const months = Array.from(
                      new Set(homeworks.map((h) => (h.date ? h.date.slice(0, 7) : '')).filter(Boolean))
                    ).sort().reverse();
                    return months.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">
                        {m}월
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportHomeworkExcel}
                className="h-8 text-xs font-bold border-slate-200 text-slate-700 gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>엑셀 다운로드</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            {(() => {
              let filteredHws = homeworks;
              if (matrixMonth !== 'all') {
                filteredHws = filteredHws.filter((h) => h.date && h.date.startsWith(matrixMonth));
              }

              if (filteredHws.length === 0) {
                return (
                  <div className="p-12 text-center text-xs text-slate-400">
                    선택한 기간에 등록된 숙제가 없습니다.
                  </div>
                );
              }

              return (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="p-2.5 text-left border-r border-slate-200 min-w-[120px] sticky left-0 bg-slate-50 z-10">
                        학생명
                      </th>
                      {filteredHws.map((hw) => (
                        <th key={hw.id} className="p-2.5 text-center border-r border-slate-200 min-w-[90px]">
                          <div className="font-bold text-slate-800">{hw.title}</div>
                          <div className="text-[10px] font-normal text-slate-400 mt-0.5">{hw.date}</div>
                        </th>
                      ))}
                      <th className="p-2.5 text-center min-w-[80px]">완료율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, idx) => {
                      const sid = s.studentId || s.id || '';
                      let doneCount = 0;
                      const cells = filteredHws.map((hw) => {
                        const isDone = homeworkChecks.some((c) => c.hwId === hw.id && c.studentId === sid && c.checked);
                        if (isDone) doneCount++;
                        return isDone;
                      });
                      const pct = filteredHws.length > 0 ? Math.round((doneCount / filteredHws.length) * 100) : 0;

                      return (
                        <tr
                          key={sid}
                          className={`border-b border-slate-100 hover:bg-emerald-50/40 transition-colors ${
                            idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                          }`}
                        >
                          <td className="p-2.5 font-bold border-r border-slate-200 sticky left-0 bg-inherit z-10 text-slate-800">
                            {s.studentNum ? `${s.studentNum}. ` : ''}
                            {s.name}
                          </td>
                          {cells.map((isDone, cIdx) => (
                            <td key={cIdx} className="p-2 text-center border-r border-slate-200">
                              <span
                                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-black ${
                                  isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                                }`}
                              >
                                {isDone ? '✓' : '✕'}
                              </span>
                            </td>
                          ))}
                          <td className="p-2 text-center">
                            <span
                              className={`font-black text-xs ${
                                pct === 100
                                  ? 'text-emerald-700'
                                  : pct >= 80
                                  ? 'text-indigo-700'
                                  : pct >= 50
                                  ? 'text-amber-700'
                                  : 'text-rose-600'
                              }`}
                            >
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* ────────────────── 6. 학년 자료 공유 탭 ────────────────── */}
      {subTab === 'materials' && (
        <GradeMaterialsTab
          classKey={classKey}
          classLabel={classLabel}
          userEmail={userEmail}
        />
      )}

      {/* ─── 행동 기록 입력 모달 ─── */}
      <Dialog open={isBehaviorModalOpen} onOpenChange={setIsBehaviorModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {selectedStudentForBehavior?.name} 관찰 기록 입력
            </DialogTitle>
            <DialogDescription className="text-xs">
              {todayDisplay} 관찰 내용을 입력해 주세요. (Ctrl + Enter로 바로 저장)
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={behaviorInput}
              onChange={(e) => setBehaviorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.ctrlKey && e.key === 'Enter') handleSaveBehavior();
              }}
              placeholder="예: 모둠 활동 시 친구들의 의견을 경청하고 배려하는 태도를 보임."
              rows={4}
              className="text-xs leading-relaxed"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setIsBehaviorModalOpen(false)}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={handleSaveBehavior}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 숙제 이름 수정 모달 ─── */}
      <Dialog open={!!editingHw} onOpenChange={(open) => !open && setEditingHw(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">숙제 내용 수정</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={editHwTitle}
              onChange={(e) => setEditHwTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEditHw();
              }}
              className="text-xs"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditingHw(null)}>
              취소
            </Button>
            <Button size="sm" onClick={handleSaveEditHw} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              수정 완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 칠판 미제출자 프레젠테이션 모달 ─── */}
      <HomeworkPresentationModal
        isOpen={isPresModalOpen}
        onClose={() => setIsPresModalOpen(false)}
        mode={presMode}
        activeHw={presTargetHw}
        allHws={homeworks}
        students={students}
        checks={homeworkChecks}
        onCheckStudent={(hwId, sid, sname) => handleToggleHwCheck(hwId, sid, sname)}
      />

      {/* ─── 일일 알림장 칠판 전체화면 모달 ─── */}
      <DailyMemoFullscreenModal
        isOpen={isMemoFullscreenOpen}
        onClose={() => setIsMemoFullscreenOpen(false)}
        dateStr={todayDisplay}
        initialContent={memoContent}
        onSave={async (content) => {
          setMemoContent(content);
          await saveDailyMemo(classKey, todayStr, content, userEmail);
        }}
        onOpenHistory={() => {
          setIsMemoFullscreenOpen(false);
          handleOpenMemoHistory();
        }}
      />

      {/* ─── 일자별 칠판 알림장 불러오기 다이얼로그 ─── */}
      <Dialog open={isMemoHistoryOpen} onOpenChange={setIsMemoHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden z-[10000]">
          <DialogHeader className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                  <span>일자별 칠판 알림장 불러오기</span>
                  <Badge variant="outline" className="text-xs bg-white text-emerald-700 border-emerald-200 font-bold">
                    {classLabel}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  이전에 저장된 일자별 알림장/칠판 내용을 확인하고 오늘의 칠판으로 불러옵니다.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col md:flex-row min-h-0 divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden">
            {/* 좌측: 일자 목록 */}
            <div className="w-full md:w-64 shrink-0 flex flex-col bg-slate-50/50 p-3 overflow-y-auto max-h-48 md:max-h-none">
              <div className="text-xs font-bold text-slate-500 mb-2 px-1 flex items-center justify-between">
                <span>저장된 날짜 목록</span>
                <span className="text-[11px] font-mono text-emerald-600 font-black">{memoHistoryList.length}건</span>
              </div>

              {isLoadingMemos ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  알림장 내역을 불러오는 중...
                </div>
              ) : memoHistoryList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  저장된 알림장 내역이 없습니다.
                </div>
              ) : (
                <div className="space-y-1">
                  {memoHistoryList.map((memo) => {
                    const isSelected = selectedHistoryMemo?.date === memo.date;
                    const isToday = memo.date === todayStr;
                    return (
                      <button
                        key={memo.date}
                        type="button"
                        onClick={() => setSelectedHistoryMemo(memo)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/70'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Calendar className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                          <span className="font-mono truncate">{memo.date}</span>
                        </div>
                        {isToday && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-extrabold ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            오늘
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 우측: 선택된 일자의 알림장 내용 미리보기 */}
            <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-white min-h-0">
              {selectedHistoryMemo ? (
                <div className="flex-1 flex flex-col min-h-0 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-sm text-slate-800">{selectedHistoryMemo.date} 저장 내용</span>
                    </div>
                    {selectedHistoryMemo.updatedAt && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(selectedHistoryMemo.updatedAt).toLocaleString('ko-KR', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-h-[220px] max-h-[380px] overflow-y-auto p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm sm:text-base font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {selectedHistoryMemo.content || '(내용 없음)'}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                  좌측에서 조회할 날짜를 선택하세요.
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50/50 flex flex-row items-center justify-between sm:justify-end gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMemoHistoryOpen(false)}
              className="text-xs font-bold text-slate-600"
            >
              닫기
            </Button>
            <Button
              size="sm"
              disabled={!selectedHistoryMemo}
              onClick={() => selectedHistoryMemo && handleApplyHistoryMemo(selectedHistoryMemo)}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>선택한 날짜 내용으로 불러오기</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
