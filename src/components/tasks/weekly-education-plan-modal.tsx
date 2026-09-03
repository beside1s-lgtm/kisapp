'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { 
  WeeklyEducationPlan, 
  DepartmentWeeklySchedule, 
  AcademicEvent 
} from '@/lib/types';
import { 
  getWeeklyEducationPlan, 
  saveWeeklyEducationPlan,
  subscribeWeeklyEducationPlan 
} from '@/lib/services/weeklyEducationPlanService';
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
import { Badge } from '@/components/ui/badge';
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  Save, 
  RefreshCw, 
  Calendar,
  Lock,
  FileText,
  Building2,
  Users,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface WeeklyEducationPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  academicEvents: AcademicEvent[];
  weeklySchedules: DepartmentWeeklySchedule[];
  orgData?: any;
}

/**
 * 내용 길이에 맞게 높이가 자동으로 늘어나는 컴포넌트 (스크롤바 없음, 인쇄 시 전체 출력)
 */
function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className,
  minRows = 3
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const adjustHeight = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, minRows * 18)}px`;
  }, [minRows]);

  React.useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        adjustHeight();
      }}
      placeholder={placeholder}
      className={cn(
        "w-full p-1 text-[9.5px] leading-snug border-none focus-visible:ring-1 focus-visible:ring-blue-300 resize-none shadow-none overflow-hidden bg-transparent",
        className
      )}
      rows={minRows}
    />
  );
}

// 표준 부서 매핑 (2열 배치)
const DEFAULT_DEPARTMENT_PAIRS = [
  ['교무기획부', '교육과정기획부'],
  ['수업연구부', '자치생활부'],
  ['AI융합교육부', '예체능방과후부'],
  ['영어교육부', '다문화교육부'],
  ['학년부(1~6)', '유치원 및 토요한글학교']
];

// 요일 목록 (월~토)
const DAYS_OF_WEEK = [
  { dayIndex: 1, label: '월' },
  { dayIndex: 2, label: '화' },
  { dayIndex: 3, label: '수' },
  { dayIndex: 4, label: '목' },
  { dayIndex: 5, label: '금' },
  { dayIndex: 6, label: '토' }
];

/**
 * 주어진 날짜가 속한 주의 월요일과 토요일 구하기 (월요일 시작 기준)
 */
function getWeekRange(d: Date) {
  const current = new Date(d);
  const day = current.getDay(); // 0(일) ~ 6(토)
  const diffToMonday = day === 0 ? -6 : 1 - day; // 일요일이면 -6, 그 외는 1 - day
  
  const monday = new Date(current);
  monday.setDate(current.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  saturday.setHours(23, 59, 59, 999);

  return { monday, saturday };
}

/**
 * YYYY-MM-DD 포맷 변환
 */
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 해당 월의 몇 번째 주차인지 계산
 */
function getWeekOfMonth(d: Date): { month: number; week: number; academicYear: number } {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const firstDay = new Date(year, d.getMonth(), 1).getDay();
  // 1일의 요일 감안하여 주차 계산
  const week = Math.ceil((date + (firstDay === 0 ? 6 : firstDay - 1)) / 7);
  // 학년도 (3월 이전은 이전 연도)
  const academicYear = month < 3 ? year - 1 : year;
  return { month, week, academicYear };
}

/**
 * 주간교육계획 기본 기준일 계산:
 * 수(3), 목(4), 금(5), 토(6), 일(0)요일에는 다음 주 회의 준비를 위해 '다음 주'를 기본으로 설정 (+7일)
 */
function getDefaultPlanDate(): Date {
  const now = new Date();
  const day = now.getDay(); // 0(일) ~ 6(토)
  if (day === 0 || day >= 3) {
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    return nextWeek;
  }
  return now;
}

export function WeeklyEducationPlanModal({
  open,
  onOpenChange,
  academicEvents,
  weeklySchedules,
  orgData
}: WeeklyEducationPlanModalProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  // 기준 날짜 (수요일부터는 자동으로 다음 주 기본 표시)
  const [currentDate, setCurrentDate] = useState<Date>(() => getDefaultPlanDate());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 모달이 새로 열릴 때 수요일 이후라면 다음 주차로 자동 갱신
  useEffect(() => {
    if (open) {
      setCurrentDate(getDefaultPlanDate());
    }
  }, [open]);

  // 주간 계획 데이터 상태 (행사 텍스트는 줄바꿈을 온전히 보존하는 string으로 관리)
  const [planTitle, setPlanTitle] = useState('');
  const [dailyEventsText, setDailyEventsText] = useState<{ [dateStr: string]: string }>({});
  const [deptContents, setDeptContents] = useState<{ [deptName: string]: string }>({});
  
  // 회의 안건 다중 목록 상태
  const [meetingAgendas, setMeetingAgendas] = useState<Array<{ id: string; title: string; proposer: string; description: string }>>([
    { id: 'agenda-1', title: '', proposer: '', description: '' }
  ]);

  // 교감 / 교장 선생님 의견 상태
  const [vpFeedback, setVpFeedback] = useState('');
  const [principalFeedback, setPrincipalFeedback] = useState('');

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

  // 해당 주의 월요일과 토요일 범위
  const { monday, saturday } = useMemo(() => getWeekRange(currentDate), [currentDate]);
  const mondayStr = useMemo(() => formatDate(monday), [monday]);
  const saturdayStr = useMemo(() => formatDate(saturday), [saturday]);

  // 주차 정보 (예: 2026학년도 8월 3주)
  const weekInfo = useMemo(() => getWeekOfMonth(monday), [monday]);

  // 월~토 각 날짜 배열
  const weekDays = useMemo(() => {
    const days: Array<{ date: Date; dateStr: string; label: string; monthDay: string }> = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const m = d.getMonth() + 1;
      const day = d.getDate();
      const label = DAYS_OF_WEEK[i].label;
      days.push({
        date: d,
        dateStr: formatDate(d),
        label: `${m}/${day}(${label})`,
        monthDay: `${m}/${day}`
      });
    }
    return days;
  }, [monday]);

  // 부서 목록 (기본 목록 + 조직도 추가 부서 병합)
  const departmentPairs = useMemo(() => {
    const standardPairs = [...DEFAULT_DEPARTMENT_PAIRS];
    const registeredDeptNames = orgData?.departments?.map((d: any) => d.name) || [];
    
    // 기본 목록에 없는 부서가 있다면 추가
    const flattened = standardPairs.flat();
    const extraDepts = registeredDeptNames.filter((name: string) => !flattened.includes(name));
    
    if (extraDepts.length > 0) {
      for (let i = 0; i < extraDepts.length; i += 2) {
        standardPairs.push([extraDepts[i], extraDepts[i + 1] || '']);
      }
    }
    return standardPairs;
  }, [orgData]);

  /**
   * 학사일정 및 부서 주간 일정을 기반으로 기본 데이터 자동 생성
   */
  const generateDefaultPlanData = useCallback(() => {
    const defaultTitle = `유초등 주간교육계획 (${weekInfo.academicYear}학년도 ${weekInfo.month}월 ${weekInfo.week}주)`;

    // 1. 날짜별 학사일정 + 부서 주간 행사 자동 매핑
    const effectiveEvents = (academicEvents && academicEvents.length > 0)
      ? academicEvents
      : (DEFAULT_ACADEMIC_CALENDAR_CONFIG.events || []);

    const generatedDailyEventsText: { [dateStr: string]: string } = {};
    weekDays.forEach(day => {
      // 1-1. 학사일정 이벤트
      const academicList = effectiveEvents
        .filter(ev => {
          const evEnd = ev.endDate || ev.date;
          return ev.date <= day.dateStr && evEnd >= day.dateStr;
        })
        .map(ev => ev.title.trim());

      // 1-2. 부서 주간 일정 중 주간 행사에 반영(isWeeklyEvent !== false)으로 설정된 일정
      const deptEventList = weeklySchedules
        .filter(sch => {
          // isWeeklyEvent가 명시적으로 false가 아니거나, isWeeklySchedule이 true인 경우
          const allowsEvent = sch.isWeeklyEvent !== false && sch.isWeeklySchedule !== false;
          const schEnd = sch.endDate || sch.startDate;
          const isDateMatch = sch.startDate <= day.dateStr && schEnd >= day.dateStr;
          return allowsEvent && isDateMatch;
        })
        .map(sch => sch.title.trim());

      // 중복 제거 및 결합
      const combinedEvents = Array.from(new Set([...academicList, ...deptEventList])).filter(Boolean);
      generatedDailyEventsText[day.dateStr] = combinedEvents.join('\n');
    });

    // 2. 부서별 주간 교육 내용 매핑 (해당 주 기간 내에 포함되며 isWeeklyDeptContent !== false인 부서 일정)
    const generatedDeptContents: { [deptName: string]: string } = {};
    departmentPairs.flat().filter(Boolean).forEach(deptName => {
      // 해당 부서의 주간 일정 필터링
      const schedules = weeklySchedules.filter(sch => {
        const allowsDeptContent = sch.isWeeklyDeptContent !== false && sch.isWeeklySchedule !== false;
        if (!allowsDeptContent) return false;

        const matchesDept = sch.deptName === deptName || 
          (deptName.startsWith('학년부') && (sch.deptName?.includes('학년') || sch.deptName?.includes('초등'))) ||
          (deptName.includes('유치원') && sch.deptName?.includes('유치원'));
        
        // 날짜가 이번 주와 겹치는지 확인
        const isOverlap = sch.startDate <= saturdayStr && (sch.endDate || sch.startDate) >= mondayStr;
        return matchesDept && isOverlap;
      });

      if (schedules.length > 0) {
        const lines = schedules.map((sch, idx) => {
          let line = `${idx + 1}. ${sch.title}`;
          if (sch.content) {
            const subLines = sch.content.split('\n').map(l => ` - ${l}`).join('\n');
            line += `\n${subLines}`;
          }
          return line;
        });
        generatedDeptContents[deptName] = lines.join('\n');
      } else {
        generatedDeptContents[deptName] = '';
      }
    });

    return {
      title: defaultTitle,
      dailyEventsText: generatedDailyEventsText,
      deptContents: generatedDeptContents,
      meetingAgendas: [],
      leadershipFeedback: {
        vp: '',
        principal: ''
      }
    };
  }, [academicEvents, weeklySchedules, weekDays, departmentPairs, weekInfo, mondayStr, saturdayStr]);

  // Firestore에서 해당 주차의 주간교육계획 불러오기
  useEffect(() => {
    if (!open) return;
    setIsLoading(true);

    const unsubscribe = subscribeWeeklyEducationPlan(mondayStr, (savedPlan) => {
      const defaultData = generateDefaultPlanData();
      if (savedPlan) {
        setPlanTitle(savedPlan.title || `유초등 주간교육계획 (${weekInfo.academicYear}학년도 ${weekInfo.month}월 ${weekInfo.week}주)`);
        
        // 저장된 계획과 신규 등록된 학사/부서 일정을 스마트하게 병합
        const mergedDailyText: { [dateStr: string]: string } = { ...defaultData.dailyEventsText };
        if (savedPlan.dailyEvents) {
          Object.entries(savedPlan.dailyEvents).forEach(([dStr, list]) => {
            if (list && list.length > 0) {
              const defaultLines = (defaultData.dailyEventsText[dStr] || '').split('\n').filter(Boolean);
              const savedLines = list.map(l => l.trim()).filter(Boolean);
              const allLines = Array.from(new Set([...defaultLines, ...savedLines]));
              mergedDailyText[dStr] = allLines.join('\n');
            }
          });
        }
        setDailyEventsText(mergedDailyText);
        setDeptContents(savedPlan.deptContents || {});

        // 회의 안건 불러오기 (배열 또는 기존 단일 안건 호환, 없을 땐 빈 배열)
        if (savedPlan.meetingAgendas && savedPlan.meetingAgendas.length > 0) {
          setMeetingAgendas(savedPlan.meetingAgendas);
        } else if (savedPlan.meetingAgenda && (savedPlan.meetingAgenda.title?.trim() || savedPlan.meetingAgenda.proposer?.trim() || savedPlan.meetingAgenda.description?.trim())) {
          setMeetingAgendas([{ id: 'agenda-1', ...savedPlan.meetingAgenda }]);
        } else {
          setMeetingAgendas([]);
        }

        // 교감/교장 의견 불러오기
        setVpFeedback(savedPlan.leadershipFeedback?.vp || '');
        setPrincipalFeedback(savedPlan.leadershipFeedback?.principal || '');
      } else {
        // 저장된 계획이 없으면 학사일정 및 부서 일정으로부터 자동 생성
        setPlanTitle(defaultData.title);
        setDailyEventsText(defaultData.dailyEventsText);
        setDeptContents(defaultData.deptContents);
        setMeetingAgendas([]);
        setVpFeedback('');
        setPrincipalFeedback('');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [open, mondayStr, generateDefaultPlanData, weekInfo]);

  // 주차 이동 함수
  const handlePrevWeek = () => {
    const prev = new Date(monday);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(monday);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };

  const handleCurrentWeek = () => {
    setCurrentDate(getDefaultPlanDate());
  };

  // 안건 추가
  const handleAddAgenda = () => {
    setMeetingAgendas(prev => [
      ...prev,
      { id: `agenda-${Date.now()}`, title: '', proposer: '', description: '' }
    ]);
  };

  // 안건 삭제
  const handleDeleteAgenda = (id: string) => {
    if (meetingAgendas.length <= 1) {
      setMeetingAgendas([{ id: 'agenda-1', title: '', proposer: '', description: '' }]);
      return;
    }
    setMeetingAgendas(prev => prev.filter(a => a.id !== id));
  };

  // 안건 수정
  const handleUpdateAgenda = (id: string, field: 'title' | 'proposer' | 'description', value: string) => {
    setMeetingAgendas(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  // 자동 새로고침(부서 일정 및 학사일정 다시 불러오기)
  const handleAutoFill = () => {
    const defaultData = generateDefaultPlanData();
    setDailyEventsText(defaultData.dailyEventsText);
    setDeptContents(prev => {
      const merged = { ...prev };
      Object.entries(defaultData.deptContents).forEach(([dept, content]) => {
        if (content) {
          merged[dept] = merged[dept] ? `${merged[dept]}\n${content}` : content;
        }
      });
      return merged;
    });
    toast({
      title: '일정 자동 불러오기 완료',
      description: '학사일정 및 승인된 부서 주간 일정이 최신 내용으로 채워졌습니다.'
    });
  };

  // 주간교육계획 저장하기
  const handleSave = async () => {
    if (!canEdit) {
      toast({ variant: 'destructive', title: '권한 없음', description: '저장 권한이 없습니다.' });
      return;
    }

    setIsSaving(true);
    try {
      // dailyEventsText를 string[] 배열로 정돈하여 Firestore 저장
      const structuredDailyEvents: { [dateStr: string]: string[] } = {};
      Object.entries(dailyEventsText).forEach(([dStr, text]) => {
        structuredDailyEvents[dStr] = text.split('\n').filter(l => l.trim().length > 0);
      });

      const planToSave: WeeklyEducationPlan = {
        id: `plan_${mondayStr}`,
        academicYear: weekInfo.academicYear,
        month: weekInfo.month,
        weekOfMonth: weekInfo.week,
        startDate: mondayStr,
        endDate: saturdayStr,
        title: planTitle.trim() || `유초등 주간교육계획 (${weekInfo.academicYear}학년도 ${weekInfo.month}월 ${weekInfo.week}주)`,
        dailyEvents: structuredDailyEvents,
        deptContents,
        meetingAgendas,
        meetingAgenda: meetingAgendas[0] || { title: '', proposer: '', description: '' },
        leadershipFeedback: {
          vp: vpFeedback,
          principal: principalFeedback
        }
      };

      const res = await saveWeeklyEducationPlan(planToSave, {
        email: profile?.email || '',
        name: profile?.name || '교직원'
      });

      if (res.success) {
        toast({
          title: '주간교육계획 저장 완료',
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

  // 특정 요일 행사 텍스트 수정 핸들러 (엔터 및 줄바꿈 100% 보존)
  const handleDailyEventChange = (dateStr: string, text: string) => {
    setDailyEventsText(prev => ({
      ...prev,
      [dateStr]: text
    }));
  };

  // 특정 부서 내용 수정 핸들러
  const handleDeptContentChange = (deptName: string, text: string) => {
    setDeptContents(prev => ({
      ...prev,
      [deptName]: text
    }));
  };

  // iframe 기반 독립 1페이지 A4 고품질 인쇄 함수
  const handlePrint = () => {
    const paperElem = document.getElementById('weekly-education-plan-printable-paper');
    const cleanFileName = `주간교육계획(${weekInfo.academicYear}년${weekInfo.month}월${weekInfo.week}주)`;

    // 메인 창 타이틀을 변경하여 브라우저 PDF 기본 파일명 강제 지정
    const originalTitle = document.title;
    document.title = cleanFileName;

    if (!paperElem) {
      window.print();
      setTimeout(() => { document.title = originalTitle; }, 2000);
      return;
    }

    // 1. 숨김 iframe 생성 또는 조회
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

    // 2. 순수 인쇄용 HTML 마크업 복제 (편집 폼 제거, 텍스트 뷰만 렌더)
    const clonedPaper = paperElem.cloneNode(true) as HTMLElement;
    clonedPaper.querySelectorAll('.print-hidden, .print\\:hidden, input, textarea, button').forEach(el => el.remove());
    clonedPaper.querySelectorAll('.hidden.print\\:block, [class*="print:block"]').forEach(el => {
      el.classList.remove('hidden');
      (el as HTMLElement).style.display = 'block';
    });

    // 3. iframe에 A4 규격 완전 독립 인쇄 문서 주입 (단어 줄바꿈 keep-all 및 1페이지 최적화)
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
              word-break: keep-all;
              overflow-wrap: break-word;
            }
            .print-paper-root {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
              border: 1.5px solid #1e293b;
              padding: 12px 14px;
              display: flex;
              flex-direction: column;
              gap: 9px;
            }
            .doc-title {
              text-align: center;
              font-size: 14.5px;
              font-weight: 900;
              padding-bottom: 5px;
              border-bottom: 2px solid #1e293b;
              letter-spacing: -0.3px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            th, td {
              border: 1px solid #64748b;
              vertical-align: top;
              padding: 4.5px 5px;
            }
            th {
              background-color: #f1f5f9;
              font-weight: 700;
              text-align: center;
              font-size: 10.5px;
            }
            .event-th {
              background-color: #e2e8f0;
              font-weight: 900;
              font-size: 11px;
              text-align: center;
              vertical-align: middle;
              color: #1e293b;
            }
            .event-cell {
              text-align: center;
              font-size: 9.5px;
              line-height: 1.35;
              color: #0f172a;
              font-weight: 500;
            }
            .two-col-layout {
              display: grid;
              grid-template-columns: 1fr 1fr;
              border: 1px solid #64748b;
            }
            .two-col-header {
              grid-column: span 2;
              background-color: #e2e8f0;
              border-bottom: 1px solid #64748b;
              padding: 4.5px;
              text-align: center;
              font-weight: 900;
              font-size: 11.5px;
            }
            .dept-card {
              display: flex;
              flex-direction: column;
              border-bottom: 1px solid #64748b;
            }
            .dept-card:nth-last-child(-n+2) {
              border-bottom: none;
            }
            .dept-card.left {
              border-right: 1px solid #64748b;
            }
            .dept-card-title {
              background-color: #f8fafc;
              border-bottom: 1px solid #94a3b8;
              padding: 3.5px 4px;
              text-align: center;
              font-weight: 700;
              font-size: 10.5px;
              color: #1e293b;
            }
            .dept-card-content {
              padding: 6px 7px;
              font-size: 10px;
              line-height: 1.38;
              white-space: pre-wrap;
              min-height: 44px;
            }
            .row-table-box {
              border: 1px solid #64748b;
              display: table;
              width: 100%;
              table-layout: fixed;
            }
            .row-table-label {
              display: table-cell;
              width: 90px;
              background-color: #f8fafc;
              border-right: 1px solid #64748b;
              padding: 6px 4px;
              text-align: center;
              vertical-align: middle;
              font-weight: 900;
              font-size: 10.5px;
              color: #1e293b;
              white-space: nowrap;
            }
            .row-table-content {
              display: table-cell;
              padding: 6px 8px;
              font-size: 10px;
              line-height: 1.35;
              background-color: #ffffff;
              vertical-align: middle;
            }
            .bold { font-weight: 700; }
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

    // 4. iframe 출력 실행
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => { document.title = originalTitle; }, 3000);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] p-0 flex flex-col overflow-hidden rounded-2xl border bg-white text-slate-900 shadow-2xl">
        
        {/* ── 1. 헤더 툴바 (주차 탐색 & 액션 버튼) - 우측 패딩으로 닫기X 버튼과 완벽 분리 ── */}
        <div className="p-3 sm:p-3.5 pr-12 sm:pr-14 border-b bg-slate-50/90 flex items-center justify-between gap-2 shrink-0 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="p-1.5 bg-blue-600/10 rounded-lg text-blue-600 shrink-0">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm sm:text-base font-black text-slate-900 font-headline truncate">
                  주간교육계획 관리
                </DialogTitle>
                <Badge variant="outline" className="bg-blue-100/90 text-blue-900 border-blue-300 text-xs sm:text-sm font-black px-2.5 py-0.5 shadow-2xs shrink-0 tracking-wide">
                  {mondayStr} ~ {saturdayStr}
                </Badge>
              </div>
              <DialogDescription className="text-[11px] text-muted-foreground hidden sm:block truncate">
                부서 주간 일정과 학사일정이 자동 반영되며, 부장/관리자가 수정 및 저장할 수 있습니다.
              </DialogDescription>
            </div>
          </div>

          {/* 주차 이동 및 기능 버튼들 (한 줄 나란히 고정) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-nowrap">
            <div className="flex items-center bg-white rounded-lg border shadow-2xs p-0.5 shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handlePrevWeek}
                className="h-6 w-6 sm:h-7 sm:w-7 text-slate-600 hover:bg-slate-100 rounded-md"
                title="이전 주"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCurrentWeek}
                className="h-6 sm:h-7 px-1.5 sm:px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                이번 주
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleNextWeek}
                className="h-6 w-6 sm:h-7 sm:w-7 text-slate-600 hover:bg-slate-100 rounded-md"
                title="다음 주"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoFill}
                className="h-7 px-2 sm:px-2.5 text-[11px] font-semibold gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 shrink-0 whitespace-nowrap"
                title="학사일정 및 승인된 부서 일정 다시 가져오기"
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
                className="h-7 px-2.5 sm:px-3 text-[11px] font-bold gap-1 bg-blue-600 hover:bg-blue-700 text-white shadow-xs shrink-0 whitespace-nowrap"
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

        {/* ── 2. 주간교육계획 본체 양식 (화면 뷰 & 고화질 복제 인쇄 소스) ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 font-sans bg-slate-100/60">
          {isLoading ? (
            <div className="h-96 flex flex-col items-center justify-center space-y-2 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-semibold">주간교육계획 문서를 불러오는 중입니다...</p>
            </div>
          ) : (
            <div 
              id="weekly-education-plan-printable-paper"
              className="max-w-4xl w-full mx-auto bg-white border border-slate-300 shadow-md p-5 sm:p-7 space-y-3.5 text-slate-900"
            >
              
              {/* 2-1. 문서 제목 */}
              <div className="doc-title text-center pb-1.5 border-b-2 border-slate-800">
                {canEdit ? (
                  <>
                    {/* 화면 편집용 */}
                    <div className="print:hidden">
                      <Input 
                        value={planTitle}
                        onChange={(e) => setPlanTitle(e.target.value)}
                        className="text-center font-black text-base sm:text-lg tracking-tight border-none focus-visible:ring-1 focus-visible:ring-blue-400 bg-transparent h-auto py-0.5 shadow-none"
                        placeholder="유초등 주간교육계획 (2026학년도 X월 X주)"
                      />
                    </div>
                    {/* 인쇄 출력용 */}
                    <h1 className="hidden print:block font-black text-[14.5px] tracking-tight py-0.5">
                      {planTitle.trim() || `유초등 주간교육계획 (${weekInfo.academicYear}학년도 ${weekInfo.month}월 ${weekInfo.week}주)`}
                    </h1>
                  </>
                ) : (
                  <h1 className="font-black text-base sm:text-lg tracking-tight">
                    {planTitle || `유초등 주간교육계획 (${weekInfo.academicYear}학년도 ${weekInfo.month}월 ${weekInfo.week}주)`}
                  </h1>
                )}
              </div>

              {/* 2-2. 상단: 주간 행사 (구분 셀과 병합되어 '주간 행사'만 단독 표시 & 가운데 정렬) */}
              <div className="border border-slate-400 overflow-hidden text-[10.5px]">
                <table className="w-full table-fixed border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-400 text-center font-bold">
                      <th 
                        rowSpan={2} 
                        className="event-th w-[11%] p-2 border-r border-slate-400 bg-slate-200/90 font-black text-slate-900 text-xs align-middle"
                      >
                        주간 행사
                      </th>
                      {weekDays.map((day, idx) => (
                        <th 
                          key={day.dateStr} 
                          className={`w-[14.8%] p-1.5 ${idx < 5 ? 'border-r border-slate-400' : ''} ${day.label.includes('토') ? 'text-blue-700 bg-blue-50/40' : 'text-slate-800'} text-[10.5px] font-bold`}
                        >
                          {day.label}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-t border-slate-400">
                      {weekDays.map((day, idx) => {
                        const rawEventText = dailyEventsText[day.dateStr] || '';
                        const lines = rawEventText.split('\n').map(l => l.trim()).filter(Boolean);

                        return (
                          <td 
                            key={day.dateStr} 
                            className={`p-1.5 ${idx < 5 ? 'border-r border-slate-400' : ''} align-top bg-white text-center`}
                          >
                            {/* 화면 편집용 (엔터 및 줄바꿈 지원) */}
                            {canEdit && (
                              <div className="print:hidden">
                                <AutoResizeTextarea 
                                  value={rawEventText}
                                  onChange={(val) => handleDailyEventChange(day.dateStr, val)}
                                  placeholder="행사 입력&#13;&#10;(엔터로 줄바꿈)"
                                  minRows={3}
                                  className="min-h-[48px] leading-tight text-center text-[11px] sm:text-xs"
                                />
                              </div>
                            )}

                            {/* 인쇄 및 읽기 전용 뷰: 가운데 정렬 및 단어 줄바꿈 */}
                            <div className={cn("event-cell space-y-0.5 text-[9.5px] leading-tight p-0.5 min-h-[38px] text-center", canEdit ? "hidden print:block" : "block")}>
                              {lines.length > 0 ? (
                                lines.map((ev, i) => (
                                  <p key={i} className="text-slate-900 font-medium whitespace-normal break-keep">
                                    • {ev}
                                  </p>
                                ))
                              ) : null}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </thead>
                </table>
              </div>

              {/* 2-3. 중간: 주간 교육 내용 (화면 및 인쇄 모두 2열 좌우 배치 100% 보장) */}
              <div className="two-col-layout border border-slate-400 text-[10.5px] w-full grid grid-cols-2">
                <div className="two-col-header col-span-2 bg-slate-200/90 border-b border-slate-400 p-1.5 text-center font-black text-xs">
                  주간 교육 내용
                </div>

                {departmentPairs.map(([deptLeft, deptRight], pairIdx) => (
                  <React.Fragment key={pairIdx}>
                    
                    {/* 좌측 부서 */}
                    <div className="dept-card left flex flex-col border-r border-b border-slate-400 bg-white">
                      <div className="dept-card-title bg-slate-100/90 border-b border-slate-400 p-1.5 text-center font-bold text-[11px] text-slate-800">
                        {deptLeft}
                      </div>
                      <div className="dept-card-content p-2 flex-1 bg-white">
                        {/* 화면 편집용 (글씨 크기 시원하게 확대) */}
                        {canEdit && (
                          <div className="print:hidden">
                            <AutoResizeTextarea 
                              value={deptContents[deptLeft] || ''}
                              onChange={(val) => handleDeptContentChange(deptLeft, val)}
                              placeholder={`${deptLeft} 주간 업무 및 교육 내용 입력...`}
                              minRows={3}
                              className="min-h-[50px] leading-relaxed text-xs sm:text-[13px]"
                            />
                          </div>
                        )}
                        {/* 인쇄 및 읽기 전용 뷰 */}
                        <div className={cn("text-[10px] leading-snug whitespace-pre-wrap font-normal text-slate-900 p-0.5 min-h-[40px]", canEdit ? "hidden print:block" : "block")}>
                          {deptContents[deptLeft] ? deptContents[deptLeft] : null}
                        </div>
                      </div>
                    </div>

                    {/* 우측 부서 */}
                    <div className="dept-card flex flex-col border-b border-slate-400 bg-white">
                      <div className="dept-card-title bg-slate-100/90 border-b border-slate-400 p-1.5 text-center font-bold text-[11px] text-slate-800">
                        {deptRight || '-'}
                      </div>
                      <div className="dept-card-content p-2 flex-1 bg-white">
                        {deptRight ? (
                          <>
                            {/* 화면 편집용 */}
                            {canEdit && (
                              <div className="print:hidden">
                                <AutoResizeTextarea 
                                  value={deptContents[deptRight] || ''}
                                  onChange={(val) => handleDeptContentChange(deptRight, val)}
                                  placeholder={`${deptRight} 주간 업무 및 교육 내용 입력...`}
                                  minRows={3}
                                  className="min-h-[50px] leading-relaxed text-xs sm:text-[13px]"
                                />
                              </div>
                            )}
                            {/* 인쇄 및 읽기 전용 뷰 */}
                            <div className={cn("text-[10px] leading-snug whitespace-pre-wrap font-normal text-slate-900 p-0.5 min-h-[40px]", canEdit ? "hidden print:block" : "block")}>
                              {deptContents[deptRight] ? deptContents[deptRight] : null}
                            </div>
                          </>
                        ) : (
                          <div className="text-transparent text-center py-2 text-[10px]"></div>
                        )}
                      </div>
                    </div>

                  </React.Fragment>
                ))}
              </div>

              {/* 2-4. 하단: 회의 안건 (좌측 1줄 제목 '회의 안건 [+추가]' + 우측 내용 2단 배치) */}
              <div className="row-table-box border border-slate-400 text-[10.5px] w-full">
                <div className="row-table-label bg-slate-100/90 border-r border-slate-400 p-2.5 text-center font-black text-[11px] text-slate-800 align-middle">
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <span>회의 안건</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={handleAddAgenda}
                        className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[9.5px] font-bold flex items-center gap-0.5 print:hidden transition whitespace-nowrap"
                        title="안건 추가"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>추가</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="row-table-content p-2.5 bg-white space-y-2">
                  {/* 1) 화면 편집용 폼 */}
                  {canEdit && (
                    <div className="space-y-2 print:hidden">
                      {meetingAgendas.length === 0 ? (
                        <div className="flex items-center justify-between py-1 text-slate-400 text-xs">
                          <span>등록된 회의 안건이 없습니다.</span>
                          <button
                            type="button"
                            onClick={handleAddAgenda}
                            className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-bold flex items-center gap-1 transition"
                          >
                            <Plus className="w-3 h-3" />
                            <span>안건 추가하기</span>
                          </button>
                        </div>
                      ) : (
                        meetingAgendas.map((agenda, index) => (
                          <div key={agenda.id} className={cn("space-y-1.5", index > 0 && "pt-2 border-t border-slate-200")}>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-700 shrink-0 text-xs">
                                ￭ 안건 {meetingAgendas.length > 1 ? index + 1 : ''} :
                              </span>
                              <Input 
                                value={agenda.title}
                                onChange={(e) => handleUpdateAgenda(agenda.id, 'title', e.target.value)}
                                placeholder="회의 안건 제목 입력"
                                className="h-7 text-xs border-slate-200 px-2 shadow-none flex-1"
                              />
                              <span className="font-bold text-slate-700 shrink-0 ml-1.5 text-xs">- 제안자 :</span>
                              <Input 
                                value={agenda.proposer}
                                onChange={(e) => handleUpdateAgenda(agenda.id, 'proposer', e.target.value)}
                                placeholder="제안자 (부서/직책)"
                                className="h-7 text-xs border-slate-200 px-2 shadow-none w-28 sm:w-36"
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteAgenda(agenda.id)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                                title="안건 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <span className="font-bold text-slate-700 shrink-0 mt-1 text-xs">- 안건 제안 설명 :</span>
                              <AutoResizeTextarea 
                                value={agenda.description}
                                onChange={(val) => handleUpdateAgenda(agenda.id, 'description', val)}
                                placeholder="안건 세부 배경 및 제안 설명 입력"
                                minRows={2}
                                className="min-h-[32px] border border-slate-200 p-1.5 leading-relaxed rounded-xs text-xs"
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* 2) 인쇄 출력 및 읽기 전용 뷰 */}
                  <div className={cn("space-y-1.5", canEdit ? "hidden print:block" : "block")}>
                    {meetingAgendas.filter(a => a.title.trim() || a.proposer.trim() || a.description.trim()).length > 0 ? (
                      meetingAgendas
                        .filter(a => a.title.trim() || a.proposer.trim() || a.description.trim())
                        .map((agenda, index, arr) => (
                          <div key={agenda.id} className={cn("space-y-0.5 text-[10px] leading-tight text-slate-900", index > 0 && "pt-1 border-t border-slate-200")}>
                            <div className="flex items-center justify-between">
                              <p><span className="bold">￭ 안건 {arr.length > 1 ? index + 1 : ''} :</span> {agenda.title || ''}</p>
                              {agenda.proposer && <p className="text-slate-700 font-medium"><span className="bold">- 제안자 :</span> {agenda.proposer}</p>}
                            </div>
                            {agenda.description && (
                              <p className="whitespace-pre-wrap pl-2 text-slate-800"><span className="bold">- 안건 제안 설명 :</span> {agenda.description}</p>
                            )}
                          </div>
                        ))
                    ) : (
                      <div className="min-h-[20px]"></div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2-5. 최하단: 교감 / 교장 선생님 의견 (좌측 1줄 제목 '교감·교장 의견' + 우측 내용 2단 배치) */}
              <div className="row-table-box border border-slate-400 text-[10.5px] w-full">
                <div className="row-table-label bg-slate-100/90 border-r border-slate-400 p-2.5 text-center font-black text-[11px] text-slate-800 align-middle">
                  <span>교감·교장 의견</span>
                </div>
                <div className="row-table-content p-2.5 bg-white space-y-2">
                  {/* 교감 의견 */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="bold text-slate-900 text-xs">￭ 교감 의견 :</span>
                    </div>
                    {/* 화면 편집용 */}
                    {canEdit && (
                      <div className="print:hidden">
                        <AutoResizeTextarea 
                          value={vpFeedback}
                          onChange={setVpFeedback}
                          placeholder="교감선생님 검토 및 당부 의견 입력..."
                          minRows={2}
                          className="min-h-[32px] border border-slate-200 p-1.5 leading-relaxed rounded-xs text-xs"
                        />
                      </div>
                    )}
                    {/* 인쇄 및 읽기 전용 뷰 */}
                    <div className={cn("text-[10px] leading-snug whitespace-pre-wrap text-slate-900 pl-2 min-h-[14px]", canEdit ? "hidden print:block" : "block")}>
                      {vpFeedback ? vpFeedback : null}
                    </div>
                  </div>

                  {/* 교장 의견 */}
                  <div className="space-y-1 pt-1.5 border-t border-slate-200">
                    <div className="flex items-center gap-1">
                      <span className="bold text-slate-900 text-xs">￭ 교장 의견 :</span>
                    </div>
                    {/* 화면 편집용 */}
                    {canEdit && (
                      <div className="print:hidden">
                        <AutoResizeTextarea 
                          value={principalFeedback}
                          onChange={setPrincipalFeedback}
                          placeholder="교장선생님 총평 및 학교 운영 지침 입력..."
                          minRows={2}
                          className="min-h-[32px] border border-slate-200 p-1.5 leading-relaxed rounded-xs text-xs"
                        />
                      </div>
                    )}
                    {/* 인쇄 및 읽기 전용 뷰 */}
                    <div className={cn("text-[10px] leading-snug whitespace-pre-wrap text-slate-900 pl-2 min-h-[14px]", canEdit ? "hidden print:block" : "block")}>
                      {principalFeedback ? principalFeedback : null}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
