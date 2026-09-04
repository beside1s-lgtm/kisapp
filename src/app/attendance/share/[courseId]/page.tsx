'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import {
  onAfterschoolCoursesUpdate,
  onAfterschoolEnrollmentsUpdate,
  onAttendanceRecordsUpdate,
  saveAttendanceRecordsBatch,
  onTeacherApplySettingsUpdate,
  getTeacherApplySettings,
  onDocConfigUpdate,
} from '@/lib/services/settingsService';
import type { Course, Enrollment, AttendanceRecord } from '@/lib/afterschool/types';
import type { DocConfig } from '@/lib/types';
import {
  generateCalendarSchedule,
  generateCalendarScheduleByDateRange,
  getCourseSessionsPerClass,
  extractHolidayDatesFromEvents,
  type ScheduleDay,
} from '@/lib/afterschool/schedule';
import { DEFAULT_ACADEMIC_CALENDAR_CONFIG } from '@/lib/services/academicCalendarService';
import {
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// =====================================================================
// 출석 마크 심볼
// =====================================================================
type MarkSymbol = 'O' | 'V' | 'X' | '';

function getMarkDisplay(mark: string): { symbol: string; colorClass: string } {
  if (mark === 'O' || mark === '○') return { symbol: '○', colorClass: 'text-emerald-600' };
  if (mark === 'V' || mark === '△') return { symbol: '△', colorClass: 'text-purple-600' };
  if (mark === 'X' || mark === '×') return { symbol: '×', colorClass: 'text-rose-600' };
  return { symbol: '·', colorClass: 'text-slate-300' };
}

// =====================================================================
// 모바일용 출석 터치 버튼 (4단계 순환: 미체크 -> 출석 -> 지각/개별 -> 결석)
// =====================================================================
const MobileMark = ({
  mark,
  onSelect,
}: {
  mark: string;
  onSelect: (v: MarkSymbol) => void;
}) => {
  const cycle: MarkSymbol[] = ['', 'O', 'V', 'X'];
  const currentIdx = cycle.indexOf(mark as MarkSymbol);
  const handleTap = () => {
    const next = cycle[(currentIdx + 1) % cycle.length];
    onSelect(next);
  };
  const { symbol, colorClass } = getMarkDisplay(mark);
  return (
    <button
      onClick={handleTap}
      className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-black transition cursor-pointer select-none shrink-0 ${
        mark === 'O' || mark === '○'
          ? 'border-emerald-400 bg-emerald-50'
          : mark === 'V' || mark === '△'
          ? 'border-purple-400 bg-purple-50'
          : mark === 'X' || mark === '×'
          ? 'border-rose-400 bg-rose-50'
          : 'border-slate-200 bg-slate-50'
      }`}
      title="탭하여 출결 변경: 미체크 -> 출석 -> 지각/개별하교 -> 결석"
    >
      <span className={colorClass}>{symbol}</span>
    </button>
  );
};

// =====================================================================
// 메인 페이지 컴포넌트
// =====================================================================
export default function SharedAttendancePage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : '';
  const { toast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [masterSettings, setMasterSettings] = useState<any>(null);
  const [docConfig, setDocConfig] = useState<Partial<DocConfig> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSessionNo, setActiveSessionNo] = useState(1);
  const sessionScrollRef = useRef<HTMLDivElement>(null);

  // 학사일정 공휴일 수집
  const holidayDates = useMemo(
    () => extractHolidayDatesFromEvents(
      (docConfig as any)?.academicCalendar?.events ||
      DEFAULT_ACADEMIC_CALENDAR_CONFIG.events ||
      []
    ),
    [docConfig]
  );

  // Firestore 실시간 구독
  useEffect(() => {
    setIsLoading(true);
    let settingsLoaded = false;

    const unsubCourses = onAfterschoolCoursesUpdate((data) => {
      setCourses(data || []);
    });
    const unsubEnrollments = onAfterschoolEnrollmentsUpdate((data) => {
      setEnrollments(data || []);
    });
    const unsubAttendance = onAttendanceRecordsUpdate((data) => {
      setAttendanceRecords(data || []);
    });
    const unsubSettings = onTeacherApplySettingsUpdate((settings) => {
      setMasterSettings(settings);
      settingsLoaded = true;
      setIsLoading(false);
    });
    const unsubDocConfig = onDocConfigUpdate((cfg) => {
      setDocConfig(cfg);
    });

    // fallback: onTeacherApplySettingsUpdate가 늘리는 경우 대비
    getTeacherApplySettings().then((settings) => {
      setMasterSettings((prev: any) => prev || settings);
      setIsLoading(false);
    });

    return () => {
      unsubCourses();
      unsubEnrollments();
      unsubAttendance();
      unsubSettings();
      unsubDocConfig();
    };
  }, []);

  const currentCourse = useMemo(
    () => courses.find((c) => c.id === courseId),
    [courses, courseId]
  );

  const courseStudents = useMemo(
    () => enrollments.filter((e) => e.courseId === courseId && e.status === 'ENROLLED'),
    [enrollments, courseId]
  );

  const scheduleDays = useMemo<ScheduleDay[]>(() => {
    if (!masterSettings || !currentCourse) return [];
    const opStart = masterSettings.operatingStartDate;
    const opEnd = masterSettings.operatingEndDate;
    const startDateStr = masterSettings.operatingStartDate || '';
    const operatingWeeks = masterSettings.operatingWeeks || 10;
    const classDays: string[] = currentCourse.classDays || masterSettings.allowedDays || ['화', '수', '목'];
    const effectiveDays = classDays.length > 0 ? classDays : (masterSettings.allowedDays || ['화', '수', '목']);
    const effectiveSessions = getCourseSessionsPerClass(currentCourse, masterSettings.sessionsPerClass || 2);
    if (opStart && opEnd) {
      return generateCalendarScheduleByDateRange(opStart, opEnd, effectiveDays, effectiveSessions, holidayDates);
    }
    return generateCalendarSchedule(startDateStr, operatingWeeks, effectiveDays, effectiveSessions, holidayDates);
  }, [masterSettings, currentCourse, holidayDates]);

  // 오늘 날짜의 회차를 기본 선택
  useEffect(() => {
    if (scheduleDays.length === 0) return;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayIdx = scheduleDays.findIndex((d) => d.fullDate === todayStr);
    if (todayIdx >= 0) {
      setActiveSessionNo(scheduleDays[todayIdx].dayIndex);
    } else {
      const futureDay = scheduleDays.find((d) => d.fullDate >= todayStr);
      if (futureDay) setActiveSessionNo(futureDay.dayIndex);
      else setActiveSessionNo(scheduleDays[scheduleDays.length - 1].dayIndex);
    }
  }, [scheduleDays.length]);

  const getDayMark = useCallback(
    (studentId: string, dayIndex: number): string => {
      const day = scheduleDays.find((d) => d.dayIndex === dayIndex);
      if (!day) return '';
      const firstSessionNo = day.startSessionNo;
      const record = attendanceRecords.find(
        (r) => r.courseId === courseId && r.studentId === studentId && r.sessionNo === firstSessionNo
      );
      if (!record) return '';
      if (record.markSymbol) return record.markSymbol;
      if (record.status === 'ATTEND') return record.isIndividualDismissal ? 'V' : 'O';
      if (record.status === 'ABSENT') return 'X';
      return '';
    },
    [attendanceRecords, courseId, scheduleDays]
  );

  // 스쿨버스 시스템 결석/개별하교 연동
  const syncBusAbsenceForDay = useCallback(async (studentId: string, dayIndex: number, mark: MarkSymbol) => {
    const day = scheduleDays.find((d) => d.dayIndex === dayIndex);
    if (!day) return;
    const targetDateStr = day.fullDate || new Date().toISOString().split('T')[0];
    const isAbsent = mark === 'X' || mark === 'V';
    try {
      const { doc, setDoc, collection, getDocs, arrayUnion, arrayRemove } = await import('firebase/firestore');
      const { getKisbusDb } = await import('@/lib/kisbus/firebase');
      const kisbusDb = getKisbusDb();
      const koreanDayMap: Record<string, string> = {
        '일': 'Sunday', '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday',
        '목': 'Thursday', '금': 'Friday', '토': 'Saturday',
      };
      const dayOfWeekMap: Record<number, string> = {
        0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday',
      };
      const match = day.dateStr.match(/\(([월화수목금토일])\)/);
      const korDay = match ? match[1] : '';
      const targetDayOfWeek = korDay
        ? koreanDayMap[korDay]
        : dayOfWeekMap[new Date(day.fullDate + 'T12:00:00').getDay()];
      if (!targetDayOfWeek) return;
      const routesSnap = await getDocs(collection(kisbusDb, 'routes'));
      for (const routeDoc of routesSnap.docs) {
        const routeData = routeDoc.data();
        if (routeData.dayOfWeek !== targetDayOfWeek) continue;
        const seating: any[] = routeData.seating || [];
        if (!seating.some((s: any) => s.studentId === studentId)) continue;
        const attendanceRef = doc(kisbusDb, 'routes', routeDoc.id, 'attendance', targetDateStr);
        await setDoc(
          attendanceRef,
          {
            notBoarding: isAbsent ? arrayUnion(studentId) : arrayRemove(studentId),
            ...(isAbsent ? { boarded: arrayRemove(studentId), disembarked: arrayRemove(studentId) } : {}),
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.error('[BusSync-Share] 버스 연동 오류:', err);
    }
  }, [scheduleDays]);

  // 출석 마크 변경 및 Firestore 저장
  const handleSetDayMark = useCallback(
    async (studentId: string, dayIndex: number, nextMark: MarkSymbol) => {
      const day = scheduleDays.find((d) => d.dayIndex === dayIndex);
      if (!day) return;
      // 낙관적 UI 업데이트
      setAttendanceRecords((prev) => {
        const filtered = prev.filter(
          (r) => !(r.courseId === courseId && r.studentId === studentId && day.sessionNos.includes(r.sessionNo || 0))
        );
        if (!nextMark) return filtered;
        const newRecords: AttendanceRecord[] = day.sessionNos.map((sNo) => ({
          id: `att_${studentId}_s${sNo}`,
          courseId,
          studentId,
          sessionNo: sNo,
          date: day.dateStr,
          status: nextMark === 'X' ? 'ABSENT' : 'ATTEND',
          markSymbol: nextMark,
          isIndividualDismissal: nextMark === 'V',
        } as AttendanceRecord));
        return [...filtered, ...newRecords];
      });
      // 버스 시스템 연동
      syncBusAbsenceForDay(studentId, dayIndex, nextMark);
      // Firestore 저장
      setIsSaving(true);
      try {
        const toUpsert: AttendanceRecord[] = nextMark
          ? day.sessionNos.map((sNo) => ({
              id: `att_${studentId}_s${sNo}`,
              courseId,
              studentId,
              sessionNo: sNo,
              date: day.dateStr,
              status: nextMark === 'X' ? ('ABSENT' as const) : ('ATTEND' as const),
              markSymbol: nextMark,
              isIndividualDismissal: nextMark === 'V',
            } as AttendanceRecord))
          : [];
        const toDeleteIds: string[] = nextMark
          ? []
          : day.sessionNos.map((sNo) => `att_${studentId}_s${sNo}`);
        await saveAttendanceRecordsBatch(toUpsert, toDeleteIds);
      } catch (err) {
        console.error('[SharedAttendance] Firestore 저장 오류:', err);
        toast({ title: '저장 실패', description: '출석 정보 저장 중 오류가 발생했습니다.', variant: 'destructive' });
      } finally {
        setIsSaving(false);
      }
    },
    [scheduleDays, courseId, syncBusAbsenceForDay, toast]
  );

  const activeDay = scheduleDays.find((d) => d.dayIndex === activeSessionNo) || scheduleDays[0];

  // 로딩 중
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-500 font-semibold">출석부 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 강좌를 찾을 수 없는 경우
  if (!currentCourse) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 max-w-sm w-full text-center">
          <AlertCircle className="h-10 w-10 text-rose-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800 mb-1">강좌를 찾을 수 없습니다</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            공유 링크가 만료되었거나 강좌 정보가 없습니다.<br />
            담당 선생님에게 새 링크를 요청해 주세요.
          </p>
        </div>
      </div>
    );
  }

  // 출석 현황 요약
  const attendCount = courseStudents.filter((e) => {
    const m = getDayMark(e.studentId, activeSessionNo);
    return m === 'O' || m === '○';
  }).length;
  const lateCount = courseStudents.filter((e) => {
    const m = getDayMark(e.studentId, activeSessionNo);
    return m === 'V' || m === '△';
  }).length;
  const absentCount = courseStudents.filter((e) => {
    const m = getDayMark(e.studentId, activeSessionNo);
    return m === 'X' || m === '×';
  }).length;
  const uncheckedCount = courseStudents.filter((e) => !getDayMark(e.studentId, activeSessionNo)).length;

  return (
    <MainLayout
      title={
        <span className="text-sm font-bold text-slate-800 truncate">
          {currentCourse.title}
          <span className="ml-1.5 text-xs font-normal text-slate-500">출석부</span>
        </span>
      }
      hideMobileBottomNav={true}
      contentClassName="p-2 sm:p-4"
    >
      <div className="max-w-2xl mx-auto space-y-3">

        {/* 안내 배너 */}
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-2.5 flex items-center gap-2.5 text-xs text-sky-800">
          <UserCheck className="w-4 h-4 text-sky-600 shrink-0" />
          <span>
            <span className="font-bold">{currentCourse.instructorName || '강사'}</span> 선생님 전용 출석부입니다.
            출석 체크 결과는 스쿨버스 탑승 시스템에 자동 연동됩니다.
            {isSaving && <span className="ml-2 text-sky-600 font-bold animate-pulse">저장 중...</span>}
          </span>
        </div>

        {/* 출석부 카드 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* 세션 헤더 */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            {/* 날짜/회차 표시 + 이전/다음 버튼 */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-bold text-slate-800 text-sm">
                  {activeDay?.dateStr || ''}
                  <span className="text-slate-500 font-normal text-xs ml-1.5">
                    ({activeDay?.dayIndex || 1}회차 / {activeDay?.startSessionNo}~{activeDay?.endSessionNo}차시)
                  </span>
                </span>
                <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[11px] px-2 py-0.5 rounded-full ml-1">
                  {courseStudents.length}명
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveSessionNo((prev) => Math.max(1, prev - 1))}
                  disabled={activeSessionNo <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-slate-500 font-mono px-1">
                  {activeSessionNo}/{scheduleDays.length}회차
                </span>
                <button
                  onClick={() => setActiveSessionNo((prev) => Math.min(scheduleDays.length, prev + 1))}
                  disabled={activeSessionNo >= scheduleDays.length}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 날짜(회차) 버튼 스크롤 */}
            <div ref={sessionScrollRef} className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {scheduleDays.map((day) => {
                const isSelected = day.dayIndex === activeSessionNo;
                const now = new Date();
                const todayFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const isToday = day.fullDate === todayFormatted;
                return (
                  <button
                    key={day.dayIndex}
                    onClick={() => setActiveSessionNo(day.dayIndex)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition shrink-0 flex flex-col items-center cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
                        : isToday
                        ? 'bg-amber-50/80 border-2 border-amber-400 text-slate-800 hover:bg-amber-100'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isToday && (
                      <span className={`text-[8px] font-black px-1 rounded-sm mb-0.5 ${isSelected ? 'bg-amber-300 text-amber-950' : 'bg-amber-500 text-white'}`}>
                        오늘
                      </span>
                    )}
                    <span className="text-xs leading-none font-extrabold">{day.dateStr}</span>
                    <span className="text-[9px] opacity-90 font-normal mt-0.5">{day.dayIndex}회차</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 학생 출석 목록 */}
          <div className="divide-y divide-slate-100">
            {courseStudents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">수강 등록된 학생이 없습니다.</div>
            ) : (
              courseStudents.map((enrollment) => {
                const mark = getDayMark(enrollment.studentId, activeSessionNo);
                const { symbol, colorClass } = getMarkDisplay(mark);
                return (
                  <div key={enrollment.id} className="px-4 py-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/70 transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-sm">{enrollment.name}</span>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          {enrollment.grade}-{enrollment.classNum}
                        </span>
                        {enrollment.kisbusNo && (
                          <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded-full">
                            {enrollment.kisbusNo}호
                          </span>
                        )}
                      </div>
                      <div className={`text-base font-black mt-0.5 ${colorClass}`}>{symbol}</div>
                    </div>
                    <MobileMark
                      mark={mark}
                      onSelect={(val) => handleSetDayMark(enrollment.studentId, activeSessionNo, val)}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* 출석 현황 요약 */}
          {courseStudents.length > 0 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex gap-4 text-xs font-bold">
              <span className="text-emerald-700">출석 {attendCount}명</span>
              <span className="text-purple-700">지각/개별 {lateCount}명</span>
              <span className="text-rose-700">결석 {absentCount}명</span>
              <span className="text-slate-400 ml-auto">미체크 {uncheckedCount}명</span>
            </div>
          )}
        </div>

        {/* 범례 안내 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600">
          <p className="font-bold mb-1 text-slate-700">출결 기호 안내</p>
          <div className="flex gap-4 flex-wrap">
            <span><span className="text-emerald-600 font-black">○</span> 출석</span>
            <span><span className="text-purple-600 font-black">△</span> 지각 / 개별하교</span>
            <span><span className="text-rose-600 font-black">×</span> 결석</span>
            <span><span className="text-slate-400 font-black">·</span> 미체크</span>
          </div>
          <p className="mt-1.5 text-slate-500">학생 이름 오른쪽 버튼을 탭하여 출결을 순서대로 변경할 수 있습니다.</p>
        </div>
      </div>
    </MainLayout>
  );
}
