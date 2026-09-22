'use client';

import type { RefObject } from 'react';
import { Download, GraduationCap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface GradeClassTreeItem {
  grade: string;
  classes: { classNum: string; count: number; key: string }[];
  totalCount: number;
}

/**
 * "진급 처리" 모달 (엑셀 서식 업로드 / 전교생 자동 진급).
 *
 * admin/students/page.tsx의 Dialog(isPromoteDialogOpen) 블록을 그대로
 * 옮긴 것으로, 상태와 처리 로직은 전부 부모(page.tsx)에 남아 있고
 * 이 컴포넌트는 순수하게 마크업만 담당한다 (동작 변경 없음).
 */
export interface PromoteStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gradeClassTree: GradeClassTreeItem[];
  promoteTemplateGrade: string;
  setPromoteTemplateGrade: (value: string) => void;
  promoteTemplateClass: string;
  setPromoteTemplateClass: (value: string) => void;
  promoteFileInputRef: RefObject<HTMLInputElement | null>;
  onDownloadTemplate: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAutoPromoteAll: () => void;
}

export function PromoteStudentsDialog({
  open,
  onOpenChange,
  gradeClassTree,
  promoteTemplateGrade,
  setPromoteTemplateGrade,
  promoteTemplateClass,
  setPromoteTemplateClass,
  promoteFileInputRef,
  onDownloadTemplate,
  onFileUpload,
  onAutoPromoteAll,
}: PromoteStudentsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs px-2.5 font-bold whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white shadow-xs">
          <GraduationCap className="mr-1.5 h-3.5 w-3.5" /> 진급 처리
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-purple-600" /> 새 학년 진급 일괄 처리
          </DialogTitle>
          <DialogDescription className="text-xs">
            새 학년도 개학 시 전교생의 학년/반 정보를 일괄 업로드하거나 1학년씩 일괄 진급합니다.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="excel" className="w-full py-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="excel" className="text-xs font-bold">진급 엑셀 파일 업로드</TabsTrigger>
            <TabsTrigger value="auto" className="text-xs font-bold">전교생 자동 +1학년 진급</TabsTrigger>
          </TabsList>

          <TabsContent value="excel" className="space-y-3 pt-3">
            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-950 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-purple-700" />
                  <span>진급 서식 양식 다운로드 (이전 학년 담임용)</span>
                </span>
              </div>

              <p className="text-purple-800 text-[11px] leading-relaxed">
                이전 학년 담임 교사가 직접 진급할 학생의 새 학년/반을 작성할 수 있도록, <strong>원하는 학년과 반을 선택하여 서식을 다운로드</strong>하세요.
              </p>

              {/* 학년 및 반 선택 필터 바 */}
              <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-purple-200">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-purple-900">학년 선택</Label>
                  <Select value={promoteTemplateGrade} onValueChange={(val) => {
                    setPromoteTemplateGrade(val);
                    setPromoteTemplateClass('all');
                  }}>
                    <SelectTrigger className="h-8 text-xs bg-purple-50/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 학년</SelectItem>
                      <SelectItem value="1">1학년</SelectItem>
                      <SelectItem value="2">2학년</SelectItem>
                      <SelectItem value="3">3학년</SelectItem>
                      <SelectItem value="4">4학년</SelectItem>
                      <SelectItem value="5">5학년</SelectItem>
                      <SelectItem value="6">6학년</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-purple-900">반 선택</Label>
                  <Select value={promoteTemplateClass} onValueChange={setPromoteTemplateClass}>
                    <SelectTrigger className="h-8 text-xs bg-purple-50/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 반</SelectItem>
                      {promoteTemplateGrade !== 'all' ? (
                        (gradeClassTree.find(g => g.grade === promoteTemplateGrade)?.classes || []).map(c => (
                          <SelectItem key={c.classNum} value={c.classNum}>{c.classNum}반 ({c.count}명)</SelectItem>
                        ))
                      ) : (
                        ['1', '2', '3', '4', '5', '6', '7', '8'].map(c => (
                          <SelectItem key={c} value={c}>{c}반</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={onDownloadTemplate}
                className="w-full h-8 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white shadow-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-white shrink-0" />
                {promoteTemplateGrade === 'all' ? '전체 학년' : `${promoteTemplateGrade}학년`} {promoteTemplateClass === 'all' ? '전체 반' : `${promoteTemplateClass}반`} 진급 서식 (.xlsx) 다운로드
              </Button>
            </div>

            <div className="space-y-1 pt-1">
              <Label className="text-xs font-bold text-slate-700">작성 완료된 진급 서식 엑셀 파일 업로드</Label>
              <Input type="file" ref={promoteFileInputRef} onChange={onFileUpload} accept=".xlsx, .xls" className="text-xs h-9 cursor-pointer" />
            </div>
          </TabsContent>

          <TabsContent value="auto" className="space-y-3 pt-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
              <p className="font-bold text-amber-900">자동 진급 규칙</p>
              <p className="text-amber-800">
                1학년 ➔ 2학년, 2학년 ➔ 3학년, 3학년 ➔ 4학년, 4학년 ➔ 5학년, 5학년 ➔ 6학년, 6학년 ➔ 졸업으로 전교생 학년이 +1 업데이트됩니다.
              </p>
            </div>
            <Button onClick={onAutoPromoteAll} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold">
              <Sparkles className="mr-1.5 h-4 w-4" /> 전교생 1학년씩 자동 진급 실행
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
