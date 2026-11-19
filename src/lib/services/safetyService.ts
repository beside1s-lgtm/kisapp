import { getDb } from '@/lib/firebase';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, limit, writeBatch } from 'firebase/firestore';
import type { 
  SafetyPatrolLog, 
  SafetyIncident, 
  SafetyFacilityItem, 
  SafetyKPIStats, 
  SafetyStatus,
  SchoolFacility,
  MonthlyInspectionRecord,
  InspectionScore,
} from '@/lib/safety/types';
import { DEFAULT_SCHOOL_FACILITIES, SAFETY_INSPECTION_ITEMS } from '@/lib/safety/types';
import { getTeacherStampSignature, isActualSignature } from '@/lib/safety/stampHelper';
import { getTeacherSignaturesDirectory, getUsersDirectory } from '@/lib/services/userService';
import { format } from 'date-fns';

const PATROL_COLLECTION = 'safety_patrol_logs';
const INCIDENT_COLLECTION = 'safety_incidents';
const FACILITY_COLLECTION = 'safety_facilities';

// 기본 초기 순찰 일지 시드 데이터
const INITIAL_PATROL_LOGS: SafetyPatrolLog[] = [
  {
    id: 'patrol_seed_1',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '08:20',
    zone: '정문/통학로',
    patrolLeader: '안전지도교사',
    patrolLeaderEmail: 'safety@kshcm.net',
    companionTeachers: ['보안관(배움터지킴이)'],
    overallStatus: 'SAFE',
    specialNotes: '등교 시간 통학로 교통 흐름 양호. 횡단보도 유도선 식별 양호.',
    actionTaken: '스쿨버스 하차 시 학생 줄서기 안내 완료.',
    checklist: [
      { id: 'c1', category: '통학로', label: '신호등 및 보행 유도등 정상 작동', status: 'SAFE' },
      { id: 'c2', category: '통학로', label: '차량 진입 차단봉 정상 작동', status: 'SAFE' },
      { id: 'c3', category: '보행안전', label: '보도블록 파손 및 턱걸림 없음', status: 'SAFE' },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'patrol_seed_2',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '12:40',
    zone: '운동장/체육시설',
    patrolLeader: '안전지도교사',
    patrolLeaderEmail: 'safety@kshcm.net',
    companionTeachers: ['당직교사'],
    overallStatus: 'WARNING',
    specialNotes: '농구 골대 하단 보호 패드 일부 들뜸 확인됨. 우천 후 배수로 점검 필요.',
    actionTaken: '행정실 시설담당자에게 농구대 보호 패드 재부착 요청 완료.',
    checklist: [
      { id: 'c4', category: '체육시설', label: '골대 및 철봉 지지대 안전 상태', status: 'WARNING', note: '보호 패드 재부착 필요' },
      { id: 'c5', category: '바닥면', label: '운동장 모래 및 잔디 이물질 없음', status: 'SAFE' },
      { id: 'c6', category: '펜스', label: '외곽 안전망 및 펜스 견고성', status: 'SAFE' },
    ],
    createdAt: new Date().toISOString(),
  },
];

// 기본 초기 안전사고 접수 대장 시드 데이터
const INITIAL_INCIDENTS: SafetyIncident[] = [
  {
    id: 'incident_seed_1',
    incidentDate: format(new Date(), 'yyyy-MM-dd'),
    incidentTime: '10:15',
    location: '2층 중앙 계단',
    type: '낙상/넘어짐',
    victimName: '김민준',
    victimGradeClass: '4학년 2반',
    victimType: 'STUDENT',
    description: '쉬는 시간 이동 중 계단 2칸에서 발을 헛디뎌 무릎 찰과상 발생.',
    firstAidGiven: '보건실 즉시 이송, 소독 후 냉찜질 및 밴드 처치. 보건교사 안정 조치 완료.',
    guardianNotified: true,
    guardianNotificationTime: '10:30',
    followUpPlan: '중앙 계단 미끄럼 방지 패드 상태 전수 점검 및 담임 교사 안전 지도 실시.',
    handlerName: '안전지도교사',
    handlerEmail: 'safety@kshcm.net',
    status: 'IN_PROGRESS',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'incident_seed_2',
    incidentDate: format(new Date(Date.now() - 86400000 * 3), 'yyyy-MM-dd'),
    incidentTime: '14:20',
    location: '체육관',
    type: '체육활동 부상',
    victimName: '이지우',
    victimGradeClass: '6학년 1반',
    victimType: 'STUDENT',
    description: '피구 경기 중 공에 손가락 끝을 맞아 경미한 염좌 발생.',
    firstAidGiven: '보건실 테이핑 고정 및 얼음찜질 처치 후 귀가.',
    guardianNotified: true,
    guardianNotificationTime: '14:40',
    followUpPlan: '준비운동 철저 및 체육 시간 손가락 보호 수칙 재안내.',
    handlerName: '체육담당교사',
    handlerEmail: 'pe@kshcm.net',
    status: 'RESOLVED',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

// 기본 초기 학교 시설물 점검 대장 시드 데이터
const INITIAL_FACILITIES: SafetyFacilityItem[] = [
  {
    id: 'fac_1',
    name: '본관 1~4층 옥내 소화전 및 비상벨',
    location: '본관 전 층 복도',
    category: '소방/비상대피',
    lastCheckedDate: format(new Date(), 'yyyy-MM-dd'),
    checkCycle: '월간',
    status: 'SAFE',
    managerName: '행정실 소방관리자',
    notes: '소화기 충압 및 비상발신기 점등 정상',
  },
  {
    id: 'fac_2',
    name: '정문 보행로 안전 차단기 및 CCTV',
    location: '정문 수위실 앞',
    category: 'CCTV/보안',
    lastCheckedDate: format(new Date(), 'yyyy-MM-dd'),
    checkCycle: '일일',
    status: 'SAFE',
    managerName: '배움터지킴이',
    notes: '카메라 화질 및 녹화 상태 양호',
  },
  {
    id: 'fac_3',
    name: '운동장 농구장 골대 충격 흡수 패드',
    location: '운동장 동편',
    category: '놀이/체육',
    lastCheckedDate: format(new Date(), 'yyyy-MM-dd'),
    checkCycle: '주간',
    status: 'WARNING',
    managerName: '안전지도교사',
    notes: '우측 골대 하단 패드 들뜸 (보수 요청 중)',
  },
  {
    id: 'fac_4',
    name: '후문 급경사지 안전 펜스',
    location: '후문 통학로',
    category: '보행/통학로',
    lastCheckedDate: format(new Date(Date.now() - 86400000 * 7), 'yyyy-MM-dd'),
    checkCycle: '월간',
    status: 'SAFE',
    managerName: '안전지도교사',
    notes: '펜스 흔들림 없음',
  },
  {
    id: 'fac_5',
    name: '교사동 중앙 비상계단 미끄럼 방지 논슬립',
    location: '본관 1~3층 계단',
    category: '보행/통학로',
    lastCheckedDate: format(new Date(), 'yyyy-MM-dd'),
    checkCycle: '주간',
    status: 'SAFE',
    managerName: '안전지도교사',
    notes: '마모 상태 양호',
  },
];

/**
 * 1. 안전 순찰 일지 목록 조회
 */
export async function getSafetyPatrolLogs(): Promise<SafetyPatrolLog[]> {
  try {
    const q = query(collection(getDb(), PATROL_COLLECTION), orderBy('date', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafetyPatrolLog));
    }
  } catch (error) {
    console.warn('Firestore getSafetyPatrolLogs fallback:', error);
  }

  // Fallback / Initial Seed
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('kis_safety_patrol_logs');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {}
    }
    localStorage.setItem('kis_safety_patrol_logs', JSON.stringify(INITIAL_PATROL_LOGS));
  }
  return INITIAL_PATROL_LOGS;
}

