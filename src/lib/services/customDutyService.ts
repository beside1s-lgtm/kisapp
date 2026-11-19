import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { Attachment, OrgStructure, UserProfile } from '@/lib/types';
import type {
  CustomDutyChecklistItem,
  CustomDutyModuleKey,
  CustomDutyStandardDoc,
  CustomDutyTableRow,
  CustomDutyWorkspace,
  CustomFeatureUpgradeRequest,
  FeatureUpgradeRequestStatus,
  ResolvedCustomDuty,
} from '@/lib/types/customDuty';
import { serializeAttachmentsForTemplate } from './standardDocTemplateService';

const COLLECTION_NAME = 'system_task_templates';

/**
 * 이미 전용 시스템 페이지/모듈이 구현된 업무 키워드 또는 비업무 직책 판별.
 * 일치하지 않는 배정 업무(예: '신입생 모집', '영재교육 담당자', '특수교사' 등)는
 * 맞춤형 커스텀 업무 페이지(`/teacher/custom-duty`) 대상으로 자동 식별된다.
 */
const BUILTIN_DUTY_KEYWORDS = [
  '방과후',
  '스쿨버스',
  '차량',
  '통학버스',
  '버스',
  '학교체육',
  '학교 체육',
  '체육',
  'paps',
  '보건',
  '학생건강',
  '학생 건강',
  '안전지도',
  '학생안전',
  '학생 안전',
  '안전점검',
  '봉사활동',
  '인수인계',
  '교원복무',
  '교원 복무',
  '초과근무',
  '보결',
  '출결',
  '체험학습',
  '결석계',
  '학부모 신청서',
  '학생 계정',
  '학생계정',
  '시스템 설정',
  '시스템설정',
  '담임',
  '교과전담',
];

