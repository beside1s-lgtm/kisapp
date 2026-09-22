'use client';

import { useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { unassignStudentFromAllRoutes } from '@/lib/kisbus/assignments';
import type { DayOfWeek } from '@/lib/kisbus/types';

export interface BusUnassignTarget {
  studentId: string;
  studentName: string;
  dayOfWeek: DayOfWeek;
  dayLabel: string;
  routeId: string;
  busNo: string;
}

/**
 * "하교 버스 탑승 해제" 확인 모달.
 *
 * teacher/homeroom/page.tsx의 Dialog(busUnassignTarget) 블록을 그대로
 * 옮긴 것으로, 이 다이얼로그가 다루는 상태(target)는 부모에 남아 있고,
 * 해제 처리 자체는 이 다이얼로그 안에서만 쓰이는 완전히 독립적인 동작이라
 * 로딩 상태(isUnassigning)와 함께 그대로 이 컴포넌트로 옮겼다
 * (동작 변경 없음 — 기존에 부모에 있던 isBusUnassigning 상태와 onClick
 * 핸들러 로직을 텍스트 그대로 이전).
 */
export interface BusUnassignConfirmDialogProps {
  target: BusUnassignTarget | null;
  onClose: () => void;
}

export function BusUnassignConfirmDialog({ target, onClose }: BusUnassignConfirmDialogProps) {
  const { toast } = useToast();
  const [isUnassigning, setIsUnassigning] = useState(false);

  const handleConfirm = async () => {
    if (!target) return;
    setIsUnassigning(true);
    try {
      await unassignStudentFromAllRoutes(
        target.studentId,
        ['Afternoon'],
        target.dayOfWeek
      );
      toast({
        title: '버스 탑승 해제 완료',
        description: `${target.studentName} - ${target.dayLabel}요일 하교 버스(${target.busNo}) 미배정 처리되었습니다.`,
      });
      onClose();
    } catch (err) {
      console.error('[BusUnassign]', err);
      toast({
        title: '해제 실패',
        description: '버스 탑승 해제 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsUnassigning(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[420px] w-[95vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <LogOut className="h-4 w-4 text-red-500 shrink-0" />
            하교 버스 탑승 해제
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 pt-1">
            {target && (
              <>
                <span className="font-semibold text-slate-700">{target.studentName}</span> 학생을{' '}
                <span className="font-semibold text-blue-700">{target.dayLabel}요일 하교</span> 버스(
                <span className="font-semibold">{target.busNo}</span>)에서 미배정 처리합니다.
                <br />
                해제 후 스쿨버스 관리자/교사 페이지에 실시간 반영됩니다.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-2 border-t flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs font-medium"
            disabled={isUnassigning}
          >
            유지
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={isUnassigning}
            className="h-8 text-xs font-bold"
            onClick={handleConfirm}
          >
            {isUnassigning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            해제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
