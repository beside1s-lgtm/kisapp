'use client';

import { RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { DeletedMasterStudent } from '@/lib/services/masterStudentService';

/**
 * "학생 계정 휴지통 (삭제 내역 및 복구)" 모달.
 *
 * admin/students/page.tsx의 Dialog(isTrashDialogOpen) 블록을 그대로
 * 옮긴 것으로, deletedStudents 상태와 복구/영구삭제 로직은 전부
 * 부모(page.tsx)에 남아 있고 이 컴포넌트는 순수하게 마크업만 담당한다
 * (동작 변경 없음).
 */
export interface TrashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deletedStudents: DeletedMasterStudent[];
  onRestore: (backupDocId: string, studentName: string) => void;
  onPurge: (student: DeletedMasterStudent, name?: string) => void;
}

export function TrashDialog({ open, onOpenChange, deletedStudents, onRestore, onPurge }: TrashDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[85vh] flex flex-col p-0 rounded-2xl overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
              <RotateCcw className="h-4 w-4 text-indigo-600" />
              <span>학생 계정 휴지통 (삭제 내역 및 복구)</span>
              <Badge variant="outline" className="text-xs bg-white text-slate-700 font-bold ml-1">
                총 {deletedStudents.length}명
              </Badge>
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 pt-1 leading-relaxed">
            실수로 삭제된 학생 계정을 1클릭으로 즉시 복구할 수 있습니다.
            <strong className="text-indigo-700 ml-1">스쿨버스 배정 및 방과후 수강 이력은 안전하게 영구 보존</strong>되어 있으므로,
            복구 시 기존 노선 및 강좌 데이터와 즉시 다시 100% 자동 재연결됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3">
          {deletedStudents.length > 0 ? (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="text-xs">
                  <TableHead className="whitespace-nowrap">삭제 일시</TableHead>
                  <TableHead className="whitespace-nowrap">학년/반/번호</TableHead>
                  <TableHead className="whitespace-nowrap">이름</TableHead>
                  <TableHead className="whitespace-nowrap">학생 계정</TableHead>
                  <TableHead className="whitespace-nowrap text-right">작업 (복구 / 전학 완전삭제)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deletedStudents.map((ds) => (
                  <TableRow key={ds.studentId || ds.studentEmail} className="hover:bg-slate-50/80 text-xs">
                    <TableCell className="whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {ds.deletedAt ? new Date(ds.deletedAt).toLocaleString('ko-KR', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                      }) : '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium text-slate-700">
                      {ds.grade}학년 {ds.classNum}반 {ds.studentNum ? `${ds.studentNum}번` : ''}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-bold text-slate-900">
                      {ds.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-[11px] text-slate-600">
                      {ds.studentEmail || '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRestore(ds.studentId || ds.studentEmail, ds.name)}
                          className="h-7 text-xs px-2.5 font-bold border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 shadow-2xs"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> 복구
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onPurge(ds, ds.name)}
                          className="h-7 text-xs px-2 text-rose-600 hover:bg-rose-50 border-rose-200 font-bold"
                          title="전학/자퇴: 스쿨버스 좌석 반환, 방과후 취소, 모든 데이터 영구 파기"
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> 전학 완전삭제
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-600">휴지통이 비어 있습니다.</p>
              <p className="text-[11px] text-slate-400">삭제된 학생 계정이 없습니다.</p>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t border-slate-200 bg-slate-50/50 shrink-0 flex items-center justify-between sm:justify-between">
          <span className="text-[11px] text-slate-500">
            💡 복구 시 학생 계정, 프로필, 스쿨버스 노선, 방과후 정보가 원상태로 복원됩니다.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-bold px-4"
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
