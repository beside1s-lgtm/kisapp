'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Settings2, Check, RotateCcw, UserCheck } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

interface PeSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail?: string | null;
  assignedGrades: string[];
  onSaveAssignedGrades: (grades: string[]) => void;
  availableGrades: string[];
  totalStudentCount: number;
}

const DEFAULT_ELEMENTARY_GRADES = ['1', '2', '3', '4', '5', '6'];
const SECONDARY_GRADES = ['7', '8', '9', '10', '11', '12'];

export default function PeSettingsDialog({
  isOpen,
  onOpenChange,
  userEmail,
  assignedGrades,
  onSaveAssignedGrades,
  availableGrades,
  totalStudentCount,
}: PeSettingsDialogProps) {
  const { toast } = useToast();
  const [selectedGrades, setSelectedGrades] = useState<string[]>(assignedGrades);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedGrades(assignedGrades);
    }
  }, [isOpen, assignedGrades]);

  const allDisplayGrades = Array.from(
    new Set([...DEFAULT_ELEMENTARY_GRADES, ...availableGrades])
  ).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

  const handleToggleGrade = (grade: string) => {
    setSelectedGrades((prev) =>
      prev.includes(grade)
        ? prev.filter((g) => g !== grade)
        : [...prev, grade].sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0))
    );
  };

  const handleSelectAll = () => {
    setSelectedGrades(allDisplayGrades);
  };

  const handleSelectPreset = (preset: 'upper' | 'lower' | 'clear') => {
    if (preset === 'upper') {
      setSelectedGrades(['4', '5', '6']);
    } else if (preset === 'lower') {
      setSelectedGrades(['1', '2', '3']);
    } else if (preset === 'clear') {
      setSelectedGrades([]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. 부모 콜백 호출 (로컬 상태 갱신)
      onSaveAssignedGrades(selectedGrades);

      // 2. Firestore에 영구 저장 (사용자별 프로필)
      if (userEmail) {
        const userRef = doc(getDb(), 'users', userEmail);
        await setDoc(userRef, { peAssignedGrades: selectedGrades }, { merge: true });
        
        // localStorage 백업
        try {
          localStorage.setItem(`pe_assigned_grades_${userEmail}`, JSON.stringify(selectedGrades));
        } catch (e) {}
      }

      toast({
        title: '설정 저장 완료',
        description: selectedGrades.length > 0
          ? `담당 학년(${selectedGrades.map(g => `${g}학년`).join(', ')}) 학생 데이터만 표시됩니다.`
          : '모든 학년의 학생 데이터가 표시됩니다.',
      });

      onOpenChange(false);
    } catch (e) {
      console.error('Save PE settings error:', e);
      toast({
        variant: 'destructive',
        title: '설정 저장 실패',
        description: '담당 학년 설정 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <Settings2 className="w-4 h-4" />
            </div>
            <DialogTitle className="text-base sm:text-lg font-black text-slate-900">
              체육 교과 담당 학년 설정
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-600 leading-relaxed">
            체육 교과 전담 선생님이 담당하는 학년을 선택하시면, 해당 학년의 학생 데이터만 최적화하여 불러오고 표시합니다.
          </DialogDescription>
        </DialogHeader>

        {/* 빠른 선택 프리셋 버튼 */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">빠른 선택 프리셋</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSelectPreset('upper')}
                className="h-6 px-2 text-[11px] font-bold text-indigo-700 bg-indigo-50/50 border-indigo-200 hover:bg-indigo-100"
              >
                고학년 (4~6)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSelectPreset('lower')}
                className="h-6 px-2 text-[11px] font-bold text-slate-700 bg-slate-50 border-slate-200 hover:bg-slate-100"
              >
                저학년 (1~3)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="h-6 px-2 text-[11px] font-bold text-slate-700 bg-slate-50 border-slate-200 hover:bg-slate-100"
              >
                전체 선택
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSelectPreset('clear')}
                className="h-6 px-1.5 text-[11px] text-slate-500 hover:text-slate-900"
                title="선택 해제"
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* 초등 학년 체크박스 그리드 */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800">초등학교 (1~6학년)</span>
              <Badge variant="secondary" className="text-[10px] font-bold">
                {selectedGrades.filter(g => parseInt(g) <= 6).length}개 학년 선택됨
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {allDisplayGrades.filter(g => parseInt(g) <= 6).map((grade) => {
                const isChecked = selectedGrades.includes(grade);
                return (
                  <label
                    key={grade}
                    htmlFor={`grade-chk-${grade}`}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-white border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-600'
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <Checkbox
                      id={`grade-chk-${grade}`}
                      checked={isChecked}
                      onCheckedChange={() => handleToggleGrade(grade)}
                      className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                    />
                    <span>{grade}학년</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 중/고등 학년 (존재하는 경우만 표시) */}
          {availableGrades.some(g => parseInt(g) > 6) && (
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800">중·고등학교</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {availableGrades.filter(g => parseInt(g) > 6).map((grade) => {
                  const isChecked = selectedGrades.includes(grade);
                  return (
                    <label
                      key={grade}
                      htmlFor={`grade-chk-${grade}`}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-white border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-600'
                          : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <Checkbox
                        id={`grade-chk-${grade}`}
                        checked={isChecked}
                        onCheckedChange={() => handleToggleGrade(grade)}
                        className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                      />
                      <span>{grade}학년</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* 안내 배너 */}
          <div className="flex items-start gap-2 p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-900 text-[11px] leading-relaxed">
            <UserCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              {selectedGrades.length === 0 ? (
                <>학년을 선택하지 않으면 <strong>전교생({totalStudentCount}명)</strong>이 모두 표시됩니다.</>
              ) : (
                <>선택하신 <strong>{selectedGrades.map(g => `${g}학년`).join(', ')}</strong> 학생들만 조회되며, 상단 필터 및 기록 입력창에 즉시 적용됩니다.</>
              )}
            </p>
          </div>
        </div>

        <DialogFooter className="pt-3 gap-2 flex-row justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs font-bold"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
          >
            {isSaving ? '저장 중...' : '설정 저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
