export type UserProfile = {
  uid: string;
  email: string;
  name: string;
  role: string;
  signature?: string;
  isAdmin?: boolean;
  annualLeaveLimit?: number; // 개인별 연가 한도 (미설정 시 기본값 21일 적용)
  parentPhone?: string;
  parentSignature?: string;
  hashedPin?: string;
  parentName?: string;
  studentName?: string;
  studentNameEn?: string;
  studentGrade?: string;
  studentClass?: string;
  studentNumber?: string;
  residenceDestinationId?: string;
  customResidenceDestination?: string;
  address?: string;
  linkedStudents?: {
    id: string;
    nameKo: string;
    nameEn: string;
    grade: string;
    studentClass: string;
    studentNumber?: string;
    gender?: 'Male' | 'Female';
  }[];
  hasUnreadInboxNotification?: boolean;
  dept?: string; // 소속 부서 (예: 교무기획부)
  grade?: string; // 소속 학년 (예: 3학년)
  lastAckAcademicCalVersion?: number; // 캘린더 공유 팝업 확인 완료 버전 (계정당 1회 팝업 보장)
};

export type AbsenceType = '병결' | '미인정' | '기타' | '출석인정';
export type TripType = '가족동반여행' | '친인척 방문' | '답사·견학 활동' | '체험활동' | '기타';

export type ParentFormData = {
  type: 'absence' | 'field-trip' | 'field-trip-report';
  studentName: string;
  gradeClassNumber: string;
  
  // 결석계 전용
  absencePeriod?: { startDate: string; endDate: string; totalDays: number };
  absenceType?: AbsenceType;
  absenceReason?: string;
  teacherConfirmMethod?: string;
  teacherConfirmDate?: string;
  
  // 체험학습 전용
  phone?: string;
  tripPeriod?: { startDate: string; endDate: string; totalDays: number };
  cumulativeDays?: number;
  tripType?: TripType;
  destination?: string;
  companionName?: string;
  companionRelation?: string;
  purpose?: string;
  detailedPlan?: string;

  // 체험학습 결과보고서 전용
  relatedApplyDocId?: string;
  reportTitle?: string;
  reportContent?: string;
  reportSubmitted?: boolean;
  reportSubmittedAt?: string;
};

export type Approver = {
  name: string;
  email: string;
  role: string;
  type: 'normal' | 'final' | 'proxy';
  status: 'pending' | 'approved' | 'rejected'; 
  approverName?: string;
  signature?: string;
  approvedAt?: string;
  comment?: string; 
};

export type Attachment = {
  name: string;
  data: string;
  size?: number;
};

export type Circular = {
    name: string;
    email: string;
};

export interface AcademicEvent {
    id: string;
    date: string; // 시작일 YYYY-MM-DD
    endDate?: string; // 종료일 YYYY-MM-DD (기간 일정인 경우)
    title: string;
    type: 'HOLIDAY' | 'PUBLIC_HOLIDAY' | 'SCHOOL_EVENT'; // 휴업일 | 공휴일 | 학교 행사 (수업일 O)
    isSchoolDay: boolean; // 수업일 포함 여부 (HOLIDAY, PUBLIC_HOLIDAY -> false, SCHOOL_EVENT -> true)
    isParentPrivate?: boolean; // 학부모 비공개 여부 (기본값: false / 체크 시 교직원 전용)
    targetGroupType?: CalendarSyncTargetType; // 'all' | 'dept' | 'grade'
    targetGrade?: string; // 특정 학년 대상 (예: '1학년')
    targetDept?: string; // 특정 부서 대상 (예: '예체능방과후부')
}

export type CalendarSyncTargetType = 'all' | 'dept' | 'grade';

