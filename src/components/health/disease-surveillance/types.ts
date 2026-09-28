import type { Student } from '@/lib/pe/types';
import type { DiseaseRecord } from '@/lib/services/healthService';

export interface DiseaseSurveillanceProps {
  students: Student[];
}

export interface DiseaseStats {
  totalCount: number;
  classCount: number;
  isolatedCount: number;
  recoveredCount: number;
  topDiseases: [string, number][];
}

export type SchoolLevelType = 'elementary' | 'secondary' | 'staff';

export const STAFF_DEPARTMENTS = ['유초등', '중등', '행정실'] as const;
export type StaffDepartment = typeof STAFF_DEPARTMENTS[number];

export type DiseaseCategoryType = '감염병' | '단순질병' | '식중독';

export interface DiseaseMeta {
  name: string;
  category: DiseaseCategoryType;
  badgeColor: string;
}

export const CATEGORY_BADGE_STYLES: Record<DiseaseCategoryType, { badge: string; text: string; lightBg: string }> = {
  감염병: {
    badge: 'bg-rose-100 text-rose-800 border-rose-300',
    text: 'text-rose-700',
    lightBg: 'bg-rose-50',
  },
  식중독: {
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    text: 'text-amber-800',
    lightBg: 'bg-amber-50',
  },
  단순질병: {
    badge: 'bg-sky-100 text-sky-800 border-sky-300',
    text: 'text-sky-700',
    lightBg: 'bg-sky-50',
  },
};

export const COMMON_DISEASES: DiseaseMeta[] = [
  // 1. 감염병 (Rose/Red)
  { name: '독감(인플루엔자)', category: '감염병', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300' },
  { name: '수족구병', category: '감염병', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300' },
  { name: '코로나19', category: '감염병', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300' },
  { name: '수두', category: '감염병', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300' },
  { name: '유행성이하선염(볼거리)', category: '감염병', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300' },
  { name: '유행성결막염', category: '감염병', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300' },
  { name: '홍역', category: '감염병', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300' },

  // 2. 식중독 (Amber/Orange)
  { name: '식중독', category: '식중독', badgeColor: 'bg-amber-100 text-amber-900 border-amber-300' },
  { name: '급성 장염', category: '식중독', badgeColor: 'bg-amber-100 text-amber-900 border-amber-300' },
  { name: '노로바이러스 장염', category: '식중독', badgeColor: 'bg-amber-100 text-amber-900 border-amber-300' },
  { name: '로타바이러스 장염', category: '식중독', badgeColor: 'bg-amber-100 text-amber-900 border-amber-300' },

  // 3. 단순질병 (Sky/Blue)
  { name: '중이염', category: '단순질병', badgeColor: 'bg-sky-100 text-sky-800 border-sky-300' },
  { name: '인후통(편도염)', category: '단순질병', badgeColor: 'bg-sky-100 text-sky-800 border-sky-300' },
  { name: '감기(상기도감염)', category: '단순질병', badgeColor: 'bg-sky-100 text-sky-800 border-sky-300' },
  { name: '발열/몸살', category: '단순질병', badgeColor: 'bg-sky-100 text-sky-800 border-sky-300' },
  { name: '복통/위장염', category: '단순질병', badgeColor: 'bg-sky-100 text-sky-800 border-sky-300' },
  { name: '기관지염/폐렴', category: '단순질병', badgeColor: 'bg-sky-100 text-sky-800 border-sky-300' },
  { name: '두통', category: '단순질병', badgeColor: 'bg-sky-100 text-sky-800 border-sky-300' },
  { name: '알레르기/비염', category: '단순질병', badgeColor: 'bg-sky-100 text-sky-800 border-sky-300' },
  { name: '외상/염좌/골절', category: '단순질병', badgeColor: 'bg-sky-100 text-sky-800 border-sky-300' },
  { name: '치과 질환', category: '단순질병', badgeColor: 'bg-sky-100 text-sky-800 border-sky-300' },
  { name: '피부염/두드러기', category: '단순질병', badgeColor: 'bg-sky-100 text-sky-800 border-sky-300' },
  { name: '사유 미기재(확인필요)', category: '단순질병', badgeColor: 'bg-slate-100 text-slate-700 border-slate-300' },
  { name: '기타 질환', category: '단순질병', badgeColor: 'bg-slate-100 text-slate-700 border-slate-300' },
];

export const SCHOOL_MONTHS = [
  { value: '03', label: '3월' },
  { value: '04', label: '4월' },
  { value: '05', label: '5월' },
  { value: '06', label: '6월' },
  { value: '07', label: '7월' },
  { value: '08', label: '8월' },
  { value: '09', label: '9월' },
  { value: '10', label: '10월' },
  { value: '11', label: '11월' },
  { value: '12', label: '12월' },
  { value: '01', label: '1월' },
  { value: '02', label: '2월' },
];
