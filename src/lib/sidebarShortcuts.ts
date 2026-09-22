'use client';

import { ALL_FEATURES, DEFAULT_SHORTCUT_IDS, type FeatureItem } from './featureRegistry';

// 하위 호환용 타입 별칭. 실제 정의는 featureRegistry.ts의 FeatureItem 하나뿐이며,
// "바로가기 설정" 모달과 "기능 검색"이 같은 원천 목록을 공유한다.
export type ShortcutItem = FeatureItem;

// "바로가기 설정" 모달에 노출되는 후보 목록 (pinnable: false 항목은 제외).
// 새 기능을 추가할 때는 featureRegistry.ts의 ALL_FEATURES에만 항목을 추가하면
// 이 목록과 기능 검색 결과에 함께 반영된다.
export const ALL_SHORTCUT_ITEMS: ShortcutItem[] = ALL_FEATURES.filter(
  (item) => item.pinnable !== false
);

export { DEFAULT_SHORTCUT_IDS };

const STORAGE_PREFIX = 'kis_sidebar_shortcuts_';

export function getSavedShortcutIds(email?: string | null): string[] {
  if (typeof window === 'undefined') return DEFAULT_SHORTCUT_IDS;
  try {
    const key = email ? `${STORAGE_PREFIX}${email.toLowerCase()}` : `${STORAGE_PREFIX}default`;
    const saved = localStorage.getItem(key);
    if (!saved) return DEFAULT_SHORTCUT_IDS;
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_SHORTCUT_IDS;
  } catch (e) {
    return DEFAULT_SHORTCUT_IDS;
  }
}

export function saveShortcutIds(ids: string[], email?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = email ? `${STORAGE_PREFIX}${email.toLowerCase()}` : `${STORAGE_PREFIX}default`;
    localStorage.setItem(key, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent('sidebar-shortcuts-updated', { detail: { ids } }));
  } catch (e) {
    console.error('Failed to save sidebar shortcuts:', e);
  }
}