const LEADERSHIP_ONLY_REGEX = /^(교장|교감|행정실장|.*부장|.*총괄\s*업무|(유치원|초등|중등)\(.*|전임강사.*|원어민.*)$/;

export function normalizeDutyTitle(dutyName: string): string {
  return dutyName.trim().replace(/\s+/g, ' ');
}

export function isBuiltInOrExcludedDutyName(rawName?: string | null): boolean {
  if (!rawName) return true;
  const trimmed = normalizeDutyTitle(rawName);
  if (!trimmed) return true;
  if (LEADERSHIP_ONLY_REGEX.test(trimmed)) return true;

  const compact = trimmed.toLowerCase().replace(/\s+/g, '');
  return BUILTIN_DUTY_KEYWORDS.some((kw) => compact.includes(kw.toLowerCase().replace(/\s+/g, '')));
}

function utf8ToHex(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getCustomDutyWorkspaceId(dutyName: string): string {
  const clean = normalizeDutyTitle(dutyName);
  const hex = utf8ToHex(clean);
  if (hex.length <= 96) return `cdw__${hex}`;
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `cdw__${hex.slice(0, 72)}_${(hash >>> 0).toString(16)}`;
}

export function getCustomDutyHref(dutyName: string, upgradedRoute?: string): string {
  if (upgradedRoute?.trim()) return upgradedRoute.trim();
  return `/teacher/custom-duty?duty=${encodeURIComponent(normalizeDutyTitle(dutyName))}`;
}

/**
 * 조직도에서 특정 교원에게 배정된 커스텀(전용 모듈 미구현) 업무 목록 산출
 */
export function resolveAssignedCustomDuties(
  email?: string | null,
  org?: Partial<OrgStructure> | null,
  profile?: Partial<UserProfile> | null
): ResolvedCustomDuty[] {
  if (!email || !org || profile?.role === '강사' || profile?.role === 'parent') return [];
  const emailLower = email.trim().toLowerCase();
  const map = new Map<string, ResolvedCustomDuty>();

  const registerDuty = (
    rawName: string,
    source: ResolvedCustomDuty['source'],
    deptName?: string,
    owners?: string[]
  ) => {
    const clean = normalizeDutyTitle(rawName);
    if (!clean || isBuiltInOrExcludedDutyName(clean)) return;
    const workspaceId = getCustomDutyWorkspaceId(clean);
    const existing = map.get(clean);
    const mergedOwners = Array.from(
      new Set([...(existing?.ownerEmails || []), ...(owners || []).map((e) => e.toLowerCase())])
    );
    map.set(clean, {
      dutyName: clean,
      workspaceId,
      deptName: existing?.deptName || deptName,
      href: getCustomDutyHref(clean),
      source: existing?.source || source,
      ownerEmails: mergedOwners,
    });
  };

  // 1. customDutyRoles
  (org.customDutyRoles || []).forEach((role) => {
    if (!role.roleName) return;
    const assigned = role.teacherEmails?.some((e) => e?.trim().toLowerCase() === emailLower);
    if (assigned) {
      registerDuty(role.roleName, 'customRole', role.deptName, role.teacherEmails);
    }
  });

  // 2. 부서 세부 업무 (dept.tasks)
  (org.departments || []).forEach((dept) => {
    (dept.tasks || []).forEach((t) => {
      if (!t.taskName) return;
      if (t.assignedEmails?.some((e) => e?.trim().toLowerCase() === emailLower)) {
        registerDuty(t.taskName, 'deptTask', dept.name, t.assignedEmails);
      }
    });
  });

  // 3. 부서별 부원 배정 업무 (deptMemberDuties)
  if (org.deptMemberDuties) {
    for (const deptId in org.deptMemberDuties) {
      const deptObj = (org.departments || []).find((d) => d.id === deptId);
      const list = org.deptMemberDuties[deptId]?.[emailLower] || [];
      list.forEach((duty) => {
        if (duty) registerDuty(duty, 'memberDuty', deptObj?.name, [emailLower]);
      });
    }
  }

  // 4. 기본 특수직책 중 전용 페이지가 아직 없는 업무 (특수교사 / 사서교사)
  if (org.specialTeachers?.some((e) => e?.trim().toLowerCase() === emailLower)) {
    registerDuty('특수교육 / 도움반', 'baseRole', org.dutyRoleDepts?.['special'], org.specialTeachers);
  }
  if (org.librarianTeachers?.some((e) => e?.trim().toLowerCase() === emailLower)) {
    registerDuty('도서관 / 사서교사', 'baseRole', org.dutyRoleDepts?.['librarian'], org.librarianTeachers);
  }

  return Array.from(map.values());
}

/**
 * 학교 전체 조직도에 등록된 모든 커스텀 업무 목록 추출 (시스템 관리자 검수용)
 */
export function resolveAllOrgCustomDuties(org?: Partial<OrgStructure> | null): ResolvedCustomDuty[] {
  if (!org) return [];
  const map = new Map<string, ResolvedCustomDuty>();

  const registerDuty = (
    rawName: string,
    source: ResolvedCustomDuty['source'],
    deptName?: string,
    owners?: string[]
  ) => {
    const clean = normalizeDutyTitle(rawName);
    if (!clean || isBuiltInOrExcludedDutyName(clean)) return;
    const workspaceId = getCustomDutyWorkspaceId(clean);
    const existing = map.get(clean);
    const mergedOwners = Array.from(
      new Set([...(existing?.ownerEmails || []), ...(owners || []).filter(Boolean).map((e) => e.toLowerCase())])
    );
    map.set(clean, {
      dutyName: clean,
      workspaceId,
      deptName: existing?.deptName || deptName,
      href: getCustomDutyHref(clean),
      source: existing?.source || source,
      ownerEmails: mergedOwners,
    });
  };

  (org.customDutyRoles || []).forEach((role) => {
    if (role.roleName) registerDuty(role.roleName, 'customRole', role.deptName, role.teacherEmails);
  });

  (org.departments || []).forEach((dept) => {
    (dept.tasks || []).forEach((t) => {
      if (t.taskName) registerDuty(t.taskName, 'deptTask', dept.name, t.assignedEmails);
    });
  });

  if (org.deptMemberDuties) {
    for (const deptId in org.deptMemberDuties) {
      const deptObj = (org.departments || []).find((d) => d.id === deptId);
      for (const [memberEmail, duties] of Object.entries(org.deptMemberDuties[deptId] || {})) {
        (duties || []).forEach((duty) => {
          if (duty) registerDuty(duty, 'memberDuty', deptObj?.name, [memberEmail]);
        });
      }
    }
  }

  if ((org.specialTeachers || []).length > 0) {
    registerDuty('특수교육 / 도움반', 'baseRole', org.dutyRoleDepts?.['special'], org.specialTeachers);
  }
  if ((org.librarianTeachers || []).length > 0) {
    registerDuty('도서관 / 사서교사', 'baseRole', org.dutyRoleDepts?.['librarian'], org.librarianTeachers);
  }

  return Array.from(map.values());
}

function resolveDutyDeptAndOwnersFromOrg(
  dutyName: string,
  org?: Partial<OrgStructure> | null
): { deptName?: string; ownerEmails: string[] } {
  const clean = normalizeDutyTitle(dutyName);
  const all = resolveAllOrgCustomDuties(org);
  const matched = all.find((item) => normalizeDutyTitle(item.dutyName) === clean);
  return {
    deptName: matched?.deptName,
    ownerEmails: matched?.ownerEmails || [],
  };
}

export function buildInitialCustomWorkspace(
  dutyName: string,
  org?: Partial<OrgStructure> | null
): CustomDutyWorkspace {
  const clean = normalizeDutyTitle(dutyName);
  const workspaceId = getCustomDutyWorkspaceId(clean);
  const meta = resolveDutyDeptAndOwnersFromOrg(clean, org);
  return {
    id: workspaceId,
    kind: 'custom_duty_workspace',
    dutyName: clean,
    deptName: meta.deptName,
    description: '',
    ownerEmails: meta.ownerEmails,
    status: 'empty',
    standardDocs: [],
    referenceFiles: [],
    enabledModules: [],
    customTableColumns: [],
    customTableRows: [],
    customChecklist: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function getCustomDutyWorkspace(
  dutyName: string,
  org?: Partial<OrgStructure> | null
): Promise<CustomDutyWorkspace> {
  const workspaceId = getCustomDutyWorkspaceId(dutyName);
  const snap = await getDoc(doc(db, COLLECTION_NAME, workspaceId));
  if (snap.exists() && snap.data()?.kind === 'custom_duty_workspace') {
    const data = snap.data() as CustomDutyWorkspace;
    return {
      ...buildInitialCustomWorkspace(dutyName, org),
      ...data,
      id: snap.id,
      dutyName: data.dutyName || normalizeDutyTitle(dutyName),
    };
  }
  return buildInitialCustomWorkspace(dutyName, org);
}

export function onCustomDutyWorkspaceUpdate(
  dutyName: string,
  org: Partial<OrgStructure> | null | undefined,
  callback: (workspace: CustomDutyWorkspace) => void
): () => void {
  const clean = normalizeDutyTitle(dutyName);
  if (!clean) return () => {};
  const workspaceId = getCustomDutyWorkspaceId(clean);
  return onSnapshot(
    doc(db, COLLECTION_NAME, workspaceId),
    (snap) => {
      if (snap.exists() && snap.data()?.kind === 'custom_duty_workspace') {
        const data = snap.data() as CustomDutyWorkspace;
        callback({
          ...buildInitialCustomWorkspace(clean, org),
          ...data,
          id: snap.id,
          dutyName: data.dutyName || clean,
        });
      } else {
        callback(buildInitialCustomWorkspace(clean, org));
      }
    },
    (err) => {
      console.warn('[customDutyService] workspace snapshot error:', err);
      callback(buildInitialCustomWorkspace(clean, org));
    }
  );
}

export function onAllCustomDutyWorkspacesUpdate(
  callback: (workspaces: Record<string, CustomDutyWorkspace>) => void
): () => void {
  return onSnapshot(
    collection(db, COLLECTION_NAME),
    (snap) => {
      const map: Record<string, CustomDutyWorkspace> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        if (data?.kind === 'custom_duty_workspace') {
          map[d.id] = { ...data, id: d.id } as CustomDutyWorkspace;
        }
      });
      callback(map);
    },
    (err) => {
      console.warn('[customDutyService] all workspaces snapshot error:', err);
      callback({});
    }
  );
}

export async function getUpgradedCustomWorkspaces(): Promise<CustomDutyWorkspace[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as any))
      .filter(
        (d) =>
          d?.kind === 'custom_duty_workspace' &&
          (d.status === 'upgraded' || (Array.isArray(d.enabledModules) && d.enabledModules.length > 0))
      ) as CustomDutyWorkspace[];
  } catch (err) {
    console.warn('[customDutyService] getUpgradedCustomWorkspaces error:', err);
    return [];
  }
}

