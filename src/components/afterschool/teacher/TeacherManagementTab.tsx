'use client';

import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  Users,
  Calendar,
  Clock,
  DollarSign,
  Download,
  Plus,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Search,
  ArrowUpDown,
  FileText,
  UserCheck,
  Building2,
  BookOpen,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Course, AttendanceRecord, SubstituteRecord } from '@/lib/afterschool/types';
import type { ScheduleDay } from '@/lib/afterschool/schedule';
import {
  computeSettlement,
  termFromSettingsAndDocConfig,
  termLabel,
  termPeriodLabel,
  courseScheduleForTerm,
  courseInstructors,
  type SettlementTerm,
  type SettlementResult,
  type SubstituteEvent,
} from '@/lib/afterschool/settlement';
import { generateAfterschoolSettlementWorkbook } from '@/lib/afterschool/excel';
import { isActualSignature } from '@/lib/safety/stampHelper';
import { findTeacherSignature, type TeacherSignatureBook } from '@/lib/teachers/teacherRegistry';

export interface TeacherManagementTabProps {
  courses: Course[];
  attendanceRecords: AttendanceRecord[];
  substituteRecords: SubstituteRecord[];
  approvalDocs: any[];
  enrollments?: any[];
  teacherApplySettings: any;
  docConfig?: any;
  holidayDates?: string[];
  sigBook?: TeacherSignatureBook | null;
  onOpenSubstituteModal?: (day: ScheduleDay, course: Course, targetInst?: string) => void;
  onRequestSignature?: (teacherName: string, courseId?: string) => void;
}

type ViewMode = 'teachers' | 'substitutes';
type SortField = 'amount' | 'sessions' | 'name';

interface InstructorCourseDetail {
  courseId: string;
  title: string;
  role: '주강사' | '공동강사' | '보조강사';
  classDays?: string[];
  classTime?: string;
  classroom?: string;
  plannedSessions: number;
  conductedSessions: number;
  regular: number;
  covered: number;
  absent: number;
  amount: number;
}

interface EnhancedInstructor {
  name: string;
  courses: InstructorCourseDetail[];
  totalPlannedSessions: number; // 예상 수업시수 (계획)
  regularSessions: number;      // 실제 정상 진행 시수
  coveredSessions: number;      // 보결(대강) 수업 시수
  absentSessions: number;       // 결강 시수
  paidSessions: number;         // 총 지급 인정 시수 (정상 + 보결)
  amount: number;               // 총 강사수당
  hasSignature: boolean;
  signatureUrl?: string;
  absentEvents: SubstituteEvent[];  // 해당 강사가 결강한 기록
  coveredEvents: SubstituteEvent[]; // 해당 강사가 타 강좌 대강한 기록
}

