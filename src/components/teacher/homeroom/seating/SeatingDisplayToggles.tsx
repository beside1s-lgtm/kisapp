'use client';

/**
 * 자리 배치도 표시 설정 (학급별, 이 브라우저에 저장)
 *  - 칭찬: 현황 바 / 책상 카드의 칭찬 등급 배지
 *  - 숙제: 현황 바 / 책상 카드의 과제 제출 표시(전체화면)
 * 칭찬·숙제 탭의 [배치도에서 확인] 체크와 자리 배치 화면이 같은 값을 쓴다 (바꾸면 바로 반영)
 */
import React, { useCallback, useEffect, useState } from 'react';

export interface SeatingDisplayPrefs {
  praiseBar: boolean;
  praiseCards: boolean;
  hwBar: boolean;
  hwCards: boolean;
}

const DEFAULT_PREFS: SeatingDisplayPrefs = { praiseBar: true, praiseCards: true, hwBar: false, hwCards: false };
const EVENT = 'kis-seating-display-prefs';
const keyOf = (classKey: string) => `kis_seating_display_${classKey}`;

function readPrefs(classKey: string): SeatingDisplayPrefs {
  try {
    const raw = localStorage.getItem(keyOf(classKey));
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    // 예전 [배치도에서 확인] 체크(숙제 하나만 있던 때) 이어받기
    if (localStorage.getItem(`kis_hw_on_seating_${classKey}`) === '1') {
      return { ...DEFAULT_PREFS, hwBar: true, hwCards: true };
    }
  } catch {}
  return DEFAULT_PREFS;
}

export function useSeatingDisplayPrefs(classKey: string): [SeatingDisplayPrefs, (patch: Partial<SeatingDisplayPrefs>) => void] {
  const [prefs, setPrefs] = useState<SeatingDisplayPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(readPrefs(classKey));
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ classKey: string }>).detail;
      if (!detail || detail.classKey === classKey) setPrefs(readPrefs(classKey));
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [classKey]);

  const update = useCallback(
    (patch: Partial<SeatingDisplayPrefs>) => {
      const next = { ...readPrefs(classKey), ...patch };
      setPrefs(next);
      try {
        localStorage.setItem(keyOf(classKey), JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new CustomEvent(EVENT, { detail: { classKey } }));
    },
    [classKey]
  );

  return [prefs, update];
}

/** [배치도에서 확인: ☑ 현황 바 ☑ 책상] 체크 묶음 */
export const SeatingDisplayToggles: React.FC<{
  bar: boolean;
  cards: boolean;
  onBarChange: (next: boolean) => void;
  onCardsChange: (next: boolean) => void;
  barLabel?: string;
  cardsLabel?: string;
  cardsTitle?: string;
  tone?: 'emerald' | 'amber';
}> = ({ bar, cards, onBarChange, onCardsChange, barLabel = '현황 바', cardsLabel = '책상', cardsTitle, tone = 'emerald' }) => {
  const on = tone === 'amber' ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-300';
  const accent = tone === 'amber' ? 'accent-amber-600' : 'accent-emerald-600';
  const item = 'flex items-center gap-1 cursor-pointer select-none whitespace-nowrap';
  return (
    <div
      className={`h-7 sm:h-8 flex items-center gap-2 rounded-xl px-2.5 border text-[11px] sm:text-xs font-bold text-slate-700 transition-colors ${
        bar || cards ? on : 'bg-white border-slate-200'
      }`}
    >
      <span className="text-slate-500 whitespace-nowrap">배치도에서 확인</span>
      <label className={item} title="자리 배치도 위쪽에 현황 바를 표시합니다">
        <input type="checkbox" checked={bar} onChange={(e) => onBarChange(e.target.checked)} className={`w-3.5 h-3.5 cursor-pointer ${accent}`} />
        <span>{barLabel}</span>
      </label>
      <label className={item} title={cardsTitle}>
        <input type="checkbox" checked={cards} onChange={(e) => onCardsChange(e.target.checked)} className={`w-3.5 h-3.5 cursor-pointer ${accent}`} />
        <span>{cardsLabel}</span>
      </label>
    </div>
  );
};
