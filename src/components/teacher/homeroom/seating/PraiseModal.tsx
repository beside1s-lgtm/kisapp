'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Pin,
  ArrowLeftRight,
  UserX,
  Star,
  Plus,
  Minus,
  RotateCcw,
  Check,
  Award,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import type { DeskSlot } from '@/lib/types/seating';
import { getPraiseTier } from '@/lib/types/seating';
import type { MasterStudent } from '@/lib/types/masterStudent';

interface PraiseModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  targetSlot: DeskSlot | null;
  student: MasterStudent | null;
  classKey?: string;
  onPraiseChange: (slotId: string, delta: number) => void;
  onPraiseReset: (slotId: string) => void;
  onToggleFixed: (slotId: string) => void;
  onStartMove: (slot: DeskSlot) => void;
  onClearSeat: (slotId: string) => void;
}

const PRAISE_REASONS = [
  '적극적인 발표',
  '바른 경청 태도',
  '친구 배려·협동',
  '모둠 활동 솔선수범',
  '과제·청소 완벽',
  '친절과 배려',
];

export const PraiseModal: React.FC<PraiseModalProps> = ({
  isOpen,
  onOpenChange,
  targetSlot,
  student,
  classKey,
  onPraiseChange,
  onPraiseReset,
  onToggleFixed,
  onStartMove,
  onClearSeat,
}) => {
  const [recentReason, setRecentReason] = useState<string | null>(null);

  if (!targetSlot || !targetSlot.studentId) return null;

  const currentPoints = targetSlot.praisePoints || 0;
  const praiseTier = getPraiseTier(currentPoints, classKey);
  const currentGender = student?.gender || targetSlot.studentGender;
  const isFemale =
    currentGender === 'Female' ||
    currentGender === '여' ||
    currentGender === '여자' ||
    currentGender === 'F';
  const isMale = !isFemale;

  const photo = student?.photoUrl || targetSlot.studentPhotoUrl;

  const handleApplyPraise = (delta: number, reason?: string) => {
    onPraiseChange(targetSlot.id, delta);
    if (reason) setRecentReason(reason);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        container={typeof document !== 'undefined' ? (document.fullscreenElement as HTMLElement) || undefined : undefined}
        className="sm:max-w-md p-6 max-h-[90vh] overflow-y-auto z-[99999]"
      >
        <DialogHeader className="pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-base font-bold text-slate-800">
              <Sparkles className="w-5 h-5 text-amber-500" />
              학생 칭찬 & 자리 관리
            </span>
            <Badge variant="outline" className="text-xs font-mono text-slate-500">
              {targetSlot.groupId ? `${targetSlot.groupId}분단/모둠` : '좌석'}
            </Badge>
          </DialogTitle>
          <DialogDescription className="sr-only">
            학생 칭찬 점수 부여 및 좌석 관리
          </DialogDescription>
        </DialogHeader>

        {/* ─── 학생 기본 프로필 및 현재 칭찬 점수 (10점 단위 티어 색상 반영) ─── */}
        <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${praiseTier.cardBgClass} ${praiseTier.cardBorderClass}`}>
          <div className="flex items-center gap-3">
            {photo ? (
              <img
                src={photo}
                alt={targetSlot.studentName || ''}
                className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm"
              />
            ) : (
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-lg border-2 border-white shadow-sm ${
                  isFemale ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {targetSlot.studentName ? targetSlot.studentName.slice(-2) : '학생'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold text-slate-500">
                  {targetSlot.studentNum ? `${targetSlot.studentNum}번` : ''}
                </span>
                <span className="text-base font-black text-slate-900">
                  {targetSlot.studentName}
                </span>
                <Badge
                  className={`text-[10px] px-1.5 py-0 ${
                    isFemale
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}
                >
                  {isFemale ? '여' : '남'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {targetSlot.isFixed ? '📌 자리 고정됨' : '자유 자리'}
              </p>
            </div>
          </div>

          {/* 현재 포인트 배지 (10점 단위 티어 반영: 글씨 대신 직관적인 등급 아이콘 표출) */}
          <div className="flex flex-col items-end">
            <span
              title={`칭찬 등급: ${praiseTier.name} (${currentPoints}점)`}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-lg shadow-xs mb-1 select-none transition-transform hover:scale-110 cursor-help ${praiseTier.badgeClass}`}
            >
              {praiseTier.icon}
            </span>
            <div className={`flex items-center gap-1 text-2xl font-black font-mono ${praiseTier.textColor}`}>
              <Star className={`w-5 h-5 ${praiseTier.starClass}`} />
              <span>{currentPoints}점</span>
            </div>
          </div>
        </div>

        {/* ─── 칭찬 포인트 부여/차감 퀵 버튼 ─── */}
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-800 block">
            칭찬 포인트 주기
          </label>
          <div className="grid grid-cols-4 gap-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.94, y: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              onClick={() => handleApplyPraise(1)}
              className="h-14 flex flex-col items-center justify-center bg-[#C49832] hover:bg-[#B0872A] border-b-4 border-[#8E6D21] text-white rounded-2xl shadow-sm transition-all select-none"
            >
              <span className="text-base font-black">+1</span>
              <span className="text-[10px] text-amber-100 font-bold whitespace-nowrap">참 잘했어요</span>
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.94, y: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              onClick={() => handleApplyPraise(2)}
              className="h-14 flex flex-col items-center justify-center bg-[#2471B2] hover:bg-[#1E629D] border-b-4 border-[#1A5384] text-white rounded-2xl shadow-sm transition-all select-none"
            >
              <span className="text-base font-black">+2</span>
              <span className="text-[10px] text-blue-100 font-bold whitespace-nowrap">적극 발표</span>
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.94, y: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              onClick={() => handleApplyPraise(3)}
              className="h-14 flex flex-col items-center justify-center bg-emerald-600 hover:bg-emerald-700 border-b-4 border-emerald-800 text-white rounded-2xl shadow-sm transition-all select-none"
            >
              <span className="text-base font-black">+3</span>
              <span className="text-[10px] text-emerald-100 font-bold whitespace-nowrap">배려·협동</span>
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.94, y: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              onClick={() => handleApplyPraise(5)}
              className="h-14 flex flex-col items-center justify-center bg-[#B01E23] hover:bg-[#9B191D] border-b-4 border-[#7E1519] text-white rounded-2xl shadow-sm transition-all select-none"
            >
              <span className="text-base font-black">+5</span>
              <span className="text-[10px] text-rose-100 font-bold whitespace-nowrap">대활약 MVP</span>
            </motion.button>
          </div>

          {/* 차감 및 리셋 버튼 */}
          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleApplyPraise(-1)}
              disabled={currentPoints <= 0}
              className="h-7 text-xs text-slate-500 hover:text-rose-600 gap-1"
            >
              <Minus className="w-3.5 h-3.5" />
              <span>1점 차감</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onPraiseReset(targetSlot.id);
                setRecentReason(null);
              }}
              disabled={currentPoints === 0}
              className="h-7 text-xs text-slate-400 hover:text-slate-700 gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>0점 초기화</span>
            </Button>
          </div>
        </div>

        {/* ─── 칭찬 사유 칩 ─── */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 block">
            칭찬 사유 태그 (선택)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRAISE_REASONS.map((reason) => {
              const isSelected = recentReason === reason;
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => handleApplyPraise(1, reason)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-white border-amber-600 font-bold shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                  }`}
                >
                  {reason} {isSelected && '✓'}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── 하단 좌석 관리 액션 (옮기기, 고정, 비우기) (듀오링고 3D 모션 버튼) ─── */}
        <div className="pt-3 border-t-2 border-slate-100 flex items-center justify-between gap-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.95, y: 1 }}
            onClick={() => {
              onOpenChange(false);
              onStartMove(targetSlot);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-2xl text-xs font-black bg-blue-50 text-[#2471B2] border-b-2 border-blue-200 hover:bg-blue-100/80 transition-all select-none whitespace-nowrap"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>자리 옮기기</span>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.95, y: 1 }}
            onClick={() => onToggleFixed(targetSlot.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-2xl text-xs font-black transition-all border-b-2 select-none whitespace-nowrap ${
              targetSlot.isFixed
                ? 'bg-amber-100 text-[#8E6D21] border-[#8E6D21]'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            <Pin className={`w-3.5 h-3.5 ${targetSlot.isFixed ? 'fill-[#C49832] text-[#C49832]' : ''}`} />
            <span>{targetSlot.isFixed ? '고정 해제' : '자리 고정'}</span>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (confirm(`${targetSlot.studentName} 학생을 좌석에서 비우시겠습니까?`)) {
                onClearSeat(targetSlot.id);
                onOpenChange(false);
              }
            }}
            className="h-10 px-3.5 rounded-2xl text-xs font-black text-[#B01E23] hover:bg-rose-50 border border-rose-200 transition-all select-none whitespace-nowrap"
          >
            <UserX className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">비우기</span>
          </motion.button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
