export type SafetyZone = '전체' | '정문/통학로' | '운동장/체육시설' | '교사동 복도/계단' | '특별실/실습실' | '급식실/식당' | '스쿨버스 승하차장';

export type SafetyStatus = 'SAFE' | 'WARNING' | 'DANGER'; // 양호, 주의, 위험

export type IncidentStatus = 'RECEIVED' | 'IN_PROGRESS' | 'RESOLVED'; // 접수, 조치중, 조치완료

export type IncidentType = '낙상/넘어짐' | '충돌/부딪힘' | '베임/찰과상' | '체육활동 부상' | '화상' | '교통/통학로 안전' | '기타';

export interface SafetyCheckItem {
  id: string;
  category: string;
  label: string;
  status: SafetyStatus;
  note?: string;
}

export interface SafetyPatrolLog {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  zone: SafetyZone;
  patrolLeader: string; // 순찰 책임자 성명
  patrolLeaderEmail: string;
  companionTeachers?: string[]; // 동행 교사/순찰자
  overallStatus: SafetyStatus; // 전체 평가
  specialNotes?: string; // 특이사항 및 긴급 조치
  actionTaken?: string; // 취한 조치
  checklist?: SafetyCheckItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface SafetyIncident {
  id: string;
  incidentDate: string; // YYYY-MM-DD
  incidentTime: string; // HH:mm
  location: string; // 발생 장소 (예: 2층 중앙 계단, 운동장 농구장 등)
  type: IncidentType;
  victimName: string; // 대상 학생/교직원 성명
  victimGradeClass?: string; // 예: 3학년 2반
  victimType: 'STUDENT' | 'FACULTY' | 'VISITOR';
  description: string; // 사고 경위
  firstAidGiven: string; // 응급처치 및 보건실 이송 내역
  guardianNotified: boolean; // 학부모 연락 여부
  guardianNotificationTime?: string;
  followUpPlan: string; // 재발 방지 및 후속 조치
  handlerName: string; // 처리 담당자 성명
  handlerEmail: string;
  status: IncidentStatus; // 처리 상태
  createdAt: string;
  updatedAt?: string;
}

export interface SafetyFacilityItem {
  id: string;
  name: string; // 시설명 (예: 옥외 소화전, 본관 비상계단 미끄럼방지 패드, 정문 차단기 등)
  location: string;
  category: '소방/비상대피' | '보행/통학로' | '놀이/체육' | '전기/가스' | 'CCTV/보안';
  lastCheckedDate: string;
  checkCycle: '일일' | '주간' | '월간' | '분기';
  status: SafetyStatus;
  managerName: string;
  notes?: string;
}

export interface SafetyKPIStats {
  todayPatrolCompleted: boolean;
  thisMonthPatrolCount: number;
  activeIncidentsCount: number; // 미조치 사고
  facilityWarningCount: number; // 점검 주의/보수 시설
  totalSafeScore: number; // 0-100 안전 지수
}

// ==========================================
// [안전점검의 날] 시설 및 월별 점검표 관련 데이터 모델
// ==========================================

export type InspectionScore = 'O' | '△' | '×' | '-';

export interface InspectionItemDef {
  id: string;
  section: '실내' | '복도 및 계단';
  index: number;
  name: string;
}

// 학교 실제 서식 기준 14개 고정 점검 항목
export const SAFETY_INSPECTION_ITEMS: InspectionItemDef[] = [
  // 실내 (8개)
  { id: 'in_1', section: '실내', index: 1, name: '출입문 관리 상태' },
  { id: 'in_2', section: '실내', index: 2, name: '유리창 및 창틀 상태' },
  { id: 'in_3', section: '실내', index: 3, name: '책·걸상 상태' },
  { id: 'in_4', section: '실내', index: 4, name: '전기콘센트/배선 상태' },
  { id: 'in_5', section: '실내', index: 5, name: '전기콘센트 주변 청결상태' },
  { id: 'in_6', section: '실내', index: 6, name: '실내 환기 및 조명 상태' },
  { id: 'in_7', section: '실내', index: 7, name: '적정 소음수준도 상태' },
  { id: 'in_8', section: '실내', index: 8, name: '정리정돈상태' },
  // 복도 및 계단 (6개)
  { id: 'cor_1', section: '복도 및 계단', index: 1, name: '복도( 및 계단)의 상태' },
  { id: 'cor_2', section: '복도 및 계단', index: 2, name: '계단 및 난간의 상태' },
  { id: 'cor_3', section: '복도 및 계단', index: 3, name: '복도 소화설비 상태' },
  { id: 'cor_4', section: '복도 및 계단', index: 4, name: '복도 전기위험요소관리 상태' },
  { id: 'cor_5', section: '복도 및 계단', index: 5, name: '소화기 비치 상태' },
  { id: 'cor_6', section: '복도 및 계단', index: 6, name: '기타(비고)' },
];

export type SchoolFacilityCategory = 'classroom' | 'special' | 'common' | 'admin';

export interface SchoolFacility {
  id: string;
  name: string; // 장소명 (예: '1반', '2반', '영어1실', '과학실', '체육관', '보건실' 등)
  fullName: string; // 전체 표기 (예: '1학년 1반', '체육관', '본관 과학실')
  category: SchoolFacilityCategory;
  grade?: number; // 1~6학년 (일반교실 및 학년 소속 특별실)
  classNum?: number; // 1~6반
  location: string; // 위치 (예: '본관 2층', '신관 1층')
  assignedTeacherName?: string; // 당해년도 담당 교사 성명
  assignedTeacherEmail?: string; // 당해년도 담당 교사 이메일
  teacherName?: string; // assignedTeacherName 호환용
  teacherEmail?: string; // assignedTeacherEmail 호환용
  assignedTeacherRole?: string; // 담임, 교과교사 등
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;

