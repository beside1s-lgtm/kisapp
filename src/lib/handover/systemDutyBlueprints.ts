import type { GoogleDriveConfig, OrgStructure } from '@/lib/types';
import type { CustomDutyWorkspace } from '@/lib/types/customDuty';
import type {
  HandoverDutyTimelineTemplate,
  HandoverItem,
  HandoverTimingKind,
} from '@/lib/types/handover';
import {
  getNormalizedTaskCompareKey,
  resolveDriveFolderForDuty,
} from '@/lib/drive/deptFolderMapping';

export type SystemDutyKey =
  | 'bus'
  | 'safety'
  | 'volunteer'
  | 'afterschool'
  | 'pe'
  | 'health'
  | 'student'
  | 'duty'
  | 'handover'
  | 'system';

export interface SystemDutyTaskBlueprint {
  key: string;
  dutyKey: SystemDutyKey | string;
  canonicalDutyName: string;
  documentTitle: string;
  category: string;
  period: string;
  scheduleLabel: string;
  timingKind: HandoverTimingKind;
  sortOrder: number;
  summary: string;
  /**
   * 동일한 학사 업무에 대해 교직원이 전자결재 기안문을 직접 작성·완료한 경우
   * 타임라인 중복 등록을 피하기 위해 시스템 자동 항목을 억제하는 키워드 목록
   */
  suppressIfApprovalMatches?: string[];
  /** true이면 기안문 작성 시기(1학기 vs 2학기)가 일치할 때만 억제 */
  suppressIfPeriodMatches?: boolean;
  /** 사용자가 수정·추가하여 업무 표준 타임라인으로 저장된 항목 여부 */
  isLearnedTemplateItem?: boolean;
  /** 사용자 추가 학습 템플릿 항목 ID (현재 초안 중복 생성 방지용) */
  learnedAddedItemId?: string;
  /** 사용자 지정 폴더/문서 링크 */
  folderUrlOverride?: string;
}

/**
 * 학년 말 인수인계 타임라인의 표준 학사 시기 순서
 * (3월 신학기 → 1학기 → 1학기 말 → 여름방학 → 2학기 → 1월 학년말 → 1~2월 겨울방학 → 정기 → 미정기)
 */
export const HANDOVER_PERIOD_OPTIONS = [
  '3월 (신학기)',
  '1학기 (4~6월)',
  '1학기 말',
  '여름방학 (7~8월)',
  '2학기 (9~11월)',
  '학년말 (1월)',
  '겨울방학 (1~2월)',
  '정기 업무',
  '수시 / 미정기',
  '연간 상시',
] as const;

export const HANDOVER_MANUAL_PERIOD_OPTIONS = [
  '3월 (신학기)',
  '1학기 (4~6월)',
  '1학기 말',
  '여름방학 (7~8월)',
  '2학기 (9~11월)',
  '학년말 (1월)',
  '겨울방학 (1~2월)',
  '정기 업무',
  '수시 / 미정기',
] as const;

export const PERIOD_SORT_RANK: Record<string, number> = {
  '3월 (신학기)': 1,
  '1학기 (4~6월)': 2,
  '1학기 말': 3,
  '여름방학 (7~8월)': 4,
  '2학기 (9~11월)': 5,
  '학년말 (1월)': 6,
  '겨울방학 (1~2월)': 7,
  '정기 업무': 8,
  '연간 상시': 9,
  '수시 / 미정기': 10,
};

/**
 * 구버전 문서/템플릿의 시기 라벨('겨울방학 (12~1월)', '학년말 (2월)')을 현재 표준 라벨로 정규화한다.
 */
export function normalizeHandoverPeriodLabel(period?: string): string {
  const clean = (period || '').trim();
  if (clean === '겨울방학 (12~1월)') return '겨울방학 (1~2월)';
  if (clean === '학년말 (2월)') return '학년말 (1월)';
  return clean;
}

export const TIMING_KIND_LABELS: Record<HandoverTimingKind, string> = {
  month: '특정 월',
  semester: '학기',
  vacation: '방학',
  regular: '정기',
  irregular: '미정기',
};

const TIMING_KIND_BADGE_CLASS: Record<HandoverTimingKind, string> = {
  month: 'bg-sky-50 text-sky-700 border-sky-200',
  semester: 'bg-violet-50 text-violet-700 border-violet-200',
  vacation: 'bg-amber-50 text-amber-800 border-amber-200',
  regular: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  irregular: 'bg-slate-100 text-slate-700 border-slate-300',
};

/**
 * 타임라인 카드 UI(HandoverEditor / HandoverPopupModal / HandoverViewer)에서 공용으로 사용하는
 * 배지 텍스트·색상 및 일자/처리 시기 문구 계산 헬퍼
 */
export function getHandoverItemTimingMeta(item: HandoverItem): {
  isSystemAuto: boolean;
  timingBadgeText: string;
  timingBadgeClass: string;
  dateOrScheduleText: string;
} {
  if (item.sourceType === 'system_auto') {
    const kind = item.timingKind || 'regular';
    const timingBadgeText = item.customTemplateItemId
      ? '고정 · 사용자 추가'
      : item.isLearnedTemplateItem
        ? `수정 반영 · ${TIMING_KIND_LABELS[kind] || '정기'}`
        : `고정 · ${TIMING_KIND_LABELS[kind] || '정기'}`;
    return {
      isSystemAuto: true,
      timingBadgeText,
      timingBadgeClass: TIMING_KIND_BADGE_CLASS[kind] || TIMING_KIND_BADGE_CLASS.regular,
      dateOrScheduleText: `처리 시기: ${item.scheduleLabel || item.period || '정기'}`,
    };
  }

  if (item.displayDateTime || item.sourceType === 'department_task') {
    return {
      isSystemAuto: false,
      timingBadgeText: '',
      timingBadgeClass: '',
      dateOrScheduleText: `일시: ${item.displayDateTime || item.date}`,
    };
  }

  return {
    isSystemAuto: false,
    timingBadgeText: '',
    timingBadgeClass: '',
    dateOrScheduleText: item.date ? `생성일: ${item.date}` : `처리 시기: ${item.scheduleLabel || item.period || ''}`,
  };
}

/**
 * 시기 문자열의 학년도 순서 순위 반환
 */
export function getHandoverPeriodRank(period?: string): number {
  const normalized = normalizeHandoverPeriodLabel(period);
  if (normalized && normalized in PERIOD_SORT_RANK) {
    return PERIOD_SORT_RANK[normalized];
  }
  return 99;
}

/**
 * 학년도(3월~익년 2월) 기준 세부 순서를 계산한다.
 * - 날짜(YYYY-MM-DD)가 있으면 3~12월은 301~1231, 1~2월은 1301~1429로 환산
 * - 날짜가 없는 시스템 고정 업무는 sortOrder를 그대로 사용
 */
export function getHandoverChronoSortKey(
  item: { date?: string; sortOrder?: number }
): number {
  const dateStr = (item.date || '').trim();
  if (dateStr.length >= 10) {
    const month = parseInt(dateStr.slice(5, 7), 10);
    const day = parseInt(dateStr.slice(8, 10), 10);
    if (!Number.isNaN(month) && !Number.isNaN(day) && month >= 1 && month <= 12) {
      const adjustedMonth = month <= 2 ? month + 12 : month;
      return adjustedMonth * 100 + day;
    }
  }
  if (typeof item.sortOrder === 'number' && !Number.isNaN(item.sortOrder)) {
    return item.sortOrder;
  }
  return 99999;
}

/**
 * KIS 시스템에 업무 기능·절차가 고정된 직책별 연간 타임라인 청사진(SSOT).
 * ※ 전자결재 기안문(/new?busTemplate=true, /new?safetyTemplate=true, /new?afterschoolMode=...,
 *    /new?peTemplate=true, 봉사활동 일괄 기안 등)으로 이미 처리·연동되는 문서들은
 *    기안문과 중복되지 않도록 제외하고, 포털 내 직접 수행하는 고정 운영 업무만 정의한다.
 */
