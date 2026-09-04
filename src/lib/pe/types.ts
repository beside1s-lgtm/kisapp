export type Student = {
  id: string;
  school: string;
  grade: string;
  classNum: string;
  studentNum: string;
  name: string;
  gender: '남' | '여';
  accessCode?: string;
  personalCode?: string;
  photoUrl?: string;
  peStudentId?: string;

  // 건강기록부 연동용 인적사항 및 이력
  residentRegistrationNumber?: string;
  guardianName?: string;
  bloodType?: string;
  officialSchoolName?: string;
  teacherName?: string;
  schoolHistory?: SchoolHistoryEntry[];
  preSchoolImmunizations?: PreSchoolImmunization;
  postSchoolImmunizations?: PostSchoolImmunization[];
  healthExams?: {
    [grade: string]: {
      general?: HealthExam;
      dental?: HealthExam;
    };
  };
  otherExams?: OtherExam[];
};

export type RecordType = 'time' | 'count' | 'distance' | 'weight' | 'level' | 'compound';

export type MeasurementItem = {
  id: string;
  name: string;
  unit: string;
  recordType: RecordType;
  goal?: number;
  isPaps: boolean;
  isCompound?: boolean;
  category?: string;
  isArchived?: boolean;
  isDeactivated?: boolean;
  isMeasurementWeek?: boolean;
  videoUrl?: string;
};

export type MeasurementRecord = {
  id: string;
  studentId: string;
  school: string;
  item: string;
  value: number;
  date: string; // YYYY-MM-DD
  note?: string;
  height?: number;
  weight?: number;
  grade?: string;
  classNum?: string;
  studentName?: string;
  gender?: '남' | '여';
};

export type MeasurementPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type ItemStatistics = {
  id: string;
  gradeStats: {
    [grade: string]: {
      average: number;
      count: number;
      topRanks: { studentId: string; rank: number; value: number; name: string; classNum: string }[];
      allRanks: { studentId: string; rank: number; value: number }[];
      gradeDistribution?: Record<string, number>;
    };
  };
  lastUpdated: any;
};

export type SportsClub = {
  id: string;
  school: string;
  name: string;
  memberIds: string[];
  createdAt: any;
};

export type Team = {
  id: string;
  name: string;
  teamIndex: number;
  memberIds: string[];
  members?: Student[];
  matchesPlayed?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  points?: number;
};

export type TeamGroup = {
  id: string;
  school: string;
  description: string;
  teams: Team[];
  itemNamesForBalancing: string[];
  createdAt: any;
  analysisScope: 'all' | 'grade' | 'class';
  grade?: string;
  classNum?: string;
  gender?: 'all' | '남' | '여' | 'separate';
  divideBy?: 'teams' | 'members' | 'single';
  numTeams?: number;
  membersPerTeam?: number;
  balancingStrategy?: 'balanced' | 'by-ability' | 'random';
};

export type TeamGroupInput = Omit<TeamGroup, 'id' | 'createdAt' | 'teams'> & {
  teams: (Omit<Team, 'id'> & { id?: string })[];
};

export type Match = {
  id: string;
  round?: number;
  matchNumber: number;
  teamAId: string | null;
  teamBId: string | null;
  scoresA: number[];
  scoresB: number[];
  winnerId: string | null;
  status: 'scheduled' | 'completed' | 'bye';
  nextMatchId: string | null;
  nextMatchSlot: 'A' | 'B' | null;
  tournamentName?: string;
  teamNameA?: string;
  teamNameB?: string;
};

export type IndividualLeagueParticipant = {
  id: string;
  name: string;
  totalPoints: number;
  status: 'active' | 'eliminated';
  initialRank: number;
};

export type Tournament = {
  id: string;
  school: string;
  name: string;
  sport?: 'soccer' | 'basketball' | 'volleyball' | 'baseball' | 'dodgeball' | 'etc';
  type: 'tournament' | 'league' | 'individual-league';
  tournamentFormat?: 'single-elimination' | 'double-elimination';
  bestOf?: 1 | 3 | 5 | 7;
  teamGroupId?: string;
  teams: Team[];
  matches: Match[];
  createdAt: any;
  updatedAt?: any;
  date?: string;
  meetingsPerTeam?: number;
  grade?: string;
  gender?: 'all' | '남' | '여';
  participants?: IndividualLeagueParticipant[];
  pointsPerWin?: number;
  membersPerTeam?: number;
  currentRound?: number;
  isFinished?: boolean;
};

