'use client';

/**
 * 방과후 강사료 증빙서류 결재 (교감)
 * 방과후 담당 부장이 결재하여 상신한 출석부·강사출근부를 기안기를 거치지 않고 이 페이지에서 결재·반려한다.
 * - 결재: 교감 선생님(조직도 vicePrincipal)만
 * - 열람: 교감, 교장, 방과후 담당 부장, 시스템 관리자
 */
import React, { Suspense, useEffect, useState } from 'react';
import { CheckCircle2, FileCheck2, Loader2, PenLine, Printer, Undo2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import type { Course, SubmittedApprovalDoc } from '@/lib/afterschool/types';
import { findTeacherSignature } from '@/lib/teachers/teacherRegistry';
import {
  approveEvidenceAsVicePrincipal,
  evidenceStage,
  returnEvidenceAsVicePrincipal,
} from '@/lib/afterschool/evidenceApproval';
import { EvidenceDocViewer, type EvidenceDocType } from '@/components/afterschool/EvidenceDocViewer';
import { SignatureRegisterModal } from '@/components/afterschool/teacher/SignatureRegisterModal';
import { useEvidenceData } from '@/components/afterschool/useEvidenceData';

function EvidenceApproval() {
  const {
    authLoading, profile, myEmail, myName, access, courseById, docs, enrollments,
    attendanceRecords, substituteRecords, settings, holidayDates, sigBook, reloadSigBook,
  } = useEvidenceData();
  const [viewing, setViewing] = useState<{ course: Course; type: EvidenceDocType; doc: SubmittedApprovalDoc } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [tab, setTab] = useState<'pending' | 'done'>('pending');

  const validDocs = docs.filter((d) => courseById.has(d.courseId));
  const pending = validDocs.filter((d) => evidenceStage(d) === 'VP_PENDING');
  const done = validDocs.filter((d) => evidenceStage(d) === 'APPROVED');
  const pendingKey = pending.map((d) => d.id).join(',');
  useEffect(() => {
    setSelected(new Set(pending.map((d) => d.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  const mySignature = findTeacherSignature(sigBook, myName, myEmail) || (profile as any)?.signature || '';
  const vp = { email: myEmail, name: myName, signature: mySignature };

  const handleApprove = async () => {
    const ids = pending.filter((d) => selected.has(d.id)).map((d) => d.id);
    if (!ids.length) return alert('결재할 증빙서류를 선택해 주세요.');
    if (!mySignature) {
      if (confirm('결재에 사용할 교감 서명(도장)이 등록되어 있지 않습니다. 지금 등록하시겠습니까?')) setSigModalOpen(true);
      return;
    }
    if (!confirm(`선택한 방과후 강사료 증빙서류 ${ids.length}건을 결재하시겠습니까?`)) return;
    setBusy(true);
    try {
      await approveEvidenceAsVicePrincipal(ids, vp);
      alert(`${ids.length}건 결재를 완료했습니다.`);
    } catch (e: any) {
      alert(`결재 처리 중 오류가 발생했습니다: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleReturn = async (d: SubmittedApprovalDoc) => {
    const reason = prompt(`[${d.courseTitle}] 반려 사유를 입력해 주세요. (방과후 담당 부장에게 돌아갑니다)`);
    if (reason === null) return;
    try {
      await returnEvidenceAsVicePrincipal([d.id], vp, reason);
    } catch (e: any) {
      alert(`반려 처리 실패: ${e?.message || e}`);
    }
  };

  if (authLoading || access === null) {
    return (
      <div className="flex justify-center py-40">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!access.canView) {
    return (
      <MainLayout title="방과후 증빙서류 결재">
        <div className="max-w-xl mx-auto py-20 text-center text-sm text-slate-600">
          교감 선생님(또는 교장·방과후 담당 부장·시스템 관리자)만 볼 수 있는 페이지입니다.
        </div>
      </MainLayout>
    );
  }

  const list = tab === 'pending' ? pending : done;

  return (
    <MainLayout title="방과후 증빙서류 결재">
      <div className="max-w-4xl mx-auto w-full px-2 sm:px-4 py-3 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1">
          <div className="font-bold text-sm flex items-center gap-1.5">
            <FileCheck2 className="w-4 h-4" /> 방과후 강사료 증빙서류 (출석부·강사출근부) 교감 결재
          </div>
          <p>방과후 담당 부장이 결재하여 상신한 증빙서류입니다. 각 강좌의 출석부·출근부를 확인한 뒤 결재하거나, 문제가 있으면 사유와 함께 반려해 주세요.</p>
          {!access.isVicePrincipal && <p className="font-bold text-rose-700">열람 전용입니다. 결재는 교감 선생님만 할 수 있습니다.</p>}
        </div>

        {access.isVicePrincipal && (
          <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
            결재 서명: <b>{myName}</b>
            {mySignature ? (
              <img src={mySignature} alt="교감 서명" className="h-7 object-contain" />
            ) : (
              <button type="button" onClick={() => setSigModalOpen(true)} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300">
                <PenLine className="w-3 h-3" /> 서명 등록 필요
              </button>
            )}
          </div>
        )}

        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {([['pending', `결재 대기 ${pending.length}`], ['done', `결재 완료 ${done.length}`]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === k ? 'bg-white shadow-xs text-blue-800' : 'text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'done' && done.length > 0 && (
          <a
            href="/teacher/afterschool/evidence-print"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-900"
          >
            <Printer className="w-3.5 h-3.5" /> 결재 완료 증빙서류 일괄 출력 ({done.length}건)
          </a>
        )}

        {list.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
            {tab === 'pending' ? '결재를 기다리는 증빙서류가 없습니다.' : '결재 완료된 증빙서류가 없습니다.'}
          </div>
        ) : (
          <div className="space-y-2">
            {tab === 'pending' && access.isVicePrincipal && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs font-bold text-indigo-600"
                  onClick={() => setSelected(selected.size === pending.length ? new Set() : new Set(pending.map((d) => d.id)))}
                >
                  {selected.size === pending.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
            )}
            {list.map((d) => {
              const c = courseById.get(d.courseId)!;
              return (
                <div key={d.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-3">
                  {tab === 'pending' && access.isVicePrincipal && (
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-blue-600"
                      checked={selected.has(d.id)}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          next.has(d.id) ? next.delete(d.id) : next.add(d.id);
                          return next;
                        })
                      }
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{d.courseTitle}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      강사 {d.instructorName} · 부장 결재 {d.managerName || ''}
                      {d.managerApprovedAt ? ` (${new Date(d.managerApprovedAt).toLocaleDateString('ko-KR')})` : ''}
                      {tab === 'done' && d.vicePrincipalApprovedAt ? ` · 교감 결재 ${new Date(d.vicePrincipalApprovedAt).toLocaleDateString('ko-KR')}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => setViewing({ course: c, type: 'ATTENDANCE', doc: d })} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50">
                      출석부
                    </button>
                    <button type="button" onClick={() => setViewing({ course: c, type: 'WORK_REGISTER', doc: d })} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50">
                      출근부
                    </button>
                    {tab === 'pending' && access.isVicePrincipal && (
                      <button type="button" onClick={() => handleReturn(d)} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center gap-1">
                        <Undo2 className="w-3 h-3" /> 반려
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'pending' && access.isVicePrincipal && pending.length > 0 && (
          <button
            type="button"
            onClick={handleApprove}
            disabled={busy}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-1.5 shadow"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            선택한 증빙서류 결재 ({pending.filter((d) => selected.has(d.id)).length}건)
          </button>
        )}
      </div>

      {viewing && (
        <EvidenceDocViewer
          course={viewing.course}
          docType={viewing.type}
          approvalDoc={docs.find((d) => d.id === viewing.doc.id) || viewing.doc}
          enrollments={enrollments}
          attendanceRecords={attendanceRecords}
          substituteRecords={substituteRecords}
          settings={settings}
          holidayDates={holidayDates}
          sigBook={sigBook}
          onClose={() => setViewing(null)}
        />
      )}

      {sigModalOpen && (
        <SignatureRegisterModal
          open={sigModalOpen}
          onOpenChange={setSigModalOpen}
          teacherName={myName}
          teacherEmail={myEmail}
          onSuccess={() => reloadSigBook()}
        />
      )}
    </MainLayout>
  );
}

export default function EvidenceApprovalPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <EvidenceApproval />
    </Suspense>
  );
}
