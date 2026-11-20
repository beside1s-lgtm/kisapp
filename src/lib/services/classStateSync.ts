/**
 * 학급 도구 상태 서버 동기화 (localStorage ↔ Firestore)
 *
 * 학급 관리의 수업 도구(칭찬 점수·보상 상점·포인트 통장·거래 내역·성장 단계·목표 점수·
 * 팀 편성·학생 아바타·위젯/표시 설정 등)는 원래 브라우저 localStorage에만 저장되어
 * 다른 기기에서 열면 보이지 않았다.
 *
 * 이 모듈은 기존 코드(localStorage를 읽고 쓰는 코드)를 그대로 두고,
 *  - 학급 키에 해당하는 localStorage 쓰기를 감지해 Firestore
 *    `homeroom_classes/{classKey}/state/{key}` 에 올리고,
 *  - 서버의 변경을 구독해 localStorage에 반영한 뒤 각 화면이 다시 읽도록 이벤트를 보낸다.
 *
 * 교사 개인 화면 설정(자리 배치도 보기 옵션, 알림장 칠판 테마)은
 * `homeroom_classes/__teacher__{email}/state/{key}` 에 저장한다.
 *
 * 처음 동기화할 때(기기별 1회) 서버에 없는 로컬 데이터는 서버로 올린다(기존 데이터 이전).
 * 칭찬 점수는 두 쪽 값 중 큰 값을 남긴다.
 */
import { getDb } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

// 학급별 키: `${prefix}${classKey}` (뒤에 `_${studentId}` 가 붙는 키도 있음)
const CLASS_PREFIXES: { prefix: string; perStudent?: boolean; event?: string }[] = [
  { prefix: 'kis_praise_rewards_', event: 'class-rewards-updated' },
  { prefix: 'kis_praise_accounts_', event: 'class-reward-accounts-updated' },
  { prefix: 'kis_praise_tx_', event: 'class-reward-tx-updated' },
  { prefix: 'kis_praise_target_goal_' },
  { prefix: 'kis_praise_widget_config_', event: 'kis_praise_widget_config_updated' },
  { prefix: 'kis_praise_period_goals_' },
  { prefix: 'kis_praise_growth_tiers_', event: 'class-praise-tiers-updated' },
  { prefix: 'kis_praise_unified_' },
  { prefix: 'kis_class_teams_', event: 'class-teams-updated' },
  { prefix: 'kis_seating_display_', event: 'kis-seating-display-prefs' },
  { prefix: 'kis_seating_hw_widget_open_' },
  { prefix: 'kis_custom_avatar_', perStudent: true, event: 'kis_avatar_updated' },
  // 칭찬 점수 (학생별) — 다른 kis_praise_* 접두어보다 뒤에서 검사
  { prefix: 'kis_praise_', perStudent: true, event: 'class-praise-points-updated' },
];

// 교사 개인 설정 키
const TEACHER_KEYS: Record<string, string | undefined> = {
  kis_seating_view_options: 'kis-seating-view-options-updated',
  kis_board_theme: 'kis-board-theme-updated',
};

export const CLASS_STATE_EVENT = 'kis-class-state-updated';
export const PRAISE_POINTS_EVENT = 'class-praise-points-updated';

const MAX_VALUE_LENGTH = 900_000; // Firestore 문서 1MB 제한 여유
const PUSH_DELAY = 500;

type Scope = {
  id: string; // Firestore 상위 문서 id (classKey 또는 __teacher__email)
  classKey?: string;
  refs: number;
  unsub?: () => void;
  ready: boolean;
  /** 서버 구독 성공 여부 */
  ok: boolean;
  readyWaiters: (() => void)[];
  /** 서버에 있는 키 → 값 */
  remote: Map<string, string | null>;
};

const scopes = new Map<string, Scope>();
const pending = new Map<string, { scope: Scope; key: string; timer: ReturnType<typeof setTimeout> }>();
let applyingRemote = false;
let patched = false;
let rawSetItem: ((key: string, value: string) => void) | null = null;
let rawRemoveItem: ((key: string) => void) | null = null;

