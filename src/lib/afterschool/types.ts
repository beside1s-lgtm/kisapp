export type Role = 'admin' | 'teacher' | 'student';

export interface SyllabusSession {
  sessionNo: number; // 1~10
  dateStr: string;   // e.g. "03/30", "04/06"
  topic?: string;    // 수업 주제/내용
}

export interface Classroom {
  id: string;
  name: string;       // e.g. "1-1반 교실", "음악실", "체육관"
  capacity?: number;  // 수용 인원
  maxSimultaneousCourses?: number; // 동시 수업 가능 강좌 수 (기본값 1, 체육관 등은 2)
}

export interface SessionPeriod {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  type: 'SEMESTER' | 'VACATION';
}

export interface Course {
  id: string;
  title: string;
  category: string;
  instructorName?: string;
  instructor2?: string;        // 강사 2 (개별 필드, 쉼표 합산 금지)
  instructor3?: string;        // 강사 3
  instructor4?: string;        // 강사 4
  instructorPhone?: string;
  classTime: string;
  classroom?: string;       // 수업 장소 (Classroom.name)
  classroomId?: string;     // Classroom.id 참조
  maxStudents: number;
  currentStudents: number;
  maxWaiting: number;
  waitingStudents: number;
  tuition: number;
  textbookFee: number;
  materialFee: number;
  targetGrades?: any;
  description: string;
  status: 'PENDING' | 'OPEN' | 'CLOSED' | 'CANCELLED' | string; // PENDING = 개설 신청 대기
  isForceLocked?: boolean;
  kisbusDepartureTime?: string;
  period?: any;
  totalHours?: any;
  syllabusFile?: any;
  teacherId?: any;
  teacherName?: any;
  syllabusSessions?: SyllabusSession[];
  instructorSealUrl?: string;
  managerSealUrl?: string;
  vicePrincipalSealUrl?: string;
  classDays?: string[];        // 요일 목록 (복수 선택 가능, e.g. ["월", "수"])
  minStudentsToOpen?: number;  // 자동 폐강 기준 모집 인원
  assistantTeachers?: string[]; // 보조/예비 강사 목록
  isFree?: boolean;            // 무료 강좌 여부 (true일 경우 수강료 0원)
  hasBusOption?: boolean;      // 학부모 수강신청 시 스쿨버스 탑승 체크박스 제공 여부 (방학/주말 강좌 등)
  [key: string]: any;
}

export interface Student {
  id: string;
  yearNo: number;
  grade: number;
  classNum: number;
  studentNum: number;
  name: string;
  gender: 'M' | 'F';
  phone: string;
  parentPhone: string;
  address?: string;
  kisbusNo?: string;
  [key: string]: any;
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  yearNo: number;
  grade: number;
  classNum: number;
  studentNum: number;
  name: string;
  phone: string;
  parentPhone: string;
  tuition: number;
  textbookFee: number;
  materialFee: number;
  registrationDate: string;
  status: any;
  timestampMs?: number;
  kisbusNo?: string;
  [key: string]: any;
}

export type AttendanceStatus = 'ATTEND' | 'ABSENT' | 'LATE' | 'EARLY_LEAVE' | 'NONE';

export interface AttendanceRecord {
  id: string;
  courseId: string;
  date: string;
  sessionNo?: number;
  studentId: string;
  status: AttendanceStatus;
  markSymbol?: 'O' | 'V' | 'X';
  isIndividualDismissal?: boolean;
  inTime?: string;
  outTime?: string;
  isClosed?: boolean;
  note?: string;
  [key: string]: any;
}

export interface SubstituteRecord {
  id: string;
  courseId: string;
  courseTitle: string;
  dayIndex: number;
  dateStr: string;
  sessionNos: number[];
  sessionCount: number;
  originalInstructor: string;
  substituteInstructor: string;
  substituteSignature?: string;
  reason?: string;
  createdAt: string;
  recordType?: 'SUBSTITUTE' | 'ABSENCE'; // 보결 등록 또는 결근 처리
  isAbsence?: boolean; // 결근 처리 여부
  targetInstructor?: string; // 특정 강사 대상 (복수 강사 강좌인 경우)
}

export interface RefundRequest {
  id: string;
  enrollmentId?: string;
  courseId?: string;
  studentId?: string;
  studentName?: string;
  courseTitle?: string;
  requestDate?: string;
  refundAmount?: number;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  status?: any;
  reason?: string;
  [key: string]: any;
}

export type RefundRecord = RefundRequest;

export interface KisbusRoute {
  routeId: string;
  routeName: string;
  driverName: string;
  driverPhone: string;
  busNumber: string;
  departureTime: string;
  studentsCount: number;
  afterschoolCourseId?: string;
  busName?: string;
  [key: string]: any;
}

export type KisbusBusRoute = KisbusRoute;

export interface GlobalTimerConfig {
  startTime: string;
  endTime: string;
  masterStatus: 'AUTO' | 'FORCE_LOCK' | 'FORCE_OPEN' | 'PAUSED';
}

export interface QueueTicket {
  ticketId: string;
  studentId: string;
  studentName: string;
  courseId: string;
  position: number;
  totalInQueue: number;
  estimatedWaitSec: number;
  status: 'WAITING' | 'PASSED' | 'EXPIRED';
  createdAtMs: number;
}

