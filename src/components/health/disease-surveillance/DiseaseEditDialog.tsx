'use client';

import React from 'react';
import { Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DiseaseRecord } from '@/lib/services/healthService';

interface DiseaseEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: DiseaseRecord | null;
  editDiseaseName: string;
  setEditDiseaseName: (name: string) => void;
  editDiseaseCategory: string;
  setEditDiseaseCategory: (category: string) => void;
  editStatus: 'isolated' | 'recovered' | 'observing';
  setEditStatus: (status: 'isolated' | 'recovered' | 'observing') => void;
  editCertificateSubmitted: boolean;
  setEditCertificateSubmitted: (submitted: boolean) => void;
  editNotes: string;
  setEditNotes: (notes: string) => void;
  isSaving: boolean;
  onSave: () => void;
}

const QUICK_DISEASE_CHIPS = [
  { name: '독감', cat: '감염병' },
  { name: '중이염', cat: '단순질병' },
  { name: '인후통', cat: '단순질병' },
  { name: '급성 장염', cat: '식중독' },
  { name: '감기/발열', cat: '단순질병' },
  { name: '식중독', cat: '식중독' },
  { name: '복통/위장염', cat: '단순질병' },
  { name: '코로나19', cat: '감염병' },
  { name: '수족구병', cat: '감염병' },
  { name: '기관지염/폐렴', cat: '단순질병' },
  { name: '유행성결막염', cat: '감염병' },
  { name: '두통', cat: '단순질병' },
  { name: '외상/염좌', cat: '단순질병' },
  { name: '알레르기/비염', cat: '단순질병' },
  { name: '치과 질환', cat: '단순질병' },
];

export function DiseaseEditDialog({
  open,
  onOpenChange,
  record,
  editDiseaseName,
  editDiseaseCategory,
  setEditDiseaseCategory,
  setEditDiseaseName,
  editStatus,
  setEditStatus,
  editCertificateSubmitted,
  setEditCertificateSubmitted,
  editNotes,
  setEditNotes,
  isSaving,
  onSave,
}: DiseaseEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Pencil className="w-4 h-4 text-indigo-600" />
            질병명 및 분류 수정
          </DialogTitle>
          <DialogDescription className="text-xs">
            {record && (
              <span className="font-semibold text-slate-800">
                {record.schoolLevel === 'staff' || record.targetType === 'staff' ? (
                  `[${record.staffDepartment || '교직원'}] ${record.studentName} (${record.staffPosition || '교직원'})`
                ) : (
                  `[${record.grade}-${record.classNum}] ${record.studentName} 학생${record.studentNum ? ` (${record.studentNum}번)` : ''}`
                )}
              </span>
            )}
            의 병명을 담당자가 확인된 명확한 질병명으로 수정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* 원본 결석 사유/증상 안내 카드 */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
            <span className="text-[11px] font-bold text-slate-500">원본 결석 사유 및 증상:</span>
            <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap break-keep">
              {record?.symptoms || record?.notes || '기재된 사유 없음'}
            </p>
          </div>

          {/* 빠른 질병명 선택 칩 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">자주 쓰이는 질병명 (클릭 시 자동 입력)</Label>
            <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1 bg-muted/20 border border-slate-200 rounded-lg">
              {QUICK_DISEASE_CHIPS.map(item => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    setEditDiseaseName(item.name);
                    setEditDiseaseCategory(item.cat);
                  }}
                  className={`px-2 py-1 rounded text-xs font-bold border transition-all ${
                    editDiseaseName === item.name
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          {/* 직접 입력 필드 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              질병명 (직접 입력 가능) <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={editDiseaseName}
              onChange={e => setEditDiseaseName(e.target.value)}
              placeholder="예: 독감, 중이염, 인후통, 장염..."
              className="h-9 text-xs"
            />
          </div>

          {/* 질병 분류 선택 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">질병 분류 (형태)</Label>
            <Select value={editDiseaseCategory} onValueChange={setEditDiseaseCategory}>
              <SelectTrigger className="h-9 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="감염병">
                  <span className="font-bold text-rose-700">감염병 (독감·코로나·수족구·결막염 등)</span>
                </SelectItem>
                <SelectItem value="단순질병">
                  <span className="font-bold text-sky-700">단순질병 (중이염·인후통·감기/발열 등)</span>
                </SelectItem>
                <SelectItem value="식중독">
                  <span className="font-bold text-amber-800">식중독 (급성 장염·식중독·노로바이러스 등)</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 상태 및 소견서 선택 (2열 배치) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">관리 상태</Label>
              <Select value={editStatus} onValueChange={(val: any) => setEditStatus(val)}>
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="observing">
                    <span className="font-bold text-amber-700">관찰중</span>
                  </SelectItem>
                  <SelectItem value="isolated">
                    <span className="font-bold text-rose-700">
                      {record?.schoolLevel === 'staff' ? '출근중지 (격리)' : '등교중지 (격리)'}
                    </span>
                  </SelectItem>
                  <SelectItem value="recovered">
                    <span className="font-bold text-emerald-700">
                      {record?.schoolLevel === 'staff' ? '완치 (출근재개)' : '완치 (출석/재개)'}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">소견서/진료확인서</Label>
              <Select
                value={editCertificateSubmitted ? 'submitted' : 'none'}
                onValueChange={val => setEditCertificateSubmitted(val === 'submitted')}
              >
                <SelectTrigger className="h-9 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submitted">
                    <span className="font-bold text-sky-700">제출완료 (확인)</span>
                  </SelectItem>
                  <SelectItem value="none">
                    <span className="font-medium text-slate-500">미제출</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 비고 수정 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">수정 비고 (선택)</Label>
            <Input
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              placeholder="예: 사유 확인 후 질병명 정제"
              className="h-8 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSaving || !editDiseaseName.trim()}
            onClick={onSave}
            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSaving ? '저장 중...' : '수정사항 저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
