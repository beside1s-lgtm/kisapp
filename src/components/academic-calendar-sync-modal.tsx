'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { onDocConfigUpdate, getDocConfig } from '@/lib/services/settingsService';
import { updateUserCalendarAck } from '@/lib/services/userService';
import type { AcademicCalendarConfig, AcademicEvent } from '@/lib/types';
import { generateGateDutyIcsFile } from '@/lib/utils';
import { buildGoogleCalendarUrl, buildAcademicEventGoogleCalendarUrl } from '@/lib/services/calendarExportService';
import { onMorningGateDutyUpdate, extractTeacherDutySlots, type MultiSemesterMorningGateDutyConfig, type TeacherDutySlotDetail } from '@/lib/kisbus/morning-gate-duty';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Globe, Sun, Clock, Bell, BellOff, Sparkles, AlertCircle, Download } from 'lucide-react';
import { usePathname } from 'next/navigation';

// 대시보드 및 내부 서비스 경로 확인 (로그인 화면, 루트 리다이렉트, 약관 페이지 제외)
function isDashboardRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/parents/login' ||
    pathname === '/parents/setup' ||
    pathname === '/privacy'
  ) {
    return false;
  }
  return (
    pathname.startsWith('/inbox') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/teacher') ||
    pathname.startsWith('/parents') ||
    pathname.startsWith('/new') ||
    pathname.startsWith('/sent') ||
    pathname.startsWith('/recalled') ||
    pathname.startsWith('/registry') ||
    pathname.startsWith('/attendance-registry') ||
    pathname.startsWith('/field-trip-registry') ||
    pathname.startsWith('/circular') ||
    pathname.startsWith('/documents') ||
    pathname.startsWith('/edit')
  );
}

// ICS 헤더/푸터 헬퍼
function buildIcsHeader(calName: string): string[] {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KSHCM//Academic Calendar//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Ho_Chi_Minh',
    'X-LIC-LOCATION:Asia/Ho_Chi_Minh',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0700',
    'TZOFFSETTO:+0700',
    'TZNAME:+07',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
}

function buildEventVEvent(ev: AcademicEvent): string[] {
  const start = ev.date.replace(/-/g, '');
  const endDateObj = new Date(ev.date);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const end = endDateObj.toISOString().split('T')[0].replace(/-/g, '');
  const category = ev.type === 'PUBLIC_HOLIDAY' ? '법정공휴일' : ev.type === 'HOLIDAY' ? '재량휴업일' : '학교행사';
  return [
    'BEGIN:VEVENT',
    `UID:ev-${ev.id || start}-${start}@kshcm.school`,
    `SUMMARY:[${category}] ${ev.title}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `DESCRIPTION:구분: ${category} (수업일 ${ev.isSchoolDay ? '포함' : '제외'})`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
  ];
}

function buildDutyVEvent(slot: TeacherDutySlotDetail, teacherName: string): string[] {
  const cleanDate = slot.dateStr.replace(/-/g, '');
  const startTime = (slot.startTime || '07:40').replace(':', '') + '00';
  const endTime = (slot.endTime || '08:20').replace(':', '') + '00';
  const roundLabel = slot.roundNumber ? ` (${slot.roundNumber}회차)` : '';
  return [
    'BEGIN:VEVENT',
    `UID:gateduty-${cleanDate}-${teacherName}@kshcm.school`,
    `SUMMARY:[등교지도 필수근무] ${teacherName} 선생님 교문 등교 지도 (07:40~08:20)${roundLabel}`,
    `DTSTART;TZID=Asia/Ho_Chi_Minh:${cleanDate}T${startTime}`,
    `DTEND;TZID=Asia/Ho_Chi_Minh:${cleanDate}T${endTime}`,
    `DESCRIPTION:호치민시한국국제학교 오전 교문 등교지도 필수 근무 시간입니다.\\n· 담당 교사: ${teacherName} 선생님\\n· 일자: ${slot.dateStr} (${slot.dayOfWeekName || ''})${roundLabel}\\n· 근무 시간: 오전 07:40 ~ 08:20 (시간엄수: 07:35까지 현장 도착)\\n· 위치: 정문 교문 및 중앙현관\\n· 긴급상황 시 학생생활안전부/보건실 즉시 연락`,
    'STATUS:CONFIRMED',
    // 1. 하루 전 사전 알림
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:[등교지도 전일알림] 내일(${slot.dateStr}) 오전 07:40 교문 등교 지도 필수 근무일입니다! 늦지 않도록 사전 준비 바랍니다.`,
    'TRIGGER:-P1D',
    'END:VALARM',
    // 2. 1시간 전 준비 알림
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:[등교지도 1시간 전] 오늘 오전 07:40 등교 지도가 있습니다! 07:35까지 정문 교문/중앙현관에 도착해 주세요.`,
    'TRIGGER:-PT1H',
    'END:VALARM',
    // 3. 10분 전 긴급 알림
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:[긴급! 등교지도 10분 전] 곧 07:40 등교 지도가 시작됩니다! 즉시 교문/중앙현관으로 이동 바랍니다.`,
    'TRIGGER:-PT10M',
    'END:VALARM',
    'END:VEVENT',
  ];
}

