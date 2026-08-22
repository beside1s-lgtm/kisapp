'use client';

import React from 'react';
import type { DepartmentTask } from '@/lib/types';
import { 
  deleteDepartmentTask, 
  updateDepartmentTaskStatus 
} from '@/lib/services/departmentTaskService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Download, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  FileText, 
  Trash2, 
  ExternalLink,
  Lock,
  MessageSquare
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TaskSubmissionsDialogProps {
  task: DepartmentTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskDeleted?: () => void;
}

export function TaskSubmissionsDialog({
  task,
  open,
  onOpenChange,
  onTaskDeleted
}: TaskSubmissionsDialogProps) {
  const { toast } = useToast();

  if (!task) return null;

  const targetEmails = task.targetEmails || [];
  const submissions = task.submissions || {};
  const submittedCount = Object.keys(submissions).length;
  const totalCount = targetEmails.length;
  const progressPercent = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;

  const handleDelete = async () => {
    if (!confirm('이 업무를 정말 삭제하시겠습니까? (제출된 내역도 함께 삭제됩니다)')) return;
    try {
      await deleteDepartmentTask(task.id);
      toast({ title: '업무 삭제 완료', description: '업무가 성공적으로 삭제되었습니다.' });
      onOpenChange(false);
      onTaskDeleted?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: '삭제 실패', description: err.message });
    }
  };

  const handleToggleStatus = async () => {
    const nextStatus = task.status === 'closed' ? 'active' : 'closed';
    try {
      await updateDepartmentTaskStatus(task.id, nextStatus);
      toast({ 
        title: nextStatus === 'closed' ? '업무 마감 완료' : '업무 재활성화 완료',
        description: nextStatus === 'closed' ? '추가 제출이 마감되었습니다.' : '다시 제출할 수 있습니다.'
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '상태 변경 실패', description: err.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0 h-4 leading-none font-bold">
                {task.creatorDept || '부서 업무'}
              </Badge>
              <Badge variant="outline" className={task.status === 'closed' ? 'bg-slate-100 text-slate-600 text-[10px]' : 'bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]'}>
                {task.status === 'closed' ? '마감됨' : '진행 중'}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleToggleStatus}
                className="h-7 text-xs text-slate-500 hover:text-slate-900 rounded-lg px-2"
              >
                <Lock className="w-3.5 h-3.5 mr-1" />
                {task.status === 'closed' ? '재개' : '마감'}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleDelete}
                className="h-7 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg px-2"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                삭제
              </Button>
            </div>
          </div>

          <DialogTitle className="text-base font-bold text-slate-900 mt-1 leading-snug">
            {task.title} - 제출 현황 및 파일 확인
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 flex items-center gap-3 pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              마감일: <strong>{task.deadline}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              대상: <strong>{totalCount}명</strong>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* 제출 진행률 게이지 바 */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                실시간 제출 현황: {submittedCount} / {totalCount}명 완료
              </span>
              <span className="text-indigo-600 font-extrabold text-sm">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2.5 bg-slate-200" />
          </div>

          {/* 요청 내용 */}
          {task.description && (
            <div className="text-xs text-slate-600 bg-indigo-50/40 border border-indigo-100 p-3 rounded-xl">
              <p className="font-bold text-indigo-950 mb-0.5 text-[11px]">요청 지침 및 안내:</p>
              <div className="whitespace-pre-wrap leading-relaxed">{task.description}</div>
            </div>
          )}

          {/* 대상자별 제출 상세 목록 테이블 */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>교직원별 제출 상태 ({targetEmails.length}명)</span>
              <span className="text-[11px] text-slate-400 font-normal">
                미제출: {totalCount - submittedCount}명
              </span>
            </h4>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
              {targetEmails.map((email) => {
                const emailKey = email.toLowerCase();
                const sub = submissions[emailKey];
                const displayName = task.targetNames?.[emailKey] || email.split('@')[0];

                return (
                  <div key={email} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900">{displayName}</span>
                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">({email})</span>
                        {sub ? (
                          <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0 h-4 leading-none font-bold">
                            ✓ 제출 완료
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[9px] px-1.5 py-0 h-4 leading-none font-semibold">
                            ⏳ 미제출
                          </Badge>
                        )}
                      </div>

                      {/* 제출 파일 및 메모 표시 */}
                      {sub && (
                        <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-slate-600">
                          {sub.submittedAt && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              {new Date(sub.submittedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {sub.note && (
                            <span className="text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[200px]" title={sub.note}>
                              💬 {sub.note}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 파일 다운로드 버튼 (있는 경우) */}
                    <div className="shrink-0">
                      {sub?.fileUrl ? (
                        <a 
                          href={sub.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 h-7 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="truncate max-w-[100px]">{sub.fileName || '문서 다운'}</span>
                        </a>
                      ) : sub ? (
                        <span className="text-[11px] text-emerald-600 font-bold">확인 완료됨</span>
                      ) : (
                        <span className="text-[11px] text-amber-600 font-semibold">대기 중</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t flex items-center justify-end">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 text-xs font-bold rounded-xl"
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
