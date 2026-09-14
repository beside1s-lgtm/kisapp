import { getDb } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  deleteDoc,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import type {
  HomeroomDailyMemo,
  HomeroomHomework,
  HomeroomHomeworkCheck,
  HomeroomBehaviorRecord,
  HomeroomConsultation,
  ConsultationConfig,
  BookingSlot,
} from '@/lib/types/homeroomClass';

// ─── 1. 일일 알림 메모 구독 및 저장 ──────────────────────────────────────────

export function onDailyMemoUpdate(
  classKey: string,
  date: string,
  callback: (memo: HomeroomDailyMemo | null) => void
): () => void {
  if (!classKey || !date) {
    callback(null);
    return () => {};
  }

  const db = getDb();
  const memoDocRef = doc(db, 'homeroom_classes', classKey, 'memos', date);

  return onSnapshot(
    memoDocRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as HomeroomDailyMemo);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn('[HomeroomClassService] onDailyMemoUpdate error:', err);
      callback(null);
    }
  );
}

export async function saveDailyMemo(
  classKey: string,
  date: string,
  content: string,
  userEmail?: string
): Promise<void> {
  if (!classKey || !date) return;
  const db = getDb();
  const memoDocRef = doc(db, 'homeroom_classes', classKey, 'memos', date);
  await setDoc(
    memoDocRef,
    {
      date,
      content,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail || '',
    },
    { merge: true }
  );
}

export async function getDailyMemos(classKey: string): Promise<HomeroomDailyMemo[]> {
  if (!classKey) return [];
  const db = getDb();
  const memosColRef = collection(db, 'homeroom_classes', classKey, 'memos');
  const snap = await getDocs(memosColRef);
  const list = snap.docs.map((d) => ({
    date: d.id,
    ...(d.data() as Omit<HomeroomDailyMemo, 'date'>),
  }));
  list.sort((a, b) => b.date.localeCompare(a.date));
  return list;
}

// ─── 2. 숙제 목록 구독 및 CRUD ──────────────────────────────────────────

export function onHomeworksUpdate(
  classKey: string,
  callback: (homeworks: HomeroomHomework[]) => void
): () => void {
  if (!classKey) {
    callback([]);
    return () => {};
  }

  const db = getDb();
  const hwColRef = collection(db, 'homeroom_classes', classKey, 'homeworks');

  return onSnapshot(
    hwColRef,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as HomeroomHomework));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(list);
    },
    (err) => {
      console.warn('[HomeroomClassService] onHomeworksUpdate error:', err);
      callback([]);
    }
  );
}