/**
 * 2. 안전 순찰 일지 저장
 */
export async function saveSafetyPatrolLog(log: Omit<SafetyPatrolLog, 'id' | 'createdAt'> & { id?: string }): Promise<SafetyPatrolLog> {
  const id = log.id || `patrol_${Date.now()}`;
  const now = new Date().toISOString();
  const fullLog: SafetyPatrolLog = {
    ...log,
    id,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(getDb(), PATROL_COLLECTION, id), fullLog);
  } catch (error) {
    console.warn('Firestore saveSafetyPatrolLog fallback:', error);
  }

  // Local storage cache sync
  if (typeof window !== 'undefined') {
    try {
      const current = await getSafetyPatrolLogs();
      const updated = [fullLog, ...current.filter(item => item.id !== id)];
      localStorage.setItem('kis_safety_patrol_logs', JSON.stringify(updated));
    } catch (e) {}
  }

  return fullLog;
}

/**
 * 3. 안전사고 접수 대장 목록 조회
 */
export async function getSafetyIncidents(): Promise<SafetyIncident[]> {
  try {
    const q = query(collection(getDb(), INCIDENT_COLLECTION), orderBy('incidentDate', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafetyIncident));
    }
  } catch (error) {
    console.warn('Firestore getSafetyIncidents fallback:', error);
  }

  // Fallback / Initial Seed
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('kis_safety_incidents');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {}
    }
    localStorage.setItem('kis_safety_incidents', JSON.stringify(INITIAL_INCIDENTS));
  }
  return INITIAL_INCIDENTS;
}

