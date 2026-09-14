'use client';

import React, { useState, useMemo } from 'react';
import type { DepartmentWeeklySchedule, AcademicEvent } from '@/lib/types';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, CalendarCheck, Download, ExternalLink } from 'lucide-react';
import { 
  generateWeeklyMonthlyIcs, 
  downloadIcsFile, 
  buildWeeklyScheduleGoogleCalendarUrl, 
  buildAcademicEventGoogleCalendarUrl 
} from '@/lib/services/calendarExportService';
import { useToast } from '@/hooks/use-toast';

interface ScheduleCalendarSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weeklySchedules: DepartmentWeeklySchedule[];
  academicEvents: AcademicEvent[];
}

export function ScheduleCalendarSyncModal({
  open,
  onOpenChange,
  weeklySchedules,
  academicEvents
}: ScheduleCalendarSyncModalProps) {
  const { toast } = useToast();

  const [includeWeekly, setIncludeWeekly] = useState(true);
  const [includeMonthly, setIncludeMonthly] = useState(true);
  const [includeAlarm, setIncludeAlarm] = useState(true);
  const [dateRange, setDateRange] = useState<'all' | 'current_month' | 'next_month' | 'next_3months'>('all');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 기간 필터링
  const filteredWeeklySchedules = useMemo(() => {
    if (!includeWeekly) return [];
    if (dateRange === 'all') return weeklySchedules;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return weeklySchedules.filter((item) => {
      if (!item.startDate) return false;
      const d = new Date(item.startDate);
      if (isNaN(d.getTime())) return false;

      if (dateRange === 'current_month') {
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }
      if (dateRange === 'next_month') {
        const nextM = new Date(currentYear, currentMonth + 1, 1);
        return d.getFullYear() === nextM.getFullYear() && d.getMonth() === nextM.getMonth();
      }
      if (dateRange === 'next_3months') {
        const maxDate = new Date(currentYear, currentMonth + 3, 31);
        return d >= now && d <= maxDate;
      }
      return true;
    });
  }, [weeklySchedules, includeWeekly, dateRange]);

  const filteredAcademicEvents = useMemo(() => {
    if (!includeMonthly) return [];
    if (dateRange === 'all') return academicEvents;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return academicEvents.filter((ev) => {
      if (!ev.date) return false;
      const d = new Date(ev.date);
      if (isNaN(d.getTime())) return false;

      if (dateRange === 'current_month') {
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }
      if (dateRange === 'next_month') {
        const nextM = new Date(currentYear, currentMonth + 1, 1);
        return d.getFullYear() === nextM.getFullYear() && d.getMonth() === nextM.getMonth();
      }
      if (dateRange === 'next_3months') {
        const maxDate = new Date(currentYear, currentMonth + 3, 31);
        return d >= now && d <= maxDate;
      }
      return true;
    });
  }, [academicEvents, includeMonthly, dateRange]);

  const totalEventCount = filteredWeeklySchedules.length + filteredAcademicEvents.length;

  const handleExport = () => {
    if (totalEventCount === 0) {
      toast({
        title: "동기화할 일정이 없습니다",
        description: "선택한 조건에 해당하는 주간 또는 월간 일정이 없습니다."
      });
      return;
    }

    try {
      const ics = generateWeeklyMonthlyIcs({
        weeklySchedules: filteredWeeklySchedules,
        academicEvents: filteredAcademicEvents,
        includeWeekly,
        includeMonthly,
        includeAlarm
      });

      downloadIcsFile(ics, `kis_school_schedules_${todayStr.replace(/-/g, '')}.ics`);

      toast({
        title: "캘린더 파일 다운로드 완료",
        description: `주간 ${filteredWeeklySchedules.length}건, 월간 ${filteredAcademicEvents.length}건(총 ${totalEventCount}건)이 포함된 캘린더 파일이 다운로드되었습니다. 파일을 열어 캘린더에 추가하세요.`
      });

      onOpenChange(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "동기화 오류",
        description: e?.message || "캘린더 파일을 생성하는 중 오류가 발생했습니다."
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-blue-600 shrink-0" />
            <DialogTitle className="text-base font-bold text-slate-900">
              주간 및 월간 일정 캘린더 동기화
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            선택한 학교 일정을 내 캘린더(스마트폰, 구글 캘린더, 아웃룩 등)에 추가합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* 동기화 항목 선택 */}
          <div className="space-y-2.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block">1. 동기화 항목 선택</span>
            
            <div className="space-y-2">
              <label className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={includeWeekly} 
                    onCheckedChange={(checked) => setIncludeWeekly(!!checked)} 
                    id="chk-weekly"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900">주간 부서·학년 업무 일정</span>
                    <span className="text-[11px] text-slate-500">부서별 주간 교육계획 및 부서 공지 일정</span>
                  </div>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[10px] font-bold shrink-0">
                  {filteredWeeklySchedules.length}건
                </Badge>
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={includeMonthly} 
                    onCheckedChange={(checked) => setIncludeMonthly(!!checked)} 
                    id="chk-monthly"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900">월간 학사 및 교육활동 일정</span>
                    <span className="text-[11px] text-slate-500">공식 학사일정, 행사 및 휴업일</span>
                  </div>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[10px] font-bold shrink-0">
                  {filteredAcademicEvents.length}건
                </Badge>
              </label>
            </div>
          </div>

          {/* 기간 필터 및 알림 옵션 */}
          <div className="space-y-2.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block">2. 기간 및 알림 설정</span>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="range-select" className="text-xs text-slate-700">포함 기간</Label>
                <Select value={dateRange} onValueChange={(val: any) => setDateRange(val)}>
                  <SelectTrigger id="range-select" className="h-8 w-36 text-xs bg-white">
                    <SelectValue placeholder="기간 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 일정</SelectItem>
                    <SelectItem value="current_month">이번 달 일정</SelectItem>
                    <SelectItem value="next_month">다음 달 일정</SelectItem>
                    <SelectItem value="next_3months">향후 3개월 일정</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <Checkbox 
                  checked={includeAlarm} 
                  onCheckedChange={(checked) => setIncludeAlarm(!!checked)} 
                  id="chk-alarm"
                />
                <span className="text-xs text-slate-700">일정 당일 오전 08시 30분에 캘린더 알림 수신</span>
              </label>
            </div>
          </div>

          {/* 안내 배너 */}
          <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 text-[11px] text-blue-900 leading-relaxed space-y-1">
            <div className="font-bold flex items-center gap-1 text-blue-950">
              <ExternalLink className="w-3 h-3 text-blue-600" />
              <span>구글 캘린더 바로 등록 지원</span>
            </div>
            <p>
              하단의 <strong>[구글 캘린더 바로 열기]</strong>를 누르면 다운로드 없이 캘린더 창이 바로 열립니다. 전체 일정 일괄 등록을 원하실 경우 <strong>[.ics 다운로드]</strong>를 이용하세요.
            </p>
          </div>

          {/* 일정 목록 간략 미리보기 & 개별 등록 */}
          {totalEventCount > 0 && (
            <div className="space-y-1.5">
              <span className="font-bold text-slate-700 text-[11px] block">
                포함된 일정 미리보기 ({totalEventCount}건)
              </span>
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                {filteredWeeklySchedules.slice(0, 10).map((ws) => {
                  const url = buildWeeklyScheduleGoogleCalendarUrl(ws);
                  return (
                    <div key={ws.id} className="p-1.5 px-2.5 flex items-center justify-between gap-2 text-xs hover:bg-slate-50">
                      <div className="min-w-0 flex-1 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-slate-500 shrink-0">{ws.startDate}</span>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[9px] px-1 py-0 font-bold shrink-0">
                          {ws.deptName || '주간'}
                        </Badge>
                        <span className="truncate font-semibold text-slate-800 text-[11px]">{ws.title}</span>
                      </div>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded shrink-0 transition-colors"
                        title="구글 캘린더에 바로 등록"
                      >
                        +등록
                      </a>
                    </div>
                  );
                })}
                {filteredAcademicEvents.slice(0, 10).map((ev) => {
                  const url = buildAcademicEventGoogleCalendarUrl(ev);
                  return (
                    <div key={ev.id} className="p-1.5 px-2.5 flex items-center justify-between gap-2 text-xs hover:bg-slate-50">
                      <div className="min-w-0 flex-1 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-slate-500 shrink-0">{ev.date}</span>
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 text-[9px] px-1 py-0 font-bold shrink-0">
                          학사
                        </Badge>
                        <span className="truncate font-semibold text-slate-800 text-[11px]">{ev.title}</span>
                      </div>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded shrink-0 transition-colors"
                        title="구글 캘린더에 바로 등록"
                      >
                        +등록
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-1.5 flex-col sm:flex-row justify-between">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
            disabled={totalEventCount === 0 || (!includeWeekly && !includeMonthly)}
            className="h-8 text-xs font-semibold text-slate-600 border-slate-300"
            title="파일 다운로드 후 일괄 등록"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            .ics 다운로드
          </Button>

          <div className="flex items-center gap-1.5 justify-end">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs font-semibold"
            >
              닫기
            </Button>
            {/* 첫 번째 일정 구글 캘린더 바로 열기 버튼 */}
            {totalEventCount > 0 && (() => {
              const firstSchedule = filteredWeeklySchedules[0];
              const firstEvent = filteredAcademicEvents[0];
              const targetUrl = firstSchedule 
                ? buildWeeklyScheduleGoogleCalendarUrl(firstSchedule)
                : (firstEvent ? buildAcademicEventGoogleCalendarUrl(firstEvent) : '');

              return (
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 inline-flex items-center gap-1 shadow-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>구글 캘린더 바로 열기</span>
                </a>
              );
            })()}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
