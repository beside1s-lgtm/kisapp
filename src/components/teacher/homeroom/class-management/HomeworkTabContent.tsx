'use client';

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
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ListFilter,
  BookOpen,
} from 'lucide-react';
import type { HomeroomHomework, HomeroomHomeworkCheck } from '@/lib/types/homeroomClass';
import type { MasterStudent } from '@/lib/types/masterStudent';

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
}) {
  return (
    <div className="space-y-4">
      {/* 상단 1: 일자 탐색 및 모드 전환 바 */}
      <Card className="rounded-2xl border-slate-200/80 shadow-xs">
        <CardContent className="p-3 sm:p-4 space-y-3">
          {/* 탐색 모드 전환 & 일자 빠른 선택 행 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* 좌측: 달력 열기 / 드롭다운 목록 토글 버튼 */}
            <div className="flex items-center gap-1.5">
              <div className="bg-slate-100 p-0.5 rounded-xl flex items-center shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant={dateNavMode === 'dropdown' ? 'default' : 'ghost'}
                  onClick={() => setDateNavMode('dropdown')}
                  className={`h-8 text-xs font-bold gap-1 rounded-lg px-2.5 ${dateNavMode === 'dropdown' ? 'bg-white text-emerald-700 shadow-xs hover:bg-white' : 'text-slate-600'}`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>일자 목록</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={dateNavMode === 'calendar' ? 'default' : 'ghost'}
                  onClick={() => setDateNavMode('calendar')}
                  className={`h-8 text-xs font-bold gap-1 rounded-lg px-2.5 ${dateNavMode === 'calendar' ? 'bg-white text-emerald-700 shadow-xs hover:bg-white' : 'text-slate-600'}`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>달력 열기</span>
                </Button>
              </div>

              {/* 오늘 날짜 바로가기 버튼 */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedHwDate(todayStr);
                  setCalCurrentDate(new Date());
                }}
                className={`h-8 text-xs font-bold px-2.5 rounded-xl border-slate-200 ${selectedHwDate === todayStr ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'text-slate-600'}`}
              >
                오늘
              </Button>
            </div>

            {/* 우측: 드롭다운 모드일 때 일자 선택기 & 직접 입력 */}
            {dateNavMode === 'dropdown' && (
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                {/* 숙제 등록된 일자 목록 드롭다운 */}
                {registeredDates.length > 0 && (
                  <div className="min-w-[180px] sm:min-w-[220px]">
                    <Select
                      value={registeredDates.includes(selectedHwDate) ? selectedHwDate : ''}
                      onValueChange={(val) => {
                        if (val) setSelectedHwDate(val);
                      }}
                    >
                      <SelectTrigger className="h-8 sm:h-9 text-xs font-bold bg-white border-slate-200">
                        <SelectValue placeholder="숙제 등록 일자 선택..." />
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
                                {stats?.isAllDone ? (
                                  <Badge className="bg-emerald-600 text-white text-[10px] font-bold px-1 py-0 h-4 gap-0.5 border-0">
                                    <Check className="w-2.5 h-2.5" /> 완료
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-slate-600 border-slate-300 text-[10px] font-bold px-1.5 py-0 h-4">
                                    {stats?.summaryText}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 임의 날짜 직접 선택 Input */}
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={selectedHwDate}
                    onChange={(e) => {
                      if (e.target.value) setSelectedHwDate(e.target.value);
                    }}
                    className="h-8 sm:h-9 w-32 sm:w-36 text-xs font-bold bg-white text-center border-slate-200"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 달력 모드일 때: 달력 그리드 패널 */}
          {dateNavMode === 'calendar' && (
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 sm:p-4">
              {/* 달력 헤더 (이전달, 연월, 다음달) */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCalCurrentDate(new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth() - 1, 1));
                  }}
                  className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
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
                    setCalCurrentDate(new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth() + 1, 1));
                  }}
                  className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 mb-1">
                <div className="text-rose-500">일</div>
                <div>월</div>
                <div>화</div>
                <div>수</div>
                <div>목</div>
                <div>금</div>
                <div className="text-blue-500">토</div>
              </div>

              {/* 날짜 셀 그리드 */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cd, idx) => {
                  const hasHw = Boolean(cd.stats && cd.stats.hwCount > 0);
                  const isSel = cd.isSelected;
                  const items = cd.stats?.items || [];

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedHwDate(cd.dateStr)}
                      className={`min-h-[58px] sm:min-h-[72px] p-1 sm:p-1.5 rounded-xl border flex flex-col justify-between items-center transition-all cursor-pointer text-left relative ${
                        !cd.isCurrentMonth
                          ? 'bg-slate-50/40 text-slate-300 border-transparent hover:bg-slate-100/50'
                          : isSel
                          ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500 shadow-xs'
                          : hasHw
                          ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs'
                          : 'bg-white border-slate-100 hover:bg-slate-50/60'
                      }`}
                    >
                      {/* 상단: 일자 번호 & 숙제 개수 숫자 뱃지 */}
                      <div className="w-full flex items-center justify-between">
                        <span
                          className={`text-[11px] sm:text-xs font-bold whitespace-nowrap ${
                            cd.isToday
                              ? 'bg-emerald-600 text-white rounded-full w-5 h-5 flex items-center justify-center -ml-0.5'
                              : isSel
                              ? 'text-emerald-900'
                              : cd.isCurrentMonth
                              ? 'text-slate-700'
                              : 'text-slate-300'
                          }`}
                        >
                          {cd.dayNum}
                        </span>

                        {/* 하루에 여러 숙제가 있을 수 있으므로 숫자 뱃지로 표시 */}
                        {hasHw && (
                          <span
                            className="bg-indigo-600 text-white text-[9px] font-black rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center shadow-2xs shrink-0"
                            title={`숙제 ${cd.stats!.hwCount}개`}
                          >
                            {cd.stats!.hwCount}
                          </span>
                        )}
                      </div>

                      {/* 하단: 유동적 높이의 개별 숙제별 상태바 목록 */}
                      <div className="w-full mt-1.5 flex flex-col gap-1">
                        {hasHw ? (
                          items.length > 0 ? (
                            items.map((item, itemIdx) => (
                              <div
                                key={item.id || itemIdx}
                                className={`w-full rounded-md px-1.5 py-1 text-[10px] font-bold flex items-center justify-between gap-1 leading-tight transition-all ${
                                  item.isDone
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100/70'
                                }`}
                                title={`${item.title}: ${item.isDone ? '완료' : `${item.doneCount}/${cd.stats!.totalStudents} (${item.pct}%)`}`}
                              >
                                <span className="truncate max-w-[50px] sm:max-w-[100px] md:max-w-[130px] font-medium hidden sm:inline">
                                  {item.title}
                                </span>
                                {item.isDone ? (
                                  <span className="flex items-center gap-0.5 text-white font-black ml-auto whitespace-nowrap">
                                    <Check className="w-2.5 h-2.5 shrink-0" />
                                    <span className="text-[9px] sm:text-[10px]">완료</span>
                                  </span>
                                ) : (
                                  <span className="font-extrabold ml-auto whitespace-nowrap text-[9px] sm:text-[10px]">
                                    {item.doneCount}/{cd.stats!.totalStudents}
                                  </span>
                                )}
                              </div>
                            ))
                          ) : (
                            cd.stats!.isAllDone ? (
                              <div
                                className="w-full bg-emerald-600 text-white rounded-md text-[10px] font-bold py-1 flex items-center justify-center gap-0.5 shadow-2xs"
                                title="전원 제출 완료"
                              >
                                <Check className="w-2.5 h-2.5" />
                                <span className="hidden sm:inline">완료</span>
                              </div>
                            ) : (
                              <div
                                className="w-full bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10px] font-black py-1 text-center leading-none"
                                title={`제출 현황: ${cd.stats!.summaryText}`}
                              >
                                {cd.stats!.summaryText}
                              </div>
                            )
                          )
                        ) : (
                          <div className="h-3" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 상단 2: 새 숙제 추가 입력창 */}
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

            {homeworks.length > 0 && (
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

      {/* ────────────────── 1단계: 선택된 날짜의 숙제 목록 ────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-800">
              {selectedHwDate} 등록된 숙제
            </h3>
            <Badge variant="outline" className="bg-slate-100 text-slate-700 text-xs font-bold">
              총 {currentDayHomeworks.length}개
            </Badge>
          </div>
          {currentDayHomeworks.length > 1 && (
            <span className="text-xs text-slate-400">
              💡 아래 숙제 카드를 클릭하면 학생 체크표가 전환됩니다.
            </span>
          )}
        </div>

        {currentDayHomeworks.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-slate-200 p-10 text-center bg-slate-50/50">
            <div className="inline-flex p-3 bg-white text-slate-400 rounded-full mb-2.5 shadow-2xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">이 날짜에 등록된 숙제가 없습니다</h4>
            <p className="text-xs text-slate-400 mt-1">
              선택하신 <span className="font-semibold text-emerald-700">{selectedHwDate}</span> 일자에 숙제를 입력하고 [추가]를 눌러주세요.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentDayHomeworks.map((hw) => {
              const { doneCount, totalCount, pct, isAllDone } = getHwStats(hw.id);
              const isSelected = selectedHw?.id === hw.id;

              return (
                <Card
                  key={hw.id}
                  onClick={() => setSelectedHwId(hw.id)}
                  className={`rounded-2xl transition-all cursor-pointer border relative overflow-hidden ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/80 shadow-md'
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
                          {isSelected && (
                            <Badge className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0 h-4">
                              선택됨
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                          {isAllDone ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0 h-4 gap-0.5">
                              <Check className="w-2.5 h-2.5" /> 전원 완료
                            </Badge>
                          ) : (
                            <span className="font-bold text-emerald-700">
                              제출 {doneCount}/{totalCount}명 ({pct}%)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 카드 액션 버튼들 */}
                      <div
                        className="flex items-center gap-0.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPresMode('single');
                            setPresTargetHw(hw);
                            setIsPresModalOpen(true);
                          }}
                          className="h-7 w-7 p-0 text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"
                          title="칠판 뷰"
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
                        className={`h-full transition-all duration-300 ${isAllDone ? 'bg-emerald-500' : 'bg-emerald-600'}`}
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

      {/* ────────────────── 2단계: 선택된 숙제의 학생 체크표 상세 ────────────────── */}
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

                  <div className="flex items-center gap-1.5">
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
    </div>
  );
}
