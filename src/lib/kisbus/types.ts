export type Student = {
  id: string;
  name: string;
  nameKo?: string | null;
  nameEn?: string | null;
  contact: string | null;
  morningDestinationId: string | null;
  afternoonDestinationId: string | null;
  afterSchoolDestinations: Partial<Record<DayOfWeek, string | null>>;
  satMorningDestinationId: string | null;
  satAfternoonDestinationId: string | null;
  grade: string;
  class: string;
  number?: string | null;
  gender: 'Male' | 'Female';
  suggestedMorningDestination?: string | null;
  suggestedAfternoonDestination?: string | null;
  suggestedSatMorningDestination?: string | null;
  suggestedSatAfternoonDestination?: string | null;
  suggestedAfterSchoolDestinations?: Partial<Record<DayOfWeek, string | null>>;
  afterSchoolClassIds?: Partial<Record<DayOfWeek, string | null>>;
  // ë°©í•™ ì¤?ë°©ê³¼???„ìš© ?„ë“œ (?™ê¸°ì¤?afterSchoolDestinations?€ ?…ë¦½?�ìœ¼ë¡?ê´€ë¦?
  vacationAfterSchoolDestinations?: Partial<Record<DayOfWeek, string | null>>;
  vacationAfterSchoolClassIds?: Partial<Record<DayOfWeek, string | null>>;
  applicationStatus?: 'pending' | 'reviewed';
  siblingGroupId?: string | null;
  kisbusNo?: string | null;
};
export type NewStudent = Omit<Student, 'id'>;

export type AfterSchoolClass = {
  id: string;
  name: string;
  dayOfWeek: DayOfWeek;
  teacherId: string | null;
  teacherName?: string | null;
  teacherId2?: string | null;
  teacherName2?: string | null;
  teacherId3?: string | null;
  teacherName3?: string | null;
  teacherId4?: string | null;
  teacherName4?: string | null;
  semesterMode?: 'regular' | 'vacation';
};
export type NewAfterSchoolClass = Omit<AfterSchoolClass, 'id'>;


export type Bus = {
  id: string;
  name: string;
  capacity: 16 | 29 | 45;
  type: '16-seater' | '29-seater' | '45-seater';
  status?: 'ready' | 'departed' | 'completed';
  departureTime?: string | null;
  isActive?: boolean;
  excludeFromAssignment?: boolean;
  zaloLink?: string;
  semesterMode?: 'regular' | 'vacation';
};
export type NewBus = Omit<Bus, 'id'>;

export type Destination = {
  id: string;
  name:string;
  zone?: string;         // 📅 평일 요금 그룹 (월~금)
  saturdayZone?: string; // 🚌 토요일 요금 그룹 (토요 방과후)
};
export type NewDestination = Omit<Destination, 'id'>;

export type Teacher = {
    id: string;
    name: string;
    afterSchoolDays?: DayOfWeek[];
    pushToken?: string;
    assignedBusId?: string | null;
    assignedAfterSchoolBusId?: string | null;
    semesterMode?: 'regular' | 'vacation';
};
export type NewTeacher = Omit<Teacher, 'id'>;


export type SeatingAssignment = {
  seatNumber: number;
  studentId: string | null;
};

export type Route = {
  id: string;
  busId: string;
  dayOfWeek: DayOfWeek;
  type: RouteType;
  stops: string[]; // ordered list of destination IDs
  seating: SeatingAssignment[];
  teacherIds?: string[];
  semesterMode?: 'regular' | 'vacation';
};

export type AttendanceRecord = {
  id: string; // YYYY-MM-DD
  routeId: string;
  notBoarding: string[]; // student IDs
  boarded: string[]; // student IDs
  disembarked?: string[]; // student IDs
  completedDestinations?: string[]; // destination IDs
};

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export type RouteType = 'Morning' | 'Afternoon' | 'AfterSchool';

export type GroupLeaderRecord = {
    studentId: string;
    name: string;
    startDate: string;
    endDate: string | null;
    days: number;
}

