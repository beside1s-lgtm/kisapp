export type SeatingLayoutType = 'ROW' | 'GROUP' | 'FREE'; // 분단형 | 모둠형 | 자유형
export type GenderPairType = 'RANDOM' | 'OPPOSITE' | 'SAME'; // 랜덤(상관없이) | 이성끼리 | 동성끼리
export type RevealEffectType = 'ALL_AT_ONCE' | 'ONE_BY_ONE'; // 한 번에 보기 | 한 명씩 보기

export interface DeskSlot {
  id: string; // 고유 슬롯 ID (예: "slot_0_0" or "slot_1")
  row: number; // 행 인덱스 (0-based)
  col: number; // 열 인덱스 (0-based)
  groupId?: number; // 분단 번호(1~6) 또는 모둠 번호(1~M)
  pairIndex?: number; // 짝꿍 인덱스 (0: 왼쪽/앞, 1: 오른쪽/뒤)

  // 배정된 학생 정보
  studentId?: string | null;
  studentName?: string | null;
  studentNum?: string | null;
  studentGender?: 'Male' | 'Female' | '남' | '여' | string | null;
  studentPhotoUrl?: string | null; // 학생 사진 URL

  // 칭찬 포인트 (수업 도구용)
  praisePoints?: number;

  // 고정(사전 지정) 여부: 교사가 직접 지정하여 랜덤 시 고정 유지
  isFixed?: boolean;

  // 활성 여부 (자유형에서 빈 칸 또는 미사용 좌석)
  isActive: boolean;
}

export interface RowLayoutConfig {
  rowType: 1 | 2; // 1열(1줄씩) vs 2열(짝꿍 2명씩)
  divisionCount: number; // 분단 수 (1열: 1~6, 2열: 1~4)
  genderPair: GenderPairType; // 짝꿍 성별 설정: 'RANDOM' | 'OPPOSITE' | 'SAME'
  avoidPreviousPartner: boolean; // 이전 짝꿍과 같이 안 앉기
}

export interface GroupLayoutConfig {
  groupSize: 3 | 4 | 5 | 6; // 모둠당 인원수 (3인, 4인, 5인, 6인)
  mergeRemaining: boolean; // 남는 학생은 기존 모둠에 합하기
  genderPair: GenderPairType; // 짝꿍 성별 설정
  avoidPreviousPartner: boolean;
}

export interface FreeLayoutConfig {
  gridRows: number; // 기본 7행
  gridCols: number; // 기본 8열 (총 56석)
  activeSlotIds: string[]; // 활성화된 좌석 ID 배열
}

export interface SeatingConfig {
  title: string; // 자리배치도 이름 (예: "9월 자리배치도")
  layoutType: SeatingLayoutType;
  rowConfig: RowLayoutConfig;
  groupConfig: GroupLayoutConfig;
  freeConfig: FreeLayoutConfig;
  revealEffect: RevealEffectType; // 'ALL_AT_ONCE' | 'ONE_BY_ONE'
}

