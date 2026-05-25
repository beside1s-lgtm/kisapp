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
  studentGrade?: string;
  studentClass?: string;
  studentNumber?: string;
  hasUnreadInboxNotification?: boolean;
};

export type AbsenceType = '병결' | '미인정' | '기타' | '출석인정';
export type TripType = '가족동반여행' | '친인척 방문' | '답사·견학 활동' | '체험활동' | '기타';

export type ParentFormData = {
  type: 'absence' | 'field-trip';
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
};

export interface Department {
  id: string; // 부서 고유 ID
  name: string; // 부서명 (예: 문예방과후부)
  headEmail: string | null; // 부장 교사 이메일
  memberEmails: string[]; // 부원 교사 이메일 배열
}

export type OrgStructure = {
  principal: string; // email
  vicePrincipal: string; // email
  gradeHeads: { [grade: string]: string }; // "1" -> email
  homerooms: { [gradeClass: string]: string }; // "1-1" -> email
  departments?: Department[]; // 행정 부서
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

export type ApprovalDocPayload = {
  title: string;
  content: string;
  docType: 'internal' | 'external' | 'parent' | 'teacher-duty' | 'teacher-overtime';
  category?: 'draft' | 'family'; 
  // [수정] 실제 사용되는 값인 한글로 타입 변경 ('public' | 'private' -> '공개' | '비공개')
  publishStatus: '공개' | '비공개' | '부분공개'; 
  parentFormData?: ParentFormData;
  teacherDutyData?: TeacherDutyData;
  teacherOvertimeData?: TeacherOvertimeData;
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