// 학생 안전교육 연간 운영계획 및 재난대피훈련 공식 템플릿 데이터

export interface CurriculumItem {
  no: number;
  area: string; // 7대 영역: 생활안전, 교통안전, 폭력 및 신변안전, 약물·사이버중독, 재난안전, 직업안전, 응급처치
  title: string;
  subject: string;
  unit: string;
  period: string; // 예: 3월, 4월
  hours: number;
}

export interface GradeHours {
  grade: number;
  semester1: {
    life: number;
    traffic: number;
    violence: number;
    drugCyber: number;
    disaster: number;
    job: number;
    firstAid: number;
  };
  semester2: {
    life: number;
    traffic: number;
    violence: number;
    drugCyber: number;
    disaster: number;
    job: number;
    firstAid: number;
  };
}

// 7대 안전교육 기준 시수
export const STANDARD_HOURS_TABLE = [
  { area: '생활안전교육', req: '학기당 2회 이상', base: 12 },
  { area: '교통안전교육', req: '학기당 3회 이상', base: 11 },
  { area: '폭력예방 및 신변보호교육', req: '학기당 2회 이상', base: 8 },
  { area: '약물 및 사이버 중독 예방 교육', req: '학기당 2회 이상', base: 10 },
  { area: '재난안전교육', req: '학기당 2회 이상', base: 6 },
  { area: '직업안전교육', req: '학기당 1회 이상', base: 2 },
  { area: '응급처치교육', req: '학기당 1회 이상', base: 2 },
];

export const GRADE_HOURS_DATA: GradeHours[] = [
  {
    grade: 1,
    semester1: { life: 7, traffic: 7, violence: 4, drugCyber: 4, disaster: 3, job: 1, firstAid: 1 },
    semester2: { life: 7, traffic: 5, violence: 4, drugCyber: 6, disaster: 3, job: 1, firstAid: 1 },
  },
  {
    grade: 2,
    semester1: { life: 7, traffic: 8, violence: 6, drugCyber: 7, disaster: 3, job: 1, firstAid: 1 },
    semester2: { life: 5, traffic: 4, violence: 2, drugCyber: 3, disaster: 3, job: 1, firstAid: 1 },
  },
  {
    grade: 3,
    semester1: { life: 6, traffic: 5, violence: 5, drugCyber: 5, disaster: 3, job: 1, firstAid: 2 },
    semester2: { life: 6, traffic: 6, violence: 3, drugCyber: 5, disaster: 3, job: 1, firstAid: 1 },
  },
  {
    grade: 4,
    semester1: { life: 9, traffic: 6, violence: 4, drugCyber: 7, disaster: 4, job: 1, firstAid: 1 },
    semester2: { life: 5, traffic: 5, violence: 4, drugCyber: 3, disaster: 2, job: 1, firstAid: 1 },
  },
  {
    grade: 5,
    semester1: { life: 9, traffic: 4, violence: 8, drugCyber: 5, disaster: 3, job: 2, firstAid: 1 },
    semester2: { life: 3, traffic: 7, violence: 3, drugCyber: 5, disaster: 3, job: 2, firstAid: 1 },
  },
  {
    grade: 6,
    semester1: { life: 6, traffic: 5, violence: 4, drugCyber: 4, disaster: 3, job: 1, firstAid: 1 },
    semester2: { life: 6, traffic: 6, violence: 4, drugCyber: 6, disaster: 3, job: 1, firstAid: 1 },
  },
];

