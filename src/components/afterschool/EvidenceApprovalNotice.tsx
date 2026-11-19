'use client';

/**
 * 교감 선생님에게만: 결재를 기다리는 방과후 강사료 증빙서류가 있으면 화면 상단에 알림 + 결재 페이지 바로가기
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileCheck2, ChevronRight } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { getOrgStructure } from '@/lib/services/settingsService';
import { evidenceStage } from '@/lib/afterschool/evidenceApproval';

export const EVIDENCE_APPROVAL_PATH = '/teacher/afterschool/evidence-approval';

let vpCache: { at: number; email: string } | null = null;
async function getVicePrincipalEmail(): Promise<string> {
  if (vpCache && Date.now() - vpCache.at < 5 * 60_000) return vpCache.email;
  const org: any = await getOrgStructure();
  vpCache = { at: Date.now(), email: String(org?.vicePrincipal || '').trim().toLowerCase() };
  return vpCache.email;
}

export function EvidenceApprovalNotice() {
  const { user, profile } = useAuth();
  const pathname = usePathname();
  const myEmail = String(profile?.email || user?.email || '').trim().toLowerCase();
  const [isVp, setIsVp] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!myEmail) return;
    let alive = true;
    getVicePrincipalEmail()
      .then((vp) => alive && setIsVp(Boolean(vp) && vp === myEmail))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [myEmail]);

  useEffect(() => {
    if (!isVp) return;
    const q = query(collection(getDb(), 'afterschool_approval_docs'), where('managerApproved', '==', true));
    return onSnapshot(
      q,
      (snap) => setCount(snap.docs.filter((d) => evidenceStage(d.data() as any) === 'VP_PENDING').length),
      () => setCount(0)
    );
  }, [isVp]);

  if (!isVp || count === 0 || pathname?.startsWith(EVIDENCE_APPROVAL_PATH)) return null;
  return (
    <Link
      href={EVIDENCE_APPROVAL_PATH}
      className="flex items-center justify-center gap-1.5 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3 shrink-0"
    >
      <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
      <span>결재를 기다리는 방과후 강사료 증빙서류 {count}건</span>
      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
    </Link>
  );
}
