'use client';

import React, { useState } from 'react';
import {
  Users,
  X,
  Sparkles,
  ClipboardList,
  Zap,
  Dice6,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface TeamSplitOptions {
  method: 'GENDER_BALANCE' | 'RANDOM' | 'NUMBER_ORDER';
  teamCount: number;
}

interface SeatingTeamBarProps {
  isOpen: boolean;
  onClose: () => void;
  totalStudentsCount: number;
  isTeaming: boolean;
  onStartTeamSplit: (options: TeamSplitOptions) => void;
  onOpenTeamList: () => void;
  hasExistingTeams: boolean;
  existingTeamCount: number;
}

export const SeatingTeamBar: React.FC<SeatingTeamBarProps> = ({
  isOpen,
  onClose,
  totalStudentsCount,
  isTeaming,
  onStartTeamSplit,
  onOpenTeamList,
  hasExistingTeams,
  existingTeamCount,
}) => {
  const [method, setMethod] = useState<'GENDER_BALANCE' | 'RANDOM' | 'NUMBER_ORDER'>('GENDER_BALANCE');
  const [teamCount, setTeamCount] = useState<number>(4);

  if (!isOpen) return null;

  const approxPerTeam = totalStudentsCount > 0 ? Math.ceil(totalStudentsCount / teamCount) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -16, height: 0 }}
        transition={{ type: 'spring', stiffness: 450, damping: 28 }}
        className="w-full bg-gradient-to-r from-rose-50 via-red-50/80 to-rose-50 border-2 border-[#B01E23] rounded-2xl p-2.5 sm:p-3 shadow-md mb-2 overflow-hidden select-none"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          {/* 좌측: 타이틀 및 나누기 방식 / 팀 수 선택 */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-xl bg-[#B01E23] flex items-center justify-center text-white shadow-xs shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight shrink-0">
                팀 나누기
              </span>
            </div>

            {/* 나누기 방식 드롭다운 */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">방식:</span>
              <Select
                value={method}
                onValueChange={(val: any) => setMethod(val)}
                disabled={isTeaming}
              >
                <SelectTrigger className="h-7 text-xs font-bold bg-white border-rose-300 rounded-lg px-2 w-[115px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[99999]">
                  <SelectItem value="GENDER_BALANCE" className="text-xs font-bold">
                    남녀 성별 균형
                  </SelectItem>
                  <SelectItem value="RANDOM" className="text-xs font-bold">
                    완전 무작위
                  </SelectItem>
                  <SelectItem value="NUMBER_ORDER" className="text-xs font-bold">
                    번호 지그재그
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 생성할 팀 수 드롭다운 */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">팀 수:</span>
              <Select
                value={String(teamCount)}
                onValueChange={(val) => setTeamCount(Number(val))}
                disabled={isTeaming}
              >
                <SelectTrigger className="h-7 text-xs font-bold bg-white border-rose-300 rounded-lg px-2 w-[85px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[99999]">
                  {[2, 3, 4, 5, 6, 8].map((n) => (
                    <SelectItem key={n} value={String(n)} className="text-xs font-bold">
                      {n}개 팀
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 인원수 안내 배지 */}
            <Badge className="bg-rose-100 text-[#B01E23] border border-rose-200 text-[10px] font-bold px-1.5 py-0.5 h-6 shrink-0">
              팀당 약 {approxPerTeam}명 ({totalStudentsCount}명 기준)
            </Badge>

            {/* 팀별 명단 보기 메뉴 버튼 */}
            <button
              type="button"
              onClick={onOpenTeamList}
              disabled={isTeaming}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-white hover:bg-rose-100/70 text-slate-700 border border-rose-300 shadow-2xs transition-colors cursor-pointer shrink-0"
              title="현재 팀별 명단 보기 및 팀 이름/색상 편집"
            >
              <ClipboardList className="w-3.5 h-3.5 text-[#B01E23]" />
              <span>팀별 명단 보기</span>
              {hasExistingTeams && (
                <span className="text-[10px] bg-rose-200 text-[#B01E23] px-1 py-0.2 rounded-full font-black">
                  {existingTeamCount}팀
                </span>
              )}
            </button>
          </div>

          {/* 우측: 팀 나누기 실행 버튼 및 닫기 버튼 */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <motion.button
              type="button"
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onStartTeamSplit({ method, teamCount })}
              disabled={isTeaming}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-black text-xs text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 border-b-4 border-red-900 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap className={`w-3.5 h-3.5 ${isTeaming ? 'animate-bounce' : ''}`} />
              <span>{isTeaming ? '자리 색상 셔플 중...' : '⚡ 팀 나누기 실행'}</span>
            </motion.button>

            <button
              type="button"
              onClick={onClose}
              disabled={isTeaming}
              title="팀 나누기 탭 바 닫기"
              className="w-7 h-7 rounded-xl flex items-center justify-center bg-white hover:bg-slate-100 text-slate-500 border border-slate-300 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
