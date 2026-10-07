'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Monitor,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ListFilter,
  BookOpen,
  Inbox,
  Archive,
  Filter,
} from 'lucide-react';
import type { HomeroomHomework, HomeroomHomeworkCheck } from '@/lib/types/homeroomClass';
import type { MasterStudent } from '@/lib/types/masterStudent';
import { HomeworkArchiveView } from './HomeworkArchiveView';

export interface HwDayStats {
  hwCount: number;
  totalStudents: number;
  avgDoneCount: number;
  isAllDone: boolean;
  summaryText: string;
  singleDoneCount?: number;
  items: Array<{ id: string; title: string; doneCount: number; pct: number; isDone: boolean }>;
}

interface CalendarDay {
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  stats?: HwDayStats;
}

export function HomeworkTabContent({
  dateNavMode,
  setDateNavMode,
  selectedHwDate,
  setSelectedHwDate,
  calCurrentDate,
  setCalCurrentDate,
  todayStr,
  registeredDates,
  dateStatsMap,
  newHwTitle,
  setNewHwTitle,
  handleAddHomework,
  homeworks,
  setPresMode,
  setIsPresModalOpen,
  currentDayHomeworks,
  getHwStats,
  selectedHw,
  setSelectedHwId,
  setPresTargetHw,
  setEditingHw,
  setEditHwTitle,
  handleDeleteHomework,
  homeworkChecks,
  students,
  handleToggleHwCheck,
  handleBatchToggleHw,
  calendarDays,
  classLabel,
  onToggleConfirm,
}: {
  dateNavMode: 'dropdown' | 'calendar';
  setDateNavMode: (mode: 'dropdown' | 'calendar') => void;
  selectedHwDate: string;
  setSelectedHwDate: (date: string) => void;
  calCurrentDate: Date;
  setCalCurrentDate: (date: Date) => void;
  todayStr: string;
  registeredDates: string[];
  dateStatsMap: Map<string, HwDayStats>;
  newHwTitle: string;
  setNewHwTitle: (val: string) => void;
  handleAddHomework: () => void;
  homeworks: HomeroomHomework[];
  setPresMode: (mode: 'single' | 'all') => void;
  setIsPresModalOpen: (open: boolean) => void;
  currentDayHomeworks: HomeroomHomework[];
  getHwStats: (hwId: string) => { doneCount: number; totalCount: number; pct: number; isAllDone: boolean };
  selectedHw: HomeroomHomework | null;
  setSelectedHwId: (id: string) => void;
  setPresTargetHw: (hw: HomeroomHomework | null) => void;
  setEditingHw: (hw: HomeroomHomework | null) => void;
  setEditHwTitle: (val: string) => void;
  handleDeleteHomework: (hwId: string) => void;
  homeworkChecks: HomeroomHomeworkCheck[];
  students: MasterStudent[];
  handleToggleHwCheck: (hwId: string, studentId: string, studentName: string) => void;
  handleBatchToggleHw: (hwId: string) => void;
  calendarDays: CalendarDay[];
  classLabel?: string;
  onToggleConfirm?: (hwId: string, isConfirmed: boolean) => void;
}) {
  // 1. 서브 뷰 모드: 'active' (미확인 숙제 피드) | 'archive' (확인된 숙제 보관함)
  const [subViewMode, setSubViewMode] = useState<'active' | 'archive'>('active');

  // 2. 날짜별 필터 토글 상태 (기본값: false - 날짜 무관 전체 통합 피드)
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);

  // 담임 미확인 활성 숙제 목록 (시간순/최신순 정렬)
  const activeHomeworks = useMemo(() => {
    return homeworks
      .filter((h) => !h.isTeacherConfirmed)
      .sort((a, b) => {
        const timeA = a.createdAt || a.date || '';
        const timeB = b.createdAt || b.date || '';
        return timeB.localeCompare(timeA);
      });
  }, [homeworks]);

  // 담임 확인 완료된 보관 숙제 목록
  const archivedHomeworks = useMemo(() => {
    return homeworks.filter((h) => h.isTeacherConfirmed);
  }, [homeworks]);

  // 화면에 표시할 활성 숙제 목록 (날짜 필터 적용 여부에 따라 분기)
  const displayedHomeworks = useMemo(() => {
    if (dateFilterEnabled) {
      return currentDayHomeworks.filter((h) => !h.isTeacherConfirmed);
    }
    return activeHomeworks;
  }, [dateFilterEnabled, currentDayHomeworks, activeHomeworks]);

  return (
    <div className="space-y-4">
      {/* ── 최상단: [미확인 과제] vs [확인된 숙제 (아카이브)] 서브 탭 바 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={subViewMode === 'active' ? 'default' : 'ghost'}
            onClick={() => setSubViewMode('active')}
            className={`h-8 sm:h-9 text-xs font-bold gap-1.5 rounded-xl px-3 transition-all cursor-pointer ${
              subViewMode === 'active'
                ? 'bg-white text-emerald-800 shadow-xs hover:bg-white hover:text-emerald-800'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Inbox className="w-3.5 h-3.5 text-emerald-600" />
            <span>미확인 숙제 목록</span>
            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-1.5 py-0 h-4 border-0">
              {activeHomeworks.length}
            </Badge>
          </Button>

          <Button
            type="button"
            size="sm"
            variant={subViewMode === 'archive' ? 'default' : 'ghost'}
            onClick={() => setSubViewMode('archive')}
            className={`h-8 sm:h-9 text-xs font-bold gap-1.5 rounded-xl px-3 transition-all cursor-pointer ${
              subViewMode === 'archive'
                ? 'bg-white text-indigo-800 shadow-xs hover:bg-white hover:text-indigo-800'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-indigo-600" />
            <span>확인된 숙제 (아카이브)</span>
            <Badge className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-1.5 py-0 h-4 border-0">
              {archivedHomeworks.length}
            </Badge>
          </Button>
        </div>

        {subViewMode === 'active' && (
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <Button
              type="button"
              size="sm"
              variant={dateFilterEnabled ? 'default' : 'outline'}
              onClick={() => setDateFilterEnabled(!dateFilterEnabled)}
              className={`h-7 sm:h-8 text-[11px] sm:text-xs font-bold gap-1 rounded-xl px-2.5 cursor-pointer ${
                dateFilterEnabled
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="특정 일자별로 좁혀서 조회하기"
            >
              <Filter className="w-3 h-3" />
              <span>{dateFilterEnabled ? `날짜 필터: ${selectedHwDate}` : '날짜별 필터 켜기'}</span>
            </Button>
          </div>
        )}
      </div>

      {/* ── 아카이브 뷰 모드일 때 ── */}
      {subViewMode === 'archive' ? (
        <HomeworkArchiveView
          classLabel={classLabel || ''}
          archivedHomeworks={archivedHomeworks}
          homeworkChecks={homeworkChecks}
          students={students}
          onToggleConfirm={(hwId, isConfirmed) => onToggleConfirm?.(hwId, isConfirmed)}
          onDeleteHomework={handleDeleteHomework}
          onToggleHwCheck={handleToggleHwCheck}
        />
      ) : (
        /* ── 미확인 숙제 피드 뷰 모드일 때 ── */
        <>
          {/* 상단 1: 숙제 추가 및 날짜 필터 탐색 바 */}
          <Card className="rounded-2xl border-slate-200/80 shadow-xs">
            <CardContent className="p-3 sm:p-4 space-y-3">
              {/* 날짜 필터가 켜져 있을 때만 노출되는 일자 탐색 도구 */}
              {dateFilterEnabled && (
                <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/70 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="bg-slate-200/80 p-0.5 rounded-lg flex items-center shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant={dateNavMode === 'dropdown' ? 'default' : 'ghost'}
                          onClick={() => setDateNavMode('dropdown')}
                          className={`h-7 text-xs font-bold gap-1 rounded-md px-2 ${
                            dateNavMode === 'dropdown'
                              ? 'bg-white text-emerald-700 shadow-2xs hover:bg-white'
                              : 'text-slate-600'
                          }`}
                        >
                          <ListFilter className="w-3 h-3" />
                          <span>일자 목록</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={dateNavMode === 'calendar' ? 'default' : 'ghost'}
                          onClick={() => setDateNavMode('calendar')}
                          className={`h-7 text-xs font-bold gap-1 rounded-md px-2 ${
                            dateNavMode === 'calendar'
                              ? 'bg-white text-emerald-700 shadow-2xs hover:bg-white'
                              : 'text-slate-600'
                          }`}
                        >
                          <CalendarDays className="w-3 h-3" />
                          <span>달력 열기</span>
                        </Button>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedHwDate(todayStr);
                          setCalCurrentDate(new Date());
                        }}
                        className={`h-7 text-xs font-bold px-2 rounded-lg border-slate-200 ${
                          selectedHwDate === todayStr
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'text-slate-600'
                        }`}
                      >
                        오늘
                      </Button>
                    </div>

                    {dateNavMode === 'dropdown' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {registeredDates.length > 0 && (
                          <div className="min-w-[170px]">
                            <Select
                              value={registeredDates.includes(selectedHwDate) ? selectedHwDate : ''}
                              onValueChange={(val) => {
                                if (val) setSelectedHwDate(val);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs font-bold bg-white border-slate-200">
                                <SelectValue placeholder="등록 일자 선택..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-72">
                                {registeredDates.map((d) => {
                                  const stats = dateStatsMap.get(d);
                                  return (
                                    <SelectItem key={d} value={d} className="text-xs">
                                      <div className="flex items-center gap-2 py-0.5">
                                        <span className="font-bold text-slate-800">{d}</span>
                                        <Badge className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0 h-4 border-0">
                                          {stats?.hwCount || 0}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <Input
                          type="date"
                          value={selectedHwDate}
                          onChange={(e) => {
                            if (e.target.value) setSelectedHwDate(e.target.value);
                          }}
                          className="h-8 w-32 text-xs font-bold bg-white text-center border-slate-200"
                        />
                      </div>
                    )}
                  </div>

                  {/* 달력 모드일 때 달력 그리드 */}
                  {dateNavMode === 'calendar' && (
                    <div className="bg-white border border-slate-200/80 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCalCurrentDate(
                              new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth() - 1, 1)
                            );
                          }}
                          className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-800">
                            {format(calCurrentDate, 'yyyy년 M월')}
                          </span>
                          {selectedHwDate && (
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                              선택: {selectedHwDate}
                            </span>
                          )}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCalCurrentDate(
                              new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth() + 1, 1)
                            );
                          }}
                          className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 mb-1">
                        <div className="text-rose-500">일</div>
                        <div>월</div>
                        <div>화</div>
                        <div>수</div>
                        <div>목</div>
                        <div>금</div>
                        <div className="text-blue-500">토</div>
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((cd, idx) => {
                          const hasHw = Boolean(cd.stats && cd.stats.hwCount > 0);
                          const isSel = cd.isSelected;

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedHwDate(cd.dateStr)}
                              className={`min-h-[50px] p-1 rounded-xl border flex flex-col justify-between items-center transition-all cursor-pointer text-left relative ${
                                !cd.isCurrentMonth
                                  ? 'bg-slate-50/40 text-slate-300 border-transparent hover:bg-slate-100/50'
                                  : isSel
                                  ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500 shadow-2xs'
                                  : hasHw
                                  ? 'bg-white border-slate-200 hover:border-slate-300'
                                  : 'bg-white border-slate-100 hover:bg-slate-50'
                              }`}
                            >
                              <div className="w-full flex items-center justify-between">
                                <span
                                  className={`text-[11px] font-bold ${
                                    cd.isToday
                                      ? 'bg-emerald-600 text-white rounded-full w-5 h-5 flex items-center justify-center'
                                      : isSel
                                      ? 'text-emerald-900'
                                      : cd.isCurrentMonth
                                      ? 'text-slate-700'
                                      : 'text-slate-300'
                                  }`}
                                >
                                  {cd.dayNum}
                                </span>
                                {hasHw && (
                                  <span className="bg-indigo-600 text-white text-[9px] font-black rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                                    {cd.stats!.hwCount}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 새 숙제 추가 입력창 */}
              <div className="pt-1 flex flex-row items-center justify-between gap-1.5 sm:gap-2.5 w-full overflow-x-hidden">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold text-[11px] sm:text-xs px-2 sm:px-2.5 py-2 rounded-xl shrink-0 flex items-center gap-1 whitespace-nowrap">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{selectedHwDate}</span>
                  </div>
                  <Input
                    value={newHwTitle}
                    onChange={(e) => setNewHwTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddHomework();
                    }}
                    placeholder={`[${selectedHwDate}] 숙제 추가`}
                    className="h-9 sm:h-10 text-xs sm:text-sm bg-white flex-1 min-w-0"
                  />
                  <Button
                    onClick={handleAddHomework}
                    className="h-9 sm:h-10 text-xs font-bold px-2.5 sm:px-4 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4 sm:mr-1 shrink-0" />
                    <span className="hidden sm:inline">추가</span>
                  </Button>
                </div>

                {activeHomeworks.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPresMode('all');
                      setIsPresModalOpen(true);
                    }}
                    className="h-9 sm:h-10 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 shrink-0 gap-1 px-2.5 sm:px-3 cursor-pointer whitespace-nowrap"
                    title="전체 미제출 칠판"
                  >
                    <Monitor className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">전체 미제출 칠판</span>
                    <span className="sm:hidden text-[11px]">칠판</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ────────────────── 미확인 숙제 목록 ────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-800">
                  {dateFilterEnabled ? `${selectedHwDate} 미확인 숙제` : '미확인 숙제 통합 피드 (시간순)'}
                </h3>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs font-bold">
                  총 {displayedHomeworks.length}개
                </Badge>
              </div>
              <span className="text-xs text-slate-400 hidden sm:inline">
                💡 숙제 카드를 클릭하면 학생 체크표가 열리며, [확인] 클릭 시 아카이브 보관함으로 이동합니다.
              </span>
            </div>

            {displayedHomeworks.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-slate-200 p-10 text-center bg-slate-50/50">
                <div className="inline-flex p-3 bg-white text-slate-400 rounded-full mb-2.5 shadow-2xs">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-700">
                  {dateFilterEnabled
                    ? '선택된 날짜에 미확인 숙제가 없습니다'
                    : '담임교사 확인이 필요한 미확인 숙제가 없습니다'}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {dateFilterEnabled
                    ? '날짜 필터를 해제하여 전체 목록을 보거나 새 숙제를 등록하세요.'
                    : '새 숙제를 등록하거나 상단의 [확인된 숙제 (아카이브)] 보관함에서 과거 내역을 확인하세요.'}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayedHomeworks.map((hw) => {
                  const { doneCount, totalCount, pct, isAllDone } = getHwStats(hw.id);
                  const isSelected = selectedHw?.id === hw.id;

                  return (
                    <Card
                      key={hw.id}
                      onClick={() => setSelectedHwId(hw.id)}
                      className={`rounded-2xl transition-all cursor-pointer border relative overflow-hidden ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/80 shadow-md'
                          : isAllDone
                          ? 'border-emerald-300/80 bg-white hover:border-emerald-400 hover:shadow-xs ring-1 ring-emerald-200/50'
                          : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs'
                      }`}
                    >
                      <CardHeader className="p-3.5 pb-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-black text-slate-900 truncate">
                                {hw.title}
                              </span>
                              {isAllDone && (
                                <Badge className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0 h-4 gap-0.5 border-0 shadow-2xs">
                                  <Check className="w-2.5 h-2.5" /> 완료
                                </Badge>
                              )}
                              {isSelected && (
                                <Badge className="bg-emerald-700 text-white text-[9px] font-bold px-1.5 py-0 h-4">
                                  선택됨
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                              <span className="font-semibold text-slate-600">
                                {hw.dateWithDay || hw.date}
                              </span>
                              <span>·</span>
                              <span className="font-bold text-emerald-700">
                                제출 {doneCount}/{totalCount}명 ({pct}%)
                              </span>
                            </div>
                          </div>

                          {/* 카드 액션 버튼들: [확인(보관)], [칠판], [수정], [삭제] */}
                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* 담임교사용 [확인] 버튼 */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onToggleConfirm?.(hw.id, true)}
                              className="h-7 px-2 text-xs font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 rounded-lg gap-1 cursor-pointer transition-all active:scale-95"
                              title="담임 확인 완료 처리 (보관함으로 이동)"
                            >
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                              <span>확인</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setPresMode('single');
                                setPresTargetHw(hw);
                                setIsPresModalOpen(true);
                              }}
                              className="h-7 w-7 p-0 text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"
                              title="전자칠판 뷰"
                            >
                              <Monitor className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingHw(hw);
                                setEditHwTitle(hw.title);
                              }}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                              title="수정"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteHomework(hw.id)}
                              className="h-7 w-7 p-0 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* 프로그레스 바 */}
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isAllDone ? 'bg-emerald-500' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* ────────────────── 선택된 숙제의 학생 체크표 상세 ────────────────── */}
          {selectedHw && (
            (() => {
              const { doneCount, totalCount, pct, isAllDone } = getHwStats(selectedHw.id);
              const doneIdSet = new Set(
                homeworkChecks
                  .filter((c) => c.hwId === selectedHw.id && c.checked)
                  .map((c) => c.studentId)
              );
              const incompleteStudents = students.filter(
                (s) => !doneIdSet.has(s.studentId || s.id || '')
              );

              return (
                <Card className="rounded-2xl border-slate-200/90 shadow-xs overflow-hidden bg-white">
                  <CardHeader className="p-4 pb-3 bg-slate-50/80 border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-slate-800">
                            {selectedHw.title}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            - 학생 제출 체크표
                          </span>
                          {isAllDone && (
                            <Badge className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5">
                              ✓ 전원 완료
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-medium">
                          <span>{selectedHw.dateWithDay || selectedHw.date}</span>
                          <span>·</span>
                          <span className="font-bold text-emerald-700">
                            제출 완료 {doneCount}/{totalCount}명 ({pct}%)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* 상세 영역에서의 [담임 확인(보관)] 버튼 */}
                        <Button
                          size="sm"
                          onClick={() => onToggleConfirm?.(selectedHw.id, true)}
                          className="h-8 text-xs px-2.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 cursor-pointer shadow-2xs"
                          title="이 숙제를 담임 확인 완료 처리하고 보관함으로 이동합니다"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>담임 확인(보관)</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPresMode('single');
                            setPresTargetHw(selectedHw);
                            setIsPresModalOpen(true);
                          }}
                          className="h-8 text-xs px-2.5 font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1 cursor-pointer"
                          title="미제출자 전자칠판 띄우기"
                        >
                          <Monitor className="w-3.5 h-3.5" />
                          <span>칠판 뷰</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBatchToggleHw(selectedHw.id)}
                          className="h-8 text-xs px-2.5 font-bold text-slate-700 hover:bg-slate-100 gap-1 border-slate-200 cursor-pointer"
                          title="전체 완료 / 전체 해제"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isAllDone ? '전체 해제' : '전체 완료'}</span>
                        </Button>
                      </div>
                    </div>

                    {/* 미제출자 명단 띠 배너 */}
                    {incompleteStudents.length > 0 ? (
                      <div className="text-[11px] font-semibold text-rose-700 bg-rose-50/80 border border-rose-100 rounded-lg px-2.5 py-1.5 mt-2.5 flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-rose-800">⚠ 미제출 ({incompleteStudents.length}명):</span>
                        <span>
                          {incompleteStudents
                            .map((s) => `${s.studentNum ? `${s.studentNum}.` : ''}${s.name}`)
                            .join(' · ')}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50/80 border border-emerald-100 rounded-lg px-2.5 py-1.5 mt-2.5 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>모든 학생이 숙제를 정상 제출하였습니다.</span>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="p-3.5">
                    {/* 학생별 원터치 체크 그리드 */}
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                      {students.map((s) => {
                        const sid = s.studentId || s.id || '';
                        const isDone = doneIdSet.has(sid);

                        return (
                          <button
                            key={sid}
                            type="button"
                            onClick={() => handleToggleHwCheck(selectedHw.id, sid, s.name)}
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
            })()
          )}
        </>
      )}
    </div>
  );
}
