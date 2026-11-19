'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { IncidentType, IncidentStatus } from '@/lib/safety/types';
import { saveSafetyIncident } from '@/lib/services/safetyService';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface SafetyNewIncidentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  currentUserEmail?: string;
  currentUserName?: string;
}

const INCIDENT_TYPES: IncidentType[] = [
  '낙상/넘어짐',
  '충돌/부딪힘',
  '베임/찰과상',
  '체육활동 부상',
  '화상',
  '교통/통학로 안전',
  '기타',
];

export function SafetyNewIncidentModal({
  open,
  onOpenChange,
  onSuccess,
  currentUserEmail = '',
  currentUserName = '안전지도교사',
}: SafetyNewIncidentModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [incidentDate, setIncidentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [incidentTime, setIncidentTime] = useState(format(new Date(), 'HH:mm'));
  const [location, setLocation] = useState('');
  const [type, setType] = useState<IncidentType>('낙상/넘어짐');
  const [victimName, setVictimName] = useState('');
  const [victimGradeClass, setVictimGradeClass] = useState('');
  const [description, setDescription] = useState('');
  const [firstAidGiven, setFirstAidGiven] = useState('');
  const [guardianNotified, setGuardianNotified] = useState(false);
  const [guardianNotificationTime, setGuardianNotificationTime] = useState('');
  const [followUpPlan, setFollowUpPlan] = useState('');
  const [status, setStatus] = useState<IncidentStatus>('RECEIVED');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!victimName.trim() || !location.trim() || !description.trim()) {
      toast({
        variant: 'destructive',
        title: '필수 항목 누락',
        description: '대상자명, 발생 장소, 사고 경위를 모두 입력해주세요.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await saveSafetyIncident({
        incidentDate,
        incidentTime,
        location: location.trim(),
        type,
        victimName: victimName.trim(),
        victimGradeClass: victimGradeClass.trim() || undefined,
        victimType: 'STUDENT',
        description: description.trim(),
        firstAidGiven: firstAidGiven.trim() || '현장 기본 조치',
        guardianNotified,
        guardianNotificationTime: guardianNotified ? (guardianNotificationTime || format(new Date(), 'HH:mm')) : undefined,
        followUpPlan: followUpPlan.trim() || '담임 및 안전담당 교사 사후 지도',
        handlerName: currentUserName,
        handlerEmail: currentUserEmail,
        status,
      });

      toast({
        title: '안전사고 접수 완료',
        description: `${victimName} 학생 관련 안전사고 대장이 성공적으로 등록되었습니다.`,
      });
      onSuccess();
      onOpenChange(false);
      // 폼 리셋
      setVictimName('');
      setVictimGradeClass('');
      setLocation('');
      setDescription('');
      setFirstAidGiven('');
      setFollowUpPlan('');
      setGuardianNotified(false);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '접수 실패',
        description: '안전사고 등록 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            신규 안전사고 접수 및 조치 등록
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">발생 일자 *</Label>
              <Input
                type="date"
                value={incidentDate}
                onChange={e => setIncidentDate(e.target.value)}
                className="h-8 text-xs bg-slate-50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">발생 시간 *</Label>
              <Input
                type="time"
                value={incidentTime}
                onChange={e => setIncidentTime(e.target.value)}
                className="h-8 text-xs bg-slate-50"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">사고 유형</Label>
              <Select value={type} onValueChange={(val) => setType(val as IncidentType)}>
                <SelectTrigger className="h-8 text-xs bg-slate-50 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="text-xs font-medium">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">발생 장소 *</Label>
              <Input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="예: 2층 복도, 체육관, 정문"
                className="h-8 text-xs bg-slate-50"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">대상 학생 성명 *</Label>
              <Input
                value={victimName}
                onChange={e => setVictimName(e.target.value)}
                placeholder="예: 홍길동"
                className="h-8 text-xs bg-slate-50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">학년 / 학급</Label>
              <Input
                value={victimGradeClass}
                onChange={e => setVictimGradeClass(e.target.value)}
                placeholder="예: 3학년 2반"
                className="h-8 text-xs bg-slate-50"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">사고 경위 및 부상 부위 *</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="사고가 발생한 구체적인 상황과 부상 부위(상처 등)를 기록하세요."
              rows={2}
              className="text-xs bg-slate-50 resize-none"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">현장 응급처치 및 보건실 연계</Label>
            <Input
              value={firstAidGiven}
              onChange={e => setFirstAidGiven(e.target.value)}
              placeholder="예: 보건실 즉시 이송, 소독 및 얼음찜질 완료"
              className="h-8 text-xs bg-slate-50"
            />
          </div>

          <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">학부모 통보 완료</span>
              <Switch
                checked={guardianNotified}
                onCheckedChange={setGuardianNotified}
              />
            </div>
            {guardianNotified && (
              <div className="pt-1 flex items-center gap-2">
                <Label className="text-[11px] text-slate-600 shrink-0">통보 시간:</Label>
                <Input
                  type="time"
                  value={guardianNotificationTime || format(new Date(), 'HH:mm')}
                  onChange={e => setGuardianNotificationTime(e.target.value)}
                  className="h-7 text-xs bg-white w-32"
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">재발 방지 및 후속 조치 계획</Label>
            <Input
              value={followUpPlan}
              onChange={e => setFollowUpPlan(e.target.value)}
              placeholder="예: 계단 미끄럼 방지 보강, 체육시간 안전수칙 재지도"
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
              className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
              사고 접수 완료
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