export const SYSTEM_DUTY_BLUEPRINTS: SystemDutyTaskBlueprint[] = [
  // ── 1. 스쿨버스 운영 관리 (/admin/bus) ───────────────────────────────
  // ※ 스쿨버스 공문서 3종(등하교 차량 지도 계획, 차장 봉사 인정, 등교지도 수당 근거)은 기안문으로 연동되므로 제외
  {
    key: 'bus:sem_start_setup',
    dutyKey: 'bus',
    canonicalDutyName: '스쿨버스 운영 관리',
    documentTitle: '신학기 스쿨버스 차량·정류장·노선 편성 및 교사·학생 탑승 좌석 일괄 배정',
    category: '스쿨버스',
    period: '3월 (신학기)',
    scheduleLabel: '3월 (신학기 개학 전·초)',
    timingKind: 'month',
    sortOrder: 301,
    summary: '[버스 등록]·[버스 설정]·[교사 관리]·[탑승 학생 관리] 탭에서 호차별 차량·정류장·요일 노선, 등하교/교문 등교지도 순환 배정표 및 학생 좌석을 편성합니다.',
  },
  {
    key: 'bus:summer_vacation_mode',
    dutyKey: 'bus',
    canonicalDutyName: '스쿨버스 운영 관리',
    documentTitle: '여름방학 스쿨버스 운행 모드(방학 중) 전환 및 방학 차량·노선·좌석 재편성',
    category: '스쿨버스',
    period: '여름방학 (7~8월)',
    scheduleLabel: '여름방학 (7~8월 시작·종료 시)',
    timingKind: 'vacation',
    sortOrder: 718,
    summary: '상단 [뷰 모드/적용 모드]를 방학 중으로 전환하여 방학 전용 노선·지도교사·탑승 학생을 운영하고, 2학기 개학 전 학기 중 모드로 복원합니다.',
  },
  {
    key: 'bus:winter_vacation_mode',
    dutyKey: 'bus',
    canonicalDutyName: '스쿨버스 운영 관리',
    documentTitle: '겨울방학 스쿨버스 운행 모드(방학 중) 전환 및 방학 차량·노선·좌석 재편성',
    category: '스쿨버스',
    period: '겨울방학 (1~2월)',
    scheduleLabel: '겨울방학 (1~2월 시작·종료 시)',
    timingKind: 'vacation',
    sortOrder: 1350,
    summary: '종업식 이후 [적용 모드]를 방학 중으로 전환해 겨울방학 전용 차량·노선·좌석을 운영하고 새 학년도 개학 전 학기 중 모드로 복귀합니다.',
  },
  {
    key: 'bus:daily_boarding_and_alerts',
    dutyKey: 'bus',
    canonicalDutyName: '스쿨버스 운영 관리',
    documentTitle: '일일 스쿨버스 미탑승("오늘 안 탐") 연동 확인 및 승하차·휴일 푸시 알림 운영',
    category: '스쿨버스',
    period: '정기 업무',
    scheduleLabel: '정기 (매일 등·하교 운행일)',
    timingKind: 'regular',
    sortOrder: 9105,
    summary: '결석계·체험학습 미탑승 자동 반영 여부 확인, 차량 출발 상태 모니터링 및 [알림 관리] 탭에서 휴업일·방학 푸시 발송을 제어합니다.',
  },
  {
    key: 'bus:afterschool_route_transfer',
    dutyKey: 'bus',
    canonicalDutyName: '스쿨버스 운영 관리',
    documentTitle: '방과후 개강·종강에 따른 방과후 하교 노선 이동 및 정규 하교 복귀 처리',
    category: '스쿨버스',
    period: '정기 업무',
    scheduleLabel: '정기 (1·2학기 방과후 개강·종강 시)',
    timingKind: 'semester',
    sortOrder: 9125,
    summary: '방과후 수강 확정 시 [방과후 하교 버스 조회]에서 배정 확인 후 상단 [방과후 노선으로 이동]을 실행하고, 종강 시 [하교 노선으로 복귀]로 원복합니다.',
  },
  {
    key: 'bus:quarterly_fare_billing',
    dutyKey: 'bus',
    canonicalDutyName: '스쿨버스 운영 관리',
    documentTitle: '분기별 스쿨버스 요금 산정(학년 제외일수·할인 반영) 및 학부모 청구서 일괄 발송',
    category: '스쿨버스',
    period: '정기 업무',
    scheduleLabel: '정기 (매 분기 · 1~4분기 개시 시)',
    timingKind: 'regular',
    sortOrder: 9145,
    summary: '[요금 관리] 탭에서 1~4분기 기간·학년별 제외일수(수학여행 등)·형제 할인·3명 이하 가산금을 반영해 청구서를 발송하고 엑셀 정산합니다.',
  },
  {
    key: 'bus:zalo_and_contact_setup',
    dutyKey: 'bus',
    canonicalDutyName: '스쿨버스 운영 관리',
    documentTitle: '버스별 ZALO 단체방 링크 일괄 등록 및 학부모 앱 담당자 전화번호·전체 공지 설정',
    category: '스쿨버스',
    period: '3월 (신학기)',
    scheduleLabel: '3월 (신학기 · 호차 편성 직후)',
    timingKind: 'month',
    sortOrder: 302,
    summary: '[시스템 관리자 설정] > [ZALO 관리]에서 양식(버스 번호·ZALO LINK)을 업로드해 호차별 단체방을 매칭하고, [일반 설정]에서 학부모 앱 담당자 전화번호와 긴급 공지 발송 기능을 점검합니다.',
  },
  {
    key: 'bus:year_end_backup',
    dutyKey: 'bus',
    canonicalDutyName: '스쿨버스 운영 관리',
    documentTitle: '학년말 스쿨버스 전체 데이터(버스·학생·노선) 백업 파일 보관 및 신학기 개편 전 복구 가능 상태 확보',
    category: '스쿨버스',
    period: '학년말 (1월)',
    scheduleLabel: '1월 (학년말 · 종업식 및 개편 전)',
    timingKind: 'month',
    sortOrder: 1312,
    summary: '[시스템 관리자 설정] > [백업 & 복구]에서 백업(JSON)을 내려받아 보관합니다. 복원은 현재 데이터를 모두 덮어쓰므로 신학기 편성 착수 전에 반드시 최신 백업을 확보합니다.',
  },
  {
    key: 'bus:irregular_applications',
    dutyKey: 'bus',
    canonicalDutyName: '스쿨버스 운영 관리',
    documentTitle: '학부모 스쿨버스 신청 창구 개폐 및 신규·노선 변경·미배정 학생 수시 좌석 배정',
    category: '스쿨버스',
    period: '수시 / 미정기',
    scheduleLabel: '미정기 (신규·변경·전입 발생 시)',
    timingKind: 'irregular',
    sortOrder: 9210,
    summary: '상단 [학부모 신청] 진행/마감 토글을 관리하고 [새 신청/변경 도착] 건 및 미배정 학생의 등·하교·토요 좌석을 수시 배정·조정합니다.',
  },

  // ── 2. 학생 안전지도 관리 (/teacher/safety) ──────────────────────────
  // ※ 연간 학생 안전교육 운영 계획 수립, 재난(지진·화재) 대피 훈련 계획은 기안문(/new?safetyTemplate=true)으로 연동되므로 제외
  {
    key: 'safety:facility_teacher_setup',
    dutyKey: 'safety',
    canonicalDutyName: '학생 안전지도 관리',
    documentTitle: '교내 안전점검 대상 시설물 목록 정비 및 시설별 점검 담당 교사 매칭',
    category: '학생안전',
    period: '3월 (신학기)',
    scheduleLabel: '3월 (신학기 시설·담임 배정 시)',
    timingKind: 'month',
    sortOrder: 305,
    summary: '[안전점검의 날] > [학교 시설 및 담당 교사 관리]에서 일반교실·특별실·공용시설별 점검 담당 교사를 신학기 조직도에 맞춰 현행화합니다.',
  },
  {
    key: 'safety:template_refresh',
    dutyKey: 'safety',
    canonicalDutyName: '학생 안전지도 관리',
    documentTitle: '학년도 안전교육 운영 계획 및 재난(지진·화재) 대피 훈련 실시 계획 기본 서식 현행화',
    category: '학생안전',
    period: '3월 (신학기)',
    scheduleLabel: '3월 (기안 작성 전 · 신학기)',
    timingKind: 'month',
    sortOrder: 307,
    summary: '[학생 안전교육] 탭의 [연간 운영 계획 기본 서식]·[재난 대피 훈련 실시 계획 기본 서식]을 새 학년도 일정·담당부서에 맞게 수정한 뒤 기안문(안전지도 템플릿)으로 상신합니다.',
  },
  {
    key: 'safety:sem1_violence_prevention',
    dutyKey: 'safety',
    canonicalDutyName: '학생 안전지도 관리',
    documentTitle: '1학기 학교폭력 예방교육(어울림 프로그램) 및 예방 캠페인 운영',
    category: '학생안전',
    period: '1학기 (4~6월)',
    scheduleLabel: '1학기 (4~6월)',
    timingKind: 'semester',
    sortOrder: 415,
    summary: '[학교폭력예방교육] 업무에 따라 1학기 어울림 프로그램 및 학교폭력 예방 캠페인을 추진·점검합니다.',
    suppressIfApprovalMatches: ['학교폭력', '학폭 예방', '학폭예방', '어울림'],
    suppressIfPeriodMatches: true,
  },
  {
    key: 'safety:sem2_violence_prevention',
    dutyKey: 'safety',
    canonicalDutyName: '학생 안전지도 관리',
    documentTitle: '2학기 학교폭력 예방교육(어울림 프로그램) 및 예방 캠페인 운영',
    category: '학생안전',
    period: '2학기 (9~11월)',
    scheduleLabel: '2학기 (9~11월)',
    timingKind: 'semester',
    sortOrder: 915,
    summary: '[학교폭력예방교육] 업무에 따라 2학기 어울림 프로그램 및 예방교육 실적을 관리합니다.',
    suppressIfApprovalMatches: ['학교폭력', '학폭 예방', '학폭예방', '어울림'],
    suppressIfPeriodMatches: true,
  },
  {
    key: 'safety:monthly_4th_inspection',
    dutyKey: 'safety',
    canonicalDutyName: '학생 안전지도 관리',
    documentTitle: '매월 4일 정기 안전점검표 취합, 미점검 교사 독려·완료 및 Google Drive PDF 저장',
    category: '학생안전',
    period: '정기 업무',
    scheduleLabel: '정기 (매월 4일 안전점검의 날)',
    timingKind: 'regular',
    sortOrder: 9120,
    summary: '[안전점검의 날] 탭에서 전 교원 월별 점검 현황 확인, [전원 독려]·[대리 점검]·[일괄 점검 완료] 처리, 시설관리팀(520) 보수 요청 확인 후 [Google Drive에 저장]을 실행합니다.',
  },

  // ── 3. 학생 봉사활동 (/volunteer) ────────────────────────────────────
  // ※ 계획서 일괄 수합 기안문([학생 봉사활동 계획서 일괄 기안])은 전자결재(addToHandover)로 연동되므로 제외
  {
    key: 'volunteer:year_end_closing',
    dutyKey: 'volunteer',
    canonicalDutyName: '봉사활동 총괄 관리',
    documentTitle: '연간 학생 봉사활동 확인서 제출 마감(12/31) 및 관리대장(CSV) 추출·생기부 반영 점검',
    category: '봉사활동',
    period: '학년말 (1월)',
    scheduleLabel: '12월 말~1월 (연간 실적 마감 · 12/31)',
    timingKind: 'month',
    sortOrder: 1304,
    summary: '[봉사활동 관리대장] 탭에서 승인된 개인·단체 봉사 건의 확인서 완료 여부를 최종 점검하고 [엑셀(CSV) 다운로드]로 연간 실적을 취합합니다.',
  },
  {
    key: 'volunteer:plan_review_and_reject',
    dutyKey: 'volunteer',
    canonicalDutyName: '봉사활동 총괄 관리',
    documentTitle: '학부모·교사 봉사활동 사전 계획서(실시 7일 전) 접수 검토 및 미비건 반려 처리',
    category: '봉사활동',
    period: '수시 / 미정기',
    scheduleLabel: '미정기 (사전 계획서 접수 시 수시)',
    timingKind: 'irregular',
    sortOrder: 9215,
    summary: '[계획서 수합·기안] 탭에서 학부모 개인·교사 단체(서식3) 신청 건의 7일 전 제출 기한 및 봉사기관 적합성을 검토하고 미비건은 반려 처리합니다.',
  },
  {
    key: 'volunteer:report_and_registry_check',
    dutyKey: 'volunteer',
    canonicalDutyName: '봉사활동 총괄 관리',
    documentTitle: '봉사활동 사후 확인서(활동사진·기관 확인) 제출 확인 및 전교 관리대장 상시 관리',
    category: '봉사활동',
    period: '수시 / 미정기',
    scheduleLabel: '미정기 (활동 완료·확인서 제출 시)',
    timingKind: 'irregular',
    sortOrder: 9230,
    summary: '승인 완료 건의 사후 확인서(서식4)·증빙 사진·인정시간 일치 여부를 [봉사활동 관리대장]에서 수시 확인하고 A4 출력을 지원합니다.',
  },

  // ── 4. 방과후학교 총괄 관리 (/admin/afterschool) ─────────────────────
  // ※ 방과후학교 운영 계획 기안(/new?afterschoolMode=plan) 및 운영 결과·수당 청구 기안(/new?afterschoolMode=result)은 기안문으로 연동되므로 제외
  {
    key: 'afterschool:classroom_and_policy_setup',
    dutyKey: 'afterschool',
    canonicalDutyName: '방과후학교 총괄 관리',
    documentTitle: '방과후학교 교실·수업시간 기준, 수강료/강사료 단가 및 강좌 개설 권한 설정',
    category: '방과후학교',
    period: '3월 (신학기)',
    scheduleLabel: '3월 (연간 개시 · 매 기수 모집 전)',
    timingKind: 'month',
    sortOrder: 304,
    summary: '[교실 관리] 및 [실시간 제어실] > [강좌 개설 설정]에서 교실 배정 한도, 수강료·강사료 단가, 학습준비물 예산 및 학사일정 기준을 설정합니다.',
  },
  {
    key: 'afterschool:term_opening_enrollment',
    dutyKey: 'afterschool',
    canonicalDutyName: '방과후학교 총괄 관리',
    documentTitle: '기수별 방과후 강좌 승인(일괄 개설), 선착순 수강신청 운영 및 결과 확정(CONFIRMED)',
    category: '방과후학교',
    period: '정기 업무',
    scheduleLabel: '정기 (1·2학기 및 여름·겨울방학 매 기수 개강 전)',
    timingKind: 'semester',
    sortOrder: 9130,
    summary: '운영 단계를 [강사 모집 ➔ 수강 신청 ➔ 신청 완료]로 전환하며 개설 강좌 승인/폐강 및 대기 편성을 처리하고, 학부모 결과 통보 및 스쿨버스 2중 배정을 확정합니다.',
  },
  {
    key: 'afterschool:tuition_billing_and_refund',
    dutyKey: 'afterschool',
    canonicalDutyName: '방과후학교 총괄 관리',
    documentTitle: '수강 확정생 방과후 수강료·토요버스비 청구서 발송 및 수강 취소·환불 정산',
    category: '방과후학교',
    period: '정기 업무',
    scheduleLabel: '정기 (매 기수 개강 전후)',
    timingKind: 'semester',
    sortOrder: 9135,
    summary: '유료·무료 강좌 구분 및 토요 스쿨버스 요금을 합산해 학부모 청구서를 발행·엑셀 출력하고 중도 취소/환불 시 스쿨버스 정규 복귀를 확인합니다.',
  },
  {
    key: 'afterschool:operating_monitoring',
    dutyKey: 'afterschool',
    canonicalDutyName: '방과후학교 총괄 관리',
    documentTitle: '방과후 운영 중 출석부·강사출근부 점검, 미제출 독촉 및 보결·준비물·지출증빙 승인',
    category: '방과후학교',
    period: '정기 업무',
    scheduleLabel: '정기 (매 기수 운영 기간 중)',
    timingKind: 'regular',
    sortOrder: 9140,
    summary: '[운영 중(OPERATING)] 단계에서 [서류 검토/독촉 알림] 발송, 강사 보결/결근 대리 등록 및 [학습준비물 & 지출증빙] 승인 처리를 수행합니다.',
  },
  {
    key: 'afterschool:term_closing_purge',
    dutyKey: 'afterschool',
    canonicalDutyName: '방과후학교 총괄 관리',
    documentTitle: '기수별 방과후 운영 최종 마감(CLOSED) — 스쿨버스 정규 복귀 및 운영 데이터 정리',
    category: '방과후학교',
    period: '정기 업무',
    scheduleLabel: '정기 (매 기수 · 학기/방학 종강 시)',
    timingKind: 'semester',
    sortOrder: 9150,
    summary: '모든 출석·정산·결과보고 완료 후 단계를 [운영 종료(CLOSED)]로 전환하여 방과후 탑승 학생의 정규 하교 복귀 및 운영 데이터를 초기화합니다.',
  },

  // ── 5. 학교 체육/PAPS 관리 (/teacher/pe) ─────────────────────────────
  // ※ 체육행사 세부 운영 계획 기안문(/new?peTemplate=true)은 기안문으로 연동되므로 제외
  {
    key: 'pe:period_and_items_setup',
    dutyKey: 'pe',
    canonicalDutyName: '학교 체육/PAPS 관리',
    documentTitle: 'PAPS 측정 주간·종목 활성화 및 종합 평가(잘함·보통·노력요함) 기준 설정',
    category: '학교체육',
    period: '3월 (신학기)',
    scheduleLabel: '3월 (신학기 · 측정 주간 개시 전)',
    timingKind: 'month',
    sortOrder: 310,
    summary: '[종목 관리] > [측정 주간 & 종목 설정]에서 측정 기간, 대상 종목 및 점수 합산 등급 기준을 설정합니다.',
  },
  {
    key: 'pe:sem1_paps_measurement',
    dutyKey: 'pe',
    canonicalDutyName: '학교 체육/PAPS 관리',
    documentTitle: '1학기 PAPS 신체능력 측정 기록 입력 및 학급별 성장 분석 진행',
    category: '학교체육',
    period: '1학기 (4~6월)',
    scheduleLabel: '1학기 (4~6월)',
    timingKind: 'semester',
    sortOrder: 510,
    summary: '[측정 & 분석] > [기록 입력]·[성장 분석]에서 1학기 PAPS(왕복오래달리기·유연성·근력·BMI 등) 측정 기록을 입력하고 분석합니다.',
    suppressIfApprovalMatches: ['PAPS', '체력평가', '건강체력'],
    suppressIfPeriodMatches: true,
  },
  {
    key: 'pe:sem2_paps_and_report',
    dutyKey: 'pe',
    canonicalDutyName: '학교 체육/PAPS 관리',
    documentTitle: '2학기 PAPS 최종 측정 및 학생 체육 성장 리포트(A4) 출력·배부',
    category: '학교체육',
    period: '2학기 (9~11월)',
    scheduleLabel: '2학기 (9~11월)',
    timingKind: 'semester',
    sortOrder: 1015,
    summary: '[측정 & 분석]에서 2학기 PAPS 기록 입력을 완료하고 학생별 A4 체육 성장 리포트(5대 요인 레이더 차트)를 출력·배부합니다.',
    suppressIfApprovalMatches: ['PAPS', '체력평가', '건강체력'],
    suppressIfPeriodMatches: true,
  },
  {
    key: 'pe:sports_club_and_tournament',
    dutyKey: 'pe',
    canonicalDutyName: '학교 체육/PAPS 관리',
    documentTitle: '학교 스포츠클럽 편성·운영 및 교내 리그·토너먼트 대진 관리',
    category: '학교체육',
    period: '정기 업무',
    scheduleLabel: '정기 (1·2학기 학기 중)',
    timingKind: 'regular',
    sortOrder: 9132,
    summary: '[체육행사 & 대회] > [스포츠클럽]·[토너먼트/리그]·[팀 밸런서]를 활용해 학기 중 교내 체육 활동 및 대회를 운영합니다.',
  },
  {
    key: 'pe:event_planning_and_requests',
    dutyKey: 'pe',
    canonicalDutyName: '학교 체육/PAPS 관리',
    documentTitle: '체육행사 기획·일정 등록, 담당 교사 업무 요청 및 제출 현황 취합·건의 검토',
    category: '학교체육',
    period: '정기 업무',
    scheduleLabel: '정기 (행사 기획 · 학기 중 수시 진행)',
    timingKind: 'semester',
    sortOrder: 9133,
    summary: '[체육행사 & 대회] > [체육행사 기획 & 일정]에서 행사를 등록하고 교사별 업무 요청을 발송해 제출 현황을 확인하며, 교사 건의사항을 검토합니다. 세부 운영 계획은 체육 기안문으로 상신합니다.',
  },
  {
    key: 'pe:theory_exam_ai',
    dutyKey: 'pe',
    canonicalDutyName: '학교 체육/PAPS 관리',
    documentTitle: '체육 이론 평가 AI 문항 출제 및 평가 배포 관리',
    category: '학교체육',
    period: '수시 / 미정기',
    scheduleLabel: '미정기 (이론 평가 실시 시)',
    timingKind: 'irregular',
    sortOrder: 9240,
    summary: '[이론 평가] > [AI 문제 출제 및 배포]에서 영역별 체육 이론 평가 문항을 출제하고 학급에 배포합니다.',
  },

  // ── 6. 학생 건강/보건실 관리 (/teacher/health) ───────────────────────
  {
    key: 'health:school_config_and_institutions',
    dutyKey: 'health',
    canonicalDutyName: '학생 건강/보건실 관리',
    documentTitle: '학교 건강기록부 표기 기준 및 지정 검진기관(일반·구강검진) 설정',
    category: '보건/건강',
    period: '3월 (신학기)',
    scheduleLabel: '3월 (신학기 개시 전)',
    timingKind: 'month',
    sortOrder: 308,
    summary: '[학생 건강기록부 관리] 설정에서 지정 검진기관, 혈액형·보호자 표기 옵션 정비 및 신입·전입생 기초 명단을 확인합니다.',
  },
  {
    key: 'health:exam_bulk_upload_and_sync',
    dutyKey: 'health',
    canonicalDutyName: '학생 건강/보건실 관리',
    documentTitle: '학생 건강검진·구강검진·예방접종 결과 일괄 등록 및 PAPS 신체발달 연동 점검',
    category: '보건/건강',
    period: '1학기 (4~6월)',
    scheduleLabel: '1학기 · 연중 (검진 완료 후)',
    timingKind: 'semester',
    sortOrder: 615,
    summary: '[학생 건강기록부 관리]에서 건강검진 결과 엑셀 일괄 업로드 및 예방접종 이력·건강기록부 통지표 출력을 관리합니다.',
    suppressIfApprovalMatches: ['건강검진', '구강검진', '건강검사'],
  },
  {
    key: 'health:monthly_disease_surveillance',
    dutyKey: 'health',
    canonicalDutyName: '학생 건강/보건실 관리',
    documentTitle: '초·중등·교직원 감염병 및 질병 현황 월별 모니터링, 격리 추적 및 대장 정리',
    category: '보건/건강',
    period: '정기 업무',
    scheduleLabel: '정기 (매월 · 연간 상시)',
    timingKind: 'regular',
    sortOrder: 9115,
    summary: '[감염병 및 질병현황] 탭에서 결석계 병결·출석부·교직원 건강신고·진단서/소견서 제출 여부를 월별 집계하고 인쇄·엑셀로 관리합니다.',
  },
  {
    key: 'health:annual_record_archive',
    dutyKey: 'health',
    canonicalDutyName: '학생 건강/보건실 관리',
    documentTitle: '학년말 전교생 건강기록부·연간 감염병 발생 대장(3월~익년 2월) 최종 정비',
    category: '보건/건강',
    period: '학년말 (1월)',
    scheduleLabel: '1월 (학년말 마감)',
    timingKind: 'month',
    sortOrder: 1310,
    summary: '진급·졸업 대상자 학생 건강기록부 출력물을 최종 확인하고 연간 질병 현황 총괄 대장을 마감합니다.',
  },

  // ── 7. 학생출결 및 학적 총괄 관리 (/admin/students, 출결/체험 대장) ───
  {
    key: 'student:new_year_promotion',
    dutyKey: 'student',
    canonicalDutyName: '학생출결 및 학적 총괄 관리',
    documentTitle: '새 학년도 전교생 진급 일괄 처리, 졸업생 구분 및 신입생 마스터 계정·사진 일괄 등록',
    category: '출결관리',
    period: '학년말 (1월)',
    scheduleLabel: '1월 (학년말 · 개학 전 준비)',
    timingKind: 'month',
    sortOrder: 1306,
    summary: '[학생 계정 관리]에서 [진급 처리](전교생 +1 진급·반배정 엑셀 업로드) 및 신입생 엑셀 일괄 등록·학급별 사진 스마트 매핑을 실행합니다.',
  },
  {
    key: 'student:fieldtrip_block_calendar',
    dutyKey: 'student',
    canonicalDutyName: '학생출결 및 학적 총괄 관리',
    documentTitle: '학년도별 교외체험학습 신청 불가(불인정) 기간 설정 및 연간 출결 기준 관리',
    category: '출결관리',
    period: '3월 (신학기)',
    scheduleLabel: '3월 (신학기 개학 시)',
    timingKind: 'month',
    sortOrder: 306,
    summary: '시스템 설정 > [학사 일정 관리]의 체험학습 불인정 기간을 설정하고 연간 체험학습·결석계 기준 일수를 점검합니다.',
  },
  {
    key: 'student:monthly_attendance_and_drive_archive',
    dutyKey: 'student',
    canonicalDutyName: '학생출결 및 학적 총괄 관리',
    documentTitle: '월별 결석계 보관함·체험학습 문서함 완결 서류 확인 및 Google Drive 아카이빙 점검',
    category: '출결관리',
    period: '정기 업무',
    scheduleLabel: '정기 (매월 말)',
    timingKind: 'regular',
    sortOrder: 9128,
    summary: '[결석계 보관함]·[체험학습 문서함]에서 미제출 결과보고서·증빙서류 확인, 일괄 인쇄 및 Google Drive 폴더 보관 상태를 점검합니다.',
  },
  {
    key: 'student:irregular_transfer_students',
    dutyKey: 'student',
    canonicalDutyName: '학생출결 및 학적 총괄 관리',
    documentTitle: '전입생·전출생 마스터 DB 등록/정리, 형제·자매 연동 및 학부모 PIN 수시 관리',
    category: '출결관리',
    period: '수시 / 미정기',
    scheduleLabel: '미정기 (전입·전출 발생 시)',
    timingKind: 'irregular',
    sortOrder: 9220,
    summary: '[학생 계정 관리]에서 전입생 개별 계정·사진 등록, 형제·자매 묶음(스쿨버스 할인 연동) 및 전출생 휴지통 정리를 처리합니다.',
  },

  // ── 8. 교원 복무/근태 관리 (/teacher/registry, duty, overtime) ───────
  {
    key: 'duty:annual_quota_and_delegation',
    dutyKey: 'duty',
    canonicalDutyName: '교원 복무/근태 관리',
    documentTitle: '신학기 교원 연가 한도·전결규정 및 복무/초과근무 결재선 기준 확인',
    category: '교무기획',
    period: '3월 (신학기)',
    scheduleLabel: '3월 (신학기 개시 시)',
    timingKind: 'month',
    sortOrder: 312,
    summary: '교원 복무(연가·출장·41조 연수)·초과근무·보강 대결 신청의 전결규정 및 결재선을 점검합니다.',
  },
  {
    key: 'duty:monthly_registry_export',
    dutyKey: 'duty',
    canonicalDutyName: '교원 복무/근태 관리',
    documentTitle: '월별 교원 복무(휴가·출장·41조연수)·초과근무 내역 대장 점검 및 엑셀 다운로드',
    category: '교무기획',
    period: '정기 업무',
    scheduleLabel: '정기 (매월 말 복무·급여 마감 시)',
    timingKind: 'regular',
    sortOrder: 9138,
    summary: '[교원 복무 내역 대장]에서 구분·기간별 복무 및 초과근무 승인 실적을 필터 조회하고 엑셀 정산 파일을 추출합니다.',
  },

  // ── 9. 학년 말 인수인계 총괄 관리 (/teacher/handover?tab=admin) ──────
  {
    key: 'handover:notice_and_faculty_tracking',
    dutyKey: 'handover',
    canonicalDutyName: '학년 말 인수인계 총괄 관리',
    documentTitle: '전 교원 학년 말 인수인계 작성 요청 공지 팝업 발송 및 제출·미제출·반려 현황 독려',
    category: '교무기획',
    period: '학년말 (1월)',
    scheduleLabel: '1월 (학년말 인수인계 기간)',
    timingKind: 'month',
    sortOrder: 1302,
    summary: '[교무부장 총괄 관리] 탭에서 [인수인계 작성 요청 팝업 발송] 실행 후 미제출 교원 독려 및 보완 필요 인계서 반려 처리를 진행합니다.',
  },
  {
    key: 'handover:assignment_and_routing',
    dutyKey: 'handover',
    canonicalDutyName: '학년 말 인수인계 총괄 관리',
    documentTitle: '차년도 교원 주·부 업무 분장 입력 및 대기 인수인계서 후임자 자동 라우팅 실행',
    category: '교무기획',
    period: '학년말 (1월)',
    scheduleLabel: '1월 (새 학년도 업무 분장 확정 시)',
    timingKind: 'month',
    sortOrder: 1318,
    summary: '[업무 분장 & 차년도 인수자 배정] 탭에서 교원별 후임자를 저장한 뒤 [대기 인계서 자동 배정(Routing)] 실행 및 교감 최종 결재를 확인합니다.',
  },

  // ── 10. 시스템 설정 관리 (시스템 설정 모달) ──────────────────────────
  {
    key: 'system:new_year_org_drive_sync',
    dutyKey: 'system',
    canonicalDutyName: '시스템 설정 관리',
    documentTitle: '새 학년도 학사일정·공휴일 설정, 조직도/업무 권한 정비 및 Google Drive 부서 폴더 동기화',
    category: '교무기획',
    period: '3월 (신학기)',
    scheduleLabel: '2월~3월 (새 학년도 시작 전)',
    timingKind: 'month',
    sortOrder: 300,
    summary: '시스템 설정 > [학사 일정 관리]·[조직도](부서·담임·업무담당 배정 및 [드라이브 동기화])·[전결규정]·[사용자]를 새 학년도에 맞게 현행화합니다.',
  },
  {
    key: 'system:midyear_personnel_updates',
    dutyKey: 'system',
    canonicalDutyName: '시스템 설정 관리',
    documentTitle: '인사이동·보직 변경에 따른 조직도·업무 권한·결재선·사용자 계정 수시 현행화',
    category: '교무기획',
    period: '수시 / 미정기',
    scheduleLabel: '미정기 (보직 변경·신규 임용 시)',
    timingKind: 'irregular',
    sortOrder: 9205,
    summary: '신규 교직원 등록, 부서원 이동, 직책별 기능/문서 권한 조정 및 [교원 소속 ↔ 조직도 자동 동기화]를 수시 실행합니다.',
  },
];

