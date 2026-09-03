import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface SystemTaskTemplate {
  id: string;
  name: string;
  desc: string;
  columns: string[];
  columnDefs?: { id: string; name: string; guide?: string }[];
  isCustom?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export const BUILTIN_TASK_TEMPLATES: SystemTaskTemplate[] = [
  {
    id: 'sports_scenario',
    name: '[체육/행사] 학년별 세부 운영 시나리오 및 타임테이블 양식',
    desc: '학년별 경기 종목, 세부 규칙, 시간대, 장소 및 안전 유의사항 취합',
    columns: ['학년/반', '프로그램명', '시간대', '진행장소', '담당교사', '준비물', '안전지도대책'],
    isCustom: false
  },
  {
    id: 'budget_supply',
    name: '[예산/물품] 부서 및 학년 소요 교구/기자재 신청 양식',
    desc: '학년/부서별 필요 교구, 수량, 단가, 규격, 소요 예산 취합',
    columns: ['신청부서/학년', '품명/규격', '수량', '예상단가(VND)', '총금액(VND)', '활용목적/비고'],
    isCustom: false
  },
  {
    id: 'afterschool_roster',
    name: '[방과후/동아리] 학생 활동 명단 및 강사 출결 취합 양식',
    desc: '강좌별/부서별 학생 명단, 강의실, 강사 출결 현황 실시간 집계',
    columns: ['강좌명/동아리', '담당교사/강사', '활동장소', '참여학생수', '주요활동내용', '출결특이사항'],
    isCustom: false
  },
  {
    id: 'facility_inspection',
    name: '[시설/환경] 교실 환경구성 및 안전 점검 체크리스트 양식',
    desc: '각 학급 및 특별실 시설 점검 상태, 보수 요청 사항 취합',
    columns: ['점검구역/학급', '점검일자', '시설상태(양호/요보수)', '보수요청내용', '점검자', '조치기한'],
    isCustom: false
  }
];

const COLLECTION_NAME = 'system_task_templates';

export async function getSystemTaskTemplates(): Promise<SystemTaskTemplate[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    if (snap.empty) {
      return BUILTIN_TASK_TEMPLATES;
    }
    const customList = snap.docs.map(d => ({ ...d.data(), id: d.id } as SystemTaskTemplate));
    // 기본 내장 템플릿 중 사용자가 덮어쓰지 않은 항목 병합
    const merged = [...customList];
    for (const builtin of BUILTIN_TASK_TEMPLATES) {
      if (!merged.some(m => m.id === builtin.id)) {
        merged.push(builtin);
      }
    }
    return merged;
  } catch (err) {
    console.error('Error fetching system task templates:', err);
    return BUILTIN_TASK_TEMPLATES;
  }
}

export function onSystemTaskTemplatesUpdate(callback: (templates: SystemTaskTemplate[]) => void) {
  try {
    const colRef = collection(db, COLLECTION_NAME);
    return onSnapshot(colRef, (snap) => {
      const customList = snap.docs.map(d => ({ ...d.data(), id: d.id } as SystemTaskTemplate));
      const merged = [...customList];
      for (const builtin of BUILTIN_TASK_TEMPLATES) {
        if (!merged.some(m => m.id === builtin.id)) {
          merged.push(builtin);
        }
      }
      callback(merged);
    }, (err) => {
      console.warn('[taskTemplateService] onSnapshot fallback to builtin:', err.message);
      callback(BUILTIN_TASK_TEMPLATES);
    });
  } catch (err: any) {
    console.warn('[taskTemplateService] onSystemTaskTemplatesUpdate catch:', err?.message);
    callback(BUILTIN_TASK_TEMPLATES);
    return () => {};
  }
}

export async function saveSystemTaskTemplate(template: SystemTaskTemplate): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, template.id);
  await setDoc(docRef, {
    ...template,
    isCustom: true,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function deleteSystemTaskTemplate(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}