export interface DepartmentWeeklySchedule {
    id: string;
    deptName: string; // 부서명 (예: 문예방과후부, 교육과정부 등)
    creatorEmail: string; // 등록한 부장 이메일
    creatorName: string; // 부장 이름
    title: string; // 일정 제목 / 업무 내용
    startDate: string; // 시작일 (YYYY-MM-DD)
    endDate: string; // 종료일 (YYYY-MM-DD)
    content?: string; // 상세 내용 / 비고 (장소, 시간 등)
    isWeeklyEvent?: boolean; // 주간 행사에 반영 여부 (상단 요일별 칸)
    isWeeklyDeptContent?: boolean; // 주간 교육 내용에 반영 여부 (부서별 칸)
    isWeeklySchedule?: boolean; // 하위 호환용 주간 일정 반영 여부
    isMonthlySchedule?: boolean; // 월간교육계획 및 월간 일정 반영 여부
    sendToAcademicCalendar: boolean; // 학사일정으로 전송 여부 (체크 시 구성원의 캘린더 일정에 추가)
    syncTargetType?: CalendarSyncTargetType; // 'all' | 'dept' | 'grade'
    syncTargetGrade?: string; // 특정 학년 (예: '1학년', '유치원' 등)
    isMainSchoolSchedule: boolean; // 주요 학교 일정으로 공개 여부 (체크 시 대시보드 주요 학교 일정 전체 공개)
    createdAt: string;
}

export interface DepartmentWeeklyProposal {
    id: string;
    deptName: string; // 부서명
    submitterEmail: string; // 제안한 부서원 이메일
    submitterName: string; // 제안한 부서원 이름
    title: string; // 일정/업무 제목
    startDate: string; // 희망 시작일 (YYYY-MM-DD)
    endDate: string; // 희망 종료일 (YYYY-MM-DD)
    content?: string; // 상세 업무 내용 / 부장 검토 요청 사항
    isWeeklyEvent?: boolean; // 주간 행사 반영 희망
    isWeeklyDeptContent?: boolean; // 주간 교육 내용 반영 희망
    isMonthlySchedule?: boolean; // 월간 계획 반영 희망
    status: 'pending' | 'approved' | 'closed_internal' | 'rejected'; // 대기 | 부서일정 승인반영 | 부서내종결 | 반려
    reviewComment?: string; // 부장의 검토 의견
    reviewedBy?: string; // 검토한 부장 이름
    reviewedAt?: string; // 검토 시각
    createdAt: string;
}

export interface AcademicSemesterPeriod {
    id: string; // "sem1" | "vacationSummer" | "sem2" | "vacationWinter"
    name: string; // "1학기", "여름방학", "2학기", "겨울방학"
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    type: 'regular' | 'vacation';
}

export interface ClassPeriodSchedule {
    id: string;
    name: string; // 예: "1교시", "2교시", "점심시간", "5교시", "방과후 1차시"
    startTime: string; // 예: "08:30"
    endTime: string; // 예: "09:10"
    type?: 'class' | 'break' | 'lunch' | 'afterschool' | 'other';
}

export const DEFAULT_PERIOD_SCHEDULES: ClassPeriodSchedule[] = [
    { id: 'p-1', name: '1교시', startTime: '08:30', endTime: '09:10', type: 'class' },
    { id: 'p-2', name: '2교시', startTime: '09:20', endTime: '10:00', type: 'class' },
    { id: 'p-3', name: '3교시', startTime: '10:20', endTime: '11:00', type: 'class' },
    { id: 'p-4', name: '4교시', startTime: '11:10', endTime: '11:50', type: 'class' },
    { id: 'p-lunch', name: '점심시간 & 휴식', startTime: '11:50', endTime: '12:40', type: 'lunch' },
    { id: 'p-5', name: '5교시', startTime: '12:40', endTime: '13:20', type: 'class' },
    { id: 'p-6', name: '6교시', startTime: '13:30', endTime: '14:10', type: 'class' },
    { id: 'p-after-1', name: '방과후 1차시', startTime: '14:30', endTime: '15:10', type: 'afterschool' },
    { id: 'p-after-2', name: '방과후 2차시', startTime: '15:20', endTime: '16:00', type: 'afterschool' },
];

