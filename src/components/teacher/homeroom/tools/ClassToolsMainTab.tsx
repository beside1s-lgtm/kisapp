'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutGrid,
  Award,
  Dice5,
  Users,
  BookOpen,
  CheckCircle2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MasterStudent } from '@/lib/types/masterStudent';
import type { HomeroomHomework, HomeroomHomeworkCheck } from '@/lib/types/homeroomClass';
import { SeatingTabContent } from '../seating/SeatingTabContent';
import { PraiseTabContent } from './PraiseTabContent';
import { RandomPickerTab } from './RandomPickerTab';
import { TeamGeneratorTab } from './TeamGeneratorTab';
import { MemoTabContent } from '../class-management/MemoTabContent';
import { HomeworkTabContent } from '../class-management/HomeworkTabContent';

export type ClassToolType = 'seating' | 'praise' | 'picker' | 'teams' | 'memo' | 'homework';

export interface ClassToolsMainTabProps {
  classKey: string;
  classLabel: string;
  students: MasterStudent[];
  userEmail?: string;
  initialTool?: ClassToolType;
  // ─── 칠판 알림 props ───
  memoProps?: {
    todayDisplay: string;
    memoContent: string;
    setMemoContent: (val: string) => void;
    handleSaveMemo: () => void;
    handleOpenMemoHistory: () => void;
    setIsMemoFullscreenOpen: (open: boolean) => void;
  };
  // ─── 숙제 확인 props ───
  homeworkProps?: {
    dateNavMode: 'dropdown' | 'calendar';
    setDateNavMode: (mode: 'dropdown' | 'calendar') => void;
    selectedHwDate: string;
    setSelectedHwDate: (date: string) => void;
    calCurrentDate: Date;
    setCalCurrentDate: (date: Date) => void;
    todayStr: string;
    registeredDates: string[];
    dateStatsMap: Map<string, any>;
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
    handleToggleHwCheck: (hwId: string, studentId: string, studentName: string) => void;
    handleBatchToggleHw: (hwId: string) => void;
    calendarDays: any[];
    onToggleConfirm?: (hwId: string, isConfirmed: boolean) => void;
    activeHwCount?: number;
  };
}

