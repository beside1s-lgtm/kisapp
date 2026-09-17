import { getDb } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getMorningGateDutyConfig, extractTeacherDutySlots } from '@/lib/kisbus/morning-gate-duty';

export interface UserNotificationSettings {
  enableBrowserNotification: boolean; // 브라우저 우측 하단 팝업 알림
  enableTaskbarBadge: boolean;        // 작업표시줄 및 탭 배지 표시
  enableSound: boolean;               // 알림음 재생
  keepPopupUntilDismissed: boolean;   // 직접 닫을 때까지 화면 우측 하단에 알림 팝업 계속 유지
  notifyOnNewApproval: boolean;       // 새 결재문서 도착 시 알림
  notifyOnDutySchedule: boolean;      // 근무일/당직 알림
}

export const DEFAULT_NOTIFICATION_SETTINGS: UserNotificationSettings = {
  enableBrowserNotification: true,
  enableTaskbarBadge: true,
  enableSound: true,
  keepPopupUntilDismissed: true,      // 기본값: 자리 비움 대비 화면에 계속 유지
  notifyOnNewApproval: true,
  notifyOnDutySchedule: true,
};

const SETTINGS_STORAGE_KEY = 'kis_user_notification_settings_v1';

/**
 * 1. 알림 환경설정 로드
 */
export const loadNotificationSettings = (userEmail?: string | null): UserNotificationSettings => {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const key = userEmail ? `${SETTINGS_STORAGE_KEY}_${userEmail.trim().toLowerCase()}` : SETTINGS_STORAGE_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('loadNotificationSettings error:', e);
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

/**
 * 2. 알림 환경설정 저장
 */
export const saveNotificationSettings = (settings: UserNotificationSettings, userEmail?: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    const key = userEmail ? `${SETTINGS_STORAGE_KEY}_${userEmail.trim().toLowerCase()}` : SETTINGS_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (e) {
    console.warn('saveNotificationSettings error:', e);
  }
};

/**
 * 3. 브라우저 알림 권한 확인 및 요청
 */
export const getNotificationPermission = (): NotificationPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (e) {
    console.error('requestNotificationPermission error:', e);
    return 'denied';
  }
};

/**
 * 4. 브라우저 알림음 재생 (웹 오디오 API 기반 경쾌한 챠임 사운드)
 */
export const playNotificationSound = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440, now);
    osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  } catch (e) {
    // 오디오 컨텍스트 자동 재생 제한 무시
  }
};

/**
 * 5. Windows 작업표시줄 및 브라우저 탭 파비콘/타이틀 배지 갱신 (Badging API)
 */
export const updateAppBadge = (count: number, enabled: boolean = true) => {
  if (typeof window === 'undefined') return;

  const effectiveCount = enabled ? Math.max(0, count) : 0;

  // 1) 웹 표준 Badging API (Windows 작업표시줄 / 스마트폰 홈 화면 배지)
  if ('setAppBadge' in navigator) {
    try {
      if (effectiveCount > 0) {
        navigator.setAppBadge(effectiveCount).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    } catch (e) {}
  }

  // 2) 브라우저 탭 타이틀 보완 (예: "(2) KIS 통합 포털")
  try {
    const currentTitle = document.title.replace(/^\(\d+\)\s*/, '');
    if (effectiveCount > 0) {
      document.title = `(${effectiveCount}) ${currentTitle}`;
    } else {
      document.title = currentTitle;
    }
  } catch (e) {}
};

/**
 * 6. 브라우저 네이티브 알림 팝업 전송 (카카오톡 스타일 Windows 토스트)
 */
export const sendBrowserNotification = (
  title: string,
  options: {
    body: string;
    url?: string;
    tag?: string;
    icon?: string;
    requireInteraction?: boolean;
    playSound?: boolean;
  }
) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    if (options.playSound !== false) {
      playNotificationSound();
    }

    const notif = new Notification(title, {
      body: options.body,
      icon: options.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: options.tag || 'kis_approval_notification',
      requireInteraction: options.requireInteraction !== undefined ? options.requireInteraction : true,
    });

    notif.onclick = (event) => {
      event.preventDefault();
      window.focus();
      if (options.url) {
        window.location.href = options.url;
      }
      notif.close();
    };

    return notif;
  } catch (e) {
    console.error('sendBrowserNotification error:', e);
    return null;
  }
};

/**
 * 7. 실시간 미결재(대기) 문서 수 구독 및 알림 트리거
 * - Firestore 'approvals' 컬렉션에서 status == 'pending' 실시간 리스너
 * - 현재 내 차례인 문서 건수 계산 -> 배지 갱신
 * - 신규 문서 도착 시 브라우저 팝업 알림 발송
 */
