export type HandoverStatus =
  | 'DRAFT'
  | 'SUBMITTED_WAITING_ACADEMIC_HEAD'
  | 'SUBMITTED_WAITING_SUCCESSOR'
  | 'ASSIGNED_TO_SUCCESSOR'
  | 'SUCCESSOR_APPROVED'
  | 'READY_FOR_VP_APPROVAL'
  | 'VICE_PRINCIPAL_APPROVED'
  | 'ARCHIVED'
  | 'REVISION_REQUESTED'
  | 'REJECTED';

// 대기 상태 별칭 지원
export type HandoverStatusAlias = HandoverStatus | 'PENDING_SUCCESSOR_ASSIGNMENT';

export interface HandoverItemAttachment {
  name: string;
  url?: string;
  size?: number;
}

export type HandoverItemSourceType = 'approval' | 'department_task' | 'system_auto' | 'manual';

export type HandoverTimingKind = 'month' | 'semester' | 'vacation' | 'regular' | 'irregular';

export interface HandoverItem {
  id: string;
  documentId?: string; // 전자결재 기안 문서 연동 ID (optional)
  sourceType?: HandoverItemSourceType;
  systemTaskKey?: string; // 시스템 고정 업무 블루프린트 식별자
  dutyName?: string; // 유래한 시스템 담당 업무명
  documentTitle: string; // 업무명 또는 기안문서 제목
  docNo?: string; // 문서 번호
  category: string; // 업무 분류 (예: '교무기획', '학생안전', '연구기획', '출결관리', '체육', '보건', '방과후', '일반업무')
  period: string; // 시기 그룹 (예: '3월 (신학기)', '1학기 (4~6월)', '1학기 말', '여름방학 (7~8월)', '2학기 (9~11월)', '학년말 (1월)', '겨울방학 (1~2월)', '정기 업무', '수시 / 미정기')
  scheduleLabel?: string; // 세부 처리 시기 표시 (특정 월·학기·방학·정기·미정기)
  timingKind?: HandoverTimingKind;
  sortOrder?: number; // 학년도 기준 시기 정렬 가중치
  date: string; // 작성일자 (YYYY-MM-DD, 시스템 고정 업무는 공백)
  displayDateTime?: string; // 부서/학년 업무 등의 표기 일시 (예: YYYY-MM-DD HH:mm)
  summary: string; // 주요 인계 사항 및 핵심 팁
  folderUrl?: string; // 관련 업무 드라이브/스토리지 폴더 URL 또는 내부 경로
  drivePath?: string; // 드라이브 경로
  attachments?: HandoverItemAttachment[];
  userEdited?: boolean;
  /** 사용자 추가/수정 항목이 향후 이 업무의 자동 타임라인 표준에도 반영되도록 연결할 때 사용 */
  customTemplateItemId?: string;
  includeInDutyTemplate?: boolean;
  isLearnedTemplateItem?: boolean;
  createdAt?: string;
}

export interface TeacherAssignment {
  id: string; // `${year}_${email}` 또는 고유 ID
  year: number; // 학년도 (예: 2026)
  teacherEmail: string;
  teacherName: string;
  department?: string; // 소속 부서
  primaryDuty: string; // 주 업무 (예: '학년 말 인수인계', '학생 안전지도', '출결 관리', '1학년 1반 담임')
  subDuties: string[]; // 부 업무 목록
  successorEmail?: string; // 차년도 업무 인수자 이메일
  successorName?: string; // 차년도 업무 인수자 성명
  dutySuccessors?: { [dutyName: string]: string }; // 업무별 차년도 인수자 이메일 매핑
  updatedAt?: string;
  updatedBy?: string;
}

/** 귀임 교원 재직기간 현황 1행 (학년도별) */
export interface HandoverServiceYearRow {
  schoolYear: number; // 학년도 (예: 2024)
  grade: string; // 학년
  homeroom: string; // 담임 학년-반 또는 전담교과
  department: string; // 소속 부서
  duty: string; // 담당 업무명
  note: string; // 비고
}

/** 귀임(올해 학교를 떠나는) 교원의 업무 인계·인수서 추가 기재 사항 */
export interface HandoverReturningInfo {
  koreaAddress: string; // 한국 주소
  koreaOriginalSchool: string; // 한국 원소속 (학교명)
  serviceStartDate: string; // 재직 시작일 (yyyy-MM-dd)
  serviceEndDate: string; // 재직 종료일 (yyyy-MM-dd)
  serviceYears: HandoverServiceYearRow[]; // 학년도별 재직 현황
}

