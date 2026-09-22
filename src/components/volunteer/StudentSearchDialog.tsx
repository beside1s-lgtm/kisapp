'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Search } from 'lucide-react';
import type { MasterStudent } from '@/lib/types/masterStudent';

export function StudentSearchDialog({
  isStudentSearchOpen,
  setIsStudentSearchOpen,
  studentSearchQuery,
  setStudentSearchQuery,
  searchedMasterStudents,
  handleSelectMasterStudent,
}: {
  isStudentSearchOpen: boolean;
  setIsStudentSearchOpen: (open: boolean) => void;
  studentSearchQuery: string;
  setStudentSearchQuery: (val: string) => void;
  searchedMasterStudents: MasterStudent[];
  handleSelectMasterStudent: (s: MasterStudent) => void;
}) {
  return (
    <Dialog open={isStudentSearchOpen} onOpenChange={setIsStudentSearchOpen}>
      <DialogContent className="max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            참여 학생 검색 및 추가
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            이름 또는 학년-반으로 검색하여 단체 봉사활동 참여 학생을 추가하세요.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={studentSearchQuery}
            onChange={e => setStudentSearchQuery(e.target.value)}
            placeholder="학생 이름 또는 학년-반 (예: 김철수, 3-2)"
            className="h-9 text-xs"
            autoFocus
          />

          <div className="border rounded-lg max-h-60 overflow-y-auto divide-y text-xs">
            {searchedMasterStudents.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-xs">
                검색 결과가 없습니다.
              </div>
            ) : (
              searchedMasterStudents.map((s, idx) => (
                <div
                  key={s.id ? `${s.id}-${idx}` : `search-std-${idx}`}
                  className="p-2.5 hover:bg-muted flex items-center justify-between cursor-pointer transition-colors"
                  onClick={() => handleSelectMasterStudent(s)}
                >
                  <div>
                    <span className="font-bold text-foreground mr-2">{s.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      ({s.grade}학년 {s.classNum}반 {s.studentNum ? `${s.studentNum}번` : ''})
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-primary font-bold">
                    추가
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
