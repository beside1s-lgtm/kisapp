import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type {
  HandoverDutyTemplateAddedItem,
  HandoverDutyTemplateItemOverride,
  HandoverDutyTimelineTemplate,
  HandoverItem,
} from '@/lib/types/handover';
import {
  doesHandoverDutyTemplateMatchDuty,
  getSystemBlueprintByKey,
  inferHandoverTimingMetaFromPeriod,
  normalizeHandoverDutyTemplateCore,
  resolveSystemDutyKeysFromDuties,
} from '@/lib/handover/systemDutyBlueprints';

const SETTINGS_COLLECTION = 'settings';
const TEMPLATE_DOC_PREFIX = 'hd_tpl__';
const LOCAL_STORAGE_PREFIX = 'kis_hd_duty_tpl_v1__';

function toUtf8Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * 업무명을 결정적(Deterministic) 표준 템플릿 문서 ID로 변환한다.
 * 동일한 시스템 업무 별칭('스쿨버스' vs '스쿨버스 탑승 관리')이나 공백/관리 접미사 차이를 단일 ID로 통합한다.
 */
export function getHandoverDutyTemplateDocId(dutyName: string): string {
  const clean = (dutyName || '').trim();
  const sysKeys = resolveSystemDutyKeysFromDuties(clean ? [clean] : []);
  if (sysKeys.length === 1) {
    return `${TEMPLATE_DOC_PREFIX}sys_${sysKeys[0]}`;
  }
  const core = normalizeHandoverDutyTemplateCore(clean) || clean.toLowerCase() || 'default';
  return `${TEMPLATE_DOC_PREFIX}custom_${toUtf8Hex(core)}`;
}

function createEmptyTemplate(dutyName: string): HandoverDutyTimelineTemplate {
  const clean = (dutyName || '').trim();
  return {
    id: getHandoverDutyTemplateDocId(clean),
    dutyName: clean,
    normalizedDutyCore: normalizeHandoverDutyTemplateCore(clean),
    itemOverrides: {},
    hiddenSystemKeys: [],
    addedItems: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeLoadedTemplate(raw: Partial<HandoverDutyTimelineTemplate> & { id: string }): HandoverDutyTimelineTemplate {
  return {
    id: raw.id,
    dutyName: (raw.dutyName || '').trim(),
    normalizedDutyCore: raw.normalizedDutyCore || normalizeHandoverDutyTemplateCore(raw.dutyName || ''),
    itemOverrides: raw.itemOverrides && typeof raw.itemOverrides === 'object' ? { ...raw.itemOverrides } : {},
    hiddenSystemKeys: Array.isArray(raw.hiddenSystemKeys) ? Array.from(new Set(raw.hiddenSystemKeys)) : [],
    addedItems: Array.isArray(raw.addedItems) ? [...raw.addedItems] : [],
    updatedByEmail: raw.updatedByEmail,
    updatedByName: raw.updatedByName,
    updatedAt: raw.updatedAt,
  };
}

function writeLocalTemplate(tpl: HandoverDutyTimelineTemplate) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${tpl.id}`, JSON.stringify(tpl));
  } catch {
    // ignore storage quota errors
  }
}

function removeLocalTemplate(docId: string) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${docId}`);
  } catch {
    // ignore storage errors
  }
}

function readAllLocalTemplates(): HandoverDutyTimelineTemplate[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const list: HandoverDutyTimelineTemplate[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(LOCAL_STORAGE_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) {
        list.push(normalizeLoadedTemplate(parsed));
      }
    }
  } catch {
    // ignore corrupted local cache
  }
  return list;
}

/**
 * 선택된 업무 목록과 타임라인 항목의 dutyName/category를 대조하여 학습 대상 업무명을 결정한다.
 */