// 1학년 교육과정 (52차시)
export const GRADE_1_CURRICULUM: CurriculumItem[] = [
  { no: 1, area: '생활안전', title: '질병 예방을 위한 건강한 식습관 기르기', subject: '창체', unit: '급식실에서 맛있고 건강하게', period: '3월', hours: 1 },
  { no: 2, area: '생활안전', title: '학용품 안전하게 사용하기', subject: '창체', unit: '학용품 안전하게 사용하기', period: '3월', hours: 1 },
  { no: 3, area: '생활안전', title: '화장실 이용 수칙', subject: '창체', unit: '화장실 바르게 이용하기', period: '3월', hours: 1 },
  { no: 4, area: '생활안전', title: '교실에서 지켜야 할 안전 수칙', subject: '통합(바생)', unit: '학교', period: '3월', hours: 1 },
  { no: 5, area: '생활안전', title: '학용품과 도구의 안전 수칙', subject: '통합(즐생)', unit: '학교', period: '4월', hours: 1 },
  { no: 6, area: '생활안전', title: '운동장과 놀이터 안전수칙', subject: '통합(즐생)', unit: '사람들', period: '4월', hours: 1 },
  { no: 7, area: '생활안전', title: '안전한 야외 체험학습 안전수칙', subject: '통합(바생)', unit: '탐험', period: '7월', hours: 1 },
  { no: 8, area: '생활안전', title: '시설물 사용 안전', subject: '통합(바생)', unit: '하루', period: '8월', hours: 1 },
  { no: 9, area: '생활안전', title: '안전한 복도통행', subject: '창체', unit: '교내 안전 수칙 알기', period: '8월', hours: 1 },
  { no: 10, area: '생활안전', title: '체육활동 안전', subject: '통합(즐생)', unit: '하루', period: '9월', hours: 1 },
  { no: 11, area: '생활안전', title: '바르게 실천하기', subject: '창체', unit: '놀이터 안전하게 이용하기', period: '10월', hours: 1 },
  { no: 12, area: '생활안전', title: '게임 규칙을 지키며 안전하게 놀이하기', subject: '통합(즐생)', unit: '상상', period: '10월', hours: 1 },
  { no: 13, area: '생활안전', title: '물놀이 안전', subject: '통합(즐생)', unit: '약속', period: '11월', hours: 1 },
  { no: 14, area: '생활안전', title: '전기도구의 사용 안전', subject: '통합(즐생)', unit: '이야기', period: '12월', hours: 1 },
  { no: 15, area: '교통안전', title: '스쿨버스 안전', subject: '창체', unit: '스쿨버스 안전하게 이용하기', period: '3월', hours: 1 },
  { no: 16, area: '교통안전', title: '교통신호 지키기', subject: '창체', unit: '교통 신호 지키기', period: '3월', hours: 1 },
  { no: 17, area: '교통안전', title: '도로 횡단 5가지 원칙', subject: '통합(바생)', unit: '학교', period: '3월', hours: 1 },
  { no: 18, area: '교통안전', title: '신호등이 없는 거리에서의 안전한 보행', subject: '통합(바생)', unit: '학교', period: '3월', hours: 1 },
  { no: 19, area: '교통안전', title: '골목 사고의 위험요소와 안전 수칙', subject: '통합(바생)', unit: '학교', period: '3월', hours: 1 },
  { no: 20, area: '교통안전', title: '신호등과 교통 표지판 구별하기', subject: '창체', unit: '탈 것을 안전하게 이용하기', period: '6월', hours: 1 },
  { no: 21, area: '교통안전', title: '안전한 골목 걷기 연습', subject: '통합(바생)', unit: '사람들', period: '6월', hours: 1 },
  { no: 22, area: '교통안전', title: '보호 장구의 중요성과 올바른 착용법', subject: '통합(슬생)', unit: '탐험', period: '8월', hours: 1 },
  { no: 23, area: '교통안전', title: '안전하게 자전거 타기', subject: '통합(즐생)', unit: '탐험', period: '8월', hours: 1 },
  { no: 24, area: '교통안전', title: '대중교통 이용 안전수칙', subject: '통합(즐생)', unit: '탐험', period: '8월', hours: 1 },
  { no: 25, area: '교통안전', title: '오토바이 사고의 원인과 예방', subject: '창체', unit: '오토바이 안전', period: '11월', hours: 1 },
  { no: 26, area: '교통안전', title: '자동차 사고의 원인과 예방', subject: '창체', unit: '자동차 안전', period: '12월', hours: 1 },
  { no: 27, area: '폭력 및 신변안전', title: '학교폭력예방', subject: '창체', unit: '내 마음 표현 방법 알기', period: '4월', hours: 1 },
  { no: 28, area: '폭력 및 신변안전', title: '학교폭력', subject: '창체', unit: '학교폭력 이해하기', period: '4월', hours: 1 },
  { no: 29, area: '폭력 및 신변안전', title: '가정폭력 예방 및 대처방법', subject: '창체', unit: '가정폭력 이해하기', period: '6월', hours: 1 },
  { no: 30, area: '폭력 및 신변안전', title: '폭력에서 내 몸을 지키는 방법', subject: '통합(슬생)', unit: '사람들', period: '6월', hours: 1 },
  { no: 31, area: '폭력 및 신변안전', title: '생명존중교육', subject: '통합(바생,슬생)', unit: '약속', period: '9월', hours: 1 },
  { no: 32, area: '폭력 및 신변안전', title: '학교폭력예방', subject: '창체', unit: '학교폭력 및 따돌림 예방', period: '9월', hours: 1 },
  { no: 33, area: '폭력 및 신변안전', title: '유괴예방 및 대처방법', subject: '창체', unit: '유괴예방 및 대처방법 알기', period: '12월', hours: 1 },
  { no: 34, area: '폭력 및 신변안전', title: '가정폭력 예방 및 대처방법', subject: '창체', unit: '가정폭력 대처방법 알기', period: '12월', hours: 1 },
  { no: 35, area: '약물·사이버중독', title: '인터넷 게임 중독과 예방법', subject: '창체', unit: '인터넷 게임 중독과 예방법 알기', period: '4월', hours: 1 },
  { no: 36, area: '약물·사이버중독', title: '우리 주변의 약 알아보기', subject: '통합(바생)', unit: '탐험', period: '7월', hours: 1 },
  { no: 37, area: '약물·사이버중독', title: '약물 복용 수칙 알아보기', subject: '통합(바생)', unit: '탐험', period: '7월', hours: 1 },
  { no: 38, area: '약물·사이버중독', title: '나의 스마트폰 사용 모습 점검하기', subject: '통합(바생)', unit: '탐험', period: '7월', hours: 1 },
  { no: 39, area: '약물·사이버중독', title: '스마트폰을 올바르게 사용하는 방법', subject: '통합(바생)', unit: '탐험', period: '7월', hours: 1 },
  { no: 40, area: '약물·사이버중독', title: '구급상자 알아보기', subject: '통합(바생)', unit: '하루', period: '9월', hours: 1 },
  { no: 41, area: '약물·사이버중독', title: '우리집 구급상자 만들기', subject: '통합(바생)', unit: '하루', period: '9월', hours: 1 },
  { no: 42, area: '약물·사이버중독', title: '나의 건강을 지키는 법 알기', subject: '통합(바생)', unit: '약속', period: '10월', hours: 1 },
  { no: 43, area: '약물·사이버중독', title: '올바른 영상 시청 습관 알아보기', subject: '통합(바생)', unit: '상상', period: '11월', hours: 1 },
  { no: 44, area: '약물·사이버중독', title: '올바른 스마트폰 사용 다짐문 작성', subject: '창체', unit: '올바른 인터넷, 스마트폰 사용', period: '12월', hours: 1 },
  { no: 45, area: '재난안전', title: '지진 대피 방법', subject: '창체', unit: '재난안전교육', period: '5월', hours: 1 },
  { no: 46, area: '재난안전', title: '재난대피훈련 (지진)', subject: '창체', unit: '재난안전교육', period: '5월', hours: 1 },
  { no: 47, area: '재난안전', title: '사고 예방과 대처 요령', subject: '창체', unit: '재난안전교육', period: '5월', hours: 1 },
  { no: 48, area: '재난안전', title: '화재발생의 원인 및 안전수칙', subject: '창체', unit: '재난안전교육', period: '10월', hours: 1 },
  { no: 49, area: '재난안전', title: '재난대피훈련 (화재)', subject: '창체', unit: '재난안전교육', period: '10월', hours: 1 },
  { no: 50, area: '재난안전', title: '소화기 사용법', subject: '창체', unit: '재난안전교육', period: '11월', hours: 1 },
  { no: 51, area: '직업안전', title: '다양한 직업의 안전', subject: '창체', unit: '진로', period: '7월', hours: 1 },
  { no: 52, area: '응급처치', title: '응급상황 이해하기 및 행동요령', subject: '통합(바생)', unit: '사람들/응급처치', period: '5월/12월', hours: 2 },
];