export interface AcademicCalendarConfig {
    year: number; // e.g. 2026
    annualSchoolDays: number; // e.g. 190
    semesters: {
        sem1: AcademicSemesterPeriod;
        vacationSummer: AcademicSemesterPeriod;
        sem2: AcademicSemesterPeriod;
        vacationWinter: AcademicSemesterPeriod;
    };
    events: AcademicEvent[]; // 휴업일, 공휴일, 학교 행사 목록
    periodSchedules?: ClassPeriodSchedule[]; // 교시별 일과 수업 시간대 설정
    publishedVersion?: number; // 공유 동기화 버전
    lastPublishedAt?: string; // 전체 사용자 공유 발송 시각 ISO
}

export interface FieldTripBlackoutPeriod {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason: string;    // e.g. "개학·입학식 실시 후 7일"
}

export const DEFAULT_FIELD_TRIP_BLACKOUT_PERIODS: FieldTripBlackoutPeriod[] = [
  { id: 'bp-1', startDate: '2026-03-02', endDate: '2026-03-06', reason: '개학·입학식 실시 후 7일' },
  { id: 'bp-2', startDate: '2026-04-17', endDate: '2026-04-23', reason: '재량휴업일 실시 전 7일' },
  { id: 'bp-3', startDate: '2026-05-04', endDate: '2026-05-08', reason: '재량휴업일 실시 후 7일' },
  { id: 'bp-4', startDate: '2026-07-08', endDate: '2026-07-14', reason: '여름방학 실시 전 7일' },
  { id: 'bp-5', startDate: '2026-08-18', endDate: '2026-08-24', reason: '개학식 후 7일' },
  { id: 'bp-6', startDate: '2026-10-12', endDate: '2026-10-16', reason: '재량휴업일 실시 전 7일' },
  { id: 'bp-7', startDate: '2026-10-26', endDate: '2026-10-30', reason: '재량휴업일 실시 후 7일' },
  { id: 'bp-8', startDate: '2027-01-04', endDate: '2027-01-07', reason: '졸업식, 종업식 전 7일' },
];

export type DocConfig = {
    address?: string;
    phone?: string;
    fax?: string;
    email?: string;
    homepage?: string;
    nextNumber?: number;
    nextFamilyNumber?: number; 
    headerImage?: string;
    slogan?: string;
    afterschoolFeePerSession?: number; // 차시별 고정 수강료
    isBusApplyActive?: boolean; // 학부모 스쿨버스 신청 활성화 여부
    isAfterschoolApplyActive?: boolean; // 학부모 방과후학교 신청 활성화 여부
    afterschoolAccount?: string; // 방과후학교 납부 계좌 정보
    afterschoolQrImage?: string; // 방과후학교 납부 QR 이미지 데이터 URL
    annualSchoolDays?: number; // 연간 총 수업일수 설정
    academicCalendar?: AcademicCalendarConfig; // 통합 학사 일정 및 학기 관리
    enableAiDraft?: boolean; // 기안문 작성 화면 내 AI 초안 생성 기능 활성화 여부
    afterschoolStageStatus?: 'RECRUITING' | 'APPLYING' | 'CONFIRMED' | 'OPERATING' | 'CLOSED';
    isAfterschoolFinalized?: boolean; // 수강신청 최종 확정 여부
    afterschoolFinalizedAt?: string; // 최종 확정 일시
    fieldTripBlackoutPeriods?: FieldTripBlackoutPeriod[]; // 체험학습 불인정(신청 불가) 기간 설정
};

export type DepartmentTaskAssignment = {
  id: string;
  taskName: string; // 담당 업무명 (예: '학적 관리', '교육과정 편성', '스쿨버스 운영' 등)
  assignedEmails?: string[]; // 해당 업무 담당자 이메일 목록 (부장/부원 중 배정)
  description?: string; // 업무 세부 설명
};

export type Department = {
  id: string; // 부서 고유 ID
  name: string; // 부서명 (예: 문예방과후부)
  headEmail: string | null; // 부장 교사 이메일
  memberEmails: string[]; // 부원 교사 이메일 배열
  tasks?: DepartmentTaskAssignment[]; // 부서 내 담당 업무 목록
};

export type SubjectTeacherGroup = {
  id: string;
  categoryName: string; // 예: "체육전담", "영어전담", "음악전담" 등
  teacherEmails: string[];
};

