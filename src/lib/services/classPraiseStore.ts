/**
 * 학급 칭찬 점수 단일 저장소
 *
 * 자리 배치도(책상·칭찬 모달·학생 카드)와 칭찬 탭이 같은 점수를 쓰도록
 * 학생별 점수를 `kis_praise_${classKey}_${studentId}` 한 곳에 둔다.
 * 이 키는 classStateSync가 서버(homeroom_classes/{classKey}/state)와 즉시 동기화한다.
 *
 * 예전에는 자리 배치도의 칭찬 점수가 배치도(슬롯)마다 따로 저장되어 [저장]을 눌러야
 * 서버에 남았고, 칭찬 탭 점수는 브라우저에만 있었다. 처음 한 번은 저장된 모든 배치도의
 * 슬롯 점수와 브라우저 점수 중 큰 값을 학생별 점수로 옮긴다.
 */
import { useEffect, useState } from 'react';
import { depositRewardPoints } from '@/lib/services/praiseRewardService';
import { getSeatingPlans } from '@/lib/services/seatingService';
import { whenClassStateReady, PRAISE_POINTS_EVENT } from '@/lib/services/classStateSync';
import { evaluatePromotion, emitPraisePromotions } from '@/lib/services/praisePromotionStore';
import type { PromotedStudentInfo } from '@/lib/types/praisePromotion';

export interface PraiseStudentMeta {
  studentNum?: string | number | null;
  gender?: string | null;
  photoUrl?: string | null;
}

const keyOf = (classKey: string, studentId: string) => `kis_praise_${classKey}_${studentId}`;
const unifiedFlag = (classKey: string) => `kis_praise_unified_${classKey}`;

function emit(classKey: string) {
  window.dispatchEvent(new CustomEvent(PRAISE_POINTS_EVENT, { detail: { classKey } }));
}

export function getPraisePoints(classKey: string, studentId: string): number {
  if (typeof window === 'undefined' || !classKey || !studentId) return 0;
  try {
    return Math.max(0, Number(localStorage.getItem(keyOf(classKey, studentId))) || 0);
  } catch {
    return 0;
  }
}

/** 학급의 저장된 칭찬 점수 전체 (studentId → 점수) */
export function getPraiseMap(classKey: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof window === 'undefined' || !classKey) return out;
  const prefix = `kis_praise_${classKey}_`;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const sid = k.slice(prefix.length);
      if (!sid) continue;
      out[sid] = Math.max(0, Number(localStorage.getItem(k)) || 0);
    }
  } catch {}
  return out;
}

export function setPraisePoints(classKey: string, studentId: string, value: number) {
  if (typeof window === 'undefined' || !classKey || !studentId) return;
  try {
    localStorage.setItem(keyOf(classKey, studentId), String(Math.max(0, Math.round(value))));
  } catch {}
  emit(classKey);
}

/** 점수 증감. 늘어난 만큼은 보상 포인트 통장에도 적립 및 등급 승급 시 축하 이벤트 발생. 바뀐 점수를 돌려줌 */
export function changePraisePoints(
  classKey: string,
  studentId: string,
  studentName: string,
  delta: number,
  meta?: PraiseStudentMeta
): number {
  const prev = getPraisePoints(classKey, studentId);
  const next = Math.max(0, prev + delta);
  setPraisePoints(classKey, studentId, next);

  if (delta > 0) {
    depositRewardPoints(classKey, studentId, studentName || '학생', delta, `칭찬 점수 획득 (+${delta}P)`);

    // 등급 승급 검사 및 축하 이벤트 발행
    const promotion = evaluatePromotion(classKey, studentId, studentName || '학생', prev, next, meta);
    if (promotion) {
      emitPraisePromotions(classKey, [promotion]);
    }
  }
  return next;
}

/** 여러 학생 일괄 점수 증감 및 등급별 순차 승급 축하 이벤트 발행 */
export function changePraisePointsBatch(
  classKey: string,
  updates: {
    studentId: string;
    studentName: string;
    delta: number;
    meta?: PraiseStudentMeta;
  }[]
): void {
  const promotions: PromotedStudentInfo[] = [];

  updates.forEach(({ studentId, studentName, delta, meta }) => {
    if (!studentId || delta === 0) return;
    const prev = getPraisePoints(classKey, studentId);
    const next = Math.max(0, prev + delta);
    setPraisePoints(classKey, studentId, next);

    if (delta > 0) {
      depositRewardPoints(classKey, studentId, studentName || '학생', delta, `칭찬 점수 획득 (+${delta}P)`);
      const promo = evaluatePromotion(classKey, studentId, studentName || '학생', prev, next, meta);
      if (promo) {
        promotions.push(promo);
      }
    }
  });

  if (promotions.length > 0) {
    emitPraisePromotions(classKey, promotions);
  }
}

export function resetPraisePoints(classKey: string, studentIds: string[]) {
  if (typeof window === 'undefined' || !classKey) return;
  studentIds.forEach((sid) => {
    if (!sid) return;
    try {
      localStorage.setItem(keyOf(classKey, sid), '0');
    } catch {}
  });
  emit(classKey);
}

const migrating = new Map<string, Promise<void>>();

/** 예전 배치도 슬롯 점수를 학생별 점수로 1회 이전 (모든 기기 통틀어 한 번) */
export function migratePraiseOnce(classKey: string): Promise<void> {
  if (typeof window === 'undefined' || !classKey) return Promise.resolve();
  const running = migrating.get(classKey);
  if (running) return running;
  const p = (async () => {
    // 서버와 연결된 뒤에만 이전 (연결 실패 시 다음 접속 때 다시 시도)
    if (!(await whenClassStateReady(classKey))) return;
    try {
      if (localStorage.getItem(unifiedFlag(classKey)) === '1') return;
    } catch {
      return;
    }
    const plans = await getSeatingPlans(classKey);
    const best: Record<string, number> = {};
    plans.forEach((plan) =>
      (plan.slots || []).forEach((slot) => {
        if (!slot.studentId) return;
        const v = Number(slot.praisePoints) || 0;
        if (v > (best[slot.studentId] || 0)) best[slot.studentId] = v;
      })
    );
    let changed = false;
    Object.entries(best).forEach(([sid, v]) => {
      if (v > getPraisePoints(classKey, sid)) {
        try {
          localStorage.setItem(keyOf(classKey, sid), String(v));
          changed = true;
        } catch {}
      }
    });
    try {
      localStorage.setItem(unifiedFlag(classKey), '1');
    } catch {}
    if (changed) emit(classKey);
  })().finally(() => migrating.delete(classKey));
  migrating.set(classKey, p);
  return p;
}

/** 학급 칭찬 점수 맵 (다른 화면·다른 기기의 변경도 실시간 반영) */
export function usePraisePoints(classKey: string): Record<string, number> {
  const [map, setMap] = useState<Record<string, number>>(() => getPraiseMap(classKey));
  useEffect(() => {
    if (!classKey) return;
    setMap(getPraiseMap(classKey));
    void migratePraiseOnce(classKey);
    const onUpdate = (e: Event) => {
      const ck = (e as CustomEvent).detail?.classKey;
      if (!ck || ck === classKey) setMap(getPraiseMap(classKey));
    };
    window.addEventListener(PRAISE_POINTS_EVENT, onUpdate);
    return () => window.removeEventListener(PRAISE_POINTS_EVENT, onUpdate);
  }, [classKey]);
  return map;
}
