import type { PraiseTier } from '@/lib/types/seating';

export interface PromotedStudentInfo {
  studentId: string;
  studentName: string;
  studentNum?: string | number | null;
  gender?: string | null;
  photoUrl?: string | null;
  oldLevel: number;
  newLevel: number;
  oldTierName?: string;
  tier: PraiseTier;
}

export interface PromotionGroup {
  level: number;
  tier: PraiseTier;
  students: PromotedStudentInfo[];
}
