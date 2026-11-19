'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, PartyPopper, CheckCircle2 } from 'lucide-react';

interface CountdownOverlayProps {
  isOpen: boolean;
  onFinished: () => void;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  isOpen,
  onFinished,
}) => {
  const [count, setCount] = useState<number>(3);
  const [showStart, setShowStart] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setCount(3);
      setShowStart(false);
      return;
    }

    setCount(3);
    setShowStart(false);

    const timer1 = setTimeout(() => {
      setCount(2);
    }, 800);

    const timer2 = setTimeout(() => {
      setCount(1);
    }, 1600);

    const timer3 = setTimeout(() => {
      setShowStart(true);
    }, 2400);

    const timer4 = setTimeout(() => {
      onFinished();
    }, 3500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [isOpen, onFinished]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div className="relative flex flex-col items-center max-w-md w-full px-4">
        {/* 원형 광채 배경 */}
        <div
          className={`absolute -inset-10 rounded-full blur-3xl transition-all duration-700 ${
            showStart
              ? 'bg-gradient-to-tr from-emerald-500/30 via-teal-500/40 to-cyan-500/30 animate-pulse'
              : 'bg-gradient-to-tr from-amber-500/25 via-orange-500/35 to-rose-500/25 animate-pulse'
          }`}
        />

        {/* 상단 뱃지 타이틀 */}
        <div
          className={`relative mb-6 flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-semibold tracking-wide transition-all duration-300 shadow-md ${
            showStart
              ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
              : 'bg-white/10 border-white/20 text-white'
          }`}
        >
          {showStart ? (
            <>
              <PartyPopper className="w-4 h-4 text-emerald-300 animate-bounce" />
              <span className="whitespace-nowrap">자리 배정 완료</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
              <span className="whitespace-nowrap">새로운 자리 랜덤 배정 중</span>
            </>
          )}
        </div>

        {/* 메인 비주얼 영역 (카운트다운 숫자 원형 vs 배정 완료 축하 카드) */}
        {!showStart ? (
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-gradient-to-b from-white/20 via-white/10 to-white/5 border-2 border-amber-300/40 shadow-[0_0_50px_rgba(245,158,11,0.25)] flex items-center justify-center transition-all duration-300">
            <span
              key={count}
              className="text-7xl sm:text-8xl font-black text-amber-400 drop-shadow-[0_4px_20px_rgba(251,191,36,0.7)] animate-in zoom-in-50 duration-300 tabular-nums"
            >
              {count}
            </span>
          </div>
        ) : (
          <div className="relative w-full max-w-sm px-8 py-7 rounded-3xl bg-gradient-to-b from-emerald-900/60 via-slate-900/80 to-teal-950/60 border-2 border-emerald-400/70 shadow-[0_0_60px_rgba(16,185,129,0.45)] backdrop-blur-md flex flex-col items-center justify-center gap-3 animate-in zoom-in-75 duration-400">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-8 h-8 text-emerald-300 animate-in zoom-in duration-300" />
            </div>
            <div className="text-center">
              <h3 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-teal-100 to-white drop-shadow-[0_2px_12px_rgba(52,211,153,0.7)] tracking-wide whitespace-nowrap break-keep">
                배정 완료!
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm font-medium text-emerald-200/90 whitespace-nowrap">
                새로운 좌석 배치가 완성되었습니다
              </p>
            </div>
          </div>
        )}

        {/* 하단 안내 문구 */}
        <p className="relative mt-6 text-slate-300 text-xs sm:text-sm font-medium tracking-tight whitespace-nowrap transition-colors duration-300">
          {showStart ? '화면으로 이동합니다...' : '두근두근! 자리가 새롭게 바뀌는 중입니다'}
        </p>
      </div>
    </div>
  );
};
