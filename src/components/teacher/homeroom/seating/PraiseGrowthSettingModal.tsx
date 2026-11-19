'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sprout, Star, Sparkles, Check, RotateCcw, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

export interface PraiseTierLevel {
  level: number;
  minPoints: number;
  maxPoints: number;
  name: string;
  icon: string;
  desc: string;
  badgeClass: string;
  starClass: string;
  cardBorderClass: string;
  cardBgClass: string;
}

export const DEFAULT_GROWTH_TIERS: PraiseTierLevel[] = [
  {
    level: 0,
    minPoints: 0,
    maxPoints: 9,
    name: '새싹',
    icon: '🌱',
    desc: '첫걸음을 떼는 귀여운 새싹',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    starClass: 'fill-amber-400 text-amber-500',
    cardBorderClass: 'border-amber-300',
    cardBgClass: 'bg-amber-50/60',
  },
  {
    level: 1,
    minPoints: 10,
    maxPoints: 19,
    name: '줄기 (에메랄드)',
    icon: '🌿',
    desc: '무럭무럭 쑥쑥 자라나는 줄기',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-400 font-black',
    starClass: 'fill-emerald-400 text-emerald-600',
    cardBorderClass: 'border-emerald-400',
    cardBgClass: 'bg-emerald-50/70',
  },
  {
    level: 2,
    minPoints: 20,
    maxPoints: 29,
    name: '꽃봉오리 (사파이어)',
    icon: '🌸',
    desc: '아름다운 성장을 피워내는 꽃봉오리',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-400 font-black',
    starClass: 'fill-sky-400 text-sky-600',
    cardBorderClass: 'border-sky-400',
    cardBgClass: 'bg-sky-50/70',
  },
  {
    level: 3,
    minPoints: 30,
    maxPoints: 39,
    name: '열매 (자수정)',
    icon: '🍇',
    desc: '알찬 노력의 결실을 맺은 열매',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-400 font-black',
    starClass: 'fill-purple-400 text-purple-600',
    cardBorderClass: 'border-purple-400',
    cardBgClass: 'bg-purple-50/70',
  },
  {
    level: 4,
    minPoints: 40,
    maxPoints: 49,
    name: '나무 (루비)',
    icon: '🌳',
    desc: '친구들에게 그늘이 되어주는 든든한 나무',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-400 font-black',
    starClass: 'fill-rose-400 text-rose-600',
    cardBorderClass: 'border-rose-400',
    cardBgClass: 'bg-rose-50/70',
  },
  {
    level: 5,
    minPoints: 50,
    maxPoints: 999,
    name: '황금숲 (골드 마스터)',
    icon: '👑',
    desc: '학급의 자랑! 빛나는 명예의 전당',
    badgeClass: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-300 text-amber-950 border-amber-500 font-black',
    starClass: 'fill-amber-700 text-amber-800',
    cardBorderClass: 'border-amber-400 ring-2 ring-amber-300',
    cardBgClass: 'bg-gradient-to-br from-amber-50 via-yellow-50/60 to-orange-50/40',
  },
];

