'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Trophy,
  Star,
  RotateCcw,
  Check,
  Award,
  X,
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
import { motion, AnimatePresence } from 'framer-motion';
import type { DeskSlot } from '@/lib/types/seating';
import { getPraiseTier } from '@/lib/types/seating';
import type { MasterStudent } from '@/lib/types/masterStudent';

interface PickerResultModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  winners: DeskSlot[];
  studentsMap: Map<string, MasterStudent>;
  classKey?: string;
  onGrantPraise: (slotId: string, delta: number) => void;
  onRePick: () => void;
}

export const PickerResultModal: React.FC<PickerResultModalProps> = ({
  isOpen,
  onOpenChange,
  winners,
  studentsMap,
  classKey,
  onGrantPraise,
  onRePick,
}) => {
  const [praisedIds, setPraisedIds] = useState<Set<string>>(new Set());

  if (!winners || winners.length === 0) return null;

  const handlePraise = (slotId: string) => {
    onGrantPraise(slotId, 1);
    setPraisedIds((prev) => new Set(prev).add(slotId));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        container={typeof document !== 'undefined' ? (document.fullscreenElement as HTMLElement) || undefined : undefined}
        className="sm:max-w-xl p-6 overflow-hidden z-[99999] border-2 border-amber-300 bg-gradient-to-b from-amber-50/90 via-white to-amber-50/50"
      >
        <DialogHeader className="pb-3 border-b border-amber-200/80 text-center relative">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-white shadow-md mb-2 animate-bounce">
            <Trophy className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-1.5">
            <Sparkles className="w-5 h-5 text-amber-500 animate-spin-slow" />
            <span>오늘의 당첨자 발표!</span>
            <Sparkles className="w-5 h-5 text-amber-500 animate-spin-slow" />
          </DialogTitle>
          <DialogDescription className="text-xs font-bold text-amber-800">
            총 {winners.length}명의 학생이 멋지게 선정되었습니다! 축하합니다! 🎉
          </DialogDescription>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-0 right-0 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </DialogHeader>

        {/* 당첨자 카드 그리드 */}
        <div className="py-4 max-h-[60vh] overflow-y-auto">
          <div
            className={`grid gap-3 ${
              winners.length === 1
                ? 'grid-cols-1 max-w-[280px] mx-auto'
                : winners.length === 2
                ? 'grid-cols-2'
                : winners.length <= 4
                ? 'grid-cols-2'
                : 'grid-cols-2 sm:grid-cols-3'
            }`}
          >
            {winners.map((slot) => {
              const student = slot.studentId ? studentsMap.get(slot.studentId) : null;
              const photo = student?.photoUrl || slot.studentPhotoUrl;
              const isFemale = slot.studentGender === 'Female' || slot.studentGender === '여';
              const currentPraise = slot.praisePoints || 0;
              const tier = getPraiseTier(currentPraise, classKey);
              const isPraised = praisedIds.has(slot.id);

              return (
                <motion.div
                  key={slot.id}
                  initial={{ scale: 0.8, opacity: 0, y: 15 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-between text-center relative shadow-sm border-b-4 ${tier.cardBgClass} ${tier.cardBorderClass}`}
                >
                  {/* 상단: 번호 및 칭찬 등급 아이콘 */}
                  <div className="w-full flex items-center justify-between text-xs mb-1">
                    <span className="font-mono font-bold text-slate-500">
                      {slot.studentNum ? `${slot.studentNum}번` : ''}
                    </span>
                    <span
                      title={`칭찬 등급: ${tier.name}`}
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs shadow-2xs ${tier.badgeClass}`}
                    >
                      {tier.icon}
                    </span>
                  </div>

                  {/* 중앙 사진 */}
                  <div className="my-1.5">
                    {photo ? (
                      <img
                        src={photo}
                        alt={slot.studentName || ''}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 sm:border-[2.5px] border-amber-300 shadow-md"
                      />
                    ) : (
                      <div
                        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-black text-xl border-2 shadow-md ${
                          isFemale ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {slot.studentName ? slot.studentName.slice(-2) : '학생'}
                      </div>
                    )}
                  </div>

                  {/* 학생 이름 & 성별 */}
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      {slot.studentName}
                    </span>
                    {slot.studentGender && (
                      <Badge
                        className={`text-[9px] px-1 py-0 h-4 ${
                          isFemale
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {isFemale ? '여' : '남'}
                      </Badge>
                    )}
                  </div>

                  {/* 하단 칭찬 도장 원터치 버튼 */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handlePraise(slot.id)}
                    disabled={isPraised}
                    className={`w-full py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer ${
                      isPraised
                        ? 'bg-emerald-500 text-white cursor-default'
                        : 'bg-amber-400 hover:bg-amber-500 text-slate-900 border-b-2 border-amber-600'
                    }`}
                  >
                    {isPraised ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>칭찬 완료 (+1)</span>
                      </>
                    ) : (
                      <>
                        <Star className="w-3.5 h-3.5 fill-amber-700 text-amber-700" />
                        <span>칭찬 도장 +1</span>
                      </>
                    )}
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* 하단 버튼 바 */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRePick}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border-slate-300"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>다시 뽑기</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="px-5 text-xs font-black bg-[#2471B2] hover:bg-[#1E629D] text-white shadow-sm"
          >
            확인
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