const DUTY_KEY_ORDER: SystemDutyKey[] = [
  'system',
  'student',
  'duty',
  'handover',
  'bus',
  'afterschool',
  'safety',
  'health',
  'pe',
  'volunteer',
];

/**
 * 교원의 주·부 업무명 문자열을 분석하여 고정 업무 블루프린트 키(SystemDutyKey)를 판별한다.
 */
export function resolveSystemDutyKeysFromDuties(duties: string[]): SystemDutyKey[] {
  const matched = new Set<SystemDutyKey>();

  for (const raw of duties || []) {
    const clean = (raw || '').trim();
    if (!clean) continue;
    const norm = getNormalizedTaskCompareKey(clean);

    if (clean.includes('스쿨버스') || norm.includes('스쿨버스')) {
      matched.add('bus');
    }
    if (clean.includes('안전지도') || clean.includes('학생 안전') || clean.includes('학교안전') || norm.includes('안전점검표')) {
      matched.add('safety');
    }
    if (clean.includes('봉사활동') || norm === '봉사') {
      matched.add('volunteer');
    }
    if (clean.includes('방과후') || norm.includes('방과후')) {
      matched.add('afterschool');
    }
    if (clean.includes('체육') || clean.toUpperCase().includes('PAPS') || norm.includes('체육측정결과')) {
      matched.add('pe');
    }
    if (clean.includes('보건') || clean.includes('건강기록') || clean.includes('학생 건강')) {
      matched.add('health');
    }
    if (clean.includes('학생출결') || clean.includes('학적') || (clean.includes('출결') && !clean.includes('방과후'))) {
      matched.add('student');
    }
    if (clean.includes('교원 복무') || clean.includes('근태') || clean.includes('복무/근태')) {
      matched.add('duty');
    }
    if (clean.includes('인수인계') || norm.includes('인수인계')) {
      matched.add('handover');
    }
    if (clean.includes('시스템 설정') || clean.includes('시스템설정') || norm.includes('시스템설정')) {
      matched.add('system');
    }
  }

  return DUTY_KEY_ORDER.filter(k => matched.has(k));
}