export async function addHomework(
  classKey: string,
  title: string,
  date: string,
  dateWithDay?: string,
  userEmail?: string
): Promise<string> {
  const db = getDb();
  const hwId = `hw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const hwDocRef = doc(db, 'homeroom_classes', classKey, 'homeworks', hwId);

  await setDoc(hwDocRef, {
    id: hwId,
    title,
    date,
    dateWithDay: dateWithDay || date,
    createdAt: new Date().toISOString(),
    createdBy: userEmail || '',
  });

  return hwId;
}

export async function updateHomework(
  classKey: string,
  hwId: string,
  title: string
): Promise<void> {
  const db = getDb();
  const hwDocRef = doc(db, 'homeroom_classes', classKey, 'homeworks', hwId);
  await setDoc(hwDocRef, { title, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function deleteHomework(classKey: string, hwId: string): Promise<void> {
  const db = getDb();
  // 1. 숙제 문서 삭제
  const hwDocRef = doc(db, 'homeroom_classes', classKey, 'homeworks', hwId);
  await deleteDoc(hwDocRef);

  // 2. 관련된 숙제 체크 문서들 삭제
  const checksColRef = collection(db, 'homeroom_classes', classKey, 'hw_checks');
  const q = query(checksColRef, where('hwId', '==', hwId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ─── 3. 숙제 제출 체크 구독 및 업데이트 ──────────────────────────────────

export function onHomeworkChecksUpdate(
  classKey: string,
  callback: (checks: HomeroomHomeworkCheck[]) => void
): () => void {
  if (!classKey) {
    callback([]);
    return () => {};
  }

  const db = getDb();
  const checksColRef = collection(db, 'homeroom_classes', classKey, 'hw_checks');

  return onSnapshot(
    checksColRef,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as HomeroomHomeworkCheck));
      callback(list);
    },
    (err) => {
      console.warn('[HomeroomClassService] onHomeworkChecksUpdate error:', err);
      callback([]);
    }
  );
}

export async function setHomeworkCheck(
  classKey: string,
  hwId: string,
  studentId: string,
  studentName: string,
  checked: boolean,
  date?: string
): Promise<void> {
  const db = getDb();
  const checkId = `${hwId}_${studentId}`;
  const checkDocRef = doc(db, 'homeroom_classes', classKey, 'hw_checks', checkId);

  await setDoc(
    checkDocRef,
    {
      id: checkId,
      hwId,
      studentId,
      studentName,
      checked,
      date: date || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function batchSetHomeworkCheck(
  classKey: string,
  hwId: string,
  students: { id: string; name: string }[],
  checked: boolean,
  date?: string
): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  const today = date || new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  students.forEach((s) => {
    const checkId = `${hwId}_${s.id}`;
    const ref = doc(db, 'homeroom_classes', classKey, 'hw_checks', checkId);
    batch.set(
      ref,
      {
        id: checkId,
        hwId,
        studentId: s.id,
        studentName: s.name,
        checked,
        date: today,
        updatedAt: now,
      },
      { merge: true }
    );
  });

  await batch.commit();
}

// ─── 4. 행동 기록 구독 및 CRUD ──────────────────────────────────────────

export function onBehaviorsUpdate(
  classKey: string,
  callback: (behaviors: HomeroomBehaviorRecord[]) => void
): () => void {
  if (!classKey) {
    callback([]);
    return () => {};
  }

  const db = getDb();
  const behaviorsColRef = collection(db, 'homeroom_classes', classKey, 'behaviors');

  return onSnapshot(
    behaviorsColRef,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as HomeroomBehaviorRecord));
      list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(list);
    },
    (err) => {
      console.warn('[HomeroomClassService] onBehaviorsUpdate error:', err);
      callback([]);
    }
  );
}

export async function addBehaviorRecord(
  classKey: string,
  studentId: string,
  studentName: string,
  studentNum: string | undefined,
  content: string,
  date: string,
  userEmail?: string
): Promise<string> {
  const db = getDb();
  const recordId = `beh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const recordDocRef = doc(db, 'homeroom_classes', classKey, 'behaviors', recordId);

  await setDoc(recordDocRef, {
    id: recordId,
    studentId,
    studentName,
    studentNum: studentNum || '',
    content,
    date,
    createdAt: new Date().toISOString(),
    createdBy: userEmail || '',
  });

  return recordId;
}

export async function deleteBehaviorRecord(classKey: string, recordId: string): Promise<void> {
  const db = getDb();
  const recordDocRef = doc(db, 'homeroom_classes', classKey, 'behaviors', recordId);
  await deleteDoc(recordDocRef);
}

// ─── 5. 보호자 상담 메모 구독 및 저장 ──────────────────────────────────

export function onConsultationsUpdate(
  classKey: string,
  callback: (consults: Record<string, HomeroomConsultation>) => void
): () => void {
  if (!classKey) {
    callback({});
    return () => {};
  }

  const db = getDb();
  const colRef = collection(db, 'homeroom_classes', classKey, 'consultations');

  return onSnapshot(
    colRef,
    (snap) => {
      const map: Record<string, HomeroomConsultation> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as HomeroomConsultation;
        map[data.studentId] = data;
      });
      callback(map);
    },
    (err) => {
      console.warn('[HomeroomClassService] onConsultationsUpdate error:', err);
      callback({});
    }
  );
}

export async function saveConsultation(
  classKey: string,
  studentId: string,
  studentName: string,
  content: string,
  userEmail?: string
): Promise<void> {
  const db = getDb();
  const consultDocRef = doc(db, 'homeroom_classes', classKey, 'consultations', studentId);

  await setDoc(
    consultDocRef,
    {
      studentId,
      studentName,
      content,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail || '',
    },
    { merge: true }
  );
}

// ─── 5. 학부모 상담 주간 설정 및 슬롯 구독/저장 ─────────────────────────

export const DEFAULT_CONSULTATION_CONFIG: ConsultationConfig = {
  isOpen: false,
  startDate: '2026-04-06',
  endDate: '2026-04-10',
  dailyStartTime: '13:40',
  dailyEndTime: '16:20',
  slotDuration: 20,
  excludedDates: [],
  title: '학부모 상담 주간',
};

/**
 * 학급별 학부모 상담 주간 설정 실시간 구독
 */
