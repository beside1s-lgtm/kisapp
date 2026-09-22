'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { MasterStudent } from '@/lib/types/masterStudent';

export function BehaviorInputDialog({
  isBehaviorModalOpen,
  setIsBehaviorModalOpen,
  selectedStudentForBehavior,
  todayDisplay,
  behaviorInput,
  setBehaviorInput,
  handleSaveBehavior,
}: {
  isBehaviorModalOpen: boolean;
  setIsBehaviorModalOpen: (open: boolean) => void;
  selectedStudentForBehavior: MasterStudent | null;
  todayDisplay: string;
  behaviorInput: string;
  setBehaviorInput: (val: string) => void;
  handleSaveBehavior: () => void;
}) {
  return (
    <Dialog open={isBehaviorModalOpen} onOpenChange={setIsBehaviorModalOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {selectedStudentForBehavior?.name} 관찰 기록 입력
          </DialogTitle>
          <DialogDescription className="text-xs">
            {todayDisplay} 관찰 내용을 입력해 주세요. (Ctrl + Enter로 바로 저장)
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Textarea
            value={behaviorInput}
            onChange={(e) => setBehaviorInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'Enter') handleSaveBehavior();
            }}
            placeholder="예: 모둠 활동 시 친구들의 의견을 경청하고 배려하는 태도를 보임."
            rows={4}
            className="text-xs leading-relaxed"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setIsBehaviorModalOpen(false)}>
            취소
          </Button>
          <Button
            size="sm"
            onClick={handleSaveBehavior}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
