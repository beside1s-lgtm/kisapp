export interface HomeroomDailyMemo {
  date: string; // YYYY-MM-DD
  content: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface HomeroomHomework {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  dateWithDay?: string; // YYYY-MM-DD (요일)
  createdAt: string;
  createdBy?: string;
}

export interface HomeroomHomeworkCheck {
  id: string; // `${hwId}_${studentId}`
  hwId: string;
  studentId: string;
  studentName: string;
  checked: boolean;
  date?: string;
  updatedAt?: string;
}

export interface HomeroomBehaviorRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentNum?: string;
  content: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  createdBy?: string;
}

export interface HomeroomConsultation {
  studentId: string;
  studentName?: string;
  content: string;
  updatedAt: string;
  updatedBy?: string;
}

// ─── 5. 학부모 상담 주간 예약 시스템 타입 ──────────────────────────────────
export type SlotStatus = 'AVAILABLE' | 'BOOKED' | 'BLOCKED';

export interface BookingSlot {
  id: string;          // format: YYYY-MM-DD__HH:mm ~ HH:mm 또는 Firestore doc ID
  date: string;        // YYYY-MM-DD
  timeRange: string;   // 13:40 ~ 14:00
  status: SlotStatus;
  bookedBy?: {
    studentName: string;
    studentId?: string;
    parentPhone?: string;
    bookedAt?: string;
    bookedByEmail?: string;
  };
}

export interface ConsultationConfig {
  isOpen?: boolean;        // 상담 신청 오픈 여부
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD
  dailyStartTime: string;  // HH:mm (e.g. 13:40)
  dailyEndTime: string;    // HH:mm (e.g. 16:20)
  slotDuration: number;    // 분 단위 (기본 20분)
  excludedDates: string[]; // 상담 제외일 (YYYY-MM-DD)
  title?: string;          // 예: 2026학년도 1학기 학부모 상담 주간
  updatedAt?: string;
  updatedBy?: string;
}