export function resolveDutyForHandoverItem(
  item: Pick<HandoverItem, 'dutyName' | 'category' | 'systemTaskKey'>,
  selectedDuties: string[]
): string {
  const cleanSelected = selectedDuties.map((d) => d.trim()).filter(Boolean);
  if (cleanSelected.length === 0) {
    return (item.dutyName || item.category || '').trim();
  }

  if (item.dutyName) {
    const matchedByDuty = cleanSelected.find((d) =>
      doesHandoverDutyTemplateMatchDuty({ dutyName: item.dutyName!, normalizedDutyCore: '' }, d)
    );
    if (matchedByDuty) return matchedByDuty;
  }

  if (item.category && item.category !== '수동추가' && item.category !== '수동 추가') {
    const matchedByCategory = cleanSelected.find((d) =>
      doesHandoverDutyTemplateMatchDuty({ dutyName: item.category, normalizedDutyCore: '' }, d)
    );
    if (matchedByCategory) return matchedByCategory;
  }

  if (item.systemTaskKey) {
    const bp = getSystemBlueprintByKey(item.systemTaskKey);
    if (bp?.canonicalDutyName) {
      const matchedBp = cleanSelected.find((d) =>
        doesHandoverDutyTemplateMatchDuty({ dutyName: bp.canonicalDutyName, normalizedDutyCore: '' }, d)
      );
      if (matchedBp) return matchedBp;
    }
  }

  return cleanSelected[0];
}

function extractAddedIdFromItem(item: Pick<HandoverItem, 'customTemplateItemId' | 'systemTaskKey' | 'id'>): string {
  if (item.customTemplateItemId) return item.customTemplateItemId;
  if (item.systemTaskKey?.startsWith('tpl_added__')) {
    const parts = item.systemTaskKey.split('__');
    return parts.slice(2).join('__') || item.id;
  }
  return '';
}

/**
 * 단일 수정(applyEditedTimelineItem 결과)을 업무 표준 타임라인 템플릿에 순수 병합한다.
 */
