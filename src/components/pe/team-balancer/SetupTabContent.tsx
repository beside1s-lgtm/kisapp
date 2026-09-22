'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, BarChart2, SlidersHorizontal, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Student, MeasurementItem } from '@/lib/pe/types';

export type ClassSelection = {
  [grade: string]: {
    all: boolean;
    classes: {
      [classNum: string]: boolean;
    };
  };
};

export function SetupTabContent({
  targetStudents,
  grades,
  classSelection,
  setClassSelection,
  classNumsByGrade,
  sportsClubs,
  clubSelection,
  setClubSelection,
  groupedItems,
  setSelectedItemNames,
  uniqueItems,
  selectedItemNames,
  selectedGender,
  setSelectedGender,
  balancingStrategy,
  setBalancingStrategy,
  divideBy,
  setDivideBy,
  numTeams,
  setNumTeams,
  membersPerTeam,
  setMembersPerTeam,
  excludeNonParticipants,
  setExcludeNonParticipants,
  handleBalanceTeams,
}: {
  targetStudents: Student[];
  grades: string[];
  classSelection: ClassSelection;
  setClassSelection: (val: ClassSelection) => void;
  classNumsByGrade: Record<string, string[]>;
  sportsClubs: { id: string; name: string }[];
  clubSelection: Record<string, boolean>;
  setClubSelection: (val: Record<string, boolean>) => void;
  groupedItems: Record<string, MeasurementItem[]>;
  setSelectedItemNames: React.Dispatch<React.SetStateAction<string[]>>;
  uniqueItems: MeasurementItem[];
  selectedItemNames: string[];
  selectedGender: "all" | "남" | "여" | "separate";
  setSelectedGender: (val: any) => void;
  balancingStrategy: 'balanced' | 'by-ability' | 'random';
  setBalancingStrategy: (val: any) => void;
  divideBy: "teams" | "members" | "single";
  setDivideBy: (val: any) => void;
  numTeams: number;
  setNumTeams: (val: number) => void;
  membersPerTeam: number;
  setMembersPerTeam: (val: number) => void;
  excludeNonParticipants: boolean;
  setExcludeNonParticipants: (val: boolean) => void;
  handleBalanceTeams: () => void;
}) {
  return (
    <div className="w-full h-full overflow-y-auto overscroll-contain p-2 sm:p-3 space-y-2.5">
      {/* 카드 1: 대상 학년 & 반 선택 */}
      <div className="p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-black text-slate-800 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            1. 대상 학급 및 클럽 선택
          </Label>
          <Badge variant="outline" className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border-indigo-200">
            선택 대상 {targetStudents.length}명
          </Badge>
        </div>

        {/* 학년 및 반 칩 목록 */}
        <div className="space-y-1.5 pt-1">
          {grades.map((grade) => {
            const isGradeAll = classSelection[grade]?.all || false;
            return (
              <div key={grade} className="p-1.5 bg-slate-50 rounded-lg border border-slate-200/60 flex flex-col sm:flex-row sm:items-center gap-1.5">
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...classSelection };
                      const newVal = !isGradeAll;
                      next[grade].all = newVal;
                      Object.keys(next[grade].classes).forEach((cn) => (next[grade].classes[cn] = newVal));
                      setClassSelection(next);
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-black transition-all",
                      isGradeAll
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    {grade}학년 전체
                  </button>
                </div>
                <div className="flex items-center gap-1 flex-wrap pl-1">
                  {classNumsByGrade[grade]?.map((classNum) => {
                    const isChecked = classSelection[grade]?.classes[classNum] || false;
                    return (
                      <button
                        key={classNum}
                        type="button"
                        onClick={() => {
                          const next = { ...classSelection };
                          next[grade].classes[classNum] = !isChecked;
                          next[grade].all = Object.values(next[grade].classes).every(Boolean);
                          setClassSelection(next);
                        }}
                        className={cn(
                          "px-2 py-0.5 rounded text-[11px] font-bold transition-all",
                          isChecked
                            ? "bg-indigo-100 border border-indigo-300 text-indigo-900"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {classNum}반
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* 스포츠 클럽 선택 */}
          {sportsClubs.length > 0 && (
            <div className="pt-1 flex items-center gap-1 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 mr-1">스포츠클럽:</span>
              {sportsClubs.map((club) => {
                const isChecked = clubSelection[club.id] || false;
                return (
                  <button
                    key={club.id}
                    type="button"
                    onClick={() => setClubSelection({ ...clubSelection, [club.id]: !isChecked })}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-bold transition-all",
                      isChecked
                        ? "bg-amber-100 border border-amber-300 text-amber-900"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {club.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 카드 2: 밸런스 기준 종목 선택 */}
      <div className="p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-black text-slate-800 flex items-center gap-1">
            <BarChart2 className="w-3.5 h-3.5 text-indigo-600" />
            2. 밸런스 기준 종목 (다중 선택)
          </Label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const papsItems = (groupedItems['PAPS'] || []).map((i) => i.name);
                setSelectedItemNames(papsItems);
              }}
              className="text-[10px] font-bold text-indigo-600 hover:underline px-1"
            >
              PAPS만
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setSelectedItemNames(uniqueItems.map((i) => i.name))}
              className="text-[10px] font-bold text-indigo-600 hover:underline px-1"
            >
              전체선택
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setSelectedItemNames([])}
              className="text-[10px] font-bold text-slate-500 hover:underline px-1"
            >
              해제
            </button>
          </div>
        </div>

        {/* 종목 태그 칩 */}
        <div className="flex flex-wrap gap-1 pt-1 max-h-32 overflow-y-auto scrollbar-thin">
          {uniqueItems.map((item) => {
            const isSelected = selectedItemNames.includes(item.name);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  setSelectedItemNames((prev) =>
                    isSelected ? prev.filter((n) => n !== item.name) : [...prev, item.name]
                  )
                }
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1",
                  isSelected
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
              >
                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 카드 3: 상세 필터 및 편성 옵션 */}
      <div className="p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
        <Label className="text-xs font-black text-slate-800 flex items-center gap-1">
          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
          3. 편성 방식 및 필터 옵션
        </Label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {/* 성별 구분 */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500">성별 옵션</span>
            <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 rounded-lg">
              {[
                { id: 'all', label: '혼성' },
                { id: 'separate', label: '성별분리' },
                { id: '남', label: '남학생만' },
                { id: '여', label: '여학생만' },
              ].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGender(g.id as any)}
                  className={cn(
                    "py-1 text-[10px] font-bold rounded transition-all text-center",
                    selectedGender === g.id
                      ? "bg-white text-indigo-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* 밸런스 기준 */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500">편성 로직</span>
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-lg">
              {[
                { id: 'balanced', label: '균등 실력' },
                { id: 'by-ability', label: '실력순' },
                { id: 'random', label: '무작위' },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBalancingStrategy(b.id as any)}
                  className={cn(
                    "py-1 text-[10px] font-bold rounded transition-all text-center",
                    balancingStrategy === b.id
                      ? "bg-white text-indigo-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* 팀 수 / 팀당 인원 기준 */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500">나누는 기준</span>
            <div className="flex items-center gap-1">
              <Select value={divideBy} onValueChange={(v) => setDivideBy(v as any)}>
                <SelectTrigger className="h-7 text-xs font-bold bg-slate-50 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teams" className="text-xs">팀 수 기준</SelectItem>
                  <SelectItem value="members" className="text-xs">팀당 인원 기준</SelectItem>
                </SelectContent>
              </Select>
              {divideBy === 'teams' ? (
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    type="number"
                    value={numTeams}
                    onChange={(e) => setNumTeams(Math.max(2, parseInt(e.target.value) || 2))}
                    className="w-16 h-7 text-xs font-bold text-center"
                    min={2}
                  />
                  <span className="text-[11px] font-bold text-slate-600">개 팀</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    type="number"
                    value={membersPerTeam}
                    onChange={(e) => setMembersPerTeam(Math.max(2, parseInt(e.target.value) || 2))}
                    className="w-16 h-7 text-xs font-bold text-center"
                    min={2}
                  />
                  <span className="text-[11px] font-bold text-slate-600">명씩</span>
                </div>
              )}
            </div>
          </div>

          {/* 기록 없는 학생 제외 스위치 */}
          <div className="flex items-center gap-2 pt-3 sm:pt-4">
            <Checkbox
              id="ex-non"
              checked={excludeNonParticipants}
              onCheckedChange={(c) => setExcludeNonParticipants(!!c)}
            />
            <Label htmlFor="ex-non" className="text-[11px] font-bold text-slate-700 cursor-pointer">
              측정 기록 없는 학생 제외
            </Label>
          </div>
        </div>
      </div>

      {/* 실행 버튼 */}
      <div className="pt-1">
        <Button
          id="btn-auto-balance-bottom"
          onClick={handleBalanceTeams}
          disabled={targetStudents.length === 0 || selectedItemNames.length === 0}
          className="w-full h-10 text-xs font-black bg-indigo-700 hover:bg-indigo-800 text-white shadow-md flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>선택된 조건으로 팀 편성 실행 ({targetStudents.length}명 대상)</span>
        </Button>
      </div>
    </div>
  );
}