/**
 * 4. 안전사고 접수 저장
 */
export async function saveSafetyIncident(incident: Omit<SafetyIncident, 'id' | 'createdAt'> & { id?: string }): Promise<SafetyIncident> {
  const id = incident.id || `incident_${Date.now()}`;
  const now = new Date().toISOString();
  const fullIncident: SafetyIncident = {
    ...incident,
    id,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(getDb(), INCIDENT_COLLECTION, id), fullIncident);
  } catch (error) {
    console.warn('Firestore saveSafetyIncident fallback:', error);
  }

  // Local storage cache sync
  if (typeof window !== 'undefined') {
    try {
      const current = await getSafetyIncidents();
      const updated = [fullIncident, ...current.filter(item => item.id !== id)];
      localStorage.setItem('kis_safety_incidents', JSON.stringify(updated));
    } catch (e) {}
  }

  return fullIncident;
}

/**
 * 5. 안전사고 처리 상태 변경
 */
export async function updateIncidentStatus(id: string, status: 'RECEIVED' | 'IN_PROGRESS' | 'RESOLVED', followUpNote?: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    const docRef = doc(getDb(), INCIDENT_COLLECTION, id);
    await updateDoc(docRef, {
      status,
      updatedAt: now,
      ...(followUpNote ? { followUpPlan: followUpNote } : {}),
    });
  } catch (error) {
    console.warn('Firestore updateIncidentStatus fallback:', error);
  }

  if (typeof window !== 'undefined') {
    try {
      const current = await getSafetyIncidents();
      const updated = current.map(item => {
        if (item.id === id) {
          return {
            ...item,
            status,
            updatedAt: now,
            ...(followUpNote ? { followUpPlan: followUpNote } : {}),
          };
        }
        return item;
      });
      localStorage.setItem('kis_safety_incidents', JSON.stringify(updated));
    } catch (e) {}
  }
}

/**
 * 6. 안전 시설물 점검 목록 조회
 */
export async function getSafetyFacilities(): Promise<SafetyFacilityItem[]> {
  try {
    const snapshot = await getDocs(collection(getDb(), FACILITY_COLLECTION));
    if (!snapshot.empty) {
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafetyFacilityItem));
    }
  } catch (error) {
    console.warn('Firestore getSafetyFacilities fallback:', error);
  }

  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('kis_safety_facilities');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {}
    }
    localStorage.setItem('kis_safety_facilities', JSON.stringify(INITIAL_FACILITIES));
  }
  return INITIAL_FACILITIES;
}

/**
 * 7. 안전 시설물 상태 업데이트
 */
export async function updateFacilityStatus(id: string, status: SafetyStatus, notes?: string): Promise<void> {
  const today = format(new Date(), 'yyyy-MM-dd');
  try {
    await updateDoc(doc(getDb(), FACILITY_COLLECTION, id), {
      status,
      lastCheckedDate: today,
      ...(notes ? { notes } : {}),
    });
  } catch (error) {
    console.warn('Firestore updateFacilityStatus fallback:', error);
  }

  if (typeof window !== 'undefined') {
    try {
      const current = await getSafetyFacilities();
      const updated = current.map(item => {
        if (item.id === id) {
          return {
            ...item,
            status,
            lastCheckedDate: today,
            ...(notes ? { notes } : {}),
          };
        }
        return item;
      });
      localStorage.setItem('kis_safety_facilities', JSON.stringify(updated));
    } catch (e) {}
  }
}

/**
 * 8. KPI 통계 지표 계산
 */
export function calculateSafetyKPI(
  patrols: SafetyPatrolLog[],
  incidents: SafetyIncident[],
  facilities: SafetyFacilityItem[]
): SafetyKPIStats {
  const today = format(new Date(), 'yyyy-MM-dd');
  const thisMonth = format(new Date(), 'yyyy-MM');

  const todayPatrolCompleted = patrols.some(p => p.date === today);
  const thisMonthPatrolCount = patrols.filter(p => p.date.startsWith(thisMonth)).length;
  const activeIncidentsCount = incidents.filter(i => i.status !== 'RESOLVED').length;
  const facilityWarningCount = facilities.filter(f => f.status === 'WARNING' || f.status === 'DANGER').length;

  // 100점 만점 지표 산출
  let score = 100;
  score -= activeIncidentsCount * 10;
  score -= facilityWarningCount * 5;
  if (!todayPatrolCompleted) score -= 5;
  const totalSafeScore = Math.max(0, Math.min(100, score));

  return {
    todayPatrolCompleted,
    thisMonthPatrolCount,
    activeIncidentsCount,
    facilityWarningCount,
    totalSafeScore,
  };
}

