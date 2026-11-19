import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import type { MasterStudent } from '@/lib/types/masterStudent';
import type {
  SeatingPlan,
  SeatingConfig,
  DeskSlot,
  GenderPairType,
} from '@/lib/types/seating';

const SEATING_SUBCOLLECTION = 'seating_plans';

/**
 * Firestore 경로 헬퍼: /homeroom_classes/{classKey}/seating_plans
 */
function getSeatingColRef(classKey: string) {
  const sanitizedKey = classKey.replace(/\//g, '_');
  return collection(db, 'homeroom_classes', sanitizedKey, SEATING_SUBCOLLECTION);
}

/**
 * 성별 판별 헬퍼
 */
export function isMaleStudent(student: MasterStudent): boolean {
  const g = (student.gender || '').toLowerCase().trim();
  return g === 'male' || g === 'm' || g === '남' || g === '남자';
}

export function isFemaleStudent(student: MasterStudent): boolean {
  const g = (student.gender || '').toLowerCase().trim();
  return g === 'female' || g === 'f' || g === '여' || g === '여자';
}

/**
 * 배열 셔플 (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 대형 설정에 따른 초기 책상 슬롯 청사진 생성
 */
export function buildInitialSlots(config: SeatingConfig, studentCount: number): DeskSlot[] {
  const slots: DeskSlot[] = [];
  const count = Math.max(studentCount, 1);

  if (config.layoutType === 'ROW') {
    const { rowType, divisionCount } = config.rowConfig;
    const colsPerDiv = rowType; // 1열 또는 2열
    const totalCols = divisionCount * colsPerDiv;
    const neededRows = Math.max(Math.ceil(count / totalCols), 4);

    let slotIdx = 0;
    for (let r = 0; r < neededRows; r++) {
      for (let d = 0; d < divisionCount; d++) {
        for (let c = 0; c < colsPerDiv; c++) {
          const colIndex = d * colsPerDiv + c;
          slots.push({
            id: `slot_${r}_${colIndex}`,
            row: r,
            col: colIndex,
            groupId: d + 1,
            pairIndex: c,
            isActive: true,
            isFixed: false,
            studentId: null,
            studentName: null,
            studentNum: null,
            studentGender: null,
          });
          slotIdx++;
        }
      }
    }
  } else if (config.layoutType === 'GROUP') {
    const { groupSize } = config.groupConfig;
    const groupCount = Math.max(Math.ceil(count / groupSize), 4);

    // 모둠별 슬롯 생성 (예: 4인이면 2x2, 6인이면 2x3 등)
    let slotIdx = 0;
    for (let g = 0; g < groupCount; g++) {
      for (let s = 0; s < groupSize; s++) {
        const pairIdx = s % 2;
        const rowInGroup = Math.floor(s / 2);
        slots.push({
          id: `group_${g + 1}_slot_${s}`,
          row: rowInGroup,
          col: s,
          groupId: g + 1,
          pairIndex: pairIdx,
          isActive: true,
          isFixed: false,
          studentId: null,
          studentName: null,
          studentNum: null,
          studentGender: null,
        });
        slotIdx++;
      }
    }
  } else {
    // FREE: 자유형 (7행 x 8열 = 56석)
    const { gridRows, gridCols, activeSlotIds } = config.freeConfig;
    const activeSet = new Set(activeSlotIds || []);

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const slotId = `free_${r}_${c}`;
        const isActive = activeSet.size > 0 ? activeSet.has(slotId) : r < 4;
        slots.push({
          id: slotId,
          row: r,
          col: c,
          groupId: Math.floor(c / 2) + 1,
          pairIndex: c % 2,
          isActive,
          isFixed: false,
          studentId: null,
          studentName: null,
          studentNum: null,
          studentGender: null,
        });
      }
    }
  }

  return slots;
}

/**
 * 짝꿍 쌍 식별 헬퍼 (분단 2열 또는 짝꿍이 정의된 모둠)
 */
