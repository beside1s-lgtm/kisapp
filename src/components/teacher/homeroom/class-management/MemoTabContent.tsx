'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Save, FolderOpen, Maximize2 } from 'lucide-react';

export function MemoTabContent({
  todayDisplay,
  memoContent,
  setMemoContent,
  handleSaveMemo,
  handleOpenMemoHistory,
  setIsMemoFullscreenOpen,
}: {
  todayDisplay: string;
  memoContent: string;
  setMemoContent: (val: string) => void;
  handleSaveMemo: () => void;
  handleOpenMemoHistory: () => void;
  setIsMemoFullscreenOpen: (open: boolean) => void;
}) {
  return (
    <Card className="rounded-xl border-slate-200/80 shadow-xs">
      <CardHeader className="p-3 sm:p-5 pb-2.5 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <span>{todayDisplay} 오늘의 알림장</span>
            </CardTitle>
            <CardDescription className="hidden sm:block text-xs text-slate-500">
              교실 빔프로젝터나 전자칠판에 띄워두는 일일 학급 공지사항입니다.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleSaveMemo()}
              className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>저장</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenMemoHistory}
              className="h-8 text-xs font-bold border-emerald-300 text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100/80 gap-1.5 cursor-pointer shadow-xs"
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>불러오기</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsMemoFullscreenOpen(true)}
              className="h-8 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1.5 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>전자칠판 전체화면</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <Textarea
          value={memoContent}
          onChange={(e) => setMemoContent(e.target.value)}
          placeholder="여기를 클릭하여 오늘의 알림장, 숙제, 준비물 및 전달사항을 작성하세요..."
          rows={12}
          className="text-base sm:text-lg font-bold leading-relaxed border-slate-200 focus-visible:ring-emerald-500 resize-y p-4 bg-slate-50/50"
        />
        <p className="text-xs text-slate-400 text-center">
          💡 [전자칠판 전체화면]을 누르면 TV/칠판 전용 대형 폰트 모드로 전환되어 교실 뒤에서도 선명하게 보입니다.
        </p>
      </CardContent>
    </Card>
  );
}