// ==========================================
// [안전점검의 날] 학교 시설 및 월별 안전점검표 서비스
// ==========================================

const SCHOOL_FACILITIES_COLLECTION = 'safety_school_facilities';
const MONTHLY_INSPECTIONS_COLLECTION = 'safety_monthly_inspections';

let _facilitiesCache: SchoolFacility[] | null = null;

export function invalidateSchoolFacilitiesCache() {
  _facilitiesCache = null;
}

async function enrichFacilitiesWithTeacherEmail(facilities: SchoolFacility[]): Promise<SchoolFacility[]> {
  try {
    const users = await getUsersDirectory();
    if (!users || users.length === 0) return facilities;
    const userMapByName = new Map<string, string>();
    users.forEach((u) => {
      if (u.name && u.email) {
        userMapByName.set(u.name.trim(), u.email.trim());
      }
    });

    return facilities.map((f) => {
      let email = (f.assignedTeacherEmail || f.teacherEmail || '').trim();
      const name = (f.assignedTeacherName || f.teacherName || '').trim();
      if (!email && name && userMapByName.has(name)) {
        email = userMapByName.get(name)!;
      }
      return {
        ...f,
        assignedTeacherEmail: email || f.assignedTeacherEmail,
        teacherEmail: email || f.teacherEmail,
      };
    });
  } catch (err) {
    return facilities;
  }
}

/**
 * 9. 학교 전체 등록 시설 목록 조회 (캐시 + Firestore + fallback 시드)
 */
export async function getSchoolFacilities(forceRefresh = false): Promise<SchoolFacility[]> {
  if (!forceRefresh && _facilitiesCache && _facilitiesCache.length > 0) {
    return _facilitiesCache;
  }
  try {
    const db = getDb();
    const snap = await getDocs(collection(db, SCHOOL_FACILITIES_COLLECTION));
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolFacility));
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
      const enriched = await enrichFacilitiesWithTeacherEmail(list);
      _facilitiesCache = enriched;
      return enriched;
    }
  } catch (e) {
    console.warn('[safetyService] getSchoolFacilities Firestore fetch error, fallback to defaults:', e);
  }

  // 로컬스토리지 백업 확인
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem('kis_school_safety_facilities');
      if (local) {
        const parsed = JSON.parse(local) as SchoolFacility[];
        if (parsed.length > 0) {
          const enriched = await enrichFacilitiesWithTeacherEmail(parsed);
          _facilitiesCache = enriched;
          return enriched;
        }
      }
    } catch (e) {}
  }

  // 기본 시드 제공 및 비동기 저장
  const enrichedSeed = await enrichFacilitiesWithTeacherEmail(DEFAULT_SCHOOL_FACILITIES);
  _facilitiesCache = enrichedSeed;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('kis_school_safety_facilities', JSON.stringify(enrichedSeed));
    } catch (e) {}
  }

  // Firestore에 기본 시드 초기 저장 시도
  try {
    const db = getDb();
    const batch = writeBatch(db);
    enrichedSeed.forEach(fac => {
      batch.set(doc(collection(db, SCHOOL_FACILITIES_COLLECTION), fac.id), fac, { merge: true });
    });
    await batch.commit();
  } catch (e) {
    console.warn('[safetyService] Seed initial facilities failed:', e);
  }

  return enrichedSeed;
}

/**
 * 10. 학교 시설 단일 추가/수정
 */
