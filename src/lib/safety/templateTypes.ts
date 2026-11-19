// 학생 안전교육 기본 템플릿(틀) 커스텀 데이터 타입 정의

export interface YearlyPlanTemplateData {
  legalBasis: string; // 관련 법령/근거
  targetGrades: string; // 대상 (예: 초등 1~6학년 전교생)
  goals: string[]; // 추진 목표 3개
  tasks: {
    category: string;
    details: string;
  }[]; // 주요 추진 과제
  evacuationSummary: {
    earthquake: string;
    fire: string;
  }; // 연간 대피훈련 개요
  homeLinkSummary: {
    heatwave: string;
    homeLiving: string;
  }; // 가정 연계 지도 요약
  expectedEffects: string[]; // 기대 효과
}

export interface EvacuationPlanTemplateData {
  legalBasis: string; // 관련 근거
  objectives: string[]; // 훈련 목적
  guidelines: string[]; // 기본 방침
  prepTasks: {
    no: number;
    title: string;
    content: string;
    schedule: string;
    manager: string;
  }[]; // 사전 준비 점검표
  timeTable: {
    no: number;
    stage: string;
    time: string;
    content: string;
    manager: string;
  }[]; // 당일 타임테이블
  rules: string[]; // 대피 8대 수칙
  floorRoutes: {
    floor1Assembly: string;
    floor2Routes: string;
    floor3Routes: string;
  }; // 본관 층별 대피 동선 및 집결지
  expectedEffects: string[]; // 기대 효과
}

// 1. 기본 연간 안전교육 계획 템플릿 기본값
export const DEFAULT_YEARLY_TEMPLATE: YearlyPlanTemplateData = {
  legalBasis: '초·중등교육법 제23조 및 학교안전사고 예방 및 보상에 관한 법률 제8조',
  targetGrades: '초등 1~6학년 전교생',
  goals: [
    '교육과정 중심의 체험·실천적 안전교육 강화로 학생의 위기 대처능력 함양',
    '학교 구성원 모두가 참여하는 안전한 교육환경 조성 및 안전 문화 정착',
    '가정 및 지역사회와 연계한 365일 촘촘한 학생 안전망 구축',
  ],
  tasks: [
    {
      category: '7대 표준 영역 시수 확보',
      details: '학년별 연간 51~52차시(학기별 균형 배정) 편성 및 정규 교과·창체 연계',
    },
    {
      category: '체험 중심 안전훈련',
      details: '연 2회(1학기 지진, 2학기 화재) 전교생 실제 대피로 이동 훈련 정례화',
    },
    {
      category: '시설 점검 및 가정 연계',
      details: '매월 4일 안전점검의 날 운영 및 계절별(폭염/한파) 가정통신문 지도',
    },
  ],
  evacuationSummary: {
    earthquake: '지진 발생 시 책상 아래 대피 및 행동요령 숙달 (1학기 5월)',
    fire: '화재 발생 시 젖은 손수건 코/입 막고 낮은 자세 대피 (2학기 10월)',
  },
  homeLinkSummary: {
    heatwave: '여름방학 전 무더위 상식 및 야외활동 안전수칙 안내',
    homeLiving: '겨울방학 전 전기/가스 안전, 빙판길 낙상 예방 수칙 안내',
  },
  expectedEffects: [
    '실천 중심의 체계적 안전교육을 통해 학생 스스로 위험 요소를 인지하고 침착하게 대처하는 자기보호 역량 신장',
    '학교-가정이 연계된 전방위적 365일 안전망 구축 및 재난대피 훈련 정례화로 안전하고 행복한 KIS 학교문화 조성',
  ],
};

