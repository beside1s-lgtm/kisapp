'use client';

import type { RefObject } from 'react';
import { Camera, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Combobox } from '@/components/ui/combobox';
import { extractEnglishNameFromEmail } from '@/lib/services/masterStudentService';
import type { NewMasterStudent } from '@/lib/types/masterStudent';

/**
 * "개별 계정 추가" 모달.
 *
 * admin/students/page.tsx의 Dialog(isAddDialogOpen) 블록을 그대로
 * 옮긴 것으로, newStudent 상태와 등록/사진 처리 로직은 전부
 * 부모(page.tsx)에 남아 있고 이 컴포넌트는 순수하게 마크업만 담당한다
 * (동작 변경 없음).
 */
export interface AddStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newStudent: Partial<NewMasterStudent>;
  setNewStudent: (updater: (prev: Partial<NewMasterStudent>) => Partial<NewMasterStudent>) => void;
  addPhotoInputRef: RefObject<HTMLInputElement | null>;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  destinationOptions: { value: string; label: string }[];
  onCreateStudent: () => void;
}

export function AddStudentDialog({
  open,
  onOpenChange,
  newStudent,
  setNewStudent,
  addPhotoInputRef,
  onPhotoChange,
  destinationOptions,
  onCreateStudent,
}: AddStudentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs px-2.5 font-bold whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> 개별 계정 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[680px] w-[96vw] max-h-[88vh] overflow-y-auto overflow-x-hidden p-6 sm:p-7 rounded-2xl">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-lg font-bold">새 학생 마스터 계정 등록</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            학생 이메일 계정(2023kangdongyun@kshcm.net) 기반으로 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          {/* 학생 사진 등록 섹션 (가로세로 2cm 최적화) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="font-bold text-slate-800 text-xs">학생 사진 등록 (가로세로 2cm 최적화)</span>
              <Badge variant="outline" className="text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700 font-medium px-1.5 py-0">
                PC 최적 해상도 160x160 자동 압축
              </Badge>
            </div>
            <div className="flex items-center gap-3.5">
              <Avatar className="rounded-2xl border-2 border-indigo-200 shadow-2xs shrink-0 bg-white" style={{ width: '2cm', height: '2cm' }}>
                {newStudent.photoUrl ? (
                  <AvatarImage src={newStudent.photoUrl} alt={newStudent.name || '학생'} className="object-cover rounded-2xl" />
                ) : (
                  <AvatarFallback className="bg-indigo-50 text-indigo-700 font-bold text-xs rounded-2xl">
                    사진 없음
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    type="file"
                    ref={addPhotoInputRef}
                    onChange={onPhotoChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addPhotoInputRef.current?.click()}
                    className="h-7 text-xs px-2.5 bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1" />
                    사진 선택
                  </Button>
                  {newStudent.photoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewStudent(prev => ({ ...prev, photoUrl: '' }))}
                      className="h-7 text-xs px-2 text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      삭제
                    </Button>
                  )}
                </div>
                <p className="text-[10.5px] text-slate-500 leading-snug">
                  선택한 사진을 2cm 정사각형으로 리사이징하여 용량을 최소화합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold">학생 이메일 계정 (학부모 겸용)</Label>
            <Input
              placeholder="예: 2023kangdongyun@kshcm.net"
              value={newStudent.studentEmail}
              onChange={e => {
                const val = e.target.value;
                setNewStudent(prev => ({
                  ...prev,
                  studentEmail: val,
                  nameEn: prev.nameEn || extractEnglishNameFromEmail(val)
                }));
              }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold">학생 이름</Label>
              <Input
                placeholder="예: 강동윤"
                value={newStudent.name}
                onChange={e => setNewStudent(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">학생 영문 이름 (선택)</Label>
              <Input
                placeholder="예: Kang Dong-yun"
                value={newStudent.nameEn || ''}
                onChange={e => setNewStudent(prev => ({ ...prev, nameEn: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">학년</Label>
              <Input value={newStudent.grade} onChange={e => setNewStudent(prev => ({ ...prev, grade: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">반</Label>
              <Input value={newStudent.classNum} onChange={e => setNewStudent(prev => ({ ...prev, classNum: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">번호</Label>
              <Input value={newStudent.studentNum || ''} onChange={e => setNewStudent(prev => ({ ...prev, studentNum: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">성별</Label>
              <Select
                value={newStudent.gender || 'Male'}
                onValueChange={(val: 'Male' | 'Female') => setNewStudent(prev => ({ ...prev, gender: val }))}
              >
                <SelectTrigger className="h-9 text-xs">
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
            <Label className="text-xs">보호자 연락처</Label>
            <Input placeholder="010-0000-0000" value={newStudent.contact} onChange={e => setNewStudent(prev => ({ ...prev, contact: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-700 font-bold">등하교 목적지 (스쿨버스 정류장)</Label>
              <span className="text-[10px] text-indigo-600 font-medium">📍 정류장 검색 선택</span>
            </div>
            <Combobox
              options={destinationOptions}
              value={newStudent.address || null}
              onSelect={(val) => setNewStudent(prev => ({ ...prev, address: val || '' }))}
              placeholder="스쿨버스 정류장/목적지 검색 (예: Hung Vuong KFC, Sky 1,2...)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onCreateStudent} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold">등록하기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