export type DutyRoleAttendanceScope = {
  type: 'all' | 'assigned_grade' | 'assigned_class' | 'specific_grades';
  grades?: number[]; // 특정 학년 직접 지정 시 (예: [1, 2])
};

export type DutyRolePermission = {
  features?: string[]; // 예: afterschool_admin, bus_admin, student_admin, duty_admin, system_admin
  documents?: string[]; // 예: doc_absence, doc_fieldtrip, doc_registry, doc_approval, doc_audit
  attendanceScope?: DutyRoleAttendanceScope; // 결석계/체험학습 학년·학급별 문서 접근 범위
};

export type CustomDutyRole = {
  id: string;
  roleName: string; // 업무/직책 명칭 (예: '영재교육 담당', '정보보안 담당', '학교폭력 전담' 등)
  deptName?: string; // 소속 부서명 (예: '연구기획부', '교무기획부' 등)
  teacherEmails: string[]; // 담당 교사 이메일 목록
  permissions?: DutyRolePermission; // 해당 업무에 부여된 기능/문서 권한
};

export type OrgStructure = {
  principal: string; // email
  vicePrincipal: string; // email
  academicHead?: string; // 교무부장 email
  gradeHeads: { [grade: string]: string }; // "1" -> email
  homerooms: { [gradeClass: string]: string }; // "1-1" -> email
  gradeSubjects?: { [grade: string]: string[] }; // "1" -> [email1, email2] (학년별 교과 담당 교사)
  departments?: Department[]; // 행정 부서
  afterschoolManager?: string; // 구버전 이메일 (호환성용)
  busManager?: string; // 구버전 이메일 (호환성용)
  afterschoolManagers?: string[]; // 방과후학교 담당자들 (이메일 배열)
  busManagers?: string[]; // 스쿨버스 담당자들 (이메일 배열)
  systemManagers?: string[]; // 시스템 설정 담당자들 (이메일 배열)
  peTeachers?: string[]; // 학교 체육 담당 교사들 (이메일 배열)
  healthTeachers?: string[]; // 보건교사들 (이메일 배열)
  specialTeachers?: string[]; // 특수교사들 (이메일 배열)
  librarianTeachers?: string[]; // 사서교사들 (이메일 배열)
  subjectTeacherGroups?: SubjectTeacherGroup[]; // 교과전담교사 그룹 (과목명 커스텀 등록 + 담당 선생님 지정)
  customDutyRoles?: CustomDutyRole[]; // 동적으로 추가된 업무 담당 직책 목록
  dutyRoleDepts?: { [roleKeyOrId: string]: string }; // 기본 직책 및 커스텀 직책별 소속 부서명 매핑
  dutyRolePermissions?: { [roleKeyOrId: string]: DutyRolePermission }; // 기본 직책 및 커스텀 직책별 권한 매핑
  deptMemberDuties?: { [deptId: string]: { [email: string]: string[] } }; // 부서별 부원에게 할당된 업무 목록
};

export interface DelegationRule {
  id: string;
  category?: string; // 대분류 (예: '학부모 출결', '일반 공문', '교원 복무')
  mainType: string; // 대분류 / 업무 구분
  subType: string; // 중분류 / 문서명 (예: '결석계', '체험학습신청서', '연간계획공문', '세부계획공문', '휴가', '출장')
  detailType: string; // 소분류 / 상세조건 (예: '일반/질병/인정', '교외체험', '조퇴', '관내', '관외' 등)
  intermediateApprover?: 'NONE' | 'GRADE_HEAD' | 'ACADEMIC_HEAD' | 'DEPT_HEAD'; // 중간 결재자 (없음, 학년부장, 교무부장, 담당부장)
  finalApprover: 'GRADE_HEAD' | 'ACADEMIC_HEAD' | 'DEPT_HEAD' | 'VP' | 'PRINCIPAL'; // 최종 결재권자 (학년부장 전결, 교무부장 전결, 담당부장 전결, 교감 전결, 교장 결재)
  description?: string; // 결재선 요약 또는 설명
}