// 강사가 제출한 서류 (부장 일괄결재용)
export interface SubmittedApprovalDoc {
  id: string;
  courseId: string;
  courseTitle: string;
  instructorName: string;
  submittedAt: string;
  selected?: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  type?: string;
  docType?: string;
  title?: string;
  managerApproved?: boolean;
  vicePrincipalApproved?: boolean;
  managerSignature?: string;
  vicePrincipalSignature?: string;
  [key: string]: any;
}

// ─── 학습준비물 신청 ───────────────────────────────────────────────────────────

export interface MaterialItem {
  name: string;        // 품목명
  quantity: number;    // 수량
  unitPrice: number;   // 단가
  amount: number;      // 총액 (quantity × unitPrice)
}

export interface MaterialRequest {
  id: string;
  courseId: string;
  courseTitle: string;
  instructorName: string;
  instructorEmail?: string;
  items: MaterialItem[];
  totalAmount: number;             // 전체 합계
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  reviewedAt?: string;
  rejectReason?: string;
}

// ─── 지출증빙서류 제출 ─────────────────────────────────────────────────────────

export interface ExpenseProofItem {
  name: string;        // 품명
  modelName: string;   // 모델명
  unit: string;        // 단위 (SET, EA, 개 등)
  contractQty: number; // 계약 수량
  inspectedQty: number;// 검수 수량
  amount: number;      // 금액
}

export interface ExpenseProof {
  id: string;
  requestId?: string;     // 연동된 학습준비물 신청 ID
  courseId: string;
  courseTitle: string;
  instructorName: string;
  // 서식 1: 영수증 증빙서
  cardType: 'PERSONAL' | 'SCHOOL'; // 개인카드(현금 등) / 학교카드
  cardOwnerName: string;           // 명의자 성명 (예: 홍길동 / 배경희)
  bankInfo?: string;               // 은행명 및 계좌번호 (예: 신한 000-0000-0000)
  accountHolderEng?: string;       // 예금주명(영문)
  spentAmount: number;             // 사용액
  receiptImageUrl?: string;        // 영수증 붙이는 곳 (이미지/첨부파일 URL)
  // 서식 2: 물품 검수 조서
  businessName: string;            // 사업명
  supplierName: string;            // 납품처
  deliveryDate: string;            // 납품일
  inspectionDate: string;          // 검수일
  items: ExpenseProofItem[];       // 검수 내역
  inspectorName: string;           // 검수자 성명 (교사)
  witnessName: string;             // 입회자 성명 (교감/부장)
  // 서식 3: 검수 사진
  inspectionPhotos: string[];      // 검수 사진 이미지 URL 목록 (최대 4장)
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
}

export interface SubmissionReminder {
  id: string;
  courseId: string;
  courseTitle: string;
  instructorName: string;
  missingDocs: string[]; // ['준비물 지출증빙', '출석부', '출근부']
  message: string;
  createdAt: string;
  isRead?: boolean;
}

// ─── 방과후학교 수강료 및 버스비 청구서 관련 타입 ──────────────────────────────────

export interface AfterschoolBillCourseItem {
  courseId: string;
  courseTitle: string;
  classDays?: string[];
  instructorName?: string;
  classroom?: string; // 수업 장소 (예: "음악실", "3-2반 교실")
  classTime?: string; // 수업 시간 (예: "15:30 ~ 16:50")
  isFree?: boolean; // 무료 강좌 여부
  tuition: number; // 강좌 수강료
  textbookFee: number; // 교재비
  materialFee: number; // 재료비
  courseSubtotal: number; // tuition + textbookFee + materialFee
}


export interface StudentAfterschoolAdjustment {
  customTotalFare?: number | null; // 최종 수강료 직접 오버라이드
  adjustmentAmount?: number; // 가감액 (+ / -)
  adjustmentReason?: string; // 감면/조정 사유 (예: 기초수급자 전액 감면, 교직원자녀 20% 감면 등)
  customBusFee?: number | null; // 버스요금 수동 지정
}

export interface AfterschoolFareBill {
  id: string; // e.g. "sem2026_1_홍길동_3_2"
  semesterId: string;
  semesterName: string;
  studentId?: string;
  studentName: string;
  grade: string | number;
  classNum: string | number;
  studentNum?: string | number;
  contact?: string;
  parentPhone?: string;

  // 신청 강좌 목록 및 수강료
  courses: AfterschoolBillCourseItem[];
  tuitionSubtotal: number; // 수강료 합계
  textbookSubtotal: number; // 교재비 합계
  materialSubtotal: number; // 재료비 합계
  coursesTotalFee: number; // 강좌 관련 총액 (tuition + textbook + material)

  // 방과후/토요 스쿨버스 탑승 및 요금 정보
  isBusRiding: boolean; // 방과후 버스 탑승 여부
  busNo?: string; // 예: "5호차"
  destinationName?: string; // 예: "푸미흥 미드타운"
  zone?: string; // 예: "Zone A (근거리)"
  busFare: number; // 스쿨버스 관리자에서 산출된 방과후 버스요금 (미탑승자는 0원)

  // 관리자 개별 수정/조정
  isAdjusted?: boolean;
  adjustmentAmount?: number;
  adjustmentReason?: string;
  customTotalFare?: number | null;

  // 최종 청구 금액 (강좌 총액 + 버스비 + 조정액)
  finalTotalFare: number;
  currency: string;

  // 발행 및 학부모 확인 상태
  issuedAt: string;
  isConfirmed?: boolean;
  confirmedAt?: string;
}



