'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import type { SafetyZone, SafetyStatus, SafetyPatrolLog } from '@/lib/safety/types';
import { saveSafetyPatrolLog } from '@/lib/services/safetyService';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface SafetyNewPatrolModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  currentUserEmail?: string;
  currentUserName?: string;
}

const ZONES: SafetyZone[] = [
  '정문/통학로',
  '운동장/체육시설',
  '교사동 복도/계단',
  '특별실/실습실',
  '급식실/식당',
  '스쿨버스 승하차장',
];

export function SafetyNewPatrolModal({
  open,
  onOpenChange,
  onSuccess,
  currentUserEmail = '',
  currentUserName = '안전지도교사',
}: SafetyNewPatrolModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [zone, setZone] = useState<SafetyZone>('정문/통학로');
  const [patrolLeader, setPatrolLeader] = useState(currentUserName);
  const [companion, setCompanion] = useState('');
  const [overallStatus, setOverallStatus] = useState<SafetyStatus>('SAFE');
  const [specialNotes, setSpecialNotes] = useState('');
  const [actionTaken, setActionTaken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patrolLeader.trim()) {
      toast({ variant: 'destructive', title: '입력 확인', description: '순찰 책임자 성명을 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await saveSafetyPatrolLog({
        date,
        time,
        zone,
        patrolLeader: patrolLeader.trim(),
        patrolLeaderEmail: currentUserEmail,
        companionTeachers: companion.trim() ? companion.split(',').map(s => s.trim()) : [],
        overallStatus,
        specialNotes: specialNotes.trim() || '특이사항 없음',
        actionTaken: actionTaken.trim() || undefined,
      });

      toast({
        title: '순찰 일지 저장 완료',
        description: `${zone} 안전 순찰 일지가 등록되었습니다.`,
      });
      onSuccess();
      onOpenChange(false);
      // 폼 리셋
      setSpecialNotes('');
      setActionTaken('');
      setCompanion('');
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '저장 실패',
        description: '순찰 일지 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-rose-600" />
            신규 안전 순찰 일지 작성
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">순찰 일자</Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="h-8 text-xs bg-slate-50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">순찰 시간</Label>
              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="h-8 text-xs bg-slate-50"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">순찰 대상 구역</Label>
              <Select value={zone} onValueChange={(val) => setZone(val as SafetyZone)}>
                <SelectTrigger className="h-8 text-xs bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZONES.map(z => (
                    <SelectItem key={z} value={z} className="text-xs font-medium">{z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">종합 평가</Label>
              <Select value={overallStatus} onValueChange={(val) => setOverallStatus(val as SafetyStatus)}>
                <SelectTrigger className="h-8 text-xs bg-slate-50 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAFE" className="text-xs font-bold text-emerald-700">양호 (정상)</SelectItem>
                  <SelectItem value="WARNING" className="text-xs font-bold text-amber-700">주의 (관찰필요)</SelectItem>
                  <SelectItem value="DANGER" className="text-xs font-bold text-rose-700">위험 (즉시조치)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">순찰 책임자</Label>
              <Input
                value={patrolLeader}
                onChange={e => setPatrolLeader(e.target.value)}
                placeholder="성명"
                className="h-8 text-xs bg-slate-50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">동행자 (쉼표 구분)</Label>
              <Input
                value={companion}
                onChange={e => setCompanion(e.target.value)}
                placeholder="예: 배움터지킴이, 당직교사"
                className="h-8 text-xs bg-slate-50"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">순찰 내용 및 특이사항</Label>
            <Textarea
              value={specialNotes}
              onChange={e => setSpecialNotes(e.target.value)}
              placeholder="시설물 상태, 학생 보행 안전, 교통 흐름, 위험 요소 등을 기재하세요."
              rows={3}
              className="text-xs bg-slate-50 resize-none"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">현장 조치 또는 건의 사항</Label>
            <Input
              value={actionTaken}
              onChange={e => setActionTaken(e.target.value)}
              placeholder="예: 행정실 시설 보수 요청 접수 완료, 학생 이동 지도 완료"
              className="h-8 text-xs bg-slate-50"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              취소
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <ClipboardCheck className="w-3.5 h-3.5 mr-1" />}
              일지 저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