  // 차년도 학급 및 시설 매핑 필드 (시스템 설정 조직도 연동)
  targetYear?: number; // 기준 학년도 (예: 2026)
  nextYear?: number; // 차년도 (예: 2027)
  nextYearName?: string; // 차년도 시설(학급)명 (예: '1학년 1반', '제1과학실')
  nextYearFullName?: string; // 차년도 전체 표기
  nextYearGrade?: number; // 차년도 학년
  nextYearClassNum?: number; // 차년도 반
  nextYearLocation?: string; // 차년도 위치
  nextYearTeacherName?: string; // 차년도 인수(담당) 교사 성명
  nextYearTeacherEmail?: string; // 차년도 인수(담당) 교사 이메일
}

export interface MonthlyInspectionRecord {
  id: string; // `${yearMonth}_${facilityId}`
  yearMonth: string; // 'YYYY-MM' (예: '2026-10')
  facilityId: string;
  facilityName: string;
  grade?: number;
  classNum?: number;
  category: SchoolFacilityCategory;
  assignedTeacherName: string;
  assignedTeacherEmail: string;
  inspectorName: string;
  inspectorEmail: string;
  inspectionDate: string; // YYYY-MM-DD
  isCompleted: boolean;
  scores: Record<string, InspectionScore>; // { in_1: 'O', ... }
  notes?: string; // 비고
  needsFacilityTeamFix: boolean; // 시설관리팀(520) 연락/조치 필요 여부
  signature?: string; // 서명 (인) Base64 또는 텍스트 서명
  submittedAt: string;
  updatedAt?: string;
}

// 사용자 제공 학교생활 안전점검표 기반 기본 학교 시설 및 담당 교사 시드
export const DEFAULT_SCHOOL_FACILITIES: SchoolFacility[] = [
  // 1학년 (1~4반, 특별실 3개)
  { id: 'fac_1_1', name: '1반', fullName: '1학년 1반', category: 'classroom', grade: 1, classNum: 1, location: '본관 1층', assignedTeacherName: '정유진', order: 101, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_1_2', name: '2반', fullName: '1학년 2반', category: 'classroom', grade: 1, classNum: 2, location: '본관 1층', assignedTeacherName: '김주연', order: 102, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_1_3', name: '3반', fullName: '1학년 3반', category: 'classroom', grade: 1, classNum: 3, location: '본관 1층', assignedTeacherName: '오혜령', order: 103, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_1_4', name: '4반', fullName: '1학년 4반', category: 'classroom', grade: 1, classNum: 4, location: '본관 1층', assignedTeacherName: '배유미', order: 104, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_1_eng', name: '영어1실', fullName: '영어1실', category: 'special', grade: 1, location: '본관 1층', assignedTeacherName: '전은지', order: 105, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_1_sci', name: '과학실', fullName: '과학실', category: 'special', grade: 1, location: '본관 1층', assignedTeacherName: '김경훈', order: 106, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_1_gym', name: '소체육실', fullName: '소체육실', category: 'special', grade: 1, location: '본관 1층', assignedTeacherName: '김남연', order: 107, isActive: true, createdAt: '2026-03-01' },

  // 2학년 (1~4반, 특별실 3개)
  { id: 'fac_2_1', name: '1반', fullName: '2학년 1반', category: 'classroom', grade: 2, classNum: 1, location: '본관 2층', assignedTeacherName: '김오경', order: 201, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_2_2', name: '2반', fullName: '2학년 2반', category: 'classroom', grade: 2, classNum: 2, location: '본관 2층', assignedTeacherName: '박정남', order: 202, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_2_3', name: '3반', fullName: '2학년 3반', category: 'classroom', grade: 2, classNum: 3, location: '본관 2층', assignedTeacherName: '이윤미', order: 203, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_2_4', name: '4반', fullName: '2학년 4반', category: 'classroom', grade: 2, classNum: 4, location: '본관 2층', assignedTeacherName: '조현수', order: 204, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_2_eng', name: '영어4실', fullName: '영어4실', category: 'special', grade: 2, location: '본관 2층', assignedTeacherName: '송다혜', order: 205, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_2_bear', name: '베어교실', fullName: '베어교실', category: 'special', grade: 2, location: '본관 2층', assignedTeacherName: '강영란', order: 206, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_2_incl', name: '통합교육실', fullName: '통합교육실', category: 'special', grade: 2, location: '본관 2층', assignedTeacherName: '박지아', order: 207, isActive: true, createdAt: '2026-03-01' },

  // 3학년 (1~4반, 특별실 3개)
  { id: 'fac_3_1', name: '1반', fullName: '3학년 1반', category: 'classroom', grade: 3, classNum: 1, location: '본관 3층', assignedTeacherName: '권예림', order: 301, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_3_2', name: '2반', fullName: '3학년 2반', category: 'classroom', grade: 3, classNum: 2, location: '본관 3층', assignedTeacherName: '오형석', order: 302, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_3_3', name: '3반', fullName: '3학년 3반', category: 'classroom', grade: 3, classNum: 3, location: '본관 3층', assignedTeacherName: '이서정', order: 303, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_3_4', name: '4반', fullName: '3학년 4반', category: 'classroom', grade: 3, classNum: 4, location: '본관 3층', assignedTeacherName: '김채원', order: 304, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_3_music', name: '음악실', fullName: '음악실', category: 'special', grade: 3, location: '본관 3층', assignedTeacherName: '이숙형', order: 305, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_3_ai', name: 'AI실', fullName: 'AI실', category: 'special', grade: 3, location: '본관 3층', assignedTeacherName: '윤한수', order: 306, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_3_lib', name: '도서관', fullName: '도서관', category: 'special', grade: 3, location: '본관 3층', assignedTeacherName: '김효주', order: 307, isActive: true, createdAt: '2026-03-01' },

  // 4학년 (1~5반, 특별실 2개)
  { id: 'fac_4_1', name: '1반', fullName: '4학년 1반', category: 'classroom', grade: 4, classNum: 1, location: '신관 2층', assignedTeacherName: '이경진', order: 401, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_4_2', name: '2반', fullName: '4학년 2반', category: 'classroom', grade: 4, classNum: 2, location: '신관 2층', assignedTeacherName: '진중식', order: 402, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_4_3', name: '3반', fullName: '4학년 3반', category: 'classroom', grade: 4, classNum: 3, location: '신관 2층', assignedTeacherName: '강아라', order: 403, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_4_4', name: '4반', fullName: '4학년 4반', category: 'classroom', grade: 4, classNum: 4, location: '신관 2층', assignedTeacherName: '김현희', order: 404, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_4_5', name: '5반', fullName: '4학년 5반', category: 'classroom', grade: 4, classNum: 5, location: '신관 2층', assignedTeacherName: '박은솔', order: 405, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_4_eng', name: '영어실', fullName: '영어실', category: 'special', grade: 4, location: '신관 2층', assignedTeacherName: '박지영', order: 406, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_4_gym', name: '체육관', fullName: '체육관', category: 'special', grade: 4, location: '체육관동', assignedTeacherName: '김태현', order: 407, isActive: true, createdAt: '2026-03-01' },

  // 5학년 (1~6반, 특별실 2개)
  { id: 'fac_5_1', name: '1반', fullName: '5학년 1반', category: 'classroom', grade: 5, classNum: 1, location: '신관 3층', assignedTeacherName: '정다운', order: 501, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_5_2', name: '2반', fullName: '5학년 2반', category: 'classroom', grade: 5, classNum: 2, location: '신관 3층', assignedTeacherName: '최선미', order: 502, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_5_3', name: '3반', fullName: '5학년 3반', category: 'classroom', grade: 5, classNum: 3, location: '신관 3층', assignedTeacherName: '조현준', order: 503, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_5_4', name: '4반', fullName: '5학년 4반', category: 'classroom', grade: 5, classNum: 4, location: '신관 3층', assignedTeacherName: '정세훈', order: 504, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_5_5', name: '5반', fullName: '5학년 5반', category: 'classroom', grade: 5, classNum: 5, location: '신관 3층', assignedTeacherName: '차유빈', order: 505, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_5_6', name: '6반', fullName: '5학년 6반', category: 'classroom', grade: 5, classNum: 6, location: '신관 3층', assignedTeacherName: '정혜진', order: 506, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_5_gym', name: '체육관', fullName: '체육관(5학년)', category: 'special', grade: 5, location: '체육관동', assignedTeacherName: '강지욱', assignedTeacherEmail: 'beside1s@kshcm.net', order: 507, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_5_health', name: '보건실', fullName: '보건실', category: 'special', grade: 5, location: '본관 1층', assignedTeacherName: '양선경', order: 508, isActive: true, createdAt: '2026-03-01' },

  // 6학년 (1~6반, 특별실 2개)
  { id: 'fac_6_1', name: '1반', fullName: '6학년 1반', category: 'classroom', grade: 6, classNum: 1, location: '신관 4층', assignedTeacherName: '박진성', order: 601, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_6_2', name: '2반', fullName: '6학년 2반', category: 'classroom', grade: 6, classNum: 2, location: '신관 4층', assignedTeacherName: '홍영도', order: 602, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_6_3', name: '3반', fullName: '6학년 3반', category: 'classroom', grade: 6, classNum: 3, location: '신관 4층', assignedTeacherName: '이한영', order: 603, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_6_4', name: '4반', fullName: '6학년 4반', category: 'classroom', grade: 6, classNum: 4, location: '신관 4층', assignedTeacherName: '장진철', order: 604, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_6_5', name: '5반', fullName: '6학년 5반', category: 'classroom', grade: 6, classNum: 5, location: '신관 4층', assignedTeacherName: '김홍빈', order: 605, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_6_6', name: '6반', fullName: '6학년 6반', category: 'classroom', grade: 6, classNum: 6, location: '신관 4층', assignedTeacherName: '양유정', order: 606, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_6_counsel', name: '상담실', fullName: '상담실(위클래스)', category: 'special', grade: 6, location: '신관 1층', assignedTeacherName: '최수연', order: 607, isActive: true, createdAt: '2026-03-01' },
  { id: 'fac_6_com1', name: '컴퓨터1실', fullName: '컴퓨터1실', category: 'special', grade: 6, location: '신관 4층', assignedTeacherName: '김나영', order: 608, isActive: true, createdAt: '2026-03-01' },
];