function docIdOf(key: string) {
  return key.replace(/\//g, '%2F');
}

function teacherScopeId(email: string) {
  return `__teacher__${email.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_')}`;
}

/** 이 키가 어떤 학급 키 규칙에 해당하는지 */
function matchClassKey(key: string, classKey: string) {
  for (const p of CLASS_PREFIXES) {
    const base = p.prefix + classKey;
    if (!key.startsWith(base)) continue;
    const rest = key.slice(base.length);
    if (p.perStudent ? rest.startsWith('_') && rest.length > 1 : rest === '') return p;
  }
  return null;
}

function scopeForKey(key: string): Scope | null {
  for (const s of scopes.values()) {
    if (s.classKey) {
      if (matchClassKey(key, s.classKey)) return s;
    } else if (key in TEACHER_KEYS) {
      return s;
    }
  }
  return null;
}

function schedulePush(scope: Scope, key: string) {
  const id = `${scope.id}::${key}`;
  const prev = pending.get(id);
  if (prev) clearTimeout(prev.timer);
  const timer = setTimeout(() => {
    pending.delete(id);
    void pushNow(scope, key);
  }, PUSH_DELAY);
  pending.set(id, { scope, key, timer });
}

async function pushNow(scope: Scope, key: string) {
  let value: string | null = null;
  try {
    value = localStorage.getItem(key);
  } catch {
    return;
  }
  if (value !== null && value.length > MAX_VALUE_LENGTH) {
    console.warn('[classStateSync] 값이 너무 커서 서버에 저장하지 않습니다:', key);
    return;
  }
  if (scope.remote.get(key) === value) return;
  scope.remote.set(key, value);
  try {
    await setDoc(doc(getDb(), 'homeroom_classes', scope.id, 'state', docIdOf(key)), {
      key,
      value,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('[classStateSync] 서버 저장 실패:', key, e);
  }
}

function patchStorage() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  const proto = Storage.prototype;
  const origSet = proto.setItem;
  const origRemove = proto.removeItem;
  rawSetItem = (k, v) => origSet.call(window.localStorage, k, v);
  rawRemoveItem = (k) => origRemove.call(window.localStorage, k);
  proto.setItem = function (this: Storage, key: string, value: string) {
    origSet.call(this, key, value);
    if (this === window.localStorage && !applyingRemote) {
      const s = scopeForKey(String(key));
      if (s) schedulePush(s, String(key));
    }
  };
  proto.removeItem = function (this: Storage, key: string) {
    origRemove.call(this, key);
    if (this === window.localStorage && !applyingRemote) {
      const s = scopeForKey(String(key));
      if (s) schedulePush(s, String(key));
    }
  };
}

function eventFor(scope: Scope, key: string): string | undefined {
  if (!scope.classKey) return TEACHER_KEYS[key];
  return matchClassKey(key, scope.classKey)?.event;
}

function dispatchFor(scope: Scope, keys: string[]) {
  const sent = new Set<string>();
  keys.forEach((key) => {
    const ev = eventFor(scope, key);
    const detail: Record<string, unknown> = { classKey: scope.classKey, key, remote: true };
    if (ev === 'kis_avatar_updated' && scope.classKey) {
      detail.studentId = key.slice(`kis_custom_avatar_${scope.classKey}_`.length);
    }
    if (ev && !sent.has(ev)) {
      sent.add(ev);
      window.dispatchEvent(new CustomEvent(ev, { detail }));
    }
  });
  window.dispatchEvent(new CustomEvent(CLASS_STATE_EVENT, { detail: { classKey: scope.classKey, keys } }));
}

function localKeysOf(scope: Scope): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (scope.classKey ? matchClassKey(k, scope.classKey) : k in TEACHER_KEYS) out.push(k);
    }
  } catch {}
  return out;
}

function isPraisePointKey(scope: Scope, key: string) {
  return !!scope.classKey && matchClassKey(key, scope.classKey)?.prefix === 'kis_praise_';
}

