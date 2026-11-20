'use client';

/**
 * 자리 배치도 과제 현황 바 — 숙제 관리의 [배치도에서 확인]을 켜면 칭찬 현황 바 아래에 표시
 *  - 접힘: 과제 수·평균 달성률·미니 게이지
 *  - 상세보기: 과제별 달성률 카드를 한 줄에 나란히 (과제 수에 맞춰 너비가 늘고 줄며 좌우를 꽉 채움)
 *  - 과제 번호(①②③…)는 전체화면 책상 카드의 과제 표시와 같은 순서
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SeatingHomeworkItem {
  id: string;
  title: string;
  date: string;
  /** 1부터 — 책상 카드 표시 번호 */
  no: number;
  doneCount: number;
  totalCount: number;
  pct: number;
}

/** 숙제 관리 → 자리 배치도로 넘기는 과제 표시 데이터 */
export interface SeatingHomeworkOverlay {
  items: SeatingHomeworkItem[];
  /** 학생이 그 과제를 냈는지 */
  isDone: (hwId: string, studentId?: string, studentName?: string) => boolean;
  /** 책상 카드에서 제출 체크를 바꿀 때 */
  onToggle?: (hwId: string, studentId: string, studentName: string) => void;
}

interface SeatingHomeworkWidgetProps {
  items: SeatingHomeworkItem[];
  classKey?: string;
}

const openKey = (classKey: string) => `kis_seating_hw_widget_open_${classKey}`;

export const SeatingHomeworkWidget: React.FC<SeatingHomeworkWidgetProps> = ({ items, classKey = 'default_class' }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  useEffect(() => {
    try {
      setIsOpen(localStorage.getItem(openKey(classKey)) === '1');
    } catch {}
  }, [classKey]);
  const toggle = () =>
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(openKey(classKey), next ? '1' : '0');
      } catch {}
      return next;
    });

  const avgPct = useMemo(
    () => (items.length ? Math.round(items.reduce((sum, h) => sum + h.pct, 0) / items.length) : 0),
    [items]
  );
  const allDoneCount = items.filter((h) => h.totalCount > 0 && h.doneCount >= h.totalCount).length;

  return (
    <div className="w-full bg-white/95 rounded-2xl border-2 border-slate-200/90 shadow-xs p-2 sm:p-2.5 mb-2 select-none transition-all">
      <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <span className="text-xs sm:text-sm font-black text-slate-800 tracking-tight shrink-0">과제 현황</span>
          <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full min-w-0 truncate">
            과제 {items.length}개 · 평균 달성률 {avgPct}%
          </span>
          {items.length > 0 && (
            <span className="hidden sm:inline text-[11px] font-bold text-slate-500 shrink-0">
              전원 제출 {allDoneCount}/{items.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <div className="w-20 sm:w-28 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shrink-0">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${avgPct}%` }}
              transition={{ duration: 0.3 }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
            />
          </div>
          <button
            type="button"
            onClick={toggle}
            title={isOpen ? '과제 현황 접기' : '과제별 달성률 펼치기'}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer shrink-0"
          >
            <span>{isOpen ? '접기' : '상세보기'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pt-2.5 border-t border-slate-100 mt-2"
          >
            {items.length === 0 ? (
              <div className="p-3 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                확인할 숙제가 없습니다. [숙제]에서 숙제를 추가하면 여기에 달성률이 표시됩니다.
              </div>
            ) : (
              /* 과제 수와 관계없이 한 줄: 각 카드가 남는 너비를 똑같이 나눠 좌우를 꽉 채움 */
              <div className="flex w-full gap-1.5 sm:gap-2">
                {items.map((h) => {
                  const done = h.totalCount > 0 && h.doneCount >= h.totalCount;
                  return (
                    <div
                      key={h.id}
                      title={`${h.no}. ${h.title} (${h.date}) — ${h.doneCount}/${h.totalCount}명 제출`}
                      className={`flex-1 min-w-0 basis-0 p-1.5 sm:p-2 rounded-xl border shadow-2xs ${
                        done ? 'bg-emerald-50/90 border-emerald-300' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1 min-w-0 mb-1">
                        <span
                          className={`w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full text-[9px] sm:text-[10px] font-black flex items-center justify-center shrink-0 ${
                            done ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'
                          }`}
                        >
                          {h.no}
                        </span>
                        <span className="text-[11px] sm:text-xs font-black text-slate-800 truncate">{h.title}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                        <div
                          style={{ width: `${h.pct}%` }}
                          className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-[#2471B2]'}`}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[10px] font-bold text-slate-500 min-w-0">
                        <span className="truncate">{h.date.slice(5).replace('-', '/')}</span>
                        <span className={`shrink-0 font-black ${done ? 'text-emerald-700' : 'text-[#1A5384]'}`}>
                          {h.pct}% <span className="text-slate-400 font-bold">({h.doneCount}/{h.totalCount})</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