export type StudyAbroadSchedule = {
  date: string;
  departure?: string;
  destination?: string;
  institution: string;
  content: string;
  note?: string;
};

export type StudyAbroadPlan = {
  affiliation: string;
  position: string;
  name: string;
  subject: string;
  purpose: string;
  category: string;
  categoryEtcDetail?: string;
  schedules: StudyAbroadSchedule[];
  effects: string;
};

export type Traveler = {
  name: string;
  email: string;
};

export type TravelItem = {
  date: string;
  startTime?: string;
  endTime?: string;
  subType: string; // 관내 | 관외 | 국외
  destination: string;
  reason: string;
  noExpensesPaid: boolean;
  useCompanyVehicle: boolean;
  travelers: Traveler[];
};

export type TeacherDutyData = {
  mainType: '휴가' | '41조 연수' | '출장';
  subType?: string;
  detailType?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  totalDays: number;
  reason: string;
  destination?: string;
  studyAbroadPlan?: StudyAbroadPlan;
  noExpensesPaid?: boolean;
  useCompanyVehicle?: boolean;
  travelItems?: TravelItem[];
};

export type TeacherOvertimeData = {
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  reason: string;
};

export type AfterschoolCourseData = {
  courseName: string;
  days: string[]; // ['월', '수'] (최대 2개)
  totalSessions: number;
  feePerSession: number;
  totalFee: number;
  minCapacity: number; // 폐강 기준 인원
  maxCapacity: number; // 모집 정원
  mainTeacherName: string;
  mainTeacherEmail: string;
  assistantTeachers: {
    name: string;
    email: string;
    role: string;
  }[];
  description?: string;
};

export type ApprovalDocPayload = {
  title: string;
  content: string;
  docType: 'internal' | 'external' | 'parent' | 'teacher-duty' | 'teacher-overtime' | 'teacher-afterschool';
  category?: 'draft' | 'family'; 
  // [수정] 실제 사용되는 값인 한글로 타입 변경 ('public' | 'private' -> '공개' | '비공개')
  publishStatus: '공개' | '비공개' | '부분공개'; 
  parentFormData?: ParentFormData;
  teacherDutyData?: TeacherDutyData;
  teacherOvertimeData?: TeacherOvertimeData;
  afterschoolCourseData?: AfterschoolCourseData;
  approvers: Approver[];
  attachments: Attachment[];
  circulars?: Circular[];
  receiverInfo?: { name: string; email?: string };
  headerImage?: string;
  footerInfo?: {
      address: string;
      phone: string;
      fax: string;
      email: string;
      homepage: string;
  };
};


export type ApprovalDoc = ApprovalDocPayload & {
  id: string;
  docNo: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterRole: string;
  requesterSignature: string;
  currentStep: number;
  status: 'pending' | 'approved' | 'rejected' | 'recalled';
  comment?: string;
  createdAt: any;
  completedAt?: any;
  updatedAt?: any;
};

// ─── 부서 및 학년 그룹 업무 할당 및 제출 관리 타입 ───────────────────────────
export type TargetGroupType = 'dept' | 'grade' | 'all' | 'custom';
export interface TaskScenarioItem {
  id: string;
  time: string;
  program: string;
  target?: string;
  rules?: string;
  preparations?: string;
  note?: string;
}

export interface TaskAttachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
  isGoogleDrive?: boolean;
  driveFileType?: 'doc' | 'sheet' | 'slide' | 'pdf' | 'folder' | 'file';
  driveFileId?: string;
}

export interface GoogleDriveConfig {
  enabled: boolean;
  rootFolderId: string;
  rootFolderUrl: string;
  sharedDriveName?: string;
  subFolders?: {
    approvalDoneId?: string;
    approvalDoneUrl?: string;
    taskWorkId?: string;
    taskWorkUrl?: string;
    absenceDoneId?: string;
    absenceDoneUrl?: string;
    fieldTripDoneId?: string;
    fieldTripDoneUrl?: string;
  };
  updatedAt?: string;
  updatedBy?: string;
}