export async function saveCustomDutyWorkspace(
  workspace: CustomDutyWorkspace
): Promise<CustomDutyWorkspace> {
  const preparedRefFiles = await serializeAttachmentsForTemplate(
    workspace.referenceFiles || [],
    workspace.id
  );
  const preparedDocs: CustomDutyStandardDoc[] = [];
  for (const d of workspace.standardDocs || []) {
    preparedDocs.push({
      ...d,
      attachments: await serializeAttachmentsForTemplate(d.attachments || [], `${workspace.id}/${d.id}`),
    });
  }

  const next: CustomDutyWorkspace = {
    ...workspace,
    kind: 'custom_duty_workspace',
    standardDocs: preparedDocs,
    referenceFiles: preparedRefFiles,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, COLLECTION_NAME, next.id), next, { merge: true });
  return next;
}

/**
 * 업로드된 파일을 Firebase Storage에 저장하고, HTML/TXT인 경우 본문 텍스트 추출 미리보기도 반환한다.
 */
export async function uploadCustomDutyAttachmentFile(
  file: File,
  workspaceId: string
): Promise<{ attachment: Attachment; extractedHtml?: string }> {
  const lower = file.name.toLowerCase();
  let extractedHtml: string | undefined;

  if ((lower.endsWith('.html') || lower.endsWith('.htm') || lower.endsWith('.txt')) && file.size < 600_000) {
    try {
      const rawText = await file.text();
      if (lower.endsWith('.txt')) {
        extractedHtml = rawText
          .split(/\r?\n/)
          .map((line) => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;') || '<br/>'}</p>`)
          .join('');
      } else {
        const bodyMatch = rawText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        extractedHtml = bodyMatch ? bodyMatch[1] : rawText;
      }
    } catch {
      extractedHtml = undefined;
    }
  }

  const safeName = file.name.replace(/[^\w.\-가-힣]/g, '_');
  const storagePath = `attachments/custom-duties/${workspaceId}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  return {
    attachment: {
      name: file.name,
      size: file.size,
      data: url,
    },
    extractedHtml,
  };
}

export async function upsertCustomDutyStandardDoc(
  dutyName: string,
  docItem: CustomDutyStandardDoc,
  org?: Partial<OrgStructure> | null
): Promise<CustomDutyWorkspace> {
  const ws = await getCustomDutyWorkspace(dutyName, org);
  const existing = ws.standardDocs || [];
  const cleanDoc: CustomDutyStandardDoc = {
    ...docItem,
    templateKey: docItem.templateKey || `custom_duty__${ws.id}__${docItem.id}`,
    updatedAt: new Date().toISOString(),
  };

  let nextDocs = existing.some((d) => d.id === cleanDoc.id)
    ? existing.map((d) => (d.id === cleanDoc.id ? cleanDoc : d))
    : [...existing, cleanDoc];

  if (cleanDoc.isDefault) {
    nextDocs = nextDocs.map((d) => ({
      ...d,
      isDefault: d.id === cleanDoc.id,
    }));
  }

  return saveCustomDutyWorkspace({
    ...ws,
    standardDocs: nextDocs,
    updatedBy: cleanDoc.updatedBy,
  });
}

export async function deleteCustomDutyStandardDoc(
  dutyName: string,
  docId: string,
  org?: Partial<OrgStructure> | null
): Promise<CustomDutyWorkspace> {
  const ws = await getCustomDutyWorkspace(dutyName, org);
  return saveCustomDutyWorkspace({
    ...ws,
    standardDocs: (ws.standardDocs || []).filter((d) => d.id !== docId),
  });
}

export interface SubmitFeatureRequestInput {
  dutyName: string;
  deptName?: string;
  requesterEmail: string;
  requesterName: string;
  requestTitle: string;
  requestDescription: string;
  desiredModules?: CustomDutyModuleKey[];
  desiredColumnsText?: string;
  uploadedDocs: CustomDutyStandardDoc[];
  attachments: Attachment[];
  org?: Partial<OrgStructure> | null;
}

export async function submitCustomFeatureUpgradeRequest(
  input: SubmitFeatureRequestInput
): Promise<CustomFeatureUpgradeRequest> {
  const ws = await getCustomDutyWorkspace(input.dutyName, input.org);
  const now = new Date().toISOString();
  const reqId = `cfreq__${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const preparedAttachments = await serializeAttachmentsForTemplate(
    input.attachments || [],
    `requests/${reqId}`
  );
  const preparedDocs: CustomDutyStandardDoc[] = [];
  for (const d of input.uploadedDocs || []) {
    preparedDocs.push({
      ...d,
      attachments: await serializeAttachmentsForTemplate(d.attachments || [], `requests/${reqId}/${d.id}`),
    });
  }

  const reqDoc: CustomFeatureUpgradeRequest = {
    id: reqId,
    kind: 'custom_feature_request',
    workspaceId: ws.id,
    dutyName: ws.dutyName,
    deptName: input.deptName || ws.deptName,
    requesterEmail: input.requesterEmail,
    requesterName: input.requesterName,
    requestTitle: input.requestTitle.trim(),
    requestDescription: input.requestDescription.trim(),
    desiredModules: input.desiredModules || [],
    desiredColumnsText: input.desiredColumnsText?.trim() || '',
    uploadedDocs: preparedDocs,
    attachments: preparedAttachments,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, COLLECTION_NAME, reqId), reqDoc);

  // 워크스페이스 상태를 'requested'로 전환하고 첨부된 표준 기안서/참고자료를 동기화
  const mergedRefNames = new Set((ws.referenceFiles || []).map((f) => `${f.name}:${f.size || 0}`));
  const nextRefFiles = [...(ws.referenceFiles || [])];
  for (const att of preparedAttachments) {
    const key = `${att.name}:${att.size || 0}`;
    if (!mergedRefNames.has(key)) {
      mergedRefNames.add(key);
      nextRefFiles.push(att);
    }
  }

  await saveCustomDutyWorkspace({
    ...ws,
    status: ws.status === 'upgraded' ? 'upgraded' : 'requested',
    description: ws.description || input.requestDescription.trim(),
    referenceFiles: nextRefFiles,
    updatedBy: input.requesterEmail,
  });

  return reqDoc;
}

export function onCustomFeatureRequestsUpdate(
  callback: (requests: CustomFeatureUpgradeRequest[]) => void
): () => void {
  return onSnapshot(
    collection(db, COLLECTION_NAME),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...d.data(), id: d.id } as any))
        .filter((d) => d.kind === 'custom_feature_request') as CustomFeatureUpgradeRequest[];
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(list);
    },
    (err) => {
      console.warn('[customDutyService] requests snapshot error:', err);
      callback([]);
    }
  );
}