export function getSystemBlueprintByKey(systemTaskKey?: string): SystemDutyTaskBlueprint | undefined {
  if (!systemTaskKey) return undefined;
  return SYSTEM_DUTY_BLUEPRINTS.find(b => b.key === systemTaskKey);
}

/**
 * 전자결재 기안문 항목이 시스템 고정 업무 항목의 실제 완료 기안과 중복되는지 판별한다.
 */
export function doesApprovalDocSuppressSystemTask(
  approvalItem: HandoverItem,
  blueprint: SystemDutyTaskBlueprint
): boolean {
  if (approvalItem.sourceType && approvalItem.sourceType !== 'approval') {
    return false;
  }
  const approvalTitle = (approvalItem.documentTitle || '').trim();
  if (!approvalTitle) return false;

  const keywords = blueprint.suppressIfApprovalMatches || [];
  if (keywords.length === 0) return false;

  const titleLower = approvalTitle.toLowerCase();
  const hasKeyword = keywords.some(kw => titleLower.includes(kw.toLowerCase()));
  if (!hasKeyword) return false;

  if (!blueprint.suppressIfPeriodMatches) {
    return true;
  }

  // 학기 구분(1학기 vs 2학기)이 있는 고정 업무는 해당 학기(또는 연간 통합) 기안문과만 중복 처리
  const mentionsSem1 = approvalTitle.includes('1학기');
  const mentionsSem2 = approvalTitle.includes('2학기');
  const mentionsAnnual = approvalTitle.includes('연간') || approvalTitle.includes('1·2학기');
  if (mentionsAnnual) return true;

  const bpIsSem1 = blueprint.period.startsWith('1학기') || blueprint.scheduleLabel.includes('1학기');
  const bpIsSem2 = blueprint.period.startsWith('2학기') || blueprint.scheduleLabel.includes('2학기');

  if (bpIsSem1) {
    if (mentionsSem2 && !mentionsSem1) return false;
    return (
      mentionsSem1 ||
      approvalItem.period === '1학기 (4~6월)' ||
      approvalItem.period === '1학기 말' ||
      approvalItem.period === '3월 (신학기)'
    );
  }
  if (bpIsSem2) {
    if (mentionsSem1 && !mentionsSem2) return false;
    return (
      mentionsSem2 ||
      approvalItem.period === '2학기 (9~11월)' ||
      approvalItem.period === '여름방학 (7~8월)'
    );
  }

  return true;
}

