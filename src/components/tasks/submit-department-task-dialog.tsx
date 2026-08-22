'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { DepartmentTask, TaskSubmission } from '@/lib/types';
import { 
  uploadTaskSubmissionFile, 
  submitDepartmentTaskResponse 
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  FileUp, 
  Paperclip, 
  CheckCircle2, 
  Calendar, 
  User, 
  Loader2, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SubmitDepartmentTaskDialogProps {
  task: DepartmentTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmitDepartmentTaskDialog({
  task,
  open,
  onOpenChange
}: SubmitDepartmentTaskDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!task) return null;

  const myEmail = profile?.email?.toLowerCase() || '';
  const existingSubmission = task.submissions?.[myEmail];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (task.taskType === 'file_submission' && !selectedFile && !existingSubmission?.fileUrl) {
      toast({ variant: 'destructive', title: '파일 필요', description: '제출할 첨부 파일을 선택해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      let fileUrl = existingSubmission?.fileUrl;
      let fileName = existingSubmission?.fileName;

      if (selectedFile) {
        const uploadRes = await uploadTaskSubmissionFile(task.id, myEmail, selectedFile);
        if (!uploadRes.success) {
          toast({ variant: 'destructive', title: '업로드 실패', description: uploadRes.error });
          setIsSubmitting(false);
          return;
        }
        fileUrl = uploadRes.fileUrl;
        fileName = uploadRes.fileName;
      }

      const submission: TaskSubmission = {
        submitterEmail: myEmail,
        submitterName: profile?.name || '교직원',
        submittedAt: new Date().toISOString(),
        status: 'submitted',
        fileUrl,
        fileName,
        note: note.trim()
      };

      const res = await submitDepartmentTaskResponse(task.id, submission);
      if (res.success) {
        toast({ 
          title: '업무 제출 완료', 
          description: `'${task.title}' 업무가 정상적으로 제출되었습니다.` 
        });
        setSelectedFile(null);
        setNote('');
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: '제출 실패', description: res.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 sm:p-6">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0 h-4 leading-none font-bold">
              {task.creatorDept || '부서 요청'}
            </Badge>
            {existingSubmission && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] px-1.5 py-0 h-4">
                제출 완료됨 (재제출 가능)
              </Badge>
            )}
          </div>
          <DialogTitle className="text-base font-bold text-slate-900 mt-1 leading-snug">
            {task.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 flex items-center gap-3 pt-1">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              요청자: <strong>{task.creatorName}</strong>
            </span>
            <span className="flex items-center gap-1 text-rose-600 font-semibold">
              <Calendar className="w-3.5 h-3.5" />
              마감: {task.deadline}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 요청 상세 내용 안내 */}
          {task.description && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
              <p className="font-bold text-slate-900 mb-1 flex items-center gap-1 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 text-indigo-600" />
                요청 내용 및 안내:
              </p>
              <div className="whitespace-pre-wrap">{task.description}</div>
            </div>
          )}

          {/* 파일 제출형인 경우 파일 선택 */}
          {task.taskType === 'file_submission' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>제출할 문서/파일 첨부 *</span>
                {existingSubmission?.fileName && (
                  <span className="text-[10px] text-slate-400 font-normal truncate max-w-[180px]">
                    기존: {existingSubmission.fileName}
                  </span>
                )}
              </Label>
              <div className="border-2 border-dashed border-indigo-200 rounded-xl p-4 text-center bg-indigo-50/30 hover:bg-indigo-50/60 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  id="task-file-upload"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <FileUp className="w-4 h-4" />
                  </div>
                  {selectedFile ? (
                    <div>
                      <p className="text-xs font-bold text-indigo-900 truncate max-w-[260px]">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB (클릭하여 변경)</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-slate-700">이곳을 클릭하여 파일 선택</p>
                      <p className="text-[10px] text-slate-400">PDF, HWP, XLSX, Word, 이미지 파일 지원</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 메모 또는 의견 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">제출 메모 / 의견 (선택)</Label>
            <Textarea 
              placeholder="요청자에게 전달할 메모나 비고사항이 있다면 작성해주세요."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="text-xs rounded-xl resize-none"
            />
          </div>

          <DialogFooter className="pt-2 border-t flex items-center justify-between sm:justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 text-xs font-bold rounded-xl"
            >
              닫기
            </Button>
            <Button 
              type="submit" 
              size="sm" 
              disabled={isSubmitting}
              className="h-9 px-5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  제출 중...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                  {existingSubmission ? '수정하여 다시 제출' : '업무 제출 완료하기'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