export type LostItem = {
    id: string;
    foundBusId?: string | null;
    foundDate?: string | null;
    itemType?: string | null;
    itemPhotoUrl?: string | null; // Data URI
    status: 'claimed' | 'unclaimed' | 'acknowledged';
}
export type NewLostItem = Omit<LostItem, 'id'>;

export type NotificationSchedule = {
    id: string;
    teacherIds: string[]; // ?¤ì¤‘ ? íƒ� ê°€??
    days: DayOfWeek[];
    time: string; // HH:mm format
    title: string;
    message: string;
    isActive: boolean;
    lastSentDate?: string; // YYYY-MM-DD
    createdAt: string;
};

export type NewNotificationSchedule = Omit<NotificationSchedule, 'id'>;

export type NotificationTrigger = 'boarding' | 'disembarking' | 'absence' | 'delay';

export type NotificationSettings = {
  id: string;
  target: 'parent' | 'teacher' | string;
  trigger: NotificationTrigger;
  isEnabled: boolean;
  titleTemplate: string;
  bodyTemplate: string;
  lastModified: string;
};

export type StudentFareAdjustment = {
  customFare?: number | null; // 최종 금액 직접 지정 (오버라이드)
  adjustmentAmount?: number; // +/- 가감 금액
  adjustmentReason?: string; // 조정 사유 (예: 5월 10일 전학으로 일할 계산, 장기 입원 감면 등)
  customDays?: number | null; // 학생 개별 등교일수 오버라이드
  customDiscountRate?: number | null; // 형제할인율 개별 변경 (%)
  forceSiblingDiscount?: boolean | null; // 형제 할인 강제 적용 여부
};

export type BusQuarterSetting = {
  id: string;
  name: string; // 예: "1분기", "2분기", "3분기", "4분기"
  startDate: string; // "2026-03-02"
  endDate: string; // "2026-05-29"
  manualDays?: number | null; // 수동 지정 일수 (null/undefined인 경우 학사일정 자동 산출)
  gradeExceptions?: Record<string, number>; // 특정 학년 등교일수 제외(차감) 일수 (예: { "6": 3 } -> 6학년 3일 제외)
  gradeExceptionReasons?: Record<string, string>; // 제외 사유 (예: { "6": "수학여행" })
  studentAdjustments?: Record<string, StudentFareAdjustment>; // 학생별 개별 수정/조정 내역
};

export type BusFareConfig = {
  busFareSettings?: Record<string, number>;
  saturdayBusFareSettings?: Record<string, number>;
  busFareCurrency?: 'VND' | 'KRW' | 'USD';
  quarters?: BusQuarterSetting[];
  activeQuarterId?: string;
  under3Surcharge?: number; // 목적지 탑승 인원 3명 이하 시 일일 추가요금
  siblingDiscountRate?: number; // 형제 복수 탑승 시 둘째 이하 할인율 (%)
};

export type BusFareBill = {
  id: string; // `${quarterId}_${studentId}`
  quarterId: string;
  quarterName: string;
  quarterPeriod: string; // "2026-03-02 ~ 2026-05-29"
  studentId: string;
  studentName: string;
  grade: string;
  studentClass: string;
  contact: string;
  destinationName: string;
  zone: string;
  isRiding: boolean;
  baseQuarterDays: number;
  excludedDays: number;
  gradeExceptionReason?: string;
  finalQuarterDays: number;
  baseDailyFare: number;
  destinationRiderCount: number;
  isSmallGroup: boolean;
  smallGroupSurcharge: number;
  totalDailyFare: number;
  subtotalFare: number;
  isSiblingDiscounted: boolean;
  discountRate: number;
  discountAmount: number;
  isAdjusted?: boolean;
  adjustmentAmount: number;
  adjustmentReason?: string;
  finalQuarterFare: number;
  currency: 'VND' | 'KRW' | 'USD';
  issuedAt: string; // ISO String
  isConfirmed?: boolean;
  confirmedAt?: string;
};