/**
 * 업그레이드된 커스텀 업무의 시기 표기 문자열을 인수인계 표준 시기·정렬값으로 정규화한다.
 */
export function parseCustomTimingToPeriodSpec(rawTiming?: string): {
  period: string;
  scheduleLabel: string;
  timingKind: HandoverTimingKind;
  sortOrder: number;
} {
  const clean = normalizeHandoverPeriodLabel(rawTiming);
  if (!clean) {
    return {
      period: '정기 업무',
      scheduleLabel: '정기 업무',
      timingKind: 'regular',
      sortOrder: 710,
    };
  }

  const monthMatch = clean.match(/(\d{1,2})\s*월/);
  if (monthMatch) {
    const m = Number(monthMatch[1]);
    if (m === 3) return { period: '3월 (신학기)', scheduleLabel: clean, timingKind: 'month', sortOrder: 310 };
    if (m >= 4 && m <= 6) return { period: '1학기 (4~6월)', scheduleLabel: clean, timingKind: 'month', sortOrder: m * 100 + 10 };
    if (m === 7 || m === 8) return { period: '여름방학 (7~8월)', scheduleLabel: clean, timingKind: 'month', sortOrder: m * 100 + 10 };
    if (m >= 9 && m <= 12) return { period: '2학기 (9~11월)', scheduleLabel: clean, timingKind: 'month', sortOrder: m * 100 + 10 };
    if (m === 1) return { period: '학년말 (1월)', scheduleLabel: clean, timingKind: 'month', sortOrder: 1310 };
    if (m === 2) return { period: '겨울방학 (1~2월)', scheduleLabel: clean, timingKind: 'vacation', sortOrder: 1410 };
  }

  if (clean.includes('1학기 말') || clean.includes('1학기말')) {
    return { period: '1학기 말', scheduleLabel: clean, timingKind: 'semester', sortOrder: 690 };
  }
  if (clean.includes('신학기')) return { period: '3월 (신학기)', scheduleLabel: clean, timingKind: 'semester', sortOrder: 315 };
  if (clean.includes('여름방학')) return { period: '여름방학 (7~8월)', scheduleLabel: clean, timingKind: 'vacation', sortOrder: 720 };
  if (clean.includes('겨울방학')) return { period: '겨울방학 (1~2월)', scheduleLabel: clean, timingKind: 'vacation', sortOrder: 1350 };
  if (clean.includes('1학기')) return { period: '1학기 (4~6월)', scheduleLabel: clean, timingKind: 'semester', sortOrder: 420 };
  if (clean.includes('2학기')) return { period: '2학기 (9~11월)', scheduleLabel: clean, timingKind: 'semester', sortOrder: 920 };
  if (clean.includes('학년말') || clean.includes('인수인계') || clean.includes('마감')) {
    return { period: '학년말 (1월)', scheduleLabel: clean, timingKind: 'month', sortOrder: 1320 };
  }
  if (clean.includes('수시') || clean.includes('미정기') || clean.includes('비정기')) {
    return { period: '수시 / 미정기', scheduleLabel: clean, timingKind: 'irregular', sortOrder: 910 };
  }

  return {
    period: '정기 업무',
    scheduleLabel: clean,
    timingKind: 'regular',
    sortOrder: 710,
  };
}

