'use client';

import { Check, CheckCircle2, Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { PeEvent } from '@/lib/pe/types';
import type { TeacherOption } from './PeEventManagement';

/**
 * "학년별 세부 운영계획 업무 요청" 모달.
 *
 * PeEventManagement.tsx의 Dialog(isTaskRequestOpen) 블록을 그대로 옮긴
 * 것으로, 상태와 발송 로직은 전부 부모(PeEventManagement.tsx)에 남아 있고
 * 이 컴포넌트는 순수하게 마크업만 담당한다 (동작 변경 없음).
 */
export interface PeTaskRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetEventForTask: PeEvent | null;
  teacherList: TeacherOption[];

  taskDeadline: string;
  setTaskDeadline: (value: string) => void;
  taskNotice: string;
  setTaskNotice: (value: string) => void;

  selectedGradesForTask: string[];
  setSelectedGradesForTask: (updater: (prev: string[]) => string[]) => void;
  gradeAssignees: { [grade: string]: { email: string; name: string } };
  setGradeAssignees: (updater: (prev: { [grade: string]: { email: string; name: string } }) => { [grade: string]: { email: string; name: string } }) => void;

  isRequestingTask: boolean;
  onSendGradeTaskRequest: () => void;
}

export function PeTaskRequestDialog({
  open,
  onOpenChange,
  targetEventForTask,
  teacherList,
  taskDeadline,
  setTaskDeadline,
  taskNotice,
  setTaskNotice,
  selectedGradesForTask,
  setSelectedGradesForTask,
  gradeAssignees,
  setGradeAssignees,
  isRequestingTask,
  onSendGradeTaskRequest,
}: PeTaskRequestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 상단 고정 헤더 */}
        <DialogHeader className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-white shrink-0 sticky top-0 z-20 text-left">
          <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 pr-8">
            <Send className="w-5 h-5 text-indigo-600 shrink-0" />
            학년별 세부 운영계획 업무 요청
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            각 학년 담당 교사(학년부장/담임교사)를 지정하여 세부 타임테이블 시나리오 및 PPT 제출을 요청합니다.
          </DialogDescription>
        </DialogHeader>

        {targetEventForTask && (
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">제출 마감일 설정</Label>
                <Input
                  type="date"
                  value={taskDeadline}
                  onChange={e => setTaskDeadline(e.target.value)}
                  className="h-8 text-xs bg-white font-bold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">요청 지침 및 안내 사항</Label>
                <Textarea
                  value={taskNotice}
                  onChange={e => setTaskNotice(e.target.value)}
                  rows={3}
                  className="text-xs bg-white resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* 학년별 담당자 지정 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  업무 요청 대상 학년 및 담당 교사 지정 ({selectedGradesForTask.length}개 학년 선택됨)
                </Label>
                <span className="text-[11px] text-slate-500">
                  학년 체크 후 원하는 담당 선생님을 클릭해 주세요.
                </span>
              </div>

              <div className="space-y-3">
                {(targetEventForTask.targetGrades && targetEventForTask.targetGrades.length > 0 ? targetEventForTask.targetGrades : ['1', '2', '3', '4', '5', '6']).map(grade => {
                  const current = gradeAssignees[grade] || { email: '', name: '' };
                  const isChecked = selectedGradesForTask.includes(grade);

                  // 해당 학년 소속 교사 (부장, 담임, 교과 등) 필터링
                  const gradeTeachers = teacherList.filter(t => {
                    return (
                      t.grade === grade ||
                      (t.role && (
                        t.role.includes(`${grade}학년`) ||
                        t.role.startsWith(`${grade}-`) ||
                        t.role.includes(`(${grade}-`) ||
                        t.role.includes(` ${grade}-`)
                      )) ||
                      (t.dept && (
                        t.dept.includes(`${grade}학년`) ||
                        t.dept.startsWith(`${grade}-`)
                      ))
                    );
                  });

                  return (
                    <div
                      key={grade}
                      className={cn(
                        "rounded-2xl border transition-all overflow-hidden",
                        isChecked
                          ? "bg-white border-indigo-200 shadow-xs"
                          : "bg-slate-50/70 border-slate-200 opacity-70"
                      )}
                    >
                      {/* 학년 카드 헤더 */}
                      <div
                        className={cn(
                          "p-3 flex items-center justify-between gap-3 cursor-pointer select-none",
                          isChecked ? "bg-indigo-50/40 border-b border-indigo-100" : "bg-transparent"
                        )}
                        onClick={() => {
                          setSelectedGradesForTask(prev =>
                            isChecked ? prev.filter(g => g !== grade) : [...prev, grade]
                          );
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              setSelectedGradesForTask(prev =>
                                checked ? [...prev, grade] : prev.filter(g => g !== grade)
                              );
                            }}
                            onClick={e => e.stopPropagation()}
                          />
                          <Badge className={cn(
                            "font-bold text-xs px-2.5 py-0.5",
                            isChecked ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                          )}>
                            {grade}학년
                          </Badge>
                          <span className="text-xs font-bold text-slate-900">
                            {grade}학년 세부 운영계획서 제출 요청
                          </span>
                        </div>

                        {isChecked && current.name && (
                          <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>지정 교사: {current.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({current.email})</span>
                          </div>
                        )}
                      </div>

                      {/* 학년 체크 시 인라인으로 펼쳐지는 교사 명단 그리드 */}
                      {isChecked && (
                        <div className="p-3.5 space-y-2.5 bg-white">
                          <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                            <span>★ {grade}학년부 소속 선생님 ({gradeTeachers.length}명) - 담당자로 지정할 교사를 체크하세요:</span>
                          </div>

                          {gradeTeachers.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {gradeTeachers.map(teacher => {
                                const isSelected = current.email.toLowerCase() === teacher.email.toLowerCase();
                                return (
                                  <button
                                    key={teacher.email}
                                    type="button"
                                    onClick={() => {
                                      setGradeAssignees(prev => ({
                                        ...prev,
                                        [grade]: {
                                          email: teacher.email,
                                          name: teacher.name
                                        }
                                      }));
                                    }}
                                    className={cn(
                                      "p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer",
                                      isSelected
                                        ? "bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs text-indigo-950"
                                        : "bg-slate-50/60 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30 text-slate-700"
                                    )}
                                  >
                                    {/* 체크/라디오 아이콘 */}
                                    <div className={cn(
                                      "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                                      isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"
                                    )}>
                                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                    </div>

                                    {/* 교사 이름 & 직책 */}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-black text-xs">{teacher.name}</span>
                                        <Badge className={cn(
                                          "text-[9px] px-1.5 py-0 h-4 font-bold border-0",
                                          isSelected ? "bg-indigo-600 text-white" : "bg-slate-200/80 text-slate-700"
                                        )}>
                                          {teacher.role}
                                        </Badge>
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                                        {teacher.email}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="py-2 text-center text-xs text-slate-400">
                              등록된 {grade}학년부 교사가 없습니다.
                            </div>
                          )}

                          {/* 타 학년/부서 교사 선택이 필요한 경우 인라인 셀렉트 */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                            <span className="text-[11px] text-slate-500 font-medium">
                              목록 외 다른 교사를 지정하시겠습니까?
                            </span>
                            <Select
                              value={current.email}
                              onValueChange={(val) => {
                                const found = teacherList.find(t => t.email.toLowerCase() === val.toLowerCase());
                                if (found) {
                                  setGradeAssignees(prev => ({
                                    ...prev,
                                    [grade]: {
                                      email: found.email,
                                      name: found.name
                                    }
                                  }));
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs bg-slate-50 w-[240px]">
                                <SelectValue placeholder="전체 교직원 목록에서 직접 선택..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-56">
                                {teacherList.map(t => (
                                  <SelectItem key={t.email} value={t.email} className="text-xs">
                                    {t.name} ({t.role} - {t.email})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 하단 고정 푸터 */}
        <DialogFooter className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50/95 backdrop-blur-xs shrink-0 flex items-center justify-between sticky bottom-0 z-20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isRequestingTask}
            className="text-xs"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSendGradeTaskRequest}
            disabled={isRequestingTask || selectedGradesForTask.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>업무 요청 발송 ({selectedGradesForTask.length}개 학년)</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
