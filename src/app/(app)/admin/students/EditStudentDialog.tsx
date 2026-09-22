'use client';

import type { RefObject } from 'react';
import { Camera, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Combobox } from '@/components/ui/combobox';
import type { MasterStudent } from '@/lib/types/masterStudent';

/**
 * "학생 마스터 정보 수정" 모달.
 *
 * admin/students/page.tsx의 Dialog(isEditDialogOpen) 블록을 그대로
 * 옮긴 것으로, editStudentForm 상태와 저장/삭제/사진 처리 로직은 전부
 * 부모(page.tsx)에 남아 있고 이 컴포넌트는 순수하게 마크업만 담당한다
 * (동작 변경 없음).
 */
export interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editStudentForm: Partial<MasterStudent>;
  setEditStudentForm: (updater: (prev: Partial<MasterStudent>) => Partial<MasterStudent>) => void;
  editPhotoInputRef: RefObject<HTMLInputElement | null>;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  destinationOptions: { value: string; label: string }[];
  students: MasterStudent[];
  onSave: () => void;
  onDeleteStudent: (student: MasterStudent | string) => void;
  onPurgeStudent: (student: MasterStudent | string, name?: string) => void;
}

export function EditStudentDialog({
  open,
  onOpenChange,
  editStudentForm,
  setEditStudentForm,
  editPhotoInputRef,
  onPhotoChange,
  destinationOptions,
  students,
  onSave,
  onDeleteStudent,
  onPurgeStudent,
}: EditStudentDialogProps) {
  const findEditTarget = (): MasterStudent | string | undefined => {
    const studentObj = students.find(
      s => s.studentId === editStudentForm.studentId || s.studentEmail === editStudentForm.studentEmail
    );
    return studentObj || editStudentForm.studentId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] w-[96vw] max-h-[88vh] overflow-y-auto overflow-x-hidden p-6 sm:p-7 rounded-2xl">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-indigo-600 shrink-0" /> 학생 마스터 정보 수정
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {editStudentForm.studentEmail} 학생의 계정 인적사항을 수정합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1 text-xs">
          {/* 학생 사진 등록 및 2cm 최적화 섹션 */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-slate-800 text-xs">학생 프로필 사진 (가로세로 2cm 규격)</span>
              <Badge variant="outline" className="text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700 font-medium px-2 py-0.5">
                PC 최적 해상도 160x160 자동 압축 (초경량)
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
              <div className="space-y-1.5 flex-1 min-w-0">
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
                    사진 업로드 / 변경
                  </Button>
                  {editStudentForm.photoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditStudentForm(prev => ({ ...prev, photoUrl: '' }))}
                      className="h-8 text-xs px-2 text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      사진 삭제
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed break-words whitespace-normal">
                  사진 등록 시 자동으로 가로세로 2cm 정사각형으로 리사이징되며, 최적 해상도로 용량이 최소화됩니다.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">학생 이메일 계정</Label>
            <Input value={editStudentForm.studentEmail || ''} disabled className="h-8 bg-slate-100 font-mono text-xs text-slate-600" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">학생 이름</Label>
              <Input
                value={editStudentForm.name || ''}
                onChange={e => setEditStudentForm(prev => ({ ...prev, name: e.target.value }))}
                className="h-8 text-xs font-medium"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">학생 영문 이름</Label>
              <Input
                value={editStudentForm.nameEn || ''}
                onChange={e => setEditStudentForm(prev => ({ ...prev, nameEn: e.target.value }))}
                placeholder="예: Kang Soobin"
                className="h-8 text-xs font-medium"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">학년</Label>
              <Input value={editStudentForm.grade || ''} onChange={e => setEditStudentForm(prev => ({ ...prev, grade: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">반</Label>
              <Input value={editStudentForm.classNum || ''} onChange={e => setEditStudentForm(prev => ({ ...prev, classNum: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">번호</Label>
              <Input value={editStudentForm.studentNum || ''} onChange={e => setEditStudentForm(prev => ({ ...prev, studentNum: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">성별</Label>
              <Select
                value={editStudentForm.gender || 'Male'}
                onValueChange={(val: 'Male' | 'Female') => setEditStudentForm(prev => ({ ...prev, gender: val }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="성별" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">남학생</SelectItem>
                  <SelectItem value="Female">여학생</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-600">보호자 연락처</Label>
            <Input value={editStudentForm.contact || ''} onChange={e => setEditStudentForm(prev => ({ ...prev, contact: e.target.value }))} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-700 font-bold">등하교 목적지 (스쿨버스 정류장)</Label>
              <span className="text-[10px] text-indigo-600 font-medium">📍 정류장 검색 선택</span>
            </div>
            <Combobox
              options={destinationOptions}
              value={editStudentForm.address || null}
              onSelect={(val) => setEditStudentForm(prev => ({ ...prev, address: val || '' }))}
              placeholder="스쿨버스 정류장/목적지 검색 (예: Hung Vuong KFC, Sky 1,2...)"
              modal={true}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-600 flex items-center justify-between">
              <span>배정된 스쿨버스</span>
              <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 font-normal">수정 불가 (조회 전용)</Badge>
            </Label>
            <Input value={editStudentForm.kisbusNo || editStudentForm.busSummary?.assignedBusName || '미배정 (자가 귀가)'} disabled className="h-8 bg-slate-100 font-mono text-xs text-slate-600 cursor-not-allowed" />
          </div>
        </div>
        <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between w-full">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const target = findEditTarget();
                if (target) onDeleteStudent(target);
              }}
              className="text-xs text-slate-600 hover:bg-slate-100 font-medium"
              title="실수 삭제 복구 가능 (휴지통 보관)"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> 삭제(휴지통)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const target = findEditTarget();
                if (target) onPurgeStudent(target, editStudentForm.name);
              }}
              className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold"
              title="전학/자퇴: 스쿨버스 좌석 반환, 방과후 취소, 계정 영구 삭제"
            >
              전학 완전삭제
            </Button>
          </div>
          <Button onClick={onSave} className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs px-5">수정 내용 저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
