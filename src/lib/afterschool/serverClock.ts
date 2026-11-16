'use client';

import { useEffect, useState } from 'react';

/**
 * 서버(인터넷 표준) 시각 동기화
 * - 학생 기기 시계가 틀려도 모두가 같은 기준으로 카운트다운/신청 가능 여부를 보도록 /api/time과의 차이(offset)를 보정한다.
 * - 왕복 지연의 절반을 반영하고, 5분마다 재동기화한다.
 */
let offsetMs = 0;
let lastSyncAt = 0;
let inflight: Promise<void> | null = null;
const RESYNC_MS = 5 * 60 * 1000;

export function syncServerClock(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && lastSyncAt && Date.now() - lastSyncAt < RESYNC_MS) return Promise.resolve();
  inflight = (async () => {
    try {
      const t0 = Date.now();
      const res = await fetch('/api/time', { cache: 'no-store' });
      const t1 = Date.now();
      const data = await res.json();
      if (typeof data?.now === 'number') {
        offsetMs = data.now - (t0 + t1) / 2;
        lastSyncAt = Date.now();
      }
    } catch {
      // 동기화 실패 시 직전 보정값 유지 (최종 판정은 어차피 서버 API가 서버 시각으로 수행)
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 서버 기준 현재 시각(ms) */
export function getServerNowMs(): number {
  return Date.now() + offsetMs;
}

/** 서버 시각 기준으로 tickMs마다 갱신되는 현재 시각(ms) */
export function useServerNow(tickMs = 1000): number {
  const [now, setNow] = useState<number>(() => getServerNowMs());
  useEffect(() => {
    let cancelled = false;
    syncServerClock().then(() => { if (!cancelled) setNow(getServerNowMs()); });
    const timer = setInterval(() => {
      setNow(getServerNowMs());
      syncServerClock();
    }, tickMs);
    return () => { cancelled = true; clearInterval(timer); };
  }, [tickMs]);
  return now;
}
