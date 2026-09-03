'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { createWeeklyProposal } from '@/lib/services/departmentWeeklyScheduleService';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CalendarPlus, 
  Send, 
  Loader2, 
  Building2,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreateWeeklyProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgData?: any;
  userDept?: string;
}

export function CreateWeeklyProposalDialog({
  open,
  onOpenChange,
  orgData,
  userDept
}: CreateWeeklyProposalDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [deptName, setDeptName] = useState('');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 사용자가 속한 부서 목록
  const myDepartments = useMemo(() => {
    if (!orgData?.departments || !profile?.email) return [];
    const emailLower = profile.email.toLowerCase();
    const depts = orgData.departments.filter((d: any) => 
      d.headEmail?.toLowerCase() === emailLower || 
      d.memberEmails?.some((m: string) => m?.toLowerCase() === emailLower)
    );
    return depts.map((d: any) => d.name);
  }, [orgData, profile]);

  const allDepartments = useMemo(() => {
    return (orgData?.departments || []).map((d: any) => d.name);
  }, [orgData]);

  useEffect(() => {
    if (open) {
      if (myDepartments.length > 0) {
        setDeptName(myDepartments[0]);
      } else if (userDept) {
        setDeptName(userDept);
      } else if (allDepartments.length > 0) {
        setDeptName(allDepartments[0]);
      } else {
        setDeptName('소속 부서');
      }
    }
  }, [open, myDepartments, userDept, allDepartments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '제안할 일정/업무 제목을 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createWeeklyProposal({
        deptName: deptName || '소속 부서',
        submitterEmail: profile?.email || '',
        submitterName: profile?.name || '교사',
        title: title.trim(),
        startDate,
        endDate: endDate >= startDate ? endDate : startDate,
        content: content.trim()
      });

      if (res.success) {
        toast({ 
          title: '주간 일정 제안 전달 완료', 
          description: `부장님께 '${title}' 일정 제안이 정상적으로 전달되었습니다.` 
        });
        setTitle('');
        setContent('');
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: '제안 실패', description: res.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0 flex flex-col overflow-hidden rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b shrink-0 bg-slate-50/80">
          <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-900">
            <CalendarPlus className="w-5 h-5 text-indigo-600" />
            부장에게 주간 일정 제안
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            이번 주 또는 다음 주 부서 주간 일정에 반영할 업무 내용을 부장님께 제안합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 scrollbar-thin">
            {/* 1. 소속 부서 & 제안 제목 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">소속 부서 *</Label>
                <Select value={deptName} onValueChange={setDeptName}>
                  <SelectTrigger className="h-9 text-xs rounded-xl font-semibold">
                    <SelectValue placeholder="부서 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {allDepartments.length > 0 ? (
                      allDepartments.map((d: string) => (
                        <SelectItem key={d} value={d} className="text-xs font-medium">
                          {d}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="소속 부서" className="text-xs">
                        소속 부서
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">일정 / 업무 제목 *</Label>
                <Input 
                  placeholder="예: 3월 방과후 강사 오리엔테이션, 환경 점검 등"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 text-xs rounded-xl font-medium"
                  required
                />
              </div>
            </div>

            {/* 2. 희망 기간 (시작일 ~ 종료일) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">희망 시작일 *</Label>
                <Input 
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate < e.target.value) setEndDate(e.target.value);
                  }}
                  className="h-9 text-xs rounded-xl font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">희망 종료일 *</Label>
                <Input 
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 text-xs rounded-xl font-medium"
                  required
                />
              </div>
            </div>

            {/* 3. 상세 내용 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">상세 업무 내용 및 부장 전달 사항</Label>
              <Textarea 
                placeholder="일정 배경, 대상, 필요 협조 사항 등을 자세히 적어주세요."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                className="text-xs rounded-xl resize-none"
              />
            </div>

            {/* 안내 배너 */}
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-900 text-xs">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                제안된 일정은 부장 교사에게 전달되며, 부장의 검토 후 <strong>[부서 주간 일정으로 승인]</strong> 또는 <strong>[부서내 종결]</strong> 처리됩니다.
              </span>
            </div>
          </div>

          <DialogFooter className="p-3.5 sm:p-4 border-t bg-slate-50/80 shrink-0 flex items-center justify-between sm:justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => onOpenChange(false)}
              className="h-8 px-3.5 text-xs font-bold rounded-xl"
            >
              취소
            </Button>
            <Button 
              type="submit" 
              size="sm" 
              disabled={isSubmitting}
              className="h-8 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  전송 중...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                  부장에게 제안 전달
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
