'use client';

import React, { useState } from 'react';
import { Download, ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export type ClassRecordExportOptions = { includePhotos: boolean; includeCounsel: boolean };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classLabel: string;
  academicYear: number;
  exporting: boolean;
  onExport: (opts: ClassRecordExportOptions) => void;
}

/** 학급 기록 내보내기(보관용) — 포함 항목 선택 + 개인정보 안내 */
export function ClassRecordExportDialog({ open, onOpenChange, classLabel, academicYear, exporting, onExport }: Props) {
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeCounsel, setIncludeCounsel] = useState(true);

  return (
    <Dialog open={open} onOpenChange={(v) => !exporting && onOpenChange(v)}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-black">학급 기록 내보내기 (보관용)</DialogTitle>
          <DialogDescription>
            {academicYear}학년도 {classLabel}의 자리배치·칭찬·숙제·알림장 기록을 브라우저로 열 수 있는 HTML 파일 하나로 내려받습니다.
            읽기 전용 보관본이라 앱 데이터는 바뀌지 않습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
            <Checkbox checked={includePhotos} onCheckedChange={(v) => setIncludePhotos(v === true)} className="mt-0.5" />
            <span>
              <span className="block text-sm font-bold text-slate-800">사진 포함</span>
              <span className="block text-xs text-slate-500">학생 사진과 사진 아바타를 파일 안에 넣습니다. 파일 크기가 커집니다.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
            <Checkbox checked={includeCounsel} onCheckedChange={(v) => setIncludeCounsel(v === true)} className="mt-0.5" />
            <span>
              <span className="block text-sm font-bold text-slate-800">상담·관찰 기록 포함</span>
              <span className="block text-xs text-slate-500">행동 관찰, 상담 메모, 학부모 상담 예약을 [관찰·상담] 탭과 학생 카드에 넣습니다.</span>
            </span>
          </label>
        </div>

        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <p>
            이 파일에는 학생 개인정보{includePhotos ? '(사진 포함)' : ''}
            {includeCounsel ? '와 상담·관찰 기록' : ''}이 들어 있습니다. 학교 업무용 저장소에만 보관하고,
            메신저·개인 메일로 보내거나 공유 폴더에 올리지 마세요. 보존 기간이 지나면 지워 주세요.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            취소
          </Button>
          <Button onClick={() => onExport({ includePhotos, includeCounsel })} disabled={exporting} className="gap-1 font-bold">
            <Download className="w-4 h-4" />
            {exporting ? '내보내는 중…' : '확인하고 내려받기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
