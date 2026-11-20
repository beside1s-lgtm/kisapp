// 칭찬 보상 및 포인트 통장(학급 화폐) 타입 정의

export type RewardCategory = 'coupon' | 'privilege' | 'item' | 'other';

export interface RewardItem {
  id: string;
  name: string;
  cost: number; // 필요 포인트 (차감량)
  desc: string;
  category: RewardCategory;
  icon: string;
  isEnabled: boolean;
}

export interface StudentRewardAccount {
  studentId: string;
  studentName: string;
  studentNum?: string | number;
  gender?: string;
  balance: number; // 현재 사용 가능한 소비형 포인트 잔액
  totalEarned: number; // 누적 획득 포인트 (칭찬 적립 누적)
  totalSpent: number; // 누적 사용/교환 포인트
  lastUpdated: string;
}

export type TransactionType = 'EARN' | 'SPEND' | 'ADJUST' | 'TRANSFER';

export interface PointTransaction {
  id: string;
  timestamp: string;
  studentId: string;
  studentName: string;
  type: TransactionType;
  amount: number; // 증감 (+/-)
  reason: string; // 사유 (예: '칭찬 포인트 적립', '자리 1일 선택권 교환', '교사 수동 지급')
  balanceAfter: number;
}
