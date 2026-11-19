import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import { CURRENT_SCHOOL_YEAR } from '@/lib/services/handoverService';

export interface HandoverLockStatus {
  year: number;
  isLocked: boolean;
  lockedAt?: string | null;
  lockedByName?: string;
  lockedByEmail?: string;
  lockReason?: string;
  unlockedAt?: string | null;
  unlockedByName?: string;
  unlockedByEmail?: string;
  updatedAt: string;
}

const SETTINGS_COLLECTION = 'settings';
const LOCK_DOC_ID = 'handover_lock';

/**
 * 인수인계 잠금 상태 조회 (기본값: false / 오픈)
 */
export async function getHandoverLockStatus(
  year: number = CURRENT_SCHOOL_YEAR
): Promise<HandoverLockStatus> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, `${LOCK_DOC_ID}_${year}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as HandoverLockStatus;
    }

    // 기본 오픈 상태
    return {
      year,
      isLocked: false,
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    console.warn('[handoverLockService] getHandoverLockStatus error:', err);
    return {
      year,
      isLocked: false,
      updatedAt: new Date().toISOString()
    };
  }
}

/**
 * 교무부장 또는 관리자에 의한 인수인계 잠금 상태 수동 변경 (토글)
 */
export async function setHandoverLockStatus(params: {
  isLocked: boolean;
  userProfile?: UserProfile | null;
  reason?: string;
  year?: number;
}): Promise<HandoverLockStatus> {
  const year = params.year || CURRENT_SCHOOL_YEAR;
  const nowIso = new Date().toISOString();
  const userName = params.userProfile?.name || '교무부장';
  const userEmail = params.userProfile?.email || '';

  const docRef = doc(db, SETTINGS_COLLECTION, `${LOCK_DOC_ID}_${year}`);
  const existing = await getHandoverLockStatus(year);

  const newStatus: HandoverLockStatus = {
    ...existing,
    year,
    isLocked: params.isLocked,
    updatedAt: nowIso
  };

  if (params.isLocked) {
    newStatus.lockedAt = nowIso;
    newStatus.lockedByName = userName;
    newStatus.lockedByEmail = userEmail;
    newStatus.lockReason = params.reason || '교무부장 수동 마감(잠금)';

    // 잠금(마감) 시 기존 활성화된 인수인계 작성 요청 공지 팝업도 자동 비활성화(active: false)
    try {
      const noticeRef = doc(db, SETTINGS_COLLECTION, 'handover_notice');
      await setDoc(noticeRef, { active: false, deactivatedAt: nowIso }, { merge: true });
    } catch (noticeErr) {
      console.warn('[handoverLockService] deactivate notice error:', noticeErr);
    }
  } else {
    newStatus.unlockedAt = nowIso;
    newStatus.unlockedByName = userName;
    newStatus.unlockedByEmail = userEmail;
    newStatus.lockReason = params.reason || '교무부장 수동 재오픈(잠금 해제)';
  }

  await setDoc(docRef, newStatus, { merge: true });
  return newStatus;
}

/**
 * 교감 최종 결재 완료 시 자동 잠금 실행
 */
export async function autoLockHandoverByVicePrincipal(params: {
  vpName?: string;
  vpEmail?: string;
  year?: number;
  reason?: string;
}): Promise<void> {
  const year = params.year || CURRENT_SCHOOL_YEAR;
  const nowIso = new Date().toISOString();
  const docRef = doc(db, SETTINGS_COLLECTION, `${LOCK_DOC_ID}_${year}`);

  const existing = await getHandoverLockStatus(year);

  const newStatus: HandoverLockStatus = {
    ...existing,
    year,
    isLocked: true,
    lockedAt: nowIso,
    lockedByName: params.vpName || '교감',
    lockedByEmail: params.vpEmail || '',
    lockReason: params.reason || '교감 최종 결재 완료로 자동 마감',
    updatedAt: nowIso
  };

  await setDoc(docRef, newStatus, { merge: true });

  // 교감 최종 결재 완료로 자동 잠금 시 공지 팝업도 자동 비활성화
  try {
    const noticeRef = doc(db, SETTINGS_COLLECTION, 'handover_notice');
    await setDoc(noticeRef, { active: false, deactivatedAt: nowIso }, { merge: true });
  } catch (noticeErr) {
    console.warn('[handoverLockService] deactivate notice error (vp auto lock):', noticeErr);
  }
}

/**
 * 실시간 잠금 상태 구독
 */
export function subscribeHandoverLockStatus(
  callback: (status: HandoverLockStatus) => void,
  year: number = CURRENT_SCHOOL_YEAR
): () => void {
  const docRef = doc(db, SETTINGS_COLLECTION, `${LOCK_DOC_ID}_${year}`);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as HandoverLockStatus);
      } else {
        callback({
          year,
          isLocked: false,
          updatedAt: new Date().toISOString()
        });
      }
    },
    (err) => {
      console.warn('[handoverLockService] subscribeHandoverLockStatus error:', err);
    }
  );
}
