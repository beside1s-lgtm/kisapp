'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { 
  MonthlyEducationPlan, 
  DepartmentWeeklySchedule, 
  AcademicEvent 
} from '@/lib/types';
import { 
  getMonthlyEducationPlan, 
  saveMonthlyEducationPlan,
  subscribeMonthlyEducationPlan 
} from '@/lib/services/monthlyEducationPlanService';
import { DEFAULT_ACADEMIC_CALENDAR_CONFIG } from '@/lib/services/academicCalendarService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  Save, 
  RefreshCw, 
  Calendar,
  Loader2,
  FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MonthlyEducationPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  academicEvents: AcademicEvent[];
  weeklySchedules: DepartmentWeeklySchedule[];
  orgData?: any;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 특정 연/월의 일수 계산
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 학년도 계산 (3월 ~ 익년 2월)
 */
function getAcademicYear(year: number, month: number): number {
  return month < 3 ? year - 1 : year;
}

export function MonthlyEducationPlanModal({
  open,
  onOpenChange,
  academicEvents,
  weeklySchedules,
  orgData
}: MonthlyEducationPlanModalProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  // 현재 조회 중인 연도 및 월
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth() + 1);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 월간 계획 데이터 상태
  const [planTitle, setPlanTitle] = useState('');
  const [schoolDays, setSchoolDays] = useState<number>(20);
  const [daysData, setDaysData] = useState<{ [day: number]: { content: string; note?: string } }>({});

  // 편집 권한 (교장, 교감, 부장, 관리자)
  const canEdit = useMemo(() => {
    if (!profile) return false;
    if (profile.isAdmin) return true;
    const role = profile.role || '';
    if (role === '교장' || role === '교감' || role.includes('부장')) return true;
    if (orgData?.departments && profile.email) {
      const emailLower = profile.email.toLowerCase();
      const isHead = orgData.departments.some((d: any) => d.headEmail?.toLowerCase() === emailLower);
      if (isHead) return true;
    }
    return false;
  }, [profile, orgData]);

  // 학년도 계산
  const academicYear = useMemo(() => getAcademicYear(currentYear, currentMonth), [currentYear, currentMonth]);

  // 해당 월의 총 일수
  const totalDays = useMemo(() => getDaysInMonth(currentYear, currentMonth), [currentYear, currentMonth]);

  // 해당 월의 날짜 목록 (1 ~ 말일)
  const monthDays = useMemo(() => {
    const list: Array<{ day: number; dateStr: string; dayOfWeek: string; isWeekend: boolean; isSunday: boolean; isSaturday: boolean }> = [];
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(currentYear, currentMonth - 1, d);
      const dayIdx = dateObj.getDay();
      const monthStr = String(currentMonth).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      list.push({
        day: d,
        dateStr: `${currentYear}-${monthStr}-${dayStr}`,
        dayOfWeek: DAY_NAMES[dayIdx],
        isWeekend: dayIdx === 0 || dayIdx === 6,
        isSunday: dayIdx === 0,
        isSaturday: dayIdx === 6
      });
    }
    return list;
  }, [currentYear, currentMonth, totalDays]);

  /**
   * 학사일정 및 월간 부서 일정을 기반으로 월간 교육활동 내용 자동 취합
   */
  const generateDefaultMonthlyData = useCallback(() => {
    const defaultTitle = `${academicYear}학년도 유초등 ${currentMonth}월 월간 교육활동 계획`;

    const generatedDays: { [day: number]: { content: string; note?: string } } = {};
    let calculatedSchoolDays = 0;

    const effectiveEvents = (academicEvents && academicEvents.length > 0)
      ? academicEvents
      : (DEFAULT_ACADEMIC_CALENDAR_CONFIG.events || []);

    monthDays.forEach(item => {
      const itemsForDay: string[] = [];

      // 1. 학사일정 매핑
      const matchingEvents = effectiveEvents.filter(ev => {
        const evEnd = ev.endDate || ev.date;
        return ev.date <= item.dateStr && evEnd >= item.dateStr;
      });
      matchingEvents.forEach(ev => {
        if (!itemsForDay.includes(ev.title)) {
          itemsForDay.push(ev.title);
        }
      });

      // 2. 부서 월간 일정 매핑 (isMonthlySchedule !== false 이거나 sendToAcademicCalendar인 일정)
      const matchingSchedules = weeklySchedules.filter(sch => {
        // 월간 일정으로 체크된 것 또는 학사일정 전송된 것
        const isMonthly = sch.isMonthlySchedule !== false || sch.sendToAcademicCalendar;
        const isWithin = sch.startDate <= item.dateStr && (sch.endDate || sch.startDate) >= item.dateStr;
        return isMonthly && isWithin;
      });

      matchingSchedules.forEach(sch => {
        // 부서명 없이 일정 내용 및 비고/장소 간단히 표기
        let text = sch.title;
        if (sch.content && sch.content.trim()) {
          // 간결하게 한 줄로 정리
          const briefContent = sch.content.split('\n').map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean).join(', ');
          if (briefContent && !text.includes(briefContent)) {
            text += `(${briefContent})`;
          }
        }
        if (!itemsForDay.includes(text)) {
          itemsForDay.push(text);
        }
      });

      // 수업일수 계산 (토/일 제외 및 공휴일/방학 제외 기본 계산)
      if (!item.isWeekend) {
        calculatedSchoolDays++;
      }

      generatedDays[item.day] = {
        content: itemsForDay.join(', '),
        note: ''
      };
    });

    return {
      title: defaultTitle,
      schoolDays: calculatedSchoolDays,
      days: generatedDays
    };
  }, [academicYear, currentMonth, monthDays, academicEvents, weeklySchedules]);

  // Firestore에서 해당 월의 월간교육계획 불러오기
  useEffect(() => {
    if (!open) return;
    setIsLoading(true);

    const unsubscribe = subscribeMonthlyEducationPlan(currentYear, currentMonth, (savedPlan) => {
      if (savedPlan) {
        setPlanTitle(savedPlan.title || `${academicYear}학년도 유초등 ${currentMonth}월 월간 교육활동 계획`);
        setSchoolDays(savedPlan.schoolDays || 20);
        setDaysData(savedPlan.days || {});
      } else {
        // 저장된 계획이 없으면 학사일정 및 월간 부서 일정으로부터 자동 생성
        const defaultData = generateDefaultMonthlyData();
        setPlanTitle(defaultData.title);
        setSchoolDays(defaultData.schoolDays);
        setDaysData(defaultData.days);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [open, currentYear, currentMonth, academicYear, generateDefaultMonthlyData]);

  // 월 이동 함수
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(prev => prev - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(prev => prev + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
  };

  // 일정 자동 취합(새로고침)
  const handleAutoFill = () => {
    const defaultData = generateDefaultMonthlyData();
    setDaysData(prev => {
      const merged = { ...prev };
      Object.entries(defaultData.days).forEach(([dStr, item]) => {
        const d = Number(dStr);
        if (!merged[d] || !merged[d].content) {
          merged[d] = item;
        } else if (item.content) {
          // 기존 내용과 병합 (중복 방지)
          const existingArr = merged[d].content.split(',').map(s => s.trim());
          const newArr = item.content.split(',').map(s => s.trim());
          const combined = Array.from(new Set([...existingArr, ...newArr])).filter(Boolean).join(', ');
          merged[d] = {
            ...merged[d],
            content: combined
          };
        }
      });
      return merged;
    });
    toast({
      title: '월간 일정 자동 취합 완료',
      description: '학사일정 및 승인된 부서 월간 일정이 최신 내용으로 채워졌습니다.'
    });
  };

  // 월간교육계획 저장하기
  const handleSave = async () => {
    if (!canEdit) {
      toast({ variant: 'destructive', title: '권한 없음', description: '저장 권한이 없습니다.' });
      return;
    }

    setIsSaving(true);
    try {
      const planToSave: MonthlyEducationPlan = {
        id: `plan_${currentYear}-${String(currentMonth).padStart(2, '0')}`,
        academicYear,
        year: currentYear,
        month: currentMonth,
        title: planTitle.trim() || `${academicYear}학년도 유초등 ${currentMonth}월 월간 교육활동 계획`,
        schoolDays: Number(schoolDays) || 0,
        days: daysData
      };

      const res = await saveMonthlyEducationPlan(planToSave, {
        email: profile?.email || '',
        name: profile?.name || '교직원'
      });

      if (res.success) {
        toast({
          title: '월간교육계획 저장 완료',
          description: `${planToSave.title}이 성공적으로 저장되었습니다.`
        });
      } else {
        toast({ variant: 'destructive', title: '저장 실패', description: res.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // iframe 기반 독립 1페이지 A4 고품질 인쇄 함수
  const handlePrint = () => {
    const paperElem = document.getElementById('monthly-education-plan-printable-paper');
    const cleanFileName = `월간교육활동계획(${academicYear}년${currentMonth}월)`;

    const originalTitle = document.title;
    document.title = cleanFileName;

    if (!paperElem) {
      window.print();
      setTimeout(() => { document.title = originalTitle; }, 2000);
      return;
    }

    let iframe = document.getElementById('clean-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'clean-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      setTimeout(() => { document.title = originalTitle; }, 2000);
      return;
    }

    const clonedPaper = paperElem.cloneNode(true) as HTMLElement;
    clonedPaper.querySelectorAll('.print-hidden, .print\\:hidden, input, textarea, button').forEach(el => el.remove());
    clonedPaper.querySelectorAll('.hidden.print\\:block, [class*="print:block"]').forEach(el => {
      el.classList.remove('hidden');
      (el as HTMLElement).style.display = 'block';
    });

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="ko">
        <head>
          <meta charset="utf-8" />
          <title>${cleanFileName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 7mm 7mm 7mm 7mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", "Segoe UI", Roboto, sans-serif;
              color: #0f172a;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              width: 100%;
            }
            .print-paper-root {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
              border: 1.5px solid #1e293b;
              padding: 10px 14px;
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            th, td {
              border: 1px solid #64748b;
              vertical-align: top;
              padding: 4px 5px;
            }
            th {
              background-color: #f1f5f9;
              font-weight: 700;
              text-align: center;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <div class="print-paper-root">
            ${clonedPaper.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 200);
  };

  // 날짜별 교육활동 내용 수정 핸들러
  const handleContentChange = (day: number, text: string) => {
    setDaysData(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        content: text
      }
    }));
  };

  // 날짜별 행사/비고 수정 핸들러
  const handleNoteChange = (day: number, text: string) => {
    setDaysData(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        note: text
      }
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] p-0 flex flex-col overflow-hidden rounded-2xl border bg-white text-slate-900 shadow-2xl print:fixed print:inset-0 print:left-0 print:top-0 print:translate-x-0 print:translate-y-0 print:transform-none print:m-0 print:p-0 print:w-full print:max-w-none print:max-h-none print:h-auto print:shadow-none print:border-none print:rounded-none">
        
        {/* 인쇄 전용 글로벌 CSS: 1페이지 백지 방지, 1페이지 완벽 수납, 여백 최적화 */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 6mm 6mm 6mm 6mm;
            }
            html, body {
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            /* 배경의 대시보드 및 모든 외부 요소 숨김 */
            header, nav, aside, main, footer, [data-radix-overlay], .fixed.inset-0.bg-black\\/80 {
              display: none !important;
            }
            /* Dialog Content 및 Portal 위치 인쇄용 리셋 */
            div[data-radix-portal],
            div[data-radix-portal] > div,
            [role="dialog"] {
              position: static !important;
              transform: none !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              max-height: none !important;
              height: auto !important;
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
              overflow: visible !important;
              display: block !important;
              visibility: visible !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
            [role="dialog"] > button[type="button"],
            [role="dialog"] > div.border-b {
              display: none !important;
            }
            .overflow-y-auto {
              overflow: visible !important;
              padding: 0 !important;
              margin: 0 !important;
            }
          }
        `}} />
        
        {/* ── 1. 상단 툴바 (월 탐색 & 액션 버튼) - 인쇄 시 숨김 (우측 패딩으로 닫기X 버튼과 분리) ── */}
        <div className="p-3 sm:p-3.5 pr-12 sm:pr-14 border-b bg-slate-50/90 flex items-center justify-between gap-2 shrink-0 print:hidden overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="p-1.5 bg-indigo-600/10 rounded-lg text-indigo-600 shrink-0">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm sm:text-base font-black text-slate-900 font-headline truncate">
                  월간 교육활동 계획 관리
                </DialogTitle>
                <Badge variant="outline" className="bg-indigo-100/90 text-indigo-900 border-indigo-300 text-xs sm:text-sm font-black px-2.5 py-0.5 shadow-2xs shrink-0 tracking-wide">
                  {currentYear}년 {currentMonth}월
                </Badge>
              </div>
              <DialogDescription className="text-[11px] text-muted-foreground hidden sm:block truncate">
                학사일정과 부서 월간 일정이 자동 취합되며, 부장/관리자가 수정 및 저장할 수 있습니다.
              </DialogDescription>
            </div>
          </div>

          {/* 월 이동 및 기능 버튼들 (한 줄 나란히 고정) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-nowrap">
            <div className="flex items-center bg-white rounded-lg border shadow-2xs p-0.5 shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handlePrevMonth}
                className="h-6 w-6 sm:h-7 sm:w-7 text-slate-600 hover:bg-slate-100 rounded-md"
                title="이전 달"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCurrentMonth}
                className="h-6 sm:h-7 px-1.5 sm:px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                이번 달
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleNextMonth}
                className="h-6 w-6 sm:h-7 sm:w-7 text-slate-600 hover:bg-slate-100 rounded-md"
                title="다음 달"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoFill}
                className="h-7 px-2 sm:px-2.5 text-[11px] font-semibold gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shrink-0 whitespace-nowrap"
                title="학사일정 및 승인된 부서 월간 일정 다시 가져오기"
              >
                <RefreshCw className="w-3 h-3" />
                <span>일정 자동 취합</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-7 px-2 sm:px-2.5 text-[11px] font-semibold gap-1 shrink-0 whitespace-nowrap"
              title="A4 양식으로 인쇄 또는 PDF 저장"
            >
              <Printer className="w-3 h-3 text-slate-600" />
              <span>인쇄 / PDF</span>
            </Button>

            {canEdit && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="h-7 px-2.5 sm:px-3 text-[11px] font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shrink-0 whitespace-nowrap"
              >
                {isSaving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3 text-amber-300" />
                )}
                <span>저장하기</span>
              </Button>
            )}
          </div>
        </div>

        {/* ── 2. 월간교육계획 본체 양식 (A4 양식 완벽 재현) ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 font-sans bg-slate-100/60 print:bg-white print:p-0 print:overflow-visible">
          {isLoading ? (
            <div className="h-96 flex flex-col items-center justify-center space-y-2 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-semibold">월간 교육활동 계획 문서를 불러오는 중입니다...</p>
            </div>
          ) : (
            <div 
              id="monthly-education-plan-printable-paper"
              className="max-w-4xl w-full mx-auto bg-white border border-slate-300 shadow-md p-5 sm:p-7 space-y-3 text-slate-900"
            >
              
              {/* 2-1. 문서 헤더 및 수업일수 */}
              <div className="space-y-1 pb-1">
                <div className="text-center">
                  {canEdit ? (
                    <Input 
                      value={planTitle}
                      onChange={(e) => setPlanTitle(e.target.value)}
                      className="text-center font-black text-base sm:text-lg tracking-tight border-none focus-visible:ring-1 focus-visible:ring-indigo-400 bg-transparent h-auto py-0.5 shadow-none"
                      placeholder="2026학년도 유초등 X월 월간 교육활동 계획"
                    />
                  ) : (
                    <h1 className="font-black text-base sm:text-lg tracking-tight">
                      {planTitle || `${academicYear}학년도 유초등 ${currentMonth}월 월간 교육활동 계획`}
                    </h1>
                  )}
                </div>

                {/* 우측 상단: 수업일수 */}
                <div className="flex justify-end items-center text-xs font-bold text-slate-800 pr-1">
                  <div className="border border-slate-400 bg-slate-50 px-3 py-1 rounded-xs flex items-center gap-1.5 shadow-2xs">
                    <span>수업일수 :</span>
                    {canEdit ? (
                      <div className="flex items-center">
                        <Input 
                          type="number"
                          value={schoolDays}
                          onChange={(e) => setSchoolDays(Number(e.target.value))}
                          className="w-12 h-5 text-xs text-center border-slate-300 p-0 shadow-none font-bold"
                        />
                        <span className="ml-1">일</span>
                      </div>
                    ) : (
                      <span>{schoolDays}일</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2-2. 월간 일정 전체 표 (날짜 / 요일 / 교육활동 내용 / 행사 및 비고) */}
              <div className="border border-slate-400 text-xs">
                {/* 테이블 헤더 */}
                <div className="grid grid-cols-12 bg-slate-200/90 border-b border-slate-400 text-center font-black text-xs">
                  <div className="col-span-1 p-2 border-r border-slate-400">
                    날짜
                  </div>
                  <div className="col-span-1 p-2 border-r border-slate-400">
                    요일
                  </div>
                  <div className="col-span-8 p-2 border-r border-slate-400">
                    교육활동 내용
                  </div>
                  <div className="col-span-2 p-2">
                    행사/비고
                  </div>
                </div>

                {/* 테이블 바디 (1일 ~ 말일) */}
                <div className="divide-y divide-slate-300">
                  {monthDays.map((item) => {
                    const rowData = daysData[item.day] || { content: '', note: '' };
                    const isSat = item.isSaturday;
                    const isSun = item.isSunday;

                    return (
                      <div 
                        key={item.day} 
                        className={`grid grid-cols-12 items-stretch min-h-[30px] ${isSun ? 'bg-rose-50/40' : isSat ? 'bg-blue-50/30' : 'bg-white'}`}
                      >
                        {/* 날짜 */}
                        <div className={`col-span-1 p-1.5 border-r border-slate-300 flex items-center justify-center font-bold text-xs ${isSun ? 'text-rose-600' : isSat ? 'text-blue-600' : 'text-slate-800'}`}>
                          {item.day}
                        </div>

                        {/* 요일 */}
                        <div className={`col-span-1 p-1.5 border-r border-slate-300 flex items-center justify-center font-bold text-xs ${isSun ? 'text-rose-600' : isSat ? 'text-blue-600' : 'text-slate-800'}`}>
                          {item.dayOfWeek}
                        </div>

                        {/* 교육활동 내용 */}
                        <div className="col-span-8 p-1.5 border-r border-slate-300 flex items-center">
                          {canEdit ? (
                            <Input 
                              value={rowData.content || ''}
                              onChange={(e) => handleContentChange(item.day, e.target.value)}
                              placeholder=""
                              className="w-full h-7 text-[11px] leading-tight border-none focus-visible:ring-1 focus-visible:ring-indigo-300 p-1 shadow-none bg-transparent"
                            />
                          ) : (
                            <p className="text-[11px] leading-snug text-slate-800 font-medium px-1">
                              {rowData.content || ''}
                            </p>
                          )}
                        </div>

                        {/* 행사 / 비고 */}
                        <div className="col-span-2 p-1.5 flex items-center">
                          {canEdit ? (
                            <Input 
                              value={rowData.note || ''}
                              onChange={(e) => handleNoteChange(item.day, e.target.value)}
                              placeholder=""
                              className="w-full h-7 text-[11px] leading-tight border-none focus-visible:ring-1 focus-visible:ring-indigo-300 p-1 shadow-none bg-transparent"
                            />
                          ) : (
                            <p className="text-[11px] leading-snug text-slate-600 px-1">
                              {rowData.note || ''}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
