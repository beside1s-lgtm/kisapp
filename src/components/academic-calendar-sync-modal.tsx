'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { onDocConfigUpdate, getDocConfig } from '@/lib/services/settingsService';
import type { AcademicCalendarConfig, AcademicEvent } from '@/lib/types';
import { generateAcademicIcsFile } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Globe, Check, Lock } from 'lucide-react';

export function AcademicCalendarSyncModal() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [academicCal, setAcademicCal] = useState<AcademicCalendarConfig | null>(null);

  const isParent = profile?.role === '학부모' || profile?.role === 'parent' || !profile?.role;

  useEffect(() => {
    const checkCalendarSync = (cal?: AcademicCalendarConfig) => {
      if (!cal || !cal.publishedVersion) return;
      const ackVer = localStorage.getItem('lastAckAcademicCalVersion');
      if (!ackVer || parseInt(ackVer) < cal.publishedVersion) {
        setAcademicCal(cal);
        setIsOpen(true);
      }
    };

    getDocConfig().then(cfg => {
      if (cfg?.academicCalendar) {
        checkCalendarSync(cfg.academicCalendar);
      }
    });

    const unsub = onDocConfigUpdate(cfg => {
      if (cfg?.academicCalendar) {
        checkCalendarSync(cfg.academicCalendar);
      }
    });

    return () => unsub();
  }, []);

  const handleAcknowledge = () => {
    if (academicCal?.publishedVersion) {
      localStorage.setItem('lastAckAcademicCalVersion', academicCal.publishedVersion.toString());
    }
    setIsOpen(false);
  };

  const handleDownloadIcs = () => {
    if (!academicCal) return;
    try {
      const icsContent = generateAcademicIcsFile(academicCal, isParent);
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `KSHCM_academic_calendar_${academicCal.year || 2026}.ics`);
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

  if (!academicCal) return null;

  // Filter events based on role
  const visibleEvents = (academicCal.events || []).filter(ev => {
    if (isParent && ev.isParentPrivate) return false;
    return true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleAcknowledge(); }}>
      <DialogContent className="sm:max-w-[620px] w-[95vw] max-h-[92vh] overflow-hidden p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-1">
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-slate-900">
            <Calendar className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>2026학년도 최신 학사 일정 캘린더 공유 안내</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            시스템 관리자가 공유한 최신 학사 일정(학기 운영 기간, 휴업일, 학교 행사)을 내 캘린더에 동기화할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1 text-xs">
          {/* 학기 기간 안내 요약 */}
          <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-1.5">
            <span className="font-bold text-indigo-950 text-xs block">2026학년도 학기 및 방학 운영 일정</span>
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
                등록된 학사 행사 및 휴업일 ({visibleEvents.length}건)
              </span>
              {isParent && (
                <span className="text-[10px] text-slate-400">
                  (학부모 공개 전용 일정만 표시됩니다)
                </span>
              )}
            </div>

            <div className="max-h-[140px] overflow-y-auto border rounded-xl divide-y divide-slate-100 bg-white">
              {visibleEvents.length > 0 ? (
                visibleEvents.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
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
                <div className="py-4 text-center text-slate-400 text-xs">
                  등록된 학사 행사가 없습니다.
                </div>
              )}
            </div>

            {/* 중복 방지 기술 안내 */}
            <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-medium leading-relaxed">
              <strong>중복 방지 기술 적용됨</strong>: 구글/외부 캘린더는 고유 식별자(UID) 기술을 사용하므로, 학사일정을 여러 번 추가해도 <strong>기존 일정 중복 생성 없이 최신 내용으로 깔끔하게 자동 업데이트(덮어쓰기)</strong>됩니다.
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 pt-3 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleAcknowledge}
            className="h-9 text-xs font-semibold text-slate-600 border-slate-300 rounded-xl px-4"
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            확인 (나중에 공유)
          </Button>

          <Button
            type="button"
            onClick={handleGoogleCalendarSync}
            className="h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs px-4"
          >
            <Globe className="w-3.5 h-3.5 mr-1.5" />
            구글 캘린더로 바로 연동
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
