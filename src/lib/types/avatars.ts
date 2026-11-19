// 학급 관리 전용 학생 아바타 타입 및 로컬 스토리지 헬퍼

export interface CustomAvatarPreset {
  id: string;
  emoji: string;
  name: string;
  bgClass: string;
  borderClass: string;
}

export const AVATAR_PRESETS: CustomAvatarPreset[] = [
  { id: 'lion', emoji: '🦁', name: '용맹 사자', bgClass: 'bg-amber-100', borderClass: 'border-amber-300' },
  { id: 'tiger', emoji: '🐯', name: '씩씩 호랑이', bgClass: 'bg-orange-100', borderClass: 'border-orange-300' },
  { id: 'bear', emoji: '🐻', name: '듬직 곰', bgClass: 'bg-amber-200/70', borderClass: 'border-amber-400' },
  { id: 'panda', emoji: '🐼', name: '귀염 판다', bgClass: 'bg-slate-100', borderClass: 'border-slate-300' },
  { id: 'rabbit', emoji: '🐰', name: '깜찍 토끼', bgClass: 'bg-pink-100', borderClass: 'border-pink-300' },
  { id: 'fox', emoji: '🦊', name: '지혜 여우', bgClass: 'bg-orange-100', borderClass: 'border-orange-400' },
  { id: 'koala', emoji: '🐨', name: '여유 코알라', bgClass: 'bg-emerald-100', borderClass: 'border-emerald-300' },
  { id: 'puppy', emoji: '🐶', name: '충직 강아지', bgClass: 'bg-yellow-100', borderClass: 'border-yellow-300' },
  { id: 'cat', emoji: '🐱', name: '새침 고양이', bgClass: 'bg-violet-100', borderClass: 'border-violet-300' },
  { id: 'hamster', emoji: '🐹', name: '똘망 햄스터', bgClass: 'bg-amber-100', borderClass: 'border-amber-300' },
  { id: 'owl', emoji: '🦉', name: '똑똑 부엉이', bgClass: 'bg-indigo-100', borderClass: 'border-indigo-300' },
  { id: 'penguin', emoji: '🐧', name: '신난 펭귄', bgClass: 'bg-cyan-100', borderClass: 'border-cyan-300' },
  { id: 'dolphin', emoji: '🐬', name: '다정 돌고래', bgClass: 'bg-sky-100', borderClass: 'border-sky-300' },
  { id: 'dino', emoji: '🦖', name: '용감 공룡', bgClass: 'bg-emerald-100', borderClass: 'border-emerald-400' },
  { id: 'astronaut', emoji: '🚀', name: '꿈 탐험가', bgClass: 'bg-blue-100', borderClass: 'border-blue-300' },
  { id: 'star', emoji: '👑', name: '빛나는 왕관', bgClass: 'bg-amber-100', borderClass: 'border-amber-400' },
];

export interface CustomAvatarData {
  type: 'preset' | 'url';
  value: string; // preset id or image url
  emoji?: string;
  name?: string;
  bgClass?: string;
  borderClass?: string;
  updatedAt: string;
}

export function getCustomAvatarStorageKey(classKey: string, studentId: string): string {
  return `kis_custom_avatar_${classKey}_${studentId}`;
}

export function getCustomAvatar(classKey: string, studentId: string): CustomAvatarData | null {
  if (typeof window === 'undefined' || !classKey || !studentId) return null;
  try {
    const raw = localStorage.getItem(getCustomAvatarStorageKey(classKey, studentId));
    if (!raw) return null;
    return JSON.parse(raw) as CustomAvatarData;
  } catch (e) {
    console.warn('[AvatarStorage] Failed to parse custom avatar:', e);
    return null;
  }
}

export function saveCustomAvatar(
  classKey: string,
  studentId: string,
  avatar: CustomAvatarData | null
): void {
  if (typeof window === 'undefined' || !classKey || !studentId) return;
  const key = getCustomAvatarStorageKey(classKey, studentId);
  if (!avatar) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(avatar));
  }

  // 화면 실시간 동기화를 위한 커스텀 이벤트
  window.dispatchEvent(
    new CustomEvent('kis_avatar_updated', {
      detail: { classKey, studentId, avatar },
    })
  );
}
