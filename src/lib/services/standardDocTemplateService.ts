import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { Attachment } from '@/lib/types';
import type { StandardDocTemplateOverride } from '@/lib/types/customDuty';

const COLLECTION_NAME = 'system_task_templates';
const LOCAL_STORAGE_PREFIX = 'kis_std_doc_tpl_v1_';
const INLINE_DATA_THRESHOLD_BYTES = 140_000;

export interface StandardDocCatalogEntry {
  key: string;
  label: string;
  dutyName: string;
}

export const STANDARD_DOC_TEMPLATE_CATALOG: StandardDocCatalogEntry[] = [
  { key: 'bus_doc_1', label: '스쿨버스 - 등하교 차량 지도 계획 수립', dutyName: '스쿨버스 운영 관리' },
  { key: 'bus_doc_2', label: '스쿨버스 - 안전 도우미(차장) 봉사시간 인정', dutyName: '스쿨버스 운영 관리' },
  { key: 'bus_doc_3', label: '스쿨버스 - 등교지도 수당 지급 청구', dutyName: '스쿨버스 운영 관리' },
  { key: 'safety_doc_1', label: '학생 안전교육 운영 계획 수립', dutyName: '학생 안전지도 관리' },
  { key: 'safety_doc_2', label: '재난 대피 훈련 실시 계획', dutyName: '학생 안전지도 관리' },
  { key: 'afterschool_plan', label: '방과후학교 운영 계획 승인', dutyName: '방과후학교 총괄 관리' },
  { key: 'afterschool_result', label: '방과후학교 결과 보고 및 수당 청구', dutyName: '방과후학교 총괄 관리' },
  { key: 'pe_event', label: '학교 체육 행사 운영 계획서', dutyName: '학교 체육/PAPS 관리' },
  { key: 'quick_general', label: '전결규정 - 기본 기안문', dutyName: '공통 공문서' },
  { key: 'quick_annual', label: '전결규정 - 연간계획공문', dutyName: '공통 공문서' },
  { key: 'quick_detail', label: '전결규정 - 세부계획공문', dutyName: '공통 공문서' },
  { key: 'quick_dept', label: '전결규정 - 부서업무공문', dutyName: '공통 공문서' },
];

export function encodeTemplateKeyToId(templateKey: string): string {
  const bytes = new TextEncoder().encode(templateKey.trim());
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `std_tpl__${hex.slice(0, 120)}`;
}

export function getStandardTemplateLabel(templateKey: string, fallbackName?: string): string {
  const found = STANDARD_DOC_TEMPLATE_CATALOG.find((item) => item.key === templateKey);
  if (found) return found.label;
  if (fallbackName) return fallbackName;
  if (templateKey.startsWith('custom_duty__')) return '커스텀 업무 표준 기안서';
  return templateKey;
}

/**
 * 대용량 Data URI 첨부파일을 Firebase Storage에 안전 업로드하여 Firestore 1MB 제한을 회피한다.
 */
export async function serializeAttachmentsForTemplate(
  attachments: Attachment[],
  storageFolder: string
): Promise<Attachment[]> {
  const results: Attachment[] = [];

  for (const att of attachments) {
    if (!att || !att.name) continue;
    const rawData = att.data || '';

    if (
      rawData.startsWith('data:') &&
      rawData.length > INLINE_DATA_THRESHOLD_BYTES
    ) {
      try {
        const res = await fetch(rawData);
        const blob = await res.blob();
        const safeName = att.name.replace(/[^\w.\-가-힣]/g, '_');
        const storageRef = ref(
          storage,
          `attachments/standard-templates/${storageFolder}/${Date.now()}_${safeName}`
        );
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        results.push({
          name: att.name,
          size: att.size || blob.size,
          data: url,
        });
        continue;
      } catch (err) {
        console.warn('[standardDocTemplateService] Storage upload fallback:', err);
      }
    }

    results.push({
      name: att.name,
      size: att.size || rawData.length,
      data: rawData,
    });
  }

  return results;
}

function readLocalCache(templateKey: string): StandardDocTemplateOverride | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${templateKey}`);
    if (!raw) return null;
    return JSON.parse(raw) as StandardDocTemplateOverride;
  } catch {
    return null;
  }
}

function writeLocalCache(templateKey: string, value: StandardDocTemplateOverride | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${LOCAL_STORAGE_PREFIX}${templateKey}`;
    if (!value) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // localStorage quota exceeded is non-fatal
  }
}

export async function loadStandardDocTemplateOverride(
  templateKey: string
): Promise<StandardDocTemplateOverride | null> {
  if (!templateKey?.trim()) return null;
  const docId = encodeTemplateKeyToId(templateKey);
  try {
    const snap = await getDoc(doc(db, COLLECTION_NAME, docId));
    if (snap.exists()) {
      const data = snap.data() as StandardDocTemplateOverride;
      if (data.kind === 'standard_doc_template') {
        const result: StandardDocTemplateOverride = { ...data, id: snap.id };
        writeLocalCache(templateKey, result);
        return result;
      }
    }
    return null;
  } catch (err) {
    console.warn('[standardDocTemplateService] Firestore read fallback to local cache:', err);
    return readLocalCache(templateKey);
  }
}

