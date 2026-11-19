'use client';

import React, { useState } from 'react';
import {
  Dice5,
  X,
  Users,
  Sparkles,
  RotateCcw,
  Plus,
  Minus,
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

export interface PickerOptions {
  count: number;
  genderFilter: 'all' | 'male' | 'female';
  avoidPrevious: boolean;
}

interface SeatingPickerBarProps {
  isOpen: boolean;
  onClose: () => void;
  totalStudentsCount: number;
  isPicking: boolean;
  onStartPick: (options: PickerOptions) => void;
  pickedHistoryCount: number;
  onResetHistory: () => void;
}

export const SeatingPickerBar: React.FC<SeatingPickerBarProps> = ({
  isOpen,
  onClose,
  totalStudentsCount,
  isPicking,
  onStartPick,
  pickedHistoryCount,
  onResetHistory,
}) => {
  const [count, setCount] = useState<number>(1);
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [avoidPrevious, setAvoidPrevious] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleMinus = () => setCount((prev) => Math.max(1, prev - 1));
  const handlePlus = () => setCount((prev) => Math.min(Math.min(12, totalStudentsCount || 12), prev + 1));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -16, height: 0 }}
        transition={{ type: 'spring', stiffness: 450, damping: 28 }}
        className="w-full bg-gradient-to-r from-amber-50 via-yellow-50/80 to-amber-50 border-2 border-[#C49832] rounded-2xl p-2.5 sm:p-3 shadow-md mb-2 overflow-hidden select-none"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          {/* 좌측: 타이틀 및 인원수 선택 */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-xl bg-[#C49832] flex items-center justify-center text-white shadow-xs shrink-0">
                <Dice5 className="w-4 h-4 animate-spin-slow" />
              </div>
              <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight shrink-0">
                발표자 뽑기
              </span>
            </div>

            {/* 인원수 증감 컨트롤 */}
            <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-xl border border-amber-300 shadow-2xs shrink-0">
              <span className="text-[11px] font-bold text-slate-500 mr-1">뽑을 인원:</span>
              <button
                type="button"
                onClick={handleMinus}
                disabled={count <= 1 || isPicking}
                className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs font-black font-mono w-6 text-center text-[#8E6D21]">
                {count}명
              </span>
              <button
                type="button"
                onClick={handlePlus}
                disabled={count >= totalStudentsCount || isPicking}
                className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* 빠른 인원 버튼 */}
            <div className="hidden md:flex items-center gap-1 shrink-0">
              {[1, 2, 3, 4, 6].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setCount(cnt)}
                  disabled={isPicking}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                    count === cnt
                      ? 'bg-[#C49832] text-white border-[#8E6D21] shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-amber-100/60 border-slate-200'
                  }`}
                >
                  {cnt}명
                </button>
              ))}
            </div>

            {/* 성별 필터 */}
            <Select
              value={genderFilter}
              onValueChange={(val: any) => setGenderFilter(val)}
              disabled={isPicking}
            >
              <SelectTrigger className="h-7 text-xs font-bold bg-white border-amber-300 rounded-lg px-2 w-[100px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[99999]">
                <SelectItem value="all" className="text-xs font-bold">
                  전체 학생
                </SelectItem>
                <SelectItem value="male" className="text-xs font-bold">
                  남학생만
                </SelectItem>
                <SelectItem value="female" className="text-xs font-bold">
                  여학생만
                </SelectItem>
              </SelectContent>
            </Select>

            {/* 이전 당첨자 제외 체크박스 */}
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={avoidPrevious}
                onChange={(e) => setAvoidPrevious(e.target.checked)}
                disabled={isPicking}
                className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
              />
              <span>중복 제외</span>
              {pickedHistoryCount > 0 && (
                <Badge className="bg-amber-200 text-amber-900 text-[9px] px-1 py-0 border-0 h-3.5">
                  {pickedHistoryCount}명 완료
                </Badge>
              )}
            </label>

            {pickedHistoryCount > 0 && (
              <button
                type="button"
                onClick={onResetHistory}
                disabled={isPicking}
                className="text-[10px] text-slate-400 hover:text-slate-700 underline flex items-center gap-0.5 cursor-pointer shrink-0"
                title="뽑기 이력 초기화"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                이력 리셋
              </button>
            )}
          </div>

          {/* 우측: 뽑기 시작 버튼 및 닫기 버튼 */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <motion.button
              type="button"
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onStartPick({ count, genderFilter, avoidPrevious })}
              disabled={isPicking}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-black text-xs text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 border-b-4 border-amber-800 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Dice5 className={`w-3.5 h-3.5 ${isPicking ? 'animate-spin' : ''}`} />
              <span>{isPicking ? '자리 룰렛 회전 중...' : '🎲 발표자 뽑기 시작'}</span>
            </motion.button>

            <button
              type="button"
              onClick={onClose}
              disabled={isPicking}
              title="뽑기 탭 바 닫기"
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
