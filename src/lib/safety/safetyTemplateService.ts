// 학생 안전교육 기본 템플릿(틀) 저장 및 로드 서비스

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  YearlyPlanTemplateData,
  EvacuationPlanTemplateData,
  DEFAULT_YEARLY_TEMPLATE,
  DEFAULT_EVACUATION_TEMPLATE,
} from './templateTypes';

const TEMPLATE_DOC_PATH = 'settings/safety_templates';
const LOCAL_STORAGE_KEY_YEARLY = 'kis_safety_template_yearly';
const LOCAL_STORAGE_KEY_EVACUATION = 'kis_safety_template_evacuation';

// 1. 연간 안전교육 계획 템플릿 로드
export async function loadYearlyTemplate(): Promise<YearlyPlanTemplateData> {
  // 로컬 스토리지 우선 확인
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY_YEARLY);
      if (local) {
        return { ...DEFAULT_YEARLY_TEMPLATE, ...JSON.parse(local) };
      }
    } catch (e) {
      console.warn('로컬 템플릿 읽기 오류:', e);
    }
  }

  // Firestore 조회
  try {
    const docRef = doc(db, TEMPLATE_DOC_PATH);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.yearly) {
        return { ...DEFAULT_YEARLY_TEMPLATE, ...data.yearly };
      }
    }
  } catch (e) {
    console.warn('Firestore 템플릿 로드 오류 (기본값 사용):', e);
  }

  return DEFAULT_YEARLY_TEMPLATE;
}

// 2. 연간 안전교육 계획 템플릿 저장
export async function saveYearlyTemplate(data: YearlyPlanTemplateData): Promise<void> {
  // 로컬 스토리지 저장
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_YEARLY, JSON.stringify(data));
    } catch (e) {
      console.warn('로컬 템플릿 저장 실패:', e);
    }
  }

  // Firestore 저장
  try {
    const docRef = doc(db, TEMPLATE_DOC_PATH);
    await setDoc(docRef, { yearly: data, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.warn('Firestore 템플릿 저장 실패 (로컬 스토리지 보존):', e);
  }
}

// 3. 재난대피 훈련 템플릿 로드
export async function loadEvacuationTemplate(): Promise<EvacuationPlanTemplateData> {
  // 로컬 스토리지 우선 확인
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY_EVACUATION);
      if (local) {
        return { ...DEFAULT_EVACUATION_TEMPLATE, ...JSON.parse(local) };
      }
    } catch (e) {
      console.warn('로컬 템플릿 읽기 오류:', e);
    }
  }

  // Firestore 조회
  try {
    const docRef = doc(db, TEMPLATE_DOC_PATH);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.evacuation) {
        return { ...DEFAULT_EVACUATION_TEMPLATE, ...data.evacuation };
      }
    }
  } catch (e) {
    console.warn('Firestore 템플릿 로드 오류 (기본값 사용):', e);
  }

  return DEFAULT_EVACUATION_TEMPLATE;
}

// 4. 재난대피 훈련 템플릿 저장
export async function saveEvacuationTemplate(data: EvacuationPlanTemplateData): Promise<void> {
  // 로컬 스토리지 저장
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_EVACUATION, JSON.stringify(data));
    } catch (e) {
      console.warn('로컬 템플릿 저장 실패:', e);
    }
  }

  // Firestore 저장
  try {
    const docRef = doc(db, TEMPLATE_DOC_PATH);
    await setDoc(docRef, { evacuation: data, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.warn('Firestore 템플릿 저장 실패 (로컬 스토리지 보존):', e);
  }
}
