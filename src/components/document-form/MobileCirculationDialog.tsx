'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import UserSearch from '../user-search';
import type { UserProfile } from '@/lib/types';

interface CircularFieldItem {
  id: string;
  name: string;
  email: string;
  role?: string;
}

/**
 * "공람자 지정" 모바일 전용 모달.
 *
 * document-form.tsx의 Dialog(isMobileCircularDialogOpen) 블록을 그대로
 * 옮긴 것으로, 공람자 필드 배열(useFieldArray)과 검색 상태는 전부
 * 부모(document-form.tsx)에 남아 있고 이 컴포넌트는 순수하게 마크업만
 * 담당한다 (동작 변경 없음).
 */
export interface MobileCirculationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserProfile[];
  circularQuery: string;
  setCircularQuery: (value: string) => void;
  circularFields: CircularFieldItem[];
  onAppendCircular: (value: { name: string; email: string; role?: string }) => void;
  onRemoveCircular: (index: number) => void;
}

export function MobileCirculationDialog({
  open,
  onOpenChange,
  users,
  circularQuery,
  setCircularQuery,
  circularFields,
  onAppendCircular,
  onRemoveCircular,
}: MobileCirculationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center justify-between">
            <span>공람자 지정</span>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
              총 {circularFields.length}명
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <UserSearch
            users={users}
            value={circularQuery}
            onChange={(value) => setCircularQuery(value)}
            onSelectUser={(u) => {
              if (!circularFields.some(f => f.email === u.email)) onAppendCircular({ name: u.name, email: u.email, role: u.role });
              setCircularQuery('');
            }}
            placeholder="공람자 검색 및 추가..."
          />
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
            {circularFields.length === 0 ? (
              <span className="text-xs text-muted-foreground p-2">지정된 공람자가 없습니다.</span>
            ) : (
              circularFields.map((field, i) => (
                <div key={field.id} className="bg-white border shadow-2xs px-2 py-1 rounded-lg flex items-center gap-1.5 text-xs font-semibold">
                  <span>{field.name}</span>
                  <button type="button" onClick={() => onRemoveCircular(i)} className="text-slate-400 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 text-xs"
          >
            확인
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
