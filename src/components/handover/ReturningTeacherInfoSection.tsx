'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plane } from 'lucide-react';
import type { HandoverReturningInfo, HandoverServiceYearRow } from '@/lib/types/handover';
import { getServiceSchoolYears, rebuildServiceRows } from '@/lib/handover/returningTeacher';

interface ReturningTeacherInfoSectionProps {
  value: HandoverReturningInfo;
  onChange: (next: HandoverReturningInfo) => void;
  authorName: string;
  authorEmail: string;
  /** 현재 학년도 행 자동 채움용 */
  currentSchoolYear: number;
  currentDepartment?: string;
  currentDuty?: string;
  disabled?: boolean;
}

/**
 * 귀임 교원 인계서 추가 기재 사항: 한국 주소, 한국 원소속(학교명), 재직기간 현황(학년도별 1행)
 */
export function ReturningTeacherInfoSection({
  value,
  onChange,
  authorName,
  authorEmail,
  currentSchoolYear,
  currentDepartment,
  currentDuty,
  disabled,
}: ReturningTeacherInfoSectionProps) {
  const years = getServiceSchoolYears(value.serviceStartDate, value.serviceEndDate);

  const updatePeriod = (patch: Partial<Pick<HandoverReturningInfo, 'serviceStartDate' | 'serviceEndDate'>>) => {
    const next = { ...value, ...patch };
    next.serviceYears = rebuildServiceRows(next.serviceStartDate, next.serviceEndDate, value.serviceYears || [], {
      schoolYear: currentSchoolYear,
      department: currentDepartment,
      duty: currentDuty,
    });
    onChange(next);
  };

  const updateRow = (schoolYear: number, patch: Partial<HandoverServiceYearRow>) => {
    onChange({
      ...value,
      serviceYears: (value.serviceYears || []).map(r => (r.schoolYear === schoolYear ? { ...r, ...patch } : r)),
    });
  };

  const cellInput = 'h-8 text-xs bg-white border-slate-300 px-1.5 text-center';

  return (
    <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
      <div className="flex items-center gap-1.5">
        <Plane className="h-4 w-4 text-sky-700" />
        <span className="text-sm font-extrabold text-sky-900">귀임 교원 기재 사항</span>
        <span className="text-[11px] text-sky-700">
          (조직도에서 귀임 교원으로 지정되어 업무 인계·인수서에 함께 기재됩니다)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-bold text-slate-700">성명 / 이메일</Label>
          <div className="h-9 flex items-center px-2 text-xs rounded-md border border-slate-200 bg-slate-50 text-slate-700">
            {authorName} <span className="ml-1.5 text-slate-500">{authorEmail}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-bold text-slate-700">한국 원소속 (학교명) *</Label>
          <Input
            value={value.koreaOriginalSchool}
            onChange={e => onChange({ ...value, koreaOriginalSchool: e.target.value })}
            placeholder="예: 서울OO초등학교"
            className="h-9 text-xs bg-white border-slate-300"
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label className="text-xs font-bold text-slate-700">한국 주소 *</Label>
          <Input
            value={value.koreaAddress}
            onChange={e => onChange({ ...value, koreaAddress: e.target.value })}
            placeholder="귀국 후 연락 가능한 한국 주소"
            className="h-9 text-xs bg-white border-slate-300"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs font-bold text-slate-700">재직기간 현황 *</Label>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Input
            type="date"
            value={value.serviceStartDate}
            onChange={e => updatePeriod({ serviceStartDate: e.target.value })}
            className="h-8 w-40 text-xs bg-white border-slate-300"
            disabled={disabled}
            aria-label="재직 시작일"
          />
          <span className="text-slate-500">~</span>
          <Input
            type="date"
            value={value.serviceEndDate}
            onChange={e => updatePeriod({ serviceEndDate: e.target.value })}
            className="h-8 w-40 text-xs bg-white border-slate-300"
            disabled={disabled}
            aria-label="재직 종료일"
          />
          <span className="font-bold text-sky-800">{years.length > 0 ? `(${years.length}년)` : ''}</span>
          {years.length === 0 && (
            <span className="text-[11px] text-slate-500">시작일과 종료일을 입력하면 학년도별 입력 칸이 만들어집니다.</span>
          )}
        </div>
      </div>

      {years.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 px-1 py-1.5 w-[11%]">학년도</th>
                <th className="border border-slate-300 px-1 py-1.5 w-[9%]">학년</th>
                <th className="border border-slate-300 px-1 py-1.5 w-[15%]">담임학년-반<br />(전담교과)</th>
                <th className="border border-slate-300 px-1 py-1.5 w-[18%]">소속부서</th>
                <th className="border border-slate-300 px-1 py-1.5">담당 업무명</th>
                <th className="border border-slate-300 px-1 py-1.5 w-[14%]">비고</th>
              </tr>
            </thead>
            <tbody>
              {(value.serviceYears || []).map(row => (
                <tr key={row.schoolYear}>
                  <td className="border border-slate-300 px-1 py-1 text-center font-bold text-slate-700">{row.schoolYear}</td>
                  <td className="border border-slate-300 p-1">
                    <Input value={row.grade} onChange={e => updateRow(row.schoolYear, { grade: e.target.value })} placeholder="예: 5" className={cellInput} disabled={disabled} />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <Input value={row.homeroom} onChange={e => updateRow(row.schoolYear, { homeroom: e.target.value })} placeholder="예: 4 / 영어전담" className={cellInput} disabled={disabled} />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <Input value={row.department} onChange={e => updateRow(row.schoolYear, { department: e.target.value })} placeholder="예: 교무기획부" className={cellInput} disabled={disabled} />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <Input value={row.duty} onChange={e => updateRow(row.schoolYear, { duty: e.target.value })} placeholder="예: 평가" className={cellInput} disabled={disabled} />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <Input value={row.note} onChange={e => updateRow(row.schoolYear, { note: e.target.value })} className={cellInput} disabled={disabled} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
