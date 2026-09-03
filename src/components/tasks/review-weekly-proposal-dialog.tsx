'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { DepartmentWeeklyProposal } from '@/lib/types';
import { reviewWeeklyProposal, deleteWeeklyProposal } from '@/lib/services/departmentWeeklyScheduleService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircle2, 
  Calendar, 
  CalendarDays, 
  Share2, 
  Eye, 
  Lock, 
  User, 
  Loader2, 
  Trash2, 
  XCircle, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ReviewWeeklyProposalDialogProps {
  proposal: DepartmentWeeklyProposal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReviewWeeklyProposalDialog({
  proposal,
  open,
  onOpenChange
}: ReviewWeeklyProposalDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [content, setContent] = useState('');
  const [isWeeklyEvent, setIsWeeklyEvent] = useState(true);
  const [isWeeklyDeptContent, setIsWeeklyDeptContent] = useState(true);
  const [isMonthlySchedule, setIsMonthlySchedule] = useState(true);
  const [sendToAcademicCalendar, setSendToAcademicCalendar] = useState(false);
  const [syncTargetType, setSyncTargetType] = useState<import('@/lib/types').CalendarSyncTargetType>('all');
  const [syncTargetGrade, setSyncTargetGrade] = useState('1학년');
  const [isMainSchoolSchedule, setIsMainSchoolSchedule] = useState(true);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (proposal && open) {
      setTitle(proposal.title || '');
      setStartDate(proposal.startDate || new Date().toISOString().split('T')[0]);
      setEndDate(proposal.endDate || proposal.startDate || new Date().toISOString().split('T')[0]);
      setContent(proposal.content || '');
      setIsWeeklyEvent(proposal.isWeeklyEvent !== false);
      setIsWeeklyDeptContent(proposal.isWeeklyDeptContent !== false);
      setIsMonthlySchedule(proposal.isMonthlySchedule !== false);
      setSendToAcademicCalendar(false);
      setSyncTargetType('all');
      setIsMainSchoolSchedule(true);
      setReviewComment(proposal.reviewComment || '');
    }
  }, [proposal, open]);

  if (!proposal) return null;

  const handleDecision = async (decision: 'approved' | 'closed_internal' | 'rejected') => {
    if (!title.trim()) {
      toast({ variant: 'destructive', title: '제목 필요', description: '일정 제목을 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await reviewWeeklyProposal(
        proposal.id,
        decision,
        {
          deptName: proposal.deptName,
          title: title.trim(),
          startDate,
          endDate,
          content: content.trim(),
          isWeeklyEvent: decision === 'approved' ? isWeeklyEvent : false,
          isWeeklyDeptContent: decision === 'approved' ? isWeeklyDeptContent : false,
          isMonthlySchedule: decision === 'approved' ? isMonthlySchedule : false,
          sendToAcademicCalendar: decision === 'approved' ? sendToAcademicCalendar : false,
          syncTargetType: (decision === 'approved' && sendToAcademicCalendar) ? syncTargetType : undefined,
          syncTargetGrade: (decision === 'approved' && sendToAcademicCalendar && syncTargetType === 'grade') ? syncTargetGrade : undefined,
          isMainSchoolSchedule: decision === 'approved' ? isMainSchoolSchedule : false,
          reviewComment: reviewComment.trim(),
          reviewerName: profile?.name || '부장',
          reviewerEmail: profile?.email || ''
        }
      );

      if (res.success) {
        const msg = decision === 'approved' 
          ? '주간 일정으로 승인 및 반영되었습니다.' 
          : decision === 'closed_internal' 
            ? '부서내 자체 종결 업무로 처리되었습니다.' 
            : '제안이 반려 처리되었습니다.';
        toast({ title: '검토 완료', description: msg });
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: '처리 실패', description: res.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('이 제안을 정말 삭제하시겠습니까?')) return;
    try {
      await deleteWeeklyProposal(proposal.id);
      toast({ title: '삭제 완료', description: '제안이 삭제되었습니다.' });
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: '삭제 실패', description: err.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] p-0 flex flex-col overflow-hidden rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b shrink-0 bg-slate-50/80">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0 font-bold">
                {proposal.deptName}
              </Badge>
              <Badge variant="outline" className={cn(
                "text-[10px] font-bold px-1.5 py-0",
                proposal.status === 'approved' ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                proposal.status === 'closed_internal' ? "bg-amber-50 text-amber-700 border-amber-300" :
                proposal.status === 'rejected' ? "bg-rose-50 text-rose-700 border-rose-300" :
                "bg-blue-50 text-blue-700 border-blue-300"
              )}>
                {proposal.status === 'approved' ? '승인 반영됨' :
                 proposal.status === 'closed_internal' ? '부서내 종결' :
                 proposal.status === 'rejected' ? '반려됨' : '검토 대기중'}
              </Badge>
            </div>

            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={handleDelete}
              className="h-7 text-xs text-slate-400 hover:text-rose-600 px-2"
              title="제안 삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-900 mt-1">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            부서원 주간 일정 제안 검토
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            <strong>{proposal.submitterName}</strong> 선생님이 제안한 주간 업무 내용을 검토하고 부서 일정 반영 또는 부서내 종결을 결정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 scrollbar-thin">
          {/* 제안 기본 정보 요약 박스 */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                제안자: {proposal.submitterName} ({proposal.submitterEmail})
              </span>
              <span className="text-[11px] text-slate-400">
                제안일: {proposal.createdAt?.split('T')[0]}
              </span>
            </div>
            {proposal.content && (
              <div className="pt-1.5 border-t text-slate-700 bg-white/80 p-2 rounded-lg leading-relaxed">
                <span className="font-bold text-slate-800">[제안 전달 내용]</span>
                <p className="mt-0.5 whitespace-pre-wrap">{proposal.content}</p>
              </div>
            )}
          </div>

          {/* 부장 편집 영역: 일정명 & 기간 */}
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">반영할 일정 제목 *</Label>
              <Input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                className="h-9 text-xs rounded-xl font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">시작일 *</Label>
                <Input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="h-9 text-xs rounded-xl font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">종료일 *</Label>
                <Input 
                  type="date" 
                  value={endDate} 
                  min={startDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="h-9 text-xs rounded-xl font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">상세 내용 및 검토 비고</Label>
              <Textarea 
                value={content} 
                onChange={(e) => setContent(e.target.value)} 
                rows={2} 
                className="text-xs rounded-xl resize-none"
              />
            </div>

            {/* 승인 시 공유 범위 설정 */}
            <div className="space-y-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-xs">
              <span className="font-bold text-indigo-950 flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                [부서 주간 일정 승인 시] 공유 범위 선택
              </span>

              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox 
                    checked={isWeeklyEvent} 
                    onCheckedChange={(c) => setIsWeeklyEvent(!!c)} 
                    className="mt-0.5"
                  />
                  <span className="font-semibold text-slate-800">
                    주간 행사에 반영 (주간교육계획 상단 요일별 칸)
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox 
                    checked={isWeeklyDeptContent} 
                    onCheckedChange={(c) => setIsWeeklyDeptContent(!!c)} 
                    className="mt-0.5"
                  />
                  <span className="font-semibold text-slate-800">
                    주간 교육 내용에 반영 (주간교육계획 부서란)
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox 
                    checked={isMonthlySchedule} 
                    onCheckedChange={(c) => setIsMonthlySchedule(!!c)} 
                    className="mt-0.5"
                  />
                  <span className="font-semibold text-slate-800">
                    월간 교육활동 계획에 반영 (월간계획 자동 취합)
                  </span>
                </label>

                <div className="space-y-1.5 pt-1 border-t border-indigo-200/60">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox 
                      checked={sendToAcademicCalendar} 
                      onCheckedChange={(c) => setSendToAcademicCalendar(!!c)} 
                      className="mt-0.5"
                    />
                    <span className="font-semibold text-slate-800">
                      학사일정으로 전송 (스마트폰/구글 캘린더 동기화)
                    </span>
                  </label>

                  {sendToAcademicCalendar && (
                    <div className="ml-6 p-2 bg-white rounded-lg border border-indigo-200 space-y-1.5">
                      <div className="grid grid-cols-3 gap-1">
                        <label className="flex items-center gap-1 cursor-pointer text-xs p-1 rounded border">
                          <input type="radio" name="revSyncTarget" checked={syncTargetType === 'all'} onChange={() => setSyncTargetType('all')} />
                          <span>전체</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer text-xs p-1 rounded border">
                          <input type="radio" name="revSyncTarget" checked={syncTargetType === 'dept'} onChange={() => setSyncTargetType('dept')} />
                          <span>부서원만</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer text-xs p-1 rounded border">
                          <input type="radio" name="revSyncTarget" checked={syncTargetType === 'grade'} onChange={() => setSyncTargetType('grade')} />
                          <span>특정학년</span>
                        </label>
                      </div>
                      {syncTargetType === 'grade' && (
                        <Select value={syncTargetGrade} onValueChange={setSyncTargetGrade}>
                          <SelectTrigger className="h-6 text-xs">
                            <SelectValue placeholder="학년 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {['유치원', '1학년', '2학년', '3학년', '4학년', '5학년', '6학년', '중등', '전담교사'].map(g => (
                              <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-3.5 sm:p-4 border-t bg-slate-50/80 shrink-0 flex flex-wrap items-center justify-between sm:justify-end gap-2">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => onOpenChange(false)}
            className="h-8 px-3 text-xs font-bold rounded-xl"
          >
            닫기
          </Button>

          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            disabled={isSubmitting}
            onClick={() => handleDecision('rejected')}
            className="h-8 px-3 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl"
          >
            <XCircle className="w-3 h-3 mr-1" />
            반려
          </Button>

          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            disabled={isSubmitting}
            onClick={() => handleDecision('closed_internal')}
            className="h-8 px-3.5 text-xs font-extrabold bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 rounded-xl shadow-2xs"
          >
            <Lock className="w-3 h-3 mr-1 text-amber-700" />
            부서내 자체 종결
          </Button>

          <Button 
            type="button" 
            size="sm" 
            disabled={isSubmitting}
            onClick={() => handleDecision('approved')}
            className="h-8 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-amber-300" />
            )}
            부서 일정으로 승인·반영
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
