'use client';

/**
 * 방과후 강사료 증빙서류 일괄 출력 페이지 (주소로 직접 열 때 — 내용은 EvidenceBatchPrint)
 *   /teacher/afterschool/evidence-print            결재 완료 전체
 *   /teacher/afterschool/evidence-print?ids=a,b    지정한 서류만
 *   /teacher/afterschool/evidence-print?mode=manual&ids=a,b
 *       수기 결재용: 결재 단계와 관계없이 지정한 서류를 부장·교감 서명 칸을 비워 출력
 * (방과후 관리자 화면의 출력 버튼은 이 페이지를 열지 않고 같은 화면에서 바로 인쇄 창을 띄운다)
 */
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { EvidenceBatchPrint } from '@/components/afterschool/EvidenceBatchPrint';

function EvidencePrint() {
  const params = useSearchParams();
  const ids = String(params.get('ids') || '').split(',').map((v) => v.trim()).filter(Boolean);
  return <EvidenceBatchPrint ids={ids} manual={params.get('mode') === 'manual'} />;
}

export default function EvidencePrintPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <EvidencePrint />
    </Suspense>
  );
}
