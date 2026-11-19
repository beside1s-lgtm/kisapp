'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePathname } from 'next/navigation';
import { HandoverNotice, HandoverDocument } from '@/lib/types/handover';
import {
  getHandoverNotice,
  getHandoversByAuthor,
  getUncheckedHandoversForSuccessor,
  resolveTeacherAssignedDutiesList,
  isSameHandoverDuty,
  isHandoverEditableByAuthor,
  CURRENT_SCHOOL_YEAR
} from '@/lib/services/handoverService';
import { getOrgStructure } from '@/lib/services/settingsService';
import { HandoverPopupModal } from './HandoverPopupModal';
import { SuccessorHandoverPopupModal } from './SuccessorHandoverPopupModal';
import { FixtureSuccessorPopupModal } from './fixture/FixtureSuccessorPopupModal';
import { usePopupSlot } from '@/lib/popupQueue';
import { getUncheckedFixturesForSuccessor } from '@/lib/services/fixtureHandoverService';
import { FixtureHandoverDocument } from '@/lib/types/fixtureHandover';
import { getHandoverLockStatus } from '@/lib/services/handoverLockService';

export function HandoverPopupWatcher() {
  const { user, profile, loading, isParent } = useAuth();
  const pathname = usePathname();

  const [notice, setNotice] = useState<HandoverNotice | null>(null);
  const [userDoc, setUserDoc] = useState<HandoverDocument | null>(null);
  const [targetDuty, setTargetDuty] = useState<string | null>(null);
  const [remainingDuties, setRemainingDuties] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // 차년도 인수자 수신 확인 모달 상태
  const [successorDocs, setSuccessorDocs] = useState<HandoverDocument[]>([]);
  const [isSuccessorOpen, setIsSuccessorOpen] = useState(false);

  // 차년도 비품 인수자 확인·서명 모달 상태
  const [fixtureDocs, setFixtureDocs] = useState<FixtureHandoverDocument[]>([]);
  const [isFixtureOpen, setIsFixtureOpen] = useState(false);

  const checkedRef = useRef(false);
  // 사용자가 닫은 인수자 팝업은 이번 화면 세션 동안 다시 띄우지 않는다 (닫기 → 재검사 → 재오픈 반복 방지)
  const successorDismissedRef = useRef(false);
  const fixtureDismissedRef = useRef(false);

  const checkPendingHandovers = async (activeNotice?: HandoverNotice | null) => {
    if (!user?.email || !profile) return false;

    // 0. [인수인계 잠금 확인] 해당 학년도 인수인계가 잠김(마감) 상태인 경우 모든 로그인 팝업 차단
    const lockStatus = await getHandoverLockStatus(CURRENT_SCHOOL_YEAR).catch(() => null);
    if (lockStatus?.isLocked) {
      setIsOpen(false);
      setIsSuccessorOpen(false);
      setIsFixtureOpen(false);
      return false;
    }

    // 1. [최우선] 내가 차년도 인수자로 배정되었으나 아직 미확인한 인계서가 있는지 확인
    const uncheckedHandovers = successorDismissedRef.current
      ? []
      : await getUncheckedHandoversForSuccessor(user.email, CURRENT_SCHOOL_YEAR).catch(() => []);
    if (uncheckedHandovers.length > 0) {
      setSuccessorDocs(uncheckedHandovers);
      setIsSuccessorOpen(true);
      return true;
    }

    // 1-2. 내가 차년도 비품 인수자로 지정되었으나 아직 확인·서명하지 않은 비품 인계서
    const uncheckedFixtures = fixtureDismissedRef.current
      ? []
      : await getUncheckedFixturesForSuccessor(user.email, CURRENT_SCHOOL_YEAR).catch(() => []);
    if (uncheckedFixtures.length > 0) {
      setFixtureDocs(uncheckedFixtures);
      setIsFixtureOpen(true);
      return true;
    }

    // 2. [차선] 전 교원 인수인계 작성 요청 공지 팝업 확인
    const n = activeNotice ?? await getHandoverNotice();
    if (!n || !n.active) return false;

    const year = n.year || CURRENT_SCHOOL_YEAR;
    const [myDocs, org] = await Promise.all([
      getHandoversByAuthor(user.email, year),
      getOrgStructure().catch(() => null),
    ]);

    const assignedDuties = resolveTeacherAssignedDutiesList(user.email, org, profile.dept);
    const editableDoc = myDocs.find(d => isHandoverEditableByAuthor(d.status)) || null;
    const submittedDuties = myDocs
      .filter(d => !isHandoverEditableByAuthor(d.status))
      .flatMap(d => [d.primaryDuty, ...(d.subDuties || [])]);

    const unsubmittedAssigned = assignedDuties.filter(
      duty => !submittedDuties.some(sd => isSameHandoverDuty(sd, duty))
    );

    if (editableDoc) {
      setNotice(n);
      setUserDoc(editableDoc);
      setTargetDuty(editableDoc.primaryDuty || unsubmittedAssigned[0] || null);
      setRemainingDuties(unsubmittedAssigned);
      setIsOpen(true);
      return true;
    }

    if (unsubmittedAssigned.length > 0 || (myDocs.length === 0)) {
      setNotice(n);
      setUserDoc(null);
      setTargetDuty(unsubmittedAssigned[0] || assignedDuties[0] || null);
      setRemainingDuties(unsubmittedAssigned);
      setIsOpen(true);
      return true;
    }

    setIsOpen(false);
    return false;
  };

  useEffect(() => {
    // 미로그인, 로딩 중, 학부모 계정이면 스킵
    if (loading || !user?.email || isParent || !profile) return;

    // 인쇄 페이지, 로그인 화면 또는 이미 인수인계 대시보드 화면에 머물고 있으면 팝업 방어
    if (pathname.includes('/print') || pathname === '/login' || pathname.startsWith('/teacher/handover')) {
      return;
    }

    if (checkedRef.current) return;
    checkedRef.current = true;

    checkPendingHandovers().catch((err) => {
      console.warn('[HandoverPopupWatcher] check error:', err);
    });
  }, [user, profile, loading, isParent, pathname]);

  // 안전점검 등 다른 자동 팝업과 겹치지 않도록 차례가 올 때만 표시
  const wantsPopup = Boolean(
    (isSuccessorOpen && successorDocs.length > 0) ||
      (isFixtureOpen && fixtureDocs.length > 0) ||
      (notice && isOpen)
  );
  const canShowPopup = usePopupSlot('handover', wantsPopup);
  if (!canShowPopup) return null;

  return (
    <>
      {/* 1. 후임 인수자 수신 확인 팝업 모달 */}
      {isSuccessorOpen && successorDocs.length > 0 && profile && (
        <SuccessorHandoverPopupModal
          open={isSuccessorOpen}
          onOpenChange={open => {
            setIsSuccessorOpen(open);
            if (!open) {
              successorDismissedRef.current = true;
              // 인수자 확인 팝업이 닫히면 작성 공지 팝업 연쇄 검사
              checkPendingHandovers().catch(() => {});
            }
          }}
          documents={successorDocs}
          currentUserProfile={profile}
          onAllChecked={() => {
            setIsSuccessorOpen(false);
            checkPendingHandovers().catch(() => {});
          }}
        />
      )}

      {/* 1-2. 차년도 비품 인수자 확인·서명 팝업 모달 */}
      {!isSuccessorOpen && isFixtureOpen && fixtureDocs.length > 0 && profile && (
        <FixtureSuccessorPopupModal
          open={isFixtureOpen}
          onOpenChange={open => {
            setIsFixtureOpen(open);
            if (!open) {
              fixtureDismissedRef.current = true;
              setFixtureDocs([]);
              checkPendingHandovers().catch(() => {});
            }
          }}
          documents={fixtureDocs}
          currentUserProfile={profile}
        />
      )}

      {/* 2. 전 교원 인수인계서 작성 공지 및 간이 작성기 팝업 모달 */}
      {!isSuccessorOpen && !isFixtureOpen && notice && isOpen && user?.email && profile && (
        <HandoverPopupModal
          key={userDoc?.id || targetDuty || 'new_popup'}
          open={isOpen}
          onOpenChange={setIsOpen}
          notice={notice}
          currentUserProfile={profile}
          initialDoc={userDoc}
          defaultDuty={targetDuty}
          remainingDuties={remainingDuties}
          onSubmittedSuccess={async () => {
            const hasMore = await checkPendingHandovers(notice).catch(() => false);
            if (!hasMore) {
              setIsOpen(false);
            }
          }}
        />
      )}
    </>
  );
}