export type QuizQuestion = {
  type: 'multiple-choice' | 'short-answer' | 'ox' | 'fill-in-the-blanks';
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
};

export type Quiz = {
  id: string;
  school: string;
  title: string;
  content: string;
  questions: QuizQuestion[];
  videoUrl?: string;
  createdAt: any;
};

export type QuizAssignment = {
  id: string;
  quizId: string;
  quizTitle: string;
  questions?: QuizQuestion[];
  videoUrl?: string;
  school: string;
  targetType: 'class' | 'grade' | 'school' | 'club';
  targetGrade?: string;
  targetClassNum?: string;
  targetClubId?: string;
  targetClubName?: string;
  createdAt: any;
  status: 'active' | 'closed';
};

export type QuizResult = {
  id: string;
  assignmentId: string;
  studentId: string;
  score: number;
  total: number;
  passed: boolean;
  createdAt: any;
};

// 건강기록부 세부 타입
export type SchoolHistoryEntry = {
  year?: string;
  schoolName: string;
  grade: string;
  classNum: string;
  studentNum: string;
  teacherName: string;
};

export type PreSchoolImmunization = {
  [disease: string]: boolean[];
};

export type PostSchoolImmunization = {
  diseaseName: string;
  grade: string;
  date: string;
};

export type HealthExam = {
  date: string;
  institution: string;
};

export type OtherExam = {
  date: string;
  examName: string;
  institution: string;
};

export type HealthSchoolSetting = {
  officialSchoolName?: string;
  healthRecord_showGuardian?: boolean;
  healthRecord_showBloodType?: boolean;
  healthExamInstitutions?: string[];
  dentalExamInstitutions?: string[];
};

// ==========================================
// 체육행사 관리 (PAPS 측정주간, 스포츠 데이 등)
// ==========================================

export type PeEventType = 'paps_week' | 'sports_day' | 'tournament' | 'custom';

export type PeEventSchedule = {
  id: string;
  date: string; // YYYY-MM-DD
  startPeriod?: string; // e.g. "1교시"
  endPeriod?: string; // e.g. "3교시"
  time?: string; // e.g. "08:30 ~ 10:50 (1~3교시)"
  targetGrades?: string[]; // e.g. ["1", "2"] or ["1"]
  target?: string; // e.g. "1학년"
  location?: string; // e.g. "대운동장, 체육관"
  title: string; // e.g. "1학년 스포츠 활동 (세부계획서 참조)"
  note?: string;
};

export type PeEventBudget = {
  id: string;
  category?: string; // 카테고리 (예: 경기용품, 시상, 운영비 등)
  item: string; // 항목명 e.g. "측정기기 소모품 및 배터리"
  spec?: string; // 규격/용도 e.g. "AAA 알카라인"
  quantity?: number; // 수량
  unitPrice?: number; // 단가
  amount: number; // 합계 금액 (quantity * unitPrice)
  currency?: 'VND' | 'KRW';
  note?: string; // 산출근거
};

export type PeEventSuggestion = {
  suggestedAt: string;
  suggestedBy: string;
  departmentHeadName?: string;
  title: string;
  content: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
};

export type PeGradeAssignment = {
  grade: string;
  teacherEmail: string;
  teacherName: string;
  status: 'PENDING' | 'SUBMITTED';
  submitted?: boolean;
  submittedAt?: string;
};

export type PeEvent = {
  id: string;
  school: string;
  title: string;
  eventType: PeEventType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  targetGrades: string[]; // e.g. ["5", "6"] or ["전교생"]
  location: string;
  manager: string; // 담당 교사
  description?: string; // 추진 목적 및 방침
  schedules: PeEventSchedule[];
  budgets: PeEventBudget[];
  totalBudget: number;
  approvalStatus: 'PLANNING' | 'DRAFTED' | 'APPROVED' | 'REJECTED' | 'DRAFT' | 'SUBMITTED';
  approvalDocId?: string;
  linkedTaskId?: string; // KIS 대시보드 업무 요청 연동 ID
  gradeAssignments?: PeGradeAssignment[]; // 학년별 담당자 배정 및 제출 현황
  suggestion?: PeEventSuggestion;
  createdAt: any;
  updatedAt?: any;
};


