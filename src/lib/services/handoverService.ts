import { getDb } from '@/lib/firebase';
import { buildStaffApiHeaders } from '@/lib/staffApiHeaders';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import {
  HandoverDocument,
  HandoverItem,
  HandoverNotice,
  HandoverPoolItem,
  TeacherAssignment,
  HandoverStatus
} from '@/lib/types/handover';
import { UserProfile, OrgStructure, GoogleDriveConfig, ApprovalDoc, DepartmentTask } from '@/lib/types';
import { getUsersDirectory, getTeacherSignaturesDirectory } from '@/lib/services/userService';
import { getTeacherStampSignature, isActualSignature } from '@/lib/safety/stampHelper';
import { formatServicePeriod } from '@/lib/handover/returningTeacher';
import {
  resolveDriveFoldersForDuties,
  inferHandoverCategoryFromTarget,
  getNormalizedTaskCompareKey,
} from '@/lib/drive/deptFolderMapping';
import {
  compareHandoverItemsTimeline,
  dedupeSystemTasksAgainstApprovals,
  inferHandoverPeriodFromDateStr,
  syncSystemDutyTasksIntoTimeline,
  TIMING_KIND_LABELS,
} from '@/lib/handover/systemDutyBlueprints';
import { getUpgradedCustomWorkspaces } from '@/lib/services/customDutyService';
import { getAllHandoverDutyTemplates } from '@/lib/services/handoverDutyTemplateService';
import { format } from 'date-fns';

const HANDOVER_DOCS_COL = 'handover_documents';
const HANDOVER_POOL_COL = 'handover_pool';
const TEACHER_ASSIGNMENTS_COL = 'teacher_assignments';
const SETTINGS_COL = 'settings';

export const CURRENT_SCHOOL_YEAR = 2026;

const DUTY_CORE_STOPWORDS = /(총괄|운영|관리|담당자|담당|업무)/g;

export function getDutyMatchCore(dutyName?: string | null): string {
  const norm = getNormalizedTaskCompareKey(dutyName || '');
  const stripped = norm.replace(DUTY_CORE_STOPWORDS, '');
  return stripped || norm;
}

export function isSameHandoverDuty(dutyA?: string | null, dutyB?: string | null): boolean {
  const a = getNormalizedTaskCompareKey(dutyA || '');
  const b = getNormalizedTaskCompareKey(dutyB || '');
  if (!a || !b) return false;
  if (a === b) return true;
  const coreA = getDutyMatchCore(dutyA);
  const coreB = getDutyMatchCore(dutyB);
  if (!coreA || !coreB) return false;
  return coreA === coreB || coreA.includes(coreB) || coreB.includes(coreA);
}

export function doesHandoverTextMatchDuty(text?: string | null, dutyName?: string | null): boolean {
  const normText = getNormalizedTaskCompareKey(text || '');
  const coreDuty = getDutyMatchCore(dutyName);
  if (!normText || !coreDuty || coreDuty.length < 2) return false;
  return normText.includes(coreDuty);
}

/**
 * 교사가 복수 업무를 각각 분리해 인수인계서를 작성할 때,
 * 현재 선택된 업무에 해당하지 않는 타 배정 업무의 누적 기안문서는 제외한다.
 */
export function filterPoolItemsForDuties(
  poolItems: HandoverPoolItem[],
  selectedDuties: string[],
  allAssignedDuties: string[]
): HandoverPoolItem[] {
  if (!selectedDuties.length || allAssignedDuties.length <= 1) return poolItems;

  const otherDuties = allAssignedDuties.filter(
    duty => !selectedDuties.some(sel => isSameHandoverDuty(sel, duty))
  );
  if (otherDuties.length === 0) return poolItems;

  return poolItems.filter(p => {
    const haystack = `${p.category || ''} ${p.documentTitle || ''} ${p.summary || ''} ${p.docNo || ''}`;
    const matchesSelected = selectedDuties.some(
      sel => isSameHandoverDuty(sel, p.category) || doesHandoverTextMatchDuty(haystack, sel)
    );
    if (matchesSelected) return true;

    const clearlyBelongsToOther = otherDuties.some(
      other => isSameHandoverDuty(other, p.category) || doesHandoverTextMatchDuty(haystack, other)
    );
    return !clearlyBelongsToOther;
  });
}

export async function deleteHandoverDraft(docId: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, HANDOVER_DOCS_COL, docId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;
  const data = snap.data() as HandoverDocument;
  if (data.status !== 'DRAFT' && data.status !== 'REJECTED') {
    throw new Error('작성 중 또는 반려된 인수인계서만 삭제할 수 있습니다.');
  }
  await deleteDoc(docRef);
}

/**
 * 학사 시기 순서(3월 신학기 → 1학기 → 1학기 말 → 여름방학 → 2학기 → 1월 학년말 → 1~2월 겨울방학 → 정기 → 미정기) 및
 * 동일 시기 내 생성일자·시각 오름차순으로 정렬
 */
export function compareHandoverItemsAsc(
  a: Pick<HandoverItem, 'date' | 'createdAt' | 'id'> & Partial<Pick<HandoverItem, 'period' | 'sortOrder'>>,
  b: Pick<HandoverItem, 'date' | 'createdAt' | 'id'> & Partial<Pick<HandoverItem, 'period' | 'sortOrder'>>
): number {
  return compareHandoverItemsTimeline(a, b);
}

/**
 * YYYY-MM-DD 날짜 문자열로부터 학사 시기(Timeline Group) 추론
 */
export function inferHandoverPeriodFromDate(dateStr?: string): string {
  return inferHandoverPeriodFromDateStr(dateStr);
}

function parseAnyTimestampToDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  if (typeof val?.toDate === 'function') {
    const d = val.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof val?.seconds === 'number') {
    const d = new Date(val.seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof val?._seconds === 'number') {
    const d = new Date(val._seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * 결재 문서의 실제 생성일자(YYYY-MM-DD), ISO 시각 및 학년도 산출
 */
export function resolveApprovalDocCreatedMeta(
  rawCreatedAt: any,
  fallbackRaw?: any
): { createdDateStr: string; createdIso: string; schoolYear: number } {
  const dt = parseAnyTimestampToDate(rawCreatedAt) || parseAnyTimestampToDate(fallbackRaw) || new Date();
  const createdDateStr = format(dt, 'yyyy-MM-dd');
  const createdIso = dt.toISOString();
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1;
  const schoolYear = m === 1 || m === 2 ? y - 1 : y;
  return { createdDateStr, createdIso, schoolYear };
}

// ─── 1. 개인 업무 인수인계 풀 (Pool) ─────────────────────────────

/**
 * 기안기 등에서 태깅된 업무 건을 개인 인수인계 풀에 저장
 */
export async function addHandoverPoolItem(
  item: Omit<HandoverPoolItem, 'id' | 'createdAt'>
): Promise<string> {
  const db = getDb();
  const poolRef = doc(collection(db, HANDOVER_POOL_COL));
  const newId = poolRef.id;

  const data: HandoverPoolItem = {
    ...item,
    id: newId,
    createdAt: serverTimestamp(),
  };

  await setDoc(poolRef, data);
  return newId;
}

/**
 * 교사의 인수인계 풀 목록 조회 (기안기에서 태깅된 건 및 기안 문서 자동 검색 통합)
 */
export async function getHandoverPoolForTeacher(
  email: string,
  year: number = CURRENT_SCHOOL_YEAR
): Promise<HandoverPoolItem[]> {
  const db = getDb();
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return [];

  const itemsMap = new Map<string, HandoverPoolItem>();

  try {
    // 1) handover_pool 컬렉션 조회
    const q1 = query(
      collection(db, HANDOVER_POOL_COL),
      where('userEmail', '==', normalizedEmail)
    );
    const snap1 = await getDocs(q1);
    snap1.forEach(d => {
      const data = d.data() as HandoverPoolItem;
      if (!data.year || data.year === year) {
        const createdIso = parseAnyTimestampToDate(data.createdAt)?.toISOString() || '';
        itemsMap.set(data.documentId || data.id, {
          ...data,
          id: d.id,
          createdAt: createdIso || data.createdAt,
        });
      }
    });
  } catch (err) {
    console.warn('[HandoverService] pool query error:', err);
  }

  try {
    // 2) approvals 컬렉션 중 addToHandover가 true이고 결재 완료(approved)된 기안 문서 보강 조회
    const q2 = query(
      collection(db, 'approvals'),
      where('requesterEmail', '==', normalizedEmail)
    );
    const snap2 = await getDocs(q2);
    snap2.forEach(d => {
      const docData = d.data() as any;
      if (docData.addToHandover && docData.status === 'approved') {
        const docId = d.id;
        if (!itemsMap.has(docId)) {
          const { createdDateStr, createdIso, schoolYear } = resolveApprovalDocCreatedMeta(
            docData.createdAt,
            docData.completedAt
          );
          if (schoolYear !== year) return;

          itemsMap.set(docId, {
            id: `approval_${docId}`,
            userEmail: normalizedEmail,
            userName: docData.requesterName || '',
            documentId: docId,
            sourceType: 'approval',
            docNo: docData.docNo || '',
            documentTitle: docData.title || '',
            category:
              docData.handoverCategory ||
              inferHandoverCategoryFromTarget(docData.driveTargetDeptName, docData.driveTargetTaskName),
            date: createdDateStr,
            summary: '',
            attachments: (docData.attachments || []).map((a: any) => ({
              name: a.name || '',
              url: a.url || a.data || '',
              size: a.size || 0
            })),
            folderUrl: docData.driveFileUrl || docData.driveTargetFolderUrl || '',
            year: year,
            createdAt: createdIso,
          });
        }
      }
    });
  } catch (err) {
    console.warn('[HandoverService] approvals handover query error:', err);
  }

  try {
    // 3) department_tasks 컬렉션 중 addToHandover가 true이고 업무 완료(completed)된 요청 보강 조회
    const q3 = query(
      collection(db, 'department_tasks'),
      where('creatorEmail', '==', normalizedEmail)
    );
    const snap3 = await getDocs(q3);
    snap3.forEach(d => {
      const taskData = d.data() as DepartmentTask;
      if (taskData.addToHandover && taskData.status === 'completed') {
        const key = `task_${d.id}`;
        if (!itemsMap.has(key)) {
          const { createdDateStr, createdIso, schoolYear } = resolveApprovalDocCreatedMeta(
            taskData.createdAt,
            taskData.completedAt || taskData.updatedAt
          );
          if (schoolYear !== year) return;
          const completionDateObj =
            parseAnyTimestampToDate(taskData.completedAt || taskData.updatedAt || taskData.createdAt) ||
            new Date();
          const displayDateTime = format(completionDateObj, 'yyyy-MM-dd HH:mm');

          itemsMap.set(key, {
            id: key,
            userEmail: normalizedEmail,
            userName: taskData.creatorName || '',
            documentId: key,
            sourceType: 'department_task',
            documentTitle: taskData.title || '',
            category:
              taskData.handoverCategory ||
              inferHandoverCategoryFromTarget(
                taskData.driveTargetDeptName || taskData.creatorDept,
                taskData.driveTargetTaskName,
                [taskData.title || '']
              ),
            date: createdDateStr,
            displayDateTime,
            summary: '',
            folderUrl: taskData.sheetsConfig?.sheetUrl || taskData.driveTargetFolderUrl || '',
            year,
            createdAt: createdIso,
          });
        }
      }
    });
  } catch (err) {
    console.warn('[HandoverService] department_tasks handover query error:', err);
  }

  return Array.from(itemsMap.values()).sort((a, b) =>
    compareHandoverItemsAsc(
      { id: a.id, date: a.date, createdAt: typeof a.createdAt === 'string' ? a.createdAt : '' },
      { id: b.id, date: b.date, createdAt: typeof b.createdAt === 'string' ? b.createdAt : '' }
    )
  );
}

/**
 * 공용 헬퍼: 전자결재/부서업무 타임라인 항목을 개인 풀(handover_pool) 및 인수인계서(handover_documents)에 중복 없이 오름차순 추가
 */
async function upsertTimelineItemForAuthor(params: {
  authorEmail: string;
  authorName: string;
  authorUid?: string;
  authorRole?: string;
  fallbackDeptName?: string;
  driveTargetFolderUrl?: string;
  year: number;
  poolDocId: string;
  matchId: string;
  timelineItem: HandoverItem;
}): Promise<void> {
  const db = getDb();
  const normalizedEmail = params.authorEmail.trim().toLowerCase();
  const { timelineItem, year, poolDocId, matchId } = params;

  // 1) 개인 인수인계 풀(handover_pool)에 idempotent 기록
  try {
    const poolDocRef = doc(db, HANDOVER_POOL_COL, poolDocId);
    await setDoc(
      poolDocRef,
      {
        id: poolDocId,
        userEmail: normalizedEmail,
        userName: params.authorName || '',
        documentId: timelineItem.documentId || matchId,
        sourceType: timelineItem.sourceType || 'approval',
        docNo: timelineItem.docNo || '',
        documentTitle: timelineItem.documentTitle,
        category: timelineItem.category,
        date: timelineItem.date,
        ...(timelineItem.displayDateTime ? { displayDateTime: timelineItem.displayDateTime } : {}),
        summary: timelineItem.summary || '',
        attachments: timelineItem.attachments || [],
        folderUrl: timelineItem.folderUrl || '',
        year,
        createdAt: timelineItem.createdAt || new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (poolErr) {
    console.warn('[HandoverService] pool sync error:', poolErr);
  }

  // 2) 요청자/기안자의 당해 연도 인수인계서 타임라인(handover_documents)에 즉시 추가 (먼저 만든 항목이 위로 오도록 정렬)
  const qDocs = query(
    collection(db, HANDOVER_DOCS_COL),
    where('authorEmail', '==', normalizedEmail)
  );
  const docsSnap = await getDocs(qDocs);
  const existingDocs: HandoverDocument[] = [];
  docsSnap.forEach(d => {
    const data = d.data() as HandoverDocument;
    if (!data.year || data.year === year) {
      existingDocs.push({ ...data, id: d.id });
    }
  });

  const nowIso = new Date().toISOString();
  const sortedEditable = existingDocs
    .filter(d => d.status === 'DRAFT' || d.status === 'REJECTED')
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  const editableDoc =
    sortedEditable.find(d =>
      [d.primaryDuty, ...(d.subDuties || [])].some(
        duty =>
          isSameHandoverDuty(duty, timelineItem.category) ||
          doesHandoverTextMatchDuty(timelineItem.documentTitle, duty) ||
          (params.driveTargetFolderUrl && d.folderUrl && d.folderUrl === params.driveTargetFolderUrl)
      )
    ) || sortedEditable[0];

  if (editableDoc) {
    const currentItems = Array.isArray(editableDoc.items) ? [...editableDoc.items] : [];
    const existingIdx = currentItems.findIndex(
      it => it.documentId === matchId || it.id === timelineItem.id
    );
    if (existingIdx >= 0) {
      currentItems[existingIdx] = {
        ...currentItems[existingIdx],
        ...timelineItem,
        folderUrl: timelineItem.folderUrl || currentItems[existingIdx].folderUrl || '',
      };
    } else {
      currentItems.push(timelineItem);
    }

    const dedupedItems = dedupeSystemTasksAgainstApprovals(currentItems);
    const sortedItems = dedupedItems.sort(compareHandoverItemsAsc);
    const updatePayload: Partial<HandoverDocument> = {
      items: sortedItems,
      updatedAt: nowIso,
    };
    if (!editableDoc.folderUrl && params.driveTargetFolderUrl) {
      updatePayload.folderUrl = params.driveTargetFolderUrl;
    }

    await updateDoc(doc(db, HANDOVER_DOCS_COL, editableDoc.id), updatePayload);
    return;
  }

  // 아직 작성 시작된 인수인계서가 전혀 없는 경우: 자동 초안(DRAFT) 생성하여 타임라인에 즉시 반영
  if (existingDocs.length === 0) {
    let primaryDuty = '일반 교무 업무';
    let subDuties: string[] = [];
    let authorDepartment = '';
    let matchedFolderUrl = params.driveTargetFolderUrl || '';
    let loadedOrg: Partial<OrgStructure> | null = null;
    let loadedDriveCfg: GoogleDriveConfig | null = null;

    try {
      const { getOrgStructure, getGoogleDriveConfig } = await import('@/lib/services/settingsService');
      const [org, driveCfg] = await Promise.all([
        getOrgStructure().catch(() => null),
        getGoogleDriveConfig().catch(() => null),
      ]);
      loadedOrg = org;
      loadedDriveCfg = driveCfg;

      const resolvedDept = resolveFacultyDepartment(
        {
          uid: params.authorUid || normalizedEmail,
          email: normalizedEmail,
          name: params.authorName || '',
          role: (params.authorRole as any) || '교사',
          dept: params.fallbackDeptName || '',
        },
        org
      );
      authorDepartment = resolvedDept;

      const duties = resolveTeacherAssignedDutiesList(normalizedEmail, org, resolvedDept);
      if (duties.length > 0) {
        const matchedAssigned = duties.find(
          duty =>
            isSameHandoverDuty(duty, timelineItem.category) ||
            doesHandoverTextMatchDuty(timelineItem.documentTitle, duty)
        );
        primaryDuty = matchedAssigned || duties[0];
        subDuties = [];
      }

      if (!matchedFolderUrl && driveCfg) {
        const matched = resolveDriveFoldersForDuties(
          duties.length > 0 ? duties : [primaryDuty],
          driveCfg,
          year,
          resolvedDept,
          org
        );
        if (matched[0]?.folderUrl) {
          matchedFolderUrl = matched[0].folderUrl;
        }
      }
    } catch (metaErr) {
      console.warn('[HandoverService] auto-draft meta resolution error:', metaErr);
    }

    const [upgradedWs, dutyTemplates] = await Promise.all([
      getUpgradedCustomWorkspaces().catch(() => []),
      getAllHandoverDutyTemplates().catch(() => []),
    ]);
    const { items: initialTimelineItems } = syncSystemDutyTasksIntoTimeline({
      currentItems: [timelineItem],
      selectedDuties: [primaryDuty, ...subDuties],
      driveConfig: loadedDriveCfg,
      org: loadedOrg,
      year,
      teacherDeptName: authorDepartment,
      upgradedCustomWorkspaces: upgradedWs,
      dutyTimelineTemplates: dutyTemplates,
    });

    const newDraftRef = doc(collection(db, HANDOVER_DOCS_COL));
    const newDraft: HandoverDocument = {
      id: newDraftRef.id,
      year,
      authorEmail: normalizedEmail,
      authorName: params.authorName || '',
      authorDepartment,
      primaryDuty,
      subDuties,
      folderUrl: matchedFolderUrl,
      targetSuccessorEmail: '',
      targetSuccessorName: '',
      status: 'DRAFT',
      items: initialTimelineItems,
      generalGuide: '',
      contactInfo: normalizedEmail,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await setDoc(newDraftRef, newDraft);
  }
}

/**
 * 최종 결재 완료된 전자결재 문서를 학년 말 인수인계 타임라인(handover_documents + handover_pool)에 자동 반영
 * - 문서 제목(documentTitle) 및 생성일자(date)만 깔끔히 기록하고 먼저 만든 문서가 위로 오도록 정렬
 */
export async function syncCompletedApprovalToHandoverTimeline(
  docId: string,
  approvalDoc: Partial<ApprovalDoc> & { id?: string }
): Promise<void> {
  if (!docId || !approvalDoc?.addToHandover || !approvalDoc?.requesterEmail) return;

  const { createdDateStr, createdIso, schoolYear } = resolveApprovalDocCreatedMeta(
    approvalDoc.createdAt,
    approvalDoc.completedAt
  );
  const year = schoolYear || CURRENT_SCHOOL_YEAR;

  const resolvedCategory =
    (approvalDoc.handoverCategory && approvalDoc.handoverCategory !== '일반업무'
      ? approvalDoc.handoverCategory
      : '') ||
    inferHandoverCategoryFromTarget(
      approvalDoc.driveTargetDeptName,
      approvalDoc.driveTargetTaskName,
      [approvalDoc.title || '']
    );

  const folderUrl = approvalDoc.driveFileUrl || approvalDoc.driveTargetFolderUrl || '';

  const timelineItem: HandoverItem = {
    id: `approval_${docId}`,
    documentId: docId,
    sourceType: 'approval',
    documentTitle: (approvalDoc.title || '제목 없음').trim(),
    docNo: approvalDoc.docNo || '',
    category: resolvedCategory,
    period: inferHandoverPeriodFromDate(createdDateStr),
    date: createdDateStr,
    summary: '',
    folderUrl,
    drivePath: approvalDoc.driveTargetFolderLabel || '',
    attachments: (approvalDoc.attachments || []).map(a => ({
      name: a.name || '',
      url: a.data || '',
      size: a.size || 0,
    })),
    createdAt: createdIso,
  };

  await upsertTimelineItemForAuthor({
    authorEmail: approvalDoc.requesterEmail,
    authorName: approvalDoc.requesterName || '',
    authorUid: approvalDoc.requesterId,
    authorRole: approvalDoc.requesterRole,
    fallbackDeptName: approvalDoc.driveTargetDeptName,
    driveTargetFolderUrl: approvalDoc.driveTargetFolderUrl,
    year,
    poolDocId: `pool_approval_${docId}`,
    matchId: docId,
    timelineItem,
  });
}

/**
 * 업무 완료 상태가 된 부서/학년 업무 요청을 학년 말 인수인계 타임라인에 자동 반영
 * - 해당 업무의 제목(documentTitle)과 일시(displayDateTime)를 기록하고 생성 순서대로 정렬
 */
export async function syncCompletedTaskToHandoverTimeline(
  taskId: string,
  taskData: Partial<DepartmentTask> & { id?: string }
): Promise<void> {
  if (!taskId || !taskData?.addToHandover || !taskData?.creatorEmail) return;

  const { createdDateStr, createdIso, schoolYear } = resolveApprovalDocCreatedMeta(
    taskData.createdAt,
    taskData.completedAt || taskData.updatedAt
  );
  const year = schoolYear || CURRENT_SCHOOL_YEAR;

  const eventDt =
    parseAnyTimestampToDate(taskData.completedAt || taskData.updatedAt || taskData.createdAt) ||
    new Date();
  const displayDateTime = format(eventDt, 'yyyy-MM-dd HH:mm');

  const resolvedCategory =
    (taskData.handoverCategory && taskData.handoverCategory !== '일반업무'
      ? taskData.handoverCategory
      : '') ||
    inferHandoverCategoryFromTarget(
      taskData.driveTargetDeptName || taskData.creatorDept,
      taskData.driveTargetTaskName,
      [taskData.title || '']
    );

  const folderUrl = taskData.sheetsConfig?.sheetUrl || taskData.driveTargetFolderUrl || '';
  const matchKey = `task_${taskId}`;

  const timelineItem: HandoverItem = {
    id: matchKey,
    documentId: matchKey,
    sourceType: 'department_task',
    documentTitle: (taskData.title || '제목 없음').trim(),
    category: resolvedCategory,
    period: inferHandoverPeriodFromDate(createdDateStr),
    date: createdDateStr,
    displayDateTime,
    summary: '',
    folderUrl,
    drivePath: taskData.driveTargetFolderLabel || '',
    attachments: (taskData.attachments || []).map(a => ({
      name: a.name || '',
      url: a.url || '',
      size: a.size || 0,
    })),
    createdAt: createdIso,
  };

  await upsertTimelineItemForAuthor({
    authorEmail: taskData.creatorEmail,
    authorName: taskData.creatorName || '',
    fallbackDeptName: taskData.driveTargetDeptName || taskData.creatorDept,
    driveTargetFolderUrl: taskData.driveTargetFolderUrl,
    year,
    poolDocId: `pool_task_${taskId}`,
    matchId: matchKey,
    timelineItem,
  });
}

/**
 * Google Drive 아카이빙이 비동기로 완료된 후 해당 타임라인 항목의 문서 링크(folderUrl) 갱신
 */
export async function updateHandoverTimelineDriveUrl(
  requesterEmail: string,
  docId: string,
  driveFileUrl: string,
  year: number = CURRENT_SCHOOL_YEAR
): Promise<void> {
  if (!requesterEmail || !docId || !driveFileUrl) return;
  const db = getDb();
  const normalizedEmail = requesterEmail.trim().toLowerCase();

  try {
    await updateDoc(doc(db, HANDOVER_POOL_COL, `pool_approval_${docId}`), {
      folderUrl: driveFileUrl,
    });
  } catch {}

  try {
    const qDocs = query(
      collection(db, HANDOVER_DOCS_COL),
      where('authorEmail', '==', normalizedEmail)
    );
    const snap = await getDocs(qDocs);
    const nowIso = new Date().toISOString();

    for (const d of snap.docs) {
      const data = d.data() as HandoverDocument;
      if (data.year && data.year !== year) continue;
      if (!Array.isArray(data.items) || data.items.length === 0) continue;

      let changed = false;
      const updatedItems = data.items.map(it => {
        if (it.documentId === docId || it.id === `approval_${docId}`) {
          changed = true;
          return { ...it, folderUrl: driveFileUrl };
        }
        return it;
      });

      if (changed) {
        await updateDoc(d.ref, {
          items: updatedItems.sort(compareHandoverItemsAsc),
          updatedAt: nowIso,
        });
      }
    }
  } catch (err) {
    console.warn('[HandoverService] update timeline drive url error:', err);
  }
}

/**
 * 인수인계 풀에서 특정 항목 삭제
 */
export async function removeHandoverPoolItem(id: string): Promise<void> {
  const db = getDb();
  if (id.startsWith('approval_')) {
    const docId = id.replace('approval_', '');
    try {
      await updateDoc(doc(db, 'approvals', docId), { addToHandover: false });
    } catch {}
    return;
  }
  await deleteDoc(doc(db, HANDOVER_POOL_COL, id));
}

// ─── 2. 인수인계서 (HandoverDocument) 라이프사이클 ──────────────

/**
 * 단일 인수인계서 조회
 */
export async function getHandoverDocument(id: string): Promise<HandoverDocument | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, HANDOVER_DOCS_COL, id));
  if (!snap.exists()) return null;
  return { ...snap.data(), id: snap.id } as HandoverDocument;
}

/**
 * 내가 작성한 인수인계서 목록 (인계자 시점)
 */
export async function getHandoversByAuthor(
  authorEmail: string,
  year: number = CURRENT_SCHOOL_YEAR
): Promise<HandoverDocument[]> {
  const db = getDb();
  const normalizedEmail = (authorEmail || '').trim().toLowerCase();
  const q = query(
    collection(db, HANDOVER_DOCS_COL),
    where('authorEmail', '==', normalizedEmail)
  );
  const snap = await getDocs(q);
  const docs: HandoverDocument[] = [];
  snap.forEach(d => {
    const data = d.data() as HandoverDocument;
    if ((data as any).isFixture) return;
    if (!year || data.year === year) {
      docs.push({ ...data, id: d.id });
    }
  });
  return docs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

/**
 * 내가 인수해야 할 인수인계서 목록 (인수자 수신함)
 */
export async function getHandoversForSuccessor(
  successorEmail: string,
  year: number = CURRENT_SCHOOL_YEAR
): Promise<HandoverDocument[]> {
  const db = getDb();
  const normalizedEmail = (successorEmail || '').trim().toLowerCase();
  const q = query(
    collection(db, HANDOVER_DOCS_COL),
    where('targetSuccessorEmail', '==', normalizedEmail)
  );
  const snap = await getDocs(q);
  const docs: HandoverDocument[] = [];
  snap.forEach(d => {
    const data = d.data() as HandoverDocument;
    if ((data as any).isFixture) return;
    if (!year || data.year === year) {
      // 대기 중이거나 인수 승인 또는 완료된 문서
      docs.push({ ...data, id: d.id });
    }
  });
  return docs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

/**
 * 교감 결재 대기 및 검토 목록
 */
export async function getHandoversForVicePrincipal(
  year: number = CURRENT_SCHOOL_YEAR
): Promise<HandoverDocument[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, HANDOVER_DOCS_COL));
  const docs: HandoverDocument[] = [];
  snap.forEach(d => {
    const data = d.data() as HandoverDocument;
    if ((data as any).isFixture) return;
    if (!year || data.year === year) {
      docs.push({ ...data, id: d.id });
    }
  });
  return docs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export interface FacultyHandoverStatusRow {
  email: string;
  name: string;
  dept: string;
  role: string;
  documentId?: string;
  primaryDuty: string;
  status: 'SUBMITTED' | 'UNSUBMITTED' | 'REJECTED';
  statusText: '완료' | '미제출' | '반려' | '수정요청';
  rawStatus?: HandoverStatus;
  submittedAt?: string;
  rejectionReason?: string;
  revisionRequestReason?: string;
  document?: HandoverDocument;
  documents?: HandoverDocument[];
  assignedDuties?: string[];
  submittedDocCount?: number;
  successorChecked?: boolean;
  successorCheckedAt?: string;
  targetSuccessorName?: string;
  targetSuccessorEmail?: string;
}

/**
 * 작성자(전임 교원)가 직접 수정·삭제·재제출 가능한 상태인지 판별한다.
 */
export function isHandoverEditableByAuthor(status?: HandoverStatus | string | null): boolean {
  return !status || status === 'DRAFT' || status === 'REJECTED' || status === 'REVISION_REQUESTED';
}

/**
 * 교무부장 총괄 관리에서 확인 후 교감 최종 결재로 상신할 수 있는 대기 상태인지 판별한다.
 */
export function isHandoverInAcademicHeadQueue(status?: HandoverStatus | string | null): boolean {
  return (
    status === 'SUBMITTED_WAITING_ACADEMIC_HEAD' ||
    status === 'SUBMITTED_WAITING_SUCCESSOR' ||
    status === 'ASSIGNED_TO_SUCCESSOR'
  );
}

/**
 * 인수자가 지정되었으나 아직 인수자 확인(서명)을 하지 않은 문서인지 판별한다.
 * 이 상태의 문서는 교무부장이 교감 결재로 상신할 수 없다. (인수자 서명 → 교무부장 → 교감 순서 보장)
 */
export function isHandoverAwaitingSuccessorSignature(
  docItem?: Pick<HandoverDocument, 'status' | 'targetSuccessorEmail' | 'successorChecked'> | null
): boolean {
  if (!docItem) return false;
  return (
    Boolean((docItem.targetSuccessorEmail || '').trim()) &&
    !docItem.successorChecked &&
    isHandoverInAcademicHeadQueue(docItem.status)
  );
}

/**
 * 교무부장 확인이 완료되어 교감 최종 결재 대기 큐에 올라간 상태인지 판별한다.
 * (교사 제출 직후 상태인 SUBMITTED_WAITING_ACADEMIC_HEAD는 엄격히 제외한다.)
 */
export function isHandoverInVpQueue(status?: HandoverStatus | string | null): boolean {
  return status === 'READY_FOR_VP_APPROVAL' || status === 'SUCCESSOR_APPROVED';
}

/**
 * 교감 최종 결재 및 아카이빙이 완료된 상태인지 판별한다.
 */
export function isHandoverCompleted(status?: HandoverStatus | string | null): boolean {
  return status === 'VICE_PRINCIPAL_APPROVED' || status === 'ARCHIVED';
}

/**
 * 인수인계 문서 상태의 한국어 표준 라벨을 반환한다.
 */
export function getHandoverStatusLabel(status?: HandoverStatus | string | null): string {
  switch (status) {
    case 'DRAFT':
      return '작성 중';
    case 'SUBMITTED_WAITING_ACADEMIC_HEAD':
      return '교무부장 확인 대기';
    case 'SUBMITTED_WAITING_SUCCESSOR':
      return '교무부장 확인 대기 (인수자 미정)';
    case 'ASSIGNED_TO_SUCCESSOR':
      return '인수자 확인·서명 대기';
    case 'SUCCESSOR_APPROVED':
      return '인수 승인 (교감 결재 대기)';
    case 'READY_FOR_VP_APPROVAL':
      return '교무부장 확인 완료 (교감 결재 대기)';
    case 'VICE_PRINCIPAL_APPROVED':
      return '교감 최종 결재 완료';
    case 'ARCHIVED':
      return '아카이브 보관 완료';
    case 'REVISION_REQUESTED':
      return '수정 요청됨 (보완 필요)';
    case 'REJECTED':
      return '반려됨 (보완 필요)';
    default:
      return '작성 전';
  }
}

/**
 * 특정 교원의 당해 연도 인수인계서 조회 (가장 최신 1건)
 */
export async function getMyHandoverDocument(
  email: string,
  year: number = CURRENT_SCHOOL_YEAR
): Promise<HandoverDocument | null> {
  const docs = await getHandoversByAuthor(email, year);
  return docs.length > 0 ? docs[0] : null;
}

/**
 * 인계서 반려 처리 (교무부장 / 교감 전용)
 * 반려 시 해당 교원의 인계서가 REJECTED 상태가 되어 다시 작성·수정할 수 있게 됨
 */
export async function rejectHandoverDocument(
  docId: string,
  reason: string,
  rejectedByName: string
): Promise<void> {
  const db = getDb();
  const docRef = doc(db, HANDOVER_DOCS_COL, docId);
  const nowIso = new Date().toISOString();

  await updateDoc(docRef, {
    status: 'REJECTED',
    rejectionReason: reason || '인수인계서 내용 보완이 필요하여 반려되었습니다.',
    rejectedAt: nowIso,
    rejectedBy: rejectedByName,
    updatedAt: nowIso,
  });
}

/**
 * 교감/교무부장 수정 요청 처리 (REVISION_REQUESTED)
 * 작성자가 수정 요청 사유를 확인하고 보완 후 다시 제출할 수 있도록 되돌린다.
 */
export async function requestHandoverRevision(
  docId: string,
  reason: string,
  requestedByName: string,
  requestedByRole: string = '교감'
): Promise<void> {
  const db = getDb();
  const docRef = doc(db, HANDOVER_DOCS_COL, docId);
  const nowIso = new Date().toISOString();

  await updateDoc(docRef, {
    status: 'REVISION_REQUESTED',
    revisionRequestReason: reason || '내용 보완이 필요하여 수정을 요청합니다.',
    revisionRequestedAt: nowIso,
    revisionRequestedBy: requestedByName,
    revisionRequestedByRole: requestedByRole,
    updatedAt: nowIso,
  });
}

export interface ReviewerHandoverPatch {
  primaryDuty?: string;
  subDuties?: string[];
  folderUrl?: string;
  contactInfo?: string;
  generalGuide?: string;
  items?: HandoverItem[];
}

/**
 * 교감(또는 교무부장)이 결재 대기/검토 중인 인수인계서 내용을 직접 수정 저장한다.
 * 현재 결재 단계(status)는 유지하면서 수정 이력을 남긴다.
 */
export async function updateHandoverByReviewer(
  docId: string,
  patch: ReviewerHandoverPatch,
  reviewerProfile: UserProfile,
  reviewerRoleLabel: string = '교감'
): Promise<HandoverDocument> {
  const db = getDb();
  const docRef = doc(db, HANDOVER_DOCS_COL, docId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('인수인계 문서를 찾을 수 없습니다.');

  const currentDoc = { ...snap.data(), id: snap.id } as HandoverDocument;
  const nowIso = new Date().toISOString();
  const nextItems = Array.isArray(patch.items)
    ? dedupeSystemTasksAgainstApprovals([...patch.items]).sort(compareHandoverItemsAsc)
    : currentDoc.items || [];

  const updatePayload: Partial<HandoverDocument> = {
    primaryDuty: patch.primaryDuty !== undefined ? (patch.primaryDuty.trim() || currentDoc.primaryDuty) : currentDoc.primaryDuty,
    subDuties: patch.subDuties !== undefined ? patch.subDuties : (currentDoc.subDuties || []),
    folderUrl: patch.folderUrl !== undefined ? patch.folderUrl.trim() : (currentDoc.folderUrl || ''),
    contactInfo: patch.contactInfo !== undefined ? patch.contactInfo.trim() : (currentDoc.contactInfo || ''),
    generalGuide: patch.generalGuide !== undefined ? patch.generalGuide : (currentDoc.generalGuide || ''),
    items: nextItems,
    lastEditedByEmail: (reviewerProfile.email || '').trim().toLowerCase(),
    lastEditedByName: reviewerProfile.name || reviewerRoleLabel,
    lastEditedByRole: reviewerRoleLabel,
    lastEditedAt: nowIso,
    updatedAt: nowIso,
  };

  await updateDoc(docRef, updatePayload);
  return {
    ...currentDoc,
    ...updatePayload,
  };
}

/**
 * 교원의 소속 부서를 조직도(orgStructure) 및 프로필 정보를 통합 분석하여 정확하게 반환
 */
export function resolveFacultyDepartment(
  user: UserProfile,
  org?: Partial<OrgStructure> | null
): string {
  const emailLower = (user.email || '').trim().toLowerCase();

  // 1. 조직도 departments의 headEmail 또는 memberEmails 검색 (최우선 단일 진실 공급원)
  if (org?.departments && org.departments.length > 0) {
    for (const d of org.departments) {
      if (d.headEmail && d.headEmail.trim().toLowerCase() === emailLower) {
        return d.name;
      }
      if (d.memberEmails && d.memberEmails.some(em => em && em.trim().toLowerCase() === emailLower)) {
        return d.name;
      }
    }
  }

  // 2. 사용자 프로필의 dept 필드 (예: '1학년', '3학년' 등)
  if (user.dept && user.dept.trim() && user.dept.trim() !== '미지정' && user.dept.trim() !== '(미지정)') {
    return user.dept.trim();
  }

  // 3. 조직도 담임 배정 (homerooms)
  if (org?.homerooms) {
    for (const [gc, em] of Object.entries(org.homerooms)) {
      if (typeof em === 'string' && em.trim().toLowerCase() === emailLower) {
        return gc.includes('-') ? `${gc.split('-')[0]}학년` : `${gc}학년`;
      }
    }
  }

  // 4. 조직도 학년부장 배정 (gradeHeads)
  if (org?.gradeHeads) {
    for (const [gr, em] of Object.entries(org.gradeHeads)) {
      if (typeof em === 'string' && em.trim().toLowerCase() === emailLower) {
        return gr.includes('학년') ? gr : `${gr}학년`;
      }
    }
  }

  // 5. 직책 부서 매핑 (dutyRoleDepts)
  if (org) {
    const roleDepts = org.dutyRoleDepts || {};
    if (org.afterschoolManagers?.some(e => e.trim().toLowerCase() === emailLower) && roleDepts.afterschoolManagers) {
      return roleDepts.afterschoolManagers;
    }
    if (org.busManagers?.some(e => e.trim().toLowerCase() === emailLower) && roleDepts.busManagers) {
      return roleDepts.busManagers;
    }
    if (org.systemManagers?.some(e => e.trim().toLowerCase() === emailLower)) {
      return '교무기획부';
    }
  }

  return '';
}

/**
 * 조직도(orgStructure)에서 특정 교원에게 배정된 모든 공식 업무 목록 추출 (우선순위 정렬)
 */
export function getAssignedDutiesForTeacher(
  email: string,
  org?: Partial<OrgStructure> | null
): string[] {
  if (!email || !org) return [];
  const emailLower = email.trim().toLowerCase();
  const duties: string[] = [];

  const addUnique = (name?: string | null) => {
    if (!name) return;
    const trimmed = name.trim();
    if (trimmed && !duties.includes(trimmed)) {
      duties.push(trimmed);
    }
  };

  // 1. 부서장인 경우 해당 부서의 'OO부장' 직책이 있으면 최우선 배치
  if (org.departments && org.customDutyRoles) {
    const headDepts = org.departments.filter(
      d => d.headEmail && d.headEmail.trim().toLowerCase() === emailLower
    );
    headDepts.forEach(hd => {
      const headRole = org.customDutyRoles!.find(
        r =>
          r.roleName &&
          r.teacherEmails?.some(e => e && e.trim().toLowerCase() === emailLower) &&
          (r.roleName === `${hd.name.replace(/부$/, '')}부장` ||
           (r.deptName === hd.name && r.roleName.includes('부장')))
      );
      if (headRole) addUnique(headRole.roleName);
    });
  }

  // 2. 조직도 > 업무 담당 설정 / 부서 관리에서 배정된 커스텀 업무 직책 (담임/교과 제외)
  const customAssigned = (org.customDutyRoles || []).filter(
    r =>
      r.roleName &&
      !r.roleName.includes('담임') &&
      !r.roleName.includes('교과') &&
      r.teacherEmails?.some(e => e && e.trim().toLowerCase() === emailLower)
  );
  // 부장 직책 및 소수 전담(구체적 담당) 업무 우선 정렬
  const sortedCustom = [...customAssigned].sort((a, b) => {
    const aIsHead = a.roleName.includes('부장') ? 0 : 1;
    const bIsHead = b.roleName.includes('부장') ? 0 : 1;
    if (aIsHead !== bIsHead) return aIsHead - bIsHead;
    return (a.teacherEmails?.length || 99) - (b.teacherEmails?.length || 99);
  });
  sortedCustom.forEach(r => addUnique(r.roleName));

  // 3. 부서 내 세부 업무 (dept.tasks)
  (org.departments || []).forEach(dept => {
    (dept.tasks || []).forEach(t => {
      if (
        t.taskName &&
        !t.taskName.includes('담임') &&
        !t.taskName.includes('교과') &&
        t.assignedEmails?.some(e => e && e.trim().toLowerCase() === emailLower)
      ) {
        addUnique(t.taskName);
      }
    });
  });

  // 4. 부서별 부원 업무 매핑 (deptMemberDuties)
  if (org.deptMemberDuties) {
    for (const deptId in org.deptMemberDuties) {
      const memberDuties = org.deptMemberDuties[deptId]?.[emailLower] || [];
      memberDuties.forEach(d => {
        if (d && !d.includes('담임') && !d.includes('교과')) addUnique(d);
      });
    }
  }

  // 5. 시스템 기본 핵심 직책 (PrimaryDutyCombobox의 STANDARD_SYSTEM_DUTIES 명칭과 일치)
  const hasEmail = (arr?: string[]) =>
    arr?.some(e => e && e.trim().toLowerCase() === emailLower);

  if (hasEmail(org.handoverManagers)) addUnique('학년 말 인수인계 총괄 관리');
  if (hasEmail(org.afterschoolManagers)) addUnique('방과후학교 총괄 관리');
  if (hasEmail(org.busManagers)) addUnique('스쿨버스 운영 관리');
  if (hasEmail(org.peTeachers)) addUnique('학교 체육/PAPS 관리');
  if (hasEmail(org.healthTeachers)) addUnique('학생 건강/보건실 관리');
  if (hasEmail(org.safetyManagers)) addUnique('학생 안전지도 관리');
  if (hasEmail(org.specialTeachers)) addUnique('특수교육 지원 관리');
  if (hasEmail(org.librarianTeachers)) addUnique('도서관/사서 관리');
  if (org.volunteerManager && org.volunteerManager.trim().toLowerCase() === emailLower) {
    addUnique('봉사활동 총괄 관리');
  }
  if (hasEmail(org.systemManagers)) addUnique('시스템 설정 관리');

  // 5-1. 학년부장 배정 매핑 ('1학년 부장' 등)
  if (org.gradeHeads) {
    for (const [gr, headEm] of Object.entries(org.gradeHeads)) {
      if (typeof headEm === 'string' && headEm.trim().toLowerCase() === emailLower) {
        const cleanGrade = gr.replace(/학년/g, '').trim();
        addUnique(`${cleanGrade}학년 부장`);
      }
    }
  }

  // 6. 별도 세부 업무가 배정되지 않은 경우에만 소속 부서 총괄 업무 폴백
  if (duties.length === 0) {
    (org.departments || []).forEach(dept => {
      if (dept.headEmail && dept.headEmail.trim().toLowerCase() === emailLower) {
        addUnique(`${dept.name} 총괄 업무`);
      }
    });
    (org.departments || []).forEach(dept => {
      if (dept.memberEmails?.some(e => e && e.trim().toLowerCase() === emailLower)) {
        addUnique(`${dept.name} 총괄 업무`);
      }
    });
  }

  return duties;
}

/**
 * 교원의 복수 배정 담당 업무 목록 자동 산출
 */
export function resolveTeacherAssignedDutiesList(
  email: string,
  org?: Partial<OrgStructure> | null,
  fallbackDept?: string
): string[] {
  const duties = getAssignedDutiesForTeacher(email, org);
  if (duties.length > 0) return duties;
  if (fallbackDept && fallbackDept.trim()) {
    return [`${fallbackDept.trim()} 총괄 업무`];
  }
  return [];
}

/**
 * 교원의 복수 배정 담당 업무 목록 자동 산출 (학년 담임 정보 포함: 새 결재문서 기본 편철 폴더 매칭용)
 */
export function resolveTeacherFilingDutiesList(
  email: string,
  org?: Partial<OrgStructure> | null,
  fallbackDept?: string
): string[] {
  const duties = getAssignedDutiesForTeacher(email, org);
  const emailLower = (email || '').trim().toLowerCase();

  if (org?.homerooms && emailLower) {
    for (const [gc, hmEmail] of Object.entries(org.homerooms)) {
      if (typeof hmEmail === 'string' && hmEmail.trim().toLowerCase() === emailLower) {
        const gradePart = gc.includes('-') ? gc.split('-')[0].trim() : gc.trim();
        const label = gradePart.includes('유치원')
          ? '유치원 담임'
          : gradePart.includes('중등')
            ? '중등 담임'
            : `${gradePart}학년 담임`;
        if (!duties.includes(label)) {
          duties.push(label);
        }
      }
    }
  }

  if (duties.length > 0) return duties;
  if (fallbackDept && fallbackDept.trim()) {
    return [`${fallbackDept.trim()} 총괄 업무`];
  }
  return [];
}

/**
 * 교원의 대표 주 업무명 1건 자동 산출
 */
export function resolveTeacherPrimaryDuty(
  email: string,
  org?: Partial<OrgStructure> | null,
  fallbackDept?: string
): string {
  const duties = resolveTeacherAssignedDutiesList(email, org, fallbackDept);
  return duties.length > 0 ? duties[0] : '일반 교무 업무';
}

/**
 * 학년 말 인수인계 대상 교원 필터링 (학생, 학부모, 교장, 교감 완전 배제 및 소속 부서가 있는 교사/강사만 선별)
 */
export function filterValidHandoverFaculty(
  users: UserProfile[],
  org?: Partial<OrgStructure> | null
): UserProfile[] {
  const principalEmail = (org?.principal || 'kisprincipaley@kshcm.net').trim().toLowerCase();
  const vpEmail = (org?.vicePrincipal || 'kisvpyk@kshcm.net').trim().toLowerCase();

  return (users || []).filter(u => {
    const emailLower = (u.email || '').trim().toLowerCase();
    if (!emailLower) return false;

    const roleLower = (u.role || '').trim().toLowerCase();

    // 1. 학생 및 학부모 전면 배제
    // 주의: getUsersDirectory()는 모든 사용자에게 studentName(data.name), studentGrade(data.grade),
    // parentPhone(data.phone)을 fallback으로 채우므로, 해당 필드로 학생 여부를 판별하면 전 교원이 탈락함.
    if (
      roleLower === 'student' ||
      roleLower === '학생' ||
      roleLower === 'parent' ||
      roleLower === '학부모' ||
      roleLower === 'none'
    ) {
      return false;
    }

    // 명시적 교직원 플래그 또는 교원 직책(교사, 강사, 부장 등) 보유 여부 확인
    const isExplicitFaculty =
      u.isFaculty === true ||
      u.isStaff === true ||
      u.isManualFaculty === true ||
      roleLower.includes('교사') ||
      roleLower.includes('강사') ||
      roleLower.includes('부장') ||
      roleLower.includes('교직원') ||
      roleLower.includes('직원') ||
      roleLower.includes('행정');

    if (!isExplicitFaculty) {
      if (/^\d{2,8}[a-zA-Z0-9._-]*@kshcm\.net$/i.test(emailLower) || u.studentNumber || u.hashedPin) {
        return false;
      }
      return false;
    }

    // 2. 교장, 교감 결재권자 배제 (인수인계서 제출 대상이 아님)
    if (
      roleLower === '교장' ||
      roleLower === '교감' ||
      roleLower.includes('교장') ||
      roleLower.includes('교감') ||
      emailLower === principalEmail ||
      emailLower === vpEmail
    ) {
      return false;
    }

    // 3. 소속 부서가 존재하는 교사나 강사만 포함
    const resolvedDept = resolveFacultyDepartment(u, org);
    return !!resolvedDept;
  }).map(u => {
    const resolvedDept = resolveFacultyDepartment(u, org);
    return {
      ...u,
      email: (u.email || '').trim().toLowerCase(),
      dept: resolvedDept,
    };
  });
}

/**
 * 교원 목록과 인수인계 문서를 인메모리 매핑하여 상태 명렬표를 초고속 생성 (네트워크 통신 0회)
 */
export function buildFacultyHandoverStatusList(
  faculty: UserProfile[],
  allDocs: HandoverDocument[],
  org?: Partial<OrgStructure> | null
): FacultyHandoverStatusRow[] {
  const docsByEmail = new Map<string, HandoverDocument[]>();
  (allDocs || []).forEach(d => {
    const key = (d.authorEmail || '').trim().toLowerCase();
    if (!key) return;
    const list = docsByEmail.get(key) || [];
    list.push(d);
    docsByEmail.set(key, list);
  });

  return (faculty || []).map(f => {
    const cleanEmail = (f.email || '').trim().toLowerCase();
    const authorDocs = docsByEmail.get(cleanEmail) || [];
    const submittedDocs = authorDocs.filter(d => !isHandoverEditableByAuthor(d.status));
    const rejectedDocs = authorDocs.filter(d => d.status === 'REJECTED' || d.status === 'REVISION_REQUESTED');
    const doc = submittedDocs[0] || rejectedDocs[0] || authorDocs[0];
    const rawStatus = doc?.status;

    let status: 'SUBMITTED' | 'UNSUBMITTED' | 'REJECTED' = 'UNSUBMITTED';
    let statusText: '완료' | '미제출' | '반려' | '수정요청' = '미제출';

    if (rejectedDocs.length > 0 && submittedDocs.length === 0) {
      status = 'REJECTED';
      statusText = rejectedDocs[0]?.status === 'REVISION_REQUESTED' ? '수정요청' : '반려';
    } else if (submittedDocs.length > 0) {
      status = 'SUBMITTED';
      statusText = '완료';
    }

    const resolvedDept = resolveFacultyDepartment(f, org) || f.dept || '';
    const assignedDuties = resolveTeacherAssignedDutiesList(cleanEmail, org, resolvedDept);
    const defaultDuty = assignedDuties[0] || resolveTeacherPrimaryDuty(cleanEmail, org, resolvedDept);
    const uniqueDocDuties = Array.from(
      new Set(
        authorDocs
          .map(d => d.primaryDuty)
          .filter(pd => Boolean(pd) && pd !== '일반 교무 업무')
      )
    );

    return {
      email: cleanEmail,
      name: f.name || cleanEmail,
      dept: resolvedDept,
      role: f.role || '교사',
      documentId: doc?.id,
      primaryDuty:
        uniqueDocDuties.length > 0
          ? uniqueDocDuties.join(', ')
          : assignedDuties.length > 0
            ? assignedDuties.join(', ')
            : defaultDuty,
      status,
      statusText,
      rawStatus,
      submittedAt: doc?.submittedAt,
      rejectionReason: doc?.rejectionReason,
      revisionRequestReason: doc?.revisionRequestReason,
      document: doc,
      documents: authorDocs,
      assignedDuties,
      submittedDocCount: submittedDocs.length,
      successorChecked: Boolean(doc?.successorChecked),
      successorCheckedAt: doc?.successorCheckedAt,
      targetSuccessorName: doc?.targetSuccessorName,
      targetSuccessorEmail: doc?.targetSuccessorEmail,
    };
  });
}

/**
 * 전체 교원 대상 인수인계 제출 현황 명렬표 조회
 */
export async function getFacultyHandoverStatusList(
  year: number = CURRENT_SCHOOL_YEAR,
  cachedFaculty?: UserProfile[],
  cachedDocs?: HandoverDocument[],
  cachedOrg?: Partial<OrgStructure> | null
): Promise<FacultyHandoverStatusRow[]> {
  const { getOrgStructure } = await import('@/lib/services/settingsService');
  const [allUsers, allDocs, org] = await Promise.all([
    cachedFaculty ? Promise.resolve(cachedFaculty) : getUsersDirectory(),
    cachedDocs ? Promise.resolve(cachedDocs) : getHandoversForVicePrincipal(year),
    cachedOrg ? Promise.resolve(cachedOrg) : getOrgStructure(),
  ]);

  const validFaculty = filterValidHandoverFaculty(allUsers || [], org);

  return buildFacultyHandoverStatusList(validFaculty, allDocs, org);
}

/**
 * 인수인계서 임시저장 (DRAFT) 또는 신규 생성
 */
export async function saveHandoverDraft(
  docData: Partial<HandoverDocument>,
  authorProfile: UserProfile,
  year: number = CURRENT_SCHOOL_YEAR
): Promise<string> {
  const db = getDb();
  const normalizedEmail = authorProfile.email.trim().toLowerCase();

  const isNew = !docData.id;
  const docRef = isNew
    ? doc(collection(db, HANDOVER_DOCS_COL))
    : doc(db, HANDOVER_DOCS_COL, docData.id!);

  const nowIso = new Date().toISOString();

  const payload: Partial<HandoverDocument> = {
    year: docData.year || year,
    authorEmail: normalizedEmail,
    authorName: authorProfile.name || '',
    authorDepartment: authorProfile.dept || '',
    primaryDuty: docData.primaryDuty || '일반 교무 업무',
    subDuties: docData.subDuties || [],
    folderUrl: docData.folderUrl || '',
    targetSuccessorEmail: docData.targetSuccessorEmail?.trim().toLowerCase() || '',
    targetSuccessorName: docData.targetSuccessorName || '',
    status: (docData.status as HandoverStatus) || 'DRAFT',
    items: dedupeSystemTasksAgainstApprovals([...(docData.items || [])]).sort(compareHandoverItemsAsc),
    dismissedSystemTaskKeys: docData.dismissedSystemTaskKeys || [],
    generalGuide: docData.generalGuide || '',
    contactInfo: docData.contactInfo || authorProfile.phoneNumber || '',
    ...(docData.returningInfo ? { returningInfo: docData.returningInfo } : {}),
    updatedAt: nowIso,
  };

  if (isNew) {
    payload.createdAt = nowIso;
  }

  await setDoc(docRef, payload, { merge: true });
  return docRef.id;
}

/**
 * 인수인계서 최종 제출 (DRAFT/REJECTED/REVISION_REQUESTED -> SUBMITTED_WAITING_ACADEMIC_HEAD)
 * 제출된 문서는 바로 교감 결재로 가지 않고 교무부장 총괄 관리로 모여 확인 후 일괄 상신된다.
 */
export async function submitHandoverDocument(
  docId: string,
  authorProfile: UserProfile,
  year: number = CURRENT_SCHOOL_YEAR
): Promise<{ status: HandoverStatus; assignedSuccessor?: string }> {
  const db = getDb();
  const docRef = doc(db, HANDOVER_DOCS_COL, docId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('인수인계 문서를 찾을 수 없습니다.');

  const current = snap.data() as HandoverDocument;
  const nowIso = new Date().toISOString();

  // 차년도 조직도 부서 관리(후임 설정) 및 교원 업무 배정표에서 인수자 정보 탐색
  let successorEmail = current.targetSuccessorEmail || '';
  let successorName = current.targetSuccessorName || '';

  const { getOrgStructure } = await import('@/lib/services/settingsService');
  const org = await getOrgStructure().catch(() => null);

  // 작성자 소속 부서: 문서에 비어 있으면 조직도(부서 관리) 기준으로 보강 (교무부장·교감 화면 '부서 미지정' 방지)
  const authorDepartment =
    (current.authorDepartment || '').trim() || resolveFacultyDepartment(authorProfile, org);

  if (!successorEmail) {
    const [assignments, allFaculty] = await Promise.all([
      getTeacherAssignments(year).catch(() => []),
      getUsersDirectory().catch(() => []),
    ]);

    const resolved = await resolveSuccessorForHandover(
      authorProfile.email,
      current.primaryDuty,
      org,
      assignments,
      allFaculty
    );

    if (resolved && resolved.email) {
      successorEmail = resolved.email;
      successorName = resolved.name;
    }
  }

  // 인계자 날인: 프로필에 등록된 서명(도장) 이미지를 우선 사용하고, 없으면 성명 직인으로 대체
  const authorSignature = await resolveRegisteredSignature(authorProfile.email, authorProfile.name || current.authorName);

  // 인수자가 있으면 인수자 확인·서명을 먼저 받고(ASSIGNED_TO_SUCCESSOR), 없으면 교무부장 확인 대기(인수자 미정)로 보낸다.
  const newStatus: HandoverStatus = successorEmail ? 'ASSIGNED_TO_SUCCESSOR' : 'SUBMITTED_WAITING_SUCCESSOR';

  const updateData: Partial<HandoverDocument> = {
    status: newStatus,
    submittedAt: nowIso,
    updatedAt: nowIso,
    targetSuccessorEmail: successorEmail,
    targetSuccessorName: successorName,
    rejectionReason: '',
    revisionRequestReason: '',
    authorDepartment,
    authorSignature,
    // (재)제출 시 이전 인수자 확인·서명은 무효화한다. (내용이 바뀌었을 수 있음)
    successorChecked: false,
    successorCheckedAt: '',
    successorReviewedAt: '',
    successorSignature: '',
  };

  if (successorEmail) {
    updateData.assignedAt = current.assignedAt || nowIso;
  }

  await updateDoc(docRef, updateData);
  return { status: newStatus, assignedSuccessor: successorName || successorEmail };
}

/**
 * 교무부장 확인 완료 및 일괄 교감 최종 결재 상신
 * (SUBMITTED_WAITING_ACADEMIC_HEAD -> READY_FOR_VP_APPROVAL)
 */
export async function confirmAndForwardHandoversToVicePrincipal(
  docIds: string[],
  academicHeadProfile: UserProfile
): Promise<{ forwardedCount: number; forwardedIds: string[]; skippedIds: string[] }> {
  const uniqueIds = Array.from(new Set(docIds.map(id => (id || '').trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { forwardedCount: 0, forwardedIds: [], skippedIds: [] };
  }

  const db = getDb();
  const nowIso = new Date().toISOString();
  const headEmail = (academicHeadProfile.email || '').trim().toLowerCase();
  const headName = academicHeadProfile.name || '교무부장';

  // 최신 상태 재확인: 교무부장 대기 상태가 아니거나 인수자 서명 전인 문서는 상신하지 않는다.
  const snaps = await Promise.all(uniqueIds.map(id => getDoc(doc(db, HANDOVER_DOCS_COL, id))));
  const forwardableIds: string[] = [];
  const skippedIds: string[] = [];
  snaps.forEach((snap, idx) => {
    const data = snap.exists() ? (snap.data() as HandoverDocument) : null;
    if (data && isHandoverInAcademicHeadQueue(data.status) && !isHandoverAwaitingSuccessorSignature(data)) {
      forwardableIds.push(uniqueIds[idx]);
    } else {
      skippedIds.push(uniqueIds[idx]);
    }
  });

  const CHUNK_SIZE = 400;
  for (let i = 0; i < forwardableIds.length; i += CHUNK_SIZE) {
    const chunk = forwardableIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(docId => {
      batch.update(doc(db, HANDOVER_DOCS_COL, docId), {
        status: 'READY_FOR_VP_APPROVAL',
        academicHeadEmail: headEmail,
        academicHeadName: headName,
        academicHeadReviewedAt: nowIso,
        rejectionReason: '',
        revisionRequestReason: '',
        updatedAt: nowIso,
      });
    });
    await batch.commit();
  }

  return { forwardedCount: forwardableIds.length, forwardedIds: forwardableIds, skippedIds };
}

/**
 * 인수자 검토 및 서명 (ASSIGNED_TO_SUCCESSOR -> SUBMITTED_WAITING_ACADEMIC_HEAD)
 * 인수자 서명 후에는 교무부장 확인을 거쳐 교감 결재로 올라간다.
 */
export async function approveBySuccessor(
  docId: string,
  signature: string,
  comment: string,
  successorProfile: UserProfile
): Promise<void> {
  const db = getDb();
  const docRef = doc(db, HANDOVER_DOCS_COL, docId);
  const nowIso = new Date().toISOString();

  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('인수인계 문서를 찾을 수 없습니다.');
  assertSuccessorCanSign(snap.data() as HandoverDocument, successorProfile.email);
  if (!signature) throw new Error('인수자 서명이 필요합니다.');

  await updateDoc(docRef, {
    status: 'SUBMITTED_WAITING_ACADEMIC_HEAD',
    successorSignature: signature,
    successorComment: comment || '인수 확인 및 이상 없음',
    successorChecked: true,
    successorCheckedAt: nowIso,
    successorReviewedAt: nowIso,
    targetSuccessorEmail: successorProfile.email.trim().toLowerCase(),
    targetSuccessorName: successorProfile.name,
    updatedAt: nowIso,
  });
}

export interface ApproveHandoverResult {
  targetYear: number;
  driveArchived: boolean;
  fileUrl?: string;
  folderUrl?: string;
  archiveError?: string;
}

/**
 * 학년 말 인수인계서 결재완료 시 아카이빙될 차년도 학년도(예: 2026학년도 인계서 -> 2027)를 산출한다.
 */
export function resolveNextHandoverArchiveYear(docYear?: number | string): number {
  const numericYear = Number(docYear);
  if (Number.isFinite(numericYear) && numericYear >= 2000) {
    return numericYear + 1;
  }
  return CURRENT_SCHOOL_YEAR + 1;
}

/**
 * 교감 최종 승인 및 아카이빙 (SUCCESSOR_APPROVED -> VICE_PRINCIPAL_APPROVED / ARCHIVED)
 * - 결재완료 시점에 차년도(예: 2027학년도) Google Drive 루트·인수인계 폴더를 자동 생성하고
 *   결재완료 인수인계서 PDF를 해당 폴더에 영구 저장한다.
 */
export async function approveByVicePrincipal(
  docId: string,
  signature: string,
  comment: string,
  vpProfile: UserProfile
): Promise<ApproveHandoverResult> {
  const db = getDb();
  const docRef = doc(db, HANDOVER_DOCS_COL, docId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('인수인계 문서를 찾을 수 없습니다.');

  const currentDoc = { ...snap.data(), id: snap.id } as HandoverDocument;
  const nowIso = new Date().toISOString();
  const targetYear = resolveNextHandoverArchiveYear(currentDoc.year);
  const targetYearStr = String(targetYear);
  const vpEmailClean = vpProfile.email.trim().toLowerCase();
  const resolvedComment = comment || '최종 확인 및 결재 완료';

  // 인계자 서명은 프로필 등록 이미지로 보강 (제출 당시 서명이 저장되지 않은 문서 대응)
  const resolvedAuthorDoc = await withResolvedHandoverSignatures(currentDoc);
  const approvedSnapshotDoc: HandoverDocument = {
    ...resolvedAuthorDoc,
    status: 'VICE_PRINCIPAL_APPROVED',
    vicePrincipalEmail: vpEmailClean,
    vicePrincipalName: vpProfile.name,
    vicePrincipalSignature: signature,
    vicePrincipalComment: resolvedComment,
    vicePrincipalReviewedAt: nowIso,
  };

  // 최종 A4 서식 HTML 스냅샷 생성
  const htmlSnapshot = generateHandoverA4Html(approvedSnapshotDoc);

  await updateDoc(docRef, {
    status: 'VICE_PRINCIPAL_APPROVED',
    vicePrincipalEmail: vpEmailClean,
    vicePrincipalName: vpProfile.name,
    vicePrincipalSignature: signature,
    vicePrincipalComment: resolvedComment,
    vicePrincipalReviewedAt: nowIso,
    archivedAt: nowIso,
    archivedTargetYear: targetYear,
    archivedFolderUrl: currentDoc.folderUrl || '',
    archivedPdfSnapshot: htmlSnapshot,
    ...(resolvedAuthorDoc.authorSignature && resolvedAuthorDoc.authorSignature !== currentDoc.authorSignature
      ? { authorSignature: resolvedAuthorDoc.authorSignature }
      : {}),
    updatedAt: nowIso,
  });

  // Google Drive 차년도 인수인계 폴더 생성 및 PDF 자동 저장 (실패 시 결재 승인 자체는 유지)
  let driveArchived = false;
  let archivedFileUrl: string | undefined;
  let archivedFolderUrl: string | undefined;
  let archiveError: string | undefined;

  try {
    const { getGoogleDriveConfig, saveGoogleDriveConfig } = await import('@/lib/services/settingsService');
    const driveConfig = await getGoogleDriveConfig().catch(() => null);

    if (driveConfig?.enabled || driveConfig?.rootFolderId) {
      // 화면 [A4 인쇄]와 동일한 레이아웃의 PDF를 브라우저에서 렌더링 (실패 시 서버 Docs 변환으로 폴백)
      let pdfBase64: string | undefined;
      try {
        const { renderA4HtmlToPdfBase64 } = await import('@/lib/handover/a4HtmlPdfRenderer');
        pdfBase64 = await renderA4HtmlToPdfBase64(htmlSnapshot);
      } catch (renderErr) {
        console.warn('[HandoverService] A4 PDF 렌더링 실패, 서버 변환으로 대체:', renderErr);
      }

      const controller = new AbortController();
      // PDF 변환·업로드는 20초 이상 걸릴 수 있다. (서버가 문서에 Drive 메타를 직접 기록하므로 시간 초과 시에도 링크는 보존됨)
      const timer = setTimeout(() => controller.abort(), 90000);
      try {
        const res = await fetch('/api/drive/archive-handover', {
          method: 'POST',
          headers: await buildStaffApiHeaders(),
          signal: controller.signal,
          body: JSON.stringify({
            docId: currentDoc.id,
            docData: approvedSnapshotDoc,
            htmlContent: htmlSnapshot,
            pdfBase64,
            targetYear: targetYearStr,
            rootFolderId: driveConfig?.rootFolderId,
            existingYearFolders: driveConfig?.yearlyFolders?.[targetYearStr] || null,
          }),
        });
        const resData = await res.json().catch(() => null);

        if (res.ok && resData?.success && resData?.file?.id) {
          driveArchived = true;
          archivedFileUrl = resData.file.webViewLink;
          archivedFolderUrl = resData.file.folderUrl;

          await updateDoc(docRef, {
            archivedTargetYear: targetYear,
            archivedDriveFileId: resData.file.id,
            archivedDriveFileUrl: archivedFileUrl || '',
            archivedDriveFolderId: resData.file.folderId || '',
            archivedDriveFolderUrl: archivedFolderUrl || '',
            archivedFolderUrl: archivedFolderUrl || currentDoc.folderUrl || '',
            updatedAt: new Date().toISOString(),
          }).catch(err => {
            console.warn('[HandoverService] 인수인계서 Drive 메타 저장 경고:', err);
          });

          if (resData.yearFolders && driveConfig) {
            const existingTargetYf = driveConfig.yearlyFolders?.[targetYearStr];
            await saveGoogleDriveConfig(
              {
                ...driveConfig,
                yearlyFolders: {
                  ...(driveConfig.yearlyFolders || {}),
                  [targetYearStr]: {
                    ...(existingTargetYf || {}),
                    ...resData.yearFolders,
                    departmentFolders: {
                      ...(existingTargetYf?.departmentFolders || {}),
                      ...(resData.yearFolders.departmentFolders || {}),
                    },
                  },
                },
              },
              vpProfile.email || vpProfile.name
            ).catch(err => {
              console.warn('[HandoverService] Google Drive 차년도 폴더 설정 동기화 경고:', err);
            });
          }
        } else {
          archiveError = resData?.error || `Drive 저장 응답 오류 (${res.status})`;
        }
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (err: any) {
    archiveError = err?.message || 'Google Drive 연동 중 네트워크 오류가 발생했습니다.';
    console.warn('[HandoverService] 차년도 인수인계 폴더 자동 저장 경고(결재는 완료됨):', err);
  }

  // 주의: 교감 결재 1건으로 학년도 전체 인수인계를 잠그지 않는다.
  // (다른 교사의 작성·제출이 막히므로) 마감은 교무부장/관리자가 [잠그기] 토글로 수동 처리한다.

  return {
    targetYear,
    driveArchived,
    fileUrl: archivedFileUrl,
    folderUrl: archivedFolderUrl,
    archiveError,
  };
}

export interface BatchApproveHandoverResult {
  totalRequested: number;
  approvedCount: number;
  driveArchivedCount: number;
  failedIds: string[];
  driveErrors: Array<{ docId: string; error: string }>;
  targetYear: number;
}

/**
 * 교감이 선택한(또는 대기 중인 전체) 인수인계서를 한 번에 일괄 최종 결재 및 Drive 아카이빙한다.
 * 차년도 폴더 생성 충돌을 방지하기 위해 순차적으로 안전하게 처리한다.
 */
export async function batchApproveByVicePrincipal(
  docIds: string[],
  signature: string,
  comment: string,
  vpProfile: UserProfile,
  onProgress?: (completed: number, total: number) => void
): Promise<BatchApproveHandoverResult> {
  const uniqueIds = Array.from(new Set(docIds.map(id => (id || '').trim()).filter(Boolean)));
  let approvedCount = 0;
  let driveArchivedCount = 0;
  const failedIds: string[] = [];
  const driveErrors: Array<{ docId: string; error: string }> = [];
  let targetYear = resolveNextHandoverArchiveYear(CURRENT_SCHOOL_YEAR);

  for (let i = 0; i < uniqueIds.length; i++) {
    const id = uniqueIds[i];
    try {
      const res = await approveByVicePrincipal(id, signature, comment, vpProfile);
      targetYear = res.targetYear;
      approvedCount += 1;
      if (res.driveArchived) {
        driveArchivedCount += 1;
      } else if (res.archiveError) {
        driveErrors.push({ docId: id, error: res.archiveError });
      }
    } catch (err: any) {
      failedIds.push(id);
      driveErrors.push({ docId: id, error: err?.message || '결재 처리 중 오류' });
    }
    onProgress?.(i + 1, uniqueIds.length);
  }

  return {
    totalRequested: uniqueIds.length,
    approvedCount,
    driveArchivedCount,
    failedIds,
    driveErrors,
    targetYear,
  };
}

// ─── 3. 전체 교원 업무 매핑 및 인수자 라우팅 ────────────────────

/**
 * 특정 학년도 교원 업무 배정표 조회
 */
export async function getTeacherAssignments(
  year: number = CURRENT_SCHOOL_YEAR
): Promise<TeacherAssignment[]> {
  const db = getDb();
  const q = query(
    collection(db, TEACHER_ASSIGNMENTS_COL),
    where('year', '==', year)
  );
  const snap = await getDocs(q);
  const list: TeacherAssignment[] = [];
  snap.forEach(d => {
    list.push({ ...d.data(), id: d.id } as TeacherAssignment);
  });

  return list.sort((a, b) => (a.teacherName || '').localeCompare(b.teacherName || ''));
}

/**
 * 교원 업무 배정 단건 저장
 */
export async function saveTeacherAssignment(
  assignment: TeacherAssignment
): Promise<void> {
  const db = getDb();
  const cleanEmail = assignment.teacherEmail.trim().toLowerCase();
  const docId = `${assignment.year}_${cleanEmail}`;
  const docRef = doc(db, TEACHER_ASSIGNMENTS_COL, docId);

  await setDoc(docRef, {
    ...assignment,
    id: docId,
    teacherEmail: cleanEmail,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * 교원 업무 배정 일괄 저장
 */
export async function saveTeacherAssignmentsBulk(
  assignments: TeacherAssignment[]
): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  const nowIso = new Date().toISOString();

  assignments.forEach(a => {
    const cleanEmail = a.teacherEmail.trim().toLowerCase();
    const docId = `${a.year}_${cleanEmail}`;
    const docRef = doc(db, TEACHER_ASSIGNMENTS_COL, docId);
    batch.set(docRef, {
      ...a,
      id: docId,
      teacherEmail: cleanEmail,
      updatedAt: nowIso,
    }, { merge: true });
  });

  await batch.commit();
}

/**
 * 조직도 부서 관리(후임 설정: successorHeadEmail, memberSuccessors) 및
 * 차년도 교원 배정표(TeacherAssignment)를 종합 조회하여 인계 대상 주업무의 인수자를 자동 결정
 */
export async function resolveSuccessorForHandover(
  authorEmail: string,
  primaryDuty: string,
  org?: Partial<OrgStructure> | null,
  cachedAssignments?: TeacherAssignment[],
  cachedFaculty?: UserProfile[]
): Promise<{ email: string; name: string } | null> {
  const authorEmailClean = (authorEmail || '').trim().toLowerCase();
  if (!authorEmailClean) return null;

  // 1. [최우선] 시스템 설정 > 조직도 > 부서 관리 (후임 설정) 확인
  if (org?.departments && org.departments.length > 0) {
    for (const dept of org.departments) {
      // 1-1. 작성자가 해당 부서의 부장인 경우 -> 후임 부장(successorHeadEmail)
      const headEmailClean = (dept.headEmail || '').trim().toLowerCase();
      if (headEmailClean === authorEmailClean && dept.successorHeadEmail) {
        const succEmail = dept.successorHeadEmail.trim().toLowerCase();
        const succUser = cachedFaculty?.find(f => f.email?.trim().toLowerCase() === succEmail);
        return {
          email: succEmail,
          name: succUser?.name || succEmail
        };
      }

      // 1-2. 작성자가 해당 부서의 소속 부원인 경우 -> memberSuccessors 매핑 확인
      if (dept.memberSuccessors) {
        for (const [memberKey, succEmail] of Object.entries(dept.memberSuccessors)) {
          if (memberKey.trim().toLowerCase() === authorEmailClean && succEmail) {
            const cleanSucc = succEmail.trim().toLowerCase();
            const succUser = cachedFaculty?.find(f => f.email?.trim().toLowerCase() === cleanSucc);
            return {
              email: cleanSucc,
              name: succUser?.name || cleanSucc
            };
          }
        }
      }
    }
  }

  // 2. [차선] 교원 업무 배정표(TeacherAssignment) 확인
  const assignments = cachedAssignments || await getTeacherAssignments();
  const authorAssignment = assignments.find(
    a => a.teacherEmail.trim().toLowerCase() === authorEmailClean
  );

  // 2-1. 업무별 지정 인수자 매핑
  const perDutyEmail = authorAssignment?.dutySuccessors?.[primaryDuty]?.trim().toLowerCase();
  if (perDutyEmail) {
    const matched = assignments.find(a => a.teacherEmail.trim().toLowerCase() === perDutyEmail) ||
      cachedFaculty?.find(f => f.email?.trim().toLowerCase() === perDutyEmail);
    if (matched) {
      return {
        email: perDutyEmail,
        name: (matched as any).teacherName || (matched as any).name || perDutyEmail
      };
    }
  }

  // 2-2. 차년도에 동일 주업무를 배정받은 타 교원
  const matchedByDuty = assignments.find(
    a =>
      a.teacherEmail.trim().toLowerCase() !== authorEmailClean &&
      [a.primaryDuty, ...(a.subDuties || [])].some(d => isSameHandoverDuty(d, primaryDuty))
  );
  if (matchedByDuty) {
    return {
      email: matchedByDuty.teacherEmail.trim().toLowerCase(),
      name: matchedByDuty.teacherName
    };
  }

  // 2-3. 교원 단위 차년도 명시적 인수자
  if (authorAssignment?.successorEmail) {
    const cleanSucc = authorAssignment.successorEmail.trim().toLowerCase();
    const matched = assignments.find(a => a.teacherEmail.trim().toLowerCase() === cleanSucc) ||
      cachedFaculty?.find(f => f.email?.trim().toLowerCase() === cleanSucc);
    if (matched) {
      return {
        email: cleanSucc,
        name: (matched as any).teacherName || (matched as any).name || cleanSucc
      };
    }
  }

  return null;
}

/**
 * 인수자가 전달받은 인수인계서를 수신 확인 완료 처리
 */
export async function markHandoverSuccessorChecked(
  docId: string,
  successorEmail: string,
  successorName?: string
): Promise<void> {
  const db = getDb();
  const docRef = doc(db, HANDOVER_DOCS_COL, docId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('인수인계 문서를 찾을 수 없습니다.');
  const current = snap.data() as HandoverDocument;
  assertSuccessorCanSign(current, successorEmail);

  // 인수자 서명: 등록된 실제 서명이 있으면 사용, 없으면 성명 직인 도장 (비품 인수인계와 동일 규칙)
  const nameKey = (successorName || current.targetSuccessorName || '').trim();
  let successorSignature = '';
  try {
    const sigMap = await getTeacherSignaturesDirectory();
    const emailKey = (successorEmail || '').trim().toLowerCase();
    const registeredSig = (emailKey && sigMap[emailKey]) || (nameKey && sigMap[nameKey]) || null;
    successorSignature = isActualSignature(registeredSig)
      ? registeredSig!
      : getTeacherStampSignature(nameKey || '교사');
  } catch {
    successorSignature = getTeacherStampSignature(nameKey || '교사');
  }

  const nowIso = new Date().toISOString();
  await updateDoc(docRef, {
    status: 'SUBMITTED_WAITING_ACADEMIC_HEAD',
    successorChecked: true,
    successorCheckedAt: nowIso,
    successorReviewedAt: nowIso,
    successorSignature,
    successorComment: current.successorComment || '인수 확인 및 이상 없음',
    updatedAt: nowIso,
  });
}

/**
 * 인수자 확인·서명 가능 여부 검증: 본인이 지정 인수자이고, 아직 서명 전이며, 교무부장 상신 전 단계여야 한다.
 */
function assertSuccessorCanSign(current: HandoverDocument, signerEmail: string): void {
  const target = (current.targetSuccessorEmail || '').trim().toLowerCase();
  const signer = (signerEmail || '').trim().toLowerCase();
  if (!target || target !== signer) {
    throw new Error('이 인수인계서의 지정 인수자만 확인·서명할 수 있습니다.');
  }
  if (current.successorChecked) {
    throw new Error('이미 인수 확인·서명이 완료된 인수인계서입니다.');
  }
  if (!isHandoverInAcademicHeadQueue(current.status)) {
    throw new Error('현재 단계에서는 인수 확인·서명을 할 수 없습니다.');
  }
}

/**
 * 로그인한 인수자에게 전달된 미확인 인수인계서 목록 조회
 */
export async function getUncheckedHandoversForSuccessor(
  successorEmail: string,
  year: number = CURRENT_SCHOOL_YEAR
): Promise<HandoverDocument[]> {
  const db = getDb();
  const normalizedEmail = (successorEmail || '').trim().toLowerCase();
  const q = query(
    collection(db, HANDOVER_DOCS_COL),
    where('targetSuccessorEmail', '==', normalizedEmail)
  );
  const snap = await getDocs(q);
  const docs: HandoverDocument[] = [];
  snap.forEach(d => {
    const data = d.data() as HandoverDocument;
    if ((data as any).isFixture) return;
    if (!year || data.year === year) {
      if (isHandoverAwaitingSuccessorSignature(data)) {
        docs.push({ ...data, id: d.id });
      }
    }
  });
  return docs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

/**
 * 신규 학년도 배정표 및 조직도 부서 관리(후임 설정)에 따라 대기 중인 인계서에 차년도 인수자 정보를 일괄 매핑 실행
 */
export async function routePendingHandoversToSuccessors(
  year: number = CURRENT_SCHOOL_YEAR
): Promise<{ routedCount: number; routedDocs: string[] }> {
  const db = getDb();
  const { getOrgStructure } = await import('@/lib/services/settingsService');
  const [assignments, org, allFaculty] = await Promise.all([
    getTeacherAssignments(year).catch(() => []),
    getOrgStructure().catch(() => null),
    getUsersDirectory().catch(() => []),
  ]);

  const q = query(
    collection(db, HANDOVER_DOCS_COL),
    where('year', '==', year),
    where('status', 'in', [
      'SUBMITTED_WAITING_ACADEMIC_HEAD',
      'SUBMITTED_WAITING_SUCCESSOR',
      'READY_FOR_VP_APPROVAL',
    ])
  );
  const snap = await getDocs(q);
  const routedDocs: string[] = [];
  const nowIso = new Date().toISOString();

  for (const docSnap of snap.docs) {
    const hDoc = docSnap.data() as HandoverDocument;
    if ((hDoc as any).isFixture) continue;

    const resolved = await resolveSuccessorForHandover(
      hDoc.authorEmail,
      hDoc.primaryDuty,
      org,
      assignments,
      allFaculty
    );

    if (resolved && resolved.email) {
      // 교무부장 상신 전이고 인수자 서명 전인 문서는 인수자 확인·서명 단계로 보낸다.
      const nextStatus: HandoverStatus =
        hDoc.status !== 'READY_FOR_VP_APPROVAL' && !hDoc.successorChecked
          ? 'ASSIGNED_TO_SUCCESSOR'
          : hDoc.status;
      await updateDoc(docSnap.ref, {
        targetSuccessorEmail: resolved.email,
        targetSuccessorName: resolved.name,
        status: nextStatus,
        assignedAt: hDoc.assignedAt || nowIso,
        updatedAt: nowIso,
      });
      routedDocs.push(`${hDoc.primaryDuty} (${hDoc.authorName} → ${resolved.name})`);
    }
  }

  return { routedCount: routedDocs.length, routedDocs };
}

// ─── 4. 인수인계 요청 팝업 / 공지 ────────────────────────────────

/**
 * 인수인계 공지 팝업 상태 조회
 */
export async function getHandoverNotice(): Promise<HandoverNotice | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, SETTINGS_COL, 'handover_notice'));
  if (!snap.exists()) return null;
  return snap.data() as HandoverNotice;
}

/**
 * 교무부장: 전 교원 대상 '학년 말 인수인계 작성 요청' 팝업 발송 트리거
 */
export async function triggerHandoverNotice(
  noticeData: { title?: string; message?: string; year?: number },
  senderProfile: UserProfile
): Promise<void> {
  const db = getDb();
  const payload: HandoverNotice = {
    active: true,
    year: noticeData.year || CURRENT_SCHOOL_YEAR,
    title: noticeData.title || `[학년 말 인수인계] ${noticeData.year || CURRENT_SCHOOL_YEAR}학년도 업무 인수인계서 작성 요청`,
    message:
      noticeData.message ||
      '2026학년도 학년 말 교원 업무 인수인계를 진행합니다. 일년간 기안기로 작성된 업무 기록을 불러와 시기별로 정리하고 전년도 업무 폴더를 연결하여 기한 내 제출해 주시기 바랍니다.',
    requestedByEmail: senderProfile.email,
    requestedByName: senderProfile.name,
    requestedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, SETTINGS_COL, 'handover_notice'), payload);
}

/**
 * 인수인계 팝업 닫기 및 오늘 하루 보지 않기 (로컬 스토리지 연동)
 */
export function dismissHandoverNoticeForToday(email: string, year: number): void {
  if (typeof window === 'undefined') return;
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const key = `kis_handover_dismiss_${(email || '').trim().toLowerCase()}_${year}_${todayStr}`;
  localStorage.setItem(key, 'true');
}

/**
 * 오늘 팝업이 이미 무시되었는지 확인
 */
export function isHandoverNoticeDismissedToday(email: string, year: number): boolean {
  if (typeof window === 'undefined') return false;
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const key = `kis_handover_dismiss_${(email || '').trim().toLowerCase()}_${year}_${todayStr}`;
  return localStorage.getItem(key) === 'true';
}

// ─── 5. A4 규격 인쇄 및 아카이브 HTML 스냅샷 생성기 ────────────

function escapeHandoverHtml(text?: string | number | null): string {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatHandoverDate(iso?: string | null): string {
  if (!iso) return '';
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.replace(/-/g, '.') : '';
}

/**
 * 프로필(users.signature)에 등록된 서명/도장 이미지를 찾는다. 없으면 성명 직인(자동 생성)을 반환.
 */
async function resolveRegisteredSignature(email?: string, name?: string): Promise<string> {
  try {
    const sigMap = await getTeacherSignaturesDirectory();
    const emailKey = (email || '').toLowerCase().trim();
    const nameKey = (name || '').trim();
    const registered = (emailKey && sigMap[emailKey]) || (nameKey && sigMap[nameKey]) || '';
    if (isActualSignature(registered)) return registered;
  } catch (e) {
    console.warn('[HandoverService] 등록 서명 조회 경고:', e);
  }
  return getTeacherStampSignature(name || '교사');
}

/**
 * 인쇄·PDF 출력 직전에 인계자 서명을 프로필 등록 이미지로 보강한다.
 * (제출 당시 서명이 저장되지 않은 기존 문서, 또는 자동 직인만 저장된 문서 대응)
 */
export async function withResolvedHandoverSignatures(doc: HandoverDocument): Promise<HandoverDocument> {
  if (!doc.submittedAt || isActualSignature(doc.authorSignature)) return doc;
  const authorSignature = await resolveRegisteredSignature(doc.authorEmail, doc.authorName);
  return { ...doc, authorSignature };
}

export function generateHandoverA4Html(doc: HandoverDocument): string {
  const esc = escapeHandoverHtml;
  const itemsSorted = [...(doc.items || [])].sort(compareHandoverItemsAsc);
  const submittedDate = formatHandoverDate(doc.submittedAt) || format(new Date(), 'yyyy.MM.dd');
  const isVpApproved = doc.status === 'VICE_PRINCIPAL_APPROVED' || doc.status === 'ARCHIVED';

  // 결재칸 서명 이미지: 등록 서명이 있으면 그대로, 없으면 성명 직인(완료된 단계만)
  const signImg = (src: string | undefined, alt: string) =>
    src ? `<img class="sign-img" src="${src}" alt="${esc(alt)}" />` : '';
  const authorSign = doc.submittedAt
    ? signImg(
        isActualSignature(doc.authorSignature) ? doc.authorSignature : getTeacherStampSignature(doc.authorName || '교사'),
        '인계자 날인'
      )
    : '';
  const successorSign = doc.successorSignature
    ? signImg(doc.successorSignature, '인수자 서명')
    : '';
  const headSign = doc.academicHeadReviewedAt ? '<span class="sign-text">확인</span>' : '';
  const vpSign = doc.vicePrincipalSignature
    ? signImg(doc.vicePrincipalSignature, '교감 서명')
    : isVpApproved
      ? '<span class="sign-text">결재</span>'
      : '';

  const approvalRows = [
    { role: '인계자', name: doc.authorName, sign: authorSign, date: doc.submittedAt },
    { role: '인수자', name: doc.targetSuccessorName || '', sign: successorSign, date: doc.successorCheckedAt || doc.successorReviewedAt },
    { role: '교무부장', name: doc.academicHeadName || '', sign: headSign, date: doc.academicHeadReviewedAt },
    { role: '교감', name: doc.vicePrincipalName || '', sign: vpSign, date: isVpApproved ? doc.vicePrincipalReviewedAt : '' },
  ];

  const timelineRows =
    itemsSorted.length === 0
      ? `<tr><td colspan="5" class="empty">누적된 인계 항목이 없습니다.</td></tr>`
      : itemsSorted
          .map(item => {
            const when =
              item.sourceType === 'system_auto'
                ? item.scheduleLabel || item.period || '정기'
                : item.displayDateTime || item.date || '-';
            const fixedTag =
              item.sourceType === 'system_auto'
                ? `<span class="tag">고정${item.timingKind ? `·${esc(TIMING_KIND_LABELS[item.timingKind])}` : ''}</span> `
                : '';
            return `
        <tr>
          <td class="c b">${esc(item.period || '연간')}</td>
          <td class="c">${esc(when)}</td>
          <td class="c">${esc(item.category)}</td>
          <td>
            <div class="b">${fixedTag}${esc(item.documentTitle)}</div>
            ${item.docNo ? `<div class="sub">${esc(item.docNo)}</div>` : ''}
            ${item.folderUrl ? `<div class="sub"><a href="${esc(item.folderUrl)}" target="_blank">관련 폴더/문서 열기</a></div>` : ''}
          </td>
          <td>${esc(item.summary || '-')}</td>
        </tr>`;
          })
          .join('');

  // 귀임 교원 기재 사항 (한국 주소·원소속·재직기간 현황)
  const ri = doc.returningInfo;
  const returningHtml = ri
    ? `
  <div class="section">귀임 교원 인적 사항 및 재직기간 현황</div>
  <table class="info">
    <colgroup><col style="width: 18%" /><col style="width: 32%" /><col style="width: 18%" /><col style="width: 32%" /></colgroup>
    <tr><th>성명</th><td>${esc(doc.authorName)}</td><th>이메일</th><td>${esc(doc.authorEmail)}</td></tr>
    <tr><th>한국 주소</th><td colspan="3">${esc(ri.koreaAddress) || '<span class="muted">미기재</span>'}</td></tr>
    <tr><th>한국 원소속</th><td colspan="3">${esc(ri.koreaOriginalSchool) || '<span class="muted">미기재</span>'}</td></tr>
    <tr><th>재직기간</th><td colspan="3">${esc(formatServicePeriod(ri)) || '<span class="muted">미기재</span>'}</td></tr>
  </table>
  ${(ri.serviceYears || []).length > 0 ? `
  <table class="timeline" style="margin-top: 2mm;">
    <colgroup>
      <col style="width: 11%" /><col style="width: 9%" /><col style="width: 16%" /><col style="width: 18%" /><col style="width: 32%" /><col style="width: 14%" />
    </colgroup>
    <thead><tr><th>학년도</th><th>학년</th><th>담임학년-반<br/>(전담교과)</th><th>소속부서</th><th>담당 업무명</th><th>비고</th></tr></thead>
    <tbody>${(ri.serviceYears || [])
      .map(
        r => `<tr><td class="c b">${esc(r.schoolYear)}</td><td class="c">${esc(r.grade)}</td><td class="c">${esc(r.homeroom)}</td><td class="c">${esc(r.department)}</td><td class="c">${esc(r.duty)}</td><td class="c">${esc(r.note)}</td></tr>`
      )
      .join('')}
    </tbody>
  </table>` : ''}`
    : '';

  const authorLabel = `${esc(doc.authorName)}${doc.authorDepartment ? ` (${esc(doc.authorDepartment)})` : ''}`;
  const successorLabel = doc.targetSuccessorName
    ? `${esc(doc.targetSuccessorName)}${doc.targetSuccessorEmail ? ` <span class="sub">${esc(doc.targetSuccessorEmail)}</span>` : ''}`
    : '<span class="muted">미배정</span>';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${esc(doc.year)}학년도_${esc(doc.primaryDuty)}_업무인수인계서</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
      margin: 0 auto; padding: 0; max-width: 190mm; color: #111; background: #fff;
      font-size: 9.5pt; line-height: 1.45; word-break: keep-all; overflow-wrap: anywhere;
    }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #555; padding: 4px 6px; vertical-align: middle; }
    th { background: #f1f5f9; font-weight: bold; text-align: center; }
    a { color: #1d4ed8; text-decoration: underline; }
    .c { text-align: center; }
    .b { font-weight: bold; }
    .sub { font-size: 8pt; color: #64748b; }
    .muted { color: #94a3b8; }

    /* 머리말 + 결재란 */
    .head { width: 100%; border: none; margin-bottom: 5mm; }
    .head td { border: none; padding: 0; vertical-align: bottom; }
    .school { font-size: 10pt; font-weight: bold; color: #2471B2; letter-spacing: 0.5px; }
    .title { font-size: 19pt; font-weight: 900; letter-spacing: -0.5px; margin-top: 2mm; line-height: 1.25; }
    .approval { width: 100%; }
    .approval th, .approval td { border: 1px solid #333; text-align: center; padding: 0; }
    .approval .ap-label { background: #f1f5f9; font-weight: bold; font-size: 9pt; line-height: 1.6; }
    .approval .ap-role { padding: 3px 0; font-size: 8.5pt; line-height: 1.3; background: #f8fafc; }
    .approval .ap-sign { padding: 0; }
    .approval .ap-name { padding: 2px 0; font-size: 8pt; line-height: 1.3; }
    .approval .ap-date { padding: 1px 0 2px; font-size: 7.5pt; line-height: 1.3; color: #475569; }
    /* 서명칸은 고정 높이 블록 안에서 가운데 정렬 (PDF 캡처 시 행 높이가 흔들리지 않도록) */
    .sign-box { height: 17mm; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .sign-img { max-height: 14mm; max-width: 20mm; width: auto; height: auto; display: block; }
    .sign-text {
      display: flex; align-items: center; justify-content: center;
      border: 1.5px solid #c62828; color: #c62828; border-radius: 50%;
      width: 12mm; height: 12mm; line-height: 1; font-size: 9pt; font-weight: bold;
    }
    .sign-wait { color: #cbd5e1; font-size: 8pt; line-height: 1; }

    .section { font-size: 11pt; font-weight: bold; color: #1e293b; border-left: 3px solid #2471B2; padding-left: 6px; margin: 5mm 0 2mm; }
    .info th { width: 18%; }
    .timeline thead th { font-size: 9pt; }
    .timeline td { font-size: 9pt; vertical-align: top; }
    .timeline td.c { vertical-align: middle; }
    .timeline td.empty { text-align: center; color: #94a3b8; padding: 10px; }
    .tag { font-size: 7.5pt; color: #0369a1; background: #e0f2fe; padding: 0 3px; border-radius: 2px; font-weight: bold; }
    .guide-box { border: 1px solid #94a3b8; background: #f8fafc; padding: 6px 8px; white-space: pre-wrap; line-height: 1.55; }
    .footer-note { text-align: center; margin-top: 8mm; font-size: 10.5pt; line-height: 1.8; }
    .footer-note .org { font-size: 13pt; font-weight: bold; letter-spacing: 1px; margin-top: 3mm; }
    @media print {
      .no-print { display: none !important; }
      tr, td, th { page-break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <table class="head">
    <colgroup><col style="width: 44%" /><col style="width: 56%" /></colgroup>
    <tr>
      <td>
        <div class="school">호치민시한국국제학교</div>
        <div class="title">${esc(doc.year)}학년도<br/>업무 인수인계서</div>
      </td>
      <td>
        <table class="approval">
          <colgroup>
            <col style="width: 8%" /><col style="width: 23%" /><col style="width: 23%" /><col style="width: 23%" /><col style="width: 23%" />
          </colgroup>
          <tr>
            <th class="ap-label" rowspan="4">결<br/>재</th>
            ${approvalRows.map(r => `<th class="ap-role">${r.role}</th>`).join('')}
          </tr>
          <tr>${approvalRows.map(r => `<td class="ap-sign"><div class="sign-box">${r.sign || '<span class="sign-wait">대기</span>'}</div></td>`).join('')}</tr>
          <tr>${approvalRows.map(r => `<td class="ap-name">${esc(r.name) || '&nbsp;'}</td>`).join('')}</tr>
          <tr>${approvalRows.map(r => `<td class="ap-date">${formatHandoverDate(r.date) || '&nbsp;'}</td>`).join('')}</tr>
        </table>
      </td>
    </tr>
  </table>

  <table class="info">
    <colgroup><col style="width: 18%" /><col style="width: 32%" /><col style="width: 18%" /><col style="width: 32%" /></colgroup>
    <tr>
      <th>업무 구분</th>
      <td colspan="3" class="b">${esc(doc.primaryDuty)}${doc.subDuties?.length ? ` <span class="sub">(${esc(doc.subDuties.join(', '))})</span>` : ''}</td>
    </tr>
    <tr>
      <th>인계자 (전임)</th>
      <td>${authorLabel}</td>
      <th>인수자 (후임)</th>
      <td>${successorLabel}</td>
    </tr>
    <tr>
      <th>제출 일자</th>
      <td>${submittedDate}</td>
      <th>최종 결재 일자</th>
      <td>${isVpApproved ? formatHandoverDate(doc.vicePrincipalReviewedAt) : '<span class="muted">결재 대기</span>'}</td>
    </tr>
    <tr>
      <th>전년도 업무 폴더</th>
      <td colspan="3">${doc.folderUrl ? `<a href="${esc(doc.folderUrl)}" target="_blank">${esc(doc.folderUrl)}</a>` : '<span class="muted">등록된 업무 폴더 없음</span>'}</td>
    </tr>
    <tr>
      <th>전임자 연락처</th>
      <td colspan="3">${esc(doc.contactInfo || doc.authorEmail)}</td>
    </tr>
  </table>

  ${returningHtml}

  <div class="section">연간 업무 진행 이력 및 인계 타임라인 (${itemsSorted.length}건)</div>
  <table class="timeline">
    <colgroup>
      <col style="width: 11%" /><col style="width: 15%" /><col style="width: 12%" /><col style="width: 33%" /><col style="width: 29%" />
    </colgroup>
    <thead>
      <tr><th>시기</th><th>일자 / 처리 시기</th><th>분류</th><th>업무명 및 기안 문서</th><th>주요 인계 사항 / 팁</th></tr>
    </thead>
    <tbody>${timelineRows}
    </tbody>
  </table>

  ${doc.generalGuide ? `
  <div class="section">총괄 인계 사항 및 연간 운영 핵심 팁</div>
  <div class="guide-box">${esc(doc.generalGuide)}</div>` : ''}

  ${doc.successorComment || doc.vicePrincipalComment ? `
  <div class="section">검토 및 승인 의견</div>
  <table class="info">
    <colgroup><col style="width: 18%" /><col style="width: 82%" /></colgroup>
    ${doc.successorComment ? `<tr><th>인수자 의견</th><td>${esc(doc.successorComment)}</td></tr>` : ''}
    ${doc.vicePrincipalComment ? `<tr><th>교감 의견</th><td>${esc(doc.vicePrincipalComment)}</td></tr>` : ''}
  </table>` : ''}

  <div class="footer-note">
    위와 같이 ${esc(doc.year)}학년도 업무 일체를 성실히 인계·인수하였음을 확인합니다.
    <div class="org">호치민시한국국제학교장 귀하</div>
  </div>
</body>
</html>`;
}
