'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Download } from 'lucide-react';
import type { HomeroomHomework, HomeroomHomeworkCheck } from '@/lib/types/homeroomClass';
import type { MasterStudent } from '@/lib/types/masterStudent';

export function MatrixTabContent({
  matrixMonth,
  setMatrixMonth,
  homeworks,
  handleExportHomeworkExcel,
  students,
  homeworkChecks,
}: {
  matrixMonth: string;
  setMatrixMonth: (val: string) => void;
  homeworks: HomeroomHomework[];
  handleExportHomeworkExcel: () => void;
  students: MasterStudent[];
  homeworkChecks: HomeroomHomeworkCheck[];
}) {
  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-xs">
      <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span>월별 숙제 제출 현황표</span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            학생별 과제 제출 현황(O/X)과 전체 완료율을 한눈에 조회하고 엑셀로 내보냅니다.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Select value={matrixMonth} onValueChange={setMatrixMonth}>
            <SelectTrigger className="h-8 text-xs w-[120px] bg-white font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">전체 기간</SelectItem>
              {(() => {
                const months = Array.from(
                  new Set(homeworks.map((h) => (h.date ? h.date.slice(0, 7) : '')).filter(Boolean))
                ).sort().reverse();
                return months.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {m}월
                  </SelectItem>
                ));
              })()}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportHomeworkExcel}
            className="h-8 text-xs font-bold border-slate-200 text-slate-700 gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>엑셀 다운로드</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0 overflow-x-auto">
        {(() => {
          let filteredHws = homeworks;
          if (matrixMonth !== 'all') {
            filteredHws = filteredHws.filter((h) => h.date && h.date.startsWith(matrixMonth));
          }

          if (filteredHws.length === 0) {
            return (
              <div className="p-12 text-center text-xs text-slate-400">
                선택한 기간에 등록된 숙제가 없습니다.
              </div>
            );
          }

          return (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="p-2.5 text-left border-r border-slate-200 min-w-[120px] sticky left-0 bg-slate-50 z-10">
                    학생명
                  </th>
                  {filteredHws.map((hw) => (
                    <th key={hw.id} className="p-2.5 text-center border-r border-slate-200 min-w-[90px]">
                      <div className="font-bold text-slate-800">{hw.title}</div>
                      <div className="text-[10px] font-normal text-slate-400 mt-0.5">{hw.date}</div>
                    </th>
                  ))}
                  <th className="p-2.5 text-center min-w-[80px]">완료율</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, idx) => {
                  const sid = s.studentId || s.id || '';
                  let doneCount = 0;
                  const cells = filteredHws.map((hw) => {
                    const isDone = homeworkChecks.some((c) => c.hwId === hw.id && c.studentId === sid && c.checked);
                    if (isDone) doneCount++;
                    return isDone;
                  });
                  const pct = filteredHws.length > 0 ? Math.round((doneCount / filteredHws.length) * 100) : 0;

                  return (
                    <tr
                      key={sid}
                      className={`border-b border-slate-100 hover:bg-emerald-50/40 transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      }`}
                    >
                      <td className="p-2.5 font-bold border-r border-slate-200 sticky left-0 bg-inherit z-10 text-slate-800">
                        {s.studentNum ? `${s.studentNum}. ` : ''}
                        {s.name}
                      </td>
                      {cells.map((isDone, cIdx) => (
                        <td key={cIdx} className="p-2 text-center border-r border-slate-200">
                          <span
                            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-black ${
                              isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                            }`}
                          >
                            {isDone ? '✓' : '✕'}
                          </span>
                        </td>
                      ))}
                      <td className="p-2 text-center">
                        <span
                          className={`font-black text-xs ${
                            pct === 100
                              ? 'text-emerald-700'
                              : pct >= 80
                              ? 'text-indigo-700'
                              : pct >= 50
                              ? 'text-amber-700'
                              : 'text-rose-600'
                          }`}
                        >
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })()}
      </CardContent>
    </Card>
  );
}
