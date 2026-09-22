'use client';

import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

/**
 * "부장 건의 (주간/월간 학사일정 공식 반영 요청)" 모달.
 *
 * PeEventManagement.tsx의 Dialog(isSuggestModalOpen) 블록을 그대로
 * 옮긴 것으로, 상태와 전송 로직은 전부 부모(PeEventManagement.tsx)에
 * 남아 있고 이 컴포넌트는 순수하게 마크업만 담당한다 (동작 변경 없음).
 */
export interface PeSuggestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestTitle: string;
  setSuggestTitle: (value: string) => void;
  suggestContent: string;
  setSuggestContent: (value: string) => void;
  isSubmittingSuggest: boolean;
  onSendSuggestion: () => void;
}

export function PeSuggestDialog({
  open,
  onOpenChange,
  suggestTitle,
  setSuggestTitle,
  suggestContent,
  setSuggestContent,
  isSubmittingSuggest,
  onSendSuggestion,
}: PeSuggestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-600" />
            부장 건의 (주간/월간 학사일정 공식 반영 요청)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            결재가 완료된 체육 행사를 교무부장/학년부장에게 건의하여 학교 주간학습안내 및 월간 일정에 공식 등록합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">건의 제목</Label>
            <Input
              value={suggestTitle}
              onChange={e => setSuggestTitle(e.target.value)}
              className="h-8 text-xs bg-white font-bold"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">건의 내용 및 전달 사항</Label>
            <Textarea
              value={suggestContent}
              onChange={e => setSuggestContent(e.target.value)}
              rows={6}
              className="text-xs bg-white font-mono leading-relaxed resize-none"
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-3 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmittingSuggest}
            className="text-xs"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSendSuggestion}
            disabled={isSubmittingSuggest || !suggestTitle.trim()}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            <span>건의안 전송</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