function findSlotPartner(slot: DeskSlot, allSlots: DeskSlot[]): DeskSlot | null {
  if (slot.pairIndex === undefined || slot.groupId === undefined) return null;
  const targetPairIdx = slot.pairIndex === 0 ? 1 : 0;
  return (
    allSlots.find(
      (s) =>
        s.isActive &&
        s.groupId === slot.groupId &&
        s.row === slot.row &&
        s.pairIndex === targetPairIdx
    ) || null
  );
}

/**
 * 랜덤 자리 배치 알고리즘
 * 1. 교사가 사전에 특정 인원의 자리를 미리 지정(isFixed)한 좌석은 100% 보존
 * 2. 미지정 학생들만 랜덤으로 배치
 * 3. 짝꿍 설정(이성끼리, 동성끼리, 랜덤/상관없이) 반영
 * 4. 이전 짝꿍과 같이 안 앉기 옵션 반영
 */
export function generateRandomSeating(
  currentSlots: DeskSlot[],
  students: MasterStudent[],
  config: SeatingConfig,
  previousPartners?: Array<{ studentAId: string; studentBId: string }>
): DeskSlot[] {
  const resultSlots: DeskSlot[] = currentSlots.map((s) => ({ ...s }));

  // 1. 사전 고정된 학생과 좌석 식별
  const fixedStudentIds = new Set<string>();
  resultSlots.forEach((slot) => {
    if (slot.isFixed && slot.studentId) {
      fixedStudentIds.add(slot.studentId);
    } else {
      // 고정되지 않은 슬롯은 학생 배정 초기화
      slot.studentId = null;
      slot.studentName = null;
      slot.studentNum = null;
      slot.studentGender = null;
    }
  });

  // 2. 랜덤 배정 대상 학생 풀 추출
  const availableStudents = students.filter(
    (s) => !fixedStudentIds.has(s.studentId || s.id || '')
  );

  const prevPartnerSet = new Set<string>();
  if (previousPartners) {
    previousPartners.forEach((p) => {
      prevPartnerSet.add(`${p.studentAId}::${p.studentBId}`);
      prevPartnerSet.add(`${p.studentBId}::${p.studentAId}`);
    });
  }

  // 3. 배정 대상 활성 빈 슬롯 목록
  const emptyActiveSlots = resultSlots.filter((s) => s.isActive && !s.isFixed);

  // 대형 유형별 짝꿍 성별 설정 적용
  const genderOption: GenderPairType =
    config.layoutType === 'ROW'
      ? config.rowConfig.genderPair
      : config.layoutType === 'GROUP'
      ? config.groupConfig.genderPair
      : 'RANDOM';

  const isPairedLayout =
    (config.layoutType === 'ROW' && config.rowConfig.rowType === 2) ||
    config.layoutType === 'GROUP';

  if (!isPairedLayout || genderOption === 'RANDOM') {
    // 짝꿍 성별 제약 없는 순수 무작위 셔플 배정
    const shuffled = shuffleArray(availableStudents);
    emptyActiveSlots.forEach((slot, idx) => {
      if (idx < shuffled.length) {
        const student = shuffled[idx];
        slot.studentId = student.studentId || student.id;
        slot.studentName = student.name;
        slot.studentNum = student.studentNum || null;
        slot.studentGender = student.gender;
      }
    });
  } else {
    // 짝꿍 성별 제약 적용 (이성끼리 또는 동성끼리)
    let boys = shuffleArray(availableStudents.filter(isMaleStudent));
    let girls = shuffleArray(availableStudents.filter(isFemaleStudent));

    // 미배정 짝꿍 쌍 수집
    const processedSlotIds = new Set<string>();
    const pairs: Array<[DeskSlot, DeskSlot | null]> = [];

    emptyActiveSlots.forEach((slot) => {
      if (processedSlotIds.has(slot.id)) return;
      processedSlotIds.add(slot.id);

      const partner = findSlotPartner(slot, resultSlots);
      if (partner && !partner.isFixed && partner.isActive) {
        processedSlotIds.add(partner.id);
        pairs.push([slot, partner]);
      } else {
        pairs.push([slot, partner]); // partner가 고정되었거나 없는 경우
      }
    });

    pairs.forEach(([slotA, slotB]) => {
      if (slotB && !slotB.isFixed && slotB.isActive) {
        // 둘 다 비어있는 짝꿍 쌍
        if (genderOption === 'OPPOSITE') {
          // 이성끼리 짝꿍: 남학생 1 + 여학생 1
          let boy = boys.pop();
          let girl = girls.pop();

          if (!boy && girl) {
            // 남학생이 부족하면 여학생 풀에서 1명 더 뽑아 배정
            boy = girls.pop();
          } else if (!girl && boy) {
            // 여학생이 부족하면 남학생 풀에서 1명 더 뽑아 배정
            girl = boys.pop();
          }

          if (boy) {
            slotA.studentId = boy.studentId || boy.id;
            slotA.studentName = boy.name;
            slotA.studentNum = boy.studentNum || null;
            slotA.studentGender = boy.gender;
            slotA.studentPhotoUrl = boy.photoUrl || null;
            slotA.praisePoints = slotA.praisePoints ?? 0;
          }
          if (girl) {
            slotB.studentId = girl.studentId || girl.id;
            slotB.studentName = girl.name;
            slotB.studentNum = girl.studentNum || null;
            slotB.studentGender = girl.gender;
            slotB.studentPhotoUrl = girl.photoUrl || null;
            slotB.praisePoints = slotB.praisePoints ?? 0;
          }
        } else if (genderOption === 'SAME') {
          // 동성끼리 짝꿍: 남-남 또는 여-여
          const pickBoyPair = boys.length >= 2 && (girls.length < 2 || Math.random() > 0.5);
          if (pickBoyPair || (boys.length >= 2 && girls.length < 2)) {
            const b1 = boys.pop();
            const b2 = boys.pop();
            if (b1) {
              slotA.studentId = b1.studentId || b1.id;
              slotA.studentName = b1.name;
              slotA.studentNum = b1.studentNum || null;
              slotA.studentGender = b1.gender;
            }
            if (b2) {
              slotB.studentId = b2.studentId || b2.id;
              slotB.studentName = b2.name;
              slotB.studentNum = b2.studentNum || null;
              slotB.studentGender = b2.gender;
            }
          } else if (girls.length >= 2) {
            const g1 = girls.pop();
            const g2 = girls.pop();
            if (g1) {
              slotA.studentId = g1.studentId || g1.id;
              slotA.studentName = g1.name;
              slotA.studentNum = g1.studentNum || null;
              slotA.studentGender = g1.gender;
            }
            if (g2) {
              slotB.studentId = g2.studentId || g2.id;
              slotB.studentName = g2.name;
              slotB.studentNum = g2.studentNum || null;
              slotB.studentGender = g2.gender;
            }
          } else {
            // 둘 다 2명이 안 남았으면 남은 인원 아무나 배정
            const remain = [...boys, ...girls];
            const s1 = remain.pop();
            const s2 = remain.pop();
            boys = [];
            girls = [];
            if (s1) {
              slotA.studentId = s1.studentId || s1.id;
              slotA.studentName = s1.name;
              slotA.studentNum = s1.studentNum || null;
              slotA.studentGender = s1.gender;
            }
            if (s2) {
              slotB.studentId = s2.studentId || s2.id;
              slotB.studentName = s2.name;
              slotB.studentNum = s2.studentNum || null;
              slotB.studentGender = s2.gender;
            }
          }
        }
      } else {
        // 단독 슬롯이거나 짝꿍이 이미 고정된 경우
        const partnerStudent = slotB?.studentId
          ? students.find((s) => (s.studentId || s.id) === slotB.studentId)
          : null;

        let candidate: MasterStudent | undefined;

        if (partnerStudent && genderOption === 'OPPOSITE') {
          // 상대가 고정되어 있으면 반대 성별 우선 매칭
          if (isMaleStudent(partnerStudent)) {
            candidate = girls.pop() || boys.pop();
          } else {
            candidate = boys.pop() || girls.pop();
          }
        } else if (partnerStudent && genderOption === 'SAME') {
          // 상대가 고정되어 있으면 같은 성별 우선 매칭
          if (isMaleStudent(partnerStudent)) {
            candidate = boys.pop() || girls.pop();
          } else {
            candidate = girls.pop() || boys.pop();
          }
        } else {
          candidate = boys.pop() || girls.pop();
        }

        if (candidate) {
          slotA.studentId = candidate.studentId || candidate.id;
          slotA.studentName = candidate.name;
          slotA.studentNum = candidate.studentNum || null;
          slotA.studentGender = candidate.gender;
        }
      }
    });

    // 남은 학생이 있는 경우 비어있는 슬롯에 순차 채움
    const leftover = [...boys, ...girls];
    resultSlots.forEach((slot) => {
      if (slot.isActive && !slot.studentId && leftover.length > 0) {
        const s = leftover.pop()!;
        slot.studentId = s.studentId || s.id;
        slot.studentName = s.name;
        slot.studentNum = s.studentNum || null;
        slot.studentGender = s.gender;
        slot.studentPhotoUrl = s.photoUrl || null;
      }
    });
  }

  // 학생 사진 동기화 및 칭찬 포인트 기본값 보장
  const studentMap = new Map<string, MasterStudent>();
  students.forEach((s) => {
    const sid = s.studentId || s.id || '';
    if (sid) studentMap.set(sid, s);
  });

  resultSlots.forEach((slot) => {
    if (slot.studentId) {
      const st = studentMap.get(slot.studentId);
      if (st && st.photoUrl) {
        slot.studentPhotoUrl = st.photoUrl;
      }
      slot.praisePoints = slot.praisePoints ?? 0;
    }
  });

  return resultSlots;
}

