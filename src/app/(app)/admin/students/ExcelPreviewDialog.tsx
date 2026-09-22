'use client';

import { AlertCircle, Bus, BookOpen, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { isStudentEmail } from '@/lib/services/masterStudentService';
import { cn } from '@/lib/kisbus/utils';

export interface ExcelPreviewRow {
  grade: string;
  classNum: string;
  studentNum: string;
  name: string;
  nameEn: string;
  gender: 'Male' | 'Female';
  studentEmail: string;
  contact: string;
  afterschoolStatus: string; // 방과후 수강 현황 (연동 결과)
  busStatus: string;         // 스쿨버스 노선 현황 (연동 결과)
  error?: string;            // 유효성 오류 메시지
}

/**
 * "엑셀 일괄 등록 미리보기" 모달.
 *
 * admin/students/page.tsx의 Dialog(isExcelPreviewOpen) 블록을 그대로
 * 옮긴 것으로, excelPreviewRows 상태와 최종 등록 로직은 전부
 * 부모(page.tsx)에 남아 있고 이 컴포넌트는 순수하게 마크업만 담당한다
 * (동작 변경 없음).
 */
export interface ExcelPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ExcelPreviewRow[];
  onCancel: () => void;
  onConfirmImport: () => void;
}

export function ExcelPreviewDialog({ open, onOpenChange, rows, onCancel, onConfirmImport }: ExcelPreviewDialogProps) {
  const errorCount = rows.filter(r => r.error).length;
  const validCount = rows.filter(r => !r.error && isStudentEmail(r.studentEmail)).length;
  const excludedCount = rows.filter(r => r.error || !isStudentEmail(r.studentEmail)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] w-full max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <CheckCheck className="h-4 w-4 text-indigo-600" /> 엑셀 일괄 등록 미리보기
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            총 <strong>{rows.length}명</strong>이 파싱되었습니다.
            방과후 수강 현황 및 스쿨버스 노선 연동 여부를 확인 후 최종 등록하세요.
            {errorCount > 0 && (
              <span className="text-rose-600 font-bold ml-1">
                (오류 {errorCount}명 - 등록 제외)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="whitespace-nowrap w-8">#</TableHead>
                <TableHead className="whitespace-nowrap">학년/반/번호</TableHead>
                <TableHead className="whitespace-nowrap">이름</TableHead>
                <TableHead className="whitespace-nowrap">영문이름</TableHead>
                <TableHead className="whitespace-nowrap">성별</TableHead>
                <TableHead className="whitespace-nowrap">계정(이메일)</TableHead>
                <TableHead className="whitespace-nowrap">학부모 연락처</TableHead>
                <TableHead className="whitespace-nowrap min-w-[140px]">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-emerald-600" /> 방과후 수강
                  </span>
                </TableHead>
                <TableHead className="whitespace-nowrap min-w-[140px]">
                  <span className="flex items-center gap-1">
                    <Bus className="w-3 h-3 text-sky-600" /> 스쿨버스 노선
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow
                  key={idx}
                  className={cn('text-xs', row.error ? 'bg-rose-50' : '')}
                >
                  <TableCell className="text-slate-400 font-mono">{idx + 1}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">
                    {row.grade}학년 {row.classNum}반 {row.studentNum ? `${row.studentNum}번` : ''}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-bold">{row.name}</TableCell>
                  <TableCell className="text-slate-500">{row.nameEn || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', row.gender === 'Female' ? 'border-rose-200 text-rose-600' : 'border-sky-200 text-sky-600')}>
                      {row.gender === 'Female' ? '여' : '남'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    {row.error ? (
                      <span className="flex items-center gap-1 text-rose-600 font-medium">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span className="truncate text-[10px]">{row.error}</span>
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-slate-700">{row.studentEmail || <span className="text-amber-500">이메일 없음</span>}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500">{row.contact || '-'}</TableCell>
                  <TableCell>
                    {row.afterschoolStatus === '없음' ? (
                      <span className="text-slate-400 text-[11px]">없음</span>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px] font-medium max-w-[130px] truncate block">
                        {row.afterschoolStatus}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.busStatus === '없음' ? (
                      <span className="text-slate-400 text-[11px]">없음</span>
                    ) : (
                      <Badge className="bg-sky-100 text-sky-800 border-0 text-[10px] font-medium max-w-[130px] truncate block">
                        {row.busStatus}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-100 shrink-0 flex items-center justify-between sm:justify-between gap-3">
          <div className="text-xs text-slate-500">
            유효한 계정: <strong className="text-indigo-700">{validCount}명</strong>
            {excludedCount > 0 && (
              <span className="text-rose-500 ml-2">
                (제외 {excludedCount}명)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="text-xs font-bold"
            >
              취소
            </Button>
            <Button
              size="sm"
              onClick={onConfirmImport}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
              {validCount}명 최종 등록
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
