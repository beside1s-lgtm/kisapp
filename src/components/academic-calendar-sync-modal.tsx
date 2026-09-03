'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { onDocConfigUpdate, getDocConfig } from '@/lib/services/settingsService';
import { updateUserCalendarAck } from '@/lib/services/userService';
import type { AcademicCalendarConfig, AcademicEvent } from '@/lib/types';
import { generateAcademicIcsFile } from '@/lib/utils';
import { onMorningGateDutyUpdate, extractTeacherDutySlots, type MultiSemesterMorningGateDutyConfig } from '@/lib/kisbus/morning-gate-duty';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Globe, Check, Lock, Sun, Clock, Bell, BellOff, UserCheck, Sparkles, AlertCircle } from 'lucide-react';

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

export function AcademicCalendarSyncModal() {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [academicCal, setAcademicCal] = useState<AcademicCalendarConfig | null>(null);
  const [gateDutyConfig, setGateDutyConfig] = useState<MultiSemesterMorningGateDutyConfig | null>(null);
  
  // Gate Duty Inclusion States
  const [includeGateDuty, setIncludeGateDuty] = useState(true);
  const [selectedTeacherName, setSelectedTeacherName] = useState<string>('');
  const [dontShowAgainChecked, setDontShowAgainChecked] = useState(false);

  const isParent = profile?.role === '학부모' || profile?.role === 'parent' || !profile?.role;

  // Check if calendar sync was already acknowledged for this account or browser
  const isAlreadyAcked = (cal?: AcademicCalendarConfig | null) => {
    if (!cal) return true;
    const version = cal.publishedVersion || 1;

    // 1. 계정 수준 확인: DB에 저장된 사용자의 확인 버전이 현재 버전 이상이면 팝업 차단
    if (profile?.lastAckAcademicCalVersion && profile.lastAckAcademicCalVersion >= version) {
      return true;
    }

    // 2. 브라우저 로컬 스토리지 확인
    const ackVer = typeof window !== 'undefined' ? localStorage.getItem('lastAckAcademicCalVersion') : null;
    if (ackVer && parseInt(ackVer, 10) >= version) {
      return true;
    }

    // 3. 계정별 로컬 스토리지 키 확인
    if (profile?.email && typeof window !== 'undefined') {
      const userAckVer = localStorage.getItem(`lastAckCalVersion_${profile.email.toLowerCase()}`);
      if (userAckVer && parseInt(userAckVer, 10) >= version) {
        return true;
      }
    }

    return false;
  };

  // Initialize selectedTeacherName when profile is loaded
  useEffect(() => {
    if (profile?.name && !isParent) {
      setSelectedTeacherName(profile.name);
    }
  }, [profile?.name, isParent]);

  // Listen for custom open event to allow opening modal from anywhere (단, 로그인된 상태일 때만)
  useEffect(() => {
    const handleOpen = () => {
      if (!user) return;
      getDocConfig().then(cfg => {
        if (cfg?.academicCalendar) {
          setAcademicCal(cfg.academicCalendar);
        }
      });
      setIsOpen(true);
    };
    window.addEventListener('openAcademicCalendarSyncModal', handleOpen);
    return () => window.removeEventListener('openAcademicCalendarSyncModal', handleOpen);
  }, [user]);

  // Listen for Doc Config (Academic Calendar) & Gate Duty Config
  // 로그인 성공 후 대시보드에 정상 진입했을 때만 자동 팝업 평가
  useEffect(() => {
    if (loading || !user || !isDashboardRoute(pathname)) {
      setIsOpen(false);
      return;
    }

    const checkCalendarSync = (cal?: AcademicCalendarConfig) => {
      if (!cal) return;
      setAcademicCal(cal);
      if (!isAlreadyAcked(cal)) {
        setIsOpen(true);
      }
    };

    getDocConfig().then(cfg => {
      if (cfg?.academicCalendar) {
        checkCalendarSync(cfg.academicCalendar);
      }
    });

    const unsubDoc = onDocConfigUpdate(cfg => {
      if (cfg?.academicCalendar) {
        checkCalendarSync(cfg.academicCalendar);
      }
    });

    const unsubDuty = onMorningGateDutyUpdate(dutyCfg => {
      setGateDutyConfig(dutyCfg);
    });

    return () => {
      unsubDoc();
      unsubDuty();
    };
  }, [loading, user, pathname, profile?.lastAckAcademicCalVersion, profile?.email]);

  // Extract all unique teacher names from gate duty sequence & schedules
  const allTeacherNames = useMemo(() => {
    if (!gateDutyConfig) return [];
    const set = new Set<string>();
    (gateDutyConfig.teacherSequence || []).forEach(name => set.add(name));
    Object.values(gateDutyConfig.schedules || {}).forEach(rows => {
      rows.forEach(r => {
        Object.values(r.days || {}).forEach(slot => {
          if (slot?.teacherName && !slot.isHoliday) {
            set.add(slot.teacherName);
          }
        });
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [gateDutyConfig]);

  // Set default teacher name if not set yet
  useEffect(() => {
    if (!selectedTeacherName && allTeacherNames.length > 0 && !isParent) {
      if (profile?.name && allTeacherNames.includes(profile.name)) {
        setSelectedTeacherName(profile.name);
      } else if (allTeacherNames.length > 0) {
        setSelectedTeacherName(allTeacherNames[0]);
      }
    }
  }, [allTeacherNames, selectedTeacherName, profile?.name, isParent]);

  // Calculate duty slots for currently selected teacher
  const myDutySlots = useMemo(() => {
    if (!gateDutyConfig || !selectedTeacherName) return [];
    return extractTeacherDutySlots(gateDutyConfig, selectedTeacherName);
  }, [gateDutyConfig, selectedTeacherName]);

  const handleAcknowledge = () => {
    const ver = academicCal?.publishedVersion || 1;
    // 1. 브라우저 로컬 스토리지에 저장
    localStorage.setItem('lastAckAcademicCalVersion', ver.toString());
    if (profile?.email) {
      localStorage.setItem(`lastAckCalVersion_${profile.email.toLowerCase()}`, ver.toString());
      // 2. 계정 DB(Firestore)에 저장하여 다른 브라우저/기기 접속 시에도 팝업 원천 차단
      updateUserCalendarAck(profile.email, ver);
    }
    setIsOpen(false);
  };

  const handleDismissWithoutSync = () => {
    handleAcknowledge();
  };

  const handleDownloadIcs = () => {
    if (!academicCal) return;
    try {
      const gateDutyOption = (!isParent && includeGateDuty && myDutySlots.length > 0) ? {
        includeGateDuty: true,
        teacherName: selectedTeacherName,
        dutySlots: myDutySlots
      } : undefined;

      const icsContent = generateAcademicIcsFile(academicCal, isParent, gateDutyOption);
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileNameSuffix = gateDutyOption ? `_${selectedTeacherName}_근무포함` : '';
      link.setAttribute('download', `KSHCM_calendar_${academicCal.year || 2026}${fileNameSuffix}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      handleAcknowledge();
    } catch (err) {
      console.error(err);
    }
  };

  const handleGoogleCalendarSync = () => {
    handleDownloadIcs();
    window.open('https://calendar.google.com/calendar/r/settings/export', '_blank');
  };

  // 로그인되지 않았거나, 대시보드 외 경로(로그인/초기화면 등)에 있거나 로딩 중이면 모달을 렌더링하지 않음 (로그인 전 노출 원천 차단)
  if (loading || !user || !isDashboardRoute(pathname) || !academicCal) return null;

  // Filter events based on role
  const visibleEvents = (academicCal.events || []).filter(ev => {
    if (isParent && ev.isParentPrivate) return false;
    return true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleAcknowledge(); }}>
      <DialogContent className="sm:max-w-[650px] w-[95vw] max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
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
            {academicCal.year || 2026}학년도 최신 학사 일정(휴업일, 행사)과 { !isParent ? '선생님 맞춤 등교지도 근무일정이' : '주요 학사일정이' } 업데이트되었습니다. 내 캘린더(구글, 애플, 아웃룩)에 동기화하여 최신 일정을 확인하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1 text-xs">
          {/* 교직원 전용: 나의 등교지도 근무일 맞춤 포함 옵션 (개인별 캘린더 생성) */}
          {!isParent && (
            <div className="p-3.5 bg-linear-to-br from-amber-50/90 via-amber-50/50 to-orange-50/80 rounded-xl border border-amber-200 shadow-xs space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-300/60 flex items-center justify-center text-amber-700 shrink-0">
                    <Sun className="w-4 h-4 text-amber-600 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="gateDutyCheck" className="font-bold text-amber-950 text-xs cursor-pointer flex items-center gap-1">
                        나의 등교지도 근무일 일정에 포함하기
                      </Label>
                      <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] px-1.5 py-0 font-bold shrink-0">
                        선생님별 맞춤
                      </Badge>
                    </div>
                    <span className="text-[11px] text-amber-800/90 block mt-0.5">
                      오전 07:40 ~ 08:20 (종일X) · 1일 전 및 30분 전 자동 알림 예약
                    </span>
                  </div>
                </div>

                <Checkbox 
                  id="gateDutyCheck"
                  checked={includeGateDuty} 
                  onCheckedChange={(checked) => setIncludeGateDuty(!!checked)}
                  className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 w-5 h-5 rounded-md mt-0.5"
                />
              </div>

              {includeGateDuty && (
                <div className="pt-2 border-t border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-amber-900">근무 교사:</span>
                      {allTeacherNames.length > 0 ? (
                        <Select value={selectedTeacherName} onValueChange={setSelectedTeacherName}>
                          <SelectTrigger className="h-7 w-auto min-w-[110px] text-xs font-bold bg-white border-amber-300 text-amber-950">
                            <SelectValue placeholder="교사 선택" />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            {allTeacherNames.map(name => (
                              <SelectItem key={name} value={name} className="text-xs">
                                {name} 선생님
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="bg-white text-amber-900 border-amber-300 font-bold">
                          {selectedTeacherName || profile?.name || '선생님'}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-amber-900 font-bold">
                      <Bell className="w-3.5 h-3.5 text-amber-600" />
                      <span>총 {myDutySlots.length}회 근무 배정됨</span>
                    </div>
                  </div>

                  {/* 배정된 근무일 미리보기 */}
                  {myDutySlots.length > 0 ? (
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-white/90 rounded-lg border border-amber-100">
                        {myDutySlots.map((slot, idx) => (
                          <div 
                            key={`${slot.dateStr}-${idx}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-md text-[10px] font-semibold text-amber-900"
                          >
                            <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{slot.dateStr} ({slot.dayOfWeekName})</span>
                            {slot.roundNumber && (
                              <span className="text-amber-600 font-normal">[{slot.roundNumber}회차]</span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-amber-700/90 px-0.5">
                        <span>⏰ 근무: 07:40 ~ 08:20 (40분)</span>
                        <span>🔔 알림: 1일 전 (24시간 전) & 30분 전</span>
                      </div>
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

          {/* 학기 기간 안내 요약 */}
          <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-1.5">
            <span className="font-bold text-indigo-950 text-xs block">{academicCal.year || 2026}학년도 학기 및 방학 운영 일정</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
              <div className="bg-white p-2 rounded-lg border border-indigo-100 flex flex-col justify-center">
                <span className="text-slate-400 font-semibold block text-[10px]">1학기</span>
                <span className="font-bold text-slate-800 text-[11px] leading-snug mt-0.5">
                  {academicCal.semesters?.sem1?.startDate} ~
                  <span className="block">{academicCal.semesters?.sem1?.endDate}</span>
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-indigo-100 flex flex-col justify-center">
                <span className="text-slate-400 font-semibold block text-[10px]">여름방학</span>
                <span className="font-bold text-slate-800 text-[11px] leading-snug mt-0.5">
                  {academicCal.semesters?.vacationSummer?.startDate} ~
                  <span className="block">{academicCal.semesters?.vacationSummer?.endDate}</span>
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-indigo-100 flex flex-col justify-center">
                <span className="text-slate-400 font-semibold block text-[10px]">2학기</span>
                <span className="font-bold text-slate-800 text-[11px] leading-snug mt-0.5">
                  {academicCal.semesters?.sem2?.startDate} ~
                  <span className="block">{academicCal.semesters?.sem2?.endDate}</span>
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-indigo-100 flex flex-col justify-center">
                <span className="text-slate-400 font-semibold block text-[10px]">겨울방학</span>
                <span className="font-bold text-slate-800 text-[11px] leading-snug mt-0.5">
                  {academicCal.semesters?.vacationWinter?.startDate} ~
                  <span className="block">{academicCal.semesters?.vacationWinter?.endDate}</span>
                </span>
              </div>
            </div>
          </div>

          {/* 주요 휴업일 및 행사 목록 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs">
                공식 학사 행사 및 휴업일 ({visibleEvents.length}건)
              </span>
              {isParent && (
                <span className="text-[10px] text-slate-400">
                  (학부모 공개 전용 일정만 표시됩니다)
                </span>
              )}
            </div>

            <div className="max-h-[130px] overflow-y-auto border rounded-xl divide-y divide-slate-100 bg-white">
              {visibleEvents.length > 0 ? (
                visibleEvents.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2 font-mono flex-wrap">
                      <span className="font-bold text-slate-800">{ev.date}</span>
                      <span className="font-semibold text-slate-700">{ev.title}</span>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] font-semibold px-1.5 py-0 ${
                          ev.type === 'PUBLIC_HOLIDAY' 
                            ? 'bg-rose-50 text-rose-700 border-rose-200' 
                            : ev.type === 'HOLIDAY' 
                              ? 'bg-amber-50 text-amber-800 border-amber-200' 
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {ev.type === 'PUBLIC_HOLIDAY' ? '공휴일' : ev.type === 'HOLIDAY' ? '휴업일' : '학교행사'}
                      </Badge>
                      {!isParent && ev.isParentPrivate && (
                        <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 font-bold px-1.5 py-0 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> 교직원 전용
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-3 text-center text-slate-400 text-xs">
                  등록된 학사 행사가 없습니다.
                </div>
              )}
            </div>

            {/* 중복 방지 기술 안내 */}
            <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-medium leading-relaxed">
              <strong>중복 방지 기술 적용됨</strong>: 구글/애플/아웃룩 캘린더는 고유 식별자(UID)를 사용하므로, 일정을 여러 번 추가해도 <strong>기존 일정 중복 생성 없이 최신 내용으로 깔끔하게 자동 덮어쓰기</strong>됩니다.
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t">
          {/* 다시 띄우지 않기 버튼 */}
          <Button
            type="button"
            variant="ghost"
            onClick={handleDismissWithoutSync}
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
              className="h-9 text-xs font-bold text-indigo-700 border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 rounded-xl px-3"
            >
              .ics 다운로드
            </Button>
            <Button
              type="button"
              onClick={handleGoogleCalendarSync}
              className="h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs px-4"
            >
              <Globe className="w-3.5 h-3.5 mr-1.5" />
              구글 캘린더 연동
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


