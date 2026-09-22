'use client';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Student, Team } from '@/lib/pe/types';

export function StudentMoveDialog({
  studentToMove,
  setStudentToMove,
  teams,
  handleMoveStudentToTeam,
}: {
  studentToMove: { student: Student; sourceTeamId: string } | null;
  setStudentToMove: (val: { student: Student; sourceTeamId: string } | null) => void;
  teams: Team[];
  handleMoveStudentToTeam: (studentId: string, sourceTeamId: string, targetTeamId: string) => void;
}) {
  return (
    <Dialog open={!!studentToMove} onOpenChange={(open) => !open && setStudentToMove(null)}>
      <DialogContent className="max-w-xs p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-sm font-black flex items-center gap-1.5">
            <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
            팀 변경: {studentToMove?.student.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            이동할 팀을 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-1.5 py-2">
          {teams.map((t) => {
            const isCurrent = studentToMove?.sourceTeamId === t.id;
            return (
              <Button
                key={t.id}
                variant={isCurrent ? "secondary" : "outline"}
                disabled={isCurrent}
                onClick={() => {
                  if (studentToMove) {
                    handleMoveStudentToTeam(studentToMove.student.id, studentToMove.sourceTeamId, t.id);
                  }
                }}
                className={cn(
                  "w-full h-9 justify-between font-bold text-xs",
                  !isCurrent && "hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300"
                )}
              >
                <span>{t.name}</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {isCurrent ? "현재 팀" : `${t.members?.length || 0}명`}
                </span>
              </Button>
            );
          })}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" size="sm" onClick={() => setStudentToMove(null)} className="w-full text-xs">
            취소
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