export function TeacherManagementTab({
  courses,
  attendanceRecords,
  substituteRecords,
  approvalDocs,
  enrollments = [],
  teacherApplySettings,
  docConfig,
  holidayDates = [],
  sigBook,
  onOpenSubstituteModal,
  onRequestSignature,
}: TeacherManagementTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('teachers');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('amount');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());

  // 학기 정산 기준 term 생성
  const term: SettlementTerm = useMemo(() => {
    return termFromSettingsAndDocConfig(teacherApplySettings, docConfig, holidayDates);
  }, [teacherApplySettings, docConfig, holidayDates]);

  // 방과후 표준 정산 엔진 실행
  const settlement: SettlementResult = useMemo(() => {
    return computeSettlement(courses, attendanceRecords, substituteRecords, approvalDocs, term);
  }, [courses, attendanceRecords, substituteRecords, approvalDocs, term]);

  // 각 강좌별 계획/진행 차시 맵 사전 계산
  const coursePlanMap = useMemo(() => {
    const map = new Map<string, { plannedSessions: number; conductedSessions: number; days: ScheduleDay[] }>();
    courses.forEach((c) => {
      const days = courseScheduleForTerm(c, term);
      const planned = days.reduce((sum, d) => sum + d.sessionNos.length, 0);
      const cSettlement = settlement.courses.find((sc) => sc.course.id === c.id);
      map.set(c.id, {
        plannedSessions: planned,
        conductedSessions: cSettlement?.conductedSessions || 0,
        days,
      });
    });
    return map;
  }, [courses, term, settlement.courses]);

  // 강사별 종합 정보 빌드 (명단, 강좌, 예상/실제 시수, 보결 기록, 총 강사수당)
  const enhancedInstructors: EnhancedInstructor[] = useMemo(() => {
    // 1. 등록된 모든 강사명 수집 (강좌 주/부/보조 강사 + 보결 기록상의 강사)
    const allTeacherNames = new Set<string>();
    courses.forEach((c) => {
      courseInstructors(c).forEach((name) => allTeacherNames.add(name));
    });
    substituteRecords.forEach((s) => {
      if (s.targetInstructor) allTeacherNames.add(s.targetInstructor.trim());
      if (s.substituteInstructor) allTeacherNames.add(s.substituteInstructor.trim());
    });

    const list: EnhancedInstructor[] = [];

    allTeacherNames.forEach((name) => {
      if (!name) return;
      const cleanName = name.trim();
      const instSettlement = settlement.instructors.find((i) => i.name === cleanName);

      // 이 강사가 참여하는 강좌 목록 및 강좌별 시수/수당
      const instructorCourses: InstructorCourseDetail[] = [];
      let totalPlannedSessions = 0;

      courses.forEach((c) => {
        const instructors = courseInstructors(c);
        if (!instructors.includes(cleanName)) return;

        const role: '주강사' | '공동강사' | '보조강사' =
          c.instructorName?.trim() === cleanName
            ? '주강사'
            : (c.assistantTeachers || []).includes(cleanName)
            ? '보조강사'
            : '공동강사';

        const planInfo = coursePlanMap.get(c.id) || { plannedSessions: 0, conductedSessions: 0, days: [] };
        totalPlannedSessions += planInfo.plannedSessions;

        const cSettlement = settlement.courses.find((sc) => sc.course.id === c.id);
        const perInst = cSettlement?.perInstructor.get(cleanName) || { regular: 0, covered: 0, absent: 0 };
        const coursePaid = perInst.regular + perInst.covered;

        instructorCourses.push({
          courseId: c.id,
          title: c.title,
          role,
          classDays: c.classDays,
          classTime: c.classTime,
          classroom: c.classroom,
          plannedSessions: planInfo.plannedSessions,
          conductedSessions: planInfo.conductedSessions,
          regular: perInst.regular,
          covered: perInst.covered,
          absent: perInst.absent,
          amount: coursePaid * term.fee,
        });
      });

      // 보결 기록 중 이 강사가 결강한 건 / 대강한 건
      const absentEvents = settlement.substituteEvents.filter(
        (e) => e.absentInstructor?.trim() === cleanName
      );
      const coveredEvents = settlement.substituteEvents.filter(
        (e) => e.substituteInstructor?.trim() === cleanName
      );

      const regularSessions = instSettlement?.regularSessions || 0;
      const coveredSessions = instSettlement?.coveredSessions || 0;
      const absentSessions = instSettlement?.absentSessions || 0;
      const paidSessions = regularSessions + coveredSessions;
      const amount = paidSessions * term.fee;

      const sigUrl = findTeacherSignature(sigBook, cleanName);
      const hasSig = isActualSignature(sigUrl);

      list.push({
        name: cleanName,
        courses: instructorCourses,
        totalPlannedSessions,
        regularSessions,
        coveredSessions,
        absentSessions,
        paidSessions,
        amount,
        hasSignature: hasSig,
        signatureUrl: sigUrl,
        absentEvents,
        coveredEvents,
      });
    });

    return list;
  }, [courses, substituteRecords, settlement, coursePlanMap, term.fee, sigBook]);

  // 검색 및 정렬 필터링
  const filteredInstructors = useMemo(() => {
    let result = [...enhancedInstructors];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (inst) =>
          inst.name.toLowerCase().includes(q) ||
          inst.courses.some((c) => c.title.toLowerCase().includes(q)) ||
          inst.absentEvents.some((e) => e.reason.toLowerCase().includes(q)) ||
          inst.coveredEvents.some((e) => e.reason.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'amount') {
        cmp = b.amount - a.amount;
      } else if (sortField === 'sessions') {
        cmp = b.paidSessions - a.paidSessions;
      } else if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name, 'ko');
      }
      return sortAsc ? -cmp : cmp;
    });

    return result;
  }, [enhancedInstructors, searchQuery, sortField, sortAsc]);

  // 전체 통계 합계 계산
  const totals = useMemo(() => {
    const totalPlanned = enhancedInstructors.reduce((sum, i) => sum + i.totalPlannedSessions, 0);
    const totalPaid = enhancedInstructors.reduce((sum, i) => sum + i.paidSessions, 0);
    const totalAmount = enhancedInstructors.reduce((sum, i) => sum + i.amount, 0);
    const totalRegular = enhancedInstructors.reduce((sum, i) => sum + i.regularSessions, 0);
    const totalCovered = enhancedInstructors.reduce((sum, i) => sum + i.coveredSessions, 0);
    const totalAbsent = enhancedInstructors.reduce((sum, i) => sum + i.absentSessions, 0);
    const subCount = settlement.substituteEvents.length;

    const progressRate = totalPlanned > 0 ? ((totalPaid / totalPlanned) * 100).toFixed(1) : '100.0';

    return {
      instructorsCount: enhancedInstructors.length,
      totalPlanned,
      totalPaid,
      totalAmount,
      totalRegular,
      totalCovered,
      totalAbsent,
      subCount,
      progressRate,
    };
  }, [enhancedInstructors, settlement.substituteEvents]);

  // 아코디언 토글
  const toggleTeacher = (name: string) => {
    setExpandedTeachers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = (expand: boolean) => {
    if (expand) {
      setExpandedTeachers(new Set(filteredInstructors.map((i) => i.name)));
    } else {
      setExpandedTeachers(new Set());
    }
  };

  // 엑셀 내보내기
  const handleExportExcel = () => {
    try {
      const wb = generateAfterschoolSettlementWorkbook(
        courses,
        enrollments,
        attendanceRecords,
        approvalDocs,
        term.fee,
        termLabel(term),
        substituteRecords,
        term
      );
      const safeTerm = termLabel(term).replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
      XLSX.writeFile(wb, `${safeTerm}_방과후학교_강사관리_수당정산명세서.xlsx`);
    } catch (err) {
      console.error('Failed to export settlement excel:', err);
      alert('엑셀 파일 생성 중 오류가 발생했습니다.');
    }
  };

  const formatCurrency = (val: number) => {
    const formatted = Math.round(val).toLocaleString('ko-KR');
    return `${formatted} ${term.currency}`;
  };

  return (
    <div className="space-y-4 pb-28 sm:pb-6">
      {/* 1. 상단 타이틀 및 기준 안내 바 */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              강사 관리 및 수당 실시간 정산
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              {termLabel(term)}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500">
            운영 기간: <span className="font-semibold text-slate-700">{termPeriodLabel(term)}</span> · 
            강사료 기준: <span className="font-bold text-indigo-700">{formatCurrency(term.fee)} / 차시</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            title="강사별 시수 및 수당 정산 종합 엑셀(5개 시트) 다운로드"
          >
            <Download className="w-3.5 h-3.5" />
            <span>정산 엑셀 다운로드</span>
          </button>
        </div>
      </div>

      {/* 2. 4대 KPI 요약 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* 카드 1: 등록 강사 */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">배정 강사</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900">{totals.instructorsCount}</span>
            <span className="text-xs text-slate-500 font-bold">명</span>
          </div>
          <div className="text-[10.5px] text-slate-400 mt-1 truncate">
            운영 강좌 {courses.filter((c) => c.status !== 'CANCELLED').length}개
          </div>
        </div>

        {/* 카드 2: 예상 수업시수 */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">예상 총 수업시수</span>
            <Calendar className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-indigo-900">{totals.totalPlanned}</span>
            <span className="text-xs text-indigo-600 font-bold">차시</span>
          </div>
          <div className="text-[10.5px] text-slate-400 mt-1 truncate">
            학기 계획 시수 총합
          </div>
        </div>

        {/* 카드 3: 실제 수업 진행 현황 */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">실제 수업 현황</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-emerald-700">{totals.totalPaid}</span>
            <span className="text-xs text-emerald-600 font-bold">차시</span>
            <span className="text-[10.5px] font-bold text-slate-500 ml-auto">{totals.progressRate}%</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-600 font-semibold">정상 {totals.totalRegular}</span>
            <span>·</span>
            <span className="text-purple-600 font-semibold">보결 {totals.totalCovered}</span>
            <span>·</span>
            <span className="text-rose-500 font-semibold">결강 {totals.totalAbsent}</span>
          </div>
        </div>

        {/* 카드 4: 총 강사수당 */}
        <div className="bg-white border border-indigo-200 bg-indigo-50/20 rounded-xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-indigo-700 mb-1">
            <span className="text-[11px] font-bold">총 예상 강사수당</span>
            <DollarSign className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-indigo-950 truncate">
              {Math.round(totals.totalAmount).toLocaleString('ko-KR')}
            </span>
            <span className="text-xs font-bold text-indigo-700">{term.currency}</span>
          </div>
          <div className="text-[10.5px] text-indigo-600/80 mt-1 truncate">
            지급 인정 총 {totals.totalPaid}차시 기준
          </div>
        </div>
      </div>

      {/* 3. 뷰 모드 탭 & 검색·정렬 컨트롤 */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* 좌측 서브 탭 */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('teachers')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'teachers'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>강사별 수당 현황 ({enhancedInstructors.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('substitutes')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'substitutes'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>보결·대강 기록 대장 ({settlement.substituteEvents.length})</span>
            </button>
          </div>

          {/* 우측 전체 펼치기/접기 */}
          {viewMode === 'teachers' && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <button
                type="button"
                onClick={() => toggleAll(true)}
                className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
              >
                모두 펼치기
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => toggleAll(false)}
                className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
              >
                모두 접기
              </button>
            </div>
          )}
        </div>

        {/* 검색 및 정렬 바 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 border-t border-slate-100">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="강사명, 강좌명, 보결 사유 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 text-xs text-slate-600 font-bold">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>정렬:</span>
            </div>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-slate-700 bg-white focus:outline-none"
            >
              <option value="amount">총 수당 높은순</option>
              <option value="sessions">인정 시수 많은순</option>
              <option value="name">강사 이름순</option>
            </select>
            <button
              type="button"
              onClick={() => setSortAsc(!sortAsc)}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title={sortAsc ? '내림차순 정렬' : '오름차순 정렬'}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. [메인 뷰 1]: 강사별 수당 현황 목록 */}
      {viewMode === 'teachers' && (
        <div className="space-y-3">
          {filteredInstructors.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs font-bold">
              조건에 부합하는 강사가 없습니다.
            </div>
          ) : (
            filteredInstructors.map((inst) => {
              const isExpanded = expandedTeachers.has(inst.name);
              const hasSubHistory = inst.absentEvents.length > 0 || inst.coveredEvents.length > 0;

              return (
                <div
                  key={inst.name}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:border-slate-300 transition"
                >
                  {/* 강사 카드 헤더 */}
                  <div
                    onClick={() => toggleTeacher(inst.name)}
                    className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/50 transition"
                  >
                    {/* 좌측: 강사 정보 & 강좌 뱃지 */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                          {inst.name.charAt(0)}
                        </div>
                        <span className="font-black text-sm sm:text-base text-slate-900">{inst.name}</span>

                        {/* 서명 상태 뱃지 */}
                        {inst.hasSignature ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>서명 등록완료</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onRequestSignature) {
                                onRequestSignature(inst.name, inst.courses[0]?.courseId);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
                            title="서명/도장 등록 모달 열기"
                          >
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span>서명 미등록 (등록)</span>
                          </button>
                        )}

                        <span className="text-[11px] text-slate-500 font-bold">
                          담당 강좌 {inst.courses.length}개
                        </span>
                      </div>

                      {/* 배정 강좌 태그 목록 */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {inst.courses.map((c) => (
                          <span
                            key={c.courseId}
                            className="text-[10.5px] font-medium px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md truncate max-w-[220px]"
                            title={c.title}
                          >
                            {c.title}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 우측: 시수 요약 및 총 강사수당 */}
                    <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-4 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                      {/* 시수 칩 */}
                      <div className="text-right space-y-0.5">
                        <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1.5">
                          <span>예상 <strong className="text-slate-700 font-black">{inst.totalPlannedSessions}</strong>차시</span>
                          <span>|</span>
                          <span className="text-emerald-700 font-bold">정상 {inst.regularSessions}</span>
                          {inst.coveredSessions > 0 && (
                            <span className="text-purple-700 font-bold">+{inst.coveredSessions}대강</span>
                          )}
                          {inst.absentSessions > 0 && (
                            <span className="text-rose-600 font-bold">-{inst.absentSessions}결강</span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm font-black text-slate-800">
                          인정 <span className="text-indigo-600 text-base">{inst.paidSessions}</span> 차시
                        </div>
                      </div>

                      {/* 총 강사수당 금액 */}
                      <div className="text-right min-w-[130px] pl-2 border-l border-slate-200">
                        <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
                          총 강사수당
                        </span>
                        <span className="text-sm sm:text-base font-black text-indigo-900 tracking-tight">
                          {formatCurrency(inst.amount)}
                        </span>
                      </div>

                      {/* 토글 화살표 */}
                      <div className="text-slate-400 pl-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* 강사 카드 바디 (펼쳤을 때 상세) */}
                  {isExpanded && (
                    <div className="bg-slate-50/70 border-t border-slate-200 p-3 sm:p-4 space-y-4 text-xs">
                      {/* 섹션 1: 담당 강좌별 상세 시수 및 수당 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                            <span>강좌별 수업시수 및 수당 분기 내역</span>
                          </span>
                        </div>

                        <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                          <table className="w-full text-center border-collapse">
                            <thead>
                              <tr className="bg-slate-100 text-[10.5px] text-slate-600 font-bold border-b border-slate-200">
                                <th className="py-1.5 px-2 text-left">강좌명</th>
                                <th className="py-1.5 px-2">역할</th>
                                <th className="py-1.5 px-2">수업 요일/시간</th>
                                <th className="py-1.5 px-2">교실</th>
                                <th className="py-1.5 px-2">예상 시수</th>
                                <th className="py-1.5 px-2 text-emerald-700">정상 진행</th>
                                <th className="py-1.5 px-2 text-purple-700">대강 시수</th>
                                <th className="py-1.5 px-2 text-rose-600">결강 시수</th>
                                <th className="py-1.5 px-2 text-indigo-700">인정 시수</th>
                                <th className="py-1.5 px-2 text-right">강사수당</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[11px]">
                              {inst.courses.map((c) => {
                                const coursePaid = c.regular + c.covered;
                                return (
                                  <tr key={c.courseId} className="hover:bg-slate-50/60">
                                    <td className="py-2 px-2 text-left font-bold text-slate-900">
                                      {c.title}
                                    </td>
                                    <td className="py-2 px-2">
                                      <span
                                        className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          c.role === '주강사'
                                            ? 'bg-blue-50 text-blue-700'
                                            : c.role === '보조강사'
                                            ? 'bg-slate-100 text-slate-600'
                                            : 'bg-purple-50 text-purple-700'
                                        }`}
                                      >
                                        {c.role}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 text-slate-600">
                                      {(c.classDays || []).join(', ')} {c.classTime || ''}
                                    </td>
                                    <td className="py-2 px-2 text-slate-600">{c.classroom || '-'}</td>
                                    <td className="py-2 px-2 font-bold text-slate-700">{c.plannedSessions}</td>
                                    <td className="py-2 px-2 font-bold text-emerald-700">{c.regular}</td>
                                    <td className="py-2 px-2 font-bold text-purple-700">
                                      {c.covered > 0 ? `+${c.covered}` : '-'}
                                    </td>
                                    <td className="py-2 px-2 font-bold text-rose-600">
                                      {c.absent > 0 ? `-${c.absent}` : '-'}
                                    </td>
                                    <td className="py-2 px-2 font-black text-indigo-800 bg-indigo-50/40">
                                      {coursePaid}
                                    </td>
                                    <td className="py-2 px-2 text-right font-black text-slate-900">
                                      {formatCurrency(c.amount)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 섹션 2: 보결·대강 기록 (해당 강사 이력) */}
                      {hasSubHistory && (
                        <div className="space-y-2 pt-2 border-t border-slate-200">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-purple-600" />
                            <span>보결 및 결강 상세 기록 ({inst.name})</span>
                          </span>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {/* 1) 결강 기록 */}
                            <div className="border border-rose-200 bg-rose-50/30 rounded-lg p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between text-rose-800 font-bold text-[11px]">
                                <span>결강 내역 (수당 제외)</span>
                                <span>{inst.absentEvents.length}건</span>
                              </div>
                              {inst.absentEvents.length === 0 ? (
                                <div className="text-[10.5px] text-slate-400 italic">결강 내역이 없습니다.</div>
                              ) : (
                                <div className="space-y-1.5">
                                  {inst.absentEvents.map((ev, idx) => (
                                    <div
                                      key={`${ev.courseId}-${ev.dayIndex}-${idx}`}
                                      className="bg-white border border-rose-100 rounded p-1.5 text-[10.5px] space-y-0.5"
                                    >
                                      <div className="flex justify-between font-bold text-slate-800">
                                        <span>{ev.dateStr} · {ev.courseTitle}</span>
                                        <span className="text-rose-600 font-black">-{ev.sessions}차시</span>
                                      </div>
                                      <div className="text-slate-500 text-[10px]">
                                        대강자: <strong className="text-slate-700">{ev.substituteInstructor || '대강 없음'}</strong> · 
                                        사유: {ev.reason || '사유 미기재'}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* 2) 보결(대강) 수업 기록 */}
                            <div className="border border-purple-200 bg-purple-50/30 rounded-lg p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between text-purple-800 font-bold text-[11px]">
                                <span>보결 대강 수업 (수당 추가 지급)</span>
                                <span>{inst.coveredEvents.length}건</span>
                              </div>
                              {inst.coveredEvents.length === 0 ? (
                                <div className="text-[10.5px] text-slate-400 italic">대강 수업 내역이 없습니다.</div>
                              ) : (
                                <div className="space-y-1.5">
                                  {inst.coveredEvents.map((ev, idx) => (
                                    <div
                                      key={`${ev.courseId}-${ev.dayIndex}-${idx}`}
                                      className="bg-white border border-purple-100 rounded p-1.5 text-[10.5px] space-y-0.5"
                                    >
                                      <div className="flex justify-between font-bold text-slate-800">
                                        <span>{ev.dateStr} · {ev.courseTitle}</span>
                                        <span className="text-purple-700 font-black">+{ev.sessions}차시</span>
                                      </div>
                                      <div className="text-slate-500 text-[10px]">
                                        원 강사: <strong className="text-slate-700">{ev.absentInstructor}</strong> · 
                                        사유: {ev.reason || '사유 미기재'}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5. [메인 뷰 2]: 학기 전체 보결·대강 기록 대장 */}
      {viewMode === 'substitutes' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span>방과후학교 학기 전체 보결·결강 통합 대장</span>
              </span>
              <p className="text-[10.5px] text-slate-500">
                출석부 및 강사출근부에서 발생한 모든 결강 및 대강 이력이 실시간 동기화되어 기록됩니다.
              </p>
            </div>

            <div className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
              총 {settlement.substituteEvents.length}건 발생
            </div>
          </div>

          {settlement.substituteEvents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-bold">
              이번 학기 등록된 보결 및 결강 기록이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-[10.5px] text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-2 px-2.5 text-left">수업 일자 (회차)</th>
                    <th className="py-2 px-2 text-left">강좌명</th>
                    <th className="py-2 px-2">구분</th>
                    <th className="py-2 px-2 text-rose-700">결강 강사</th>
                    <th className="py-2 px-2 text-purple-700">대강(보결) 강사</th>
                    <th className="py-2 px-1.5">시수</th>
                    <th className="py-2 px-2">수업 상태</th>
                    <th className="py-2 px-3 text-left">사유</th>
                    <th className="py-2 px-2.5 text-right">수당 정산 변동</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {settlement.substituteEvents.map((ev, idx) => {
                    const isCovered = Boolean(ev.substituteInstructor);
                    return (
                      <tr key={`${ev.courseId}-${ev.dayIndex}-${idx}`} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-2.5 text-left font-bold text-slate-900 whitespace-nowrap">
                          {ev.dateStr}
                        </td>
                        <td className="py-2.5 px-2 text-left font-semibold text-slate-800">
                          {ev.courseTitle}
                        </td>
                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isCovered
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {isCovered ? '대강 수업' : '결강 (미대강)'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 font-bold text-rose-700 whitespace-nowrap">
                          {ev.absentInstructor}
                        </td>
                        <td className="py-2.5 px-2 font-bold text-purple-700 whitespace-nowrap">
                          {ev.substituteInstructor || '-'}
                        </td>
                        <td className="py-2.5 px-1.5 font-bold text-slate-700 whitespace-nowrap">
                          {ev.sessions}차시
                        </td>
                        <td className="py-2.5 px-2 whitespace-nowrap">
                          {ev.conducted ? (
                            <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              수업 완료
                            </span>
                          ) : (
                            <span className="text-[10.5px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              미진행/대기
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-left text-slate-600 text-[11px] max-w-[200px] truncate" title={ev.reason}>
                          {ev.reason || '-'}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap text-[11px]">
                          {ev.conducted ? (
                            <div className="space-y-0.5">
                              <span className="text-rose-600 block">
                                {ev.absentInstructor} -{formatCurrency(ev.sessions * term.fee)}
                              </span>
                              {ev.substituteInstructor && (
                                <span className="text-purple-700 block">
                                  {ev.substituteInstructor} +{formatCurrency(ev.sessions * term.fee)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10.5px]">정산 미반영</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default TeacherManagementTab;
