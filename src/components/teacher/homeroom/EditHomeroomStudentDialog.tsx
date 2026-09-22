'use client';

import type { ChangeEvent, RefObject } from 'react';
import { Camera, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { MasterStudent } from '@/lib/types/masterStudent';

/**
 * "개별 학생 정보 및 사진 수정" 모달.
 *
 * teacher/homeroom/page.tsx의 Dialog(isEditDialogOpen) 블록을 그대로
 * 옮긴 것으로, editStudentForm 상태와 저장/사진 변환 로직은 전부
 * 부모(page.tsx)에 남아 있고 이 컴포넌트는 순수하게 마크업만 담당한다
 * (동작 변경 없음).
 */
export interface EditHomeroomStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editStudentForm: Partial<MasterStudent>;
  setEditStudentForm: (updater: (prev: Partial<MasterStudent>) => Partial<MasterStudent>) => void;
  editPhotoInputRef: RefObject<HTMLInputElement | null>;
  onPhotoChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
}

export function EditHomeroomStudentDialog({
  open,
  onOpenChange,
  editStudentForm,
  setEditStudentForm,
  editPhotoInputRef,
  onPhotoChange,
  onSave,
}: EditHomeroomStudentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] w-[95vw] max-h-[88vh] overflow-y-auto p-6 rounded-2xl">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-indigo-600 shrink-0" /> 학급 학생 정보 및 사진 수정
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {editStudentForm.studentEmail} 학생의 프로필 사진 및 기본 정보를 수정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* 사진 등록 섹션 (가로세로 2cm 규격) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-slate-800 text-xs">학생 프로필 사진 (가로세로 2cm 규격)</span>
              <Badge variant="outline" className="text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700 font-medium px-2 py-0.5">
                PC 최적 160x160 자동 압축
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <Avatar className="rounded-2xl border-2 border-indigo-200 shadow-2xs shrink-0 bg-white" style={{ width: '2cm', height: '2cm' }}>
                {editStudentForm.photoUrl ? (
                  <AvatarImage src={editStudentForm.photoUrl} alt={editStudentForm.name || '학생'} className="object-cover rounded-2xl" />
                ) : (
                  <AvatarFallback className="bg-indigo-50 text-indigo-700 font-bold text-xs rounded-2xl">
                    사진 없음
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="file"
                    ref={editPhotoInputRef}
                    onChange={onPhotoChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => editPhotoInputRef.current?.click()}
                    className="h-8 text-xs px-3 bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold cursor-pointer shadow-2xs"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1" />
                    사진 업로드
                  </Button>
                  {editStudentForm.photoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditStudentForm(prev => ({ ...prev, photoUrl: '' }))}
                      className="h-8 text-xs px-2.5 text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      사진 삭제
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  사진을 선택하면 증명사진용 2cm 정사각형으로 자동 압축되어 즉시 적용됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* 인적사항 입력 필드 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">학생 이름</Label>
              <Input
                value={editStudentForm.name || ''}
                onChange={(e) => setEditStudentForm(prev => ({ ...prev, name: e.target.value }))}
                className="h-8 text-xs bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">학생 영문 이름</Label>
              <Input
                value={editStudentForm.nameEn || ''}
                onChange={(e) => setEditStudentForm(prev => ({ ...prev, nameEn: e.target.value }))}
                placeholder="예: Kwon Garim"
                className="h-8 text-xs bg-white font-medium"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">출석 번호</Label>
              <Input
                value={editStudentForm.studentNum || ''}
                onChange={(e) => setEditStudentForm(prev => ({ ...prev, studentNum: e.target.value }))}
                placeholder="예: 5"
                className="h-8 text-xs bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">성별</Label>
              <Select
                value={editStudentForm.gender || 'Male'}
                onValueChange={(val: any) => setEditStudentForm(prev => ({ ...prev, gender: val }))}
              >
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">남학생</SelectItem>
                  <SelectItem value="Female">여학생</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label className="text-xs font-bold text-slate-700">보호자 연락처</Label>
              <Input
                value={editStudentForm.contact || ''}
                onChange={(e) => setEditStudentForm(prev => ({ ...prev, contact: e.target.value }))}
                placeholder="010-0000-0000"
                className="h-8 text-xs bg-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">거주지 주소 / 스쿨버스 정류장</Label>
            <Input
              value={editStudentForm.address || ''}
              onChange={(e) => setEditStudentForm(prev => ({ ...prev, address: e.target.value }))}
              placeholder="예: 현대아파트 앞"
              className="h-8 text-xs bg-white"
            />
          </div>
        </div>

        <DialogFooter className="pt-2 border-t flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-medium"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            저장 완료
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
