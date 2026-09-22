'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Edit2, Search } from 'lucide-react';
import type { HomeroomBehaviorRecord } from '@/lib/types/homeroomClass';
import type { MasterStudent } from '@/lib/types/masterStudent';

export function BehaviorTabContent({
  behaviors,
  behaviorSearch,
  setBehaviorSearch,
  students,
  behaviorCountMap,
  handleOpenBehaviorModal,
}: {
  behaviors: HomeroomBehaviorRecord[];
  behaviorSearch: string;
  setBehaviorSearch: (val: string) => void;
  students: MasterStudent[];
  behaviorCountMap: Record<string, number>;
  handleOpenBehaviorModal: (student: MasterStudent) => void;
}) {
  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-xs">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-indigo-600" />
              <span>학생 행동 관찰 기록</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              학생 타일을 클릭하면 오늘 관찰한 행동이나 특이사항을 빠르게 기록할 수 있습니다.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
              누적 {behaviors.length}건 기록됨
            </span>
          </div>
        </div>

        {/* 검색창 */}
        <div className="relative pt-2">
          <Search className="absolute left-3 top-4.5 w-3.5 h-3.5 text-slate-400" />
          <Input
            value={behaviorSearch}
            onChange={(e) => setBehaviorSearch(e.target.value)}
            placeholder="학생 이름 또는 번호 검색..."
            className="pl-8 h-9 text-xs bg-white"
          />
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {students
            .filter((s) => {
              if (!behaviorSearch) return true;
              return (
                s.name.includes(behaviorSearch) ||
                String(s.studentNum || '').includes(behaviorSearch)
              );
            })
            .map((s) => {
              const sid = s.studentId || s.id || '';
              const count = behaviorCountMap[sid] || 0;

              return (
                <button
                  key={sid}
                  onClick={() => handleOpenBehaviorModal(s)}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center relative transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                    count > 0
                      ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950 hover:bg-indigo-100/50'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {count > 0 && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-indigo-600 text-white">
                      {count}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-medium">
                    {s.studentNum ? `${s.studentNum}번` : ''}
                  </span>
                  <span className="text-sm font-extrabold mt-0.5">{s.name}</span>
                  <span className="text-[10px] text-slate-400 mt-1 font-medium">클릭 시 기록</span>
                </button>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
