import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { WeeklyEducationPlan } from '@/lib/types';

const COLLECTION_NAME = 'weekly_education_plans';

/**
 * 특정 주의 주간교육계획 문서 ID 생성 (예: 'plan_2026-08-17')
 */
export function getWeeklyPlanDocId(startDate: string): string {
  return `plan_${startDate}`;
}

/**
 * 특정 주차의 주간교육계획 문서 가져오기
 */
export async function getWeeklyEducationPlan(startDate: string): Promise<WeeklyEducationPlan | null> {
  try {
    const db = getDb();
    const docId = getWeeklyPlanDocId(startDate);
    const docRef = doc(db, COLLECTION_NAME, docId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      return snap.data() as WeeklyEducationPlan;
    }
    return null;
  } catch (error) {
    console.error('Error fetching weekly education plan:', error);
    return null;
  }
}

/**
 * 주간교육계획 저장 또는 업데이트
 */
export async function saveWeeklyEducationPlan(
  plan: WeeklyEducationPlan,
  userProfile?: { email: string; name?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const docId = getWeeklyPlanDocId(plan.startDate);
    const docRef = doc(db, COLLECTION_NAME, docId);

    const dataToSave: WeeklyEducationPlan = {
      ...plan,
      id: docId,
      updatedAt: new Date().toISOString(),
      updatedBy: userProfile?.email || 'system',
      updatedByName: userProfile?.name || '교직원'
    };

    await setDoc(docRef, dataToSave, { merge: true });
    return { success: true };
  } catch (error: any) {
    console.error('Error saving weekly education plan:', error);
    return { success: false, error: error.message || '저장 중 오류가 발생했습니다.' };
  }
}

/**
 * 실시간 주간교육계획 구독
 */
export function subscribeWeeklyEducationPlan(
  startDate: string,
  onUpdate: (plan: WeeklyEducationPlan | null) => void
) {
  const db = getDb();
  const docId = getWeeklyPlanDocId(startDate);
  const docRef = doc(db, COLLECTION_NAME, docId);

  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      onUpdate(snap.data() as WeeklyEducationPlan);
    } else {
      onUpdate(null);
    }
  }, (err) => {
    console.error('Error in subscribeWeeklyEducationPlan:', err);
  });
}
