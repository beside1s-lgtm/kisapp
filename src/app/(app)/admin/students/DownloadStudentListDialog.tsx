'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/kisbus/utils';
import type { MasterStudent } from '@/lib/types/masterStudent';
import type { GradeClassTreeItem } from './PromoteStudentsDialog';

/**
 * "학생 명단 엑셀 다운로드 (학년/반 선택)" 모달.
 *
 * admin/students/page.tsx의 Dialog(isDownloadDialogOpen) 블록을 그대로
 * 옮긴 것으로, 선택 상태와 다운로드 로직은 전부 부모(page.tsx)에 남아
 * 있고 이 컴포넌트는 순수하게 마크업만 담당한다 (동작 변경 없음).
 */
export interface DownloadStudentListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: MasterStudent[];
  gradeClassTree: GradeClassTreeItem[];
  selectedClassesForDownload: string[];
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onToggleGrade: (grade: string) => void;
  onToggleClass: (key: string) => void;
  onDownload: () => void;
}

export function DownloadStudentListDialog({
  open,
  onOpenChange,
  students,
  gradeClassTree,
  selectedClassesForDownload,
  onSelectAll,
  onDeselectAll,
  onToggleGrade,
  onToggleClass,
  onDownload,
}: DownloadStudentListDialogProps) {
  const selectedCount = students.filter(s => selectedClassesForDownload.includes(`${s.grade}-${s.classNum || '1'}`)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-2 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
              <Download className="h-5 w-5 text-indigo-600" />
              <span>학생 명단 엑셀 다운로드 (학년/반 선택)</span>
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            다운로드할 학년과 반을 체크박스로 선택해주세요.
          </DialogDescription>
        </DialogHeader>

        {/* 빠른 선택 바 */}
        <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
          <span className="font-bold text-slate-700">
            선택된 대상: <strong className="text-indigo-600">{selectedCount}명</strong> / 전체 {students.length}명
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              className="h-7 text-xs font-semibold px-2"
            >
              전체 선택
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDeselectAll}
              className="h-7 text-xs font-semibold px-2 text-slate-500"
            >
              전체 해제
            </Button>
          </div>
        </div>

        {/* 학년별 반 선택 체크박스 그리드 */}
        <div className="space-y-3 py-1">
          {gradeClassTree.map((gItem) => {
            const gradeKeys = gItem.classes.map(c => c.key);
            const allSelected = gradeKeys.length > 0 && gradeKeys.every(k => selectedClassesForDownload.includes(k));
            const someSelected = gradeKeys.some(k => selectedClassesForDownload.includes(k));

            return (
              <div key={gItem.grade} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`grade-all-${gItem.grade}`}
                      checked={allSelected ? true : (someSelected ? 'indeterminate' : false)}
                      onCheckedChange={() => onToggleGrade(gItem.grade)}
                      className="h-4 w-4 text-indigo-600 rounded"
                    />
                    <Label htmlFor={`grade-all-${gItem.grade}`} className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5">
                      <span>{gItem.grade === '졸업' ? '졸업생' : `${gItem.grade}학년 전체`}</span>
                      <span className="text-[11px] font-normal text-slate-500">({gItem.totalCount}명)</span>
                    </Label>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleGrade(gItem.grade)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {allSelected ? '학년 해제' : '학년 선택'}
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                  {gItem.classes.map((c) => {
                    const isChecked = selectedClassesForDownload.includes(c.key);
                    return (
                      <div
                        key={c.key}
                        onClick={() => onToggleClass(c.key)}
                        className={cn(
                          "flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer transition select-none",
                          isChecked
                            ? "bg-indigo-50 border-indigo-300 text-indigo-900 font-bold"
                            : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        <Checkbox
                          id={c.key}
                          checked={isChecked}
                          onCheckedChange={() => onToggleClass(c.key)}
                          className="h-3.5 w-3.5"
                        />
                        <span className="truncate">{c.classNum}반 ({c.count}명)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="pt-2 flex items-center justify-between sm:justify-end gap-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs font-bold">
            취소
          </Button>
          <Button
            onClick={onDownload}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-xs"
          >
            <Download className="h-4 w-4" />
            <span>선택된 학생 ({selectedCount}명) 엑셀 다운로드</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