export function getSavedGrowthTiers(classKey: string): PraiseTierLevel[] {
  if (typeof window === 'undefined') return DEFAULT_GROWTH_TIERS;
  try {
    const raw = localStorage.getItem(`kis_praise_growth_tiers_${classKey}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_GROWTH_TIERS;
}

export function saveGrowthTiers(classKey: string, tiers: PraiseTierLevel[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`kis_praise_growth_tiers_${classKey}`, JSON.stringify(tiers));
    window.dispatchEvent(new CustomEvent('class-praise-tiers-updated', { detail: { classKey, tiers } }));
  } catch (e) {
    console.error('Failed to save growth tiers:', e);
  }
}

interface PraiseGrowthSettingModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  classKey: string;
}

export const PraiseGrowthSettingModal: React.FC<PraiseGrowthSettingModalProps> = ({
  isOpen,
  onOpenChange,
  classKey,
}) => {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<PraiseTierLevel[]>(DEFAULT_GROWTH_TIERS);

  useEffect(() => {
    if (isOpen) {
      setTiers(getSavedGrowthTiers(classKey));
    }
  }, [isOpen, classKey]);

  const handleNameChange = (idx: number, newName: string) => {
    setTiers((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, name: newName } : t))
    );
  };

  const handleMinPointsChange = (idx: number, newPoints: number) => {
    if (idx === 0) return; // 0단계는 0점 고정
    setTiers((prev) =>
      prev.map((t, i) => {
        if (i === idx) {
          return { ...t, minPoints: Math.max(1, newPoints) };
        }
        if (i === idx - 1) {
          return { ...t, maxPoints: Math.max(1, newPoints - 1) };
        }
        return t;
      })
    );
  };

  const handleResetToDefault = () => {
    setTiers(DEFAULT_GROWTH_TIERS);
    saveGrowthTiers(classKey, DEFAULT_GROWTH_TIERS);
    toast({
      title: '기본 칭찬 성장 체계 복원',
      description: '새싹 → 줄기 → 꽃봉오리 → 열매 → 나무 → 황금숲 기본값으로 복원되었습니다.',
    });
  };

  const handleSave = () => {
    saveGrowthTiers(classKey, tiers);
    toast({
      title: '칭찬 성장 체계 저장 완료',
      description: '학생들의 칭찬 점수 성장 단계와 등급 명칭이 저장되었습니다.',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-6 max-h-[90vh] overflow-y-auto rounded-3xl border-2 border-slate-200">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-base font-black text-slate-900">
              <Sprout className="w-5 h-5 text-emerald-600" />
              <span>칭찬 성장 체계 및 등급 가이드</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetToDefault}
              className="text-xs text-slate-500 hover:text-slate-800 h-8 gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>기본값 복원</span>
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">칭찬 점수가 쌓일수록 학생 카드의 등급과 색상이 진화합니다!</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                아래에서 각 성장 단계의 이름과 필요 점수를 학급 상황에 맞게 직접 편집할 수 있습니다.
              </p>
            </div>
          </div>

          {/* 성장 단계 목록 */}
          <div className="space-y-2.5">
            {tiers.map((tier, idx) => (
              <motion.div
                key={tier.level}
                whileHover={{ scale: 1.01 }}
                className={`p-3 rounded-2xl border-2 ${tier.cardBorderClass} ${tier.cardBgClass} flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl shrink-0 select-none">{tier.icon}</span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        Lv.{tier.level}
                      </span>
                      <Input
                        type="text"
                        value={tier.name}
                        onChange={(e) => handleNameChange(idx, e.target.value)}
                        className="h-8 text-xs font-black w-40 sm:w-44 bg-white/90 border border-slate-300 rounded-xl px-2"
                        placeholder="등급 명칭 입력..."
                      />
                      <Badge className={`text-[10px] px-2 py-0.5 ${tier.badgeClass}`}>
                        미리보기
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">{tier.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 bg-white/80 p-1.5 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-600">기준:</span>
                  {idx === 0 ? (
                    <span className="text-xs font-mono font-black text-slate-700 px-2">
                      0점 ~ {tier.maxPoints}점
                    </span>
                  ) : idx === tiers.length - 1 ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="1"
                        max="999"
                        value={tier.minPoints}
                        onChange={(e) => handleMinPointsChange(idx, Number(e.target.value) || 0)}
                        className="h-7 w-16 text-xs font-mono font-black text-center bg-white border rounded-lg px-1"
                      />
                      <span className="text-xs font-bold text-slate-700">점 이상</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="1"
                        max="999"
                        value={tier.minPoints}
                        onChange={(e) => handleMinPointsChange(idx, Number(e.target.value) || 0)}
                        className="h-7 w-16 text-xs font-mono font-black text-center bg-white border rounded-lg px-1"
                      />
                      <span className="text-xs font-bold text-slate-500">~</span>
                      <span className="text-xs font-mono font-black text-slate-700">{tier.maxPoints}점</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-2xl text-xs font-bold h-10"
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="rounded-2xl text-xs font-black h-10 bg-[#2471B2] hover:bg-[#1E629D] text-white border-b-2 border-[#1A5384] shadow-xs"
          >
            <Check className="w-4 h-4 mr-1" />
            성장 체계 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
