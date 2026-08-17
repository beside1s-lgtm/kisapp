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
  zone?: string;
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
