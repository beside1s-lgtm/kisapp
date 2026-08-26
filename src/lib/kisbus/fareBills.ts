import { fetchDocument, setDocument, onDocumentUpdate, fetchCollection, onCollectionUpdate } from './core';
import type { BusFareBill } from './types';
import { normalizeString } from './utils';

export interface BusFareBillsStore {
  quarterId: string;
  quarterName: string;
  issuedAt: string;
  bills: BusFareBill[];
}

/**
 * 관리자가 특정 분기의 학생별 청구서를 일괄 발행하여 Firestore에 저장합니다.
 */
export async function issueBusFareBills(
  quarterId: string,
  quarterName: string,
  bills: BusFareBill[]
): Promise<void> {
  const issuedAt = new Date().toISOString();
  // 평일 정규 등하교 버스를 실제 탑승 신청한 학생만 필터링하여 청구서 발행
  const stampedBills = bills
    .filter(b => b.isRiding)
    .map(b => ({
      ...b,
      issuedAt,
      isConfirmed: false
    }));


  // 1) 분기별 청구서 묶음 문서 저장 (kisbus_fare_bills / bills_{quarterId})
  await setDocument<BusFareBillsStore>('bus_fare_bills', `quarter_${quarterId}`, {
    quarterId,
    quarterName,
    issuedAt,
    bills: stampedBills
  });

  // 2) 최신 청구서 포인터 저장 (학부모 포털에서 즉시 최신 청구서 감지용)
  await setDocument<{ activeQuarterId: string; lastIssuedAt: string }>(
    'bus_fare_bills',
    'latest_active',
    {
      activeQuarterId: quarterId,
      lastIssuedAt: issuedAt
    }
  );
}

/**
 * 특정 분기의 청구서 목록을 가져옵니다.
 */
export async function getBusFareBills(quarterId: string): Promise<BusFareBillsStore | null> {
  return fetchDocument<BusFareBillsStore>('bus_fare_bills', `quarter_${quarterId}`);
}

/**
 * 실시간으로 최신 활성 청구서 포인터를 구독합니다.
 */
export function onLatestActiveBillsUpdate(
  callback: (data: { activeQuarterId: string; lastIssuedAt: string } | null) => void
): () => void {
  return onDocumentUpdate<{ activeQuarterId: string; lastIssuedAt: string }>(
    'bus_fare_bills',
    'latest_active',
    callback
  );
}

/**
 * 특정 분기의 청구서 목록을 실시간으로 구독합니다.
 */
export function onBusFareBillsUpdate(
  quarterId: string,
  callback: (data: BusFareBillsStore | null) => void
): () => void {
  return onDocumentUpdate<BusFareBillsStore>(
    'bus_fare_bills',
    `quarter_${quarterId}`,
    callback
  );
}

/**
 * 학부모 로그인 시, 자녀 이름 / 학년 / 반 / 연락처를 매칭하여 최신 청구서 단건을 찾습니다.
 */
export function findStudentBill(
  bills: BusFareBill[],
  options: {
    studentName?: string;
    grade?: string;
    studentClass?: string;
    contact?: string;
    studentId?: string;
  }
): BusFareBill | null {
  const { studentName, grade, studentClass, contact, studentId } = options;

  const ridingBills = bills.filter(b => b.isRiding);

  if (studentId) {
    const byId = ridingBills.find(b => b.studentId === studentId);
    if (byId) return byId;
  }

  if (!studentName) return null;
  const normName = normalizeString(studentName);

  // 1차: 이름 + 학년 + 반 정확 일치
  if (grade && studentClass) {
    const match = ridingBills.find(b => {
      const nameMatch = normalizeString(b.studentName) === normName;
      const gradeMatch = (b.grade || '').trim() === (grade || '').trim();
      const classMatch = (b.studentClass || '').trim() === (studentClass || '').trim();
      return nameMatch && gradeMatch && classMatch;
    });
    if (match) return match;
  }

  // 2차: 이름 + 연락처 뒷자리 일치
  if (contact && contact.replace(/\D/g, '').length >= 4) {
    const cleanPhone = contact.replace(/\D/g, '');
    const match = ridingBills.find(b => {
      const nameMatch = normalizeString(b.studentName) === normName;
      const bPhone = (b.contact || '').replace(/\D/g, '');
      const phoneMatch = bPhone.endsWith(cleanPhone.slice(-4)) || cleanPhone.endsWith(bPhone.slice(-4));
      return nameMatch && phoneMatch;
    });
    if (match) return match;
  }

  // 3차: 이름 단순 일치 (이름이 일치하는 첫 번째 학생)
  const byName = ridingBills.find(b => normalizeString(b.studentName) === normName);
  return byName || null;
}

/**
 * 학부모가 청구서를 확인했을 때 확인 완료 상태를 업데이트합니다.
 */
export async function confirmStudentBusFareBill(
  quarterId: string,
  studentId: string
): Promise<void> {
  const store = await getBusFareBills(quarterId);
  if (!store || !store.bills) return;

  const now = new Date().toISOString();
  const updatedBills = store.bills.map(b => {
    if (b.studentId === studentId) {
      return { ...b, isConfirmed: true, confirmedAt: now };
    }
    return b;
  });

  await setDocument<BusFareBillsStore>('bus_fare_bills', `quarter_${quarterId}`, {
    ...store,
    bills: updatedBills
  });
}
