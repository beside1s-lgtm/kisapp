'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle2, XCircle, Clock, Check, Eye, Printer } from 'lucide-react';
import type { SchoolFacility, MonthlyInspectionRecord, InspectionScore } from '@/lib/safety/types';
import { SAFETY_INSPECTION_ITEMS } from '@/lib/safety/types';
import { getTeacherStampSignature, isActualSignature } from '@/lib/safety/stampHelper';
import { getTeacherSignaturesDirectory } from '@/lib/services/userService';
import { openSafetyInspectionPrintWindow } from './InspectionPrintModal';

interface InspectionGridTableProps {
  facilities: SchoolFacility[];
  records: MonthlyInspectionRecord[];
  yearMonth: string;
  teacherSignatures?: Record<string, string>;
  onSelectFacilityDetail?: (facility: SchoolFacility, record?: MonthlyInspectionRecord) => void;
}

export function InspectionGridTable({
  facilities,
  records,
  yearMonth,
  teacherSignatures: propTeacherSignatures,
  onSelectFacilityDetail,
}: InspectionGridTableProps) {
  // 학년별 탭 선택 ('1' ~ '6', 'special', 'all')
  const [selectedTab, setSelectedTab] = useState<string>('1');
  const [internalSignatures, setInternalSignatures] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!propTeacherSignatures) {
      getTeacherSignaturesDirectory().then(map => {
        setInternalSignatures(map);
      });
    }
  }, [propTeacherSignatures]);

  const teacherSignatures = propTeacherSignatures || internalSignatures;

  // facilityId -> record 매핑
  const recordMap = useMemo(() => {
    const map: Record<string, MonthlyInspectionRecord> = {};
    records.forEach(r => {
      map[r.facilityId] = r;
    });
    return map;
  }, [records]);

  // 선택된 탭에 속하는 시설 목록
  const tabFacilities = useMemo(() => {
    return facilities.filter(fac => {
      if (!fac.isActive) return false;
      if (selectedTab === 'all') return true;
      if (selectedTab === 'special') return fac.category === 'special' || fac.category === 'common';
      return String(fac.grade) === selectedTab;
    });
  }, [facilities, selectedTab]);

  const monthDisplay = parseInt(yearMonth.split('-')[1], 10);

  return (
    <div className="space-y-3">
      {/* 상단 학년 선택 탭 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full sm:w-auto">
          <TabsList className="bg-slate-100 p-1 rounded-xl h-auto flex flex-wrap gap-1">
            <TabsTrigger value="1" className="text-xs font-bold px-3 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-2xs">
              1학년
            </TabsTrigger>
            <TabsTrigger value="2" className="text-xs font-bold px-3 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-2xs">
              2학년
            </TabsTrigger>
            <TabsTrigger value="3" className="text-xs font-bold px-3 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-2xs">
              3학년
            </TabsTrigger>
            <TabsTrigger value="4" className="text-xs font-bold px-3 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-2xs">
              4학년
            </TabsTrigger>
            <TabsTrigger value="5" className="text-xs font-bold px-3 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-2xs">
              5학년
            </TabsTrigger>
            <TabsTrigger value="6" className="text-xs font-bold px-3 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-2xs">
              6학년
            </TabsTrigger>
            <TabsTrigger value="special" className="text-xs font-bold px-3 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-2xs">
              특별실
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs font-bold px-3 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-2xs">
              전체 종합 ({facilities.length}개소)
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* 요약 상태 뱃지 */}
        <div className="flex items-center gap-1.5 text-xs">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">
            점검 완료: {tabFacilities.filter(f => recordMap[f.id]?.isCompleted).length}
          </Badge>
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 font-bold">
            미점검: {tabFacilities.filter(f => !recordMap[f.id]?.isCompleted).length}
          </Badge>
        </div>
      </div>

      {/* 학교 안전점검표 서식 그대로 렌더링되는 종합 그리드 테이블 */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
        {/* 서식 상단 공문 헤더 */}
        <div className="p-3.5 sm:p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              {yearMonth.split('-')[0]} 학교생활 안전점검표 ({monthDisplay}월) - {selectedTab === 'all' ? '전체 시설' : selectedTab === 'special' ? '특별실' : `${selectedTab}학년`}
            </h4>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 font-medium mt-0.5">
              <span>* 매월 4일(해당일 휴일인 경우 그 전후)에 점검을 실시합니다.</span>
              <span className="text-rose-600 font-bold">* 이상이 있을 시, 시설관리팀(520) 연락</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="text-emerald-700">좋음: O</span>
              <span className="text-amber-700">보통: △</span>
              <span className="text-rose-700">나쁨: ×</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openSafetyInspectionPrintWindow(facilities, records, yearMonth, selectedTab, teacherSignatures)}
              className="h-7 px-2.5 text-xs font-bold bg-white hover:bg-slate-50 border-slate-300 text-slate-800 shadow-2xs flex items-center gap-1 cursor-pointer"
              title="A4 가로 1장 인쇄 창 열기"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>{selectedTab === 'all' ? '전 학년 일괄 인쇄' : selectedTab === 'special' ? '특별실 인쇄' : `${selectedTab}학년 인쇄`}</span>
            </Button>
          </div>
        </div>

        {/* 엑셀/공문 테이블 뷰 (가로 스크롤 가능) */}
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse text-xs text-center min-w-[750px]">
            <thead>
              {/* 1행: 헤더 구분 및 장소명 */}
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-2 border-r border-slate-200 w-16 text-center shrink-0">구분</th>
                <th className="p-2 border-r border-slate-200 w-56 text-left shrink-0">점검항목</th>
                <th colSpan={tabFacilities.length} className="p-2 border-r border-slate-200 text-center bg-amber-50/60 text-amber-900">
                  담당장소
                </th>
                <th className="p-2 w-28 text-center shrink-0">비고/조치</th>
              </tr>

              {/* 2행: 장소명 라인 */}
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-800 font-bold">
                <th className="p-1.5 border-r border-slate-200" colSpan={2}>
                  장소명
                </th>
                {tabFacilities.map(fac => (
                  <th key={fac.id} className="p-1.5 border-r border-slate-200 min-w-[70px] max-w-[100px] truncate text-[11px] font-black">
                    {fac.name}
                  </th>
                ))}
                <th className="p-1.5 text-center text-[11px]">시설팀(520)</th>
              </tr>

              {/* 3행: 담당자 교사명 라인 */}
              <tr className="bg-white border-b border-slate-200 text-slate-800">
                <th className="p-1.5 border-r border-slate-200 font-bold" colSpan={2}>
                  담당 교사
                </th>
                {tabFacilities.map(fac => (
                  <td key={fac.id} className="p-1.5 border-r border-slate-200 text-[11px] font-bold text-slate-700">
                    {fac.assignedTeacherName || <span className="text-rose-400 font-normal">미지정</span>}
                  </td>
                ))}
                <td className="p-1.5 text-center text-[10px] text-slate-400">-</td>
              </tr>

              {/* 4행: 서명(인) 확인 라인 - 도장/서명 이미지 겹쳐 찍힘 */}
              <tr className="bg-amber-50/30 border-b border-slate-200">
                <th className="p-1.5 border-r border-slate-200 font-bold text-amber-900" colSpan={2}>
                  서명(인)
                </th>
                {tabFacilities.map(fac => {
                  const rec = recordMap[fac.id];
                  const isDone = rec && rec.isCompleted;
                  const teacherName = (fac.assignedTeacherName || rec?.inspectorName || '교사').trim();

                  let stampUrl: string | null = null;
                  if (isDone) {
                    const facEmail = (fac.assignedTeacherEmail || '').toLowerCase().trim();
                    const registeredSig = (facEmail && teacherSignatures[facEmail]) || (teacherName && teacherSignatures[teacherName]) || null;

                    // 1순위: users 프로필에 등록된 실제 서명/도장 이미지 파일
                    if (isActualSignature(registeredSig)) {
                      stampUrl = registeredSig;
                    }
                    // 2순위: 점검 레코드 자체에 보관된 실제 도장 이미지 파일
                    else if (isActualSignature(rec.signature)) {
                      stampUrl = rec.signature || null;
                    }
                    // 3순위: 성명 기반 붉은색 타원형 가상 직인 SVG
                    else {
                      stampUrl = getTeacherStampSignature(teacherName);
                    }
                  }

                  return (
                    <td key={fac.id} className="p-1 border-r border-slate-200 text-center align-middle h-9">
                      {isDone ? (
                        <div
                          className="relative inline-flex items-center justify-center w-12 h-7"
                          title={`${teacherName} (인) 서명/도장 날인 완료`}
                        >
                          <span className="text-[10px] text-slate-300 font-bold select-none">(인)</span>
                          {stampUrl && (
                            <img
                              src={stampUrl}
                              alt=""
                              onError={(e) => {
                                // 이미지 로드 실패 시 깨진 아이콘 방지 및 성명 기반 직인 인영으로 즉시 폴백
                                const fallbackStamp = getTeacherStampSignature(teacherName);
                                if (e.currentTarget.src !== fallbackStamp) {
                                  e.currentTarget.src = fallbackStamp;
                                }
                              }}
                              className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-multiply transition-transform hover:scale-110"
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                          미점검
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="p-1.5 text-center text-[10px] text-slate-400">-</td>
              </tr>
            </thead>

            <tbody>
              {/* 섹션 1: 실내 점검 항목 (8개) */}
              {SAFETY_INSPECTION_ITEMS.filter(item => item.section === '실내').map((item, idx) => (
                <tr key={item.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  {idx === 0 && (
                    <td rowSpan={8} className="p-2 border-r border-slate-200 font-black text-slate-800 bg-slate-50/60 align-middle">
                      실내
                    </td>
                  )}
                  <td className="p-2 border-r border-slate-200 text-left font-medium text-slate-700 whitespace-normal break-keep leading-snug">
                    {item.index}. {item.name}
                  </td>
                  {tabFacilities.map(fac => {
                    const rec = recordMap[fac.id];
                    const score = rec?.scores?.[item.id] || (rec?.isCompleted ? 'O' : '-');
                    const colorMap: Record<string, string> = {
                      O: 'text-emerald-700 font-black',
                      '△': 'text-amber-700 font-black',
                      '×': 'text-rose-600 font-black bg-rose-50',
                      '-': 'text-slate-300',
                    };
                    return (
                      <td key={fac.id} className={`p-2 border-r border-slate-200 text-center ${colorMap[score] || ''}`}>
                        {score}
                      </td>
                    );
                  })}
                  <td className="p-2 text-center text-[10px] text-slate-400">
                    -
                  </td>
                </tr>
              ))}

              {/* 섹션 2: 복도 및 계단 점검 항목 (6개) */}
              {SAFETY_INSPECTION_ITEMS.filter(item => item.section === '복도 및 계단').map((item, idx) => (
                <tr key={item.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  {idx === 0 && (
                    <td rowSpan={6} className="p-2 border-r border-slate-200 font-black text-slate-800 bg-slate-50/60 align-middle">
                      복도 및 계단
                    </td>
                  )}
                  <td className="p-2 border-r border-slate-200 text-left font-medium text-slate-700 whitespace-normal break-keep leading-snug">
                    {item.index}. {item.name}
                  </td>
                  {tabFacilities.map(fac => {
                    const rec = recordMap[fac.id];
                    const score = rec?.scores?.[item.id] || (rec?.isCompleted ? 'O' : '-');
                    const colorMap: Record<string, string> = {
                      O: 'text-emerald-700 font-black',
                      '△': 'text-amber-700 font-black',
                      '×': 'text-rose-600 font-black bg-rose-50',
                      '-': 'text-slate-300',
                    };
                    return (
                      <td key={fac.id} className={`p-2 border-r border-slate-200 text-center ${colorMap[score] || ''}`}>
                        {score}
                      </td>
                    );
                  })}
                  <td className="p-2 text-center text-[10px] text-slate-400">
                    -
                  </td>
                </tr>
              ))}

              {/* 시설별 비고 및 시설팀 연락 필요 여부 종합 행 */}
              <tr className="bg-amber-50/40 border-t-2 border-slate-200">
                <td colSpan={2} className="p-2 border-r border-slate-200 font-black text-slate-800 text-center">
                  비고 / 특이사항
                </td>
                {tabFacilities.map(fac => {
                  const rec = recordMap[fac.id];
                  if (!rec) return <td key={fac.id} className="p-2 border-r border-slate-200 text-[10px] text-slate-400">-</td>;
                  return (
                    <td key={fac.id} className="p-2 border-r border-slate-200 text-left text-[10px]">
                      {rec.needsFacilityTeamFix && (
                        <div className="flex items-center gap-0.5 text-rose-700 font-bold mb-0.5">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>시설팀(520) 요청</span>
                        </div>
                      )}
                      {rec.notes ? (
                        <span className="text-slate-700 line-clamp-2" title={rec.notes}>{rec.notes}</span>
                      ) : (
                        <span className="text-slate-400">특이사항 없음</span>
                      )}
                    </td>
                  );
                })}
                <td className="p-2 text-center text-xs font-bold text-amber-900">
                  {tabFacilities.filter(f => recordMap[f.id]?.needsFacilityTeamFix).length}건 이상
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