export interface SaveStandardDocOverrideParams {
  templateKey: string;
  templateName?: string;
  dutyName?: string;
  title: string;
  content: string;
  docType?: 'internal' | 'external' | 'teacher-afterschool' | 'volunteer';
  includeAttachments: boolean;
  attachments: Attachment[];
  updatedBy: string;
  updatedByName?: string;
}

export async function saveStandardDocTemplateOverride(
  params: SaveStandardDocOverrideParams
): Promise<StandardDocTemplateOverride> {
  const cleanKey = params.templateKey.trim();
  const docId = encodeTemplateKeyToId(cleanKey);

  const preparedAttachments = params.includeAttachments
    ? await serializeAttachmentsForTemplate(params.attachments || [], docId)
    : [];

  const payload: StandardDocTemplateOverride = {
    id: docId,
    kind: 'standard_doc_template',
    templateKey: cleanKey,
    templateName: getStandardTemplateLabel(cleanKey, params.templateName),
    dutyName: params.dutyName || STANDARD_DOC_TEMPLATE_CATALOG.find((c) => c.key === cleanKey)?.dutyName,
    title: params.title,
    content: params.content,
    docType: params.docType || 'internal',
    includeAttachments: params.includeAttachments,
    attachments: preparedAttachments,
    updatedAt: new Date().toISOString(),
    updatedBy: params.updatedBy,
    updatedByName: params.updatedByName,
  };

  await setDoc(doc(db, COLLECTION_NAME, docId), payload);
  writeLocalCache(cleanKey, payload);

  // 커스텀 업무 워크스페이스 소속 표준 기안문서인 경우 해당 워크스페이스 내 항목도 동기화
  if (cleanKey.startsWith('custom_duty__')) {
    await syncCustomWorkspaceDocFromTemplate(cleanKey, payload);
  }

  return payload;
}

async function syncCustomWorkspaceDocFromTemplate(
  templateKey: string,
  override: StandardDocTemplateOverride
): Promise<void> {
  // 형식: custom_duty__<workspaceId>__<docId>
  const parts = templateKey.split('__');
  if (parts.length < 3) return;
  const workspaceId = `${parts[1]}__${parts[2]}`;
  const docId = parts.slice(3).join('__');
  if (!docId) return;

  try {
    const wsRef = doc(db, COLLECTION_NAME, workspaceId);
    const snap = await getDoc(wsRef);
    if (!snap.exists()) return;
    const ws = snap.data() as any;
    const existingDocs: any[] = Array.isArray(ws.standardDocs) ? ws.standardDocs : [];
    const foundIdx = existingDocs.findIndex((d) => d.id === docId || d.templateKey === templateKey);
    const updatedDoc = {
      id: docId,
      templateKey,
      title: override.title,
      description: foundIdx >= 0 ? existingDocs[foundIdx].description : '표준 기안문서 기본값',
      content: override.content,
      docType: override.docType === 'external' ? 'external' : 'internal',
      attachments: override.includeAttachments
        ? override.attachments
        : (foundIdx >= 0 ? existingDocs[foundIdx].attachments || [] : []),
      isDefault: true,
      updatedAt: override.updatedAt,
      updatedBy: override.updatedBy,
      updatedByName: override.updatedByName,
    };
    const nextDocs =
      foundIdx >= 0
        ? existingDocs.map((d, idx) => (idx === foundIdx ? updatedDoc : d))
        : [...existingDocs, updatedDoc];
    await setDoc(
      wsRef,
      {
        standardDocs: nextDocs,
        updatedAt: override.updatedAt,
        updatedBy: override.updatedBy,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[standardDocTemplateService] Failed syncing workspace doc:', err);
  }
}

export async function resetStandardDocTemplateOverride(templateKey: string): Promise<void> {
  if (!templateKey?.trim()) return;
  const docId = encodeTemplateKeyToId(templateKey);
  await deleteDoc(doc(db, COLLECTION_NAME, docId));
  writeLocalCache(templateKey, null);
}

export async function listStandardDocTemplateOverrides(): Promise<StandardDocTemplateOverride[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as any))
      .filter((d) => d.kind === 'standard_doc_template');
  } catch (err) {
    console.warn('[standardDocTemplateService] list error:', err);
    return [];
  }
}

export function onStandardDocTemplateOverridesUpdate(
  callback: (items: StandardDocTemplateOverride[]) => void
): () => void {
  return onSnapshot(
    collection(db, COLLECTION_NAME),
    (snap) => {
      const items = snap.docs
        .map((d) => ({ ...d.data(), id: d.id } as any))
        .filter((d) => d.kind === 'standard_doc_template');
      callback(items);
    },
    (err) => {
      console.warn('[standardDocTemplateService] snapshot error:', err);
      callback([]);
    }
  );
}