export async function getAllCustomFeatureRequests(): Promise<CustomFeatureUpgradeRequest[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    const list = snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as any))
      .filter((d) => d.kind === 'custom_feature_request') as CustomFeatureUpgradeRequest[];
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list;
  } catch (err) {
    console.warn('[customDutyService] getAll requests error:', err);
    return [];
  }
}

export interface ApplyFeatureUpgradeDecisionParams {
  request: CustomFeatureUpgradeRequest;
  status: FeatureUpgradeRequestStatus;
  adminNotes: string;
  handledBy: string;
  handledByName: string;
  enabledModules: CustomDutyModuleKey[];
  customTableColumns: string[];
  customChecklist: CustomDutyChecklistItem[];
  upgradedRoute?: string;
}

export async function applyFeatureUpgradeDecision(
  params: ApplyFeatureUpgradeDecisionParams
): Promise<void> {
  const now = new Date().toISOString();
  const { request } = params;

  const updatedReq: Partial<CustomFeatureUpgradeRequest> = {
    status: params.status,
    adminNotes: params.adminNotes.trim(),
    upgradedRoute: params.upgradedRoute?.trim() || '',
    handledBy: params.handledBy,
    handledByName: params.handledByName,
    handledAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, COLLECTION_NAME, request.id), updatedReq, { merge: true });

  // 워크스페이스 반영
  const ws = await getCustomDutyWorkspace(request.dutyName);
  const nextStatus =
    params.status === 'upgraded'
      ? 'upgraded'
      : params.status === 'in_review'
        ? 'in_progress'
        : params.status === 'rejected'
          ? (ws.enabledModules.length > 0 ? 'upgraded' : 'empty')
          : 'requested';

  const mergedChecklist: CustomDutyChecklistItem[] =
    params.customChecklist.length > 0
      ? params.customChecklist
      : ws.customChecklist;

  const wsPatch: CustomDutyWorkspace = {
    ...ws,
    status: nextStatus,
    enabledModules: params.enabledModules,
    customTableColumns:
      params.customTableColumns.length > 0
        ? params.customTableColumns
        : ws.customTableColumns,
    customChecklist: mergedChecklist,
    upgradedRoute: params.upgradedRoute?.trim() || ws.upgradedRoute || '',
    upgradedSummary:
      params.status === 'upgraded' || params.adminNotes.trim()
        ? params.adminNotes.trim()
        : ws.upgradedSummary,
    upgradedAt: params.status === 'upgraded' ? now : ws.upgradedAt,
    upgradedBy: params.status === 'upgraded' ? params.handledByName : ws.upgradedBy,
    updatedAt: now,
    updatedBy: params.handledBy,
  };

  await setDoc(doc(db, COLLECTION_NAME, ws.id), wsPatch, { merge: true });
}

export async function saveWorkspaceTableRows(
  dutyName: string,
  rows: CustomDutyTableRow[],
  updatedBy: string
): Promise<void> {
  const ws = await getCustomDutyWorkspace(dutyName);
  await setDoc(
    doc(db, COLLECTION_NAME, ws.id),
    {
      customTableRows: rows,
      updatedAt: new Date().toISOString(),
      updatedBy,
    },
    { merge: true }
  );
}

export async function saveWorkspaceChecklist(
  dutyName: string,
  items: CustomDutyChecklistItem[],
  updatedBy: string
): Promise<void> {
  const ws = await getCustomDutyWorkspace(dutyName);
  await setDoc(
    doc(db, COLLECTION_NAME, ws.id),
    {
      customChecklist: items,
      updatedAt: new Date().toISOString(),
      updatedBy,
    },
    { merge: true }
  );
}
