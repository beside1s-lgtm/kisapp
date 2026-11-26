'use client';

import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import type { Course, GlobalTimerConfig } from '@/lib/afterschool/types';
import { getWaitingLimit } from '@/lib/afterschool/waitingRules';

interface Props {
  timerConfig: GlobalTimerConfig;
  setTimerConfig: React.Dispatch<React.SetStateAction<GlobalTimerConfig>>;
  courses: Course[];
}

type Mode = 'unlimited' | 'none' | 'limit';

/** 학부모 수강 신청: 강좌별 정원 외 대기 인원 한도 설정 */
export function WaitingLimitCard({ timerConfig, setTimerConfig, courses }: Props) {
  const saved = getWaitingLimit(timerConfig);
  const savedMode: Mode = saved === null ? 'unlimited' : saved === 0 ? 'none' : 'limit';
  const [mode, setMode] = useState<Mode>(savedMode);
  const [count, setCount] = useState<string>(saved && saved > 0 ? String(saved) : '5');
  const [savedNotice, setSavedNotice] = useState(false);

  // 다른 관리자가 바꾼 값 반영
  useEffect(() => {
    setMode(savedMode);
    if (saved && saved > 0) setCount(String(saved));
  }, [saved, savedMode]);

  const nextLimit = mode === 'unlimited' ? -1 : mode === 'none' ? 0 : Math.max(1, Math.min(99, parseInt(count, 10) || 1));
  const dirty = nextLimit !== (saved === null ? -1 : saved);

  const apply = () => {
    setTimerConfig((prev) => ({ ...prev, waitingLimit: nextLimit }));
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  // 이미 한도를 넘은 강좌 (기존 대기자는 그대로 두고 새 대기 신청만 막힘)
  const over = nextLimit >= 0 ? courses.filter((c) => (c.waitingStudents || 0) > nextLimit && c.status !== 'CANCELLED') : [];

  const opt = (m: Mode, label: string, desc: string) => (
    <label
      className={`flex-1 min-w-[150px] flex items-start gap-2 rounded-xl border p-3 cursor-pointer transition ${
        mode === m ? 'border-indigo-400 bg-indigo-50/70 ring-1 ring-indigo-200' : 'border-slate-200 hover:bg-slate-50'
      }`}
    >
      <input type="radio" name="waiting-limit-mode" checked={mode === m} onChange={() => setMode(m)} className="mt-0.5 accent-indigo-600" />
      <span>
        <span className="block text-xs font-bold text-slate-800">{label}</span>
        <span className="block text-[11px] text-slate-500 mt-0.5">{desc}</span>
      </span>
    </label>
  );

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <Users className="w-4 h-4 text-indigo-600" />
            정원 외 대기 인원
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            정원이 찬 강좌에 학부모가 대기 신청할 수 있는 인원입니다. 동시간대 2순위 신청도 대기로 들어가므로 이 한도에 포함됩니다.
          </p>
        </div>
        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded shrink-0">
          현재: {saved === null ? '무제한' : saved === 0 ? '대기 받지 않음' : `강좌당 ${saved}명`}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {opt('limit', '인원 제한', '강좌마다 정해진 인원까지만 대기')}
        {opt('none', '대기 받지 않음', '정원이 차면 바로 마감')}
        {opt('unlimited', '무제한', '대기 인원 제한 없음 (기존 방식)')}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {mode === 'limit' && (
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
            강좌당 대기
            <input
              type="number"
              min={1}
              max={99}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            명까지
          </label>
        )}
        <button
          type="button"
          onClick={apply}
          disabled={!dirty}
          className="sm:ml-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
        >
          {savedNotice ? '✓ 적용되었습니다' : '대기 인원 적용'}
        </button>
      </div>

      {over.length > 0 && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          이미 대기자가 한도보다 많은 강좌 {over.length}개: {over.slice(0, 5).map((c) => `${c.title}(${c.waitingStudents}명)`).join(', ')}
          {over.length > 5 ? ' 외' : ''} — 기존 대기자는 그대로 두고, 새 대기 신청만 막습니다.
        </p>
      )}
    </div>
  );
}
