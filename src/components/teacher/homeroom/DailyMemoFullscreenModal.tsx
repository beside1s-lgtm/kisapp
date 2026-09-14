'use client';

import React, { useEffect, useState } from 'react';
import { X, Save, Check, Palette, Monitor, FolderOpen } from 'lucide-react';

interface DailyMemoFullscreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onOpenHistory?: () => void;
}

type BoardTheme = 'chalkboard' | 'whiteboard';

export const DailyMemoFullscreenModal: React.FC<DailyMemoFullscreenModalProps> = ({
  isOpen,
  onClose,
  dateStr,
  initialContent,
  onSave,
  onOpenHistory,
}) => {
  const [content, setContent] = useState(initialContent);
  const [isSaved, setIsSaved] = useState(false);
  const [theme, setTheme] = useState<BoardTheme>('chalkboard');

  // 사용자 선호 테마 로컬스토리지 불러오기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('kis_board_theme') as BoardTheme;
      if (savedTheme === 'whiteboard' || savedTheme === 'chalkboard') {
        setTheme(savedTheme);
      }
    }
  }, []);

  const handleToggleTheme = (newTheme: BoardTheme) => {
    setTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kis_board_theme', newTheme);
    }
  };

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleSaveAndClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, content]);

  if (!isOpen) return null;

  const handleSaveAndClose = async () => {
    await onSave(content);
    onClose();
  };

  const handleManualSave = async () => {
    await onSave(content);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const isChalkboard = theme === 'chalkboard';

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col justify-between p-6 sm:p-10 transition-colors duration-200 select-none ${
        isChalkboard
          ? 'bg-[#15231c] text-white' // 짙은 초록색 전통 흑판
          : 'bg-[#f8fafc] text-slate-900' // 깨끗하고 선명한 화이트보드
      }`}
      style={{ opacity: 1 }}
    >
      {/* ─── 상단 헤더: 제목, 날짜, 테마 토글, 액션 버튼 ─── */}
      <div
        className={`w-full flex flex-col sm:flex-row sm:items-center justify-between pb-4 sm:pb-6 border-b shrink-0 gap-4 ${
          isChalkboard ? 'border-emerald-800/60' : 'border-slate-200'
        }`}
      >
        {/* 좌측: 타이틀 및 날짜 */}
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs sm:text-sm font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                isChalkboard
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
              }`}
            >
              {isChalkboard ? '칠판 모드' : '화이트보드 모드'}
            </span>
            <span className={`text-xs ${isChalkboard ? 'text-emerald-400' : 'text-slate-500'} font-semibold`}>
              교실 전자칠판 알림장
            </span>
          </div>
          {/* 선명하게 잘 보이는 날짜 텍스트 */}
          <h2
            className={`text-2xl sm:text-4xl font-black mt-2 tracking-tight ${
              isChalkboard ? 'text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]' : 'text-slate-900 drop-shadow-xs'
            }`}
          >
            {dateStr}
          </h2>
        </div>

        {/* 우측: 스타일 선택기 + 저장 버튼 + 닫기(X) 버튼 */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* 칠판 / 화이트보드 전환 탭 */}
          <div
            className={`flex items-center p-1 rounded-xl border ${
              isChalkboard
                ? 'bg-black/40 border-emerald-800/80'
                : 'bg-white border-slate-300 shadow-xs'
            }`}
          >
            <button
              type="button"
              onClick={() => handleToggleTheme('chalkboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isChalkboard
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>칠판</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleTheme('whiteboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isChalkboard
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-emerald-300/80 hover:text-white'
              }`}
            >
              <span>화이트보드</span>
            </button>
          </div>

          {/* 저장 버튼 (배경 대비 확실한 고채도 버튼) */}
          <button
            type="button"
            onClick={handleManualSave}
            className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer ${
              isChalkboard
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>저장 완료!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>저장</span>
              </>
            )}
          </button>

          {/* 불러오기 버튼 */}
          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer border ${
                isChalkboard
                  ? 'bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-200 border-emerald-700/60'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
              title="이전 일자별 칠판 알림장 불러오기"
            >
              <FolderOpen className="w-4 h-4" />
              <span>불러오기</span>
            </button>
          )}

          {/* 닫기 (X) 버튼 (선명한 대비와 눈에 띄는 테두리/배경색) */}
          <button
            type="button"
            onClick={handleSaveAndClose}
            className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border shadow-md ${
              isChalkboard
                ? 'bg-red-500/20 hover:bg-red-500 text-white border-red-400/60 hover:border-red-400'
                : 'bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border-red-300 hover:border-red-600'
            }`}
            title="저장 후 닫기 (단축키: ESC)"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
            <span>닫기 (ESC)</span>
          </button>
        </div>
      </div>

      {/* ─── 대형 텍스트 에디터 (전자칠판/TV용 대형 분필/마커 폰트) ─── */}
      <div className="flex-1 w-full my-4 sm:my-6 flex flex-col min-h-0">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="오늘의 알림장, 준비물 및 전달사항을 입력하세요..."
          className={`flex-1 w-full bg-transparent resize-none border-none outline-none font-bold text-3xl sm:text-5xl lg:text-6xl leading-relaxed font-sans select-text p-2 ${
            isChalkboard
              ? 'text-yellow-100 placeholder:text-emerald-700/60 caret-yellow-300'
              : 'text-slate-900 placeholder:text-slate-400 caret-indigo-600'
          }`}
          autoFocus
        />
      </div>

      {/* ─── 하단 푸터 안내 ─── */}
      <div
        className={`text-xs sm:text-sm font-medium text-center shrink-0 pt-3 border-t ${
          isChalkboard
            ? 'text-emerald-400/70 border-emerald-900/40'
            : 'text-slate-500 border-slate-200'
        }`}
      >
        💡 내용을 입력하고 닫기(ESC)를 누르면 자동 저장되며, 교실 전자칠판/TV에 고대비 모드로 상시 유지됩니다.
      </div>
    </div>
  );
};