// 2학년 교육과정 (52차시)
export const GRADE_2_CURRICULUM: CurriculumItem[] = [
  { no: 1, area: '생활안전', title: '질병 예방을 위한 올바른 손 씻기', subject: '통합', unit: '1-1.나', period: '3월', hours: 1 },
  { no: 2, area: '생활안전', title: '실내에서 안전하게 생활하기', subject: '통합', unit: '1-1.나', period: '3월', hours: 1 },
  { no: 3, area: '생활안전', title: '게임 규칙을 지키며 안전하게 놀이하기', subject: '통합', unit: '1-1.나', period: '4월', hours: 1 },
  { no: 4, area: '생활안전', title: '야외에서 안전하게', subject: '통합', unit: '1-2.자연', period: '4월', hours: 1 },
  { no: 5, area: '생활안전', title: '시설물 사용 안전', subject: '통합', unit: '1-3.마을', period: '5월', hours: 1 },
  { no: 6, area: '생활안전', title: '여름철 날씨의 특징과 건강수칙', subject: '통합', unit: '1-4.세계', period: '7월', hours: 1 },
  { no: 7, area: '생활안전', title: '식중독 예방', subject: '통합', unit: '1-4.세계', period: '7월', hours: 1 },
  { no: 8, area: '생활안전', title: '봄을 안전하게', subject: '통합', unit: '2-1.계절', period: '9월', hours: 1 },
  { no: 9, area: '생활안전', title: '여름을 안전하게', subject: '통합', unit: '2-1.계절', period: '9월', hours: 1 },
  { no: 10, area: '생활안전', title: '가을을 안전하게', subject: '통합', unit: '2-1.계절', period: '9월', hours: 1 },
  { no: 11, area: '생활안전', title: '겨울을 안전하게', subject: '통합', unit: '2-1.계절', period: '9월', hours: 1 },
  { no: 12, area: '생활안전', title: '전기를 안전하게', subject: '통합', unit: '2-2.물건', period: '10월', hours: 1 },
  { no: 13, area: '교통안전', title: '지도 속 자연-교통질서 지키기', subject: '통합', unit: '1-2.나', period: '4월', hours: 1 },
  { no: 14, area: '교통안전', title: '자동차를 안전하게', subject: '통합', unit: '1-3. 마을', period: '6월', hours: 1 },
  { no: 15, area: '교통안전', title: '도로횡단 5가지 원칙-마을 탐험대가 되어요', subject: '통합', unit: '1-3. 마을', period: '6월', hours: 1 },
  { no: 16, area: '교통안전', title: '교통질서를 지켜요', subject: '창체', unit: '교통안전교육', period: '6월', hours: 1 },
  { no: 17, area: '교통안전', title: '골목에서 안전하게-마을 탐험을 떠나요', subject: '통합', unit: '1-3. 마을', period: '6월', hours: 1 },
  { no: 18, area: '교통안전', title: '학교부근 위험요소-마을 사람들을 만나요', subject: '통합', unit: '1-3. 마을', period: '6월', hours: 1 },
  { no: 19, area: '교통안전', title: '안전띠 착용의 중요성과 바른 사용법', subject: '통합', unit: '1-3. 마을', period: '6월', hours: 1 },
  { no: 20, area: '교통안전', title: '탈것을 안전하게', subject: '통합', unit: '1-3. 마을', period: '6월', hours: 1 },
  { no: 21, area: '교통안전', title: '자동길을 탈 때는', subject: '통합', unit: '2-3.인물', period: '11월', hours: 1 },
  { no: 22, area: '교통안전', title: '직업체험 가요-대중교통 안전수칙지키기', subject: '창체', unit: '현장학습', period: '12월', hours: 1 },
  { no: 23, area: '교통안전', title: '지키기 놀이', subject: '통합', unit: '2-4.기억', period: '12월', hours: 1 },
  { no: 24, area: '교통안전', title: '슬기로운 3학년 생활-교통 안전', subject: '통합', unit: '2-4.기억', period: '12월', hours: 1 },
  { no: 25, area: '폭력 및 신변안전', title: '학교폭력예방교육-학교생활 안내', subject: '창체', unit: '개학식', period: '3월', hours: 1 },
  { no: 26, area: '폭력 및 신변안전', title: '학교폭력예방수칙을 알아봐요', subject: '창체', unit: '학교폭력예방교육', period: '3월', hours: 1 },
  { no: 27, area: '폭력 및 신변안전', title: '성폭력예방교육-내몸을 스스로 지켜요', subject: '통합', unit: '1-1.나', period: '3월', hours: 1 },
  { no: 28, area: '폭력 및 신변안전', title: '생명존중교육', subject: '통합', unit: '1-1.나', period: '3월', hours: 1 },
  { no: 29, area: '폭력 및 신변안전', title: '학교폭력 예방교육(과연 장난일까)', subject: '통합', unit: '1-1.나', period: '4월', hours: 1 },
  { no: 30, area: '폭력 및 신변안전', title: '유괴예방 및 대처방법-길을 잃었을 때', subject: '통합', unit: '1-3.마을', period: '5월', hours: 1 },
  { no: 31, area: '폭력 및 신변안전', title: '행복해지고 싶어요', subject: '통합', unit: '2-2.물건', period: '10월', hours: 1 },
  { no: 32, area: '폭력 및 신변안전', title: '생명을 지켜요', subject: '통합', unit: '2-4.기억', period: '12월', hours: 1 },
  { no: 33, area: '약물·사이버중독', title: '인터넷 바르게 사용하기', subject: 'AI', unit: '1. 우리는 컴퓨터 탐험대', period: '3월', hours: 1 },
  { no: 34, area: '약물·사이버중독', title: '몸이 아파요 / 바르게 알고 먹어요', subject: '통합', unit: '1-1.나', period: '3월', hours: 1 },
  { no: 35, area: '약물·사이버중독', title: '좋은 습관 나쁜 습관-흡연예방교육', subject: '통합', unit: '1-1.나', period: '3월', hours: 1 },
  { no: 36, area: '약물·사이버중독', title: '인터넷에서 좋은 말 사용하기', subject: 'AI', unit: '2. 웰리 구출 작전', period: '4월', hours: 1 },
  { no: 37, area: '약물·사이버중독', title: '올바른 스마트폰 사용', subject: 'AI', unit: '2. 웰리 구출 작전', period: '4월', hours: 1 },
  { no: 38, area: '약물·사이버중독', title: '인터넷 게임 중독과 예방법', subject: 'AI', unit: '2. 웰리 구출 작전', period: '4월', hours: 1 },
  { no: 39, area: '약물·사이버중독', title: '약물예방교육-약을 보관할 때는', subject: '통합', unit: '2-3.인물', period: '11월', hours: 1 },
  { no: 40, area: '약물·사이버중독', title: '소중한 정보를 지켜요', subject: '통합', unit: '2-3.인물', period: '11월', hours: 1 },
  { no: 41, area: '약물·사이버중독', title: '게임 중독을 예방해요', subject: '통합', unit: '2-4.기억', period: '12월', hours: 1 },
  { no: 42, area: '재난안전', title: '재난대비교육(지진/화재)', subject: '창체', unit: '재난 대피훈련', period: '5월', hours: 1 },
  { no: 43, area: '재난안전', title: '태풍이 오고 있어요', subject: '통합', unit: '1-4.세계', period: '7월', hours: 1 },
  { no: 44, area: '재난안전', title: '안전하게 이동해요', subject: '통합', unit: '1-4.세계', period: '7월', hours: 1 },
  { no: 45, area: '재난안전', title: '화재는 예방이 최고', subject: '통합', unit: '2-2.물건', period: '10월', hours: 1 },
  { no: 46, area: '재난안전', title: '재난대비교육(지진/화재)', subject: '창체', unit: '재난 대피훈련', period: '10월', hours: 1 },
  { no: 47, area: '재난안전', title: '자연재해 관련 안전-등산을 할 때는', subject: '통합', unit: '2-3.인물', period: '11월', hours: 1 },
  { no: 48, area: '직업안전', title: '나의 소질과 직업- 직업 세계의 안전사고', subject: '창체', unit: '진로', period: '6월', hours: 1 },
  { no: 49, area: '직업안전', title: '직업체험-직업 안전의식', subject: '창체', unit: '진로', period: '12월', hours: 1 },
  { no: 50, area: '응급처치', title: '몸이 아파요-응급상황 시 행동요령', subject: '통합', unit: '1-1.나', period: '3월', hours: 1 },
  { no: 51, area: '응급처치', title: '나들이를 가요-심폐소생술, 지혈 및 상처 처치', subject: '통합', unit: '2-1.계절', period: '9월', hours: 1 },
];

