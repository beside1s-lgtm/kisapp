'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import {
  CheckCircle2,
  BookOpen,
  MessageSquare,
  BarChart3,
  Edit2,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { MemoTabContent } from './class-management/MemoTabContent';
import { HomeworkTabContent } from './class-management/HomeworkTabContent';
import { BehaviorTabContent } from './class-management/BehaviorTabContent';
import { ReviewTabContent } from './class-management/ReviewTabContent';
import { MatrixTabContent } from './class-management/MatrixTabContent';
import { BehaviorInputDialog } from './class-management/BehaviorInputDialog';
import { EditHomeworkDialog } from './class-management/EditHomeworkDialog';
import { MemoHistoryDialog } from './class-management/MemoHistoryDialog';

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

  // 2. 숙제 상태 및 일자별 관리 상태
  const [homeworks, setHomeworks] = useState<HomeroomHomework[]>([]);
  const [homeworkChecks, setHomeworkChecks] = useState<HomeroomHomeworkCheck[]>([]);
  const [newHwTitle, setNewHwTitle] = useState('');
  const [editingHw, setEditingHw] = useState<HomeroomHomework | null>(null);
  const [editHwTitle, setEditHwTitle] = useState('');
  const [isPresModalOpen, setIsPresModalOpen] = useState(false);
  const [presMode, setPresMode] = useState<'single' | 'all'>('single');
  const [presTargetHw, setPresTargetHw] = useState<HomeroomHomework | null>(null);

  // 일자별 숙제 탐색 듀얼 모드 상태
  const [selectedHwDate, setSelectedHwDate] = useState<string>(todayStr);
  const [selectedHwId, setSelectedHwId] = useState<string | null>(null);
  const [dateNavMode, setDateNavMode] = useState<'dropdown' | 'calendar'>('dropdown');
  const [calCurrentDate, setCalCurrentDate] = useState<Date>(new Date());

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
      const targetD = new Date(selectedHwDate + 'T12:00:00');
      const dayName = isNaN(targetD.getTime()) ? '' : ` (${days[targetD.getDay()]})`;
      const dateWithDay = `${selectedHwDate}${dayName}`;
      const newId = await addHomework(classKey, newHwTitle.trim(), selectedHwDate, dateWithDay, userEmail);
      setNewHwTitle('');
      setSelectedHwId(newId);
      toast({ title: '숙제 등록 완료', description: `'${newHwTitle}' 숙제가 ${selectedHwDate} 일자에 추가되었습니다.` });
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

  // 1) 날짜별 등록된 숙제 목록 맵 (YYYY-MM-DD -> HomeroomHomework[])
  const homeworksByDate = useMemo(() => {
    const map = new Map<string, HomeroomHomework[]>();
    homeworks.forEach((hw) => {
      const d = hw.date || todayStr;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(hw);
    });
    return map;
  }, [homeworks, todayStr]);

  // 2) 숙제가 등록된 일자 목록 (최신순 역정렬)
  const registeredDates = useMemo(() => {
    const dates = Array.from(homeworksByDate.keys());
    return dates.sort((a, b) => b.localeCompare(a));
  }, [homeworksByDate]);

  // 3) 각 날짜별 통계 (숙제 개수, 총 학생 수, 제출 현황 문자열, 전원 완료 여부, 개별 숙제별 상태 목록)
  const dateStatsMap = useMemo(() => {
    const map = new Map<string, {
      hwCount: number;
      totalStudents: number;
      avgDoneCount: number;
      isAllDone: boolean;
      summaryText: string;
      singleDoneCount?: number;
      items: Array<{
        id: string;
        title: string;
        doneCount: number;
        pct: number;
        isDone: boolean;
      }>;
    }>();

    const totalStudents = students.length;

    homeworksByDate.forEach((hws, dateKey) => {
      if (hws.length === 0) return;

      let allHwsDone = true;
      let sumDone = 0;

      const items = hws.map((hw) => {
        const checks = homeworkChecks.filter((c) => c.hwId === hw.id && c.checked);
        const doneCount = students.filter((s) => {
          const sid = s.studentId || s.id || '';
          return checks.some((c) => c.studentId === sid);
        }).length;
        sumDone += doneCount;
        const isDone = totalStudents > 0 && doneCount === totalStudents;
        if (!isDone) {
          allHwsDone = false;
        }
        const pct = totalStudents > 0 ? Math.round((doneCount / totalStudents) * 100) : 0;
        return {
          id: hw.id,
          title: hw.title,
          doneCount,
          pct,
          isDone,
        };
      });

      const avgDone = Math.round(sumDone / hws.length);
      const isSingle = hws.length === 1;
      const singleDone = isSingle ? sumDone : undefined;

      map.set(dateKey, {
        hwCount: hws.length,
        totalStudents,
        avgDoneCount: avgDone,
        isAllDone: totalStudents > 0 && allHwsDone,
        summaryText: isSingle ? `${singleDone}/${totalStudents}` : `${avgDone}/${totalStudents}`,
        singleDoneCount: singleDone,
        items,
      });
    });

    return map;
  }, [homeworksByDate, homeworkChecks, students]);

  // 4) 현재 선택된 날짜의 숙제 목록
  const currentDayHomeworks = useMemo(() => {
    return homeworksByDate.get(selectedHwDate) || [];
  }, [homeworksByDate, selectedHwDate]);

  // 5) 현재 선택된 숙제 객체
  const selectedHw = useMemo(() => {
    return currentDayHomeworks.find((hw) => hw.id === selectedHwId) || currentDayHomeworks[0] || null;
  }, [currentDayHomeworks, selectedHwId]);

  // 6) 선택된 날짜가 바뀌거나 숙제 목록이 변경될 때 활성 숙제 자동 선택
  useEffect(() => {
    if (currentDayHomeworks.length > 0) {
      if (!selectedHwId || !currentDayHomeworks.some((hw) => hw.id === selectedHwId)) {
        setSelectedHwId(currentDayHomeworks[0].id);
      }
    } else {
      setSelectedHwId(null);
    }
  }, [currentDayHomeworks, selectedHwId]);

  // 7) 달력 월간 날짜 그리드 데이터 계산
  const calendarDays = useMemo(() => {
    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const firstDayOfWeek = firstDay.getDay(); // 0: 일요일
    const totalDays = lastDay.getDate();

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      stats?: {
        hwCount: number;
        totalStudents: number;
        avgDoneCount: number;
        isAllDone: boolean;
        summaryText: string;
        singleDoneCount?: number;
        items: Array<{
          id: string;
          title: string;
          doneCount: number;
          pct: number;
          isDone: boolean;
        }>;
      };
    }> = [];

    // 이전 달 패딩
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dNum = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, dNum);
      const dStr = format(prevDate, 'yyyy-MM-dd');
      days.push({
        dateStr: dStr,
        dayNum: dNum,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedHwDate,
        stats: dateStatsMap.get(dStr),
      });
    }

    // 이번 달 날짜들
    for (let d = 1; d <= totalDays; d++) {
      const curD = new Date(year, month, d);
      const dStr = format(curD, 'yyyy-MM-dd');
      days.push({
        dateStr: dStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedHwDate,
        stats: dateStatsMap.get(dStr),
      });
    }

    // 다음 달 패딩 (총 35개 또는 42개 맞춤)
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let nextD = 1; nextD <= remaining; nextD++) {
        const nextDate = new Date(year, month + 1, nextD);
        const dStr = format(nextDate, 'yyyy-MM-dd');
        days.push({
          dateStr: dStr,
          dayNum: nextD,
          isCurrentMonth: false,
          isToday: dStr === todayStr,
          isSelected: dStr === selectedHwDate,
          stats: dateStatsMap.get(dStr),
        });
      }
    }

    return days;
  }, [calCurrentDate, todayStr, selectedHwDate, dateStatsMap]);

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
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto whitespace-nowrap">
          <Button
            variant={subTab === 'memo' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSubTab('memo')}
            className={`h-7 sm:h-8 text-xs font-bold gap-1 rounded-lg px-2 sm:px-3 whitespace-nowrap ${subTab === 'memo' ? 'bg-white text-emerald-700 shadow-xs hover:bg-white' : 'text-slate-600'}`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>칠판 알림</span>
          </Button>

          <Button
            variant={subTab === 'homework' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSubTab('homework')}
            className={`h-7 sm:h-8 text-xs font-bold gap-1 rounded-lg px-2 sm:px-3 whitespace-nowrap ${subTab === 'homework' ? 'bg-white text-emerald-700 shadow-xs hover:bg-white' : 'text-slate-600'}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
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
            className={`h-7 sm:h-8 text-xs font-bold gap-1 rounded-lg px-2 sm:px-3 whitespace-nowrap ${subTab === 'behavior' ? 'bg-white text-emerald-700 shadow-xs hover:bg-white' : 'text-slate-600'}`}
          >
            <Edit2 className="w-3.5 h-3.5 shrink-0" />
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
            className={`h-7 sm:h-8 text-xs font-bold gap-1 rounded-lg px-2 sm:px-3 whitespace-nowrap ${subTab === 'review' ? 'bg-white text-emerald-700 shadow-xs hover:bg-white' : 'text-slate-600'}`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span>기록·상담</span>
          </Button>

          <Button
            variant={subTab === 'matrix' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSubTab('matrix')}
            className={`h-7 sm:h-8 text-xs font-bold gap-1 rounded-lg px-2 sm:px-3 whitespace-nowrap ${subTab === 'matrix' ? 'bg-white text-emerald-700 shadow-xs hover:bg-white' : 'text-slate-600'}`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span>월별 현황</span>
          </Button>

          <Button
            variant={subTab === 'materials' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSubTab('materials')}
            className={`h-7 sm:h-8 text-xs font-bold gap-1 rounded-lg px-2 sm:px-3 whitespace-nowrap ${subTab === 'materials' ? 'bg-white text-indigo-700 shadow-xs hover:bg-white' : 'text-slate-600'}`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>자료 공유</span>
          </Button>
        </div>
      </div>

      {/* ────────────────── 1. 칠판 알림 메모 탭 ────────────────── */}
      {subTab === 'memo' && (
        <MemoTabContent
          todayDisplay={todayDisplay}
          memoContent={memoContent}
          setMemoContent={setMemoContent}
          handleSaveMemo={handleSaveMemo}
          handleOpenMemoHistory={handleOpenMemoHistory}
          setIsMemoFullscreenOpen={setIsMemoFullscreenOpen}
        />
      )}

      {/* ────────────────── 2. 숙제 확인 탭 (일자별 달력/드롭다운 듀얼 탐색 & 2단계 계층 구조) ────────────────── */}
      {subTab === 'homework' && (
        <HomeworkTabContent
          dateNavMode={dateNavMode}
          setDateNavMode={setDateNavMode}
          selectedHwDate={selectedHwDate}
          setSelectedHwDate={setSelectedHwDate}
          calCurrentDate={calCurrentDate}
          setCalCurrentDate={setCalCurrentDate}
          todayStr={todayStr}
          registeredDates={registeredDates}
          dateStatsMap={dateStatsMap}
          newHwTitle={newHwTitle}
          setNewHwTitle={setNewHwTitle}
          handleAddHomework={handleAddHomework}
          homeworks={homeworks}
          setPresMode={setPresMode}
          setIsPresModalOpen={setIsPresModalOpen}
          currentDayHomeworks={currentDayHomeworks}
          getHwStats={getHwStats}
          selectedHw={selectedHw}
          setSelectedHwId={setSelectedHwId}
          setPresTargetHw={setPresTargetHw}
          setEditingHw={setEditingHw}
          setEditHwTitle={setEditHwTitle}
          handleDeleteHomework={handleDeleteHomework}
          homeworkChecks={homeworkChecks}
          students={students}
          handleToggleHwCheck={handleToggleHwCheck}
          handleBatchToggleHw={handleBatchToggleHw}
          calendarDays={calendarDays}
        />
      )}

      {/* ────────────────── 3. 행동 관찰 기록 탭 ────────────────── */}
      {subTab === 'behavior' && (
        <BehaviorTabContent
          behaviors={behaviors}
          behaviorSearch={behaviorSearch}
          setBehaviorSearch={setBehaviorSearch}
          students={students}
          behaviorCountMap={behaviorCountMap}
          handleOpenBehaviorModal={handleOpenBehaviorModal}
        />
      )}

      {/* ────────────────── 4. 기록 조회 및 상담 메모 탭 ────────────────── */}
      {subTab === 'review' && (
        <ReviewTabContent
          selectedStudentForReview={selectedStudentForReview}
          setSelectedStudentForReview={setSelectedStudentForReview}
          reviewSearch={reviewSearch}
          setReviewSearch={setReviewSearch}
          students={students}
          behaviorCountMap={behaviorCountMap}
          handleSelectStudentForReview={handleSelectStudentForReview}
          behaviors={behaviors}
          handleCopyBehaviorRecords={handleCopyBehaviorRecords}
          handleCopyAIPrompt={handleCopyAIPrompt}
          handleDeleteBehavior={handleDeleteBehavior}
          consultInput={consultInput}
          setConsultInput={setConsultInput}
          handleSaveConsultMemo={handleSaveConsultMemo}
          handleExportBehaviorExcel={handleExportBehaviorExcel}
        />
      )}

      {/* ────────────────── 5. 월별 현황 매트릭스 탭 ────────────────── */}
      {subTab === 'matrix' && (
        <MatrixTabContent
          matrixMonth={matrixMonth}
          setMatrixMonth={setMatrixMonth}
          homeworks={homeworks}
          handleExportHomeworkExcel={handleExportHomeworkExcel}
          students={students}
          homeworkChecks={homeworkChecks}
        />
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
      <BehaviorInputDialog
        isBehaviorModalOpen={isBehaviorModalOpen}
        setIsBehaviorModalOpen={setIsBehaviorModalOpen}
        selectedStudentForBehavior={selectedStudentForBehavior}
        todayDisplay={todayDisplay}
        behaviorInput={behaviorInput}
        setBehaviorInput={setBehaviorInput}
        handleSaveBehavior={handleSaveBehavior}
      />

      {/* ─── 숙제 이름 수정 모달 ─── */}
      <EditHomeworkDialog
        editingHw={editingHw}
        setEditingHw={setEditingHw}
        editHwTitle={editHwTitle}
        setEditHwTitle={setEditHwTitle}
        handleSaveEditHw={handleSaveEditHw}
      />

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
      <MemoHistoryDialog
        isMemoHistoryOpen={isMemoHistoryOpen}
        setIsMemoHistoryOpen={setIsMemoHistoryOpen}
        memoHistoryList={memoHistoryList}
        isLoadingMemos={isLoadingMemos}
        selectedHistoryMemo={selectedHistoryMemo}
        setSelectedHistoryMemo={setSelectedHistoryMemo}
        todayStr={todayStr}
        classLabel={classLabel}
        handleApplyHistoryMemo={handleApplyHistoryMemo}
      />
    </div>
  );
};
