import type { OrgStructure } from '@/lib/types';
import type { HandoverReturningInfo, HandoverServiceYearRow } from '@/lib/types/handover';

/**
 * 귀임 교원(올해 학교를 떠나는 교원) 관련 공용 로직.
 * - 귀임 여부: 시스템 설정 > 조직도 > 부서 관리 > 후임 설정에서 체크 (orgStructure.returningTeacherEmails)
 * - 인계서 작성 시 한국 주소·한국 원소속·재직기간 현황(학년도별 1행)을 추가로 기재한다.
 */

const MAX_SERVICE_YEARS = 10;

export function isReturningTeacher(org: Partial<OrgStructure> | null | undefined, email?: string | null): boolean {
  const key = (email || '').trim().toLowerCase();
  if (!key) return false;
  return (org?.returningTeacherEmails || []).some(e => (e || '').trim().toLowerCase() === key);
}

/** 학년도 (3월 시작): 2025-02-28 → 2024, 2025-03-01 → 2025 */
export function toSchoolYear(dateStr?: string | null): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateStr || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  return month >= 3 ? y : y - 1;
}

/** 재직기간에 포함되는 학년도 목록 (시작 학년도 ~ 종료 학년도) */
export function getServiceSchoolYears(startDate?: string, endDate?: string): number[] {
  const s = toSchoolYear(startDate);
  const e = toSchoolYear(endDate);
  if (s === null || e === null || e < s) return [];
  const years: number[] = [];
  for (let y = s; y <= e && years.length < MAX_SERVICE_YEARS; y++) years.push(y);
  return years;
}

export function createEmptyServiceRow(schoolYear: number): HandoverServiceYearRow {
  return { schoolYear, grade: '', homeroom: '', department: '', duty: '', note: '' };
}

/**
 * 재직기간이 바뀌면 학년도별 행을 다시 구성한다. (이미 입력한 학년도의 내용은 유지)
 */
export function rebuildServiceRows(
  startDate: string,
  endDate: string,
  existing: HandoverServiceYearRow[],
  prefill?: { schoolYear: number; department?: string; duty?: string }
): HandoverServiceYearRow[] {
  const years = getServiceSchoolYears(startDate, endDate);
  if (years.length === 0) return existing;
  return years.map(y => {
    const found = existing.find(r => r.schoolYear === y);
    if (found) return found;
    const row = createEmptyServiceRow(y);
    if (prefill && prefill.schoolYear === y) {
      row.department = prefill.department || '';
      row.duty = prefill.duty || '';
    }
    return row;
  });
}

/** 귀임 교원 기본 재직기간: 현재 학년도 종료일(다음 해 2월 말)까지 */
export function defaultServiceEndDate(currentSchoolYear: number): string {
  const y = currentSchoolYear + 1;
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return `${y}-02-${isLeap ? '29' : '28'}`;
}

export function createEmptyReturningInfo(currentSchoolYear: number): HandoverReturningInfo {
  return {
    koreaAddress: '',
    koreaOriginalSchool: '',
    serviceStartDate: '',
    serviceEndDate: defaultServiceEndDate(currentSchoolYear),
    serviceYears: [],
  };
}

/** 제출 전 필수 항목 확인. 누락 시 안내 문구, 정상이면 null */
export function validateReturningInfo(info?: HandoverReturningInfo | null): string | null {
  if (!info) return '귀임 교원 기재 사항(한국 주소, 한국 원소속, 재직기간)을 입력해 주세요.';
  if (!info.koreaAddress.trim()) return '귀임 교원 기재 사항: 한국 주소를 입력해 주세요.';
  if (!info.koreaOriginalSchool.trim()) return '귀임 교원 기재 사항: 한국 원소속(학교명)을 입력해 주세요.';
  if (getServiceSchoolYears(info.serviceStartDate, info.serviceEndDate).length === 0) {
    return '귀임 교원 기재 사항: 재직기간(시작일 ~ 종료일)을 올바르게 입력해 주세요.';
  }
  return null;
}

/** "2022. 3. 1. ~ 2025. 2. 28. (3년)" */
export function formatServicePeriod(info: HandoverReturningInfo): string {
  const fmt = (d: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
    return m ? `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.` : '';
  };
  const years = getServiceSchoolYears(info.serviceStartDate, info.serviceEndDate).length;
  const s = fmt(info.serviceStartDate);
  const e = fmt(info.serviceEndDate);
  if (!s && !e) return '';
  return `${s} ~ ${e}${years ? ` (${years}년)` : ''}`;
}
