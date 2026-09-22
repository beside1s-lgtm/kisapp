'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Search, Download, User, Copy, Sparkles, MessageSquare, Trash2 } from 'lucide-react';
import type { HomeroomBehaviorRecord } from '@/lib/types/homeroomClass';
import type { MasterStudent } from '@/lib/types/masterStudent';

export function ReviewTabContent({
  selectedStudentForReview,
  setSelectedStudentForReview,
  reviewSearch,
  setReviewSearch,
  students,
  behaviorCountMap,
  handleSelectStudentForReview,
  behaviors,
  handleCopyBehaviorRecords,
  handleCopyAIPrompt,
  handleDeleteBehavior,
  consultInput,
  setConsultInput,
  handleSaveConsultMemo,
  handleExportBehaviorExcel,
}: {
  selectedStudentForReview: MasterStudent | null;
  setSelectedStudentForReview: (s: MasterStudent | null) => void;
  reviewSearch: string;
  setReviewSearch: (val: string) => void;
  students: MasterStudent[];
  behaviorCountMap: Record<string, number>;
  handleSelectStudentForReview: (student: MasterStudent) => void;
  behaviors: HomeroomBehaviorRecord[];
  handleCopyBehaviorRecords: (student: MasterStudent) => void;
  handleCopyAIPrompt: (student: MasterStudent) => void;
  handleDeleteBehavior: (recordId: string) => void;
  consultInput: string;
  setConsultInput: (val: string) => void;
  handleSaveConsultMemo: () => void;
  handleExportBehaviorExcel: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500">학생별 누적 관찰 일지 및 상담 이력</span>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportBehaviorExcel}
          className="h-8 text-xs font-bold border-slate-200 text-slate-700 gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>행동 기록 엑셀 다운로드</span>
        </Button>
      </div>

      {!selectedStudentForReview ? (
        /* 학생 선택 그리드 */
        <Card className="rounded-2xl border-slate-200/80 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={reviewSearch}
                onChange={(e) => setReviewSearch(e.target.value)}
                placeholder="학생 이름 또는 번호 검색..."
                className="pl-8 h-8 text-xs bg-white"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
              {students
                .filter((s) => {
                  if (!reviewSearch) return true;
                  return (
                    s.name.includes(reviewSearch) ||
                    String(s.studentNum || '').includes(reviewSearch)
                  );
                })
                .map((s) => {
                  const sid = s.studentId || s.id || '';
                  const count = behaviorCountMap[sid] || 0;

                  return (
                    <button
                      key={sid}
                      onClick={() => handleSelectStudentForReview(s)}
                      className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex flex-col items-center justify-center transition-all cursor-pointer hover:border-indigo-400"
                    >
                      <span className="text-[10px] text-slate-400">{s.studentNum ? `${s.studentNum}번` : ''}</span>
                      <span className="text-sm font-bold text-slate-800">{s.name}</span>
                      <span className="text-[10px] text-indigo-600 font-semibold mt-1">
                        {count > 0 ? `${count}건 기록` : '기록 없음'}
                      </span>
                    </button>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* 선택된 학생 상세 타임라인 & 보호자 상담 메모 분할 뷰 */
        <div className="space-y-4 animate-in fade-in duration-150">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedStudentForReview(null)}
            className="h-8 text-xs font-bold text-slate-600 hover:bg-slate-100 gap-1 cursor-pointer"
          >
            ← 학생 목록으로 돌아가기
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 좌측: 행동 관찰 타임라인 (2열) */}
            <Card className="lg:col-span-2 rounded-2xl border-slate-200/80 shadow-xs">
              <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>
                      {selectedStudentForReview.studentNum ? `${selectedStudentForReview.studentNum}번 ` : ''}
                      {selectedStudentForReview.name} 행동 관찰 일지
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    총{' '}
                    {
                      behaviors.filter(
                        (b) => b.studentId === (selectedStudentForReview.studentId || selectedStudentForReview.id)
                      ).length
                    }
                    건의 관찰 기록이 있습니다.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyBehaviorRecords(selectedStudentForReview)}
                    className="h-7 text-xs font-bold border-slate-200 text-slate-700 gap-1 cursor-pointer"
                    title="기록 전체 텍스트 복사"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>복사</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyAIPrompt(selectedStudentForReview)}
                    className="h-7 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1 cursor-pointer"
                    title="생기부 종합의견 AI 분석용 프롬프트 복사"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI 생기부 프롬프트</span>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                {(() => {
                  const sid = selectedStudentForReview.studentId || selectedStudentForReview.id || '';
                  const studentBehaviors = behaviors
                    .filter((b) => b.studentId === sid)
                    .sort((a, b) => b.date.localeCompare(a.date));

                  if (studentBehaviors.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-400 text-xs">
                        등록된 행동 관찰 기록이 없습니다.
                      </div>
                    );
                  }

                  return studentBehaviors.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-100"
                    >
                      <div className="space-y-1 flex-1">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 inline-block">
                          {b.date}
                        </span>
                        <p className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap mt-1">
                          {b.content}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteBehavior(b.id)}
                        className="h-7 w-7 p-0 text-slate-300 hover:text-rose-600 hover:bg-rose-50 shrink-0 cursor-pointer"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ));
                })()}
              </CardContent>
            </Card>

            {/* 우측: 보호자 상담 메모 (1열) */}
            <Card className="rounded-2xl border-slate-200/80 shadow-xs h-fit">
              <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>보호자 상담 메모</span>
                </CardTitle>
                <Button
                  size="sm"
                  onClick={handleSaveConsultMemo}
                  className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  저장
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <Textarea
                  value={consultInput}
                  onChange={(e) => setConsultInput(e.target.value)}
                  placeholder="학부모 전화 상담, 방문 상담 메모를 자유롭게 입력하세요..."
                  rows={10}
                  className="text-xs leading-relaxed resize-none bg-slate-50/60"
                />
                <p className="text-[11px] text-slate-400">
                  * 학생별로 안전하게 분리 저장되며, 상시 열람 가능합니다.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