/**
 * 타임라인 표준 시기명으로부터 정렬 가중치 및 timingKind 메타를 일관되게 추론한다.
 */
export function inferHandoverTimingMetaFromPeriod(
  period: string,
  fallbackKind?: HandoverTimingKind
): {
  period: string;
  scheduleLabel: string;
  timingKind: HandoverTimingKind;
  sortOrder: number;
} {
  const clean = normalizeHandoverPeriodLabel(period);
  const exactMap: Record<string, { timingKind: HandoverTimingKind; sortOrder: number }> = {
    '3월 (신학기)': { timingKind: 'month', sortOrder: 310 },
    '1학기 (4~6월)': { timingKind: 'semester', sortOrder: 420 },
    '1학기 말': { timingKind: 'semester', sortOrder: 690 },
    '여름방학 (7~8월)': { timingKind: 'vacation', sortOrder: 720 },
    '2학기 (9~11월)': { timingKind: 'semester', sortOrder: 920 },
    '학년말 (1월)': { timingKind: 'month', sortOrder: 1310 },
    '겨울방학 (1~2월)': { timingKind: 'vacation', sortOrder: 1350 },
    '정기 업무': { timingKind: 'regular', sortOrder: 710 },
    '연간 상시': { timingKind: 'regular', sortOrder: 810 },
    '수시 / 미정기': { timingKind: 'irregular', sortOrder: 910 },
  };
  if (clean in exactMap) {
    const meta = exactMap[clean];
    return {
      period: clean,
      scheduleLabel: clean,
      timingKind: fallbackKind || meta.timingKind,
      sortOrder: meta.sortOrder,
    };
  }
  const parsed = parseCustomTimingToPeriodSpec(clean);
  return {
    ...parsed,
    timingKind: fallbackKind || parsed.timingKind,
  };
}

/**
 * 업무명을 인수인계 업무 표준 템플릿 매칭용 정규화 키로 변환한다.
 */
export function normalizeHandoverDutyTemplateCore(dutyName: string): string {
  return getNormalizedTaskCompareKey(dutyName);
}

/**
 * 저장된 업무 표준 타임라인 템플릿이 대상 직책/업무명과 일치하는지 판별한다.
 */
export function doesHandoverDutyTemplateMatchDuty(
  tpl: Pick<HandoverDutyTimelineTemplate, 'dutyName' | 'normalizedDutyCore'>,
  targetDutyName: string
): boolean {
  const targetClean = (targetDutyName || '').trim();
  const tplClean = (tpl.dutyName || '').trim();
  if (!targetClean || !tplClean) return false;
  if (targetClean === tplClean) return true;

  const targetCore = normalizeHandoverDutyTemplateCore(targetClean);
  const tplCore = tpl.normalizedDutyCore || normalizeHandoverDutyTemplateCore(tplClean);
  if (targetCore && tplCore && targetCore === tplCore) return true;

  // 시스템 고정 직책 alias 매칭 (예: '스쿨버스' === '스쿨버스 탑승 관리', '방과후' === '방과후학교')
  const tplSysKeys = resolveSystemDutyKeysFromDuties([tplClean]);
  const targetSysKeys = resolveSystemDutyKeysFromDuties([targetClean]);
  if (tplSysKeys.length === 1 && targetSysKeys.length === 1 && tplSysKeys[0] === targetSysKeys[0]) {
    return true;
  }

  return false;
}

/**
 * 시스템 기본 + 업그레이드된 커스텀 청사진 목록에 사용자 학습(수정/숨김/추가) 템플릿을 반영한다.
 */
export function applyLearnedDutyTemplatesToBlueprints(
  baseBlueprints: SystemDutyTaskBlueprint[],
  selectedDuties: string[],
  dutyTimelineTemplates: HandoverDutyTimelineTemplate[] = []
): SystemDutyTaskBlueprint[] {
  if (!dutyTimelineTemplates.length || !selectedDuties.length) {
    return baseBlueprints;
  }

  const matchedTemplates: Array<{
    tpl: HandoverDutyTimelineTemplate;
    matchedDutyName: string;
  }> = [];

  for (const tpl of dutyTimelineTemplates) {
    const matchedDuty = selectedDuties.find((d) => doesHandoverDutyTemplateMatchDuty(tpl, d));
    if (matchedDuty) {
      matchedTemplates.push({ tpl, matchedDutyName: matchedDuty.trim() });
    }
  }

  if (matchedTemplates.length === 0) {
    return baseBlueprints;
  }

  const hiddenKeys = new Set<string>();
  const overrideByKey = new Map<string, HandoverDutyTimelineTemplate['itemOverrides'][string]>();

  for (const { tpl } of matchedTemplates) {
    for (const hk of tpl.hiddenSystemKeys || []) {
      if (hk) hiddenKeys.add(hk);
    }
    for (const [k, ov] of Object.entries(tpl.itemOverrides || {})) {
      if (k && ov) overrideByKey.set(k, ov);
    }
  }

  const adjustedBase: SystemDutyTaskBlueprint[] = [];
  const existingNormTitles = new Set<string>();

  for (const bp of baseBlueprints) {
    if (hiddenKeys.has(bp.key)) continue;
    const ov = overrideByKey.get(bp.key);
    if (ov) {
      const nextPeriod = normalizeHandoverPeriodLabel(ov.period || bp.period);
      const timingMeta = inferHandoverTimingMetaFromPeriod(nextPeriod, ov.timingKind || bp.timingKind);
      const nextTitle = (ov.documentTitle || bp.documentTitle).trim();
      adjustedBase.push({
        ...bp,
        period: timingMeta.period,
        scheduleLabel: normalizeHandoverPeriodLabel(ov.scheduleLabel || timingMeta.scheduleLabel),
        timingKind: timingMeta.timingKind,
        sortOrder: typeof ov.sortOrder === 'number' ? ov.sortOrder : timingMeta.sortOrder,
        documentTitle: nextTitle,
        category: (ov.category || bp.category).trim(),
        summary: (ov.summary ?? bp.summary).trim(),
        ...(ov.folderUrl ? { folderUrlOverride: ov.folderUrl } : {}),
        isLearnedTemplateItem: true,
      });
      existingNormTitles.add(getNormalizedTaskCompareKey(nextTitle));
    } else {
      adjustedBase.push(bp);
      existingNormTitles.add(getNormalizedTaskCompareKey(bp.documentTitle));
    }
  }

  const learnedAdditions: SystemDutyTaskBlueprint[] = [];
  const seenAdditionIds = new Set<string>();

  for (const { tpl, matchedDutyName } of matchedTemplates) {
    const targetDutyLabel = matchedDutyName || tpl.dutyName;
    for (const added of tpl.addedItems || []) {
      if (!added?.id || !added.documentTitle?.trim()) continue;
      if (seenAdditionIds.has(added.id)) continue;
      const cleanTitle = added.documentTitle.trim();
      const normTitle = getNormalizedTaskCompareKey(cleanTitle);
      if (normTitle && existingNormTitles.has(normTitle)) continue;

      seenAdditionIds.add(added.id);
      if (normTitle) existingNormTitles.add(normTitle);

      const nextPeriod = (added.period || '정기 업무').trim();
      const timingMeta = inferHandoverTimingMetaFromPeriod(nextPeriod, added.timingKind);
      learnedAdditions.push({
        key: `tpl_added__${tpl.id}__${added.id}`,
        dutyKey: `learned_${tpl.normalizedDutyCore || tpl.id}`,
        canonicalDutyName: targetDutyLabel,
        documentTitle: cleanTitle,
        category: (added.category || targetDutyLabel).trim(),
        period: timingMeta.period,
        scheduleLabel: (added.scheduleLabel || timingMeta.scheduleLabel).trim(),
        timingKind: timingMeta.timingKind,
        sortOrder: typeof added.sortOrder === 'number' ? added.sortOrder : timingMeta.sortOrder,
        summary: (added.summary || '').trim(),
        suppressIfApprovalMatches: [cleanTitle],
        learnedAddedItemId: added.id,
        isLearnedTemplateItem: true,
        ...(added.folderUrl ? { folderUrlOverride: added.folderUrl } : {}),
      });
    }
  }

  return [...adjustedBase, ...learnedAdditions];
}

