'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, Calendar, Clock, CheckCircle2, Trash2, Lock, ShieldAlert, CalendarPlus } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { onConsultationConfigUpdate, onConsultationSlotsUpdate, bookConsultationSlotTransaction, cancelConsultationSlot } from '@/lib/services/homeroomClassService';
import { onOrgStructureUpdate } from '@/lib/services/settingsService';
import { onUsersDirectoryUpdate } from '@/lib/services/userService';
import type { ConsultationConfig, BookingSlot } from '@/lib/types/homeroomClass';
import { Badge } from '@/components/ui/badge';

// Google Calendar 원클릭 일정 등록 URL 생성 헬퍼
function getGoogleCalendarUrl({
  title,
  startDateStr,
  timeRange,
  description,
  location,
}: {
  title: string;
  startDateStr: string;
  timeRange: string;
  description?: string;
  location?: string;
}) {
  try {
    // timeRange format: "13:40 ~ 14:00"
    const times = timeRange.split('~').map(t => t.trim());
    const [startH, startM] = (times[0] || '13:40').split(':').map(Number);
    const [endH, endM] = (times[1] || '14:00').split(':').map(Number);

    const [year, month, day] = startDateStr.split('-').map(Number);

    const startDate = new Date(year, month - 1, day, startH, startM);
    const endDate = new Date(year, month - 1, day, endH, endM);

    const pad = (n: number) => String(n).padStart(2, '0');
    const formatUtc = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

    const datesParam = `${formatUtc(startDate)}/${formatUtc(endDate)}`;

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: datesParam,
      details: description || '',
      location: location || '교실 / 온라인',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  } catch (err) {
    console.error('Failed to generate Google Calendar URL:', err);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}`;
  }
}

export default function ParentConsultationPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // 자녀 학급 키 계산 (예: "4-2")
  const classKey = useMemo(() => {
    if (!profile?.studentGrade || !profile?.studentClass) return '';
    const g = String(parseInt(profile.studentGrade, 10) || profile.studentGrade).trim();
    const c = String(parseInt(profile.studentClass, 10) || profile.studentClass).trim();
    return `${g}-${c}`;
  }, [profile]);

  const classLabel = useMemo(() => {
    if (!profile?.studentGrade || !profile?.studentClass) return '';
    return `${profile.studentGrade}학년 ${profile.studentClass}반`;
  }, [profile]);

  // 로그인된 학생/학부모 정보 자동 바인딩
  const studentName = profile?.studentName || '';
  const parentPhone = profile?.parentPhone || profile?.phoneNumber || '';

  const [config, setConfig] = useState<ConsultationConfig | null>(null);
  const [slotsData, setSlotsData] = useState<Record<string, BookingSlot>>({});
  const [orgStructure, setOrgStructure] = useState<any>(null);
  const [usersDirectory, setUsersDirectory] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // 실시간 구독
  useEffect(() => {
    if (!classKey) return;

    const unsubConfig = onConsultationConfigUpdate(classKey, (cfg) => {
      setConfig(cfg);
    });

    const unsubSlots = onConsultationSlotsUpdate(classKey, (slots) => {
      setSlotsData(slots);
    });

    return () => {
      unsubConfig();
      unsubSlots();
    };
  }, [classKey]);

  useEffect(() => {
    const unsubOrg = onOrgStructureUpdate((org) => setOrgStructure(org));
    const unsubUsers = onUsersDirectoryUpdate((users) => setUsersDirectory(users));
    return () => {
      unsubOrg();
      unsubUsers();
    };
  }, []);

  // 담임 선생님 성명 자동 매칭
  const homeroomTeacherName = useMemo(() => {
    if (!profile?.studentGrade || !profile?.studentClass) return '';
    const g = String(parseInt(profile.studentGrade, 10) || profile.studentGrade).trim();
    const c = String(parseInt(profile.studentClass, 10) || profile.studentClass).trim();
    const gradeClassKey = `${g}-${c}`;

    const teacherEmail = orgStructure?.homerooms?.[gradeClassKey] ||
                         orgStructure?.homerooms?.[`${profile.studentGrade}-${profile.studentClass}`] ||
                         Object.entries(orgStructure?.homerooms || {}).find(([k]) => {
                           const [kg, kc] = k.split('-').map(s => String(parseInt(s, 10) || s).trim());
                           return kg === g && kc === c;
                         })?.[1];

    if (!teacherEmail) return '';
    const teacherUser = usersDirectory.find(u => u.email?.toLowerCase() === teacherEmail.toLowerCase());
    return teacherUser?.name || teacherEmail.split('@')[0];
  }, [profile, orgStructure, usersDirectory]);

  // 내 신청 확인
  const myBookingSlot = useMemo(() => {
    if (!studentName && !user?.email) return null;
    const trimmed = studentName.trim().toLowerCase();
    const userEmail = user?.email?.toLowerCase();

    return Object.values(slotsData).find(
      (slot) =>
        slot.status === 'BOOKED' &&
        ((trimmed && (slot.bookedBy?.studentName || '').trim().toLowerCase() === trimmed) ||
          (userEmail && slot.bookedBy?.bookedByEmail?.toLowerCase() === userEmail))
    );
  }, [slotsData, studentName, user]);

  const myBookingId = myBookingSlot ? myBookingSlot.id : null;

  // 시간 파싱 헬퍼
  const parseTimeToMinutes = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const formatMinutesToTime = (minutes: number) => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  // 날짜 열 계산
  const dateColumns = useMemo(() => {
    if (!config?.startDate || !config?.endDate) return [];
    const dates: { dateStr: string; label: string; isExcluded: boolean }[] = [];
    const start = new Date(config.startDate);
    const end = new Date(config.endDate);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    let curr = new Date(start);
    while (curr <= end) {
      const dayOfWeek = curr.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        dates.push({
          dateStr,
          label: `${curr.getMonth() + 1}.${curr.getDate()}(${dayNames[dayOfWeek]})`,
          isExcluded: config.excludedDates?.includes(dateStr) || false,
        });
      }
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }, [config?.startDate, config?.endDate, config?.excludedDates]);

  // 시간 슬롯 행 계산
  const timeSlotRows = useMemo(() => {
    if (!config) return [];
    const rows: { timeRange: string; startMin: number }[] = [];
    const startMin = parseTimeToMinutes(config.dailyStartTime || '13:40');
    const endMin = parseTimeToMinutes(config.dailyEndTime || '16:20');
    const duration = config.slotDuration || 20;

    let current = startMin;
    while (current + duration <= endMin) {
      const next = current + duration;
      rows.push({
        timeRange: `${formatMinutesToTime(current)} ~ ${formatMinutesToTime(next)}`,
        startMin: current,
      });
      current = next;
    }
    return rows;
  }, [config]);

  const getSlotKey = (dateStr: string, timeRange: string) =>
    `${dateStr}__${timeRange.replace(/\s+/g, '')}`;

  const getSlot = (dateStr: string, timeRange: string): BookingSlot => {
    const key = getSlotKey(dateStr, timeRange);
    if (config?.excludedDates?.includes(dateStr)) {
      return { id: key, date: dateStr, timeRange, status: 'BLOCKED' };
    }
    return slotsData[key] || { id: key, date: dateStr, timeRange, status: 'AVAILABLE' };
  };

  // 신청 핸들러
  const handleParentBook = async (dateStr: string, timeRange: string) => {
    if (!config?.isOpen) {
      setAlertMessage('현재 학부모 상담 신청 기간이 아니거나 접수가 마감(종료)되었습니다.');
      return;
    }

    if (!studentName) {
      setAlertMessage('로그인된 학생 정보를 찾을 수 없습니다.');
      return;
    }

    if (myBookingId) {
      setAlertMessage('이미 신청된 상담 일정이 있습니다. 변경하려면 기존 예약을 먼저 취소해 주세요.');
      return;
    }

    const key = getSlotKey(dateStr, timeRange);
    const current = getSlot(dateStr, timeRange);

    if (current.status === 'BOOKED' || current.status === 'BLOCKED') {
      setAlertMessage('이미 예약되었거나 마감된 시간대입니다. 다른 시간을 선택해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await bookConsultationSlotTransaction(classKey, key, dateStr, timeRange, {
        studentName: studentName.trim(),
        parentPhone: parentPhone.trim(),
        bookedByEmail: user?.email || '',
      });

      setAlertMessage(null);
      toast({
        title: '상담 신청 완료',
        description: `${dateStr} (${timeRange}) 상담 신청이 확정되었습니다.`,
      });
    } catch (err: any) {
      console.error(err);
      if (err.message === 'ALREADY_BOOKED') {
        setAlertMessage('방금 다른 학부모님께서 먼저 신청을 완료한 시간대입니다. 다른 시간을 선택해 주세요.');
      } else if (err.message === 'SLOT_BLOCKED') {
        setAlertMessage('현재 해당 시간대는 상담 불가로 마감되었습니다.');
      } else {
        setAlertMessage('신청 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 취소 핸들러
  const handleParentCancel = async () => {
    if (!myBookingId) return;
    if (!confirm('신청된 상담 일정을 취소하시겠습니까? 취소 후 다른 시간대로 다시 신청할 수 있습니다.')) return;

    try {
      await cancelConsultationSlot(classKey, myBookingId);
      toast({ title: '예약 취소 완료', description: '상담 예약이 취소되었습니다. 새로운 시간대를 선택하실 수 있습니다.' });
    } catch (err) {
      console.error(err);
      toast({ title: '취소 실패', description: '예약 취소 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <span className="text-xs text-slate-500">로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
      {/* 상단 네비게이션 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 sm:h-9 text-xs sm:text-sm bg-white hover:bg-slate-50 text-muted-foreground hover:text-foreground shadow-xs shrink-0"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            뒤로가기
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 sm:h-9 text-xs sm:text-sm bg-white hover:bg-slate-50 text-muted-foreground hover:text-foreground shadow-xs shrink-0"
            onClick={() => router.push('/parents')}
          >
            <Home className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            홈
          </Button>
        </div>

        {classLabel && (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold text-xs px-2.5 py-1">
            {classLabel} · {studentName ? `${studentName} 학생` : ''}
          </Badge>
        )}
      </div>

      {/* 페이지 타이틀 카드 */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <span>{config?.title || '학부모 상담 주간 신청'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            원하시는 빈 시간대를 클릭하시면 선착순으로 즉시 배정됩니다. (로그인 정보로 자동 신청)
          </p>
        </div>

        {config && (
          <div className="flex items-center gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200 shrink-0">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-slate-700">
              상담 기간: {config.startDate} ~ {config.endDate} ({config.slotDuration}분 단위)
            </span>
          </div>
        )}
      </div>

      {/* 상담 미접수(종료) 안내 배너 */}
      {config && !config.isOpen && (
        <div className="flex items-center justify-between p-4 bg-slate-100 border border-slate-300 rounded-xl text-slate-800 text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-slate-500 shrink-0" />
            <div>
              <div className="font-bold text-slate-800">현재 학부모 상담 신청이 접수 중이 아닙니다 (신청 마감/종료).</div>
              <div className="text-[11px] text-slate-500 mt-0.5">담임 선생님께서 상담 신청을 오픈(시작)하시면 신청하실 수 있습니다.</div>
            </div>
          </div>
        </div>
      )}

      {/* 경고 배너 */}
      {alertMessage && (
        <div className="flex items-center justify-between p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{alertMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertMessage(null)}
            className="text-xs font-bold underline ml-4 hover:text-rose-950 cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}

          {/* 내 예약 완료 배너 */}
          {myBookingSlot && (
            <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-950 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-700">
                    상담 예약 확정 {config && !config.isOpen ? '(접수 마감됨)' : ''}
                  </div>
                  <div className="text-sm font-black mt-0.5">
                    {myBookingSlot.date} ({myBookingSlot.timeRange}) — 학생: {myBookingSlot.bookedBy?.studentName}
                    {homeroomTeacherName && <span className="font-normal text-emerald-800 ml-1.5">(담임: {homeroomTeacherName})</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                {/* 캘린더에 바로 등록 버튼 */}
                <Button
                  type="button"
                  size="sm"
                  asChild
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs cursor-pointer"
                >
                  <a
                    href={getGoogleCalendarUrl({
                      title: `[학부모 상담] ${myBookingSlot.bookedBy?.studentName || studentName} 학생 1:1 상담 (${classLabel})`,
                      startDateStr: myBookingSlot.date,
                      timeRange: myBookingSlot.timeRange,
                      description: `KIS 학부모 상담 주간 일정\n- 학생명: ${myBookingSlot.bookedBy?.studentName || studentName}\n- 학급: ${classLabel}\n- 담임교사: ${homeroomTeacherName || '담임교사'}\n- 일시: ${myBookingSlot.date} ${myBookingSlot.timeRange}`,
                      location: `${classLabel} 교실`,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    <span>구글 캘린더에 등록</span>
                  </a>
                </Button>

                {config?.isOpen ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleParentCancel}
                    className="text-xs font-bold bg-white hover:bg-rose-50 border-rose-200 text-rose-600 gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>예약 취소 후 변경하기</span>
                  </Button>
                ) : (
                  <Badge variant="outline" className="bg-white border-emerald-300 text-emerald-800 text-xs font-bold px-3 py-1">
                    일정 확정됨 (수정은 담임 문의)
                  </Badge>
                )}
              </div>
            </div>
          )}

      {/* 시간표 그리드 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-xs font-bold text-slate-700">
                <th className="p-3 w-48 border-r border-slate-200 bg-slate-100 whitespace-nowrap">
                  상담 시간 ({config?.slotDuration || 20}분)
                </th>
                {dateColumns.map((col) => (
                  <th key={col.dateStr} className="p-3 border-r border-slate-200 last:border-r-0">
                    <span className={col.isExcluded ? 'line-through text-slate-400 font-semibold' : 'text-slate-800 font-black'}>
                      {col.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-200">
              {timeSlotRows.map((row) => (
                <tr key={row.timeRange} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-3 font-bold bg-slate-50/90 border-r border-slate-200 text-slate-700 whitespace-nowrap">
                    {row.timeRange}
                  </td>

                  {dateColumns.map((col) => {
                    const slot = getSlot(col.dateStr, row.timeRange);
                    const isMySlot = myBookingId === slot.id;

                    let cellContent = null;
                    let cellClass = 'p-2.5 border-r border-slate-200 last:border-r-0 transition-all ';

                    if (slot.status === 'BLOCKED' || col.isExcluded) {
                      cellClass += 'bg-slate-100 text-slate-400 cursor-not-allowed';
                      cellContent = (
                        <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 font-medium">
                          <Lock className="w-3 h-3" />
                          <span>마감/불가</span>
                        </div>
                      );
                    } else if (slot.status === 'BOOKED') {
                      if (isMySlot) {
                        cellClass += 'bg-emerald-100 border-2 border-emerald-500 text-emerald-950 font-black';
                        cellContent = (
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>내 예약 완료</span>
                          </div>
                        );
                      } else {
                        cellClass += 'bg-slate-200/80 text-slate-500 font-medium cursor-not-allowed';
                        cellContent = (
                          <div className="flex items-center justify-center gap-1">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>예약 마감</span>
                          </div>
                        );
                      }
                    } else {
                      cellClass += 'bg-white hover:bg-indigo-50/60 cursor-pointer text-indigo-600';
                      cellContent = (
                        <span className="text-[11px] font-bold text-indigo-600 hover:underline">
                          신청 가능
                        </span>
                      );
                    }

                    return (
                      <td
                        key={col.dateStr}
                        className={cellClass}
                        onClick={() => {
                          if (slot.status === 'AVAILABLE' && !col.isExcluded) {
                            handleParentBook(col.dateStr, row.timeRange);
                          } else if (slot.status === 'BOOKED' && !isMySlot) {
                            setAlertMessage('이미 다른 학부모님께서 신청을 완료한 시간대입니다.');
                          }
                        }}
                      >
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 하단 범례 */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-4 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-white border border-slate-300 rounded-md"></div>
            <span>신청 가능</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-emerald-100 border border-emerald-500 rounded-md"></div>
            <span>내 예약</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-slate-200 border border-slate-300 rounded-md"></div>
            <span>예약 마감</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-slate-100 border border-slate-200 rounded-md"></div>
            <span>상담 불가/제외</span>
          </div>
        </div>
      </div>
    </div>
  );
}