function startScope(scope: Scope) {
  const migratedFlag = `kis_state_migrated_${scope.id}`;
  let first = true;
  scope.unsub = onSnapshot(
    collection(getDb(), 'homeroom_classes', scope.id, 'state'),
    (snap) => {
      const changed: string[] = [];
      const fromServer = new Map<string, string | null>();
      snap.docChanges().forEach((ch) => {
        const data = ch.doc.data() as { key?: string; value?: string | null };
        const key = data.key || ch.doc.id;
        const value = ch.type === 'removed' ? null : (data.value ?? null);
        fromServer.set(key, value);
      });

      let alreadyMigrated = false;
      try {
        alreadyMigrated = localStorage.getItem(migratedFlag) === '1';
      } catch {}

      applyingRemote = true;
      try {
        fromServer.forEach((value, key) => {
          scope.remote.set(key, value);
          // 이 기기에서 아직 올라가지 않은 변경이 있으면 서버 값으로 덮지 않음
          if (pending.has(`${scope.id}::${key}`)) return;
          let local: string | null = null;
          try {
            local = localStorage.getItem(key);
          } catch {}
          if (local === value) return;
          // 처음 이전 시 칭찬 점수는 큰 값을 남김
          if (first && !alreadyMigrated && isPraisePointKey(scope, key) && local !== null) {
            if ((Number(local) || 0) > (Number(value) || 0)) return;
          }
          if (value === null) rawRemoveItem?.(key);
          else rawSetItem?.(key, value);
          changed.push(key);
        });
      } finally {
        applyingRemote = false;
      }

      if (first) {
        first = false;
        // 기존 기기 데이터 이전: 서버에 없거나(1회) 로컬이 더 큰 칭찬 점수는 서버로 올림
        if (!alreadyMigrated) {
          localKeysOf(scope).forEach((k) => {
            const local = localStorage.getItem(k);
            const remote = scope.remote.get(k);
            if (!scope.remote.has(k) || remote === null) {
              if (local !== null) void pushNow(scope, k);
            } else if (isPraisePointKey(scope, k) && (Number(local) || 0) > (Number(remote) || 0)) {
              void pushNow(scope, k);
            }
          });
          try {
            rawSetItem?.(migratedFlag, '1');
          } catch {}
        }
        scope.ready = true;
        scope.ok = true;
        scope.readyWaiters.splice(0).forEach((fn) => fn());
      }
      if (changed.length) dispatchFor(scope, changed);
    },
    (err) => {
      console.error('[classStateSync] 구독 실패:', scope.id, err);
      scope.ready = true;
      scope.readyWaiters.splice(0).forEach((fn) => fn());
    }
  );
}

function acquire(id: string, classKey?: string): () => void {
  if (typeof window === 'undefined' || !id) return () => {};
  patchStorage();
  let scope = scopes.get(id);
  if (!scope) {
    scope = { id, classKey, refs: 0, ready: false, ok: false, readyWaiters: [], remote: new Map() };
    scopes.set(id, scope);
    startScope(scope);
  }
  scope.refs += 1;
  const s = scope;
  return () => {
    s.refs -= 1;
    if (s.refs > 0) return;
    // 남은 변경은 즉시 올리고 구독 해제
    for (const [pid, p] of pending) {
      if (p.scope === s) {
        clearTimeout(p.timer);
        pending.delete(pid);
        void pushNow(s, p.key);
      }
    }
    s.unsub?.();
    scopes.delete(s.id);
  };
}

/** 학급 도구 상태 동기화 시작 (반환 함수로 해제) */
export function startClassStateSync(classKey: string): () => void {
  if (!classKey) return () => {};
  return acquire(classKey, classKey);
}

/** 교사 개인 화면 설정 동기화 시작 */
export function startTeacherPrefsSync(email?: string | null): () => void {
  if (!email) return () => {};
  return acquire(teacherScopeId(email));
}

/** 서버 값이 처음 반영될 때까지 기다림. 서버와 연결되었으면 true */
export async function whenClassStateReady(classKey: string): Promise<boolean> {
  // 하위 화면의 effect가 상위(동기화 시작)보다 먼저 실행되므로 잠시 기다림
  for (let i = 0; i < 20 && !scopes.get(classKey); i++) await new Promise((r) => setTimeout(r, 100));
  const s = scopes.get(classKey);
  if (!s) return false;
  if (s.ready) return Promise.resolve(s.ok);
  return new Promise((resolve) => {
    s.readyWaiters.push(() => resolve(s.ok));
    setTimeout(() => resolve(s.ok), 8000);
  });
}
