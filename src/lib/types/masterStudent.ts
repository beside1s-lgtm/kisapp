export type AcademicHistoryRecord = {
  academicYear: number;        // 학학년도 (예: 2025)
  grade: string;               // 당시 학년 (예: "4")
  classNum: string;            // 당시 반 (예: "4")
  studentNum?: string | null;  // 당시 번호 (예: "2")
  archivedAt: string;          // 아카이빙 일시 (ISO)
};

export type MasterStudent = {
  studentEmail: string;        // 주 식별자 계정 이메일 (예: "2023KANGDONGYUN@kshcm.net")
  studentId: string;           // Firestore 고유 ID (doc ID 또는 UUID)
  studentNumYear?: number;     // 입학년도/학번 (예: 2023)
  name: string;                // 이름
  nameKo?: string | null;
  nameEn?: string | null;
  grade: string;               // 학년 (예: "3")
  classNum: string;            // 반 (예: "2")
  studentNum?: string | null;  // 번호 (예: "5")
  gender: 'Male' | 'Female';
  contact: string;             // 본인/보호자 연락처
  parentEmail?: string | null; // 보호자 연동 이메일
  address?: string | null;     // 주소
  kisbusNo?: string | null;    // 승차권 번호

  // [학적 이력 아카이브] 과거 학학년도별 학년/반/번호 아카이브 기록
  academicHistory?: AcademicHistoryRecord[];

  // [서브도메인 1] 방과후 수강 & 청구 요약
  afterschoolSummary?: {
    enrolledCourseIds?: string[];
    enrolledCourseTitles?: string[];
    totalTuition?: number;
    paymentStatus?: 'PAID' | 'UNPAID' | 'PARTIAL';
  };

  // [서브도메인 2] 스쿨버스 탑승 & 노선 지정 요약
  busSummary?: {
    morningDestinationId?: string | null;
    afternoonDestinationId?: string | null;
    afterSchoolDestinations?: Record<string, string | null>;
    satMorningDestinationId?: string | null;
    satAfternoonDestinationId?: string | null;
    assignedBusId?: string | null;
    assignedBusName?: string | null;
    assignedSeatNumber?: number | null;
  };

  // [서브도메인 3] 출결 관리 요약
  attendanceSummary?: {
    totalAbsences?: number;
    totalLates?: number;
    lastAttendanceDate?: string | null;
  };

  // [서브도메인 4] 체험학습 신청 요약
  fieldTripSummary?: {
    activeApplicationsCount?: number;
    approvedCount?: number;
  };

  createdAt?: string;
  updatedAt?: string;
};

export type NewMasterStudent = Omit<MasterStudent, 'studentId'>;
