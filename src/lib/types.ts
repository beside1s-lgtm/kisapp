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
  dept?: string; // 소속 (학년/부서)
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
    date: string; // YYYY-MM-DD
    title: string;
    type: 'HOLIDAY' | 'PUBLIC_HOLIDAY' | 'SCHOOL_EVENT'; // 휴업일 | 공휴일 | 학교 행사 (수업일 O)
    isSchoolDay: boolean; // 수업일 포함 여부 (HOLIDAY, PUBLIC_HOLIDAY -> false, SCHOOL_EVENT -> true)
    isParentPrivate?: boolean; // 학부모 비공개 여부 (기본값: false / 체크 시 교직원 전용)
}

export interface AcademicSemesterPeriod {
    id: string; // "sem1" | "vacationSummer" | "sem2" | "vacationWinter"
    name: string; // "1학기", "여름방학", "2학기", "겨울방학"
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    type: 'regular' | 'vacation';
}

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
    publishedVersion?: number; // 공유 동기화 버전
    lastPublishedAt?: string; // 전체 사용자 공유 발송 시각 ISO
}

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
};

export type Department = {
  id: string; // 부서 고유 ID
  name: string; // 부서명 (예: 문예방과후부)
  headEmail: string | null; // 부장 교사 이메일
  memberEmails: string[]; // 부원 교사 이메일 배열
}

export type SubjectTeacherGroup = {
  id: string;
  categoryName: string; // 예: "체육전담", "영어전담", "음악전담" 등
  teacherEmails: string[];
};

export type OrgStructure = {
  principal: string; // email
  vicePrincipal: string; // email
  gradeHeads: { [grade: string]: string }; // "1" -> email
  homerooms: { [gradeClass: string]: string }; // "1-1" -> email
  departments?: Department[]; // 행정 부서
  afterschoolManager?: string; // 구버전 이메일 (호환성용)
  busManager?: string; // 구버전 이메일 (호환성용)
  afterschoolManagers?: string[]; // 방과후학교 담당자들 (이메일 배열)
  busManagers?: string[]; // 스쿨버스 담당자들 (이메일 배열)
  systemManagers?: string[]; // 시스템 설정 담당자들 (이메일 배열)
  healthTeachers?: string[]; // 보건교사들 (이메일 배열)
  specialTeachers?: string[]; // 특수교사들 (이메일 배열)
  librarianTeachers?: string[]; // 사서교사들 (이메일 배열)
  subjectTeacherGroups?: SubjectTeacherGroup[]; // 교과전담교사 그룹 (과목명 커스텀 등록 + 담당 선생님 지정)
};

export interface DelegationRule {
  id: string;
  mainType: string; // 복무 대분류 (예: 휴가, 41조 연수, 출장)
  subType: string; // 중분류 (예: 연가, 공가, 병가, 관내, 관외)
  detailType: string; // 소분류 (예: 조퇴, 지참, 육아시간 등)
  finalApprover: 'VP' | 'PRINCIPAL'; // 최종 결재권자 (교감, 교장)
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