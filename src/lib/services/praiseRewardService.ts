import type { RewardItem, StudentRewardAccount, PointTransaction } from '@/lib/types/praiseReward';
import type { DeskSlot } from '@/lib/types/seating';

export const DEFAULT_REWARD_ITEMS: RewardItem[] = [
  {
    id: 'reward_seat_choice',
    name: '자리 1일 선택권',
    cost: 15,
    desc: '원하는 자리에 하루 동안 자유롭게 앉을 수 있는 쿠폰',
    category: 'privilege',
    icon: '🪑',
    isEnabled: true,
  },
  {
    id: 'reward_homework_pass',
    name: '숙제 1회 면제권',
    cost: 20,
    desc: '일기나 일일 숙제를 1회 면제받을 수 있는 쿠폰',
    category: 'coupon',
    icon: '📝',
    isEnabled: true,
  },
  {
    id: 'reward_lunch_first',
    name: '급식 1등 줄서기',
    cost: 10,
    desc: '점심시간에 가장 먼저 배식을 받을 수 있는 특권',
    category: 'privilege',
    icon: '🍱',
    isEnabled: true,
  },
  {
    id: 'reward_cleaning_pass',
    name: '1일 청소 당번 면제권',
    cost: 10,
    desc: '하루 동안 교실 청소 당번을 쉴 수 있는 쿠폰',
    category: 'coupon',
    icon: '🧹',
    isEnabled: true,
  },
  {
    id: 'reward_teacher_game',
    name: '선생님과 1:1 보드게임',
    cost: 25,
    desc: '쉬는 시간이나 방과후에 선생님과 재미있는 보드게임을 해요',
    category: 'other',
    icon: '🎲',
    isEnabled: true,
  },
  {
    id: 'reward_pass_speech',
    name: '발표 1회 패스권',
    cost: 5,
    desc: '수업 중 발표 차례가 왔을 때 1회 패스할 수 있는 쿠폰',
    category: 'coupon',
    icon: '✋',
    isEnabled: true,
  },
  {
    id: 'reward_snack_box',
    name: '학급 보물상자 뽑기',
    cost: 15,
    desc: '간식이나 유용한 학용품이 담긴 보물상자 뽑기 1회',
    category: 'item',
    icon: '🎁',
    isEnabled: true,
  },
];

const REWARDS_STORAGE_PREFIX = 'kis_praise_rewards_';
const ACCOUNTS_STORAGE_PREFIX = 'kis_praise_accounts_';
const TRANSACTIONS_STORAGE_PREFIX = 'kis_praise_tx_';

// ─── 1. 보상 아이템 관리 ───
export function getSavedRewardItems(classKey: string): RewardItem[] {
  if (typeof window === 'undefined') return DEFAULT_REWARD_ITEMS;
  try {
    const raw = localStorage.getItem(`${REWARDS_STORAGE_PREFIX}${classKey}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse reward items:', e);
  }
  return DEFAULT_REWARD_ITEMS;
}

export function saveRewardItems(classKey: string, items: RewardItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${REWARDS_STORAGE_PREFIX}${classKey}`, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('class-rewards-updated', { detail: { classKey, items } }));
  } catch (e) {
    console.error('Failed to save reward items:', e);
  }
}

// ─── 2. 학생 포인트 통장 계좌 관리 ───
export function getSavedAccounts(classKey: string): Record<string, StudentRewardAccount> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${ACCOUNTS_STORAGE_PREFIX}${classKey}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse accounts:', e);
  }
  return {};
}