/**
 * 업그레이드된 커스텀 업무 워크스페이스를 기존 시스템 고정 업무와 동일한 청사진 형식으로 변환한다.
 */
export function buildBlueprintsFromUpgradedWorkspaces(
  selectedDuties: string[],
  workspaces: CustomDutyWorkspace[] = []
): SystemDutyTaskBlueprint[] {
  if (!workspaces.length || !selectedDuties.length) return [];

  const normalizedSelected = selectedDuties
    .map((d) => ({ raw: d.trim(), norm: getNormalizedTaskCompareKey(d) }))
    .filter((d) => Boolean(d.norm));

  const results: SystemDutyTaskBlueprint[] = [];

  for (const ws of workspaces) {
    const isUpgraded =
      ws.status === 'upgraded' ||
      (Array.isArray(ws.enabledModules) && ws.enabledModules.length > 0);
    if (!isUpgraded) continue;

    const wsNorm = getNormalizedTaskCompareKey(ws.dutyName);
    if (!wsNorm) continue;

    const matchesSelected = normalizedSelected.some(
      (sel) => sel.norm === wsNorm || sel.norm.includes(wsNorm) || wsNorm.includes(sel.norm)
    );
    if (!matchesSelected) continue;

    const dutyKey = `custom_ws:${ws.id}`;
    let producedCount = 0;

    // 1. 체크리스트(연간 추진 과업) 기반 주기별 항목 생성
    (ws.customChecklist || []).forEach((chk, idx) => {
      if (!chk?.title?.trim()) return;
      const spec = parseCustomTimingToPeriodSpec(chk.timing);
      const colsHint =
        ws.enabledModules?.includes('custom_table') && ws.customTableColumns?.length > 0
          ? ` (관리 대장: ${ws.customTableColumns.join(', ')})`
          : '';
      results.push({
        key: `${dutyKey}:chk:${chk.id || idx}`,
        dutyKey,
        canonicalDutyName: ws.dutyName,
        documentTitle: `[${ws.dutyName}] ${chk.title.trim()}`,
        category: ws.dutyName,
        period: spec.period,
        scheduleLabel: spec.scheduleLabel,
        timingKind: spec.timingKind,
        sortOrder: spec.sortOrder + idx,
        summary: `${ws.upgradedSummary ? `${ws.upgradedSummary} — ` : ''}${ws.dutyName} 맞춤형 업무기능 추진 과업${colsHint}`,
        suppressIfApprovalMatches: [chk.title.trim()],
      });
      producedCount++;
    });

    // 2. 맞춤형 관리 대장이 활성화된 경우 정기 운영 항목 생성
    if (ws.enabledModules?.includes('custom_table')) {
      const cols = ws.customTableColumns || [];
      results.push({
        key: `${dutyKey}:table`,
        dutyKey,
        canonicalDutyName: ws.dutyName,
        documentTitle: `[${ws.dutyName}] 맞춤형 관리 대장 운영 (${cols.slice(0, 4).join('·') || '데이터 취합'})`,
        category: ws.dutyName,
        period: '정기 업무',
        scheduleLabel: '상시 · 정기 관리',
        timingKind: 'regular',
        sortOrder: 715,
        summary: `${cols.length > 0 ? `관리 항목: ${cols.join(', ')} — ` : ''}${ws.dutyName} 맞춤형 워크스페이스 대장 입력·검색 및 엑셀 내보내기 운영`,
      });
      producedCount++;
    }

    // 3. 등록된 표준 기안문서 기반 항목 생성 (동일 제목 전자결재 기안문 존재 시 자동 중복 억제)
    (ws.standardDocs || []).forEach((docItem, idx) => {
      if (!docItem?.title?.trim()) return;
      const spec = parseCustomTimingToPeriodSpec(docItem.title);
      results.push({
        key: `${dutyKey}:doc:${docItem.id || idx}`,
        dutyKey,
        canonicalDutyName: ws.dutyName,
        documentTitle: `[표준 기안] ${docItem.title.trim()}`,
        category: ws.dutyName,
        period: spec.period,
        scheduleLabel: docItem.isDefault ? '표준 기본 서식' : spec.scheduleLabel,
        timingKind: spec.timingKind,
        sortOrder: spec.sortOrder + 50 + idx,
        summary: docItem.description?.trim() || `${ws.dutyName} 표준 기안서 양식(붙임 ${docItem.attachments?.length || 0}건 포함)`,
        suppressIfApprovalMatches: [docItem.title.trim()],
      });
      producedCount++;
    });

    // 4. 최소 1건 요약 항목 보장 (업그레이드 안내 요약만 있는 경우)
    if (producedCount === 0) {
      results.push({
        key: `${dutyKey}:overview`,
        dutyKey,
        canonicalDutyName: ws.dutyName,
        documentTitle: `[${ws.dutyName}] 맞춤 업무기능 운영`,
        category: ws.dutyName,
        period: '정기 업무',
        scheduleLabel: '정기 업무',
        timingKind: 'regular',
        sortOrder: 720,
        summary: ws.upgradedSummary || `${ws.dutyName} 업그레이드 완료 업무기능 운영 및 자료 관리`,
      });
    }
  }

  return results;
}

/**
 * 타임라인 내 전자결재 기안문과 겹치는 시스템 고정 업무(system_auto)를 제거해 중복을 차단한다.
 */
export function dedupeSystemTasksAgainstApprovals(
  items: HandoverItem[],
  extraBlueprints: SystemDutyTaskBlueprint[] = []
): HandoverItem[] {
  const approvalItems = items.filter(it => it.sourceType !== 'system_auto' && it.sourceType !== 'manual');
  if (approvalItems.length === 0) return items;

  const existingApprovalKeys = new Set(
    approvalItems.map(a => getNormalizedTaskCompareKey(a.documentTitle))
  );

  return items.filter(item => {
    if (item.sourceType !== 'system_auto') return true;
    if (item.userEdited) return true;

    const itemNorm = getNormalizedTaskCompareKey(item.documentTitle);
    if (itemNorm && existingApprovalKeys.has(itemNorm)) {
      return false;
    }

    const blueprint =
      getSystemBlueprintByKey(item.systemTaskKey) ||
      extraBlueprints.find(b => b.key === item.systemTaskKey);
    if (!blueprint) return true;

    return !approvalItems.some(appItem => doesApprovalDocSuppressSystemTask(appItem, blueprint));
  });
}

/**
 * 타임라인 항목을 학사 시기 순서(3월 신학기 → 1학기 → 1학기 말 → 여름방학 → 2학기 → 1월 학년말 → 1~2월 겨울방학 → 정기 → 미정기) 및
 * 동일 시기 내 일자/가중치/생성시각 오름차순으로 정렬한다.
 */
export function compareHandoverItemsTimeline(
  a: Pick<HandoverItem, 'id' | 'date' | 'createdAt'> & Partial<Pick<HandoverItem, 'period' | 'sortOrder'>>,
  b: Pick<HandoverItem, 'id' | 'date' | 'createdAt'> & Partial<Pick<HandoverItem, 'period' | 'sortOrder'>>
): number {
  const rankA = getHandoverPeriodRank(a.period || inferHandoverPeriodFromDateStr(a.date));
  const rankB = getHandoverPeriodRank(b.period || inferHandoverPeriodFromDateStr(b.date));
  if (rankA !== rankB) return rankA - rankB;

  const keyA = getHandoverChronoSortKey(a);
  const keyB = getHandoverChronoSortKey(b);
  if (keyA !== keyB) return keyA - keyB;

  const dateA = (a.date || '').trim();
  const dateB = (b.date || '').trim();
  if (dateA !== dateB) {
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.localeCompare(dateB);
  }

  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : NaN;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : NaN;
  if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
    return timeA - timeB;
  }

  const rawTimeA = typeof a.createdAt === 'string' ? a.createdAt : '';
  const rawTimeB = typeof b.createdAt === 'string' ? b.createdAt : '';
  if (rawTimeA && rawTimeB && rawTimeA !== rawTimeB) {
    return rawTimeA.localeCompare(rawTimeB);
  }

  return (a.id || '').localeCompare(b.id || '');
}

