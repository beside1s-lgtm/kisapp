import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  updateDoc,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import type {
  Student,
  HealthSchoolSetting,
  HealthExam,
  PreSchoolImmunization,
  PostSchoolImmunization,
  SchoolHistoryEntry,
  OtherExam
} from '@/lib/pe/types';

// ==========================================
// 1. 학교 건강기록부 전역 설정 & 검진기관
// ==========================================

const HEALTH_SETTINGS_DOC = 'healthSettings';

export async function getHealthSchoolSetting(school: string = 'KISH'): Promise<HealthSchoolSetting> {
  try {
    const docRef = doc(db, 'settings', `${school}_${HEALTH_SETTINGS_DOC}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as HealthSchoolSetting;
    }
    return {
      officialSchoolName: '호치민시한국국제학교',
      healthRecord_showGuardian: true,
      healthRecord_showBloodType: true,
      healthExamInstitutions: ['비나헬스케어', '라플스 메디컬', '패밀리 메디컬 프랙티스', 'FV 병원'],
      dentalExamInstitutions: ['비나헬스케어 치과', '보스톤 치과', '호치민 치과병원'],
    };
  } catch (e) {
    console.error('getHealthSchoolSetting error:', e);
    return {
      officialSchoolName: '호치민시한국국제학교',
      healthRecord_showGuardian: true,
      healthRecord_showBloodType: true,
      healthExamInstitutions: ['비나헬스케어', '라플스 메디컬'],
      dentalExamInstitutions: ['비나헬스케어 치과'],
    };
  }
}

export async function saveHealthSchoolSetting(school: string = 'KISH', setting: Partial<HealthSchoolSetting>): Promise<void> {
  const docRef = doc(db, 'settings', `${school}_${HEALTH_SETTINGS_DOC}`);
  await setDoc(docRef, { ...setting, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getHealthExamInstitutions(school: string = 'KISH'): Promise<{ general: string[]; dental: string[] }> {
  const s = await getHealthSchoolSetting(school);
  return {
    general: s.healthExamInstitutions || [],
    dental: s.dentalExamInstitutions || [],
  };
}

export async function saveHealthExamInstitutions(
  school: string = 'KISH',
  institutions: { general: string[]; dental: string[] }
): Promise<void> {
  await saveHealthSchoolSetting(school, {
    healthExamInstitutions: institutions.general,
    dentalExamInstitutions: institutions.dental,
  });
}

// ==========================================
// 2. 학생 건강기록부 개별 데이터
// ==========================================

export async function getHealthStudentRecord(studentId: string): Promise<Partial<Student> | null> {
  try {
    const docRef = doc(db, 'student_health_records', studentId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as Partial<Student>;
    }
    return null;
  } catch (e) {
    console.error('getHealthStudentRecord error:', e);
    return null;
  }
}

export async function getAllHealthStudentRecords(): Promise<Record<string, Partial<Student>>> {
  try {
    const collRef = collection(db, 'student_health_records');
    const snap = await getDocs(collRef);
    const result: Record<string, Partial<Student>> = {};
    snap.docs.forEach(d => {
      result[d.id] = d.data() as Partial<Student>;
    });
    return result;
  } catch (e) {
    console.error('getAllHealthStudentRecords error:', e);
    return {};
  }
}

export async function saveHealthStudentRecord(
  studentId: string,
  data: Partial<Student>
): Promise<void> {
  const docRef = doc(db, 'student_health_records', studentId);
  await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function bulkUpdateHealthExams(
  updates: { studentId: string; grade: string; type: 'general' | 'dental'; exam: HealthExam }[]
): Promise<number> {
  const batch = writeBatch(db);
  let count = 0;

  for (const item of updates) {
    const docRef = doc(db, 'student_health_records', item.studentId);
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? (snap.data() as Partial<Student>) : {};
    const healthExams = existing.healthExams || {};
    
    if (!healthExams[item.grade]) {
      healthExams[item.grade] = {};
    }
    healthExams[item.grade][item.type] = item.exam;

    batch.set(docRef, { healthExams, updatedAt: serverTimestamp() }, { merge: true });
    count++;
  }

  await batch.commit();
  return count;
}

// ==========================================
// 3. 학생 감염병 및 질병 현황 관리
// ==========================================

export interface DiseaseRecord {
  id: string;
  studentId: string;
  studentName: string;
  grade: string;
  classNum: string;
  studentNum?: string;
  gender?: string;
  schoolLevel: 'elementary' | 'secondary' | 'staff'; // 초등(1~6) | 중등(7~12) | 교직원
  targetType?: 'student' | 'staff';
  staffDepartment?: string; // 교직원 소속/부서 (행정실, 초등교무실 등)
  staffPosition?: string; // 직책/직급 (교사, 부장 등)
  staffEmail?: string; // 교직원 이메일
  homeroomTeacherName: string; // 담임 교사명 또는 직책
  diseaseCategory: string; // '법정감염병' | '학교다발감염병' | '일반질환' | '기타'
  diseaseName: string; // '수족구병', '인플루엔자(독감)', '코로나19', '수두', '급성 장염', 등
  diagnosedAt: string; // YYYY-MM-DD
  isolationStartDate?: string;
  isolationEndDate?: string;
  totalDays?: number; // 결석/격리 총 일수
  status: 'isolated' | 'recovered' | 'observing';
  medicalCertificateSubmitted: boolean;
  medicalCertificateUrl?: string; // 소견서/진단서 원본 이미지 URL 또는 Base64
  medicalCertificateName?: string;
  symptoms?: string;
  notes?: string;
  reportedBy?: string;
  source?: 'absence_doc' | 'health_manual' | 'staff_self'; // 결석계 자동연동 vs 보건실 수기 vs 교직원 직접신고
  relatedDocId?: string; // 결석계 전자결재 문서 ID
  createdAt?: string;
  updatedAt?: string;
}

const DISEASE_COLL = 'health_disease_surveillance';

/**
 * 비질병 결석 사유(체험학습, 탐방, 여행, 인정결석 등) 여부 판별
 */
export function isNonDiseaseAbsence(text: string = '', docType: string = ''): boolean {
  if (docType === 'field-trip') return true;
  const t = (text || '').trim().toLowerCase();
  if (!t) return false;
  const nonDiseaseKeywords = [
    '체험', '탐방', '가족여행', '여행', '현장학습', '교외체험',
    '가족문화', '가족 문화', '출석인정', '인정결석', '기타결석',
    '경조사', '가사', '간병', '여권', '비자', '이사', '대회참가'
  ];
  return nonDiseaseKeywords.some(kw => t.includes(kw));
}

/**
 * 감염병 및 질병 3대 표준 형태
 */
export type DiseaseCategoryType = '감염병' | '단순질병' | '식중독';

/**
 * 기존 저장 데이터 및 질병명을 3대 표준 형태로 정규화
 */
export function normalizeDiseaseCategory(category?: string, diseaseName?: string): DiseaseCategoryType {
  const cat = (category || '').trim();
  const name = (diseaseName || '').trim().toLowerCase();

  // 1. 식중독
  if (
    cat === '식중독' ||
    name.includes('식중독') ||
    name.includes('장염') ||
    name.includes('노로') ||
    name.includes('로타') ||
    name.includes('살모넬라')
  ) {
    return '식중독';
  }

  // 2. 감염병
  if (
    cat === '감염병' ||
    cat === '법정감염병' ||
    name.includes('독감') ||
    name.includes('인플루엔자') ||
    name.includes('수족구') ||
    name.includes('코로나') ||
    name.includes('수두') ||
    name.includes('볼거리') ||
    name.includes('이하선염') ||
    name.includes('홍역') ||
    name.includes('결막염') ||
    name.includes('눈병') ||
    name.includes('아폴로') ||
    name.includes('백일해') ||
    name.includes('성홍열')
  ) {
    return '감염병';
  }

  // 3. 학교다발감염병 과거 데이터 분류
  if (cat === '학교다발감염병') {
    if (name.includes('결막염') || name.includes('눈병')) return '감염병';
    return '식중독';
  }

  return '단순질병';
}

/**
 * 사유 텍스트로부터 감염병/질병 형태('감염병' | '단순질병' | '식중독') 및 표준 질병명 판별
 */
export function categorizeDisease(reason: string = ''): { category: DiseaseCategoryType; standardizedName: string } {
  const r = (reason || '').trim().toLowerCase();
  if (!r) return { category: '단순질병', standardizedName: '사유 미기재(확인필요)' };

  // 1. 식중독 (식중독, 장염, 노로바이러스, 살모넬라, 로타 등)
  if (r.includes('식중독')) return { category: '식중독', standardizedName: '식중독' };
  if (r.includes('노로')) return { category: '식중독', standardizedName: '노로바이러스 장염' };
  if (r.includes('로타')) return { category: '식중독', standardizedName: '로타바이러스 장염' };
  if (r.includes('장염') || r.includes('급성장염') || r.includes('급성 장염') || r.includes('세균성장염')) {
    return { category: '식중독', standardizedName: '급성 장염' };
  }

  // 2. 감염병 (독감, 인플루엔자, 코로나, 수족구, 수두, 볼거리, 홍역, 결막염, 눈병, 아폴로 등)
  if (r.includes('독감') || r.includes('인플루엔자')) return { category: '감염병', standardizedName: '독감(인플루엔자)' };
  if (r.includes('수족구')) return { category: '감염병', standardizedName: '수족구병' };
  if (r.includes('코로나') || r.includes('covid') || r.includes('코비드')) return { category: '감염병', standardizedName: '코로나19' };
  if (r.includes('수두')) return { category: '감염병', standardizedName: '수두' };
  if (r.includes('볼거리') || r.includes('이하선염')) return { category: '감염병', standardizedName: '유행성이하선염(볼거리)' };
  if (r.includes('홍역')) return { category: '감염병', standardizedName: '홍역' };
  if (r.includes('결막염') || r.includes('눈병') || r.includes('아폴로')) return { category: '감염병', standardizedName: '유행성결막염' };
  if (r.includes('백일해')) return { category: '감염병', standardizedName: '백일해' };
  if (r.includes('성홍열')) return { category: '감염병', standardizedName: '성홍열' };
  if (r.includes('수막구균') || r.includes('뇌수막염')) return { category: '감염병', standardizedName: '뇌수막염' };

  // 3. 단순질병 - 이비인후과 및 호흡기
  if (r.includes('중이염')) return { category: '단순질병', standardizedName: '중이염' };
  if (r.includes('인후통') || r.includes('인후염') || r.includes('편도') || r.includes('목감기') || r.includes('목 통증') || r.includes('목이 아') || r.includes('목통증')) {
    return { category: '단순질병', standardizedName: '인후통(편도염)' };
  }
  if (r.includes('기관지염') || r.includes('폐렴') || r.includes('모세기관지염')) return { category: '단순질병', standardizedName: '기관지염/폐렴' };
  if (r.includes('비염') || r.includes('천식') || r.includes('알레르기')) return { category: '단순질병', standardizedName: '알레르기/비염' };
  if (r.includes('감기') || r.includes('기침') || r.includes('콧물') || r.includes('상기도') || r.includes('코감기') || r.includes('몸살감기')) {
    return { category: '단순질병', standardizedName: '감기(상기도감염)' };
  }

  // 단순질병 - 소화기 / 전신
  if (r.includes('위염') || r.includes('위경련') || r.includes('소화불량') || r.includes('배탈') || r.includes('복통') || r.includes('설사') || r.includes('구토') || r.includes('배가 아') || r.includes('배아픔')) {
    return { category: '단순질병', standardizedName: '복통/위장염' };
  }
  if (r.includes('발열') || r.includes('고열') || r.includes('열감') || r.includes('몸살') || r.includes('오한') || r.includes('열이 나') || r.includes('열이 3') || r.includes('열이남')) {
    return { category: '단순질병', standardizedName: '발열/몸살' };
  }
  if (r.includes('두통') || r.includes('편두통') || r.includes('머리가 아') || r.includes('머리아픔')) return { category: '단순질병', standardizedName: '두통' };
  if (r.includes('어지럼') || r.includes('빈혈')) return { category: '단순질병', standardizedName: '어지럼증/빈혈' };

  // 단순질병 - 외과 / 치과 / 피부
  if (r.includes('골절') || r.includes('깁스') || r.includes('염좌') || r.includes('인대') || r.includes('탈구') || r.includes('외상') || r.includes('수술') || r.includes('다침') || r.includes('타박상') || r.includes('반깁스')) {
    return { category: '단순질병', standardizedName: '외상/염좌/골절' };
  }
  if (r.includes('치통') || r.includes('치과') || r.includes('충치') || r.includes('발치')) return { category: '단순질병', standardizedName: '치과 질환' };
  if (r.includes('피부염') || r.includes('아토피') || r.includes('두드러기')) return { category: '단순질병', standardizedName: '피부염/두드러기' };
  if (r.includes('병원') || r.includes('진료') || r.includes('통원')) return { category: '단순질병', standardizedName: '병원 진료(사유 확인)' };

  // 단순 "병결", "결석", "병결(출석부)" 등 명시적 병명이 없는 일반 단어인 경우
  if (r === '병결' || r === '결석' || r.includes('출석부') || r === '질병' || r === '질병결석' || r === '아픔' || r.includes('담임 출석부')) {
    return { category: '단순질병', standardizedName: '사유 미기재(확인필요)' };
  }

  // 그 외 기재된 사유가 있으면 정돈하여 사용
  const trimmed = reason.trim();
  if (trimmed.length <= 15) {
    return { category: '단순질병', standardizedName: trimmed };
  }
  return { category: '단순질병', standardizedName: trimmed.slice(0, 15) + '...' };
}

/**
 * 기간별(월간 또는 연간 전체) 감염병, 결석계(병결), 담임 일일 출석부 통합 데이터 조회
 * @param year '2026'
 * @param month '01'~'12' 또는 'all' (기본값: 'all')
 */
export async function getDiseaseRecordsByPeriod(
  year: string,
  month: string = 'all',
  school: string = 'KISH'
): Promise<DiseaseRecord[]> {
  try {
    const isAllYear = month === 'all';
    const targetMonthPrefix = isAllYear ? '' : `${year}-${month}`;

    // 학년도 범위 검사 함수 (3월 ~ 익년 2월)
    const isDateInSchoolYear = (dateStr: string) => {
      if (!dateStr) return false;
      if (!isAllYear) return dateStr.startsWith(targetMonthPrefix);
      const nextYear = String(parseInt(year, 10) + 1);
      const startLimit = `${year}-03-01`;
      const endLimit = `${nextYear}-02-29`;
      return dateStr >= startLimit && dateStr <= endLimit;
    };

    // 교원 이메일 -> 실명 매핑 테이블 사전 로드
    const userEmailMap = new Map<string, string>();
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.docs.forEach(ud => {
        const udata = ud.data();
        const uEmail = ud.id.toLowerCase();
        const uName = udata.nameKo || udata.name || udata.displayName || '';
        if (uName) {
          userEmailMap.set(uEmail, uName);
        }
      });
    } catch (e) {
      console.warn('Teacher users map fetch notice:', e);
    }

    // 마스터 학생 DB (master_students) 사전 로드하여 출석번호 및 성별 매핑 보완 (Enrichment)
    interface MasterStudentInfo {
      studentNum?: string;
      gender?: string;
    }
    const masterById = new Map<string, MasterStudentInfo>();
    const masterByNameGc = new Map<string, MasterStudentInfo>();
    const masterByName = new Map<string, MasterStudentInfo>();

    try {
      const masterSnap = await getDocs(collection(db, 'master_students'));
      masterSnap.docs.forEach(mDoc => {
        const m = mDoc.data();
        const mName = String(m.name || m.nameKo || '').trim();
        const mGrade = String(m.grade || '').trim();
        const mClass = String(m.classNum || m.class || '').trim();
        const mNum = String(m.studentNum || m.number || '').trim();
        const mGender = String(m.gender || '').trim();

        const info: MasterStudentInfo = {
          studentNum: mNum || undefined,
          gender: mGender || undefined,
        };

        if (mDoc.id) masterById.set(mDoc.id, info);
        if (m.studentId) masterById.set(String(m.studentId), info);
        if (mName && mGrade && mClass) {
          masterByNameGc.set(`${mName}_${mGrade}_${mClass}`, info);
        }
        if (mName) {
          masterByName.set(mName, info);
        }
      });
    } catch (e) {
      console.warn('Master students fetch notice:', e);
    }

    const resolveTeacherName = (rawTeacher: string): string => {
      if (!rawTeacher) return '담임교사';
      const lower = rawTeacher.toLowerCase().trim();
      if (userEmailMap.has(lower)) return userEmailMap.get(lower)!;
      if (lower.includes('@')) {
        return '담임교사';
      }
      return rawTeacher;
    };

    // 1. 보건실 자체 등록 및 수정 저장된 감염병 기록 조회
    const diseaseCollRef = collection(db, DISEASE_COLL);
    const snap = await getDocs(diseaseCollRef);
    const manualList: DiseaseRecord[] = [];

    snap.docs.forEach(d => {
      const data = d.data();
      const diag = data.diagnosedAt || data.isolationStartDate || '';
      if (isDateInSchoolYear(diag)) {
        // 비질병(체험학습 등) 필터
        if (isNonDiseaseAbsence(data.diseaseName || '') || isNonDiseaseAbsence(data.notes || '')) {
          return;
        }

        const isStaff = data.schoolLevel === 'staff' || data.targetType === 'staff';
        const gradeNum = parseInt(String(data.grade || '1'), 10) || 1;
        const targetLevel: 'elementary' | 'secondary' | 'staff' = isStaff 
          ? 'staff' 
          : (gradeNum <= 6 ? 'elementary' : 'secondary');

        manualList.push({
          id: d.id,
          studentId: data.studentId || d.id,
          studentName: data.studentName || '',
          grade: String(data.grade || (isStaff ? '교직원' : '')),
          classNum: String(data.classNum || (isStaff ? (data.staffDepartment || '교원') : '')),
          studentNum: String(data.studentNum || ''),
          gender: data.gender || '',
          schoolLevel: targetLevel,
          targetType: isStaff ? 'staff' : 'student',
          staffDepartment: data.staffDepartment || (isStaff ? (data.classNum || '') : ''),
          staffPosition: data.staffPosition || (isStaff ? (data.homeroomTeacherName || '교직원') : ''),
          staffEmail: data.staffEmail || '',
          homeroomTeacherName: isStaff ? (data.staffPosition || '교직원') : resolveTeacherName(data.homeroomTeacherName || data.reportedBy || ''),
          diseaseCategory: normalizeDiseaseCategory(data.diseaseCategory, data.diseaseName),
          diseaseName: data.diseaseName || '사유 미기재(확인필요)',
          diagnosedAt: diag,
          isolationStartDate: data.isolationStartDate || '',
          isolationEndDate: data.isolationEndDate || '',
          totalDays: data.totalDays || 1,
          status: data.status || 'observing',
          medicalCertificateSubmitted: Boolean(data.medicalCertificateSubmitted),
          medicalCertificateUrl: data.medicalCertificateUrl || '',
          medicalCertificateName: data.medicalCertificateName || '',
          symptoms: data.symptoms || '',
          notes: data.notes || '',
          reportedBy: data.reportedBy || '',
          source: data.source || 'health_manual',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '',
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || '',
        });
      }
    });

    // 2. 담임 교사가 처리한 결석계(병결) 승인 문서 조회
    const absenceDocList: DiseaseRecord[] = [];
    try {
      const approvalsRef = collection(db, 'approvals');
      const q = query(
        approvalsRef,
        where('parentFormData.type', '==', 'absence'),
        where('parentFormData.absenceType', '==', '병결')
      );
      const appSnap = await getDocs(q);

      appSnap.docs.forEach(docSnap => {
        const appData = docSnap.data();
        const pData = appData.parentFormData;
        if (!pData) return;

        // 비질병(체험학습, 탐방 등) 결석 완전 배제
        if (
          pData.type === 'field-trip' ||
          (pData.absenceType && pData.absenceType !== '병결') ||
          isNonDiseaseAbsence(pData.absenceReason || '') ||
          isNonDiseaseAbsence(pData.purpose || '') ||
          isNonDiseaseAbsence(appData.title || '')
        ) {
          return;
        }

        const period = pData.absencePeriod;
        const startDate = period?.startDate || pData.applyDate || '';
        
        if (isDateInSchoolYear(startDate)) {
          const rawGc = String(pData.gradeClassNumber || '').trim();
          const parts = rawGc.replace(/[^0-9-]/g, '-').split('-').filter(Boolean);
          const gStr = parts[0] || '1';
          const cStr = parts[1] || '1';
          const sNum = parts[2] || '';
          const gradeNum = parseInt(gStr, 10) || 1;

          let teacherName = pData.proxyTeacherName || '';
          if (!teacherName && Array.isArray(appData.approvers)) {
            const hrApprover = appData.approvers.find((a: any) => a.role === '담임' || a.role === '담임교사');
            if (hrApprover) teacherName = hrApprover.name || '';
            else if (appData.approvers[0]) teacherName = appData.approvers[0].name || '';
          }

          const rawReason = pData.absenceReason || pData.symptoms || appData.title || '';
          const { category: parsedCat, standardizedName: parsedName } = categorizeDisease(rawReason);
          const directCat = pData.diseaseCategory;
          const directName = pData.diseaseName;
          const category = directCat ? normalizeDiseaseCategory(directCat, directName || parsedName) : parsedCat;
          const standardizedName = directName || parsedName;

          const defaultStatus: 'isolated' | 'recovered' | 'observing' =
            category === '감염병' ? (appData.status === 'approved' ? 'isolated' : 'observing') : 'observing';

          const resolvedTeacher = resolveTeacherName(teacherName);

          const certUrl = pData.medicalCertificateUrl || appData.attachments?.[0]?.data || pData.attachments?.[0]?.data || '';
          const hasCert = Boolean(
            pData.medicalCertificateSubmitted !== undefined
              ? pData.medicalCertificateSubmitted
              : (certUrl !== '' || (Array.isArray(appData.attachments) && appData.attachments.length > 0))
          );

          absenceDocList.push({
            id: `doc_${docSnap.id}`,
            studentId: pData.studentId || docSnap.id,
            studentName: pData.studentName || '',
            grade: gStr,
            classNum: cStr,
            studentNum: sNum,
            gender: pData.gender || '',
            schoolLevel: gradeNum <= 6 ? 'elementary' : 'secondary',
            homeroomTeacherName: resolvedTeacher,
            diseaseCategory: category,
            diseaseName: standardizedName,
            diagnosedAt: startDate,
            isolationStartDate: startDate,
            isolationEndDate: period?.endDate || startDate,
            totalDays: period?.totalDays || 1,
            status: defaultStatus,
            medicalCertificateSubmitted: hasCert,
            medicalCertificateUrl: certUrl || undefined,
            medicalCertificateName: pData.medicalCertificateName || appData.attachments?.[0]?.name,
            symptoms: rawReason || '결석계 사유 참조',
            notes: `결석계 [${appData.status === 'approved' ? '승인완료' : '결재진행'}] (${resolvedTeacher})`,
            reportedBy: resolvedTeacher,
            source: 'absence_doc',
            relatedDocId: docSnap.id,
          });
        }
      });
    } catch (e) {
      console.warn('Approvals absence fetch notice:', e);
    }

    // 3. 담임 일일 출석부(homeroom_daily_attendance) 결석 기록 조회 (실시간 연동)
    const homeroomAttendanceList: DiseaseRecord[] = [];
    try {
      const attRef = collection(db, 'homeroom_daily_attendance');
      const attQ = query(attRef, where('status', '==', 'ABSENT'));
      const attSnap = await getDocs(attQ);

      attSnap.docs.forEach(attDoc => {
        const attData = attDoc.data();
        const attDate = attData.date || '';
        if (isDateInSchoolYear(attDate)) {
          // 비질병(체험학습, 탐방, 가족여행 등) 결석 완전 제외
          if (
            attData.source === 'auto_field_trip' ||
            attData.type === 'field-trip' ||
            (attData.absenceType && attData.absenceType !== '병결') ||
            isNonDiseaseAbsence(attData.reason || '') ||
            isNonDiseaseAbsence(attData.notes || '')
          ) {
            return;
          }

          // 단순 수기 결석 체크(사유가 전혀 없고 병결 표시도 없는 일반 결석)는 감염병/질병 대장에서 제외!
          // 감염병 및 질병 현황 대장은 "결석계 연동(auto_absence)"이거나, "병결"로 지정되었거나, 구체적인 질병/증상 사유가 입력된 경우만 수집
          const trimmedReason = (attData.reason || '').trim();
          const isExplicitDiseaseAbsence =
            attData.source === 'auto_absence' ||
            attData.absenceType === '병결' ||
            (trimmedReason !== '' && !['결석', '출석부', '체크', '미인정', '기타'].includes(trimmedReason));

          if (!isExplicitDiseaseAbsence) {
            return;
          }

          const rawGc = String(attData.gradeClass || '').trim();
          const parts = rawGc.replace(/[^0-9-]/g, '-').split('-').filter(Boolean);
          const gStr = parts[0] || '1';
          const cStr = parts[1] || '1';
          const gradeNum = parseInt(gStr, 10) || 1;
          const sName = attData.studentName || '';

          const reasonText = attData.reason || '';
          const { category, standardizedName } = categorizeDisease(reasonText);

          const defaultStatus: 'isolated' | 'recovered' | 'observing' =
            category === '감염병' ? 'isolated' : 'observing';

          const resolvedTeacher = resolveTeacherName(attData.updatedBy || '');

          homeroomAttendanceList.push({
            id: `att_${attDoc.id}`,
            studentId: attData.studentId || attDoc.id,
            studentName: sName,
            grade: gStr,
            classNum: cStr,
            studentNum: attData.studentNum || attData.number || '',
            gender: attData.gender || '',
            schoolLevel: gradeNum <= 6 ? 'elementary' : 'secondary',
            homeroomTeacherName: resolvedTeacher,
            diseaseCategory: category,
            diseaseName: standardizedName,
            diagnosedAt: attDate,
            isolationStartDate: attDate,
            isolationEndDate: attDate,
            totalDays: 1,
            status: defaultStatus,
            medicalCertificateSubmitted: false,
            symptoms: reasonText || '담임 출석부 결석 체크',
            notes: `담임 출석부 (${attData.source === 'auto_absence' ? '결석계 연동' : '담임 직접 체크'})`,
            reportedBy: resolvedTeacher,
            source: 'absence_doc',
          });
        }
      });
    } catch (e) {
      console.warn('Homeroom attendance fetch notice:', e);
    }

    // 4. 중복 병합 (출석부 < 결석계 < 보건실 수기/수정 등록 우선순위)
    const combinedMap = new Map<string, DiseaseRecord>();
    
    // 1) 출석부 기본 반영
    homeroomAttendanceList.forEach(r => {
      const key = `${r.studentName}_${r.grade}_${r.classNum}_${r.diagnosedAt}`;
      combinedMap.set(key, r);
    });

    // 2) 결석계 문서가 있으면 더 상세한 정보로 덮어쓰기
    absenceDocList.forEach(r => {
      const key = `${r.studentName}_${r.grade}_${r.classNum}_${r.diagnosedAt}`;
      combinedMap.set(key, r);
    });

    // 3) 보건실 자체 및 수정 등록(manualList)이 있으면 최우선 반영!
    manualList.forEach(r => {
      const key = `${r.studentName}_${r.grade}_${r.classNum}_${r.diagnosedAt}`;
      combinedMap.set(key, r);
    });

    // ID 기준 2차 중복 제거 보장
    const idMap = new Map<string, DiseaseRecord>();
    Array.from(combinedMap.values()).forEach(r => {
      idMap.set(r.id, r);
    });

    // 5. 마스터 학생 DB 기반 출석번호(studentNum) 및 성별(gender) 100% 매핑 보완 (Enrichment)
    const allRecords = Array.from(idMap.values()).map(r => {
      if (r.schoolLevel !== 'staff' && r.targetType !== 'staff') {
        const nameGcKey = `${r.studentName}_${r.grade}_${r.classNum}`;
        const masterInfo = masterById.get(r.studentId) || masterByNameGc.get(nameGcKey) || masterByName.get(r.studentName);

        const enrichedStudentNum = r.studentNum || masterInfo?.studentNum || '';
        const rawGender = r.gender || masterInfo?.gender || '';
        const enrichedGender = rawGender.startsWith('남') ? '남' : rawGender.startsWith('여') ? '여' : rawGender;

        return {
          ...r,
          studentNum: enrichedStudentNum,
          gender: enrichedGender,
        };
      }
      return r;
    });

    // 학년 오름차순, 반 오름차순, 진단일 내림차순 정렬
    return allRecords.sort((a, b) => {
      const gDiff = (parseInt(a.grade, 10) || 0) - (parseInt(b.grade, 10) || 0);
      if (gDiff !== 0) return gDiff;
      const cDiff = (parseInt(a.classNum, 10) || 0) - (parseInt(b.classNum, 10) || 0);
      if (cDiff !== 0) return cDiff;
      return (b.diagnosedAt || '').localeCompare(a.diagnosedAt || '');
    });

  } catch (err) {
    console.error('getDiseaseRecordsByPeriod error:', err);
    return [];
  }
}

/**
 * 담당자가 질병명 및 분류를 직접 수정/보정하여 Firestore에 영구 저장
 */
export async function updateDiseaseRecordDetails(
  record: DiseaseRecord,
  newDiseaseName: string,
  newCategory?: string,
  newNotes?: string,
  newStatus?: 'isolated' | 'recovered' | 'observing',
  newCertificateSubmitted?: boolean,
  newCertificateUrl?: string
): Promise<void> {
  const collRef = collection(db, DISEASE_COLL);
  const docId = record.id;
  const docRef = doc(collRef, docId);

  const cleanCategory = normalizeDiseaseCategory(newCategory || record.diseaseCategory, newDiseaseName);
  
  const cleanData: any = {
    id: docId,
    studentId: record.studentId || '',
    studentName: record.studentName || '',
    grade: record.grade || '',
    classNum: record.classNum || '',
    studentNum: record.studentNum || '',
    gender: record.gender || '',
    schoolLevel: record.schoolLevel || (parseInt(record.grade || '1', 10) <= 6 ? 'elementary' : 'secondary'),
    homeroomTeacherName: record.homeroomTeacherName || '',
    diseaseCategory: cleanCategory,
    diseaseName: newDiseaseName.trim(),
    diagnosedAt: record.diagnosedAt || '',
    isolationStartDate: record.isolationStartDate || record.diagnosedAt || '',
    isolationEndDate: record.isolationEndDate || record.diagnosedAt || '',
    totalDays: record.totalDays || 1,
    status: newStatus !== undefined ? newStatus : (record.status || (cleanCategory === '감염병' ? 'isolated' : 'observing')),
    medicalCertificateSubmitted: newCertificateSubmitted !== undefined ? Boolean(newCertificateSubmitted) : Boolean(record.medicalCertificateSubmitted),
    medicalCertificateUrl: newCertificateUrl !== undefined ? newCertificateUrl : (record.medicalCertificateUrl || ''),
    medicalCertificateName: record.medicalCertificateName || '',
    symptoms: record.symptoms || '',
    notes: newNotes !== undefined ? newNotes : (record.notes || ''),
    reportedBy: record.reportedBy || '보건교사 수정',
    source: 'health_manual',
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, cleanData, { merge: true });
}

/**
 * 월별 감염병 및 담임 병결 통합 데이터 조회 (기존 호환)
 */
export async function getMonthlyDiseaseRecords(
  monthStr: string,
  school: string = 'KISH'
): Promise<DiseaseRecord[]> {
  const [year, month] = monthStr.split('-');
  return getDiseaseRecordsByPeriod(year || '2026', month || 'all', school);
}

export async function getDiseaseRecords(school: string = 'KISH'): Promise<DiseaseRecord[]> {
  try {
    const collRef = collection(db, DISEASE_COLL);
    const snap = await getDocs(collRef);
    const list: DiseaseRecord[] = [];
    snap.docs.forEach(d => {
      const data = d.data();
      const gradeNum = parseInt(String(data.grade || '1'), 10) || 1;
      list.push({
        id: d.id,
        studentId: data.studentId || '',
        studentName: data.studentName || '',
        grade: String(data.grade || ''),
        classNum: String(data.classNum || ''),
        studentNum: String(data.studentNum || ''),
        gender: data.gender || '',
        schoolLevel: gradeNum <= 6 ? 'elementary' : 'secondary',
        homeroomTeacherName: data.homeroomTeacherName || data.reportedBy || '',
        diseaseCategory: data.diseaseCategory || '법정감염병',
        diseaseName: data.diseaseName || '기타',
        diagnosedAt: data.diagnosedAt || '',
        isolationStartDate: data.isolationStartDate || '',
        isolationEndDate: data.isolationEndDate || '',
        status: data.status || 'isolated',
        medicalCertificateSubmitted: Boolean(data.medicalCertificateSubmitted),
        symptoms: data.symptoms || '',
        notes: data.notes || '',
        reportedBy: data.reportedBy || '',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '',
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || '',
      });
    });

    const sorted = list.sort((a, b) => (b.diagnosedAt || '').localeCompare(a.diagnosedAt || ''));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('local_disease_records_cache', JSON.stringify(sorted));
      } catch {}
    }
    return sorted;
  } catch (e) {
    console.error('getDiseaseRecords error:', e);
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('local_disease_records_cache');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  }
}

export async function saveDiseaseRecord(
  record: Omit<DiseaseRecord, 'id'> & { id?: string }
): Promise<string> {
  const collRef = collection(db, DISEASE_COLL);
  const docRef = record.id ? doc(db, DISEASE_COLL, record.id) : doc(collRef);
  
  const isStaff = record.schoolLevel === 'staff' || record.targetType === 'staff';

  const cleanData: any = {
    studentId: record.studentId || '',
    studentName: record.studentName || '',
    grade: record.grade || (isStaff ? '교직원' : ''),
    classNum: record.classNum || (isStaff ? (record.staffDepartment || '교원') : ''),
    studentNum: record.studentNum || '',
    gender: record.gender || '',
    schoolLevel: isStaff ? 'staff' : (record.schoolLevel || (parseInt(record.grade || '1', 10) <= 6 ? 'elementary' : 'secondary')),
    targetType: isStaff ? 'staff' : 'student',
    staffDepartment: record.staffDepartment || '',
    staffPosition: record.staffPosition || '',
    staffEmail: (record.staffEmail || '').trim().toLowerCase(),
    homeroomTeacherName: record.homeroomTeacherName || (isStaff ? (record.staffPosition || '교직원') : ''),
    diseaseCategory: record.diseaseCategory || '법정감염병',
    diseaseName: record.diseaseName || '기타',
    diagnosedAt: record.diagnosedAt || '',
    isolationStartDate: record.isolationStartDate || '',
    isolationEndDate: record.isolationEndDate || '',
    totalDays: record.totalDays || 1,
    status: record.status || 'isolated',
    medicalCertificateSubmitted: Boolean(record.medicalCertificateSubmitted),
    medicalCertificateUrl: record.medicalCertificateUrl || '',
    medicalCertificateName: record.medicalCertificateName || '',
    symptoms: record.symptoms || '',
    notes: record.notes || '',
    reportedBy: record.reportedBy || '',
    source: record.source || (isStaff ? 'staff_self' : 'health_manual'),
    updatedAt: serverTimestamp(),
  };

  if (!record.id) {
    cleanData.createdAt = serverTimestamp();
  }

  await setDoc(docRef, cleanData, { merge: true });
  return docRef.id;
}

/**
 * 로그인한 교직원 본인의 건강/질병 신고 내역 조회
 */
export async function getMyStaffDiseaseReports(email: string): Promise<DiseaseRecord[]> {
  if (!email) return [];
  try {
    const collRef = collection(db, DISEASE_COLL);
    const q = query(
      collRef,
      where('staffEmail', '==', email.trim().toLowerCase())
    );
    const snap = await getDocs(q);
    const list: DiseaseRecord[] = [];
    snap.docs.forEach(d => {
      const data = d.data();
      list.push({
        id: d.id,
        studentId: data.studentId || d.id,
        studentName: data.studentName || '',
        grade: String(data.grade || '교직원'),
        classNum: String(data.classNum || data.staffDepartment || '교원'),
        studentNum: String(data.studentNum || ''),
        gender: data.gender || '',
        schoolLevel: 'staff',
        targetType: 'staff',
        staffDepartment: data.staffDepartment || '',
        staffPosition: data.staffPosition || '',
        staffEmail: data.staffEmail || '',
        homeroomTeacherName: data.staffPosition || '교직원',
        diseaseCategory: normalizeDiseaseCategory(data.diseaseCategory, data.diseaseName),
        diseaseName: data.diseaseName || '사유 미기재',
        diagnosedAt: data.diagnosedAt || '',
        isolationStartDate: data.isolationStartDate || '',
        isolationEndDate: data.isolationEndDate || '',
        totalDays: data.totalDays || 1,
        status: data.status || 'observing',
        medicalCertificateSubmitted: Boolean(data.medicalCertificateSubmitted),
        medicalCertificateUrl: data.medicalCertificateUrl || '',
        medicalCertificateName: data.medicalCertificateName || '',
        symptoms: data.symptoms || '',
        notes: data.notes || '',
        reportedBy: data.reportedBy || '',
        source: data.source || 'staff_self',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '',
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || '',
      });
    });
    return list.sort((a, b) => (b.diagnosedAt || '').localeCompare(a.diagnosedAt || ''));
  } catch (err) {
    console.error('getMyStaffDiseaseReports error:', err);
    return [];
  }
}

export async function deleteDiseaseRecord(id: string): Promise<void> {
  const docRef = doc(db, DISEASE_COLL, id);
  await deleteDoc(docRef);
}

export async function updateDiseaseStatus(
  id: string,
  status: 'isolated' | 'recovered' | 'observing',
  isolationEndDate?: string
): Promise<void> {
  const docRef = doc(db, DISEASE_COLL, id);
  const updateData: any = { status, updatedAt: serverTimestamp() };
  if (isolationEndDate) {
    updateData.isolationEndDate = isolationEndDate;
  }
  await setDoc(docRef, updateData, { merge: true });
}
