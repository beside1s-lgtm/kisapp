'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Check, Edit3, ShieldAlert, Sparkles, Stethoscope, UtensilsCrossed, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { COMMON_DISEASES, CATEGORY_BADGE_STYLES, DiseaseCategoryType, DiseaseMeta } from './types';

export interface AbsenceDiseaseSelectorProps {
  value: string;
  onChange: (
    fullReason: string,
    meta?: {
      category: DiseaseCategoryType;
      diseaseName: string;
      detail: string;
    }
  ) => void;
  initialCategory?: DiseaseCategoryType;
  initialDiseaseName?: string;
  error?: string;
  className?: string;
}

export function AbsenceDiseaseSelector({
  value,
  onChange,
  initialCategory,
  initialDiseaseName,
  error,
  className = '',
}: AbsenceDiseaseSelectorProps) {
  // 1. 선택된 질병 형태: 단순질병 | 감염병 | 식중독
  const [selectedCategory, setSelectedCategory] = useState<DiseaseCategoryType>(() => {
    if (initialCategory) return initialCategory;
    if (value.includes('독감') || value.includes('수족구') || value.includes('코로나') || value.includes('수두') || value.includes('감염병')) {
      return '감염병';
    }
    if (value.includes('식중독') || value.includes('장염') || value.includes('노로')) {
      return '식중독';
    }
    return '단순질병';
  });

  // 2. 병명 검색어
  const [searchQuery, setSearchQuery] = useState('');

  // 3. 선택된 병명 (또는 'custom')
  const [selectedDisease, setSelectedDisease] = useState<string>(() => {
    if (initialDiseaseName) return initialDiseaseName;
    return '';
  });

  // 4. 직접 입력 여부 및 텍스트
  const [isCustomDisease, setIsCustomDisease] = useState(false);
  const [customDiseaseName, setCustomDiseaseName] = useState('');

  // 5. 상세 사유 / 증상
  const [detailReason, setDetailReason] = useState(() => {
    if (!value) return '';
    // 만약 기존 value에서 병명 접두사나 하이픈이 있으면 분리
    const parts = value.split(' - ');
    if (parts.length > 1) {
      return parts.slice(1).join(' - ');
    }
    return '';
  });

  // 초기 value 파싱 (컴포넌트 마운트 시 기존 값이 있을 때 매핑)
  useEffect(() => {
    if (value && !selectedDisease && !customDiseaseName) {
      const match = COMMON_DISEASES.find((d) => value.includes(d.name));
      if (match) {
        setSelectedCategory(match.category);
        setSelectedDisease(match.name);
      }
    }
  }, [value, selectedDisease, customDiseaseName]);

  // 검색 및 카테고리에 따른 병명 목록 필터링
  const filteredDiseases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return COMMON_DISEASES.filter((d) => {
      const matchCat = d.category === selectedCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return d.name.toLowerCase().includes(q);
    });
  }, [selectedCategory, searchQuery]);

  // 최종 유효 병명 결정
  const activeDiseaseName = isCustomDisease ? customDiseaseName.trim() : selectedDisease;

  // 상태 변경 시 부모 컴포넌트에 최종 사유 문자열 전달
  const updateParent = (
    cat: DiseaseCategoryType,
    diseaseName: string,
    detail: string
  ) => {
    const cleanDisease = diseaseName.trim();
    const cleanDetail = detail.trim();

    let combined = '';
    if (cleanDisease && cleanDetail) {
      combined = `${cleanDisease} - ${cleanDetail}`;
    } else if (cleanDisease) {
      combined = cleanDisease;
    } else if (cleanDetail) {
      combined = cleanDetail;
    }

    onChange(combined, {
      category: cat,
      diseaseName: cleanDisease,
      detail: cleanDetail,
    });
  };

  // 카테고리 전환 핸들러
  const handleCategorySelect = (cat: DiseaseCategoryType) => {
    setSelectedCategory(cat);
    // 카테고리가 바뀌면 검색어 유지하되, 현재 선택 병명이 타 카테고리 병명이면 초기화
    if (!isCustomDisease && selectedDisease) {
      const existsInNewCat = COMMON_DISEASES.some((d) => d.category === cat && d.name === selectedDisease);
      if (!existsInNewCat) {
        setSelectedDisease('');
        updateParent(cat, '', detailReason);
      } else {
        updateParent(cat, selectedDisease, detailReason);
      }
    } else if (isCustomDisease) {
      updateParent(cat, customDiseaseName, detailReason);
    }
  };

  // 병명 칩/버튼 클릭 핸들러
  const handleDiseaseClick = (name: string) => {
    setIsCustomDisease(false);
    setSelectedDisease(name);
    updateParent(selectedCategory, name, detailReason);
  };

  // 직접 입력 모드 전환
  const handleCustomMode = () => {
    setIsCustomDisease(true);
    setSelectedDisease('');
    if (searchQuery.trim() && !customDiseaseName) {
      setCustomDiseaseName(searchQuery.trim());
      updateParent(selectedCategory, searchQuery.trim(), detailReason);
    } else {
      updateParent(selectedCategory, customDiseaseName, detailReason);
    }
  };

  // 직접 입력 텍스트 변경
  const handleCustomNameChange = (name: string) => {
    setCustomDiseaseName(name);
    updateParent(selectedCategory, name, detailReason);
  };

  // 상세 증상/사유 변경
  const handleDetailChange = (detail: string) => {
    setDetailReason(detail);
    updateParent(selectedCategory, activeDiseaseName, detail);
  };

  return (
    <div className={`space-y-2 bg-slate-50/80 p-2.5 sm:p-3 rounded-lg border border-slate-200 text-xs ${className}`}>
      {/* 1. 질병 형태 선택 3대 탭/버튼 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            질병 분류 선택 <span className="text-red-500">*</span>
          </span>
          <span className="text-[10px] text-slate-400">병결 사유 표준 분류</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {/* 단순질병 */}
          <button
            type="button"
            onClick={() => handleCategorySelect('단순질병')}
            className={`py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-all border ${
              selectedCategory === '단순질병'
                ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                : 'bg-white text-sky-800 border-sky-200 hover:bg-sky-50'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">단순질병</span>
          </button>

          {/* 감염병 */}
          <button
            type="button"
            onClick={() => handleCategorySelect('감염병')}
            className={`py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-all border ${
              selectedCategory === '감염병'
                ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                : 'bg-white text-rose-800 border-rose-200 hover:bg-rose-50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">감염병</span>
          </button>

          {/* 식중독 */}
          <button
            type="button"
            onClick={() => handleCategorySelect('식중독')}
            className={`py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-all border ${
              selectedCategory === '식중독'
                ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-50'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">식중독</span>
          </button>
        </div>
      </div>

      {/* 2. 병명 검색 및 빠른 선택 칩 */}
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-700">
            병명 선택 / 검색 <span className="text-red-500">*</span>
          </span>
          <span className="text-[10px] text-slate-400">클릭하여 선택</span>
        </div>

        {/* 검색 인풋창 */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder={`${selectedCategory} 병명 검색 (예: ${
              selectedCategory === '단순질병' ? '감기, 복통, 발열, 중이염' : selectedCategory === '감염병' ? '독감, 수족구, 코로나' : '장염, 식중독, 노로'
            })`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs bg-white border-slate-300 focus:border-indigo-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* 병명 선택 칩 그리드 */}
        <div className="flex flex-wrap gap-1 max-h-[130px] overflow-y-auto p-1 bg-white rounded border border-slate-200 overscroll-contain">
          {filteredDiseases.map((d) => {
            const isSelected = !isCustomDisease && selectedDisease === d.name;
            return (
              <button
                key={d.name}
                type="button"
                onClick={() => handleDiseaseClick(d.name)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1 border shrink-0 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                {d.name}
              </button>
            );
          })}

          {/* 직접 입력 칩 */}
          <button
            type="button"
            onClick={handleCustomMode}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1 border shrink-0 ${
              isCustomDisease
                ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-2xs'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            <span>목록에 없음 (직접 입력)</span>
          </button>
        </div>

        {/* 직접 입력 선택 시 인풋 활성화 */}
        {isCustomDisease && (
          <div className="space-y-1 pt-1 animate-in fade-in-50 duration-200">
            <div className="flex items-center gap-1">
              <Edit3 className="w-3 h-3 text-indigo-600" />
              <span className="text-[11px] font-bold text-indigo-900">병명 직접 입력</span>
            </div>
            <Input
              type="text"
              placeholder="병명을 정확히 입력해주세요 (예: 인대 파열, 결막하 출혈, 편도 비대)"
              value={customDiseaseName}
              onChange={(e) => handleCustomNameChange(e.target.value)}
              className="h-8 text-xs bg-white border-indigo-300 focus:border-indigo-500 font-semibold"
              autoFocus
            />
          </div>
        )}
      </div>

      {/* 3. 세부 증상 및 상세 사유 (선택 입력) */}
      <div className="space-y-1 pt-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-700">상세 증상 및 사유 (선택)</span>
          <span className="text-[10px] text-slate-400">의사 소견 / 특이사항</span>
        </div>
        <Input
          type="text"
          placeholder="예: 38.5도 고열 및 오한으로 인한 가료 요양 필요"
          value={detailReason}
          onChange={(e) => handleDetailChange(e.target.value)}
          className="h-8 text-xs bg-white border-slate-300 focus:border-indigo-400"
        />
      </div>

      {/* 4. 최종 결석계 기재 사유 미리보기 */}
      <div className="bg-white p-2 rounded border border-slate-200 flex flex-col gap-1">
        <span className="text-[10px] font-bold text-slate-500">결석계 반영 사유 미리보기:</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${CATEGORY_BADGE_STYLES[selectedCategory].badge}`}>
            {selectedCategory}
          </Badge>
          <span className="font-bold text-slate-800 text-xs">
            {activeDiseaseName || <span className="text-slate-400 font-normal">병명을 선택해주세요</span>}
          </span>
          {detailReason && (
            <span className="text-slate-600 text-xs">
              - {detailReason}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1 text-[11px] text-destructive font-medium pt-0.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
