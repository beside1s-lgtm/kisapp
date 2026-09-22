'use client';

import { cn } from "@/lib/utils";

// ─── 순수 SVG 막대 차트 컴포넌트 ─────────────────────────────────────
export function OvertimeBarChart({ data }: { data: { month: string; hours: number }[] }) {
  const maxHours = Math.max(...data.map(d => d.hours), 1);
  const totalHours = parseFloat(data.reduce((s, d) => s + d.hours, 0).toFixed(1));
  const activeMonths = data.filter(d => d.hours > 0).length;

  // 현재 월까지만 표시 (미래 달은 0으로 두되, 회색으로)
  const currentMonth = new Date().getMonth(); // 0-based

  return (
    <div className="space-y-3">
      {/* 요약 수치 */}
      <div className="flex items-center gap-6 flex-wrap">
        <div>
          <span className="text-2xl font-black text-violet-600">{totalHours}</span>
          <span className="text-sm text-muted-foreground ml-1">시간 (연누계)</span>
        </div>
        <div>
          <span className="text-lg font-bold text-violet-400">{activeMonths}</span>
          <span className="text-sm text-muted-foreground ml-1">개월 실적</span>
        </div>
        {activeMonths > 0 && (
          <div>
            <span className="text-lg font-bold text-violet-400">
              {parseFloat((totalHours / activeMonths).toFixed(1))}
            </span>
            <span className="text-sm text-muted-foreground ml-1">시간/월 평균</span>
          </div>
        )}
      </div>

      {/* 막대 차트 */}
      <div className="flex items-end gap-1 h-28 w-full">
        {data.map((d, i) => {
          const barHeightPct = maxHours > 0 ? (d.hours / maxHours) * 100 : 0;
          const isFuture = i > currentMonth;
          const isCurrent = i === currentMonth;
          return (
            <div key={d.month} className="flex flex-col items-center gap-1 flex-1 h-full justify-end group relative">
              {/* 툴팁 */}
              {d.hours > 0 && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {d.hours}h
                </div>
              )}
              {/* 막대 */}
              <div
                className={cn(
                  "w-full rounded-t-sm transition-all duration-500",
                  isFuture
                    ? "bg-muted"
                    : isCurrent && d.hours > 0
                    ? "bg-violet-500 ring-2 ring-violet-300"
                    : d.hours > 0
                    ? "bg-violet-400 hover:bg-violet-500"
                    : "bg-muted/50"
                )}
                style={{ height: `${Math.max(barHeightPct, d.hours > 0 ? 4 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* 월 레이블 */}
      <div className="flex gap-1 w-full">
        {data.map((d, i) => (
          <div
            key={d.month}
            className={cn(
              "flex-1 text-center text-[10px] font-medium",
              i === currentMonth ? "text-violet-600 font-bold" : "text-muted-foreground"
            )}
          >
            {d.month.replace('월', '')}
          </div>
        ))}
      </div>
    </div>
  );
}
