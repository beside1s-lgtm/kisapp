export type FixtureRoomType = 'CLASSROOM' | 'SPECIAL_ROOM';

export interface FixtureItem {
  id: string;
  itemNo: number; // 1, 2, 3...
  name: string; // 비품명 (예: TV, 교사용 컴퓨터, ...)
  quantity: number | string; // 수량 (예: 1, 18, ...)
  note: string; // 비고 (이상이 있는 경우 기재)
}

export type FixtureHandoverStatus =
  | 'DRAFT' // 임시 저장
  | 'SUBMITTED' // (레거시 호환) 제출 완료
  | 'SUBMITTED_WAITING_SUCCESSOR' // 1단계: 후임 인수자 확인 대기 (후임자에게 전달됨)
  | 'SUBMITTED_WAITING_ACADEMIC_HEAD' // 2단계: 인수자 확인 완료 → 교무부장 확인 대기
  | 'READY_FOR_VP_APPROVAL' // 3단계: 교무부장 일괄 상신 → 교감 결재 대기
  | 'APPROVED' // 4단계: 교감 최종 입회(결재) 완료
  | 'REJECTED'; // 반려/수정요청

export interface FixtureHandoverDocument {
  id: string;
  year: number; // 현재 학년도 (예: 2025 또는 2026)
  targetNextYear: number; // 차기 학년도 (예: 2026 또는 2027)
  type: FixtureRoomType; // 'CLASSROOM' | 'SPECIAL_ROOM'
  grade?: string; // 학년 (예: '3')
  classNum?: string; // 반 (예: '1')
  roomName?: string; // 특별실명 (예: '제1과학실', '체육관', '음악1실')

  // 차년도 학급/특별실 명칭 (시스템 설정 [시설 및 학급] 매핑 연동)
  nextYearGrade?: string;
  nextYearClassNum?: string;
  nextYearRoomName?: string;

  items: FixtureItem[];
  windowsPassword?: string; // ★ 윈도우 로그인 비번 (기본값: '없음')

  handoverDate: string; // 일자 (YYYY-MM-DD)

  // 인계자 (작성자)
  authorEmail: string;
  authorName: string;
  authorRole?: string; // 직 (기본: '교사')
  authorSignature?: string; // 서명 텍스트 또는 이미지

  // 인수자 (후임자)
  successorEmail?: string;
  successorName?: string;
  successorRole?: string; // 직 (기본: '교사')
  successorSignature?: string;
  successorChecked?: boolean; // 인수자 수신 확인 여부
  successorCheckedAt?: string;

  // 교무부장 확인
  academicHeadEmail?: string;
  academicHeadName?: string;
  academicHeadChecked?: boolean;
  academicHeadCheckedAt?: string;

  // 입회자 (교감)
  vicePrincipalEmail?: string;
  vicePrincipalName?: string;
  vicePrincipalRole?: string; // 직 (기본: '교감')
  vicePrincipalSignature?: string;

  status: FixtureHandoverStatus;
  rejectionReason?: string;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FixtureTemplate {
  id: string; // scopeKey (예: "classroom_3_1" 또는 "special_제1과학실")
  scopeType: FixtureRoomType;
  scopeKey: string;
  grade?: string;
  classNum?: string;
  roomName?: string;
  items: FixtureItem[];
  windowsPassword?: string;
  updatedAt: string;
  updatedBy: string; // email
  updatedByName?: string;
}

// 첨부 PDF 서식 기준 기본 13개 비품 항목 청사진
export const DEFAULT_FIXTURE_ITEMS: Omit<FixtureItem, 'id'>[] = [
  { itemNo: 1, name: 'TV', quantity: 1, note: '' },
  { itemNo: 2, name: '교사용 컴퓨터', quantity: 1, note: '' },
  { itemNo: 3, name: '교사용 모니터', quantity: 1, note: '' },
  { itemNo: 4, name: '프린터기', quantity: 1, note: '' },
  { itemNo: 5, name: '실물화상기', quantity: 1, note: '' },
  { itemNo: 6, name: '리모컨', quantity: 2, note: '' },
  { itemNo: 7, name: '교사용 책상', quantity: 1, note: '' },
  { itemNo: 8, name: '교사용 의자', quantity: 1, note: '' },
  { itemNo: 9, name: '교사용 캐비넷', quantity: 1, note: '' },
  { itemNo: 10, name: '사무용 의자', quantity: 4, note: '' },
  { itemNo: 11, name: '테이블', quantity: 1, note: '' },
  { itemNo: 12, name: '학생용 책상', quantity: 18, note: '' },
  { itemNo: 13, name: '학생용 의자', quantity: 18, note: '' },
];
