import type { PromotedStudentInfo } from '@/lib/types/praisePromotion';
import { getPraiseTier } from '@/lib/types/seating';

export const PRAISE_PROMOTION_EVENT = 'kis-praise-promotion-event';

export interface PromotionEventDetail {
  classKey: string;
  promotedStudents: PromotedStudentInfo[];
}

/**
 * 승급 축하 이벤트 발행
 */
export function emitPraisePromotions(classKey: string, promotedStudents: PromotedStudentInfo[]): void {
  if (typeof window === 'undefined' || !promotedStudents || promotedStudents.length === 0) return;

  window.dispatchEvent(
    new CustomEvent<PromotionEventDetail>(PRAISE_PROMOTION_EVENT, {
      detail: { classKey, promotedStudents },
    })
  );
}

/**
 * 점수 변경 전/후를 비교하여 승급 여부 판별 후 승급 학생 정보 생성
 */
export function evaluatePromotion(
  classKey: string,
  studentId: string,
  studentName: string,
  oldPoints: number,
  newPoints: number,
  meta?: {
    studentNum?: string | number | null;
    gender?: string | null;
    photoUrl?: string | null;
  }
): PromotedStudentInfo | null {
  if (newPoints <= oldPoints) return null;

  const oldTier = getPraiseTier(oldPoints, classKey);
  const newTier = getPraiseTier(newPoints, classKey);

  if (newTier.level > oldTier.level) {
    return {
      studentId,
      studentName,
      studentNum: meta?.studentNum,
      gender: meta?.gender,
      photoUrl: meta?.photoUrl,
      oldLevel: oldTier.level,
      newLevel: newTier.level,
      oldTierName: oldTier.name,
      tier: newTier,
    };
  }

  return null;
}