export interface HandoverDocument {
  id: string;
  year: number; // 학년도 (예: 2026)
  authorEmail: string; // 인계자 이메일
  authorName: string; // 인계자 성명
  authorDepartment?: string;
  /** 인계자 서명(프로필 등록 도장/서명 이미지). 제출 시점에 저장 */
  authorSignature?: string;
  primaryDuty: string; // 인계 대상 주 업무명
  subDuties: string[]; // 인계 대상 부 업무 목록
  folderUrl?: string; // 전년도 업무 드라이브/스토리지 폴더 링크
  targetSuccessorEmail?: string; // 인수자 이메일
  targetSuccessorName?: string; // 인수자 성명
  status: HandoverStatus;
  items: HandoverItem[]; // 시기별/업무별 정리된 인계 항목 목록
  dismissedSystemTaskKeys?: string[]; // 사용자가 타임라인에서 제외한 시스템 고정 업무 키 목록
  generalGuide?: string; // 총괄 인계 사항, 연간 운영 팁, 주의사항
  contactInfo?: string; // 전임자 비상 연락처
  /** 귀임 교원 추가 기재 사항 (조직도 후임 설정에서 귀임 체크된 교원만) */
  returningInfo?: HandoverReturningInfo;
  
  // 상태 변경 및 결재 추적
  submittedAt?: string;
  assignedAt?: string;
  
  // 교무부장 확인 및 일괄 상신
  academicHeadEmail?: string;
  academicHeadName?: string;
  academicHeadReviewedAt?: string;

  // 인수자 서명 및 검토
  successorChecked?: boolean; // 인수자가 문서를 열람하거나 수신 확인 완료했는지 여부
  successorCheckedAt?: string; // 인수자 수신 확인 일시 ISO
  successorReviewedAt?: string;
  successorSignature?: string;
  successorComment?: string;

  // 교감 최종 승인
  vicePrincipalEmail?: string;
  vicePrincipalName?: string;
  vicePrincipalReviewedAt?: string;
  vicePrincipalSignature?: string;
  vicePrincipalComment?: string;

  // 반려 및 수정 요청 추적
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  revisionRequestReason?: string;
  revisionRequestedAt?: string;
  revisionRequestedBy?: string;
  revisionRequestedByRole?: string;

  // 교감/교무부장 직접 수정 추적
  lastEditedByEmail?: string;
  lastEditedByName?: string;
  lastEditedByRole?: string;
  lastEditedAt?: string;
  
  // 아카이빙
  archivedAt?: string;
  archivedTargetYear?: number; // 결재완료 문서가 저장된 차년도 학년도 (예: 2027)
  archivedFolderUrl?: string; // 아카이빙 폴더 또는 업무 폴더 링크
  archivedDriveFileId?: string; // Google Drive에 업로드된 결재완료 인수인계서 파일 ID
  archivedDriveFileUrl?: string; // Google Drive 결재완료 인수인계서 열람 링크
  archivedDriveFolderId?: string; // Google Drive 차년도 인수인계 폴더 ID
  archivedDriveFolderUrl?: string; // Google Drive 차년도 인수인계 폴더 열람 링크
  archivedPdfSnapshot?: string; // A4 인쇄 포맷 스냅샷 HTML/데이터
  
  createdAt?: string;
  updatedAt?: string;
}

export interface HandoverNotice {
  active: boolean;
  year: number;
  title: string;
  message: string;
  requestedByEmail: string;
  requestedByName: string;
  requestedAt: string;
}

export interface HandoverPoolItem {
  id: string;
  userEmail: string;
  userName: string;
  documentId?: string;
  sourceType?: 'approval' | 'department_task' | 'manual';
  docNo?: string;
  documentTitle: string;
  category: string;
  date: string;
  displayDateTime?: string;
  summary: string;
  attachments?: HandoverItemAttachment[];
  folderUrl?: string;
  year: number;
  createdAt?: any;
}

export interface HandoverDutyTemplateItemOverride {
  systemTaskKey: string;
  period?: string;
  scheduleLabel?: string;
  timingKind?: HandoverTimingKind;
  sortOrder?: number;
  documentTitle?: string;
  category?: string;
  summary?: string;
  folderUrl?: string;
  updatedAt?: string;
}

export interface HandoverDutyTemplateAddedItem {
  id: string;
  documentTitle: string;
  category: string;
  period: string;
  scheduleLabel?: string;
  timingKind?: HandoverTimingKind;
  sortOrder?: number;
  summary: string;
  folderUrl?: string;
  updatedAt?: string;
}

export interface HandoverDutyTimelineTemplate {
  id: string;
  dutyName: string;
  normalizedDutyCore: string;
  itemOverrides: Record<string, HandoverDutyTemplateItemOverride>;
  hiddenSystemKeys: string[];
  addedItems: HandoverDutyTemplateAddedItem[];
  updatedByEmail?: string;
  updatedByName?: string;
  updatedAt?: string;
}
