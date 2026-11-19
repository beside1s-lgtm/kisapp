'use client';

/**
 * [방과후 관리자 › 전자결재 일괄 기안] 탭의 "방과후 강사료 증빙서류 결재" 카드
 * 기안문 작성(기안기)과 별도로, 교사가 상신한 출석부·강사출근부를 담당 부장이 결재하고 교감에게 상신한다.
 * 교감은 [방과후 증빙서류 결재] 페이지(/teacher/afterschool/evidence-approval)에서 결재한다.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileCheck2, Loader2, Send, Undo2, AlertTriangle, PenLine, Printer } from 'lucide-react';
import type { Course, SubmittedApprovalDoc } from '@/lib/afterschool/types';
import { useAuth } from '@/hooks/use-auth';
import { getOrgStructure } from '@/lib/services/settingsService';
import { findTeacherSignature, type TeacherSignatureBook } from '@/lib/teachers/teacherRegistry';
import { EvidenceBatchPrint } from '@/components/afterschool/EvidenceBatchPrint';
import {
  EVIDENCE_STAGE_LABEL,
  approveEvidenceAsManager,
  cancelManagerApproval,
  canManagerApprove,
  evidenceStage,
} from '@/lib/afterschool/evidenceApproval';

interface Props {
  courses: Course[];
  approvalDocs: SubmittedApprovalDoc[];
  sigBook: TeacherSignatureBook | null;
  onViewDoc: (course: Course, type: 'ATTENDANCE' | 'WORK_REGISTER') => void;
  onRequestSignature: (teacherName: string, teacherEmail: string) => void;
}

export function EvidenceApprovalCard({ courses, approvalDocs, sigBook, onViewDoc, onRequestSignature }: Props) {
  const { profile, user } = useAuth();
  const myEmail = String(profile?.email || user?.email || '').trim().toLowerCase();
  const myName = String(profile?.name || '').trim();
  const mySignature = findTeacherSignature(sigBook, myName, myEmail) || (profile as any)?.signature || '';

  const [vpEmail, setVpEmail] = useState('');
  useEffect(() => {
    getOrgStructure().then((org: any) => setVpEmail(String(org?.vicePrincipal || '').trim().toLowerCase())).catch(() => {});
  }, []);
  const vpName = (vpEmail && sigBook?.index.byEmail.get(vpEmail)?.name) || '';

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const docs = useMemo(
    () => approvalDocs.filter((d) => courseById.has(d.courseId) && courseById.get(d.courseId)?.status !== 'CANCELLED'),
    [approvalDocs, courseById]
  );
  const toApprove = docs.filter(canManagerApprove);
  const vpPending = docs.filter((d) => evidenceStage(d) === 'VP_PENDING');
  const approved = docs.filter((d) => evidenceStage(d) === 'APPROVED');
  const submittedCourseIds = new Set(docs.map((d) => d.courseId));
  const notSubmitted = courses.filter((c) => (c.status === 'OPEN' || c.status === 'CLOSED') && !submittedCourseIds.has(c.id));

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 같은 화면에서 바로 인쇄 창 (새 페이지를 열지 않음)
  const [printJob, setPrintJob] = useState<{ ids: string[]; manual: boolean } | null>(null);
  const toApproveKey = toApprove.map((d) => d.id).join(',');
  useEffect(() => {
    setSelected(new Set(toApprove.map((d) => d.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toApproveKey]);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleApprove = async () => {
    const ids = toApprove.filter((d) => selected.has(d.id)).map((d) => d.id);
    if (!ids.length) return alert('결재할 증빙서류를 선택해 주세요.');
    if (!vpEmail) return alert('시스템 설정 › 조직도에 교감 선생님이 지정되어 있지 않습니다. 먼저 교감을 지정해 주세요.');
    if (!mySignature) {
      if (confirm('결재에 사용할 부장 서명(도장)이 등록되어 있지 않습니다. 지금 등록하시겠습니까?')) onRequestSignature(myName, myEmail);
      return;
    }
    if (!confirm(`선택한 증빙서류 ${ids.length}건(출석부·강사출근부)을 부장 결재하고 교감 선생님(${vpName || vpEmail})께 상신하시겠습니까?`)) return;
    setBusy(true);
    try {
      await approveEvidenceAsManager(ids, { email: myEmail, name: myName, signature: mySignature }, vpEmail);
      alert(`${ids.length}건을 부장 결재하고 교감 선생님께 상신했습니다.`);
    } catch (e: any) {
      alert(`결재 처리 중 오류가 발생했습니다: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (d: SubmittedApprovalDoc) => {
    if (!confirm(`[${d.courseTitle}] 교감 상신을 취소하고 부장 결재 전 상태로 되돌리시겠습니까?`)) return;
    try {
      await cancelManagerApproval([d.id]);
    } catch (e: any) {
      alert(`상신 취소 실패: ${e?.message || e}`);
    }
  };

  const DocButtons = ({ d }: { d: SubmittedApprovalDoc }) => {
    const c = courseById.get(d.courseId);
    if (!c) return null;
    return (
      <div className="flex gap-1 shrink-0">
        <button type="button" onClick={() => onViewDoc(c, 'ATTENDANCE')} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700">
          출석부
        </button>
        <button type="button" onClick={() => onViewDoc(c, 'WORK_REGISTER')} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700">
          출근부
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex justify-between items-start gap-2">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            3. 방과후 강사료 증빙서류 결재 (출석부·강사출근부)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            기안문 작성과 별도로, 강사가 상신한 증빙서류를 부장이 결재하여 교감 선생님께 상신합니다. 교감 선생님은 [방과후 증빙서류 결재] 페이지에서 결재합니다.
          </p>
        </div>
        <FileCheck2 className="w-5 h-5 text-amber-500 shrink-0" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {[
          { label: '미제출 강좌', n: notSubmitted.length, cls: 'bg-slate-50 text-slate-700 border-slate-200' },
          { label: '부장 결재 대기', n: toApprove.length, cls: 'bg-amber-50 text-amber-800 border-amber-200' },
          { label: '교감 결재 대기', n: vpPending.length, cls: 'bg-blue-50 text-blue-800 border-blue-200' },
          { label: '결재 완료', n: approved.length, cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-2 ${s.cls}`}>
            <div className="text-lg font-black">{s.n}</div>
            <div className="text-[11px] font-bold">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1 text-slate-600">
        <div>• 결재 단계: 강사 상신 ➡️ 방과후 담당 부장 결재 ➡️ 교감 결재</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          • 결재자(부장): <b>{myName || myEmail}</b>
          {mySignature ? (
            <img src={mySignature} alt="부장 서명" className="h-6 object-contain" />
          ) : (
            <button type="button" onClick={() => onRequestSignature(myName, myEmail)} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300">
              <PenLine className="w-3 h-3" /> 서명 등록 필요
            </button>
          )}
        </div>
        <div>
          • 교감: {vpEmail ? <b>{vpName || vpEmail}</b> : <span className="text-rose-600 font-bold">조직도에 교감이 지정되지 않음</span>}
        </div>
      </div>

      {notSubmitted.length > 0 && (
        <div className="flex items-start gap-1.5 text-[11px] text-slate-500">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span>미제출: {notSubmitted.map((c) => c.title).join(', ')}</span>
        </div>
      )}

      {toApprove.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>부장 결재 대기 {toApprove.length}건</span>
            <button
              type="button"
              className="text-[11px] text-indigo-600"
              onClick={() => setSelected(selected.size === toApprove.length ? new Set() : new Set(toApprove.map((d) => d.id)))}
            >
              {selected.size === toApprove.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {toApprove.map((d) => (
              <label key={d.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 cursor-pointer">
                <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} className="w-4 h-4 accent-amber-600" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{d.courseTitle}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    강사 {d.instructorName} · 상신 {d.submittedAt}
                  </div>
                  {evidenceStage(d) === 'RETURNED' && (
                    <div className="text-[11px] text-rose-600 font-bold">교감 반려: {d.vpRejectReason}</div>
                  )}
                </div>
                <DocButtons d={d} />
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleApprove}
        disabled={busy || toApprove.length === 0}
        className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow"
      >
        {busy ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 결재 처리 중...</>
        ) : toApprove.length === 0 ? (
          <><CheckCircle2 className="w-3.5 h-3.5" /> 부장 결재할 증빙서류가 없습니다</>
        ) : (
          <><Send className="w-3.5 h-3.5" /> 증빙서류 부장 결재 및 교감 상신 ({toApprove.filter((d) => selected.has(d.id)).length}건)</>
        )}
      </button>

      {/* 교감 상신 없이 종이로 결재받을 때: 부장·교감 서명 칸이 빈 출석부·출근부를 일괄 출력 */}
      {(() => {
        const printIds = toApprove.filter((d) => selected.has(d.id)).map((d) => d.id);
        return (
          <button
            type="button"
            disabled={printIds.length === 0}
            onClick={() => setPrintJob({ ids: printIds, manual: true })}
            className="w-full bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-800 border border-slate-300 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5"
            title="교감 상신 없이 출력해서 수기로 결재받을 때 사용합니다. 부장·교감 서명 칸은 비워서 출력됩니다."
          >
            <Printer className="w-3.5 h-3.5" /> 증빙 서류 출력 — 수기 결재용, 부장·교감 서명 없음 ({printIds.length}건)
          </button>
        );
      })()}

      {vpPending.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-bold text-blue-800">교감 결재 대기 {vpPending.length}건</summary>
          <div className="mt-1.5 space-y-1.5">
            {vpPending.map((d) => (
              <div key={d.id} className="flex items-center gap-2 bg-blue-50/50 border border-blue-100 rounded-xl p-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 truncate">{d.courseTitle}</div>
                  <div className="text-[11px] text-slate-500">{EVIDENCE_STAGE_LABEL.VP_PENDING} · 부장 결재 {d.managerName}</div>
                </div>
                <DocButtons d={d} />
                <button type="button" onClick={() => handleCancel(d)} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-rose-200 text-rose-600 bg-white hover:bg-rose-50 flex items-center gap-1 shrink-0">
                  <Undo2 className="w-3 h-3" /> 상신 취소
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {approved.length > 0 && (
        <button
          type="button"
          onClick={() => setPrintJob({ ids: [], manual: false })}
          className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow"
        >
          <Printer className="w-3.5 h-3.5" /> 결재 완료 증빙서류 일괄 출력 ({approved.length}건) — 운영 결과 기안 별첨
        </button>
      )}

      {printJob && (
        <EvidenceBatchPrint ids={printJob.ids} manual={printJob.manual} autoPrint onClose={() => setPrintJob(null)} />
      )}

      {approved.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-bold text-emerald-800">결재 완료 {approved.length}건</summary>
          <div className="mt-1.5 space-y-1.5">
            {approved.map((d) => (
              <div key={d.id} className="flex items-center gap-2 bg-emerald-50/50 border border-emerald-100 rounded-xl p-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 truncate">{d.courseTitle}</div>
                  <div className="text-[11px] text-slate-500">
                    교감 결재 {d.vicePrincipalName || ''} {d.vicePrincipalApprovedAt ? `· ${new Date(d.vicePrincipalApprovedAt).toLocaleString('ko-KR')}` : ''}
                  </div>
                </div>
                <DocButtons d={d} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