export function AcademicCalendarSyncModal() {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [academicCal, setAcademicCal] = useState<AcademicCalendarConfig | null>(null);
  const [gateDutyConfig, setGateDutyConfig] = useState<MultiSemesterMorningGateDutyConfig | null>(null);

  // Teacher selector
  const [includeGateDuty, setIncludeGateDuty] = useState(true);
  const [selectedTeacherName, setSelectedTeacherName] = useState<string>('');

  // 체크박스 선택 상태: Set<eventId or dateStr>
  const [checkedEventIds, setCheckedEventIds] = useState<Set<string>>(new Set());
  const [checkedDutyDates, setCheckedDutyDates] = useState<Set<string>>(new Set());

  const isParent = profile?.role === '학부모' || profile?.role === 'parent' || !profile?.role;

  const isAlreadyAcked = (cal?: AcademicCalendarConfig | null) => {
    if (!cal) return true;
    const version = cal.publishedVersion || 1;
    if (profile?.lastAckAcademicCalVersion && profile.lastAckAcademicCalVersion >= version) return true;
    const ackVer = typeof window !== 'undefined' ? localStorage.getItem('lastAckAcademicCalVersion') : null;
    if (ackVer && parseInt(ackVer, 10) >= version) return true;
    if (profile?.email && typeof window !== 'undefined') {
      const userAckVer = localStorage.getItem(`lastAckCalVersion_${profile.email.toLowerCase()}`);
      if (userAckVer && parseInt(userAckVer, 10) >= version) return true;
    }
    return false;
  };

  useEffect(() => {
    if (profile?.name && !isParent) setSelectedTeacherName(profile.name);
  }, [profile?.name, isParent]);

  useEffect(() => {
    const handleOpen = () => {
      if (!user) return;
      getDocConfig().then(cfg => {
        if (cfg?.academicCalendar) setAcademicCal(cfg.academicCalendar);
      });
      setIsOpen(true);
    };
    window.addEventListener('openAcademicCalendarSyncModal', handleOpen);
    return () => window.removeEventListener('openAcademicCalendarSyncModal', handleOpen);
  }, [user]);

  useEffect(() => {
    if (loading || !user || !isDashboardRoute(pathname)) { setIsOpen(false); return; }

    const checkCalendarSync = (cal?: AcademicCalendarConfig) => {
      if (!cal) return;
      setAcademicCal(cal);
      if (!isAlreadyAcked(cal)) setIsOpen(true);
    };

    getDocConfig().then(cfg => { if (cfg?.academicCalendar) checkCalendarSync(cfg.academicCalendar); });
    const unsubDoc = onDocConfigUpdate(cfg => { if (cfg?.academicCalendar) checkCalendarSync(cfg.academicCalendar); });
    const unsubDuty = onMorningGateDutyUpdate(dutyCfg => { setGateDutyConfig(dutyCfg); });
    return () => { unsubDoc(); unsubDuty(); };
  }, [loading, user, pathname, profile?.lastAckAcademicCalVersion, profile?.email]);

  const allTeacherNames = useMemo(() => {
    if (!gateDutyConfig) return [];
    const set = new Set<string>();
    (gateDutyConfig.teacherSequence || []).forEach(name => set.add(name));
    Object.values(gateDutyConfig.schedules || {}).forEach(rows => {
      rows.forEach(r => {
        Object.values(r.days || {}).forEach(slot => {
          if (slot?.teacherName && !slot.isHoliday) set.add(slot.teacherName);
        });
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [gateDutyConfig]);

  useEffect(() => {
    if (!selectedTeacherName && allTeacherNames.length > 0 && !isParent) {
      if (profile?.name && allTeacherNames.includes(profile.name)) setSelectedTeacherName(profile.name);
      else if (allTeacherNames.length > 0) setSelectedTeacherName(allTeacherNames[0]);
    }
  }, [allTeacherNames, selectedTeacherName, profile?.name, isParent]);

  const myDutySlots = useMemo(() => {
    if (!gateDutyConfig || !selectedTeacherName) return [];
    return extractTeacherDutySlots(gateDutyConfig, selectedTeacherName);
  }, [gateDutyConfig, selectedTeacherName]);

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const futureDutySlots = useMemo(
    () => myDutySlots.filter(s => new Date(s.dateStr) >= today),
    [myDutySlots, today]
  );

  // visibleEvents는 렌더링 시점에 결정되어야 하므로 아래에서 처리
  // 초기화: 모달 열릴 때 학사 행사 / 미래 근무일 전체 체크
  useEffect(() => {
    if (!isOpen || !academicCal) return;
    const evIds = new Set<string>(
      (academicCal.events || [])
        .filter(ev => !(isParent && ev.isParentPrivate))
        .map(ev => ev.id || ev.date)
    );
    setCheckedEventIds(evIds);
  }, [isOpen, academicCal, isParent]);

  useEffect(() => {
    if (!isOpen) return;
    setCheckedDutyDates(new Set<string>(futureDutySlots.map(s => s.dateStr)));
  }, [isOpen, futureDutySlots]);

  const toggleEvent = useCallback((id: string) => {
    setCheckedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleDuty = useCallback((dateStr: string) => {
    setCheckedDutyDates(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
      return next;
    });
  }, []);

  const handleAcknowledge = () => {
    const ver = academicCal?.publishedVersion || 1;
    localStorage.setItem('lastAckAcademicCalVersion', ver.toString());
    if (profile?.email) {
      localStorage.setItem(`lastAckCalVersion_${profile.email.toLowerCase()}`, ver.toString());
      updateUserCalendarAck(profile.email, ver);
    }
    setIsOpen(false);
  };

  // 선택된 항목만 포함하여 ICS 생성 후 다운로드
  const handleDownloadIcs = () => {
    if (!academicCal) return;
    try {
      const visibleEvs = (academicCal.events || []).filter(ev => !(isParent && ev.isParentPrivate));
      const selectedEvs = visibleEvs.filter(ev => checkedEventIds.has(ev.id || ev.date));
      const selectedDuties = (!isParent && includeGateDuty)
        ? futureDutySlots.filter(s => checkedDutyDates.has(s.dateStr))
        : [];

      const calName = selectedDuties.length > 0
        ? `호치민시한국국제학교 학사 및 ${selectedTeacherName} 등교지도 일정`
        : '호치민시한국국제학교 학사 일정';

      const lines = buildIcsHeader(calName);

      // 학기 기간 (체크박스 없이 항상 포함)
      if (academicCal.semesters) {
        const sMap: Record<string, string> = {
          sem1: '1학기',
          vacationSummer: '여름방학',
          sem2: '2학기',
          vacationWinter: '겨울방학',
        };
        Object.entries(academicCal.semesters).forEach(([key, sem]: [string, any]) => {
          if (sem?.startDate && sem?.endDate) {
            const start = sem.startDate.replace(/-/g, '');
            const endDateObj = new Date(sem.endDate);
            endDateObj.setDate(endDateObj.getDate() + 1);
            const end = endDateObj.toISOString().split('T')[0].replace(/-/g, '');
            lines.push(
              'BEGIN:VEVENT',
              `UID:sem-${key}-${start}@kshcm.school`,
              `SUMMARY:[학사일정] ${sem.name || sMap[key] || '학기'}`,
              `DTSTART;VALUE=DATE:${start}`,
              `DTEND;VALUE=DATE:${end}`,
              `DESCRIPTION:학교 공식 ${sem.name || '운영 기간'}입니다.`,
              'STATUS:CONFIRMED',
              'END:VEVENT'
            );
          }
        });
      }

      // 선택된 학사 행사
      selectedEvs.forEach(ev => lines.push(...buildEventVEvent(ev)));

      // 선택된 등교지도 근무일
      selectedDuties.forEach(slot => lines.push(...buildDutyVEvent(slot, selectedTeacherName)));

      lines.push('END:VCALENDAR');
      const icsContent = lines.join('\r\n');

      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const suffix = selectedDuties.length > 0 ? `_${selectedTeacherName}_근무포함` : '';
      link.setAttribute('download', `KSHCM_calendar_${academicCal.year || 2026}${suffix}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      handleAcknowledge();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !user || !isDashboardRoute(pathname) || !academicCal) return null;

  const visibleEvents = (academicCal.events || []).filter(ev => {
    if (isParent && ev.isParentPrivate) return false;
    return true;
  });

  const selectedEventCount = visibleEvents.filter(ev => checkedEventIds.has(ev.id || ev.date)).length;
  const selectedDutyCount = futureDutySlots.filter(s => checkedDutyDates.has(s.dateStr)).length;
  const totalSelected = selectedEventCount + (includeGateDuty ? selectedDutyCount : 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleAcknowledge(); }}>
      <DialogContent className="sm:max-w-[680px] w-[95vw] max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] px-2 py-0.5 flex items-center gap-1 shadow-xs animate-pulse">
              <Sparkles className="w-3 h-3 text-white" /> 학사일정 알림
            </Badge>
            {academicCal.lastPublishedAt && (
              <span className="text-[11px] text-muted-foreground">
                업데이트: {academicCal.lastPublishedAt.split('T')[0]}
              </span>
            )}
          </div>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-extrabold text-slate-900">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>추가/변경된 학사 일정이 있습니다</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600 leading-relaxed">
            {academicCal.year || 2026}학년도 최신 학사 일정(휴업일, 행사){!isParent ? '과 선생님 맞춤 등교지도 근무일정이' : '이'} 업데이트되었습니다. 원하는 항목만 선택하여 내 캘린더에 동기화하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1 text-xs">

          {/* ── 교직원 전용: 등교지도 근무일정 섹션 ── */}
          {!isParent && (
            <div className="p-3.5 bg-amber-50/90 rounded-xl border border-amber-200 space-y-2.5">
              {/* 헤더: 포함 토글 + 교사 선택 */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="gateDutyCheck"
                    checked={includeGateDuty}
                    onCheckedChange={(c) => setIncludeGateDuty(!!c)}
                    className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 w-4 h-4 rounded"
                  />
                  <Label htmlFor="gateDutyCheck" className="font-bold text-amber-950 text-xs cursor-pointer flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-600" />
                    나의 등교지도 근무일정 포함
                  </Label>
                  <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] px-1.5 py-0 font-bold">선생님 맞춤</Badge>
                </div>

                {includeGateDuty && allTeacherNames.length > 0 && (
                  <Select value={selectedTeacherName} onValueChange={setSelectedTeacherName}>
                    <SelectTrigger className="h-7 w-auto min-w-[110px] text-xs font-bold bg-white border-amber-300 text-amber-950">
                      <SelectValue placeholder="교사 선택" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {allTeacherNames.map(name => (
                        <SelectItem key={name} value={name} className="text-xs">{name} 선생님</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* 근무일 체크박스 목록 */}
              {includeGateDuty && (
                <div className="pt-1 border-t border-amber-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-amber-900 font-semibold">
                    <span>
                      <Bell className="w-3 h-3 text-amber-600 inline mr-1" />
                      07:40~08:20 (07:35까지 현장도착) · {futureDutySlots.length}회 남음 · 1일 전/1시간 전/10분 전 3중 알림
                    </span>
                    {futureDutySlots.length > 0 && (
                      <button
                        type="button"
                        className="text-[10px] text-amber-700 underline hover:text-amber-900"
                        onClick={() => {
                          if (selectedDutyCount === futureDutySlots.length) {
                            setCheckedDutyDates(new Set());
                          } else {
                            setCheckedDutyDates(new Set(futureDutySlots.map(s => s.dateStr)));
                          }
                        }}
                      >
                        {selectedDutyCount === futureDutySlots.length ? '전체 해제' : '전체 선택'}
                      </button>
                    )}
                  </div>

                  {myDutySlots.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-white/80 rounded-lg border border-amber-100">
                      {myDutySlots.map((slot, idx) => {
                        const isPast = new Date(slot.dateStr) < today;
                        const slotKey = slot.dateStr;
                        const googleUrl = buildGoogleCalendarUrl({
                          title: `[등교지도 필수근무] ${selectedTeacherName} 선생님 교문 등교 지도 (07:40~08:20)${slot.roundNumber ? ` (${slot.roundNumber}회차)` : ''}`,
                          startDateStr: slot.dateStr,
                          startTime: slot.startTime || '07:40',
                          endTime: slot.endTime || '08:20',
                          description: `호치민시한국국제학교 오전 교문 등교지도 필수 근무 시간입니다.\n· 담당 교사: ${selectedTeacherName} 선생님\n· 일자: ${slot.dateStr} (${slot.dayOfWeekName || ''})\n· 근무 시간: 07:40 ~ 08:20 (시간 엄수: 07:35까지 현장 도착 필수)\n· 위치: 정문 교문 및 중앙현관\n· 긴급상황 시 학생생활안전부/보건실 즉시 연락`,
                          location: '호치민시한국국제학교 교문/중앙현관',
                        });

                        return (
                          <div
                            key={`${slotKey}-${idx}`}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 border rounded-md text-[10px] font-semibold ${
                              isPast
                                ? 'bg-slate-100 border-slate-200 text-slate-400'
                                : checkedDutyDates.has(slotKey)
                                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                                  : 'bg-white border-slate-200 text-slate-400'
                            }`}
                          >
                            {!isPast && (
                              <Checkbox
                                checked={checkedDutyDates.has(slotKey)}
                                onCheckedChange={() => toggleDuty(slotKey)}
                                className="w-3 h-3 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                              />
                            )}
                            <Clock className="w-3 h-3 shrink-0" />
                            <span className={isPast ? 'line-through' : ''}>{slot.dateStr} ({slot.dayOfWeekName})</span>
                            {slot.roundNumber && <span className="font-normal">[{slot.roundNumber}회차]</span>}
                            {!isPast && (
                              <a
                                href={googleUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-0.5 text-[9px] font-bold bg-amber-200 hover:bg-amber-300 text-amber-900 px-1.5 py-0.5 rounded transition-colors whitespace-nowrap"
                                title="이 근무일 구글 캘린더에 바로 등록"
                                onClick={(e) => e.stopPropagation()}
                              >
                                +캘린더
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-2 bg-white/80 rounded-lg border border-amber-100 text-center text-slate-500 text-[11px]">
                      {selectedTeacherName} 선생님으로 배정된 등교지도 일정이 없습니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 학기 기간 안내 요약 ── */}
          <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-1.5">
            <span className="font-bold text-indigo-950 text-xs block">{academicCal.year || 2026}학년도 학기 및 방학 운영 일정</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
              {(['sem1', 'vacationSummer', 'sem2', 'vacationWinter'] as const).map((key) => {
                const labels: Record<string, string> = { sem1: '1학기', vacationSummer: '여름방학', sem2: '2학기', vacationWinter: '겨울방학' };
                const sem = (academicCal.semesters as any)?.[key];
                return (
                  <div key={key} className="bg-white p-2 rounded-lg border border-indigo-100 flex flex-col justify-center">
                    <span className="text-slate-400 font-semibold block text-[10px]">{labels[key]}</span>
                    <span className="font-bold text-slate-800 text-[11px] leading-snug mt-0.5">
                      {sem?.startDate} ~<span className="block">{sem?.endDate}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 공식 학사 행사 및 휴업일 체크박스 목록 ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs">
                공식 학사 행사 및 휴업일 ({visibleEvents.length}건)
              </span>
              <div className="flex items-center gap-2">
                {isParent && (
                  <span className="text-[10px] text-slate-400">(학부모 공개 전용 일정만 표시)</span>
                )}
                <button
                  type="button"
                  className="text-[10px] text-slate-500 underline hover:text-slate-800"
                  onClick={() => {
                    if (selectedEventCount === visibleEvents.length) {
                      setCheckedEventIds(new Set());
                    } else {
                      setCheckedEventIds(new Set(visibleEvents.map(ev => ev.id || ev.date)));
                    }
                  }}
                >
                  {selectedEventCount === visibleEvents.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
            </div>

            <div className="max-h-[180px] overflow-y-auto border rounded-xl divide-y divide-slate-100 bg-white">
              {visibleEvents.length > 0 ? (
                visibleEvents.map(ev => {
                  const evKey = ev.id || ev.date;
                  const evUrl = buildAcademicEventGoogleCalendarUrl(ev);
                  const isChecked = checkedEventIds.has(evKey);
                  return (
                    <div
                      key={evKey}
                      className={`flex items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${isChecked ? '' : 'opacity-50'}`}
                      onClick={() => toggleEvent(evKey)}
                    >
                      <div className="flex items-center gap-2 font-mono flex-wrap min-w-0 flex-1">
                        <span className="font-bold text-slate-800 shrink-0">{ev.date}</span>
                        <span className="font-semibold text-slate-700 truncate">{ev.title}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold px-1.5 py-0 shrink-0 ${
                            ev.type === 'PUBLIC_HOLIDAY'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : ev.type === 'HOLIDAY'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}
                        >
                          {ev.type === 'PUBLIC_HOLIDAY' ? '공휴일' : ev.type === 'HOLIDAY' ? '휴업일' : '학교행사'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleEvent(evKey)}
                          className="w-4 h-4 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 rounded"
                          aria-label={`${ev.title} 포함 여부`}
                        />
                        <a
                          href={evUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-extrabold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-md flex items-center gap-1 transition-colors"
                          title="구글 캘린더에 바로 등록"
                        >
                          <Globe className="w-2.5 h-2.5" />
                          <span>캘린더 등록</span>
                        </a>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-3 text-center text-slate-400 text-xs">등록된 학사 행사가 없습니다.</div>
              )}
            </div>

            {/* 안내 */}
            <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-900 font-medium leading-relaxed">
              <strong>체크박스</strong>로 원하는 항목만 선택한 뒤 <strong>[선택 항목 .ics 다운로드]</strong>를 누르세요. 각 행의 <strong>[캘린더 등록]</strong> 버튼으로 개별 일정을 구글 캘린더에 즉시 등록할 수 있습니다.
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={handleAcknowledge}
            className="h-9 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl px-3 flex items-center gap-1.5"
          >
            <BellOff className="w-4 h-4 text-slate-400" />
            <span>다시 띄우지 않기</span>
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadIcs}
              disabled={totalSelected === 0}
              className="h-9 text-xs font-bold text-slate-700 border-slate-300 hover:bg-slate-100 rounded-xl px-3"
              title="선택된 항목만 ICS 파일로 다운로드"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              선택 {totalSelected}건 .ics 다운로드
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


