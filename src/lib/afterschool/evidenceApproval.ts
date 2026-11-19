/**
 * 방과후 강사료 증빙서류(출석부·강사출근부) 결재 — 기안기(전자결재 기안문)와 별도로 진행
 *
 *   교사 상신(PENDING) ─▶ 방과후 담당 부장 결재(managerApproved) ─▶ 교감 결재(status: APPROVED, vicePrincipalApproved)
 *                                   ▲                                   │
 *                                   └──────── 교감 반려(사유) ◀─────────┘   (반려되면 부장 결재 전 단계로 돌아감)
 *
 * 문서: afterschool_approval_docs (강좌별 1건)
 */
import { doc, writeBatch, deleteField } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { SubmittedApprovalDoc } from '@/lib/afterschool/types';

export type EvidenceStage = 'SUBMITTED' | 'VP_PENDING' | 'APPROVED' | 'RETURNED';

export const EVIDENCE_STAGE_LABEL: Record<EvidenceStage, string> = {
  SUBMITTED: '부장 결재 대기',
  VP_PENDING: '교감 결재 대기',
  APPROVED: '결재 완료',
  RETURNED: '교감 반려 (부장 재검토)',
};

/** 문서의 결재 단계 */
export function evidenceStage(d: Partial<SubmittedApprovalDoc> | null | undefined): EvidenceStage {
  if (!d) return 'SUBMITTED';
  if (d.status === 'APPROVED' || d.vicePrincipalApproved) return 'APPROVED';
  if (d.managerApproved) return 'VP_PENDING';
  if (d.vpRejectReason) return 'RETURNED';
  return 'SUBMITTED';
}

/** 부장이 결재할 수 있는 문서 (제출됨 또는 교감 반려) */
export const canManagerApprove = (d: Partial<SubmittedApprovalDoc>) => {
  const s = evidenceStage(d);
  return d.status !== 'REJECTED' && (s === 'SUBMITTED' || s === 'RETURNED');
};

/** 교사가 회수할 수 있는지 (부장 결재 후에는 회수 불가) */
export const canTeacherRecall = (d: Partial<SubmittedApprovalDoc>) => {
  const s = evidenceStage(d);
  return s === 'SUBMITTED' || s === 'RETURNED';
};

export interface Approver {
  email: string;
  name: string;
  signature: string;
}

const nowIso = () => new Date().toISOString();

async function commitInChunks(ids: string[], data: (id: string) => Record<string, any>) {
  const db = getDb();
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => batch.update(doc(db, 'afterschool_approval_docs', id), data(id)));
    await batch.commit();
  }
}

/** 부장 결재 + 교감 상신 */
export async function approveEvidenceAsManager(ids: string[], manager: Approver, vicePrincipalEmail: string): Promise<void> {
  if (!ids.length) return;
  const at = nowIso();
  await commitInChunks(ids, () => ({
    managerApproved: true,
    managerSignature: manager.signature,
    managerName: manager.name,
    managerEmail: manager.email,
    managerApprovedAt: at,
    vicePrincipalEmail: vicePrincipalEmail || '',
    vpRequestedAt: at,
    vpRejectReason: deleteField(),
    vpRejectedAt: deleteField(),
  }));
}

/** 교감 결재 전이라면 부장이 상신을 취소(회수) */
export async function cancelManagerApproval(ids: string[]): Promise<void> {
  await commitInChunks(ids, () => ({
    managerApproved: false,
    managerSignature: deleteField(),
    managerApprovedAt: deleteField(),
    vpRequestedAt: deleteField(),
  }));
}

/** 교감 결재 (최종) */
export async function approveEvidenceAsVicePrincipal(ids: string[], vp: Approver): Promise<void> {
  if (!ids.length) return;
  const at = nowIso();
  await commitInChunks(ids, () => ({
    status: 'APPROVED',
    vicePrincipalApproved: true,
    vicePrincipalSignature: vp.signature,
    vicePrincipalName: vp.name,
    vicePrincipalEmail: vp.email,
    vicePrincipalApprovedAt: at,
  }));
}

/** 교감 반려: 부장 결재 전 단계로 되돌리고 사유를 남긴다 */
export async function returnEvidenceAsVicePrincipal(ids: string[], vp: Approver, reason: string): Promise<void> {
  if (!ids.length) return;
  const at = nowIso();
  await commitInChunks(ids, () => ({
    status: 'PENDING',
    managerApproved: false,
    managerSignature: deleteField(),
    managerApprovedAt: deleteField(),
    vicePrincipalApproved: false,
    vicePrincipalSignature: deleteField(),
    vpRejectReason: reason.trim() || '사유 미기재',
    vpRejectedAt: at,
    vpRejectedBy: vp.name,
  }));
}