export async function saveSchoolFacility(
  facility: Partial<SchoolFacility>
): Promise<{ success: boolean; facility?: SchoolFacility }> {
  const id = facility.id || `fac_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const dataToSave: SchoolFacility = {
    id,
    name: facility.name || '신규 시설',
    fullName: facility.fullName || facility.name || '신규 시설',
    category: facility.category || 'special',
    grade: facility.grade,
    classNum: facility.classNum,
    location: facility.location || '교내',
    assignedTeacherName: facility.assignedTeacherName || '',
    assignedTeacherEmail: facility.assignedTeacherEmail || '',
    assignedTeacherRole: facility.assignedTeacherRole || '',
    order: facility.order || 999,
    isActive: facility.isActive !== false,
    createdAt: facility.createdAt || now,
    updatedAt: now,
  };

  // 차년도 학급·시설 매핑 필드 보존 (개별 추가/수정 모달 저장 시 누락되던 문제 수정)
  const NEXT_YEAR_FIELDS = [
    'targetYear',
    'nextYear',
    'nextYearName',
    'nextYearFullName',
    'nextYearGrade',
    'nextYearClassNum',
    'nextYearLocation',
    'nextYearTeacherName',
    'nextYearTeacherEmail',
  ] as const;
  for (const key of NEXT_YEAR_FIELDS) {
    const value = facility[key];
    if (value !== undefined) {
      (dataToSave as any)[key] = value;
    }
  }

  // Firestore는 undefined 값을 거부하므로 제거한다. (학년/반이 없는 특별실 수정 시 저장이 조용히 실패하던 문제)
  for (const key of Object.keys(dataToSave)) {
    if ((dataToSave as any)[key] === undefined) delete (dataToSave as any)[key];
  }

  try {
    const db = getDb();
    await setDoc(doc(collection(db, SCHOOL_FACILITIES_COLLECTION), id), dataToSave, { merge: true });
  } catch (e) {
    // 저장 실패를 숨기지 않는다: 호출부(시설 추가/수정 모달)에서 '저장 실패'로 안내
    console.warn('[safetyService] saveSchoolFacility firestore error:', e);
    throw e;
  }

  // 캐시 및 로컬스토리지 동기화
  const current = await getSchoolFacilities();
  const existingIdx = current.findIndex(f => f.id === id);
  let updated: SchoolFacility[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = dataToSave;
  } else {
    updated = [...current, dataToSave];
  }
  updated.sort((a, b) => (a.order || 0) - (b.order || 0));
  _facilitiesCache = updated;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('kis_school_safety_facilities', JSON.stringify(updated));
    } catch (e) {}
  }

  return { success: true, facility: dataToSave };
}

/**
 * 10-1. 시설 및 학급 목록 일괄 저장 (당해년도 및 차년도 매핑 동시 저장)
 */
export async function saveSchoolFacilitiesBatch(
  facilities: SchoolFacility[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const db = getDb();
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();

    facilities.forEach((fac) => {
      const docRef = doc(collection(db, SCHOOL_FACILITIES_COLLECTION), fac.id);
      batch.set(
        docRef,
        {
          ...fac,
          updatedAt: nowIso
        },
        { merge: true }
      );
    });

    await batch.commit();
    _facilitiesCache = facilities;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('kis_school_safety_facilities', JSON.stringify(facilities));
      } catch (e) {}
    }
    return { success: true, count: facilities.length };
  } catch (e: any) {
    console.error('[safetyService] saveSchoolFacilitiesBatch error:', e);
    return { success: false, count: 0, error: e.message };
  }
}

/**
 * 11. 학교 시설 삭제
 */
export async function deleteSchoolFacility(id: string): Promise<boolean> {
  try {
    const db = getDb();
    await deleteDoc(doc(collection(db, SCHOOL_FACILITIES_COLLECTION), id));
  } catch (e) {
    console.warn('[safetyService] deleteSchoolFacility firestore error:', e);
  }
  const current = await getSchoolFacilities();
  const updated = current.filter(f => f.id !== id);
  _facilitiesCache = updated;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('kis_school_safety_facilities', JSON.stringify(updated));
    } catch (e) {}
  }
  return true;
}

/**
 * 12. 기본 학교 시설 일괄 초기화
 */
export async function resetDefaultSchoolFacilities(): Promise<SchoolFacility[]> {
  try {
    const db = getDb();
    const batch = writeBatch(db);
    DEFAULT_SCHOOL_FACILITIES.forEach(fac => {
      batch.set(doc(collection(db, SCHOOL_FACILITIES_COLLECTION), fac.id), fac);
    });
    await batch.commit();
  } catch (e) {
    console.warn('[safetyService] resetDefaultSchoolFacilities error:', e);
  }
  _facilitiesCache = DEFAULT_SCHOOL_FACILITIES;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('kis_school_safety_facilities', JSON.stringify(DEFAULT_SCHOOL_FACILITIES));
    } catch (e) {}
  }
  return DEFAULT_SCHOOL_FACILITIES;
}

// ─── 월별 안전점검표 (매월 4일 점검) ──────────────────────────────────────────

/**
 * 13. 특정 연월(YYYY-MM)의 전체 점검 기록 조회
 */
export async function getMonthlyInspections(yearMonth: string): Promise<MonthlyInspectionRecord[]> {
  try {
    const db = getDb();
    const snap = await getDocs(collection(db, MONTHLY_INSPECTIONS_COLLECTION));
    if (!snap.empty) {
      const records = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as MonthlyInspectionRecord))
        .filter(r => r.yearMonth === yearMonth);
      return records;
    }
  } catch (e) {
    console.warn('[safetyService] getMonthlyInspections firestore error:', e);
  }

  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(`kis_safety_inspections_${yearMonth}`);
      if (local) {
        return JSON.parse(local) as MonthlyInspectionRecord[];
      }
    } catch (e) {}
  }
  return [];
}

/**
 * 14. 월별 안전점검표 제출 및 저장
 */
export async function saveMonthlyInspection(
  record: Partial<MonthlyInspectionRecord>
): Promise<{ success: boolean; record?: MonthlyInspectionRecord }> {
  if (!record.facilityId || !record.yearMonth) {
    return { success: false };
  }
  const id = record.id || `${record.yearMonth}_${record.facilityId}`;
  const now = new Date().toISOString();
  let finalSignature = record.signature;
  if (!isActualSignature(finalSignature)) {
    const sigMap = await getTeacherSignaturesDirectory();
    const emailKey = (record.assignedTeacherEmail || record.inspectorEmail || '').toLowerCase().trim();
    const nameKey = (record.assignedTeacherName || record.inspectorName || '').trim();
    const registeredSig = (emailKey && sigMap[emailKey]) || (nameKey && sigMap[nameKey]) || null;
    if (isActualSignature(registeredSig)) {
      finalSignature = registeredSig!;
    } else {
      finalSignature = getTeacherStampSignature(nameKey || '교사', finalSignature);
    }
  }

  const dataToSave: MonthlyInspectionRecord = {
    id,
    yearMonth: record.yearMonth,
    facilityId: record.facilityId,
    facilityName: record.facilityName || '',
    grade: record.grade !== undefined ? record.grade : (null as any),
    classNum: record.classNum !== undefined ? record.classNum : (null as any),
    category: record.category || 'classroom',
    assignedTeacherName: record.assignedTeacherName || '',
    assignedTeacherEmail: record.assignedTeacherEmail || '',
    inspectorName: record.inspectorName || record.assignedTeacherName || '점검자',
    inspectorEmail: record.inspectorEmail || record.assignedTeacherEmail || '',
    inspectionDate: record.inspectionDate || format(new Date(), 'yyyy-MM-dd'),
    isCompleted: record.isCompleted !== false,
    scores: record.scores || {},
    notes: record.notes || '',
    needsFacilityTeamFix: Boolean(record.needsFacilityTeamFix),
    signature: finalSignature,
    submittedAt: record.submittedAt || now,
    updatedAt: now,
  };

  try {
    const db = getDb();
    await setDoc(doc(collection(db, MONTHLY_INSPECTIONS_COLLECTION), id), dataToSave, { merge: true });
  } catch (e) {
    console.warn('[safetyService] saveMonthlyInspection error:', e);
  }

  if (typeof window !== 'undefined') {
    try {
      const key = `kis_safety_inspections_${record.yearMonth}`;
      const local = localStorage.getItem(key);
      const list: MonthlyInspectionRecord[] = local ? JSON.parse(local) : [];
      const idx = list.findIndex(r => r.id === id);
      if (idx >= 0) {
        list[idx] = dataToSave;
      } else {
        list.push(dataToSave);
      }
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {}
  }

  return { success: true, record: dataToSave };
}

/**
 * 15. 특정 교사에게 당월 미완료된 점검 시설 목록 조회 (팝업 대상 판별용)
 */
export async function getTeacherPendingInspections(
  teacherEmail?: string,
  teacherName?: string,
  yearMonth?: string
): Promise<{ pendingFacilities: SchoolFacility[]; currentRecords: Record<string, MonthlyInspectionRecord> }> {
  const currentYM = yearMonth || format(new Date(), 'yyyy-MM');
  const facilities = await getSchoolFacilities();
  const monthlyRecords = await getMonthlyInspections(currentYM);
  const recordMap: Record<string, MonthlyInspectionRecord> = {};
  monthlyRecords.forEach(r => {
    recordMap[r.facilityId] = r;
  });

  const normEmail = (teacherEmail || '').toLowerCase().trim();
  const normName = (teacherName || '').trim();

  // 해당 교사에게 배정된 활성 시설 필터링
  const myFacilities = facilities.filter(fac => {
    if (!fac.isActive) return false;
    const facEmail = (fac.assignedTeacherEmail || '').toLowerCase().trim();
    const facName = (fac.assignedTeacherName || '').trim();
    if (normEmail && facEmail && normEmail === facEmail) return true;
    if (normName && facName && normName === facName) return true;
    return false;
  });

  // 점검 미완료 시설 찾기
  const pendingFacilities = myFacilities.filter(fac => {
    const rec = recordMap[fac.id];
    return !rec || !rec.isCompleted;
  });

  return { pendingFacilities, currentRecords: recordMap };
}

/**
 * 16. 전체 미점검 시설 일괄 점검 완료 처리 (안전지도 관리 담당자 전결)
 */
export async function batchCompleteAllInspections(
  yearMonth: string,
  inspectorName: string,
  inspectorEmail: string
): Promise<{ success: boolean; completedCount: number }> {
  const facilities = await getSchoolFacilities();
  const existingRecords = await getMonthlyInspections(yearMonth);
  const recordMap: Record<string, MonthlyInspectionRecord> = {};
  existingRecords.forEach(r => {
    recordMap[r.facilityId] = r;
  });

  const activeFacilities = facilities.filter(f => f.isActive);
  const pendingFacilities = activeFacilities.filter(f => !recordMap[f.id]?.isCompleted);

  if (pendingFacilities.length === 0) {
    return { success: true, completedCount: 0 };
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date().toISOString();

  // 기본 전체 양호 스코어 셋
  const defaultScores: Record<string, InspectionScore> = {};
  SAFETY_INSPECTION_ITEMS.forEach(i => {
    defaultScores[i.id] = 'O';
  });

  // 전교 교원 실제 등록 서명(도장 이미지) 맵 조회
  const sigMap = await getTeacherSignaturesDirectory();

  const batchDocs: MonthlyInspectionRecord[] = pendingFacilities.map(fac => {
    const id = `${yearMonth}_${fac.id}`;
    const teacherName = fac.assignedTeacherName || inspectorName;
    const teacherEmail = (fac.assignedTeacherEmail || '').toLowerCase().trim();
    const registeredSig = (teacherEmail && sigMap[teacherEmail]) || (teacherName && sigMap[teacherName]) || null;
    const signature = isActualSignature(registeredSig)
      ? registeredSig!
      : getTeacherStampSignature(teacherName);

    return {
      id,
      yearMonth,
      facilityId: fac.id,
      facilityName: fac.name,
      grade: fac.grade,
      classNum: fac.classNum,
      category: fac.category,
      assignedTeacherName: teacherName,
      assignedTeacherEmail: fac.assignedTeacherEmail || '',
      inspectorName: `${inspectorName}(일괄)`,
      inspectorEmail,
      inspectionDate: today,
      isCompleted: true,
      scores: defaultScores,
      notes: '안전지도 담당 교사 일괄 점검 완료',
      needsFacilityTeamFix: false,
      signature,
      submittedAt: now,
      updatedAt: now,
    };
  });

  try {
    const db = getDb();
    const batch = writeBatch(db);
    batchDocs.forEach(rec => {
      batch.set(doc(collection(db, MONTHLY_INSPECTIONS_COLLECTION), rec.id), rec, { merge: true });
    });
    await batch.commit();
  } catch (e) {
    console.warn('[safetyService] batchCompleteAllInspections firestore error:', e);
  }

  if (typeof window !== 'undefined') {
    try {
      const key = `kis_safety_inspections_${yearMonth}`;
      const local = localStorage.getItem(key);
      const list: MonthlyInspectionRecord[] = local ? JSON.parse(local) : [];
      batchDocs.forEach(b => {
        const idx = list.findIndex(r => r.id === b.id);
        if (idx >= 0) {
          list[idx] = b;
        } else {
          list.push(b);
        }
      });
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {}
  }

  return { success: true, completedCount: batchDocs.length };
}

/**
 * 17. 특정 미점검 교사의 담당 시설 대리 점검 완료 처리
 */
export async function proxyCompleteTeacherInspections(
  teacherName: string,
  teacherEmail: string,
  facilityIds: string[],
  yearMonth: string,
  proxyInspectorName: string,
  proxyInspectorEmail: string
): Promise<{ success: boolean; completedCount: number }> {
  const facilities = await getSchoolFacilities();
  const targetFacilities = facilities.filter(f => facilityIds.includes(f.id));

  if (targetFacilities.length === 0) {
    return { success: true, completedCount: 0 };
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date().toISOString();

  const defaultScores: Record<string, InspectionScore> = {};
  SAFETY_INSPECTION_ITEMS.forEach(i => {
    defaultScores[i.id] = 'O';
  });

  // 전교 교원 실제 등록 서명(도장 이미지) 맵 조회
  const sigMap = await getTeacherSignaturesDirectory();

  const batchDocs: MonthlyInspectionRecord[] = targetFacilities.map(fac => {
    const id = `${yearMonth}_${fac.id}`;
    const tName = fac.assignedTeacherName || teacherName;
    const tEmail = (fac.assignedTeacherEmail || teacherEmail || '').toLowerCase().trim();
    const registeredSig = (tEmail && sigMap[tEmail]) || (tName && sigMap[tName]) || null;
    const signature = isActualSignature(registeredSig)
      ? registeredSig!
      : getTeacherStampSignature(tName);

    return {
      id,
      yearMonth,
      facilityId: fac.id,
      facilityName: fac.name,
      grade: fac.grade,
      classNum: fac.classNum,
      category: fac.category,
      assignedTeacherName: tName,
      assignedTeacherEmail: fac.assignedTeacherEmail || teacherEmail,
      inspectorName: `${proxyInspectorName}(대리)`,
      inspectorEmail: proxyInspectorEmail,
      inspectionDate: today,
      isCompleted: true,
      scores: defaultScores,
      notes: `안전지도 담당자(${proxyInspectorName}) 대리 점검 완료`,
      needsFacilityTeamFix: false,
      signature,
      submittedAt: now,
      updatedAt: now,
    };
  });

  try {
    const db = getDb();
    const batch = writeBatch(db);
    batchDocs.forEach(rec => {
      batch.set(doc(collection(db, MONTHLY_INSPECTIONS_COLLECTION), rec.id), rec, { merge: true });
    });
    await batch.commit();
  } catch (e) {
    console.warn('[safetyService] proxyCompleteTeacherInspections firestore error:', e);
  }

  if (typeof window !== 'undefined') {
    try {
      const key = `kis_safety_inspections_${yearMonth}`;
      const local = localStorage.getItem(key);
      const list: MonthlyInspectionRecord[] = local ? JSON.parse(local) : [];
      batchDocs.forEach(b => {
        const idx = list.findIndex(r => r.id === b.id);
        if (idx >= 0) {
          list[idx] = b;
        } else {
          list.push(b);
        }
      });
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {}
  }

  return { success: true, completedCount: batchDocs.length };
}

/**
 * 18. 매월 4일 안전점검 팝업 발동 가능 조건 검사
 * - 매월 4일 이후(당월 4일~말일)인지 검사 (1~3일은 점검일 전이므로 팝업 차단)
 * - 시스템 설정의 학사 일정 관리(1학기, 2학기) 기간 내인지 검사 (방학 기간 배제)
 */
export async function isInspectionPopupAllowed(currentDate = new Date()): Promise<{
  allowed: boolean;
  reason?: string;
  semesterName?: string;
}> {
  const day = currentDate.getDate();
  const dateStr = format(currentDate, 'yyyy-MM-dd');

  // 1. 매월 4일 이전(1~3일) 차단
  if (day < 4) {
    return { allowed: false, reason: '매월 4일 정기 점검일 이전(1~3일)입니다.' };
  }

  // 2. 학사 일정 조회하여 1학기, 2학기 정규 학기 기간 내인지 검사 (방학 기간 배제)
  try {
    const { getDocConfig } = await import('@/lib/services/settingsService');
    const config = await getDocConfig();
    const semesters = config?.academicCalendar?.semesters;

    if (semesters) {
      const sem1 = semesters.sem1;
      const sem2 = semesters.sem2;

      const isInSem1 = sem1 && sem1.startDate && sem1.endDate && dateStr >= sem1.startDate && dateStr <= sem1.endDate;
      const isInSem2 = sem2 && sem2.startDate && sem2.endDate && dateStr >= sem2.startDate && dateStr <= sem2.endDate;

      if (!isInSem1 && !isInSem2) {
        return { allowed: false, reason: '학사 일정 상 방학 또는 학기 외 기간이므로 점검 팝업이 표시되지 않습니다.' };
      }

      const activeSemName = isInSem1 ? (sem1.name || '1학기') : (sem2.name || '2학기');
      return { allowed: true, semesterName: activeSemName };
    }
  } catch (e) {
    console.warn('[safetyService] isInspectionPopupAllowed academic calendar check warning:', e);
  }

  // 학사 일정이 미설정되어 있는 경우 기본 학기 기간(3~7월, 8~1월) 검사
  const month = currentDate.getMonth() + 1;
  const isDefaultSemester = (month >= 3 && month <= 7) || (month >= 8 && month <= 12) || month === 1;
  if (!isDefaultSemester) {
    return { allowed: false, reason: '기본 방학 기간(2월 등)이므로 점검 팝업이 표시되지 않습니다.' };
  }

  return { allowed: true };
}
