'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar, Clock, Check, FolderOpen } from 'lucide-react';
import type { HomeroomDailyMemo } from '@/lib/types/homeroomClass';

export function MemoHistoryDialog({
  isMemoHistoryOpen,
  setIsMemoHistoryOpen,
  memoHistoryList,
  isLoadingMemos,
  selectedHistoryMemo,
  setSelectedHistoryMemo,
  todayStr,
  classLabel,
  handleApplyHistoryMemo,
}: {
  isMemoHistoryOpen: boolean;
  setIsMemoHistoryOpen: (open: boolean) => void;
  memoHistoryList: HomeroomDailyMemo[];
  isLoadingMemos: boolean;
  selectedHistoryMemo: HomeroomDailyMemo | null;
  setSelectedHistoryMemo: (memo: HomeroomDailyMemo | null) => void;
  todayStr: string;
  classLabel: string;
  handleApplyHistoryMemo: (memo: HomeroomDailyMemo) => void;
}) {
  return (
    <Dialog open={isMemoHistoryOpen} onOpenChange={setIsMemoHistoryOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden z-[10000]">
        <DialogHeader className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                <span>일자별 칠판 알림장 불러오기</span>
                <Badge variant="outline" className="text-xs bg-white text-emerald-700 border-emerald-200 font-bold">
                  {classLabel}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                이전에 저장된 일자별 알림장/칠판 내용을 확인하고 오늘의 칠판으로 불러옵니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:flex-row min-h-0 divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden">
          {/* 좌측: 일자 목록 */}
          <div className="w-full md:w-64 shrink-0 flex flex-col bg-slate-50/50 p-3 overflow-y-auto max-h-48 md:max-h-none">
            <div className="text-xs font-bold text-slate-500 mb-2 px-1 flex items-center justify-between">
              <span>저장된 날짜 목록</span>
              <span className="text-[11px] font-mono text-emerald-600 font-black">{memoHistoryList.length}건</span>
            </div>

            {isLoadingMemos ? (
              <div className="py-8 text-center text-xs text-slate-400">
                알림장 내역을 불러오는 중...
              </div>
            ) : memoHistoryList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                저장된 알림장 내역이 없습니다.
              </div>
            ) : (
              <div className="space-y-1">
                {memoHistoryList.map((memo) => {
                  const isSelected = selectedHistoryMemo?.date === memo.date;
                  const isToday = memo.date === todayStr;
                  return (
                    <button
                      key={memo.date}
                      type="button"
                      onClick={() => setSelectedHistoryMemo(memo)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Calendar className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                        <span className="font-mono truncate">{memo.date}</span>
                      </div>
                      {isToday && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-extrabold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          오늘
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 우측: 선택된 일자의 알림장 내용 미리보기 */}
          <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-white min-h-0">
            {selectedHistoryMemo ? (
              <div className="flex-1 flex flex-col min-h-0 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-sm text-slate-800">{selectedHistoryMemo.date} 저장 내용</span>
                  </div>
                  {selectedHistoryMemo.updatedAt && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(selectedHistoryMemo.updatedAt).toLocaleString('ko-KR', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-h-[220px] max-h-[380px] overflow-y-auto p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm sm:text-base font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {selectedHistoryMemo.content || '(내용 없음)'}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                좌측에서 조회할 날짜를 선택하세요.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50/50 flex flex-row items-center justify-between sm:justify-end gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMemoHistoryOpen(false)}
            className="text-xs font-bold text-slate-600"
          >
            닫기
          </Button>
          <Button
            size="sm"
            disabled={!selectedHistoryMemo}
            onClick={() => selectedHistoryMemo && handleApplyHistoryMemo(selectedHistoryMemo)}
            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>선택한 날짜 내용으로 불러오기</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