export function saveAccounts(classKey: string, accounts: Record<string, StudentRewardAccount>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${ACCOUNTS_STORAGE_PREFIX}${classKey}`, JSON.stringify(accounts));
    window.dispatchEvent(new CustomEvent('class-reward-accounts-updated', { detail: { classKey, accounts } }));
  } catch (e) {
    console.error('Failed to save accounts:', e);
  }
}

/**
 * 현재 자리 배치(slots)를 기준으로 학생들의 통장 계좌 목록을 안전하게 동기화/조회
 */
export function getSyncedStudentAccounts(
  classKey: string,
  slots: DeskSlot[] = []
): StudentRewardAccount[] {
  const savedMap = getSavedAccounts(classKey);
  let updated = false;

  slots.forEach((slot) => {
    if (!slot.studentId) return;

    if (!savedMap[slot.studentId]) {
      // 최초 계좌 개설: 기존에 가지고 있던 칭찬 점수가 있다면 초기 잔액으로 시작
      const initPoints = slot.praisePoints || 0;
      const studentNumVal = typeof slot.studentNum === 'number' ? slot.studentNum : slot.studentNum ? Number(slot.studentNum) || undefined : undefined;
      const studentGenderVal = slot.studentGender ? String(slot.studentGender) : undefined;
      savedMap[slot.studentId] = {
        studentId: slot.studentId,
        studentName: slot.studentName || '학생',
        studentNum: studentNumVal,
        gender: studentGenderVal,
        balance: initPoints,
        totalEarned: initPoints,
        totalSpent: 0,
        lastUpdated: new Date().toISOString(),
      };
      updated = true;
    } else {
      // 이름, 번호 등 프로필 갱신
      const acc = savedMap[slot.studentId];
      const studentNumVal = typeof slot.studentNum === 'number' ? slot.studentNum : slot.studentNum ? Number(slot.studentNum) || undefined : undefined;
      const studentGenderVal = slot.studentGender ? String(slot.studentGender) : undefined;
      if (
        acc.studentName !== slot.studentName ||
        acc.studentNum !== studentNumVal ||
        acc.gender !== studentGenderVal
      ) {
        acc.studentName = slot.studentName || acc.studentName;
        acc.studentNum = studentNumVal ?? acc.studentNum;
        acc.gender = studentGenderVal ?? acc.gender;
        updated = true;
      }
    }
  });

  if (updated) {
    saveAccounts(classKey, savedMap);
  }

  // 번호순/이름순 정렬
  return Object.values(savedMap).sort((a, b) => {
    const numA = Number(a.studentNum);
    const numB = Number(b.studentNum);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.studentName.localeCompare(b.studentName);
  });
}

// ─── 3. 거래 내역 (Transactions) ───
export function getSavedTransactions(classKey: string): PointTransaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${TRANSACTIONS_STORAGE_PREFIX}${classKey}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse transactions:', e);
  }
  return [];
}

export function appendTransaction(classKey: string, tx: PointTransaction): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getSavedTransactions(classKey);
    const updated = [tx, ...list].slice(0, 300); // 최근 300건 보관
    localStorage.setItem(`${TRANSACTIONS_STORAGE_PREFIX}${classKey}`, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('class-reward-tx-updated', { detail: { classKey, transaction: tx } }));
  } catch (e) {
    console.error('Failed to save transaction:', e);
  }
}

// ─── 4. 핵심 금융 액션 (칭찬 적립, 보상 교환, 수동 조정) ───

/**
 * 칭찬 점수 획득 시 포인트 통장에도 동일하게 소비형 포인트 적립
 */
export function depositRewardPoints(
  classKey: string,
  studentId: string,
  studentName: string,
  amount: number,
  reason: string = '칭찬 점수 획득 적립'
): StudentRewardAccount | null {
  if (amount <= 0) return null;
  const accounts = getSavedAccounts(classKey);
  const acc = accounts[studentId] || {
    studentId,
    studentName,
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastUpdated: new Date().toISOString(),
  };

  acc.balance += amount;
  acc.totalEarned += amount;
  acc.lastUpdated = new Date().toISOString();
  accounts[studentId] = acc;
  saveAccounts(classKey, accounts);

  appendTransaction(classKey, {
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    studentId,
    studentName,
    type: 'EARN',
    amount,
    reason,
    balanceAfter: acc.balance,
  });

  return acc;
}

/**
 * 보상 교환 (포인트 소비/차감)
 */
export function exchangeRewardItem(
  classKey: string,
  studentId: string,
  reward: RewardItem
): { success: boolean; message: string; account?: StudentRewardAccount } {
  const accounts = getSavedAccounts(classKey);
  const acc = accounts[studentId];
  if (!acc) {
    return { success: false, message: '학생 통장을 찾을 수 없습니다.' };
  }

  if (acc.balance < reward.cost) {
    return {
      success: false,
      message: `포인트가 부족합니다. (현재: ${acc.balance}P / 필요: ${reward.cost}P)`,
    };
  }

  acc.balance -= reward.cost;
  acc.totalSpent += reward.cost;
  acc.lastUpdated = new Date().toISOString();
  accounts[studentId] = acc;
  saveAccounts(classKey, accounts);

  appendTransaction(classKey, {
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    studentId,
    studentName: acc.studentName,
    type: 'SPEND',
    amount: -reward.cost,
    reason: `보상 교환: ${reward.name}`,
    balanceAfter: acc.balance,
  });

  return {
    success: true,
    message: `${acc.studentName} 학생이 [${reward.name}]을(를) 교환했습니다. (-${reward.cost}P)`,
    account: acc,
  };
}

/**
 * 교사 수동 포인트 지급 또는 차감 조정
 */
export function adjustStudentPoints(
  classKey: string,
  studentId: string,
  delta: number,
  reason: string
): { success: boolean; account?: StudentRewardAccount } {
  const accounts = getSavedAccounts(classKey);
  const acc = accounts[studentId];
  if (!acc) return { success: false };

  const prevBalance = acc.balance;
  const nextBalance = Math.max(0, prevBalance + delta);
  const actualDelta = nextBalance - prevBalance;

  acc.balance = nextBalance;
  if (actualDelta > 0) {
    acc.totalEarned += actualDelta;
  } else if (actualDelta < 0) {
    acc.totalSpent += Math.abs(actualDelta);
  }
  acc.lastUpdated = new Date().toISOString();
  accounts[studentId] = acc;
  saveAccounts(classKey, accounts);

  appendTransaction(classKey, {
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    studentId,
    studentName: acc.studentName,
    type: 'ADJUST',
    amount: actualDelta,
    reason: reason || (actualDelta >= 0 ? '교사 수동 지급' : '교사 수동 차감'),
    balanceAfter: acc.balance,
  });

  return { success: true, account: acc };
}
