import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { MonthlyEducationPlan } from '@/lib/types';

const COLLECTION_NAME = 'monthly_education_plans';

/**
 * 특정 월의 월간교육계획 문서 ID 생성 (예: 'plan_2026-06')
 */
export function getMonthlyPlanDocId(year: number, month: number): string {
  const monthStr = String(month).padStart(2, '0');
  return `plan_${year}-${monthStr}`;
}

/**
 * 특정 월의 월간교육계획 문서 가져오기
 */
export async function getMonthlyEducationPlan(year: number, month: number): Promise<MonthlyEducationPlan | null> {
  try {
    const db = getDb();
    const docId = getMonthlyPlanDocId(year, month);
    const docRef = doc(db, COLLECTION_NAME, docId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      return snap.data() as MonthlyEducationPlan;
    }
    return null;
  } catch (error) {
    console.error('Error fetching monthly education plan:', error);
    return null;
  }
}

/**
 * 월간교육계획 저장 또는 업데이트
 */
export async function saveMonthlyEducationPlan(
  plan: MonthlyEducationPlan,
  userProfile?: { email: string; name?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const docId = getMonthlyPlanDocId(plan.year, plan.month);
    const docRef = doc(db, COLLECTION_NAME, docId);

    const dataToSave: MonthlyEducationPlan = {
      ...plan,
      id: docId,
      updatedAt: new Date().toISOString(),
      updatedBy: userProfile?.email || 'system',
      updatedByName: userProfile?.name || '교직원'
    };

    await setDoc(docRef, dataToSave, { merge: true });
    return { success: true };
  } catch (error: any) {
    console.error('Error saving monthly education plan:', error);
    return { success: false, error: error.message || '저장 중 오류가 발생했습니다.' };
  }
}

/**
 * 실시간 월간교육계획 구독
 */
export function subscribeMonthlyEducationPlan(
  year: number,
  month: number,
  onUpdate: (plan: MonthlyEducationPlan | null) => void
) {
  const db = getDb();
  const docId = getMonthlyPlanDocId(year, month);
  const docRef = doc(db, COLLECTION_NAME, docId);

  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      onUpdate(snap.data() as MonthlyEducationPlan);
    } else {
      onUpdate(null);
    }
  }, (err) => {
    console.error('Error in subscribeMonthlyEducationPlan:', err);
  });
}