export const subscribePendingApprovals = (
  userEmail: string,
  userName?: string,
  onCountChange?: (count: number) => void
) => {
  if (!userEmail) return () => {};
  const normalizedEmail = userEmail.trim().toLowerCase();
  const normalizedName = userName?.trim();

  let isFirstLoad = true;
  let prevCount = 0;

  const approvalsCol = collection(getDb(), 'approvals');
  const q = query(approvalsCol, where('status', '==', 'pending'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    let myPendingCount = 0;
    const myNewDocs: any[] = [];

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const currentStep = data.currentStep;
      const approvers = data.approvers || [];

      if (typeof currentStep === 'number' && currentStep >= 0 && currentStep < approvers.length) {
        const currentApprover = approvers[currentStep];
        const apEmail = (currentApprover?.email || '').trim().toLowerCase();
        const apName = (currentApprover?.name || '').trim();

        const isMyTurn = (apEmail && apEmail === normalizedEmail) ||
                         (normalizedName && apName && apName === normalizedName);

        if (isMyTurn) {
          myPendingCount++;
          myNewDocs.push({ id: docSnap.id, ...data });
        }
      }
    });

    const settings = loadNotificationSettings(normalizedEmail);

    // 1) 작업표시줄 및 탭 배지 업데이트
    updateAppBadge(myPendingCount, settings.enableTaskbarBadge);

    // 2) 신규 결재문서 도착 시 푸시 알림 발송
    if (!isFirstLoad && myPendingCount > prevCount && settings.enableBrowserNotification && settings.notifyOnNewApproval) {
      const diff = myPendingCount - prevCount;
      const latestDoc = myNewDocs[0];
      const docTitle = latestDoc?.title || latestDoc?.formTitle || '전자결재 문서';
      const requester = latestDoc?.requesterName ? `${latestDoc.requesterName} 교사` : '기안자';

      sendBrowserNotification(`[결재 요청] ${docTitle}`, {
        body: `${requester}로부터 승인 대기 문서(${diff}건)가 도착했습니다.`,
        url: latestDoc?.id ? `/inbox?docId=${latestDoc.id}` : '/inbox',
        tag: `approval_${latestDoc?.id || Date.now()}`,
        playSound: settings.enableSound,
        requireInteraction: settings.keepPopupUntilDismissed ?? true
      });
    }

    prevCount = myPendingCount;
    isFirstLoad = false;

    if (onCountChange) {
      onCountChange(myPendingCount);
    }
  }, (err) => {
    console.warn('subscribePendingApprovals listener error:', err);
  });

  return () => {
    unsubscribe();
  };
};

/**
 * 8. 등교지도 근무일 전일(월요일 근무 시 금요일) 오전 11시 40분 사전 알림 스케줄링
 */
export const checkAndScheduleDutyNotification = async (
  userEmail: string,
  userName: string
): Promise<(() => void) | undefined> => {
  if (typeof window === 'undefined' || !userEmail || !userName) return;

  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const check = async () => {
    const settings = loadNotificationSettings(userEmail);
    if (!settings.enableBrowserNotification || !settings.notifyOnDutySchedule) return;

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0: 일, 1: 월, 2: 화, 3: 수, 4: 목, 5: 금, 6: 토

    // 월~금 평일 검사 (금요일은 다음 주 월요일 근무 검사, 월~목은 내일 근무 검사)
    if (dayOfWeek < 1 || dayOfWeek > 5) return;

    let targetDate: Date;
    let isMondayDuty = false;

    if (dayOfWeek === 5) {
      // 금요일 -> 3일 뒤인 다음 주 월요일 근무 확인
      targetDate = new Date(now);
      targetDate.setDate(now.getDate() + 3);
      isMondayDuty = true;
    } else {
      // 월~목 -> 1일 뒤인 내일 근무 확인
      targetDate = new Date(now);
      targetDate.setDate(now.getDate() + 1);
    }

    const targetDateStr = formatLocalDate(targetDate);
    const storageKey = `kis_duty_notified_${userEmail.trim().toLowerCase()}_${targetDateStr}`;

    // 이미 오늘 이 대상 근무일에 대한 알림을 전송했으면 중복 발송 방지
    if (localStorage.getItem(storageKey)) return;

    // 등교지도 설정 및 해당 교사 근무 일정 조회
    const config = await getMorningGateDutyConfig();
    const slots = extractTeacherDutySlots(config, userName);
    const matchingSlot = slots.find(s => s.dateStr === targetDateStr);

    if (!matchingSlot) return; // 전일 알림 대상 근무가 없음

    // 11시 40분 목표 시각 계산
    const targetHour = 11;
    const targetMinute = 40;
    const triggerTime = new Date(now);
    triggerTime.setHours(targetHour, targetMinute, 0, 0);

    const timeDiff = triggerTime.getTime() - now.getTime();

    const fireDutyNotification = () => {
      // 발송 시점에도 최신 설정 다시 확인
      const currentSettings = loadNotificationSettings(userEmail);
      if (!currentSettings.enableBrowserNotification || !currentSettings.notifyOnDutySchedule) return;

      const title = isMondayDuty
        ? `[등교지도 알림] 월요일 아침 등교지도 근무일입니다`
        : `[등교지도 알림] 내일(${matchingSlot.dayOfWeekName}) 아침 등교지도 근무일입니다`;

      const month = targetDate.getMonth() + 1;
      const date = targetDate.getDate();
      const body = isMondayDuty
        ? `다음 주 월요일(${month}/${date}) 아침 ${matchingSlot.startTime}~${matchingSlot.endTime} 등교지도 근무일입니다. 잊지 말고 준비해 주세요.`
        : `내일(${matchingSlot.dayOfWeekName}요일, ${month}/${date}) 아침 ${matchingSlot.startTime}~${matchingSlot.endTime} 등교지도 근무일입니다. 잊지 말고 준비해 주세요.`;

      sendBrowserNotification(title, {
        body,
        url: '/teacher/bus',
        tag: `duty_reminder_${targetDateStr}`,
        playSound: currentSettings.enableSound,
        requireInteraction: currentSettings.keepPopupUntilDismissed ?? true
      });

      localStorage.setItem(storageKey, new Date().toISOString());
    };

    if (timeDiff <= 0) {
      // 이미 오전 11:40이 지난 시점에 접속한 경우: 아직 오늘 알림을 못 받았으므로 즉시 발송
      fireDutyNotification();
      return undefined;
    } else {
      // 11:40 이전인 경우: 정확히 11:40에 발송되도록 타이머 예약
      const timerId = setTimeout(() => {
        fireDutyNotification();
      }, timeDiff);
      return () => clearTimeout(timerId);
    }
  };

  return check();
};
