'use client';

import { useState, useEffect, useMemo } from 'react';
import { getKisbusDb as db } from '@/lib/kisbus/firebase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Bus, Teacher, Route } from '@/lib/kisbus/types';

/**
 * 교사 개인 담당 버스 설정 다이얼로그 (teacher/bus/page.tsx에서 순수 이동).
 *
 * 원래부터 TeacherPage 내부 클로저를 참조하지 않는, props만으로 동작하는
 * 독립 컴포넌트였기 때문에 그대로 파일만 옮긴 것이다 (동작 변경 없음).
 */
export function TeacherSettingsDialog({
  teacher, buses, routes = [], t, lang, teacherBadge
}: {
  teacher: Teacher; buses: Bus[]; routes?: Route[]; t: any; lang: string; teacherBadge?: React.ReactNode
}) {
  const [assignedBusId, setAssignedBusId] = useState(teacher?.assignedBusId || '');
  const [assignedAfterSchoolBusId, setAssignedAfterSchoolBusId] = useState(teacher?.assignedAfterSchoolBusId || '');
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && teacher) {
      setAssignedBusId(teacher.assignedBusId || '');
      setAssignedAfterSchoolBusId(teacher.assignedAfterSchoolBusId || '');
    }
  }, [open, teacher]);

  const commuteBuses = useMemo(() => {
    return buses.filter(bus =>
      routes.some(r => r.busId === bus.id && r.type !== 'AfterSchool')
    );
  }, [buses, routes]);

  const afterSchoolBuses = useMemo(() => {
    return buses.filter(bus =>
      routes.some(r => r.busId === bus.id && r.type === 'AfterSchool')
    );
  }, [buses, routes]);

  const handleSave = async () => {
    try {
      const { doc, updateDoc } = require('firebase/firestore');
      await updateDoc(doc(db(), 'teachers', teacher.id), {
        assignedBusId,
        assignedAfterSchoolBusId
      });
      toast({
        title: lang === 'ko' ? '설정 저장 완료' : 'Settings Saved',
        description: lang === 'ko' ? '담당 버스 설정이 업데이트되었습니다.' : 'Preferences updated successfully.',
      });
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {teacherBadge ? (
          <div className="flex items-center gap-2">
            {teacherBadge}
            <Button variant="outline" size="sm" className="h-8">
              <Settings className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">{lang === 'ko' ? '설정' : 'Settings'}</span>
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-8">
            <Settings className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">{lang === 'ko' ? '설정' : 'Settings'}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{lang === 'ko' ? '설정' : 'Settings'}</DialogTitle>
          <DialogDescription>
            {lang === 'ko' ? '담당 버스를 관리합니다.' : 'Manage your assigned buses.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 font-sans text-sm">
          <div className="grid gap-2">
            <label className="font-bold">{lang === 'ko' ? '담당 버스 (등하교)' : 'Assigned Bus (Morning/Afternoon)'}</label>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={assignedBusId === '' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setAssignedBusId('')}
              >
                {lang === 'ko' ? '미지정' : 'Unassigned'}
              </Button>
              {commuteBuses.map((bus) => (
                <Button
                   key={bus.id}
                  variant={assignedBusId === bus.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setAssignedBusId(bus.id)}
                >
                  {bus.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 mt-2">
            <label className="font-bold">{lang === 'ko' ? '담당 버스 (방과후)' : 'Assigned Bus (After School)'}</label>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={assignedAfterSchoolBusId === '' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setAssignedAfterSchoolBusId('')}
              >
                {lang === 'ko' ? '미지정' : 'Unassigned'}
              </Button>
              {afterSchoolBuses.map((bus) => (
                <Button
                  key={bus.id}
                  variant={assignedAfterSchoolBusId === bus.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setAssignedAfterSchoolBusId(bus.id)}
                >
                  {bus.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>{lang === 'ko' ? '취소' : 'Cancel'}</Button>
          <Button onClick={handleSave}>{lang === 'ko' ? '저장' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
