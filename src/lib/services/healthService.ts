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