export function mergeEditedItemIntoTemplatePure(
  currentTemplate: HandoverDutyTimelineTemplate | null,
  params: {
    dutyName: string;
    item: HandoverItem;
    updatedByEmail?: string;
    updatedByName?: string;
  }
): HandoverDutyTimelineTemplate {
  const base = currentTemplate
    ? normalizeLoadedTemplate(currentTemplate)
    : createEmptyTemplate(params.dutyName);
  const { item } = params;
  const now = new Date().toISOString();
  const timingMeta = inferHandoverTimingMetaFromPeriod(item.period || '정기 업무', item.timingKind);
  const cleanTitle = (item.documentTitle || '').trim();
  const cleanSummary = (item.summary || '').trim();
  const addedId = extractAddedIdFromItem(item);

  const next: HandoverDutyTimelineTemplate = {
    ...base,
    dutyName: base.dutyName || params.dutyName.trim(),
    normalizedDutyCore: base.normalizedDutyCore || normalizeHandoverDutyTemplateCore(params.dutyName),
    itemOverrides: { ...base.itemOverrides },
    hiddenSystemKeys: [...base.hiddenSystemKeys],
    addedItems: [...base.addedItems],
    updatedByEmail: params.updatedByEmail ?? base.updatedByEmail,
    updatedByName: params.updatedByName ?? base.updatedByName,
    updatedAt: now,
  };

  if (addedId) {
    const idx = next.addedItems.findIndex((a) => a.id === addedId);
    const updatedAdded: HandoverDutyTemplateAddedItem = {
      id: addedId,
      documentTitle: cleanTitle,
      category: (item.category && item.category !== '수동추가' ? item.category : next.dutyName).trim(),
      period: timingMeta.period,
      scheduleLabel: timingMeta.scheduleLabel,
      timingKind: timingMeta.timingKind,
      sortOrder: timingMeta.sortOrder,
      summary: cleanSummary,
      ...(item.folderUrl ? { folderUrl: item.folderUrl.trim() } : {}),
      updatedAt: now,
    };
    if (idx >= 0) {
      next.addedItems[idx] = updatedAdded;
    } else {
      next.addedItems.push(updatedAdded);
    }
    return next;
  }

  if (item.sourceType === 'system_auto' && item.systemTaskKey) {
    const sysKey = item.systemTaskKey;
    const overrideEntry: HandoverDutyTemplateItemOverride = {
      systemTaskKey: sysKey,
      period: timingMeta.period,
      scheduleLabel: timingMeta.scheduleLabel,
      timingKind: timingMeta.timingKind,
      sortOrder: timingMeta.sortOrder,
      documentTitle: cleanTitle,
      category: (item.category || next.dutyName).trim(),
      summary: cleanSummary,
      ...(item.folderUrl ? { folderUrl: item.folderUrl.trim() } : {}),
      updatedAt: now,
    };
    next.itemOverrides[sysKey] = overrideEntry;
    next.hiddenSystemKeys = next.hiddenSystemKeys.filter((k) => k !== sysKey);
    return next;
  }

  // 수동 항목이 이미 표준 연계 대상인 경우 추가 목록으로 병합
  if (item.sourceType === 'manual' && item.includeInDutyTemplate !== false && cleanTitle) {
    const newAddedId = item.customTemplateItemId || `usr_${item.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const existingIdx = next.addedItems.findIndex((a) => a.id === newAddedId);
    const addedEntry: HandoverDutyTemplateAddedItem = {
      id: newAddedId,
      documentTitle: cleanTitle,
      category: (item.category && item.category !== '수동추가' ? item.category : next.dutyName).trim(),
      period: timingMeta.period,
      scheduleLabel: timingMeta.scheduleLabel,
      timingKind: timingMeta.timingKind,
      sortOrder: timingMeta.sortOrder,
      summary: cleanSummary,
      ...(item.folderUrl ? { folderUrl: item.folderUrl.trim() } : {}),
      updatedAt: now,
    };
    if (existingIdx >= 0) {
      next.addedItems[existingIdx] = addedEntry;
    } else {
      next.addedItems.push(addedEntry);
    }
  }

  return next;
}

/**
 * 타임라인 항목 삭제/제외를 업무 표준 타임라인 템플릿에 순수 반영한다.
 */
export function mergeRemovedItemIntoTemplatePure(
  currentTemplate: HandoverDutyTimelineTemplate | null,
  params: {
    dutyName: string;
    item: HandoverItem;
    updatedByEmail?: string;
    updatedByName?: string;
  }
): HandoverDutyTimelineTemplate {
  const base = currentTemplate
    ? normalizeLoadedTemplate(currentTemplate)
    : createEmptyTemplate(params.dutyName);
  const { item } = params;
  const now = new Date().toISOString();
  const addedId = extractAddedIdFromItem(item);

  const next: HandoverDutyTimelineTemplate = {
    ...base,
    dutyName: base.dutyName || params.dutyName.trim(),
    normalizedDutyCore: base.normalizedDutyCore || normalizeHandoverDutyTemplateCore(params.dutyName),
    itemOverrides: { ...base.itemOverrides },
    hiddenSystemKeys: [...base.hiddenSystemKeys],
    addedItems: [...base.addedItems],
    updatedByEmail: params.updatedByEmail ?? base.updatedByEmail,
    updatedByName: params.updatedByName ?? base.updatedByName,
    updatedAt: now,
  };

  if (addedId) {
    next.addedItems = next.addedItems.filter((a) => a.id !== addedId);
    return next;
  }

  if (item.sourceType === 'system_auto' && item.systemTaskKey) {
    const sysKey = item.systemTaskKey;
    delete next.itemOverrides[sysKey];
    if (!next.hiddenSystemKeys.includes(sysKey)) {
      next.hiddenSystemKeys.push(sysKey);
    }
  }

  return next;
}

/**
 * 전체 저장된 업무 표준 타임라인 템플릿 조회 (Firestore 우선 + localStorage 폴백 병합)
 */
export async function getAllHandoverDutyTemplates(): Promise<HandoverDutyTimelineTemplate[]> {
  const localMap = new Map<string, HandoverDutyTimelineTemplate>();
  for (const t of readAllLocalTemplates()) {
    localMap.set(t.id, t);
  }

  try {
    const db = getDb();
    const snap = await getDocs(collection(db, SETTINGS_COLLECTION));
    const mergedMap = new Map<string, HandoverDutyTimelineTemplate>(localMap);
    snap.forEach((docSnap) => {
      if (!docSnap.id.startsWith(TEMPLATE_DOC_PREFIX)) return;
      const tpl = normalizeLoadedTemplate({
        ...(docSnap.data() as Partial<HandoverDutyTimelineTemplate>),
        id: docSnap.id,
      });
      mergedMap.set(tpl.id, tpl);
      writeLocalTemplate(tpl);
    });
    return Array.from(mergedMap.values());
  } catch {
    return Array.from(localMap.values());
  }
}

/**
 * 특정 업무명의 표준 타임라인 템플릿 단건 조회
 */
export async function getHandoverDutyTemplate(dutyName: string): Promise<HandoverDutyTimelineTemplate | null> {
  const docId = getHandoverDutyTemplateDocId(dutyName);
  try {
    const db = getDb();
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, docId));
    if (snap.exists()) {
      const tpl = normalizeLoadedTemplate({
        ...(snap.data() as Partial<HandoverDutyTimelineTemplate>),
        id: docId,
      });
      writeLocalTemplate(tpl);
      return tpl;
    }
  } catch {
    // fallback to localStorage
  }

  const locals = readAllLocalTemplates();
  return locals.find((t) => t.id === docId || doesHandoverDutyTemplateMatchDuty(t, dutyName)) || null;
}

/**
 * 업무 표준 타임라인 템플릿 목록 실시간 구독
 */
export function onHandoverDutyTemplatesUpdate(
  callback: (templates: HandoverDutyTimelineTemplate[]) => void
): Unsubscribe {
  const localInitial = readAllLocalTemplates();
  if (localInitial.length > 0) {
    callback(localInitial);
  }

  const db = getDb();
  return onSnapshot(
    collection(db, SETTINGS_COLLECTION),
    (snap) => {
      const list: HandoverDutyTimelineTemplate[] = [];
      snap.forEach((docSnap) => {
        if (!docSnap.id.startsWith(TEMPLATE_DOC_PREFIX)) return;
        const tpl = normalizeLoadedTemplate({
          ...(docSnap.data() as Partial<HandoverDutyTimelineTemplate>),
          id: docSnap.id,
        });
        list.push(tpl);
        writeLocalTemplate(tpl);
      });
      callback(list);
    },
    () => {
      callback(readAllLocalTemplates());
    }
  );
}

async function saveHandoverDutyTemplate(tpl: HandoverDutyTimelineTemplate): Promise<HandoverDutyTimelineTemplate> {
  const normalized = normalizeLoadedTemplate(tpl);
  writeLocalTemplate(normalized);
  try {
    const db = getDb();
    await setDoc(doc(db, SETTINGS_COLLECTION, normalized.id), normalized, { merge: false });
  } catch {
    // localStorage cache keeps working offline
  }
  return normalized;
}

/**
 * 인라인 수정된 타임라인 항목을 해당 업무 표준 템플릿에 즉시 학습·저장한다.
 */
export async function recordEditedItemToDutyTemplate(params: {
  dutyName: string;
  item: HandoverItem;
  updatedByEmail?: string;
  updatedByName?: string;
}): Promise<HandoverDutyTimelineTemplate | null> {
  if (!params.dutyName.trim()) return null;
  // 특정 학년도 기안문/부서업무는 1회성 공문서이므로 고정 업무 템플릿으로 승격하지 않는다
  if (params.item.sourceType === 'approval' || params.item.sourceType === 'department_task') {
    return null;
  }
  const existing = await getHandoverDutyTemplate(params.dutyName);
  const next = mergeEditedItemIntoTemplatePure(existing, params);
  return saveHandoverDutyTemplate(next);
}

/**
 * 사용자가 수동 추가한 반복 업무 항목을 해당 업무 표준 템플릿에 즉시 학습·저장한다.
 */
export async function recordAddedManualItemToDutyTemplate(params: {
  dutyName: string;
  item: HandoverItem;
  updatedByEmail?: string;
  updatedByName?: string;
}): Promise<HandoverDutyTimelineTemplate | null> {
  if (!params.dutyName.trim() || !params.item.documentTitle?.trim()) return null;
  const existing = await getHandoverDutyTemplate(params.dutyName);
  const next = mergeEditedItemIntoTemplatePure(existing, {
    ...params,
    item: {
      ...params.item,
      includeInDutyTemplate: true,
    },
  });
  return saveHandoverDutyTemplate(next);
}

/**
 * 타임라인에서 삭제된 시스템 고정/사용자 추가 항목을 해당 업무 표준 템플릿에 반영한다.
 */
export async function recordRemovedItemToDutyTemplate(params: {
  dutyName: string;
  item: HandoverItem;
  updatedByEmail?: string;
  updatedByName?: string;
}): Promise<HandoverDutyTimelineTemplate | null> {
  if (!params.dutyName.trim()) return null;
  const isCustomAdded = Boolean(extractAddedIdFromItem(params.item));
  const isSystemAuto = params.item.sourceType === 'system_auto' && Boolean(params.item.systemTaskKey);
  if (!isCustomAdded && !isSystemAuto) return null;

  const existing = await getHandoverDutyTemplate(params.dutyName);
  if (!existing && isCustomAdded) return null;
  const next = mergeRemovedItemIntoTemplatePure(existing, params);
  return saveHandoverDutyTemplate(next);
}

/**
 * 현재 문서의 타임라인 수정 사항과 수동 추가 항목을 업무별 표준 템플릿으로 일괄 동기화한다.
 */
export async function syncHandoverDutyTemplatesFromTimeline(params: {
  selectedDuties: string[];
  items: HandoverItem[];
  dismissedSystemTaskKeys?: string[];
  includeAllManualItems?: boolean;
  updatedByEmail?: string;
  updatedByName?: string;
}): Promise<number> {
  const cleanDuties = params.selectedDuties.map((d) => d.trim()).filter(Boolean);
  if (cleanDuties.length === 0) return 0;

  const itemsByDuty = new Map<string, HandoverItem[]>();
  for (const d of cleanDuties) {
    itemsByDuty.set(d, []);
  }

  for (const item of params.items) {
    const resolvedDuty = resolveDutyForHandoverItem(item, cleanDuties);
    if (!resolvedDuty) continue;
    const bucket = itemsByDuty.get(resolvedDuty) || [];
    bucket.push(item);
    itemsByDuty.set(resolvedDuty, bucket);
  }

  let savedCount = 0;

  for (const [dutyName, dutyItems] of itemsByDuty.entries()) {
    const existing = await getHandoverDutyTemplate(dutyName);
    let working = existing ? normalizeLoadedTemplate(existing) : null;
    let mutated = false;

    for (const item of dutyItems) {
      if (item.sourceType === 'system_auto') {
        const isLearnedAdded = Boolean(extractAddedIdFromItem(item));
        if (item.userEdited || (isLearnedAdded && params.includeAllManualItems)) {
          working = mergeEditedItemIntoTemplatePure(working, {
            dutyName,
            item,
            updatedByEmail: params.updatedByEmail,
            updatedByName: params.updatedByName,
          });
          mutated = true;
        }
      } else if (item.sourceType === 'manual') {
        const shouldLearn = params.includeAllManualItems
          ? item.includeInDutyTemplate !== false
          : item.includeInDutyTemplate === true;
        if (shouldLearn) {
          working = mergeEditedItemIntoTemplatePure(working, {
            dutyName,
            item: { ...item, includeInDutyTemplate: true },
            updatedByEmail: params.updatedByEmail,
            updatedByName: params.updatedByName,
          });
          mutated = true;
        }
      }
    }

    // 해당 업무에 속한 시스템 제외 키 동기화
    for (const sysKey of params.dismissedSystemTaskKeys || []) {
      const bp = getSystemBlueprintByKey(sysKey);
      const belongsHere = bp?.canonicalDutyName
        ? doesHandoverDutyTemplateMatchDuty(
            { dutyName: bp.canonicalDutyName, normalizedDutyCore: '' },
            dutyName
          )
        : cleanDuties.length === 1;
      if (!belongsHere) continue;
      if (!working) working = createEmptyTemplate(dutyName);
      if (!working.hiddenSystemKeys.includes(sysKey)) {
        delete working.itemOverrides[sysKey];
        working.hiddenSystemKeys = [...working.hiddenSystemKeys, sysKey];
        working.updatedAt = new Date().toISOString();
        working.updatedByEmail = params.updatedByEmail ?? working.updatedByEmail;
        working.updatedByName = params.updatedByName ?? working.updatedByName;
        mutated = true;
      }
    }

    if (mutated && working) {
      await saveHandoverDutyTemplate(working);
      savedCount++;
    }
  }

  return savedCount;
}

/**
 * 특정 업무의 사용자 학습 표준 타임라인을 초기화하여 시스템 기본 청사진으로 복원한다.
 */
export async function resetHandoverDutyTemplate(dutyName: string): Promise<void> {
  const docId = getHandoverDutyTemplateDocId(dutyName);
  removeLocalTemplate(docId);
  try {
    const db = getDb();
    await deleteDoc(doc(db, SETTINGS_COLLECTION, docId));
  } catch {
    // ignore offline delete failures
  }
}

/**
 * 제외(숨김) 처리되었던 시스템 고정 업무들을 해당 업무 표준 템플릿에서 일괄 복원한다.
 */
export async function restoreHiddenKeysInDutyTemplates(selectedDuties: string[]): Promise<void> {
  const cleanDuties = selectedDuties.map((d) => d.trim()).filter(Boolean);
  for (const dutyName of cleanDuties) {
    const existing = await getHandoverDutyTemplate(dutyName);
    if (!existing || !existing.hiddenSystemKeys.length) continue;
    await saveHandoverDutyTemplate({
      ...existing,
      hiddenSystemKeys: [],
      updatedAt: new Date().toISOString(),
    });
  }
}

/**
 * 선택된 업무 목록에 매칭되는 학습 템플릿의 요약 카운트를 계산한다.
 */
export function summarizeDutyTemplateCustomizations(
  selectedDuties: string[],
  templates: HandoverDutyTimelineTemplate[]
): {
  matchedTemplates: HandoverDutyTimelineTemplate[];
  overrideCount: number;
  addedCount: number;
  hiddenCount: number;
  totalCustomCount: number;
} {
  const matchedTemplates = templates.filter((tpl) =>
    selectedDuties.some((d) => doesHandoverDutyTemplateMatchDuty(tpl, d))
  );
  let overrideCount = 0;
  let addedCount = 0;
  let hiddenCount = 0;
  for (const tpl of matchedTemplates) {
    overrideCount += Object.keys(tpl.itemOverrides || {}).length;
    addedCount += (tpl.addedItems || []).length;
    hiddenCount += (tpl.hiddenSystemKeys || []).length;
  }
  return {
    matchedTemplates,
    overrideCount,
    addedCount,
    hiddenCount,
    totalCustomCount: overrideCount + addedCount + hiddenCount,
  };
}
