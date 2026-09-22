'use client';

import { CheckCircle2, Clock, Download, ExternalLink, Layers, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { PeEvent } from '@/lib/pe/types';
import type { DepartmentTask, TaskSubmission } from '@/lib/types';

export interface EventTaskSubmissionsResult {
  task: DepartmentTask | null;
  submissions: Record<string, TaskSubmission>;
  submittedCount: number;
  totalCount: number;
  percent: number;
  requestedGrades: string[];
}

/**
 * "학년별 세부계획 제출 현황 및 취합 내역" 모달.
 *
 * PeEventManagement.tsx의 Dialog(isSubmissionsViewOpen) 블록을 그대로
 * 옮긴 것으로, 상태와 조회/삭제 로직은 전부 부모(PeEventManagement.tsx)에
 * 남아 있고 이 컴포넌트는 순수하게 마크업만 담당한다 (동작 변경 없음).
 */
export interface PeSubmissionsViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetEventForView: PeEvent | null;
  getEventTaskSubmissions: (ev: PeEvent) => EventTaskSubmissionsResult;
  onDeleteSubmissionItem: (taskId: string, submissionKey: string) => void;
}

export function PeSubmissionsViewDialog({
  open,
  onOpenChange,
  targetEventForView,
  getEventTaskSubmissions,
  onDeleteSubmissionItem,
}: PeSubmissionsViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white shadow-2xl">
        <DialogHeader className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-white shrink-0 sticky top-0 z-20 text-left">
          <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 pr-8">
            <Layers className="w-5 h-5 text-indigo-600 shrink-0" />
            학년별 세부계획 제출 현황 및 취합 내역
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            지정된 학년 담당 교사들이 제출한 타임테이블 시나리오와 자료를 확인하고 정리합니다.
          </DialogDescription>
        </DialogHeader>

        {targetEventForView && (() => {
          const { task, submissions, submittedCount, totalCount, percent, requestedGrades } = getEventTaskSubmissions(targetEventForView);
          if (!task) return <div className="py-6 text-center text-xs text-slate-400">연결된 업무가 없습니다.</div>;

          return (
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700">전체 제출 진행률: {submittedCount}/{totalCount}개 학년 제출 완료</span>
                  <span className="text-indigo-600 font-extrabold">{percent}%</span>
                </div>
                <Progress value={percent} className="h-2 bg-slate-200" />
              </div>

              <div className="space-y-3">
                {requestedGrades.map(grade => {
                  const gradeKey = Object.keys(submissions).find(k => {
                    const s = submissions[k];
                    return String(s.grade) === String(grade) || k.endsWith(`_${grade}`);
                  });
                  const sub = gradeKey ? submissions[gradeKey] : Object.values(submissions).find(s => String(s.grade) === String(grade));

                  return (
                    <div key={grade} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-indigo-600 text-white font-bold text-xs">
                            {grade}학년
                          </Badge>
                          {sub ? (
                            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              제출 완료 (작성: {sub.submitterName || '담당교사'})
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              미제출 (대기 중)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {sub?.fileUrl && (
                            <a
                              href={sub.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 h-6 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors"
                            >
                              <Download className="w-3 h-3 text-indigo-600" />
                              <span>{sub.fileName || '문서 다운'}</span>
                            </a>
                          )}
                          {sub?.linkUrl && (
                            <a
                              href={sub.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 h-6 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-colors"
                            >
                              <ExternalLink className="w-3 h-3 text-purple-600" />
                              <span>{sub.linkTitle || '캔바 자료'}</span>
                            </a>
                          )}
                          {sub && gradeKey && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteSubmissionItem(task.id, gradeKey)}
                              className="h-6 px-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="제출 내역 삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {sub ? (
                        <div className="space-y-2 text-xs">
                          {sub.scenarios && sub.scenarios.length > 0 ? (
                            <div className="border border-slate-100 rounded-lg overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                                  <tr>
                                    <th className="p-1.5 text-center w-24">시간</th>
                                    <th className="p-1.5 text-left">프로그램명</th>
                                    <th className="p-1.5 text-left">경기 규칙</th>
                                    <th className="p-1.5 text-left">준비물/역할</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {sub.scenarios.map((sc, i) => (
                                    <tr key={sc.id || i} className="hover:bg-slate-50/50">
                                      <td className="p-1.5 text-center font-bold text-indigo-700">{sc.time}</td>
                                      <td className="p-1.5 font-bold text-slate-900">{sc.program}</td>
                                      <td className="p-1.5 text-slate-600">{sc.rules || '-'}</td>
                                      <td className="p-1.5 text-slate-600">{sc.preparations || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-slate-400 italic text-[11px]">작성된 시나리오가 없습니다.</p>
                          )}
                          {sub.note && (
                            <p className="text-slate-600 bg-slate-50 p-2 rounded-lg text-[11px]">
                              <strong className="text-slate-800">특이사항:</strong> {sub.note}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="py-2 text-center text-slate-400 text-[11px]">
                          해당 학년의 세부 운영 계획이 아직 제출되지 않았습니다.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 하단 고정 푸터 */}
        <DialogFooter className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50/95 backdrop-blur-xs shrink-0 flex items-center justify-end sticky bottom-0 z-20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
