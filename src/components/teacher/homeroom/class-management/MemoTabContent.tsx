'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Save, FolderOpen, Maximize2, Type, Check } from 'lucide-react';
import { motion } from 'framer-motion';

export interface MemoTabContentProps {
  todayDisplay: string;
  memoContent: string;
  setMemoContent: (val: string) => void;
  handleSaveMemo: () => void;
  handleOpenMemoHistory: () => void;
  setIsMemoFullscreenOpen: (open: boolean) => void;
  isFullscreen?: boolean;
}

export function MemoTabContent({
  todayDisplay,
  memoContent,
  setMemoContent,
  handleSaveMemo,
  handleOpenMemoHistory,
  setIsMemoFullscreenOpen,
  isFullscreen = false,
}: MemoTabContentProps) {
  // 전체화면 모드 시 칠판 테마 (초록 분필 칠판 vs 화이트보드)
  const [boardTheme, setBoardTheme] = useState<'chalk' | 'white'>('chalk');
  // 글씨 크기 단계 (1: 보통, 2: 크게, 3: 특대)
  const [fontSizeLevel, setFontSizeLevel] = useState<1 | 2 | 3>(2);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const onSave = () => {
    handleSaveMemo();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // 폰트 크기 매핑
  const fontSizeClasses = {
    1: isFullscreen ? 'text-xl sm:text-2xl leading-relaxed' : 'text-base sm:text-lg leading-relaxed',
    2: isFullscreen ? 'text-2xl sm:text-3xl lg:text-4xl leading-loose font-black' : 'text-lg sm:text-xl leading-relaxed font-bold',
    3: isFullscreen ? 'text-3xl sm:text-4xl lg:text-5xl leading-loose font-black' : 'text-xl sm:text-2xl leading-relaxed font-extrabold',
  };

  return (
    <Card
      className={`rounded-3xl border-2 transition-all shadow-md overflow-hidden ${
        isFullscreen
          ? boardTheme === 'chalk'
            ? 'bg-[#15281E] border-[#1D3B2D] text-emerald-50 shadow-2xl flex flex-col h-[calc(100vh-120px)] min-h-[500px]'
            : 'bg-white border-slate-200 text-slate-800 shadow-2xl flex flex-col h-[calc(100vh-120px)] min-h-[500px]'
          : 'bg-white border-slate-200/90 text-slate-800'
      }`}
    >
      {/* ─── 상단 헤더 바 (컴팩트 1줄: 제목 + 색상토글 + 불러오기(아이콘) + 저장(아이콘)) ─── */}
      <CardHeader
        className={`p-2.5 sm:p-3.5 pb-2.5 border-b shrink-0 ${
          isFullscreen
            ? boardTheme === 'chalk'
              ? 'bg-[#101F17] border-[#1D3B2D]'
              : 'bg-slate-50/90 border-slate-200'
            : 'bg-slate-50/70 border-slate-100'
        }`}
      >
        <div className="flex items-center justify-between gap-2 flex-nowrap">
          {/* 좌측: 타이틀 및 날짜 (부제목 및 대형배지 제거로 단 1줄 컴팩트 유지) */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`p-1.5 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                isFullscreen && boardTheme === 'chalk'
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                  : 'bg-[#2471B2]/10 text-[#2471B2] border border-[#2471B2]/20'
              }`}
            >
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <CardTitle
              className={`text-sm sm:text-lg font-black tracking-tight truncate ${
                isFullscreen && boardTheme === 'chalk' ? 'text-emerald-100' : 'text-slate-900'
              }`}
            >
              {todayDisplay} 오늘의 칠판 알림
            </CardTitle>
          </div>

          {/* 우측 도구 버튼군: 색상 토글 + 불러오기(아이콘) + 저장(아이콘) */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto flex-nowrap">
            {/* 4. 화이트보드/흑판 분필 모드: 색상만 선택하는 토글 버튼 */}
            <div
              className={`flex items-center p-1 rounded-2xl border gap-1 shrink-0 ${
                isFullscreen && boardTheme === 'chalk'
                  ? 'bg-emerald-950/70 border-emerald-800/80'
                  : 'bg-slate-200/70 border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setBoardTheme('chalk')}
                title="흑판 분필 모드 (초록)"
                className={`w-6 h-6 rounded-full transition-all flex items-center justify-center border ${
                  boardTheme === 'chalk'
                    ? 'bg-[#15281E] border-emerald-400 ring-2 ring-emerald-400/60 shadow-sm scale-110'
                    : 'bg-[#15281E] border-transparent opacity-40 hover:opacity-80'
                }`}
              >
                {boardTheme === 'chalk' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </button>
              <button
                type="button"
                onClick={() => setBoardTheme('white')}
                title="화이트보드 모드 (화이트)"
                className={`w-6 h-6 rounded-full transition-all flex items-center justify-center border ${
                  boardTheme === 'white'
                    ? 'bg-white border-[#2471B2] ring-2 ring-[#2471B2]/60 shadow-sm scale-110'
                    : 'bg-white border-transparent opacity-40 hover:opacity-80'
                }`}
              >
                {boardTheme === 'white' && <div className="w-1.5 h-1.5 rounded-full bg-[#2471B2]" />}
              </button>
            </div>

            {/* 5. 지난 알림 불러오기: 아이콘만 남김 */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95, y: 1 }}
              onClick={handleOpenMemoHistory}
              title="지난 알림 불러오기"
              className="w-9 h-9 rounded-2xl flex items-center justify-center bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-b-4 border-slate-300 transition-all select-none shadow-xs shrink-0 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 text-[#2471B2]" />
            </motion.button>

            {/* 6. 칠판 내용 저장: 아이콘만 남김 */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95, y: 1 }}
              onClick={onSave}
              title="칠판 내용 저장하기"
              className={`w-9 h-9 rounded-2xl flex items-center justify-center select-none border-b-4 transition-all shadow-sm shrink-0 cursor-pointer ${
                saveSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-800 text-white'
                  : 'bg-[#2471B2] hover:bg-[#1E629D] border-[#1A5384] text-white'
              }`}
            >
              {saveSuccess ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <Save className="w-4 h-4 text-white" />
              )}
            </motion.button>

            {/* 전자칠판 단독 팝업 전체화면 버튼 (비 전체화면일 때만 아이콘으로 노출) */}
            {!isFullscreen && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.05, y: -1 }}
                whileTap={{ scale: 0.95, y: 1 }}
                onClick={() => setIsMemoFullscreenOpen(true)}
                title="단독 대형 팝업 창으로 칠판 열기"
                className="w-9 h-9 rounded-2xl flex items-center justify-center bg-[#C49832] hover:bg-[#B0872A] border-b-4 border-[#8E6D21] text-white select-none transition-all shadow-xs shrink-0 cursor-pointer"
              >
                <Maximize2 className="w-4 h-4 text-white" />
              </motion.button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* ─── 칠판 본문 에디터 영역 ─── */}
      <CardContent
        className={`p-3 sm:p-5 space-y-2.5 ${
          isFullscreen ? 'flex-1 flex flex-col min-h-0' : ''
        }`}
      >
        <div className={`w-full relative ${isFullscreen ? 'flex-1 flex flex-col min-h-0' : ''}`}>
          <textarea
            value={memoContent}
            onChange={(e) => setMemoContent(e.target.value)}
            placeholder="여기를 클릭하여 오늘의 알림장, 숙제, 준비물 및 전달사항을 작성하세요...&#10;&#10;예시:&#10;1. 내일 준비물: 수학익힘책, 색연필&#10;2. 알림장 부모님 확인 싸인 받아오기&#10;3. 방과후 수업 정상 진행 (15:00)"
            rows={isFullscreen ? undefined : 14}
            className={`w-full rounded-2xl p-4 sm:p-6 transition-all outline-none resize-none ${fontSizeClasses[fontSizeLevel]} ${
              isFullscreen
                ? boardTheme === 'chalk'
                  ? 'flex-1 h-full bg-[#12221A] text-emerald-100 placeholder-emerald-700/50 border-2 border-[#1E3B2D] focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 shadow-inner'
                  : 'flex-1 h-full bg-slate-50 text-slate-900 placeholder-slate-400 border-2 border-slate-200 focus:border-[#2471B2] focus:ring-4 focus:ring-[#2471B2]/20 shadow-inner'
                : 'h-80 bg-slate-50/70 text-slate-900 placeholder-slate-400 border-2 border-slate-200 focus:border-[#2471B2] focus:ring-4 focus:ring-[#2471B2]/20 shadow-inner'
            }`}
          />
        </div>

        {/* ─── 하단 안내 캡션 & 글씨 크기 조절 바 (3. 화살표 위치: 하단 우측으로 이동) ─── */}
        <div className="flex items-center justify-between text-xs px-1 shrink-0 gap-2 flex-wrap">
          <p
            className={`text-xs ${
              isFullscreen && boardTheme === 'chalk' ? 'text-emerald-400/80' : 'text-slate-400'
            }`}
          >
            💡 상단 우측 전체화면 아이콘을 누르면 브라우저 전체화면으로 대형 칠판이 꽉 차게 확장됩니다.
          </p>

          <div className="flex items-center gap-3 shrink-0 ml-auto">
            {/* 3. 글씨 크기 선택 버튼 (하단 우측 화살표 위치로 이동) */}
            <div
              className={`flex items-center rounded-2xl p-0.5 border ${
                isFullscreen && boardTheme === 'chalk'
                  ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <span className="text-[11px] font-black px-2 flex items-center gap-1 select-none">
                <Type className="w-3.5 h-3.5" />
                크기
              </span>
              <button
                type="button"
                onClick={() => setFontSizeLevel(1)}
                className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-all ${
                  fontSizeLevel === 1
                    ? 'bg-[#2471B2] text-white shadow-xs'
                    : 'hover:bg-slate-200/50'
                }`}
              >
                보통
              </button>
              <button
                type="button"
                onClick={() => setFontSizeLevel(2)}
                className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-all ${
                  fontSizeLevel === 2
                    ? 'bg-[#2471B2] text-white shadow-xs'
                    : 'hover:bg-slate-200/50'
                }`}
              >
                크게
              </button>
              <button
                type="button"
                onClick={() => setFontSizeLevel(3)}
                className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-all ${
                  fontSizeLevel === 3
                    ? 'bg-[#2471B2] text-white shadow-xs'
                    : 'hover:bg-slate-200/50'
                }`}
              >
                특대
              </button>
            </div>

            {/* 글자 수 표시 */}
            <span
              className={`font-semibold shrink-0 text-xs ${
                isFullscreen && boardTheme === 'chalk' ? 'text-emerald-300' : 'text-slate-500'
              }`}
            >
              글자 수: {memoContent.length}자
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
