'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * 페이지 진입 시 자동으로 뜨는 팝업(안전점검, 인수인계 등)이 동시에 겹치지 않도록
 * 한 번에 하나씩만 보여 주는 간단한 전역 대기열.
 * 먼저 요청한 팝업이 화면을 차지하고, 닫히면(want=false) 다음 대기 팝업이 이어서 표시된다.
 */
let owner: string | null = null;
const waiting: string[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function request(id: string) {
  if (owner === id || waiting.includes(id)) return;
  if (owner === null) {
    owner = id;
  } else {
    waiting.push(id);
  }
  emit();
}

function release(id: string) {
  const idx = waiting.indexOf(id);
  if (idx >= 0) waiting.splice(idx, 1);
  if (owner === id) {
    owner = waiting.shift() ?? null;
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * @param id 팝업 식별자 (예: 'safety-inspection', 'handover')
 * @param want 이 팝업을 띄우고 싶은 상태인지
 * @returns 지금 화면에 표시해도 되는지 (대기열 차례인지)
 */
export function usePopupSlot(id: string, want: boolean): boolean {
  useEffect(() => {
    if (want) request(id);
    else release(id);
  }, [id, want]);

  useEffect(() => () => release(id), [id]);

  const currentOwner = useSyncExternalStore(
    subscribe,
    () => owner,
    () => null
  );
  return want && currentOwner === id;
}
