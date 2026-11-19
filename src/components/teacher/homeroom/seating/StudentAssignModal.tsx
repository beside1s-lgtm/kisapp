'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pin, PinOff, Search, User, UserX, Check, ArrowLeftRight } from 'lucide-react';
import type { MasterStudent } from '@/lib/types/masterStudent';
import type { DeskSlot } from '@/lib/types/seating';
import { isMaleStudent } from '@/lib/services/seatingService';

interface StudentAssignModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  targetSlot: DeskSlot | null;
  allSlots: DeskSlot[];
  students: MasterStudent[];
  onAssignStudent: (slotId: string, student: MasterStudent | null, isFixed: boolean) => void;
  onStartMove?: (slot: DeskSlot) => void;
}

export const StudentAssignModal: React.FC<StudentAssignModalProps> = ({
  isOpen,
  onOpenChange,
  targetSlot,
  allSlots,
  students,
  onAssignStudent,
  onStartMove,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // 현재 이미 배정(고정)된 학생 ID 맵
  const assignedMap = useMemo(() => {
    const map = new Map<string, DeskSlot>();
    allSlots.forEach((slot) => {
      if (slot.studentId) {
        map.set(slot.studentId, slot);
      }
    });
    return map;
  }, [allSlots]);

  // 검색 필터링된 학생 목록 (번호순 정렬)
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sorted = [...students].sort(
      (a, b) => (Number(a.studentNum) || 0) - (Number(b.studentNum) || 0) || a.name.localeCompare(b.name)
    );
    if (!q) return sorted;
    return sorted.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.studentNum && s.studentNum.includes(q))
    );
  }, [students, searchQuery]);

  if (!targetSlot) return null;

  const currentStudent = targetSlot.studentId
    ? students.find((s) => (s.studentId || s.id) === targetSlot.studentId)
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 rounded-2xl">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Pin className="w-4 h-4 text-orange-500" />
              <span>좌석 사전 지정 및 학생 배정</span>
            </span>
            <Badge variant="outline" className="text-xs bg-slate-100 font-semibold">
              {targetSlot.groupId ? `${targetSlot.groupId}분단/모둠 ` : ''}
              {targetSlot.row + 1}행 {targetSlot.col + 1}열
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            특정 학생을 미리 이 자리에 고정해 두면, 랜덤 배정을 돌려도 이 자리는 그대로 유지됩니다.
          </DialogDescription>
        </DialogHeader>

        {/* 현재 배정된 상태 박스 */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${targetSlot.isFixed ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-600'}`}>
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">현재 좌석 학생</div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                {currentStudent ? (
                  <>
                    <span>{currentStudent.studentNum ? `${currentStudent.studentNum}번 ` : ''}{currentStudent.name}</span>
                    {targetSlot.isFixed && (
                      <Badge className="bg-orange-500 text-white text-[10px] h-4 px-1 font-bold gap-0.5">
                        <Pin className="w-2.5 h-2.5" />
                        고정됨
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="text-slate-400">빈 좌석 (미배정)</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {currentStudent && (
              <>
                {onStartMove && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      onStartMove(targetSlot);
                    }}
                    className="h-7 text-xs font-bold gap-1 text-orange-600 border-orange-300 hover:bg-orange-50"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    <span>자리 옮기기</span>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onAssignStudent(targetSlot.id, currentStudent, !targetSlot.isFixed);
                    onOpenChange(false);
                  }}
                  className="h-7 text-xs font-bold gap-1 text-slate-700"
                >
                  {targetSlot.isFixed ? (
                    <>
                      <PinOff className="w-3 h-3 text-slate-500" />
                      <span>고정 해제</span>
                    </>
                  ) : (
                    <>
                      <Pin className="w-3 h-3 text-orange-500" />
                      <span>자리 고정</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onAssignStudent(targetSlot.id, null, false);
                    onOpenChange(false);
                  }}
                  className="h-7 text-xs font-bold gap-1 text-rose-600 hover:bg-rose-50"
                >
                  <UserX className="w-3 h-3" />
                  <span>비우기</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 학생 검색 */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="학생 이름 또는 번호 검색..."
            className="pl-9 h-9 text-xs rounded-xl"
          />
        </div>

        {/* 학생 목록 */}
        <ScrollArea className="h-64 border rounded-xl p-1 bg-white">
          <div className="space-y-1 p-1">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                검색된 학생이 없습니다.
              </div>
            ) : (
              filteredStudents.map((student) => {
                const sid = student.studentId || student.id || '';
                const isCurrent = targetSlot.studentId === sid;
                const assignedSlot = assignedMap.get(sid);
                const isAssignedElsewhere = assignedSlot && assignedSlot.id !== targetSlot.id;
                const isMale = isMaleStudent(student);

                return (
                  <button
                    key={sid}
                    type="button"
                    onClick={() => {
                      // 학생을 이 자리에 고정 배정
                      onAssignStudent(targetSlot.id, student, true);
                      onOpenChange(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-center justify-between text-xs transition-colors ${
                      isCurrent
                        ? 'bg-orange-50 border border-orange-200'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 w-6 text-right font-bold">
                        {student.studentNum || '-'}
                      </span>
                      <span className="font-bold text-slate-900">{student.name}</span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] h-4 px-1 ${
                          isMale
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {isMale ? '남' : '여'}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isCurrent ? (
                        <Badge className="bg-orange-500 text-white text-[10px] font-bold gap-0.5">
                          <Check className="w-2.5 h-2.5" />
                          현재 좌석 (고정)
                        </Badge>
                      ) : isAssignedElsewhere ? (
                        <Badge variant="outline" className="text-[10px] text-slate-500">
                          {assignedSlot.groupId ? `${assignedSlot.groupId}분단 ` : ''}배정됨
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-orange-600 font-bold hover:underline">
                          이 자리에 고정
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