export const ClassToolsMainTab: React.FC<ClassToolsMainTabProps> = ({
  classKey,
  classLabel,
  students,
  userEmail,
  initialTool = 'seating',
  memoProps,
  homeworkProps,
}) => {
  const [activeTool, setActiveTool] = useState<ClassToolType>(initialTool);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [isTeamOpen, setIsTeamOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // initialTool 변경 시 동기화
  useEffect(() => {
    if (initialTool) {
      setActiveTool(initialTool);
    }
  }, [initialTool]);

  // 브라우저 전체화면 이벤트 동기화 (ESC 누름 감지)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isDocFs = Boolean(document.fullscreenElement);
      setIsFullscreen(isDocFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // 전체화면 토글
  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && !isFullscreen) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any)?.webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      // API 미지원 브라우저인 경우 CSS fixed 오버레이 모드로 작동
      setIsFullscreen((prev) => !prev);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`w-full transition-colors duration-200 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-gradient-to-b from-slate-50 via-white to-blue-50/20 p-2 sm:p-2.5 overflow-hidden flex flex-col h-screen max-h-screen select-none'
          : 'space-y-3 sm:space-y-4'
      }`}
    >
      {/* ─── 수업 도구 상단 컨트롤 바 (화면이 좁아지더라도 절대 줄바꿈 없는 한 줄 flex-nowrap) ─── */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 p-1 sm:p-1.5 bg-white/95 backdrop-blur-sm rounded-2xl sm:rounded-3xl border-2 border-slate-200/90 shadow-sm shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
        {/* 서브 도구 선택 탭군 (6대 핵심 도구 컴팩트 축약형) */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap shrink-0">
          {/* 1. 자리 배치 (학교 공식 블루 #2471B2) */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.96, y: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            onClick={() => {
              setActiveTool('seating');
              setIsPickerOpen(false);
              setIsTeamOpen(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl font-black text-xs sm:text-sm tracking-tight transition-all select-none whitespace-nowrap break-keep shrink-0 cursor-pointer ${
              activeTool === 'seating' && !isPickerOpen && !isTeamOpen
                ? 'bg-[#2471B2] text-white border-b-4 border-[#1A5384] shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border-b-4 border-slate-300'
            }`}
          >
            <LayoutGrid className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTool === 'seating' && !isPickerOpen && !isTeamOpen ? 'text-white' : 'text-[#2471B2]'}`} />
            <span>자리 배치</span>
          </motion.button>

          {/* 2. 칭찬 (신규 분리: 학교 공식 골드 #C49832) */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.96, y: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            onClick={() => {
              setActiveTool('praise');
              setIsPickerOpen(false);
              setIsTeamOpen(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl font-black text-xs sm:text-sm tracking-tight transition-all select-none whitespace-nowrap break-keep shrink-0 cursor-pointer ${
              activeTool === 'praise'
                ? 'bg-[#C49832] text-white border-b-4 border-[#8E6D21] shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border-b-4 border-slate-300'
            }`}
          >
            <Award className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTool === 'praise' ? 'text-white' : 'text-[#C49832]'}`} />
            <span>칭찬</span>
          </motion.button>

          {/* 3. 뽑기 (자리 배치 화면 내 슬라이드 다운 탭 바: 학교 공식 골드 #C49832) */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.96, y: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            onClick={() => {
              setActiveTool('seating');
              setIsPickerOpen((prev) => !prev);
              setIsTeamOpen(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl font-black text-xs sm:text-sm tracking-tight transition-all select-none whitespace-nowrap break-keep shrink-0 cursor-pointer ${
              activeTool === 'seating' && isPickerOpen
                ? 'bg-[#C49832] text-white border-b-4 border-[#8E6D21] shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border-b-4 border-slate-300'
            }`}
          >
            <Dice5 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTool === 'seating' && isPickerOpen ? 'text-white' : 'text-[#C49832]'}`} />
            <span>뽑기</span>
          </motion.button>

          {/* 4. 팀 나누기 (자리 배치 화면 내 슬라이드 다운 탭 바: 학교 공식 레드 #B01E23) */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.96, y: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            onClick={() => {
              setActiveTool('seating');
              setIsTeamOpen((prev) => !prev);
              setIsPickerOpen(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl font-black text-xs sm:text-sm tracking-tight transition-all select-none whitespace-nowrap break-keep shrink-0 cursor-pointer ${
              activeTool === 'seating' && isTeamOpen
                ? 'bg-[#B01E23] text-white border-b-4 border-[#7E1519] shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border-b-4 border-slate-300'
            }`}
          >
            <Users className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTool === 'seating' && isTeamOpen ? 'text-white' : 'text-[#B01E23]'}`} />
            <span>팀 나누기</span>
          </motion.button>

          {/* 5. 칠판 (칠판 알림 축약형: 학교 공식 블루 #2471B2) */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.96, y: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            onClick={() => {
              setActiveTool('memo');
              setIsPickerOpen(false);
              setIsTeamOpen(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl font-black text-xs sm:text-sm tracking-tight transition-all select-none whitespace-nowrap break-keep shrink-0 cursor-pointer ${
              activeTool === 'memo'
                ? 'bg-[#2471B2] text-white border-b-4 border-[#1A5384] shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border-b-4 border-slate-300'
            }`}
          >
            <BookOpen className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTool === 'memo' ? 'text-white' : 'text-[#2471B2]'}`} />
            <span>칠판</span>
          </motion.button>

          {/* 6. 숙제 (숙제 확인 축약형: 학교 공식 골드 #C49832) */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.96, y: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            onClick={() => {
              setActiveTool('homework');
              setIsPickerOpen(false);
              setIsTeamOpen(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl font-black text-xs sm:text-sm tracking-tight transition-all select-none whitespace-nowrap break-keep shrink-0 cursor-pointer ${
              activeTool === 'homework'
                ? 'bg-[#C49832] text-white border-b-4 border-[#8E6D21] shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border-b-4 border-slate-300'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTool === 'homework' ? 'text-white' : 'text-[#C49832]'}`} />
            <span>숙제</span>
            {homeworkProps?.activeHwCount && homeworkProps.activeHwCount > 0 ? (
              <span
                className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTool === 'homework'
                    ? 'bg-white text-[#8E6D21] shadow-xs'
                    : 'bg-[#C49832] text-white'
                }`}
              >
                {homeworkProps.activeHwCount}
              </span>
            ) : null}
          </motion.button>
        </div>

        {/* 우측: 전체화면 토글 버튼 (아이콘만 남김, 컴팩트한 사각 듀오링고 3D) */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0 pl-1">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95, y: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            onClick={handleToggleFullscreen}
            title={isFullscreen ? '전체화면 종료 (ESC)' : '교실 화면 전체를 덮는 전체화면 모드로 보기'}
            className={`flex items-center justify-center p-2 sm:p-2.5 rounded-2xl font-black select-none border-b-4 transition-all shadow-sm shrink-0 cursor-pointer ${
              isFullscreen
                ? 'bg-[#B01E23] hover:bg-[#9B191D] border-[#7E1519] text-white'
                : 'bg-[#2471B2] hover:bg-[#1E629D] border-[#1A5384] text-white'
            }`}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-white" />
            ) : (
              <Maximize2 className="w-4 h-4 text-white" />
            )}
          </motion.button>
        </div>
      </div>

      {/* ─── 메인 뷰 컨테이너 (디스플레이 크기에 맞게 꽉 채우고 스크롤 원천 차단) ─── */}
      <div className={`w-full flex-1 min-h-0 ${isFullscreen ? 'mt-1.5 sm:mt-2 flex flex-col overflow-hidden' : ''}`}>
        <AnimatePresence mode="wait">
          {/* 1. 자리 배치 관리 */}
          {activeTool === 'seating' && (
            <motion.div
              key="seating"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={isFullscreen ? 'w-full h-full flex-1 min-h-0 flex flex-col overflow-hidden' : 'w-full'}
            >
              <SeatingTabContent
                classKey={classKey}
                classLabel={classLabel}
                students={students}
                userEmail={userEmail}
                isFullscreen={isFullscreen}
                isPickerBarOpen={isPickerOpen}
                onClosePickerBar={() => setIsPickerOpen(false)}
                isTeamBarOpen={isTeamOpen}
                onCloseTeamBar={() => setIsTeamOpen(false)}
              />
            </motion.div>
          )}

          {/* 2. 칭찬 관리 (칭찬 온도계 + 학생 칭찬 도장판 전용 뷰) */}
          {activeTool === 'praise' && (
            <motion.div
              key="praise"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <PraiseTabContent
                classKey={classKey}
                classLabel={classLabel}
                students={students}
                userEmail={userEmail}
                isFullscreen={isFullscreen}
              />
            </motion.div>
          )}

          {/* 3. 발표자 뽑기 (1~12명) */}
          {activeTool === 'picker' && (
            <motion.div
              key="picker"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <RandomPickerTab
                students={students}
                classLabel={classLabel}
                isFullscreen={isFullscreen}
              />
            </motion.div>
          )}

          {/* 4. 팀 나누기 (모둠 분할) */}
          {activeTool === 'teams' && (
            <motion.div
              key="teams"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <TeamGeneratorTab
                students={students}
                classLabel={classLabel}
                classKey={classKey}
                isFullscreen={isFullscreen}
              />
            </motion.div>
          )}

          {/* 5. 칠판 (대형 칠판 에디터) */}
          {activeTool === 'memo' && memoProps && (
            <motion.div
              key="memo"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <MemoTabContent
                todayDisplay={memoProps.todayDisplay}
                memoContent={memoProps.memoContent}
                setMemoContent={memoProps.setMemoContent}
                handleSaveMemo={memoProps.handleSaveMemo}
                handleOpenMemoHistory={memoProps.handleOpenMemoHistory}
                setIsMemoFullscreenOpen={memoProps.setIsMemoFullscreenOpen}
                isFullscreen={isFullscreen}
              />
            </motion.div>
          )}

          {/* 6. 숙제 (과제 체크 대시보드) */}
          {activeTool === 'homework' && homeworkProps && (
            <motion.div
              key="homework"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <HomeworkTabContent
                dateNavMode={homeworkProps.dateNavMode}
                setDateNavMode={homeworkProps.setDateNavMode}
                selectedHwDate={homeworkProps.selectedHwDate}
                setSelectedHwDate={homeworkProps.setSelectedHwDate}
                calCurrentDate={homeworkProps.calCurrentDate}
                setCalCurrentDate={homeworkProps.setCalCurrentDate}
                todayStr={homeworkProps.todayStr}
                registeredDates={homeworkProps.registeredDates}
                dateStatsMap={homeworkProps.dateStatsMap}
                newHwTitle={homeworkProps.newHwTitle}
                setNewHwTitle={homeworkProps.setNewHwTitle}
                handleAddHomework={homeworkProps.handleAddHomework}
                homeworks={homeworkProps.homeworks}
                setPresMode={homeworkProps.setPresMode}
                setIsPresModalOpen={homeworkProps.setIsPresModalOpen}
                currentDayHomeworks={homeworkProps.currentDayHomeworks}
                getHwStats={homeworkProps.getHwStats}
                selectedHw={homeworkProps.selectedHw}
                setSelectedHwId={homeworkProps.setSelectedHwId}
                setPresTargetHw={homeworkProps.setPresTargetHw}
                setEditingHw={homeworkProps.setEditingHw}
                setEditHwTitle={homeworkProps.setEditHwTitle}
                handleDeleteHomework={homeworkProps.handleDeleteHomework}
                homeworkChecks={homeworkProps.homeworkChecks}
                students={students}
                handleToggleHwCheck={homeworkProps.handleToggleHwCheck}
                handleBatchToggleHw={homeworkProps.handleBatchToggleHw}
                calendarDays={homeworkProps.calendarDays}
                classLabel={classLabel}
                onToggleConfirm={homeworkProps.onToggleConfirm}
                isFullscreen={isFullscreen}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
