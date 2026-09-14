'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, UserCheck, X } from 'lucide-react';
import type { ConsultationConfig, BookingSlot } from '@/lib/types/homeroomClass';
import { onConsultationConfigUpdate, onConsultationSlotsUpdate } from '@/lib/services/homeroomClassService';

interface ParentConsultationModalProps {
  classKey: string;
  studentName?: string;
  userEmail?: string;
}

export const ParentConsultationModal: React.FC<ParentConsultationModalProps> = ({
  classKey,
  studentName,
  userEmail,
}) => {
  const router = useRouter();
  const [config, setConfig] = useState<ConsultationConfig | null>(null);
  const [slotsData, setSlotsData] = useState<Record<string, BookingSlot>>({});
  const [isOpen, setIsOpen] = useState(false);

  // 로컬 스토리지 무시 키 (다시 열지 않기)
  const dismissStorageKey = useMemo(() => {
    if (!classKey) return '';
    return `kis_consultation_dismissed_${classKey}_${config?.startDate || 'current'}`;
  }, [classKey, config?.startDate]);

  // 실시간 구독
  useEffect(() => {
    if (!classKey) return;

    const unsubConfig = onConsultationConfigUpdate(classKey, (cfg) => {
      setConfig(cfg);
    });

    const unsubSlots = onConsultationSlotsUpdate(classKey, (slots) => {
      setSlotsData(slots);
    });

    return () => {
      unsubConfig();
      unsubSlots();
    };
  }, [classKey]);

  // 상담 주간 유효 여부 및 학생 신청 여부 판별
  useEffect(() => {
    // 담임 교사가 학부모 신청을 시작(isOpen: true)하지 않았거나 일정이 없으면 팝업 띄우지 않음
    if (!config || !config.isOpen || !config.startDate || !config.endDate) {
      setIsOpen(false);
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isOngoing = todayStr >= config.startDate && todayStr <= config.endDate;

    // 기간이 아니면 노출 안 함
    if (!isOngoing) {
      setIsOpen(false);
      return;
    }

    // 학생이 이미 신청 완료했는지 확인
    const trimmedStudentName = (studentName || '').trim().toLowerCase();
    const isAlreadyBooked = Object.values(slotsData).some(
      (slot) =>
        slot.status === 'BOOKED' &&
        ((trimmedStudentName && (slot.bookedBy?.studentName || '').trim().toLowerCase() === trimmedStudentName) ||
          (userEmail && slot.bookedBy?.bookedByEmail?.toLowerCase() === userEmail.toLowerCase()))
    );

    if (isAlreadyBooked) {
      setIsOpen(false);
      return;
    }

    // 다시 보지 않기 여부 확인
    if (dismissStorageKey && typeof window !== 'undefined') {
      const isDismissed = localStorage.getItem(dismissStorageKey) === 'true';
      if (isDismissed) {
        setIsOpen(false);
        return;
      }
    }

    // 팝업 오픈
    setIsOpen(true);
  }, [config, slotsData, studentName, userEmail, dismissStorageKey]);

  const handleGoToApply = () => {
    setIsOpen(false);
    router.push('/parents/consultation');
  };

  const handleDismissForever = () => {
    if (dismissStorageKey && typeof window !== 'undefined') {
      localStorage.setItem(dismissStorageKey, 'true');
    }
    setIsOpen(false);
  };

  if (!isOpen || !config) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px] w-[95vw] rounded-2xl p-0 overflow-hidden border-indigo-200 shadow-xl z-[9999]">
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 p-5 sm:p-6 text-white text-center">
          <div className="w-12 h-12 bg-white/20 rounded-2xl mx-auto flex items-center justify-center mb-3 backdrop-blur-xs">
            <Calendar className="w-6 h-6 text-yellow-300" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-white">
            {config.title || '학부모 상담 주간 안내'}
          </DialogTitle>
          <DialogDescription className="text-indigo-100 text-xs sm:text-sm mt-1.5 leading-relaxed">
            자녀의 학교생활 및 학업 상담을 위한 상담 주간이 시작되었습니다.
            <br />
            원하시는 시간대를 선택하여 신청해 주세요.
          </DialogDescription>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 space-y-2 text-indigo-950">
            <div className="flex items-center gap-2 font-bold">
              <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                상담 기간: {config.startDate} ~ {config.endDate}
              </span>
            </div>
            <div className="flex items-center gap-2 font-bold">
              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                운영 시간: {config.dailyStartTime} ~ {config.dailyEndTime} (1인 {config.slotDuration}분 단위)
              </span>
            </div>
            <div className="flex items-center gap-2 font-semibold text-slate-600 pt-1 border-t border-indigo-200/50">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>신청 대상: {studentName ? `${studentName} 학부모님` : '학급 학부모님'}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            ※ 실시간 선착순으로 접수되며, 원하시는 시간대를 빠르게 확정하실 수 있습니다.
          </p>
        </div>

        <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDismissForever}
            className="text-xs text-slate-500 hover:text-slate-800 w-full sm:w-auto cursor-pointer"
          >
            이번 주간 다시 보지 않기
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="text-xs w-full sm:w-auto cursor-pointer"
            >
              닫기
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleGoToApply}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs w-full sm:w-auto cursor-pointer"
            >
              상담 신청하기
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