// 3~6학년 대표 요약용 메타데이터 (전체 51차시)
export const GRADE_SUMMARIES = [
  { grade: 1, totalHours: 52, items: GRADE_1_CURRICULUM },
  { grade: 2, totalHours: 52, items: GRADE_2_CURRICULUM },
  { grade: 3, totalHours: 51, focus: '체육활동 및 과학실험 안전, 호치민 도로 및 교통 수단 특징' },
  { grade: 4, totalHours: 51, focus: '공공시설물 안전, 화산·지진 땅의 변화, 성폭력 예방' },
  { grade: 5, totalHours: 51, focus: '실과 식품안전, 교통발달과 호치민 교통, 산업재해 및 직업병' },
  { grade: 6, totalHours: 51, focus: '실험실습안전, 인공지능 윤리 및 인터넷 게임 중독, 심폐소생술/제세동기' },
];

// 재난대피 훈련 사전점검 목록
export const DEFAULT_PREPARATION_TASKS = [
  { no: 1, title: '소방시설 점검', content: '소방시설 안전점검 및 진단, 화재경보기/소화기 확인', schedule: '5.12~5.22.', manager: '행정실' },
  { no: 2, title: '응급 조치반 구성', content: '요보호대상자 관리(사전 파악), 응급상황 시 조치 요령 숙지', schedule: '5.12~5.22.', manager: '보건실' },
  { no: 3, title: '방송 영상 및 PPT', content: '재난 대피 영상, PPT 준비', schedule: '5.12~5.22.', manager: '안전담당 교사' },
];