export function onConsultationConfigUpdate(
  classKey: string,
  callback: (config: ConsultationConfig) => void
): () => void {
  if (!classKey) {
    callback(DEFAULT_CONSULTATION_CONFIG);
    return () => {};
  }

  const db = getDb();
  const configDocRef = doc(db, 'homeroom_classes', classKey, 'consultation_settings', 'config');

  return onSnapshot(
    configDocRef,
    (snap) => {
      if (snap.exists()) {
        callback({ ...DEFAULT_CONSULTATION_CONFIG, ...(snap.data() as ConsultationConfig) });
      } else {
        callback(DEFAULT_CONSULTATION_CONFIG);
      }
    },
    (err) => {
      console.warn('[HomeroomClassService] onConsultationConfigUpdate error:', err);
      callback(DEFAULT_CONSULTATION_CONFIG);
    }
  );
}

/**
 * 학급별 학부모 상담 주간 설정 저장
 */
export async function saveConsultationConfig(
  classKey: string,
  config: ConsultationConfig,
  userEmail?: string
): Promise<void> {
  if (!classKey) return;
  const db = getDb();
  const configDocRef = doc(db, 'homeroom_classes', classKey, 'consultation_settings', 'config');
  await setDoc(
    configDocRef,
    {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail || '',
    },
    { merge: true }
  );
}

/**
 * 학급별 상담 예약 슬롯 실시간 구독
 */
export function onConsultationSlotsUpdate(
  classKey: string,
  callback: (slots: Record<string, BookingSlot>) => void
): () => void {
  if (!classKey) {
    callback({});
    return () => {};
  }

  const db = getDb();
  const slotsColRef = collection(db, 'homeroom_classes', classKey, 'consultation_slots');

  return onSnapshot(
    slotsColRef,
    (snap) => {
      const map: Record<string, BookingSlot> = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data() as BookingSlot;
      });
      callback(map);
    },
    (err) => {
      console.warn('[HomeroomClassService] onConsultationSlotsUpdate error:', err);
      callback({});
    }
  );
}

/**
 * 교사용: 개별 슬롯 차단/해제 토글
 */
export async function toggleConsultationSlotBlock(
  classKey: string,
  slotKey: string,
  date: string,
  timeRange: string,
  currentStatus: 'AVAILABLE' | 'BOOKED' | 'BLOCKED',
  userEmail?: string
): Promise<void> {
  if (!classKey || !slotKey) return;
  const db = getDb();
  const slotDocRef = doc(db, 'homeroom_classes', classKey, 'consultation_slots', slotKey);

  const nextStatus = currentStatus === 'BLOCKED' ? 'AVAILABLE' : 'BLOCKED';
  await setDoc(
    slotDocRef,
    {
      id: slotKey,
      date,
      timeRange,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail || '',
      bookedBy: nextStatus === 'AVAILABLE' ? null : undefined,
    },
    { merge: true }
  );
}

/**
 * 학부모용/교사용: 실시간 선착순 동시성 제어 예약 (runTransaction)
 */
export async function bookConsultationSlotTransaction(
  classKey: string,
  slotKey: string,
  date: string,
  timeRange: string,
  applicant: {
    studentName: string;
    studentId?: string;
    parentPhone?: string;
    bookedByEmail?: string;
  }
): Promise<void> {
  if (!classKey || !slotKey) throw new Error('잘못된 요청입니다.');
  const db = getDb();
  const slotDocRef = doc(db, 'homeroom_classes', classKey, 'consultation_slots', slotKey);

  await runTransaction(db, async (transaction) => {
    const slotDoc = await transaction.get(slotDocRef);

    if (slotDoc.exists()) {
      const data = slotDoc.data() as BookingSlot;
      if (data.status === 'BOOKED') {
        throw new Error('ALREADY_BOOKED');
      }
      if (data.status === 'BLOCKED') {
        throw new Error('SLOT_BLOCKED');
      }
    }

    transaction.set(
      slotDocRef,
      {
        id: slotKey,
        date,
        timeRange,
        status: 'BOOKED',
        bookedBy: {
          studentName: applicant.studentName.trim(),
          studentId: applicant.studentId || '',
          parentPhone: applicant.parentPhone?.trim() || '',
          bookedAt: new Date().toISOString(),
          bookedByEmail: applicant.bookedByEmail || '',
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  });
}

/**
 * 예약 취소 처리
 */
export async function cancelConsultationSlot(
  classKey: string,
  slotKey: string
): Promise<void> {
  if (!classKey || !slotKey) return;
  const db = getDb();
  const slotDocRef = doc(db, 'homeroom_classes', classKey, 'consultation_slots', slotKey);

  await setDoc(
    slotDocRef,
    {
      status: 'AVAILABLE',
      bookedBy: null,
      cancelledAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
