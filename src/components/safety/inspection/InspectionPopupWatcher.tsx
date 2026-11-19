'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePathname } from 'next/navigation';
import type { SchoolFacility } from '@/lib/safety/types';
import { getTeacherPendingInspections, isInspectionPopupAllowed } from '@/lib/services/safetyService';
import { MonthlyInspectionPopupModal } from './MonthlyInspectionPopupModal';
import { format } from 'date-fns';
import { usePopupSlot } from '@/lib/popupQueue';

export function InspectionPopupWatcher() {
  const { user, profile, loading, isParent } = useAuth();
  const pathname = usePathname();

  const [pendingFacilities, setPendingFacilities] = useState<SchoolFacility[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    // 학부모/학생이거나 미로그인 또는 로딩 중이면 제외
    if (loading || !user || isParent) return;

    // 인쇄 모달이나 로그인 페이지 등에서는 방해되지 않도록 방어
    if (pathname.includes('/print') || pathname === '/login') return;

    // 세션당 1회 최초 체크 (단, 다음 접속/새로고침 시에는 다시 체크됨)
    if (checkedRef.current) return;
    checkedRef.current = true;

    async function checkInspection() {
      // 1. 매월 4일 이후 및 학사 일정 1학기/2학기 기간 내(방학 배제) 검사
      const allowedCheck = await isInspectionPopupAllowed();
      if (!allowedCheck.allowed) {
        return;
      }

      const currentYM = format(new Date(), 'yyyy-MM');
      const teacherEmail = user?.email || undefined;
      const teacherName = profile?.name || user?.displayName || undefined;

      try {
        const res = await getTeacherPendingInspections(teacherEmail, teacherName, currentYM);
        if (res.pendingFacilities.length > 0) {
          setPendingFacilities(res.pendingFacilities);
          // 팝업 열기
          setIsOpen(true);
        }
      } catch (err) {
        console.warn('[InspectionPopupWatcher] check pending error:', err);
      }
    }

    checkInspection();
  }, [user, profile, loading, isParent, pathname]);

  // 다른 자동 팝업(인수인계 등)과 겹치지 않도록 차례가 올 때만 표시
  const canShow = usePopupSlot('safety-inspection', isOpen && pendingFacilities.length > 0);

  if (!canShow) {
    return null;
  }

  return (
    <MonthlyInspectionPopupModal
      open={isOpen}
      onOpenChange={setIsOpen}
      pendingFacilities={pendingFacilities}
      onSubmitted={() => {
        setPendingFacilities([]);
        setIsOpen(false);
      }}
    />
  );
}
