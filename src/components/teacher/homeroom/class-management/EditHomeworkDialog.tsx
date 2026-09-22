'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { HomeroomHomework } from '@/lib/types/homeroomClass';

export function EditHomeworkDialog({
  editingHw,
  setEditingHw,
  editHwTitle,
  setEditHwTitle,
  handleSaveEditHw,
}: {
  editingHw: HomeroomHomework | null;
  setEditingHw: (hw: HomeroomHomework | null) => void;
  editHwTitle: string;
  setEditHwTitle: (val: string) => void;
  handleSaveEditHw: () => void;
}) {
  return (
    <Dialog open={!!editingHw} onOpenChange={(open) => !open && setEditingHw(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">숙제 내용 수정</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Input
            value={editHwTitle}
            onChange={(e) => setEditHwTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEditHw();
            }}
            className="text-xs"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setEditingHw(null)}>
            취소
          </Button>
          <Button size="sm" onClick={handleSaveEditHw} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            수정 완료
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