/**
 * YYYY-MM-DD 날짜 문자열로부터 표준 학사 시기 그룹을 추론한다(SSOT).
 */
export function inferHandoverPeriodFromDateStr(dateStr?: string): string {
  if (!dateStr || dateStr.length < 7) return '연간 상시';
  const month = parseInt(dateStr.slice(5, 7), 10);
  const day = dateStr.length >= 10 ? parseInt(dateStr.slice(8, 10), 10) : NaN;
  if (month === 3) return '3월 (신학기)';
  if (month >= 4 && month <= 6) return '1학기 (4~6월)';
  if (month === 7 || month === 8) return '여름방학 (7~8월)';
  if (month >= 9 && month <= 12) return '2학기 (9~11월)';
  if (month === 1) {
    return !Number.isNaN(day) && day > 15 ? '겨울방학 (1~2월)' : '학년말 (1월)';
  }
  if (month === 2) return '겨울방학 (1~2월)';
  return '연간 상시';
}

/**
 * 선택된 주·부 업무 목록에 맞춰 시스템 고정 업무를 타임라인에 자동 생성·병합하고
 * 기안문과 중복 없이 시기 순서대로 정렬한 결과를 반환한다.
 */
export function syncSystemDutyTasksIntoTimeline(params: {
  currentItems: HandoverItem[];
  selectedDuties: string[];
  dismissedSystemTaskKeys?: string[];
  driveConfig?: GoogleDriveConfig | null;
  org?: Partial<OrgStructure> | null;
  year?: number | string;
  teacherDeptName?: string;
  pruneRemovedDuties?: boolean;
  upgradedCustomWorkspaces?: CustomDutyWorkspace[];
  dutyTimelineTemplates?: HandoverDutyTimelineTemplate[];
}): {
  items: HandoverItem[];
  changed: boolean;
} {
  const {
    currentItems,
    selectedDuties,
    dismissedSystemTaskKeys = [],
    driveConfig,
    org,
    year = 2026,
    teacherDeptName = '',
    pruneRemovedDuties = true,
    upgradedCustomWorkspaces = [],
    dutyTimelineTemplates = [],
  } = params;

  const activeDutyKeys = new Set<SystemDutyKey>(resolveSystemDutyKeysFromDuties(selectedDuties));
  const dismissedSet = new Set<string>(dismissedSystemTaskKeys);

  const staticActiveBlueprints = SYSTEM_DUTY_BLUEPRINTS.filter(
    bp => activeDutyKeys.has(bp.dutyKey as SystemDutyKey)
  );
  const customActiveBlueprints = buildBlueprintsFromUpgradedWorkspaces(
    selectedDuties,
    upgradedCustomWorkspaces
  );

  const learnedAppliedBlueprints = applyLearnedDutyTemplatesToBlueprints(
    [...staticActiveBlueprints, ...customActiveBlueprints],
    selectedDuties,
    dutyTimelineTemplates
  );
  const activeBlueprints = learnedAppliedBlueprints.filter(bp => !dismissedSet.has(bp.key));
  const activeKeySet = new Set(activeBlueprints.map(b => b.key));
  const bpMap = new Map(activeBlueprints.map(b => [b.key, b]));

  // 직책별 Google Drive 폴더 URL 캐시 계산 (고정 업무 + 업그레이드된 커스텀 업무 + 학습 템플릿 지원)
  const dutyFolderUrlMap = new Map<string, string>();
  if (driveConfig?.enabled) {
    for (const bp of activeBlueprints) {
      if (dutyFolderUrlMap.has(bp.dutyKey)) continue;
      const matched = resolveDriveFolderForDuty(
        bp.canonicalDutyName,
        driveConfig,
        year,
        teacherDeptName,
        org
      );
      if (matched?.folderUrl) {
        dutyFolderUrlMap.set(bp.dutyKey, matched.folderUrl);
      }
    }
  }

  let changed = false;
  const existingSystemKeys = new Set<string>();
  const existingCustomTemplateIds = new Set<string>();
  const existingManualOrOtherTitles = new Set<string>();

  const nextItems: HandoverItem[] = [];

  for (const it of currentItems) {
    if (it.customTemplateItemId) {
      existingCustomTemplateIds.add(it.customTemplateItemId);
    }
    if (it.sourceType === 'system_auto') {
      const sKey = it.systemTaskKey || '';
      if (pruneRemovedDuties && (!sKey || !activeKeySet.has(sKey))) {
        changed = true;
        continue;
      }
      if (sKey && dismissedSet.has(sKey)) {
        changed = true;
        continue;
      }
      if (sKey) {
        existingSystemKeys.add(sKey);
        const bp = bpMap.get(sKey);
        if (bp && !it.userEdited) {
          const resolvedFolderUrl = bp.folderUrlOverride || dutyFolderUrlMap.get(bp.dutyKey) || it.folderUrl || '';
          const nextIsLearned = Boolean(bp.isLearnedTemplateItem);
          const nextLearnedId = bp.learnedAddedItemId;
          if (
            it.documentTitle !== bp.documentTitle ||
            it.period !== bp.period ||
            it.summary !== bp.summary ||
            it.category !== bp.category ||
            it.sortOrder !== bp.sortOrder ||
            it.scheduleLabel !== bp.scheduleLabel ||
            it.timingKind !== bp.timingKind ||
            it.dutyName !== bp.canonicalDutyName ||
            Boolean(it.isLearnedTemplateItem) !== nextIsLearned ||
            it.customTemplateItemId !== nextLearnedId ||
            (resolvedFolderUrl && it.folderUrl !== resolvedFolderUrl)
          ) {
            changed = true;
            nextItems.push({
              ...it,
              documentTitle: bp.documentTitle,
              category: bp.category,
              period: bp.period,
              summary: bp.summary,
              sortOrder: bp.sortOrder,
              scheduleLabel: bp.scheduleLabel,
              timingKind: bp.timingKind,
              dutyName: bp.canonicalDutyName,
              folderUrl: resolvedFolderUrl,
              isLearnedTemplateItem: nextIsLearned,
              ...(nextLearnedId ? { customTemplateItemId: nextLearnedId } : {}),
            });
            continue;
          }
        }
      }
      nextItems.push(it);
    } else {
      existingManualOrOtherTitles.add(getNormalizedTaskCompareKey(it.documentTitle));
      nextItems.push(it);
    }
  }

  for (const bp of activeBlueprints) {
    if (existingSystemKeys.has(bp.key)) continue;
    if (bp.learnedAddedItemId && existingCustomTemplateIds.has(bp.learnedAddedItemId)) continue;
    if (existingManualOrOtherTitles.has(getNormalizedTaskCompareKey(bp.documentTitle))) continue;

    changed = true;
    nextItems.push({
      id: `sys_${bp.key.replace(/[^a-zA-Z0-9_]/g, '_')}`,
      sourceType: 'system_auto',
      systemTaskKey: bp.key,
      dutyName: bp.canonicalDutyName,
      documentTitle: bp.documentTitle,
      category: bp.category,
      period: bp.period,
      scheduleLabel: bp.scheduleLabel,
      timingKind: bp.timingKind,
      sortOrder: bp.sortOrder,
      date: '',
      summary: bp.summary,
      folderUrl: bp.folderUrlOverride || dutyFolderUrlMap.get(bp.dutyKey) || '',
      ...(bp.isLearnedTemplateItem ? { isLearnedTemplateItem: true } : {}),
      ...(bp.learnedAddedItemId ? { customTemplateItemId: bp.learnedAddedItemId } : {}),
      createdAt: '',
    });
  }

  const deduped = dedupeSystemTasksAgainstApprovals(nextItems, activeBlueprints);
  if (deduped.length !== nextItems.length) {
    changed = true;
  }

  const sorted = [...deduped].sort(compareHandoverItemsTimeline);

  if (!changed && sorted.length === currentItems.length) {
    const orderChanged = sorted.some((it, i) => it.id !== currentItems[i]?.id);
    if (orderChanged) changed = true;
  }

  return {
    items: sorted,
    changed,
  };
}

/**
 * 타임라인 항목 인라인 수정 내용을 반영하고 시기 순으로 재정렬한다.
 */
export function applyEditedTimelineItem(
  items: HandoverItem[],
  itemId: string,
  patch: { period: string; documentTitle: string; summary: string }
): HandoverItem[] {
  const cleanTitle = patch.documentTitle.trim();
  const nextPeriod = patch.period;

  return items
    .map((it) => {
      if (it.id !== itemId) return it;
      const isDateEmpty = !it.date;
      const timingMeta = isDateEmpty
        ? inferHandoverTimingMetaFromPeriod(nextPeriod, it.timingKind)
        : null;
      return {
        ...it,
        period: nextPeriod,
        documentTitle: cleanTitle,
        summary: patch.summary.trim(),
        userEdited: true,
        ...(timingMeta
          ? {
              scheduleLabel: timingMeta.scheduleLabel,
              timingKind: timingMeta.timingKind,
              sortOrder: timingMeta.sortOrder,
            }
          : {}),
      };
    })
    .sort(compareHandoverItemsTimeline);
}
