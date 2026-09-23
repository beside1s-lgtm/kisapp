'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

export function PinModal({
  showPinModal,
  setShowPinModal,
  pinInput,
  setPinInput,
  isSubmitting,
  confirmSubmit,
}: {
  showPinModal: boolean;
  setShowPinModal: (open: boolean) => void;
  pinInput: string;
  setPinInput: (val: string) => void;
  isSubmitting: boolean;
  confirmSubmit: (skipPinCheck?: boolean) => void;
}) {
  return (
    <Dialog open={showPinModal} onOpenChange={setShowPinModal}>
      <DialogContent className="w-[92%] sm:max-w-md rounded-2xl p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg font-bold">전자서명 비밀번호 확인</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-slate-500">
            기기 등록 시 설정한 4자리 PIN 번호를 입력해 주세요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pinInput.length === 4 && !isSubmitting) {
                e.preventDefault();
                confirmSubmit();
              }
            }}
            placeholder="••••"
            className="text-center text-3xl tracking-[1em] w-[150px] font-mono h-14 border-slate-300 focus:border-indigo-500"
            autoFocus
          />
        </div>
        <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => { setShowPinModal(false); setPinInput(''); }} disabled={isSubmitting} className="h-10 px-4">
            취소
          </Button>
          <Button size="sm" onClick={() => confirmSubmit(false)} disabled={isSubmitting || pinInput.length !== 4} className="h-10 px-4 bg-primary text-primary-foreground font-bold">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '서명 후 제출'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