/**
 * 짝꿍 이력 추출 헬퍼 (현재 배치에서 짝꿍 쌍 저장)
 */
export function extractPartnersFromSlots(slots: DeskSlot[]): Array<{ studentAId: string; studentBId: string }> {
  const partners: Array<{ studentAId: string; studentBId: string }> = [];
  const visited = new Set<string>();

  slots.forEach((slot) => {
    if (!slot.studentId || visited.has(slot.id)) return;
    const partner = findSlotPartner(slot, slots);
    if (partner && partner.studentId) {
      visited.add(slot.id);
      visited.add(partner.id);
      partners.push({
        studentAId: slot.studentId,
        studentBId: partner.studentId,
      });
    }
  });

  return partners;
}

// ──────────────────────────────────────────────
// Firestore 데이터 CRUD 연동
// ──────────────────────────────────────────────

/**
 * 학급의 저장된 자리배치도 목록 조회
 */
export async function getSeatingPlans(classKey: string): Promise<SeatingPlan[]> {
  try {
    const colRef = getSeatingColRef(classKey);
    const q = query(colRef, orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    const list: SeatingPlan[] = [];
    snap.forEach((docSnap) => {
      list.push({ ...docSnap.data(), id: docSnap.id } as SeatingPlan);
    });
    return list;
  } catch (err) {
    console.error('[seatingService] getSeatingPlans error:', err);
    return [];
  }
}

/**
 * 자리배치도 실시간 리스너 구독
 */
export function subscribeSeatingPlans(
  classKey: string,
  callback: (plans: SeatingPlan[]) => void
): () => void {
  const colRef = getSeatingColRef(classKey);
  const q = query(colRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const list: SeatingPlan[] = [];
      snap.forEach((docSnap) => {
        list.push({ ...docSnap.data(), id: docSnap.id } as SeatingPlan);
      });
      callback(list);
    },
    (err) => {
      console.error('[seatingService] subscribe error:', err);
    }
  );
}

/**
 * 자리배치도 저장 또는 갱신
 */
export async function saveSeatingPlan(classKey: string, plan: SeatingPlan): Promise<string> {
  const colRef = getSeatingColRef(classKey);
  const planId = plan.id || `plan_${Date.now()}`;
  const docRef = doc(colRef, planId);
  const nowIso = new Date().toISOString();

  const payload: SeatingPlan = {
    ...plan,
    id: planId,
    classKey,
    updatedAt: nowIso,
    createdAt: plan.createdAt || nowIso,
  };

  await setDoc(docRef, payload, { merge: true });
  return planId;
}

/**
 * 자리배치도 삭제
 */
export async function deleteSeatingPlan(classKey: string, planId: string): Promise<void> {
  const colRef = getSeatingColRef(classKey);
  const docRef = doc(colRef, planId);
  await deleteDoc(docRef);
}