export interface SeatingPlan {
  id: string;
  classKey: string; // 학급 식별자 (예: "grade_4_class_3")
  classLabel?: string; // 학급 라벨 (예: "4학년 3반")
  title: string; // 이름
  config: SeatingConfig;
  slots: DeskSlot[];
  historyPartners?: Array<{ studentAId: string; studentBId: string }>; // 짝꿍 이력
  praiseTargetGoal?: number; // 칭찬 온도계 목표 점수 (기본값 50점)
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export const DEFAULT_ROW_CONFIG: RowLayoutConfig = {
  rowType: 2,
  divisionCount: 3,
  genderPair: 'RANDOM',
  avoidPreviousPartner: false,
};

export const DEFAULT_GROUP_CONFIG: GroupLayoutConfig = {
  groupSize: 4,
  mergeRemaining: true,
  genderPair: 'RANDOM',
  avoidPreviousPartner: false,
};

export const DEFAULT_FREE_CONFIG: FreeLayoutConfig = {
  gridRows: 7,
  gridCols: 8,
  activeSlotIds: [],
};

export const DEFAULT_SEATING_CONFIG: SeatingConfig = {
  title: '새 자리배치도',
  layoutType: 'ROW',
  rowConfig: DEFAULT_ROW_CONFIG,
  groupConfig: DEFAULT_GROUP_CONFIG,
  freeConfig: DEFAULT_FREE_CONFIG,
  revealEffect: 'ALL_AT_ONCE',
};

export interface SeatingViewOptions {
  showPhoto: boolean;       // 학생 사진 표시
  showPraise: boolean;      // 칭찬 포인트 및 배지 표시
  showGauge: boolean;       // 모둠/학급 게이지 표시
  showGenderBadge: boolean; // 성별 배지 표시
}

export const DEFAULT_VIEW_OPTIONS: SeatingViewOptions = {
  showPhoto: true,
  showPraise: true,
  showGauge: true,
  showGenderBadge: true,
};

/**
 * 칭찬 포인트 10개 단위 색상 티어 인터페이스
 */
export interface PraiseTier {
  level: number;
  name: string;
  icon: string;
  badgeClass: string;
  starClass: string;
  cardBorderClass: string;
  cardBgClass: string;
  textColor: string;
}

/**
 * 개인의 칭찬이 10개씩 모일 때마다 색상과 티어가 달라지는 헬퍼 함수
 * 0~9점: 기본 앰버/옐로우
 * 10~19점: 에메랄드 그린
 * 20~29점: 사파이어 블루
 * 30~39점: 자수정 퍼플
 * 40~49점: 루비 로즈
 * 50점 이상: 황금빛 마스터 레전드
 */
export function getPraiseTier(points: number = 0, classKey?: string): PraiseTier {
  const safePoints = Math.max(0, points || 0);

  // 학급별 커스텀 성장 체계 확인
  if (typeof window !== 'undefined' && classKey) {
    try {
      const raw = localStorage.getItem(`kis_praise_growth_tiers_${classKey}`);
      if (raw) {
        const customTiers = JSON.parse(raw);
        if (Array.isArray(customTiers) && customTiers.length > 0) {
          const matched = customTiers.find(
            (t: any) => safePoints >= t.minPoints && safePoints <= t.maxPoints
          );
          if (matched) {
            return {
              level: matched.level,
              name: matched.name,
              icon: matched.icon || '🌱',
              badgeClass: matched.badgeClass,
              starClass: matched.starClass,
              cardBorderClass: matched.cardBorderClass,
              cardBgClass: matched.cardBgClass,
              textColor: 'text-slate-800',
            };
          }
        }
      }
    } catch {}
  }

  const level = Math.floor(safePoints / 10);

  switch (level) {
    case 0:
      return {
        level: 0,
        name: '새싹',
        icon: '🌱',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        starClass: 'fill-amber-400 text-amber-500',
        cardBorderClass: 'border-amber-300',
        cardBgClass: 'bg-amber-50/50',
        textColor: 'text-amber-800',
      };
    case 1: // 10~19점
      return {
        level: 1,
        name: '줄기 (에메랄드)',
        icon: '🌿',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-400 shadow-xs ring-1 ring-emerald-300 font-black',
        starClass: 'fill-emerald-400 text-emerald-600',
        cardBorderClass: 'border-emerald-400 shadow-emerald-100',
        cardBgClass: 'bg-emerald-50/70',
        textColor: 'text-emerald-800',
      };
    case 2: // 20~29점
      return {
        level: 2,
        name: '꽃봉오리 (사파이어)',
        icon: '🌸',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-400 shadow-xs ring-1 ring-sky-300 font-black',
        starClass: 'fill-sky-400 text-sky-600',
        cardBorderClass: 'border-sky-400 shadow-sky-100',
        cardBgClass: 'bg-sky-50/70',
        textColor: 'text-sky-800',
      };
    case 3: // 30~39점
      return {
        level: 3,
        name: '열매 (자수정)',
        icon: '🍎',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-400 shadow-xs ring-1 ring-purple-300 font-black',
        starClass: 'fill-purple-400 text-purple-600',
        cardBorderClass: 'border-purple-400 shadow-purple-100',
        cardBgClass: 'bg-purple-50/70',
        textColor: 'text-purple-800',
      };
    case 4: // 40~49점
      return {
        level: 4,
        name: '나무 (루비)',
        icon: '🌳',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-400 shadow-xs ring-1 ring-rose-300 font-black',
        starClass: 'fill-rose-400 text-rose-600',
        cardBorderClass: 'border-rose-400 shadow-rose-100',
        cardBgClass: 'bg-rose-50/70',
        textColor: 'text-rose-800',
      };
    default: // 50점 이상 (50~59, 60~69 ...)
      return {
        level,
        name: `황금숲 ${level >= 5 ? `Lv.${level}` : '마스터'}`,
        icon: '👑',
        badgeClass: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-300 text-amber-950 border-amber-500 shadow-sm ring-1 ring-amber-400 font-black',
        starClass: 'fill-amber-700 text-amber-800',
        cardBorderClass: 'border-amber-400 ring-2 ring-amber-300 shadow-amber-200',
        cardBgClass: 'bg-gradient-to-br from-amber-50 via-yellow-50/60 to-orange-50/40',
        textColor: 'text-amber-900',
      };
  }
}