export interface TaskSubmission {
  submitterEmail: string;
  submitterName: string;
  submittedAt: string;
  status: 'submitted' | 'approved' | 'rejected';
  fileName?: string;
  fileUrl?: string;
  linkUrl?: string; // 캔바(Canva), 노션, 구글 슬라이드 등 웹 공유 링크
  linkTitle?: string;
  note?: string;
  grade?: string;
  scenarios?: TaskScenarioItem[];
  attachments?: TaskAttachment[];
}

export interface DepartmentTask {
  id: string;
  title: string;
  description: string;
  attachments?: TaskAttachment[]; // 요청자가 등록한 참고자료 (이미지, PDF, 문서 등)
  creatorEmail: string;
  creatorName: string;
  creatorDept: string;
  targetType: TargetGroupType;
  targetDeptId?: string;
  targetGradeId?: string;
  targetEmails?: string[];
  targetNames?: Record<string, string>;
  taskType: 'file_submission' | 'acknowledgment' | 'simple_check' | 'text_response' | 'sheets_custom' | 'sheets_template' | 'html_draft';
  deadline: string;
  status: 'active' | 'closed';
  submissions?: Record<string, TaskSubmission>;
  category?: 'general' | 'event';
  eventDetails?: {
    eventType?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
    targetGrades?: string[];
    purpose?: string;
    schedules?: Array<{ id: string; time: string; program: string; location?: string; manager?: string }>;
    budgets?: Array<{ id: string; item: string; amount: number; note?: string }>;
    totalBudget?: number;
  };
  sheetsConfig?: {
    mode?: 'custom' | 'template' | 'html_draft';
    sheetUrl?: string;
    templateId?: string;
    templateName?: string;
    columns?: string[];
    autoDraftTable?: boolean;
  };
  eventSchedules?: any[]; // 체육행사 요일별/시간대별 일정표 연동
  delegatedHistory?: { fromEmail: string; toEmail: string; at: string; reason?: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface MeetingAgendaItem {
  id: string;
  title: string; // 안건명
  proposer: string; // 제안자
  description: string; // 안건 제안 설명
}

// ─── 주간교육계획 (학교 전체 종합 주간 업무 및 행사 계획서) ───────────────────────────
export interface WeeklyEducationPlan {
  id: string; // 예: 'plan_2026-08-17' (해당 주의 월요일 날짜 기준)
  academicYear: number; // 학년도 (예: 2026)
  month: number; // 월 (예: 8)
  weekOfMonth: number; // 해당 월의 주차 (예: 3)
  startDate: string; // 시작일(월요일, YYYY-MM-DD)
  endDate: string; // 종료일(토요일, YYYY-MM-DD)
  title: string; // 예: '유초등 주간교육계획 (2026학년도 8월 3주)'
  dailyEvents: { [dateStr: string]: string[] }; // 날짜별 주요 행사 목록
  deptContents: { [deptName: string]: string }; // 부서별 주간 교육 및 업무 내용
  meetingAgenda?: {
    title: string;
    proposer: string;
    description: string;
  };
  meetingAgendas?: MeetingAgendaItem[]; // 다중 회의 안건 목록
  leadershipFeedback?: {
    vp?: string; // 교감 선생님 의견
    principal?: string; // 교장 선생님 의견
  };
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
}

// ─── 월간교육계획 (학교 전체 종합 월간 교육활동 계획서) ───────────────────────────
export interface MonthlyEducationDayItem {
  day: number; // 1 ~ 31
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: string; // 월, 화, 수, 목, 금, 토, 일
  content: string; // 교육활동 내용 (부서명 없이 내용, 장소, 일시 등)
  note?: string; // 행사 / 비고
}

export interface MonthlyEducationPlan {
  id: string; // 예: 'plan_2026-06'
  academicYear: number; // 학년도 (예: 2026)
  year: number; // 연도 (예: 2026)
  month: number; // 월 (예: 6)
  title: string; // 예: '2026학년도 유초등 6월 월간 교육활동 계획'
  schoolDays?: number; // 수업일수 (예: 22)
  days: { [day: number]: { content: string; note?: string } }; // 날짜별 내용 및 비고
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
}