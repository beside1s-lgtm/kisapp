'use client';

import { useState } from 'react';
import { getKisbusDb as db } from '@/lib/kisbus/firebase';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { RouteType } from '@/lib/kisbus/types';

/**
 * 좌석표를 다른 요일/노선으로 복사하는 다이얼로그 (teacher/bus/page.tsx에서 순수 이동).
 *
 * 원래부터 TeacherPage 내부 클로저를 참조하지 않는, props만으로 동작하는
 * 독립 컴포넌트였기 때문에 그대로 파일만 옮긴 것이다 (동작 변경 없음).
 */
export function WebCopySeatPlanDialog({ sourceRoute, sourceDay, routes, students, t, lang, iconOnly = false }: any) {
  const [selectedTypes, setSelectedTypes] = useState<RouteType[]>([sourceRoute.type]);
  const [selectedDays, setSelectedDays] = useState<string[]>([sourceDay]);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const toggleType = (type: RouteType) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleCopy = async () => {
    if (selectedDays.length === 0 || selectedTypes.length === 0) {
      toast({ title: 'Error', description: 'Select targets', variant: 'destructive' });
      return;
    }

    const confirmMsg = lang === 'ko'
      ? '선택한 노선과 요일로 복사하시겠습니까?'
      : 'Copy this seat plan to selected targets?';

    if (!window.confirm(confirmMsg)) return;

    try {
      const { doc, writeBatch } = require('firebase/firestore');
      const batch = writeBatch(db());
      let count = 0;

      const DAYS_MAP_LOCAL: Record<string, string> = {
        '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday',
        '목': 'Thursday', '금': 'Friday', '토': 'Saturday'
      };

      for (const day of selectedDays) {
        const dayKey = DAYS_MAP_LOCAL[day] || day;
        for (const type of selectedTypes) {
          if (day === sourceDay && type === sourceRoute.type) continue;

          const targetRoute = routes.find((r: any) =>
            r.busId === sourceRoute.busId &&
            r.dayOfWeek === dayKey &&
            r.type === type
          );

          if (targetRoute) {
            let finalSeating = sourceRoute.seating;

            if (type === 'Afternoon') {
              finalSeating = sourceRoute.seating.map((se: any) => {
                if (!se.studentId) return se;

                const student = students.find((s: any) => s.id === se.studentId);
                const hasAfterSchool = student?.afterSchoolClassIds?.[day];

                if (hasAfterSchool) {
                  return { ...se, studentId: '' };
                }
                return se;
              });
            }

            batch.update(doc(db(), 'routes', targetRoute.id), {
              seating: finalSeating
            });
            count++;
          }
        }
      }

      if (count > 0) {
        await batch.commit();
        toast({
          title: lang === 'ko' ? '복사 완료' : 'Copy Complete',
          description: lang === 'ko' ? '좌석표가 복사되었습니다.' : 'Seat plan copied successfully.'
        });
        setOpen(false);
      } else {
        toast({ title: 'Error', description: 'No matching routes found', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    }
  };

  const DAYS_LIST = ['월', '화', '수', '목', '금', '토'];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 sm:h-8 px-1.5 sm:px-2.5 border-blue-200 text-blue-600 hover:bg-blue-50 shrink-0 text-xs" title={lang === 'ko' ? '좌석 복사' : 'Copy Seating'}>
          <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span className="hidden 2xl:inline ml-1.5">{lang === 'ko' ? '좌석 복사' : 'Copy Seating'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{lang === 'ko' ? '좌석표 복사' : 'Copy Seat Plan'}</DialogTitle>
          <DialogDescription>
            {lang === 'ko'
              ? '현재 좌석표를 다른 요일이나 하교 노선으로 복사합니다.'
              : 'Copy current seating configuration to other days/routes.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 font-sans text-sm">
          <div className="grid gap-2">
            <label className="font-bold">{lang === 'ko' ? '대상 노선' : 'Target Routes'}</label>
            <div className="flex gap-4">
              {['Morning', 'Afternoon'].map((type) => {
                const isSelected = selectedTypes.includes(type as RouteType);
                const label = type === 'Morning'
                  ? (lang === 'ko' ? '등교' : 'Morning')
                  : (lang === 'ko' ? '하교' : 'Afternoon');
                return (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`type-${type}`}
                      checked={isSelected}
                      onCheckedChange={() => toggleType(type as RouteType)}
                    />
                    <label htmlFor={`type-${type}`} className="font-medium cursor-pointer">
                      {label}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2 mt-2">
            <label className="font-bold">{lang === 'ko' ? '대상 요일' : 'Target Days'}</label>
            <div className="flex flex-wrap gap-3">
              {DAYS_LIST.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day}`}
                      checked={isSelected}
                      onCheckedChange={() => toggleDay(day)}
                    />
                    <label htmlFor={`day-${day}`} className="font-medium cursor-pointer">
                      {day}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>{lang === 'ko' ? '취소' : 'Cancel'}</Button>
          <Button onClick={handleCopy}>{lang === 'ko' ? '복사 실행' : 'Copy'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
