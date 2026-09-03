'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { DepartmentWeeklySchedule } from '@/lib/types';
import { createDepartmentWeeklySchedule } from '@/lib/services/departmentWeeklyScheduleService';
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
import { Checkbox } from '@/components/ui/checkbox';
import { 
  CalendarDays, 
  Calendar, 
  Building2, 
  Share2, 
  Eye, 
  Lock, 
  Loader2, 
  Plus,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreateWeeklyScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgData?: any;
  userDept?: string;
}

export function CreateWeeklyScheduleDialog({
  open,
  onOpenChange,
  orgData,
  userDept
}: CreateWeeklyScheduleDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [deptName, setDeptName] = useState('');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [content, setContent] = useState('');
  const [isWeeklyEvent, setIsWeeklyEvent] = useState(true); // 주간 행사(상단 요일별) 반영
  const [isWeeklyDeptContent, setIsWeeklyDeptContent] = useState(true); // 주간 교육 내용(부서란) 반영
  const [isMonthlySchedule, setIsMonthlySchedule] = useState(true); // 월간 계획 반영
  const [sendToAcademicCalendar, setSendToAcademicCalendar] = useState(false); // 캘린더 동기화
  const [syncTargetType, setSyncTargetType] = useState<import('@/lib/types').CalendarSyncTargetType>('all');
  const [syncTargetGrade, setSyncTargetGrade] = useState('1학년');
  const [isMainSchoolSchedule, setIsMainSchoolSchedule] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 사용자가 속한 또는 부장을 맡은 부서 목록
  const myHeadDepartments = useMemo(() => {
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

  // 다이얼로그 열릴 때 기본 부서 설정
  useEffect(() => {
    if (open) {
      if (myHeadDepartments.length > 0) {
        setDeptName(myHeadDepartments[0]);
      } else if (userDept) {
        setDeptName(userDept);
      } else if (allDepartments.length > 0) {
        setDeptName(allDepartments[0]);
      } else {
        setDeptName('담당 부서');
      }
    }
  }, [open, myHeadDepartments, userDept, allDepartments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '일정 제목을 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createDepartmentWeeklySchedule({
        deptName: deptName || '담당 부서',
        creatorEmail: profile?.email || '',
        creatorName: profile?.name || '부장',
        title: title.trim(),
        startDate,
        endDate: endDate >= startDate ? endDate : startDate,
        content: content.trim(),
        isWeeklyEvent,
        isWeeklyDeptContent,
        isWeeklySchedule: isWeeklyEvent || isWeeklyDeptContent,
        isMonthlySchedule,
        sendToAcademicCalendar,
        syncTargetType: sendToAcademicCalendar ? syncTargetType : undefined,
        syncTargetGrade: (sendToAcademicCalendar && syncTargetType === 'grade') ? syncTargetGrade : undefined,
        isMainSchoolSchedule
      });

      if (res.success) {
        toast({ 
          title: '부서 일정 등록 완료', 
          description: `'${title}' 일정이 정상적으로 등록되었습니다.` 
        });
        setTitle('');
        setContent('');
        setIsWeeklyEvent(true);
        setIsWeeklyDeptContent(true);
        setIsMonthlySchedule(true);
        setSendToAcademicCalendar(false);
        setSyncTargetType('all');
        setIsMainSchoolSchedule(true);
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: '등록 실패', description: res.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] p-0 flex flex-col overflow-hidden rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b shrink-0 bg-slate-50/80">
          <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-900">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
            부서별 주간 일정 등록
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            담당 부서의 주요 주간 업무 및 일정을 등록하고 공유 범위를 설정합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 scrollbar-thin">
            {/* 1. 부서 선택 & 일정 제목 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">주관 부서 *</Label>
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
                      <SelectItem value="담당 부서" className="text-xs">
                        담당 부서
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">일정 / 업무 제목 *</Label>
                <Input 
                  placeholder="예: 2026학년도 방과후 강좌 수강신청 시작"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 text-xs rounded-xl font-medium"
                  required
                />
              </div>
            </div>

            {/* 2. 일정 기간 (시작일 ~ 종료일) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">시작일 *</Label>
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
                <Label className="text-xs font-bold text-slate-700">종료일 *</Label>
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
              <Label className="text-xs font-bold text-slate-700">상세 내용 및 비고</Label>
              <Textarea 
                placeholder="대상 학년, 장소, 준비사항 등 세부 내용을 입력하세요."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={2}
                className="text-xs rounded-xl resize-none"
              />
            </div>

            {/* 4. 일정 반영 및 캘린더 연동 범위 설정 (주간 행사/주간 교육내용/월간/학사일정) */}
            <div className="space-y-2.5 pt-2 border-t">
              <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                일정 반영 및 공유 범위 설정
              </Label>

              <div className="space-y-2.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200 text-xs">
                {/* 체크박스 1: 주간 행사 (상단 요일별 칸) */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox 
                    checked={isWeeklyEvent}
                    onCheckedChange={(checked) => setIsWeeklyEvent(!!checked)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                      주간 행사에 반영 (주간교육계획 상단 요일별 칸)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      체크 시 해당 주의 [유초등 주간교육계획] 상단 요일(월~토) 행사란에 자동 취합됩니다.
                    </p>
                  </div>
                </label>

                {/* 체크박스 2: 주간 교육 내용 (부서란) */}
                <label className="flex items-start gap-2.5 cursor-pointer pt-1.5 border-t border-slate-200/60">
                  <Checkbox 
                    checked={isWeeklyDeptContent}
                    onCheckedChange={(checked) => setIsWeeklyDeptContent(!!checked)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-sky-600" />
                      주간 교육 내용에 반영 (주간교육계획 부서란)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      체크 시 해당 주의 [유초등 주간교육계획] 담당 부서란에 업무/교육 내용으로 자동 취합됩니다.
                    </p>
                  </div>
                </label>

                {/* 체크박스 3: 월간교육계획 반영 */}
                <label className="flex items-start gap-2.5 cursor-pointer pt-1.5 border-t border-slate-200/60">
                  <Checkbox 
                    checked={isMonthlySchedule}
                    onCheckedChange={(checked) => setIsMonthlySchedule(!!checked)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      월간 교육활동 계획에 반영 (월간계획 자동 취합)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      체크 시 해당 월의 [유초등 월간 교육활동 계획] 날짜란에 자동 취합됩니다.
                    </p>
                  </div>
                </label>

                {/* 체크박스 4: 학사일정으로 전송 & 캘린더 동기화 대상 그룹 선택 */}
                <div className="pt-1.5 border-t border-slate-200/60 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <Checkbox 
                      checked={sendToAcademicCalendar}
                      onCheckedChange={(checked) => setSendToAcademicCalendar(!!checked)}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        학사일정으로 전송 (스마트폰/구글 캘린더 동기화)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        체크 시 지정한 대상의 캘린더 동기화 학사일정에 추가됩니다.
                      </p>
                    </div>
                  </label>

                  {/* 캘린더 동기화 대상 그룹 선택 옵션 */}
                  {sendToAcademicCalendar && (
                    <div className="ml-6 p-2.5 bg-white rounded-lg border border-emerald-200 space-y-2">
                      <Label className="text-[11px] font-bold text-emerald-900">캘린더 동기화 대상 그룹</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs p-1.5 rounded-md hover:bg-slate-50 border">
                          <input 
                            type="radio" 
                            name="syncTarget" 
                            checked={syncTargetType === 'all'} 
                            onChange={() => setSyncTargetType('all')}
                            className="text-emerald-600"
                          />
                          <span className="font-semibold text-slate-800">전체 교직원</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs p-1.5 rounded-md hover:bg-slate-50 border">
                          <input 
                            type="radio" 
                            name="syncTarget" 
                            checked={syncTargetType === 'dept'} 
                            onChange={() => setSyncTargetType('dept')}
                            className="text-emerald-600"
                          />
                          <span className="font-semibold text-slate-800">부서원만</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs p-1.5 rounded-md hover:bg-slate-50 border">
                          <input 
                            type="radio" 
                            name="syncTarget" 
                            checked={syncTargetType === 'grade'} 
                            onChange={() => setSyncTargetType('grade')}
                            className="text-emerald-600"
                          />
                          <span className="font-semibold text-slate-800">특정 학년</span>
                        </label>
                      </div>

                      {syncTargetType === 'grade' && (
                        <div className="pt-1.5">
                          <Select value={syncTargetGrade} onValueChange={setSyncTargetGrade}>
                            <SelectTrigger className="h-7 text-xs rounded-lg">
                              <SelectValue placeholder="학년 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {['유치원', '1학년', '2학년', '3학년', '4학년', '5학년', '6학년', '중등', '전담교사'].map(g => (
                                <SelectItem key={g} value={g} className="text-xs">
                                  {g}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 안내: 모든 옵션 미체크 시 자체 종료 업무 */}
                {!isWeeklyEvent && !isWeeklyDeptContent && !isMonthlySchedule && !sendToAcademicCalendar && (
                  <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] mt-1">
                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>부서 자체 일정:</strong> 주간/월간/학사일정에 공개되지 않고 교장, 교감, 부장단 및 {deptName ? `[${deptName}]` : '해당 부서'} 부원에게만 내부 관리용으로 표시됩니다.
                    </span>
                  </div>
                )}
              </div>
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
                  등록 중...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  일정 등록
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
