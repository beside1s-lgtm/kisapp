'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { DepartmentTask, TargetGroupType, TaskType } from '@/lib/types';
import { createDepartmentTask } from '@/lib/services/departmentTaskService';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ClipboardList, 
  Users, 
  Building2, 
  GraduationCap, 
  Calendar, 
  FileUp, 
  CheckCircle2, 
  Loader2, 
  Sparkles,
  Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreateDepartmentTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgData?: any;
  allTeachers?: Array<{ email: string; name: string; dept?: string }>;
}

export function CreateDepartmentTaskDialog({
  open,
  onOpenChange,
  orgData,
  allTeachers = []
}: CreateDepartmentTaskDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<TargetGroupType>('dept');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('1학년');
  const [selectedCustomEmails, setSelectedCustomEmails] = useState<string[]>([]);
  const [taskType, setTaskType] = useState<TaskType>('file_submission');
  const [deadline, setDeadline] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // User's department list from orgData
  const myDepartments = useMemo(() => {
    if (!orgData?.departments || !profile?.email) return [];
    const emailLower = profile.email.toLowerCase();
    return orgData.departments.filter((d: any) => 
      d.headEmail?.toLowerCase() === emailLower || 
      d.memberEmails?.some((m: string) => m?.toLowerCase() === emailLower)
    );
  }, [orgData, profile]);

  // Available departments in school
  const allDepartments = useMemo(() => {
    return (orgData?.departments || []).map((d: any) => d.name);
  }, [orgData]);

  // Set default selected dept when opened
  React.useEffect(() => {
    if (myDepartments.length > 0 && !selectedDept) {
      setSelectedDept(myDepartments[0].name);
    } else if (allDepartments.length > 0 && !selectedDept) {
      setSelectedDept(allDepartments[0]);
    }
  }, [myDepartments, allDepartments, selectedDept]);

  // Calculate target recipients
  const targetRecipients = useMemo(() => {
    const emailToNameMap: { [email: string]: string } = {};
    (allTeachers || []).forEach(t => {
      if (t.email) emailToNameMap[t.email.toLowerCase()] = t.name;
    });

    if (targetType === 'all') {
      const list = allTeachers.map(t => t.email.toLowerCase());
      return { emails: Array.from(new Set(list)), names: emailToNameMap };
    }

    if (targetType === 'dept' && selectedDept && orgData?.departments) {
      const deptObj = orgData.departments.find((d: any) => d.name === selectedDept);
      if (deptObj) {
        const emails = new Set<string>();
        if (deptObj.headEmail) emails.add(deptObj.headEmail.toLowerCase());
        (deptObj.memberEmails || []).forEach((m: string) => {
          if (m) emails.add(m.toLowerCase());
        });
        return { emails: Array.from(emails), names: emailToNameMap };
      }
    }

    if (targetType === 'grade' && selectedGrade && orgData?.homerooms) {
      const emails = new Set<string>();
      // Find all homeroom teachers in this grade (e.g. 1-1, 1-2, 1-3)
      Object.entries(orgData.homerooms).forEach(([gc, email]) => {
        if (gc.startsWith(selectedGrade.replace('학년', '')) && email) {
          emails.add((email as string).toLowerCase());
        }
      });
      // Also check grade head
      if (orgData.gradeHeads?.[selectedGrade]) {
        emails.add(orgData.gradeHeads[selectedGrade].toLowerCase());
      }
      return { emails: Array.from(emails), names: emailToNameMap };
    }

    if (targetType === 'custom') {
      return { emails: selectedCustomEmails.map(e => e.toLowerCase()), names: emailToNameMap };
    }

    return { emails: [], names: emailToNameMap };
  }, [targetType, selectedDept, selectedGrade, selectedCustomEmails, allTeachers, orgData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '업무 제목을 입력해주세요.' });
      return;
    }
    if (targetRecipients.emails.length === 0) {
      toast({ variant: 'destructive', title: '대상 오류', description: '업무를 할당할 대상 교직원이 1명 이상이어야 합니다.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createDepartmentTask({
        title: title.trim(),
        description: description.trim(),
        creatorEmail: profile?.email || '',
        creatorName: profile?.name || '교직원',
        creatorDept: selectedDept || profile?.dept || '소속',
        targetType,
        targetDept: targetType === 'dept' ? selectedDept : undefined,
        targetGrade: targetType === 'grade' ? selectedGrade : undefined,
        targetEmails: targetRecipients.emails,
        targetNames: targetRecipients.names,
        taskType,
        deadline,
        status: 'active'
      });

      if (res.success) {
        toast({ title: '업무 생성 완료', description: `총 ${targetRecipients.emails.length}명에게 업무가 할당되었습니다.` });
        setTitle('');
        setDescription('');
        setSelectedCustomEmails([]);
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: '생성 실패', description: res.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCustomEmail = (email: string) => {
    setSelectedCustomEmails(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            새 부서 / 학년 업무 요청 생성
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            소속 부서원 또는 학년 교사들에게 파일 제출 및 확인 업무를 생성하고 할당합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 1. 업무 제목 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">업무 제목 *</Label>
            <Input 
              placeholder="예: 2026학년도 1학기 방과후 지도계획서 제출, 3월 환경구성 점검 등"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 text-sm rounded-xl font-medium"
              required
            />
          </div>

          {/* 2. 대상 그룹 선택 */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700">업무 할당 대상 그룹 *</Label>
            <RadioGroup 
              value={targetType} 
              onValueChange={(v) => setTargetType(v as TargetGroupType)}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            >
              <div className="flex items-center space-x-1.5 p-2.5 rounded-xl border bg-slate-50/70 hover:bg-indigo-50/50 cursor-pointer">
                <RadioGroupItem value="dept" id="tg-dept" />
                <Label htmlFor="tg-dept" className="text-xs font-semibold cursor-pointer">소속 부서원</Label>
              </div>
              <div className="flex items-center space-x-1.5 p-2.5 rounded-xl border bg-slate-50/70 hover:bg-indigo-50/50 cursor-pointer">
                <RadioGroupItem value="grade" id="tg-grade" />
                <Label htmlFor="tg-grade" className="text-xs font-semibold cursor-pointer">학년 교사</Label>
              </div>
              <div className="flex items-center space-x-1.5 p-2.5 rounded-xl border bg-slate-50/70 hover:bg-indigo-50/50 cursor-pointer">
                <RadioGroupItem value="all" id="tg-all" />
                <Label htmlFor="tg-all" className="text-xs font-semibold cursor-pointer">전체 교직원</Label>
              </div>
              <div className="flex items-center space-x-1.5 p-2.5 rounded-xl border bg-slate-50/70 hover:bg-indigo-50/50 cursor-pointer">
                <RadioGroupItem value="custom" id="tg-custom" />
                <Label htmlFor="tg-custom" className="text-xs font-semibold cursor-pointer">직접 선택</Label>
              </div>
            </RadioGroup>

            {/* Sub-selectors */}
            {targetType === 'dept' && (
              <div className="pt-1.5">
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="부서 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {allDepartments.map((d: string) => (
                      <SelectItem key={d} value={d} className="text-xs font-medium">
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetType === 'grade' && (
              <div className="pt-1.5">
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="학년 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {['1학년', '2학년', '3학년', '4학년', '5학년', '6학년'].map((g) => (
                      <SelectItem key={g} value={g} className="text-xs font-medium">
                        {g} 담임 및 부장
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetType === 'custom' && (
              <div className="border rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1.5 bg-slate-50/50 text-xs">
                {allTeachers.map((t) => (
                  <div 
                    key={t.email}
                    onClick={() => toggleCustomEmail(t.email)}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-indigo-50/60 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={selectedCustomEmails.includes(t.email)}
                        onCheckedChange={() => toggleCustomEmail(t.email)}
                      />
                      <span className="font-semibold text-slate-800">{t.name}</span>
                      <span className="text-[11px] text-slate-400">({t.dept || '교직원'})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recipient summary badge */}
            <div className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50/80 p-2 rounded-xl font-medium">
              <Users className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>할당 대상: <strong>총 {targetRecipients.emails.length}명</strong>의 교직원이 업무를 부여받습니다.</span>
            </div>
          </div>

          {/* 3. 업무 처리 유형 (파일 제출 vs 확인 완료) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">업무 해결 방식 *</Label>
              <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
                <SelectTrigger className="h-10 text-xs rounded-xl font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="file_submission" className="text-xs font-medium">
                    📁 문서 / 파일 제출형 (버튼으로 파일 업로드)
                  </SelectItem>
                  <SelectItem value="acknowledgment" className="text-xs font-medium">
                    ✓ 확인 완료형 (내용 확인 후 원클릭 체크)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 4. 마감 기한 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">마감 일시 *</Label>
              <Input 
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="h-10 text-xs rounded-xl font-medium"
                required
              />
            </div>
          </div>

          {/* 5. 세부 내용 및 설명 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">상세 요청 내용 및 제출 안내</Label>
            <Textarea 
              placeholder="제출할 서식 양식, 주의사항, 검토 요청 내용 등을 자세히 적어주세요."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
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
              취소
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
                  업무 생성 중...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  업무 할당 및 요청 생성
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