// 2. 기본 재난대피훈련 템플릿 기본값
export const DEFAULT_EVACUATION_TEMPLATE: EvacuationPlanTemplateData = {
  legalBasis: '초·중등교육법 제23조 및 학교안전교육 실시 기준 등에 관한 고시',
  objectives: [
    '재난 발생 시 초동대처능력 및 신속한 대피절차 숙달',
    '위기상황 발생 시 안전의식 고취 및 생명보호 역량 함양',
    '신속하고 질서 있는 대피 훈련을 통한 2차 안전사고(압사/낙상) 예방',
  ],
  guidelines: [
    '재난 발생 시 행동 요령을 체득하는 데 중점을 둔다.',
    '훈련 시 계단 낙상 등 2차 안전사고에 각별히 유의한다.',
    '수업 중인 교사의 통제하에 신속하고 질서 있게 대피한다.',
  ],
  prepTasks: [
    { no: 1, title: '소방시설 점검', content: '소방시설 안전점검 및 진단, 화재경보기/소화기 확인', schedule: '훈련 1주 전', manager: '행정실' },
    { no: 2, title: '응급 조치반 구성', content: '요보호대상자 관리(사전 파악), 응급상황 시 조치 요령 숙지', schedule: '훈련 1주 전', manager: '보건실' },
    { no: 3, title: '방송 영상 및 PPT', content: '재난 대피 영상, 행동요령 PPT 준비', schedule: '훈련 3일 전', manager: '안전담당 교사' },
  ],
  timeTable: [
    { no: 1, stage: '재난 대피훈련 안내', time: '08:15', content: '재난 대피 훈련 안내 (중앙 방송)', manager: '자치생활부장' },
    { no: 2, stage: '대피훈련 사전교육', time: '14:10-14:30', content: '행동요령 및 층별 대피경로 교육', manager: '수업 교사' },
    { no: 3, stage: '비상 경보 발령', time: '14:30', content: '사이렌 및 비상방송 발령', manager: '방송담당 교사' },
    { no: 4, stage: '실제 대피훈련 실시', time: '14:30-14:40', content: '머리 보호, 계단 신속 이동, 집결지 집합', manager: '수업 교사' },
    { no: 5, stage: '훈련 종료 및 피드백', time: '14:40-14:50', content: '인원 점검, 총평 및 안전 하교지도', manager: '수업 교사' },
  ],
  rules: [
    '① 학급별 출입문 쪽 학생부터 교실을 나온 순서대로 복도에 정렬한다.',
    '② 교사의 통제하에 가까운 계단을 이용하여 신속하게 건물 바깥으로 이동한다.',
    '③ 다른 학급과 섞이지 않도록 순서를 지킨다.',
    '④ 대피 시 앞 사람(학급) 추월금지, 침착하게 질서를 유지한다.',
    '⑤ 환자와 장애학생의 안전 대피를 최우선 지원한다.',
    '⑥ 도움반 학생은 대피 시 도움반 수업일 경우 도움반 교사와 대피하고, 통합반 수업일 경우 담임교사와 함께 맨 앞에서 대피한다.',
    '⑦ 엘리베이터를 절대 이용하지 않고 지정된 비상계단으로만 이동한다.',
    '⑧ 대피할 때는 책가방 등 소지품으로 머리를 보호하며 대피하도록 한다.',
  ],
  floorRoutes: {
    floor1Assembly: '1·2학년: 무지개 놀이터 외곽 | 3·4학년: 매점 앞 중앙광장 | 5·6학년: 본관 앞 광장',
    floor2Routes: '동편 계단: 2-1~2-3 (본관 앞 광장) | 중앙 계단: 1-1~1-3 (중앙광장) | 서편 계단: 3학년 (무지개 놀이터)',
    floor3Routes: '동편 계단: 4학년 (운동장) | 중앙 계단: 5학년 (본관 앞 광장) | 서편 계단: 6학년 (무지개 놀이터)',
  },
  expectedEffects: [
    '실질적인 현장 대피 훈련을 통해 재난 발생 시 공포심을 줄이고 신속 침착한 대피 능력 체득',
    '층별·학급별 전용 이동 동선 사전 숙지로 병목 현상 및 압사 등 2차 사고 원천 방지',
    '교직원과 학생이 유기적으로 협력하는 비상 대응 체계 확립',
  ],
};