// 재난대피 훈련 당일 일정 타임테이블
export const DEFAULT_TRAINING_TIMETABLE = [
  { no: 1, stage: '재난 대피훈련 안내', time: '08:15', content: '재난 대피 훈련 안내 (중앙 방송)', manager: '자치생활부장' },
  { no: 2, stage: '지진 대피훈련 사전교육', time: '14:10-14:30', content: '지진 대피요령 및 층별 대피경로 교육', manager: '7교시 수업 교사' },
  { no: 3, stage: '지진 경보 발령', time: '14:30', content: '지진 경보 발령 (사이렌 및 비상방송)', manager: '방송담당 교사' },
  { no: 4, stage: '지진 대피훈련 실시', time: '14:30-14:40', content: '실제 대피훈련 (책가방 머리보호, 계단 신속 이동)', manager: '7교시 수업 교사' },
  { no: 5, stage: '현장훈련 종료 및 하교지도', time: '14:40-14:50', content: '대피 훈련 피드백(학급별), 인원 점검 및 안전 하교지도', manager: '7교시 수업 교사' },
];

// 대피 8대 수칙
export const EVACUATION_RULES = [
  '① 학급별 출입문 쪽 학생부터 교실을 나온 순서대로 복도에 정렬한다.',
  '② 교사의 통제하에 가까운 계단을 이용하여 신속하게 건물 바깥으로 이동한다.',
  '③ 다른 학급과 섞이지 않도록 순서를 지킨다.',
  '④ 대피 시 앞 사람(학급) 추월금지, 침착하게 질서를 유지한다.',
  '⑤ 환자와 장애학생의 안전 대피를 최우선 지원한다.',
  '⑥ 도움반 학생은 대피 시 도움반 수업일 경우 도움반 교사와 대피하고, 통합반 수업일 경우 담임교사와 함께 맨 앞에서 대피한다.',
  '⑦ 엘리베이터를 절대 이용하지 않고 지정된 비상계단으로만 이동한다.',
  '⑧ 대피할 때는 책가방 등 소지품으로 머리를 보호하며 대피하도록 한다.',
];
