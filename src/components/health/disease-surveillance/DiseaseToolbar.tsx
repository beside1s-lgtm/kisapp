'use client';

import React from 'react';
import { 
  Calendar, 
  Search, 
  FileSpreadsheet, 
  Printer, 
  RefreshCw, 
  Plus, 
  Layers, 
  CheckCircle2, 
  ShieldAlert, 
  GraduationCap, 
  School 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COMMON_DISEASES, SCHOOL_MONTHS } from './types';

interface DiseaseToolbarProps {
  schoolLevel: 'elementary' | 'secondary' | 'staff';
  setSchoolLevel: (level: 'elementary' | 'secondary' | 'staff') => void;
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  isAnnualMode: boolean;
  periodLabel: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedDiseaseFilter: string;
  setSelectedDiseaseFilter: (filter: string) => void;
  selectedCategoryFilter: string;
  setSelectedCategoryFilter: (category: string) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  onExportExcel: (mode: 'current' | 'annual') => void;
  onPrintReport: (mode: 'current' | 'annual') => void;
  onOpenAddDialog: () => void;
}

export function DiseaseToolbar({
  schoolLevel,
  setSchoolLevel,
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  isAnnualMode,
  periodLabel,
  searchQuery,
  setSearchQuery,
  selectedDiseaseFilter,
  setSelectedDiseaseFilter,
  selectedCategoryFilter,
  setSelectedCategoryFilter,
  isRefreshing,
  onRefresh,
  onExportExcel,
  onPrintReport,
  onOpenAddDialog,
}: DiseaseToolbarProps) {
  return (
    <div className="space-y-4">
      {/* ── 상단 툴바: 연도/월 선택 및 출력/등록 액션 ── */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 bg-muted/20 p-3 rounded-xl border border-border/50">
        {/* 연도 및 월별 / 연간 전체 선택 컨트롤 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs shrink-0">
            <Calendar className="w-4 h-4 text-slate-500 mr-1" />
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-7 w-[90px] text-xs font-bold border-none p-0 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['2025', '2026', '2027'].map(y => (
                  <SelectItem key={y} value={y}>{y}년</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 연간 전체 버튼 */}
          <button
            type="button"
            onClick={() => setSelectedMonth('all')}
            className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all flex items-center gap-1 shrink-0 ${
              isAnnualMode
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            연간 전체 (3월~2월)
          </button>

          {/* 월별 빠른 선택 버튼 그룹 */}
          <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5 overflow-x-auto no-scrollbar max-w-full">
            {SCHOOL_MONTHS.map(m => {
              const isSelected = selectedMonth === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setSelectedMonth(m.value)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all shrink-0 ${
                    isSelected
                      ? schoolLevel === 'elementary'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : schoolLevel === 'secondary'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-purple-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 px-2.5 text-xs text-slate-700 border-slate-200 shrink-0"
            title="최신 결석계 및 감염병 데이터 동기화"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            동기화
          </Button>
        </div>

        {/* 오른쪽: 출력(인쇄) & 엑셀 & 등록 액션 */}
        <div className="flex items-center gap-1.5 justify-end flex-wrap shrink-0">
          {/* 엑셀 내보내기 버튼 */}
          <div className="flex items-center border border-emerald-300 rounded-lg overflow-hidden bg-white shadow-2xs">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onExportExcel('current')}
              className="h-8 px-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-none border-r border-emerald-200"
              title="현재 선택 기간 엑셀 다운로드"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              {isAnnualMode ? '연간 엑셀' : '월간 엑셀'}
            </Button>
            {!isAnnualMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onExportExcel('annual')}
                className="h-8 px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 rounded-none"
                title="연간 전체 엑셀 일괄 다운로드"
              >
                연간 전체 엑셀
              </Button>
            )}
          </div>

          {/* 대장 A4 인쇄 출력 버튼 */}
          <div className="flex items-center border border-indigo-300 rounded-lg overflow-hidden bg-white shadow-2xs">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPrintReport('current')}
              className="h-8 px-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 rounded-none border-r border-indigo-200"
              title="현재 선택 기간 A4 표준 양식 인쇄"
            >
              <Printer className="w-3.5 h-3.5 mr-1 text-indigo-600" />
              {isAnnualMode ? '연간 인쇄' : '월간 대장 인쇄'}
            </Button>
            {!isAnnualMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPrintReport('annual')}
                className="h-8 px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 rounded-none"
                title="연간 전체 대장 일괄 인쇄"
              >
                연간 전체 인쇄
              </Button>
            )}
          </div>

          {/* 신규 등록 버튼 */}
          <Button
            size="sm"
            onClick={onOpenAddDialog}
            className={`h-8 px-3 text-xs font-bold text-white shadow-xs ${
              schoolLevel === 'staff'
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            {schoolLevel === 'staff' ? '교직원 질병 등록' : '감염병 환자 등록'}
          </Button>
        </div>
      </div>

      {/* ── 검색 및 필터 & 연동 안내 배너 ── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. 검색창 */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={
                schoolLevel === 'staff'
                  ? '소속 부서(예: 행정실, 초등교무실), 직책, 교직원명, 병명, 증상 검색...'
                  : '학반(예: 2-3), 담임명, 학생명, 병명, 증상 검색...'
              }
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>

          {/* 2. 질병 형태(감염병/단순질병/식중독) 1클릭 필터 탭 */}
          <div className="flex items-center gap-1 shrink-0 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryFilter('all');
                setSelectedDiseaseFilter('all');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                selectedCategoryFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              전체 형태
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryFilter('감염병');
                setSelectedDiseaseFilter('all');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-1 ${
                selectedCategoryFilter === '감염병'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-rose-700 bg-rose-50/60 hover:bg-rose-100'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
              감염병
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryFilter('단순질병');
                setSelectedDiseaseFilter('all');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-1 ${
                selectedCategoryFilter === '단순질병'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-sky-700 bg-sky-50/60 hover:bg-sky-100'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block" />
              단순질병
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryFilter('식중독');
                setSelectedDiseaseFilter('all');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-1 ${
                selectedCategoryFilter === '식중독'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-amber-800 bg-amber-50/60 hover:bg-amber-100'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              식중독
            </button>
          </div>

          {/* 3. 구체적 병명 세부 필터 (선택된 카테고리에 해당하는 병명만 표출) */}
          <Select value={selectedDiseaseFilter} onValueChange={setSelectedDiseaseFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs shrink-0">
              <SelectValue placeholder="세부 병명 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 병명</SelectItem>
              {COMMON_DISEASES
                .filter(d => selectedCategoryFilter === 'all' || d.category === selectedCategoryFilter)
                .map(d => (
                  <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>

          <div className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            조회: <span className="text-emerald-800">{periodLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 bg-amber-50/60 border border-amber-200/60 px-3 py-1.5 rounded-lg">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>
            {schoolLevel === 'staff' ? (
              <>
                교직원 건강/질병 신고는 교직원 본인이 <strong>[교원 서비스 &gt; 건강/질병 신고]</strong>에서 직접 등록하거나, 보건 교사가 수기 등록할 수 있으며 <strong>입력된 교직원만 핀포인트로 대장에 관리</strong>됩니다.
              </>
            ) : (
              <>
                담임 교사가 <strong>출석부</strong> 및 <strong>결석계</strong>에서 병결로 처리한 학생은 질병명과 함께 실시간으로 자동 등재되며, 결석 학생이 발생한 학급과 담임명만 핀포인트로 표시됩니다.
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
